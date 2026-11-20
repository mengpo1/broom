// Race rules and scoring tables. Plain data: tune or extend freely.

export const POINTS_TABLE = [10, 6, 4, 3, 2, 1];
export const FASTEST_LAP_POINT = 0; // set to 1 to award a bonus point

export const RACE_DISTANCES = { sprint: 3, short: 5, medium: 8, long: 14 };
export const DISTANCE_ORDER = ['sprint', 'short', 'medium', 'long'];

export const ATTRITION_SCALES = { off: 0, normal: 1, fast: 2.5 };

/** Base rule sets. `profile` names a driving profile in vehicles/car-spec.js. */
export const RULE_PRESETS = {
  arcade: { profile: 'arcade', wear: false, fuel: false, damage: false, crashes: true, pitStops: false, failures: false },
  racing: { profile: 'racing', wear: true, fuel: true, damage: true, crashes: true, pitStops: true, failures: true },
  training: { profile: 'racing', wear: false, fuel: false, damage: false, crashes: true, pitStops: true, failures: false },
  turbo: { profile: 'turbo', wear: false, fuel: false, damage: false, crashes: true, pitStops: false, failures: false },
};

const DEFAULTS = {
  tyreLifeLaps: 13,          // medium compound, clean driving
  fuelRangeLaps: 10.5,
  failureChancePerLap: 0.004,
  countdown: 4.2,
  flyingStart: false,
  attrition: 'normal',
};

/** Resolve a rule set against a track (converts lap based ranges to metres). */
export function resolveRules(rules, track) {
  const r = { ...DEFAULTS, ...RULE_PRESETS.racing, ...(rules || {}) };
  const scale = ATTRITION_SCALES[r.attrition] ?? 1;
  if (scale === 0) { r.wear = false; r.fuel = false; }
  r.tyreLifeMeters = (r.tyreLifeLaps * track.length) / (scale || 1);
  r.fuelRangeLaps = r.fuelRangeLaps / (scale || 1);
  r.fuelRangeMeters = r.fuelRangeLaps * track.length;
  return r;
}

export function pointsForPosition(position) {
  return POINTS_TABLE[position - 1] || 0;
}
