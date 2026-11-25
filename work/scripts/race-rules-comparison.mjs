// Full races driven by the computer (16 cars), to compare two versions of the contact rules: contacts
// by kind, and for every flight caused by a car where the car came down relative to the one that threw
// it up (ahead of it or not, overlapping it or not). The script only uses what exists in both versions,
// so the same file can be run against an older checkout of the sources:
//   node work/scripts/race-rules-comparison.mjs out.json            (this tree)
//   VIRAGE_SRC=/path/to/other/checkout node work/scripts/race-rules-comparison.mjs out.json
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve(process.env.VIRAGE_SRC || new URL('../..', import.meta.url).pathname, 'src');
const { buildTrack } = await import(`${src}/tracks/track-builder.js`);
const { getCircuit } = await import(`${src}/tracks/track-catalog.js`);
const { Race, RACE_PHASE, SIM_DT } = await import(`${src}/gameplay/race.js`);
const { RULE_PRESETS } = await import(`${src}/gameplay/rules.js`);
const { DRIVERS, PLAYER_DRIVERS } = await import(`${src}/vehicles/liveries.js`);

// (only in the version that has it) the geometric test of a front wheel going into the back of a rear wheel, counted for
// every pair of racing cars whatever the energy: how often the contact itself happens
const wheels = await import(`${src}/physics/wheel-contacts.js`).catch(() => null);
const out = process.argv[2] || 'work/benchmarks/race-rules-comparison.json';
const RACES = [];
for (const circuit of ['hazelbrook', 'kestrel-fields', 'sablon', 'porto-sereno', 'meridian-docks', 'grand-zenith']) for (const seed of [11, 12, 13]) RACES.push({ circuit, seed, rules: 'arcade' });
for (const circuit of ['hazelbrook', 'meridian-docks', 'tannenring']) RACES.push({ circuit, seed: 11, rules: 'racing' });

function overlap(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z; let min = Infinity;
  for (const h of [a.heading, a.heading + Math.PI / 2, b.heading, b.heading + Math.PI / 2]) {
    const ax = Math.cos(h), az = Math.sin(h);
    const reach = (c) => c.params.halfLength * Math.abs(ax * Math.cos(c.heading) + az * Math.sin(c.heading)) + c.params.halfWidth * Math.abs(-ax * Math.sin(c.heading) + az * Math.cos(c.heading));
    const o = reach(a) + reach(b) - Math.abs(dx * ax + dz * az);
    if (o <= 0) return 0;
    min = Math.min(min, o);
  }
  return min;
}

const results = [];
for (const r of RACES) {
  const track = buildTrack(getCircuit(r.circuit));
  const entries = DRIVERS.slice(0, 15).map((driver) => ({ driver }));
  entries.push({ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0, autoDrive: true });
  const race = new Race({ track, laps: 3, entries, rules: RULE_PRESETS[r.rules], difficulty: 'pro', seed: r.seed });
  const counts = {}, flights = [];
  const flying = new Map();           // car index -> { hop, other, t }
  let steps = 0;
  const strikes = { any: 0, closing36: 0, closing57: 0 }, struck = new Map();
  while (race.phase !== RACE_PHASE.FINISHED && steps < 120 * 60 * 20) {
    race.step(SIM_DT); steps++;
    if (wheels) {
      const cars = race.cars;
      for (let i = 0; i < cars.length; i++) for (let j = 0; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        if (i === j || a.state !== 1 || b.state !== 1 || a.inPit || b.inPit || a.ghostTimer > 0 || b.ghostTimer > 0) continue;
        if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 > 30 || Math.cos(a.heading - b.heading) < 0.94) continue;
        if (!wheels.wheelStrike(a, b, 0.04)) continue;
        const key = i * 100 + j;
        if (race.time - (struck.get(key) ?? -10) < 1) continue;      // one count per meeting of two cars
        struck.set(key, race.time);
        const closing = (a.speed - b.speed) * 3.6;
        strikes.any++; if (closing >= 36) strikes.closing36++; if (closing >= 57) strikes.closing57++;
      }
    }
    for (let e = 0; e < race.eventCount; e++) {
      const ev = race.events[e];
      counts[ev.type] = (counts[ev.type] || 0) + 1;
      if (ev.type === 'launch' && ev.other >= 0 && !flying.has(ev.car)) flying.set(ev.car, { hop: false, other: ev.other, t: race.time, closingKmh: +((race.cars[ev.car].speed - race.cars[ev.other].speed) * 3.6).toFixed(0) });
      if (ev.type === 'hop' && flying.has(ev.car)) flying.get(ev.car).hop = true;
      if (ev.type === 'landing' && flying.has(ev.car)) {
        const f = flying.get(ev.car), a = race.cars[ev.car], b = race.cars[f.other];
        const fx = Math.cos(b.heading), fz = Math.sin(b.heading);
        const ahead = (a.x - b.x) * fx + (a.z - b.z) * fz, side = -(a.x - b.x) * fz + (a.z - b.z) * fx, length = a.params.halfLength + b.params.halfLength;
        flights.push({ kind: f.hop ? 'hop' : 'accident', closingKmh: f.closingKmh, seconds: +(race.time - f.t).toFixed(3), aheadOfItsNoseM: +(ahead - length).toFixed(2), sideM: +side.toFixed(2), overlapM: +overlap(a, b).toFixed(2), landedAhead: ahead >= length });
        flying.delete(ev.car);
      }
    }
    race.eventCount = 0;
  }
  const table = race.classification(), best = Math.min(...race.cars.map((c) => c.bestLapTime || 1e9));
  results.push({ ...r, finished: race.phase === RACE_PHASE.FINISHED, raceTime: +race.time.toFixed(2), winnerTime: +(+table[0].time).toFixed(2), bestLap: +best.toFixed(3),
    finishers: race.cars.filter((c) => c.finished).length, resets: race.cars.reduce((n, c) => n + c.resets, 0), retired: race.cars.filter((c) => c.state === 5).length,
    contact: counts.contact || 0, bump: counts.bump || 0, wheel: counts.wheel || 0, obstacle: counts.obstacle || 0, launch: counts.launch || 0, hop: counts.hop || 0, crash: counts.crash || 0, wall: counts.wall || 0, wheelStrikes: wheels ? strikes : null, flights });
  const last = results.at(-1);
  console.log(`${r.circuit.padEnd(15)} seed ${r.seed} ${r.rules.padEnd(6)}: winner ${last.winnerTime} s, best lap ${last.bestLap}, finishers ${last.finishers}, resets ${last.resets}; contacts ${last.contact}, bumps ${last.bump}, rubs ${last.wheel}, boards ${last.obstacle}, flights by a car ${last.flights.length} (hops ${last.flights.filter((f) => f.kind === 'hop').length}), landed ahead ${last.flights.filter((f) => f.landedAhead).length}, overlapping at the landing ${last.flights.filter((f) => f.overlapM > 0).length}`);
}
const all = results.flatMap((r) => r.flights);
const summary = { races: results.length, bumps: results.reduce((n, r) => n + r.bump, 0), rubs: results.reduce((n, r) => n + r.wheel, 0), contacts: results.reduce((n, r) => n + r.contact, 0), boards: results.reduce((n, r) => n + r.obstacle, 0),
  hops: all.filter((f) => f.kind === 'hop').length, accidents: all.filter((f) => f.kind === 'accident').length, landedAhead: all.filter((f) => f.landedAhead).length, overlappingAtTheLanding: all.filter((f) => f.overlapM > 0).length,
  wheelStrikes: wheels ? { any: results.reduce((n, r) => n + r.wheelStrikes.any, 0), closingOver36: results.reduce((n, r) => n + r.wheelStrikes.closing36, 0), closingOver57: results.reduce((n, r) => n + r.wheelStrikes.closing57, 0) } : null,
  resets: results.reduce((n, r) => n + r.resets, 0), finishers: results.reduce((n, r) => n + r.finishers, 0), wall: results.reduce((n, r) => n + r.wall, 0), totalWinnerTime: +results.reduce((n, r) => n + r.winnerTime, 0).toFixed(2) };
console.log(JSON.stringify(summary));
writeFileSync(out, JSON.stringify({ source: src, summary, results }, null, 1));
