// How often does a recoverable hop happen in a full race, and in which conditions?
// Complete computer-driven races (16 cars, 3 laps; the player's car is driven by the computer too),
// the same circuits, rules and seeds from one run to the next, so that two versions of the contact
// rules can be compared. For every hop: the energy of the contact (closing speed, speed of the car
// behind), its geometry (sideways offset, share of the car width overlapped, how much of the front
// tyre of the car behind stands behind the rear tyre of the car ahead, distance between the two
// axles), whether it stands alone or belongs to a series (the same car hopping again within ten
// seconds), and what follows the landing (a new contact of the same two cars within five seconds).
// node work/scripts/hop-frequency.mjs <out.json> [--circuits a,b,...] [--rules arcade,racing] [--seeds 11,23] [--laps 3] [--set key=value,...]
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { CIRCUITS, getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { COLLISION_TUNING } from '../../src/physics/collision-tuning.js';
import { CAR_DIMENSIONS as D } from '../../src/art/vehicles/car-model.js';

const option = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'work/benchmarks/hop-frequency.json';
const circuits = option('circuits', CIRCUITS.map((c) => c.id).join(',')).split(',');
const rulesList = option('rules', 'arcade,racing').split(','), seeds = option('seeds', '11').split(',').map(Number), laps = +option('laps', 3);
for (const pair of option('set', '').split(',').filter(Boolean)) { const [k, v] = pair.split('='); if (!(k in COLLISION_TUNING)) throw new Error(`unknown tuning ${k}`); COLLISION_TUNING[k] = +v; }
const KMH = 3.6, r1 = (v) => +v.toFixed(1), r2 = (v) => +v.toFixed(2);
const SERIES_WINDOW = 10, AFTER_WINDOW = 5;

/**
 * Geometry of the car behind (f) relative to the car ahead (l), in the frame of the car ahead:
 * where the front wheel of f nearest to l stands relative to the rear wheel of l on that side.
 * tyreOverlap: share of the width of that front tyre that is in line with the rear tyre;
 * axleGap: how far behind the rear axle of l that front wheel is (m; under the sum of the two tyre
 * radii, 0.655 m, the tyres are side by side rather than one behind the other).
 * (Computed here from the dimensions of the car model, independently of the rules of the game.)
 */
function geometry(f, l) {
  const cl = Math.cos(l.heading), sl = Math.sin(l.heading), cf = Math.cos(f.heading), sf = Math.sin(f.heading);
  const dx = f.x - l.x, dz = f.z - l.z;
  const behind = -(dx * cl + dz * sl), lateral = -dx * sl + dz * cl, side = lateral >= 0 ? 1 : -1;
  const body = Math.max(0, Math.min(1, (f.params.halfWidth + l.params.halfWidth - Math.abs(lateral)) / (2 * Math.min(f.params.halfWidth, l.params.halfWidth))));
  const px = f.x + cf * D.frontAxleX + sf * side * D.frontTrack - l.x, pz = f.z + sf * D.frontAxleX - cf * side * D.frontTrack - l.z;
  const xw = px * cl + pz * sl, yw = (-px * sl + pz * cl) * side, yr = D.rearTrack;
  const tyre = Math.max(0, Math.min(yw + D.frontTyre.width / 2, yr + D.rearTyre.width / 2) - Math.max(yw - D.frontTyre.width / 2, yr - D.rearTyre.width / 2)) / D.frontTyre.width;
  return { side: r2(Math.abs(lateral)), behind: r2(behind), bodyOverlap: r2(body), tyreOverlap: r2(tyre), axleGap: r2(D.rearAxleX - xw) };
}

function runRace(circuit, rulesName, seed) {
  const track = buildTrack(getCircuit(circuit));
  const entries = DRIVERS.slice(0, 15).map((driver) => ({ driver }));
  entries.push({ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0, autoDrive: true });
  const race = new Race({ track, laps, entries, rules: rulesName === 'racing' ? RULE_PRESETS.racing : RULE_PRESETS.arcade, difficulty: 'pro', seed });
  const cars = race.cars, before = cars.map(() => ({ speed: 0 }));
  const hops = [], counts = {}, contacts = [];
  let steps = 0, carLaunches = 0;                 // launches over another car (a hop is one of them)
  while (race.phase !== RACE_PHASE.FINISHED && steps < 120 * 60 * 20) {
    for (let i = 0; i < cars.length; i++) before[i].speed = cars[i].speed;
    race.step(SIM_DT); steps++;
    for (let e = 0; e < race.eventCount; e++) {
      const ev = race.events[e];
      counts[ev.type] = (counts[ev.type] || 0) + 1;
      if (ev.type === 'launch' && ev.other >= 0) carLaunches++;
      if (['bump', 'wheel', 'hop', 'crash'].includes(ev.type) || (ev.type === 'launch' && ev.other >= 0)) contacts.push({ t: race.time, type: ev.type, car: ev.car, other: ev.other });
      if (ev.type === 'hop') {
        const f = cars[ev.car], l = cars[ev.other];
        hops.push({ t: r2(race.time), car: ev.car, other: ev.other, player: !!f.isHuman, speed: r1(before[ev.car].speed * KMH), closing: r1((before[ev.car].speed - before[ev.other].speed) * KMH), ...geometry(f, l) });
      }
      if (ev.type === 'landing' && ev.value === 2) { const h = hops.findLast((x) => x.car === ev.car && x.landed === undefined); if (h) h.landed = r2(race.time); }
    }
    race.eventCount = 0;
  }
  for (const h of hops) {
    // a series: the same car hops again within the window (before or after)
    h.inSeries = hops.some((o) => o !== h && o.car === h.car && Math.abs(o.t - h.t) <= SERIES_WINDOW);
    // what follows the landing: the next contact of the same two cars within the window
    const end = h.landed ?? h.t + COLLISION_TUNING.hopFlightTime;
    const next = contacts.find((c) => c.t > end && c.t <= end + AFTER_WINDOW && ((c.car === h.car && c.other === h.other) || (c.car === h.other && c.other === h.car)));
    h.after = next ? { type: next.type, seconds: r2(next.t - end) } : null;
  }
  const table = race.classification();
  const best = Math.min(...cars.map((c) => c.bestLapTime || 1e9));
  return { circuit, rules: rulesName, seed, laps, raceTime: r2(race.time), winnerTime: +(table[0].time ?? race.time).toFixed(2), bestLap: +best.toFixed(3),
    counts: { bump: counts.bump || 0, wheel: counts.wheel || 0, hop: counts.hop || 0, hardLaunch: carLaunches - (counts.hop || 0), crash: counts.crash || 0, obstacle: counts.obstacle || 0, wall: counts.wall || 0, reset: counts.reset || 0 },
    hops };
}

const races = [];
for (const rulesName of rulesList) for (const seed of seeds) for (const circuit of circuits) {
  const r = runRace(circuit, rulesName, seed);
  races.push(r);
  console.log(`${circuit.padEnd(16)} ${rulesName.padEnd(7)} seed ${seed}: ${String(r.counts.hop).padStart(2)} hops (${r.hops.filter((h) => !h.inSeries).length} alone, ${r.hops.filter((h) => h.inSeries).length} in series, ${r.hops.filter((h) => h.after).length} followed by a new contact of the same two cars), bumps ${r.counts.bump}, wheel ${r.counts.wheel}, hard launches ${r.counts.hardLaunch}, winner ${r.winnerTime} s`);
}
const all = races.flatMap((r) => r.hops);
const share = (list, test) => (list.length ? r2(list.filter(test).length / list.length) : 0);
const summary = {
  races: races.length, carsPerRace: 16, laps,
  hops: all.length, hopsPerRace: r2(all.length / races.length), racesWithoutHop: races.filter((r) => !r.counts.hop).length, mostInOneRace: Math.max(0, ...races.map((r) => r.counts.hop)),
  alone: all.filter((h) => !h.inSeries).length, inSeries: all.filter((h) => h.inSeries).length,
  followedByContactOfTheSameCars: all.filter((h) => h.after).length,
  followedBy: Object.fromEntries(['bump', 'wheel', 'hop', 'launch', 'crash'].map((t) => [t, all.filter((h) => h.after && h.after.type === t).length])),
  playerCar: all.filter((h) => h.player).length,
  // geometry and energy of the hops
  tyreBehindTyre: { atLeastHalf: share(all, (h) => h.tyreOverlap >= 0.5), none: share(all, (h) => h.tyreOverlap === 0) },
  frontAxleBehindRearAxleByATyre: share(all, (h) => h.axleGap >= D.frontTyre.radius + D.rearTyre.radius),
  bodyOverlap: { under20: share(all, (h) => h.bodyOverlap < 0.2), from20to50: share(all, (h) => h.bodyOverlap >= 0.2 && h.bodyOverlap < 0.5), from50to80: share(all, (h) => h.bodyOverlap >= 0.5) },
  fromTheSide: share(all, (h) => h.behind < 4.15),                     // (nose to tail, the two centres are 4.2 m apart)
  closingKmh: { under45: share(all, (h) => h.closing < 45), from45to54: share(all, (h) => h.closing >= 45 && h.closing < 54), over54: share(all, (h) => h.closing >= 54) },
  speedKmh: { under150: share(all, (h) => h.speed < 150), from150to180: share(all, (h) => h.speed >= 150 && h.speed < 180), over180: share(all, (h) => h.speed >= 180) },
  totals: Object.fromEntries(['bump', 'wheel', 'hop', 'hardLaunch', 'crash', 'obstacle', 'wall', 'reset'].map((k) => [k, races.reduce((n, r) => n + r.counts[k], 0)])),
};
writeFileSync(out, JSON.stringify({ tuning: Object.fromEntries(Object.entries(COLLISION_TUNING).filter(([k]) => k.startsWith('hop') || k.startsWith('launch'))), seriesWindowSeconds: SERIES_WINDOW, afterWindowSeconds: AFTER_WINDOW, summary, races }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log('->', out);
