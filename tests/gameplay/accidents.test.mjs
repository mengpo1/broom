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

test('E3 flight: the car comes down behind the car it rode over, which drives away ahead', () => {
  // report: after the flight "the two cars reappear just ahead, seen from close"
  const { a, b, log } = scenarioE3(1.2);
  const launch = stateAt(log, 'a', 'launch'), landing = stateAt(log, 'a', 'landing');
  const length = a.params.halfLength + b.params.halfLength;
  const ahead = (f) => { let ds = f.b.s - f.a.s; if (ds > track.length / 2) ds -= track.length; else if (ds < -track.length / 2) ds += track.length; return ds; };
  for (let i = launch.e.frame + 1; i <= landing.e.frame; i++) {
    const f = log.frames[i];
    assert.ok(ahead(f) > length - 0.3, `in flight the car stays behind the one it hit (${ahead(f).toFixed(2)} m at ${f.time.toFixed(2)} s)`);
  }
  const gapAtLanding = ahead(log.frames[landing.e.frame]);
  assert.ok(gapAtLanding > length - 0.3 && gapAtLanding < length + 3, `lands just behind it (${gapAtLanding.toFixed(2)} m between centres)`);
  const later = log.frames.at(-1);
  assert.ok(ahead(later) > gapAtLanding + 5, 'the car ahead drives away');
  assert.equal(later.b.state, CAR_STATE.RACING);
  // its own speed goes on falling as measured (50 km/h per second), whatever the pace of the car ahead
  const lost = (launch.frame.speed - log.frames[landing.e.frame - 1].a.speed) * KMH / (landing.e.time - launch.e.time);
  assert.ok(Math.abs(lost - 50) < 4, `${lost.toFixed(1)} km/h per second lost in flight`);
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

// (Changed with the recoverable hop. This test used to say "no flight" for every case below the
// thresholds of the accident. One of its cases, wheel over wheel at 170 km/h onto a car doing
// 100 km/h, now sits in the new intermediate level and gives a hop: the test states the three
// levels instead. The cases and the thresholds of the accident itself are unchanged.)
test('launch conditions are explicit: three levels by energy, and no flight outside the overlap window', () => {
  const cases = [
    { name: 'in line (full overlap)', lateral: 0, speedA: 262, speedB: 190, outcome: 'none' },
    { name: 'too slow for the accident: a hop', lateral: 0.93, speedA: 170, speedB: 100, outcome: 'hop' },
    { name: 'low closing speed', lateral: 0.93, speedA: 262, speedB: 240, outcome: 'none' },
    { name: 'too slow even for a hop', lateral: 0.93, speedA: 95, speedB: 45, outcome: 'none' },
    { name: 'wheel over wheel, fast', lateral: 0.93, speedA: 262, speedB: 190, outcome: 'accident' },
    { name: 'wheel over wheel, other side', lateral: -0.93, speedA: 262, speedB: 190, outcome: 'accident' },
  ];
  for (const c of cases) {
    const { race, a } = twoCars(track, { gap: 2, lateral: c.lateral, speedA: c.speedA / KMH, speedB: c.speedB / KMH, straight: 700 });
    const log = run(race, 0.7, { throttleA: 1, throttleB: 0.8 });
    const launched = log.events.some((e) => e.type === 'launch'), hop = log.events.some((e) => e.type === 'hop');
    assert.equal(launched, c.outcome !== 'none', c.name);
    assert.equal(hop, c.outcome === 'hop', `${c.name}: hop`);
    if (c.outcome === 'accident') assert.equal(a.airKind, 1, `${c.name}: hard landing ahead`);
  }
  assert.ok(T.launchMinSpeed * KMH > 146 && T.launchClosingSpeed > 0, 'thresholds stay above the speeds of the bumps of E4');
  assert.ok(T.hopClosingSpeed * KMH > 30, 'and the hop needs more closing speed than the wheel contact of E2 (about 25 km/h)');
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
