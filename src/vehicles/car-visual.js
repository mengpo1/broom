// Presentation layer for cars: interpolates simulation states to the render time, adds purely
// cosmetic body motion (roll, pitch, vibration, wheel spin, steering) and fills the renderer's
// instance array. Nothing here feeds back into the simulation.

import {
  mat4Create, mat4FromPose, mat4Translate, mat4RotateX, mat4RotateY, mat4RotateZ, lerp, damp, clamp, wrapAngle,
} from '../core/math.js';
import { CAR_GEOMETRY } from './car-mesh.js';
import { ALL_TEAMS } from './liveries.js';
import { CAR_STATE } from '../physics/car-physics.js';
import { MAX_CARS, CAR_INSTANCE_FLOATS, CAR_PART } from '../graphics/renderer.js';

const base = mat4Create(), part = mat4Create();

function writeRows(data, offset, m) {
  data[offset] = m[0]; data[offset + 1] = m[4]; data[offset + 2] = m[8]; data[offset + 3] = m[12];
  data[offset + 4] = m[1]; data[offset + 5] = m[5]; data[offset + 6] = m[9]; data[offset + 7] = m[13];
  data[offset + 8] = m[2]; data[offset + 9] = m[6]; data[offset + 10] = m[10]; data[offset + 11] = m[14];
}

export class CarVisuals {
  constructor() {
    this.poses = Array.from({ length: MAX_CARS }, () => ({
      x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, matrix: mat4Create(), speed: 0,
      accelLat: 0, accelLong: 0, bodyRoll: 0, bodyPitch: 0, drift: 0, impact: 0, teleported: true, visible: false,
      wheelSpin: 0, steerAngle: 0,
    }));
    this.count = 0;
    this.time = 0;
    this.slots = new Int32Array(7);
  }

  reset() { for (const p of this.poses) { p.teleported = true; p.bodyRoll = 0; p.bodyPitch = 0; p.drift = 0; p.impact = 0; } }

  /** Note an impact on a car (drives camera shake). */
  addImpact(index, strength) { const p = this.poses[index]; if (p) p.impact = Math.min(1, p.impact + strength); }

  /**
   * @param race   current race
   * @param alpha  interpolation factor between the previous and current simulation step (0..1)
   * @param dt     frame time in seconds
   * @param data   renderer.carInstanceData
   */
  update(race, alpha, dt, data) {
    const cars = race.cars, G = CAR_GEOMETRY;
    this.count = cars.length;
    this.time += dt;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i], pose = this.poses[i];
      const moved = Math.hypot(car.x - car.prevX, car.z - car.prevZ);
      const jumped = moved > 6;
      pose.teleported = pose.teleported || jumped;
      const a = jumped ? 1 : alpha;
      pose.x = lerp(car.prevX, car.x, a); pose.y = lerp(car.prevY, car.y, a); pose.z = lerp(car.prevZ, car.z, a);
      pose.heading = car.prevHeading + wrapAngle(car.heading - car.prevHeading) * a;
      pose.pitch = lerp(car.prevPitch, car.pitch, a);
      pose.speed = car.speed;
      pose.visible = !car.removed;
      const racing = car.state === CAR_STATE.RACING || car.state === CAR_STATE.RETIRED;
      pose.accelLat = damp(pose.accelLat, racing ? car.accelLat : 0, 9, dt);
      pose.accelLong = damp(pose.accelLong, racing ? car.accelLong : 0, 9, dt);
      pose.bodyRoll = clamp(pose.accelLat * 0.0011, -0.035, 0.035);
      pose.bodyPitch = clamp(-pose.accelLong * 0.0009, -0.02, 0.026);
      pose.drift = damp(pose.drift, racing ? clamp(Math.sign(car.yawRate) * car.slip * 0.09, -0.14, 0.14) : 0, 7, dt);
      pose.impact = Math.max(0, pose.impact - dt * 2.2);
      const speed = Math.abs(car.speed);
      const rough = car.surface >= 2 ? 0.02 : car.surface === 1 ? 0.012 : 0.0025;
      const buzz = Math.sin(this.time * 61 + i * 1.7) * rough * Math.min(1, speed / 40);
      pose.roll = pose.bodyRoll + buzz * 0.6;
      mat4FromPose(pose.matrix, pose.x, pose.y + Math.abs(buzz) * 0.5, pose.z, pose.heading + pose.drift, pose.pitch + pose.bodyPitch, pose.roll);

      const slotBody = (CAR_PART.BODY * MAX_CARS + i) * CAR_INSTANCE_FLOATS;
      const slotDriver = (CAR_PART.DRIVER * MAX_CARS + i) * CAR_INSTANCE_FLOATS;
      const slotSteer = (CAR_PART.STEERING * MAX_CARS + i) * CAR_INSTANCE_FLOATS;
      const slotFront = (CAR_PART.WHEEL_FRONT * MAX_CARS + i * 2) * CAR_INSTANCE_FLOATS;
      const slotRear = (CAR_PART.WHEEL_REAR * MAX_CARS + i * 2) * CAR_INSTANCE_FLOATS;
      const slots = this.slots;
      slots[0] = slotBody; slots[1] = slotDriver; slots[2] = slotSteer; slots[3] = slotFront; slots[4] = slotFront + CAR_INSTANCE_FLOATS; slots[5] = slotRear; slots[6] = slotRear + CAR_INSTANCE_FLOATS;
      // previous transforms (for motion vectors)
      for (let k = 0; k < 7; k++) data.copyWithin(slots[k] + 12, slots[k], slots[k] + 12);
      if (!pose.visible) { for (let k = 0; k < 7; k++) data.fill(0, slots[k], slots[k] + 24); continue; }

      writeRows(data, slotBody, pose.matrix);
      writeRows(data, slotDriver, pose.matrix);
      // steering wheel
      const sc = G.steeringCentre;
      mat4Translate(part, pose.matrix, sc[0], sc[1], sc[2]);
      mat4RotateX(part, part, -G.steeringTilt);
      pose.steerAngle = car.steer;
      mat4RotateZ(part, part, -car.steer * 1.9);
      writeRows(data, slotSteer, part);
      // wheels ride on the ground frame (no body roll / dive)
      mat4FromPose(base, pose.x, pose.y, pose.z, pose.heading + pose.drift, pose.pitch, 0);
      const lock = 0.3 / (1 + (speed / 30) ** 2) + 0.03;
      const frontSpin = -car.odometer / G.frontWheelRadius;
      const rearSpin = -(car.odometer / G.rearWheelRadius) - (pose.wheelSpin += car.wheelspin * 60 * dt);
      for (let w = 0; w < 4; w++) {
        const front = w < 2, side = w % 2 === 0 ? -1 : 1;
        mat4Translate(part, base, side * (front ? G.frontTrackHalf : G.rearTrackHalf), front ? G.frontWheelRadius : G.rearWheelRadius, front ? G.frontAxleZ : G.rearAxleZ);
        if (front) mat4RotateY(part, part, -car.steer * lock);
        mat4RotateX(part, part, front ? frontSpin : rearSpin);
        writeRows(data, (front ? slotFront : slotRear) + (w % 2) * CAR_INSTANCE_FLOATS, part);
      }
      if (pose.teleported) for (let k = 0; k < 7; k++) data.copyWithin(slots[k] + 12, slots[k], slots[k] + 12);

      // colours and parameters
      const team = ALL_TEAMS[car.teamIndex] || ALL_TEAMS[0];
      const ghost = car.ghostTimer > 0 || car.state === CAR_STATE.RESET ? 1 : 0;
      const rpm = clamp((car.rpm - 4000) / (car.params.spec.rpmMax - 4500), 0, 1);
      const blur = clamp((speed - 6) / 30, 0, 1);
      for (let k = 0; k < slots.length; k++) {
        const o = slots[k] + 24;
        data[o] = team.primary[0]; data[o + 1] = team.primary[1]; data[o + 2] = team.primary[2]; data[o + 3] = team.helmet[0];
        data[o + 4] = team.secondary[0]; data[o + 5] = team.secondary[1]; data[o + 6] = team.secondary[2]; data[o + 7] = team.helmet[1];
        data[o + 8] = team.accent[0]; data[o + 9] = team.accent[1]; data[o + 10] = team.accent[2]; data[o + 11] = team.helmet[2];
        data[o + 12] = car.driver.number; data[o + 13] = k >= 3 ? blur : rpm; data[o + 14] = team.pattern; data[o + 15] = ghost;
      }
    }
  }

  /** Call once the frame has been rendered. */
  endFrame() { for (let i = 0; i < this.count; i++) this.poses[i].teleported = false; }
}
