// Headless race simulation for tuning: node work/scripts/sim-race.mjs [circuit] [laps] [difficulty] [rules] [cars]
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { DRIVERS } from '../../src/vehicles/liveries.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { estimateLapTime } from '../../src/ai/speed-profile.js';

const [circuit = 'hazelbrook', laps = '3', difficulty = 'pro', rules = 'racing', count = '18'] = process.argv.slice(2);
const track = buildTrack(getCircuit(circuit));
const entries = DRIVERS.slice(0, +count).map((driver) => ({ driver }));
const race = new Race({ track, laps: +laps, entries, rules: RULE_PRESETS[rules], difficulty, seed: 7 });
const counts = {};
const t0 = performance.now();
let steps = 0;
while (race.phase !== RACE_PHASE.FINISHED && steps < 120 * 60 * 30) {
  race.step(SIM_DT); steps++;
  for (let i = 0; i < race.eventCount; i++) { const e = race.events[i]; counts[e.type] = (counts[e.type] || 0) + 1; }
  race.eventCount = 0;
}
const ms = performance.now() - t0;
const fmt = (t) => (t ? `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}` : '--');
console.log(`${track.name} ${track.length.toFixed(0)} m, ${laps} laps, ${difficulty}/${rules}: sim ${(steps * SIM_DT).toFixed(1)} s in ${ms.toFixed(0)} ms (${((steps * SIM_DT * 1000) / ms).toFixed(0)}x realtime)`);
console.log('estimated ideal lap:', fmt(estimateLapTime(track, race.cars[0].params, race.speedProfile, 1)));
for (const row of race.classification()) {
  const car = race.cars[row.carIndex];
  console.log(`${String(row.position).padStart(2)} ${row.driver.name.padEnd(14)} grid ${String(car.gridPosition).padStart(2)} laps ${row.laps} ${row.retired ? 'DNF' : fmt(row.time)}  best ${fmt(row.bestLap)}  top ${(car.topSpeed * 3.6).toFixed(0)} km/h  walls ${car.wallHits} contacts ${car.contacts} resets ${car.resets} off ${car.offTrackTime.toFixed(1)}s pits ${car.pitStops} wear ${(car.tyreWear * 100).toFixed(0)}% fuel ${car.fuel.toFixed(0)}`);
}
console.log(counts);
