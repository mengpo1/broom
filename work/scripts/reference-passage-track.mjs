// Derives a small development circuit from the passage of the reference footage used for the study
// of the held steering (1:47.8 to 1:56.4 of the 1991 recording: a long right-hand turn, then a
// left-hand turn, at about 260 to 245 km/h), so that the comparison video can show bends as close
// as possible to it.
// What is known from the footage: the speed read-out and, image by image, which of the seven
// drawings of the hands is shown. What is NOT known: the controls of the player and the shape of
// the road. HYPOTHESIS used here: a steering key is down while the hands are at the second
// position or beyond and not coming back (KEYS below, seconds from the first movement at 1:47.76).
// The validated car (variant a) is driven with those keys on open asphalt; the two turns it makes
// are fitted with two arcs, and the corners of a closed circuit around them are printed.
// node work/scripts/reference-passage-track.mjs
import { buildTrack, SURFACE } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { straightStretch } from '../../tests/gameplay/collision-helpers.mjs';
import { REFERENCE_PASSAGE } from '../../src/core/steering-bench.js';

const { keys: KEYS, kmh: KMH0, seconds: SECONDS, speeds: SPEEDS, lead: LEAD } = REFERENCE_PASSAGE;
const { HeldSteeringRun, trackBends } = await import('../../src/core/steering-bench.js');
const wide = buildTrack({ ...getCircuit('kestrel-fields'), width: 900 });
const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
const race = new Race({ track: wide, laps: 3, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 5 });
while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
const car = race.playerCars[0], other = race.cars.find((c) => !c.isHuman);
placeCar(other, wide, wide.length * 0.5, 0); other.state = CAR_STATE.RACING; other.isHuman = true; other.inThrottle = 0; other.inBrake = 1;
// the same scripted run as on the bench (keys, and pedals following the speed of the footage), on open asphalt
const open = new HeldSteeringRun(race, car, { s0: straightStretch(wide, 600) + 40, d0: -300, kmh: KMH0, lead: LEAD, keys: KEYS, speeds: SPEEDS, after: SECONDS - KEYS[KEYS.length - 1][1] });
const path = [];
let x0 = 0, z0 = 0, h0 = 0, c = 1, s = 0;
for (let i = 0; i < 6000 && !open.done; i++) {
  const before = open.started;
  open.beforeStep(); if (open.done) break;
  if (before < 0 && open.started >= 0) { x0 = car.x; z0 = car.z; h0 = car.heading; c = Math.cos(h0); s = Math.sin(h0); }
  race.step(SIM_DT); race.eventCount = 0;
  if (open.started < 0) continue;
  if (car.state !== CAR_STATE.RACING || car.surface !== SURFACE.ASPHALT) throw new Error(`left the asphalt at ${open.time.toFixed(2)} s`);
  const dx = car.x - x0, dz = car.z - z0;
  let h = car.heading - h0; while (h > Math.PI) h -= 2 * Math.PI; while (h < -Math.PI) h += 2 * Math.PI;
  path.push({ t: open.time + SIM_DT, x: dx * c + dz * s, y: -dx * s + dz * c, h, kmh: car.speed * 3.6, steer: car.steer });
}
const at = (t) => path[Math.min(path.length - 1, Math.round(t / SIM_DT) - 1)];
// the right-hand turn ends when the steering is back at the centre after the last right key; the left-hand one likewise
const settle = (t) => path.find((p) => p.t > t && Math.abs(p.steer) < 0.02) || path[path.length - 1];
const A = settle(KEYS[2][1]), B = at(KEYS[3][0]), C = settle(KEYS[3][1]), end = path[path.length - 1];
const deg = (r) => (r * 180 / Math.PI).toFixed(1);
console.log(`right turn: ${deg(A.h)} deg in ${A.t.toFixed(2)} s; left turn: ${deg(B.h - C.h)} deg; heading at the end ${deg(end.h)} deg; ${at(0.01).kmh.toFixed(0)} -> ${A.kmh.toFixed(0)} -> ${C.kmh.toFixed(0)} -> ${end.kmh.toFixed(0)} km/h`);
// tangent lines: y = 0 (heading 0) before; through A with heading A.h; through C with heading C.h
const cross = (p, hp, q, hq) => { const d = Math.cos(hp) * Math.sin(hq) - Math.sin(hp) * Math.cos(hq); const u = ((q.x - p.x) * Math.sin(hq) - (q.y - p.y) * Math.cos(hq)) / d; return { x: p.x + u * Math.cos(hp), y: p.y + u * Math.sin(hp) }; };
const P0 = { x: 0, y: 0 };
const C1 = cross(P0, 0, A, A.h), C2 = cross(A, A.h, C, C.h);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const R1 = ((dist(P0, C1) + dist(A, C1)) / 2) / Math.tan(A.h / 2), R2 = ((dist(B, C2) + dist(C, C2)) / 2) / Math.tan((B.h - C.h) / 2);
console.log(`corner 1 at (${C1.x.toFixed(1)}, ${C1.y.toFixed(1)}), radius ${R1.toFixed(1)} m; corner 2 at (${C2.x.toFixed(1)}, ${C2.y.toFixed(1)}), radius ${R2.toFixed(1)} m; straight between the turns ${(dist(A, B)).toFixed(1)} m`);
console.log(JSON.stringify({ turnIn: P0, endOfRight: { x: +A.x.toFixed(1), y: +A.y.toFixed(1), h: +A.h.toFixed(4) }, startOfLeft: { x: +B.x.toFixed(1), y: +B.y.toFixed(1) }, endOfLeft: { x: +C.x.toFixed(1), y: +C.y.toFixed(1), h: +C.h.toFixed(4) }, end: { x: +end.x.toFixed(1), y: +end.y.toFixed(1), h: +end.h.toFixed(4) } }));

// ---- the circuit: corners from the fit above, then adjusted (--fit) so that the car stays near the centre line.
// (The track builder eases every corner in and out, so the road is not exactly the arcs; a search over the
// angles, the radii, the distances between the corners and the point of the first key makes up for it.)
const base = { theme: 'plains', pitSide: -1, width: 14, laps: 3 };
/**
 * Corners of the loop. The right-hand turn is made of two corners (the keys are released for a moment in
 * the middle of it): angle and radius of the first, distance to the second, its angle and radius; then the
 * distance to the left-hand corner, its angle and radius.
 */
function corners([a1, r1, d1, a1b, r1b, d12, a2, r2]) {
  const rad = Math.PI / 180, h1 = a1 * rad, h1b = (a1 + a1b) * rad, h2 = (a1 + a1b - a2) * rad;
  const c1 = [310.4, 0], c1b = [c1[0] + d1 * Math.cos(h1), c1[1] + d1 * Math.sin(h1)], c2 = [c1b[0] + d12 * Math.cos(h1b), c1b[1] + d12 * Math.sin(h1b)];
  // a last corner brings the road back to heading 180 degrees; two right angles close the loop
  const d23 = r2 * Math.tan((a2 * rad) / 2) + 120 * Math.tan((Math.PI - h2) / 2) + 150;
  const c3 = [c2[0] + d23 * Math.cos(h2), c2[1] + d23 * Math.sin(h2)];
  const r = (v) => +v.toFixed(1);
  return [[r(c1[0]), 0, r(r1)], [r(c1b[0]), r(c1b[1]), r(r1b)], [r(c2[0]), r(c2[1]), r(r2)], [r(c3[0]), r(c3[1]), 120], [-1000, r(c3[1]), 150], [-1000, 0, 150]];
}
/** The keys played on a circuit from `offset` metres after the start of its first bend: furthest distance from the centre line, per turn. */
function drive(def, offset, report = false) {
  let track;
  try { track = buildTrack(def); } catch { return { worst: 1e3 }; }
  if ((track.warnings || []).length) return { worst: 1e3 };
  const bends = trackBends(track);
  const race2 = new Race({ track, laps: 3, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 5 });
  while (race2.phase === RACE_PHASE.COUNTDOWN) { race2.step(SIM_DT); race2.eventCount = 0; }
  const me = race2.playerCars[0], robot = race2.cars.find((k) => !k.isHuman);
  placeCar(robot, track, track.length * 0.6, 0); robot.state = CAR_STATE.RACING; robot.isHuman = true; robot.inThrottle = 0; robot.inBrake = 1;
  const turnIn = bends[0].sFrom + offset;
  const run = new HeldSteeringRun(race2, me, { s0: turnIn - LEAD, kmh: KMH0, lead: LEAD, keys: KEYS, speeds: SPEEDS, after: SECONDS - KEYS[KEYS.length - 1][1] });
  let worst = 0, when = 0, off = null, sum = 0, n = 0;
  for (let i = 0; i < 4000 && !run.done; i++) {
    run.beforeStep(); if (run.done) break;
    race2.step(SIM_DT); race2.eventCount = 0;
    if (run.started < 0) continue;
    sum += me.d * me.d; n++;
    if (Math.abs(me.d) > worst) { worst = Math.abs(me.d); when = run.time; }
    if (off === null && me.surface !== SURFACE.ASPHALT && me.surface !== SURFACE.KERB) off = run.time;
  }
  if (report) console.log(`  ${track.length.toFixed(0)} m; ${bends.map((b) => `${b.number}: ${b.side > 0 ? 'right' : 'left'} ${b.turnDeg.toFixed(0)} deg R${b.radius.toFixed(0)} from ${b.sFrom.toFixed(0)} m`).join(' | ')}\n  first key at s = ${turnIn.toFixed(1)} m: furthest from the centre line ${worst.toFixed(2)} m at ${when.toFixed(2)} s, ${off === null ? 'stays on the road' : `off the road at ${off.toFixed(2)} s`}, ${(me.speed * 3.6).toFixed(0)} km/h at the end`);
  return { worst, rms: Math.sqrt(sum / n), off, turnIn };
}
if (process.argv.includes('--fit')) {
  // first guess: the path cut where the first key is released (M, heading M.h) and where the third key goes down
  const M = settle(KEYS[0][1]);
  const K1 = cross(P0, 0, M, M.h), K1b = cross(M, M.h, A, A.h);
  const deg1 = M.h * 180 / Math.PI, deg1b = (A.h - M.h) * 180 / Math.PI, deg2 = (B.h - C.h) * 180 / Math.PI;
  let best = [deg1, dist(P0, K1) / Math.tan(M.h / 2), dist(K1, K1b), deg1b, 130, dist(K1b, C2), deg2, R2, 0], step = [3, 12, 12, 3, 12, 12, 3, 12, 8];
  // search on a copy of the candidate widened to 60 m (so that an excursion does not change the path)
  const score = (p) => { const r = drive({ ...base, id: 'fit', name: 'fit', region: '', width: 60, corners: corners(p) }, p[8]); return r.worst + r.rms; };
  let bestScore = score(best);
  console.log(`first guess: ${best.map((v) => v.toFixed(1)).join(', ')} (score ${bestScore.toFixed(2)})`);
  for (let round = 0; round < 80 && Math.max(...step) > 0.05; round++) {
    let improved = false;
    for (let k = 0; k < best.length; k++) for (const sign of [1, -1]) {
      const trial = best.slice(); trial[k] += sign * step[k];
      const sc = score(trial);
      if (sc < bestScore - 1e-6) { best = trial; bestScore = sc; improved = true; }
    }
    if (!improved) step = step.map((v) => v / 2);
  }
  console.log(`fit: ${best.map((v) => v.toFixed(2)).join(', ')} (score ${bestScore.toFixed(2)})`);
  console.log('corners:', JSON.stringify(corners(best)), 'first key offset:', +best[8].toFixed(1));
  drive({ ...base, id: 'fit', name: 'fit', region: '', corners: corners(best) }, +best[8].toFixed(1), true);
}
console.log('banc-reference as it is in the catalogue:');
drive(getCircuit(REFERENCE_PASSAGE.circuit), REFERENCE_PASSAGE.firstKeyAfterBendStart, true);
