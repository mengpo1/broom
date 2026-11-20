// Vegetation drawings. Every painter has the signature (ctx, w, h, P, rnd, variant):
// it draws inside [0,w]x[0,h] with the ground line at the bottom edge, P is the theme palette
// (hex strings, art/palettes), rnd a seeded generator. Light comes from the upper left.
// Style rules: three flat tones per mass (light / base / shade), contour inked around the whole
// silhouette (heavier underneath), a few interior pen marks, no gradients.

import { LINE, closedCurve, brushCurve, brushStroke, blobPoints, clipped } from '../styles/ink.js';

/** Flat drop shadow on the ground under an object. */
export function groundShadow(ctx, cx, y, rx, ry) {
  ctx.fillStyle = 'rgba(22,22,36,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Foliage mass built from overlapping clumps. clumps: [{x, y, r}]. Draws the inked silhouette,
 * then base and light shapes shifted toward the light, then leaf marks.
 */
export function foliageMass(ctx, clumps, colors, k, rnd, options = {}) {
  const shapes = clumps.map((c) => blobPoints(c.x, c.y, c.r, c.r * (c.squash ?? 0.86), 5 + Math.floor(rnd() * 3), 0.16, rnd));
  const trace = (g) => { for (const s of shapes) closedCurve(g, s); };
  // contour first (it shows around the union only), slightly heavier below
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = LINE.silhouette * 2 * k;
  ctx.beginPath(); trace(ctx); ctx.stroke();
  ctx.save(); ctx.translate(k * 0.6, k * 1.5); ctx.beginPath(); trace(ctx); ctx.stroke(); ctx.restore();
  ctx.fillStyle = colors.shade;
  ctx.beginPath(); trace(ctx); ctx.fill();
  clipped(ctx, trace, () => {
    if (colors.deep) {
      ctx.fillStyle = colors.deep;
      for (const c of clumps) {
        if (rnd() < 0.55) continue;
        ctx.beginPath(); closedCurve(ctx, blobPoints(c.x + c.r * 0.35, c.y + c.r * 0.45, c.r * 0.42, c.r * 0.3, 4, 0.2, rnd)); ctx.fill();
      }
    }
    ctx.fillStyle = colors.base;
    for (const c of clumps) { ctx.beginPath(); closedCurve(ctx, blobPoints(c.x - c.r * 0.16, c.y - c.r * 0.2, c.r * 0.84, c.r * 0.7, 6, 0.18, rnd)); ctx.fill(); }
    ctx.fillStyle = colors.light;
    for (const c of clumps) {
      if (c.dark) continue;
      ctx.beginPath(); closedCurve(ctx, blobPoints(c.x - c.r * 0.3, c.y - c.r * 0.36, c.r * 0.5, c.r * 0.38, 5, 0.22, rnd)); ctx.fill();
    }
    // leaf marks: short scalloped pen strokes on the shadow side of each clump
    const marks = options.marks ?? 3;
    for (const c of clumps) {
      for (let m = 0; m < marks; m++) {
        const a = 0.3 + rnd() * 1.6, rr = c.r * (0.5 + rnd() * 0.4), span = 0.35 + rnd() * 0.3;
        const pts = [];
        for (let q = 0; q <= 4; q++) { const t = a + (q / 4 - 0.5) * span; pts.push([c.x + Math.cos(t) * rr, c.y + Math.sin(t) * rr * 0.86]); }
        brushCurve(ctx, pts, LINE.detail * k * (0.8 + rnd() * 0.5), { color: colors.ink, taper: 0.4, seed: m });
      }
    }
  });
}

function trunk(ctx, x, yBase, yTop, wBase, wTop, P, k, rnd, lean = 0) {
  const pts = [[x - wBase * 0.7, yBase], [x - wBase * 0.5, yBase - (yBase - yTop) * 0.12], [x - wTop * 0.5 + lean * 0.5, yBase - (yBase - yTop) * 0.6], [x - wTop * 0.45 + lean, yTop],
    [x + wTop * 0.45 + lean, yTop], [x + wTop * 0.5 + lean * 0.5, yBase - (yBase - yTop) * 0.6], [x + wBase * 0.5, yBase - (yBase - yTop) * 0.12], [x + wBase * 0.75, yBase]];
  const trace = (g) => { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  ctx.beginPath(); trace(ctx);
  ctx.fillStyle = P.trunk; ctx.fill();
  clipped(ctx, trace, () => { ctx.fillStyle = P.trunkShade; ctx.fillRect(x + lean * 0.5, yTop, wBase, yBase - yTop); });
  ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.form * k; ctx.lineJoin = 'round';
  ctx.beginPath(); trace(ctx); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const t = 0.2 + rnd() * 0.6, yy = yBase - (yBase - yTop) * t;
    brushStroke(ctx, [[x - wTop * 0.2 + lean * t, yy], [x - wTop * 0.1 + lean * t, yy - 14 * k]], LINE.hair * k, { color: P.ink, taper: 0.4 });
  }
}

function broadleaf(ctx, w, h, P, rnd, variant) {
  const k = w / 352;
  const cx = w * (0.5 + (rnd() - 0.5) * 0.04);
  groundShadow(ctx, cx + 10 * k, h - 7 * k, w * 0.33, 7 * k);
  const crownY = h * (variant === 1 ? 0.36 : 0.39), crownR = w * (variant === 2 ? 0.4 : 0.43), crownH = h * (variant === 1 ? 0.33 : 0.3);
  trunk(ctx, cx, h - 8 * k, crownY + crownH * 0.35, 30 * k, 17 * k, P, k, rnd, (rnd() - 0.5) * 12 * k);
  // main boughs showing under the crown
  for (const side of [-1, 1]) {
    brushCurve(ctx, [[cx, crownY + crownH * 0.75], [cx + side * crownR * 0.25, crownY + crownH * 0.45], [cx + side * crownR * 0.5, crownY + crownH * 0.2]], 9 * k, { color: P.trunkShade, taper: 0.5, taperStart: 0 });
  }
  const clumps = [{ x: cx, y: crownY, r: crownR * 0.55 }];
  const count = 7 + variant;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.4;
    const lower = Math.sin(a) > 0.3;
    clumps.push({ x: cx + Math.cos(a) * crownR * 0.62, y: crownY + Math.sin(a) * crownH * 0.62, r: crownR * (0.34 + rnd() * 0.12), dark: lower && rnd() < 0.6 });
  }
  foliageMass(ctx, clumps, { ink: P.ink, shade: P.leafShade, base: P.leaf, light: P.leafLight, deep: P.leafDeep }, k, rnd);
}

/** Painters by family. Missing families fall back to a neutral placeholder (see scenery-painters.js). */
export const VEGETATION_PAINTERS = {
  'tree.broadleaf': broadleaf,
};
