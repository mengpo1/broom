// Tall natural strips running along the road (tree line, cliff face). Same contract as the
// strips of trackside.js: (ctx, w, h, P, rnd, variant), seamless from left edge to right edge.
// Everything that crosses a vertical edge is drawn again one tile away (see `wrapped`); the top
// 3 % of the canvas stays transparent so the irregular silhouette is anti-aliased.

import { LINE, seeded, sampleCurve, brushCurve, brushStroke, clipped, tracePolygon } from '../styles/ink.js';
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

  // 1. skyline: far crowns and a few conifer tops
  const slots = 7;
  const spires = [0, 3, 5].map((s) => ({ x: ((s + 0.5 + jit(rnd, 0.25)) / slots) * w, top: top + (2 + rnd() * 26) * k, hw: (40 + rnd() * 14) * k, seed: newSeed(rnd) }));
  for (const s of spires) wrapped(ctx, w, s.x - s.hw * 1.3, s.x + s.hw * 1.3, () => spire(ctx, s.x, s.top, 250 * k, s.hw, 6, firs, k, seeded(s.seed)));
  for (let i = 0; i < slots; i++) {
    const r = (70 + rnd() * 26) * k, x = ((i + 0.5 + jit(rnd, 0.2)) / slots) * w, y = top + r * 0.86 + (24 + rnd() * 44) * k, seed = newSeed(rnd);
    const clumps = [{ x: x + r * 0.45, y: y + r * 0.2, r: r * 0.7, dark: true }, { x: x - r * 0.4, y: y + r * 0.1, r: r * 0.72 }, { x, y: y - r * 0.12, r: r * 0.8 }];
    wrapped(ctx, w, x - r * 1.5, x + r * 1.5, () => foliageMass(ctx, clumps, far, k, seeded(seed), { inkWidth: LINE.form, marks: 1 }));
  }
  // 2. darkness inside the wood, deeper hollows
  ctx.fillStyle = P.leafDeep; ctx.fillRect(0, top + 150 * k, w, h);
  for (let i = 0; i < 6; i++) {
    const x = ((i + rnd()) / 6) * w, y = (330 + rnd() * 130) * k, pts = ringPoints(x, y, (60 + rnd() * 50) * k, (50 + rnd() * 40) * k, 8, 0.12, rnd);
    wrapped(ctx, w, x - 130 * k, x + 130 * k, () => { ctx.beginPath(); traceScallops(ctx, pts, 0.25); ctx.fillStyle = abyss; ctx.fill(); });
  }
  // 3. thin trunks deep in the wood
  const dusky = mixHex(P.trunkShade, P.leafDeep, 0.45), duskyLight = mixHex(P.trunk, P.leafDeep, 0.4);
  for (let i = 0; i < 7; i++) {
    const x = ((i + 0.2 + rnd() * 0.6) / 7) * w, tw = (9 + rnd() * 8) * k, lean = jit(rnd, 14 * k);
    wrapped(ctx, w, x - 40 * k, x + 40 * k, () => {
      const poly = [[x - tw * 0.7, h], [x - tw * 0.4 + lean, 300 * k], [x + tw * 0.4 + lean, 300 * k], [x + tw * 0.7, h]];
      ctx.beginPath(); tracePolygon(ctx, poly); ctx.fillStyle = dusky; ctx.fill();
      ctx.beginPath(); tracePolygon(ctx, [[x - tw * 0.7, h], [x - tw * 0.4 + lean, 300 * k], [x - tw * 0.05 + lean, 300 * k], [x - tw * 0.2, h]]); ctx.fillStyle = duskyLight; ctx.fill();
    });
  }
  // 4. middle crowns
  const mids = 5;
  for (let i = 0; i < mids; i++) {
    const x = ((i + 0.5 + jit(rnd, 0.22)) / mids) * w, radius = (104 + rnd() * 26) * k, y = (196 + rnd() * 50) * k, seed = newSeed(rnd);
    const clumps = crownClumps(x, y, radius, radius * 0.78, rnd);
    wrapped(ctx, w, x - radius * 1.4, x + radius * 1.4, () => foliageMass(ctx, clumps, i % 2 ? lit : dim, k, seeded(seed), { inkWidth: LINE.form * 1.1 }));
  }
  // 5. trunks of the front row, then their low boughs
  const fronts = 4, trees = [];
  for (let i = 0; i < fronts; i++) {
    trees.push({ x: ((i + 0.5 + jit(rnd, 0.2)) / fronts) * w, radius: (86 + rnd() * 26) * k, y: (338 + rnd() * 44) * k, tw: (24 + rnd() * 12) * k, lean: jit(rnd, 12 * k), seedA: newSeed(rnd), seedB: newSeed(rnd) });
  }
  for (const t of trees) {
    wrapped(ctx, w, t.x - 80 * k, t.x + 80 * k, () => {
      const r = seeded(t.seedA);
      for (const side of [-1, 1]) {
        const bough = [[t.x + t.lean, t.y + 60 * k], [t.x + t.lean + side * 40 * k, t.y + 20 * k], [t.x + side * 78 * k, t.y - 16 * k]];
        brushCurve(ctx, bough, 14 * k, { color: P.ink, taperStart: 0, taperEnd: 0.5, swell: 0.05 });
        brushCurve(ctx, bough, 9 * k, { color: P.trunkShade, taperStart: 0, taperEnd: 0.5, swell: 0.05 });
      }
      trunk(ctx, t.x, h + 4 * k, t.y, t.tw, t.tw * 0.62, P, k, r, t.lean);
    });
  }
  for (const t of trees) {
    const clumps = crownClumps(t.x, t.y, t.radius, t.radius * 0.62, rnd, 1);
    wrapped(ctx, w, t.x - t.radius * 1.4, t.x + t.radius * 1.4, () => foliageMass(ctx, clumps, lit, k, seeded(t.seedB), { inkWidth: LINE.silhouette * 0.85 }));
  }
  // 6. undergrowth along the ground line
  const shrubs = 8;
  for (let i = 0; i < shrubs; i++) {
    const x = ((i + 0.5 + jit(rnd, 0.3)) / shrubs) * w, r = (30 + rnd() * 18) * k, y = h - r * (0.5 + rnd() * 0.5), seed = newSeed(rnd);
    const clumps = [{ x: x + r * 0.7, y: y + r * 0.25, r: r * 0.8, dark: true }, { x: x - r * 0.7, y: y + r * 0.2, r: r * 0.85, dark: i % 3 === 0 }, { x, y: y - r * 0.1, r, dark: i % 4 === 1 }];
    wrapped(ctx, w, x - r * 2.2, x + r * 2.2, () => {
      const r2 = seeded(seed);
      foliageMass(ctx, clumps, lit, k, r2, { inkWidth: LINE.form, marks: 1, density: 1.2 });
      grassTuft(ctx, x - r * 1.2, h - 2 * k, (14 + r2() * 8) * k, P.ink, k, r2, P.grassDark);
      grassTuft(ctx, x + r * 1.5, h - 2 * k, (12 + r2() * 8) * k, P.ink, k, r2, P.grassDark);
    });
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
  const k = h / 576;
  const wobble = (m, phase, amp) => (x) => amp * k * Math.sin((x / w) * TAU * m + phase);
  // bed boundaries (periodic): cap rock | soft bed | hard bed | soft bed | scree
  const y1 = ((f) => (x) => 168 * k + f(x))(wobble(2, rnd() * 6, 7));
  const y2 = ((f) => (x) => 292 * k + f(x))(wobble(1, rnd() * 6, 9));
  const y3 = ((f) => (x) => 404 * k + f(x))(wobble(3, rnd() * 6, 6));
  const y4 = ((f, g) => (x) => 506 * k + f(x) + g(x))(wobble(2, rnd() * 6, 12), wobble(5, rnd() * 6, 5));
  const top = h * 0.035;

  // ---- geometry
  const cap = splitColumns(w, 7, rnd).map((c) => {
    const yTop = top + (4 + rnd() * rnd() * 74) * k, tilt = jit(rnd, 9 * k), gap = (2 + rnd() * rnd() * 16) * k, cham = (5 + rnd() * 9) * k;
    const xm = (c.x0 + c.x1) / 2, foot = y1(xm) + jit(rnd, 9 * k);
    const pts = [[c.x0, foot], [c.x0 + gap * 0.2, yTop + 60 * k], [c.x0 + gap, yTop + cham + 4 * k], [c.x0 + gap + cham, yTop], [c.x1 - gap - cham * 1.4, yTop + tilt], [c.x1 - gap, yTop + tilt + cham * 1.5], [c.x1 - gap * 0.2, yTop + 70 * k], [c.x1, foot]];
    return { ...c, pts, yTop, foot, depth: 0.4 + rnd() * 0.6, seed: newSeed(rnd) };
  });
  const mid = splitColumns(w, 8, rnd).map((c) => {
    const xm = (c.x0 + c.x1) / 2, head = y2(xm) + jit(rnd, 8 * k), foot = y3(xm) + jit(rnd, 10 * k), cham = (4 + rnd() * 6) * k;
    const pts = [[c.x0, foot], [c.x0, head + cham], [c.x0 + cham, head], [c.x1 - cham, head + jit(rnd, 3 * k)], [c.x1, head + cham * 1.3], [c.x1, foot]];
    return { ...c, pts, yTop: head, foot, depth: 0.4 + rnd() * 0.6, seed: newSeed(rnd) };
  });

  /** Front of a protruding hard bed: sunlit face, shaded right flank, stains, joints and cracks. */
  const paintColumn = (c) => {
    const r = seeded(c.seed), trace = (g) => tracePolygon(g, c.pts), cw = c.x1 - c.x0, ch = c.foot - c.yTop;
    ctx.beginPath(); trace(ctx); ctx.fillStyle = P.rockLight; ctx.fill();
    clipped(ctx, trace, () => {
      // right flank turned away from the light, with a broken edge
      const flank = cw * (0.1 + 0.16 * c.depth), edge = [[c.x1 + 4, c.yTop - 4]];
      for (let i = 0; i <= 6; i++) edge.push([c.x1 - flank * (0.7 + r() * 0.6) - (i % 2 ? flank * 0.35 : 0), c.yTop + (ch * i) / 6]);
      edge.push([c.x1 + 4, c.foot + 4]);
      ctx.beginPath(); tracePolygon(ctx, edge); ctx.fillStyle = P.rock; ctx.fill();
      ctx.beginPath(); tracePolygon(ctx, edge.map(([x, y], i) => [i === 0 || i === edge.length - 1 ? x : x + flank * 0.5, y])); ctx.fillStyle = P.rockShade; ctx.fill();
      // weathering stains running down from the rim
      for (let i = 0; i < 3; i++) {
        const x = c.x0 + cw * (0.12 + r() * 0.6), len = ch * (0.25 + r() * 0.5), sw = (5 + r() * 9) * k;
        ctx.beginPath(); ctx.moveTo(x - sw, c.yTop - 2); ctx.lineTo(x + sw, c.yTop - 2); ctx.lineTo(x + sw * 0.6, c.yTop + len * 0.6); ctx.lineTo(x + sw * 0.1, c.yTop + len); ctx.lineTo(x - sw * 0.5, c.yTop + len * 0.5); ctx.closePath();
        ctx.fillStyle = P.rock; ctx.fill();
      }
      // bedding lines and vertical cracks
      for (let i = 0; i < 3; i++) {
        const y = c.yTop + ch * (0.2 + r() * 0.7), xa = c.x0 + cw * r() * 0.5, xb = xa + cw * (0.2 + r() * 0.4);
        brushStroke(ctx, [[xa, y], [(xa + xb) / 2, y + jit(r, 2 * k)], [xb, y + jit(r, 2 * k)]], LINE.hair * k * 1.5, { color: P.rockShade, taper: 0.4, swell: 0 });
      }
      for (let i = 0; i < 2; i++) {
        const x = c.x0 + cw * (0.2 + r() * 0.55), ya = c.yTop + ch * r() * 0.4, len = ch * (0.25 + r() * 0.4);
        brushStroke(ctx, [[x, ya], [x + jit(r, 4 * k), ya + len * 0.35], [x + jit(r, 5 * k), ya + len * 0.7], [x + jit(r, 5 * k), ya + len]], LINE.detail * k * 1.2, { color: P.ink, taperStart: 0.15, taperEnd: 0.6, swell: 0.2, seed: i });
      }
      // joint with the next column: heavier toward the foot
      brushStroke(ctx, [[c.x1 - 1.5 * k, c.yTop + ch * 0.1], [c.x1 - 1.5 * k + jit(r, 2 * k), c.yTop + ch * 0.5], [c.x1 - 1.5 * k, c.foot]], LINE.form * k * 1.6, { color: P.ink, taperStart: 0.5, taperEnd: 0.02, swell: 0.15 });
    });
  };
  /** Flat shadow thrown by an overhanging column on the recessed bed below it. */
  const paintOverhang = (c, color, reach) => {
    const r = seeded(c.seed + 7), d = reach * (0.5 + c.depth) * k;
    const pts = [[c.x0 - 1, c.foot - 14 * k], [c.x1 + 1, c.foot - 14 * k], [c.x1 + d * 0.55, c.foot + d * 0.8]];
    const teeth = 4;
    for (let i = 1; i <= teeth; i++) { const x = c.x1 + d * 0.55 - ((c.x1 - c.x0) * i) / teeth; pts.push([x + (c.x1 - c.x0) / teeth * 0.5, c.foot + d * (0.75 + r() * 0.5)], [x, c.foot + d * (0.5 + r() * 0.4)]); }
    ctx.beginPath(); tracePolygon(ctx, pts); ctx.fillStyle = color; ctx.fill();
  };
  const softBed = (ya, yb, seed) => {
    // recessed bed: fine strata drawn with broken pen lines, a few shaded niches
    const r = seeded(seed);
    for (let i = 0; i < 4; i++) {
      const x = r() * w, y = ya(x) + (yb(x) - ya(x)) * (0.45 + r() * 0.4), rx = (22 + r() * 30) * k, ry = (9 + r() * 10) * k;
      wrapped(ctx, w, x - rx * 1.3, x + rx * 1.3, () => {
        ctx.beginPath(); ctx.moveTo(x - rx, y + ry); ctx.quadraticCurveTo(x - rx * 0.8, y - ry * 1.4, x + rx * 0.2, y - ry); ctx.quadraticCurveTo(x + rx, y - ry * 0.6, x + rx * 1.1, y + ry); ctx.closePath();
        ctx.fillStyle = P.rockShade; ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - rx * 0.5, y + ry); ctx.quadraticCurveTo(x - rx * 0.3, y - ry * 0.5, x + rx * 0.3, y - ry * 0.4); ctx.quadraticCurveTo(x + rx * 0.8, y - ry * 0.1, x + rx * 0.9, y + ry); ctx.closePath();
        ctx.fillStyle = P.rockDeep; ctx.fill();
      });
    }
    for (let line = 0; line < 5; line++) {
      const f = (line + 0.5 + jit(r, 0.3)) / 5;
      let x = r() * 60 * k;
      while (x < w) {
        const len = (50 + r() * 150) * k, xa = x, xb = Math.min(x + len, w + 40 * k), width = LINE.hair * k * (1.2 + r() * 1.3), tone = r() < 0.3 ? P.ink : P.rockShade;
        const pts = [];
        for (let q = 0; q <= 6; q++) { const xx = xa + ((xb - xa) * q) / 6; pts.push([xx, ya(xx) + (yb(xx) - ya(xx)) * f + ((q * 7 + line * 3) % 5 - 2) * 0.7 * k]); }
        wrapped(ctx, w, xa, xb, () => brushStroke(ctx, pts, width, { color: tone, taper: 0.3, swell: 0.2 }));
        x = xb + (14 + r() * 60) * k;
      }
    }
  };

  // ---- painting, top to bottom
  // silhouette of the cap rock: contour first, heavier on the flanks turned away from the light
  for (const c of cap) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 8 * k, () => inkUnion(ctx, (g) => tracePolygon(g, c.pts), P.ink, LINE.silhouette, k, 1));
  ctx.fillStyle = P.rock; ctx.fillRect(0, 150 * k, w, h);
  for (const c of cap) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 8 * k, () => paintColumn(c));
  for (const c of cap) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 60 * k, () => paintOverhang(c, P.rockShade, 30));
  softBed(y1, y2, newSeed(rnd));
  for (const c of cap) {
    // pen line under the overhang
    wrapped(ctx, w, c.x0, c.x1, () => brushStroke(ctx, [[c.x0, c.foot], [(c.x0 + c.x1) / 2, c.foot + 1.5 * k], [c.x1, c.foot]], LINE.form * k * 1.5, { color: P.ink, taper: 0.12, swell: 0.3, seed: c.seed % 17 }));
  }
  // hard bed standing proud of the face: lit rim on top, contour underneath
  for (const c of mid) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 8 * k, () => inkUnion(ctx, (g) => tracePolygon(g, c.pts), P.ink, LINE.form, k, 1));
  for (const c of mid) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 8 * k, () => paintColumn(c));
  for (const c of mid) wrapped(ctx, w, c.x0 - 8 * k, c.x1 + 60 * k, () => paintOverhang(c, P.rockShade, 24));
  softBed(y3, y4, newSeed(rnd));
  for (const c of mid) wrapped(ctx, w, c.x0, c.x1, () => brushStroke(ctx, [[c.x0, c.foot], [(c.x0 + c.x1) / 2, c.foot + 1.5 * k], [c.x1, c.foot]], LINE.form * k * 1.4, { color: P.ink, taper: 0.12, swell: 0.3, seed: c.seed % 13 }));

  // scree at the foot of the wall
  const screeTop = [];
  for (let x = -w; x <= 2 * w; x += 16 * k) screeTop.push([x, y4(x)]);
  const traceScree = (g) => { g.moveTo(-w, h + 10); for (const p of screeTop) g.lineTo(p[0], p[1]); g.lineTo(2 * w, h + 10); g.closePath(); };
  inkUnion(ctx, traceScree, P.ink, LINE.form, k, 0);
  ctx.beginPath(); traceScree(ctx); ctx.fillStyle = P.rockLight; ctx.fill();
  clipped(ctx, traceScree, () => {
    for (let i = 0; i < 7; i++) {
      const x = ((i + rnd()) / 7) * w, y = y4(x) + (20 + rnd() * 40) * k, pts = ringPoints(x, y, (40 + rnd() * 40) * k, (10 + rnd() * 10) * k, 7, 0.2, rnd);
      wrapped(ctx, w, x - 100 * k, x + 100 * k, () => { ctx.beginPath(); tracePolygon(ctx, pts); ctx.fillStyle = P.rock; ctx.fill(); });
    }
  });
  for (let i = 0; i < 6; i++) {
    const x = ((i + rnd()) / 6) * w, y = y4(x) + (18 + rnd() * 44) * k, r = (7 + rnd() * 12) * k, pts = ringPoints(x, y, r, r * 0.7, 6, 0.18, rnd);
    wrapped(ctx, w, x - r * 2, x + r * 2, () => {
      inkUnion(ctx, (g) => tracePolygon(g, pts), P.ink, LINE.form, k, 0.7);
      ctx.beginPath(); tracePolygon(ctx, pts); ctx.fillStyle = P.rock; ctx.fill();
      clipped(ctx, (g) => tracePolygon(g, pts), () => {
        ctx.beginPath(); tracePolygon(ctx, pts.map(([px, py]) => [px - r * 0.3, py - r * 0.35])); ctx.fillStyle = P.rockLight; ctx.fill();
        ctx.beginPath(); tracePolygon(ctx, pts.map(([px, py]) => [px + r * 0.9, py + r * 0.5])); ctx.fillStyle = P.rockShade; ctx.fill();
      });
    });
  }
  // dry bushes on the ledges, on the rim and in the scree
  const bushes = [];
  for (const c of mid) if (bushes.length < 3 && rnd() < 0.5) bushes.push([c.x0 + (c.x1 - c.x0) * (0.3 + rnd() * 0.4), c.yTop + 2 * k, (13 + rnd() * 7) * k]);
  for (let i = 0; i < 3; i++) { const x = ((i + rnd()) / 3) * w; bushes.push([x, y4(x) + (8 + rnd() * 30) * k, (14 + rnd() * 9) * k]); }
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
