// Movements of the view that stage contacts and accidents. Pure functions of the simulated state
// of the followed car (its own clock and the clocks of its last events): the same state always
// gives the same picture, whatever the display rate, and a paused race shows a still image.
// Values are fractions of the view height; positive = the nose goes down (the horizon rises).

import { COLLISION_TUNING } from '../../physics/collision-tuning.js';

/** Brief dive of the view after a contact that cost speed (rear-end bump, wheel contact, board). */
export function contactDive(car) {
  const T = COLLISION_TUNING;
  const t = car.clock - car.bumpClock;
  if (t < 0 || t >= T.contactDiveIn + T.contactDiveOut) return 0;
  const k = t < T.contactDiveIn ? t / T.contactDiveIn : 1 - (t - T.contactDiveIn) / T.contactDiveOut;
  return T.contactDive * k * (2 - k);          // eased: quick into the dive, soft out of it
}

/**
 * Shape of the pitch animation of an accident. The two accidents of the reference footage
 * follow the same script with different timings: nose up and held, a steady swing to nose down
 * that ends at the landing, the ground held, a rebound to level, a second dip, the recovery.
 * Amplitudes are fractions of the view height; times in seconds are MEASURED on the footage
 * (see the analysis report), the amplitudes are set so that the horizon leaves the picture.
 */
export const CRASH_CAMERA = {
  noseUp: 0.6,               // the horizon sinks under the cockpit: only sky is left
  noseDown: 0.5,             // the horizon leaves by the top: only the ground is left
  riseTime: 0.06,            // s to rear up at the launch
  holdFraction: 0.47,        // share of the flight spent nose up (0.40 s of 0.85 s)
  groundHoldHard: 0.48, groundHoldLight: 0.28,
  reboundHard: 0.16, reboundLight: 0.08,
  dipInHard: 0.28, dipInLight: 0.2,
  dipHoldHard: 0.6, dipHoldLight: 0.24,
  dipDepthLight: 0.34,       // the second dip of a light landing does not reach the ground-only view
  recoverHard: 0.28, recoverLight: 0.3,
  trembleAmplitude: 0.015, trembleHz: 12,
};

const AIRBORNE = 6, SPIN = 2;      // CAR_STATE values (physics/car-physics.js)

/**
 * Pitch of the view during and after a flight, as a fraction of the view height
 * (positive = nose down). A pure function of the car: state, flight clock, landing clock.
 */
export function crashPitch(car) {
  const C = CRASH_CAMERA;
  if (car.state === AIRBORNE) {
    const u = car.airDuration > 0 ? Math.min(1, car.airTime / car.airDuration) : 1;
    if (u < C.holdFraction) return -C.noseUp * Math.min(1, car.airTime / C.riseTime);
    return -C.noseUp + (C.noseUp + C.noseDown) * ((u - C.holdFraction) / (1 - C.holdFraction));
  }
  if (car.landClock < 0) return 0;
  let t = car.clock - car.landClock;
  if (t < 0) return 0;
  const hard = car.landHard;
  const hold = hard ? C.groundHoldHard : C.groundHoldLight;
  if (t < hold) return C.noseDown;
  t -= hold;
  const rebound = hard ? C.reboundHard : C.reboundLight;
  if (t < rebound) return C.noseDown * (1 - t / rebound);
  t -= rebound;
  const depth = hard ? C.noseDown : C.dipDepthLight, dipIn = hard ? C.dipInHard : C.dipInLight;
  if (t < dipIn) return depth * (t / dipIn);
  t -= dipIn;
  const dipHold = hard ? C.dipHoldHard : C.dipHoldLight;
  if (t < dipHold) return depth;
  t -= dipHold;
  const recover = hard ? C.recoverHard : C.recoverLight;
  if (t < recover) return depth * (1 - t / recover);
  return 0;
}

/** Total duration of the pitch animation after a landing (s). */
export function crashPitchDuration(hard) {
  const C = CRASH_CAMERA;
  return hard ? C.groundHoldHard + C.reboundHard + C.dipInHard + C.dipHoldHard + C.recoverHard
    : C.groundHoldLight + C.reboundLight + C.dipInLight + C.dipHoldLight + C.recoverLight;
}

/** Vertical trembling of the view while the car slides out of control (fraction of the view height). */
export function slideTremble(car) {
  if (car.state !== SPIN || Math.abs(car.speed) < 5) return 0;
  const C = CRASH_CAMERA;
  return C.trembleAmplitude * Math.sin(car.clock * C.trembleHz * Math.PI * 2);
}
