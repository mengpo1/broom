// Races in dense packs: 20 cars (the 18 computer drivers and the two player cars left to the computer), two laps
// from a standing start, on every circuit and several draws. For every flight: what threw the car up (a car or a
// roadside board), how many cars were within 30 m at the take-off, the time in the air, how long the landing waited,
// whether the car was put back on the track as a last resort, whether it was set down in another car, and, for a
// flight caused by a car, whether it came down ahead of that car. Simulation only.
// The script only uses what exists in both versions, so that it can be run against an older checkout:
//   node work/scripts/dense-pack-races.mjs [out.json]
//   VIRAGE_SRC=/path/to/other/checkout node work/scripts/dense-pack-races.mjs out.json
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve(process.env.VIRAGE_SRC || new URL('../..', import.meta.url).pathname, 'src');
const { buildTrack } = await import(`${src}/tracks/track-builder.js`);
const { getCircuit, CIRCUITS } = await import(`${src}/tracks/track-catalog.js`);
const { Race, RACE_PHASE, SIM_DT } = await import(`${src}/gameplay/race.js`);
const { RULE_PRESETS } = await import(`${src}/gameplay/rules.js`);
const { DRIVERS, PLAYER_DRIVERS } = await import(`${src}/vehicles/liveries.js`);
const out = process.argv[2] || 'work/benchmarks/dense-pack-races.json';
const AIRBORNE = 6, RESET = 3;

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

const RACES = [];
for (const c of CIRCUITS) for (const seed of [21, 22, 23]) RACES.push({ circuit: c.id, seed, rules: 'arcade', difficulty: seed === 23 ? 'amateur' : 'pro' });
const results = [], flights = [];
for (const r of RACES) {
  const track = buildTrack(getCircuit(r.circuit));
  const entries = DRIVERS.map((driver) => ({ driver }));
  entries.splice(6, 0, { driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0, autoDrive: true });
  entries.splice(13, 0, { driver: PLAYER_DRIVERS[1], human: true, playerIndex: 1, autoDrive: true });
  const race = new Race({ track, laps: 2, entries, rules: RULE_PRESETS[r.rules], difficulty: r.difficulty, seed: r.seed });
  const cars = race.cars, up = new Map(), was = cars.map((c) => c.state), counts = {};
  let steps = 0, closest = 0;
  while (race.phase !== RACE_PHASE.FINISHED && steps < 120 * 60 * 12) {
    for (let i = 0; i < cars.length; i++) was[i] = cars[i].state;
    race.step(SIM_DT); steps++;
    for (let e = 0; e < race.eventCount; e++) counts[race.events[e].type] = (counts[race.events[e].type] || 0) + 1;
    race.eventCount = 0;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (car.state === AIRBORNE && was[i] !== AIRBORNE) {
        const near = cars.filter((o) => o !== car && !o.removed && Math.hypot(o.x - car.x, o.z - car.z) < 30).length;
        up.set(i, { t: race.time, other: car.launchOther, near, planned: car.airPlanned, kind: car.airKind === 2 ? 'hop' : car.launchOther >= 0 ? 'accident' : 'board', resets: car.resets });
        closest = Math.max(closest, near);
      } else if (car.state !== AIRBORNE && was[i] === AIRBORNE && up.has(i)) {
        const f = up.get(i); up.delete(i);
        const seconds = race.time - f.t, putBack = car.resets > f.resets || car.state === RESET;
        let inACar = 0;
        for (const o of cars) if (o !== car && !o.removed && o.state !== AIRBORNE) inACar = Math.max(inACar, overlap(car, o));
        const row = { circuit: r.circuit, seed: r.seed, kind: f.kind, carsWithin30m: f.near, seconds: +seconds.toFixed(3), planned: +f.planned.toFixed(3), waited: +Math.max(0, seconds - f.planned - SIM_DT).toFixed(3), putBack, setDownInACarM: putBack ? 0 : +inACar.toFixed(2) };
        if (f.other >= 0 && !putBack) {
          const b = cars[f.other], fx = Math.cos(b.heading), fz = Math.sin(b.heading);
          const ahead = (car.x - b.x) * fx + (car.z - b.z) * fz - car.params.halfLength - b.params.halfLength;
          row.aheadOfItsNoseM = +ahead.toFixed(2); row.sideM = +(-(car.x - b.x) * fz + (car.z - b.z) * fx).toFixed(2); row.landedAhead = ahead > 0;
        }
        flights.push(row);
      }
    }
  }
  const table = race.classification();
  results.push({ ...r, finished: race.phase === RACE_PHASE.FINISHED, winnerTime: +(+table[0].time).toFixed(2), finishers: cars.filter((c) => c.finished).length, resets: cars.reduce((n, c) => n + c.resets, 0),
    contacts: counts.contact || 0, bumps: counts.bump || 0, rubs: counts.wheel || 0, launches: counts.launch || 0, hops: counts.hop || 0, boards: counts.obstacle || 0, mostCarsAroundAFlight: closest });
  const last = results.at(-1);
  console.log(`${r.circuit.padEnd(15)} seed ${r.seed} ${r.difficulty.padEnd(7)}: winner ${last.winnerTime} s, finishers ${last.finishers}, contacts ${last.contacts}, bumps ${last.bumps}, rubs ${last.rubs}, launches ${last.launches}, resets ${last.resets}`);
}
const sum = (key) => results.reduce((n, r) => n + r[key], 0), byCar = flights.filter((f) => f.kind !== 'board');
const summary = {
  races: results.length, carsPerRace: 20, allFinished: results.every((r) => r.finished), totalWinnerTime: +sum('winnerTime').toFixed(2), finishers: sum('finishers'), contacts: sum('contacts'), bumps: sum('bumps'), rubs: sum('rubs'), resets: sum('resets'),
  flights: flights.length, hops: flights.filter((f) => f.kind === 'hop').length, accidents: flights.filter((f) => f.kind === 'accident').length, onBoards: flights.filter((f) => f.kind === 'board').length,
  landingsThatWaited: flights.filter((f) => f.waited > 0.02).length, longestWait: Math.max(0, ...flights.map((f) => f.waited)), longestFlight: Math.max(0, ...flights.map((f) => f.seconds)),
  putBackAsLastResort: flights.filter((f) => f.putBack).length, setDownInACar: flights.filter((f) => f.setDownInACarM > 0).length,
  causedByACar: byCar.length, ofWhichLandedAhead: byCar.filter((f) => f.landedAhead).length, ofWhichNotAhead: byCar.filter((f) => f.landedAhead === false).length,
};
console.log(JSON.stringify(summary));
writeFileSync(out, JSON.stringify({ source: src, note: '20 cars, 2 laps, standing start; every flight of every race is listed', summary, flights, results }, null, 1));
