// Cockpit compositor: places the cockpit drawings (art/cockpits/cockpit-art.js) in a view and
// animates them — steering wheel and hands, steered front wheels with rolling marks, rev needle,
// gear digit, vibration. Pure presentation: reads the car state only.

import { VIEW_CONFIG } from '../../core/config.js';
import { clamp, mod } from '../../core/math.js';
import { CAMERA } from './race-view.js';
import { COCKPIT_REF_FOCAL, STEER_FRAMES, MAX_DRAWN_STEER, DIAL, STEERING } from '../../art/cockpits/cockpit-art.js';
import { CAR_DIMENSIONS, TREAD_MARKS, TREAD_PHASES } from '../../art/vehicles/car-model.js';
import { BASE_CAR_SPEC } from '../../vehicles/car-spec.js';
import { QUAD_MODE } from '../drawing/quad-batch.js';

const BLUR_SPEED = 17;       // m/s above which the tyre is drawn with speed streaks

/**
 * Which drawing of the front wheel to show: rolling phase 0..TREAD_PHASES-1 synchronised with the
 * distance travelled, or TREAD_PHASES (streaks) at speed.
 */
export function wheelVariant(odometer, speed) {
  if (Math.abs(speed) > BLUR_SPEED) return TREAD_PHASES;
  const angle = odometer / CAR_DIMENSIONS.frontTyre.radius;
  const period = (Math.PI * 2) / TREAD_MARKS;
  return Math.floor((mod(angle, period) / period) * TREAD_PHASES) % TREAD_PHASES;
}

/** Steering frame (0 = full right ... STEER_FRAMES-1 = full left) of the LEFT wheel for a steering value in -1..1 (+ = right). */
export function steerFrame(steer, lock) {
  const angle = clamp(-steer * lock, -MAX_DRAWN_STEER, MAX_DRAWN_STEER);
  const mid = (STEER_FRAMES - 1) / 2;
  return Math.round(mid + (angle / MAX_DRAWN_STEER) * mid);
}

export class CockpitLayer {
  constructor(art, layout, text) {
    this.text = text;
    this.near = layout.near.map((id) => art.sprite(id));
    this.far = layout.far.map((id) => art.sprite(id));
    this.steering = layout.steering.map((id) => art.sprite(id));
    this.wheels = layout.wheels.map((row) => row.map((id) => art.sprite(id)));
    this.dial = art.sprite(layout.dial);
    this.needle = art.sprite(layout.needle);
    this.needleAngle = [0, 0];
    this.wheelAngle = [0, 0];
  }

  /** True when the dash dial is visible in this view (otherwise the HUD shows a rev bar). */
  dialVisible(view) {
    const k = view.baseFocal / COCKPIT_REF_FOCAL;
    const ratio = view.wide ? VIEW_CONFIG.horizonRatioWide : VIEW_CONFIG.horizonRatio;
    return view.camera === CAMERA.COCKPIT && view.rect.h * ratio + (DIAL.y + DIAL.r * 0.6) * k < view.rect.h;
  }

  half(quads, sp, ox, oy, k) {
    const w = sp.w * k, h = sp.h * k, y = oy + sp.oy * k;
    quads.sprite(sp, ox + sp.ox * k, y, w, h, 1, 1, 1, 1, 0, false);
    quads.sprite(sp, ox - (sp.ox + sp.w) * k, y, w, h, 1, 1, 1, 1, 0, true);
  }

  buildFront(app, view) {
    if (view.camera !== CAMERA.COCKPIT) return;
    const quads = app.quads, r = view.rect;
    const car = app.race.cars[view.carIndex];
    const p = clamp(car.playerIndex, 0, this.near.length - 1);
    const k = view.baseFocal / COCKPIT_REF_FOCAL;
    const ratio = view.wide ? VIEW_CONFIG.horizonRatioWide : VIEW_CONFIG.horizonRatio;
    const ox = r.w * 0.5 + view.shakeX, oy = r.h * ratio + view.shakeY + Math.max(0, view.dive) * 6 * k;
    this.half(quads, this.far[p], ox, oy, k);

    // front wheels: steering frame and rolling variant
    const lock = BASE_CAR_SPEC.steerLock * (0.45 + 0.55 / (1 + Math.abs(car.speed) / 28));
    const frame = steerFrame(car.steer, lock);
    const variant = wheelVariant(car.odometer, car.speed);
    const left = this.wheels[frame][variant], right = this.wheels[STEER_FRAMES - 1 - frame][variant];
    const jolt = view.shakeAmp * 0.5 * k;
    const wy = oy + left.oy * k + Math.sin(view.time * 61) * jolt;
    quads.sprite(left, ox + left.ox * k, wy, left.w * k, left.h * k, 1, 1, 1, 1, 0, false);
    quads.sprite(right, ox - (right.ox + right.w) * k, oy + right.oy * k - Math.sin(view.time * 53) * jolt, right.w * k, right.h * k, 1, 1, 1, 1, 0, true);

    this.half(quads, this.near[p], ox, oy, k);

    if (this.dialVisible(view)) {
      const dx = ox + DIAL.x * k, dy = oy + DIAL.y * k;
      const ds = this.dial.w * k;
      quads.sprite(this.dial, dx - ds / 2, dy - ds / 2, ds, ds, 1, 1, 1, 1, 0, false);
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
    const sp = this.steering[p];
    const angle = car.steer * 0.95;
    const s = STEERING.size * k * 0.5;
    const cx = ox + STEERING.x * k + view.shakeX * 0.4, cy = oy + STEERING.y * k + view.shakeY * 0.6;
    const co = Math.cos(angle), si = Math.sin(angle), q = STEERING.squash;
    const yb = s * (1 + 2 * STEERING.extra);       // bottom edge of the taller drawing, below the wheel centre
    quads.quad(
      cx + (-s * co + s * si), cy + (-s * si - s * co) * q, 1, cx + (s * co + s * si), cy + (s * si - s * co) * q, 1,
      cx + (-s * co - yb * si), cy + (-s * si + yb * co) * q, 1, cx + (s * co - yb * si), cy + (s * si + yb * co) * q, 1,
      sp.u0, sp.v0, sp.u1, sp.v1, sp.layer, QUAD_MODE.SPRITE, 1, 1, 1, 1, 0);
  }
}
