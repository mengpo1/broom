// Cockpit compositor: places the cockpit drawings (art/cockpits/cockpit-art.js) in a view and
// animates them — steering wheel and hands, steered front wheels with rolling marks, rev needle,
// gear digit, vibration. Pure presentation: reads the car state only.

import { VIEW_CONFIG } from '../../core/config.js';
import { clamp, mod } from '../../core/math.js';
import { CAMERA } from './race-view.js';
import { COCKPIT_REF_FOCAL, STEER_FRAMES, MAX_DRAWN_STEER, DIAL, STEERING, MIRROR } from '../../art/cockpits/cockpit-art.js';
import { CAR_DIMENSIONS, TREAD_MARKS, TREAD_PHASES, STREAK_PHASES } from '../../art/vehicles/car-model.js';
import { BASE_CAR_SPEC } from '../../vehicles/car-spec.js';
import { QUAD_MODE } from '../drawing/quad-batch.js';
import { CAR_STATE } from '../../physics/car-physics.js';

/**
 * Speed (m/s) up to which the drawn tread marks can follow the real rotation of the wheel: beyond
 * it the marks would pass faster than the pictures follow each other and seem to stand still or
 * turn backwards. Above it the tyre is drawn with streaks that cycle at an apparent rate.
 */
export const WHEEL_SYNC_SPEED = 4.5;
/** Speed (m/s) from which the streaks start to show through the marks: the two drawings are cross-faded up to WHEEL_SYNC_SPEED. */
export const WHEEL_BLEND_SPEED = 2.2;

/**
 * Apparent rotation of the streaked tyre: cycles of the streak pattern shown per metre travelled.
 * The cycling rate grows with speed (7 per second where the streaks appear, 10 at top speed): with
 * three drawn phases that is a new drawing every two or three pictures at 60 images per second,
 * and never more than one phase per picture at 30, so the direction always reads.
 */
export function streakCyclesPerMetre(speed) {
  const v = Math.max(Math.abs(speed), WHEEL_BLEND_SPEED);
  return (7 + 3 * (1 - Math.exp(-(v - WHEEL_BLEND_SPEED) / 30))) / v;
}

/** Share of the streaked drawing in the picture of the tyre: 0 = marks only, 1 = streaks only. */
export function streakBlend(speed) {
  return clamp((Math.abs(speed) - WHEEL_BLEND_SPEED) / (WHEEL_SYNC_SPEED - WHEEL_BLEND_SPEED), 0, 1);
}

/** Drawing of the rolling marks (0..TREAD_PHASES-1), exactly synchronised with the distance travelled. */
export function rollingVariant(odometer) {
  const angle = odometer / CAR_DIMENSIONS.frontTyre.radius;
  const period = (Math.PI * 2) / TREAD_MARKS;
  return Math.floor((mod(angle, period) / period) * TREAD_PHASES) % TREAD_PHASES;
}

/** Drawing of the streaks for a position in their cycle (see advanceStreak). */
export function streakVariant(streakTurn) {
  return TREAD_PHASES + (Math.floor(mod(streakTurn, 1) * STREAK_PHASES) % STREAK_PHASES);
}

/**
 * The drawing of the front wheel that dominates at a speed. Up to WHEEL_SYNC_SPEED: rolling phase
 * 0..TREAD_PHASES-1. Above: one of the STREAK_PHASES streaked drawings, chosen by `streakTurn`
 * (cycles of the streak pattern accumulated along the distance travelled, see CockpitLayer).
 * Between WHEEL_BLEND_SPEED and WHEEL_SYNC_SPEED the cockpit shows both, cross-faded (streakBlend).
 */
export function wheelVariant(odometer, speed, streakTurn = 0) {
  return Math.abs(speed) > WHEEL_SYNC_SPEED ? streakVariant(streakTurn) : rollingVariant(odometer);
}

/** Advance the streak cycle of a wheel over a distance travelled (negative when reversing). */
export function advanceStreak(turn, distance, speed) {
  return mod(turn + distance * streakCyclesPerMetre(speed), 1);
}

/** Steering frame (0 = full right ... STEER_FRAMES-1 = full left) of the LEFT wheel for a steering value in -1..1 (+ = right). */
export function steerFrame(steer, lock) {
  const angle = clamp(-steer * lock, -MAX_DRAWN_STEER, MAX_DRAWN_STEER);
  const mid = (STEER_FRAMES - 1) / 2;
  return Math.round(mid + (angle / MAX_DRAWN_STEER) * mid);
}

// rear view of a mirror: a small perspective of its own (pixels per metre at one metre, eye height, reach)
const MIRROR_FOCAL = 860, MIRROR_EYE = 0.75, MIRROR_REACH = 120;
const MIRROR_DEPTHS = [0, 13, 22, 38, 65, 120];        // road drawn in bands between these distances behind (0 = bottom of the glass)
const polyA = new Float32Array(48), polyB = new Float32Array(48);
const behindOrder = new Int16Array(40), behindGap = new Float32Array(40);

/** Clip the convex polygon in `src` (n points, x/y pairs) against one side of an axis-aligned box. Returns the new count. */
function clipSide(src, n, dst, axis, bound, keepGreater) {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = src[i * 2 + axis], b = src[j * 2 + axis];
    const ain = keepGreater ? a >= bound : a <= bound, bin = keepGreater ? b >= bound : b <= bound;
    if (ain) { dst[m * 2] = src[i * 2]; dst[m * 2 + 1] = src[i * 2 + 1]; m++; }
    if (ain !== bin) {
      const t = (bound - a) / (b - a);
      dst[m * 2] = src[i * 2] + (src[j * 2] - src[i * 2]) * t; dst[m * 2 + 1] = src[i * 2 + 1] + (src[j * 2 + 1] - src[i * 2 + 1]) * t; m++;
    }
  }
  return m;
}

/** Flat-coloured convex quadrilateral (points in polyA, in order) clipped to a box. */
function flatClipped(quads, x0, y0, x1, y1, r, g, b) {
  let n = clipSide(polyA, 4, polyB, 0, x0, true);
  n = clipSide(polyB, n, polyA, 0, x1, false);
  n = clipSide(polyA, n, polyB, 1, y0, true);
  n = clipSide(polyB, n, polyA, 1, y1, false);
  for (let i = 1; i + 1 < n; i += 2) {
    const c = i + 2 < n ? i + 2 : i + 1;
    quads.quad(polyA[0], polyA[1], 1, polyA[i * 2], polyA[i * 2 + 1], 1, polyA[c * 2], polyA[c * 2 + 1], 1, polyA[(i + 1) * 2], polyA[(i + 1) * 2 + 1], 1,
      0, 0, 0, 0, 0, QUAD_MODE.FLAT, r, g, b, 1, 0);
  }
}

const placement = { k: 1, oy: 0 };
/**
 * Scale and vertical origin of the cockpit drawing in a view. It hangs from the horizon; in the
 * split-screen formats it is reduced so that the whole driving position fits, and in a narrow
 * view it sits on the bottom edge instead (never a gap under the drawing).
 */
function place(view) {
  const cfg = VIEW_CONFIG;
  const k = (view.baseFocal / COCKPIT_REF_FOCAL) * (view.wide ? cfg.cockpitScaleWide : view.tall ? cfg.cockpitScaleTall : 1);
  placement.k = k;
  placement.oy = Math.max(view.rect.h * view.horizonRatio, view.rect.h - cfg.cockpitDepth * k);
  return placement;
}

/** Scale (k) and vertical origin (oy) of the cockpit drawing in a view, for what must be drawn on the car itself. */
export function cockpitPlacement(view) { return place(view); }

export class CockpitLayer {
  constructor(art, layout, text) {
    this.text = text;
    this.art = art;
    this.near = layout.near.map((id) => art.sprite(id));
    this.far = layout.far.map((id) => art.sprite(id));
    this.steering = layout.steering.map((id) => art.sprite(id));
    this.steeringFree = layout.steeringFree.map((id) => art.sprite(id));
    this.wheels = layout.wheels.map((row) => row.map((id) => art.sprite(id)));
    this.dial = art.sprite(layout.dial);
    this.needle = art.sprite(layout.needle);
    this.needleAngle = [0, 0];
    this.streakTurn = [0, 0]; this.lastOdometer = [NaN, NaN];
    this.wheelAngle = [0, 0];
  }

  /** True when the dash dial is visible in this view (otherwise the HUD shows a rev bar). */
  dialVisible(view) {
    const { k, oy } = place(view);
    return view.camera === CAMERA.COCKPIT && oy + (DIAL.y + DIAL.r * 0.6) * k < view.rect.h;
  }

  half(quads, sp, ox, oy, k, am) {
    const w = sp.w * k, h = sp.h * k, y = oy + sp.oy * k;
    quads.sprite(sp, ox + sp.ox * k, y, w, h, am[0], am[1], am[2], 1, 0, false);
    quads.sprite(sp, ox - (sp.ox + sp.w) * k, y, w, h, am[0], am[1], am[2], 1, 0, true);
  }

  /**
   * Rear view in one mirror (side -1 = left, +1 = right), drawn behind the mirror housing: sky,
   * distant relief, verge, the road running away behind the car and the cars that follow.
   */
  mirror(app, view, car, side, ox, oy, k, am) {
    const quads = app.quads, race = app.race, track = race.track, colors = app.scene.mirror;
    const cxm = ox - side * MIRROR.x * k, cym = oy + MIRROR.y * k;
    const gw = (MIRROR.w / 2 - MIRROR.glassInset) * k, gh = (MIRROR.h / 2 - MIRROR.glassInset) * k;
    const x0 = cxm - gw, x1 = cxm + gw, y0 = cym - gh, y1 = cym + gh;
    const yh = y0 + gh * 0.8;                                  // horizon in the glass
    const f = MIRROR_FOCAL * k;
    const xv = cxm - side * gw * 0.45;                         // straight behind lies toward the inner side of each mirror
    quads.rect(x0, y0, gw * 2, yh - y0, colors.sky[0] * am[0], colors.sky[1] * am[1], colors.sky[2] * am[2], 1);
    quads.rect(x0, yh - gh * 0.22, gw * 2, gh * 0.22, colors.relief[0], colors.relief[1], colors.relief[2], 1);
    quads.rect(x0, yh, gw * 2, y1 - yh, colors.verge[0], colors.verge[1], colors.verge[2], 1);
    // the road behind: displaced sideways by the bend the car has just come through
    const sample = Math.floor(mod(car.s - 25, track.length) / track.ds) % track.n;
    const bend = track.kappa[sample] * 0.5;
    const half = track.halfWidth, zBottom = (MIRROR_EYE * f) / (y1 - yh);
    for (let band = MIRROR_DEPTHS.length - 2; band >= 0; band--) {
      const zn = band === 0 ? zBottom : MIRROR_DEPTHS[band], zf = MIRROR_DEPTHS[band + 1];
      if (zf <= zn) continue;
      const cn = (bend * zn * zn - car.d) * (f / zn), cf = (bend * zf * zf - car.d) * (f / zf);
      const wn = half * (f / zn), wf = half * (f / zf);
      const yn = yh + (MIRROR_EYE * f) / zn, yf = yh + (MIRROR_EYE * f) / zf;
      polyA[0] = xv + cf - wf; polyA[1] = yf; polyA[2] = xv + cf + wf; polyA[3] = yf;
      polyA[4] = xv + cn + wn; polyA[5] = yn; polyA[6] = xv + cn - wn; polyA[7] = yn;
      flatClipped(quads, x0, y0, x1, y1, colors.road[0], colors.road[1], colors.road[2]);
      for (let e = -1; e <= 1; e += 2) {                       // barriers on both sides, a metre high
        const bn = (half + 4.5) * (f / zn), bf = (half + 4.5) * (f / zf), hn = f / zn, hf = f / zf;
        polyA[0] = xv + cf + e * bf; polyA[1] = yf - hf; polyA[2] = xv + cf + e * bf; polyA[3] = yf;
        polyA[4] = xv + cn + e * bn; polyA[5] = yn; polyA[6] = xv + cn + e * bn; polyA[7] = yn - hn;
        flatClipped(quads, x0, y0, x1, y1, colors.barrier[0], colors.barrier[1], colors.barrier[2]);
      }
      for (let e = -1; e <= 1; e += 2) {                       // edge lines
        const ln = 0.22 * (f / zn), lf = 0.22 * (f / zf);
        polyA[0] = xv + cf + e * wf - lf; polyA[1] = yf; polyA[2] = xv + cf + e * wf + lf; polyA[3] = yf;
        polyA[4] = xv + cn + e * wn + ln; polyA[5] = yn; polyA[6] = xv + cn + e * wn - ln; polyA[7] = yn;
        flatClipped(quads, x0, y0, x1, y1, colors.line[0], colors.line[1], colors.line[2]);
      }
    }
    // cars behind, the farthest first
    let count = 0;
    const cars = race.cars;
    for (let i = 0; i < cars.length && count < behindOrder.length; i++) {
      const other = cars[i];
      if (other === car || other.removed) continue;
      const gap = mod(car.s - other.s, track.length);
      if (gap < 2.5 || gap > MIRROR_REACH) continue;
      let q = count++;
      while (q > 0 && behindGap[q - 1] < gap) { behindGap[q] = behindGap[q - 1]; behindOrder[q] = behindOrder[q - 1]; q--; }
      behindGap[q] = gap; behindOrder[q] = i;
    }
    const front = this.art.cars[this.art.cars.length - 1];     // the drawing seen from straight ahead
    for (let q = 0; q < count; q++) {
      const other = cars[behindOrder[q]], z = behindGap[q], scale = f / z, kk = scale / front.ppm;
      const gx = xv + (other.d - car.d + bend * z * z) * scale, gy = yh + MIRROR_EYE * scale;
      const left = gx - front.ax * kk, top = gy - front.ay * kk, w = front.w * kk, h = front.h * kk;
      const cl = Math.max(left, x0), cr = Math.min(left + w, x1), ct = Math.max(top, y0), cb = Math.min(top + h, y1);
      if (cl >= cr || ct >= cb) continue;
      quads.quad(cl, ct, 1, cr, ct, 1, cl, cb, 1, cr, cb, 1, (cl - left) / w, (ct - top) / h, (cr - left) / w, (cb - top) / h,
        front.layer, QUAD_MODE.CAR + other.teamIndex, am[0], am[1], am[2], 1, 0);
    }
  }

  buildFront(app, view) {
    if (view.camera !== CAMERA.COCKPIT) return;
    const quads = app.quads, r = view.rect;
    const car = app.race.cars[view.carIndex];
    const p = clamp(car.playerIndex, 0, this.near.length - 1);
    const k = place(view).k;
    const ox = r.w * 0.5 + view.shakeX, oy = placement.oy + view.shakeY + Math.max(0, view.dive) * 6 * k;
    const am = app.scene.ambient;
    this.half(quads, this.far[p], ox, oy, k, am);

    // front wheels: steering frame and rolling variant
    const lock = BASE_CAR_SPEC.steerLock * (0.45 + 0.55 / (1 + Math.abs(car.speed) / 28));
    const frame = steerFrame(car.steer, lock);
    // streaks cycle with the distance travelled, not with the images drawn: same motion at any display rate
    const vi = view.index, travelled = car.odometer - this.lastOdometer[vi];
    if (Number.isFinite(travelled) && Math.abs(travelled) < 30) this.streakTurn[vi] = advanceStreak(this.streakTurn[vi], travelled, car.speed);
    this.lastOdometer[vi] = car.odometer;
    // the marks, then the streaks over them as the speed rises (one drawing fades into the other)
    const blend = streakBlend(car.speed), jolt = view.shakeAmp * 0.5 * k;
    const joltL = Math.sin(view.time * 61) * jolt, joltR = -Math.sin(view.time * 53) * jolt;
    for (let pass = 0; pass < 2; pass++) {
      const alpha = pass === 0 ? 1 : blend;
      if (pass === 0 ? blend >= 1 : blend <= 0) continue;
      const variant = pass === 0 ? rollingVariant(car.odometer) : streakVariant(this.streakTurn[vi]);
      const left = this.wheels[frame][variant], right = this.wheels[STEER_FRAMES - 1 - frame][variant];
      quads.sprite(left, ox + left.ox * k, oy + left.oy * k + joltL, left.w * k, left.h * k, am[0], am[1], am[2], alpha, 0, false);
      quads.sprite(right, ox - (right.ox + right.w) * k, oy + right.oy * k + joltR, right.w * k, right.h * k, am[0], am[1], am[2], alpha, 0, true);
    }

    this.mirror(app, view, car, -1, ox, oy, k, am);
    this.mirror(app, view, car, 1, ox, oy, k, am);
    this.half(quads, this.near[p], ox, oy, k, am);

    if (this.dialVisible(view)) {
      const dx = ox + DIAL.x * k, dy = oy + DIAL.y * k;
      const ds = this.dial.w * k;
      quads.sprite(this.dial, dx - ds / 2, dy - ds / 2, ds, ds, am[0], am[1], am[2], 1, 0, false);
      const rpm = clamp(car.rpm, 0, DIAL.maxRpm);
      const target = DIAL.minAngle + ((DIAL.maxAngle - DIAL.minAngle) * rpm) / DIAL.maxRpm;
      const vi = view.index;
      this.needleAngle[vi] += (target - this.needleAngle[vi]) * 0.45;
      const flutter = car.limiter ? Math.sin(view.time * 90) * 0.05 : 0;
      quads.rotated(this.needle, dx, dy, this.needle.w * k, this.needle.h * k, this.needleAngle[vi] + flutter, 0.5, 1 - 11 / this.needle.h, 1, 1, 1, 1);
      // gear digit in the dial window
      const buf = this.text.scratch.clear();
      if (car.reverse) buf.char(82); else buf.int(car.gear);
      this.text.drawBuffer(quads, 'b', buf, dx, dy + 63 * k, 30 * k, 1, 0.82, 0.2, 1, 0.5);
    }

    // steering wheel with the hands, rotated then flattened (the wheel is tilted toward the driver)
    // out of control (spin or slide): the driver has let go of the wheel, which turns on its own
    const loose = car.state === CAR_STATE.SPIN;
    const sp = loose ? this.steeringFree[p] : this.steering[p];
    const angle = loose ? Math.sin(car.clock * 9) * 0.5 : car.steer * 0.95;
    const s = STEERING.size * k * 0.5;
    const cx = ox + STEERING.x * k + view.shakeX * 0.4, cy = oy + STEERING.y * k + view.shakeY * 0.6;
    const co = Math.cos(angle), si = Math.sin(angle), q = STEERING.squash;
    const yb = s * (1 + 2 * STEERING.extra);       // bottom edge of the taller drawing, below the wheel centre
    quads.quad(
      cx + (-s * co + s * si), cy + (-s * si - s * co) * q, 1, cx + (s * co + s * si), cy + (s * si - s * co) * q, 1,
      cx + (-s * co - yb * si), cy + (-s * si + yb * co) * q, 1, cx + (s * co - yb * si), cy + (s * si + yb * co) * q, 1,
      sp.u0, sp.v0, sp.u1, sp.v1, sp.layer, QUAD_MODE.SPRITE, am[0], am[1], am[2], 1, 0);
  }
}
