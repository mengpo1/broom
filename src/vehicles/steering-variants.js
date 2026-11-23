// EXPERIMENTAL steering variants — a prototype, never the default driving.
//
// The validated driving is variant `a`: the steering goes to its stop at a constant rate (0.22 s)
// and stays there for as long as the key is held; at speed that stop asks for 1.22 times the grip
// available (overSteerAllowance, car-spec.js). Nothing here changes it.
//
// A player found that holding a steering key should end up turning the wheel further, tightening
// the turn and possibly sliding the car, as on the reference footage where the driver's hands go
// through three positions on each side and reach the last one only after the key has been held
// for a while (docs/specifications/held-steering.md). The variants below are ways of doing that,
// to be tried side by side with `a` (launch options #steering=b1 ... and #steerlab=b1 ..., the
// steering bench: core/steering-bench.js). They
// apply to the cars driven by a player only; computer-driven cars always use `a`.
//
// One mechanism, in two phases, entirely described by numbers (nothing is drawn at random, the
// simulation step is fixed: the result does not depend on the display rate):
//   phase 1  the steering goes to its stop as today. At speed the stop is where the front wheels
//            ask for `phase1Allowance` times the grip available.
//   phase 2  while the request stays at full lock (at least `holdThreshold` of the travel: a key,
//            a d-pad, a stick or a mouse pushed to the end), after `phase2Delay` seconds the wheels
//            turn further, up to `phase2Allowance` times the grip, at `phase2Rate` per second
//            (1 = the whole of phase 2 in one second). Released, it comes back at `phase2Return`.
// Speed and grip are taken into account by construction: the extra angle is a share of the angle
// the grip allows at that speed (it vanishes at low speed, where the lock is the mechanical one,
// and it is smaller on a slippery surface). Road curvature: with `curvatureGain`, phase 2 builds
// up faster in a bend that asks for more than the car can give (v^2 x curvature / grip).
// What the extra angle does is the existing slip mechanism (the yaw stays capped by the grip, the
// excess scrubs speed off and makes the tyres squeal, mark and smoke), plus, with `driftGain`, a
// slide of the rear: the car turns in faster than its path, its nose pointing inside the turn.
// With `spinAngle`, a slide angle beyond that value ends in a spin.

export const STEERING_REFERENCE = 'a';

export const STEERING_VARIANTS = {
  /** The validated driving. */
  a: null,
  /**
   * B1 - two stages, never more lock than today. Phase 1 stops where the front wheels ask for
   * 85 % of the grip (no scrub, a turn a little wider than today's); holding the key winds on the
   * rest, up to today's full lock (1.22). Timing after the reference footage: the last position of
   * the hands appears 0.5 to 1 s after the first movement.
   */
  b1: { id: 'b1', holdThreshold: 0.95, phase1Allowance: 0.85, phase2Allowance: 1.22, phase2Delay: 0.15, phase2Rate: 1.25, phase2Return: 6,
    curvatureGain: 0, driftGain: 0, driftSlipCap: 1, driftResponse: 8, driftRecovery: 1, spinAngle: 0 },
  /**
   * B2 - phase 1 is today's steering, unchanged; holding the key then winds on more lock than the
   * grip can use, up to twice the grip (a slip of about 1: the tyres go through the three existing
   * stages, squeal at 0.22, marks at 0.55, smoke at 0.85). The car scrubs speed off and its line
   * tightens as it slows down. No slide of the rear, no spin.
   */
  b2: { id: 'b2', holdThreshold: 0.95, phase1Allowance: 1.22, phase2Allowance: 2, phase2Delay: 0.3, phase2Rate: 1, phase2Return: 5,
    curvatureGain: 0, driftGain: 0, driftSlipCap: 1, driftResponse: 8, driftRecovery: 1, spinAngle: 0 },
  /**
   * B3 - as B2, further (2.5 times the grip: a slip of 1.5, where the existing scrub is capped) and
   * with a slide of the rear: the nose turns inside the bend and the line tightens beyond what the
   * grip alone gives, at the price of speed; phase 2 builds up faster in a bend too tight for the
   * speed, and insisting ends in a spin (slide angle beyond 0.3 rad, 17 degrees).
   */
  b3: { id: 'b3', holdThreshold: 0.95, phase1Allowance: 1.22, phase2Allowance: 2.5, phase2Delay: 0.3, phase2Rate: 0.8, phase2Return: 4,
    curvatureGain: 0.5, driftGain: 0.5, driftSlipCap: 1, driftResponse: 6, driftRecovery: 0.45, spinAngle: 0.3 },
};

/** Bounds accepted for a parameter given by hand (launch option, console): [lowest, highest]. */
export const STEERING_PARAMETER_RANGES = {
  holdThreshold: [0.5, 1], phase1Allowance: [0.5, 3], phase2Allowance: [0.5, 4], phase2Delay: [0, 3], phase2Rate: [0.1, 10], phase2Return: [0.5, 20],
  curvatureGain: [0, 3], driftGain: [0, 2], driftSlipCap: [0.1, 3], driftResponse: [0.5, 20], driftRecovery: [0, 1], spinAngle: [0, 1.2],
};

/**
 * The variant of that name: an object, null for the reference, undefined for an unknown name.
 * `overrides` ({ phase2Delay: 0.5, ... }, numbers or numeric strings) gives a copy of the variant
 * with those parameters changed, each kept within STEERING_PARAMETER_RANGES; unknown names and
 * values that are not numbers are ignored. The reference has no parameters: it stays null.
 */
export function steeringVariant(name, overrides) {
  const key = String(name ?? STEERING_REFERENCE).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(STEERING_VARIANTS, key)) return undefined;
  const base = STEERING_VARIANTS[key];
  if (!base || !overrides) return base;
  let custom = null;
  for (const param in STEERING_PARAMETER_RANGES) {
    if (overrides[param] === undefined || overrides[param] === null || overrides[param] === '') continue;
    const value = Number(overrides[param]), [lo, hi] = STEERING_PARAMETER_RANGES[param];
    if (!Number.isFinite(value)) continue;
    if (!custom) custom = { ...base, custom: true };
    custom[param] = Math.max(lo, Math.min(hi, value));
  }
  if (custom && custom.phase2Allowance < custom.phase1Allowance) custom.phase2Allowance = custom.phase1Allowance;   // phase 2 never takes lock away
  return custom || base;
}

/** What a race is given: a variant object as it is, a name looked up; anything else (unset, unknown, the reference) is null. */
export function resolveSteering(value) {
  if (value && typeof value === 'object') return value;
  return steeringVariant(value) || null;
}
