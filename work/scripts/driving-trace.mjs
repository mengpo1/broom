// Fingerprint of the default driving: complete traces of races in which a player's car is driven by
// a scripted keyboard (keys held for seconds, both ways, lifting and braking) among computer-driven
// cars, on several circuits and rule sets. Every car, every step: position, heading, speed,
// steering, slide, yaw rate, slip, state. The script takes the source tree to load, so that two
// versions of the game can be compared to the last bit:
//   node work/scripts/driving-trace.mjs [path/to/src]   -> one line per race: steps, SHA-256 of the trace
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const src = resolve(process.argv[2] || 'src');
const load = (file) => import(pathToFileURL(`${src}/${file}`).href);
const { buildTrack } = await load('tracks/track-builder.js');
const { getCircuit } = await load('tracks/track-catalog.js');
const { Race, SIM_DT } = await load('gameplay/race.js');
const { RULE_PRESETS } = await load('gameplay/rules.js');
const { DRIVERS, PLAYER_DRIVERS } = await load('vehicles/liveries.js');

const RACES = [['hazelbrook', 'racing', 3], ['kestrel-fields', 'arcade', 7], ['hazelbrook', 'turbo', 11], ['kestrel-fields', 'training', 5]];
const buffer = new Float64Array(9);
for (const [circuit, rules, seed] of RACES) {
  const track = buildTrack(getCircuit(circuit));
  const entries = [...DRIVERS.slice(0, 7).map((driver) => ({ driver })), { driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }];
  const race = new Race({ track, laps: 2, entries, rules: RULE_PRESETS[rules], difficulty: 'pro', seed });
  const hash = createHash('sha256');
  let steps = 0;
  for (; steps < 75 / SIM_DT; steps++) {
    const t = steps * SIM_DT;
    const steer = t < 5 ? 0 : (Math.floor(t / 1.7) % 4 === 0 ? 0 : Math.floor(t / 3.4) % 2 ? 1 : -1) * (Math.floor(t / 11) % 3 === 2 ? 0.6 : 1);
    race.setPlayerInput(0, steer, t % 8 < 6.5 ? 1 : 0, t % 8 > 7.2 ? 1 : 0, 0, false, t % 30 > 29.9);
    race.step(SIM_DT); race.eventCount = 0;
    for (const c of race.cars) {
      buffer[0] = c.x; buffer[1] = c.z; buffer[2] = c.heading; buffer[3] = c.speed; buffer[4] = c.steer; buffer[5] = c.vLat; buffer[6] = c.yawRate; buffer[7] = c.slip; buffer[8] = c.state;
      hash.update(new Uint8Array(buffer.buffer));
    }
  }
  console.log(`${circuit} ${rules} seed ${seed}: ${steps} steps, ${race.cars.length} cars, ${hash.digest('hex')}`);
}
