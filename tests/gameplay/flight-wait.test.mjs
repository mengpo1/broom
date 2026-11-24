// A car in flight that cannot come down where it planned to. Its landing place is chosen free of every car at the
// take-off (flightPlan), but the other cars go on driving while it is in the air: one can come to be under it, and
// stay there. The flight must then still END, within a stated time, WITHOUT the car being set down in another one,
// without anything being moved by hand, and with a flight that stays a flight: the car moved by its own velocity.
//
// Each scenario is played by real cars driven through their controls. The driver that makes the defect appear is
// `shadow`: from the take-off it does what it can to be under the car in flight (it brakes at the rate the car in
// flight slows down, or speeds up to it, and steers under it). Before the correction (PR #8, commit dc8b823) the
// landing waited for as long as a car was below, then, once the car in flight had nearly lost all its speed, came
// down whatever was under it: the scenarios below lasted 4 to 5 s in the air, and in those with the hard accident
// the car was then set down inside another one (in those with the hop the car below had moved away by then).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { startHop, requestReset, placeCar } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { field, hold, parked, shadow, switching, watchFlights, SIM_DT, CAR_STATE, KMH, bodyOverlap } from './flight-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));
const LENGTH = 4.2;                                                    // of a car (m)
const WAIT_MAX = T.flightWaitMax ?? 3.5;                               // s: the longest a flight can go on beyond its planned time
const YIELD = T.flightYieldSpeed ?? 8;                                 // m/s kept between the car in flight and a car below it
/** Longest time a flight can last: its plan, the longest wait, and the descent. */
const longest = (fl) => fl.car.airPlanned + WAIT_MAX + T.flightHoldTime + 2 * SIM_DT;

/**
 * The reference hop: A at 215 km/h, a front wheel on a rear wheel of B doing 150 km/h. `side`: +1, A is to the left
 * of B (its right front wheel on the left rear wheel of B); -1, to its right. `d`: where the two are across the road.
 */
function hop(f, { kmhA = 215, kmhB = 150, d = 0, side = 1, driveB = null } = {}) {
  const [a, b] = f.cars;
  f.put(b, 60, d + side * 0.975, kmhB, driveB || hold(kmhB, d + side * 0.975));
  f.put(a, 60 - LENGTH - 4, d - side * 0.975, kmhA, hold(kmhA, d - side * 0.975));
  return { a, b, kmhA, kmhB, behind: LENGTH + 4, free: -side };
}
/** The reference accident (E3): A at 262 km/h rides over a rear wheel of B doing 188 km/h, half a width to its side. */
function accident(f, { kmhA = 262, kmhB = 188, d = 0, side = 1, driveB = null } = {}) {
  const [a, b] = f.cars;
  f.put(b, 60, d + side * 0.465, kmhB, driveB || hold(kmhB, d + side * 0.465));
  f.put(a, 60 - LENGTH - 2.5, d - side * 0.465, kmhA, hold(kmhA, d - side * 0.465));
  return { a, b, kmhA, kmhB, behind: LENGTH + 2.5, free: -side };
}
const KINDS = { hop, accident };

/** What every scenario must show for the flight of `car`. Returns the flight. */
function checkFlight(flights, car, label, { noPutBack = true, waitAtMost = WAIT_MAX + T.flightHoldTime, offVelocity = 1e-6, touching = 0 } = {}) {   // (a wait begins flightHoldTime before the planned landing)
  const fl = flights.find((x) => x.car === car);
  assert.ok(fl, `${label}: the car took off`);
  // it ends
  assert.ok(fl.down >= 0, `${label}: the flight ends (still in the air ${((flights.steps - fl.up) * SIM_DT).toFixed(1)} s after the take-off)`);
  assert.ok(fl.seconds <= longest(fl), `${label}: ${fl.seconds.toFixed(2)} s in the air, at most ${longest(fl).toFixed(2)} s allowed`);
  assert.ok(fl.waited <= waitAtMost + 2 * SIM_DT, `${label}: the landing waited ${fl.waited.toFixed(2)} s, at most ${waitAtMost} s`);
  // it is not set down in another car, and no car is driven through afterwards
  assert.equal(fl.overlapAtLanding, 0, `${label}: set down ${fl.overlapAtLanding.toFixed(2)} m inside another car`);
  assert.ok(fl.overlapAfter <= touching, `${label}: bodies overlapping after the landing (${fl.overlapAfter.toFixed(2)} m)`);
  // it stays a flight: moved by its own velocity, never faster than it took off, no jump of height
  assert.ok(fl.offVelocity < offVelocity, `${label}: moved otherwise than by its velocity (${fl.offVelocity.toExponential(2)} m in a step)`);
  assert.ok(fl.fastest <= Math.max(fl.takeOffSpeed, YIELD) + 1e-6, `${label}: faster in the air (${(fl.fastest * KMH).toFixed(0)} km/h) than at the take-off (${(fl.takeOffSpeed * KMH).toFixed(0)} km/h)`);
  assert.ok(fl.rise < 0.02, `${label}: its height jumps up by ${(fl.rise * 100).toFixed(1)} cm in a step on the way down`);
  if (noPutBack) assert.equal(fl.putBack, false, `${label}: the flight ends by a landing, not by the car being put back on the track`);
  return fl;
}
function fly(f, seconds, options) {
  const flights = watchFlights(f, seconds, options);
  flights.steps = f.step;
  return flights;
}
const told = (fl) => `${fl.seconds.toFixed(2)} s in the air (plan ${fl.car.airPlanned.toFixed(2)} s), the landing waited ${fl.waited.toFixed(2)} s, down at ${(fl.landedSpeed * KMH).toFixed(0)} km/h${fl.wreckDrivenThrough > 0 ? ' [its wreck was then driven through by another car: known, older than this work]' : ''}`;

test('a third car puts itself under the car in flight and slows down with it until it has stopped there: the flight ends, on free ground', (t) => {
  // the third car is beside the car that will fly, on the side away from the car it hits, at its speed. From the take-off it
  // steers under it and brakes as it slows down, to stay under it: it ends up stopped on the place where the car should land,
  // and stays there. (Before the correction the landing waited for as long as it was there: until both had stopped, 4 to 5 s
  // later; then the car was set down, inside it in the case of the accident.)
  for (const kind of ['hop', 'accident']) {
    for (const back of [0, 2, -2]) {
      const f = field(track, 3);
      const { a, b, kmhA, behind, free } = KINDS[kind](f);
      const c = f.put(f.cars[2], 60 - behind - back, a.d + free * 2.2, kmhA, shadow(a, hold(kmhA, a.d + free * 2.2)));
      const flights = fly(f, 9);
      const fl = checkFlight(flights, a, `${kind}, third car beside it, ${back} m back`, { waitAtMost: 1.3 });
      assert.equal(b.state, CAR_STATE.RACING);
      t.diagnostic(`${kind}, third car beside it ${back} m back: ${told(fl)}`);
    }
  }
});

test('a third car arrives under the car in flight during the flight, from behind, and keeps pace with it: the flight ends, on free ground', (t) => {
  // faster than the car that will fly, behind it in the next lane: it reaches it while it is in the air, moves under it
  // and from then on does what it can to stay there
  for (const kind of ['hop', 'accident']) {
    for (const [back, more] of [[4, 15], [7, 25], [11, 40]]) {
      const f = field(track, 3);
      const { a, kmhA, behind, free } = KINDS[kind](f);
      f.put(f.cars[2], 60 - behind - back, a.d + free * 2.2, kmhA + more, shadow(a, hold(kmhA + more, a.d + free * 2.2)));
      const flights = fly(f, 9);
      const fl = checkFlight(flights, a, `${kind}, a car arriving from ${back} m behind at +${more} km/h`, { waitAtMost: 1.3 });
      t.diagnostic(`${kind}, a car arriving from ${back} m behind at +${more} km/h: ${told(fl)}`);
    }
  }
});

test('a pack travels with the car that flies and fills every place where it could come down: the flight ends, on free ground', (t) => {
  // the car that will fly is passing the car it hits in the middle of a pack at its own speed: cars beside it, level with
  // it, half a length ahead and a length behind, and more in the next lane. From the take-off three of them move onto its
  // line (where it should land, the place before and the place after) and every one keeps pace with it as it slows down:
  // wherever it could come down along its path, there is a car.
  // (the accident throws its car towards the pack: the cars are placed so that, going on as they are, they leave its landing
  // place free, or the plan of the flight would refuse the take-off)
  const PACKS = {
    hop: [[[5, 1], [0, 1], [-5, 1]], [[6, 1], [1, 1], [-4, 1], [3.5, 2], [-1.5, 2]], [[2.5, 1], [-2.5, 1], [-7.5, 1], [0, 2], [-5, 2]]],
    accident: [[[5.5, 1], [0.5, 1], [-10.5, 1]], [[6, 1], [1, 1], [-11, 1], [3.5, 2], [-7, 2]], [[0.5, 1], [-10, 1], [-15, 1], [5, 2], [-5, 2]]],
  };
  for (const kind of ['hop', 'accident']) {
    for (const places of PACKS[kind]) {
      const f = field(track, 2 + places.length);
      const { a, kmhA, behind, free } = KINDS[kind](f);
      const pack = places.map(([offset, lane], i) => f.put(f.cars[2 + i], 60 - behind + offset, a.d + free * 2.2 * lane, kmhA,
        shadow(a, hold(kmhA, a.d + free * 2.2 * lane), { offset, sideways: lane === 1 })));
      const flights = fly(f, 9);
      const fl = checkFlight(flights, a, `${kind} in a pack of ${places.length}`);
      assert.ok(fl.waited > 0.3, `${kind} in a pack of ${places.length}: the pack did get under it (the landing waited ${fl.waited.toFixed(2)} s)`);
      const last = Math.min(...pack.map((c) => f.along(c))), first = Math.max(...pack.map((c) => f.along(c)));
      t.diagnostic(`${kind} in a pack of ${places.length}: ${told(fl)}; it comes down ${f.along(a) < last ? `${(last - f.along(a)).toFixed(1)} m behind the last car of the pack` : f.along(a) > first ? 'ahead of the pack' : 'in a gap of the pack'}`);
    }
  }
});

test('the car that was flown over speeds up and keeps itself under the car in flight: the flight ends, on free ground', (t) => {
  for (const kind of ['hop', 'accident']) {
    for (const offset of [0, 2.5, -2]) {
      const f = field(track, 2);
      // from the take-off the car ahead does what it can to be under the car that flies over it: full throttle to stay
      // level, the steering to be on its line, then the brakes to slow down with it
      const [a, b] = f.cars, kmhB = kind === 'hop' ? 150 : 188;
      KINDS[kind](f, { driveB: shadow(a, hold(kmhB, kind === 'hop' ? 0.975 : 0.465), { offset }) });
      const flights = fly(f, 9);
      const fl = checkFlight(flights, a, `${kind}, the car flown over keeping ${offset} m ahead`, { waitAtMost: 1.8 });
      // (whether it ends up ahead of that car is another matter: a car that speeds up under it is not passed. Told, not asserted.)
      t.diagnostic(`${kind}, the car flown over keeping itself ${offset} m ahead: ${told(fl)}; it comes down ${f.along(a) > f.along(b) ? 'AHEAD OF' : 'BEHIND'} that car`);
    }
  }
});

test('against a barrier, a car under the car in flight: the flight ends, on free ground, inside the barriers', (t) => {
  const limit = (car) => track.barrierR[Math.floor(car.s / track.ds) % track.n] - car.params.halfWidth;
  for (const kind of ['hop', 'accident']) {
    for (const who of ['the car flown over', 'a third car']) {
      const f = field(track, 3);
      // the car that flies is the one next to the right-hand barrier, 30 cm from it; the accident throws it further that way
      const edge = track.barrierR[Math.round(f.s0 / track.ds)] - 0.93 - 0.3, kmhB = kind === 'hop' ? 150 : 188;
      const [a, b, c] = f.cars, dA = edge, dB = edge - (kind === 'hop' ? 1.95 : 0.93);
      const { kmhA, behind } = KINDS[kind](f, { d: (dA + dB) / 2, side: -1, driveB: who === 'a third car' ? null : shadow(a, hold(kmhB, dB)) });
      assert.ok(Math.abs(a.d - edge) < 1e-6 && b.d < a.d);
      // (the third car comes from behind on the side away from the barrier, beyond the car that is hit)
      if (who === 'a third car') f.put(c, 60 - behind - 5, dB - 2.2, kmhA + 20, shadow(a, hold(kmhA + 20, dB - 2.2)));
      let outside = -Infinity;
      const flights = fly(f, 9, { each: () => { if (a.state === CAR_STATE.AIRBORNE) outside = Math.max(outside, a.d - limit(a)); } });
      // (a car in flight that reaches the barrier is held inside it: by the few centimetres it would have gone through, as before)
      const fl = checkFlight(flights, a, `${kind} against the barrier, ${who} under it`, { waitAtMost: 1.8, offVelocity: 0.05 });
      assert.ok(outside < 0.05, `${kind}, ${who}: ${outside.toFixed(2)} m beyond the barrier during the flight`);
      t.diagnostic(`${kind} against the barrier, ${who} under it: ${told(fl)}; nearest to the barrier: ${(-outside).toFixed(2)} m inside`);
    }
  }
});

test('two cars take off almost together towards the same place: neither comes down in the other, nor flies through it', (t) => {
  const twoInTheAir = (cars) => { let worst = 0; for (const p of cars) for (const q of cars) if (p.index < q.index && p.state === CAR_STATE.AIRBORNE && q.state === CAR_STATE.AIRBORNE) worst = Math.max(worst, bodyOverlap(p, q)); return worst; };
  // two cars side by side, each riding over the inner rear wheel of a car ahead: both accidents throw their car towards
  // the middle of the road, where there is room for one
  for (const lag of [0, 0.4, 1.2, 2.5, 5]) {
    const f = field(track, 4);
    const [a1, a2, b1, b2] = f.cars;
    f.put(b1, 60, -2, 188, hold(188, -2)); f.put(b2, 60, 2, 188, hold(188, 2));
    f.put(a1, 60 - LENGTH - 2.5, -1.07, 262, hold(262, -1.07)); f.put(a2, 60 - LENGTH - 2.5 - lag, 1.07, 262, hold(262, 1.07));
    let both = 0, inTheAir = 0;
    const flights = fly(f, 7, { each: () => { if (a1.state === CAR_STATE.AIRBORNE && a2.state === CAR_STATE.AIRBORNE) both++; inTheAir = Math.max(inTheAir, twoInTheAir(f.cars)); } });
    const flew = flights.filter((x) => x.car === a1 || x.car === a2);
    assert.ok(flew.length >= 1, `second car ${lag} m behind: at least one of the two takes off`);
    for (const fl of flew) checkFlight(flights, fl.car, `second car ${lag} m behind, car ${fl.car === a1 ? 1 : 2}`);
    assert.equal(inTheAir, 0, `second car ${lag} m behind: the two overlap in the air (${inTheAir.toFixed(2)} m)`);
    t.diagnostic(`side by side, second car ${lag} m behind: ${flew.length} flight(s), ${both} steps with both in the air; ${flew.map((x) => `car ${x.car === a1 ? 1 : 2}: ${told(x)}`).join('; ')}`);
  }
  // the same two further apart (the cars ahead 8 m from each other): there is room for both, and both fly
  {
    const f = field(track, 4);
    const [a1, a2, b1, b2] = f.cars;
    f.put(b1, 60, -4, 188, hold(188, -4)); f.put(b2, 60, 4, 188, hold(188, 4));
    f.put(a1, 60 - LENGTH - 2.5, -3.07, 262, hold(262, -3.07)); f.put(a2, 60 - LENGTH - 2.5, 3.07, 262, hold(262, 3.07));
    let both = 0, inTheAir = 0;
    const flights = fly(f, 7, { each: () => { if (a1.state === CAR_STATE.AIRBORNE && a2.state === CAR_STATE.AIRBORNE) both++; inTheAir = Math.max(inTheAir, twoInTheAir(f.cars)); } });
    for (const car of [a1, a2]) checkFlight(flights, car, `with room for both, car ${car === a1 ? 1 : 2}`);
    assert.ok(both > 60, `both in the air together (${both} steps)`);
    assert.equal(inTheAir, 0);
    t.diagnostic(`side by side with room for both: 2 flights, ${both} steps with both in the air, ${Math.abs(f.across(a1) - f.across(a2)).toFixed(2)} m between their centres on the ground`);
  }
  // one behind the other on the same car: the second rides over the same wheel a moment after the first
  for (const kind of ['hop', 'accident']) {
    for (const [gap, more] of [[2, 5], [5, 15], [9, 25], [14, 40]]) {
      const f = field(track, 3);
      const { a, kmhA, behind } = KINDS[kind](f);
      const second = f.put(f.cars[2], 60 - behind - LENGTH - gap, a.d, kmhA + more, hold(kmhA + more, a.d));
      let inTheAir = 0;
      const flights = fly(f, 7, { each: () => { inTheAir = Math.max(inTheAir, twoInTheAir(f.cars)); } });
      for (const fl of flights) checkFlight(flights, fl.car, `${kind}, a second car ${gap} m behind at +${more} km/h, car ${fl.car === a ? 1 : fl.car === second ? 2 : 'ahead'}`);
      assert.equal(inTheAir, 0, `${kind}, second car ${gap} m behind: the two overlap in the air (${inTheAir.toFixed(2)} m)`);
      t.diagnostic(`${kind}, a second car ${gap} m behind the first at +${more} km/h: ${flights.length} flight(s)${flights.map((x) => `; car ${x.car.index}: ${told(x)}`).join('')}`);
    }
  }
});

test('one car alone cannot keep a car in the air: whatever it does to stay under it, the landing waits a second or two at most', (t) => {
  let worst = 0, flightsSeen = 0, waits = 0, worstCase = '';
  for (const kind of ['hop', 'accident']) {
    for (const back of [-3, 0, 3, 7]) for (const more of [0, 20]) for (const offset of [-3, -1, 0, 1.5, 3.5]) for (const reach of [5, 9, 16]) {
      const f = field(track, 3);
      const { a, kmhA, behind, free } = KINDS[kind](f);
      f.put(f.cars[2], 60 - behind - back, a.d + free * 2.2, kmhA + more, shadow(a, hold(kmhA + more, a.d + free * 2.2), { offset, reach }));
      const flights = fly(f, 8);
      const fl = flights.find((x) => x.car === a);
      if (!fl) continue;
      flightsSeen++;
      checkFlight(flights, a, `${kind}, a car from ${back} m back at +${more} km/h aiming ${offset} m ahead of it (reach ${reach})`, { waitAtMost: 2.5 });
      if (fl.waited > 0) waits++;
      if (fl.waited > worst) { worst = fl.waited; worstCase = `${kind}, from ${back} m back at +${more} km/h, aiming ${offset} m ahead, reach ${reach}`; }
    }
  }
  t.diagnostic(`${flightsSeen} flights with a car doing what it can to stay under: ${waits} landings waited, the longest ${worst.toFixed(2)} s (${worstCase})`);
  assert.ok(flightsSeen >= 200 && waits >= 150, `${flightsSeen} flights, ${waits} waits`);
});

test('last resort: when cars stay under it for the whole of the longest wait, the car is put back on a free place, never set down in one', (t) => {
  // a line of stopped cars, nose to tail, longer than the car can glide over in the longest wait: the hop is started by
  // hand at the tail of the line (in a race the plan of the flight refuses such a take-off)
  const f = field(track, 26);
  const a = f.cars[0];
  for (let i = 1; i < 26; i++) f.put(f.cars[i], 60 + 4 + i * (LENGTH + 0.15), 0, 0, parked());
  f.put(a, 60, 0, 150, hold(150, 0));
  startHop(a, null, -1, 1, 0.45);
  let before = null, after = null;
  const nearest = () => Math.min(...f.cars.filter((o) => o !== a).map((o) => Math.hypot(o.x - a.x, o.z - a.z)));
  const flights = fly(f, 8, { each: () => {
    if (a.state === CAR_STATE.AIRBORNE) before = { progress: a.progress, along: f.along(a), d: a.d };
    else if (before && !after) after = { progress: a.progress, along: f.along(a), d: a.d, speed: a.speed, clear: nearest(), free: Math.max(...f.cars.filter((o) => o !== a).map((o) => bodyOverlap(a, o))) };
  } });
  const fl = checkFlight(flights, a, 'over a line of 25 stopped cars', { noPutBack: false });
  // its distance covered in the race follows it back: it has not gained the metres it flew over the line
  assert.ok(Math.abs((after.progress - before.progress) - (after.along - before.along)) < 0.5, `distance covered changed by ${(after.progress - before.progress).toFixed(1)} m for a move of ${(after.along - before.along).toFixed(1)} m`);
  assert.equal(fl.putBack, true, 'the flight ended by the car being put back on the track');
  assert.ok(fl.seconds > fl.planned + WAIT_MAX - 0.05 && fl.seconds <= fl.planned + WAIT_MAX + 2 * SIM_DT, `when the whole of the longest wait was spent: ${fl.seconds.toFixed(2)} s after a plan of ${fl.planned.toFixed(2)} s`);
  // where: the nearest free place, here beside the line; on the road, stationary, in no car
  assert.ok(Math.abs(after.d) <= track.halfWidth - 0.93, `on the road (${after.d.toFixed(2)} m from the centre line)`);
  assert.equal(after.free, 0, 'in no car'); assert.ok(Math.abs(after.speed) < 0.01, 'stationary');
  assert.ok(Math.abs(after.along - before.along) < 3 && Math.abs(after.d - before.d) > 1.86, `beside where it was (${(after.along - before.along).toFixed(1)} m along, ${(after.d - before.d).toFixed(2)} m across)`);
  assert.ok(f.events.some((e) => e.type === 'reset' && e.car === a.index), 'signalled as any car put back on the track');
  t.diagnostic(`over a line of 25 stopped cars: ${fl.seconds.toFixed(2)} s in the air (plan ${fl.planned.toFixed(2)} s), then put back on the track ${(after.d - before.d).toFixed(2)} m to the side of where it was, ${after.clear.toFixed(1)} m from the centre of the nearest car`);
});

test('letting a crawling car go: the car drifts back off it, comes down STATIONARY, and is an ordinary car on the ground', (t) => {
  // a hop started by hand at 32 km/h (no hop is that slow in a race: this is the far end of the rule) over a car crawling
  // at 18 km/h: too slow to pass it at the margin, the car in flight lets it go, which here means moving backwards.
  // It must not be handed to the ground moving backwards: out of reverse gear a car that brakes then goes backwards
  // faster and faster, and a car arriving behind it is no longer a bump (found by the independent review).
  const scene = (after) => {
    const f = field(track, 3);
    const [a, c, d] = f.cars;
    f.put(c, 60 + 3.5, 0, 18, hold(18, 0));
    f.put(a, 60, 0, 32, after);
    startHop(a, null, -1, 1, 0.45);
    return { f, a, c, d };
  };
  // the flight, then the driver accelerates
  {
    const { f, a, c } = scene(hold(60, 0)), heading = a.heading;
    let backwards = 0, slowestAlong = Infinity, landed = null;
    const flights = fly(f, 5, { each: () => {
      if (a.state === CAR_STATE.AIRBORNE) { const v = f.alongSpeed(a); if (v < 0) backwards++; slowestAlong = Math.min(slowestAlong, v); }
      else if (!landed) landed = { speed: a.speed, velocity: Math.hypot(a.velX, a.velZ), state: a.state, reverse: a.reverse };
    } });
    const fl = checkFlight(flights, a, 'over a crawling car', { waitAtMost: 1.6 });
    assert.ok(backwards > 10, `it moved backwards for a while (${backwards} steps, ${slowestAlong.toFixed(1)} m/s at most)`);
    assert.ok(slowestAlong >= 18 / KMH - YIELD - 0.2, `never further from the speed of the car below than the margin (${slowestAlong.toFixed(1)} m/s)`);
    assert.ok(f.along(a) < f.along(c) - LENGTH, 'it came down behind the car it let go');
    assert.ok(landed.speed === 0 && landed.velocity === 0 && landed.state === CAR_STATE.RACING && !landed.reverse, `set down stationary, in forward gear (${JSON.stringify(landed)})`);
    assert.ok(Math.abs(a.heading - heading) < 0.02 && a.state === CAR_STATE.RACING && !a.reverse, `heading ${a.heading.toFixed(3)} (was ${heading.toFixed(3)}), state ${a.state}`);
    assert.ok(a.speed > 3, `driving forward again, behind the crawling car (${(a.speed * KMH).toFixed(0)} km/h)`);
    t.diagnostic(`over a car crawling at 18 km/h: ${told(fl)}; ${backwards} steps moving backwards, at ${(-slowestAlong * KMH).toFixed(0)} km/h at most`);
  }
  // the driver holds the brake as it comes down, or touches nothing: the car stays where it is, or backs away as a car in
  // reverse does (the brake held at a standstill engages reverse), never faster than a car goes in reverse
  for (const [what, pedal] of [['brake held', 1], ['no pedal', 0]]) {
    const { f, a } = scene((car) => { car.inThrottle = 0; car.inBrake = pedal; car.inSteer = 0; });
    let lowest = Infinity;
    fly(f, 9, { each: () => { if (a.state !== CAR_STATE.AIRBORNE) lowest = Math.min(lowest, a.speed); } });
    assert.ok(lowest >= -a.params.spec.reverseSpeed - 0.5, `${what}: ${(lowest * KMH).toFixed(0)} km/h at the lowest`);
    if (!pedal) assert.ok(Math.abs(a.speed) < 0.5, `${what}: it stays where it came down (${(a.speed * KMH).toFixed(1)} km/h)`);
    t.diagnostic(`${what} after that landing: lowest speed ${(lowest * KMH).toFixed(0)} km/h (reverse gear tops at ${(a.params.spec.reverseSpeed * KMH).toFixed(0)} km/h)`);
  }
  // a car arrives behind it once it is down: what happens is what happens with any stopped car hit at that speed
  // (compared with a car simply parked at the same place), not something of its own
  {
    const idle = (car) => { car.inThrottle = 0; car.inBrake = 0; car.inSteer = 0; };
    const { f, a, d } = scene(idle);
    let sent = false, at = null;
    fly(f, 6, { each: () => { if (!sent && a.state !== CAR_STATE.AIRBORNE) { sent = true; at = { along: f.along(a), d: a.d }; f.put(d, at.along - 60 - 40, a.d, 100, hold(100, a.d)); } } });
    const told2 = (ff, x, y) => `${[...new Set(ff.events.filter((e) => (e.car === x.index || e.car === y.index) && ['contact', 'bump', 'crash', 'launch', 'hop', 'wheel'].includes(e.type)).map((e) => `${e.type}:${e.car === x.index ? 'stopped car' : 'arriving car'}`))].sort().join(' ')}`;
    const g = field(track, 2), [p, q] = g.cars;
    g.put(p, at.along - 60, at.d, 0, idle); g.put(q, at.along - 60 - 40, at.d, 100, hold(100, at.d));
    for (let i = 0; i < 6 / SIM_DT; i++) g.tick();
    assert.ok(told2(f, a, d).includes('contact'), `the arriving car reached it (${told2(f, a, d)})`);
    assert.equal(told2(f, a, d), told2(g, p, q), 'the same contact as with a car parked there');
    t.diagnostic(`a car arriving at 100 km/h behind it once it is down: ${told2(f, a, d)} — the same as on a car parked there`);
  }
});

test('two cars whose landings wait over each other: one gets clear of the other, their speeds stay those of cars', (t) => {
  // two hops started by hand, one car just behind the other on the same line, over a line of stopped cars that keeps
  // both in the air: each is "a car below" for the other. (If each let the other go, each slowing down below the speed
  // the other had a step before, the two would chase each other's speed down without end.)
  for (const [gap, kmh1, kmh2] of [[1.5, 120, 120], [0.5, 110, 125], [3, 130, 115], [0, 120, 120]]) {
    const f = field(track, 7);
    const [a1, a2] = f.cars;
    for (let i = 2; i < 7; i++) f.put(f.cars[i], 60 + 14 + (i - 2) * (LENGTH + 0.15), 0, 0, parked());
    f.put(a1, 60, 0.4, kmh1, hold(kmh1, 0.4)); f.put(a2, 60 - gap, -0.4, kmh2, hold(kmh2, -0.4));
    startHop(a1, null, -1, 1, 0.45); startHop(a2, null, -1, 1, 0.45);
    let slowest = Infinity, fastest = -Infinity, bothWaiting = 0;
    const flights = fly(f, 9, { each: () => {
      for (const car of [a1, a2]) if (car.state === CAR_STATE.AIRBORNE) { const v = f.alongSpeed(car); slowest = Math.min(slowest, v); fastest = Math.max(fastest, v); }
      if (a1.state === CAR_STATE.AIRBORNE && a2.state === CAR_STATE.AIRBORNE && a1.airWaiting && a2.airWaiting) bothWaiting++;
    } });
    assert.ok(bothWaiting > 10, `${gap} m apart: both landings waited at the same time (${bothWaiting} steps)`);
    assert.ok(slowest > -YIELD - 8 && fastest <= Math.max(kmh1, kmh2) / KMH + 0.01, `${gap} m apart: speeds in the air from ${slowest.toFixed(1)} to ${fastest.toFixed(1)} m/s`);
    // (afterwards the two cars and the stopped ones meet on the ground: three cars touching in the same step can be left a
    // centimetre or two in each other for a step, as in any contact between three cars)
    for (const car of [a1, a2]) checkFlight(flights, car, `${gap} m apart, car ${car === a1 ? 1 : 2}`, { touching: 0.05 });
    t.diagnostic(`${gap} m apart at ${kmh1} and ${kmh2} km/h: speeds in the air from ${(slowest * KMH).toFixed(0)} to ${(fastest * KMH).toFixed(0)} km/h; ${flights.map((x) => `car ${x.car === a1 ? 1 : 2}: ${told(x)}${x.putBack ? ' (put back)' : ''}`).join('; ')}`);
  }
});

test('every car that is drawn counts under the landing place, whatever its state: one waiting to be put back, one in the pit entry', (t) => {
  // (found by the independent review; both were left out of the landing test, as they are left out of the contacts on the
  // ground: the car in flight was set down in them)
  // a car that has spun and waits to be put back on the track (it stays where it is, drawn, for a moment)
  for (const kind of ['hop', 'accident']) {
    // where does the flight come down when nothing is in the way?
    let f = field(track, 3), a = KINDS[kind](f).a, place = null;
    for (let i = 0; i < 400 && !place; i++) { const was = a.state; f.tick(); if (was === CAR_STATE.AIRBORNE && a.state !== CAR_STATE.AIRBORNE) place = { s: a.s, d: a.d }; }
    // the same flight, with a car put there at the take-off, waiting to be put back for the next five seconds
    f = field(track, 3); a = KINDS[kind](f).a;
    const c = f.cars[2];
    let set = false, stateAtTheLanding = null;
    const flights = fly(f, 4, { each: () => {
      if (!set && a.state === CAR_STATE.AIRBORNE) { set = true; placeCar(c, track, place.s, place.d); c.drive = null; requestReset(c, 5); }
      else if (set && stateAtTheLanding === null && a.state !== CAR_STATE.AIRBORNE) stateAtTheLanding = c.state;
    } });
    const fl = checkFlight(flights, a, `${kind}, a car waiting to be put back where it lands`);
    assert.equal(stateAtTheLanding, CAR_STATE.RESET, 'that car was still there, waiting, when the flight ended');
    assert.ok(fl.waited > 0.05, `${kind}: the landing waited (${fl.waited.toFixed(2)} s)`);
    t.diagnostic(`${kind}, a car waiting to be put back at the landing place: ${told(fl)}`);
  }
  // a car in the pit entry, before the pit wall begins: a hop along that edge of the road comes down beside or behind it, not in it
  let flew = 0, inIt = 0, waits = 0;
  for (const ahead of [10, 14, 18, 22, 26, 30]) for (const kmh of [60, 80, 120, 160]) for (const dA of [-7.2, -7.6]) {
    const f = field(track, 3), [a, b, c] = f.cars;
    const at = (rel) => track.length + rel - f.s0;                         // `along` of a place given relative to the start line
    f.put(b, at(-285), dA + 1.95, 150, hold(150, dA + 1.95)); f.put(a, at(-285) - LENGTH - 4, dA, 215, hold(215, dA));
    f.put(c, at(-285) + ahead, -9.2, kmh, hold(kmh, -9.2));
    const flights = fly(f, 4), fl = flights.find((x) => x.car === a);
    if (!fl) continue;
    flew++; if (fl.waited > 0) waits++;
    if (fl.overlapAtLanding > 0) inIt++;
    assert.ok(fl.down >= 0 && fl.seconds <= longest(fl) && !fl.putBack, `pit entry, car ${ahead} m ahead at ${kmh} km/h: the flight ends by a landing`);
  }
  assert.ok(flew >= 30, `${flew} hops along the pit entry`);
  assert.equal(inIt, 0, `${inIt} of ${flew} hops set down in the car in the pit entry`);
  t.diagnostic(`${flew} hops along the pit entry with a car in the entry lane: ${inIt} set down in it, ${waits} landings waited`);
});
