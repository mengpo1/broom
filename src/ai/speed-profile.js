// Target speed along the racing line: corner limit, backward braking pass, forward traction pass.

import { cornerSpeed, gripLimit, powerFraction } from '../vehicles/car-spec.js';

const GRIP_USAGE = 0.9;

/**
 * @returns {Float32Array} target speed (m/s) for each track sample, for a car with `params`.
 */
export function buildSpeedProfile(track, params, brakeUsage = 0.85) {
  const { n, ds, lineKappa } = track;
  const spec = params.spec;
  const top = spec.gearTopSpeeds[spec.gearTopSpeeds.length - 1];
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(top, cornerSpeed(params, lineKappa[i], GRIP_USAGE));
  // Backward pass: never arrive faster than braking allows (two laps for wrap-around).
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const next = v[(i + 1) % n];
      const brake = Math.min(params.brake * (1 + params.downforce * next * next * 0.9), gripLimit(params, next) * 1.1) * brakeUsage
        + params.drag * next * next;
      const reachable = Math.sqrt(next * next + 2 * brake * ds);
      if (v[i] > reachable) v[i] = reachable;
    }
  }
  return v;
}

/** Lap time estimate: follow the profile with a forward acceleration limit. */
export function estimateLapTime(track, params, profile, pace = 1) {
  const { n, ds } = track;
  const spec = params.spec;
  const gears = spec.gearTopSpeeds;
  let v = profile[0] * pace, time = 0;
  for (let pass = 0; pass < 2; pass++) {
    time = 0;
    for (let i = 0; i < n; i++) {
      const limit = profile[(i + 1) % n] * pace;
      let gear = 0;
      while (gear < gears.length - 1 && v > gears[gear] * spec.autoUpshiftAt) gear++;
      const raw = (params.power * powerFraction(spec, v / gears[gear])) / Math.max(v, spec.minPowerSpeed);
      const accel = Math.min(raw, gripLimit(params, v) * spec.tractionFraction) - params.drag * v * v - spec.rollingResistance;
      const next = Math.min(limit, Math.sqrt(Math.max(1, v * v + 2 * accel * ds)));
      time += ds / Math.max(1, 0.5 * (v + next));
      v = next;
    }
  }
  return time;
}
