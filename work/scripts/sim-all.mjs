// Runs a short AI race on every circuit and prints robustness metrics.
import { CIRCUITS } from '../../src/tracks/track-catalog.js';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { DRIVERS } from '../../src/vehicles/liveries.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
const [laps = '2', difficulty = 'expert', rules = 'racing'] = process.argv.slice(2);
const fmt = (t) => (t ? `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}` : '--');
for (const def of CIRCUITS) {
  const track = buildTrack(def);
  const race = new Race({ track, laps: +laps, entries: DRIVERS.map((driver) => ({ driver })), rules: RULE_PRESETS[rules], difficulty, seed: 11 });
  let steps = 0; const counts = {};
  while (race.phase !== RACE_PHASE.FINISHED && steps < 120 * 60 * 20) {
    race.step(SIM_DT); steps++;
    for (let i = 0; i < race.eventCount; i++) counts[race.events[i].type] = (counts[race.events[i].type] || 0) + 1;
    race.eventCount = 0;
  }
  const cars = race.cars;
  const sum = (f) => cars.reduce((a, c) => a + f(c), 0);
  const best = Math.min(...cars.map((c) => c.bestLapTime || 1e9));
  const worst = Math.max(...cars.map((c) => c.bestLapTime || 0));
  console.log(`${def.id.padEnd(15)} best ${fmt(best)} worst ${fmt(worst)} avg ${(track.length / best * 3.6).toFixed(0)} km/h top ${(Math.max(...cars.map((c) => c.topSpeed)) * 3.6).toFixed(0)} | walls ${sum((c) => c.wallHits)} contacts ${counts.contact || 0} crashes ${counts.crash || 0} resets ${sum((c) => c.resets)} off ${sum((c) => c.offTrackTime).toFixed(0)}s overtakes ${counts.overtake || 0} finished ${cars.filter((c) => c.finished).length}/18 ${race.phase}`);
}
