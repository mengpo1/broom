// Cameras and camera rigs (cockpit, chase, close chase, trackside TV, free). A rig turns a car's
// visual pose into a view; the renderer only consumes the resulting Camera.

import { mat4Create, mat4LookAt, clamp, damp, lerp, angleDiff, transformPoint, transformDirection } from '../core/math.js';
import { CAR_GEOMETRY } from '../vehicles/car-mesh.js';

export const CAMERA_MODE = { COCKPIT: 0, CHASE: 1, CLOSE: 2, TV: 3, FREE: 4 };
export const CAMERA_MODE_COUNT = 4; // modes cycled by the player (free camera is separate)

export class Camera {
  constructor() {
    this.eye = new Float32Array(3);
    this.forward = new Float32Array([0, 0, -1]);
    this.right = new Float32Array([1, 0, 0]);
    this.up = new Float32Array([0, 1, 0]);
    this.viewMatrix = mat4Create();
    this.fovY = 1.05;
    this.near = 0.3;
    this.cut = false;
    this.noMotionBlur = false;
  }

  lookAt(ex, ey, ez, tx, ty, tz, ux = 0, uy = 1, uz = 0) {
    mat4LookAt(this.viewMatrix, ex, ey, ez, tx, ty, tz, ux, uy, uz);
    const m = this.viewMatrix;
    this.eye[0] = ex; this.eye[1] = ey; this.eye[2] = ez;
    this.right[0] = m[0]; this.right[1] = m[4]; this.right[2] = m[8];
    this.up[0] = m[1]; this.up[1] = m[5]; this.up[2] = m[9];
    this.forward[0] = -m[2]; this.forward[1] = -m[6]; this.forward[2] = -m[10];
  }
}

const tmp = new Float32Array(9);

export class CameraRig {
  constructor() {
    this.camera = new Camera();
    this.mode = CAMERA_MODE.COCKPIT;
    this.lastMode = -1;
    this.lastCar = -1;
    this.followHeading = 0;
    this.lookYaw = 0;
    this.shake = 0;
    this.shakePhase = 0;
    this.tvIndex = -1;
    this.free = { x: 0, y: 30, z: 0, yaw: 0, pitch: -0.3, fov: 1.0 };
    this.baseFov = 1.12;
  }

  /**
   * @param pose   visual pose of the followed car (see vehicles/car-visual.js)
   * @param car    simulation state of that car (read only)
   * @param world  { tvCameras, track }
   */
  update(dt, pose, car, world) {
    const cam = this.camera;
    cam.cut = this.mode !== this.lastMode || this.lastCar !== car.index || pose.teleported;
    cam.noMotionBlur = false;
    const speed = Math.abs(car.speed);
    const speedFactor = clamp(speed / 90, 0, 1);
    if (cam.cut) { this.followHeading = pose.heading; this.lookYaw = 0; }
    this.shakePhase += dt * (28 + speed * 0.5);
    const rough = car.surface >= 2 ? 1 : car.surface === 1 ? 0.6 : 0;
    const targetShake = (speedFactor * speedFactor * 0.25 + rough * Math.min(1, speed / 25) * 0.9) + pose.impact * 2.5;
    this.shake = damp(this.shake, targetShake, 10, dt);
    const sx = Math.sin(this.shakePhase * 1.31) * Math.sin(this.shakePhase * 0.73) * this.shake;
    const sy = Math.sin(this.shakePhase * 1.77 + 1.3) * this.shake;
    const m = pose.matrix;
    switch (this.mode) {
      case CAMERA_MODE.COCKPIT: {
        const e = CAR_GEOMETRY.eye;
        // the head leans slightly against acceleration and looks into the corner
        const lean = clamp(-pose.accelLat * 0.0011, -0.03, 0.03);
        const surge = clamp(-pose.accelLong * 0.0012, -0.035, 0.03);
        transformPoint(tmp, 0, m, e[0] + lean + sx * 0.006, e[1] + sy * 0.008, e[2] + surge);
        this.lookYaw = damp(this.lookYaw, clamp(car.steer * 0.07 + car.yawRate * 0.05, -0.16, 0.16), 6, dt);
        const c = Math.cos(this.lookYaw), s = Math.sin(this.lookYaw);
        transformDirection(tmp, 3, m, s, -0.1, -c);
        // keep part of the horizon level: blend the up vector between car and world
        transformDirection(tmp, 6, m, 0, 1, 0);
        cam.lookAt(tmp[0], tmp[1], tmp[2], tmp[0] + tmp[3], tmp[1] + tmp[4], tmp[2] + tmp[5], lerp(0, tmp[6], 0.6), lerp(1, tmp[7], 0.6), lerp(0, tmp[8], 0.6));
        cam.near = 0.09;
        cam.fovY = this.baseFov + speedFactor * 0.12;
        break;
      }
      case CAMERA_MODE.CHASE:
      case CAMERA_MODE.CLOSE: {
        const close = this.mode === CAMERA_MODE.CLOSE;
        this.followHeading += angleDiff(pose.heading, this.followHeading) * (1 - Math.exp(-(close ? 9 : 5.5) * dt));
        const back = close ? 4.6 : 7.4 + speedFactor * 1.2, height = close ? 1.45 : 2.5;
        const ch = Math.cos(this.followHeading), sh = Math.sin(this.followHeading);
        const ex = pose.x - ch * back + sx * 0.02, ez = pose.z - sh * back;
        const ey = pose.y + height + sy * 0.02;
        const ph = Math.cos(pose.heading), qh = Math.sin(pose.heading);
        cam.lookAt(ex, ey, ez, pose.x + ph * 5, pose.y + (close ? 0.75 : 0.9), pose.z + qh * 5);
        cam.near = 0.3;
        cam.fovY = (close ? 1.0 : 0.95) + speedFactor * 0.14;
        break;
      }
      case CAMERA_MODE.TV: {
        const list = world.tvCameras;
        const length = world.track.length;
        let best = this.tvIndex;
        const ahead = (c) => { let d = c.s - car.s; if (d > length / 2) d -= length; if (d < -length / 2) d += length; return d; };
        if (best < 0 || ahead(list[best]) < -70 || ahead(list[best]) > 330) {
          let bestD = 1e9;
          for (let i = 0; i < list.length; i++) { const d = ahead(list[i]); if (d > 30 && d < bestD) { bestD = d; best = i; } }
          if (best < 0) best = 0;
          if (best !== this.tvIndex) cam.cut = true;
          this.tvIndex = best;
        }
        const c = list[best];
        const dist = Math.hypot(c.x - pose.x, c.z - pose.z, c.y - pose.y);
        cam.lookAt(c.x, c.y, c.z, pose.x, pose.y + 0.5, pose.z);
        cam.near = 0.5;
        cam.fovY = clamp(2 * Math.atan(9 / Math.max(dist, 6)), 0.12, 0.9);
        break;
      }
      default: {
        const f = this.free;
        const cp = Math.cos(f.pitch);
        cam.lookAt(f.x, f.y, f.z, f.x + Math.cos(f.yaw) * cp, f.y + Math.sin(f.pitch), f.z + Math.sin(f.yaw) * cp);
        cam.near = 0.3;
        cam.fovY = f.fov;
      }
    }
    this.lastMode = this.mode;
    this.lastCar = car.index;
  }
}
