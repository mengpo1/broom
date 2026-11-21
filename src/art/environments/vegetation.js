// Vegetation drawings. Every painter has the signature (ctx, w, h, P, rnd, variant):
// it draws inside [0,w]x[0,h] with the ground line at the bottom edge, P is the theme palette
// (hex strings, art/palettes), rnd a seeded generator. Light comes from the upper left.
// Style rules: three flat tones per mass (light / base / shade), contour inked around the whole
// silhouette (heavier underneath), a few interior pen marks, no gradients.

import { LINE, sampleCurve, brushCurve, brushStroke, clipped, tracePolygon } from '../styles/ink.js';
import { shadeHex, mixHex } from '../palettes/palettes.js';

const TAU = Math.PI * 2;

function jit(rnd, amount) { return (rnd() - 0.5) * 2 * amount; }

/** Flat drop shadow on the ground under an object. */
export function groundShadow(ctx, cx, y, rx, ry) {
  ctx.fillStyle = 'rgba(22,22,36,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Contour of the union of the shapes added by `trace` ("stroke under the fill"): the caller
 * fills the shapes afterwards, so only the outer half of the stroke remains. A second, shifted
 * pass makes the line heavier underneath and on the side away from the light.
 */
export function inkUnion(ctx, trace, ink, width, k, drop = 1) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = ink;
  ctx.lineWidth = width * 1.5 * k;
  ctx.beginPath(); trace(ctx); ctx.stroke();
  if (drop > 0) { ctx.save(); ctx.translate(k * 0.9 * drop, k * 1.9 * drop); ctx.beginPath(); trace(ctx); ctx.stroke(); ctx.restore(); }
}

/** Vertices spread around an ellipse with irregular spacing and radius (clockwise on screen). */
export function ringPoints(cx, cy, rx, ry, count, jitter, rnd) {
  const pts = [], rot = rnd() * TAU;
  for (let i = 0; i < count; i++) {
    const a = rot + ((i + jit(rnd, 0.26)) / count) * TAU;
    const r = 1 + jit(rnd, jitter);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
}

/**
 * Leafy outline: a chain of convex bumps with crisp cusps between consecutive vertices
 * (vertices must run clockwise on screen so the bumps point outward). Does not begin/fill.
 */
export function traceScallops(ctx, pts, bulge = 0.3, dx = 0, dy = 0) {
  const n = pts.length;
  ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    ctx.quadraticCurveTo((a[0] + b[0]) / 2 + ey * bulge * 2 + dx, (a[1] + b[1]) / 2 - ex * bulge * 2 + dy, b[0] + dx, b[1] + dy);
  }
  ctx.closePath();
}

function bumpCount(r, k, density) { return Math.max(6, Math.round((r / k) * 0.13 * density + 2)); }

/**
 * Geometry of one foliage clump {x, y, r, squash, dark}: scalloped outline, base and light
 * patches shifted toward the light, and the arcs of a few leaf marks. Pure data (no drawing),
 * so that tiling strips can draw wrapped copies of the same clump.
 */
export function buildClump(c, k, rnd, options = {}) {
  const density = options.density ?? 1, marks = options.marks ?? 2;
  const ry = c.r * (c.squash ?? 0.86);
  const clump = {
    c,
    outline: ringPoints(c.x, c.y, c.r, ry, bumpCount(c.r, k, density), 0.08, rnd),
    base: ringPoints(c.x - c.r * 0.17, c.y - ry * 0.24, c.r * 0.84, ry * 0.78, bumpCount(c.r * 0.8, k, density), 0.1, rnd),
    light: ringPoints(c.x - c.r * 0.3, c.y - ry * 0.42, c.r * 0.52, ry * 0.42, bumpCount(c.r * 0.5, k, density), 0.14, rnd),
    marks: [],
  };
  for (let m = 0; m < marks; m++) {
    // short scalloped pen strokes hugging the shadow side of the clump
    const a = 0.15 + rnd() * 1.5, rr = c.r * (0.42 + rnd() * 0.4), span = 0.3 + rnd() * 0.3;
    const pts = [];
    for (let q = 0; q <= 4; q++) { const t = a + (q / 4 - 0.5) * span; pts.push([c.x + Math.cos(t) * rr, c.y + Math.sin(t) * rr * 0.86]); }
    clump.marks.push({ pts, width: LINE.detail * k * (0.8 + rnd() * 0.5), seed: m });
  }
  return clump;
}

/** Paint one built clump (three tones and leaf marks) at a horizontal offset. `tones` = [shade, base, light]. */
export function paintClump(ctx, clump, tones, ink, dx = 0) {
  const one = (g) => traceScallops(g, clump.outline, 0.3, dx, 0);
  ctx.beginPath(); one(ctx); ctx.fillStyle = tones[0]; ctx.fill();
  clipped(ctx, one, () => {
    ctx.beginPath(); traceScallops(ctx, clump.base, 0.3, dx, 0); ctx.fillStyle = tones[1]; ctx.fill();
    ctx.beginPath(); traceScallops(ctx, clump.light, 0.32, dx, 0); ctx.fillStyle = tones[2]; ctx.fill();
    if (ink) {
      for (const m of clump.marks) brushCurve(ctx, dx ? m.pts.map((p) => [p[0] + dx, p[1]]) : m.pts, m.width, { color: ink, taper: 0.4, seed: m.seed });
    }
  });
}

/**
 * Foliage mass built from overlapping clumps. clumps: [{x, y, r, squash, dark}], painted in the
 * given order (back to front). Draws the inked silhouette of the union, then every clump in three
 * tones shifted toward the light (dark clumps use deep / shade / base), then leaf marks.
 */
export function foliageMass(ctx, clumps, colors, k, rnd, options = {}) {
  const built = clumps.map((c) => buildClump(c, k, rnd, options));
  const trace = (g) => { for (const b of built) traceScallops(g, b.outline, 0.3); };
  inkUnion(ctx, trace, colors.ink, options.inkWidth ?? LINE.silhouette, k);
  const lit = [colors.shade, colors.base, colors.light], dim = [colors.deep || colors.shade, colors.shade, colors.base];
  for (const b of built) paintClump(ctx, b, b.c.dark ? dim : lit, colors.ink);
}

/** Tuft of grass blades (tapered pen strokes fanning out of one point). */
export function grassTuft(ctx, x, y, size, ink, k, rnd, fill) {
  const blades = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < blades; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / blades - 0.5) * 1.7 + jit(rnd, 0.12), len = size * (0.6 + rnd() * 0.5);
    const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len], mid = [x + Math.cos(a) * len * 0.5 + (i - blades / 2) * k * 0.6, y + Math.sin(a) * len * 0.55];
    if (fill) brushStroke(ctx, [[x + (i - blades / 2) * 1.6 * k, y], mid, tip], LINE.silhouette * k, { color: fill, taperStart: 0, taperEnd: 0.7, swell: 0 });
    brushStroke(ctx, [[x + (i - blades / 2) * 1.6 * k, y], mid, tip], LINE.detail * k, { color: ink, taperStart: 0.05, taperEnd: 0.6, swell: 0 });
  }
}

/** Tree trunk: flared foot, shaded right side, a few bark strokes. */
export function trunk(ctx, x, yBase, yTop, wBase, wTop, P, k, rnd, lean = 0) {
  const H = yBase - yTop;
  const left = [[x - wBase * 0.95, yBase], [x - wBase * 0.56, yBase - H * 0.1], [x - wTop * 0.52 + lean * 0.45, yBase - H * 0.55], [x - wTop * 0.5 + lean, yTop]];
  const right = [[x + wTop * 0.5 + lean, yTop], [x + wTop * 0.52 + lean * 0.45, yBase - H * 0.55], [x + wBase * 0.58, yBase - H * 0.1], [x + wBase * 1.05, yBase]];
  const pts = sampleCurve(left, 5).concat(sampleCurve(right, 5));
  const trace = (g) => tracePolygon(g, pts);
  ctx.beginPath(); trace(ctx);
  ctx.fillStyle = P.trunk; ctx.fill();
  clipped(ctx, trace, () => {
    // shaded side with a ragged bark edge
    const edge = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; edge.push([x + lean * t + wTop * 0.06 + (i % 2 ? -1 : 1) * wTop * 0.09 + jit(rnd, wTop * 0.05), yBase - H * t]); }
    ctx.beginPath(); ctx.moveTo(x + wBase * 2, yBase); for (const p of edge) ctx.lineTo(p[0], p[1]); ctx.lineTo(x + wBase * 2, yTop); ctx.closePath();
    ctx.fillStyle = P.trunkShade; ctx.fill();
    // cast shadow of the crown on the top of the trunk
    ctx.fillRect(x - wBase * 2, yTop - 1, wBase * 4, H * 0.16);
  });
  ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.form * k; ctx.lineJoin = 'round';
  ctx.beginPath(); trace(ctx); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const t = 0.12 + rnd() * 0.55, yy = yBase - H * t, xx = x + lean * t + jit(rnd, wTop * 0.3);
    brushStroke(ctx, [[xx, yy], [xx + jit(rnd, 1.5 * k), yy - (10 + rnd() * 12) * k]], LINE.hair * k * 1.2, { color: P.ink, taper: 0.45 });
  }
}

// ---------------------------------------------------------------------------- broadleaf trees

const BROADLEAF_CROWNS = [
  // variant 0: broad round oak. [x, y, r, dark] in crown units (x * crownR, y * crownH, r * crownR)
  [[-0.38, 0.62, 0.34, 1], [0.36, 0.64, 0.36, 1], [0.0, 0.7, 0.3, 1], [-0.74, 0.12, 0.36, 0], [0.74, 0.16, 0.36, 0], [0.46, -0.34, 0.42, 0], [-0.44, -0.38, 0.44, 0], [0.02, 0.06, 0.52, 0], [0.04, -0.66, 0.4, 0]],
  // variant 1: tall egg-shaped crown (lime, hornbeam)
  [[-0.3, 0.72, 0.36, 1], [0.34, 0.7, 0.38, 1], [-0.62, 0.3, 0.4, 0], [0.64, 0.3, 0.4, 0], [0.5, -0.16, 0.42, 0], [-0.5, -0.2, 0.44, 0], [0.0, 0.2, 0.5, 0], [0.24, -0.56, 0.38, 0], [-0.2, -0.6, 0.4, 0], [0.02, -0.9, 0.3, 0]],
  // variant 2: spreading, lopsided crown with a low side bough
  [[-0.2, 0.62, 0.3, 1], [0.4, 0.5, 0.34, 1], [-0.86, 0.52, 0.27, 0], [0.8, 0.06, 0.34, 0], [-0.52, -0.08, 0.4, 0], [0.4, -0.3, 0.44, 0], [0.1, 0.1, 0.42, 0], [-0.16, -0.62, 0.4, 0], [0.34, -0.74, 0.28, 0]],
];

function broadleaf(ctx, w, h, P, rnd, variant) {
  const k = w / 352;
  const cx = w * (0.5 + (rnd() - 0.5) * 0.03);
  groundShadow(ctx, cx + 10 * k, h - 7 * k, w * (variant === 1 ? 0.28 : 0.34), 7 * k);
  const crownY = h * [0.4, 0.43, 0.39][variant], crownR = w * [0.385, 0.33, 0.37][variant], crownH = h * [0.29, 0.34, 0.27][variant];
  const lean = jit(rnd, 6 * k) + (variant === 2 ? 8 * k : 0);
  const forkY = crownY + crownH * (variant === 2 ? 0.62 : 0.5);
  // main boughs showing under the crown (drawn first: the trunk and the foliage cover their ends)
  const boughs = variant === 2 ? [[-1, 0.86, 0.5], [1, 0.5, 0.1], [-1, 0.3, -0.1]] : [[-1, 0.5, 0.2], [1, 0.55, 0.25]];
  for (const [side, reach, rise] of boughs) {
    const pts = [[cx + lean, forkY + 26 * k], [cx + lean + side * crownR * reach * 0.45, crownY + crownH * (0.52 + rise * 0.5)], [cx + side * crownR * reach, crownY + crownH * rise]];
    brushCurve(ctx, pts, 15 * k, { color: P.ink, taperStart: 0, taperEnd: 0.6, swell: 0.05 });
    brushCurve(ctx, pts, 10 * k, { color: P.trunkShade, taperStart: 0, taperEnd: 0.6, swell: 0.05 });
  }
  trunk(ctx, cx, h - 8 * k, forkY, 30 * k, 18 * k, P, k, rnd, lean);
  const clumps = BROADLEAF_CROWNS[variant].map(([x, y, r, dark]) => ({
    x: cx + (x + jit(rnd, 0.05)) * crownR, y: crownY + (y + jit(rnd, 0.05)) * crownH, r: crownR * r * (0.94 + rnd() * 0.12), dark: !!dark,
  }));
  foliageMass(ctx, clumps, { ink: P.ink, shade: P.leafShade, base: P.leaf, light: P.leafLight, deep: P.leafDeep }, k, rnd);
  grassTuft(ctx, cx - 24 * k, h - 6 * k, 13 * k, P.ink, k, rnd);
  grassTuft(ctx, cx + 30 * k, h - 5 * k, 10 * k, P.ink, k, rnd);
}

// ------------------------------------------------------------------------------------ conifers

/** Outline of one tier of drooping boughs: apex on the trunk, pointed tips, saw-toothed sagging lower edge. */
function tierOutline(cx, yTop, yBot, hwL, hwR, teeth, rnd) {
  const H = yBot - yTop, sag = H * 0.2, depth = H * 0.19, span = hwL + hwR, edgeY = yBot - sag - depth;
  const pts = sampleCurve([[cx - 1, yTop], [cx - hwL * 0.26, yTop + H * 0.34], [cx - hwL * 0.7, edgeY - H * 0.1], [cx - hwL, edgeY + depth * 0.25]], 4);
  const firstTooth = pts.length;
  for (let j = 0; j < teeth; j++) {
    const u0 = 0.05 + ((j + jit(rnd, 0.1)) / teeth) * 0.9, u = 0.05 + ((j + 0.5 + jit(rnd, 0.12)) / teeth) * 0.9;
    const d = depth * (0.7 + rnd() * 0.6) * (0.5 + 0.5 * Math.sin(Math.PI * u));
    pts.push([cx - hwL + Math.max(0.04, u0) * span, edgeY + sag * Math.sin(Math.PI * u0) - d * 0.25]);
    pts.push([cx - hwL + u * span + (u - 0.5) * d * 1.2, edgeY + sag * Math.sin(Math.PI * u) + d]);
  }
  pts.push([cx + hwR - span * 0.04, edgeY - depth * 0.1]);
  const lastTooth = pts.length;
  for (const p of sampleCurve([[cx + hwR, edgeY + depth * 0.25], [cx + hwR * 0.7, edgeY - H * 0.1], [cx + hwR * 0.26, yTop + H * 0.34], [cx + 1, yTop]], 4)) pts.push(p);
  return { pts, firstTooth, lastTooth, cx, yTop, yBot, hw: span / 2 };
}

const PINE_SHAPES = [
  // variant 0: full spruce, skirt down to a short bare trunk. widths per tier (fraction of the widest), top first
  { widths: [0.15, 0.28, 0.41, 0.54, 0.67, 0.8, 0.91, 1], top: 12, bare: 40, maxHw: 96, overlap: 0.7, asym: 0.07, teeth: [2, 3, 4, 5, 5, 6, 7, 7] },
  // variant 1: old pine, long bare trunk, fewer and uneven tiers that let the trunk show
  { widths: [0.2, 0.5, 0.84, 0.66, 0.96, 0.7], top: 14, bare: 138, maxHw: 80, overlap: 0.3, asym: 0.2, teeth: [2, 4, 5, 4, 6, 4] },
];

function pine(ctx, w, h, P, rnd, variant) {
  const k = w / 224, shape = PINE_SHAPES[variant] || PINE_SHAPES[0];
  const cx = w * 0.5 + jit(rnd, 3 * k), ground = h - 8 * k;
  const top = shape.top * k, bottom = ground - shape.bare * k, n = shape.widths.length;
  groundShadow(ctx, cx + 8 * k, h - 6 * k, shape.maxHw * k * (variant === 1 ? 0.7 : 0.92), 6 * k);
  const deep = shadeHex(P.pineShade, 0.3, P.ink);
  // tiers, top first
  const tiers = [];
  const spacing = (bottom - top) / (n + 0.25);
  for (let i = 0; i < n; i++) {
    const yBot = top + spacing * (i + 1.25) + jit(rnd, spacing * 0.05);
    const tierH = spacing * (1 + shape.overlap) * (i === 0 ? 0.9 : 1);
    const hw = shape.maxHw * k * shape.widths[i], skew = jit(rnd, shape.asym) + (variant === 1 ? (i % 2 ? 0.14 : -0.14) : 0);
    tiers.push(tierOutline(cx + (variant === 1 ? jit(rnd, 4 * k) : 0), Math.max(top, yBot - tierH), yBot, hw * (1 - skew), hw * (1 + skew), shape.teeth[i], rnd));
  }
  // trunk (runs up behind the tiers) and leader shoot
  const trunkTop = tiers[1].yTop, tw = (variant === 1 ? 17 : 15) * k;
  const trunkPts = [[cx - tw * 0.95, ground], [cx - tw * 0.55, ground - 16 * k], [cx - tw * 0.2, trunkTop], [cx + tw * 0.2, trunkTop], [cx + tw * 0.55, ground - 16 * k], [cx + tw, ground]];
  const stubs = [];
  if (variant === 1) {
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1, y = ground - (34 + i * 27 + rnd() * 10) * k, len = (13 + rnd() * 12) * k;
      stubs.push([[cx + side * tw * 0.3, y], [cx + side * (tw * 0.4 + len * 0.6), y - len * 0.2], [cx + side * (tw * 0.4 + len), y - len * 0.55]]);
    }
  }
  const traceAll = (g) => { tracePolygon(g, trunkPts); for (const t of tiers) tracePolygon(g, t.pts); };
  inkUnion(ctx, traceAll, P.ink, LINE.silhouette, k);
  for (const s of stubs) brushCurve(ctx, s, 6.5 * k, { color: P.ink, taperStart: 0, taperEnd: 0.5, swell: 0 });
  // trunk tones
  const traceTrunk = (g) => tracePolygon(g, trunkPts);
  ctx.beginPath(); traceTrunk(ctx); ctx.fillStyle = P.trunk; ctx.fill();
  clipped(ctx, traceTrunk, () => { ctx.fillStyle = P.trunkShade; ctx.fillRect(cx + tw * 0.08, 0, tw * 2, h); ctx.fillRect(cx - tw * 2, bottom - 2 * k, tw * 4, 16 * k); });
  for (const s of stubs) brushCurve(ctx, s, 3.4 * k, { color: P.trunkShade, taperStart: 0, taperEnd: 0.5, swell: 0 });
  for (let i = 0; i < 3; i++) {
    const yy = ground - (10 + rnd() * (shape.bare - 16)) * k, xx = cx - tw * 0.2 + jit(rnd, tw * 0.12);
    brushStroke(ctx, [[xx, yy], [xx + jit(rnd, k), yy - (9 + rnd() * 9) * k]], LINE.hair * k * 1.2, { color: P.ink, taper: 0.45 });
  }
  // tiers from the lowest to the highest; each one throws a flat shadow on those below
  for (let i = n - 1; i >= 0; i--) {
    const t = tiers[i], one = (g) => tracePolygon(g, t.pts);
    ctx.beginPath(); one(ctx); ctx.fillStyle = P.pineShade; ctx.fill();
    clipped(ctx, one, () => {
      const H = t.yBot - t.yTop;
      ctx.fillStyle = P.pine;
      ctx.beginPath(); tracePolygon(ctx, t.pts.map((p) => [t.cx + (p[0] - t.cx) * 0.84 - t.hw * 0.13, t.yTop + (p[1] - t.yTop) * 0.87])); ctx.fill();
      ctx.fillStyle = P.pineLight;
      ctx.beginPath(); tracePolygon(ctx, t.pts.map((p) => [t.cx + (p[0] - t.cx) * 0.5 - t.hw * 0.36, t.yTop + (p[1] - t.yTop) * 0.66 + H * 0.02])); ctx.fill();
      // needle sprays: short strokes following the boughs on the shadow side
      for (let m = 0; m < 2; m++) {
        const u = 0.52 + rnd() * 0.36, x0 = t.cx + (u - 0.5) * t.hw * 1.5, y0 = t.yTop + H * (0.5 + rnd() * 0.22);
        brushStroke(ctx, [[x0, y0], [x0 + (u - 0.5) * H * 0.3, y0 + H * 0.12], [x0 + (u - 0.5) * H * 0.56, y0 + H * 0.26]], LINE.detail * k, { color: P.ink, taper: 0.45, seed: m });
      }
    });
    if (i > 0) {
      const up = tiers[i - 1], drop = (up.yBot - up.yTop) * 0.2;
      const lower = (g) => { for (let j = i; j < n; j++) tracePolygon(g, tiers[j].pts); tracePolygon(g, trunkPts); };
      clipped(ctx, lower, () => {
        ctx.beginPath(); tracePolygon(ctx, up.pts.map((p) => [p[0] + drop * 0.25, p[1] + drop])); ctx.fillStyle = deep; ctx.fill();
        // pen line under the boughs above, fading out on the lit side
        const edge = up.pts.slice(up.firstTooth - 1, up.lastTooth + 1);
        brushStroke(ctx, edge, (s) => LINE.form * k * 2 * (0.25 + 0.75 * s), { color: P.ink, taperStart: 0.4, taperEnd: 0, swell: 0, minRatio: 0.05 });
      });
    }
  }
  grassTuft(ctx, cx - 16 * k, h - 6 * k, 11 * k, P.ink, k, rnd);
}

function cypress(ctx, w, h, P, rnd) {
  const k = w / 128, cx = w * 0.5, ground = h - 8 * k, top = 14 * k, bottom = ground - 20 * k, H = bottom - top, maxHw = 43 * k;
  groundShadow(ctx, cx + 5 * k, h - 6 * k, 40 * k, 5.5 * k);
  const profile = sampleCurve([[0, 0.02], [0.08, 0.2], [0.25, 0.52], [0.45, 0.82], [0.66, 1], [0.84, 0.94], [0.95, 0.7], [1, 0.34]], 6);
  const hwAt = (t) => { const f = Math.min(profile.length - 1.001, Math.max(0, t) * (profile.length - 1)), i = Math.floor(f); return (profile[i][1] + (profile[i + 1][1] - profile[i][1]) * (f - i)) * maxHw; };
  const sway = (t) => Math.pow(1 - t, 2.2) * 7 * k;                       // the tip leans away from the wind
  // flame-shaped tufts pointing upward along both flanks
  const tufts = 11, sides = [[], []];
  for (let s = 0; s < 2; s++) {
    for (let j = 0; j <= tufts; j++) {
      const t = Math.min(1, (j + (s ? 0.45 : 0) + jit(rnd, 0.12)) / tufts);
      const tn = Math.min(1, t + (0.7 + rnd() * 0.12) / tufts), sign = s ? 1 : -1;
      sides[s].push({ tip: [cx + sway(t) + sign * hwAt(t) * (1.02 + rnd() * 0.1), top + H * t], notch: [cx + sway(tn) + sign * hwAt(tn) * (0.8 + rnd() * 0.06), top + H * tn] });
    }
  }
  const trace = (g) => {
    g.moveTo(cx + sway(0), top - 6 * k);
    for (const f of sides[1]) { g.lineTo(f.tip[0], f.tip[1]); g.quadraticCurveTo(f.tip[0] + 3 * k, (f.tip[1] + f.notch[1]) / 2 + 3 * k, f.notch[0], f.notch[1]); }
    g.quadraticCurveTo(cx + 6 * k, bottom + 9 * k, cx - 4 * k, bottom + 7 * k);
    for (let j = sides[0].length - 1; j >= 0; j--) { const f = sides[0][j]; g.lineTo(f.notch[0], f.notch[1]); g.quadraticCurveTo(f.tip[0] - 3 * k, (f.tip[1] + f.notch[1]) / 2 + 3 * k, f.tip[0], f.tip[1]); }
    g.closePath();
  };
  const trunkPts = [[cx - 9 * k, ground], [cx - 5 * k, bottom - 4 * k], [cx + 5 * k, bottom - 4 * k], [cx + 10 * k, ground]];
  inkUnion(ctx, (g) => { trace(g); tracePolygon(g, trunkPts); }, P.ink, LINE.silhouette, k);
  ctx.beginPath(); tracePolygon(ctx, trunkPts); ctx.fillStyle = P.trunkShade; ctx.fill();
  ctx.fillStyle = P.trunk; ctx.fillRect(cx - 6 * k, bottom + 12 * k, 5 * k, ground - bottom - 12 * k);
  ctx.beginPath(); trace(ctx); ctx.fillStyle = P.cypressShade; ctx.fill();
  const flame = (x, y, len, wd, color) => {
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + wd * 1.1, y - len * 0.3, x + wd * 0.5, y - len);
    ctx.quadraticCurveTo(x - wd * 0.5, y - len * 0.45, x, y);
    ctx.fillStyle = color; ctx.fill();
  };
  clipped(ctx, trace, () => {
    const scaled = (sx, shift, lift, color) => {
      ctx.save(); ctx.translate(cx + shift, top + lift); ctx.scale(sx, 1); ctx.translate(-cx, -top);
      ctx.beginPath(); trace(ctx); ctx.fillStyle = color; ctx.fill(); ctx.restore();
    };
    scaled(0.82, -maxHw * 0.2, -4 * k, P.cypress);
    scaled(0.42, -maxHw * 0.5, 6 * k, P.cypressLight);
    // tongues of foliage breaking the tone boundaries
    for (let i = 0; i < 9; i++) {
      const t = 0.14 + (i + rnd() * 0.7) / 9 * 0.82, hw = hwAt(t), y = top + H * t, x = cx + sway(t);
      flame(x + hw * (0.3 + rnd() * 0.25), y, (26 + rnd() * 22) * k, (7 + rnd() * 4) * k, P.cypress);
      flame(x - hw * (0.1 + rnd() * 0.3), y + 10 * k, (22 + rnd() * 20) * k, (6 + rnd() * 4) * k, i % 2 ? P.cypressShade : P.cypressLight);
      if (i % 3 === 0) flame(x - hw * 0.62, y + 4 * k, (20 + rnd() * 14) * k, 5 * k, P.cypress);
    }
    for (let i = 0; i < 8; i++) {
      const t = 0.2 + (i + rnd() * 0.6) / 8 * 0.76, hw = hwAt(t), y = top + H * t, x = cx + sway(t) + hw * (rnd() * 0.75 - 0.15), len = (20 + rnd() * 22) * k;
      brushCurve(ctx, [[x, y], [x + 4 * k, y - len * 0.5], [x + 2 * k, y - len]], LINE.detail * k * (0.8 + rnd() * 0.5), { color: P.ink, taperStart: 0.2, taperEnd: 0.6, seed: i });
    }
  });
  grassTuft(ctx, cx - 13 * k, h - 6 * k, 9 * k, P.ink, k, rnd);
}

// --------------------------------------------------------------------------------------- palms

/** Polygon of a ribbon of varying width along a polyline: returns { left, right, poly }. */
function ribbon(pts, widthAt) {
  const n = pts.length, left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const hw = widthAt(i / (n - 1), i) * 0.5;
    left.push([pts[i][0] + ty * hw, pts[i][1] - tx * hw]);
    right.push([pts[i][0] - ty * hw, pts[i][1] + tx * hw]);
  }
  return { left, right, poly: left.concat(right.slice().reverse()) };
}

/**
 * Geometry of a feather frond: an arching midrib bent by its own weight, fringed with leaflets
 * that hang from it (long on the underside, short above). `hang` is the pull of gravity on the
 * leaflets (0 = stiff herring-bone, 0.7 = limp fringe). Returns { rib, poly, top }.
 */
function buildFrond(x0, y0, angle, length, droop, leaf, pairs, hang, rnd) {
  const sign = Math.cos(angle) >= 0 ? 1 : -1, steps = pairs * 2;
  const rib = [], sideA = [], sideB = [];
  let x = x0, y = y0;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps, th = angle + sign * droop * Math.pow(s, 1.6);
    const tx = Math.cos(th), ty = Math.sin(th);
    rib.push([x, y]);
    const prof = Math.pow(Math.sin(Math.PI * Math.pow(0.05 + s * 0.95, 0.66)), 0.6);
    const isTip = i % 2 === 1, reach = isTip ? 0.84 + rnd() * 0.3 : 0.3;
    for (let q = 0; q < 2; q++) {
      const nx = q ? -ty : ty, ny = q ? tx : -tx;                        // q = 0: left of the direction of growth
      const weight = 0.6 + 0.4 * ny;                                      // leaflets under the midrib are longer
      const sweep = isTip ? 0.62 : 0.15;
      const lx = nx * 0.6 + tx * sweep, ly = ny * 0.6 + ty * sweep + hang * (isTip ? 1 : 0.4);
      const l = Math.hypot(lx, ly) || 1, len = leaf * prof * weight * reach;
      (q ? sideB : sideA).push([x + (lx / l) * len, y + (ly / l) * len]);
    }
    x += tx * length / steps; y += ty * length / steps;
  }
  // the side that faces the sky carries the light tone
  const mid = Math.floor(steps / 2), upper = sideA[mid][1] < sideB[mid][1] ? sideA : sideB;
  return { rib, poly: sideA.concat(sideB.slice().reverse()), top: upper.concat(rib.slice().reverse()) };
}

// fronds: [angle in degrees (0 = right, -90 = up), droop in radians, relative length, layer]
// layers: 0 back (shaded), 1 arching sides, 2 front (lit), 3 old hanging fronds, 4 dry skirt
const PALM_SHAPES = [
  // variant 0: slender coconut palm, curved trunk leaning to the right, long limp fronds
  { trunk: [[-46, 0], [-38, -90], [-18, -200], [8, -316]], base: 26, mid: 15, tip: 12, frond: 142, leaf: 46, pairs: 11, hang: 0.62,
    fronds: [[-98, 0.5, 0.62, 0], [-66, 0.7, 0.7, 0], [-128, 0.7, 0.7, 0], [-152, 1.15, 0.95, 1], [-30, 1.15, 0.95, 1], [-172, 1.45, 0.86, 1], [-8, 1.45, 0.86, 1],
      [-112, 1.0, 0.82, 2], [-58, 1.05, 0.84, 2], [-86, 0.8, 0.66, 2], [158, 1.2, 0.7, 3], [24, 1.2, 0.68, 3]] },
  // variant 1: stout date palm, thick scaly trunk, dense round crown of stiff fronds, dry skirt
  { trunk: [[16, 0], [12, -80], [2, -170], [-8, -258]], base: 35, mid: 27, tip: 34, frond: 130, leaf: 36, pairs: 12, hang: 0.22,
    fronds: [[146, 0.5, 0.5, 4], [34, 0.5, 0.5, 4], [-90, 0.2, 0.74, 0], [-62, 0.3, 0.8, 0], [-118, 0.3, 0.8, 0], [-36, 0.45, 0.86, 0], [-144, 0.45, 0.86, 0],
      [-162, 0.75, 0.96, 1], [-18, 0.75, 0.96, 1], [-180, 0.95, 0.9, 1], [0, 0.95, 0.9, 1], [-104, 0.4, 0.84, 2], [-76, 0.4, 0.84, 2], [-132, 0.6, 0.92, 2], [-48, 0.6, 0.92, 2],
      [164, 0.8, 0.74, 3], [16, 0.8, 0.74, 3]] },
];

function palm(ctx, w, h, P, rnd, variant) {
  const k = w / 288, shape = PALM_SHAPES[variant] || PALM_SHAPES[0];
  const cx = w * 0.5, ground = h - 8 * k;
  const line = sampleCurve(shape.trunk.map(([x, y]) => [cx + x * k, ground + y * k]), 9);
  const crown = line[line.length - 1];
  groundShadow(ctx, line[0][0] + 14 * k, h - 6 * k, 60 * k, 6 * k);
  const scaly = variant === 1;
  const widthAt = (t, i) => {
    const flare = Math.pow(Math.max(0, 1 - t * 7), 2);
    const body = t < 0.5 ? shape.mid + (shape.base * 0.72 - shape.mid) * Math.pow(1 - t * 2, 1.5) : shape.mid + (shape.tip - shape.mid) * Math.pow((t - 0.5) * 2, scaly ? 3 : 1);
    return (body + flare * shape.base * 0.5) * k * (scaly ? (i % 2 ? 1.07 : 0.95) : 1);
  };
  const trunkShape = ribbon(line, widthAt);
  const fronds = shape.fronds.map(([deg, droop, len, layer]) => {
    const f = buildFrond(crown[0] + jit(rnd, 3 * k), crown[1] + jit(rnd, 3 * k), (deg + jit(rnd, 4)) * Math.PI / 180, shape.frond * k * len * (0.95 + rnd() * 0.1),
      droop * (0.92 + rnd() * 0.16), shape.leaf * k * (layer === 4 ? 0.8 : 1), layer === 4 ? 7 : shape.pairs, layer === 4 ? 0.5 : shape.hang, rnd);
    f.layer = layer;
    return f;
  });
  const order = [1, 2, 3, 4, 0];                                           // painting rank of each layer (dry skirt first)
  fronds.sort((a, b) => order[a.layer] - order[b.layer]);
  const heart = ringPoints(crown[0], crown[1] + 3 * k, (scaly ? 19 : 14) * k, (scaly ? 15 : 12) * k, 7, 0.08, rnd);
  const traceAll = (g) => { tracePolygon(g, trunkShape.poly); for (const f of fronds) tracePolygon(g, f.poly); traceScallops(g, heart, 0.2); };
  inkUnion(ctx, traceAll, P.ink, LINE.form * 1.2, k, 0.8);
  // trunk: three tones and ring scars
  const traceTrunk = (g) => tracePolygon(g, trunkShape.poly);
  ctx.beginPath(); traceTrunk(ctx); ctx.fillStyle = P.palmTrunk; ctx.fill();
  clipped(ctx, traceTrunk, () => {
    const last = line.length - 1;
    const band = (from, to, color) => {
      const a = line.map((p, i) => [p[0] + widthAt(i / last, i) * from, p[1]]), b = line.map((p, i) => [p[0] + widthAt(i / last, i) * to, p[1]]);
      ctx.beginPath(); tracePolygon(ctx, a.concat(b.reverse())); ctx.fillStyle = color; ctx.fill();
    };
    band(0.12, 0.8, P.palmTrunkShade);
    band(-0.8, -0.2, P.palmTrunkLight);
    // shadow of the crown on the top of the trunk
    ctx.fillStyle = P.palmTrunkShade;
    ctx.beginPath(); ctx.ellipse(crown[0], crown[1] + 4 * k, 44 * k, (scaly ? 40 : 30) * k, 0, 0, TAU); ctx.fill();
    const rings = scaly ? 14 : 17;
    for (let r = 1; r < rings; r++) {
      const t = Math.pow(r / rings, 0.9), f = t * last, i = Math.min(last - 1, Math.floor(f)), u = f - i;
      const L = trunkShape.left, R = trunkShape.right;
      const a = [L[i][0] + (L[i + 1][0] - L[i][0]) * u, L[i][1] + (L[i + 1][1] - L[i][1]) * u], b = [R[i][0] + (R[i + 1][0] - R[i][0]) * u, R[i][1] + (R[i + 1][1] - R[i][1]) * u];
      const up = Math.hypot(b[0] - a[0], b[1] - a[1]) * (scaly ? 0.3 : 0.2);
      if (scaly) {
        // chevrons of old leaf bases
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + up];
        brushStroke(ctx, [a, [(a[0] + m[0]) / 2, (a[1] + m[1]) / 2 - up * 0.2], m, [(b[0] + m[0]) / 2, (b[1] + m[1]) / 2 - up * 0.2], b], LINE.detail * k * 1.1, { color: P.ink, taperStart: 0.35, taperEnd: 0.05, swell: 0 });
      } else {
        const start = r % 3 === 0 ? 0 : 0.3 + rnd() * 0.25;
        const a2 = [a[0] + (b[0] - a[0]) * start, a[1] + (b[1] - a[1]) * start];
        brushCurve(ctx, [a2, [(a2[0] + b[0]) / 2, (a2[1] + b[1]) / 2 - up], b], LINE.detail * k * (0.9 + rnd() * 0.4), { color: P.ink, taperStart: 0.5, taperEnd: 0.04, swell: 0 });
      }
    }
  });
  // fronds, back to front: [underside, sky side] tones per layer
  const tones = [[P.palmShade, P.palm], [P.palm, P.palmLight], [P.palm, P.palmLight], [P.palmShade, P.palm], [P.dryShade, P.dry]];
  for (const f of fronds) {
    const [low, high] = tones[f.layer];
    ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.detail * k * 1.25;
    ctx.beginPath(); tracePolygon(ctx, f.poly); ctx.stroke();
    ctx.fillStyle = low; ctx.fill();
    ctx.beginPath(); tracePolygon(ctx, f.top); ctx.fillStyle = high; ctx.fill();
    brushStroke(ctx, f.rib, LINE.detail * k * 1.5, { color: f.layer === 4 ? P.ink : shadeHex(low, 0.55, P.ink), taperStart: 0.02, taperEnd: 0.45, swell: 0 });
  }
  // heart of the crown and fruit
  ctx.beginPath(); traceScallops(ctx, heart, 0.2); ctx.fillStyle = P.palmShade; ctx.fill();
  if (scaly) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = crown[0] + side * (16 + i * 5) * k, len = (30 + rnd() * 14) * k;
        const strand = [[crown[0] + side * 8 * k, crown[1] + 8 * k], [x + side * 5 * k, crown[1] + 10 * k + len * 0.35], [x + side * 2 * k, crown[1] + 10 * k + len]];
        brushCurve(ctx, strand, 4.4 * k, { color: P.ink, taperStart: 0.1, taperEnd: 0.1, swell: 0 });
        brushCurve(ctx, strand, 2.4 * k, { color: P.dateFruit, taperStart: 0.1, taperEnd: 0.1, swell: 0 });
      }
    }
  } else {
    for (const [dx, dy] of [[-9, 13], [5, 16], [13, 8], [-1, 5]]) {
      const x = crown[0] + dx * k, y = crown[1] + dy * k, r = 7.5 * k;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = P.wood; ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.detail * k; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.42, 0, TAU); ctx.fillStyle = P.woodLight; ctx.fill();
    }
  }
  grassTuft(ctx, line[0][0] - 20 * k, h - 6 * k, 12 * k, P.ink, k, rnd);
  grassTuft(ctx, line[0][0] + 24 * k, h - 5 * k, 9 * k, P.ink, k, rnd);
}

// ----------------------------------------------------------------------------- bushes and rocks

const BUSH_SHAPES = [
  // variant 0: dense rounded shrub. [x, y, r, dark] in units of the half width / height
  [[-0.5, 0.74, 0.3, 1], [0.52, 0.76, 0.3, 1], [0.0, 0.8, 0.34, 1], [-0.62, 0.52, 0.28, 0], [0.6, 0.5, 0.3, 0], [0.26, 0.36, 0.34, 0], [-0.24, 0.38, 0.36, 0], [0.0, 0.56, 0.4, 0]],
  // variant 1: low spreading shrub, taller on the right, with long shoots
  [[-0.34, 0.8, 0.26, 1], [0.4, 0.78, 0.3, 1], [-0.7, 0.72, 0.22, 0], [-0.3, 0.62, 0.3, 0], [0.7, 0.62, 0.24, 0], [0.34, 0.44, 0.34, 0], [0.04, 0.66, 0.3, 0]],
];

function bush(ctx, w, h, P, rnd, variant) {
  const k = w / 256, cx = w * 0.5, hw = w * 0.5, ground = h - 6 * k;
  groundShadow(ctx, cx + 6 * k, h - 6 * k, w * (variant ? 0.4 : 0.38), 6 * k);
  if (variant === 1) {
    // long shoots standing above the mass, with paired lance-shaped leaves
    for (const [x, lean, len] of [[0.34, 0.16, 0.6], [0.5, 0.42, 0.46], [0.14, -0.1, 0.5], [-0.3, -0.3, 0.44], [-0.5, -0.56, 0.32]]) {
      const x0 = cx + x * hw, y0 = h * 0.62, bend = lean * 22 * k, tip = [x0 + lean * 50 * k, y0 - len * h];
      const at = (t) => [x0 + (tip[0] - x0) * t + bend * 4 * t * (1 - t) * 0.5, y0 + (tip[1] - y0) * t];
      brushCurve(ctx, [at(0), at(0.5), at(1)], LINE.form * k * 1.5, { color: P.ink, taperStart: 0, taperEnd: 0.55, swell: 0 });
      for (let i = 0; i < 5; i++) {
        const t = 0.42 + i * 0.14, [px, py] = at(t), side = i % 2 ? 1 : -1, size = (15 - i * 1.6) * k;
        const a = -Math.PI / 2 + lean * 0.5 + side * (0.75 + rnd() * 0.3), dx = Math.cos(a), dy = Math.sin(a);
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + dx * size * 0.5 - dy * size * 0.32, py + dy * size * 0.5 + dx * size * 0.32, px + dx * size, py + dy * size);
        ctx.quadraticCurveTo(px + dx * size * 0.5 + dy * size * 0.32, py + dy * size * 0.5 - dx * size * 0.32, px, py);
        ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.detail * 1.7 * k; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.fillStyle = side < 0 ? P.leafLight : P.leaf; ctx.fill();
      }
    }
  }
  const clumps = BUSH_SHAPES[variant].map(([x, y, r, dark]) => ({ x: cx + (x + jit(rnd, 0.04)) * hw, y: (y + jit(rnd, 0.03)) * h - 4 * k, r: r * hw * (0.95 + rnd() * 0.1), squash: 0.8, dark: !!dark }));
  clipped(ctx, (g) => g.rect(0, 0, w, ground), () => {
    foliageMass(ctx, clumps, { ink: P.ink, shade: P.leafShade, base: P.leaf, light: P.leafLight, deep: P.leafDeep }, k, rnd, { inkWidth: LINE.silhouette * 0.9, density: 1.25 });
  });
  // ground contact: heavy line under the mass and grass in front
  const span = variant ? 0.74 : 0.7;
  brushStroke(ctx, [[cx - hw * span, ground - 2 * k], [cx - hw * 0.2, ground], [cx + hw * 0.3, ground], [cx + hw * span, ground - 2 * k]], LINE.silhouette * k * 1.3, { color: P.ink, taper: 0.22, swell: 0.1 });
  for (const x of [-0.56, -0.1, 0.36, 0.66]) grassTuft(ctx, cx + (x + jit(rnd, 0.06)) * hw, h - 4 * k, (11 + rnd() * 5) * k, P.ink, k, rnd);
}

const ROCK_SHAPES = [
  // variant 0: broad faceted boulder (design space 256 x 168, ground at y = 160)
  {
    blocks: [{
      outline: [[24, 160], [19, 131], [40, 92], [72, 57], [118, 40], [162, 44], [205, 70], [232, 112], [239, 160]],
      light: [[[40, 92], [72, 57], [118, 40], [162, 44], [205, 70], [158, 93], [110, 84], [66, 105]], [[19, 131], [40, 92], [66, 105], [46, 128]]],
      shade: [[[158, 93], [205, 70], [232, 112], [239, 160], [172, 160], [180, 124]], [[24, 160], [60, 149], [104, 160]]],
      edges: [[[40, 92], [66, 105], [110, 84], [158, 93], [205, 70]], [[110, 84], [104, 122], [108, 150]], [[158, 93], [180, 124], [172, 160]], [[66, 105], [46, 128], [36, 150]]],
      cracks: [[[96, 52], [112, 62], [116, 76]], [[132, 104], [140, 126], [136, 146]], [[212, 96], [206, 118]]],
      hatch: [[188, 110], [222, 150]],
    }],
    pebbles: [[14, 153, 9], [228, 155, 7]],
  },
  // variant 1: tall leaning block with a smaller boulder at its foot
  {
    blocks: [{
      outline: [[98, 160], [88, 116], [104, 62], [134, 22], [168, 30], [204, 78], [222, 126], [228, 160]],
      light: [[[104, 62], [134, 22], [150, 70], [140, 118], [112, 106]], [[134, 22], [168, 30], [176, 56], [150, 70]]],
      shade: [[[150, 70], [176, 56], [168, 30], [204, 78], [222, 126], [228, 160], [156, 160], [140, 118]]],
      edges: [[[134, 22], [150, 70], [140, 118], [156, 160]], [[150, 70], [176, 56], [168, 30]], [[104, 62], [112, 106], [140, 118]]],
      cracks: [[[118, 128], [126, 144], [122, 158]], [[186, 86], [180, 110], [188, 130]], [[98, 96], [110, 100]]],
      hatch: [[170, 96], [214, 152]],
    }, {
      outline: [[28, 160], [26, 134], [46, 112], [84, 107], [110, 128], [116, 160]],
      light: [[[26, 134], [46, 112], [84, 107], [110, 128], [80, 131], [50, 135]]],
      shade: [[[80, 131], [110, 128], [116, 160], [88, 160]]],
      edges: [[[26, 134], [50, 135], [80, 131], [110, 128]], [[80, 131], [88, 160]]],
      cracks: [[[58, 140], [62, 154]]],
      hatch: null,
    }],
    pebbles: [[238, 154, 8], [12, 156, 6]],
  },
];

function rock(ctx, w, h, P, rnd, variant) {
  const k = w / 256, shape = ROCK_SHAPES[variant] || ROCK_SHAPES[0];
  const moved = new Map();
  // every design vertex gets one random offset, so facets that share a vertex stay joined
  const at = ([x, y]) => {
    const key = `${x},${y}`;
    let p = moved.get(key);
    if (!p) { const fixed = y >= 160; p = [(x + jit(rnd, 5)) * k, h - (168 - y - (fixed ? 0 : jit(rnd, 4))) * k]; moved.set(key, p); }
    return p;
  };
  groundShadow(ctx, w * 0.53, h - 7 * k, w * 0.46, 7 * k);
  const pebbles = shape.pebbles.map(([x, y, r]) => ringPoints(x * k, h - (168 - y) * k, r * k, r * k * 0.7, 6, 0.16, rnd));
  const blocks = shape.blocks.map((b) => ({ ...b, outline: b.outline.map(at) }));
  inkUnion(ctx, (g) => { for (const b of blocks) tracePolygon(g, b.outline); for (const p of pebbles) tracePolygon(g, p); }, P.ink, LINE.silhouette, k);
  for (const b of blocks) {
    const trace = (g) => tracePolygon(g, b.outline);
    ctx.beginPath(); trace(ctx); ctx.lineWidth = LINE.form * 2 * k; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.fillStyle = P.rock; ctx.fill();
    clipped(ctx, trace, () => {
      ctx.fillStyle = P.rockLight; for (const f of b.light) { ctx.beginPath(); tracePolygon(ctx, f.map(at)); ctx.fill(); }
      ctx.fillStyle = P.rockShade; for (const f of b.shade) { ctx.beginPath(); tracePolygon(ctx, f.map(at)); ctx.fill(); }
      if (b.hatch) {
        const [a, c] = b.hatch;
        for (let i = 0; i < 6; i++) {
          const x = (a[0] + (c[0] - a[0]) * (i / 5)) * k, y0 = h - (168 - a[1] - i * 5) * k, len = (16 + rnd() * 16) * k;
          brushStroke(ctx, [[x, y0], [x - len * 0.2, y0 + len * 0.5], [x - len * 0.4, y0 + len]], LINE.hair * k * 1.3, { color: P.ink, taper: 0.4, swell: 0 });
        }
      }
      for (const e of b.edges) brushStroke(ctx, sampleCurve(e.map(at), 3), LINE.form * k * 0.9, { color: P.ink, taperStart: 0.08, taperEnd: 0.45, swell: 0.25, seed: e[0][0] });
      for (const c of b.cracks) brushStroke(ctx, sampleCurve(c.map(at), 3), LINE.detail * k * 1.1, { color: P.ink, taperStart: 0.1, taperEnd: 0.6, swell: 0.2, seed: c[0][1] });
    });
  }
  for (const p of pebbles) {
    ctx.beginPath(); tracePolygon(ctx, p); ctx.fillStyle = P.rock; ctx.fill();
    clipped(ctx, (g) => tracePolygon(g, p), () => { ctx.fillStyle = P.rockLight; ctx.beginPath(); tracePolygon(ctx, p.map(([x, y]) => [x - 3 * k, y - 4 * k])); ctx.fill(); });
  }
  const tuftInk = mixHex(P.ink, P.grassDark, 0.15);
  for (const x of variant ? [20, 122, 214] : [34, 150, 226]) grassTuft(ctx, (x + jit(rnd, 6)) * k, h - 4 * k, (12 + rnd() * 6) * k, tuftInk, k, rnd, P.grassDark);
}

/** Painters by family. Missing families fall back to a neutral placeholder (see scenery-painters.js). */
export const VEGETATION_PAINTERS = {
  'tree.broadleaf': broadleaf,
  'tree.pine': pine,
  'tree.palm': palm,
  'tree.cypress': cypress,
  'bush': bush,
  'rock': rock,
};
