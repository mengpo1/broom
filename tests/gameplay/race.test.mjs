// Race engine: start procedure, laps, classification, timing, finish, determinism; a complete
// race runs automatically.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS, pointsForPosition } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { CAR_STATE } from '../../src/physics/car-physics.js';

const track = buildTrack(getCircuit('hazelbrook'));
function makeRace(over = {}) {
  const entries = DRIVERS.slice(0, over.count ?? 12).map((driver) => ({ driver }));
  if (over.human) entries.push({ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0, autoDrive: true });
  return new Race({ track, laps: over.laps ?? 2, entries, rules: RULE_PRESETS[over.rules || 'racing'], difficulty: over.difficulty || 'pro', seed: over.seed ?? 7 });
}
function runToEnd(race, maxSeconds = 1500) {
  const counts = {};
  let steps = 0;
  while (race.phase !== RACE_PHASE.FINISHED && steps < maxSeconds / SIM_DT) {
    race.step(SIM_DT); steps++;
    for (let i = 0; i < race.eventCount; i++) counts[race.events[i].type] = (counts[race.events[i].type] || 0) + 1;
    race.eventCount = 0;
  }
  return counts;
}

test('start: cars wait on the grid during the five lights, then are released together', () => {
  const race = makeRace();
  const lights = [];
  let greenAt = -1;
  for (let i = 0; i < 12 / SIM_DT && greenAt < 0; i++) {
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) {
      if (race.events[e].type === 'light') lights.push(race.events[e].value);
      if (race.events[e].type === 'green') greenAt = i * SIM_DT;
    }
    race.eventCount = 0;
    if (greenAt < 0) for (const car of race.cars) { assert.equal(car.state, CAR_STATE.GRID); assert.equal(car.speed, 0); }
  }
  assert.deepEqual(lights, [1, 2, 3, 4, 5]);
  assert.ok(greenAt > 4 && greenAt < 6.5, `lights out after ${greenAt} s`);
  assert.equal(race.phase, RACE_PHASE.RACING);
  for (let i = 0; i < 3 / SIM_DT; i++) race.step(SIM_DT);
  assert.ok(race.cars.every((car) => car.speed > 10), 'every car has left the grid');
  // grid order: two staggered columns, pole in front
  const fresh = makeRace();
  assert.ok(fresh.cars[0].s > fresh.cars[1].s || fresh.cars[0].progress > fresh.cars[1].progress);
  assert.ok(Math.sign(fresh.cars[0].d) !== Math.sign(fresh.cars[1].d));
});

test('a complete race runs automatically: laps, timing, classification and finish are consistent', () => {
  const race = makeRace({ laps: 2, human: true });
  const counts = runToEnd(race);
  assert.equal(race.phase, RACE_PHASE.FINISHED, 'race reached the end');
  const table = race.classification();
  assert.equal(table.length, race.cars.length);
  const leader = race.cars[table[0].carIndex];
  assert.ok(leader.finished && leader.lap === 2);
  assert.ok(counts.lap >= 2 * 2 && counts.finish >= 1 && counts.green === 1 && counts.raceEnd === 1);
  // positions are a permutation 1..n and follow the progress of the cars
  assert.deepEqual(table.map((r) => r.position), table.map((_, i) => i + 1));
  const finishers = table.filter((r) => r.finished);
  for (let i = 1; i < finishers.length; i++) assert.ok(finishers[i].time >= finishers[i - 1].time - 1e-9, 'finishers are ordered by time');
  // timing: lap times add up to the finishing time, best lap is the minimum
  for (const row of finishers) {
    const car = race.cars[row.carIndex];
    assert.equal(car.lapTimes.length, 2);
    assert.ok(Math.abs(car.lapTimes.reduce((a, b) => a + b, 0) - car.finishTime) < 0.02, 'lap times sum to the race time');
    assert.ok(Math.abs(Math.min(...car.lapTimes) - car.bestLapTime) < 1e-9);
    assert.ok(car.bestLapTime > 40 && car.bestLapTime < 90, `plausible lap time ${car.bestLapTime}`);
  }
  assert.equal(pointsForPosition(1), 10); assert.equal(pointsForPosition(6), 1); assert.equal(pointsForPosition(7), 0);
});

test('progress: live positions always match the distance covered', () => {
  const race = makeRace({ laps: 1, count: 10 });
  for (let i = 0; i < 40 / SIM_DT; i++) {
    race.step(SIM_DT); race.eventCount = 0;
    if (i % 600 === 0 && race.phase === RACE_PHASE.RACING) {
      for (let k = 1; k < race.order.length; k++) {
        const a = race.cars[race.order[k - 1]], b = race.cars[race.order[k]];
        assert.ok(race.orderKey(a) >= race.orderKey(b));
        assert.equal(b.position, k + 1);
      }
    }
  }
});

test('same seed, same race; different seed, different race', () => {
  const sig = (seed) => { const race = makeRace({ laps: 1, count: 8, seed }); runToEnd(race); return race.classification().map((r) => `${r.driver.id}:${race.cars[r.carIndex].finishTime.toFixed(6)}`).join('|'); };
  const a = sig(11), b = sig(11), c = sig(12);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('attrition rules: tyres wear and fuel burns in racing mode, not in arcade mode', () => {
  const racing = makeRace({ laps: 1, count: 4, rules: 'racing' }), arcade = makeRace({ laps: 1, count: 4, rules: 'arcade' });
  runToEnd(racing); runToEnd(arcade);
  assert.ok(racing.cars.every((c) => c.tyreWear > 0.01 && c.fuel < 99));
  assert.ok(arcade.cars.every((c) => c.tyreWear === 0 && c.fuel === 100));
});
