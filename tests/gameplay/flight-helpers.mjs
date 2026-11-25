// A field of cars on a straight, each driven by a small script, for the tests of what happens when a car in
// flight cannot come down where it planned to: a car stays under it, a pack fills the places where it could
// land, two cars take off almost together. The cars are driven through their controls (throttle, brake,
// steering) like any car of a race: nothing is placed by hand once the scenario has started.
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { straightStretch, bodyOverlap, KMH } from './collision-helpers.mjs';

export { SIM_DT, CAR_STATE, KMH, bodyOverlap };

function gearFor(car, speed) {
  const tops = car.params.spec.gearTopSpeeds;
  for (let g = 0; g < tops.length; g++) if (speed < tops[g] * 0.93) return g + 1;
  return tops.length;
}

/**
 * `n` identical cars on the long straight of `track`, none of them driven by the computer.
 * put(car, along, d, kmh): `along` metres from the start of the scenario, `d` metres to the right of the centre line.
 * Each car has a `drive` function (car, field) called before every step: it writes inThrottle, inBrake, inSteer.
 */
export function field(track, n, { rules = RULE_PRESETS.arcade } = {}) {
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }];
  for (let i = 1; i < n; i++) entries.push({ driver: DRIVERS[(i - 1) % DRIVERS.length] });
  const race = new Race({ track, laps: 3, entries, rules, difficulty: 'amateur', seed: 5 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const cars = race.cars, s0 = straightStretch(track, 600) + 30;
  const i0 = Math.round(s0 / track.ds), fx = Math.cos(track.heading[i0]), fz = Math.sin(track.heading[i0]);
  cars.forEach((car, i) => {
    car.params = cars[0].params; car.isHuman = true; car.drive = null;                    // the same car for all, and no computer driver
    placeCar(car, track, s0 + track.length / 2 + i * 30, 0); car.state = CAR_STATE.RACING; car.ghostTimer = 0;   // far away until it is given a place
  });
  const self = {
    race, cars, track, s0, step: 0, events: [],
    put(car, along, d, kmh, drive = null) {
      placeCar(car, track, s0 + along, d);
      car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = kmh / KMH; car.gear = gearFor(car, car.speed); car.drive = drive;
      return car;
    },
    /** metres along the straight, and to the right of its centre line (world coordinates: also right for a car in flight) */
    along: (car) => (car.x - cars.ref.x0) * fx + (car.z - cars.ref.z0) * fz,
    across: (car) => -(car.x - cars.ref.x0) * fz + (car.z - cars.ref.z0) * fx,
    /** speed of a car along the straight, whatever its state */
    alongSpeed(car) {
      if (car.state === CAR_STATE.AIRBORNE || car.state === CAR_STATE.SPIN || car.state === CAR_STATE.WRECKED) return car.velX * fx + car.velZ * fz;
      const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
      return (ch * car.speed - sh * car.vLat) * fx + (sh * car.speed + ch * car.vLat) * fz;
    },
    tick(each) {
      for (const car of cars) { if (car.drive && (car.state === CAR_STATE.RACING)) car.drive(car, self); else if (car.drive) { car.inThrottle = 0; car.inBrake = 0; car.inSteer = 0; } }
      race.step(SIM_DT);
      for (let e = 0; e < race.eventCount; e++) { const ev = race.events[e]; self.events.push({ type: ev.type, car: ev.car, other: ev.other, value: ev.value, step: self.step }); }
      race.eventCount = 0;
      if (each) each(self.step);
      self.step++;
    },
  };
  // origin of `along` / `across`: the centre line at the start of the scenario
  cars.ref = { x0: track.x[i0], z0: track.z[i0] };
  return self;
}

// ---- drivers

/** Holds `kmh`, straight ahead (keeps its line with a touch of steering). */
export function hold(kmh, d = null) {
  return (car) => {
    car.inThrottle = Math.max(0, Math.min(1, 0.35 + (kmh / KMH - car.speed) * 0.4)); car.inBrake = 0;
    car.inSteer = d === null ? 0 : Math.max(-0.2, Math.min(0.2, (d - car.d) * 0.08 - car.headingError * 1.5));
  };
}

/** Parked: brakes on. */
export const parked = () => (car) => { car.inThrottle = 0; car.inBrake = Math.abs(car.speed) > 0.5 ? 1 : 0; car.inSteer = 0; };   // (holding the brake at a standstill engages reverse)

/**
 * Stays under a car in flight: from the take-off of `target` it does whatever keeps it `offset` metres ahead of
 * it along the road, and under it sideways when `sideways` (throttle, brake, steering: a driver trying to be
 * there). It closes the distance as fast as it can still cancel the difference of speed on arrival, then keeps
 * pace: it slows down as the car in flight does. Before the take-off it drives as `before`; once the car in flight
 * is down it brakes to a standstill and stays where it is.
 */
export function shadow(target, before, { offset = 0, sideways = true, reach = 9 } = {}) {
  let seen = false;
  return (car, f) => {
    if (target.state !== CAR_STATE.AIRBORNE) {
      if (seen) { car.inThrottle = 0; car.inBrake = car.speed > 0.5 ? 1 : 0; car.inSteer = -car.headingError * 1.5; } else before(car, f);
      return;
    }
    seen = true;
    const vt = f.alongSpeed(target), v = f.alongSpeed(car);
    const gap = f.along(target) + offset - f.along(car);                  // > 0: the place to be is ahead of this car
    const rate = vt - v;                                                  // > 0: that place is pulling away
    const wanted = -Math.sign(gap) * Math.sqrt(2 * reach * Math.abs(gap)); // rate at which the gap should be closing
    const want = (vt > 0.5 ? -T_AIR_DECEL : 0) + (rate - wanted) * 8;      // m/s^2: what the car in flight does, plus the correction
    if (want >= 0) { car.inThrottle = Math.min(1, want / 6); car.inBrake = 0; } else { car.inThrottle = 0; car.inBrake = car.speed > 0.3 ? Math.min(1, -want / 17) : 0; }   // (never into reverse)
    car.inSteer = sideways ? Math.max(-0.3, Math.min(0.3, (f.across(target) - f.across(car)) * 0.12 - car.headingError * 1.5)) : -car.headingError * 1.5;
  };
}
const T_AIR_DECEL = 13.9;

/** Drives as `first` until `when(field)` is true, then as `then` for good. */
export function switching(first, when, then) {
  let switched = false;
  return (car, f) => { if (!switched && when(f)) switched = true; (switched ? then : first)(car, f); };
}

/**
 * Follow the flights of a scenario for `seconds`. For every car that takes off, records the step of the take-off
 * and of the landing, the time in the air, the largest overlap between its body and any other car at the step
 * where it came down and during `after` seconds afterwards, the largest distance by which a step in the air
 * differed from its velocity times the step, the largest gain of speed in one step in the air, the largest rise
 * of its height in one step once it has started coming down, and whether it was put back on the track.
 * Also: the largest loss and the largest gain of speed in one step in the air, the most speed taken back after having
 * lost it, the distance flown backwards, and how many times its landing began to wait.
 * A car in the air above another is not counted as being in it: the overlaps are those of cars on the ground.
 */
export function watchFlights(f, seconds, { after = 1.5, each = null } = {}) {
  const flights = new Map(), state = new Map();
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    for (const car of f.cars) state.set(car, { x: car.x, z: car.z, st: car.state, v: Math.hypot(car.velX, car.velZ), h: car.airHeight, resets: car.resets, waiting: car.airWaiting });
    f.tick();
    for (const car of f.cars) {
      const b = state.get(car), flying = car.state === CAR_STATE.AIRBORNE;
      let fl = flights.get(car);
      if (flying && (b.st !== CAR_STATE.AIRBORNE || !fl)) { fl = { car, up: f.step - 1, down: -1, takeOffSpeed: Math.max(b.v, Math.hypot(car.velX, car.velZ)), planned: car.airPlanned, seconds: 0, overlapAtLanding: 0, overlapAfter: 0, wreckDrivenThrough: 0, offVelocity: 0, speedGain: 0, speedDrop: 0, regained: 0, lowestSoFar: Infinity, backwards: 0, waitStarts: 0, fastest: 0, rise: 0, top: 0, putBack: false, waited: 0, lowest: Infinity, landedSpeed: 0, comingDown: false }; flights.set(car, fl); }
      if (!fl) continue;
      if (flying && b.st === CAR_STATE.AIRBORNE) {
        fl.offVelocity = Math.max(fl.offVelocity, Math.hypot(car.x - b.x - car.velX * SIM_DT, car.z - b.z - car.velZ * SIM_DT));
        const v = Math.hypot(car.velX, car.velZ);
        fl.speedGain = Math.max(fl.speedGain, v - b.v); fl.speedDrop = Math.max(fl.speedDrop, b.v - v);
        // (how much speed it took back in the air after having lost it, and how far it moved backwards)
        fl.lowestSoFar = Math.min(fl.lowestSoFar, v); fl.regained = Math.max(fl.regained, v - fl.lowestSoFar);
        if (car.airBack) fl.backwards += v * SIM_DT;
        fl.fastest = Math.max(fl.fastest, Math.hypot(car.velX, car.velZ));
        if (car.airHeight < b.h - 1e-9) fl.comingDown = true;
        if (fl.comingDown) fl.rise = Math.max(fl.rise, car.airHeight - b.h);
        fl.top = Math.max(fl.top, car.airHeight);
        if (car.airWaiting) { fl.waited += SIM_DT; fl.lowest = Math.min(fl.lowest, car.airHeight); if (!b.waiting) fl.waitStarts++; }
      }
      if (fl.down < 0 && !flying && b.st === CAR_STATE.AIRBORNE) {
        fl.down = f.step - 1; fl.seconds = (fl.down - fl.up) * SIM_DT; fl.putBack = car.resets > b.resets || car.state === CAR_STATE.RESET;
        fl.landedSpeed = Math.hypot(car.velX, car.velZ);
        // (is it behind the car that threw it up, at the step it comes down? centre to centre along the straight)
        const thrower = car.launchOther >= 0 ? f.cars[car.launchOther] : null;
        fl.behindLauncher = !!thrower && f.along(car) < f.along(thrower);
        // (a car still in the air above it is not a car it was set down in: that one will have to find its own place)
        for (const o of f.cars) if (o !== car && !o.removed && o.state !== CAR_STATE.AIRBORNE) fl.overlapAtLanding = Math.max(fl.overlapAtLanding, bodyOverlap(car, o));
      } else if (fl.down >= 0 && f.step - 1 - fl.down <= after / SIM_DT && car.state !== CAR_STATE.RESET && car.state !== CAR_STATE.AIRBORNE && car.ghostTimer <= 0) {
        // afterwards: bodies of cars on the ground. A wreck (the car after a hard landing, until it restarts) is a case
        // apart: it cannot be hit, the other cars drive through it. That was so before this work and is counted separately.
        for (const o of f.cars) {
          if (o === car || o.removed || o.state === CAR_STATE.RESET || o.state === CAR_STATE.AIRBORNE || o.ghostTimer > 0) continue;
          const overlap = bodyOverlap(car, o);
          if (car.state === CAR_STATE.WRECKED || o.state === CAR_STATE.WRECKED) fl.wreckDrivenThrough = Math.max(fl.wreckDrivenThrough, overlap); else fl.overlapAfter = Math.max(fl.overlapAfter, overlap);
        }
      }
    }
    if (each) each(i, flights);
  }
  return [...flights.values()];
}
