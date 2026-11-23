// Figures for the trackside objects (tracks/trackside-objects.js), simulation only:
//   1. what every circuit gets (objects by family, tunnels, gantries; interactive objects when they are switched on);
//   2. cost of the simulation with 16 cars: classic scenery, enriched scenery (the simulation does not see it),
//      EXPERIMENTAL interactive objects;
//   3. EXPERIMENTAL open verges: the same computer-driven races on Kestrel Fields (closed limits) and on its copy with
//      open verges, with and without volumes on what stands there.
// node work/scripts/trackside-report.mjs [out.json] [--no-timing]
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit, CIRCUITS } from '../../src/tracks/track-catalog.js';
import { buildSceneryLayout } from '../../src/tracks/scenery-layout.js';
import { TRACKSIDE_OBJECTS } from '../../src/tracks/trackside-objects.js';
import { TRACKSIDE_TUNING } from '../../src/physics/trackside-tuning.js';
import { Race, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS } from '../../src/vehicles/liveries.js';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'work/benchmarks/trackside-report.json';
const timing = !process.argv.includes('--no-timing');
const MODES = { classic: { scenery: 'classic', interactions: false }, enriched: { scenery: 'enriched', interactions: false }, interactive: { scenery: 'enriched', interactions: true } };
const isNew = (id) => { const f = id.replace(/\.\d+$/, ''); return (TRACKSIDE_OBJECTS[f] && !TRACKSIDE_OBJECTS[f].original) || /^strip\.(tufts|sandbank|tunnelwall)$/.test(id); };
const build = (id, mode) => { const track = buildTrack(getCircuit(id)); track.trackside = { ...MODES[mode] }; track.sceneryLayout = buildSceneryLayout(track); return track; };
const report = { circuits: [], simulation: [], openVerges: [] };

// ---- 1. per circuit
for (const def of CIRCUITS) {
  const classic = build(def.id, 'classic').sceneryLayout, rich = build(def.id, 'enriched').sceneryLayout, inter = build(def.id, 'interactive').sceneryLayout;
  const families = {};
  for (const p of rich.props) if (isNew(p.id)) { const f = p.id.replace(/\.\d+$/, ''); families[f] = (families[f] || 0) + 1; }
  const objects = {};
  for (const o of inter.objects) { const k = (o.support ? 'support of ' : '') + o.family; objects[k] = (objects[k] || 0) + 1; }
  report.circuits.push({ id: def.id, theme: def.theme, propsBefore: classic.props.length, propsAfter: rich.props.length, stripsBefore: classic.strips.length, stripsAfter: rich.strips.length,
    tunnels: rich.trackside.tunnels.map((t) => ({ fromM: Math.round(t.from), lengthM: Math.round(t.length) })), gantries: rich.trackside.gantries.map((g) => g.id), added: families,
    validatedBoards: rich.obstacles.length, interactiveObjects: inter.objects.length, interactive: objects });
}

// ---- races of the computer
function race(track, { laps = 2, seed = 1, cars = 16, maxSeconds = 400 } = {}) {
  const entries = DRIVERS.slice(0, cars).map((driver) => ({ driver }));
  const r = new Race({ track, laps, entries, rules: RULE_PRESETS.racing, difficulty: 'pro', seed });
  const events = {}; let steps = 0;
  const t0 = performance.now();
  while (r.phase !== 'finished' && steps < maxSeconds / SIM_DT) {
    r.step(SIM_DT); steps++;
    for (let e = 0; e < r.eventCount; e++) { const ev = r.events[e]; events[ev.type] = (events[ev.type] || 0) + 1; if (ev.type === 'object') { const k = `object:${r.objects[ev.other].family}`; events[k] = (events[k] || 0) + 1; } }
    r.eventCount = 0;
  }
  const ms = performance.now() - t0;
  const sum = (f) => r.cars.reduce((a, c) => a + f(c), 0);
  return { steps, msPer1000Steps: +(ms / steps * 1000).toFixed(1), winnerTime: +Math.min(...r.cars.filter((c) => c.finished).map((c) => c.finishTime ?? c.raceTime ?? Infinity)).toFixed(3), finished: r.cars.filter((c) => c.finished).length,
    wallHits: sum((c) => c.wallHits), offTrackSeconds: +sum((c) => c.offTrackTime).toFixed(1), resets: sum((c) => c.resets), contacts: sum((c) => c.contacts),
    spins: events.crash || 0, validatedBoardsHit: events.obstacle || 0, objectsHit: events.object || 0, objectsDown: [...r.objectState].filter((v) => v === 1).length,
    byFamily: Object.fromEntries(Object.entries(events).filter(([k]) => k.startsWith('object:')).map(([k, v]) => [k.slice(7), v])), launches: events.launch || 0 };
}

// ---- 2. cost of the simulation (16 cars, 2 laps)
if (timing) {
  for (const id of ['hazelbrook', 'grand-zenith', 'montclair']) {
    const row = { circuit: id, cars: 16 };
    for (const mode of Object.keys(MODES)) { race(build(id, mode), { laps: 1 }); const r = race(build(id, mode)); row[mode] = { objects: build(id, mode).sceneryLayout.objects.length, msPer1000Steps: r.msPer1000Steps, winnerTime: r.winnerTime, objectsHit: r.objectsHit }; }
    report.simulation.push(row);
  }
}

// ---- 3. open verges against closed limits: three races each
for (const seed of [1, 2, 3]) {
  const closed = race(build('kestrel-fields', 'enriched'), { laps: 3, seed });
  const openTrack = (interactions) => { const t = buildTrack(getCircuit('banc-accotements')); t.trackside = { scenery: 'enriched', interactions }; t.sceneryLayout = buildSceneryLayout(t); return t; };
  const openGhost = race(openTrack(false), { laps: 3, seed }), openSolid = race(openTrack(true), { laps: 3, seed });
  report.openVerges.push({ seed, laps: 3, cars: 16, closedLimits: closed, openVergesWithoutVolumes: openGhost, openVergesWithVolumes: { objects: openTrack(true).sceneryLayout.objects.length, ...openSolid } });
}
report.tuning = TRACKSIDE_TUNING;
writeFileSync(out, JSON.stringify(report, null, 1));

console.log('circuit            props before -> after   tunnels  gantries  boards  interactive objects');
for (const c of report.circuits) console.log(`${c.id.padEnd(18)} ${String(c.propsBefore).padStart(5)} -> ${String(c.propsAfter).padStart(5)}        ${c.tunnels.length}        ${c.gantries.length}       ${String(c.validatedBoards).padStart(2)}      ${c.interactiveObjects}`);
for (const row of report.simulation) console.log(`simulation ${row.circuit}: ${Object.keys(MODES).map((m) => `${m} ${row[m].msPer1000Steps} ms/1000 steps (${row[m].objects} objects, winner ${row[m].winnerTime} s, ${row[m].objectsHit} hit)`).join(' | ')}`);
for (const row of report.openVerges) for (const k of ['closedLimits', 'openVergesWithoutVolumes', 'openVergesWithVolumes']) { const r = row[k]; console.log(`seed ${row.seed} ${k.padEnd(26)} winner ${r.winnerTime} s, finished ${r.finished}, wall hits ${r.wallHits}, off track ${r.offTrackSeconds} s, resets ${r.resets}, spins ${r.spins}, boards ${r.validatedBoardsHit}, objects hit ${r.objectsHit} ${JSON.stringify(r.byFamily)}, launches ${r.launches}, ${r.msPer1000Steps} ms/1000 steps`); }
console.log('->', out);
