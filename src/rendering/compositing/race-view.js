// One on-screen view of the race (a player's cockpit, or an external camera): camera behaviour,
// projection and per-view uniforms. Reads simulation state, never writes it.

import { clamp, damp, wrapAngle, mod } from '../../core/math.js';
import { VIEW_CONFIG } from '../../core/config.js';
import { createProjection, updateProjection, focalForFov } from '../projection/road-projection.js';
import { createViewUniforms, set4, setColors, U } from './view-uniforms.js';
import { MAX_ROWS } from './renderer.js';
import { BACKDROP_PERIOD } from '../../art/environments/backdrop-rules.js';

export const CAMERA = { COCKPIT: 0, CHASE: 1, FRONT: 2, TRACKSIDE: 3 };

export class RaceView {
  constructor(index) {
    this.index = index;
    this.projection = createProjection(MAX_ROWS);
    this.uniforms = createViewUniforms();
    this.rect = { x: 0, y: 0, w: 1, h: 1 };
    this.camera = CAMERA.COCKPIT;
    this.carIndex = 0;
    this.cam = { s: 0, d: 0, eyeHeight: 1, yaw: 0, dir: 1, width: 1, height: 1, focal: 1, cx: 0, cy: 0, drawDistance: VIEW_CONFIG.drawDistance };
    this.yaw = 0; this.pitch = 0; this.dive = 0; this.stretch = 0;
    this.shakeX = 0; this.shakeY = 0; this.shakeAmp = 0; this.impact = 0; this.flash = 0;
    this.speedLines = 0; this.heading = 0; this.focusX = 0;
    this.tracksideS = 0; this.tracksideD = 0; this.tracksideTimer = 0;
    this.time = 0;
    this.wide = false;
    this.baseFocal = 1;      // focal at rest: cockpit art is scaled against it
    this.sceneStart = 0; this.sceneCount = 0; this.frontStart = 0; this.frontCount = 0;
    this.extrapolation = 0;
  }

  setRect(x, y, w, h) {
    const r = this.rect;
    r.x = x; r.y = y; r.w = w; r.h = h;
    this.wide = w / h > 2.4;
  }

  /** Register an impact (0..1) seen from this view: jolt, flash, brief burst of speed lines. */
  addImpact(strength) {
    this.impact = Math.max(this.impact, strength);
    this.flash = Math.max(this.flash, strength * 0.9);
  }

  /**
   * Advance camera behaviour and rebuild the projection.
   * @param ahead seconds since the last simulation tick (render extrapolation)
   */
  update(dt, race, effects, ahead) {
    const track = race.track, car = race.cars[this.carIndex];
    const cfg = VIEW_CONFIG, r = this.rect, cam = this.cam;
    this.time += dt;
    const he = car.headingError;
    const cosH = Math.cos(he), sinH = Math.sin(he);
    // extrapolated track position of the followed car
    const vs = car.speed * cosH - car.vLat * sinH, vd = car.speed * sinH + car.vLat * cosH;
    const carS = car.s + vs * ahead, carD = car.d + vd * ahead;
    const speedRatio = clamp(Math.abs(car.speed) / 92, 0, 1);
    let dir = 1, yawTarget = he * cfg.yawFollow, eye = cfg.eyeHeight, camS = carS + cfg.eyeForward, camD = carD;

    if (this.camera === CAMERA.COCKPIT) {
      if (Math.abs(he) > 1.75) { dir = -1; yawTarget = wrapAngle(he - Math.PI) * cfg.yawFollow; }
      else if (Math.abs(he) > 1.0) yawTarget = Math.sign(he) * (1.0 * cfg.yawFollow + (Math.abs(he) - 1.0) * 0.3);
    } else if (this.camera === CAMERA.CHASE) {
      camS = carS - cfg.chase.back; eye = cfg.chase.height; camD = carD * 0.82; yawTarget = he * 0.25;
    } else if (this.camera === CAMERA.FRONT) {
      dir = -1; camS = carS + cfg.front.ahead; eye = cfg.front.height;
      camD = clamp(carD * 0.6 + cfg.front.side, -track.halfWidth + 1, track.halfWidth - 1);
      yawTarget = Math.atan2(camD - carD, cfg.front.ahead) * 0.75;      // turn toward the car for a three-quarter front view
    } else {
      // trackside camera: fixed position, re-placed ahead of the car when it has gone past
      this.tracksideTimer -= dt;
      let gap = mod(this.tracksideS - carS + track.length / 2, track.length) - track.length / 2;
      if (gap < -30 || gap > 260 || this.tracksideTimer < -40) {
        this.tracksideS = mod(carS + 150, track.length);
        const i = Math.floor(this.tracksideS / track.ds) % track.n;
        const side = track.kappa[i] > 0 ? -1 : 1;
        this.tracksideD = side * (track.halfWidth + 1.5);
        this.tracksideTimer = 0;
        gap = 150;
      }
      dir = -1; camS = this.tracksideS; camD = this.tracksideD; eye = cfg.tv.height;
      yawTarget = clamp(Math.atan2((carD - camD) * -1, Math.max(gap, 4)) * 0.9, -0.9, 0.9);
    }
    const rate = this.camera === CAMERA.COCKPIT ? 14 : 6;
    this.yaw = Math.abs(yawTarget - this.yaw) > 1.2 ? yawTarget : damp(this.yaw, yawTarget, rate, dt);

    // perspective breathing and nose dive
    const diveTarget = clamp(-car.accelLong / 26, -0.25, 1);
    this.dive = damp(this.dive, diveTarget, 7, dt);
    const stretchTarget = effects.perspectiveStretch ? speedRatio * speedRatio * cfg.hfovSpeedGain - Math.max(0, this.dive) * cfg.hfovBrakeLoss + (car.boosting ? 0.05 : 0) : 0;
    this.stretch = damp(this.stretch, stretchTarget, 3.5, dt);
    const tall = r.w < r.h * 1.1;
    const restFov = this.camera === CAMERA.COCKPIT ? (tall ? cfg.hfovTall : cfg.hfov) : this.camera === CAMERA.CHASE ? cfg.chase.hfov : this.camera === CAMERA.FRONT ? cfg.front.hfov : cfg.tv.hfov;
    const hfov = restFov + (this.camera === CAMERA.COCKPIT ? this.stretch : this.stretch * 0.3);
    const focal = focalForFov(r.w, hfov);
    this.baseFocal = focalForFov(r.w, restFov);

    // vibration: speed buzz, kerbs, loose surfaces, impacts
    this.impact = Math.max(0, this.impact - dt * 2.6);
    this.flash = Math.max(0, this.flash - dt * 5.5);
    let amp = 0;
    if (effects.cockpitShake && this.camera === CAMERA.COCKPIT) {
      const rough = car.surface === 1 ? 1.0 : car.surface === 2 ? 0.7 : car.surface === 3 ? 1.15 : 0;
      amp = speedRatio * speedRatio * 0.9 + rough * Math.min(1, Math.abs(car.speed) / 25) * 3.2 + car.slip * 0.7;
    }
    if (effects.impactFrames) amp += this.impact * 16;
    this.shakeAmp = damp(this.shakeAmp, amp, 18, dt);
    const t = this.time, k = r.h / 1440;
    this.shakeX = (Math.sin(t * 71.3) * 0.6 + Math.sin(t * 113.7 + 1.3) * 0.4) * this.shakeAmp * k;
    this.shakeY = (Math.sin(t * 87.1 + 0.7) * 0.6 + Math.sin(t * 139.9) * 0.4) * this.shakeAmp * k;

    // horizon: road grade and dive
    const pitchTarget = car.pitch * dir * cfg.pitchFollow;
    this.pitch = damp(this.pitch, pitchTarget, 6, dt);
    const ratio = this.wide ? cfg.horizonRatioWide : cfg.horizonRatio;
    const diveShift = this.camera === CAMERA.COCKPIT ? this.dive * 0.012 * r.h : 0;
    cam.s = camS; cam.d = camD; cam.eyeHeight = eye; cam.yaw = this.yaw; cam.dir = dir;
    cam.width = r.w; cam.height = r.h; cam.focal = focal;
    cam.cx = r.w * 0.5 + this.shakeX * 0.35;
    cam.cy = r.h * ratio + focal * Math.tan(this.pitch) - diveShift + this.shakeY * 0.35;
    updateProjection(this.projection, track, cam);

    // speed lines: speed, acceleration bursts, impacts
    let lines = 0;
    if (effects.speedLines) {
      lines = clamp((speedRatio - 0.42) / 0.5, 0, 1);
      lines = lines * lines * 0.8 + (car.boosting ? 0.25 : 0) + clamp(car.accelLong / 40, 0, 0.15);
      if (this.camera !== CAMERA.COCKPIT) lines *= 0.5;
    }
    if (effects.impactFrames) lines += this.impact * 0.9;
    this.speedLines = damp(this.speedLines, clamp(lines, 0, 1), 6, dt);

    const i0 = this.projection.baseIndex;
    this.heading = track.heading[i0] + this.yaw + (dir < 0 ? Math.PI : 0);
    // vanishing point of the road a little ahead, used as the focus of the speed lines
    const p = this.projection;
    const look = Math.min(p.nodeCount - 1, 24);
    const lz = p.nodeZ[look];
    this.focusX = clamp(p.cx + ((p.nodeX[look] - p.camD - lz * p.yawTan) * p.focal) / Math.max(lz, 1), r.w * 0.3, r.w * 0.7);
  }

  /** Per-race constants: track dimensions, pit lane, palette. */
  configure(track, colors, gridCount) {
    const u = this.uniforms;
    const pit = track.pit;
    set4(u, U.track, track.length, track.ds, track.halfWidth, track.kerbWidth);
    set4(u, U.pitA, pit.side, pit.wallD, pit.outerD, pit.laneD);
    set4(u, U.pitB, pit.entryS, pit.wallStartS, pit.wallEndS, pit.exitS);
    setColors(u, colors);
    this.gridCount = gridCount;
    this.fogDensity = colors.fogDensity || 0.00055;
    this.sampleCount = track.n;
  }

  /** Write the per-frame part of the uniform block. */
  writeUniforms(time, speed, cloudScroll, detail) {
    const u = this.uniforms, r = this.rect, p = this.projection;
    set4(u, U.rect, r.x, r.y, r.w, r.h);
    set4(u, U.proj, p.focal, p.cx, p.cy, p.dir);
    set4(u, U.cam, p.camS, p.camD, time, speed);
    set4(u, U.misc, p.topRow, this.heading / BACKDROP_PERIOD, this.fogDensity, this.sampleCount);
    set4(u, U.fx, this.speedLines, this.focusX, p.cy, this.flash);
    set4(u, U.sky, cloudScroll, 0, 1, detail);
    set4(u, U.flags, this.gridCount, this.index * MAX_ROWS, 0, 0);
  }
}
