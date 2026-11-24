// Dense packs and flights that cannot come down where they planned to: thousands of packs of cars on a straight, each
// car driven through its controls by a small script drawn at random (holding its speed, braking hard at a random
// moment, changing lane, or doing what it can to stay under a car in flight), and one car arriving on another fast
// enough to be thrown in the air. For every flight: how long the landing waited, whether the car was put back on the
// track as a last resort, whether it was set down in another car, whether a step in the air differed from its velocity.
// Simulation only, deterministic (the draws come from a seeded generator).
//   node work/scripts/flight-wait-stress.mjs [packs] [out.json]
//   VIRAGE_ROOT=/path/to/other/checkout node work/scripts/flight-wait-stress.mjs     (to compare with another version)
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.VIRAGE_ROOT || new URL('../..', import.meta.url).pathname);
const { buildTrack } = await import(`${root}/src/tracks/track-builder.js`);
const { getCircuit } = await import(`${root}/src/tracks/track-catalog.js`);
const { COLLISION_TUNING: T } = await import(`${root}/src/physics/collision-tuning.js`);
const here = new URL('../..', import.meta.url).pathname;
const H = await import(process.env.VIRAGE_ROOT ? `${root}/tests/gameplay/flight-helpers.mjs` : `${here}/tests/gameplay/flight-helpers.mjs`);
const { field, hold, parked, shadow, switching, watchFlights, SIM_DT, CAR_STATE, KMH } = H;

const packs = Number(process.argv[2]) || 2000, out = process.argv[3] || 'work/benchmarks/flight-wait-stress.json';
const track = buildTrack(getCircuit('kestrel-fields')), LENGTH = 4.2;
let seed = 20261124;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (a, b) => a + (b - a) * rnd();

const total = { packs, flights: 0, hops: 0, accidents: 0, waited: 0, putBack: 0, setDownInACar: 0, drivenThroughAfter: 0, touchingAfter: 0, offVelocity: 0, notEnded: 0, stillUpAtTheEnd: 0, longestWait: 0, longestFlight: 0, wreckDrivenThrough: 0, twoInTheAir: 0, landedBehind: 0, fasterThanAtTakeOff: 0, notANumber: 0,
  // how the car in flight behaves while its landing waits (its speed is then chosen by rule)
  waitedAndLostOver30KmhInAStep: 0, largestLossInAStepKmh: 0, waitedAndTookBackOver7Kmh: 0, mostSpeedTakenBackKmh: 0, flewBackwards: 0, furthestBackwardsM: 0, beganToWaitMoreThanTwice: 0, mostTimesALandingBeganToWait: 0 };
const waits = [], worst = [];
const only = process.env.VIRAGE_PACK ? Number(process.env.VIRAGE_PACK) : -1;      // (to look at one pack: its flights step by step)
for (let p = 0; p < packs; p++) {
  const n = 5 + Math.floor(rnd() * 8);                                   // 5 to 12 cars
  const f = field(track, n), [a, b] = f.cars;
  const accident = rnd() < 0.5;
  const kmhB = between(accident ? 150 : 90, accident ? 215 : 190), kmhA = kmhB + between(60, 95), side = rnd() < 0.5 ? 1 : -1, d0 = between(-3, 3);
  const offset = accident ? between(0.5, 1.3) : between(1.88, 2.02);
  f.put(b, 60, d0 + side * offset / 2, kmhB, hold(kmhB, d0 + side * offset / 2));
  f.put(a, 60 - LENGTH - between(2, 5), d0 - side * offset / 2, kmhA, hold(kmhA, d0 - side * offset / 2));
  // the pack: around the two, in lanes 2.2 m apart, each with its own way of driving
  const taken = [[f.along(a), a.d], [f.along(b), b.d]];
  for (let i = 2; i < n; i++) {
    let along, d, tries = 0;
    do { along = 60 + between(-28, 38); d = d0 + pick([-2, -1, 0, 1, 2]) * 2.2 + between(-0.3, 0.3); tries++; }
    while (tries < 40 && taken.some(([s, e]) => Math.abs(s - along) < LENGTH + 1.2 && Math.abs(e - d) < 2.05));
    if (tries >= 40) { f.put(f.cars[i], 60 + 60 + i * 8, d0, kmhB, hold(kmhB, d0)); continue; }
    taken.push([along, d]);
    const kmh = pick([kmhA, kmhA, kmhB, kmhB, between(kmhB, kmhA), kmhA + between(0, 30)]);
    const how = rnd(), cruise = hold(kmh, d);
    const drive = how < 0.3 ? cruise
      : how < 0.5 ? switching(cruise, () => a.state === CAR_STATE.AIRBORNE, parked())                              // brakes to a standstill at the take-off
      : how < 0.62 ? switching(cruise, ((at) => (x) => x.step > at)(Math.floor(between(20, 200))), parked())          // or at any moment
      : how < 0.72 ? switching(cruise, ((at) => (x) => x.step > at)(Math.floor(between(20, 160))), hold(kmh, d + pick([-2.2, 2.2])))   // changes lane
      : shadow(a, cruise, { offset: between(-6, 6), reach: between(4, 16), sideways: rnd() < 0.8 });                 // does what it can to be under the car in flight
    f.put(f.cars[i], along, d, kmh, drive);
  }
  if (only >= 0 && p !== only) continue;
  let twoInTheAir = 0;
  const flights = watchFlights(f, 8, { each: (i) => {
    if (only >= 0) {
      const up = f.cars.filter((x) => x.state === CAR_STATE.AIRBORNE);
      if (up.length && (i % 6 === 0 || f.events.some((e) => e.step === i))) console.log(String(i).padStart(4), up.map((x) => `#${x.index} ${x.airKind === 2 ? 'hop' : 'acc'} t${x.airTime.toFixed(2)}/${x.airDuration.toFixed(2)} h${x.airHeight.toFixed(2)} ${x.airWaiting ? `WAIT${x.airMode > 0 ? '+' : x.airMode < 0 ? '-' : '0'} ${(x.airWaited ?? 0).toFixed(2)}s` : ''} v${(f.alongSpeed(x)).toFixed(1)} at ${f.along(x).toFixed(1)},${f.across(x).toFixed(1)}`).join(' | '), '||', f.cars.filter((o) => o.state !== CAR_STATE.AIRBORNE && up.some((x) => Math.abs(f.along(o) - f.along(x)) < 9 && Math.abs(f.across(o) - f.across(x)) < 2.2)).map((o) => `#${o.index} st${o.state} v${f.alongSpeed(o).toFixed(1)} at ${f.along(o).toFixed(1)},${f.across(o).toFixed(1)}`).join(' '), f.events.filter((e) => e.step === i).map((e) => `${e.type}(${e.car}${e.other >= 0 ? '>' + e.other : ''})`).join(' '));
    }
    for (const x of f.cars) for (const y of f.cars) if (x.index < y.index && x.state === CAR_STATE.AIRBORNE && y.state === CAR_STATE.AIRBORNE) twoInTheAir = Math.max(twoInTheAir, H.bodyOverlap(x, y));
  } });
  if (twoInTheAir > 0) total.twoInTheAir++;
  if (f.cars.some((x) => !Number.isFinite(x.x + x.z + x.speed + x.velX + x.velZ + x.heading))) total.notANumber++;
  for (const fl of flights) {
    total.flights++;
    if (fl.car.airKind === 2) total.hops++; else total.accidents++;
    if (fl.down < 0) { if ((f.step - fl.up) * SIM_DT > 5.5) total.notEnded++; else total.stillUpAtTheEnd++; continue; }   // (a flight that began in the last seconds of the run is not one that did not end)
    if (fl.waited > 0) {
      total.waited++; waits.push(fl.waited);
      if ((fl.speedDrop ?? 0) * KMH > 30) total.waitedAndLostOver30KmhInAStep++;
      total.largestLossInAStepKmh = Math.max(total.largestLossInAStepKmh, Math.round((fl.speedDrop ?? 0) * KMH));
      if ((fl.regained ?? 0) * KMH > 7) total.waitedAndTookBackOver7Kmh++;
      total.mostSpeedTakenBackKmh = Math.max(total.mostSpeedTakenBackKmh, Math.round((fl.regained ?? 0) * KMH));
      if ((fl.backwards ?? 0) > 0.05) total.flewBackwards++;
      total.furthestBackwardsM = Math.max(total.furthestBackwardsM, +(fl.backwards ?? 0).toFixed(1));
      if ((fl.waitStarts ?? 0) > 2) total.beganToWaitMoreThanTwice++;
      total.mostTimesALandingBeganToWait = Math.max(total.mostTimesALandingBeganToWait, fl.waitStarts ?? 0);
    }
    if (fl.putBack) total.putBack++;
    if (fl.overlapAtLanding > 0) total.setDownInACar++;
    // (three cars meeting in the same step can be left a few centimetres in each other for a step, on the ground, flight or
    // no flight: counted apart from a car driven through)
    if (fl.overlapAfter > 0.3) total.drivenThroughAfter++; else if (fl.overlapAfter > 0) total.touchingAfter++;
    if (fl.wreckDrivenThrough > 0) total.wreckDrivenThrough++;
    if (fl.offVelocity > 0.05) total.offVelocity++;
    if (fl.fastest > Math.max(fl.takeOffSpeed, (T.flightYieldSpeed ?? 0)) + 0.01) total.fasterThanAtTakeOff++;
    total.longestWait = Math.max(total.longestWait, fl.waited); total.longestFlight = Math.max(total.longestFlight, fl.seconds);
    if (fl.car === a && !fl.putBack && fl.behindLauncher) total.landedBehind++;                 // (where it was at the step it came down)
    if (fl.waited > 2 || fl.putBack || fl.overlapAtLanding > 0 || fl.overlapAfter > 0.3) worst.push({ pack: p, cars: n, car: fl.car.index, kind: fl.car.airKind === 2 ? 'hop' : 'accident', seconds: +fl.seconds.toFixed(2), waited: +fl.waited.toFixed(2), putBack: fl.putBack, setDownInACar: +fl.overlapAtLanding.toFixed(2), overlappingAfter: +fl.overlapAfter.toFixed(2) });
  }
}
waits.sort((x, y) => x - y);
const share = (q) => (waits.length ? +waits[Math.min(waits.length - 1, Math.floor(q * waits.length))].toFixed(2) : 0);
total.longestWait = +total.longestWait.toFixed(2); total.longestFlight = +total.longestFlight.toFixed(2);
const report = {
  note: 'packs of 5 to 12 cars on a straight, drivers drawn at random (about a quarter of them doing what they can to stay under the car in flight), one car thrown in the air per pack; seeded, simulation only',
  limits: { flightWaitMax: T.flightWaitMax ?? null, flightYieldSpeed: T.flightYieldSpeed ?? null },
  total, waitSeconds: { median: share(0.5), p90: share(0.9), p99: share(0.99), longest: total.longestWait }, toLookAt: worst.slice(0, 40),
};
if (out !== '-') writeFileSync(out, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.total)); console.log('waits', JSON.stringify(report.waitSeconds), 'listed', worst.length);
