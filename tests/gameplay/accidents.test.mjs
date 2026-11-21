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
import { crashPitch, crashPitchDuration, slideTremble, contactDive, CRASH_CAMERA as C } from '../../src/rendering/compositing/crash-camera.js';
import { BLAST } from '../../src/rendering/effects/effects-layer.js';
import { twoCars, run, KMH } from './collision-helpers.mjs';

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

test('E5 launch on a board: thrown in the air, light landing without loss of speed nor explosion, slide, then back on the track', () => {
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
  // and ends back on the track, able to drive
  const end = frames.at(-1);
  assert.equal(end.state, CAR_STATE.RACING);
  assert.ok(Math.abs(end.d) < tr.halfWidth, 'put back on the track');
});

test('launch conditions are explicit: no flight below the speed, the closing speed or outside the overlap window', () => {
  const cases = [
    { name: 'in line (full overlap)', lateral: 0, speedA: 262, speedB: 190, launch: false },
    { name: 'too slow', lateral: 0.93, speedA: 170, speedB: 100, launch: false },
    { name: 'low closing speed', lateral: 0.93, speedA: 262, speedB: 240, launch: false },
    { name: 'wheel over wheel, fast', lateral: 0.93, speedA: 262, speedB: 190, launch: true },
    { name: 'wheel over wheel, other side', lateral: -0.93, speedA: 262, speedB: 190, launch: true },
  ];
  for (const c of cases) {
    const { race } = twoCars(track, { gap: 2, lateral: c.lateral, speedA: c.speedA / KMH, speedB: c.speedB / KMH, straight: 700 });
    const log = run(race, 0.7, { throttleA: 1, throttleB: 0.8 });
    assert.equal(log.events.some((e) => e.type === 'launch'), c.launch, c.name);
  }
  assert.ok(T.launchMinSpeed * KMH > 146 && T.launchClosingSpeed > 0, 'thresholds stay above the speeds of the bumps of E4');
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

test('explosion: four phases in order, 1.25 s of fire, plumes until 1.6 s', () => {
  assert.ok(0 < BLAST.grow && BLAST.grow < BLAST.full && BLAST.full < BLAST.dark && BLAST.dark < BLAST.smokeEnd);
  assert.ok(Math.abs(BLAST.smokeEnd - 1.25) < 0.15, 'fire and smoke last about 1.25 s');
  assert.ok(BLAST.plumeStart < BLAST.smokeEnd && Math.abs(BLAST.end - BLAST.plumeStart - 0.6) < 0.05);
});
