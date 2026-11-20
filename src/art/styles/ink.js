// Inking toolkit shared by every procedural drawing (Canvas 2D paths). It encodes the line
// rules of the art direction: contours are filled shapes of varying thickness (never a uniform
// hairline), strokes taper at their ends, silhouettes are heavier than inner details, and
// shadows are flat shapes or hatching, never soft gradients.

/** Line weights in pixels for a drawing shown at its nominal size on a 1440p screen. */
export const LINE = { silhouette: 3.4, form: 2.2, detail: 1.3, hair: 0.8 };

/** Small deterministic generator for drawings (mulberry32). Returns a function in [0,1). */
export function seeded(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    let t = (state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trace a smooth closed curve through points [[x,y],...] (Catmull-Rom). Does not begin/fill. */
export function closedCurve(ctx, pts, tension = 0.5) {
  const n = pts.length;
  if (n < 3) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const k = tension / 3;
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  ctx.closePath();
}

/** Trace a smooth open curve through points. Does not begin/stroke. */
export function openCurve(ctx, pts, tension = 0.5, move = true) {
  const n = pts.length;
  if (n < 2) return;
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const k = tension / 3;
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
}

/** Sample a Catmull-Rom curve through pts into a polyline (steps per span). */
export function sampleCurve(pts, steps = 8, closed = false) {
  const n = pts.length, out = [];
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = closed ? pts[(i + n - 1) % n] : pts[Math.max(0, i - 1)];
    const p1 = pts[i % n], p2 = pts[(i + 1) % n];
    const p3 = closed ? pts[(i + 2) % n] : pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/**
 * Brush stroke along a polyline: a filled shape whose thickness swells and tapers like a pen
 * or brush line. options: { color, taper (0..0.5 fraction tapered at each end, default 0.18),
 * taperStart, taperEnd, swell (0..1 pressure variation, default 0.18), seed, closed, minRatio }.
 */
export function brushStroke(ctx, pts, width, options = {}) {
  const n = pts.length;
  if (n < 2) return;
  const closed = !!options.closed;
  const taperA = closed ? 0 : options.taperStart ?? options.taper ?? 0.18;
  const taperB = closed ? 0 : options.taperEnd ?? options.taper ?? 0.18;
  const swell = options.swell ?? 0.18;
  const minRatio = options.minRatio ?? 0.12;
  const phase = ((options.seed ?? 0) * 0.618) % 1 * 6.283;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const total = cum[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0);
  if (total < 1e-6) return;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = closed ? pts[(i + n - 1) % n] : pts[Math.max(0, i - 1)];
    const b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const t = cum[i] / total;
    let w = 1 + swell * Math.sin(t * 7.3 + phase) * 0.6 + swell * Math.sin(t * 17.1 + phase * 2.3) * 0.4;
    if (taperA > 0 && t < taperA) w *= minRatio + (1 - minRatio) * Math.sin((t / taperA) * 1.5708);
    if (taperB > 0 && t > 1 - taperB) w *= minRatio + (1 - minRatio) * Math.sin(((1 - t) / taperB) * 1.5708);
    const h = (typeof width === 'function' ? width(t) : width) * 0.5 * w;
    left.push(pts[i][0] - ty * h, pts[i][1] + tx * h);
    right.push(pts[i][0] + ty * h, pts[i][1] - tx * h);
  }
  ctx.beginPath();
  ctx.moveTo(left[0], left[1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i * 2], left[i * 2 + 1]);
  if (closed) {
    ctx.closePath();
    ctx.moveTo(right[0], right[1]);
    for (let i = n - 1; i >= 1; i--) ctx.lineTo(right[i * 2], right[i * 2 + 1]);
    ctx.closePath();
  } else {
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i * 2], right[i * 2 + 1]);
    ctx.closePath();
  }
  ctx.fillStyle = options.color || '#16161f';
  ctx.fill(closed ? 'evenodd' : 'nonzero');
}

/** Brush stroke through control points with a smooth curve between them. */
export function brushCurve(ctx, pts, width, options = {}) {
  brushStroke(ctx, sampleCurve(pts, options.steps ?? 8, !!options.closed), width, options);
}

/**
 * Fill a shape with a flat colour and ink its contour.
 * `trace(ctx)` must add the path (without beginPath). options: { fill, ink, width, join }.
 */
export function inkedShape(ctx, trace, options) {
  ctx.beginPath();
  trace(ctx);
  if (options.fill) { ctx.fillStyle = options.fill; ctx.fill(options.rule || 'nonzero'); }
  if (options.width > 0) {
    ctx.strokeStyle = options.ink || '#16161f';
    ctx.lineWidth = options.width;
    ctx.lineJoin = options.join || 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

/** Polygon helper: trace points [[x,y],...] as a closed path. */
export function tracePolygon(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Run `draw` clipped to the path added by `trace`. */
export function clipped(ctx, trace, draw) {
  ctx.save();
  ctx.beginPath();
  trace(ctx);
  ctx.clip();
  draw(ctx);
  ctx.restore();
}

/**
 * Parallel pen hatching over a rectangle (use inside `clipped`). Lines are slightly irregular in
 * length and weight. options: { angle (rad), spacing, width, color, seed, breakChance }.
 */
export function hatch(ctx, x, y, w, h, options = {}) {
  const angle = options.angle ?? -0.9, spacing = options.spacing ?? 6, width = options.width ?? 1;
  const rnd = seeded(options.seed ?? 7);
  const cx = x + w / 2, cy = y + h / 2, radius = Math.hypot(w, h) / 2;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  ctx.fillStyle = options.color || '#16161f';
  for (let o = -radius; o <= radius; o += spacing) {
    const jitter = (rnd() - 0.5) * spacing * 0.25;
    const ox = cx - dy * (o + jitter), oy = cy + dx * (o + jitter);
    let a = -radius;
    while (a < radius) {
      const len = radius * (0.5 + rnd() * 1.5);
      const b = Math.min(radius, a + len);
      brushStroke(ctx, [[ox + dx * a, oy + dy * a], [ox + dx * (a + b) / 2, oy + dy * (a + b) / 2], [ox + dx * b, oy + dy * b]], width * (0.8 + rnd() * 0.5), { color: options.color, taper: 0.3, swell: 0 });
      a = b + spacing * (rnd() < (options.breakChance ?? 0.25) ? 1.5 + rnd() * 2 : 0.0001);
      if (b >= radius) break;
    }
  }
}

/**
 * Points of an organic closed mass (foliage clump, cloud, smoke puff): a lumpy ellipse.
 * Returns control points for closedCurve.
 */
export function blobPoints(cx, cy, rx, ry, lobes, jitter, rnd) {
  const pts = [];
  const count = lobes * 2;
  const rot = rnd() * 6.283;
  for (let i = 0; i < count; i++) {
    const a = rot + (i / count) * 6.283 + (rnd() - 0.5) * 0.25;
    const bump = i % 2 === 0 ? 1 + jitter * (0.4 + rnd() * 0.6) : 1 - jitter * (0.3 + rnd() * 0.5);
    pts.push([cx + Math.cos(a) * rx * bump, cy + Math.sin(a) * ry * bump]);
  }
  return pts;
}

/** Cloud-like scalloped outline: a chain of arcs along an ellipse (comic cumulus edge). */
export function scallopPoints(cx, cy, rx, ry, bumps, depth, rnd) {
  const pts = [];
  const rot = rnd() * 6.283;
  for (let i = 0; i < bumps; i++) {
    const a0 = rot + (i / bumps) * 6.283, a1 = rot + ((i + 0.5) / bumps) * 6.283;
    const k = 1 + depth * (0.6 + rnd() * 0.8);
    pts.push([cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry]);
    pts.push([cx + Math.cos(a1) * rx * k, cy + Math.sin(a1) * ry * k]);
  }
  return pts;
}
