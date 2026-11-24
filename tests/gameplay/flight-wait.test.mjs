// A car in flight that cannot come down where it planned to. Its landing place is chosen free of every car at the
// take-off (flightPlan), but the other cars go on driving while it is in the air: one can come to be under it, and
// stay there. The flight must then still END, within a stated time, WITHOUT the car being set down in another one,
// without anything being moved by hand, and with a flight that stays a flight: the car moved by its own velocity.
//
// Each scenario is played by real cars driven through their controls. The driver that makes the defect appear is
// `shadow`: from the take-off it does what it can to be under the car in flight (it brakes at the rate the car in
// flight slows down, or speeds up to it, and steers under it). Before the correction (PR #8, commit dc8b823) the
// landing waited for as long as a car was below, then, once the car in flight had nearly lost all its speed, came
// down whatever was under it: every scenario below ended with the car set down inside another one, seconds later.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { startHop } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { field, hold, parked, shadow, switching, watchFlights, SIM_DT, CAR_STATE, KMH, bodyOverlap } from './flight-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));
const LENGTH = 4.2;                                                    // of a car (m)
const WAIT_MAX = T.flightWaitMax ?? 3;                                 // s: longest wait of a landing, all causes together
const YIELD = T.flightYieldSpeed ?? 8;                                 // m/s kept between the car in flight and a car below it
/** Longest time a flight can last: the longest plan, the wait, and the descent. */
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
function checkFlight(flights, car, label, { noPutBack = true, waitAtMost = WAIT_MAX, offVelocity = 1e-6 } = {}) {
  const fl = flights.find((x) => x.car === car);
  assert.ok(fl, `${label}: the car took off`);
  // it ends
  assert.ok(fl.down >= 0, `${label}: the flight ends (still in the air ${((flights.steps - fl.up) * SIM_DT).toFixed(1)} s after the take-off)`);
  assert.ok(fl.seconds <= longest(fl), `${label}: ${fl.seconds.toFixed(2)} s in the air, at most ${longest(fl).toFixed(2)} s allowed`);
  assert.ok(fl.waited <= waitAtMost + 2 * SIM_DT, `${label}: the landing waited ${fl.waited.toFixed(2)} s, at most ${waitAtMost} s`);
  // it is not set down in another car, and no car is driven through afterwards
  assert.equal(fl.overlapAtLanding, 0, `${label}: set down ${fl.overlapAtLanding.toFixed(2)} m inside another car`);
  assert.equal(fl.overlapAfter, 0, `${label}: bodies overlapping after the landing (${fl.overlapAfter.toFixed(2)} m)`);
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
  const flights = fly(f, 8);
  const fl = checkFlight(flights, a, 'over a line of 25 stopped cars', { noPutBack: false });
  assert.equal(fl.putBack, true, 'the flight ended by the car being put back on the track');
  assert.ok(fl.waited >= WAIT_MAX - 0.05, `after the whole wait (${fl.waited.toFixed(2)} s)`);
  // where: on the road, stationary, clear of every car
  const clear = Math.min(...f.cars.filter((o) => o !== a).map((o) => Math.hypot(o.x - a.x, o.z - a.z)));
  assert.ok(Math.abs(a.d) <= track.halfWidth, `on the road (${a.d.toFixed(1)} m from the centre line)`);
  assert.ok(clear > LENGTH + 2, `nearest car ${clear.toFixed(1)} m away`);
  assert.ok(f.events.some((e) => e.type === 'reset' && e.car === a.index), 'signalled as any car put back on the track');
  t.diagnostic(`over a line of 25 stopped cars: ${fl.seconds.toFixed(2)} s in the air, then put back on the track ${clear.toFixed(1)} m from the nearest car`);
});

test('letting a crawling car go: the car drifts back off it, comes down rolling backwards a little, and drives off', (t) => {
  // a hop started by hand at 32 km/h (no hop is that slow in a race: this is the far end of the rule) over a car crawling
  // at 18 km/h: too slow to pass it at the margin, the car in flight lets it go, which here means moving backwards
  const f = field(track, 2);
  const [a, c] = f.cars;
  f.put(c, 60 + 3.5, 0, 18, hold(18, 0));
  f.put(a, 60, 0, 32, hold(60, 0));
  const heading = a.heading;
  startHop(a, null, -1, 1, 0.45);
  let backwards = 0, slowestAlong = Infinity;
  const flights = fly(f, 5, { each: () => { if (a.state === CAR_STATE.AIRBORNE) { const v = f.alongSpeed(a); if (v < 0) backwards++; slowestAlong = Math.min(slowestAlong, v); } } });
  const fl = checkFlight(flights, a, 'over a crawling car', { waitAtMost: 1.6 });
  assert.ok(backwards > 10, `it moved backwards for a while (${backwards} steps, ${slowestAlong.toFixed(1)} m/s at most)`);
  assert.ok(slowestAlong >= 18 / KMH - YIELD - 0.2, `never further from the speed of the car below than the margin (${slowestAlong.toFixed(1)} m/s)`);
  assert.ok(f.along(a) < f.along(c) - LENGTH, 'it came down behind the car it let go');
  // on its wheels, pointing the way it flew, and its driver takes it away
  assert.ok(Math.abs(a.heading - heading) < 0.02 && a.state === CAR_STATE.RACING && !a.reverse, `heading ${a.heading.toFixed(3)} (was ${heading.toFixed(3)}), state ${a.state}`);
  assert.ok(a.speed > 3, `driving forward again, behind the crawling car (${(a.speed * KMH).toFixed(0)} km/h)`);
  t.diagnostic(`over a car crawling at 18 km/h: ${told(fl)}; ${backwards} steps moving backwards, at ${(-slowestAlong * KMH).toFixed(0)} km/h at most`);
});
