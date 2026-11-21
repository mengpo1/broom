// Statistics of a full computer-driven race: contacts by kind, finishing time, laps.
// With --legacy the arcade contact classification is switched off (previous impulse model),
// which gives the baseline for the non-regression report.
// node work/scripts/race-contact-stats.mjs [circuit] [laps] [--legacy] [--racing]
// --racing: competition rules (tyre wear, fuel, damage, failures) instead of arcade rules.
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { COLLISION_TUNING } from '../../src/physics/collision-tuning.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const legacy = process.argv.includes('--legacy'), racing = process.argv.includes('--racing');
if (legacy) { COLLISION_TUNING.alignedCos = 2; COLLISION_TUNING.obstacleSpeedFactor = 1; COLLISION_TUNING.obstacleLaunchSpeed = 1e9; }
export function raceStats(circuit, laps, seed = 11) {
  const track = buildTrack(getCircuit(circuit));
  const entries = DRIVERS.slice(0, 15).map((driver) => ({ driver }));
  entries.push({ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0, autoDrive: true });
  const race = new Race({ track, laps, entries, rules: racing ? RULE_PRESETS.racing : RULE_PRESETS.arcade, difficulty: 'pro', seed });
  const counts = {};
  let steps = 0;
  while (race.phase !== RACE_PHASE.FINISHED && steps < 120 * 60 * 20) {
    race.step(SIM_DT); steps++;
    for (let e = 0; e < race.eventCount; e++) counts[race.events[e].type] = (counts[race.events[e].type] || 0) + 1;
    race.eventCount = 0;
  }
  const table = race.classification();
  const best = Math.min(...race.cars.map((c) => c.bestLapTime || 1e9));
  return { circuit, laps, finished: race.phase === RACE_PHASE.FINISHED, raceTime: +race.time.toFixed(2), winnerTime: +(table[0].time ?? race.time).toFixed?.(2) || null,
    bestLap: +best.toFixed(3), finishers: race.cars.filter((c) => c.finished).length, resets: race.cars.reduce((n, c) => n + c.resets, 0),
    retired: race.cars.filter((c) => c.state === 5).length, damage: +race.cars.reduce((n, c) => n + c.damage, 0).toFixed(2),
    contact: counts.contact || 0, bump: counts.bump || 0, wheel: counts.wheel || 0, obstacle: counts.obstacle || 0, launch: counts.launch || 0, crash: counts.crash || 0, wall: counts.wall || 0 };
}
if (process.argv[1].endsWith('race-contact-stats.mjs')) console.log(JSON.stringify(raceStats(args[0] || 'hazelbrook', +(args[1] || 3))));
