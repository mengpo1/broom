// Trackside objects added on top of the original scenery: their catalogue, how a car may interact
// with each of them, and where they stand. This EXTENDS the scenery layout (scenery-layout.js calls
// placeTracksideObjects after its own placements): same props, same strips, same logical ids
// resolved by the art library, so every drawing stays replaceable.
//
// Three independent switches (TRACKSIDE, changed by launch options or per track, never by the menus):
//   scenery       'enriched' (default): the new decorative objects are placed. They stand behind the
//                 barriers, span the road well above the cars or line the foot of the barriers: no
//                 car can touch them, the simulation does not know them.
//                 'classic': nothing of this file is placed; the layout is the previous one, to the
//                 last object.
//   interactions  false (default) / true, EXPERIMENTAL: a second set of objects is placed on the
//                 verges, in front of the barriers, where cars can reach them, with a collision
//                 volume and a reaction (physics/trackside-contacts.js, values in
//                 physics/trackside-tuning.js). The validated braking boards are not part of it
//                 and keep their own code.
//   openVerges    false (default) / true, EXPERIMENTAL prototype handled by the track builder for
//                 circuits that ask for it (tracks/track-builder.js: def.openVerges).
//
// Interaction profiles. A profile is given to an object by its catalogue entry, never deduced from
// what it looks like:
//   DECORATIVE  no contact, ever
//   OVERHEAD    spans the road; cars pass under it as long as `clearance` is above them. Its
//               supports are separate volumes, solid only where the circuit lets a car reach them
//   BREAKABLE   a point obstacle that a car knocks down (it stays down for the rest of the race)
//   SOLID       a rigid obstacle with a collision volume

import { Random, hashString } from '../core/random.js';
import { mod } from '../core/math.js';
import { VERGE } from './track-builder.js';

export const INTERACTION = { DECORATIVE: 'decorative', OVERHEAD: 'overhead', BREAKABLE: 'breakable', SOLID: 'solid' };

/** Current settings (see the top of the file). A track may carry its own in `track.trackside`. */
export const TRACKSIDE = { scenery: 'enriched', interactions: false };

export function configureTrackside(options = {}) {
  if (options.scenery === 'classic' || options.scenery === 'enriched') TRACKSIDE.scenery = options.scenery;
  if (options.interactions !== undefined) TRACKSIDE.interactions = !!options.interactions;
  return TRACKSIDE;
}

/** Settings that apply to a track: its own (a development circuit, or a test), else the current ones. */
export function tracksideSettings(track) {
  return { ...TRACKSIDE, ...((track.def && track.def.trackside) || {}), ...(track.trackside || {}) };
}

/**
 * Catalogue. One entry per family of objects (the art library draws `family` or `family.N`).
 *   category   for the documentation and the tests
 *   profile    what the object is when it stands where a car can reach it AND interactions are on;
 *              everywhere else it is decorative, whatever this says
 *   halfWidth, halfDepth  collision volume on the ground (m): across and along the road
 *   height     of the object (m), for the documentation and the drawings
 *   clearance  OVERHEAD only: free height under the span (m)
 *   supports   OVERHEAD only: lateral positions of the supports from the centre of the object (m),
 *              with their own volume (supportHalfWidth, supportHalfDepth)
 *   reaction   key of the reaction in physics/trackside-tuning.js (BREAKABLE and SOLID)
 *   variants   number of drawings
 */
export const TRACKSIDE_OBJECTS = {
  // ---- direction arrows and signs before the bends
  'sign.chevron': { category: 'chevrons', profile: INTERACTION.BREAKABLE, halfWidth: 1.05, halfDepth: 0.3, height: 3.05, reaction: 'lightSign' },
  'sign.turn': { category: 'signals', profile: INTERACTION.BREAKABLE, halfWidth: 0.75, halfDepth: 0.3, height: 2.85, reaction: 'lightSign' },
  // ---- advertising boards of the fictional sponsors of the game, on low or tall supports
  'sign.advert.low': { category: 'adverts', profile: INTERACTION.BREAKABLE, halfWidth: 2.2, halfDepth: 0.35, height: 2.2, reaction: 'board', variants: 3 },
  'sign.advert.high': { category: 'adverts', profile: INTERACTION.DECORATIVE, halfWidth: 0, halfDepth: 0, height: 6.6, variants: 2 },
  // ---- structures over the road
  'gantry.banner': { category: 'gantries', profile: INTERACTION.OVERHEAD, clearance: 5.3, height: 7.5, supports: [-10.6, 10.6], supportHalfWidth: 0.45, supportHalfDepth: 0.45, reaction: 'pillar', variants: 2 },
  // (the start gantry and the footbridges of the original scenery: their drawings and places are unchanged; listed here
  // so that, with interactions on, their supports are volumes like those of the new gantries)
  'gantry.start': { category: 'gantries', profile: INTERACTION.OVERHEAD, clearance: 6.5, height: 8.5, supports: [-10.9, 10.9], supportHalfWidth: 0.9, supportHalfDepth: 0.9, reaction: 'pillar', original: true },
  bridge: { category: 'gantries', profile: INTERACTION.OVERHEAD, clearance: 5.6, height: 9, supports: [-12.85, 12.85], supportHalfWidth: 1.6, supportHalfDepth: 1.6, reaction: 'pillar', variants: 2, original: true },
  // (a tunnel is sized to its place: the feet of its mouth stand on the barriers, 14.2 m from the middle at scale 1)
  'tunnel.portal': { category: 'tunnels', profile: INTERACTION.OVERHEAD, clearance: 5.8, height: 11, supports: [], reaction: null },
  'tunnel.arch': { category: 'tunnels', profile: INTERACTION.OVERHEAD, clearance: 5.8, height: 11, supports: [], reaction: null },
  // ---- lone trees and plants of each environment
  'tree.oak': { category: 'vegetation', profile: INTERACTION.SOLID, halfWidth: 0.55, halfDepth: 0.55, height: 12, reaction: 'trunk' },
  'tree.poplar': { category: 'vegetation', profile: INTERACTION.SOLID, halfWidth: 0.35, halfDepth: 0.35, height: 14, reaction: 'trunk' },
  cactus: { category: 'vegetation', profile: INTERACTION.SOLID, halfWidth: 0.4, halfDepth: 0.4, height: 4.2, reaction: 'trunk', variants: 2 },
  // ---- rocks and small natural objects
  boulder: { category: 'rocks', profile: INTERACTION.SOLID, halfWidth: 1.1, halfDepth: 0.9, height: 1.9, reaction: 'rock', variants: 2 },
  stones: { category: 'rocks', profile: INTERACTION.DECORATIVE, halfWidth: 0, halfDepth: 0, height: 0.4, variants: 2 },
  // ---- trackside accessories
  cone: { category: 'accessories', profile: INTERACTION.BREAKABLE, halfWidth: 0.25, halfDepth: 0.25, height: 0.75, reaction: 'cone' },
  'marker.post': { category: 'accessories', profile: INTERACTION.BREAKABLE, halfWidth: 0.12, halfDepth: 0.12, height: 1.1, reaction: 'cone' },
  tyrestack: { category: 'accessories', profile: INTERACTION.BREAKABLE, halfWidth: 0.7, halfDepth: 0.7, height: 1.2, reaction: 'tyres' },
  haybale: { category: 'accessories', profile: INTERACTION.BREAKABLE, halfWidth: 0.9, halfDepth: 0.5, height: 0.9, reaction: 'bale' },
  barrel: { category: 'accessories', profile: INTERACTION.SOLID, halfWidth: 0.4, halfDepth: 0.4, height: 1.1, reaction: 'barrel' },
  // ---- trees, bushes and rocks of the original scenery. Where they stand today no car can reach them; they get a
  // volume only on the experimental circuits with open verges, where the ground they stand on can be driven on
  'tree.broadleaf': { category: 'vegetation', profile: INTERACTION.SOLID, halfWidth: 0.5, halfDepth: 0.5, height: 11, reaction: 'trunk', variants: 3, original: true },
  'tree.pine': { category: 'vegetation', profile: INTERACTION.SOLID, halfWidth: 0.4, halfDepth: 0.4, height: 13, reaction: 'trunk', variants: 2, original: true },
  'tree.palm': { category: 'vegetation', profile: INTERACTION.SOLID, halfWidth: 0.35, halfDepth: 0.35, height: 10, reaction: 'trunk', variants: 2, original: true },
  'tree.cypress': { category: 'vegetation', profile: INTERACTION.SOLID, halfWidth: 0.45, halfDepth: 0.45, height: 11, reaction: 'trunk', variants: 1, original: true },
  rock: { category: 'rocks', profile: INTERACTION.SOLID, halfWidth: 1.4, halfDepth: 1.1, height: 2.6, reaction: 'rock', variants: 2, original: true },
  bush: { category: 'vegetation', profile: INTERACTION.BREAKABLE, halfWidth: 1.2, halfDepth: 0.9, height: 2.2, reaction: 'bush', variants: 2, original: true },
};

/** Catalogue entry of a prop id (`sign.advert.low.2` -> the entry of `sign.advert.low`), or null. */
export function tracksideObject(id) {
  if (TRACKSIDE_OBJECTS[id]) return TRACKSIDE_OBJECTS[id];
  const family = id.replace(/\.\d+$/, '');
  return TRACKSIDE_OBJECTS[family] || null;
}

/**
 * What each environment plants and sets up, in the new families (the original recipe of the theme,
 * tracks/themes.js, is untouched). Densities are per 100 m of road and per side unless noted.
 *   lone: [[family, weight]...] lone trees and plants behind the barriers; loneDensity
 *   boulders, stones: density of rocks behind the barriers / at their foot
 *   adverts: boards per km on straights; foot: strip at the foot of the barriers; accessories
 */
export const THEME_TRACKSIDE = {
  forest: { lone: [['tree.oak', 1]], loneDensity: 0.5, boulders: 0.1, stones: 0.5, adverts: 4, foot: 'strip.tufts', accessories: ['haybale', 'tyrestack'] },
  taiga: { lone: [['tree.oak', 1]], loneDensity: 0.2, boulders: 0.4, stones: 0.9, adverts: 3, foot: 'strip.tufts', accessories: ['tyrestack'] },
  coast: { lone: [['tree.poplar', 1]], loneDensity: 0.25, boulders: 0.5, stones: 0.8, adverts: 5, foot: 'strip.sandbank', accessories: ['barrel', 'tyrestack'] },
  lake: { lone: [['tree.poplar', 0.7], ['tree.oak', 0.3]], loneDensity: 0.7, boulders: 0.3, stones: 0.7, adverts: 4, foot: 'strip.tufts', accessories: ['haybale', 'tyrestack'] },
  alpine: { lone: [['tree.oak', 1]], loneDensity: 0.15, boulders: 1.1, stones: 1.2, adverts: 3, foot: 'strip.tufts', accessories: ['haybale', 'tyrestack'] },
  highland: { lone: [['tree.oak', 1]], loneDensity: 0.3, boulders: 1.3, stones: 1.4, adverts: 2, foot: 'strip.tufts', accessories: ['haybale'] },
  desert: { lone: [['cactus', 1]], loneDensity: 1.5, boulders: 0.9, stones: 1.3, adverts: 4, foot: 'strip.sandbank', accessories: ['barrel', 'tyrestack'] },
  canyon: { lone: [['cactus', 1]], loneDensity: 1.1, boulders: 1.6, stones: 1.6, adverts: 2, foot: 'strip.sandbank', accessories: ['barrel'] },
  plains: { lone: [['tree.poplar', 0.75], ['tree.oak', 0.25]], loneDensity: 0.9, boulders: 0, stones: 0.3, adverts: 6, foot: 'strip.tufts', accessories: ['haybale', 'tyrestack'] },
  park: { lone: [['tree.poplar', 0.5], ['tree.oak', 0.5]], loneDensity: 0.6, boulders: 0, stones: 0.2, adverts: 7, foot: 'strip.tufts', accessories: ['tyrestack'] },
  docks: { lone: [], loneDensity: 0, boulders: 0, stones: 0.3, adverts: 6, foot: null, accessories: ['barrel', 'tyrestack'] },
  dusk: { lone: [['tree.oak', 0.6], ['tree.poplar', 0.4]], loneDensity: 0.5, boulders: 0.2, stones: 0.5, adverts: 4, foot: 'strip.tufts', accessories: ['haybale', 'tyrestack'] },
  zenith: { lone: [['tree.poplar', 1]], loneDensity: 0.4, boulders: 0.2, stones: 0.4, adverts: 8, foot: 'strip.tufts', accessories: ['tyrestack'] },
};

/**
 * Explicit placements, for the characteristic places of a circuit (the rules below do the rest).
 *   { type: 'tunnel', at: share of the lap (0..1), length: m }
 *   { type: 'gantry', at, id }      { type: 'object', at, id, d: metres from the centre line (+ right), flip }
 *   (`s`, in metres from the line, may be given instead of `at`)
 * A circuit definition may carry its own list in `features` (development circuits).
 */
export const CIRCUIT_FEATURES = {
  'porto-sereno': [{ type: 'tunnel', at: 0.46, length: 190 }],
  montclair: [{ type: 'tunnel', at: 0.58, length: 150 }],
  'meridian-docks': [{ type: 'tunnel', at: 0.37, length: 130 }, { type: 'gantry', at: 0.7, id: 'gantry.banner.1' }],
  'roca-alta': [{ type: 'tunnel', at: 0.52, length: 110 }],
  'grand-zenith': [{ type: 'gantry', at: 0.33, id: 'gantry.banner.0' }, { type: 'gantry', at: 0.66, id: 'gantry.banner.1' }],
};

/** Tunnels: spacing of the ribs of the vault (m), half width of the mouth at scale 1 (m), shade under a footbridge (0..1) and its length (m). */
export const TUNNEL = { archSpacing: 9, mouthHalfWidth: 14.2, bridgeShade: 0.45, bridgeShadeLength: 7 };

function weighted(rng, table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng.next() * total;
  for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
  return table[table.length - 1][0];
}

/** Bends of a track: [{ from, to, apex (samples), sign (+1 right), radius (m, tightest), turn (rad) }]. */
export function trackBends(track, gentlerThan = 1 / 420) {
  const { n, ds, kappa } = track, bends = [];
  let start = 0;
  while (start < n && Math.abs(kappa[start]) > gentlerThan) start++;         // begin on a straight
  if (start === n) return bends;
  for (let q = 0; q < n;) {
    const i = (start + q) % n;
    if (Math.abs(kappa[i]) <= gentlerThan) { q++; continue; }
    const sign = Math.sign(kappa[i]);
    let len = 0, peak = 0, apex = i, turn = 0;
    while (q + len < n) {
      const j = (start + q + len) % n, k = kappa[j];
      if (Math.abs(k) <= gentlerThan || Math.sign(k) !== sign) break;
      if (Math.abs(k) > peak) { peak = Math.abs(k); apex = j; }
      turn += Math.abs(k) * ds; len++;
    }
    bends.push({ from: i, to: (i + len) % n, count: len, apex, sign, radius: 1 / peak, turn });
    q += len;
  }
  return bends;
}

/**
 * Place the objects of this file. `L` is what the scenery layout lends: { track, theme, addProp,
 * addStrip, barrierOf, vergeOf, inPitWall, blocked, tall }. Uses its own random sequence, so the
 * original placements are the same with or without these objects.
 * Returns { tunnels: [{ from, to (m), length }], gantries: [...] } for the renderer and the tests.
 */
export function placeTracksideObjects(L, settings) {
  const { track, addProp, addStrip, barrierOf, vergeOf, inPitWall, blocked, tall } = L;
  const { n, ds, length, halfWidth, kappa, pit } = track;
  const recipe = THEME_TRACKSIDE[track.theme] || THEME_TRACKSIDE.forest;
  const rng = new Random(hashString(`trackside:${track.id}`));
  const side01 = (side) => (side > 0 ? 1 : 0);
  const rel = (i) => { const s = i * ds; return s > length / 2 ? s - length : s; };
  const nearPits = (i, margin = 60) => { const r = rel(i); return r > pit.entryS - margin && r < pit.exitS + margin; };
  const straightAround = (i, before, after, limit = 1 / 600) => {
    for (let k = -Math.round(before / ds); k <= Math.round(after / ds); k++) if (Math.abs(kappa[mod(i + k, n)]) > limit) return false;
    return true;
  };
  // cover: shade over the road per sample, for the ground and the cars (1 inside a tunnel, less under a footbridge)
  const info = { tunnels: [], gantries: [], cover: new Float32Array(n) };
  const overhead = [];                                   // samples already taken by something that spans the road
  for (const prop of L.props) if (/^(bridge|gantry)\./.test(prop.id)) overhead.push(prop.sample);
  const clearOfOverhead = (i, metres) => overhead.every((o) => Math.min(mod(o - i, n), mod(i - o, n)) * ds > metres);
  const inTunnel = (i) => info.tunnels.some((t) => mod(i - t.fromSample, n) <= t.count);
  const decor = (id, s, d, opt) => addProp(id, s, d, opt);
  const features = [...(CIRCUIT_FEATURES[track.id] || []), ...((track.def && track.def.features) || []), ...(track.features || [])];

  // ---- tunnels (explicit only): two portals, arches between them, walls along the barriers
  for (const f of features) {
    if (f.type !== 'tunnel') continue;
    let from = mod(Math.round((f.at * length) / ds), n);
    const count = Math.round(f.length / ds);
    // slide along the lap to the first stretch clear of the pits, of the start and of the other structures
    // (a tunnel needs barriers at a constant distance: no run-off area widens inside it)
    const evenBarriers = (i0) => {
      let lo = Infinity, hi = 0;
      for (let k = -2; k <= count + 2; k++) for (const side of [-1, 1]) { const b = barrierOf(side, mod(i0 + k, n)); lo = Math.min(lo, b); hi = Math.max(hi, b); }
      return hi - lo < 1.2;
    };
    let ok = false;
    for (let tries = 0; tries < 160 && !ok; tries++) {
      ok = !nearPits(from, 120) && !nearPits(mod(from + count, n), 120) && Math.abs(rel(from)) > 380 && Math.abs(rel(mod(from + count, n))) > 380
        && clearOfOverhead(from, 160) && clearOfOverhead(mod(from + count, n), 160) && evenBarriers(from);
      if (!ok) from = mod(from + Math.round(25 / ds), n);
    }
    if (!ok) continue;
    const scaleAt = (i) => (Math.max(barrierOf(1, i), barrierOf(-1, i)) + 0.9) / TUNNEL.mouthHalfWidth;
    const tunnel = { from: from * ds, to: mod(from + count, n) * ds, length: count * ds, fromSample: from, count, scale: scaleAt(from) };
    info.tunnels.push(tunnel);
    for (let k = 0; k <= count; k++) info.cover[mod(from + k, n)] = 1;
    // (a wall up to the vault on each side, then rock: tall enough to hide whatever stood behind the barrier)
    for (const side of [-1, 1]) addStrip('strip.tunnelwall', side, from, count, { offset: 0.25, height: 13, tile: 8, tall: true, block: true });
    decor('tunnel.portal', from * ds, 0, { reach: 1300, scale: tunnel.scale });
    decor('tunnel.portal', (from + count) * ds, 0, { reach: 1300, scale: scaleAt(mod(from + count, n)) });
    for (let s = TUNNEL.archSpacing; s < count * ds - 2; s += TUNNEL.archSpacing) decor('tunnel.arch', from * ds + s, 0, { reach: 420, scale: scaleAt(mod(from + Math.round(s / ds), n)) });
    overhead.push(from, mod(from + count, n));
  }

  // ---- gantries: explicit ones, then one by rule on the longest free straight
  // (like the start gantry and the footbridges of the original scenery, a gantry stands with its supports on the
  // verges: decorative by default, volumes only with interactions on)
  const addGantry = (id, i) => {
    decor(id, i * ds, 0, { reach: 1300 });
    overhead.push(i);
    info.gantries.push({ id, s: i * ds, sample: i, scale: 1 });
  };
  for (const f of features) {
    if (f.type !== 'gantry') continue;
    let i = mod(Math.round((f.s !== undefined ? f.s : f.at * length) / ds), n), ok = false;
    for (let tries = 0; tries < 80 && !ok; tries++) {
      ok = !nearPits(i, 80) && Math.abs(rel(i)) > 300 && clearOfOverhead(i, 220) && straightAround(i, 60, 60, 1 / 350) && !inTunnel(i);
      if (!ok) i = mod(i + Math.round(30 / ds), n);
    }
    if (ok) addGantry(f.id, i);
  }
  if (!info.gantries.length) {
    for (let tries = 0; tries < 80; tries++) {
      const i = rng.int(0, n - 1);
      if (nearPits(i, 80) || Math.abs(rel(i)) < 300 || !clearOfOverhead(i, 260) || !straightAround(i, 70, 70) || inTunnel(i)) continue;
      addGantry(`gantry.banner.${rng.int(0, 1)}`, i);
      break;
    }
  }

  // shade on the road under the footbridges (those of the original scenery): a deck casts one, the thin beam of a
  // gantry does not (in the reference footage too the picture darkens under bridges and roofs, not under gantries)
  const shadeSamples = Math.max(1, Math.round(TUNNEL.bridgeShadeLength / 2 / ds));
  for (const prop of L.props) {
    if (!/^bridge\./.test(prop.id)) continue;
    for (let k = -shadeSamples; k <= shadeSamples; k++) { const i = mod(prop.sample + k, n); if (info.cover[i] < TUNNEL.bridgeShade) info.cover[i] = TUNNEL.bridgeShade; }
  }

  // ---- chevrons on the outside of the bends, a direction sign before them
  const bends = trackBends(track);
  for (const b of bends) {
    if (b.radius > 230 || b.turn < 0.6) continue;
    const outside = -b.sign, flip = b.sign < 0;                      // the drawing points to the right
    const span = mod(b.apex - b.from, n) + Math.round(12 / ds);
    const boards = Math.max(3, Math.min(6, Math.round((span * ds) / 16)));
    for (let k = 0; k < boards; k++) {
      const i = mod(b.from + Math.round((k + 0.5) * span / boards), n);
      if (inTunnel(i) || (outside === pit.side && inPitWall(i))) continue;
      decor('sign.chevron', i * ds, outside * (barrierOf(outside, i) + 1.25), { reach: 700, flip });
    }
    // direction sign on the inside, 150 m before the bend when a straight leads to it, 60 m otherwise
    const before = straightAround(b.from, 170, 0, 1 / 320) ? 150 : 60;
    const j = mod(b.from - Math.round(before / ds), n);
    if (!inTunnel(j) && !(b.sign === pit.side && inPitWall(j)) && Math.abs(kappa[j]) < 1 / 250) {
      decor('sign.turn', j * ds, b.sign * (barrierOf(b.sign, j) + 1.4), { reach: 600, flip });
    }
  }

  // ---- advertising boards behind the barriers of the straights: low ones near, tall ones further back
  const boards = Math.round((recipe.adverts * length) / 1000);
  for (let k = 0, tries = 0; k < boards && tries < boards * 12; tries++) {
    const i = rng.int(0, n - 1), side = rng.chance(0.5) ? 1 : -1;
    if (blocked[side01(side)][i] || tall[side01(side)][i] || inTunnel(i) || (side === pit.side && nearPits(i, 30)) || !straightAround(i, 25, 25, 1 / 260)) continue;
    const high = rng.chance(0.4);
    if (high) decor(`sign.advert.high.${rng.int(0, 1)}`, i * ds, side * (barrierOf(side, i) + 7 + rng.next() * 6), { reach: 1100 });
    else decor(`sign.advert.low.${rng.int(0, 2)}`, i * ds, side * (barrierOf(side, i) + 2.6 + rng.next() * 1.6), { reach: 800 });
    k++;
  }

  // ---- lone trees and plants, boulders, stones: behind the barriers
  const scatter = (perHundred, make) => {
    const p = (perHundred * ds) / 100;
    for (let i = 0; i < n; i++) for (const side of [-1, 1]) if (rng.next() < p) make(i, side);
  };
  if (recipe.lone.length) {
    scatter(recipe.loneDensity, (i, side) => {
      if (blocked[side01(side)][i] || tall[side01(side)][i] || inTunnel(i)) return;
      const family = weighted(rng, recipe.lone), entry = TRACKSIDE_OBJECTS[family];
      const id = entry.variants ? `${family}.${rng.int(0, entry.variants - 1)}` : family;
      decor(id, (i + rng.next()) * ds, side * (barrierOf(side, i) + 6 + rng.next() * rng.next() * 45), { scale: rng.range(0.85, 1.2), flip: rng.chance(0.5), reach: 1300 });
    });
  }
  scatter(recipe.boulders, (i, side) => {
    if (blocked[side01(side)][i] || inTunnel(i)) return;
    decor(`boulder.${rng.int(0, 1)}`, (i + rng.next()) * ds, side * (barrierOf(side, i) + 3 + rng.next() * 22), { scale: rng.range(0.7, 1.5), flip: rng.chance(0.5), reach: 700 });
  });
  scatter(recipe.stones, (i, side) => {
    if (blocked[side01(side)][i] || inTunnel(i)) return;
    decor(`stones.${rng.int(0, 1)}`, (i + rng.next()) * ds, side * (barrierOf(side, i) + 1 + rng.next() * 5), { scale: rng.range(0.8, 1.3), flip: rng.chance(0.5), reach: 300 });
  });

  // ---- accessories behind the barriers: tyre stacks and bales on the outside of the slow bends, barrels and posts
  for (const b of bends) {
    if (b.radius > 120 || !recipe.accessories.length) continue;
    const outside = -b.sign, family = rng.pick(recipe.accessories);
    if (blocked[side01(outside)][b.apex] || inTunnel(b.apex)) continue;
    const count = family === 'barrel' ? 3 : 4;
    for (let k = 0; k < count; k++) {
      const i = mod(b.apex + Math.round(((k - count / 2) * 2.4) / ds), n);
      decor(family, i * ds + rng.next() * 1.5, outside * (barrierOf(outside, i) + 1.1 + (family === 'haybale' ? 0 : rng.next() * 0.6)), { reach: 450, flip: rng.chance(0.5) });
    }
  }
  // reflector posts along the long straights, both sides, every 50 m
  for (let i = 0; i < n; i += Math.round(50 / ds)) {
    if (!straightAround(i, 120, 120) || inTunnel(i)) continue;
    for (const side of [-1, 1]) {
      if (side === pit.side && nearPits(i, 20)) continue;
      decor('marker.post', i * ds, side * (barrierOf(side, i) + 0.55), { reach: 260 });
    }
  }

  // ---- foot of the barriers: tufts of grass or a bank of sand, in runs (terrain transition)
  if (recipe.foot) {
    for (const side of [-1, 1]) {
      let i = rng.int(0, 40);
      while (i < n) {
        const count = Math.floor(rng.range(40, 160) / ds / 4) * 4;
        const gravel = vergeOf(side, i) === VERGE.GRAVEL;
        if (rng.chance(0.55) && !(side === pit.side && (nearPits(i, 10) || nearPits(mod(i + count, n), 10))) && !inTunnel(i) && !inTunnel(mod(i + count, n))) {
          addStrip(gravel ? 'strip.sandbank' : recipe.foot, side, i, Math.min(count, n - i), { offset: -0.45, height: 0.55, tile: 4 });
        }
        i += count + rng.int(6, 40);
      }
    }
  }

  // ---- EXPERIMENTAL: objects standing on the verges, in front of the barriers, where a car can reach them
  if (settings.interactions) {
    const verge = (side, i) => barrierOf(side, i) - halfWidth;
    const reachable = (id, s, d, opt = {}) => addProp(id, s, d, { ...opt, interactive: true });
    // the three tightest bends get chevron boards on the verge itself
    const tight = bends.filter((b) => b.radius < 160 && b.turn > 0.6).sort((a, b) => a.radius - b.radius).slice(0, 3);
    for (const b of tight) {
      const outside = -b.sign;
      for (let k = 0; k < 3; k++) {
        const i = mod(b.apex + Math.round(((k - 1) * 14) / ds), n);
        if ((outside === pit.side && nearPits(i, 20)) || verge(outside, i) < 3.4 || inTunnel(i)) continue;
        reachable('sign.chevron', i * ds, outside * (barrierOf(outside, i) - 1.4), { reach: 700, flip: b.sign < 0 });
      }
      // a rock or a tyre stack at the end of a gravel trap, a lone plant on a wide grass verge
      const j = mod(b.apex + Math.round(30 / ds), n);
      if (vergeOf(outside, j) === VERGE.GRAVEL && verge(outside, j) > 9 && recipe.boulders > 0.3) reachable(`boulder.${rng.int(0, 1)}`, j * ds, outside * (barrierOf(outside, j) - 1.8), { reach: 700 });
      else if (verge(outside, j) > 6) reachable('tyrestack', j * ds, outside * (barrierOf(outside, j) - 1.0), { reach: 450 });
    }
    // a low advertising board on the verge of two straights
    for (let placed = 0, tries = 0; placed < 2 && tries < 60; tries++) {
      const i = rng.int(0, n - 1), side = rng.chance(0.5) ? 1 : -1;
      if (nearPits(i, 60) || !straightAround(i, 60, 60) || verge(side, i) < 6 || inTunnel(i)) continue;
      reachable(`sign.advert.low.${rng.int(0, 2)}`, i * ds, side * (barrierOf(side, i) - 2.8), { reach: 800 });
      placed++;
    }
    if (recipe.lone.length) {
      for (let placed = 0, tries = 0; placed < 2 && tries < 80; tries++) {
        const i = rng.int(0, n - 1), side = rng.chance(0.5) ? 1 : -1;
        if (nearPits(i, 60) || verge(side, i) < 8 || vergeOf(side, i) !== VERGE.GRASS || inTunnel(i)) continue;
        const family = weighted(rng, recipe.lone), entry = TRACKSIDE_OBJECTS[family];
        reachable(entry.variants ? `${family}.${rng.int(0, entry.variants - 1)}` : family, i * ds, side * (barrierOf(side, i) - 2.2), { reach: 1300 });
        placed++;
      }
    }
  }
  // ---- EXPERIMENTAL open verges (track builder: def.openVerges): the ground between the usual barrier line and the
  // moved limits is planted like the surroundings of the circuit, and what stands there can be reached
  if (track.openVerges) {
    const veg = L.theme.trees, closed = (side, i) => (side > 0 ? track.closedBarrierR[i] : track.closedBarrierL[i]);
    scatter(2.4, (i, side) => {
      const inner = closed(side, i) + 2, outer = barrierOf(side, i) - 2.5;
      if (outer - inner < 4) return;
      const roll = rng.next();
      let id;
      if (roll < 0.5) { const family = weighted(rng, veg); id = `${family}.${rng.int(0, (TRACKSIDE_OBJECTS[family] ? TRACKSIDE_OBJECTS[family].variants : 1) - 1)}`; }
      else if (roll < 0.75) id = `bush.${rng.int(0, 1)}`;
      else if (roll < 0.9) id = `rock.${rng.int(0, 1)}`;
      else id = `boulder.${rng.int(0, 1)}`;
      addProp(id, (i + rng.next()) * ds, side * (inner + rng.next() * (outer - inner)), { reach: 1300, flip: rng.chance(0.5), interactive: settings.interactions });
    });
  }

  // explicit single objects (development circuits and characteristic places); reachable ones only with interactions on
  for (const f of features) {
    if (f.type !== 'object') continue;
    const s = f.s !== undefined ? f.s : f.at * length, i = mod(Math.round(s / ds), n), side = f.d > 0 ? 1 : -1;
    const within = Math.abs(f.d) < barrierOf(side, i);
    if (within && !settings.interactions && tracksideObject(f.id) && tracksideObject(f.id).profile !== INTERACTION.OVERHEAD) continue;
    addProp(f.id, s, f.d, { reach: f.reach ?? 900, flip: !!f.flip, scale: f.scale ?? 1, interactive: within && settings.interactions });
    if (/^gantry\./.test(f.id)) info.gantries.push({ id: f.id, s, sample: i, scale: f.scale ?? 1 });
  }
  return info;
}

/**
 * The objects a car can run into (EXPERIMENTAL list, empty unless interactions are on): the props
 * marked interactive, and the supports of the overhead structures that stand inside the barriers.
 * Each: { index, prop, id, family, profile, reaction, s, d, halfWidth, halfDepth, support }.
 */
export function collectInteractiveObjects(track, props, settings) {
  const objects = [];
  if (!settings.interactions) return objects;
  const { n, ds } = track;
  props.forEach((prop, index) => {
    const entry = tracksideObject(prop.id);
    if (!entry) return;
    const i = Math.floor(prop.s / ds) % n;
    const add = (o) => { const object = { index: objects.length, prop: index, id: prop.id, family: prop.id.replace(/\.\d+$/, ''), s: prop.s, ...o }; objects.push(object); return object; };
    if (entry.profile === INTERACTION.OVERHEAD) {
      // the span is passed under (clearance); a support is a volume only where a car can get to it
      for (const x of entry.supports || []) {
        const d = prop.d + x * prop.scale, side = d > 0 ? 1 : -1, barrier = side > 0 ? track.barrierR[i] : track.barrierL[i];
        const hw = entry.supportHalfWidth * prop.scale;
        if (Math.abs(d) + hw >= barrier || Math.abs(d) - hw <= track.halfWidth) continue;
        add({ profile: INTERACTION.SOLID, reaction: entry.reaction, d, halfWidth: hw, halfDepth: entry.supportHalfDepth * prop.scale, support: true, clearance: entry.clearance * prop.scale });
      }
      return;
    }
    if (!prop.interactive || entry.profile === INTERACTION.DECORATIVE) return;
    const object = add({ profile: entry.profile, reaction: entry.reaction, d: prop.d, halfWidth: entry.halfWidth * prop.scale, halfDepth: entry.halfDepth * prop.scale, support: false });
    prop.object = object.index;
  });
  return objects;
}
