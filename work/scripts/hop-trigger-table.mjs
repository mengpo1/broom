// What triggers what (lot 5): the same arrival from behind, at several speeds, for a series of sideways
// offsets between the two cars, and the outcome given by the rules of the game (pure simulation at
// 120 Hz, no pictures; both cars hold their speed). Shows where each contact lies:
//   in line, nose in the gearbox: the cars bump;
//   the nose on a rear wheel (20 to 80 % of the width of the bodies overlapped): bump, or the hard accident
//   when it is fast enough (E3);
//   the front wing against a rear wheel (bodies overlapping by a hand's width): bump;
//   the front wheel in the back of a rear wheel, the bodies apart: the recoverable hop, when it is fast enough
//   to get past; nothing otherwise;
//   further out: nothing is touched.
// For every flight: how long it lasts and where the car comes down relative to the car it flew over.
// node work/scripts/hop-trigger-table.mjs [out.json]
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { LANDING } from '../../src/physics/car-physics.js';
import { WHEEL_LAYOUT as W } from '../../src/physics/wheel-contacts.js';
import { twoCars, run, KMH, holdSpeed, relativeTo } from '../../tests/gameplay/collision-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));
const out = process.argv[2] || 'work/benchmarks/hop-trigger-table.json';
const ARRIVALS = [[170, 150], [200, 150], [205, 150], [208, 150], [215, 150], [230, 150], [262, 188], [175, 110]];
const OFFSETS = [0, 0.3, 0.5, 0.93, 1.3, 1.5, 1.7, 1.8, 1.84, 1.87, 1.9, 1.95, 2.0, 2.03, 2.06, 2.1, 2.3];
const rows = [];
for (const [kmhA, kmhB] of ARRIVALS) {
  for (const lateral of OFFSETS) {
    const { race, a, b } = twoCars(track, { gap: 4, lateral, speedA: kmhA / KMH, speedB: kmhB / KMH, straight: 700 });
    const bodies = a.params.halfWidth + b.params.halfWidth - lateral, tyres = W.frontTrack + W.frontTyre.width / 2 + W.rearTrack + W.rearTyre.width / 2 - lateral;
    const log = run(race, 2.2, { throttleA: holdSpeed(a, kmhA), throttleB: holdSpeed(b, kmhB) });
    const mine = log.events.filter((e) => e.car === a.index);
    const first = mine.find((e) => ['bump', 'launch'].includes(e.type)) || log.events.find((e) => e.type === 'wheel');
    const launch = mine.find((e) => e.type === 'launch'), landing = mine.find((e) => e.type === 'landing');
    let outcome = 'aucun contact';
    if (first && first.type === 'bump') outcome = 'tamponnage';
    else if (first && first.type === 'wheel') outcome = 'frottement roue contre roue';
    else if (launch && landing && landing.value === LANDING.RECOVERABLE) outcome = 'SAUT RECUPERABLE';
    else if (launch && landing && landing.value === LANDING.HARD) outcome = 'ACCIDENT VIOLENT (E3)';
    else if (tyres > 0 && bodies <= 0) outcome = 'pneus qui se croisent, sans effet';
    const row = { speedBehindKmh: kmhA, speedAheadKmh: kmhB, closingKmh: kmhA - kmhB, offsetM: lateral, bodiesOverlapM: +Math.max(0, bodies).toFixed(3), tyresInLineM: +Math.max(0, Math.min(tyres, W.frontTyre.width)).toFixed(3), outcome };
    if (launch && landing) {
      // (frames hold the state after each step; positions are read from the cars at the end of the run for the landing only)
      const at = log.frames[landing.frame], up = log.frames[launch.frame];
      const ahead = ((at.a.s - at.b.s + track.length * 1.5) % track.length) - track.length / 2;
      Object.assign(row, { flightSeconds: +(landing.time - launch.time).toFixed(3), peakHeightM: +Math.max(...log.frames.map((f) => f.a.airHeight)).toFixed(2),
        landsAheadOfTheOtherNoseM: +(ahead - a.params.halfLength - b.params.halfLength).toFixed(2), sideAtLandingM: +Math.abs(at.a.d - at.b.d).toFixed(2),
        speedAtTakeOffKmh: +(up.a.speed * KMH).toFixed(0), speedAtLandingKmh: +(log.frames[landing.frame - 1].a.speed * KMH).toFixed(0), otherCarAtLandingKmh: +(at.b.speed * KMH).toFixed(0) });
    }
    rows.push(row);
    void relativeTo;
  }
}
writeFileSync(out, JSON.stringify({ note: 'both cars hold their speed; offsets in metres between the centre lines of the two cars',
  bodyHalfWidthM: 0.93, tyresOutsideTheBodyM: { front: +(W.frontTrack + W.frontTyre.width / 2 - 0.93).toFixed(3), rear: +(W.rearTrack + W.rearTyre.width / 2 - 0.93).toFixed(3) },
  accident: { overlapOfTheBodies: [T.launchOverlapMin, T.launchOverlapMax], closingKmh: T.launchClosingSpeed * KMH, speedKmh: T.launchMinSpeed * KMH, flightSeconds: [T.flightTimeCar, T.flightTimeCarMax] },
  hop: { tyreInContactMinM: T.hopTyreOverlapMin, closingKmh: T.hopClosingSpeed * KMH, speedKmh: +(T.hopMinSpeed * KMH).toFixed(0), flightSeconds: [T.hopFlightTime, T.hopFlightTimeMax] },
  clearanceM: T.flightClearance, sideClearanceM: T.flightSideClearance, rows }, null, 1));
let previous = '';
for (const r of rows) {
  const key = `${r.speedBehindKmh} km/h sur une voiture a ${r.speedAheadKmh} km/h (ecart ${r.closingKmh} km/h)`;
  if (key !== previous) { previous = key; console.log(`\n${key}`); }
  console.log(`  decalage ${r.offsetM.toFixed(2)} m  ->  ${r.outcome}${r.flightSeconds ? ` : vol ${r.flightSeconds} s, sommet ${r.peakHeightM} m, retombe ${r.landsAheadOfTheOtherNoseM} m devant le nez de l'autre, a ${r.sideAtLandingM} m de cote, ${r.speedAtTakeOffKmh} -> ${r.speedAtLandingKmh} km/h (autre : ${r.otherCarAtLandingKmh})` : ''}`);
}
console.log('->', out);
