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
  // recoverable hop (DESIGN, not on the footage): the same script much reduced, the horizon never
  // leaves the picture and the view is level again a third of a second after the landing
  hopNoseUp: 0.2, hopNoseDown: 0.13, hopGroundHold: 0.05, hopRebound: 0.1, hopDipIn: 0.07, hopDipHold: 0.03, hopDipDepth: 0.045, hopRecover: 0.1,
};

const AIRBORNE = 6, SPIN = 2;      // CAR_STATE values (physics/car-physics.js)
const RECOVERABLE = 2;             // LANDING.RECOVERABLE

/**
 * Pitch of the view during and after a flight, as a fraction of the view height
 * (positive = nose down). A pure function of the car: state, flight clock, landing clock.
 */
export function crashPitch(car) {
  const C = CRASH_CAMERA;
  if (car.state === AIRBORNE) {
    const u = car.airDuration > 0 ? Math.min(1, car.airTime / car.airDuration) : 1;
    const up = car.airKind === RECOVERABLE ? C.hopNoseUp : C.noseUp, down = car.airKind === RECOVERABLE ? C.hopNoseDown : C.noseDown;
    if (u < C.holdFraction) return -up * Math.min(1, car.airTime / C.riseTime);
    return -up + (up + down) * ((u - C.holdFraction) / (1 - C.holdFraction));
  }
  if (car.landClock < 0) return 0;
  let t = car.clock - car.landClock;
  if (t < 0) return 0;
  if (car.landKind === RECOVERABLE) {
    if (t < C.hopGroundHold) return C.hopNoseDown;
    t -= C.hopGroundHold;
    if (t < C.hopRebound) return C.hopNoseDown * (1 - t / C.hopRebound);
    t -= C.hopRebound;
    if (t < C.hopDipIn) return C.hopDipDepth * (t / C.hopDipIn);
    t -= C.hopDipIn;
    if (t < C.hopDipHold) return C.hopDipDepth;
    t -= C.hopDipHold;
    return t < C.hopRecover ? C.hopDipDepth * (1 - t / C.hopRecover) : 0;
  }
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

/** Total duration of the pitch animation after a landing (s): hard (true), light (false) or a recoverable hop ('hop'). */
export function crashPitchDuration(hard) {
  const C = CRASH_CAMERA;
  if (hard === 'hop') return C.hopGroundHold + C.hopRebound + C.hopDipIn + C.hopDipHold + C.hopRecover;
  return hard ? C.groundHoldHard + C.reboundHard + C.dipInHard + C.dipHoldHard + C.recoverHard
    : C.groundHoldLight + C.reboundLight + C.dipInLight + C.dipHoldLight + C.recoverLight;
}

/**
 * Attitude of a car in an accident, for the cameras that see it from outside: the same script as
 * the pitch of its driver's view, as angles. `out` receives pitch (radians, positive = nose up),
 * roll (radians, positive = right side up: the side that rode over the other car lifts) and
 * squash (1 = none; below 1 the car is flattened for an instant when it hits the ground).
 */
export const FLIGHT_ATTITUDE = { pitchPerView: 0.4, roll: 0.2, rollHop: 0.11, squashHard: 0.24, squashLight: 0.12, squashHop: 0.08, squashTime: 0.16 };
export function flightAttitude(car, out) {
  const A = FLIGHT_ATTITUDE;
  out.pitch = 0; out.roll = 0; out.squash = 1;
  if (car.state === AIRBORNE) {
    const u = car.airDuration > 0 ? Math.min(1, car.airTime / car.airDuration) : 1;
    out.pitch = -crashPitch(car) * A.pitchPerView;
    out.roll = (car.launchSide || 0) * (car.airKind === RECOVERABLE ? A.rollHop : A.roll) * Math.sin(Math.PI * u);
    return out;
  }
  const t = car.clock - car.landClock;
  if (car.landClock < 0 || t < 0 || t >= A.squashTime) return out;
  const k = 1 - t / A.squashTime;
  const hop = car.landKind === RECOVERABLE;
  out.pitch = -(hop ? CRASH_CAMERA.hopNoseDown : CRASH_CAMERA.noseDown) * A.pitchPerView * k;          // it lands on its nose, then settles
  out.squash = 1 - (hop ? A.squashHop : car.landHard ? A.squashHard : A.squashLight) * k;
  return out;
}

/** Vertical trembling of the view while the car slides out of control (fraction of the view height). */
export function slideTremble(car) {
  if (car.state !== SPIN || Math.abs(car.speed) < 5) return 0;
  const C = CRASH_CAMERA;
  return C.trembleAmplitude * Math.sin(car.clock * C.trembleHz * Math.PI * 2);
}
