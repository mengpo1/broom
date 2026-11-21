// Distant backdrops: three 120-degree panoramas per circuit theme (0 clouds, 1 far relief,
// 2 near relief), painted once per circuit. Each must tile horizontally. The bottom edge of the
// canvas sits slightly below the horizon (see backdrop-rules.js); colours get paler with distance.
//
// Every panorama is built from individual drawn objects (a peak, a hill, a mesa, a cloud...)
// painted back to front; whatever crosses a vertical edge is drawn again one period away, so the
// picture wraps. Far relief: two or three flat hazy tones, no ink. Near relief: more saturated,
// light pen contours, trees and buildings. One pixel is about 1/1960 radian in both directions.

import { BACKDROP_TAN_TOP, BACKDROP_TAN_BOTTOM } from './backdrop-rules.js';
import { seeded, sampleCurve, brushStroke, tracePolygon, clipped } from '../styles/ink.js';
import { mixHex, hexToRgb } from '../palettes/palettes.js';

const TAU = Math.PI * 2;

/** y coordinate (pixels) of the horizon line inside a backdrop canvas of height h. */
export function backdropHorizon(h) { return (h * BACKDROP_TAN_TOP) / (BACKDROP_TAN_TOP - BACKDROP_TAN_BOTTOM); }

// ------------------------------------------------------------------------------------ helpers

function jit(rnd, amount) { return (rnd() - 0.5) * 2 * amount; }
function lerp(a, b, t) { return a + (b - a) * t; }
function newSeed(rnd) { return Math.floor(rnd() * 4294967295) + 1; }

/** Run `draw` at its place and one period to the left / right when [minX, maxX] crosses an edge. */
function wrapped(ctx, w, minX, maxX, draw) {
  for (const dx of [0, -w, w]) {
    if (maxX + dx < 0 || minX + dx > w) continue;
    ctx.save(); ctx.translate(dx, 0); draw(); ctx.restore();
  }
}

/** Place `count` objects on jittered slots along the panorama; each gets a private generator. */
function scatter(rnd, w, count, jitter, place) {
  const phase = rnd();
  for (let i = 0; i < count; i++) place((((i + phase + jit(rnd, jitter)) / count) % 1) * w, seeded(newSeed(rnd)), i);
}

/** Paint an object (deterministic `paint(r)`) with its wrap-around copies. */
function stamp(env, minX, maxX, seed, paint) {
  wrapped(env.ctx, env.w, minX, maxX, () => paint(seeded(seed)));
}

function tones(light, base, shade, ink = null) { return { light, base, shade, ink }; }

/** The same tones seen through more air. */
function hazed(t, haze, amount) {
  return { light: mixHex(t.light, haze, amount), base: mixHex(t.base, haze, amount), shade: mixHex(t.shade, haze, amount), ink: t.ink ? mixHex(t.ink, haze, amount) : null };
}

/** Mist at the foot of what is already painted (the only gradient allowed with the sky). */
function groundHaze(env, height, alpha) {
  const { ctx, w, y0, u, P } = env, [r, g, b] = hexToRgb(P.haze).map((v) => Math.round(v * 255));
  const grad = ctx.createLinearGradient(0, y0 - height * u, 0, y0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0)`); grad.addColorStop(1, `rgba(${r},${g},${b},${alpha})`);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = grad; ctx.fillRect(0, y0 - height * u, w, height * u);
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`; ctx.fillRect(0, y0, w, env.h - y0);
  ctx.restore();
}

/** Thin contour of the shape about to be filled (stroke under the fill), heavier below / right. */
function contour(ctx, trace, ink, width) {
  if (!ink) return;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = width * 2;
  ctx.beginPath(); trace(ctx); ctx.stroke();
  ctx.save(); ctx.translate(width * 0.5, width * 0.5); ctx.beginPath(); trace(ctx); ctx.stroke(); ctx.restore();
}

/** Line broken by random midpoint displacement (rock edges). Returns points from a to b. */
function jagged(a, b, levels, rough, rnd, sag = 0) {
  let pts = [a, b];
  for (let l = 0; l < levels; l++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], d = jit(rnd, rough) + (l === 0 ? sag : 0);
      next.push([(p[0] + q[0]) / 2 - dy * d, (p[1] + q[1]) / 2 + dx * d], q);
    }
    pts = next;
  }
  return pts;
}

/**
 * Add a crest to the current path, from the current point through pts (left to right):
 * 'smooth' straight joins, 'scallop' rounded tree crowns, 'fir' pointed conifer tops.
 */
function traceCrest(ctx, pts, style, tips) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (style === 'scallop') ctx.quadraticCurveTo((a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.6, (a[1] + b[1]) / 2 - (b[0] - a[0]) * (0.45 + tips[i] * 0.35), b[0], b[1]);
    else if (style === 'fir') { ctx.lineTo((a[0] + b[0]) / 2 + (b[0] - a[0]) * (tips[i] - 0.5) * 0.3, (a[1] + b[1]) / 2 - (b[0] - a[0]) * (0.9 + tips[i] * 1.1)); ctx.lineTo(b[0], b[1]); } else ctx.lineTo(b[0], b[1]);
  }
}

// ------------------------------------------------------------------------- landforms (objects)

/**
 * Rounded hill. o: { x, halfW, height, base, tones, edge ('smooth' | 'scallop' | 'fir'), grain
 * (size of a tree crown in pixels), skew, power, contour }. Three tones displaced toward the
 * light; the canopy texture of the crest is repeated on the tone boundaries.
 */
function paintHill(env, o, rnd) {
  const { ctx, h } = env;
  const skew = o.skew ?? jit(rnd, 0.3), power = o.power ?? 0.9 + rnd() * 0.5, p1 = rnd() * 6, p2 = rnd() * 6;
  const yAt = (x) => {
    const t = (x - o.x) / o.halfW;
    if (t <= -1 || t >= 1) return o.base;
    const tt = t < skew ? (t - skew) / (1 + skew) : (t - skew) / (1 - skew);
    const bell = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * tt), power);
    return o.base - o.height * bell * (1 + (0.09 * Math.sin(t * 5 + p1) + 0.05 * Math.sin(t * 11 + p2)) * (1 - t * t));
  };
  const grain = o.grain || 14, pts = [], tips = [];
  for (let x = o.x - o.halfW; x < o.x + o.halfW; x += o.edge === 'smooth' ? 12 : grain * (0.7 + rnd() * 0.9)) { pts.push([x, yAt(x)]); tips.push(rnd()); }
  pts.push([o.x + o.halfW, o.base]); tips.push(0.5);
  const trace = (g) => { g.moveTo(pts[0][0], h + 4); g.lineTo(pts[0][0], pts[0][1]); traceCrest(g, pts, o.edge, tips); g.lineTo(o.x + o.halfW, h + 4); g.closePath(); };
  const t = o.tones;
  contour(ctx, trace, t.ink, o.contour || 1.3);
  ctx.beginPath(); trace(ctx); ctx.fillStyle = t.shade; ctx.fill();
  clipped(ctx, trace, () => {
    const copy = (dx, dy, color) => { ctx.save(); ctx.translate(dx, dy); ctx.beginPath(); trace(ctx); ctx.fillStyle = color; ctx.fill(); ctx.restore(); };
    copy(-o.halfW * 0.1 - grain * 0.4, o.height * 0.02, t.base);
    copy(-o.halfW * 0.2 - grain * 0.6, o.height * 0.07 + grain * 0.2, t.light);
    copy(-o.halfW * 0.36 - grain * 0.6, o.height * (0.34 + rnd() * 0.14) + grain * 0.5, t.base);
    if (o.detail) o.detail(yAt, rnd);
  });
  return yAt;
}

/**
 * Alpine peak. o: { x, height, left, right, base, tones (light = sunlit rock, base = rock in
 * shade), snow, snowShade, snowLine (pixels above the base, 0 = none), rough, detail }.
 */
function paintPeak(env, o, rnd) {
  const { ctx, h } = env;
  const top = [o.x, o.base - o.height], footL = [o.x - o.left, o.base], footR = [o.x + o.right, o.base];
  const rough = o.rough ?? 0.1;
  const edgeL = jagged(footL, top, 4, rough, rnd, -0.07 - rnd() * 0.06), edgeR = jagged(top, footR, 4, rough, rnd, -0.07 - rnd() * 0.06);
  const trace = (g) => { g.moveTo(footL[0], h + 4); for (const p of edgeL) g.lineTo(p[0], p[1]); for (const p of edgeR) g.lineTo(p[0], p[1]); g.lineTo(footR[0], h + 4); g.closePath(); };
  // ridge running down from the summit toward the viewer: the boundary between light and shade
  const ridgeEnd = o.x + o.right * (0.08 + rnd() * 0.22), ridge = [top], steps = 7;
  for (let j = 1; j <= steps; j++) {
    const s = j / steps, amp = (o.left + o.right) * 0.035 * (0.4 + s) * (0.6 + rnd() * 0.8);
    ridge.push([lerp(o.x, ridgeEnd, s) + (j % 2 ? amp : -amp * 0.7), lerp(top[1], o.base, Math.pow(s, 0.9))]);
  }
  const shadeTrace = (g) => { g.moveTo(top[0], top[1]); for (const p of ridge) g.lineTo(p[0], p[1]); g.lineTo(ridgeEnd, h + 4); g.lineTo(footR[0] + 4, h + 4); for (let i = edgeR.length - 1; i >= 0; i--) g.lineTo(edgeR[i][0] + 2, edgeR[i][1] - 1); g.closePath(); };
  // slivers of shadow behind the spurs of the sunlit face
  const spurs = [];
  for (let i = 0; i < (o.detail ?? 2); i++) {
    const s = 0.2 + rnd() * 0.45, a = [lerp(top[0], footL[0], s * 0.8) + o.left * 0.1, lerp(top[1], o.base, s)], len = o.height * (0.2 + rnd() * 0.22), wd = o.left * (0.05 + rnd() * 0.06);
    spurs.push([a, [a[0] - len * 0.25 + wd, a[1] + len * 0.6], [a[0] - len * 0.5 + wd * 1.6, a[1] + len], [a[0] - len * 0.62, a[1] + len * 1.05], [a[0] - len * 0.3, a[1] + len * 0.5]]);
  }
  contour(ctx, trace, o.tones.ink, 1.2);
  ctx.beginPath(); trace(ctx); ctx.fillStyle = o.tones.light; ctx.fill();
  clipped(ctx, trace, () => {
    ctx.fillStyle = o.tones.base;
    ctx.beginPath(); shadeTrace(ctx); ctx.fill();
    for (const s of spurs) { ctx.beginPath(); tracePolygon(ctx, s); ctx.fill(); }
    if (o.snowLine > 0) {
      // snow above a ragged line; tongues of snow reach lower in the gullies
      const ySnow = o.base - o.snowLine, teeth = [[footL[0] - 4, top[1] - 40], [footL[0] - 4, ySnow]];
      for (let x = footL[0]; x < footR[0]; ) { const step = (o.left + o.right) * (0.03 + rnd() * 0.05); teeth.push([x + step * 0.5, ySnow + step * (0.5 + rnd() * 1.6)], [x + step, ySnow - step * (0.2 + rnd() * 0.9)]); x += step; }
      teeth.push([footR[0] + 4, ySnow], [footR[0] + 4, top[1] - 40]);
      clipped(ctx, (g) => tracePolygon(g, teeth), () => {
        ctx.fillStyle = o.snow; ctx.fillRect(footL[0] - 4, top[1] - 40, o.left + o.right + 8, o.height + 40);
        ctx.fillStyle = o.snowShade;
        ctx.beginPath(); shadeTrace(ctx); ctx.fill();
        for (const s of spurs) { ctx.beginPath(); tracePolygon(ctx, s); ctx.fill(); }
        // rock showing through the snow
        for (let i = 0; i < 4; i++) {
          const s = 0.25 + rnd() * 0.6, side = rnd() < 0.5 ? -1 : 1, x = top[0] + side * (side < 0 ? o.left : o.right) * s * (0.2 + rnd() * 0.5), y = lerp(top[1], ySnow, s), d = o.height * (0.025 + rnd() * 0.03);
          ctx.beginPath(); tracePolygon(ctx, [[x, y], [x + d * 0.9, y + d * 2.2], [x - d * 0.7, y + d * 1.6]]); ctx.fillStyle = side < 0 ? o.tones.light : o.tones.base; ctx.fill();
        }
      });
    }
  });
}

/**
 * Mesa or butte. o: { x, top (half width of the flat summit), height, cap (share of the height
 * that is vertical cliff), apron (width of the scree on each side), base, tones, detail, strata }.
 */
function paintMesa(env, o, rnd) {
  const { ctx, h, u } = env;
  const yTop = o.base - o.height, yCliff = o.base - o.height * (1 - o.cap), apronL = o.apron * (0.8 + rnd() * 0.5), apronR = o.apron * (0.8 + rnd() * 0.5);
  const xl = o.x - o.top, xr = o.x + o.top, batter = o.height * o.cap * 0.07;
  // summit line with a few steps, cliffs with a ledge, concave scree
  const summit = [[xl, yTop + jit(rnd, 2 * u)]];
  for (let s = 1; s < 4; s++) { const x = lerp(xl, xr, s / 4 + jit(rnd, 0.08)), y = yTop + (rnd() < 0.35 ? o.height * 0.05 * rnd() : 0) + jit(rnd, 1.5 * u); summit.push([x - 2 * u, summit[summit.length - 1][1]], [x, y]); }
  summit.push([xr, summit[summit.length - 1][1]]);
  const ledge = yTop + (yCliff - yTop) * (0.45 + rnd() * 0.25), step = o.height * 0.035 * (0.5 + rnd());
  const left = sampleCurve([[xl - batter - step - apronL, o.base], [xl - batter - step - apronL * 0.45, o.base - (o.base - yCliff) * 0.32], [xl - batter - step - 2, yCliff]], 5).concat([[xl - batter * 0.5 - step, ledge], [xl - batter * 0.5, ledge - 2 * u]]);
  const right = [[xr + batter * 0.5, ledge - 2 * u], [xr + batter * 0.5 + step, ledge]].concat(sampleCurve([[xr + batter + step + 2, yCliff], [xr + batter + step + apronR * 0.45, o.base - (o.base - yCliff) * 0.32], [xr + batter + step + apronR, o.base]], 5));
  const outline = left.concat(summit, right);
  const trace = (g) => { g.moveTo(outline[0][0], h + 4); for (const p of outline) g.lineTo(p[0], p[1]); g.lineTo(outline[outline.length - 1][0], h + 4); g.closePath(); };
  const t = o.tones, width = xr - xl;
  contour(ctx, trace, t.ink, 1.3);
  ctx.beginPath(); trace(ctx); ctx.fillStyle = t.base; ctx.fill();
  clipped(ctx, trace, () => {
    // sunlit cliff: everything above the ragged top of the scree cones
    const cones = [[xl - batter - step - 6, yCliff]], count = Math.max(2, Math.round(width / (o.height * 0.3)));
    for (let i = 0; i < count; i++) { const x0 = lerp(xl - batter, xr + batter, i / count), x1 = lerp(xl - batter, xr + batter, (i + 1) / count); cones.push([lerp(x0, x1, 0.5 + jit(rnd, 0.2)), yCliff - o.height * o.cap * (0.06 + rnd() * 0.16)], [x1, yCliff + jit(rnd, o.height * 0.02)]); }
    cones.push([xr + batter + step + 6, yCliff], [xr + 40 * u, yTop - 30], [xl - 40 * u, yTop - 30]);
    ctx.beginPath(); tracePolygon(ctx, cones); ctx.fillStyle = t.light; ctx.fill();
    // strata: bands and pen lines following the bedding, the same on every mesa of a range
    for (const [f, thick] of o.strata || []) {
      const y = lerp(yTop, yCliff, f);
      ctx.fillStyle = t.base; ctx.fillRect(xl - batter - step - 4, y, width + 2 * (batter + step) + 8, Math.max(1.2 * u, thick * (yCliff - yTop)));
    }
    // right end of the cliff and of the scree turned away from the light
    const turn = Math.min(width * 0.5, o.height * (0.12 + rnd() * 0.14)), edge = [[xr - turn, yTop - 20]];
    for (let i = 0; i <= 6; i++) edge.push([xr - turn + (i % 2 ? turn * 0.3 : 0) + (i / 6) * turn * 0.5, lerp(yTop, yCliff, i / 6)]);
    edge.push([xr + batter + step - turn * 0.2 + apronR * 0.5, o.base], [xr + apronR * 2 + batter, h + 4], [xr + apronR * 2 + batter, yTop - 20]);
    ctx.beginPath(); tracePolygon(ctx, edge); ctx.fillStyle = t.shade; ctx.fill();
    if (o.detail) {
      // fluting of the cliff and gullies in the scree
      const pen = t.ink || t.shade;
      for (let i = 0; i < Math.round(width / (9 * u)); i++) {
        const x = lerp(xl, xr - turn, rnd()), ya = lerp(yTop, yCliff, rnd() * 0.5), len = (yCliff - yTop) * (0.2 + rnd() * 0.5);
        brushStroke(ctx, [[x, ya], [x + jit(rnd, 1.5 * u), ya + len * 0.5], [x + jit(rnd, 2 * u), ya + len]], (1 + rnd() * 0.8) * u, { color: i % 3 ? t.base : pen, taper: 0.4, swell: 0.1 });
      }
      for (let i = 0; i < Math.round((width + apronL) / (26 * u)); i++) {
        const x = lerp(xl - apronL * 0.5, xr - turn, rnd()), ya = yCliff + (o.base - yCliff) * 0.1, len = (o.base - yCliff) * (0.4 + rnd() * 0.5), lean = (x - o.x) / (width + apronL) * len * 0.9;
        brushStroke(ctx, [[x, ya], [x + lean * 0.4 + jit(rnd, 3 * u), ya + len * 0.5], [x + lean, ya + len]], (1.2 + rnd()) * u, { color: t.shade, taper: 0.45, swell: 0.1 });
      }
    }
  });
}

/**
 * Sand dune. o: { x, halfW, height, base, tones, detail }. Gentle windward slope on the left,
 * sharp crest, steep slip face in shadow; the crest line winds down toward the viewer.
 */
function paintDune(env, o, rnd) {
  const { ctx, h, u } = env;
  const crestX = o.x + o.halfW * (0.1 + rnd() * 0.25), top = o.base - o.height, L = crestX - (o.x - o.halfW), R = o.x + o.halfW - crestX;
  const windward = sampleCurve([[crestX - L, o.base], [crestX - L * 0.62, o.base - o.height * 0.2], [crestX - L * 0.3, o.base - o.height * 0.62], [crestX - L * 0.08, o.base - o.height * 0.93], [crestX, top]], 6);
  const slip = sampleCurve([[crestX, top], [crestX + R * 0.2, o.base - o.height * 0.62], [crestX + R * 0.55, o.base - o.height * 0.2], [crestX + R, o.base]], 6);
  const trace = (g) => { g.moveTo(crestX - L, h + 4); for (const p of windward) g.lineTo(p[0], p[1]); for (const p of slip) g.lineTo(p[0], p[1]); g.lineTo(crestX + R, h + 4); g.closePath(); };
  // crest winding down the face
  const sway = (rnd() < 0.5 ? -1 : 1) * o.halfW * (0.12 + rnd() * 0.14);
  const crest = sampleCurve([[crestX, top], [crestX - sway * 0.5, o.base - o.height * 0.66], [crestX + sway * 0.6, o.base - o.height * 0.3], [crestX + sway * 0.2 - o.halfW * 0.1, o.base + 8 * u]], 6);
  const t = o.tones;
  contour(ctx, trace, t.ink, 1.2);
  ctx.beginPath(); trace(ctx); ctx.fillStyle = t.light; ctx.fill();
  clipped(ctx, trace, () => {
    // lower windward apron in the middle tone
    const apron = sampleCurve([[crestX - L - 10, o.base - o.height * 0.1], [crestX - L * 0.5, o.base - o.height * (0.2 + rnd() * 0.12)], [crestX - L * 0.2, o.base - o.height * (0.42 + rnd() * 0.1)], [crestX + sway * 0.4, o.base - o.height * 0.36], [crestX + R, o.base - o.height * 0.3]], 6);
    ctx.beginPath(); ctx.moveTo(crestX - L - 10, h + 4); for (const p of apron) ctx.lineTo(p[0], p[1]); ctx.lineTo(crestX + R, h + 4); ctx.closePath(); ctx.fillStyle = t.base; ctx.fill();
    // slip face
    ctx.beginPath(); ctx.moveTo(crest[0][0], crest[0][1]); for (const p of crest) ctx.lineTo(p[0], p[1]); ctx.lineTo(crestX + R + 10, h + 4); ctx.lineTo(crestX + R + 10, top - 10); ctx.closePath(); ctx.fillStyle = t.shade; ctx.fill();
    if (o.detail) {
      // wind ripples on the sunlit side, pen line along the crest
      for (let i = 0; i < 5; i++) {
        const f = 0.25 + i * 0.13 + jit(rnd, 0.03), x0 = crestX - L * (0.75 - f * 0.3), len = L * (0.3 + rnd() * 0.3), y = o.base - o.height * (0.12 + f * 0.6);
        brushStroke(ctx, sampleCurve([[x0, y + 4 * u], [x0 + len * 0.5, y - o.height * 0.03], [x0 + len, y - o.height * 0.1]], 4), 1.3 * u, { color: i % 2 ? t.base : t.shade, taper: 0.45, swell: 0 });
      }
      if (t.ink) brushStroke(ctx, crest, 1.8 * u, { color: t.ink, taperStart: 0.05, taperEnd: 0.5, swell: 0.2 });
    }
  });
}

// --------------------------------------------------------------------- small drawn structures

/** House seen from afar: lit wall, shaded gable end, pitched or flat roof. c: { wallLight, wall, roof, roofShade, ink }. */
function paintHouse(ctx, x, y, wd, ht, c, flat, rnd) {
  const gable = wd * (0.28 + rnd() * 0.12), roofH = flat ? ht * 0.12 : ht * (0.34 + rnd() * 0.12);
  if (c.ink) { ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeRect(x - wd / 2, y - ht, wd, ht); }
  ctx.fillStyle = c.wallLight; ctx.fillRect(x - wd / 2, y - ht, wd, ht);
  ctx.fillStyle = c.wall; ctx.fillRect(x + wd / 2 - gable, y - ht, gable, ht);
  const roof = flat ? [[x - wd / 2 - 1, y - ht], [x - wd / 2 - 1, y - ht - roofH], [x + wd / 2 + 1, y - ht - roofH], [x + wd / 2 + 1, y - ht]]
    : [[x - wd / 2 - 2, y - ht], [x - wd / 2 + roofH * 0.5, y - ht - roofH], [x + wd / 2 - gable * 0.5, y - ht - roofH], [x + wd / 2 + 2, y - ht]];
  ctx.beginPath(); tracePolygon(ctx, roof);
  if (c.ink) { ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = c.roof; ctx.fill();
  if (!flat) { ctx.beginPath(); tracePolygon(ctx, [[x + wd / 2 - gable, y - ht], [x + wd / 2 - gable * 0.5, y - ht - roofH], [x + wd / 2 + 2, y - ht]]); ctx.fillStyle = c.roofShade; ctx.fill(); }
  // dark openings
  ctx.fillStyle = c.roofShade;
  for (let i = 0, n = Math.max(1, Math.round(wd / 9)); i < n; i++) ctx.fillRect(x - wd / 2 + (wd - gable) * ((i + 0.5) / n) - 1, y - ht * 0.62, 2, ht * 0.26);
}

/** Cypress or poplar: narrow flame, two tones. */
function paintSpike(ctx, x, y, ht, wd, dark, light, ink) {
  const trace = (g) => { g.moveTo(x - wd * 0.3, y); g.quadraticCurveTo(x - wd * 0.62, y - ht * 0.45, x, y - ht); g.quadraticCurveTo(x + wd * 0.62, y - ht * 0.45, x + wd * 0.3, y); g.closePath(); };
  if (ink) { ctx.beginPath(); trace(ctx); ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.beginPath(); trace(ctx); ctx.fillStyle = dark; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - wd * 0.3, y); ctx.quadraticCurveTo(x - wd * 0.62, y - ht * 0.45, x, y - ht); ctx.quadraticCurveTo(x - wd * 0.1, y - ht * 0.5, x - wd * 0.08, y); ctx.closePath(); ctx.fillStyle = light; ctx.fill();
}

/** Round tree crown on a short trunk (umbrella pine when flat). */
function paintTree(ctx, x, y, size, flat, dark, light, ink, rnd) {
  const rx = size * (flat ? 0.75 : 0.5), ry = size * (flat ? 0.3 : 0.48), cy = y - size * (flat ? 0.78 : 0.56), lumps = [];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + rnd(); lumps.push([x + Math.cos(a) * rx * (0.9 + rnd() * 0.2), cy + Math.sin(a) * ry * (0.9 + rnd() * 0.2)]); }
  const trace = (g) => { g.moveTo(lumps[0][0], lumps[0][1]); for (let i = 0; i < 7; i++) { const a = lumps[i], b = lumps[(i + 1) % 7]; g.quadraticCurveTo((a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.5, (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.5, b[0], b[1]); } g.closePath(); };
  ctx.fillStyle = ink || dark; ctx.fillRect(x - size * 0.05, cy, size * 0.1, y - cy);
  if (ink) { ctx.beginPath(); trace(ctx); ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.beginPath(); trace(ctx); ctx.fillStyle = dark; ctx.fill();
  clipped(ctx, trace, () => { ctx.save(); ctx.translate(-rx * 0.3, -ry * 0.4); ctx.beginPath(); trace(ctx); ctx.fillStyle = light; ctx.fill(); ctx.restore(); });
}

/** Small palm silhouette: bent trunk and a star of drooping fronds. */
function paintPalm(ctx, x, y, size, dark, light, ink, rnd) {
  const lean = jit(rnd, size * 0.25), top = [x + lean, y - size];
  brushStroke(ctx, sampleCurve([[x, y], [x + lean * 0.3, y - size * 0.5], top], 5), size * 0.07, { color: ink || dark, taperStart: 0, taperEnd: 0.2, swell: 0 });
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.04 + (i / 6) * 0.92) + jit(rnd, 0.12), len = size * (0.34 + rnd() * 0.12), dx = Math.cos(a), dy = Math.sin(a);
    const frond = sampleCurve([top, [top[0] + dx * len * 0.55, top[1] + dy * len * 0.6 - len * 0.1], [top[0] + dx * len, top[1] + dy * len * 0.3 + len * 0.42]], 4);
    brushStroke(ctx, frond, size * 0.1, { color: i % 2 ? dark : light, taperStart: 0.1, taperEnd: 0.6, swell: 0 });
  }
}

/** Sailing boat on the sea: hull stroke, main sail and jib. */
function paintSail(ctx, x, y, size, sail, shade, hull, rnd) {
  const heel = jit(rnd, size * 0.08), flip = rnd() < 0.5 ? -1 : 1;
  ctx.fillStyle = hull; ctx.beginPath(); tracePolygon(ctx, [[x - size * 0.42, y - size * 0.07], [x + size * 0.46, y - size * 0.07], [x + size * 0.34, y], [x - size * 0.34, y]]); ctx.fill();
  ctx.fillStyle = sail; ctx.beginPath(); tracePolygon(ctx, [[x + flip * size * 0.02, y - size * 0.1], [x + flip * size * 0.02 + heel, y - size], [x + flip * size * 0.36, y - size * 0.14]]); ctx.fill();
  ctx.fillStyle = shade; ctx.beginPath(); tracePolygon(ctx, [[x - flip * size * 0.04, y - size * 0.1], [x - flip * size * 0.04 + heel, y - size * 0.86], [x - flip * size * 0.3, y - size * 0.12]]); ctx.fill();
}

/** City building: lit front, shaded side, roof clutter and rows of windows. c: { light, base, shade, ink }. */
function paintBlock(ctx, x, y, wd, ht, c, style, u, rnd) {
  const side = wd * (0.2 + rnd() * 0.16), x0 = x - wd / 2, top = y - ht;
  const roof = [];
  if (style === 'spire') roof.push([[x - wd * 0.12, top], [x - wd * 0.06, top - ht * 0.16], [x, top - ht * 0.42], [x + wd * 0.06, top - ht * 0.16], [x + wd * 0.12, top]]);
  else if (style === 'step') roof.push([[x0 + wd * 0.16, top], [x0 + wd * 0.16, top - ht * 0.09], [x0 + wd * 0.34, top - ht * 0.09], [x0 + wd * 0.34, top - ht * 0.17], [x0 + wd * 0.7, top - ht * 0.17], [x0 + wd * 0.7, top - ht * 0.09], [x0 + wd * 0.86, top - ht * 0.09], [x0 + wd * 0.86, top]]);
  else if (style === 'slant') roof.push([[x0, top], [x0, top - ht * 0.05], [x0 + wd, top - ht * 0.2], [x0 + wd, top]]);
  else if (style === 'plant') roof.push([[x0 + wd * 0.12, top], [x0 + wd * 0.12, top - 5 * u], [x0 + wd * 0.4, top - 5 * u], [x0 + wd * 0.4, top]], [[x0 + wd * 0.62, top], [x0 + wd * 0.62, top - 9 * u], [x0 + wd * 0.68, top - 9 * u], [x0 + wd * 0.68, top]]);
  const trace = (g) => { g.rect(x0, top, wd, ht + 4); for (const r of roof) tracePolygon(g, r); };
  if (c.ink) { ctx.beginPath(); trace(ctx); ctx.strokeStyle = c.ink; ctx.lineWidth = 2.4 * u; ctx.lineJoin = 'miter'; ctx.stroke(); }
  ctx.beginPath(); trace(ctx); ctx.fillStyle = c.light; ctx.fill();
  ctx.fillStyle = c.base; ctx.fillRect(x0 + wd - side, top, side, ht + 4);
  if (style === 'spire' || style === 'step') { ctx.beginPath(); for (const r of roof) tracePolygon(ctx, r); ctx.fillStyle = c.base; ctx.fill(); }
  if (c.windows) {
    // window bands on the lit front, darker on the side
    const rows = Math.max(2, Math.round(ht / (c.windows * u))), bandH = (ht / rows) * 0.36;
    for (let r = 0; r < rows; r++) {
      const yy = top + (r + 0.4) * (ht / rows);
      ctx.fillStyle = c.base; ctx.fillRect(x0 + 2 * u, yy, wd - side - 4 * u, bandH);
      ctx.fillStyle = c.shade; ctx.fillRect(x0 + wd - side + 1.5 * u, yy, side - 3 * u, bandH);
    }
  }
}

/** Tower crane: lattice mast, jib and counter-jib with ballast, hook line. */
function paintCrane(ctx, x, y, ht, reach, color, u, rnd) {
  const flip = rnd() < 0.5 ? -1 : 1, top = y - ht, lw = Math.max(1.6, 2.2 * u);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'miter';
  ctx.fillRect(x - 1.5 * lw, top, lw, ht); ctx.fillRect(x + 0.5 * lw, top, lw, ht);
  ctx.lineWidth = lw * 0.5; ctx.beginPath();
  for (let yy = top; yy < y; yy += lw * 4.5) { ctx.moveTo(x - 1.5 * lw, yy); ctx.lineTo(x + 1.5 * lw, yy + lw * 2.2); ctx.lineTo(x - 1.5 * lw, yy + lw * 4.5); }
  ctx.stroke();
  ctx.fillRect(x - flip * reach * 0.3, top - lw * 0.5, flip * reach * 1.3, lw * 1.2);
  ctx.fillRect(x - flip * reach * 0.3, top + lw * 0.4, flip * reach * 0.12, lw * 2.6);
  ctx.beginPath(); ctx.moveTo(x - flip * reach * 0.3, top); ctx.lineTo(x, top - ht * 0.11); ctx.lineTo(x + flip * reach * 0.62, top); ctx.stroke();
  ctx.fillRect(x - lw, top - ht * 0.11, lw * 2, ht * 0.11);
  const hook = x + flip * reach * (0.35 + rnd() * 0.5);
  ctx.fillRect(hook, top, lw * 0.5, ht * (0.2 + rnd() * 0.4));
}

/** Factory chimney with a warning band and a flat plume of smoke leaning with the wind. */
function paintChimney(ctx, x, y, ht, wd, c, plume, u, rnd) {
  const top = y - ht, shaft = [[x - wd * 0.5, y], [x - wd * 0.32, top], [x + wd * 0.32, top], [x + wd * 0.5, y]];
  if (plume) {
    const puffs = [];
    for (let i = 0; i < 5; i++) puffs.push([x + (8 + i * 15) * u * (1 + rnd() * 0.3), top - (5 + i * 5.5 + rnd() * 4) * u, (6 + i * 3.2 + rnd() * 2) * u]);
    for (const [color, shift] of [[plume.shade, 0], [plume.light, -1]]) {
      ctx.fillStyle = color; ctx.beginPath();
      for (const [px, py, r] of puffs) { ctx.moveTo(px + r + shift * r * 0.25, py + shift * r * 0.3); ctx.arc(px + shift * r * 0.25, py + shift * r * 0.3, r * (shift ? 0.8 : 1), 0, TAU); }
      ctx.fill();
    }
  }
  if (c.ink) { ctx.beginPath(); tracePolygon(ctx, shaft); ctx.strokeStyle = c.ink; ctx.lineWidth = 2.4 * u; ctx.lineJoin = 'miter'; ctx.stroke(); }
  ctx.beginPath(); tracePolygon(ctx, shaft); ctx.fillStyle = c.light; ctx.fill();
  clipped(ctx, (g) => tracePolygon(g, shaft), () => {
    ctx.fillStyle = c.base; ctx.fillRect(x + wd * 0.06, top, wd, ht);
    ctx.fillStyle = c.band; ctx.fillRect(x - wd, top + ht * 0.06, wd * 2, ht * 0.07); ctx.fillRect(x - wd, top + ht * 0.2, wd * 2, ht * 0.07);
  });
}

// ------------------------------------------------------------------------------------- clouds

/**
 * Cumulus: a heap of billows on a flat base. o: { x, y (base), width, height, c: { light, shade,
 * deep, line }, shadow (0..1 share of shade), deepBase }.
 */
function paintCumulus(env, o, rnd) {
  const { ctx, u } = env;
  const count = Math.max(4, Math.round(o.width / (o.height * 0.42))), puffs = [];
  const lean = jit(rnd, 0.18);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count, dome = Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * t)), 0.9);
    const lift = dome * (0.35 + rnd() * 0.65), r = o.height * (0.2 + 0.22 * dome) * (0.85 + rnd() * 0.3);
    puffs.push({ x: o.x + (t - 0.5 + lean * lift) * o.width * 0.86 + jit(rnd, r * 0.3), y: o.y - r * 0.5 - (o.height - r * 1.4) * lift, r, lift });
  }
  // a row of smaller billows along the base hides the feet of the big ones
  for (let i = 0; i < count; i++) { const t = (i + rnd()) / count, r = o.height * (0.16 + rnd() * 0.1); puffs.push({ x: o.x + (t - 0.5) * o.width * 0.94, y: o.y - r * 0.5, r, lift: -1 }); }
  puffs.sort((a, b) => b.lift - a.lift);
  for (const p of puffs) {
    p.ring = [];
    const bumps = Math.max(6, Math.round(p.r / (7 * u)) + 3), rot = rnd() * TAU;
    for (let i = 0; i < bumps; i++) { const a = rot + ((i + jit(rnd, 0.22)) / bumps) * TAU, rr = p.r * (0.94 + rnd() * 0.12); p.ring.push([p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.92]); }
  }
  const ringPath = (g, ring, dx = 0, dy = 0, s = 1, cx = 0, cy = 0) => {
    const q = (p) => [cx + (p[0] - cx) * s + dx, cy + (p[1] - cy) * s + dy];
    const first = q(ring[0]); g.moveTo(first[0], first[1]);
    for (let i = 0; i < ring.length; i++) { const a = q(ring[i]), b = q(ring[(i + 1) % ring.length]); g.quadraticCurveTo((a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.42, (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.42, b[0], b[1]); }
    g.closePath();
  };
  const all = (g) => { for (const p of puffs) ringPath(g, p.ring); };
  const half = o.width * 0.56;
  ctx.save();
  ctx.beginPath(); ctx.rect(o.x - half - o.height, o.y - o.height * 1.6, 2 * half + 2 * o.height, o.height * 1.6); ctx.clip();
  ctx.lineJoin = 'round'; ctx.strokeStyle = o.c.line; ctx.lineWidth = 3 * u;
  ctx.beginPath(); all(ctx); ctx.stroke();
  for (const p of puffs) {
    const one = (g) => ringPath(g, p.ring);
    ctx.beginPath(); one(ctx); ctx.fillStyle = o.c.shade; ctx.fill();
    clipped(ctx, one, () => {
      // lit top of the billow: the same shape pushed toward the light
      const k = o.shadow * (p.lift < 0 ? 1.5 : 1);
      ctx.beginPath(); ringPath(ctx, p.ring, -p.r * 0.1 * k, -p.r * (0.14 + 0.4 * k), 1 - 0.1 * k, p.x, p.y); ctx.fillStyle = o.c.light; ctx.fill();
    });
  }
  // flat underside
  clipped(ctx, all, () => {
    const under = [[o.x - half - 20, o.y + 4]];
    for (let i = 0; i <= 8; i++) under.push([o.x - half + (2 * half * i) / 8, o.y - o.height * (0.07 + o.shadow * 0.16) * (i % 2 ? 1.5 : 0.7) * (0.7 + rnd() * 0.6)]);
    under.push([o.x + half + 20, o.y + 4]);
    ctx.beginPath(); ctx.moveTo(under[0][0], under[0][1]);
    for (let i = 1; i < under.length - 1; i++) ctx.quadraticCurveTo(under[i][0], under[i][1], (under[i][0] + under[i + 1][0]) / 2, (under[i][1] + under[i + 1][1]) / 2);
    ctx.lineTo(under[under.length - 1][0], under[under.length - 1][1]); ctx.closePath();
    ctx.fillStyle = o.deepBase ? o.c.deep : o.c.shade; ctx.fill();
  });
  ctx.restore();
  brushStroke(ctx, [[o.x - half * 0.9, o.y], [o.x, o.y + 0.5 * u], [o.x + half * 0.9, o.y]], 2.4 * u, { color: o.c.line, taper: 0.3, swell: 0.2 });
}

/** Stratus: a long flat streak, lit on top, shaded underneath, tapering at both ends. */
function paintStratus(env, o, rnd) {
  const { ctx } = env, half = o.width / 2, upper = [], lower = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n, taper = Math.pow(Math.sin(Math.PI * t), 0.6);
    upper.push([o.x - half + o.width * t, o.y - o.height * taper * (0.55 + (i % 2) * 0.45) * (0.8 + rnd() * 0.4)]);
    lower.push([o.x - half + o.width * t, o.y + o.height * 0.22 * taper * (0.5 + rnd())]);
  }
  const outline = sampleCurve(upper, 5).concat(sampleCurve(lower, 5).reverse());
  const trace = (g) => tracePolygon(g, outline);
  if (o.c.line) { ctx.beginPath(); trace(ctx); ctx.strokeStyle = o.c.line; ctx.lineWidth = 2.4 * env.u; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.beginPath(); trace(ctx); ctx.fillStyle = o.c.shade; ctx.fill();
  clipped(ctx, trace, () => { ctx.save(); ctx.translate(-o.width * 0.02, -o.height * (0.3 + 0.3 * (1 - o.shadow))); ctx.beginPath(); trace(ctx); ctx.fillStyle = o.c.light; ctx.fill(); ctx.restore(); });
}

/** How overcast a palette is (0 clear blue sky .. 1 grey sky), read from the saturation of its zenith. */
function overcast(P) {
  const [r, g, b] = hexToRgb(P.skyTop), max = Math.max(r, g, b), min = Math.min(r, g, b);
  return Math.max(0, Math.min(1, (0.7 - (max - min) / (max || 1)) / 0.24));
}

const CLOUD_STYLE = {
  hills: { cumulus: 8, stratus: 3, size: 1 }, mountains: { cumulus: 7, stratus: 2, size: 1.15 }, sea: { cumulus: 9, stratus: 2, size: 0.9 },
  dunes: { cumulus: 3, stratus: 5, size: 0.7 }, mesas: { cumulus: 4, stratus: 4, size: 0.85 }, city: { cumulus: 7, stratus: 4, size: 0.95 }, flat: { cumulus: 9, stratus: 2, size: 1.1 },
};

function paintClouds(env) {
  const { w, h, u, y0, P, rnd } = env, grey = overcast(P), style = CLOUD_STYLE[env.kind];
  // clouds near the horizon are seen through more air: paler, smaller, flatter
  const colors = (depth, dark) => {
    const air = depth * 0.5;
    return { light: mixHex(dark ? mixHex(P.cloudLight, P.cloudShade, 0.35) : P.cloudLight, P.skyLow, air), shade: mixHex(dark ? mixHex(P.cloudShade, P.cloudDeep, 0.5) : P.cloudShade, P.skyLow, air),
      deep: mixHex(P.cloudDeep, P.skyLow, air), line: mixHex(mixHex(P.cloudDeep, P.skyTop, 0.35), P.skyLow, air * 0.8) };
  };
  const items = [];
  // high streaks first, then heaps from the horizon upward (the nearest, highest clouds last)
  scatter(rnd, w, Math.round(style.stratus * (1 + grey * 1.6)), 0.4, (x, r) => {
    const level = r(), y = lerp(y0 - 90 * u, 70 * u, level), width = (260 + r() * 420) * u * (0.6 + level * 0.6);
    items.push({ order: level * 0.2, x, half: width / 2, seed: newSeed(r), paint: (rr) => paintStratus(env, { x, y, width, height: (9 + rr() * 9) * u * (0.6 + level * 0.7), c: colors(1 - level, grey > 0.5 && rr() < 0.6), shadow: 0.4 + grey * 0.4 }, rr) });
  });
  scatter(rnd, w, Math.round(style.cumulus * (1 + grey * 1.3)), 0.42, (x, r) => {
    const level = Math.pow(r(), 1.25 - grey * 0.4), y = lerp(y0 - 70 * u, 190 * u, level), scale = style.size * (0.5 + level * 0.9) * (0.8 + r() * 0.5) * (1 + grey * 0.25);
    const width = (190 + r() * 230) * u * scale, height = Math.min(y - 14 * u, (70 + r() * 60) * u * scale * (0.6 + level * 0.4));
    const dark = grey > 0.3 && r() < grey * 0.75;
    items.push({ order: 1 + level, x, half: width * 0.56 + height, seed: newSeed(r), paint: (rr) => paintCumulus(env, { x, y, width, height, c: colors(1 - level, dark), shadow: 0.34 + grey * 0.5 + (dark ? 0.2 : 0), deepBase: dark || grey > 0.6 }, rr) });
  });
  items.sort((a, b) => a.order - b.order);
  for (const it of items) stamp(env, it.x - it.half, it.x + it.half, it.seed, it.paint);
  void h;
}

// ------------------------------------------------------------------------- far relief by kind

function farTones(P, amount = 0) { return hazed(tones(P.farReliefLight, P.farRelief, P.farReliefShade), P.haze, amount); }

/** Row of objects of one kind painted back to front (the tallest first). */
function row(env, count, jitter, make) {
  const list = [];
  scatter(env.rnd, env.w, count, jitter, (x, r, i) => { const o = make(x, r, i); if (o) list.push({ o, seed: newSeed(r) }); });
  list.sort((a, b) => (b.o.rank ?? b.o.height) - (a.o.rank ?? a.o.height));
  for (const { o, seed } of list) stamp(env, o.x - o.reach, o.x + o.reach, seed, (r) => o.paint(o, r));
}

function farHills(env) {
  const { u, y0, P } = env;
  const back = farTones(P, 0.42), mid = farTones(P, 0.16), front = tones(P.farRelief, mixHex(P.farRelief, P.farReliefShade, 0.55), P.farReliefShade);
  row(env, 6, 0.3, (x, r) => ({ x, halfW: (520 + r() * 420) * u, height: (120 + r() * 110) * u, base: y0, tones: back, edge: 'smooth', get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  row(env, 8, 0.3, (x, r) => ({ x, halfW: (380 + r() * 360) * u, height: (70 + r() * 80) * u, base: y0, tones: mid, edge: 'scallop', grain: 9 * u, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  row(env, 9, 0.3, (x, r) => ({ x, halfW: (300 + r() * 320) * u, height: (36 + r() * 52) * u, base: y0, tones: front, edge: 'scallop', grain: 12 * u, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  groundHaze(env, 120, 0.5);
}

function farMountains(env) {
  const { u, y0, P } = env;
  const backRock = hazed(tones(P.farReliefLight, P.farRelief, P.farReliefShade), P.haze, 0.25);
  const snowShade = mixHex(P.snow, P.farRelief, 0.42);
  // main range: high snowy summits
  row(env, 11, 0.32, (x, r) => {
    const height = (190 + Math.pow(r(), 1.3) * 190) * u;
    return { x, height, left: height * (1.0 + r() * 0.7), right: height * (0.9 + r() * 0.7), base: y0, tones: backRock, snow: P.snow, snowShade, snowLine: (150 + r() * 40) * u, detail: 2, get reach() { return Math.max(this.left, this.right); }, paint: (o, rr) => paintPeak(env, o, rr) };
  });
  // lower spurs in front of it, darker, with little snow
  const frontRock = tones(P.farRelief, P.farReliefShade, P.farReliefShade);
  row(env, 12, 0.35, (x, r) => {
    const height = (80 + r() * 100) * u;
    return { x, height, left: height * (1.5 + r() * 1.0), right: height * (1.4 + r() * 1.0), base: y0, tones: frontRock, snow: mixHex(P.snow, P.farReliefLight, 0.25), snowShade, snowLine: height > 158 * u ? 150 * u : 0, rough: 0.08, detail: 1, get reach() { return Math.max(this.left, this.right); }, paint: (o, rr) => paintPeak(env, o, rr) };
  });
  groundHaze(env, 150, 0.55);
}

function farSea(env) {
  const { ctx, w, h, u, y0, P, rnd } = env;
  // the sea rises a little above the true horizon so that it shows over the far end of the land
  const seaTop = y0 - 44 * u, far = mixHex(P.waterB, P.haze, 0.55), mid = mixHex(P.waterB, P.haze, 0.2);
  // headlands and islands standing on the sea horizon
  const land = farTones(P, 0.3), nearer = farTones(P, 0.05);
  row(env, 5, 0.4, (x, r) => ({ x, halfW: (300 + r() * 520) * u, height: (40 + r() * 90) * u, base: seaTop + 2 * u, tones: land, edge: 'smooth', power: 0.6 + r() * 0.3, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  ctx.fillStyle = far; ctx.fillRect(0, seaTop, w, h - seaTop);
  ctx.fillStyle = mid; ctx.fillRect(0, seaTop + 13 * u, w, h - seaTop);
  ctx.fillStyle = P.waterB; ctx.fillRect(0, seaTop + 27 * u, w, h - seaTop);
  ctx.fillStyle = P.waterA; ctx.fillRect(0, seaTop + 40 * u, w, h - seaTop);
  // ragged joins between the bands of water, glitter toward the horizon
  const streak = (y, color, count, len) => scatter(rnd, w, count, 0.5, (x, r) => { const l = len * (0.4 + r()) * u, yy = y + jit(r, 2.5 * u); wrapped(ctx, w, x - l, x + l, () => brushStroke(ctx, [[x - l / 2, yy], [x, yy + 0.4 * u], [x + l / 2, yy]], (1.6 + r() * 1.6) * u, { color, taper: 0.45, swell: 0 })); });
  streak(seaTop + 13 * u, far, 26, 150); streak(seaTop + 27 * u, mid, 22, 190); streak(seaTop + 40 * u, P.waterB, 18, 240);
  streak(seaTop + 6 * u, mixHex(P.cloudLight, far, 0.35), 16, 120); streak(seaTop + 21 * u, mixHex(P.cloudLight, mid, 0.5), 10, 90);
  // a nearer island with a lighthouse, sails
  row(env, 2, 0.3, (x, r) => ({ x, halfW: (150 + r() * 160) * u, height: (26 + r() * 30) * u, base: seaTop + 9 * u, tones: nearer, edge: 'smooth', power: 0.7, get reach() { return this.halfW + 20 * u; }, paint: (o, rr) => {
    const yAt = paintHill(env, o, rr), lx = o.x + o.halfW * jit(rr, 0.3), ly = yAt(lx) + 2 * u;
    ctx.fillStyle = mixHex(P.cloudLight, P.haze, 0.3); ctx.fillRect(lx - 1.6 * u, ly - 15 * u, 3.2 * u, 15 * u);
    ctx.fillStyle = nearer.shade; ctx.fillRect(lx - 2.4 * u, ly - 18 * u, 4.8 * u, 3.4 * u);
    brushStroke(ctx, [[o.x - o.halfW * 0.9, o.base + 1.5 * u], [o.x, o.base + 2 * u], [o.x + o.halfW * 0.9, o.base + 1.5 * u]], 2 * u, { color: mixHex(P.cloudLight, far, 0.3), taper: 0.3, swell: 0.3 });
  } }));
  const sail = mixHex(P.cloudLight, P.haze, 0.15), sailShade = mixHex(P.cloudShade, P.haze, 0.2), hull = mixHex(P.farReliefShade, P.waterA, 0.4);
  scatter(rnd, w, 9, 0.45, (x, r) => {
    const depth = r(), size = (9 + depth * 17) * u, y = seaTop + (4 + depth * 30) * u, seed = newSeed(r);
    wrapped(ctx, w, x - size, x + size, () => paintSail(ctx, x, y, size, sail, sailShade, hull, seeded(seed)));
  });
  // a freighter on the horizon
  scatter(rnd, w, 2, 0.4, (x, r) => {
    const s = (30 + r() * 16) * u, y = seaTop + 2.5 * u, c = mixHex(P.farReliefShade, P.haze, 0.25);
    wrapped(ctx, w, x - s, x + s, () => { ctx.fillStyle = c; ctx.fillRect(x - s / 2, y - 3 * u, s, 3 * u); ctx.fillRect(x + s * 0.24, y - 7.5 * u, s * 0.16, 4.5 * u); ctx.fillRect(x + s * 0.3, y - 10 * u, 2 * u, 3 * u); });
  });
}

function farDunes(env) {
  const { u, y0, P } = env;
  const back = farTones(P, 0.4), mid = farTones(P, 0.12);
  // a distant plateau, then two ranks of sand ridges
  row(env, 4, 0.3, (x, r) => ({ x, top: (160 + r() * 300) * u, height: (60 + r() * 50) * u, cap: 0.3, apron: (150 + r() * 120) * u, base: y0, tones: back, strata: [[0.5, 0.12]], get reach() { return this.top + this.apron * 1.6; }, paint: (o, rr) => paintMesa(env, o, rr) }));
  row(env, 9, 0.3, (x, r) => ({ x, halfW: (300 + r() * 380) * u, height: (50 + r() * 80) * u, base: y0, tones: mid, get reach() { return this.halfW; }, paint: (o, rr) => paintDune(env, o, rr) }));
  row(env, 10, 0.3, (x, r) => ({ x, halfW: (260 + r() * 300) * u, height: (26 + r() * 44) * u, base: y0, tones: tones(P.farReliefLight, P.farRelief, P.farReliefShade), get reach() { return this.halfW; }, paint: (o, rr) => paintDune(env, o, rr) }));
  groundHaze(env, 100, 0.45);
}

function farMesas(env) {
  const { u, y0, P } = env;
  const back = farTones(P, 0.42), mid = farTones(P, 0.08);
  const strataBack = [[0.3, 0.07]], strataMid = [[0.22, 0.06], [0.52, 0.1], [0.8, 0.04]];
  row(env, 5, 0.35, (x, r) => { const height = (120 + r() * 90) * u; return { x, top: (120 + r() * r() * 520) * u, height, cap: 0.5 + r() * 0.15, apron: height * (0.7 + r() * 0.4), base: y0, tones: back, strata: strataBack, get reach() { return this.top + this.apron * 1.6; }, paint: (o, rr) => paintMesa(env, o, rr) }; });
  row(env, 7, 0.35, (x, r, i) => {
    const spire = i % 3 === 1, height = (spire ? 110 + r() * 80 : 70 + r() * 80) * u;
    return { x, top: (spire ? 12 + r() * 22 : 70 + r() * r() * 330) * u, height, cap: spire ? 0.66 : 0.48 + r() * 0.14, apron: height * (0.6 + r() * 0.4), base: y0, tones: mid, strata: strataMid, get reach() { return this.top + this.apron * 1.6; }, paint: (o, rr) => paintMesa(env, o, rr) };
  });
  groundHaze(env, 110, 0.45);
}

function farCity(env) {
  const { ctx, w, h, u, y0, P, rnd } = env;
  // low hills behind the town, then two ranks of towers lost in the haze
  row(env, 5, 0.3, (x, r) => ({ x, halfW: (500 + r() * 500) * u, height: (30 + r() * 46) * u, base: y0, tones: farTones(P, 0.5), edge: 'smooth', get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  const ranks = [{ c: farTones(P, 0.42), count: 60, height: 54, width: 20 }, { c: farTones(P, 0.12), count: 54, height: 78, width: 26 }];
  for (const rank of ranks) {
    // towers cluster into a few districts
    const centres = [rnd(), rnd(), rnd()];
    scatter(rnd, w, rank.count, 0.5, (x, r) => {
      let near = 1; for (const c of centres) { const d = Math.abs(((x / w - c + 1.5) % 1) - 0.5); near = Math.min(near, d); }
      const cluster = Math.pow(Math.max(0, 1 - near * 7), 1.5), tall = cluster > 0.2 && r() < 0.6;
      const ht = (tall ? rank.height * (0.8 + cluster * 1.4 + r() * 0.8) : rank.height * (0.2 + r() * 0.45)) * u, wd = rank.width * (0.7 + r() * (tall ? 0.7 : 1.8)) * u;
      const style = tall ? ['flat', 'spire', 'step', 'slant', 'flat'][Math.floor(r() * 5)] : 'flat', seed = newSeed(r);
      wrapped(ctx, w, x - wd, x + wd, () => paintBlock(ctx, x, y0, wd, ht, { light: rank.c.light, base: rank.c.base, shade: rank.c.shade, windows: tall && rank.height > 60 ? 9 : 0 }, style, u, seeded(seed)));
    });
  }
  ctx.fillStyle = mixHex(P.farRelief, P.haze, 0.2); ctx.fillRect(0, y0 - 5 * u, w, h - y0 + 5 * u);
  groundHaze(env, 90, 0.5);
}

function farFlat(env) {
  const { ctx, w, h, u, y0, P, rnd } = env;
  // very low swells on the horizon, a distant line of woods, a few landmarks
  row(env, 5, 0.3, (x, r) => ({ x, halfW: (600 + r() * 600) * u, height: (16 + r() * 22) * u, base: y0, tones: farTones(P, 0.45), edge: 'smooth', power: 0.7, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  const wood = farTones(P, 0.1);
  row(env, 12, 0.4, (x, r) => ({ x, halfW: (140 + r() * 260) * u, height: (9 + r() * 12) * u, base: y0, tones: wood, edge: 'scallop', grain: 8 * u, power: 0.35, skew: 0, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  // water towers, a church, pylons of a power line marching across the plain
  scatter(rnd, w, 4, 0.4, (x, r, i) => {
    const c = wood.shade, s = (16 + r() * 8) * u;
    wrapped(ctx, w, x - s, x + s, () => {
      ctx.fillStyle = c;
      if (i % 2) { ctx.fillRect(x - s * 0.08, y0 - s * 1.5, s * 0.16, s * 1.5); ctx.beginPath(); ctx.ellipse(x, y0 - s * 1.55, s * 0.36, s * 0.2, 0, 0, TAU); ctx.fill(); } else { ctx.fillRect(x - s * 0.16, y0 - s, s * 0.32, s); ctx.beginPath(); tracePolygon(ctx, [[x - s * 0.2, y0 - s], [x, y0 - s * 2], [x + s * 0.2, y0 - s]]); ctx.fill(); ctx.fillRect(x + s * 0.16, y0 - s * 0.5, s * 0.9, s * 0.5); }
    });
  });
  const pylonGap = w / 14, pylon = mixHex(P.farReliefShade, P.haze, 0.2);
  for (let i = 0; i < 14; i++) {
    const x = (i + 0.5) * pylonGap, s = 26 * u;
    ctx.strokeStyle = pylon; ctx.lineWidth = 1.5 * u; ctx.beginPath();
    ctx.moveTo(x - s * 0.16, y0); ctx.lineTo(x - s * 0.04, y0 - s); ctx.lineTo(x + s * 0.04, y0 - s); ctx.lineTo(x + s * 0.16, y0);
    ctx.moveTo(x - s * 0.3, y0 - s * 0.82); ctx.lineTo(x + s * 0.3, y0 - s * 0.82); ctx.moveTo(x - s * 0.22, y0 - s * 0.62); ctx.lineTo(x + s * 0.22, y0 - s * 0.62);
    ctx.stroke();
    ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.moveTo(x + s * 0.3, y0 - s * 0.82); ctx.quadraticCurveTo(x + pylonGap / 2, y0 - s * 0.62, x + pylonGap - s * 0.3, y0 - s * 0.82); ctx.stroke();
  }
  ctx.fillStyle = wood.base; ctx.fillRect(0, y0 - 3 * u, w, h - y0 + 3 * u);
  groundHaze(env, 60, 0.45);
}

// ------------------------------------------------------------------------ near relief by kind

function nearTones(P, amount = 0) {
  return hazed(tones(P.nearReliefLight, P.nearRelief, P.nearReliefShade, mixHex(P.ink, P.nearReliefShade, 0.45)), P.haze, amount);
}

/** Colours of distant buildings: the palette's walls and roofs seen through some air. */
function builtColors(P, amount, ink) {
  return { wallLight: mixHex(P.wallLight, P.haze, amount), wall: mixHex(P.wallShade, P.haze, amount), roof: mixHex(P.roof, P.haze, amount), roofShade: mixHex(P.roofShade, P.haze, amount), ink };
}

function nearHills(env) {
  const { ctx, u, y0, P } = env;
  const back = nearTones(P, 0.34), front = nearTones(P, 0.08);
  const field = [mixHex(P.mown, P.haze, 0.3), mixHex(P.gravelA, P.nearReliefLight, 0.45), mixHex(P.nearReliefLight, P.haze, 0.25)];
  const built = builtColors(P, 0.25, front.ink);
  row(env, 7, 0.3, (x, r) => ({ x, halfW: (420 + r() * 380) * u, height: (70 + r() * 70) * u, base: y0, tones: back, edge: 'scallop', grain: 11 * u, contour: 1, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  row(env, 8, 0.3, (x, r, i) => ({
    x, halfW: (330 + r() * 330) * u, height: (30 + r() * 52) * u, base: y0 + 6 * u, tones: front, edge: 'scallop', grain: 17 * u, contour: 1.5, get reach() { return this.halfW; },
    paint: (o, rr) => paintHill(env, { ...o, detail: (yAt, r2) => {
      // clearings: fields that follow the roundness of the hill, edged with hedges
      const cells = 2 + Math.floor(r2() * 3);
      for (let c = 0; c < cells; c++) {
        const t0 = -0.6 + r2() * 0.9, t1 = t0 + 0.12 + r2() * 0.2, v0 = 0.3 + r2() * 0.3, v1 = Math.min(1, v0 + 0.25 + r2() * 0.3), lean = jit(r2, 0.08);
        const at = (t, v) => { const xx = o.x + (t + lean * v) * o.halfW, yy = yAt(xx) + 10 * u; return [xx, yy + (o.base - yy) * v]; };
        const quad = [];
        for (let q = 0; q <= 5; q++) quad.push(at(lerp(t0, t1, q / 5), v0));
        for (let q = 5; q >= 0; q--) quad.push(at(lerp(t0, t1, q / 5), v1));
        ctx.beginPath(); tracePolygon(ctx, quad); ctx.fillStyle = field[(c + i) % 3]; ctx.fill();
        brushStroke(ctx, quad.slice(0, 6), 3.4 * u, { color: front.shade, taper: 0.1, swell: 0.5, seed: c });
        brushStroke(ctx, [at(t0, v0), at(t0, (v0 + v1) / 2), at(t0, v1)], 2.6 * u, { color: front.shade, taper: 0.1, swell: 0.5, seed: c + 3 });
      }
      if (i % 3 === 0) {
        // a village with its church at the foot of the hill
        const vx = o.x + o.halfW * jit(r2, 0.4), vy = o.base - 6 * u;
        for (let b = 0; b < 6; b++) paintHouse(ctx, vx + (b - 2.5) * 15 * u + jit(r2, 4 * u), vy - r2() * 6 * u, (11 + r2() * 7) * u, (7 + r2() * 4) * u, built, false, r2);
        ctx.fillStyle = built.ink; ctx.fillRect(vx - 3.6 * u, vy - 25 * u, 7.2 * u, 22 * u);
        ctx.fillStyle = built.wallLight; ctx.fillRect(vx - 2.6 * u, vy - 24 * u, 5.2 * u, 22 * u);
        ctx.beginPath(); tracePolygon(ctx, [[vx - 3.6 * u, vy - 24 * u], [vx, vy - 38 * u], [vx + 3.6 * u, vy - 24 * u]]); ctx.fillStyle = built.roofShade; ctx.fill();
      }
    } }, rr),
  }));
  groundHaze(env, 46, 0.3);
}

function nearMountains(env) {
  const { ctx, u, y0, P } = env;
  const back = nearTones(P, 0.36), front = nearTones(P, 0.06);
  const meadow = mixHex(P.mown, P.haze, 0.22), built = builtColors(P, 0.2, front.ink);
  const rock = hazed(tones(P.rockLight, P.rock, P.rockShade, front.ink), P.haze, 0.3);
  // steep wooded spurs: firs on the crests, alpine meadows and chalets lower down
  row(env, 7, 0.3, (x, r) => ({ x, halfW: (330 + r() * 330) * u, height: (110 + r() * 80) * u, base: y0, tones: back, edge: 'fir', grain: 7 * u, power: 1.2 + r() * 0.5, contour: 1, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  row(env, 8, 0.3, (x, r, i) => ({
    x, halfW: (300 + r() * 300) * u, height: (44 + r() * 70) * u, base: y0 + 6 * u, tones: front, edge: 'fir', grain: 11 * u, power: 1.1 + r() * 0.5, contour: 1.5, get reach() { return this.halfW; },
    paint: (o, rr) => paintHill(env, { ...o, detail: (yAt, r2) => {
      // a meadow below the tree line, edged by a ragged row of firs
      const t0 = -0.5 + r2() * 0.5, t1 = t0 + 0.3 + r2() * 0.3, upper = [], lower = [];
      for (let q = 0; q <= 8; q++) { const xx = o.x + lerp(t0, t1, q / 8) * o.halfW, yy = yAt(xx); upper.push([xx, yy + (o.base - yy) * (0.42 + 0.1 * Math.sin(q * 1.3))]); lower.push([xx, o.base + 6 * u]); }
      ctx.beginPath(); tracePolygon(ctx, upper.concat(lower.reverse())); ctx.fillStyle = meadow; ctx.fill();
      ctx.beginPath();
      for (let q = 0; q < 26; q++) { const f = q / 25, a = upper[Math.min(7, Math.floor(f * 8))], b = upper[Math.min(8, Math.floor(f * 8) + 1)], g = f * 8 - Math.floor(f * 8), xx = lerp(a[0], b[0], g), yy = lerp(a[1], b[1], g) + 3 * u, s = (7 + r2() * 6) * u; ctx.moveTo(xx - s * 0.4, yy); ctx.lineTo(xx, yy - s * 1.5); ctx.lineTo(xx + s * 0.4, yy); }
      ctx.fillStyle = front.shade; ctx.fill();
      if (i % 2 === 0) for (let b = 0; b < 3; b++) { const xx = o.x + lerp(t0, t1, 0.25 + b * 0.25) * o.halfW; paintHouse(ctx, xx, upper[4][1] + (16 + r2() * 14) * u, (15 + r2() * 6) * u, (7 + r2() * 3) * u, built, false, r2); }
      if (i % 3 === 1) {
        // a bare rock face breaking through the forest
        const xx = o.x + o.halfW * (0.1 + r2() * 0.2), yy = yAt(xx) + 14 * u, s = (26 + r2() * 20) * u, face = [[xx - s * 0.5, yy + s], [xx - s * 0.3, yy + s * 0.2], [xx, yy], [xx + s * 0.4, yy + s * 0.3], [xx + s * 0.6, yy + s * 1.1]];
        ctx.beginPath(); tracePolygon(ctx, face); ctx.strokeStyle = rock.ink; ctx.lineWidth = 2 * u; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = rock.light; ctx.fill();
        ctx.beginPath(); tracePolygon(ctx, [[xx, yy], [xx + s * 0.4, yy + s * 0.3], [xx + s * 0.6, yy + s * 1.1], [xx + s * 0.12, yy + s]]); ctx.fillStyle = rock.shade; ctx.fill();
      }
    } }, rr),
  }));
  groundHaze(env, 46, 0.3);
}

function nearSea(env) {
  const { ctx, w, u, y0, P, rnd } = env;
  const back = nearTones(P, 0.3), front = nearTones(P, 0.05);
  const built = builtColors(P, 0.12, front.ink), cypress = [mixHex(P.cypressShade, P.haze, 0.15), mixHex(P.cypress, P.haze, 0.15)], pines = [mixHex(P.pineShade, P.haze, 0.15), mixHex(P.pine, P.haze, 0.15)];
  const rock = hazed(tones(P.rockLight, P.rock, P.rockShade), P.haze, 0.2);
  // two capes close the bay: the hills only stand on part of the panorama, the sea shows between them
  const capes = [0.02 + rnd() * 0.08, 0.52 + rnd() * 0.1].map((c) => ({ centre: c * w, span: (0.17 + rnd() * 0.05) * w }));
  for (const cape of capes) {
    const hills = [];
    for (let i = 0; i < 4; i++) hills.push({ x: cape.centre + ((i + 0.5) / 4 - 0.5) * 2 * cape.span * 0.8 + jit(rnd, 40 * u), halfW: (230 + rnd() * 200) * u, height: (60 + rnd() * 70) * u * (1 - Math.abs(i - 1.5) * 0.22), seed: newSeed(rnd), far: true });
    for (let i = 0; i < 4; i++) hills.push({ x: cape.centre + ((i + 0.5) / 4 - 0.5) * 2 * cape.span + jit(rnd, 50 * u), halfW: (200 + rnd() * 170) * u, height: (36 + rnd() * 54) * u * (1 - Math.abs(i - 1.5) * 0.2), seed: newSeed(rnd), far: false, index: i });
    for (const hill of hills) {
      const o = { x: hill.x, halfW: hill.halfW, height: hill.height, base: y0 + 4 * u, tones: hill.far ? back : front, edge: 'scallop', grain: (hill.far ? 10 : 15) * u, contour: hill.far ? 1 : 1.5, power: 0.8 + (hill.seed % 5) * 0.08 };
      stamp(env, o.x - o.halfW - 30 * u, o.x + o.halfW + 30 * u, hill.seed, (r) => {
        const yAt = paintHill(env, hill.far ? o : { ...o, detail: (y2, r2) => {
          // terraces drawn as pale lines across the slope
          for (let i = 0; i < 3; i++) { const t0 = -0.5 + r2() * 0.6, v = 0.45 + i * 0.16, line = []; for (let q = 0; q <= 5; q++) { const xx = o.x + (t0 + q * 0.07) * o.halfW, yy = y2(xx); line.push([xx, yy + (o.base - yy) * v]); } brushStroke(ctx, line, 2 * u, { color: front.light, taper: 0.3, swell: 0.2 }); }
        } }, r);
        if (hill.far) return;
        // villas, cypresses and umbrella pines scattered on the slope
        for (let i = 0; i < 9; i++) {
          const xx = o.x + o.halfW * jit(r, 0.62), yy = yAt(xx), ground = yy + (o.base - yy) * (0.3 + r() * 0.5), kind = r();
          if (ground > y0 - 4 * u) continue;
          if (kind < 0.36) { paintHouse(ctx, xx, ground, (15 + r() * 10) * u, (9 + r() * 5) * u, built, r() < 0.4, r); paintSpike(ctx, xx - (13 + r() * 6) * u, ground + u, (17 + r() * 9) * u, 6 * u, cypress[0], cypress[1], front.ink); } else if (kind < 0.72) for (let q = 0, n = 1 + Math.floor(r() * 3); q < n; q++) paintSpike(ctx, xx + q * 7 * u, ground + q * u, (16 + r() * 13) * u, (5 + r() * 2) * u, cypress[0], cypress[1], front.ink);
          else paintTree(ctx, xx, ground, (20 + r() * 9) * u, true, pines[0], pines[1], front.ink, r);
        }
      });
    }
    // rocky point where the cape falls into the sea, with a line of surf
    for (const side of [-1, 1]) {
      const x = cape.centre + side * cape.span * 1.12, s = (40 + rnd() * 26) * u, base = y0 - 8 * u;
      const cliff = [[x - s, base + 30 * u], [x - s * 0.9, base - s * 0.2], [x - s * 0.3, base - s * (0.5 + rnd() * 0.2)], [x + s * 0.2, base - s * 0.42], [x + s * 0.8, base - s * 0.12], [x + s, base + 30 * u]];
      wrapped(ctx, w, x - s * 1.6, x + s * 1.6, () => {
        ctx.beginPath(); tracePolygon(ctx, cliff); ctx.strokeStyle = front.ink; ctx.lineWidth = 2.4 * u; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = rock.light; ctx.fill();
        ctx.beginPath(); tracePolygon(ctx, [cliff[2], cliff[3], cliff[4], cliff[5], [x + s * 0.1, base + 30 * u], [x - s * 0.05, base - s * 0.1]]); ctx.fillStyle = rock.shade; ctx.fill();
        ctx.beginPath(); tracePolygon(ctx, [cliff[1], cliff[2], [x - s * 0.05, base - s * 0.1], [x - s * 0.5, base]]); ctx.fillStyle = rock.base; ctx.fill();
        brushStroke(ctx, [[x - s * 1.4, base + 5 * u], [x, base + 6.5 * u], [x + s * 1.4, base + 5 * u]], 3 * u, { color: P.cloudLight, taper: 0.3, swell: 0.4 });
      });
    }
  }
}

function nearDunes(env) {
  const { ctx, w, u, y0, P, rnd } = env;
  const back = nearTones(P, 0.3), front = nearTones(P, 0.04);
  row(env, 7, 0.3, (x, r) => ({ x, halfW: (300 + r() * 330) * u, height: (50 + r() * 70) * u, base: y0, tones: back, detail: false, get reach() { return this.halfW; }, paint: (o, rr) => paintDune(env, o, rr) }));
  // an oasis in a hollow between the two ranks of dunes
  const palmDark = mixHex(P.palmShade, P.haze, 0.12), palmLight = mixHex(P.palm, P.haze, 0.12), built = builtColors(P, 0.15, front.ink);
  scatter(rnd, w, 3, 0.3, (x, r) => {
    const seed = newSeed(r), span = (90 + r() * 80) * u;
    wrapped(ctx, w, x - span - 40 * u, x + span + 40 * u, () => {
      const r2 = seeded(seed);
      for (let i = 0; i < 3; i++) paintHouse(ctx, x + jit(r2, span * 0.5), y0 - (6 + r2() * 8) * u, (16 + r2() * 12) * u, (9 + r2() * 5) * u, built, true, r2);
      for (let i = 0; i < 9; i++) paintPalm(ctx, x + jit(r2, span), y0 - r2() * 8 * u, (26 + r2() * 20) * u, palmDark, palmLight, front.ink, r2);
    });
  });
  row(env, 7, 0.3, (x, r) => ({ x, halfW: (320 + r() * 360) * u, height: (22 + r() * 46) * u, base: y0 + 8 * u, tones: front, detail: true, get reach() { return this.halfW; }, paint: (o, rr) => paintDune(env, o, rr) }));
  groundHaze(env, 30, 0.25);
}

function nearMesas(env) {
  const { ctx, w, u, y0, P, rnd } = env;
  const back = nearTones(P, 0.3), front = nearTones(P, 0.04);
  const strata = [[0.16, 0.07], [0.4, 0.03], [0.58, 0.12], [0.86, 0.04]];
  // the nearer buttes leave wide gaps: the far mesas show between them
  row(env, 4, 0.3, (x, r) => { const height = (90 + r() * 60) * u; return { x, top: (90 + r() * 260) * u, height, cap: 0.5 + r() * 0.12, apron: height * (0.8 + r() * 0.4), base: y0, tones: back, strata, detail: true, get reach() { return this.top + this.apron * 1.7; }, paint: (o, rr) => paintMesa(env, o, rr) }; });
  row(env, 3, 0.25, (x, r, i) => {
    const spire = i === 1, height = (spire ? 150 + r() * 40 : 110 + r() * 60) * u;
    return { x, top: (spire ? 20 + r() * 20 : 140 + r() * 240) * u, height, cap: spire ? 0.62 : 0.5 + r() * 0.1, apron: height * (0.7 + r() * 0.3), base: y0 + 6 * u, tones: front, strata, detail: true, get reach() { return this.top + this.apron * 1.7; }, paint: (o, rr) => paintMesa(env, o, rr) };
  });
  // low swells of the desert floor dotted with scrub
  const floor = tones(mixHex(front.light, P.haze, 0.15), mixHex(front.base, P.haze, 0.1), front.shade, front.ink);
  row(env, 9, 0.3, (x, r) => ({ x, halfW: (300 + r() * 300) * u, height: (8 + r() * 16) * u, base: y0 + 6 * u, tones: floor, edge: 'smooth', power: 0.7, contour: 1, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  const scrub = mixHex(P.dryShade, P.haze, 0.15), scrubLight = mixHex(P.dry, P.haze, 0.15);
  scatter(rnd, w, 46, 0.5, (x, r) => { const s = (7 + r() * 9) * u, y = y0 - r() * 9 * u, seed = newSeed(r); wrapped(ctx, w, x - s, x + s, () => paintTree(ctx, x, y + s * 0.3, s, true, scrub, scrubLight, null, seeded(seed))); });
  groundHaze(env, 30, 0.25);
}

function nearCity(env) {
  const { ctx, w, h, u, y0, P, rnd } = env;
  const concrete = (amount, ink) => ({ light: mixHex(P.concreteLight, P.haze, amount), base: mixHex(P.concrete, P.haze, amount), shade: mixHex(P.concreteShade, P.haze, amount), ink });
  const brick = (amount, ink) => ({ light: mixHex(P.wallLight, P.haze, amount), base: mixHex(P.wall, P.haze, amount), shade: mixHex(P.wallShade, P.haze, amount), ink });
  const ink = mixHex(P.ink, P.concreteShade, 0.4), steel = mixHex(P.metalShade, P.haze, 0.2);
  const plume = { light: mixHex(P.smoke, P.haze, 0.2), shade: mixHex(P.smokeShade, P.haze, 0.2) };
  // back rank: big housing blocks and office slabs
  scatter(rnd, w, 30, 0.5, (x, r, i) => {
    const slab = r() < 0.4, ht = (slab ? 44 + r() * 30 : 70 + r() * 80) * u, wd = (slab ? 90 + r() * 80 : 36 + r() * 34) * u, seed = newSeed(r), c = i % 3 ? concrete(0.34, null) : brick(0.34, null);
    wrapped(ctx, w, x - wd, x + wd, () => paintBlock(ctx, x, y0, wd, ht, { ...c, windows: 8 }, ['flat', 'plant', 'step', 'flat'][seed % 4], u, seeded(seed)));
  });
  // chimneys and cranes stand between the two ranks
  scatter(rnd, w, 7, 0.4, (x, r, i) => {
    const seed = newSeed(r), ht = (110 + r() * 60) * u;
    if (i % 2) wrapped(ctx, w, x - 30 * u, x + 130 * u, () => paintChimney(ctx, x, y0, ht, 14 * u, { light: mixHex(P.concreteLight, P.haze, 0.25), base: mixHex(P.concreteShade, P.haze, 0.25), band: mixHex(P.kerbA, P.haze, 0.3), ink: null }, plume, u, seeded(seed)));
    else wrapped(ctx, w, x - ht, x + ht, () => paintCrane(ctx, x, y0, ht * 1.05, ht * 0.62, steel, u, seeded(seed)));
  });
  // front rank: lower buildings with a light pen contour, sheds, a gasometer
  scatter(rnd, w, 26, 0.5, (x, r, i) => {
    const seed = newSeed(r), kind = r();
    if (kind < 0.12) {
      const rad = (26 + r() * 14) * u, c = concrete(0.14, ink);
      wrapped(ctx, w, x - rad * 1.2, x + rad * 1.2, () => {
        ctx.strokeStyle = ink; ctx.lineWidth = 2.4 * u; ctx.strokeRect(x - rad, y0 - rad * 1.3, rad * 2, rad * 1.3 + 4);
        ctx.fillStyle = c.light; ctx.fillRect(x - rad, y0 - rad * 1.3, rad * 2, rad * 1.3 + 4);
        ctx.fillStyle = c.base; ctx.fillRect(x + rad * 0.2, y0 - rad * 1.3, rad * 0.8, rad * 1.3 + 4);
        ctx.fillStyle = c.shade; ctx.fillRect(x + rad * 0.7, y0 - rad * 1.3, rad * 0.3, rad * 1.3 + 4);
        ctx.fillStyle = ink; for (let b = 1; b < 4; b++) ctx.fillRect(x - rad, y0 - rad * 1.3 * (b / 4), rad * 2, 1.2 * u);
      });
      return;
    }
    const shed = kind < 0.4, ht = (shed ? 16 + r() * 12 : 30 + r() * 44) * u, wd = (shed ? 80 + r() * 90 : 40 + r() * 50) * u, c = i % 2 ? concrete(0.12, ink) : brick(0.12, ink);
    wrapped(ctx, w, x - wd, x + wd, () => paintBlock(ctx, x, y0, wd, ht, { ...c, windows: shed ? 0 : 7 }, shed ? (seed % 2 ? 'slant' : 'flat') : ['flat', 'plant', 'flat', 'step'][seed % 4], u, seeded(seed)));
  });
  // trees of the avenues and parks at the foot of the buildings
  const green = nearTones(P, 0.1);
  row(env, 16, 0.45, (x, r) => ({ x, halfW: (70 + r() * 150) * u, height: (11 + r() * 13) * u, base: y0 + 4 * u, tones: green, edge: 'scallop', grain: 11 * u, power: 0.4, skew: 0, contour: 1.2, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  ctx.fillStyle = green.shade; ctx.fillRect(0, y0 + 2 * u, w, h - y0);
  groundHaze(env, 26, 0.25);
}

function nearFlat(env) {
  const { ctx, w, h, u, y0, P, rnd } = env;
  const back = nearTones(P, 0.32), front = nearTones(P, 0.06);
  const ink = front.ink, metal = { light: mixHex(P.metalLight, P.haze, 0.15), base: mixHex(P.metal, P.haze, 0.15), shade: mixHex(P.metalShade, P.haze, 0.15) };
  const built = builtColors(P, 0.15, ink), poplar = [mixHex(P.leafShade, P.haze, 0.15), mixHex(P.leaf, P.haze, 0.15)];
  // strips of crops just above the horizon, hedges and copses
  const crops = [mixHex(P.mown, P.haze, 0.3), mixHex(P.gravelA, P.haze, 0.25), mixHex(P.beyondB, P.haze, 0.3), mixHex(P.grassA, P.haze, 0.3)];
  scatter(rnd, w, 22, 0.4, (x, r, i) => {
    const half = (120 + r() * 160) * u, top = y0 - (5 + r() * 7) * u, lean = jit(r, 30 * u), color = crops[i % 4];
    wrapped(ctx, w, x - half - 40 * u, x + half + 40 * u, () => { ctx.beginPath(); tracePolygon(ctx, [[x - half, y0 + 6 * u], [x - half * 0.8 + lean, top], [x + half * 0.8 + lean, top + jit(seeded(i + 1), 2 * u)], [x + half, y0 + 6 * u]]); ctx.fillStyle = color; ctx.fill(); });
  });
  row(env, 14, 0.45, (x, r) => ({ x, halfW: (90 + r() * 220) * u, height: (12 + r() * 14) * u, base: y0, tones: back, edge: 'scallop', grain: 10 * u, power: 0.4, skew: 0, contour: 1, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  // the airfield: hangars, control tower, radar, wind sock; farms and rows of poplars elsewhere
  const field = rnd() * w;
  for (let i = 0; i < 4; i++) {
    const x = field + (i - 1.5) * 150 * u + jit(rnd, 20 * u), wd = (110 + rnd() * 40) * u, ht = (30 + rnd() * 10) * u;
    wrapped(ctx, w, x - wd, x + wd, () => {
      const arch = (g) => { g.moveTo(x - wd / 2, y0 + 4); g.lineTo(x - wd / 2, y0 - ht * 0.45); g.quadraticCurveTo(x, y0 - ht * 1.5, x + wd / 2, y0 - ht * 0.45); g.lineTo(x + wd / 2, y0 + 4); g.closePath(); };
      ctx.beginPath(); arch(ctx); ctx.strokeStyle = ink; ctx.lineWidth = 2.6 * u; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = metal.base; ctx.fill();
      clipped(ctx, arch, () => {
        ctx.save(); ctx.translate(-wd * 0.12, ht * 0.16); ctx.beginPath(); arch(ctx); ctx.fillStyle = metal.light; ctx.fill(); ctx.restore();
        ctx.fillStyle = metal.shade; ctx.fillRect(x - wd * 0.34, y0 - ht * 0.56, wd * 0.68, ht);
        ctx.fillStyle = ink; for (let d = 1; d < 4; d++) ctx.fillRect(x - wd * 0.34 + (wd * 0.68 * d) / 4, y0 - ht * 0.56, 1.2 * u, ht);
      });
    });
  }
  const tx = field + 330 * u, th = 78 * u;
  wrapped(ctx, w, tx - 120 * u, tx + 120 * u, () => {
    // control tower: shaft, overhanging glazed cab, antennas
    const shaft = [[tx - 9 * u, y0 + 4], [tx - 7 * u, y0 - th * 0.74], [tx + 7 * u, y0 - th * 0.74], [tx + 9 * u, y0 + 4]], cab = [[tx - 13 * u, y0 - th * 0.74], [tx - 17 * u, y0 - th * 0.93], [tx + 17 * u, y0 - th * 0.93], [tx + 13 * u, y0 - th * 0.74]];
    const roof = [[tx - 18.5 * u, y0 - th * 0.93], [tx - 14 * u, y0 - th], [tx + 14 * u, y0 - th], [tx + 18.5 * u, y0 - th * 0.93]];
    ctx.strokeStyle = ink; ctx.lineWidth = 2.6 * u; ctx.lineJoin = 'round';
    ctx.beginPath(); tracePolygon(ctx, shaft); tracePolygon(ctx, cab); tracePolygon(ctx, roof); ctx.stroke();
    ctx.beginPath(); tracePolygon(ctx, shaft); ctx.fillStyle = built.wallLight; ctx.fill();
    ctx.fillStyle = built.wall; ctx.beginPath(); tracePolygon(ctx, [[tx + 2 * u, y0 + 4], [tx + 2 * u, y0 - th * 0.74], [tx + 7 * u, y0 - th * 0.74], [tx + 9 * u, y0 + 4]]); ctx.fill();
    ctx.beginPath(); tracePolygon(ctx, cab); ctx.fillStyle = mixHex(P.glass, P.haze, 0.15); ctx.fill();
    ctx.beginPath(); tracePolygon(ctx, [[tx + 3 * u, y0 - th * 0.74], [tx + 4 * u, y0 - th * 0.93], [tx + 17 * u, y0 - th * 0.93], [tx + 13 * u, y0 - th * 0.74]]); ctx.fillStyle = mixHex(P.glassShade, P.haze, 0.15); ctx.fill();
    ctx.fillStyle = ink; for (const d of [-8, -2.5, 3, 9]) ctx.fillRect(tx + d * u, y0 - th * 0.93, 1.2 * u, th * 0.19);
    ctx.beginPath(); tracePolygon(ctx, roof); ctx.fillStyle = built.roof; ctx.fill();
    ctx.fillStyle = ink; ctx.fillRect(tx - 1 * u, y0 - th * 1.22, 1.6 * u, th * 0.22); ctx.fillRect(tx + 7 * u, y0 - th * 1.12, 1.2 * u, th * 0.12);
    // low terminal building, radar dish and wind sock
    paintBlock(ctx, tx + 46 * u, y0, 70 * u, 15 * u, { light: built.wallLight, base: built.wall, shade: built.roofShade, ink, windows: 7 }, 'flat', u, seeded(7));
    ctx.fillStyle = ink; ctx.fillRect(tx - 62 * u, y0 - 30 * u, 1.8 * u, 30 * u);
    ctx.beginPath(); ctx.ellipse(tx - 61 * u, y0 - 34 * u, 12 * u, 5 * u, -0.35, 0, TAU); ctx.fillStyle = ink; ctx.fill();
    ctx.beginPath(); ctx.ellipse(tx - 61.5 * u, y0 - 34.6 * u, 10 * u, 3.4 * u, -0.35, 0, TAU); ctx.fillStyle = metal.light; ctx.fill();
    ctx.fillStyle = ink; ctx.fillRect(tx - 98 * u, y0 - 22 * u, 1.4 * u, 22 * u);
    ctx.beginPath(); tracePolygon(ctx, [[tx - 97 * u, y0 - 22 * u], [tx - 82 * u, y0 - 19 * u], [tx - 82 * u, y0 - 16.5 * u], [tx - 97 * u, y0 - 17 * u]]); ctx.fillStyle = mixHex(P.kerbA, P.haze, 0.15); ctx.fill();
  });
  scatter(rnd, w, 5, 0.3, (x, r, i) => {
    const seed = newSeed(r);
    if (Math.abs(((x - field) / w + 1.5) % 1 - 0.5) < 0.14) return;
    wrapped(ctx, w, x - 190 * u, x + 190 * u, () => {
      const r2 = seeded(seed);
      if (i % 2) {
        // farm: house, barn and silos
        paintHouse(ctx, x, y0, 34 * u, 15 * u, built, false, r2); paintHouse(ctx, x + 44 * u, y0, 46 * u, 19 * u, { ...built, wallLight: built.roof, wall: built.roofShade, roof: metal.base, roofShade: metal.shade }, false, r2);
        for (const d of [-36, -25]) { ctx.strokeStyle = ink; ctx.lineWidth = 2.4 * u; ctx.strokeRect(x + d * u, y0 - 32 * u, 9 * u, 32 * u); ctx.fillStyle = metal.light; ctx.fillRect(x + d * u, y0 - 32 * u, 9 * u, 32 * u); ctx.fillStyle = metal.base; ctx.fillRect(x + (d + 5) * u, y0 - 32 * u, 4 * u, 32 * u); ctx.beginPath(); ctx.ellipse(x + (d + 4.5) * u, y0 - 32 * u, 5.5 * u, 3 * u, 0, Math.PI, TAU); ctx.fillStyle = ink; ctx.fill(); }
      }
      // wind-break of poplars
      for (let q = 0, n = 7 + Math.floor(r2() * 6); q < n; q++) paintSpike(ctx, x + (i % 2 ? 80 : -70) * u + q * 13 * u, y0 + u, (34 + r2() * 14) * u, 9 * u, poplar[0], poplar[1], ink);
    });
  });
  // hedge line closing the foreground
  row(env, 12, 0.45, (x, r) => ({ x, halfW: (120 + r() * 240) * u, height: (6 + r() * 8) * u, base: y0 + 4 * u, tones: front, edge: 'scallop', grain: 12 * u, power: 0.35, skew: 0, contour: 1.2, get reach() { return this.halfW; }, paint: (o, rr) => paintHill(env, o, rr) }));
  ctx.fillStyle = front.base; ctx.fillRect(0, y0 + 3 * u, w, h - y0);
  groundHaze(env, 22, 0.25);
}

const FAR_RELIEF = { hills: farHills, mountains: farMountains, sea: farSea, dunes: farDunes, mesas: farMesas, city: farCity, flat: farFlat };
const NEAR_RELIEF = { hills: nearHills, mountains: nearMountains, sea: nearSea, dunes: nearDunes, mesas: nearMesas, city: nearCity, flat: nearFlat };

/**
 * Paint one panorama. index: 0 clouds, 1 far relief, 2 near relief. `kind` is the backdrop
 * family of the circuit theme ('hills', 'mountains', 'sea', 'dunes', 'mesas', 'city', 'flat').
 * Colours come from the palette P only, so every kind works under every theme.
 */
export function paintBackdropLayer(index, ctx, w, h, P, kind, rnd) {
  ctx.clearRect(0, 0, w, h);
  const env = { ctx, w, h, P, rnd, u: h / 768, y0: backdropHorizon(h), kind: FAR_RELIEF[kind] ? kind : 'hills' };
  if (index === 0) paintClouds(env);
  else if (index === 1) FAR_RELIEF[env.kind](env);
  else NEAR_RELIEF[env.kind](env);
}
