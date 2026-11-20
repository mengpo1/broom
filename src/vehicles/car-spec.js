// Vehicle parameters. Everything that shapes the handling lives here as plain data so it can be
// tuned or modded without touching the simulation code. Units: metres, seconds, radians.

export const GRAVITY = 9.81;

/** Base single-seater. All values are design choices for an arcade feel, not measurements. */
export const BASE_CAR_SPEC = {
  length: 4.4,
  width: 1.9,
  wheelbase: 2.9,
  collisionHalfLength: 2.1,
  collisionHalfWidth: 0.93,
  powerPerMass: 900,                 // W/kg at peak
  minPowerSpeed: 12,                 // m/s, avoids infinite force at standstill
  gearTopSpeeds: [27, 39, 51, 64, 78, 93], // m/s reached at rpmMax in each gear
  rpmIdle: 3500,
  rpmMax: 13500,
  shiftTime: 0.09,
  autoUpshiftAt: 0.965,              // fraction of rpmMax
  autoDownshiftAt: 0.86,             // fraction of the lower gear's top speed
  powerCurve: [[0, 0.22], [0.25, 0.32], [0.4, 0.5], [0.6, 0.76], [0.8, 0.94], [0.92, 1], [1, 0.94]],
  dragCoefficient: 0.00112,          // 1/m (acceleration = c * v^2)
  rollingResistance: 0.3,            // m/s^2
  engineBraking: 2.6,                // m/s^2 at full revs, throttle closed
  gripBase: 1.72,                    // tyre friction coefficient on asphalt
  downforceCoefficient: 0.0002,      // extra grip factor = c * v^2
  tractionFraction: 0.84,            // share of grip usable for acceleration
  brakeDecel: 17,                    // m/s^2 before downforce
  steerLock: 0.34,                   // rad at low speed
  steerRate: 4.6,                    // 1/s toward the requested steering
  steerReturnRate: 7.5,              // 1/s back to centre
  yawResponse: 16,                   // 1/s, how quickly yaw rate follows the steering
  overSteerAllowance: 1.22,          // full lock asks for this multiple of the available grip
  slipScrub: 7,                      // m/s^2 lost per unit of slip
  lateralRecovery: 5,                // 1/s decay of lateral slide velocity
  reverseSpeed: 7,
  fuelCapacity: 100,
  fuelMassPenalty: 0.07,             // acceleration loss with a full tank
};

/**
 * Driving profiles. ARCADE is forgiving (full steering aid, softer contacts, no attrition),
 * RACING adds attrition and a stricter limit, TURBO raises power and enables boost.
 */
export const DRIVING_PROFILES = {
  arcade: {
    id: 'arcade', steerAssist: 1, gripScale: 1.08, powerScale: 1, brakeScale: 1.1,
    wallSpeedLoss: 0.022, crashImpact: 14, carCrashImpact: 19, contactRestitution: 0.35,
    offroadGrip: 0.62, offroadDrag: 0.75, boost: false,
  },
  racing: {
    id: 'racing', steerAssist: 0.78, gripScale: 1, powerScale: 1, brakeScale: 1,
    wallSpeedLoss: 0.032, crashImpact: 11, carCrashImpact: 15, contactRestitution: 0.25,
    offroadGrip: 0.5, offroadDrag: 1, boost: false,
  },
  turbo: {
    id: 'turbo', steerAssist: 0.9, gripScale: 1.04, powerScale: 1.22, brakeScale: 1.05,
    wallSpeedLoss: 0.026, crashImpact: 12.5, carCrashImpact: 17, contactRestitution: 0.3,
    offroadGrip: 0.55, offroadDrag: 0.9, boost: true,
    boostPower: 1.45, boostHeatRate: 0.2, boostCoolRate: 0.085, overheatLockout: 3.5,
  },
};

/** Tyre compounds: grip multiplier and wear speed relative to the medium compound. */
export const TYRE_COMPOUNDS = {
  hard: { id: 'hard', grip: 0.972, wear: 0.55 },
  medium: { id: 'medium', grip: 1, wear: 1 },
  soft: { id: 'soft', grip: 1.034, wear: 1.9 },
};
export const TYRE_ORDER = ['hard', 'medium', 'soft'];

export const WING_LEVELS = 5; // 0 = minimum downforce ... 4 = maximum

export const DEFAULT_SETUP = { wing: 2, tyres: 'medium', gearbox: 'auto' };

export function sanitizeSetup(setup) {
  const s = { ...DEFAULT_SETUP, ...(setup || {}) };
  s.wing = Math.max(0, Math.min(WING_LEVELS - 1, Math.round(s.wing)));
  if (!TYRE_COMPOUNDS[s.tyres]) s.tyres = 'medium';
  if (s.gearbox !== 'manual') s.gearbox = 'auto';
  return s;
}

/**
 * Flatten spec + setup + profile into the parameter object consumed by the physics step.
 * Wing: each step trades about 2.3 % of drag-limited top speed for about 7 % of high speed grip.
 */
export function deriveCarParams(spec, setup, profile, skill = null) {
  const s = sanitizeSetup(setup);
  const wingDrag = 0.86 + 0.07 * s.wing;
  const wingDown = 0.7 + 0.15 * s.wing;
  const compound = TYRE_COMPOUNDS[s.tyres];
  const powerSkill = skill ? skill.power : 1;
  return {
    spec, profile, setup: s,
    wheelbase: spec.wheelbase,
    halfLength: spec.collisionHalfLength,
    halfWidth: spec.collisionHalfWidth,
    power: spec.powerPerMass * profile.powerScale * powerSkill,
    drag: spec.dragCoefficient * wingDrag,
    downforce: spec.downforceCoefficient * wingDown,
    grip: spec.gripBase * profile.gripScale * compound.grip,
    wearRate: compound.wear,
    brake: spec.brakeDecel * profile.brakeScale,
    manual: s.gearbox === 'manual',
    gearCount: spec.gearTopSpeeds.length,
  };
}

/** Maximum lateral (or braking) acceleration available at speed v on a surface. */
export function gripLimit(params, v, surfaceGrip = 1, tyreFactor = 1) {
  return GRAVITY * params.grip * surfaceGrip * tyreFactor * (1 + params.downforce * v * v);
}

/** Highest speed at which a corner of curvature kappa can be taken using `usage` of the grip. */
export function cornerSpeed(params, kappa, usage = 1) {
  const k = Math.abs(kappa);
  const base = GRAVITY * params.grip * usage;
  const denom = k - base * params.downforce;
  if (denom <= 1e-6) return 200;
  return Math.sqrt(base / denom);
}

export function powerFraction(spec, rpmFraction) {
  const curve = spec.powerCurve;
  if (rpmFraction <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (rpmFraction <= curve[i][0]) {
      const a = curve[i - 1], b = curve[i];
      return a[1] + ((b[1] - a[1]) * (rpmFraction - a[0])) / (b[0] - a[0]);
    }
  }
  return 0; // above the limiter
}
