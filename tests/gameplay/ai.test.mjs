// Computer drivers: they follow the circuit, brake for corners, overtake, survive contacts and
// finish — with the same simulation as a human car.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit, CIRCUITS } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS } from '../../src/vehicles/liveries.js';

function run(circuit, count, laps, rules = 'racing', difficulty = 'pro', watch = null) {
  const track = buildTrack(getCircuit(circuit));
  const race = new Race({ track, laps, entries: DRIVERS.slice(0, count).map((driver) => ({ driver })), rules: RULE_PRESETS[rules], difficulty, seed: 3 });
  const counts = {};
  let steps = 0;
  while (race.phase !== RACE_PHASE.FINISHED && steps < 1800 / SIM_DT) {
    race.step(SIM_DT); steps++;
    for (let i = 0; i < race.eventCount; i++) counts[race.events[i].type] = (counts[race.events[i].type] || 0) + 1;
    race.eventCount = 0;
    if (watch && steps % 12 === 0) watch(race);
  }
  return { race, counts, track };
}

test('a lone computer driver laps cleanly: stays on the road, no reset, no wall', () => {
  for (const id of ['hazelbrook', 'montclair', 'meridian-docks']) {
    const { race } = run(id, 1, 2, 'training');
    const car = race.cars[0];
    assert.ok(car.finished, `${id}: finished`);
    assert.equal(car.resets, 0, `${id}: resets`);
    assert.equal(car.wallHits, 0, `${id}: wall hits`);
    assert.ok(car.offTrackTime < 1.5, `${id}: off-track ${car.offTrackTime}`);
  }
});

test('braking: corners are taken much slower than the straights, and the brakes are used', () => {
  let minSpeed = 1e9, maxSpeed = 0, braked = 0, samples = 0;
  run('porto-sereno', 1, 2, 'training', 'pro', (race) => {
    const car = race.cars[0];
    if (race.phase !== RACE_PHASE.RACING || car.lap < 1 || car.finished) return;
    samples++;
    minSpeed = Math.min(minSpeed, car.speed); maxSpeed = Math.max(maxSpeed, car.speed);
    if (car.brake > 0.5) braked++;
  });
  assert.ok(maxSpeed > 70, `fast on the straight (${maxSpeed})`);
  assert.ok(minSpeed < maxSpeed * 0.6, `slow in the tightest corner (${minSpeed})`);
  assert.ok(braked / samples > 0.04, 'brakes hard for a noticeable share of the lap');
});

test('traffic: overtakes happen, contacts are survived, the whole field finishes', () => {
  const { race, counts } = run('hazelbrook', 16, 3);
  assert.ok((counts.overtake || 0) >= 10, `overtakes: ${counts.overtake}`);
  const done = race.cars.filter((c) => c.finished || c.lap >= 2).length;
  assert.ok(done >= 14, `${done} cars classified`);
  for (const car of race.cars) {
    assert.ok(Number.isFinite(car.x) && Number.isFinite(car.z) && Number.isFinite(car.speed), 'state stays finite after contacts');
    assert.ok(car.resets <= 2, `resets ${car.resets}`);
  }
  // faster rated drivers should on average finish ahead of slower ones
  const order = race.classification().map((r) => DRIVERS.indexOf(r.driver));
  const front = order.slice(0, 8).reduce((a, b) => a + b, 0) / 8, back = order.slice(8).reduce((a, b) => a + b, 0) / 8;
  assert.ok(front < back, `front half is better rated (${front} vs ${back})`);
});

test('difficulty levels change the pace', () => {
  const lap = (difficulty) => run('hazelbrook', 1, 2, 'training', difficulty).race.cars[0].bestLapTime;
  const novice = lap('novice'), expert = lap('expert');
  assert.ok(expert < novice - 1.5, `expert ${expert} vs novice ${novice}`);
});

test('pit stops: with fast attrition, computer drivers stop for tyres or fuel and rejoin', () => {
  const track = buildTrack(getCircuit('hazelbrook'));
  const race = new Race({ track, laps: 6, entries: DRIVERS.slice(0, 6).map((driver) => ({ driver })), rules: { ...RULE_PRESETS.racing, attrition: 'fast' }, difficulty: 'pro', seed: 5 });
  let steps = 0, stops = 0;
  while (race.phase !== RACE_PHASE.FINISHED && steps < 1500 / SIM_DT) {
    race.step(SIM_DT); steps++;
    for (let i = 0; i < race.eventCount; i++) if (race.events[i].type === 'pitDone') stops++;
    race.eventCount = 0;
  }
  assert.ok(stops >= 3, `pit stops: ${stops}`);
  assert.ok(race.cars.filter((c) => c.finished).length >= 4, 'cars rejoined and finished');
});

test('every circuit of the three seasons can be raced by the computer', () => {
  for (const def of CIRCUITS) {
    const { race } = run(def.id, 6, 1, 'arcade', 'amateur');
    assert.equal(race.phase, RACE_PHASE.FINISHED, `${def.id} finished`);
    assert.ok(race.cars.filter((c) => c.finished).length >= 5, `${def.id}: field finished`);
  }
});
