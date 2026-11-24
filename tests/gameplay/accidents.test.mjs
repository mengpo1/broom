// Launches, landings and their staging. Scenarios E3 (launch over a car, hard landing, explosion,
// stop, restart) and E5 (launch on a roadside board, light landing, slide out of control) of
// docs/research/vroom-gameplay-analysis.md are replayed and compared with the measurements of
// the report. Those measurements are approximate references: tolerances are stated in each test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { crashPitch, crashPitchDuration, slideTremble, contactDive, flightAttitude, FLIGHT_ATTITUDE, CRASH_CAMERA as C } from '../../src/rendering/compositing/crash-camera.js';
import { BLAST } from '../../src/rendering/effects/effects-layer.js';
import { twoCars, run, straightStretch, KMH } from './collision-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));
const stateAt = (log, who, type) => { const e = log.events.find((x) => x.type === type); return e ? { e, frame: log.frames[e.frame][who], before: log.frames[Math.max(0, e.frame - 1)][who] } : null; };

/** E3: the follower at 262 km/h rides over the right rear wheel of a car doing 190 km/h (half overlap). */
function scenarioE3(seconds = 9) {
  const setup = twoCars(track, { gap: 2.5, lateral: 0.93, speedA: 262 / KMH, speedB: 190 / KMH, straight: 700 });
  const log = run(setup.race, seconds, { throttleA: 1, throttleB: 0.7 });
  return { ...setup, log };
}

test('E3 launch: wheel over wheel at a high closing speed throws the follower in the air; the car ahead drives on', () => {
  const { a, b, log } = scenarioE3(0.6);
  const launch = stateAt(log, 'a', 'launch');
  assert.ok(launch, 'launch event');
  assert.equal(launch.e.car, a.index); assert.equal(launch.e.other, b.index);
  assert.equal(launch.frame.state, CAR_STATE.AIRBORNE);
  assert.ok(Math.abs(launch.before.speed * KMH - 262) < 8, `launched at ${(launch.before.speed * KMH).toFixed(0)} km/h (reference 262)`);
  const leader = stateAt(log, 'b', 'launch');
  assert.equal(leader.frame.state, CAR_STATE.RACING);
  assert.ok(Math.abs(leader.frame.speed - leader.before.speed) < 0.5, 'the car ahead is not disturbed');
  assert.ok(log.events.every((e) => e.type !== 'bump' && e.type !== 'wheel'), 'not a bump');
});

test('E3 flight: the car flies over the car it rode over and comes down ahead of it, beside its path; that car drives past the wreck', () => {
  // (until lot 5 the car was held behind the one it hit, as on the reference footage; the player asked for the
  // opposite after the trials of PR #4: a car that takes off clears what threw it up and lands ahead of it)
  const { race, a, b, log } = scenarioE3(2.6);
  const launch = stateAt(log, 'a', 'launch'), landing = stateAt(log, 'a', 'landing');
  const length = a.params.halfLength + b.params.halfLength, width = a.params.halfWidth + b.params.halfWidth;
  // how far the car in flight is ahead of the other one (m along the road, centre to centre), and to its side
  const ahead = (f) => { let ds = f.a.s - f.b.s; if (ds > track.length / 2) ds -= track.length; else if (ds < -track.length / 2) ds += track.length; return ds; };
  const atLaunch = log.frames[launch.e.frame], atLanding = log.frames[landing.e.frame];
  assert.ok(ahead(atLaunch) < -length + 0.6, `it takes off behind (${ahead(atLaunch).toFixed(2)} m)`);
  // it passes over the other car during the flight...
  const over = log.frames.slice(launch.e.frame, landing.e.frame).filter((f) => Math.abs(ahead(f)) < length && Math.abs(f.a.d - f.b.d) < width);
  assert.ok(over.length > 20, `${over.length} steps above the other car`);
  assert.ok(over.every((f) => f.a.state === CAR_STATE.AIRBORNE));
  const above = over.filter((f) => Math.abs(ahead(f)) < 1.5);
  assert.ok(above.length > 5 && above.every((f) => f.a.airHeight > 0.7), `well off the ground when it is right above it (${Math.min(...above.map((f) => f.a.airHeight)).toFixed(2)} m at least)`);
  // ...and comes down ahead of it, clear of it lengthwise and beside its path
  assert.ok(ahead(atLanding) >= length + T.flightClearance - 0.15, `lands ${(ahead(atLanding) - length).toFixed(2)} m ahead of the nose of the other car`);
  assert.ok(Math.abs(atLanding.a.d - atLanding.b.d) >= width + T.flightSideClearance - 0.1, `and ${(Math.abs(atLanding.a.d - atLanding.b.d) - width).toFixed(2)} m to the side of it`);
  assert.ok(Math.sign(atLanding.a.d - atLanding.b.d) === Math.sign(atLaunch.a.d - atLaunch.b.d), 'on the side it was already on');
  // the flight is free: at each step the car moves by its own velocity, slowing by 50 km/h per second
  const lost = (launch.frame.speed - log.frames[landing.e.frame - 1].a.speed) * KMH / (landing.e.time - launch.e.time);
  assert.ok(Math.abs(lost - 50) < 4, `${lost.toFixed(1)} km/h per second lost in flight`);
  for (let i = launch.e.frame + 2; i < landing.e.frame; i++) {
    const step = Math.abs(ahead(log.frames[i]) - ahead(log.frames[i - 1]));
    assert.ok(step < (log.frames[i].a.speed - log.frames[i].b.speed) * SIM_DT + 0.02, `no jump of position in flight (step ${i}: ${step.toFixed(3)} m)`);
  }
  // then it is a wreck where it landed, and the car it flew over drives past it without touching it
  let nearest = Infinity;
  for (let i = landing.e.frame; i < log.frames.length; i++) {
    const f = log.frames[i];
    if (Math.abs(ahead(f)) < length) nearest = Math.min(nearest, Math.abs(f.a.d - f.b.d) - width);
  }
  assert.ok(nearest > 0.2 && nearest < 1.5, `the other car passes ${nearest.toFixed(2)} m beside the wreck`);
  const end = log.frames.at(-1);
  assert.ok(ahead(end) < -20, 'and drives away ahead');
  assert.equal(end.b.state, CAR_STATE.RACING);
  assert.ok(log.events.every((e) => e.car !== b.index || !['bump', 'wheel', 'crash', 'launch'].includes(e.type)), 'nothing happens to it');
  assert.equal(b.contacts, 1, 'one contact for the car that was hit: the shock itself');
  assert.equal(race.cars.filter((c) => c.state === CAR_STATE.WRECKED).length, 1);
});

test('E3 at an angle: the follower converging on the car ahead still comes down beside its path, and is never driven through', () => {
  // (found by an independent review: the sideways throw assumed the two cars parallel; turned toward the car ahead by
  // half a degree or more, the wreck was set down in its path and the car drove through it for 22 steps)
  const overlap = (p, q) => {
    const dx = q.x - p.x, dz = q.z - p.z; let min = Infinity;
    for (const h of [p.heading, p.heading + Math.PI / 2, q.heading, q.heading + Math.PI / 2]) {
      const ax = Math.cos(h), az = Math.sin(h);
      const reach = (c) => c.params.halfLength * Math.abs(ax * Math.cos(c.heading) + az * Math.sin(c.heading)) + c.params.halfWidth * Math.abs(-ax * Math.sin(c.heading) + az * Math.cos(c.heading));
      const o = reach(p) + reach(q) - Math.abs(dx * ax + dz * az);
      if (o <= 0) return 0;
      min = Math.min(min, o);
    }
    return min;
  };
  for (const lateral of [0.93, -0.93]) {
    for (const turned of [-0.03, -0.01, 0, 0.01, 0.02, 0.03, 0.05]) {
      // (headingA turns the follower to the right: toward the car ahead when it starts on its left)
      const { race, a, b } = twoCars(track, { gap: 2.5, lateral, speedA: 262 / KMH, speedB: 190 / KMH, headingA: turned * Math.sign(lateral), straight: 700 });
      let flew = false, landed = false, worst = 0, side = 0;
      for (let i = 0; i < 2.6 / SIM_DT; i++) {
        race.setPlayerInput(0, 0, 1, 0, 0, false, false); race.setPlayerInput(1, 0, 0.7, 0, 0, false, false);
        race.step(SIM_DT); race.eventCount = 0;
        if (a.state === CAR_STATE.AIRBORNE) flew = true;
        if (flew && a.state !== CAR_STATE.AIRBORNE) {
          if (!landed) { landed = true; side = Math.abs(-(a.x - b.x) * Math.sin(b.heading) + (a.z - b.z) * Math.cos(b.heading)); }
          worst = Math.max(worst, overlap(a, b));
        }
      }
      // (turned further, the nose arrives nearly in line with the tail: more than 80 % of the widths overlap, it is a bump)
      if (Math.abs(turned) <= 0.03) assert.ok(flew && landed, `turned ${turned} rad, ${lateral} m: the accident happened`);
      if (!flew) continue;
      assert.equal(a.state, CAR_STATE.WRECKED);
      assert.equal(worst, 0, `turned ${turned} rad, ${lateral} m: the car that was hit never drives through the wreck (landed ${side.toFixed(2)} m to its side)`);
      assert.ok(side >= a.params.halfWidth + b.params.halfWidth + T.flightSideClearance - 0.2, `turned ${turned} rad, ${lateral} m: it comes down ${(side - a.params.halfWidth - b.params.halfWidth).toFixed(2)} m beside the other car`);
    }
  }
});

test('two contacts in the same step: the bodies come first whatever the order of the cars, and a car thrown in the air is touched by nothing else', () => {
  // (found by an independent review) the car behind meets, in the same step, the rear wheel of one car (L1) with its
  // front wheel and the tail of another (L2) with its nose. Whichever car has which place in the list, the contact
  // between bodies decides (the accident), there is no hop, and the two other cars are not disturbed. L2 is moved
  // forward a little at a time: at first the nose reaches it before the wheels meet, then in the same step, then not
  // at all (the hop). Before the correction the outcome depended on the order for every position from 0.57 to 0.71 m.
  const seen = { accident: 0, hop: 0 };
  for (const extra of [0.5, 0.56, 0.58, 0.6, 0.62, 0.64, 0.66, 0.68, 0.7, 0.72, 0.76]) {
    const outcomes = [];
    for (const order of [[2, 0, 1], [2, 1, 0], [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0]]) {
      const { race, s0 } = twoCars(track, { gap: 60, lateral: 0, speedA: 1, speedB: 1, straight: 700 });
      const [F, L1, L2] = order.map((i) => race.cars[i]);
      // the three cars are the same car (the third entry of the race is a computer driver, with its own figures)
      const put = (car, s, d, kmh) => { car.params = race.cars[0].params; placeCar(car, track, s, d); car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = kmh / KMH; car.gear = kmh > 200 ? 5 : 4; car.isHuman = true; };
      put(L1, s0 + 60, 1.95, 150); put(L2, s0 + 60 + extra, -0.6, 150); put(F, s0 + 60 - 4.2 - 2, 0, 215);
      const hold = (car, kmh) => Math.max(0, Math.min(1, 0.35 + (kmh / KMH - car.speed) * 0.4));
      const events = [];
      let px = F.x, pz = F.z, flying = false;
      for (let i = 0; i < 80; i++) {
        for (const [car, kmh] of [[F, 215], [L1, 150], [L2, 150]]) { car.inThrottle = car.state === CAR_STATE.RACING ? hold(car, kmh) : 0; car.inSteer = 0; car.inBrake = 0; }
        const before = { l1: L1.speed, l2: L2.speed };
        race.step(SIM_DT);
        for (let e = 0; e < race.eventCount; e++) events.push({ type: race.events[e].type, car: race.events[e].car, other: race.events[e].other, step: i });
        race.eventCount = 0;
        if (flying && F.state === CAR_STATE.AIRBORNE) assert.ok(Math.hypot(F.x - px - F.velX * SIM_DT, F.z - pz - F.velZ * SIM_DT) < 1e-6, `L2 ${extra} m ahead, order ${order}: step ${i}, the car in flight is moved by its own velocity only`);
        flying = F.state === CAR_STATE.AIRBORNE; px = F.x; pz = F.z;
        assert.ok(Math.abs(L1.speed - before.l1) < 0.3 && Math.abs(L2.speed - before.l2) < 0.3, `L2 ${extra} m ahead, order ${order}: step ${i}, the two other cars are not disturbed`);
      }
      const mine = events.filter((e) => e.car === F.index);
      const launch = mine.find((e) => e.type === 'launch');
      outcomes.push(`${mine.some((e) => e.type === 'hop') ? 'hop' : launch ? 'accident' : mine.some((e) => e.type === 'bump') ? 'bump' : 'none'} at step ${(launch || mine[0] || { step: -1 }).step} on the car playing ${launch ? (launch.other === L2.index ? 'L2 (body)' : 'L1 (wheel)') : '-'}`);
    }
    for (const o of outcomes) assert.equal(o, outcomes[0], `L2 ${extra} m ahead: same outcome for every order of the cars (${outcomes.join(' | ')})`);
    if (outcomes[0].startsWith('accident')) { seen.accident++; assert.ok(outcomes[0].endsWith('L2 (body)'), `L2 ${extra} m ahead: the contact between bodies decides: ${outcomes[0]}`); }
    else { seen.hop++; assert.ok(outcomes[0].startsWith('hop') && outcomes[0].endsWith('L1 (wheel)'), `L2 ${extra} m ahead: out of reach of the nose, the wheel decides: ${outcomes[0]}`); }
    // up to 0.7 m the nose reaches L2 no later than the wheels meet: the bodies decide
    if (extra <= 0.7) assert.ok(outcomes[0].startsWith('accident'), `L2 ${extra} m ahead: ${outcomes[0]}`);
  }
  assert.ok(seen.accident >= 8 && seen.hop >= 2, `both outcomes are met: ${JSON.stringify(seen)}`);
});

test('E3 near a barrier: the flight stays between the barriers, and the car is still not set down on another one', () => {
  // the two cars against the right-hand barrier, the follower on the outside: the flight would carry it further out
  // (the follower on the right: the left-hand side of this straight is the pit wall)
  const setup = twoCars(track, { gap: 2.5, lateral: -0.93, speedA: 262 / KMH, speedB: 190 / KMH, straight: 700 });
  const { race, a, b } = setup;
  const i0 = Math.floor(a.s / track.ds) % track.n, wall = track.barrierR[i0];
  const side = Math.sign(a.d - b.d);                       // the side the follower is on: it is thrown further that way
  assert.equal(side, 1);
  const shift = wall - a.params.halfWidth - 0.3 - a.d;
  for (const car of [a, b]) placeCar(car, track, car.s, car.d + shift);
  a.state = CAR_STATE.RACING; b.state = CAR_STATE.RACING; a.speed = 262 / KMH; b.speed = 190 / KMH; a.gear = 6; b.gear = 5;
  let flew = false, landed = false, worst = 0;
  for (let i = 0; i < 2.5 / SIM_DT; i++) {
    race.setPlayerInput(0, 0, 1, 0, 0, false, false); race.setPlayerInput(1, 0, 0.7, 0, 0, false, false);
    race.step(SIM_DT); race.eventCount = 0;
    if (a.state === CAR_STATE.AIRBORNE) flew = true;
    const k = a.segIndex, limit = (a.d > 0 ? track.barrierR[k] : track.barrierL[k]) - a.params.halfWidth;
    assert.ok(Math.abs(a.d) <= limit + 0.02, `inside the barrier at step ${i} (${Math.abs(a.d).toFixed(2)} m for ${limit.toFixed(2)})`);
    if (flew && !landed && a.state !== CAR_STATE.AIRBORNE) {
      landed = true;
      const dx = a.x - b.x, dz = a.z - b.z, f = [Math.cos(b.heading), Math.sin(b.heading)];
      const along = Math.abs(dx * f[0] + dz * f[1]), across = Math.abs(-dx * f[1] + dz * f[0]);
      assert.ok(along >= a.params.halfLength + b.params.halfLength || across >= a.params.halfWidth + b.params.halfWidth, 'clear of the other car as it lands');
    }
  }
  assert.ok(flew && landed, 'the accident happened against the barrier');
  assert.equal(a.state, CAR_STATE.WRECKED);
});

test('E3 flight: 0.85 s, slowing by 50 km/h per second, rising then coming down', () => {
  const { log } = scenarioE3(1.2);
  const launch = stateAt(log, 'a', 'launch'), landing = stateAt(log, 'a', 'landing');
  assert.ok(landing, 'landing event');
  const flight = landing.e.time - launch.e.time;
  assert.ok(Math.abs(flight - 0.85) < 0.03, `flight ${flight.toFixed(3)} s (reference about 0.85)`);
  const rate = (launch.frame.speed - landing.before.speed) * KMH / flight;
  assert.ok(Math.abs(rate - 50) < 5, `loses ${rate.toFixed(1)} km/h per second in the air (reference 50)`);
  const heights = log.frames.slice(launch.e.frame, landing.e.frame).map((f) => f.a.airHeight);
  const peak = Math.max(...heights);
  assert.ok(peak > 1 && peak < 1.6 && heights[0] < 0.1 && heights.at(-1) < 0.1, `arc of the flight, peak ${peak.toFixed(2)} m`);
  assert.ok(log.frames.slice(launch.e.frame, landing.e.frame).every((f) => f.a.state === CAR_STATE.AIRBORNE));
});

test('E3 hard landing: speed cut to about 15 %, standstill within a second, 3.2 s stopped, restart on the spot in first gear', () => {
  const { a, log } = scenarioE3(9);
  const landing = stateAt(log, 'a', 'landing');
  assert.equal(landing.e.value, 1, 'hard landing');
  const ratio = landing.frame.speed / landing.before.speed;
  assert.ok(ratio > 0.1 && ratio < 0.2, `speed kept at the landing: ${(ratio * 100).toFixed(0)} % (reference 228 -> 35 km/h, 15 %)`);
  assert.equal(landing.frame.state, CAR_STATE.WRECKED);
  assert.ok(log.events.some((e) => e.type === 'crash' && e.car === a.index), 'explosion and crash sound are triggered');
  const stopped = log.frames.findIndex((f, i) => i > landing.e.frame && f.a.speed < 0.05);
  const stopTime = log.frames[stopped].time - log.frames[landing.e.frame].time;
  assert.ok(stopTime > 0.6 && stopTime < 1.0, `standstill ${stopTime.toFixed(2)} s after the landing (reference 0.84)`);
  const restart = stateAt(log, 'a', 'restart');
  assert.ok(restart, 'restart event');
  const hold = restart.e.time - log.frames[stopped].time;
  assert.ok(Math.abs(hold - 3.2) < 0.25, `stopped for ${hold.toFixed(2)} s (reference 3.2)`);
  const total = restart.e.time - stateAt(log, 'a', 'launch').e.time;
  assert.ok(Math.abs(total - 4.9) < 0.3, `launch to restart ${total.toFixed(2)} s (reference 4.9)`);
  assert.equal(restart.frame.state, CAR_STATE.RACING);
  assert.ok(Math.abs(restart.frame.s - restart.before.s) < 0.05 && Math.abs(restart.frame.d - restart.before.d) < 0.05, 'restarts where it stopped, no teleport');
  // it pulls away again under its own power (normal driving is untouched: 0-100 km/h in about 1.9 s)
  const later = log.frames.find((f) => f.time > log.frames[restart.e.frame].time + 2.2);
  assert.ok(later && later.a.speed * KMH > 95 && later.a.state === CAR_STATE.RACING, `2.2 s after the restart: ${(later.a.speed * KMH).toFixed(0)} km/h`);
  assert.ok(a.gear >= 1 && log.frames[restart.e.frame + 5].a.speed < 3, 'starts from standstill');
});

test('a wrecked or flying car cannot be hit, and the restarting car is protected for a moment', () => {
  const { race, a, log } = scenarioE3(2.5);
  assert.equal(a.state, CAR_STATE.WRECKED);
  // a third car drives straight through the place of the wreck
  const third = race.cars.find((c) => !c.isHuman);
  placeCar(third, track, a.s - 30, a.d); third.state = CAR_STATE.RACING; third.speed = 50; third.gear = 4; third.ghostTimer = 0;
  const contactsBefore = a.contacts;
  for (let i = 0; i < 1.2 / SIM_DT; i++) { race.step(SIM_DT); race.eventCount = 0; }
  assert.equal(a.contacts, contactsBefore, 'no contact with the wreck');
  assert.ok(log.events.filter((e) => e.type === 'launch').length === 1);
});

test('a computer driver steers round a wreck instead of driving through it', () => {
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }, { driver: DRIVERS[1] }];
  const race = new Race({ track, laps: 3, entries, rules: RULE_PRESETS.arcade, difficulty: 'pro', seed: 5 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const wreck = race.playerCars[0], [driver, other] = race.cars.filter((c) => !c.isHuman);
  const s0 = straightStretch(track, 500) + 30, onLine = (s) => track.line[Math.floor(s / track.ds) % track.n];
  placeCar(driver, track, s0, onLine(s0)); driver.state = CAR_STATE.RACING; driver.speed = 70; driver.gear = 5; driver.ghostTimer = 0;
  placeCar(other, track, s0 + track.length / 2, 0); other.state = CAR_STATE.RACING;
  // the wreck stands on the racing line, 100 m ahead
  placeCar(wreck, track, s0 + 100, onLine(s0 + 100));
  wreck.state = CAR_STATE.WRECKED; wreck.speed = 0; wreck.velX = 0; wreck.velZ = 0; wreck.wreckTimer = 1; wreck.wreckDecel = 1;
  let alongside = Infinity, passed = false;
  for (let i = 0; i < 4 / SIM_DT; i++) {
    race.setPlayerInput(0, 0, 0, 0, 0, false, false);
    race.step(SIM_DT); race.eventCount = 0;
    const ds = wreck.s - driver.s;
    if (Math.abs(ds) < driver.params.halfLength + wreck.params.halfLength) alongside = Math.min(alongside, Math.abs(driver.d - wreck.d));
    if (ds < -6) passed = true;
  }
  assert.ok(passed, 'the driver went past the wreck');
  assert.ok(alongside > driver.params.halfWidth + wreck.params.halfWidth, `the cars did not overlap: ${alongside.toFixed(2)} m between centres when alongside`);
  assert.equal(driver.state, CAR_STATE.RACING);
});

test('E5 launch on a board: thrown in the air, light landing without loss of speed nor explosion, slide, restart from where it stopped', () => {
  const tr = buildTrack(getCircuit('hazelbrook'));
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
  const race = new Race({ track: tr, laps: 2, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 3 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const car = race.playerCars[0], o = race.obstacles[0];
  placeCar(car, tr, o.s - 25, o.d);
  car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = 240 / KMH; car.gear = 5;
  const events = [], frames = [];
  for (let i = 0; i < 6 / SIM_DT; i++) {
    race.setPlayerInput(0, 0, 0, 0, 0, false, false);
    const before = { speed: car.speed, state: car.state, he: car.headingError };
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) events.push({ type: race.events[e].type, car: race.events[e].car, value: race.events[e].value, time: i * SIM_DT, before, after: { speed: car.speed, state: car.state } });
    race.eventCount = 0;
    frames.push({ time: (i + 1) * SIM_DT, speed: car.speed, state: car.state, he: car.headingError, d: car.d });
  }
  const mine = events.filter((e) => e.car === car.index);
  const hit = mine.find((e) => e.type === 'obstacle'), launch = mine.find((e) => e.type === 'launch'), landing = mine.find((e) => e.type === 'landing');
  assert.ok(hit && launch && landing, 'board hit, launch, landing');
  assert.ok(Math.abs(hit.before.speed * KMH - 236) < 10, `hit at ${(hit.before.speed * KMH).toFixed(0)} km/h (reference 240)`);
  assert.equal(launch.time, hit.time);
  const flight = landing.time - launch.time;
  assert.ok(Math.abs(flight - 0.6) < 0.03, `flight ${flight.toFixed(2)} s (reference about 0.6, by analogy)`);
  assert.equal(landing.value, 0, 'light landing');
  assert.ok(landing.after.speed > landing.before.speed * 0.97, 'no loss of speed at the landing (reference 227 -> 224 km/h)');
  assert.ok(mine.every((e) => e.type !== 'crash'), 'no explosion');
  assert.equal(landing.after.state, CAR_STATE.SPIN, 'slides out of control');
  // the slide: slow at first (about 30 km/h per second), then the car digs in; stopped about 2.1 s after the landing
  const at = (t) => frames.find((f) => f.time >= landing.time + t);
  const early = (at(0.05).speed - at(0.55).speed) * KMH / 0.5;
  assert.ok(early > 20 && early < 45, `early deceleration ${early.toFixed(0)} km/h per second (reference about 30)`);
  const stop = frames.find((f) => f.time > landing.time && f.speed < 0.5);
  assert.ok(stop && stop.time - landing.time > 1.6 && stop.time - landing.time < 2.6, `stopped ${(stop.time - landing.time).toFixed(2)} s after the landing (reference about 2.1)`);
  // it turns slowly while it slides (reference: about 75 degrees in 0.84 s)
  const turned = Math.abs(at(1.0).he - at(0.1).he);
  assert.ok(turned > 0.9 && turned < 1.8, `turned ${(turned * 57.3).toFixed(0)} degrees in 0.9 s`);
  // the car is not moved: it is handed back to its driver where it stopped, off the track, in first gear
  const handed = frames.find((f) => f.time > stop.time && f.state === CAR_STATE.RACING);
  assert.ok(handed && handed.time - stop.time < 0.2, 'driving again as soon as the slide is over');
  assert.ok(Math.abs(handed.d - stop.d) < 0.1 && Math.abs(handed.d) > tr.halfWidth, `not put back on the track (d ${handed.d.toFixed(1)} m)`);
  assert.ok(mine.every((e) => e.type !== 'reset' || e.time > handed.time + 2.5), 'no automatic repositioning at the end of the slide');
  assert.equal(car.gear, 1);
});

// (Until lot 5 a contact too slow for the accident, with the same partial overlap, gave a recoverable hop: the
// test stated three levels by energy. The hop now comes from a contact between wheels only, at the edge of the
// cars; the cases and the thresholds of the accident itself are unchanged, with one consequence stated below.)
test('launch conditions are explicit: the accident inside its overlap window, the hop on the wheels, nothing else flies', () => {
  const cases = [
    { name: 'in line (full overlap)', lateral: 0, speedA: 262, speedB: 190, outcome: 'none' },
    { name: 'too slow for the accident: a bump', lateral: 0.93, speedA: 170, speedB: 100, outcome: 'none' },
    { name: 'low closing speed', lateral: 0.93, speedA: 262, speedB: 240, outcome: 'none' },
    { name: 'slow car', lateral: 0.93, speedA: 95, speedB: 45, outcome: 'none' },
    { name: 'nose on a rear wheel, fast', lateral: 0.93, speedA: 262, speedB: 190, outcome: 'accident' },
    { name: 'nose on a rear wheel, other side', lateral: -0.93, speedA: 262, speedB: 190, outcome: 'accident' },
    { name: 'front wheel on rear wheel, fast', lateral: 1.95, speedA: 262, speedB: 190, outcome: 'hop' },
    { name: 'front wheel on rear wheel, slower car', lateral: -1.95, speedA: 185, speedB: 110, outcome: 'hop' },
  ];
  for (const c of cases) {
    const { race, a } = twoCars(track, { gap: 2, lateral: c.lateral, speedA: c.speedA / KMH, speedB: c.speedB / KMH, straight: 700 });
    const log = run(race, 0.7, { throttleA: 1, throttleB: 0.8 });
    const launched = log.events.some((e) => e.type === 'launch'), hop = log.events.some((e) => e.type === 'hop');
    assert.equal(launched, c.outcome !== 'none', c.name);
    assert.equal(hop, c.outcome === 'hop', `${c.name}: hop`);
    if (c.outcome === 'accident') assert.equal(a.airKind, 1, `${c.name}: hard landing ahead`);
    if (c.outcome === 'none' && c.lateral !== 0 && c.speedA - c.speedB > 30) assert.ok(log.events.some((e) => e.type === 'bump'), `${c.name}: bump`);
  }
  assert.ok(T.launchMinSpeed * KMH > 146 && T.launchClosingSpeed > 0, 'thresholds stay above the speeds of the bumps of E4');
  assert.ok(T.hopClosingSpeed * KMH > 30, 'and the hop needs more closing speed than the wheel contact of E2 (about 25 km/h)');
  // consequence of landing ahead: a car only takes off when its speed can carry it past the other one. With the loss of
  // speed of any flight, the accident needs about 58 km/h of closing speed where its own threshold says 54
  const hold = (car, kmh) => () => Math.max(0, Math.min(1, 0.35 + (kmh / KMH - car.speed) * 0.4));
  const closingNeeded = (lateral) => {
    for (let kmh = 200; kmh <= 215; kmh++) {
      const s = twoCars(track, { gap: 4, lateral, speedA: kmh / KMH, speedB: 150 / KMH, straight: 700 });
      if (run(s.race, 1.5, { throttleA: hold(s.a, kmh), throttleB: hold(s.b, 150) }).events.some((e) => e.type === 'launch')) return kmh - 150;
    }
    return null;
  };
  const needed = closingNeeded(0.93);
  assert.ok(needed >= T.launchClosingSpeed * KMH && needed <= 61, `the accident starts at ${needed} km/h of closing speed on a car holding its speed`);
});

test('pitch of the view (E3, hard): nose up and held, steady swing, ground held, rebound, second dip, level again', () => {
  const car = { state: CAR_STATE.AIRBORNE, airTime: 0, airDuration: T.flightTimeCar, clock: 0, landClock: -10, landHard: false, speed: 60 };
  const samples = [];
  for (let i = 0; i <= Math.round(T.flightTimeCar * 120); i++) { car.airTime = i / 120; car.clock = car.airTime; samples.push(crashPitch(car)); }
  const holdEnd = Math.floor(C.holdFraction * T.flightTimeCar * 120);
  assert.ok(samples[12] <= -0.55 && samples[holdEnd - 1] <= -0.55, 'nose up: the horizon is under the cockpit');
  assert.ok(Math.abs(holdEnd / 120 - 0.4) < 0.03, `nose up held ${(holdEnd / 120).toFixed(2)} s (reference 0.40)`);
  for (let i = holdEnd + 1; i < samples.length; i++) assert.ok(samples[i] >= samples[i - 1] - 1e-9, 'the swing is monotonic');
  assert.ok(Math.abs(samples.at(-1) - C.noseDown) < 0.02, 'nose down at the landing');
  // after the landing
  car.state = CAR_STATE.WRECKED; car.landClock = car.clock; car.landHard = true;
  const t0 = car.clock, after = (t) => { car.clock = t0 + t; return crashPitch(car); };
  assert.equal(after(0.2), C.noseDown); assert.equal(after(0.47), C.noseDown);
  assert.ok(Math.abs(after(C.groundHoldHard + C.reboundHard)) < 0.02, 'rebound to level');
  assert.ok(after(0.48 + 0.16 + 0.28 + 0.3) === C.noseDown, 'second dip down to the ground-only view');
  assert.ok(Math.abs(crashPitchDuration(true) - 1.8) < 0.1, `over ${crashPitchDuration(true).toFixed(2)} s after the landing (reference 1.8)`);
  assert.equal(after(crashPitchDuration(true) + 0.01), 0);
  // from launch to a level view: 2.6 s in the report
  assert.ok(Math.abs(T.flightTimeCar + crashPitchDuration(true) - 2.64) < 0.15);
  // no jump from one displayed image to the next at 60 images per second, except the launch itself
  let previous = after(0);
  for (let t = 1 / 60; t < 2; t += 1 / 60) { const v = after(t); assert.ok(Math.abs(v - previous) < 0.15, `continuous at ${t.toFixed(2)} s`); previous = v; }
});

test('pitch of the view (E5, light): same script, shorter, second dip partial; trembling only while sliding', () => {
  const car = { state: CAR_STATE.SPIN, airTime: 0, airDuration: T.flightTimeObstacle, clock: 5, landClock: 5, landHard: false, speed: 50 };
  const after = (t) => { car.clock = 5 + t; return crashPitch(car); };
  assert.equal(after(0.1), C.noseDown);
  let deepest = 0;
  for (let t = C.groundHoldLight + C.reboundLight; t < 2; t += 1 / 120) deepest = Math.max(deepest, after(t));
  assert.ok(Math.abs(deepest - 0.34) < 0.02 && deepest < 0.4, `second dip ${deepest.toFixed(2)} of the height (reference 0.34)`);
  assert.ok(Math.abs(crashPitchDuration(false) - 1.1) < 0.1);
  assert.equal(after(crashPitchDuration(false) + 0.01), 0);
  car.clock = 6; assert.ok(Math.abs(slideTremble(car)) <= C.trembleAmplitude + 1e-9);
  let swing = 0; for (let t = 0; t < 0.2; t += 1 / 240) { car.clock = 6 + t; swing = Math.max(swing, Math.abs(slideTremble(car))); }
  assert.ok(swing > C.trembleAmplitude * 0.9, 'trembles while sliding');
  car.speed = 2; assert.equal(slideTremble(car), 0);
  car.state = CAR_STATE.RACING; car.speed = 50; assert.equal(slideTremble(car), 0);
});

test('the staging depends only on the simulated state: same values whatever the display rate, nothing for the other player', () => {
  const { a, b, log } = scenarioE3(1.5);
  assert.ok(crashPitch(a) !== 0 || a.state === CAR_STATE.WRECKED);
  assert.equal(crashPitch(b), 0); assert.equal(contactDive(b), 0); assert.equal(slideTremble(b), 0);
  // evaluating twice, or after any number of intermediate evaluations, gives the same value
  const v = crashPitch(a); for (let i = 0; i < 7; i++) crashPitch(a);
  assert.equal(crashPitch(a), v);
  // deterministic: the same scenario gives the same events at the same steps
  const again = scenarioE3(1.5).log;
  assert.deepEqual(again.events.map((e) => [e.type, e.car, e.frame]), log.events.map((e) => [e.type, e.car, e.frame]));
});

test('seen from outside: a car in flight is tilted (nose up then down, the side that was hit lifted) and flattened as it lands', () => {
  const out = { pitch: 0, roll: 0, squash: 1 };
  const flying = (u, side = 1) => flightAttitude({ state: CAR_STATE.AIRBORNE, airTime: u * T.flightTimeCar, airDuration: T.flightTimeCar, launchSide: side, clock: 0, landClock: -10 }, out);
  // nose up at the start of the flight, nose down at the end, the same script as the driver's view
  assert.ok(flying(0.2).pitch > 0.15, 'nose up'); assert.ok(flying(0.98).pitch < -0.15, 'nose down');
  let previous = Infinity;
  for (let u = C.holdFraction; u <= 1; u += 0.05) { const p = flying(u).pitch; assert.ok(p <= previous + 1e-9, 'the nose only goes down once it starts to'); previous = p; }
  // the side that rode over the other car lifts, most at the top of the flight, and the car is level again at the landing
  assert.ok(flying(0.5, 1).roll > 0.15 && flying(0.5, -1).roll < -0.15, 'rolls away from the side that was hit');
  assert.ok(Math.abs(flying(0.5, 1).roll) <= FLIGHT_ATTITUDE.roll + 1e-9 && Math.abs(flying(1, 1).roll) < 0.01 && Math.abs(flying(0, 1).roll) < 0.01);
  assert.equal(flying(0.5, 0).roll, 0, 'no roll when thrown by a board');
  assert.equal(flying(0.5).squash, 1, 'no squash in the air');
  // landing: flattened for an instant, more after a hard landing, then back to its shape
  const landed = (t, hard) => flightAttitude({ state: hard ? CAR_STATE.WRECKED : CAR_STATE.SPIN, clock: 20 + t, landClock: 20, landHard: hard }, out);
  assert.ok(Math.abs(landed(0, true).squash - (1 - FLIGHT_ATTITUDE.squashHard)) < 1e-9); assert.ok(Math.abs(landed(0, false).squash - (1 - FLIGHT_ATTITUDE.squashLight)) < 1e-9);
  assert.ok(landed(FLIGHT_ATTITUDE.squashTime / 2, true).squash > landed(0, true).squash && landed(FLIGHT_ATTITUDE.squashTime / 2, true).squash < 1);
  const after = landed(FLIGHT_ATTITUDE.squashTime + 0.01, true);
  assert.equal(after.squash, 1); assert.equal(after.pitch, 0); assert.equal(after.roll, 0);
  // a car that is simply racing is drawn as usual
  const racing = flightAttitude({ state: CAR_STATE.RACING, clock: 50, landClock: -10 }, out);
  assert.equal(racing.pitch, 0); assert.equal(racing.roll, 0); assert.equal(racing.squash, 1);
});

test('explosion: four phases in order, 1.25 s of fire, plumes until 1.6 s', () => {
  assert.ok(0 < BLAST.grow && BLAST.grow < BLAST.full && BLAST.full < BLAST.dark && BLAST.dark < BLAST.smokeEnd);
  assert.ok(Math.abs(BLAST.smokeEnd - 1.25) < 0.15, 'fire and smoke last about 1.25 s');
  assert.ok(BLAST.plumeStart < BLAST.smokeEnd && Math.abs(BLAST.end - BLAST.plumeStart - 0.6) < 0.05);
});
