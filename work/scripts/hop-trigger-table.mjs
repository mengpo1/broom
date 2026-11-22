// What triggers what: the same arrival from behind (the car behind 50 km/h faster, then 20, then 74)
// for a series of sideways offsets between the two cars, and the outcome given by the rules of the
// game (pure simulation at 120 Hz, no pictures). Shows where the "wheel over wheel" window lies:
// in line, nose in the gearbox, the cars bump; with the wheels interlocked (20 to 80 % of the width
// overlapped) the car behind is lifted; further out, nothing is touched from behind.
// node work/scripts/hop-trigger-table.mjs [out.json]
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { LANDING } from '../../src/physics/car-physics.js';
import { twoCars, run, KMH } from '../../tests/gameplay/collision-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));
const out = process.argv[2] || 'work/benchmarks/hop-trigger-table.json';
const ARRIVALS = [
  { name: 'faible energie', speedA: 170, speedB: 150 },
  { name: 'energie moyenne', speedA: 200, speedB: 150 },
  { name: 'forte energie', speedA: 262, speedB: 188 },
];
const OFFSETS = [0, 0.3, 0.5, 0.93, 1.2, 1.4, 1.6, 1.8, 2.0];
const rows = [];
for (const arrival of ARRIVALS) {
  for (const lateral of OFFSETS) {
    const { race, a, b } = twoCars(track, { gap: 2, lateral, speedA: arrival.speedA / KMH, speedB: arrival.speedB / KMH, straight: 700 });
    const overlap = Math.max(0, Math.min(1, (a.params.halfWidth + b.params.halfWidth - lateral) / (2 * Math.min(a.params.halfWidth, b.params.halfWidth))));
    const log = run(race, 1.6, { throttleA: 1, throttleB: 0.6 });
    const mine = log.events.filter((e) => e.car === a.index);
    const first = mine.find((e) => ['bump', 'wheel', 'launch'].includes(e.type));
    const landing = mine.find((e) => e.type === 'landing');
    let outcome = 'aucun contact';
    if (first && first.type === 'bump') outcome = 'tamponnage (sans decollage)';
    else if (first && first.type === 'wheel') outcome = 'contact roue contre roue (sans decollage)';
    else if (first && landing && landing.value === LANDING.RECOVERABLE) outcome = 'saut recuperable';
    else if (first && landing && landing.value === LANDING.HARD) outcome = 'accident violent (E3)';
    else if (first) outcome = `decollage (${landing ? landing.value : '?'})`;
    const at = first ? log.atEvent(first) : null;
    rows.push({ arrival: arrival.name, speedBehind: arrival.speedA, speedAhead: arrival.speedB, offset: lateral, widthOverlapped: +overlap.toFixed(2),
      closingAtContact: at ? +((at.a.speed - at.b.speed) * KMH).toFixed(1) : null, outcome });
  }
}
writeFileSync(out, JSON.stringify({ note: 'window: launchOverlapMin..launchOverlapMax of the width overlapped', launchOverlapMin: T.launchOverlapMin, launchOverlapMax: T.launchOverlapMax,
  hopClosingSpeedKmh: T.hopClosingSpeed * KMH, launchClosingSpeedKmh: T.launchClosingSpeed * KMH, rows }, null, 1));
let previous = '';
for (const r of rows) {
  if (r.arrival !== previous) { previous = r.arrival; console.log(`\n${r.arrival} : ${r.speedBehind} km/h sur une voiture a ${r.speedAhead} km/h`); }
  console.log(`  decalage ${r.offset.toFixed(2)} m (${String(Math.round(r.widthOverlapped * 100)).padStart(3)} % de la largeur en recouvrement)  ->  ${r.outcome}${r.closingAtContact !== null ? `, ecart au contact ${r.closingAtContact} km/h` : ''}`);
}
console.log('->', out);
