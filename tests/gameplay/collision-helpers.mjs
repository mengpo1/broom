// Shared set-up for the collision scenarios: two cars placed on a straight at chosen speeds, and a
// runner that records the events and the state of both cars at every step.
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';

export const KMH = 3.6;

/** Distance s at which a straight of at least `length` metres begins (curvature near zero), or -1. */
export function straightStretch(track, length) {
  const need = Math.ceil(length / track.ds);
  let run = 0;
  for (let i = 0; i < track.n * 2; i++) {
    const k = i % track.n;
    const rel = k * track.ds > track.length / 2 ? k * track.ds - track.length : k * track.ds;
    const inPits = rel > track.pit.entryS - 40 && rel < track.pit.exitS + 40;
    if (Math.abs(track.kappa[k]) < 1 / 2500 && !inPits) { run++; if (run >= need) return ((i - need + 1) % track.n) * track.ds; } else run = 0;
  }
  return -1;
}

function gearFor(car, speed) {
  const tops = car.params.spec.gearTopSpeeds;
  for (let g = 0; g < tops.length; g++) if (speed < tops[g] * 0.93) return g + 1;
  return tops.length;
}

/**
 * Two human cars alone on a straight. Car A is behind car B by `gap` metres (between bodies, bumper to
 * bumper when lateral is 0) and offset sideways by `lateral` metres (A to the left of B when positive).
 * Speeds in m/s. Options: headingA (rad, turned toward B), rules.
 */
export function twoCars(track, { gap, lateral = 0, speedA, speedB, headingA = 0, rules = RULE_PRESETS.arcade, straight = 320 }) {
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: PLAYER_DRIVERS[1], human: true, playerIndex: 1 }, { driver: DRIVERS[0] }];
  const race = new Race({ track, laps: 3, entries, rules, difficulty: 'amateur', seed: 5 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const a = race.playerCars[0], b = race.playerCars[1], third = race.cars.find((c) => !c.isHuman);
  const s0 = straightStretch(track, straight) + 30;
  const length = a.params.halfLength + b.params.halfLength;
  placeCar(third, track, s0 + track.length / 2, 0); third.state = CAR_STATE.RACING;      // far away, out of the scenario
  placeCar(a, track, s0, -lateral / 2); placeCar(b, track, s0 + length + gap, lateral / 2);
  for (const [car, speed] of [[a, speedA], [b, speedB]]) {
    car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = speed; car.gear = gearFor(car, speed);
  }
  a.heading += headingA;
  return { race, a, b, s0 };
}

/**
 * Run the race for `seconds`. Inputs: throttleA/B, brakeA/B, steerA/B (numbers or functions of time).
 * Returns { events: [{type, car, other, value, time}], frames: [{time, a, b}], start, afterFirst(type, car), atEvent(e) }.
 */
export function run(race, seconds, inputs = {}) {
  const a = race.playerCars[0], b = race.playerCars[1];
  const snap = (c) => ({ speed: c.speed, s: c.s, d: c.d, state: c.state, heading: c.headingError, clock: c.clock, airHeight: c.airHeight || 0, progress: c.progress });
  const val = (v, t) => (typeof v === 'function' ? v(t) : v ?? 0);
  const log = { events: [], frames: [], start: { a: snap(a), b: snap(b) } };
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * SIM_DT;
    race.setPlayerInput(0, val(inputs.steerA, t), val(inputs.throttleA, t), val(inputs.brakeA, t), 0, false, false);
    race.setPlayerInput(1, val(inputs.steerB, t), val(inputs.throttleB, t), val(inputs.brakeB, t), 0, false, false);
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) { const ev = race.events[e]; log.events.push({ type: ev.type, car: ev.car, other: ev.other, value: ev.value, time: t, frame: log.frames.length }); }
    race.eventCount = 0;
    log.frames.push({ time: t + SIM_DT, a: snap(a), b: snap(b) });
  }
  log.afterFirst = (type, car) => { const e = log.events.find((x) => x.type === type); return e ? log.frames[e.frame][car === a ? 'a' : 'b'] : null; };
  log.atEvent = (e) => log.frames[Math.max(0, e.frame - 1)];
  return log;
}

// ---- geometry seen from above, written independently of the game (corners and separating axes),
// so that the tests do not check the collision code with itself

/** Corners of a rectangle centred on (cx, cz), `halfLength` along `heading`, `halfWidth` across. */
export function corners(cx, cz, heading, halfLength, halfWidth) {
  const f = [Math.cos(heading), Math.sin(heading)], r = [-Math.sin(heading), Math.cos(heading)];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [cx + f[0] * halfLength * i + r[0] * halfWidth * j, cz + f[1] * halfLength * i + r[1] * halfWidth * j]);
}

/** Depth (m) by which two convex polygons overlap, 0 when they are apart. */
export function polygonOverlap(p, q) {
  let min = Infinity;
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], nx = -(b[1] - a[1]), nz = b[0] - a[0], l = Math.hypot(nx, nz);
      const span = (pts) => { let lo = Infinity, hi = -Infinity; for (const c of pts) { const v = (c[0] * nx + c[1] * nz) / l; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
      const [a0, a1] = span(p), [b0, b1] = span(q);
      const overlap = Math.min(a1, b1) - Math.max(a0, b0);
      if (overlap <= 0) return 0;
      min = Math.min(min, overlap);
    }
  }
  return min;
}

/** Body of a car in the collision model: its box. */
export const bodyOf = (car) => corners(car.x, car.z, car.heading, car.params.halfLength, car.params.halfWidth);
/** Overlap (m) of the bodies of two cars, 0 when they are apart. */
export const bodyOverlap = (a, b) => polygonOverlap(bodyOf(a), bodyOf(b));

/** A tyre of a car seen from above. `axle`: 'front' or 'rear'; `side`: +1 right, -1 left. Dimensions from `layout` (WHEEL_LAYOUT). */
export function tyreOf(car, layout, axle, side) {
  const x = axle === 'front' ? layout.frontAxleX : layout.rearAxleX, track = axle === 'front' ? layout.frontTrack : layout.rearTrack, tyre = axle === 'front' ? layout.frontTyre : layout.rearTyre;
  const f = [Math.cos(car.heading), Math.sin(car.heading)], r = [-Math.sin(car.heading), Math.cos(car.heading)];
  return corners(car.x + f[0] * x + r[0] * side * track, car.z + f[1] * x + r[1] * side * track, car.heading, tyre.radius, tyre.width / 2);
}

/** Largest overlap (m) between a front tyre of `a` and a rear tyre of `b`. */
export function frontOnRearTyres(a, b, layout) {
  let best = 0;
  for (const sa of [1, -1]) for (const sb of [1, -1]) best = Math.max(best, polygonOverlap(tyreOf(a, layout, 'front', sa), tyreOf(b, layout, 'rear', sb)));
  return best;
}

/** How far the centre of `a` is ahead of the centre of `b`, along `b` (m), and to its right. */
export function relativeTo(a, b) {
  const f = [Math.cos(b.heading), Math.sin(b.heading)];
  return { ahead: (a.x - b.x) * f[0] + (a.z - b.z) * f[1], right: -(a.x - b.x) * f[1] + (a.z - b.z) * f[0] };
}

/** Throttle that holds a car at `kmh` (a function of time, for `run`). */
export const holdSpeed = (car, kmh) => () => Math.max(0, Math.min(1, 0.35 + (kmh / KMH - car.speed) * 0.4));
