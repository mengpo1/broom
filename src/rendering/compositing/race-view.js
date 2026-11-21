// One on-screen view of the race (a player's cockpit, or an external camera): camera behaviour,
// projection and per-view uniforms. Reads simulation state, never writes it.

import { clamp, damp, wrapAngle, mod } from '../../core/math.js';
import { VIEW_CONFIG } from '../../core/config.js';
import { createProjection, updateProjection, focalForFov, depthOf, segmentAt } from '../projection/road-projection.js';
import { createViewUniforms, set4, setColors, U } from './view-uniforms.js';
import { MAX_ROWS } from './renderer.js';
import { BACKDROP_PERIOD } from '../../art/environments/backdrop-rules.js';
import { contactDive, crashPitch, slideTremble } from './crash-camera.js';

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
    this.contactDive = 0; this.crashPitch = 0;
    this.tracksideS = 0; this.tracksideD = 0; this.tracksideTimer = 0; this.tracksideAim = 0; this.tracksideGap = 120; this.tracksideFresh = true;
    this.time = 0;
    this.wide = false; this.tall = false; this.horizonRatio = VIEW_CONFIG.horizonRatio;
    this.baseFocal = 1;      // focal at rest: cockpit art is scaled against it
    this.sceneStart = 0; this.sceneCount = 0; this.frontStart = 0; this.frontCount = 0;
    this.extrapolation = 0;
  }

  setRect(x, y, w, h) {
    const r = this.rect;
    r.x = x; r.y = y; r.w = w; r.h = h;
    this.wide = w / h > 2.4;
    this.tall = w < h * 1.1;
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
      // right against a barrier the drawing of the wall would fill the picture, blown up: the
      // eye stays a little way off it (the car itself goes on touching the wall)
      const i = Math.floor(mod(carS, track.length) / track.ds) % track.n;
      const lo = -track.barrierL[i] + cfg.wallClearance, hi = track.barrierR[i] - cfg.wallClearance;
      if (lo < hi) camD = clamp(camD, lo, hi);
      if (Math.abs(he) > 1.75) { dir = -1; yawTarget = wrapAngle(he - Math.PI) * cfg.yawFollow; }
      else if (Math.abs(he) > 1.0) yawTarget = Math.sign(he) * (1.0 * cfg.yawFollow + (Math.abs(he) - 1.0) * 0.3);
    } else if (this.camera === CAMERA.CHASE) {
      camS = carS - cfg.chase.back; eye = cfg.chase.height; camD = carD * 0.82; yawTarget = he * 0.25;
    } else if (this.camera === CAMERA.FRONT) {
      dir = -1; camS = carS + cfg.front.ahead; eye = cfg.front.height;
      camD = clamp(carD * 0.6 + cfg.front.side, -track.halfWidth + 1, track.halfWidth - 1);
      yawTarget = Math.atan2(camD - carD, cfg.front.ahead) * 0.75;      // turn toward the car for a three-quarter front view
    } else {
      // trackside camera: fixed position, re-placed ahead of the car as soon as it has gone past
      this.tracksideTimer -= dt;
      let gap = mod(this.tracksideS - carS + track.length / 2, track.length) - track.length / 2;
      if (gap < 3 || gap > 280 || this.tracksideTimer < -40 || this.tracksideFresh) {
        // among a few places ahead, prefer the one the car reaches along the straightest stretch
        let best = 0, bestTurn = 1e9;
        for (let c = 0; c < 6; c++) {
          const s1 = carS + cfg.tv.ahead + c * 18;
          const i1 = Math.floor(mod(s1, track.length) / track.ds) % track.n, i0 = Math.floor(mod(s1 - cfg.tv.ahead, track.length) / track.ds) % track.n;
          const turn = Math.abs(wrapAngle(track.heading[i1] - track.heading[i0])) + c * 0.02;
          if (turn < bestTurn) { bestTurn = turn; best = s1; }
        }
        this.tracksideS = mod(best, track.length);
        const i = Math.floor(this.tracksideS / track.ds) % track.n;
        const side = track.kappa[i] > 0 ? -1 : 1;
        this.tracksideD = side * (track.halfWidth + 1.5);
        this.tracksideTimer = 0;
        this.tracksideFresh = true;
        gap = mod(this.tracksideS - carS + track.length / 2, track.length) - track.length / 2;
      }
      this.tracksideGap = gap;
      dir = -1; camS = this.tracksideS; camD = this.tracksideD; eye = cfg.tv.height;
      yawTarget = this.tracksideAim;
    }
    const rate = this.camera === CAMERA.COCKPIT ? 14 : this.camera === CAMERA.TRACKSIDE ? 12 : 6;
    this.yaw = Math.abs(yawTarget - this.yaw) > 1.2 ? yawTarget : damp(this.yaw, yawTarget, rate, dt);

    // perspective breathing and nose dive
    const diveTarget = clamp(-car.accelLong / 26, -0.25, 1);
    this.dive = damp(this.dive, diveTarget, 7, dt);
    const stretchTarget = effects.perspectiveStretch ? speedRatio * speedRatio * cfg.hfovSpeedGain - Math.max(0, this.dive) * cfg.hfovBrakeLoss + (car.boosting ? 0.05 : 0) : 0;
    this.stretch = damp(this.stretch, stretchTarget, 3.5, dt);
    const tall = this.tall;
    // the trackside camera zooms out as the car comes closer, like a television operator
    const tvFov = cfg.tv.hfovFar + (cfg.tv.hfovNear - cfg.tv.hfovFar) * clamp(1 - (this.tracksideGap - 8) / (cfg.tv.ahead - 8), 0, 1) ** 1.6;
    const restFov = this.camera === CAMERA.COCKPIT ? (this.wide ? cfg.hfovWide : tall ? cfg.hfovTall : cfg.hfov) : this.camera === CAMERA.CHASE ? cfg.chase.hfov : this.camera === CAMERA.FRONT ? cfg.front.hfov : tvFov;
    const hfov = restFov + (this.camera === CAMERA.COCKPIT ? this.stretch : this.stretch * 0.3);
    const focal = focalForFov(r.w, hfov);
    this.baseFocal = focalForFov(r.w, restFov);

    // vibration: speed buzz, kerbs, loose surfaces, impacts
    this.impact = Math.max(0, this.impact - dt * 2.6);
    this.flash = Math.max(0, this.flash - dt * 5.5);
    let amp = 0;
    if (effects.cockpitShake && this.camera === CAMERA.COCKPIT) {
      const rough = car.surface === 1 ? 1.0 : car.surface === 2 ? 0.7 : car.surface === 3 ? 1.15 : 0;
      // nothing at moderate speed (a one-pixel tremble only blurs the fine lines), a frank buzz near top speed
      const buzz = Math.max(0, speedRatio - 0.6) / 0.4;
      amp = buzz * buzz * 2.6 + rough * Math.min(1, Math.abs(car.speed) / 25) * 3.2 + car.slip * 0.7;
    }
    if (effects.impactFrames) amp += this.impact * 16;
    this.shakeAmp = damp(this.shakeAmp, amp, 18, dt);
    const t = this.time, k = r.h / 1440;
    this.shakeX = (Math.sin(t * 71.3) * 0.6 + Math.sin(t * 113.7 + 1.3) * 0.4) * this.shakeAmp * k;
    this.shakeY = (Math.sin(t * 87.1 + 0.7) * 0.6 + Math.sin(t * 139.9) * 0.4) * this.shakeAmp * k;

    // horizon: road grade and dive
    const pitchTarget = car.pitch * dir * cfg.pitchFollow;
    this.pitch = damp(this.pitch, pitchTarget, 6, dt);
    const ratio = this.wide ? cfg.horizonRatioWide : tall ? cfg.horizonRatioTall : cfg.horizonRatio;
    this.horizonRatio = ratio;
    // nose dive: braking (smoothed) and contacts (driven by the car's own clock)
    this.contactDive = this.camera === CAMERA.COCKPIT ? contactDive(car) : 0;
    // accidents: the pitch of the whole flight and landing, and the trembling of a slide
    this.crashPitch = this.camera === CAMERA.COCKPIT ? crashPitch(car) + (effects.cockpitShake ? slideTremble(car) : 0) : 0;
    const diveShift = this.camera === CAMERA.COCKPIT ? (this.dive * cfg.brakeDive + this.contactDive + this.crashPitch) * r.h : 0;
    cam.s = camS; cam.d = camD; cam.eyeHeight = eye + (this.camera === CAMERA.COCKPIT ? car.airHeight || 0 : 0); cam.yaw = this.yaw; cam.dir = dir;
    cam.width = r.w; cam.height = r.h; cam.focal = focal;
    cam.cx = r.w * 0.5 + this.shakeX * 0.35;
    cam.cy = r.h * ratio + focal * Math.tan(this.pitch) - diveShift + this.shakeY * 0.35;
    updateProjection(this.projection, track, cam);
    if (this.camera === CAMERA.TRACKSIDE) {
      // pan: aim at the place where the car is actually drawn (the road may bend between camera and car)
      const p = this.projection, z = depthOf(p, carS);
      if (z > 1.5 && z < p.farZ) {
        const k = segmentAt(p, z), t = z - p.nodeZ[k];
        const offset = p.nodeX[k] + p.nodeTheta[k] * t + 0.5 * p.nodeKappa[k] * t * t + p.dir * carD - p.camD;
        this.tracksideAim = clamp(Math.atan2(offset, z), -1.05, 1.05);
      }
      if (this.tracksideFresh) {
        // first frame at a new place: point at the car at once instead of panning from the old angle
        this.tracksideFresh = false;
        this.yaw = this.tracksideAim; cam.yaw = this.yaw;
        updateProjection(this.projection, track, cam);
      }
    } else this.tracksideFresh = true;

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
