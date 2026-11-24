// Arcade single-seater dynamics. One deterministic step function shared by human and AI cars.
// The model is intentionally light: kinematic steering limited by a speed dependent grip budget,
// power/drag/brake longitudinal model with gears, surface effects and wall contacts expressed
// in track coordinates (s along the centre line, d to the right of it).

import { clamp, damp, moveToward, angleDiff, wrapAngle, lerp } from '../core/math.js';
import { GRAVITY, gripLimit, powerFraction } from '../vehicles/car-spec.js';
import { SURFACE, locateOnTrack, relativeS, sampleArray } from '../tracks/track-builder.js';
import { COLLISION_TUNING } from './collision-tuning.js';

// AIRBORNE: thrown in the air by a contact; WRECKED: stopped on the spot after a hard landing.
export const CAR_STATE = { GRID: 0, RACING: 1, SPIN: 2, RESET: 3, SERVICE: 4, RETIRED: 5, AIRBORNE: 6, WRECKED: 7 };
/**
 * How a flight ends. LIGHT: the car slides out of control until it stops (launch on an obstacle).
 * HARD: stopped on the spot, explosion, restart (launch over a car). RECOVERABLE: it comes down on
 * its wheels and drives on, the steering disturbed for a moment (hop over a wheel).
 */
export const LANDING = { LIGHT: 0, HARD: 1, RECOVERABLE: 2 };

const located = { index: 0, s: 0, d: 0 };

export function createCarState(index) {
  return {
    index, params: null, driver: null, isHuman: false, playerIndex: -1, teamIndex: 0,
    state: CAR_STATE.GRID,
    x: 0, y: 0, z: 0, heading: 0, pitch: 0,
    prevX: 0, prevY: 0, prevZ: 0, prevHeading: 0, prevPitch: 0,
    speed: 0, vLat: 0, yawRate: 0, velX: 0, velZ: 0,
    steer: 0, throttle: 0, brake: 0,
    inSteer: 0, inThrottle: 0, inBrake: 0, inShift: 0, inBoost: false, inReset: false,
    gear: 1, rpm: 0, shiftTimer: 0, reverse: false, reverseTimer: 0, limiter: false,
    segIndex: -1, s: 0, d: 0, surface: SURFACE.ASPHALT, progress: 0, headingError: 0,
    inPit: false, pitAuto: false, autoDrive: false, wantsPit: false, pitBoxS: 0, servicedThisVisit: false, removed: false, timingStarted: false, serviceTimer: 0, serviceTotal: 0, pitStops: 0,
    tyreWear: 0, fuel: 100, damage: 0, puncture: false, engineOut: false,
    boostHeat: 0, boostLock: 0, boosting: false,
    draft: 0, slip: 0, wheelspin: 0, accelLong: 0, accelLat: 0, odometer: 0,
    spinTimer: 0, spinRate: 0, resetTimer: 0, ghostTimer: 0, stuckTimer: 0, wrongWayTimer: 0,
    lap: 0, lapStartTime: 0, lastLapTime: 0, bestLapTime: 0, lapTimes: [], sector: 0,
    sectorStart: 0, lastSectorTime: 0, finished: false, finishTime: 0, position: 0, gridPosition: 0,
    overtakes: 0, contacts: 0, wallHits: 0, offTrackTime: 0, resets: 0, topSpeed: 0,
    lastContactTime: -10, compound: 'medium', nextCompound: 'medium',
    // collisions and accidents (see collision-tuning.js): `clock` is the car's own simulation time,
    // the other clocks are values of it at the last event, for the animations driven by the state
    clock: 0, lastPenaltyClock: -10, bumpClock: -10, bumpStrength: 0,
    airTime: 0, airDuration: 0, airHard: false, airHeight: 0, launchSide: 0, launchOther: -1, launchClock: -10,
    landClock: -10, landHard: false, wreckTimer: 0, wreckDecel: 0, slideGentle: false,
    airKind: 0, airPeak: 0, landKind: 0, airPlanned: 0, airHold: 0, rearmClock: -10,
  };
}

/** Place a car on the track at (s, d), stationary, facing forward. */
export function placeCar(car, track, s, d) {
  const n = track.n;
  const f = (((s % track.length) + track.length) % track.length) / track.ds;
  const i = Math.floor(f) % n, j = (i + 1) % n, t = f - Math.floor(f);
  const nxv = lerp(track.nx[i], track.nx[j], t), nzv = lerp(track.nz[i], track.nz[j], t);
  car.x = lerp(track.x[i], track.x[j], t) + nxv * d;
  car.z = lerp(track.z[i], track.z[j], t) + nzv * d;
  car.y = lerp(track.y[i], track.y[j], t);
  car.heading = track.heading[i] + wrapAngle(track.heading[j] - track.heading[i]) * t;
  car.pitch = Math.atan(lerp(track.grade[i], track.grade[j], t));
  car.segIndex = i; car.s = f * track.ds; car.d = d;
  car.speed = 0; car.vLat = 0; car.yawRate = 0; car.velX = 0; car.velZ = 0; car.steer = 0;
  car.gear = 1; car.reverse = false; car.slip = 0; car.wheelspin = 0;
  car.prevX = car.x; car.prevY = car.y; car.prevZ = car.z; car.prevHeading = car.heading; car.prevPitch = car.pitch;
  car.headingError = 0;
}

export function startSpin(car, impact, direction, emit) {
  if (car.state !== CAR_STATE.RACING) return;
  const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
  car.velX = ch * car.speed - sh * car.vLat;
  car.velZ = sh * car.speed + ch * car.vLat;
  car.state = CAR_STATE.SPIN;
  car.slideGentle = false;
  car.spinTimer = 1.1 + Math.min(impact, 25) * 0.035;
  car.spinRate = (direction >= 0 ? 1 : -1) * (5 + Math.min(impact, 25) * 0.16);
  car.pitAuto = false;
  if (emit) emit('crash', car.index, impact);
}

/**
 * Throw a car in the air (it rode over another car, or hit a roadside object). In flight it
 * follows its velocity, cannot be steered and slows down; it comes down after `duration` seconds
 * (later only if another car is then under it: see the contacts between cars),
 * hard (stopped on the spot, see WRECKED) or light (it slides out of control, see startSlide).
 * @param side  -1 / 0 / +1: side of the car that took the hit (where the damage shows)
 */
export function startAirborne(car, duration, hard, emit, other = -1, side = 0) {
  if (car.state !== CAR_STATE.RACING && car.state !== CAR_STATE.SPIN) return false;
  if (car.state === CAR_STATE.RACING) {
    const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
    car.velX = ch * car.speed - sh * car.vLat;
    car.velZ = sh * car.speed + ch * car.vLat;
  }
  car.state = CAR_STATE.AIRBORNE;
  car.airTime = 0; car.airDuration = duration; car.airPlanned = duration; car.airHold = 0; car.airHard = hard; car.airHeight = 0;
  car.airKind = hard ? LANDING.HARD : LANDING.LIGHT;
  const reach = duration / COLLISION_TUNING.flightTimeCar;
  car.airPeak = COLLISION_TUNING.airPeakHeight * reach * reach;
  car.launchSide = side; car.launchClock = car.clock; car.launchOther = other;
  car.pitAuto = false; car.vLat = 0; car.yawRate = 0;
  if (emit) emit('launch', car.index, Math.hypot(car.velX, car.velZ), other);
  return true;
}

/**
 * Recoverable hop: a front wheel of the car has run into the back of a rear wheel of another one and
 * climbs it. The car flies for `duration` seconds and comes down on its wheels (see LANDING.RECOVERABLE).
 *
 * Nothing is taken from its speed at the shock: it needs it to get past the car it touched. What the
 * hop costs is the time spent in the air, where the car slows down as in any flight; nothing more is
 * taken at the landing. It is never sped up.
 */
export function startHop(car, emit, other, side, duration = COLLISION_TUNING.hopFlightTime) {
  if (car.state !== CAR_STATE.RACING) return false;
  const T = COLLISION_TUNING;
  startAirborne(car, duration, false, null, other, side);
  const reach = duration / T.flightTimeCar;
  car.airKind = LANDING.RECOVERABLE; car.airPeak = Math.max(T.hopPeakHeight, T.airPeakHeight * reach * reach);
  const speed = Math.hypot(car.velX, car.velZ);
  if (emit) { emit('launch', car.index, speed, other); emit('hop', car.index, speed, other); }
  return true;
}

/**
 * Disturbance of the steering after a recoverable landing, added to what the driver asks for (share
 * of the steering travel): whole swings that grow then fade, so that they cancel out and the car is
 * left heading where it was. Zero at any other time.
 */
export function hopSteerKick(car) {
  if (car.landKind !== LANDING.RECOVERABLE) return 0;
  const T = COLLISION_TUNING, x = (car.clock - car.landClock) / T.hopWobbleTime;
  if (x < 0 || x >= 1) return 0;
  return -(car.launchSide || 1) * T.hopWobbleSteer * Math.sin(Math.PI * x) * Math.sin(Math.PI * 2 * T.hopWobbleSwings * x);   // first away from the side that was hit
}

/** Loss of control after a light landing: the car slides on, turning slowly, until it stops. */
function startSlide(car) {
  car.state = CAR_STATE.SPIN;
  car.slideGentle = true;
  car.spinTimer = 0.2;
  // it turns toward the track (positive heading error = moving toward positive d)
  car.spinRate = (car.d > 0 ? -1 : 1) * COLLISION_TUNING.slideYawRate;
}

function stepAirborne(car, dt, emit) {
  const T = COLLISION_TUNING, spec = car.params.spec;
  const v = Math.hypot(car.velX, car.velZ);
  const decel = car.airKind === LANDING.RECOVERABLE ? T.hopAirDecel : T.airDecel;
  const nv = Math.max(0, v - decel * dt);
  const k = v > 1e-4 ? nv / v : 0;
  car.velX *= k; car.velZ *= k;
  car.x += car.velX * dt; car.z += car.velZ * dt;
  car.airTime += dt;
  const u = Math.min(1, car.airTime / car.airDuration);
  car.airHeight = car.airPeak * 4 * u * (1 - u);
  car.speed = nv; car.vLat = 0; car.yawRate = 0; car.slip = 0; car.wheelspin = 0;
  car.throttle = 0; car.brake = 0; car.steer = moveToward(car.steer, 0, 3 * dt);
  car.rpm = damp(car.rpm, spec.rpmIdle + (spec.rpmMax - spec.rpmIdle) * 0.35, 5, dt);
  car.accelLong = -decel; car.accelLat = 0;
  if (car.airTime < car.airDuration) return;
  // ---- landing
  car.airHeight = 0; car.landClock = car.clock; car.landHard = car.airHard; car.landKind = car.airKind;
  if (car.airKind === LANDING.RECOVERABLE) {
    // on its wheels and driving again at once, at the speed it had in the air: what the hop costs was
    // taken during the flight
    car.velX *= T.hopLandingSpeedFactor; car.velZ *= T.hopLandingSpeedFactor;
    car.speed = nv * T.hopLandingSpeedFactor;
    if (nv > 1) car.heading = Math.atan2(car.velZ, car.velX);          // it comes down pointing the way it flew
    car.state = CAR_STATE.RACING;
    car.rearmClock = car.clock; car.stuckTimer = 0;
    if (emit) emit('landing', car.index, LANDING.RECOVERABLE);
  } else if (car.airHard) {
    car.velX *= T.hardLandingSpeedFactor; car.velZ *= T.hardLandingSpeedFactor;
    car.speed = nv * T.hardLandingSpeedFactor;
    car.state = CAR_STATE.WRECKED;
    car.wreckTimer = 0; car.wreckDecel = car.speed / T.hardLandingStopTime;
    if (emit) { emit('landing', car.index, 1); emit('crash', car.index, 20); }
  } else {
    startSlide(car);
    if (emit) emit('landing', car.index, 0);
  }
}

/** After a hard landing: the car runs out of speed, stays where it stopped, then restarts in first gear. */
function stepWrecked(car, track, dt, emit) {
  const T = COLLISION_TUNING, spec = car.params.spec;
  const v = Math.hypot(car.velX, car.velZ);
  const nv = Math.max(0, v - car.wreckDecel * dt);
  const k = v > 1e-4 ? nv / v : 0;
  car.velX *= k; car.velZ *= k;
  car.x += car.velX * dt; car.z += car.velZ * dt;
  car.speed = nv; car.vLat = 0; car.yawRate = 0; car.slip = 0; car.wheelspin = 0;
  car.throttle = 0; car.brake = 1; car.steer = 0;
  car.rpm = damp(car.rpm, spec.rpmIdle, 4, dt);
  car.accelLong = nv > 0 ? -car.wreckDecel : 0; car.accelLat = 0;
  if (nv === 0) { car.gear = 1; car.reverse = false; }          // stopped: first gear, ready to restart
  car.wreckTimer += dt;
  if (car.wreckTimer < T.hardLandingStopTime + T.wreckHoldTime) return;
  // restart on the spot when the car is on the road and pointing the right way; otherwise it is put back
  car.velX = 0; car.velZ = 0; car.speed = 0; car.gear = 1; car.reverse = false; car.shiftTimer = 0;
  if (Math.abs(car.d) > track.halfWidth + 1 || Math.abs(car.headingError) > 1.2 || car.engineOut) {
    car.state = CAR_STATE.RESET; car.resetTimer = 0.1;
  } else {
    car.state = CAR_STATE.RACING; car.ghostTimer = T.restartGhostTime; car.stuckTimer = 0;
  }
  if (emit) emit('restart', car.index, 0);
}

export function requestReset(car, delay) {
  if (car.state === CAR_STATE.RETIRED || car.state === CAR_STATE.GRID || car.state === CAR_STATE.SERVICE) return;
  car.state = CAR_STATE.RESET;
  car.resetTimer = delay;
  car.speed = 0; car.vLat = 0; car.yawRate = 0; car.velX = 0; car.velZ = 0;
}

/** Steering angle at full lock for the current speed (speed sensitive when the aid is on). */
export function steeringLock(params, absV, aMax) {
  const spec = params.spec;
  let lock = spec.steerLock;
  if (absV > 6) {
    const gripLock = Math.atan((params.wheelbase * aMax * spec.overSteerAllowance) / (absV * absV));
    lock = lerp(lock, Math.min(lock, gripLock), params.profile.steerAssist);
  }
  return lock;
}

function surfaceGrip(surface, profile) {
  switch (surface) {
    case SURFACE.KERB: return 0.94;
    case SURFACE.GRASS: return profile.offroadGrip;
    case SURFACE.GRAVEL: return profile.offroadGrip * 0.85;
    default: return 1;
  }
}

function surfaceDrag(surface, profile, v) {
  switch (surface) {
    case SURFACE.GRASS: return (3 + 0.035 * v) * profile.offroadDrag;
    case SURFACE.GRAVEL: return (7.5 + 0.07 * v) * profile.offroadDrag;
    default: return 0;
  }
}

/**
 * Advance one car by dt.
 * @param rules  { wear, fuel, damage, tyreLifeMeters, fuelRangeMeters, crashes }
 * @param emit   function(type, carIndex, value) or null
 */
export function stepCar(car, track, dt, rules, emit) {
  car.prevX = car.x; car.prevY = car.y; car.prevZ = car.z;
  car.prevHeading = car.heading; car.prevPitch = car.pitch;
  if (car.ghostTimer > 0) car.ghostTimer -= dt;
  car.clock += dt;
  const spec = car.params.spec;

  switch (car.state) {
    case CAR_STATE.GRID:
    case CAR_STATE.SERVICE: {
      car.speed = 0; car.vLat = 0; car.yawRate = 0; car.slip = 0; car.wheelspin = 0;
      car.throttle = car.state === CAR_STATE.GRID ? car.inThrottle : 0;
      const target = spec.rpmIdle + (spec.rpmMax - spec.rpmIdle) * 0.78 * car.throttle;
      car.rpm = damp(car.rpm, target, car.rpm < target ? 9 : 5, dt);
      car.accelLong = 0; car.accelLat = 0;
      return;
    }
    case CAR_STATE.RESET:
      car.resetTimer -= dt;
      car.rpm = damp(car.rpm, spec.rpmIdle, 6, dt);
      car.slip = 0; car.wheelspin = 0;
      if (car.resetTimer <= 0) repositionCar(car, track, emit);
      return;
    case CAR_STATE.SPIN:
      stepSpin(car, dt);
      break;
    case CAR_STATE.AIRBORNE:
      stepAirborne(car, dt, emit);
      break;
    case CAR_STATE.WRECKED:
      stepWrecked(car, track, dt, emit);
      break;
    case CAR_STATE.RETIRED:
      car.inThrottle = 0; car.inBrake = car.speed > 0.5 ? 0.35 : 1; car.inSteer = 0;
      stepDrive(car, track, dt, rules, emit);
      break;
    default: {
      // (after a recoverable landing the steering swings for a moment around what the driver asks for)
      const kick = hopSteerKick(car);
      if (kick !== 0) {
        const asked = car.inSteer;
        car.inSteer = clamp(asked + kick, -1, 1);
        stepDrive(car, track, dt, rules, emit);
        car.inSteer = asked;
      } else stepDrive(car, track, dt, rules, emit);
    }
  }
  updateTrackFrame(car, track, dt);
  collideBoundaries(car, track, rules, emit);
  if (car.state === CAR_STATE.RACING) watchStuck(car, dt, emit);
}

function stepSpin(car, dt) {
  const spec = car.params.spec;
  const v = Math.hypot(car.velX, car.velZ);
  let decel = 12 + 0.05 * v;
  if (car.slideGentle) {
    // slide after a light landing: little grip at first, then the car digs in
    const T = COLLISION_TUNING, t = car.clock - car.landClock;
    decel = T.slideDecelStart + (T.slideDecelEnd - T.slideDecelStart) * clamp((t - T.slideDecelDelay) / T.slideDecelRamp, 0, 1);
  }
  const nv = Math.max(0, v - decel * dt);
  const k = v > 1e-4 ? nv / v : 0;
  car.velX *= k; car.velZ *= k;
  car.x += car.velX * dt; car.z += car.velZ * dt;
  car.heading = wrapAngle(car.heading + car.spinRate * dt);
  if (!car.slideGentle) car.spinRate *= Math.exp(-0.9 * dt); else if (nv < 2) car.spinRate = 0;
  car.spinTimer -= dt;
  car.speed = nv; car.vLat = 0; car.yawRate = car.spinRate;
  car.slip = Math.min(2, v * 0.1); car.wheelspin = 0;
  car.throttle = 0; car.brake = 1; car.steer = 0;
  car.rpm = damp(car.rpm, spec.rpmIdle, 4, dt);
  car.accelLong = -decel; car.accelLat = 0;
  if (car.slideGentle) {
    // the slide after a light landing ends where the car stops: its driver takes it back from there
    // (the usual watch puts it back on the track if it then stays stuck)
    if ((car.spinTimer <= 0 && nv < 0.3) || car.spinTimer < -6) {
      car.slideGentle = false;
      car.velX = 0; car.velZ = 0; car.speed = 0; car.yawRate = 0; car.slip = 0;
      car.gear = 1; car.reverse = false; car.shiftTimer = 0; car.stuckTimer = 0;
      car.ghostTimer = COLLISION_TUNING.restartGhostTime;
      car.state = car.engineOut ? CAR_STATE.RETIRED : CAR_STATE.RACING;
    }
    return;
  }
  if ((car.spinTimer <= 0 && nv < 4) || car.spinTimer < -3) {
    car.state = CAR_STATE.RESET;
    car.resetTimer = 0.7;
    car.speed = 0;
  }
}

function repositionCar(car, track, emit) {
  let d = 0;
  if (car.inPit) d = track.pit.side * track.pit.laneD;
  placeCar(car, track, car.s, d);
  car.state = car.engineOut ? CAR_STATE.RETIRED : CAR_STATE.RACING;
  car.ghostTimer = 2.5;
  car.stuckTimer = 0;
  car.resets++;
  if (emit) emit('reset', car.index, 0);
}

function stepDrive(car, track, dt, rules, emit) {
  const p = car.params, spec = p.spec, profile = p.profile;
  let v = car.speed;
  const absV = Math.abs(v);
  const throttleIn = clamp(car.inThrottle, 0, 1), brakeIn = clamp(car.inBrake, 0, 1);

  // ---- tyres and surface
  let tyreFactor = 1 - 0.2 * car.tyreWear * car.tyreWear;
  if (car.puncture) tyreFactor *= 0.62;
  if (rules.damage) tyreFactor *= 1 - 0.12 * Math.min(1, car.damage);
  const sGrip = surfaceGrip(car.surface, profile);
  const aMax = gripLimit(p, absV, sGrip, tyreFactor);

  // ---- steering
  const steerTarget = clamp(car.inSteer, -1, 1);
  const towardCentre = Math.abs(steerTarget) < Math.abs(car.steer) || steerTarget * car.steer < 0;
  car.steer = moveToward(car.steer, steerTarget, (towardCentre ? spec.steerReturnRate : spec.steerRate) * dt);
  const lock = steeringLock(p, absV, aMax);
  const yawWanted = (v * Math.tan(car.steer * lock)) / p.wheelbase;
  const latWanted = Math.abs(v * yawWanted);
  let slip = latWanted > aMax ? latWanted / aMax - 1 : 0;
  let yawTarget = yawWanted;
  if (slip > 0) yawTarget = (yawWanted * (1 + Math.min(slip, 0.5) * 0.12)) / (1 + slip);
  car.yawRate = damp(car.yawRate, yawTarget, spec.yawResponse, dt);
  car.heading = wrapAngle(car.heading + car.yawRate * dt);
  car.accelLat = v * car.yawRate;

  // ---- gearbox
  const gears = spec.gearTopSpeeds;
  if (car.shiftTimer > 0) car.shiftTimer -= dt;
  if (!car.reverse) {
    if (p.manual && !car.pitAuto && !car.autoDrive) {
      if (car.inShift > 0 && car.gear < p.gearCount) { car.gear++; car.shiftTimer = spec.shiftTime; if (emit) emit('shift', car.index, 1); }
      else if (car.inShift < 0 && car.gear > 1 && absV < gears[car.gear - 2] * 1.06) { car.gear--; car.shiftTimer = spec.shiftTime; if (emit) emit('shift', car.index, -1); }
    } else if (car.shiftTimer <= 0) {
      if (car.gear < p.gearCount && absV > gears[car.gear - 1] * spec.autoUpshiftAt && throttleIn > 0.1) {
        car.gear++; car.shiftTimer = spec.shiftTime; if (emit) emit('shift', car.index, 1);
      } else if (car.gear > 1 && absV < gears[car.gear - 2] * spec.autoDownshiftAt) {
        car.gear--; car.shiftTimer = spec.shiftTime * 0.6; if (emit) emit('shift', car.index, -1);
      }
    }
  }
  car.inShift = 0;
  const gearTop = car.reverse ? gears[0] : gears[car.gear - 1];
  const rpmFraction = absV / gearTop;
  car.limiter = rpmFraction >= 1;

  // ---- reverse engagement (hold brake at standstill)
  if (absV < 0.6 && brakeIn > 0.3 && throttleIn < 0.1 && car.isHuman && !car.pitAuto && !car.autoDrive && car.state === CAR_STATE.RACING) {
    car.reverseTimer += dt;
    if (car.reverseTimer > 0.35) car.reverse = true;
  } else if (!car.reverse || throttleIn > 0.1) {
    if (car.reverse && throttleIn > 0.1 && v > -0.6) car.reverse = false;
    car.reverseTimer = 0;
  }

  // ---- boost (turbo profile)
  let boostFactor = 1;
  car.boosting = false;
  if (profile.boost) {
    if (car.boostLock > 0) car.boostLock -= dt;
    if (car.inBoost && car.boostLock <= 0 && throttleIn > 0.5 && !car.reverse) {
      car.boosting = true;
      boostFactor = profile.boostPower;
      car.boostHeat += profile.boostHeatRate * dt;
      if (car.boostHeat >= 1) { car.boostHeat = 1; car.boostLock = profile.overheatLockout; if (emit) emit('overheat', car.index, 0); }
    } else {
      car.boostHeat = Math.max(0, car.boostHeat - profile.boostCoolRate * dt);
    }
  }

  // ---- longitudinal forces
  let accel = 0;
  const engineAlive = !car.engineOut && (!rules.fuel || car.fuel > 0);
  const fuelFactor = 1 / (1 + (rules.fuel ? spec.fuelMassPenalty * (car.fuel / spec.fuelCapacity) : 0));
  let drive = 0;
  car.wheelspin = 0;
  if (car.reverse) {
    if (brakeIn > 0.05 && v > -spec.reverseSpeed) accel -= 6 * brakeIn;
    if (throttleIn > 0.05) accel += Math.min(-v * 6, 14) * throttleIn;
  } else {
    if (engineAlive && car.shiftTimer <= 0 && throttleIn > 0) {
      const raw = (throttleIn * p.power * boostFactor * powerFraction(spec, rpmFraction) * fuelFactor) / Math.max(absV, spec.minPowerSpeed);
      const traction = aMax * spec.tractionFraction;
      drive = Math.min(raw, traction);
      if (raw > traction * 1.25 && absV < 34) car.wheelspin = Math.min(1, (raw / traction - 1.25) * 2) * throttleIn;
    }
    accel += drive;
    const brakeMax = Math.min(p.brake * (1 + p.downforce * v * v * 0.9) * sGrip, aMax * 1.15);
    accel -= brakeIn * brakeMax;
    accel -= spec.engineBraking * Math.min(1, rpmFraction) * (1 - throttleIn);
  }
  const dragCoefficient = p.drag * (1 - 0.32 * car.draft) * (car.puncture ? 2.4 : 1) * (1 + (rules.damage ? 0.5 * car.damage : 0));
  const resist = dragCoefficient * v * v + spec.rollingResistance + surfaceDrag(car.surface, profile, absV) + spec.slipScrub * Math.min(slip, 1.5);
  accel -= Math.sign(v) * resist;
  accel -= GRAVITY * Math.sin(car.pitch);

  // Pit lane limiter.
  if (car.inPit && track.pit && absV > track.pit.speedLimit) {
    const rel = relativeS(track, car.s);
    if (rel > track.pit.wallStartS - 20 && rel < track.pit.wallEndS) accel = Math.min(accel, -22);
  }

  let nv = v + accel * dt;
  if (!car.reverse && v >= 0 && nv < 0) nv = 0;        // brakes never push the car backwards
  if (car.reverse && nv > 0 && throttleIn < 0.05) nv = Math.min(nv, 0);
  if (car.limiter && nv > gearTop && drive > 0) nv = Math.max(gearTop, v - 0.5 * dt);
  car.accelLong = (nv - v) / dt;
  v = nv;
  car.speed = v;

  // ---- lateral slide (visible drift when beyond the limit, decays with grip)
  if (slip > 0) car.vLat -= Math.sign(car.yawRate) * Math.min(slip, 1.5) * aMax * 0.22 * dt;
  car.vLat *= Math.exp(-spec.lateralRecovery * sGrip * dt);
  car.slip = damp(car.slip, slip + Math.abs(car.vLat) * 0.12, 12, dt);

  // ---- integrate position
  const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
  car.x += (ch * v - sh * car.vLat) * dt;
  car.z += (sh * v + ch * car.vLat) * dt;
  car.odometer += v * dt;

  // ---- engine speed
  const rpmTarget = car.reverse
    ? spec.rpmIdle + (spec.rpmMax - spec.rpmIdle) * Math.min(1, absV / gears[0])
    : Math.max(spec.rpmIdle, spec.rpmMax * Math.min(1.02, rpmFraction));
  const slipRev = car.wheelspin > 0 ? spec.rpmMax * 0.25 * car.wheelspin : 0;
  car.rpm = damp(car.rpm, engineAlive ? Math.min(spec.rpmMax, rpmTarget + slipRev) : 0, 22, dt);
  car.throttle = throttleIn; car.brake = brakeIn;
  if (absV > car.topSpeed) car.topSpeed = absV;

  // ---- attrition
  if (rules.wear && !car.puncture) {
    const load = 0.45 + 0.55 * Math.min(1, latWanted / aMax) + 2.2 * Math.min(slip, 1.5) + car.wheelspin;
    car.tyreWear += (absV * dt * load * p.wearRate) / rules.tyreLifeMeters;
    if (car.tyreWear >= 1) { car.tyreWear = 1; car.puncture = true; if (emit) emit('puncture', car.index, 0); }
  }
  if (rules.fuel && car.fuel > 0 && engineAlive) {
    const burn = (0.35 + 0.65 * throttleIn) * (car.boosting ? 1.6 : 1);
    car.fuel -= (spec.fuelCapacity * absV * dt * burn) / (rules.fuelRangeMeters * 0.87);
    if (car.fuel <= 0) { car.fuel = 0; if (emit) emit('fuelOut', car.index, 0); }
  }
  if (car.surface === SURFACE.GRASS || car.surface === SURFACE.GRAVEL) car.offTrackTime += dt;
}

function updateTrackFrame(car, track, dt) {
  const previousS = car.s;
  locateOnTrack(track, car.x, car.z, car.segIndex, located);
  let ds = located.s - previousS;
  if (ds > track.length / 2) ds -= track.length; else if (ds < -track.length / 2) ds += track.length;
  if (car.segIndex >= 0) car.progress += ds;
  car.segIndex = located.index; car.s = located.s; car.d = located.d;
  const i = located.index;
  car.headingError = angleDiff(car.heading, track.heading[i]);
  const ad = Math.abs(car.d);
  if (ad <= track.halfWidth) car.surface = SURFACE.ASPHALT;
  else {
    const right = car.d > 0;
    const kerb = right ? track.kerbR[i] : track.kerbL[i];
    const verge = right ? track.vergeR[i] : track.vergeL[i];
    if (kerb > 0.5 && ad <= track.halfWidth + track.kerbWidth) car.surface = SURFACE.KERB;
    else if (verge === 2) car.surface = SURFACE.PIT;
    else if (verge === 1 && ad > track.halfWidth + 3) car.surface = SURFACE.GRAVEL;
    else car.surface = SURFACE.GRASS;
  }
  car.y = sampleArray(track, track.y, car.s);
  const grade = track.grade[i] * Math.cos(car.headingError);
  car.pitch = damp(car.pitch, Math.atan(grade), 20, dt);
}

function wallBounce(car, track, side, penetration, rules, emit) {
  const i = car.segIndex;
  const nx = track.nx[i], nz = track.nz[i], tx = track.tx[i], tz = track.tz[i];
  car.x -= nx * side * penetration;
  car.z -= nz * side * penetration;
  car.d -= side * penetration;
  const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
  const spinning = car.state === CAR_STATE.SPIN || car.state === CAR_STATE.AIRBORNE || car.state === CAR_STATE.WRECKED;
  const vx = spinning ? car.velX : ch * car.speed - sh * car.vLat;
  const vz = spinning ? car.velZ : sh * car.speed + ch * car.vLat;
  const vn = (vx * nx + vz * nz) * side;
  if (vn <= 0.15) return;
  if (car.state === CAR_STATE.AIRBORNE || car.state === CAR_STATE.WRECKED) {
    // in flight or wrecked: kept inside the barriers, quietly (the accident is already being staged)
    car.velX -= nx * side * vn; car.velZ -= nz * side * vn;
    return;
  }
  const vt = vx * tx + vz * tz;
  const profile = car.params.profile;
  car.wallHits++;
  if (emit) emit('wall', car.index, vn);
  if (rules.damage) car.damage = Math.min(1, car.damage + Math.max(0, vn - 2) * 0.011);
  if (spinning) {
    const bounce = -vn * 0.4 * side;
    car.velX = tx * vt * 0.8 + nx * bounce;
    car.velZ = tz * vt * 0.8 + nz * bounce;
    return;
  }
  const direction = vt >= 0 ? 1 : -1;
  const loss = clamp(1 - vn * profile.wallSpeedLoss, 0.25, 1);
  const awayHeading = track.heading[i] + (direction < 0 ? Math.PI : 0) - side * direction * 0.05;
  const blend = clamp(vn / 6, 0.25, 1);
  car.heading = wrapAngle(car.heading + angleDiff(awayHeading, car.heading) * blend);
  const facing = Math.cos(angleDiff(car.heading, track.heading[i])) >= 0 ? 1 : -1;
  car.speed = Math.abs(vt) * loss * (facing === direction ? 1 : -1);
  car.vLat = -side * facing * Math.min(vn * 0.3, 3);
  car.yawRate *= 0.3;
  if (vn > profile.crashImpact && rules.crashes !== false) startSpin(car, vn, -side * direction, emit);
}

function collideBoundaries(car, track, rules, emit) {
  if (car.state !== CAR_STATE.RACING && car.state !== CAR_STATE.SPIN && car.state !== CAR_STATE.RETIRED && car.state !== CAR_STATE.AIRBORNE && car.state !== CAR_STATE.WRECKED) return;
  const i = car.segIndex, hw = car.params.halfWidth, pit = track.pit;
  let limitR = track.barrierR[i] - hw, limitL = track.barrierL[i] - hw;
  const rel = relativeS(track, car.s);
  const inZone = rel >= pit.entryS && rel <= pit.exitS;
  const inWall = rel >= pit.wallStartS && rel <= pit.wallEndS;
  const dp = car.d * pit.side;
  if (!inZone) car.inPit = false;
  else if (!inWall) car.inPit = dp > pit.wallD;
  if (inWall) {
    const half = pit.wallThickness / 2 + hw;
    if (car.inPit) {
      if (dp < pit.wallD + half) wallBounce(car, track, -pit.side, pit.wallD + half - dp, rules, emit);
    } else if (pit.side > 0) limitR = Math.min(limitR, pit.wallD - half);
    else limitL = Math.min(limitL, pit.wallD - half);
  }
  if (car.d > limitR) wallBounce(car, track, 1, car.d - limitR, rules, emit);
  else if (car.d < -limitL) wallBounce(car, track, -1, -limitL - car.d, rules, emit);
}

function watchStuck(car, dt, emit) {
  if (car.inReset) {
    car.inReset = false;
    requestReset(car, 0.5);
    if (emit) emit('manualReset', car.index, 0);
    return;
  }
  const offLine = car.surface === SURFACE.GRASS || car.surface === SURFACE.GRAVEL || Math.abs(car.headingError) > 1.9;
  const slow = Math.abs(car.speed) < 1.5;
  if (slow && (offLine || !car.isHuman) && !car.pitAuto) car.stuckTimer += dt;
  else car.stuckTimer = Math.max(0, car.stuckTimer - dt * 2);
  if (car.stuckTimer > (car.isHuman ? 3 : 4)) requestReset(car, 0.4);
  if (Math.abs(car.headingError) > 1.75 && car.speed > 4) car.wrongWayTimer += dt; else car.wrongWayTimer = 0;
}
