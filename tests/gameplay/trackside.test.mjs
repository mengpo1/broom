// Trackside objects (src/tracks/trackside-objects.js): the enriched scenery is decorative and leaves
// the simulation exactly as it was; interactions with objects are EXPERIMENTAL and exist only where
// they are asked for. The contact cases are played on the collision test bench (the real module,
// the real simulation: see lab-helpers.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit, CIRCUITS, DEV_CIRCUITS } from '../../src/tracks/track-catalog.js';
import { buildSceneryLayout } from '../../src/tracks/scenery-layout.js';
import { TRACKSIDE, TRACKSIDE_OBJECTS, INTERACTION, THEME_TRACKSIDE, tracksideObject, trackBends, TUNNEL } from '../../src/tracks/trackside-objects.js';
import { TRACKSIDE_TUNING as T } from '../../src/physics/trackside-tuning.js';
import { passesUnder, collideTracksideObjects } from '../../src/physics/trackside-contacts.js';
import { COLLISION_TUNING } from '../../src/physics/collision-tuning.js';
import { THEMES } from '../../src/tracks/themes.js';
import { DRIVING_PROFILES } from '../../src/vehicles/car-spec.js';
import { expandScenerySpecs } from '../../src/art/environments/scenery-specs.js';
import { hasSceneryPainter } from '../../src/art/environments/scenery-painters.js';
import { AtlasBuilder } from '../../src/rendering/drawing/atlas.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { LAB_SCENARIOS, CollisionLab } from '../../src/core/collision-lab.js';
import { playCase } from './lab-helpers.mjs';

const specs = new Map(expandScenerySpecs().map((s) => [s.id, s]));
const layoutOf = (id, trackside) => { const track = buildTrack(getCircuit(id)); if (trackside) track.trackside = trackside; return { track, layout: buildSceneryLayout(track) }; };
const CLASSIC = { scenery: 'classic', interactions: false }, ENRICHED = { scenery: 'enriched', interactions: false }, INTERACTIVE = { scenery: 'enriched', interactions: true };
const NEW_FAMILIES = Object.keys(TRACKSIDE_OBJECTS).filter((f) => !TRACKSIDE_OBJECTS[f].original);
const isNew = (id) => NEW_FAMILIES.includes(id.replace(/\.\d+$/, '')) || /^strip\.(tufts|sandbank|tunnelwall)$/.test(id);
function fingerprint(track, layout) {
  const hash = createHash('sha256');
  for (const s of layout.strips) hash.update(JSON.stringify([s.id, s.side, s.from, s.count, s.offset, s.absolute, s.base, s.height, s.tile, s.phase]));
  for (const p of layout.props) hash.update(JSON.stringify([p.id, p.s, p.d, p.sample, p.scale, p.flip, p.reach, p.solidHalfWidth, p.obstacle]));
  for (const o of layout.obstacles) hash.update(JSON.stringify([o.index, o.prop, o.s, o.d, o.halfWidth]));
  hash.update(JSON.stringify([...track.barrierL.slice(0, 400)].concat([...track.barrierR.slice(0, 400)])));
  return { strips: layout.strips.length, props: layout.props.length, obstacles: layout.obstacles.length, sha256: hash.digest('hex') };
}

test('trackside: defaults - enriched scenery, no interaction; the catalogue names a profile, a volume and a reaction for every object', () => {
  assert.deepEqual(TRACKSIDE, { scenery: 'enriched', interactions: false });
  assert.deepEqual(Object.values(INTERACTION).sort(), ['breakable', 'decorative', 'overhead', 'solid']);
  const categories = new Set();
  for (const [family, o] of Object.entries(TRACKSIDE_OBJECTS)) {
    categories.add(o.category);
    assert.ok(Object.values(INTERACTION).includes(o.profile), `${family}: a known profile`);
    const ids = o.variants ? Array.from({ length: o.variants }, (_, v) => `${family}.${v}`) : [family];
    for (const id of ids) {
      const spec = specs.get(id);
      assert.ok(spec && spec.kind === 'prop', `${id}: a drawing specification`);
      assert.ok(hasSceneryPainter(spec.family), `${id}: a drawing`);
      assert.equal(tracksideObject(id), o);
      // what is hit is what is drawn: the volume fits inside the drawing, the height is the height of the drawing
      if (o.profile === INTERACTION.BREAKABLE || o.profile === INTERACTION.SOLID) {
        assert.ok(o.halfWidth > 0 && o.halfWidth <= spec.worldW / 2 + 1e-9, `${id}: volume ${o.halfWidth * 2} m inside the drawing (${spec.worldW} m)`);
        assert.ok(o.halfDepth > 0 && o.halfDepth <= 1.7);
        const r = T.reactions[o.reaction];
        assert.ok(r, `${family}: reaction ${o.reaction}`);
        assert.equal(r.kind, o.profile === INTERACTION.BREAKABLE ? 'break' : 'solid', `${family}: the reaction matches the profile`);
      }
      if (o.profile === INTERACTION.OVERHEAD) {
        assert.ok(o.clearance >= 5 && o.clearance < spec.worldH, `${id}: clearance ${o.clearance} m under a ${spec.worldH} m structure`);
        for (const x of o.supports) assert.ok(Math.abs(x) + o.supportHalfWidth <= spec.worldW / 2 + 1e-9, `${id}: supports inside the drawing`);
        if (o.supports.length) assert.equal(T.reactions[o.reaction].kind, 'solid');
      }
      if (o.profile === INTERACTION.DECORATIVE) assert.equal(o.halfWidth, 0);
    }
  }
  assert.deepEqual([...categories].sort(), ['accessories', 'adverts', 'chevrons', 'gantries', 'rocks', 'signals', 'tunnels', 'vegetation']);
  // every reaction is complete and none of them is a launch
  for (const [name, r] of Object.entries(T.reactions)) {
    assert.ok(r.sound && r.sound.gain > 0 && r.sound.gain <= 1 && r.sound.weight >= 4 && r.sound.weight <= 20, `${name}: a sound`);
    if (r.kind === 'break') assert.ok(r.speedKeep > 0.5 && r.speedKeep < 1 && r.jolt >= 0 && r.jolt <= 1, name);
    else assert.ok(r.stopKeep >= 0 && r.stopKeep < 0.5 && r.glanceKeep > r.stopKeep && r.glanceKeep < 1 && r.spinSpeed > 10 && r.glanceOverlap > 0.2, name);
    assert.ok(!('launch' in r) && !('flight' in r));
  }
  // every environment has its recipe, with families that exist
  for (const theme of Object.keys(THEMES)) {
    const recipe = THEME_TRACKSIDE[theme];
    assert.ok(recipe, `recipe for ${theme}`);
    for (const [family] of recipe.lone) assert.ok(TRACKSIDE_OBJECTS[family]);
    for (const family of recipe.accessories) assert.ok(TRACKSIDE_OBJECTS[family]);
    if (recipe.foot) assert.ok(specs.has(recipe.foot));
  }
  // the experimental values live apart from the validated ones
  for (const key of Object.keys(T)) assert.ok(!(key in COLLISION_TUNING), `${key} is not a validated parameter`);
});

test('trackside: with the objects switched off the scenery of the 18 circuits is the one of PR #4, to the last object', () => {
  const reference = JSON.parse(readFileSync(new URL('../fixtures/scenery-pr4.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(reference).length, 18);
  for (const def of CIRCUITS) {
    const { track, layout } = layoutOf(def.id, CLASSIC);
    assert.deepEqual(fingerprint(track, layout), reference[def.id], def.id);
    assert.deepEqual(layout.objects, []);
    assert.equal(layout.trackside.cover, null);
  }
});

test('trackside: the enriched scenery only adds - every original object, strip and solid board is where it was; nothing new can be reached', () => {
  let tunnels = 0, added = 0;
  for (const def of CIRCUITS) {
    const classic = layoutOf(def.id, CLASSIC), rich = layoutOf(def.id, ENRICHED), track = rich.track;
    const kept = rich.layout.props.filter((p) => !isNew(p.id));
    assert.equal(kept.length, classic.layout.props.length, `${def.id}: the original objects are all there`);
    for (let i = 0; i < kept.length; i++) {
      const a = kept[i], b = classic.layout.props[i];
      assert.ok(a.id === b.id && a.s === b.s && a.d === b.d && a.scale === b.scale && a.flip === b.flip && a.solidHalfWidth === b.solidHalfWidth && a.obstacle === b.obstacle, `${def.id}: ${b.id} unchanged`);
    }
    const strips = rich.layout.strips.filter((s) => !isNew(s.id));
    assert.deepEqual(strips.map((s) => [s.id, s.side, s.from, s.count, s.offset]), classic.layout.strips.map((s) => [s.id, s.side, s.from, s.count, s.offset]));
    // the simulation sees the same solid boards, in the same order, and no other object
    assert.deepEqual(rich.layout.obstacles.map((o) => [o.index, o.s, o.d, o.halfWidth]), classic.layout.obstacles.map((o) => [o.index, o.s, o.d, o.halfWidth]));
    assert.deepEqual(rich.layout.objects, []);
    // new objects: behind the barriers, or spanning the road high above the cars; none on the asphalt
    const fresh = rich.layout.props.filter((p) => isNew(p.id));
    added += fresh.length;
    assert.ok(fresh.length > 100 && rich.layout.props.length < 1800, `${def.id}: ${fresh.length} objects added, ${rich.layout.props.length} in all`);
    for (const p of fresh) {
      const entry = tracksideObject(p.id), side = p.d > 0 ? 1 : -1, barrier = side > 0 ? track.barrierR[p.sample] : track.barrierL[p.sample];
      assert.ok(!p.interactive && p.object === -1);
      if (entry.profile === INTERACTION.OVERHEAD) { assert.equal(p.d, 0); assert.ok(entry.clearance * p.scale > 5); continue; }
      assert.ok(Math.abs(p.d) > barrier, `${def.id}: ${p.id} stands behind the barrier (${Math.abs(p.d).toFixed(1)} m, barrier at ${barrier.toFixed(1)} m)`);
    }
    for (const s of rich.layout.strips.filter((x) => /tufts|sandbank/.test(x.id))) assert.ok(s.height < 0.7, 'the strip at the foot of a barrier is low');
    // shade over the road: only under what spans it
    const cover = rich.layout.trackside.cover;
    assert.equal(cover.length, track.n);
    const spans = rich.layout.props.filter((p) => /^(bridge|tunnel)\./.test(p.id));              // (a gantry is a thin beam: no shade)
    for (let i = 0; i < track.n; i++) if (cover[i] > 0) assert.ok(spans.some((p) => Math.min((p.sample - i + track.n) % track.n, (i - p.sample + track.n) % track.n) * track.ds < 12), `${def.id}: shade at sample ${i} is under a structure`);
    for (const t of rich.layout.trackside.tunnels) {
      tunnels++;
      assert.ok(t.length >= 100 && t.length <= 200);
      // constant width, away from the pits and the start, a mouth at each end, ribs in between
      let lo = Infinity, hi = 0;
      for (let k = 0; k <= t.count; k++) for (const b of [track.barrierL, track.barrierR]) { lo = Math.min(lo, b[(t.fromSample + k) % track.n]); hi = Math.max(hi, b[(t.fromSample + k) % track.n]); }
      assert.ok(hi - lo < 1.2, `${def.id}: tunnel of constant width`);
      assert.equal(rich.layout.props.filter((p) => p.id === 'tunnel.portal').length, 2 * rich.layout.trackside.tunnels.length);
      assert.ok(rich.layout.props.filter((p) => p.id === 'tunnel.arch').length >= Math.floor(t.length / TUNNEL.archSpacing) - 2);
      assert.ok(t.scale * TUNNEL.mouthHalfWidth > hi, 'the feet of the mouth stand outside the barriers');
      assert.ok(tracksideObject('tunnel.portal').clearance * t.scale > 6);
    }
    assert.ok(rich.layout.trackside.gantries.length >= 1, `${def.id}: at least one gantry`);
    // signs follow the road: chevrons on the outside of tight bends, pointing into them
    const bends = trackBends(track).filter((b) => b.radius <= 230 && b.turn >= 0.6);
    const chevrons = rich.layout.props.filter((p) => p.id === 'sign.chevron');
    assert.ok(chevrons.length >= bends.length * 2, `${def.id}: ${chevrons.length} chevrons for ${bends.length} bends`);
    for (const c of chevrons) {
      const bend = bends.find((b) => (c.sample - b.from + track.n) % track.n <= b.count + 8);
      assert.ok(bend, 'a chevron stands in a bend');
      assert.equal(Math.sign(c.d), -bend.sign, 'on its outside');
      assert.equal(c.flip, bend.sign < 0, 'pointing the way the road turns');
    }
  }
  assert.ok(tunnels >= 3, `${tunnels} tunnels in the catalogue`);
  assert.ok(added > 4000);
});

test('trackside: the simulation does not know the decorative objects - same race with and without them', () => {
  const run = (trackside) => {
    const track = buildTrack(getCircuit('montclair')); track.trackside = trackside;           // (a circuit with a tunnel and a gantry)
    const entries = [...DRIVERS.slice(0, 9).map((driver) => ({ driver })), { driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }];
    const race = new Race({ track, laps: 2, entries, rules: RULE_PRESETS.racing, difficulty: 'pro', seed: 9 });
    assert.equal(race.objects.length, 0);
    const out = [];
    for (let i = 0; i < 45 / SIM_DT; i++) {
      const t = i * SIM_DT;
      // a player who leaves the road on both sides, lifts, brakes, runs along the barriers
      race.setPlayerInput(0, t < 5 ? 0 : (Math.floor(t / 2.2) % 3) - 1, t % 7 < 5.5 ? 1 : 0, t % 7 > 6.4 ? 1 : 0, 0, false, false);
      race.step(SIM_DT); race.eventCount = 0;
      if (i % 20 === 0) for (const c of race.cars) out.push(c.x, c.z, c.heading, c.speed, c.state, c.wallHits);
    }
    return out;
  };
  assert.deepEqual(run(ENRICHED), run(CLASSIC));
});

test('trackside: every circuit fits the texture atlas, with and without the experimental objects', () => {
  const noop = new Proxy(function () {}, { get: (t, k) => (k === 'canvas' ? {} : noop), apply: () => noop, set: () => true });
  const had = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return noop; } };
  try {
    for (const def of [...CIRCUITS, ...DEV_CIRCUITS]) {
      for (const mode of [ENRICHED, INTERACTIVE]) {
        const { layout } = layoutOf(def.id, def.trackside ? { ...def.trackside, ...mode, interactions: mode.interactions || def.trackside.interactions } : mode);
        const ids = new Set(); for (const s of layout.strips) ids.add(s.id); for (const p of layout.props) ids.add(p.id);
        const atlas = new AtlasBuilder(2048, 9, 4);                       // the four layers left to the scenery of a circuit
        for (const id of ids) { const spec = specs.get(id); assert.ok(spec, `spec for ${id}`); const d = spec.density || 1; atlas.define(id, spec.w * d, spec.h * d, () => {}, {}); }
        atlas.define('map.track', 256, 256, () => {}, {});
        assert.ok(atlas.build().length <= 4, `${def.id}: the scenery fits four atlas layers`);
      }
    }
  } finally { if (had) globalThis.OffscreenCanvas = had; else delete globalThis.OffscreenCanvas; }
});

test('trackside (experimental): interactive objects stand where cars can reach them, never on the road nor behind a barrier; the same every time', () => {
  for (const id of ['hazelbrook', 'ouarzane', 'grand-zenith', 'montclair']) {
    const classic = layoutOf(id, CLASSIC), a = layoutOf(id, INTERACTIVE), b = layoutOf(id, INTERACTIVE), track = a.track;
    assert.deepEqual(a.layout.objects, b.layout.objects, `${id}: deterministic`);
    assert.ok(a.layout.objects.length >= 8 && a.layout.objects.length <= 60, `${id}: ${a.layout.objects.length} interactive objects`);
    // the validated boards are not touched: same list, and none of them is in the experimental list
    assert.deepEqual(a.layout.obstacles.map((o) => [o.index, o.s, o.d, o.halfWidth]), classic.layout.obstacles.map((o) => [o.index, o.s, o.d, o.halfWidth]));
    assert.ok(a.layout.objects.every((o) => !o.id.startsWith('sign.brake')));
    a.layout.objects.forEach((o, k) => {
      assert.equal(o.index, k);
      const i = Math.floor(o.s / track.ds) % track.n, barrier = o.d > 0 ? track.barrierR[i] : track.barrierL[i];
      assert.ok(Math.abs(o.d) - o.halfWidth > track.halfWidth, `${id}: ${o.id} is off the asphalt`);
      assert.ok(Math.abs(o.d) + o.halfWidth < barrier, `${id}: ${o.id} is inside the barrier, where a car can get to it`);
      assert.ok(o.profile === INTERACTION.BREAKABLE || o.profile === INTERACTION.SOLID);
      assert.ok(T.reactions[o.reaction]);
      const prop = a.layout.props[o.prop];
      assert.equal(prop.s, o.s, 'the volume is where the drawing is');
      if (o.support) { assert.equal(o.profile, INTERACTION.SOLID); assert.ok(Math.abs(o.d - prop.d) > 5, 'a support stands beside the road, under the end of its span'); }
      else { assert.equal(prop.d, o.d); assert.equal(prop.object, k); }
    });
    // nothing behind a barrier or far away is a volume
    for (const p of a.layout.props) {
      const side = p.d > 0 ? 1 : -1, barrier = side > 0 ? track.barrierR[p.sample] : track.barrierL[p.sample];
      if (Math.abs(p.d) > barrier) assert.equal(p.object, -1, `${p.id} behind the barrier has no volume`);
    }
  }
});

test('trackside (experimental): a structure over the road is passed under - clearance above the highest flight of the game', () => {
  // the highest a car flies: the validated hard accident (E3) and the launch on a board (E5), replayed on the bench
  const flights = ['crash', 'board'].map((name) => playCase(name, 7).maxAir);
  const highest = Math.max(...flights);
  assert.ok(highest > 0.5 && highest < 3, `highest flight ${highest.toFixed(2)} m`);
  for (const [family, o] of Object.entries(TRACKSIDE_OBJECTS)) {
    if (o.profile !== INTERACTION.OVERHEAD) continue;
    assert.ok(o.clearance > highest + T.carHeight + 1, `${family}: ${o.clearance} m of clearance for a car flying at ${highest.toFixed(2)} m`);
    assert.equal(passesUnder(o.clearance, { airHeight: highest }), true);
    assert.equal(passesUnder(o.clearance, { airHeight: 0 }), true);
  }
  assert.equal(passesUnder(2, { airHeight: 1.2 }), false, 'a structure too low would not be passed under');
});

test('trackside bench: every new case has a command, and plays through the real simulation the same way every time', () => {
  const cases = ['sign', 'rock', 'gantry', 'pillar', 'tunnel', 'offtrack', 'close'];
  const keys = Object.values(LAB_SCENARIOS).map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, 'one key for each case');
  for (const name of cases) {
    assert.ok(LAB_SCENARIOS[name], name);
    assert.equal(CollisionLab.resolve(name), name);
    const a = playCase(name, 6), b = playCase(name, 6);
    assert.deepEqual(a.samples, b.samples, `${name}: deterministic`);
    assert.deepEqual(a.events, b.events);
    assert.equal(a.maxAir, 0, `${name}: no car leaves the ground`);
    assert.ok(!a.events.some((e) => e.type === 'launch' || e.type === 'hop' || e.type === 'landing'), `${name}: no launch`);
  }
  for (const [alias, name] of [['destructible', 'sign'], ['rigide', 'rock'], ['portique', 'gantry'], ['pilier', 'pillar'], ['sortie', 'offtrack'], ['contact', 'close']]) assert.equal(CollisionLab.resolve(alias), name);
  // the validated cases keep their keys and their circuits
  assert.deepEqual(['wheel', 'hop', 'crash', 'board', 'bump'].map((n) => [LAB_SCENARIOS[n].key, LAB_SCENARIOS[n].circuit]),
    [['Digit1', 'kestrel-fields'], ['Digit2', 'kestrel-fields'], ['Digit3', 'kestrel-fields'], ['Digit4', 'hazelbrook'], ['Digit5', 'kestrel-fields']]);
});

test('trackside bench: breakable board - knocked down once, stays down, the car drives on; no second contact', () => {
  const r = playCase('sign', 8), o = r.lab.target, k = o.index, reaction = T.reactions[o.reaction];
  assert.equal(o.profile, INTERACTION.BREAKABLE);
  const hits = r.mine.filter((e) => e.type === 'object');
  assert.equal(hits.length, 1, 'one contact');
  assert.equal(hits[0].other, k);
  assert.ok(Math.abs(hits[0].value - 150 / 3.6) < 1.5, `hit at ${(hits[0].value * 3.6).toFixed(0)} km/h`);
  assert.equal(r.race.objectState[k], 1, 'the board is down');
  assert.ok(!r.mine.some((e) => e.type === 'crash' || e.type === 'obstacle' || e.type === 'reset'), 'no spin, no validated board involved');
  // the speed kept is the one of the reaction (then the car coasts on the grass)
  const before = r.samples.filter((x) => x.t < hits[0].t).pop(), after = r.samples.find((x) => x.t > hits[0].t + 0.02);
  assert.ok(after.kmh < before.kmh * reaction.speedKeep + 1 && after.kmh > before.kmh * reaction.speedKeep * 0.8, `${before.kmh} -> ${after.kmh} km/h`);
  assert.ok(r.samples.every((x) => x.state === CAR_STATE.RACING), 'the car keeps driving');
  // driving through the same place again: nothing happens, the board is still down
  const me = r.me;
  placeCar(me, r.race.track, o.s - 60, o.d); me.state = CAR_STATE.RACING; me.speed = 40;
  let again = 0;
  for (let i = 0; i < 3 / SIM_DT; i++) { r.race.setPlayerInput(0, 0, 0.3, 0, 0, false, false); r.race.step(SIM_DT); for (let e = 0; e < r.race.eventCount; e++) if (r.race.events[e].type === 'object') again++; r.race.eventCount = 0; }
  assert.equal(again, 0, 'no second contact with a board that is down');
  assert.equal(r.race.objectState[k], 1);
});

test('trackside bench: rigid obstacle and gantry support - the car is stopped outside the volume, the object stays, the contact is reported once', () => {
  for (const name of ['rock', 'pillar']) {
    const r = playCase(name, 4.6), o = r.lab.target, reaction = T.reactions[o.reaction];
    assert.equal(o.profile, INTERACTION.SOLID);
    if (name === 'pillar') assert.equal(o.support, true);
    const hits = r.mine.filter((e) => e.type === 'object');
    assert.equal(hits.length, 1, `${name}: reported once`);
    assert.equal(hits[0].other, o.index);
    assert.equal(r.race.objectState[o.index], 0, `${name}: a rigid object stays up`);
    // a square hit above the spin speed of the reaction: the existing spin (announced by the existing 'crash' event)
    assert.ok(hits[0].value >= reaction.spinSpeed);
    assert.ok(r.mine.some((e) => e.type === 'crash' && e.t === hits[0].t), `${name}: spin`);
    // the car is left outside the volume, behind the face it hit
    const me = r.me;
    let along = o.s - me.s; if (along < -r.race.track.length / 2) along += r.race.track.length;
    assert.ok(along >= me.params.halfLength + o.halfDepth - 0.05, `${name}: stopped ${along.toFixed(2)} m before the centre of the object`);
    assert.ok(Math.abs(me.speed) < 3 && Math.hypot(me.velX, me.velZ) < hits[0].value * 0.5);
  }
  // below the spin speed: stopped, no spin; and a car left pushing against the object is not reported again and again
  const { lab, app } = (() => { const p = playCase('rock', 0.1); return { lab: p.lab, app: null, ...p }; })();
  const race = lab.race, me = lab.me, o = lab.target;
  placeCar(me, race.track, o.s - 12, o.d); me.state = CAR_STATE.RACING; me.speed = 12;
  const seen = [];
  for (let i = 0; i < 4 / SIM_DT; i++) {
    race.setPlayerInput(0, 0, 1, 0, 0, false, false);                       // full throttle into the rock
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) if (race.events[e].car === me.index) seen.push(race.events[e].type);
    race.eventCount = 0;
    let along = o.s - me.s; if (along < -race.track.length / 2) along += race.track.length;
    assert.ok(along >= me.params.halfLength + o.halfDepth - 0.3 || Math.abs(o.d - me.d) >= me.params.halfWidth + o.halfWidth - 0.05, 'the car never sits inside the rock');
  }
  assert.ok(seen.filter((t) => t === 'object').length >= 1 && seen.filter((t) => t === 'object').length <= 4 / T.repeatDelay + 1, `${seen.filter((t) => t === 'object').length} reports in 4 s`);
  assert.ok(!seen.includes('crash'), 'a slow hit does not spin the car');
  void app;
});

test('trackside bench: gantry and tunnel are driven through without any contact; the light changes in the tunnel only', () => {
  const g = playCase('gantry', 7);
  assert.deepEqual(g.mine, [], 'under the gantry: no event');
  const passed = g.samples.filter((x) => Math.abs(x.s - g.lab.target.s) < 30);
  assert.ok(passed.length > 0 && passed.every((x) => x.kmh > 240 && Math.abs(x.d) < 0.5), 'on the road at 250 km/h');
  // its supports are volumes of the bench circuit, clear of the road
  const supports = g.race.objects.filter((o) => o.support && o.family === 'gantry.banner');
  assert.equal(supports.length, 2);
  for (const sup of supports) assert.ok(Math.abs(sup.d) - sup.halfWidth > g.race.track.halfWidth + 2.5);
  const t = playCase('tunnel', 9), track = t.race.track, tunnel = track.sceneryLayout.trackside.tunnels[0], cover = track.sceneryLayout.trackside.cover;
  assert.deepEqual(t.mine, [], 'through the tunnel: no event');
  const inside = t.samples.filter((x) => x.s > tunnel.from + 5 && x.s < tunnel.from + tunnel.length - 5);
  assert.ok(inside.length >= 20 && inside.every((x) => x.state === CAR_STATE.RACING && x.kmh > 200), `${inside.length} samples inside`);
  assert.ok(t.samples.some((x) => x.s > tunnel.from + tunnel.length + 30), 'the car comes out');
  for (const x of inside) assert.equal(cover[Math.floor(x.s / track.ds) % track.n], 1, 'full shade inside');
  assert.equal(cover[Math.floor((tunnel.from - 40) / track.ds)], 0, 'daylight before the mouth');
  assert.equal(cover[Math.floor((tunnel.from + tunnel.length + 40) / track.ds) % track.n], 0, 'and after it');
});

test('trackside bench: close contact between two cars uses the validated rules and nothing else', () => {
  const r = playCase('close', 6);
  assert.equal(r.race.objects.length, 0, 'a circuit of the game: no experimental object');
  assert.ok(r.mine.some((e) => e.type === 'wheel'), 'wheel contact');
  assert.ok(!r.events.some((e) => e.type === 'object' || e.type === 'crash' || e.type === 'launch' || e.type === 'hop'));
  assert.ok(r.samples.every((x) => x.state === CAR_STATE.RACING && x.surface === 0), 'both keep racing on the asphalt');
});

test('trackside (experimental): the same contact for every car, driven by a player or by the computer', () => {
  const outcome = (human) => {
    const track = buildTrack(getCircuit('banc-objets')); buildSceneryLayout(track);
    const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
    const race = new Race({ track, laps: 3, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 5 });
    while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
    const car = human ? race.playerCars[0] : race.cars.find((c) => !c.isHuman), other = race.cars.find((c) => c !== car);
    placeCar(other, track, track.length * 0.6, 0); other.state = CAR_STATE.RACING;
    const o = race.objects.find((x) => x.family === 'sign.advert.low');
    placeCar(car, track, o.s - 20, o.d); car.state = CAR_STATE.RACING; car.speed = 35;
    const down = new Uint8Array(race.objects.length), cooldown = new Float32Array(2), seen = [];
    // the contact rule alone, on the car as it is: same call for both kinds of car
    car.s = o.s - car.params.halfLength - o.halfDepth + 0.2;
    collideTracksideObjects([car], track, race.objects, down, cooldown, SIM_DT, (type, index, value, k) => seen.push([type, +value.toFixed(3), k]));
    return { seen, speed: car.speed, down: down[o.index] };
  };
  assert.deepEqual(outcome(true), outcome(false));
  assert.equal(outcome(false).down, 1);
});

test('trackside (experimental): open verges are a copy of a circuit - same road, limits moved outward away from the pits, grip untouched', () => {
  const closed = buildTrack(getCircuit('kestrel-fields')), open = buildTrack(getCircuit('banc-accotements'));
  assert.ok(DEV_CIRCUITS.some((c) => c.id === 'banc-accotements') && !CIRCUITS.some((c) => c.id === 'banc-accotements'));
  assert.equal(closed.openVerges, undefined); assert.equal(closed.closedBarrierR, undefined);
  assert.deepEqual([...open.x], [...closed.x]); assert.deepEqual([...open.z], [...closed.z]); assert.deepEqual([...open.kappa], [...closed.kappa]);
  assert.deepEqual([...open.closedBarrierR], [...closed.barrierR], 'the usual barrier line is the one of the circuit');
  assert.deepEqual([...open.closedBarrierL], [...closed.barrierL]);
  assert.deepEqual([...open.vergeR], [...closed.vergeR], 'same grass and gravel');
  let widened = 0, most = 0;
  for (let i = 0; i < open.n; i++) {
    for (const [o, c] of [[open.barrierR[i], closed.barrierR[i]], [open.barrierL[i], closed.barrierL[i]]]) {
      assert.ok(o >= c - 1e-3 && o <= c + 30 + 1e-3, `limit at ${o.toFixed(3)} m for a barrier at ${c.toFixed(3)} m`);
      if (o > c + 20) widened++;
      most = Math.max(most, o - c);
    }
    const fromLine = Math.min(i, open.n - i) * open.ds;
    if (fromLine < 370) { assert.equal(open.barrierR[i], closed.barrierR[i]); assert.equal(open.barrierL[i], closed.barrierL[i]); }   // the pits keep their walls
  }
  assert.ok(widened > open.n * 0.8 && most > 29, `${widened} samples opened by more than 20 m (out of ${open.n * 2}), up to ${most.toFixed(1)} m`);
  // the grip of every surface is the one of the game (profiles are shared, nothing in them is new)
  assert.deepEqual(Object.keys(DRIVING_PROFILES.arcade).filter((k) => /open|verge/i.test(k)), []);
  // the bench case: the car drives on the ground beyond the usual barrier line without meeting a wall, and comes back
  const r = playCase('offtrack', 11), track = r.race.track, side = r.lab.target.side;
  const beyond = r.samples.filter((x) => { const i = Math.floor(x.s / track.ds) % track.n; return x.d * side > (side > 0 ? track.closedBarrierR[i] : track.closedBarrierL[i]); });
  assert.ok(beyond.length >= 10, `${beyond.length / 10} s beyond the usual barrier line`);
  assert.ok(Math.max(...r.samples.map((x) => x.d * side)) > 20);
  assert.deepEqual(r.mine.filter((e) => e.type === 'wall' || e.type === 'crash' || e.type === 'reset'), [], 'no wall, no spin, no reset');
  assert.ok(beyond.every((x) => x.surface === 2 && x.state === CAR_STATE.RACING), 'on grass, still driving');
  assert.ok(r.samples[r.samples.length - 1].d * side < 6, 'back toward the road');
  // on that circuit the vegetation planted on the opened ground can be reached: it has volumes
  const families = new Set(r.race.objects.map((o) => o.family));
  assert.ok(families.has('tree.broadleaf') && families.has('bush') && families.has('rock'));
  assert.ok(r.race.objects.length > 100 && r.race.objects.length < 300);
});
