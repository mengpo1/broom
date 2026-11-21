// Tall natural strips running along the road (tree line, cliff face). Same contract as the
// strips of trackside.js: (ctx, w, h, P, rnd, variant), seamless from left edge to right edge.
// Everything that crosses a vertical edge is drawn again one tile away (see `wrapped`); the top
// 3 % of the canvas stays transparent so the irregular silhouette is anti-aliased.

import { LINE, seeded, brushCurve, brushStroke, clipped, tracePolygon } from '../styles/ink.js';
import { shadeHex, mixHex } from '../palettes/palettes.js';
import { foliageMass, inkUnion, grassTuft, trunk, ringPoints, traceScallops } from './vegetation.js';

const TAU = Math.PI * 2;

function jit(rnd, amount) { return (rnd() - 0.5) * 2 * amount; }

/**
 * Run `draw` at its place and again one tile to the left / right when the horizontal range
 * [minX, maxX] crosses a vertical edge. `draw` must be deterministic (re-seed inside).
 */
function wrapped(ctx, w, minX, maxX, draw) {
  for (const dx of [0, -w, w]) {
    if (maxX + dx < 0 || minX + dx > w) continue;
    ctx.save(); ctx.translate(dx, 0); draw(); ctx.restore();
  }
}

function newSeed(rnd) { return Math.floor(rnd() * 4294967295) + 1; }

// ------------------------------------------------------------------------------ forest edge

// one crown: [x, y, r, dark] in units of the crown radius (x, r) and crown height (y)
const CROWN = [[-0.42, 0.56, 0.36, 1], [0.44, 0.58, 0.36, 1], [0.0, 0.66, 0.32, 1], [-0.74, 0.1, 0.36, 0], [0.74, 0.12, 0.36, 0], [0.42, -0.36, 0.42, 0], [-0.44, -0.4, 0.44, 0], [0.02, 0.06, 0.5, 0], [0.04, -0.68, 0.4, 0]];

function crownClumps(x, y, radius, height, rnd, skip = 0) {
  return CROWN.slice(skip).map(([cx, cy, r, dark]) => ({ x: x + (cx + jit(rnd, 0.07)) * radius, y: y + (cy + jit(rnd, 0.07)) * height, r: radius * r * (0.92 + rnd() * 0.16), dark: !!dark }));
}

/** Conifer top standing behind the broadleaf crowns: stepped tiers, two tones, light contour. */
function spire(ctx, x, yTop, yBase, halfWidth, tiers, colors, k, rnd) {
  const right = [], left = [], step = (yBase - yTop) / tiers;
  for (let j = 1; j <= tiers; j++) {
    const t = j / tiers, y = yTop + step * j, hw = halfWidth * (0.16 + 0.84 * t);
    right.push([x + hw * (0.9 + rnd() * 0.2), y + step * 0.18], [x + hw * 0.52, y - step * 0.1]);
    left.push([x - hw * (0.9 + rnd() * 0.2), y + step * 0.18], [x - hw * 0.52, y - step * 0.1]);
  }
  const pts = [[x, yTop]].concat(right, [[x, yBase + step * 0.3]], left.reverse().map((p, i, a) => a[i ^ 1] || p));
  const trace = (g) => tracePolygon(g, pts);
  inkUnion(ctx, trace, colors.ink, LINE.form, k, 0.6);
  ctx.beginPath(); trace(ctx); ctx.fillStyle = colors.shade; ctx.fill();
  clipped(ctx, trace, () => {
    ctx.beginPath(); tracePolygon(ctx, pts.map((p) => [x + (p[0] - x) * 0.8 - halfWidth * 0.3, p[1] - step * 0.12])); ctx.fillStyle = colors.base; ctx.fill();
    ctx.beginPath(); tracePolygon(ctx, pts.map((p) => [x + (p[0] - x) * 0.4 - halfWidth * 0.5, yTop + (p[1] - yTop) * 0.8])); ctx.fillStyle = colors.light; ctx.fill();
  });
}

function forest(ctx, w, h, P, rnd) {
  const k = h / 576;
  const abyss = shadeHex(P.leafDeep, 0.42, P.ink);
  const softInk = mixHex(P.ink, P.leafDeep, 0.35);
  const lit = { ink: P.ink, shade: P.leafShade, base: P.leaf, light: P.leafLight, deep: P.leafDeep };
  const dim = { ink: P.ink, shade: P.leafDeep, base: P.leafShade, light: P.leaf, deep: abyss };
  const far = { ink: softInk, shade: mixHex(P.leafDeep, P.leafShade, 0.45), base: P.leafShade, light: mixHex(P.leafShade, P.leaf, 0.7), deep: P.leafDeep };
  const firs = { ink: softInk, shade: P.pineShade, base: P.pine, light: mixHex(P.pine, P.pineLight, 0.6) };
  const top = h * 0.035;

  // 1. skyline: conifer tops standing above the far crowns
  const slots = 7;
  for (const s of [0, 2, 3, 5]) {
    const x = ((s + 0.5 + jit(rnd, 0.3)) / slots) * w, yTop = top + (2 + rnd() * 34) * k, hw = (46 + rnd() * 16) * k, seed = newSeed(rnd);
    wrapped(ctx, w, x - hw * 1.3, x + hw * 1.3, () => spire(ctx, x, yTop, 290 * k, hw, 7, firs, k, seeded(seed)));
  }
  for (let i = 0; i < slots; i++) {
    const r = (64 + rnd() * 30) * k, x = ((i + 0.5 + jit(rnd, 0.2)) / slots) * w, y = top + r * 0.86 + (44 + rnd() * 70) * k, seed = newSeed(rnd);
    const clumps = [{ x: x + r * 0.5, y: y + r * 0.25, r: r * 0.7, dark: true }, { x: x - r * 0.45, y: y + r * 0.1, r: r * 0.72 }, { x: x + jit(rnd, r * 0.2), y: y - r * 0.15, r: r * 0.8 }];
    wrapped(ctx, w, x - r * 1.6, x + r * 1.6, () => foliageMass(ctx, clumps, far, k, seeded(seed), { inkWidth: LINE.form, marks: 1 }));
  }
  // 2. darkness inside the wood, deeper hollows
  ctx.fillStyle = P.leafDeep; ctx.fillRect(0, top + 190 * k, w, h);
  for (let i = 0; i < 6; i++) {
    const x = ((i + rnd()) / 6) * w, y = (350 + rnd() * 130) * k, pts = ringPoints(x, y, (60 + rnd() * 50) * k, (50 + rnd() * 40) * k, 8, 0.12, rnd);
    wrapped(ctx, w, x - 130 * k, x + 130 * k, () => { ctx.beginPath(); traceScallops(ctx, pts, 0.25); ctx.fillStyle = abyss; ctx.fill(); });
  }
  // 3. thin trunks deep in the wood
  const dusky = mixHex(P.trunkShade, P.leafDeep, 0.45), duskyLight = mixHex(P.trunk, P.leafDeep, 0.4);
  for (let i = 0; i < 8; i++) {
    const x = ((i + 0.2 + rnd() * 0.6) / 8) * w, tw = (8 + rnd() * 9) * k, lean = jit(rnd, 16 * k);
    wrapped(ctx, w, x - 40 * k, x + 40 * k, () => {
      ctx.beginPath(); tracePolygon(ctx, [[x - tw * 0.7, h], [x - tw * 0.4 + lean, 300 * k], [x + tw * 0.4 + lean, 300 * k], [x + tw * 0.7, h]]); ctx.fillStyle = dusky; ctx.fill();
      ctx.beginPath(); tracePolygon(ctx, [[x - tw * 0.7, h], [x - tw * 0.4 + lean, 300 * k], [x - tw * 0.05 + lean, 300 * k], [x - tw * 0.2, h]]); ctx.fillStyle = duskyLight; ctx.fill();
    });
  }
  // 4. middle canopy: big crowns of uneven size, mostly in half shade
  const mids = 4;
  for (let i = 0; i < mids; i++) {
    const x = ((i + 0.5 + jit(rnd, 0.25)) / mids) * w, radius = (112 + rnd() * 44) * k, y = (190 + rnd() * 70) * k + radius * 0.2, seed = newSeed(rnd);
    const clumps = crownClumps(x, y, radius, radius * (0.66 + rnd() * 0.16), rnd);
    wrapped(ctx, w, x - radius * 1.4, x + radius * 1.4, () => foliageMass(ctx, clumps, i === 1 ? lit : dim, k, seeded(seed), { inkWidth: LINE.form * 1.1 }));
  }
  // 5. front row: trunks, then wide low boughs of uneven height that hide their forks
  const fronts = 4, trees = [];
  for (let i = 0; i < fronts; i++) {
    const big = i % 2 === 0;
    trees.push({ x: ((i + 0.5 + jit(rnd, 0.24)) / fronts) * w, radius: (big ? 124 + rnd() * 24 : 84 + rnd() * 18) * k, y: (big ? 300 + rnd() * 30 : 372 + rnd() * 30) * k,
      tw: (big ? 32 + rnd() * 8 : 22 + rnd() * 6) * k, lean: jit(rnd, 14 * k), offset: jit(rnd, 26 * k), seedA: newSeed(rnd), seedB: newSeed(rnd) });
  }
  for (const t of trees) {
    const tx = t.x + t.offset;
    wrapped(ctx, w, tx - 90 * k, tx + 90 * k, () => {
      const r = seeded(t.seedA);
      for (const side of [-1, 1]) {
        const bough = [[tx + t.lean, t.y + 70 * k], [tx + t.lean + side * 44 * k, t.y + 30 * k], [tx + side * 84 * k, t.y - 10 * k]];
        brushCurve(ctx, bough, 14 * k, { color: P.ink, taperStart: 0, taperEnd: 0.5, swell: 0.05 });
        brushCurve(ctx, bough, 9 * k, { color: P.trunkShade, taperStart: 0, taperEnd: 0.5, swell: 0.05 });
      }
      trunk(ctx, tx, h + 4 * k, t.y, t.tw, t.tw * 0.62, P, k, r, t.lean);
    });
  }
  for (const t of trees) {
    const clumps = crownClumps(t.x, t.y, t.radius, t.radius * 0.56, rnd, 1);
    wrapped(ctx, w, t.x - t.radius * 1.4, t.x + t.radius * 1.4, () => foliageMass(ctx, clumps, lit, k, seeded(t.seedB), { inkWidth: LINE.silhouette * 0.85 }));
  }
  // 6. undergrowth along the ground line: shrubs of uneven size with gaps, grass in front
  const shrubs = 6;
  for (let i = 0; i < shrubs; i++) {
    const x = ((i + 0.5 + jit(rnd, 0.4)) / shrubs) * w, r = (24 + rnd() * rnd() * 44) * k, y = h - r * (0.45 + rnd() * 0.4), seed = newSeed(rnd);
    const clumps = [{ x: x + r * 0.8, y: y + r * 0.25, r: r * 0.8, dark: true }, { x: x - r * 0.8, y: y + r * 0.2, r: r * 0.85, dark: i % 3 === 0 }, { x, y: y - r * 0.1, r, dark: i % 4 === 1 }];
    wrapped(ctx, w, x - r * 2.4, x + r * 2.4, () => foliageMass(ctx, clumps, i % 3 === 2 ? dim : lit, k, seeded(seed), { inkWidth: LINE.form, marks: 1, density: 1.2 }));
  }
  for (let i = 0; i < 9; i++) {
    const x = ((i + rnd()) / 9) * w, seed = newSeed(rnd);
    wrapped(ctx, w, x - 30 * k, x + 30 * k, () => grassTuft(ctx, x, h - 2 * k, (14 + (seed % 12)) * k, P.ink, k, seeded(seed), i % 2 ? P.grassDark : P.leafShade));
  }
  ctx.fillStyle = 'rgba(22,22,36,0.35)';
  ctx.fillRect(0, h - 7 * k, w, 7 * k);
}

// ------------------------------------------------------------------------------- cliff face

/** Split one tile width into `count` irregular columns: [{ x0, x1 }] (x1 of the last one exceeds w). */
function splitColumns(w, count, rnd, spread = 0.3) {
  const cuts = [], offset = rnd() * w / count;
  for (let i = 0; i < count; i++) cuts.push(offset + ((i + jit(rnd, spread)) / count) * w);
  return cuts.map((x0, i) => ({ x0, x1: i + 1 < count ? cuts[i + 1] : cuts[0] + w }));
}

/** Dry bush clinging to a ledge. */
function ledgeBush(ctx, x, y, r, P, k, rnd) {
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.42 + jit(rnd, 0.15), len = r * (1.5 + rnd() * 0.7);
    brushCurve(ctx, [[x, y], [x + Math.cos(a) * len * 0.5 + jit(rnd, 2 * k), y + Math.sin(a) * len * 0.5], [x + Math.cos(a) * len, y + Math.sin(a) * len]], LINE.detail * k * 1.2, { color: P.ink, taperStart: 0, taperEnd: 0.6, swell: 0 });
  }
  const clumps = [{ x: x + r * 0.7, y: y - r * 0.5, r: r * 0.7, dark: true }, { x: x - r * 0.6, y: y - r * 0.55, r: r * 0.8 }, { x: x + r * 0.05, y: y - r * 0.95, r: r * 0.8 }];
  foliageMass(ctx, clumps, { ink: P.ink, shade: P.dryShade, base: P.dry, light: P.dryLight, deep: shadeHex(P.dryShade, 0.3, P.ink) }, k, rnd, { inkWidth: LINE.form, marks: 1, density: 1.5 });
}

function cliff(ctx, w, h, P, rnd) {
  const k = h / 576, top = h * 0.035;
  const wobble = (base, m, amp, m2 = m * 2 + 1) => {
    const p1 = rnd() * 6, p2 = rnd() * 6;
    return (x) => (base + amp * Math.sin((x / w) * TAU * m + p1) + amp * 0.4 * Math.sin((x / w) * TAU * m2 + p2)) * k;
  };
  const capFoot = wobble(268, 1, 10), screeTop = wobble(512, 2, 10, 5);

  // ---- geometry
  // cap rock: buttresses of uneven width and height separated by clefts
  const cap = splitColumns(w, 6, rnd, 0.36).map((c) => {
    const cw = c.x1 - c.x0, xm = (c.x0 + c.x1) / 2, yTop = top + (4 + Math.pow(rnd(), 1.4) * 104) * k, tilt = jit(rnd, 16 * k);
    const gapL = (2 + rnd() * rnd() * 14) * k, gapR = (2 + rnd() * rnd() * 14) * k, foot = capFoot(xm) + jit(rnd, 10 * k);
    const pts = [[c.x0, foot], [c.x0 + 1, yTop + 120 * k], [c.x0 + gapL * 0.5, yTop + (50 + rnd() * 30) * k], [c.x0 + gapL, yTop + (14 + rnd() * 22) * k],
      [c.x0 + gapL + cw * (0.06 + rnd() * 0.08), yTop + jit(rnd, 4 * k)], [c.x0 + cw * (0.4 + rnd() * 0.2), yTop + tilt * 0.4 - rnd() * 6 * k], [c.x1 - gapR - cw * (0.1 + rnd() * 0.1), yTop + tilt],
      [c.x1 - gapR, yTop + tilt + (12 + rnd() * 26) * k], [c.x1 - gapR * 0.5, yTop + (60 + rnd() * 40) * k], [c.x1 - 1, yTop + 130 * k], [c.x1, foot]];
    return { ...c, pts, yTop, foot, depth: 0.4 + rnd() * 0.6, stains: 3, cracks: 3, seed: newSeed(rnd) };
  });
  // three ledges of long slabs stepping out toward the foot of the wall
  const ledges = [[322, 30, 3], [392, 40, 2], [458, 30, 3]].map(([base, thick, count]) => {
    const head = wobble(base, 2, 7, 3);
    return splitColumns(w, count, rnd, 0.3).map((c) => {
      const xm = (c.x0 + c.x1) / 2, y = head(xm) + jit(rnd, 6 * k), t = thick * (0.7 + rnd() * 0.6) * k, gap = rnd() < 0.35 ? (4 + rnd() * 14) * k : 0, cham = (4 + rnd() * 6) * k;
      const pts = [[c.x0 + gap, y + t], [c.x0 + gap, y + cham], [c.x0 + gap + cham, y], [xm + jit(rnd, 20 * k), y + jit(rnd, 4 * k)], [c.x1 - gap - cham, y + jit(rnd, 3 * k)], [c.x1 - gap, y + cham * 1.4], [c.x1 - gap, y + t + jit(rnd, 4 * k)], [xm, y + t + jit(rnd, 4 * k)]];
      return { ...c, pts, yTop: y, foot: y + t, depth: 0.3 + rnd() * 0.7, stains: 2, cracks: 1, seed: newSeed(rnd) };
    });
  });

  /** Front of a block standing proud of the face: sunlit, shaded right flank, stains, cracks. */
  const paintBlock = (c) => {
    const r = seeded(c.seed), trace = (g) => tracePolygon(g, c.pts), cw = c.x1 - c.x0, ch = c.foot - c.yTop;
    ctx.beginPath(); trace(ctx); ctx.fillStyle = P.rockLight; ctx.fill();
    clipped(ctx, trace, () => {
      // right flank turned away from the light, with a broken edge
      const flank = Math.min(cw * 0.3, (10 + 22 * c.depth) * k), edge = [[c.x1 + 4, c.yTop - 4]];
      for (let i = 0; i <= 6; i++) edge.push([c.x1 - flank * (0.7 + r() * 0.6) - (i % 2 ? flank * 0.4 : 0), c.yTop + (ch * i) / 6]);
      edge.push([c.x1 + 4, c.foot + 4]);
      ctx.beginPath(); tracePolygon(ctx, edge); ctx.fillStyle = P.rock; ctx.fill();
      ctx.beginPath(); tracePolygon(ctx, edge.map(([x, y], i) => [i === 0 || i === edge.length - 1 ? x : x + flank * 0.55, y])); ctx.fillStyle = P.rockShade; ctx.fill();
      // weathering stains running down from the rim
      for (let i = 0; i < c.stains; i++) {
        const x = c.x0 + cw * (0.1 + r() * 0.62), len = Math.min(ch * (0.3 + r() * 0.55), 190 * k), sw = Math.min(cw * 0.12, (5 + r() * 10) * k);
        ctx.beginPath(); ctx.moveTo(x - sw, c.yTop - 12 * k); ctx.lineTo(x + sw, c.yTop - 12 * k); ctx.lineTo(x + sw * 0.7, c.yTop + len * 0.55); ctx.lineTo(x + sw * 0.1, c.yTop + len); ctx.lineTo(x - sw * 0.5, c.yTop + len * 0.45); ctx.closePath();
        ctx.fillStyle = P.rock; ctx.fill();
      }
      // bedding joints (pale pen lines) and cracks
      for (let i = 0; i < 2 + c.cracks; i++) {
        const y = c.yTop + ch * (0.15 + r() * 0.75), xa = c.x0 + cw * r() * 0.5, xb = xa + cw * (0.2 + r() * 0.45);
        brushStroke(ctx, [[xa, y], [(xa + xb) / 2, y + jit(r, 2 * k)], [xb, y + jit(r, 2 * k)]], LINE.hair * k * 1.6, { color: P.rockShade, taper: 0.4, swell: 0 });
      }
      for (let i = 0; i < c.cracks; i++) {
        const x = c.x0 + cw * (0.15 + r() * 0.6), ya = c.yTop + ch * r() * 0.5, len = Math.min(ch * (0.25 + r() * 0.4), 120 * k);
        brushStroke(ctx, [[x, ya], [x + jit(r, 4 * k), ya + len * 0.35], [x + jit(r, 6 * k), ya + len * 0.7], [x + jit(r, 6 * k), ya + len]], LINE.detail * k * 1.2, { color: P.ink, taperStart: 0.15, taperEnd: 0.6, swell: 0.2, seed: i });
      }
    });
  };
  /** Cleft between two buttresses: a wedge of shadow that closes downward, inked on its lit side. */
  const paintCleft = (c) => {
    const r = seeded(c.seed + 3), len = (110 + r() * 150) * k * c.depth, y0 = c.yTop + 50 * k, x = c.x1, half = (5 + r() * 7) * k;
    ctx.beginPath(); tracePolygon(ctx, [[x - half, y0], [x + half * 0.6, y0 - 20 * k], [x + half * 0.3, y0 + len * 0.6], [x + jit(r, 3 * k), y0 + len]]); ctx.fillStyle = P.rockDeep; ctx.fill();
    brushStroke(ctx, [[x + half * 0.5, y0 - 16 * k], [x + half * 0.3 + jit(r, 2 * k), y0 + len * 0.5], [x + jit(r, 3 * k), y0 + len * 1.15]], LINE.form * k * 1.5, { color: P.ink, taperStart: 0.1, taperEnd: 0.6, swell: 0.2 });
  };
  /** Flat shadow thrown by an overhanging block on the recessed slope below it. */
  const paintOverhang = (c, reach) => {
    const r = seeded(c.seed + 7), d = reach * (0.5 + c.depth) * k, cw = c.x1 - c.x0, teeth = Math.max(3, Math.round(cw / (34 * k)));
    const pts = [[c.x0 - 1, c.foot - 12 * k], [c.x1 + 1, c.foot - 12 * k], [c.x1 + d * 0.55, c.foot + d * 0.8]];
    for (let i = 1; i <= teeth; i++) { const x = c.x1 + d * 0.55 - (cw * i) / teeth; pts.push([x + (cw / teeth) * 0.5, c.foot + d * (0.75 + r() * 0.5)], [x, c.foot + d * (0.45 + r() * 0.4)]); }
    ctx.beginPath(); tracePolygon(ctx, pts); ctx.fillStyle = P.rockShade; ctx.fill();
  };
  /** Recessed slope between two levels: fine strata drawn with broken pen lines. */
  const strata = (ya, yb, lines, seed) => {
    const r = seeded(seed);
    for (let line = 0; line < lines; line++) {
      const f = (line + 0.5 + jit(r, 0.3)) / lines;
      let x = r() * 60 * k;
      while (x < w) {
        const len = (40 + r() * 170) * k, xa = x, xb = Math.min(x + len, w + 40 * k), width = LINE.hair * k * (1.2 + r() * 1.4), tone = r() < 0.25 ? P.ink : P.rockShade;
        const pts = [];
        for (let q = 0; q <= 6; q++) { const xx = xa + ((xb - xa) * q) / 6; pts.push([xx, ya(xx) + (yb(xx) - ya(xx)) * f + (((q * 7 + line * 3) % 5) - 2) * 0.8 * k]); }
        wrapped(ctx, w, xa, xb, () => brushStroke(ctx, pts, width, { color: tone, taper: 0.3, swell: 0.2 }));
        x = xb + (14 + r() * 70) * k;
      }
    }
  };
  const underline = (c, weight) => brushStroke(ctx, [[c.x0, c.foot], [(c.x0 + c.x1) / 2, c.foot + 1.5 * k], [c.x1, c.foot]], LINE.form * k * weight, { color: P.ink, taper: 0.12, swell: 0.3, seed: c.seed % 17 });

  // ---- painting, top to bottom
  // silhouette of the cap rock: contour first, heavier on the flanks turned away from the light
  for (const c of cap) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 8 * k, () => inkUnion(ctx, (g) => tracePolygon(g, c.pts), P.ink, LINE.silhouette, k, 1));
  ctx.fillStyle = P.rock; ctx.fillRect(0, 170 * k, w, h);
  for (const c of cap) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 8 * k, () => paintBlock(c));
  for (const c of cap) wrapped(ctx, w, c.x1 - 30 * k, c.x1 + 30 * k, () => paintCleft(c));
  for (const c of cap) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 60 * k, () => paintOverhang(c, 26));
  strata(capFoot, screeTop, 9, newSeed(rnd));
  for (const c of cap) wrapped(ctx, w, c.x0, c.x1, () => underline(c, 1.6));
  // long shaded alcoves weathered out along the bedding
  for (let i = 0; i < 3; i++) {
    const x = ((i + rnd()) / 3) * w, y = capFoot(x) + (22 + rnd() * 30) * k, rx = (34 + rnd() * 40) * k, ry = (7 + rnd() * 6) * k, seed = newSeed(rnd);
    wrapped(ctx, w, x - rx * 1.4, x + rx * 1.4, () => {
      const r = seeded(seed), pts = ringPoints(x, y, rx, ry, 7, 0.2, r);
      ctx.beginPath(); tracePolygon(ctx, pts); ctx.fillStyle = P.rockShade; ctx.fill();
      ctx.beginPath(); tracePolygon(ctx, pts.map(([px, py]) => [x + (px - x) * 0.7 + rx * 0.12, y + (py - y) * 0.55 - ry * 0.25])); ctx.fillStyle = P.rockDeep; ctx.fill();
    });
  }
  for (const slabs of ledges) {
    for (const c of slabs) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 8 * k, () => inkUnion(ctx, (g) => tracePolygon(g, c.pts), P.ink, LINE.form * 0.9, k, 1));
    for (const c of slabs) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 60 * k, () => paintOverhang(c, 16));
    for (const c of slabs) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 8 * k, () => paintBlock(c));
  }

  // scree at the foot of the wall
  const screeLine = [];
  for (let x = -w; x <= 2 * w; x += 16 * k) screeLine.push([x, screeTop(x)]);
  const traceScree = (g) => { g.moveTo(-w, h + 10); for (const p of screeLine) g.lineTo(p[0], p[1]); g.lineTo(2 * w, h + 10); g.closePath(); };
  inkUnion(ctx, traceScree, P.ink, LINE.form, k, 0);
  ctx.beginPath(); traceScree(ctx); ctx.fillStyle = P.rockLight; ctx.fill();
  clipped(ctx, traceScree, () => {
    for (let i = 0; i < 7; i++) {
      const x = ((i + rnd()) / 7) * w, y = screeTop(x) + (16 + rnd() * 40) * k, pts = ringPoints(x, y, (40 + rnd() * 50) * k, (7 + rnd() * 9) * k, 7, 0.2, rnd);
      wrapped(ctx, w, x - 110 * k, x + 110 * k, () => { ctx.beginPath(); tracePolygon(ctx, pts); ctx.fillStyle = P.rock; ctx.fill(); });
    }
  });
  for (let i = 0; i < 6; i++) {
    const x = ((i + rnd()) / 6) * w, y = screeTop(x) + (16 + rnd() * 40) * k, r = (6 + rnd() * rnd() * 20) * k, pts = ringPoints(x, y, r, r * 0.7, 6, 0.18, rnd);
    wrapped(ctx, w, x - r * 2, x + r * 2, () => {
      inkUnion(ctx, (g) => tracePolygon(g, pts), P.ink, LINE.form, k, 0.7);
      ctx.beginPath(); tracePolygon(ctx, pts); ctx.fillStyle = P.rock; ctx.fill();
      clipped(ctx, (g) => tracePolygon(g, pts), () => {
        ctx.beginPath(); tracePolygon(ctx, pts.map(([px, py]) => [px - r * 0.3, py - r * 0.35])); ctx.fillStyle = P.rockLight; ctx.fill();
        ctx.beginPath(); tracePolygon(ctx, pts.map(([px, py]) => [px + r * 0.9, py + r * 0.5])); ctx.fillStyle = P.rockShade; ctx.fill();
      });
    });
  }
  // dry bushes on the ledges and in the scree
  const bushes = [];
  for (const slabs of ledges) { const c = slabs[Math.floor(rnd() * slabs.length)]; bushes.push([c.x0 + (c.x1 - c.x0) * (0.25 + rnd() * 0.5), c.yTop + 3 * k, (11 + rnd() * 8) * k]); }
  for (let i = 0; i < 2; i++) { const x = ((i + rnd()) / 2) * w; bushes.push([x, screeTop(x) + (10 + rnd() * 30) * k, (15 + rnd() * 10) * k]); }
  for (const [x, y, r] of bushes) { const seed = newSeed(rnd); wrapped(ctx, w, x - r * 3, x + r * 3, () => ledgeBush(ctx, x, y, r, P, k, seeded(seed))); }
  for (let i = 0; i < 5; i++) {
    const x = ((i + rnd()) / 5) * w, seed = newSeed(rnd);
    wrapped(ctx, w, x - 30 * k, x + 30 * k, () => grassTuft(ctx, x, h - 3 * k, (12 + (seed % 9)) * k, P.ink, k, seeded(seed), P.dry));
  }
  ctx.fillStyle = 'rgba(22,22,36,0.35)';
  ctx.fillRect(0, h - 7 * k, w, 7 * k);
}

/** Painters by family. */
export const TERRAIN_STRIP_PAINTERS = {
  'strip.forest': forest,
  'strip.cliff': cliff,
};
