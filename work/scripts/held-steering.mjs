// A steering direction held for several seconds: what the car does, step by step, with the validated
// steering (variant a) and with the experimental two-phase variants (b1, b2, b3; see
// src/vehicles/steering-variants.js). Reproducible: pure simulation at 120 Hz, a constant request of
// full lock from a given instant (what a held key gives), the same manoeuvre for every variant
// (HeldSteeringRun, src/core/steering-bench.js: the one the steering bench plays as a demonstration).
// Two families of scenarios:
//   - open asphalt, straight ahead at 100, 150, 200 and 250 km/h, then full lock for 4 s;
//   - the six bends of the steering bench (banc-direction, radii of about 70 to 260 m, both
//     directions), entered at 85 %, 100 % and 115 % of the speed the grip allows in that bend (never
//     above 300 km/h: the two widest bends are flat out and are entered at 300 km/h only), full
//     lock for 3 s from the entry of the bend, the throttle frozen where it held the speed. The
//     track is a copy of the bench widened to 90 m, so that the car stays on asphalt and the figures
//     are those of the steering alone; they are also read against the 14 m of the real bench (the
//     instant at which the car would have left the road, and on which side).
// Recorded 60 times a second (rows in the order of `columns`): time since the key, request, steering position, hold time, progress
// of phase 2, lock applied (multiple of the reference full lock), wheel angle, yaw rate, speed,
// lateral acceleration, grip available, grip asked for (share), tyre slip, slide angle, lateral
// position, state. The run stops at the edge of the widened asphalt. All of this with the arcade
// driving profile (the one of the bench); one line per variant is added for the two other profiles.
// node work/scripts/held-steering.mjs [out.json]
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { STEERING_VARIANTS } from '../../src/vehicles/steering-variants.js';
import { HeldSteeringRun, trackBends, demoManoeuvre, BENCH_CIRCUIT } from '../../src/core/steering-bench.js';
import { straightStretch } from '../../tests/gameplay/collision-helpers.mjs';

const out = process.argv[2] || 'work/benchmarks/held-steering.json';
const VARIANTS = Object.keys(STEERING_VARIANTS);
const ROAD_HALF_WIDTH = 7;                    // of the real bench
const COLUMNS = ['t', 'request', 'steer', 'hold', 'phase2', 'applied', 'wheelDeg', 'yawDegS', 'kmh', 'latG', 'gripG', 'askedShare', 'slip', 'slideDeg', 'd', 'state'];

function makeRace(track, variant, rules = 'arcade') {
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
  const race = new Race({ track, laps: 3, entries, rules: RULE_PRESETS[rules], difficulty: 'amateur', seed: 5, steering: variant });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const car = race.playerCars[0], other = race.cars.find((c) => !c.isHuman);
  placeCar(other, track, track.length * 0.97, 0); other.state = CAR_STATE.RACING; other.isHuman = true; other.inThrottle = 0; other.inBrake = 1;   // parked far away
  return { race, car };
}

/** One run of the manoeuvre, up to a second after the key is released (or the edge of the asphalt). */
function hold(track, variant, manoeuvre, rules = 'arcade') {
  const { race, car } = makeRace(track, variant, rules);
  const run = new HeldSteeringRun(race, car, { ...manoeuvre, roadHalfWidth: ROAD_HALF_WIDTH });
  for (let step = 0; step < 4000 && !run.done; step++) {
    run.beforeStep();
    if (run.done) break;
    race.step(SIM_DT); race.eventCount = 0;
    if (Math.abs(car.d) > track.halfWidth - 1.5) { run.marks.reachesTheEdgeOfTheWidenedAsphalt = +run.time.toFixed(3); break; }
  }
  return { marks: run.marks, summary: run.summary(), samples: run.samples.map((row) => COLUMNS.map((c) => row[c])) };
}

const report = { note: 'variant a is the validated driving; b1, b2, b3 are experimental', variants: STEERING_VARIANTS, sampleRateHz: 60, columns: COLUMNS, openAsphalt: [], bends: [] };

// ---- open asphalt
const wide = buildTrack({ ...getCircuit('kestrel-fields'), width: 900 });
const sOpen = straightStretch(wide, 600) + 60;
for (const kmh of [100, 150, 200, 250]) {
  const row = { kmh, seconds: 4, throttle: 'frozen where it held the speed', runs: {} };
  for (const v of VARIANTS) row.runs[v] = hold(wide, v, { s0: sOpen, kmh, lead: 30, side: 1, seconds: 4 });
  report.openAsphalt.push(row);
}

// ---- the other driving profiles (the figures above and below are those of the arcade profile, the one of the bench)
report.otherProfiles = [];
for (const rules of ['racing', 'turbo']) {
  const row = { rules, kmh: 200, seconds: 4, runs: {} };
  for (const v of VARIANTS) { const r = hold(wide, v, { s0: sOpen, kmh: 200, lead: 30, side: 1, seconds: 4 }, rules); row.runs[v] = { marks: r.marks, summary: r.summary }; }
  report.otherProfiles.push(row);
}

// ---- the bends of the bench
const bench = buildTrack({ ...getCircuit(BENCH_CIRCUIT), width: 90 });
const params = makeRace(bench, 'a').car.params;
const bends = trackBends(bench);
for (const number of [1, 4, 2, 5, 3, 6]) {
  let last = 0;
  for (const share of [0.85, 1, 1.15]) {
    const m = demoManoeuvre(bench, params, { bend: number, share, seconds: 3 });
    if (m.kmh < last * 1.02) continue;                                             // (capped at 300 km/h: the same run again)
    last = m.kmh;
    const row = { bend: number, radiusM: +m.bend.radius.toFixed(1), turnsDeg: +m.bend.turnDeg.toFixed(1), direction: m.side > 0 ? 'right' : 'left', limitKmh: +m.limitKmh.toFixed(1), entryShareOfLimit: +(m.kmh / m.limitKmh).toFixed(2), kmh: +m.kmh.toFixed(1), seconds: 3, runs: {} };
    for (const v of VARIANTS) row.runs[v] = hold(bench, v, m);
    report.bends.push(row);
  }
}
report.benchBends = bends.map((b) => ({ number: b.number, fromM: +b.sFrom.toFixed(0), toM: +b.sTo.toFixed(0), radiusM: +b.radius.toFixed(1), direction: b.side > 0 ? 'right' : 'left', turnsDeg: +b.turnDeg.toFixed(1) }));
writeFileSync(out, JSON.stringify(report));

// ---- tables
const dash = (v) => (v === undefined ? '-' : v);
const line = (v, r) => `    ${v.padEnd(2)} stop ${dash(r.marks.steeringAtItsStop)} s | yaw ${r.summary.yawAtHalfSecond} deg/s at 0.5 s, most ${r.summary.largestYaw} | phase 2 ${dash(r.marks.phase2Starts)}..${dash(r.marks.phase2Complete)} s | lock x${r.summary.largestApplied}, asks ${r.summary.largestAskedShare} x grip | slip ${r.summary.largestSlip}, slide ${r.summary.largestSlideDeg} deg | squeal ${dash(r.marks.tyresSqueal)} marks ${dash(r.marks.tyreMarks)} smoke ${dash(r.marks.tyreSmoke)} | ${r.summary.kmhAtStart} -> ${r.summary.kmhAtEnd} km/h | tightest ${r.summary.tightestRadiusM} m, turned ${r.summary.headingTurnedDeg} deg${r.marks.spin !== undefined ? ` | SPIN ${r.marks.spin} s` : ''}${r.marks.leavesTheRoad !== undefined ? ` | off a 14 m road ${r.marks.leavesTheRoad} s (${r.marks.leftOn})` : ''}`;
console.log('Open asphalt, full lock for 4 s');
for (const row of report.openAsphalt) { console.log(`  ${row.kmh} km/h`); for (const v of VARIANTS) console.log(line(v, row.runs[v])); }
console.log('Other driving profiles, open asphalt, 200 km/h, full lock for 4 s');
for (const row of report.otherProfiles) { console.log(`  ${row.rules}`); for (const v of VARIANTS) console.log(line(v, row.runs[v])); }
console.log('Bends of the bench, full lock for 3 s from the entry of the bend');
for (const row of report.bends) { console.log(`  bend ${row.bend} (${row.direction}, radius ${row.radiusM} m, ${row.turnsDeg} deg), entered at ${row.kmh} km/h = ${row.entryShareOfLimit} x the limit (${row.limitKmh} km/h)`); for (const v of VARIANTS) console.log(line(v, row.runs[v])); }
console.log('->', out);
