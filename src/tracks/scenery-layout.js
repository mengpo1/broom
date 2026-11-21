// Logical scenery of a circuit: which strip (barrier, fence, stand, tree line...) runs along
// which stretch of road and where single objects stand. Deterministic for a given circuit.
// Only logical ids are used here ("strip.armco", "tree.pine"); how they are drawn is decided
// by the art library, so drawings can be swapped without touching this placement.

import { Random, hashString } from '../core/random.js';
import { mod } from '../core/math.js';
import { VERGE } from './track-builder.js';
import { getTheme } from './themes.js';

/** Variants available per logical family (the art library provides `${family}.${index}`). */
export const VARIANTS = {
  'tree.broadleaf': 3, 'tree.pine': 2, 'tree.palm': 2, 'tree.cypress': 1, bush: 2, rock: 2,
  'building.villa': 2, 'building.chalet': 2, 'building.tent': 2, 'building.hangar': 1, 'building.city': 3,
  'building.crane': 1, 'building.container': 2, 'building.warehouse': 1,
  'strip.hoarding': 4, 'pole.flag': 3, 'crowd.group': 2, bridge: 2,
};

function pickWeighted(rng, table) {
  let r = rng.next();
  for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
  return table[table.length - 1][0];
}

/**
 * @returns {{
 *   strips: object[], stripsAt: number[][], props: object[], propStart: Int32Array,
 *   theme: object }}
 * strip: { id, side, from, count, offset, absolute, base, height, tile, phase }
 * prop:  { id, s, d, sample, scale, flip, reach, solidHalfWidth, obstacle }  (reach: draw distance in metres;
 *         obstacle: index in `obstacles` when the object is solid, else -1)
 */
export function buildSceneryLayout(track) {
  const theme = getTheme(track.theme);
  const rng = new Random(hashString(`scenery:${track.id}`));
  const { n, ds, length, halfWidth, kappa, pit } = track;
  const strips = [];
  const stripsAt = Array.from({ length: n }, () => []);
  const props = [];
  const blocked = [new Uint8Array(n), new Uint8Array(n)];   // [left, right]: 1 = no loose objects behind the barrier
  const tall = [new Uint8Array(n), new Uint8Array(n)];      // a tall strip already stands here
  const sideIndex = (side) => (side > 0 ? 1 : 0);
  const sampleOf = (s) => mod(Math.round(s / ds), n);

  const addStrip = (id, side, fromSample, count, opt = {}) => {
    if (count <= 0) return;
    const strip = {
      id, side, from: mod(fromSample, n), count: Math.min(count, n), offset: opt.offset ?? 0, absolute: !!opt.absolute,
      base: opt.base ?? 0, height: opt.height ?? 1, tile: opt.tile ?? 2, phase: opt.phase ?? 0,
    };
    const index = strips.length;
    strips.push(strip);
    for (let k = 0; k < strip.count; k++) stripsAt[(strip.from + k) % n].push(index);
    if (opt.tall) for (let k = 0; k < strip.count; k++) tall[sideIndex(side)][(strip.from + k) % n] = 1;
    if (opt.block) for (let k = -2; k < strip.count + 2; k++) blocked[sideIndex(side)][mod(strip.from + k, n)] = 1;
  };
  const addProp = (id, s, d, opt = {}) => {
    props.push({ id, s: mod(s, length), d, sample: Math.floor(mod(s, length) / ds) % n, scale: opt.scale ?? 1, flip: !!opt.flip, reach: opt.reach ?? 1300,
      solidHalfWidth: opt.solidHalfWidth ?? 0, obstacle: -1 });
  };
  const barrierOf = (side, i) => (side > 0 ? track.barrierR[i] : track.barrierL[i]);
  const vergeOf = (side, i) => (side > 0 ? track.vergeR[i] : track.vergeL[i]);
  const inPitWall = (i) => { let r = i * ds; if (r > length / 2) r -= length; return r >= pit.wallStartS && r <= pit.wallEndS; };

  // ---- pit complex
  const wallFrom = sampleOf(pit.wallStartS), wallCount = Math.round((pit.wallEndS - pit.wallStartS) / ds);
  addStrip('strip.pitwall', pit.side, wallFrom, wallCount, { offset: pit.wallD, absolute: true, height: 2.5, tile: 4 });
  addStrip('strip.pitbuilding', pit.side, wallFrom, wallCount, { offset: 0.6, height: 9, tile: 5, tall: true, block: true });

  // ---- barriers all around (tyre walls in front of run-off areas)
  for (const side of [-1, 1]) {
    let runStart = 0, runId = null;
    for (let i = 0; i <= n; i++) {
      let id = null;
      if (i < n) {
        const pitFacade = side === pit.side && inPitWall(i);
        id = pitFacade ? null : vergeOf(side, i) === VERGE.GRAVEL ? theme.runoffBarrier : theme.barrier;
      }
      if (id !== runId) {
        if (runId) addStrip(runId, side, runStart, i - runStart, { height: runId === 'strip.tyres' ? 1.15 : 1.0, tile: 2 });
        runStart = i; runId = id;
      }
    }
  }

  // ---- grandstands: main straight opposite the pits, then the outside of the main corners
  const standZones = [];
  const addStand = (side, s0, len) => {
    const from = sampleOf(s0), count = Math.round(len / ds / 8) * 8;
    for (let k = 0; k < count; k++) if (tall[sideIndex(side)][(from + k) % n]) return false;
    addStrip('strip.grandstand', side, from, count, { offset: 4.5, height: 11, tile: 8, tall: true, block: true });
    addStrip('strip.fence', side, from - 4, count + 8, { offset: 0.35, height: 3.4, tile: 2 });
    standZones.push({ side, from, count });
    addProp(`pole.flag.${rng.int(0, 2)}`, from * ds - 3, side * (barrierOf(side, from) + 5), { reach: 900 });
    addProp(`pole.flag.${rng.int(0, 2)}`, (from + count) * ds + 3, side * (barrierOf(side, mod(from + count, n)) + 5), { reach: 900 });
    return true;
  };
  addStand(-pit.side, -180, 400);
  const corners = [];
  for (let i = 0; i < n; i++) {
    const k = Math.abs(kappa[i]);
    if (k > 1 / 140 && k >= Math.abs(kappa[(i + 1) % n]) && k > Math.abs(kappa[mod(i - 1, n)])) corners.push({ i, k, sign: Math.sign(kappa[i]) });
  }
  corners.sort((a, b) => b.k - a.k);
  let stands = 1;
  const used = [];
  for (const c of corners) {
    if (stands >= theme.grandstands) break;
    if (used.some((u) => Math.min(mod(u - c.i, n), mod(c.i - u, n)) * ds < 320)) continue;
    const rel = c.i * ds > length / 2 ? c.i * ds - length : c.i * ds;
    if (rel > pit.entryS - 150 && rel < pit.exitS + 150) continue;
    if (addStand(-c.sign, c.i * ds - 70, 100)) { stands++; used.push(c.i); }
  }

  // ---- fences, hoardings, crowd banks, tree lines: random runs along the lap
  const run = (share, minLen, maxLen, place) => {
    for (const side of [-1, 1]) {
      let i = rng.int(0, 60);
      while (i < n) {
        const len = Math.round(rng.range(minLen, maxLen) / ds);
        if (rng.chance(share)) place(side, i, Math.min(len, n - i));
        i += len + rng.int(4, 30);
      }
    }
  };
  const free = (side, from, count) => {
    for (let k = 0; k < count; k++) if (tall[sideIndex(side)][(from + k) % n]) return false;
    return true;
  };
  run(theme.fence, 80, 220, (side, from, count) => {
    if (side === pit.side && (inPitWall(from) || inPitWall((from + count) % n))) return;
    addStrip('strip.fence', side, from, count, { offset: 0.35, height: 3.4, tile: 2 });
  });
  run(theme.hoardings, 30, 70, (side, from, count) => {
    if (side === pit.side && (inPitWall(from) || inPitWall((from + count) % n))) return;
    const c = Math.floor(count / 4) * 4;
    addStrip(`strip.hoarding.${rng.int(0, VARIANTS['strip.hoarding'] - 1)}`, side, from, c, { offset: 0.5, base: 0.95, height: 1.25, tile: 4 });
  });
  run(theme.crowdBanks, 60, 140, (side, from, count) => {
    const c = Math.floor(count / 8) * 8;
    if (!free(side, from, c)) return;
    addStrip('strip.crowdbank', side, from, c, { offset: 3, height: 4.2, tile: 8, tall: true, block: true });
    addStrip('strip.fence', side, from, c, { offset: 0.35, height: 3.4, tile: 2 });
  });
  if (theme.wallStrip) {
    run(0.75, 150, 500, (side, from, count) => {
      const c = Math.floor(count / 8) * 8;
      if (!free(side, from, c)) return;
      addStrip(theme.wallStrip, side, from, c, { offset: 9, height: theme.wallStrip === 'strip.cliff' ? 18 : 15, tile: 8, tall: true, block: true });
    });
  }
  run(theme.forestWall, 120, 420, (side, from, count) => {
    const c = Math.floor(count / 8) * 8;
    if (!free(side, from, c)) return;
    addStrip('strip.forest', side, from, c, { offset: 13, height: 15, tile: 8, tall: true });
  });

  // ---- start gantry, bridges
  addProp('gantry.start', 5, 0, { reach: 1300 });
  let bridges = 0;
  for (let tries = 0; tries < 60 && bridges < theme.bridges; tries++) {
    const i = rng.int(0, n - 1);
    const rel = i * ds > length / 2 ? i * ds - length : i * ds;
    if (Math.abs(rel) < 350) continue;
    let straight = true;
    for (let k = -30; k <= 30; k++) if (Math.abs(kappa[mod(i + k, n)]) > 1 / 500) { straight = false; break; }
    if (!straight) continue;
    addProp(`bridge.${rng.int(0, VARIANTS.bridge - 1)}`, i * ds, 0, { reach: 1300 });
    bridges++;
  }

  // ---- braking boards before the corners that follow a straight
  for (let i = 0; i < n; i++) {
    const k = Math.abs(kappa[i]);
    if (k < 1 / 150 || Math.abs(kappa[mod(i - 1, n)]) >= 1 / 150) continue;
    let straight = true;
    for (let b = 8; b < 90; b++) if (Math.abs(kappa[mod(i - b, n)]) > 1 / 320) { straight = false; break; }
    if (!straight) continue;
    const side = -Math.sign(kappa[i]) || 1;
    for (const dist of [300, 200, 100]) {
      const j = mod(i - Math.round(dist / ds), n);
      if (side === pit.side && inPitWall(j)) continue;
      // braking boards stand on the verge, clear of the barrier: they are solid (see physics/obstacles.js)
      const verge = barrierOf(side, j) - halfWidth;
      addProp(`sign.brake.${dist}`, j * ds, side * (barrierOf(side, j) - (verge > 3.6 ? 1.4 : 0.9)), { reach: 600, solidHalfWidth: 0.85 });
    }
  }

  // ---- marshal posts, towers
  let postSide = 1;
  for (let s = 130; s < length - 60; s += 240 + rng.range(-30, 30)) {
    const i = sampleOf(s);
    postSide = -postSide;
    if (postSide === pit.side && inPitWall(i)) continue;
    if (!blocked[sideIndex(postSide)][i]) addProp('post.marshal', s, postSide * (barrierOf(postSide, i) + 1.7), { reach: 500 });
  }
  for (let s = -150; s <= 250; s += 100) {
    const i = sampleOf(s);
    addProp('tower.light', s + 20, -pit.side * (barrierOf(-pit.side, i) + 2.2), { reach: 1300 });
  }
  addProp('tower.tv', 40, pit.side * (pit.outerD + 6), { reach: 900 });

  // ---- loose vegetation, rocks, buildings, spectators
  const scatter = (density, perSample, make) => {
    for (let i = 0; i < n; i++) {
      for (const side of [-1, 1]) {
        if (rng.next() < density * perSample) make(i, side, blocked[sideIndex(side)][i]);
      }
    }
  };
  scatter(theme.treeDensity, 0.34, (i, side, isBlocked) => {
    const family = pickWeighted(rng, theme.trees);
    const far = rng.next();
    const behindTall = tall[sideIndex(side)][i];
    const d = barrierOf(side, i) + (isBlocked || behindTall ? 22 + far * 50 : 5 + far * far * 60);
    if (isBlocked && far < 0.5) return;
    addProp(`${family}.${rng.int(0, VARIANTS[family] - 1)}`, (i + rng.next()) * ds, side * d, { scale: rng.range(0.8, 1.25), flip: rng.chance(0.5), reach: family === 'bush' ? 500 : 1300 });
  });
  scatter(theme.bushDensity, 0.12, (i, side, isBlocked) => {
    if (isBlocked) return;
    addProp(`bush.${rng.int(0, VARIANTS.bush - 1)}`, (i + rng.next()) * ds, side * (barrierOf(side, i) + 1.8 + rng.next() * 14), { scale: rng.range(0.7, 1.3), flip: rng.chance(0.5), reach: 450 });
  });
  scatter(theme.rockDensity, 0.1, (i, side, isBlocked) => {
    if (isBlocked) return;
    addProp(`rock.${rng.int(0, VARIANTS.rock - 1)}`, (i + rng.next()) * ds, side * (barrierOf(side, i) + 2.5 + rng.next() * 30), { scale: rng.range(0.6, 1.8), flip: rng.chance(0.5), reach: 600 });
  });
  if (theme.buildings.length) {
    scatter(theme.buildingDensity, 0.012, (i, side, isBlocked) => {
      if (isBlocked || tall[sideIndex(side)][i]) return;
      const family = rng.pick(theme.buildings);
      addProp(`${family}.${rng.int(0, VARIANTS[family] - 1)}`, i * ds, side * (barrierOf(side, i) + 16 + rng.next() * 45), { scale: rng.range(0.9, 1.2), reach: 1300 });
    });
  }
  scatter(0.5, 0.03, (i, side, isBlocked) => {
    if (isBlocked || (side === pit.side && inPitWall(i))) return;
    addProp(`crowd.group.${rng.int(0, VARIANTS['crowd.group'] - 1)}`, i * ds, side * (barrierOf(side, i) + 2.2 + rng.next() * 2), { flip: rng.chance(0.5), reach: 400 });
  });

  // ---- index props by sample (sorted along the track inside each sample)
  props.sort((a, b) => a.sample - b.sample || a.s - b.s);
  const propStart = new Int32Array(n + 1);
  for (const p of props) propStart[p.sample + 1]++;
  for (let i = 0; i < n; i++) propStart[i + 1] += propStart[i];
  // solid objects a car can run into: the simulation only knows this list (position and width)
  const obstacles = [];
  props.forEach((prop, index) => {
    if (prop.solidHalfWidth <= 0) return;
    prop.obstacle = obstacles.length;
    obstacles.push({ index: obstacles.length, prop: index, s: prop.s, d: prop.d, halfWidth: prop.solidHalfWidth });
  });
  return { strips, stripsAt, props, propStart, theme, obstacles };
}

/** Layout of a track, built once (the race and the renderer must see the same objects). */
export function getSceneryLayout(track) {
  if (!track.sceneryLayout) track.sceneryLayout = buildSceneryLayout(track);
  return track.sceneryLayout;
}
