// Trackside furniture and the strips that run along the road. Painters have the signature
// (ctx, w, h, P, rnd, variant, spec). Strip painters must tile seamlessly from the left edge to
// the right edge (the atlas repeats them along the track); the top edge keeps a little
// transparent margin so the silhouette stays anti-aliased. Props stand on the bottom edge.
// Light comes from above / upper left. The first half of the file is the small construction kit
// shared with buildings.js (ink contours, tube work, lattices, lettered panels, figures, crowds).

import { LINE, seeded, closedCurve, brushStroke, brushCurve, tracePolygon, clipped } from '../styles/ink.js';
import { drawText, measureText } from '../styles/lettering.js';
import { mixHex, shadeHex, lightHex } from '../palettes/palettes.js';
import { groundShadow } from './vegetation.js';

const TAU = Math.PI * 2;

// ---- construction kit ---------------------------------------------------------------------------

/** Translucent ink used for flat cast shadows. */
export function inkAlpha(P, alpha = 0.32) {
  const v = parseInt(P.ink.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

/** Three flat values of a paint colour. */
export function paintTones(hex, light = 0.3, shade = 0.32) {
  return { light: lightHex(hex, light), base: hex, shade: shadeHex(hex, shade) };
}

export function fillRect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

export function fillPoly(ctx, pts, color) { ctx.beginPath(); tracePolygon(ctx, pts); ctx.fillStyle = color; ctx.fill(); }

export function fillTrace(ctx, trace, color, rule) { ctx.beginPath(); trace(ctx); ctx.fillStyle = color; ctx.fill(rule || 'nonzero'); }

export function traceEllipse(g, cx, cy, rx, ry) { g.moveTo(cx + rx, cy); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.closePath(); }

export function fillEllipse(ctx, cx, cy, rx, ry, color) { ctx.beginPath(); traceEllipse(ctx, cx, cy, rx, ry); ctx.fillStyle = color; ctx.fill(); }

/** Straight ruled line (joints, edges). */
export function inkLine(ctx, x0, y0, x1, y1, width, color) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

/**
 * Ink contour around the union of the shapes added by `trace` ("trait sous l'aplat"): call it
 * first, then fill the shapes over it. The line is heavier underneath and on the right (shadow side).
 */
export function contour(ctx, trace, ink, width = LINE.silhouette, heavy = 1, join = 'miter') {
  ctx.save();
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineJoin = join; ctx.lineCap = 'round'; ctx.miterLimit = 3;
  ctx.lineWidth = width * 2;
  ctx.beginPath(); trace(ctx); ctx.stroke();
  if (heavy) {
    ctx.translate(width * 0.3 * heavy, width * 0.6 * heavy);
    ctx.beginPath(); trace(ctx); ctx.stroke(); ctx.fill();
  }
  ctx.restore();
}

/** Flat shapes with one contour around their union. shapes: [{ r: [x,y,w,h] | p: points | trace, fill }]. */
export function inkGroup(ctx, P, shapes, width = LINE.silhouette, heavy = 1, join = 'miter') {
  const one = (g, s) => { if (s.r) g.rect(s.r[0], s.r[1], s.r[2], s.r[3]); else if (s.p) tracePolygon(g, s.p); else s.trace(g); };
  contour(ctx, (g) => { for (const s of shapes) one(g, s); }, P.ink, width, heavy, join);
  for (const s of shapes) { if (!s.fill) continue; ctx.beginPath(); one(ctx, s); ctx.fillStyle = s.fill; ctx.fill(); }
}

function tracePaths(ctx, paths) {
  for (const p of paths) {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  }
}

/**
 * Inked tube work (posts, rails, lattice members, cables). Every group of polylines is stroked in
 * ink first, then in its own colour, so the contour follows the union of all the members.
 * groups: [{ paths: [[[x,y],...],...], width, fill, light, shade }] drawn back to front.
 */
export function inkTubes(ctx, P, groups, line = LINE.detail, cap = 'round') {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = cap; ctx.strokeStyle = P.ink;
  for (let pass = 0; pass < 2; pass++) {
    ctx.save();
    if (pass) ctx.translate(line * 0.3, line * 0.55);
    for (const g of groups) { ctx.lineWidth = g.width + line * 2; ctx.beginPath(); tracePaths(ctx, g.paths); ctx.stroke(); }
    ctx.restore();
  }
  for (const g of groups) {
    ctx.strokeStyle = g.fill; ctx.lineWidth = g.width; ctx.lineCap = cap;
    ctx.beginPath(); tracePaths(ctx, g.paths); ctx.stroke();
    if (g.width < 3.2 || !(g.light || g.shade)) continue;
    // light on the side turned toward the upper left, shade on the other one
    ctx.lineCap = 'butt';
    for (const [tone, side] of [[g.light, 1], [g.shade, -1]]) {
      if (!tone) continue;
      ctx.strokeStyle = tone; ctx.lineWidth = Math.max(1, g.width * 0.28);
      ctx.beginPath();
      for (const p of g.paths) {
        for (let i = 0; i + 1 < p.length; i++) {
          let nx = -(p[i + 1][1] - p[i][1]), ny = p[i + 1][0] - p[i][0];
          const l = Math.hypot(nx, ny) || 1;
          const flip = (nx * -0.55 + ny * -0.83 < 0 ? -1 : 1) * side * g.width * 0.27 / l;
          nx *= flip; ny *= flip;
          ctx.moveTo(p[i][0] + nx, p[i][1] + ny); ctx.lineTo(p[i + 1][0] + nx, p[i + 1][1] + ny);
        }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

/**
 * Members of a lattice panel between chord a (a0 -> a1) and chord b (b0 -> b1), as polylines:
 * { chords, struts, braces }. mode 'x' crosses every bay, 'zig' alternates the diagonals.
 */
export function latticeMembers(a0, a1, b0, b1, bays, mode = 'x') {
  const chords = [[a0, a1], [b0, b1]], struts = [], braces = [];
  for (let i = 0; i <= bays; i++) struts.push([lerp2(a0, a1, i / bays), lerp2(b0, b1, i / bays)]);
  for (let i = 0; i < bays; i++) {
    const [p, q] = struts[i], [r, s] = struts[i + 1];
    if (mode === 'x' || i % 2 === 0) braces.push([p, s]);
    if (mode === 'x' || i % 2 === 1) braces.push([q, r]);
  }
  return { chords, struts, braces };
}

/** Draw lattice panels (from latticeMembers) as inked tube work in three metal values. */
export function drawLattice(ctx, P, panels, chordW, braceW, tones, line = LINE.detail) {
  const t = tones || { light: P.metalLight, base: P.metal, shade: P.metalShade };
  const all = (key) => panels.reduce((list, m) => list.concat(m[key]), []);
  inkTubes(ctx, P, [
    { paths: all('braces'), width: braceW, fill: t.shade },
    { paths: all('struts'), width: braceW * 1.15, fill: t.base, light: t.light },
    { paths: all('chords'), width: chordW, fill: t.base, light: t.light, shade: t.shade },
  ], line, 'butt');
}

/** One line of sign lettering centred on (cx, cy), shrunk to fit maxWidth. Returns the cap height used. */
export function label(ctx, text, cx, cy, maxWidth, size, options) {
  const o = { style: 'bold', align: 'center', slant: 0, jitter: 0.6, ...(options || {}) };
  const width = measureText(text, size, o);
  const s = width > maxWidth ? (size * maxWidth) / width : size;
  drawText(ctx, text, cx, cy + s * 0.5, s, o);
  return s;
}

/** Chequered block. */
export function checker(ctx, x, y, w, h, cols, rows, dark, light) {
  fillRect(ctx, x, y, w, h, light);
  ctx.fillStyle = dark;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if ((i + j) % 2 === 0) ctx.fillRect(x + (i * w) / cols, y + (j * h) / rows, w / cols + 0.3, h / rows + 0.3);
}

/**
 * Open diamond mesh (fence netting) over a rectangle: thin lines only, no fill. Nodes sit on the
 * bottom edge every `px`; choose the height as a multiple of `py` to have nodes on the top edge too.
 */
export function diamondMesh(ctx, x0, y0, x1, y1, px, py, color, width) {
  const run = ((y1 - y0) * px) / py;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  ctx.beginPath();
  for (let x = x0 - run - px; x < x1 + run + px; x += px) { ctx.moveTo(x, y1); ctx.lineTo(x + run, y0); ctx.moveTo(x, y1); ctx.lineTo(x - run, y0); }
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.stroke();
  ctx.restore();
}

/** Clip a strip painter to its tile. */
export function clipTile(ctx, w, h) { ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); }

/**
 * Seamless strips: run `draw(r)` for the tile and its two neighbours, with the same seeded
 * generator each time, so anything crossing an edge comes back on the other side.
 */
export function wrapped(ctx, w, rnd, draw) {
  const seed = Math.floor(rnd() * 4294967295);
  for (const dx of [0, -w, w]) { ctx.save(); ctx.translate(dx, 0); draw(seeded(seed)); ctx.restore(); }
}

/** Rounded-box outline (superellipse), used for tyres, lamps, soft panels. */
export function superEllipse(cx, cy, a, b, n = 3, steps = 28) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TAU, c = Math.cos(t), s = Math.sin(t);
    pts.push([cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]);
  }
  return pts;
}

// ---- people -------------------------------------------------------------------------------------

const HAIR_TONES = ['trunkShade', 'ink', 'wood', 'dryLight', 'concreteShade', 'roofShade'];
const LEGWEAR = ['inkSoft', 'uiBlue', 'tyreLight', 'wallShade', 'uiDark', 'glassShade'];

/** Random spectator look: { shirt, trousers, skin, hair, hat, hatColor, sleeves, build }. */
export function randomLook(P, rnd) {
  const hat = rnd();
  return {
    shirt: P.crowd[Math.floor(rnd() * P.crowd.length)], trousers: P[LEGWEAR[Math.floor(rnd() * LEGWEAR.length)]],
    skin: P.skin[Math.floor(rnd() * rnd() * P.skin.length * 1.3) % P.skin.length], hair: P[HAIR_TONES[Math.floor(rnd() * HAIR_TONES.length)]],
    hat: hat < 0.24 ? 'cap' : hat < 0.3 ? 'sunhat' : rnd() < 0.3 ? 'long' : 'none', hatColor: P.crowd[Math.floor(rnd() * P.crowd.length)],
    sleeves: rnd() < 0.6 ? 'short' : 'long', build: 0.92 + rnd() * 0.2,
  };
}

/**
 * Standing figure seen from the front, feet at (x, y), total height H (pixels). Realistic
 * proportions (head = 1/7.4 of the height). o: { shirt, trousers, skin, hair, hat: 'none' | 'cap' |
 * 'sunhat' | 'long' | 'headset', hatColor, sleeves: 'short' | 'long', arms: { l: [a, b], r: [a, b] }
 * (angles of the upper arm and forearm from straight down, positive away from the body; 'l' is the
 * arm on the left of the picture), lean, stance, build, line, overalls }.
 * Returns { l, r } hand positions and `head` [cx, cy, rx, ry].
 */
export function drawFigure(ctx, P, x, y, H, o = {}) {
  const u = H, lw = o.line ?? Math.max(1, H * 0.016);
  const shirt = o.shirt || P.crowd[0], trousers = o.overalls ? shirt : o.trousers || P.inkSoft, skin = o.skin || P.skin[0];
  const hairTone = o.hair || P.trunkShade, hat = o.hat || 'none', hatColor = o.hatColor || P.paint;
  const cx = x + (o.lean || 0) * u, build = o.build || 1, spread = (o.stance ?? 0.03) * u;
  const hipY = y - 0.5 * u, kneeY = y - 0.27 * u, ankleY = y - 0.04 * u, waistY = y - 0.61 * u, shY = y - 0.815 * u;
  const sw = 0.12 * u * build, ww = 0.088 * u * build, hw = 0.1 * u * build, xm = (cx + x) / 2;
  const hx = cx + (o.tilt || 0) * u, hy = y - 0.928 * u, rx = 0.053 * u, ry = 0.068 * u;
  const leg = (s) => [[x + s * hw, hipY], [x + s * (0.078 * u + spread * 0.5), kneeY], [x + s * (0.062 * u + spread), ankleY],
    [x + s * (0.012 * u + spread), ankleY], [x + s * (0.008 * u + spread * 0.5), kneeY], [x, hipY + 0.07 * u]];
  const shoe = (s) => [[x + s * (0.068 * u + spread), ankleY - 0.004 * u], [x + s * (0.092 * u + spread), y], [x + s * (0.002 * u + spread), y], [x + s * (0.01 * u + spread), ankleY - 0.004 * u]];
  const torso = [[cx - 0.034 * u, shY - 0.022 * u], [cx + 0.034 * u, shY - 0.022 * u], [cx + sw, shY + 0.014 * u], [cx + sw * 0.94, shY + 0.11 * u], [xm + ww, waistY],
    [x + hw, hipY + 0.035 * u], [x - hw, hipY + 0.035 * u], [xm - ww, waistY], [cx - sw * 0.94, shY + 0.11 * u], [cx - sw, shY + 0.014 * u]];
  const hairPath = (g) => {
    if (hat === 'long') { traceEllipse(g, hx, hy + ry * 0.3, rx * 1.32, ry * 1.4); return; }
    if (hat === 'sunhat') { traceEllipse(g, hx, hy - ry * 0.34, rx * 2.1, ry * 0.3); }
    const lift = hat === 'cap' || hat === 'sunhat' ? 0.16 : 0.02, grow = hat === 'none' || hat === 'headset' ? 1.07 : 1.13;
    g.moveTo(hx - rx * grow, hy - ry * lift);
    g.ellipse(hx, hy - ry * lift, rx * grow, ry * (1 + lift) * 1.04, 0, Math.PI, TAU);
    g.quadraticCurveTo(hx, hy - ry * (lift + (hat === 'none' || hat === 'headset' ? 0.5 : 0.1)), hx - rx * grow, hy - ry * lift);
    g.closePath();
  };
  const body = (g) => {
    for (const s of [-1, 1]) { tracePolygon(g, leg(s)); tracePolygon(g, shoe(s)); }
    tracePolygon(g, torso);
    g.rect(cx - 0.026 * u, y - 0.878 * u, 0.052 * u, 0.05 * u);
    traceEllipse(g, hx, hy, rx, ry);
    if (hat !== 'bald') hairPath(g);
  };
  contour(ctx, body, P.ink, lw, 1, 'round');
  const trouserShade = shadeHex(trousers, 0.3), shirtShade = shadeHex(shirt, 0.3), skinShade = shadeHex(skin, 0.26);
  if (hat === 'long') fillTrace(ctx, hairPath, hairTone);
  fillPoly(ctx, leg(-1), trousers); fillPoly(ctx, leg(1), trouserShade);
  fillPoly(ctx, shoe(-1), P.ink); fillPoly(ctx, shoe(1), P.ink);
  fillPoly(ctx, torso, shirt);
  clipped(ctx, (g) => tracePolygon(g, torso), () => {
    fillPoly(ctx, [[cx + sw * 0.38, shY - 0.03 * u], [cx + sw * 1.2, shY - 0.03 * u], [x + hw * 1.2, hipY + 0.05 * u], [x + hw * 0.5, hipY + 0.05 * u]], shirtShade);
    if (o.overalls) fillRect(ctx, x - hw * 1.2, waistY - 0.012 * u, hw * 2.4, 0.026 * u, P.ink);
    else fillRect(ctx, x - hw * 1.2, hipY - 0.012 * u, hw * 2.4, 0.06 * u, trousers);
  });
  brushStroke(ctx, [[x, hipY + 0.06 * u], [x + spread * 0.2, kneeY], [x + spread * 0.3, ankleY]], lw, { color: P.ink, taperStart: 0, taperEnd: 0.4 });
  fillRect(ctx, cx - 0.026 * u, y - 0.878 * u, 0.052 * u, 0.05 * u, skinShade);
  fillEllipse(ctx, hx, hy, rx, ry, skin);
  clipped(ctx, (g) => traceEllipse(g, hx, hy, rx, ry), () => {
    fillEllipse(ctx, hx + rx * 0.95, hy + ry * 0.15, rx * 0.62, ry * 1.2, skinShade);
    if (hat === 'cap' || hat === 'sunhat') fillRect(ctx, hx - rx, hy - ry * 0.4, rx * 2, ry * 0.42, skinShade);
  });
  if (hat === 'long') {
    fillTrace(ctx, (g) => { g.moveTo(hx - rx * 1.1, hy + ry * 0.1); g.ellipse(hx, hy, rx * 1.1, ry * 1.08, 0, Math.PI, TAU); g.quadraticCurveTo(hx + rx * 0.2, hy - ry * 0.75, hx - rx * 1.1, hy + ry * 0.1); }, hairTone);
  } else if (hat !== 'bald') {
    fillTrace(ctx, hairPath, hat === 'cap' || hat === 'sunhat' ? hatColor : hairTone);
    if (hat === 'cap') fillEllipse(ctx, hx + rx * 0.2, hy - ry * 0.2, rx * 1.02, ry * 0.17, shadeHex(hatColor, 0.3));
    if (hat === 'sunhat') { fillEllipse(ctx, hx, hy - ry * 0.34, rx * 2.1, ry * 0.3, hatColor); fillEllipse(ctx, hx + rx * 0.3, hy - ry * 0.28, rx * 1.5, ry * 0.16, shadeHex(hatColor, 0.3)); }
  }
  if (hat === 'headset') {
    ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1.5, rx * 0.34); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(hx, hy - ry * 0.05, rx * 1.12, ry * 1.1, 0, Math.PI * 1.05, TAU * 0.975); ctx.stroke();
    fillRect(ctx, hx - rx * 1.38, hy - ry * 0.28, rx * 0.5, ry * 0.7, P.ink); fillRect(ctx, hx + rx * 0.88, hy - ry * 0.28, rx * 0.5, ry * 0.7, P.ink);
  }
  // arms, each with its own contour so that they read over the body
  const hands = { head: [hx, hy, rx, ry], shoulderY: shY };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [s, key] of [[1, 'r'], [-1, 'l']]) {
    const a = (o.arms && o.arms[key]) || [0.1, 0.03];
    const j = [cx + s * (sw - 0.016 * u), shY + 0.042 * u];
    const e = [j[0] + s * Math.sin(a[0]) * 0.165 * u, j[1] + Math.cos(a[0]) * 0.165 * u];
    const wr = [e[0] + s * Math.sin(a[1]) * 0.15 * u, e[1] + Math.cos(a[1]) * 0.15 * u];
    const hd = [wr[0] + s * Math.sin(a[1]) * 0.028 * u, wr[1] + Math.cos(a[1]) * 0.028 * u];
    hands[key] = hd;
    const sleeve = s > 0 ? shirtShade : shirt, long = o.sleeves === 'long' || o.overalls;
    const mid = long ? wr : lerp2(j, e, 0.72);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 0.056 * u + lw * 2;
    ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(wr[0], wr[1]); ctx.stroke();
    fillEllipse(ctx, hd[0], hd[1], 0.03 * u + lw, 0.03 * u + lw, P.ink);
    if (!long) { ctx.strokeStyle = s > 0 ? skinShade : skin; ctx.lineWidth = 0.044 * u; ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(wr[0], wr[1]); ctx.stroke(); }
    ctx.strokeStyle = sleeve; ctx.lineWidth = 0.056 * u;
    ctx.beginPath(); ctx.moveTo(j[0], j[1]);
    if (long) { ctx.lineTo(e[0], e[1]); ctx.lineTo(wr[0], wr[1]); } else ctx.lineTo(mid[0], mid[1]);
    ctx.stroke();
    fillEllipse(ctx, hd[0], hd[1], 0.03 * u, 0.03 * u, o.gloves || (s > 0 ? skinShade : skin));
  }
  return hands;
}

const ARM_POSES = { down: [0.1, 0.03], rail: [0.5, -1.3], up: [2.62, 3.0], wave: [2.2, 3.35], hip: [0.75, -0.7], point: [1.5, 1.7] };

/** Named arm pose -> [upper arm angle, forearm angle]. */
export function armPose(name) { return ARM_POSES[name] || ARM_POSES.down; }

/**
 * A row of spectators shown as busts (shoulders and head, a few raised arms), inked as a group.
 * `u` is the head height in pixels, `yBase` the line where the busts are cut by whatever stands
 * in front. o: { density, stagger, arms (chance of a raised arm), tint (colour -> colour),
 * wrap (tile width: figures crossing an edge are repeated), line, skip (x -> true where nobody sits) }.
 */
export function crowdRow(ctx, P, rnd, x0, x1, yBase, u, o = {}) {
  const lw = o.line ?? Math.max(0.9, u * 0.1), tint = o.tint || ((c) => c);
  const count = Math.max(1, Math.round((x1 - x0) / (u * 2.12))), step = (x1 - x0) / count;
  const people = [];
  for (let i = 0; i < count; i++) {
    const look = randomLook(P, rnd), keep = rnd() < (o.density ?? 0.94), arm = rnd(), side = rnd() < 0.5 ? -1 : 1;
    const person = { x: x0 + (i + 0.5 + (o.stagger || 0)) * step + (rnd() - 0.5) * u * 0.3, y: yBase, s: u * (0.93 + rnd() * 0.14), look, arms: arm < (o.arms ?? 0.1) ? (arm < (o.arms ?? 0.1) * 0.4 ? 2 : 1) : 0, side, lift: rnd() < 0.12 ? u * 0.35 : 0 };
    if (!keep || (o.skip && o.skip(person.x))) continue;
    people.push(person);
    if (o.wrap) for (const dx of [-o.wrap, o.wrap]) if (person.x + dx > x0 - u * 2 && person.x + dx < x1 + u * 2) people.push({ ...person, x: person.x + dx });
  }
  const shoulders = (g, p) => {
    const s = p.s, b = p.look.build, top = p.y - p.lift - s * 0.86;
    g.moveTo(p.x - s * b, p.y + 1); g.lineTo(p.x - s * b, top + s * 0.42);
    g.quadraticCurveTo(p.x - s * b * 0.97, top + s * 0.06, p.x - s * 0.36, top); g.lineTo(p.x + s * 0.36, top);
    g.quadraticCurveTo(p.x + s * b * 0.97, top + s * 0.06, p.x + s * b, top + s * 0.42); g.lineTo(p.x + s * b, p.y + 1); g.closePath();
  };
  const headY = (p) => p.y - p.lift - p.s * 1.3;
  const hair = (g, p) => {
    const s = p.s, hy = headY(p), cap = p.look.hat === 'cap' || p.look.hat === 'sunhat';
    if (p.look.hat === 'sunhat') traceEllipse(g, p.x, hy - s * 0.16, s * 0.82, s * 0.14);
    g.moveTo(p.x - s * 0.44, hy); g.ellipse(p.x, hy, s * 0.44, s * 0.55, 0, Math.PI, TAU);
    g.quadraticCurveTo(p.x, hy - s * (cap ? 0.12 : 0.34), p.x - s * 0.44, hy); g.closePath();
  };
  const byColor = (list, keyOf, trace) => {
    const groups = new Map();
    for (const p of list) { const key = keyOf(p); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(p); }
    for (const [color, members] of groups) { ctx.beginPath(); for (const p of members) trace(ctx, p); ctx.fillStyle = color; ctx.fill(); }
  };
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // raised arms first: they sit behind the neighbours' heads
  for (const p of people) {
    if (!p.arms) continue;
    const s = p.s, sleeve = tint(p.look.shirt), skin = tint(p.look.skin);
    for (const side of p.arms === 2 ? [-1, 1] : [p.side]) {
      const j = [p.x + side * s * 0.8, p.y - p.lift - s * 0.62], e = [p.x + side * s * 1.12, p.y - p.lift - s * 1.3], hd = [p.x + side * s * (0.95 + rnd() * 0.3), p.y - p.lift - s * 2.05];
      ctx.strokeStyle = P.ink; ctx.lineWidth = s * 0.36 + lw * 2;
      ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
      ctx.strokeStyle = p.look.sleeves === 'long' ? sleeve : skin; ctx.lineWidth = s * 0.36;
      ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
      ctx.strokeStyle = sleeve; ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
      fillEllipse(ctx, hd[0], hd[1], s * 0.24 + lw, s * 0.24 + lw, P.ink); fillEllipse(ctx, hd[0], hd[1], s * 0.24, s * 0.24, skin);
    }
  }
  ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 2;
  ctx.beginPath(); for (const p of people) shoulders(ctx, p); ctx.stroke();
  byColor(people, (p) => tint(p.look.shirt), shoulders);
  ctx.fillStyle = inkAlpha(P, 0.26);
  ctx.beginPath();
  for (const p of people) { const s = p.s, b = p.look.build, top = p.y - p.lift - s * 0.86; ctx.moveTo(p.x + s * 0.42, p.y + 1); ctx.lineTo(p.x + s * 0.5, top + s * 0.05); ctx.quadraticCurveTo(p.x + s * b * 0.95, top + s * 0.1, p.x + s * b, top + s * 0.44); ctx.lineTo(p.x + s * b, p.y + 1); ctx.closePath(); }
  ctx.fill();
  // heads
  ctx.beginPath();
  for (const p of people) { traceEllipse(ctx, p.x, headY(p), p.s * 0.4, p.s * 0.5); if (p.look.hat !== 'long') hair(ctx, p); else traceEllipse(ctx, p.x, headY(p) + p.s * 0.12, p.s * 0.52, p.s * 0.66); }
  ctx.stroke();
  byColor(people.filter((p) => p.look.hat === 'long'), (p) => tint(p.look.hair), (g, p) => traceEllipse(g, p.x, headY(p) + p.s * 0.12, p.s * 0.52, p.s * 0.66));
  byColor(people, (p) => tint(p.look.skin), (g, p) => traceEllipse(g, p.x, headY(p), p.s * 0.4, p.s * 0.5));
  ctx.fillStyle = inkAlpha(P, 0.2);
  ctx.beginPath(); for (const p of people) { const hy = headY(p); ctx.moveTo(p.x + p.s * 0.12, hy + p.s * 0.5); ctx.quadraticCurveTo(p.x + p.s * 0.2, hy, p.x + p.s * 0.3, hy - p.s * 0.3); ctx.quadraticCurveTo(p.x + p.s * 0.5, hy, p.x + p.s * 0.12, hy + p.s * 0.5); } ctx.fill();
  byColor(people, (p) => tint(p.look.hat === 'cap' || p.look.hat === 'sunhat' ? p.look.hatColor : p.look.hair), hair);
  ctx.restore();
  return people;
}

// ---- strips -------------------------------------------------------------------------------------

function hline(ctx, y, w, width, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, y - width / 2, w, width);
}

function armco(ctx, w, h, P) {
  const k = h / 104;
  const top = 10 * k, railH = 38 * k, gap = 4 * k;
  // posts (two per tile, placed so the tile wraps)
  for (const px of [0.25, 0.75]) {
    const x = w * px;
    ctx.fillStyle = P.metalShade; ctx.fillRect(x - 7 * k, top + 6 * k, 14 * k, h - top - 6 * k);
    ctx.fillStyle = P.ink; ctx.fillRect(x - 8 * k, top + 6 * k, 2 * k, h - top - 6 * k); ctx.fillRect(x + 6 * k, top + 6 * k, 2 * k, h - top - 6 * k);
  }
  for (let r = 0; r < 2; r++) {
    const y = top + r * (railH + gap);
    ctx.fillStyle = P.metal; ctx.fillRect(0, y, w, railH);
    ctx.fillStyle = P.metalLight; ctx.fillRect(0, y + 2 * k, w, railH * 0.3);
    ctx.fillStyle = P.metalShade; ctx.fillRect(0, y + railH * 0.48, w, railH * 0.14);
    ctx.fillStyle = P.metalShade; ctx.fillRect(0, y + railH * 0.82, w, railH * 0.18);
    hline(ctx, y, w, LINE.form * k, P.ink);
    hline(ctx, y + railH, w, LINE.silhouette * k, P.ink);
    hline(ctx, y + railH * 0.55, w, LINE.hair * k, P.inkSoft);
    for (const px of [0.25, 0.75]) {
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(w * px, y + railH * 0.28, 2.6 * k, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * px, y + railH * 0.72, 2.6 * k, 0, Math.PI * 2); ctx.fill();
    }
    // overlap joint of two rail lengths
    brushStroke(ctx, [[w * 0.5, y + 3 * k], [w * 0.5 + 2 * k, y + railH - 3 * k]], LINE.detail * k, { color: P.ink, taper: 0.2 });
  }
  ctx.fillStyle = 'rgba(22,22,36,0.35)';
  ctx.fillRect(0, h - 9 * k, w, 9 * k);
}

/** Precast concrete barrier: two 2.5 m blocks per tile (one of them spans the tile edge). */
function concrete(ctx, w, h, P, rnd) {
  const k = h / 104;
  ctx.save(); clipTile(ctx, w, h);
  const top = 5 * k, capH = 9 * k, bandY = top + capH, bandH = 26 * k, footY = 72 * k, toeY = 88 * k;
  const joints = [w * 0.25, w * 0.75], blockW = w * 0.5;
  const bands = [P.kerbA, P.kerbB];
  fillRect(ctx, 0, top, w, h - top, P.concrete);
  fillRect(ctx, 0, top, w, capH, P.concreteLight);
  // painted band: one colour per block, lower third of the band in its shade
  for (let b = 0; b < 3; b++) {
    const x = joints[0] + (b - 1) * blockW, color = bands[(b + 1) % 2];
    fillRect(ctx, x, bandY, blockW, bandH, color);
    fillRect(ctx, x, bandY + bandH * 0.64, blockW, bandH * 0.36, shadeHex(color, 0.2));
  }
  // flared foot: the slope catches the light, the toe turns under
  fillRect(ctx, 0, footY - 7 * k, w, 7 * k, P.concreteShade);
  fillRect(ctx, 0, footY, w, toeY - footY, P.concreteLight);
  fillRect(ctx, 0, toeY, w, h - toeY, P.concreteShade);
  hline(ctx, bandY, w, LINE.detail * k, P.ink);
  hline(ctx, bandY + bandH, w, LINE.detail * k, P.ink);
  hline(ctx, footY, w, LINE.form * k, P.ink);
  hline(ctx, toeY, w, LINE.hair * k, P.inkSoft);
  // wear: rubber streaks, scraped paint, chips and drips (wrapped around the tile edges)
  wrapped(ctx, w, rnd, (r) => {
    const rubber = mixHex(P.concrete, P.tyre, 0.62);
    for (let i = 0; i < 7; i++) {
      const x = r() * w, y = (40 + r() * 28) * k, len = (40 + r() * 110) * k, rise = (r() - 0.5) * 7 * k;
      brushStroke(ctx, [[x, y], [x + len * 0.5, y + rise * 0.7], [x + len, y + rise]], (2 + r() * 4.5) * k, { color: rubber, taper: 0.45, swell: 0.4, seed: i });
    }
    for (let i = 0; i < 5; i++) {
      const x = r() * w, y = bandY + (5 + r() * 16) * k, len = (18 + r() * 50) * k;
      brushStroke(ctx, [[x, y], [x + len * 0.5, y + k], [x + len, y + (r() - 0.5) * 3 * k]], (1.5 + r() * 2.5) * k, { color: i % 2 ? P.concrete : P.concreteShade, taper: 0.4, seed: i });
    }
    for (let i = 0; i < 2; i++) {
      const x = r() * w, y = (46 + r() * 20) * k, len = (30 + r() * 40) * k;
      brushStroke(ctx, [[x, y], [x + len, y + (r() - 0.5) * 2 * k]], 1.8 * k, { color: P.banners[i ? 2 : 1], taper: 0.45 });
    }
    for (let i = 0; i < 6; i++) {
      const x = r() * w, y0 = bandY + bandH + k, len = (5 + r() * 16) * k;
      brushStroke(ctx, [[x, y0], [x + 0.6 * k, y0 + len]], (1.2 + r() * 1.2) * k, { color: P.concreteShade, taperStart: 0, taperEnd: 0.7 });
    }
    for (let i = 0; i < 9; i++) {
      const x = r() * w, y = (r() < 0.5 ? 42 + r() * 26 : 76 + r() * 9) * k, len = (6 + r() * 16) * k;
      brushStroke(ctx, [[x, y], [x + len, y + (r() - 0.5) * k]], LINE.hair * k, { color: P.inkSoft, taper: 0.4 });
    }
  });
  for (const jx of joints) {
    // block ends: rounded arris in shade on the left of the gap, lit arris on its right
    fillRect(ctx, jx - 6 * k, top, 4.5 * k, h - top, P.concreteShade);
    fillRect(ctx, jx + 2 * k, top + capH, 3 * k, h - top - capH, P.concreteLight);
    fillRect(ctx, jx - 2 * k, top, 4 * k, h - top, P.ink);
    // chipped corners
    fillPoly(ctx, [[jx + 2 * k, top], [jx + 12 * k, top], [jx + 5 * k, top + 6 * k], [jx + 2 * k, top + 9 * k]], P.concreteShade);
    fillPoly(ctx, [[jx - 6 * k, toeY - 5 * k], [jx - 2 * k, toeY - 9 * k], [jx - 2 * k, toeY + 2 * k]], P.ink);
    // steel coupling plates across the joint
    for (const y of [46 * k, 80 * k]) {
      inkGroup(ctx, P, [{ r: [jx - 11 * k, y - 4 * k, 22 * k, 8 * k], fill: P.metalShade }], LINE.detail * k);
      fillRect(ctx, jx - 11 * k, y - 4 * k, 22 * k, 2.4 * k, P.metal);
      fillEllipse(ctx, jx - 7 * k, y, 1.5 * k, 1.5 * k, P.ink); fillEllipse(ctx, jx + 7 * k, y, 1.5 * k, 1.5 * k, P.ink);
    }
    // fork-lift slots of the block that starts here
    for (const f of [0.2, 0.8]) {
      for (const dx of [0, -w]) {
        const sx = jx + blockW * f + dx, sw = 38 * k, sh = 11 * k;
        fillRect(ctx, sx - sw / 2 - 2 * k, h - sh - 2.5 * k, sw + 4 * k, sh + 2.5 * k, P.concreteLight);
        fillTrace(ctx, (g) => { g.moveTo(sx - sw / 2, h); g.lineTo(sx - sw / 2, h - sh + 3 * k); g.quadraticCurveTo(sx - sw / 2, h - sh, sx - sw / 2 + 3 * k, h - sh); g.lineTo(sx + sw / 2 - 3 * k, h - sh); g.quadraticCurveTo(sx + sw / 2, h - sh, sx + sw / 2, h - sh + 3 * k); g.lineTo(sx + sw / 2, h); }, P.ink);
      }
    }
  }
  hline(ctx, top, w, LINE.form * k, P.ink);
  hline(ctx, top + capH, w, LINE.hair * k, P.inkSoft);
  fillRect(ctx, 0, h - 6 * k, w, 6 * k, inkAlpha(P, 0.4));
  hline(ctx, h - LINE.silhouette * k * 0.5, w, LINE.silhouette * k, P.ink);
  ctx.restore();
}

/** Tyre wall: eight columns of three wide tyres per tile, top rows painted, steel strap. */
function tyres(ctx, w, h, P, rnd) {
  const k = h / 120;
  ctx.save(); clipTile(ctx, w, h);
  const cols = 8, pitch = w / cols, rowH = 34.6 * k, top = 11 * k, a = pitch * 0.5 - 2.1 * k, b = rowH * 0.5 - 1.2 * k;
  const black = { light: lightHex(P.tyreLight, 0.22), base: P.tyreLight, shade: P.tyre };
  const white = { light: P.paint, base: mixHex(P.paint, P.concrete, 0.34), shade: shadeHex(P.paint, 0.45) };
  const red = { light: lightHex(P.kerbA, 0.3), base: P.kerbA, shade: shadeHex(P.kerbA, 0.42) };
  // dark backing between the tyres
  fillRect(ctx, 0, top + b, w, h - top - b, P.ink);
  const list = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      list.push({ row: r, cx: (c + 0.5) * pitch + (rnd() - 0.5) * 2.6 * k, cy: top + (r + 0.5) * rowH + (rnd() - 0.5) * 1.2 * k, a: a * (0.98 + rnd() * 0.035), b, tone: r === 2 ? black : (r + c) % 2 ? red : white, painted: r < 2, seed: r * 8 + c });
    }
  }
  const outline = (t) => superEllipse(t.cx, t.cy, t.a, t.b, 4.6, 36);
  const topFace = (g, t) => traceEllipse(g, t.cx, t.cy - t.b + 1.5 * k, t.a * 0.93, 6.5 * k);
  contour(ctx, (g) => { for (const t of list) { tracePolygon(g, outline(t)); if (!t.row) topFace(g, t); } }, P.ink, LINE.form * k, 0, 'round');
  for (const t of list) {
    const shape = outline(t), yTop = t.cy - t.b * 0.56, yLow = t.cy + t.b * 0.5;
    fillPoly(ctx, shape, t.tone.shade);
    clipped(ctx, (g) => tracePolygon(g, shape), () => {
      // tread face in the base value, upper shoulder in the light, lower shoulder left in shade
      fillRect(ctx, t.cx - t.a, t.cy - t.b, t.a * 2, yLow - t.cy + t.b, t.tone.base);
      fillRect(ctx, t.cx - t.a, t.cy - t.b, t.a * 2, yTop - t.cy + t.b, t.tone.light);
      // the cylinder turns away on the right
      fillPoly(ctx, superEllipse(t.cx + t.a * 1.04, t.cy, t.a * 0.24, t.b * 1.2, 2, 12), t.tone.shade);
      if (t.painted) {
        // worn paint: rubber showing through
        const n = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const x = t.cx + (rnd() - 0.6) * t.a * 1.3, y = t.cy + (rnd() - 0.45) * t.b * 0.8, len = (6 + rnd() * 16) * k;
          brushStroke(ctx, [[x, y], [x + len, y + (rnd() - 0.5) * 2 * k]], (1.2 + rnd() * 2.2) * k, { color: mixHex(t.tone.shade, P.tyre, 0.55), taper: 0.4 });
        }
      } else {
        brushStroke(ctx, [[t.cx - t.a * 0.7, t.cy - t.b * 0.2], [t.cx - t.a * 0.1, t.cy - t.b * 0.24], [t.cx + t.a * 0.3, t.cy - t.b * 0.2]], 2.2 * k, { color: t.tone.light, taper: 0.45 });
      }
      // tread sipes on both shoulders, closer together where the tread turns away
      ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.25; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = -5; i <= 5; i++) {
        const x = t.cx + Math.sin(i * 0.27) * t.a * 0.97, tilt = Math.sin(i * 0.27) * 1.6 * k;
        ctx.moveTo(x + tilt, t.cy - t.b * 0.98); ctx.lineTo(x, yTop + 2 * k);
        ctx.moveTo(x, yLow - 1.5 * k); ctx.lineTo(x + tilt, t.cy + t.b * 0.98);
      }
      ctx.stroke();
    });
    brushCurve(ctx, [[t.cx - t.a * 0.96, yTop - 1.2 * k], [t.cx, yTop + 0.8 * k], [t.cx + t.a * 0.96, yTop - 1.2 * k]], LINE.hair * k * 1.2, { color: P.ink, taper: 0.12 });
    brushCurve(ctx, [[t.cx - t.a * 0.96, yLow - 1.2 * k], [t.cx, yLow + 0.8 * k], [t.cx + t.a * 0.96, yLow - 1.2 * k]], LINE.detail * k, { color: P.ink, taper: 0.12 });
    if (!t.row) {
      // top row: upper sidewall and the dark well of the rim
      fillTrace(ctx, (g) => topFace(g, t), t.tone.light);
      fillEllipse(ctx, t.cx + 0.6 * k, t.cy - t.b + 2 * k, t.a * 0.6, 3.6 * k, P.ink);
      fillEllipse(ctx, t.cx + 2 * k, t.cy - t.b + 2.9 * k, t.a * 0.5, 2.2 * k, shadeHex(P.tyre, 0.2));
    }
  }
  // steel strap bolted through the middle row
  const sy = top + rowH * 1.5, sh = 6.5 * k;
  fillRect(ctx, 0, sy - sh / 2 - LINE.detail * k, w, sh + LINE.detail * k * 2.6, P.ink);
  fillRect(ctx, 0, sy - sh / 2, w, sh, P.metalShade);
  fillRect(ctx, 0, sy - sh / 2, w, sh * 0.38, P.metal);
  for (let c = 0; c <= cols; c++) {
    fillRect(ctx, c * pitch - 3.5 * k, sy - sh / 2, 7 * k, sh, shadeHex(P.metalShade, 0.45));
    if (c === cols) break;
    const x = (c + 0.5) * pitch;
    fillEllipse(ctx, x, sy, 3.9 * k, 3.9 * k, P.ink); fillEllipse(ctx, x - 0.3 * k, sy - 0.4 * k, 2.3 * k, 2.3 * k, P.metalLight);
  }
  fillRect(ctx, 0, h - 5 * k, w, 5 * k, inkAlpha(P, 0.45));
  ctx.restore();
}

/** Curved-top post of a catch fence as a polyline. */
function fencePost(x, yBase, yBend, yTop, lean) {
  const pts = [[x, yBase], [x, yBend]];
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, u = 1 - t;
    pts.push([u * u * x + 2 * u * t * x + t * t * (x + lean), u * u * yBend + 2 * u * t * (yTop + (yBend - yTop) * 0.25) + t * t * yTop]);
  }
  return pts;
}

/** Catch fence: curved-top posts every 2.5 m, three cables, open diamond netting (no fill). */
function fence(ctx, w, h, P) {
  const k = h / 264;
  ctx.save(); clipTile(ctx, w, h);
  const top = 10 * k, bend = 66 * k, foot = h - 8 * k, lean = 30 * k, px = w / 24;
  const mesh = P.inkSoft;
  ctx.globalAlpha = 0.85;
  diamondMesh(ctx, 0, top, w, bend, px, (bend - top) / 5, mesh, LINE.hair * k);
  diamondMesh(ctx, 0, bend, w, foot, px, (foot - bend) / 12, mesh, LINE.hair * k * 1.1);
  ctx.globalAlpha = 1;
  // cables: top selvedge wire, three tension cables, bottom wire
  inkTubes(ctx, P, [
    { paths: [[[-4, top], [w + 4, top]], [[-4, foot], [w + 4, foot]]], width: 1.2 * k, fill: P.metalShade },
    { paths: [bend, 128 * k, 192 * k].map((y) => [[-4, y], [w + 4, y]]), width: 1.8 * k, fill: P.metalLight },
  ], LINE.hair * k, 'butt');
  for (const x of [w * 0.25, w * 0.75]) {
    fillPoly(ctx, [[x + 4 * k, h], [x + 46 * k, h], [x + 40 * k, h - 4 * k], [x + 4 * k, h - 4 * k]], inkAlpha(P, 0.32));
    inkGroup(ctx, P, [{ r: [x - 13 * k, h - 8 * k, 26 * k, 8 * k], fill: P.metalShade }], LINE.detail * k);
    fillRect(ctx, x - 13 * k, h - 8 * k, 26 * k, 2.5 * k, P.metal);
    inkTubes(ctx, P, [{ paths: [fencePost(x, h - 7 * k, bend + 6 * k, top - 3 * k, lean)], width: 8.5 * k, fill: P.metal, light: P.metalLight, shade: P.metalShade }], LINE.form * k, 'butt');
    // cable clamps
    for (const y of [bend, 128 * k, 192 * k]) {
      inkGroup(ctx, P, [{ r: [x - 7.5 * k, y - 4 * k, 15 * k, 8 * k], fill: P.metalShade }], LINE.hair * k * 1.2);
      fillRect(ctx, x - 7.5 * k, y - 4 * k, 15 * k, 2.6 * k, P.metalLight);
    }
    fillEllipse(ctx, x - 8 * k, h - 4 * k, 1.6 * k, 1.6 * k, P.ink); fillEllipse(ctx, x + 8 * k, h - 4 * k, 1.6 * k, 1.6 * k, P.ink);
  }
  fillRect(ctx, 0, h - 2.5 * k, w, 2.5 * k, inkAlpha(P, 0.35));
  ctx.restore();
}

/** Pit wall: 1.1 m concrete wall, debris fence, one signalling opening per tile, number panels. */
function pitwall(ctx, w, h, P, rnd) {
  const k = h / 160;
  ctx.save(); clipTile(ctx, w, h);
  const wallTop = 90 * k, top = 12 * k, posts = [0.125, 0.375, 0.625, 0.875].map((f) => f * w), px = w / 40;
  const open0 = posts[1], open1 = posts[2];
  // netting on three bays (the fourth is the signalling opening)
  ctx.globalAlpha = 0.85;
  diamondMesh(ctx, open1, top, w, wallTop, px, (wallTop - top) / 6, P.inkSoft, LINE.hair * k);
  diamondMesh(ctx, 0, top, open0, wallTop, px, (wallTop - top) / 6, P.inkSoft, LINE.hair * k);
  ctx.globalAlpha = 1;
  const spans = [[[-4, 0], [open0, 0]], [[open1, 0], [w + 4, 0]]];
  inkTubes(ctx, P, [
    { paths: spans.map((s) => s.map((p) => [p[0], top])), width: 1.4 * k, fill: P.metalShade },
    { paths: spans.map((s) => s.map((p) => [p[0], 50 * k])), width: 1.8 * k, fill: P.metalLight },
  ], LINE.hair * k, 'butt');
  // pit perch seen through the opening: canopy, two crew members with headsets
  const mid = (open0 + open1) / 2;
  inkTubes(ctx, P, [{ paths: [[[open0 + 22 * k, wallTop], [open0 + 22 * k, 30 * k]], [[open1 - 22 * k, wallTop], [open1 - 22 * k, 30 * k]]], width: 3.4 * k, fill: P.metalShade }], LINE.detail * k, 'butt');
  const crewTint = (c) => mixHex(c, P.ink, 0.12);
  const crew = [{ x: mid - 30 * k, shirt: P.banners[2] }, { x: mid + 22 * k, shirt: P.banners[2] }];
  for (const c of crew) {
    const u = 15 * k, by = wallTop, hy = by - u * 1.72;
    inkGroup(ctx, P, [{ trace: (g) => { g.moveTo(c.x - u * 1.02, by); g.lineTo(c.x - u * 1.02, by - u * 0.5); g.quadraticCurveTo(c.x - u, by - u * 1.06, c.x - u * 0.36, by - u * 1.1); g.lineTo(c.x + u * 0.36, by - u * 1.1); g.quadraticCurveTo(c.x + u, by - u * 1.06, c.x + u * 1.02, by - u * 0.5); g.lineTo(c.x + u * 1.02, by); g.closePath(); }, fill: crewTint(c.shirt) },
      { trace: (g) => traceEllipse(g, c.x, hy, u * 0.4, u * 0.5), fill: crewTint(P.skin[c.x < mid ? 0 : 2]) }], LINE.detail * k, 1, 'round');
    fillPoly(ctx, [[c.x + u * 0.45, by], [c.x + u * 0.5, by - u * 1.04], [c.x + u * 0.98, by - u * 0.9], [c.x + u * 1.02, by]], inkAlpha(P, 0.28));
    fillTrace(ctx, (g) => { g.moveTo(c.x - u * 0.44, hy); g.ellipse(c.x, hy, u * 0.44, u * 0.55, 0, Math.PI, TAU); g.quadraticCurveTo(c.x, hy - u * 0.3, c.x - u * 0.44, hy); }, c.x < mid ? P.trunkShade : P.ink);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(c.x, hy - u * 0.04, u * 0.5, u * 0.58, 0, Math.PI, TAU); ctx.stroke();
    fillRect(ctx, c.x - u * 0.62, hy - u * 0.12, u * 0.26, u * 0.38, P.ink); fillRect(ctx, c.x + u * 0.36, hy - u * 0.12, u * 0.26, u * 0.38, P.ink);
  }
  const canopy = paintTones(P.banners[2]);
  inkGroup(ctx, P, [{ p: [[open0 + 8 * k, 20 * k], [open1 - 8 * k, 20 * k], [open1 - 14 * k, 33 * k], [open0 + 14 * k, 33 * k]], fill: canopy.shade }, { r: [open0 + 6 * k, 13 * k, open1 - open0 - 12 * k, 8 * k], fill: canopy.base }], LINE.form * k);
  fillRect(ctx, open0 + 6 * k, 13 * k, open1 - open0 - 12 * k, 2.6 * k, canopy.light);
  // wall
  fillRect(ctx, 0, wallTop, w, h - wallTop, P.concrete);
  fillRect(ctx, 0, wallTop, w, 9 * k, P.concreteLight);
  fillRect(ctx, 0, wallTop + 9 * k, w, 3.5 * k, P.concreteShade);
  for (let i = 0; i < 5; i++) {
    const x = posts[0] + (i - 1) * w * 0.25, color = i % 2 ? P.kerbA : P.kerbB;
    fillRect(ctx, x, wallTop + 12.5 * k, w * 0.25, 9 * k, color);
    fillRect(ctx, x, wallTop + 18.5 * k, w * 0.25, 3 * k, shadeHex(color, 0.22));
    inkLine(ctx, x, wallTop + 12.5 * k, x, wallTop + 21.5 * k, LINE.hair * k, P.ink);
  }
  fillRect(ctx, 0, h - 12 * k, w, 12 * k, P.concreteShade);
  hline(ctx, wallTop + 12.5 * k, w, LINE.detail * k, P.ink);
  hline(ctx, wallTop + 21.5 * k, w, LINE.detail * k, P.ink);
  hline(ctx, h - 12 * k, w, LINE.hair * k, P.inkSoft);
  for (const x of posts) inkLine(ctx, x, wallTop + 22 * k, x, h, LINE.detail * k, P.ink);
  wrapped(ctx, w, rnd, (r) => {
    for (let i = 0; i < 6; i++) {
      const x = r() * w, y = wallTop + (26 + r() * 26) * k, len = (30 + r() * 90) * k;
      brushStroke(ctx, [[x, y], [x + len * 0.5, y + (r() - 0.5) * 3 * k], [x + len, y + (r() - 0.5) * 4 * k]], (1.5 + r() * 3) * k, { color: mixHex(P.concrete, P.tyre, 0.55), taper: 0.45, swell: 0.4, seed: i });
    }
    for (let i = 0; i < 8; i++) {
      const x = r() * w, y = wallTop + (24 + r() * 40) * k;
      brushStroke(ctx, [[x, y], [x + (6 + r() * 14) * k, y]], LINE.hair * k, { color: P.inkSoft, taper: 0.4 });
    }
  });
  // painted number panels on the two netted bays next to the opening
  const numbers = [String(11 + Math.floor(rnd() * 8)), ''];
  numbers[1] = String(+numbers[0] + 1);
  [posts[0] + w * 0.125, posts[2] + w * 0.125].forEach((cx, i) => {
    const pw = 88 * k, ph = 34 * k, py = wallTop + 27 * k;
    inkGroup(ctx, P, [{ r: [cx - pw / 2, py, pw, ph], fill: P.paint }], LINE.detail * k);
    fillRect(ctx, cx - pw / 2, py, 20 * k, ph, P.banners[i ? 5 : 2]);
    inkLine(ctx, cx - pw / 2 + 20 * k, py, cx - pw / 2 + 20 * k, py + ph, LINE.hair * k, P.ink);
    label(ctx, numbers[i], cx + 10 * k, py + ph / 2, 56 * k, 23 * k, { weight: 1.15, color: P.ink });
    label(ctx, 'P', cx - pw / 2 + 10 * k, py + ph / 2, 16 * k, 15 * k, { color: P.paint });
  });
  // service hatch on the bay that spans the tile edge
  for (const dx of [0, w]) {
    const hx = dx - 20 * k;
    inkGroup(ctx, P, [{ r: [hx, wallTop + 30 * k, 40 * k, 28 * k], fill: P.metal }], LINE.detail * k);
    fillRect(ctx, hx, wallTop + 30 * k, 40 * k, 6 * k, P.metalLight);
    fillRect(ctx, hx + 26 * k, wallTop + 30 * k, 14 * k, 28 * k, P.metalShade);
    fillRect(ctx, hx + 6 * k, wallTop + 42 * k, 9 * k, 3 * k, P.ink);
  }
  // pit board hanging on the track side of the wall under the opening
  const bx = mid + 4 * k, by = wallTop + 4 * k, bw = 50 * k, bh = 54 * k;
  inkTubes(ctx, P, [{ paths: [[[bx - bw * 0.3, wallTop - 4 * k], [bx - bw * 0.3, by + 4 * k]], [[bx + bw * 0.3, wallTop - 4 * k], [bx + bw * 0.3, by + 4 * k]]], width: 2.4 * k, fill: P.metal }], LINE.hair * k);
  inkGroup(ctx, P, [{ r: [bx - bw / 2, by, bw, bh], fill: P.uiDark }], LINE.form * k);
  fillRect(ctx, bx - bw / 2, by, bw, 3 * k, P.inkSoft);
  inkLine(ctx, bx - bw / 2, by + bh * 0.53, bx + bw / 2, by + bh * 0.53, LINE.hair * k, P.inkSoft);
  label(ctx, 'P3', bx, by + bh * 0.29, bw - 10 * k, 17 * k, { weight: 1.1, color: P.paintYellow });
  label(ctx, '+0.4', bx, by + bh * 0.76, bw - 8 * k, 12 * k, { color: P.paint });
  // sill plate of the opening, then posts over everything
  inkGroup(ctx, P, [{ r: [open0 - 2 * k, wallTop - 5 * k, open1 - open0 + 4 * k, 7 * k], fill: P.metal }], LINE.detail * k);
  fillRect(ctx, open0 - 2 * k, wallTop - 5 * k, open1 - open0 + 4 * k, 2.4 * k, P.metalLight);
  hline(ctx, wallTop, w, LINE.form * k, P.ink);
  for (const x of posts) {
    const path = [[x, wallTop + 2 * k], [x, 34 * k], [x + 3 * k, 22 * k], [x + 12 * k, top - 3 * k]];
    inkTubes(ctx, P, [{ paths: [path], width: 6.5 * k, fill: P.metal, light: P.metalLight, shade: P.metalShade }], LINE.form * k, 'butt');
    inkGroup(ctx, P, [{ r: [x - 9 * k, wallTop - 4 * k, 18 * k, 7 * k], fill: P.metalShade }], LINE.detail * k);
    fillRect(ctx, x - 9 * k, wallTop - 4 * k, 18 * k, 2.4 * k, P.metalLight);
  }
  fillRect(ctx, 0, h - 5 * k, w, 5 * k, inkAlpha(P, 0.4));
  hline(ctx, h - LINE.form * k * 0.5, w, LINE.form * k, P.ink);
  ctx.restore();
}

// ---- fictional sponsors -------------------------------------------------------------------------
// Invented names and plain geometric emblems: no real company, product or logo.

/** Simple one-colour emblem centred on (cx, cy), radius r. `hole` is the colour seen through cut-outs. */
export function emblem(ctx, kind, cx, cy, r, color, hole) {
  const poly = (pts) => { ctx.beginPath(); tracePolygon(ctx, pts.map(([px, py]) => [cx + px * r, cy + py * r])); ctx.fillStyle = color; ctx.fill(); };
  const disc = (dx, dy, rr, c) => fillEllipse(ctx, cx + dx * r, cy + dy * r, rr * r, rr * r, c);
  const star = (n, r0, r1, rot = -Math.PI / 2) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, q = i % 2 ? r0 : r1; pts.push([Math.cos(a) * q, Math.sin(a) * q]); } return pts; };
  if (kind === 'drop') {
    fillTrace(ctx, (g) => { g.moveTo(cx, cy - r); g.bezierCurveTo(cx + 0.2 * r, cy - 0.4 * r, cx + 0.7 * r, cy - 0.05 * r, cx + 0.7 * r, cy + 0.32 * r); g.arc(cx, cy + 0.32 * r, 0.7 * r, 0, Math.PI); g.bezierCurveTo(cx - 0.7 * r, cy - 0.05 * r, cx - 0.2 * r, cy - 0.4 * r, cx, cy - r); }, color);
    fillEllipse(ctx, cx - 0.26 * r, cy + 0.3 * r, 0.14 * r, 0.24 * r, hole);
  } else if (kind === 'gear') {
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; for (const [da, q] of [[-0.2, 0.72], [-0.13, 1], [0.13, 1], [0.2, 0.72]]) pts.push([Math.cos(a + da) * q, Math.sin(a + da) * q]); }
    poly(pts); disc(0, 0, 0.34, hole);
  } else if (kind === 'sun') {
    poly(star(10, 0.62, 1)); disc(0, 0, 0.5, hole); disc(0, 0, 0.38, color);
  } else if (kind === 'bolt') {
    poly([[0.3, -1], [-0.6, 0.14], [-0.06, 0.14], [-0.32, 1], [0.6, -0.2], [0.06, -0.2]]);
  } else if (kind === 'nut') {
    poly(star(3, 1, 1, 0)); disc(0, 0, 0.45, hole);
  } else if (kind === 'disc') {
    disc(0, 0, 1, color); disc(0, 0, 0.36, hole); disc(0, 0, 0.16, color);
    for (let i = 0; i < 8; i++) disc(Math.cos((i / 8) * TAU) * 0.68, Math.sin((i / 8) * TAU) * 0.68, 0.1, hole);
  } else if (kind === 'peaks') {
    poly([[-1, 0.7], [-0.32, -0.7], [0.12, 0.2], [0.42, -0.25], [1, 0.7]]);
  } else if (kind === 'tyre') {
    disc(0, 0, 1, color); disc(0, 0, 0.56, hole); disc(0, 0, 0.3, color);
    ctx.strokeStyle = hole; ctx.lineWidth = r * 0.1; ctx.lineCap = 'butt';
    ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.moveTo(cx + Math.cos(a) * r * 0.76, cy + Math.sin(a) * r * 0.76); ctx.lineTo(cx + Math.cos(a + 0.2) * r * 1.02, cy + Math.sin(a + 0.2) * r * 1.02); } ctx.stroke();
  } else if (kind === 'curve') {
    ctx.strokeStyle = color; ctx.lineWidth = r * 0.42; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(cx - 0.75 * r, cy + r); ctx.lineTo(cx - 0.75 * r, cy + 0.1 * r); ctx.arcTo(cx - 0.75 * r, cy - 0.5 * r, cx - 0.1 * r, cy - 0.5 * r, 0.6 * r); ctx.lineTo(cx + 0.3 * r, cy - 0.5 * r); ctx.stroke();
    poly([[0.25, -1.05], [1.05, -0.5], [0.25, 0.05]]);
  } else if (kind === 'piston') {
    poly([[-0.7, -1], [0.7, -1], [0.7, 0.05], [0.24, 0.05], [0.16, 0.5], [-0.16, 0.5], [-0.24, 0.05], [-0.7, 0.05]]);
    disc(0, 0.68, 0.34, color); disc(0, 0.68, 0.14, hole);
    fillRect(ctx, cx - 0.7 * r, cy - 0.76 * r, 1.4 * r, 0.1 * r, hole); fillRect(ctx, cx - 0.7 * r, cy - 0.52 * r, 1.4 * r, 0.1 * r, hole);
  } else if (kind === 'arrow') {
    poly([[-1, -0.6], [-0.2, -0.6], [0.5, 0], [-0.2, 0.6], [-1, 0.6], [-0.3, 0]]); poly([[0.1, -0.6], [0.4, -0.6], [1.1, 0], [0.4, 0.6], [0.1, 0.6], [0.8, 0]]);
  } else if (kind === 'wave') {
    ctx.strokeStyle = color; ctx.lineWidth = r * 0.26; ctx.lineCap = 'round';
    for (const dy of [-0.5, 0.05, 0.6]) { ctx.beginPath(); ctx.moveTo(cx - r, cy + dy * r); ctx.bezierCurveTo(cx - 0.5 * r, cy + (dy - 0.5) * r, cx - 0.1 * r, cy + (dy + 0.5) * r, cx + 0.3 * r, cy + dy * r); ctx.bezierCurveTo(cx + 0.55 * r, cy + (dy - 0.3) * r, cx + 0.8 * r, cy + (dy - 0.2) * r, cx + r, cy + (dy - 0.1) * r); ctx.stroke(); }
  } else {
    poly(star(5, 0.42, 1));
  }
}

// bg / fg / accent are indices in P.banners (0 red, 1 yellow, 2 blue, 3 white, 4 green, 5 orange, 6 purple, 7 ink)
export const SPONSORS = {
  orvane: { name: 'ORVANE', emblem: 'drop', bg: 5, fg: 3, accent: 7, layout: 'disc' },
  gommex: { name: 'GOMMEX', emblem: 'tyre', bg: 6, fg: 1, accent: 3, layout: 'stripe' },
  keltor: { name: 'KELTOR', emblem: 'gear', bg: 2, fg: 3, accent: 1, layout: 'plain' },
  brizal: { name: 'BRIZAL', emblem: 'sun', bg: 1, fg: 2, accent: 0, layout: 'split' },
  turbal: { name: 'TURBAL', emblem: 'arrow', bg: 3, fg: 0, accent: 0, layout: 'stripe' },
  virage: { name: 'VIRAGE GP', emblem: 'curve', bg: 0, fg: 3, accent: 1, layout: 'checker' },
  solgane: { name: 'SOLGANE', emblem: 'wave', bg: 4, fg: 3, accent: 3, layout: 'plain' },
  korvex: { name: 'KORVEX', emblem: 'nut', bg: 7, fg: 3, accent: 5, layout: 'split' },
  freinor: { name: 'FREINOR', emblem: 'disc', bg: 3, fg: 7, accent: 0, layout: 'disc' },
  nitral: { name: 'NITRAL', emblem: 'bolt', bg: 1, fg: 7, accent: 7, layout: 'stripe' },
  pistona: { name: 'PISTONA', emblem: 'piston', bg: 4, fg: 3, accent: 1, layout: 'plain' },
  montevo: { name: 'MONTEVO', emblem: 'peaks', bg: 3, fg: 2, accent: 2, layout: 'split' },
};

/**
 * Advertising panel of a fictional sponsor: flat colour, emblem on the left, bold lettering.
 * Draws the face only (no frame, no contour) inside (x, y, bw, bh).
 */
export function sponsorPanel(ctx, P, id, x, y, bw, bh, options = {}) {
  const s = SPONSORS[id], bg = P.banners[s.bg], fg = P.banners[s.fg], accent = P.banners[s.accent];
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, bw, bh); ctx.clip();
  fillRect(ctx, x, y, bw, bh, bg);
  const r = bh * 0.3, pad = bh * 0.2;
  let ex = x + pad + r, textLeft = ex + r + pad * 0.7, textRight = x + bw - pad;
  if (s.layout === 'stripe') {
    fillRect(ctx, x, y + bh * 0.8, bw, bh * 0.2, accent);
    fillRect(ctx, x, y + bh * 0.76, bw, bh * 0.025, fg);
  } else if (s.layout === 'split') {
    const edge = textLeft - pad * 0.2;
    fillPoly(ctx, [[x, y], [edge + bh * 0.16, y], [edge - bh * 0.16, y + bh], [x, y + bh]], accent);
    inkLine(ctx, edge + bh * 0.16, y, edge - bh * 0.16, y + bh, LINE.detail, P.ink);
  } else if (s.layout === 'checker') {
    const cw = bh * 0.5;
    checker(ctx, x, y, cw, bh, 2, 4, P.banners[7], P.banners[3]);
    checker(ctx, x + bw - cw, y, cw, bh, 2, 4, P.banners[7], P.banners[3]);
    ex += cw; textLeft += cw; textRight -= cw;
  } else if (s.layout === 'disc') {
    fillEllipse(ctx, ex, y + bh * 0.5, r * 1.3, r * 1.3, accent);
  }
  const cy = y + bh * (s.layout === 'stripe' ? 0.4 : 0.5);
  const emblemColor = s.layout === 'split' ? bg : s.layout === 'disc' ? bg : s.layout === 'checker' ? accent : accent;
  const holeColor = s.layout === 'split' || s.layout === 'disc' ? accent : bg;
  if (!options.noEmblem) emblem(ctx, s.emblem, ex, cy, r * (s.layout === 'disc' ? 0.82 : 1), emblemColor, holeColor);
  else textLeft = x + pad;
  label(ctx, s.name, (textLeft + textRight) / 2, cy, textRight - textLeft, bh * (options.size || 0.48), { weight: 1.25, color: fg, slant: 0.1, seed: s.bg * 7 + s.fg });
  ctx.restore();
}

const HOARDINGS = [
  [['orvane', 0.5], ['gommex', 0.5]],
  [['keltor', 1 / 3], ['brizal', 1 / 3], ['turbal', 1 / 3]],
  [['virage', 0.44], ['solgane', 0.28], ['korvex', 0.28]],
  [['freinor', 1 / 3], ['nitral', 1 / 3], ['pistona', 1 / 3]],
];

/** Advertising hoardings: two or three boards of fictional sponsors on a galvanised frame. */
function hoarding(ctx, w, h, P, rnd, variant) {
  const k = h / 96;
  ctx.save(); clipTile(ctx, w, h);
  const top = 6 * k, bottom = 82 * k, boards = HOARDINGS[variant % HOARDINGS.length];
  // shadow under the boards, then the frame feet
  fillRect(ctx, 0, bottom, w, h - bottom, inkAlpha(P, 0.42));
  hline(ctx, top - 1.5 * k, w, 3 * k + LINE.form * k * 2, P.ink);
  let x = 0;
  const edges = [0];
  for (const [id, share] of boards) {
    sponsorPanel(ctx, P, id, x, top, w * share, bottom - top);
    // thin cast shadow of the top rail, lit lower edge
    fillRect(ctx, x, top, w * share, 3 * k, inkAlpha(P, 0.22));
    x += w * share; edges.push(x);
  }
  hline(ctx, top - 1.5 * k, w, 3 * k, P.metalLight);
  hline(ctx, bottom, w, LINE.silhouette * k, P.ink);
  fillRect(ctx, 0, bottom - 4.5 * k, w, 3 * k, P.metalShade);
  hline(ctx, bottom - 4.5 * k, w, LINE.hair * k, P.ink);
  for (const ex of edges) {
    inkGroup(ctx, P, [{ r: [ex - 4 * k, 1.5 * k, 8 * k, h - 1.5 * k], fill: P.metal }, { p: [[ex - 16 * k, h], [ex - 4 * k, h - 9 * k], [ex + 4 * k, h - 9 * k], [ex + 16 * k, h]], fill: P.metalShade }], LINE.detail * k);
    fillRect(ctx, ex - 4 * k, 1.5 * k, 2.6 * k, h - 10.5 * k, P.metalLight);
    fillRect(ctx, ex + 1.6 * k, 1.5 * k, 2.4 * k, h - 10.5 * k, P.metalShade);
    for (const y of [14 * k, 44 * k, 72 * k]) fillEllipse(ctx, ex, y, 1.5 * k, 1.5 * k, P.ink);
  }
  ctx.restore();
}

// ---- trackside furniture (props) ----------------------------------------------------------------

function roundRectPath(g, x, y, w, h, r) {
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

/** Braking distance board: white panel with a red edge on two galvanised posts. */
function brakeSign(text) {
  return (ctx, w, h, P) => {
    const k = w / 144, ground = h - 6 * k;
    const bx = 9 * k, by = 7 * k, bw = 126 * k, bh = 74 * k, posts = [34 * k, 110 * k], red = P.banners[0];
    groundShadow(ctx, w / 2 + 8 * k, ground, 58 * k, 5 * k);
    inkTubes(ctx, P, [{ paths: posts.map((x) => [[x, by + bh - 6 * k], [x, ground - 2 * k]]), width: 7 * k, fill: P.metal, light: P.metalLight, shade: P.metalShade }], LINE.form * k, 'butt');
    for (const x of posts) {
      fillRect(ctx, x - 3.5 * k, by + bh, 7 * k, 11 * k, inkAlpha(P, 0.45));
      inkGroup(ctx, P, [{ r: [x - 9 * k, ground - 5 * k, 18 * k, 5 * k], fill: P.metalShade }], LINE.detail * k);
      fillRect(ctx, x - 9 * k, ground - 5 * k, 18 * k, 1.8 * k, P.metalLight);
    }
    const face = (g) => roundRectPath(g, bx, by, bw, bh, 7 * k);
    const inner = (g) => roundRectPath(g, bx + 8 * k, by + 8 * k, bw - 16 * k, bh - 16 * k, 3 * k);
    contour(ctx, face, P.ink, LINE.silhouette * k, 1, 'round');
    fillTrace(ctx, face, red);
    clipped(ctx, face, () => {
      fillPoly(ctx, [[bx, by + bh], [bx + bw, by + bh * 0.5], [bx + bw, by + bh]], shadeHex(red, 0.28));
      fillRect(ctx, bx, by, bw, 2.6 * k, lightHex(red, 0.35));
    });
    fillTrace(ctx, inner, P.paint);
    clipped(ctx, inner, () => fillPoly(ctx, [[bx + bw * 0.5, by + bh], [bx + bw, by + bh * 0.42], [bx + bw, by + bh]], shadeHex(P.paint, 0.16)));
    ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.detail * k; ctx.lineJoin = 'round';
    ctx.beginPath(); inner(ctx); ctx.stroke();
    label(ctx, text, bx + bw / 2, by + bh / 2 + k, bw - 30 * k, 38 * k, { weight: 1.25, color: P.ink, slant: 0.07, seed: 3 });
    for (const x of posts) for (const y of [by + 4 * k, by + bh - 4 * k]) fillEllipse(ctx, x, y, 1.6 * k, 1.6 * k, P.ink);
  };
}

/** Waving flag cloth hoisted at (x0, y0), fly length L, hoist height H. design: 'checker' | 'diagonal' | 'stripes' | 'plain'. */
function flagCloth(ctx, P, x0, y0, L, H, design, colors, k, phase) {
  const waves = 1.3;
  const wave = (u) => Math.sin(u * waves * TAU + phase);
  const at = (u, v) => [x0 + L * (u - 0.03 * u * Math.sin(u * waves * TAU + phase + 0.9)), y0 + v * H * (1 - 0.07 * u) + Math.pow(u, 1.5) * H * 0.2 + wave(u) * H * 0.1 * (0.2 + 0.8 * u) + v * u * H * 0.05 * wave(u + 0.12)];
  const poly = (uv) => {
    const pts = [];
    for (let i = 0; i < uv.length; i++) {
      const a = uv[i], b = uv[(i + 1) % uv.length], n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) * 16));
      for (let s = 0; s < n; s++) pts.push(at(a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n));
    }
    return pts;
  };
  const outline = poly([[0, 0], [1, 0], [1, 1], [0, 1]]);
  contour(ctx, (g) => tracePolygon(g, outline), P.ink, LINE.form * k, 1, 'round');
  fillPoly(ctx, outline, colors[0]);
  if (design === 'checker') {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) fillPoly(ctx, poly([[i / 6, j / 4], [(i + 1) / 6, j / 4], [(i + 1) / 6, (j + 1) / 4], [i / 6, (j + 1) / 4]]), colors[1]);
  } else if (design === 'diagonal') {
    fillPoly(ctx, poly([[0.14, 0], [0.5, 0], [0.86, 1], [0.5, 1]]), colors[1]);
    fillPoly(ctx, poly([[0.07, 0], [0.14, 0], [0.5, 1], [0.43, 1]]), colors[2]);
    fillPoly(ctx, poly([[0.5, 0], [0.57, 0], [0.93, 1], [0.86, 1]]), colors[2]);
  } else if (design === 'stripes') {
    for (let j = 1; j < 5; j += 2) fillPoly(ctx, poly([[0.3, j / 5], [1, j / 5], [1, (j + 1) / 5], [0.3, (j + 1) / 5]]), colors[1]);
    fillPoly(ctx, poly([[0, 0], [0.3, 0], [0.3, 1], [0, 1]]), colors[2]);
    fillPoly(ctx, poly([[0.3, 0], [0.36, 0], [0.36, 1], [0.3, 1]]), colors[3] || colors[0]);
  }
  // folds: flat shade where the cloth turns away from the light, flat light on the crests
  clipped(ctx, (g) => tracePolygon(g, outline), () => {
    let start = -1;
    for (let i = 0; i <= 50; i++) {
      const u = i / 50, away = Math.cos(u * waves * TAU + phase) > 0.2 && u > 0.06;
      if (away && start < 0) start = u;
      if ((!away || i === 50) && start >= 0) {
        fillPoly(ctx, poly([[start, 0], [u, 0], [u + 0.05, 1], [start + 0.07, 1]]), inkAlpha(P, 0.27));
        brushStroke(ctx, [at(start, 0.02), at(start + 0.03, 0.4), at(start + 0.06, 0.78)], LINE.detail * k, { color: P.ink, taperStart: 0.05, taperEnd: 0.6 });
        start = -1;
      }
    }
    start = -1;
    for (let i = 0; i <= 50; i++) {
      const u = i / 50, crest = Math.cos(u * waves * TAU + phase) < -0.78 && u > 0.1;
      if (crest && start < 0) start = u;
      if ((!crest || i === 50) && start >= 0) { fillPoly(ctx, poly([[start, 0], [u, 0], [u + 0.04, 1], [start + 0.04, 1]]), 'rgba(255,248,230,0.34)'); start = -1; }
    }
  });
  return at;
}

const FLAG_DESIGNS = [['checker', 3, 7, 7, 7], ['diagonal', 5, 3, 7, 7], ['stripes', 6, 1, 2, 3]];

/** Flagpole with a waving flag of abstract design (no national flag). */
function flagPole(ctx, w, h, P, rnd, variant) {
  const k = w / 128, ground = h - 6 * k, px = 19 * k, topY = 15 * k;
  const [design, c0, c1, c2, c3] = FLAG_DESIGNS[variant % FLAG_DESIGNS.length];
  groundShadow(ctx, px + 14 * k, ground, 28 * k, 4.5 * k);
  inkGroup(ctx, P, [{ r: [px - 11 * k, ground - 9 * k, 22 * k, 9 * k], fill: P.concrete }], LINE.detail * k);
  fillRect(ctx, px - 11 * k, ground - 9 * k, 22 * k, 3 * k, P.concreteLight);
  fillRect(ctx, px + 4 * k, ground - 6 * k, 7 * k, 6 * k, P.concreteShade);
  flagCloth(ctx, P, px + 2 * k, topY + 12 * k, 100 * k, 66 * k, design, [P.banners[c0], P.banners[c1], P.banners[c2], P.banners[c3]], k, 0.5 + variant * 1.9);
  const pole = [[px - 3.4 * k, ground - 8 * k], [px - 1.9 * k, topY], [px + 1.9 * k, topY], [px + 3.4 * k, ground - 8 * k]];
  inkGroup(ctx, P, [{ p: pole, fill: P.metal }, { trace: (g) => traceEllipse(g, px, topY - 3 * k, 4.6 * k, 4.6 * k), fill: P.paintYellow }, { r: [px - 5.5 * k, ground - 14 * k, 11 * k, 6 * k], fill: P.metalShade }], LINE.form * k, 1, 'round');
  clipped(ctx, (g) => tracePolygon(g, pole), () => {
    fillPoly(ctx, [[px - 3.4 * k, ground], [px - 1.9 * k, topY], [px - 0.7 * k, topY], [px - 1.4 * k, ground]], P.metalLight);
    fillPoly(ctx, [[px + 1.2 * k, ground], [px + 0.7 * k, topY], [px + 2 * k, topY], [px + 3.6 * k, ground]], P.metalShade);
  });
  fillEllipse(ctx, px - 1.4 * k, topY - 4.4 * k, 1.6 * k, 1.6 * k, lightHex(P.paintYellow, 0.6));
  // halyard and cleat
  brushStroke(ctx, [[px + 3 * k, topY + 10 * k], [px + 5.5 * k, (topY + ground) / 2], [px + 4 * k, ground - 84 * k]], LINE.hair * k * 1.2, { color: P.ink, taper: 0.05 });
  inkGroup(ctx, P, [{ r: [px + 2.5 * k, ground - 88 * k, 6 * k, 3.4 * k], fill: P.metalShade }], LINE.hair * k);
  for (const y of [topY + 14 * k, topY + 76 * k]) fillRect(ctx, px - 3.4 * k, y - 1.5 * k, 7.6 * k, 3 * k, P.ink);
}

/** Marshal post: raised platform with rails and a hipped sheet roof, marshal waving a yellow flag. */
function marshalPost(ctx, w, h, P, rnd) {
  const k = w / 256, ground = h - 7 * k, deck = ground - 38 * k;
  const x0 = 66 * k, x1 = 232 * k, eaves = 58 * k, rail = deck - 80 * k, midRail = deck - 42 * k;
  const steel = { light: P.metalLight, base: P.metal, shade: P.metalShade };
  groundShadow(ctx, (x0 + x1) / 2 + 6 * k, ground, 104 * k, 7 * k);
  // rear frame, drawn a little higher and inset: gives the platform its depth
  inkTubes(ctx, P, [
    { paths: [[[x0 + 18 * k, deck - 4 * k], [x0 + 18 * k, eaves]], [[x1 - 18 * k, deck - 4 * k], [x1 - 18 * k, eaves]]], width: 4 * k, fill: P.metalShade },
    { paths: [[[x0 + 18 * k, rail - 7 * k], [x1 - 18 * k, rail - 7 * k]], [[x0 + 18 * k, midRail - 6 * k], [x1 - 18 * k, midRail - 6 * k]]], width: 3 * k, fill: P.metalShade },
  ], LINE.detail * k, 'butt');
  // under-structure: legs and cross brace
  inkTubes(ctx, P, [
    { paths: [[[x0 + 5 * k, deck + 8 * k], [x1 - 5 * k, ground - 2 * k]], [[x1 - 5 * k, deck + 8 * k], [x0 + 5 * k, ground - 2 * k]]], width: 3 * k, fill: P.metalShade },
    { paths: [[[x0 + 5 * k, deck + 6 * k], [x0 + 5 * k, ground - 1 * k]], [[x1 - 5 * k, deck + 6 * k], [x1 - 5 * k, ground - 1 * k]]], width: 6 * k, fill: steel.base, light: steel.light, shade: steel.shade },
  ], LINE.detail * k, 'butt');
  for (const x of [x0 + 5 * k, x1 - 5 * k]) inkGroup(ctx, P, [{ r: [x - 9 * k, ground - 4 * k, 18 * k, 4.5 * k], fill: P.concreteLight }], LINE.detail * k);
  fillRect(ctx, x0 - 2 * k, deck + 9 * k, x1 - x0 + 4 * k, 9 * k, inkAlpha(P, 0.4));
  // spare flags rolled in their rack, extinguisher
  for (const [dx, c] of [[0, 4], [9, 0], [17, 2]]) {
    const bx = x1 - 56 * k + dx * k, tx = bx + (9 - dx * 0.4) * k, ty = deck - 96 * k + dx * 0.5 * k;
    inkTubes(ctx, P, [{ paths: [[[bx, deck - 2 * k], [tx, ty]]], width: 2 * k, fill: P.woodLight }, { paths: [[lerp2([bx, deck], [tx, ty], 0.52), lerp2([bx, deck], [tx, ty], 0.96)]], width: 5.5 * k, fill: P.banners[c] }], LINE.hair * k * 1.3);
  }
  const ex = x1 - 22 * k, red = paintTones(P.banners[0]);
  inkGroup(ctx, P, [{ trace: (g) => roundRectPath(g, ex - 7.5 * k, deck - 36 * k, 15 * k, 36 * k, 4 * k), fill: red.base }, { r: [ex - 3 * k, deck - 42 * k, 6 * k, 7 * k], fill: P.metalShade }, { r: [ex - 8 * k, deck - 46 * k, 13 * k, 4.5 * k], fill: P.ink }], LINE.detail * k, 1, 'round');
  fillRect(ctx, ex - 7 * k, deck - 34 * k, 4 * k, 31 * k, red.light);
  fillRect(ctx, ex + 2.5 * k, deck - 34 * k, 4.6 * k, 32 * k, red.shade);
  fillRect(ctx, ex - 7.5 * k, deck - 25 * k, 15 * k, 9 * k, P.paint);
  brushCurve(ctx, [[ex + 4 * k, deck - 43 * k], [ex + 13 * k, deck - 36 * k], [ex + 11 * k, deck - 18 * k], [ex + 8 * k, deck - 10 * k]], 2.4 * k, { color: P.ink, taper: 0.1 });
  // the marshal leans out of the post with the yellow flag
  const mx = x0 + 46 * k, mh = 130 * k;
  const hands = drawFigure(ctx, P, mx, deck, mh, { shirt: P.banners[5], overalls: true, skin: P.skin[0], hair: P.trunkShade, hat: 'cap', hatColor: P.paint, gloves: P.paint, arms: { l: [1.3, 1.62], r: [0.7, -0.75] }, lean: -0.035, stance: 0.04, line: LINE.form * k * 0.9 });
  // zip and reflective bands of the overalls
  const sy = hands.shoulderY, tx = mx - 0.035 * mh;
  brushStroke(ctx, [[tx - 1 * k, sy + 1 * k], [tx, sy + 30 * k], [mx - 1 * k, sy + 62 * k]], LINE.hair * k * 1.4, { color: P.ink, taper: 0.1 });
  fillRect(ctx, tx - 13.5 * k, sy + 13 * k, 27 * k, 3.4 * k, P.paint);
  fillRect(ctx, mx - 12 * k, deck - 31 * k, 10 * k, 3 * k, P.paint); fillRect(ctx, mx + 3 * k, deck - 31 * k, 10 * k, 3 * k, shadeHex(P.paint, 0.3));
  // flag: the cloth hangs and swings under the stick
  const hand = hands.l, tip = [hand[0] - 40 * k, hand[1] - 24 * k], butt = [hand[0] + 7 * k, hand[1] + 4 * k];
  const yellow = paintTones(P.paintYellow, 0.4, 0.3), a = lerp2(hand, tip, 0.2), m = lerp2(hand, tip, 0.6);
  const cloth = [a, m, tip, [tip[0] + 4 * k, tip[1] + 24 * k], [tip[0] - 3 * k, tip[1] + 47 * k], [m[0] - 5 * k, m[1] + 42 * k], [m[0] + 10 * k, m[1] + 49 * k], [a[0] - 1 * k, a[1] + 45 * k], [a[0] + 3 * k, a[1] + 22 * k]];
  const clothPath = (g) => closedCurve(g, cloth, 0.3);
  contour(ctx, clothPath, P.ink, LINE.form * k, 1, 'round');
  fillTrace(ctx, clothPath, yellow.base);
  clipped(ctx, clothPath, () => {
    fillPoly(ctx, [[m[0] - 2 * k, m[1] - 4 * k], [m[0] + 9 * k, m[1] - 4 * k], [m[0] + 13 * k, m[1] + 56 * k], [m[0] - 6 * k, m[1] + 56 * k]], yellow.shade);
    fillPoly(ctx, [[tip[0] - 4 * k, tip[1]], [tip[0] + 4 * k, tip[1]], [tip[0] + 7 * k, tip[1] + 26 * k], [tip[0], tip[1] + 56 * k], [tip[0] - 8 * k, tip[1] + 56 * k]], yellow.shade);
    fillPoly(ctx, [[m[0] - 14 * k, m[1] - 8 * k], [m[0] - 8 * k, m[1] - 8 * k], [m[0] - 12 * k, m[1] + 50 * k], [m[0] - 18 * k, m[1] + 50 * k]], yellow.light);
  });
  brushStroke(ctx, [[m[0] + 9 * k, m[1] + 2 * k], [m[0] + 11 * k, m[1] + 22 * k], [m[0] + 12 * k, m[1] + 40 * k]], LINE.detail * k, { color: P.ink, taperStart: 0.05, taperEnd: 0.6 });
  brushStroke(ctx, [[tip[0] + 9 * k, tip[1] + 6 * k], [tip[0] + 10 * k, tip[1] + 24 * k]], LINE.hair * k * 1.3, { color: P.ink, taper: 0.4 });
  inkTubes(ctx, P, [{ paths: [[butt, [tip[0] - 2.5 * k, tip[1] - 1.5 * k]]], width: 2.8 * k, fill: P.woodLight }], LINE.detail * k);
  fillEllipse(ctx, hand[0], hand[1], 5.6 * k, 5.6 * k, P.ink); fillEllipse(ctx, hand[0], hand[1], 4.2 * k, 4.2 * k, P.paint);
  // deck and front frame
  inkGroup(ctx, P, [{ r: [x0 - 8 * k, deck, x1 - x0 + 16 * k, 9 * k], fill: P.wood }], LINE.form * k);
  fillRect(ctx, x0 - 8 * k, deck, x1 - x0 + 16 * k, 3 * k, P.woodLight);
  for (let x = x0 + 14 * k; x < x1; x += 29 * k) inkLine(ctx, x, deck + 3 * k, x, deck + 9 * k, LINE.hair * k, P.ink);
  inkTubes(ctx, P, [
    { paths: [[[x0, rail], [x1, rail]], [[x0, midRail], [x1, midRail]]], width: 4.4 * k, fill: steel.base, light: steel.light },
    { paths: [[[x0, deck + 2 * k], [x0, eaves]], [[x1, deck + 2 * k], [x1, eaves]]], width: 6 * k, fill: steel.base, light: steel.light, shade: steel.shade },
  ], LINE.form * k * 0.9, 'butt');
  // post number hanging under the eaves
  const nx = x1 - 66 * k, ny = eaves + 14 * k;
  inkTubes(ctx, P, [{ paths: [[[nx + 6 * k, eaves + 6 * k], [nx + 6 * k, ny]], [[nx + 30 * k, eaves + 6 * k], [nx + 30 * k, ny]]], width: 1.4 * k, fill: P.metalShade }], LINE.hair * k, 'butt');
  inkGroup(ctx, P, [{ r: [nx, ny, 36 * k, 31 * k], fill: P.paint }], LINE.detail * k);
  fillRect(ctx, nx, ny, 36 * k, 6 * k, P.banners[0]);
  fillPoly(ctx, [[nx + 36 * k, ny + 12 * k], [nx + 36 * k, ny + 31 * k], [nx + 16 * k, ny + 31 * k]], shadeHex(P.paint, 0.14));
  label(ctx, String(3 + Math.floor(rnd() * 9)), nx + 18 * k, ny + 19 * k, 28 * k, 18 * k, { weight: 1.2, color: P.ink, slant: 0.05 });
  // roof: hipped sheet roof, fascia in shade, cast shadow on the posts
  for (const x of [x0, x1]) fillRect(ctx, x - 3 * k, eaves + 8 * k, 6 * k, 10 * k, inkAlpha(P, 0.45));
  const slope = [[x0 - 20 * k, eaves], [x0, 20 * k], [x1, 20 * k], [x1 + 20 * k, eaves]];
  inkGroup(ctx, P, [{ p: slope, fill: P.metal }, { r: [x0 - 20 * k, eaves, x1 - x0 + 40 * k, 8 * k], fill: P.metalShade }], LINE.silhouette * k);
  clipped(ctx, (g) => tracePolygon(g, slope), () => {
    fillPoly(ctx, [[x0 - 20 * k, eaves], [x0, 20 * k], [x0 + 70 * k, 20 * k], [x0 + 42 * k, eaves]], P.metalLight);
    fillPoly(ctx, [[x1 - 34 * k, eaves], [x1 - 20 * k, 20 * k], [x1, 20 * k], [x1 + 20 * k, eaves]], P.metalShade);
    ctx.strokeStyle = P.inkSoft; ctx.lineWidth = LINE.hair * k; ctx.beginPath();
    for (let i = 1; i < 12; i++) { const t = i / 12; ctx.moveTo(x0 + (x1 - x0) * t, 20 * k); ctx.lineTo(x0 - 20 * k + (x1 - x0 + 40 * k) * t, eaves); }
    ctx.stroke();
  });
  inkLine(ctx, x0 - 20 * k, eaves, x1 + 20 * k, eaves, LINE.detail * k, P.ink);
  fillRect(ctx, x0 - 20 * k, eaves + 1 * k, x1 - x0 + 40 * k, 2.2 * k, P.metal);
}

/** Floodlight mast: tapered lattice, service platform, twelve projectors. */
function lightTower(ctx, w, h, P) {
  const k = w / 96, ground = h - 6 * k, cx = w / 2, baseY = ground - 11 * k, headY = 100 * k;
  groundShadow(ctx, cx + 8 * k, ground, 36 * k, 5 * k);
  inkGroup(ctx, P, [{ r: [cx - 27 * k, baseY, 54 * k, 11 * k], fill: P.concrete }], LINE.form * k);
  fillRect(ctx, cx - 27 * k, baseY, 54 * k, 3.5 * k, P.concreteLight);
  fillRect(ctx, cx + 12 * k, baseY + 3.5 * k, 15 * k, 7.5 * k, P.concreteShade);
  const mast = latticeMembers([cx - 18 * k, baseY], [cx - 6.5 * k, headY], [cx + 18 * k, baseY], [cx + 6.5 * k, headY], 11, 'x');
  drawLattice(ctx, P, [mast], 4.4 * k, 1.5 * k, null, LINE.detail * k);
  // switch cabinet and cable riser
  inkGroup(ctx, P, [{ r: [cx - 9 * k, baseY - 40 * k, 18 * k, 24 * k], fill: P.metalLight }], LINE.detail * k);
  fillRect(ctx, cx + 1 * k, baseY - 40 * k, 8 * k, 24 * k, P.metal);
  fillRect(ctx, cx - 6 * k, baseY - 30 * k, 4 * k, 2 * k, P.ink);
  brushStroke(ctx, [[cx, baseY - 40 * k], [cx + 1 * k, (baseY + headY) / 2], [cx, headY]], LINE.detail * k, { color: P.ink, taper: 0.02 });
  // service platform
  inkTubes(ctx, P, [{ paths: [[[cx - 30 * k, headY - 18 * k], [cx + 30 * k, headY - 18 * k]], [[cx - 30 * k, headY], [cx - 30 * k, headY - 18 * k]], [[cx + 30 * k, headY], [cx + 30 * k, headY - 18 * k]], [[cx, headY], [cx, headY - 18 * k]]], width: 1.6 * k, fill: P.metal }], LINE.hair * k * 1.3, 'butt');
  inkGroup(ctx, P, [{ r: [cx - 33 * k, headY - 2 * k, 66 * k, 5 * k], fill: P.metalShade }], LINE.detail * k);
  fillRect(ctx, cx - 33 * k, headY - 2 * k, 66 * k, 1.8 * k, P.metalLight);
  // lamp frame and projectors (three rows of four), hoods toward the track
  const fx = 7 * k, fy = 10 * k, fw = w - 14 * k, fh = 68 * k;
  inkTubes(ctx, P, [{ paths: [[[cx - 14 * k, headY - 2 * k], [cx - 14 * k, fy + 4 * k]], [[cx + 14 * k, headY - 2 * k], [cx + 14 * k, fy + 4 * k]], [[fx + 2 * k, fy + fh * 0.5], [fx + fw - 2 * k, fy + fh * 0.5]]], width: 3 * k, fill: P.metalShade }], LINE.detail * k, 'butt');
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) cells.push([fx + (c + 0.5) * (fw / 4), fy + (r + 0.5) * (fh / 3)]);
  const lw2 = fw / 4 - 3.4 * k, lh = fh / 3 - 4.5 * k;
  contour(ctx, (g) => { for (const [x, y] of cells) g.rect(x - lw2 / 2, y - lh / 2, lw2, lh); }, P.ink, LINE.form * k);
  for (const [x, y] of cells) {
    fillRect(ctx, x - lw2 / 2, y - lh / 2, lw2, lh, P.inkSoft);
    fillRect(ctx, x - lw2 / 2, y - lh / 2, lw2, 3.2 * k, P.metal);
    const gx = x - lw2 / 2 + 2 * k, gy = y - lh / 2 + 4.6 * k, gw = lw2 - 4 * k, gh = lh - 6.6 * k;
    fillRect(ctx, gx, gy, gw, gh, P.glassLight);
    fillPoly(ctx, [[gx + gw, gy], [gx + gw, gy + gh], [gx, gy + gh]], P.glass);
    fillPoly(ctx, [[gx + gw, gy + gh * 0.55], [gx + gw, gy + gh], [gx + gw * 0.45, gy + gh]], P.glassShade);
    fillRect(ctx, gx + 1.2 * k, gy + 1.2 * k, gw * 0.3, 1.6 * k, P.paint);
  }
}

/** Camera scaffold: three lifts of tube and coupler scaffolding, camera, operator, parasol, banner. */
function tvTower(ctx, w, h, P) {
  const k = w / 208, ground = h - 6 * k, xl = 46 * k, xr = 162 * k, deck = ground - 300 * k, rail = deck - 66 * k;
  const lifts = [ground - 8 * k, ground - 104 * k, ground - 202 * k, deck];
  const steel = { light: P.metalLight, base: P.metal, shade: P.metalShade };
  groundShadow(ctx, w / 2 + 10 * k, ground, 96 * k, 6 * k);
  // rear frame, offset up and to the right
  const ox = 13 * k, oy = -8 * k;
  inkTubes(ctx, P, [{ paths: [[[xl + ox, ground - 6 * k], [xl + ox, rail + oy]], [[xr + ox, ground - 6 * k], [xr + ox, rail + oy]], ...lifts.slice(1).map((y) => [[xl + ox, y + oy], [xr + ox, y + oy]]), [[xl + ox, rail + oy], [xr + ox, rail + oy]],
    [[xl + ox, lifts[1] + oy], [xr + ox, lifts[0] + oy]], [[xl + ox, lifts[1] + oy], [xr + ox, lifts[2] + oy]], [[xl + ox, lifts[3] + oy], [xr + ox, lifts[2] + oy]]], width: 3 * k, fill: P.metalShade }], LINE.detail * k, 'butt');
  // ladder inside the right-hand bay
  const ladder = [];
  for (let y = ground - 20 * k; y > deck + 6 * k; y -= 15 * k) ladder.push([[xr - 30 * k, y], [xr - 12 * k, y]]);
  inkTubes(ctx, P, [{ paths: ladder, width: 1.6 * k, fill: P.metal }, { paths: [[[xr - 30 * k, ground - 6 * k], [xr - 30 * k, deck]], [[xr - 12 * k, ground - 6 * k], [xr - 12 * k, deck]]], width: 2.4 * k, fill: P.metal }], LINE.hair * k * 1.3, 'butt');
  // parasol behind the crew
  const pc = 118 * k, py = 40 * k;
  inkTubes(ctx, P, [{ paths: [[[pc, deck - 4 * k], [pc, 14 * k]]], width: 2.6 * k, fill: P.metal }], LINE.detail * k, 'butt');
  const canopy = [[pc - 70 * k, py], [pc - 52 * k, 24 * k], [pc - 22 * k, 13 * k], [pc, 10 * k], [pc + 22 * k, 13 * k], [pc + 52 * k, 24 * k], [pc + 70 * k, py]];
  const scallop = (g) => { g.moveTo(canopy[0][0], canopy[0][1]); for (let i = 1; i < canopy.length; i++) g.lineTo(canopy[i][0], canopy[i][1]); for (let i = 3; i >= 0; i--) g.quadraticCurveTo(pc - 70 * k + (i + 0.5) * 35 * k, py - 7 * k, pc - 70 * k + i * 35 * k, py); g.closePath(); };
  contour(ctx, scallop, P.ink, LINE.form * k, 1, 'round');
  fillTrace(ctx, scallop, P.paint);
  clipped(ctx, scallop, () => {
    fillPoly(ctx, [[pc - 35 * k, py + 2 * k], [pc - 22 * k, 13 * k], [pc, 9 * k], [pc, py + 2 * k]], P.banners[2]);
    fillPoly(ctx, [[pc + 35 * k, py + 2 * k], [pc + 52 * k, 22 * k], [pc + 72 * k, py + 2 * k]], P.banners[2]);
    fillPoly(ctx, [[pc + 8 * k, py + 2 * k], [pc + 4 * k, 8 * k], [pc + 80 * k, 8 * k], [pc + 80 * k, py + 2 * k]], inkAlpha(P, 0.2));
    for (const dx of [-35, 0, 35]) brushStroke(ctx, [[pc + dx * 0.02 * k, 10 * k], [pc + dx * 0.6 * k, 20 * k], [pc + dx * k, py - 4 * k]], LINE.hair * k * 1.2, { color: P.ink, taper: 0.1 });
  });
  // camera on its tripod, operator behind the pan bar
  const cxm = 86 * k, cy = deck - 70 * k;
  inkTubes(ctx, P, [{ paths: [[[cxm, cy + 8 * k], [cxm - 16 * k, deck - 2 * k]], [[cxm, cy + 8 * k], [cxm + 15 * k, deck - 2 * k]], [[cxm, cy + 8 * k], [cxm + 2 * k, deck - 2 * k]]], width: 3 * k, fill: P.inkSoft }], LINE.detail * k);
  const op = drawFigure(ctx, P, 134 * k, deck - 2 * k, 108 * k, { shirt: P.crowd[8], trousers: P.uiBlue, skin: P.skin[1], hair: P.ink, hat: 'headset', sleeves: 'long', arms: { l: [1.05, 1.5], r: [0.3, -0.5] }, lean: -0.03, line: LINE.detail * k * 1.25 });
  inkTubes(ctx, P, [{ paths: [[[cxm + 12 * k, cy + 6 * k], op.l]], width: 2.2 * k, fill: P.metalShade }], LINE.hair * k * 1.3);
  const dark = P.uiDark;
  inkGroup(ctx, P, [
    { r: [cxm - 24 * k, cy - 12 * k, 46 * k, 22 * k], fill: P.inkSoft },
    { p: [[cxm - 24 * k, cy - 9 * k], [cxm - 46 * k, cy - 11 * k], [cxm - 46 * k, cy + 9 * k], [cxm - 24 * k, cy + 7 * k]], fill: dark },
    { p: [[cxm - 46 * k, cy - 14 * k], [cxm - 58 * k, cy - 16 * k], [cxm - 58 * k, cy + 14 * k], [cxm - 46 * k, cy + 12 * k]], fill: P.inkSoft },
    { r: [cxm + 2 * k, cy - 23 * k, 18 * k, 11 * k], fill: dark },
    { r: [cxm - 7 * k, cy + 10 * k, 14 * k, 6 * k], fill: P.metalShade },
  ], LINE.form * k * 0.9);
  fillRect(ctx, cxm - 24 * k, cy - 12 * k, 46 * k, 4 * k, P.metalShade);
  fillRect(ctx, cxm - 24 * k, cy + 4 * k, 46 * k, 6 * k, dark);
  fillPoly(ctx, [[cxm - 58 * k, cy - 16 * k], [cxm - 46 * k, cy - 14 * k], [cxm - 46 * k, cy - 9 * k], [cxm - 58 * k, cy - 10 * k]], P.metalShade);
  fillEllipse(ctx, cxm - 59 * k, cy, 3 * k, 12 * k, P.glassShade); fillEllipse(ctx, cxm - 59.5 * k, cy - 4 * k, 1.6 * k, 5 * k, P.glassLight);
  fillRect(ctx, cxm - 16 * k, cy - 4 * k, 22 * k, 4 * k, P.banners[2]);
  fillEllipse(ctx, cxm + 16 * k, cy - 17.5 * k, 2 * k, 2 * k, P.banners[0]);
  // deck, toe board
  inkGroup(ctx, P, [{ r: [xl - 14 * k, deck - 2 * k, xr - xl + 40 * k, 8 * k], fill: P.wood }, { r: [xl - 10 * k, deck - 13 * k, xr - xl + 20 * k, 11 * k], fill: P.woodLight }], LINE.form * k * 0.9);
  fillRect(ctx, xl - 14 * k, deck - 2 * k, xr - xl + 40 * k, 2.6 * k, P.woodLight);
  fillRect(ctx, xl - 10 * k, deck - 6 * k, xr - xl + 20 * k, 4 * k, P.wood);
  // front frame: braces, ledgers, standards, outriggers
  inkTubes(ctx, P, [
    { paths: [[[xl, lifts[0]], [xr, lifts[1]]], [[xr, lifts[1]], [xl, lifts[2]]], [[xl, lifts[2]], [xr, lifts[3]]]], width: 3.2 * k, fill: steel.shade },
    { paths: [[[xl, ground - 62 * k], [xl - 36 * k, ground - 2 * k]], [[xr, ground - 62 * k], [xr + 36 * k, ground - 2 * k]]], width: 3.6 * k, fill: steel.base, light: steel.light },
    { paths: [...lifts.map((y) => [[xl - 5 * k, y], [xr + 5 * k, y]]), [[xl - 5 * k, rail], [xr + 5 * k, rail]], [[xl - 5 * k, deck - 36 * k], [xr + 5 * k, deck - 36 * k]]], width: 4.4 * k, fill: steel.base, light: steel.light },
    { paths: [[[xl, ground - 3 * k], [xl, rail - 6 * k]], [[xr, ground - 3 * k], [xr, rail - 6 * k]]], width: 5.6 * k, fill: steel.base, light: steel.light, shade: steel.shade },
  ], LINE.form * k * 0.9, 'butt');
  // couplers and base plates
  for (const x of [xl, xr]) {
    for (const y of [...lifts, rail]) { inkGroup(ctx, P, [{ r: [x - 4.6 * k, y - 4.6 * k, 9.2 * k, 9.2 * k], fill: P.metalShade }], LINE.hair * k * 1.3); fillRect(ctx, x - 4.6 * k, y - 4.6 * k, 9.2 * k, 3 * k, P.metal); }
    inkGroup(ctx, P, [{ r: [x - 10 * k, ground - 4 * k, 20 * k, 4 * k], fill: P.metalShade }], LINE.detail * k);
  }
  for (const x of [xl - 36 * k, xr + 36 * k]) inkGroup(ctx, P, [{ r: [x - 8 * k, ground - 3.5 * k, 16 * k, 3.5 * k], fill: P.woodLight }], LINE.detail * k);
  // banner laced into the middle lift
  const bx = xl + 5 * k, by = lifts[2] + 8 * k, bw = xr - xl - 10 * k, bh = lifts[1] - lifts[2] - 16 * k, blue = paintTones(P.banners[2]);
  ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.3; ctx.beginPath();
  for (const [px2, py2, qx, qy] of [[bx, by, xl, lifts[2]], [bx + bw, by, xr, lifts[2]], [bx, by + bh, xl, lifts[1]], [bx + bw, by + bh, xr, lifts[1]], [bx + bw / 2, by, bx + bw / 2, lifts[2]], [bx + bw / 2, by + bh, bx + bw / 2, lifts[1]]]) { ctx.moveTo(px2, py2); ctx.lineTo(qx, qy); }
  ctx.stroke();
  inkGroup(ctx, P, [{ r: [bx, by, bw, bh], fill: blue.base }], LINE.form * k);
  fillRect(ctx, bx, by + bh * 0.62, bw, bh * 0.38, P.paint);
  fillPoly(ctx, [[bx + bw * 0.55, by + bh], [bx + bw, by + bh * 0.25], [bx + bw, by + bh]], inkAlpha(P, 0.16));
  inkLine(ctx, bx, by + bh * 0.62, bx + bw, by + bh * 0.62, LINE.detail * k, P.ink);
  emblem(ctx, 'curve', bx + 20 * k, by + bh * 0.3, 11 * k, P.paintYellow, blue.base);
  label(ctx, 'TV', bx + bw * 0.62, by + bh * 0.31, bw * 0.5, 34 * k, { style: 'impact', color: P.paint, outline: P.ink });
  label(ctx, 'VIRAGE GP', bx + bw / 2, by + bh * 0.81, bw - 14 * k, 15 * k, { weight: 1.2, color: blue.shade, slant: 0.1 });
}

/** Spectators standing behind a rail (front row full figures, heads of a second row behind). */
function crowdGroup(ctx, w, h, P, rnd, variant) {
  const k = h / 128, ground = h - 5 * k, railY = ground - 67 * k, posts = [0.05, 0.35, 0.65, 0.95].map((f) => f * w);
  groundShadow(ctx, w / 2, ground, w * 0.48, 5 * k);
  // back row: full figures a little taller and darker, seen between the others
  for (let i = 0; i < 6; i++) {
    const look = randomLook(P, rnd);
    for (const key of ['shirt', 'trousers', 'skin', 'hair', 'hatColor']) look[key] = mixHex(look[key], P.ink, 0.16);
    const up = rnd() < 0.3;
    drawFigure(ctx, P, w * (0.14 + (0.72 * i) / 5) + (rnd() - 0.5) * 12 * k, ground - 2 * k, (up ? 104 : 108 + rnd() * 9) * k, { ...look, arms: up ? { l: armPose('up'), r: armPose('wave') } : undefined, stance: 0.025, line: LINE.detail * k * 1.1 });
  }
  const count = 8, order = [];
  for (let i = 0; i < count; i++) order.push({ i, x: w * (0.085 + (0.83 * i) / (count - 1)) + (rnd() - 0.5) * 9 * k, H: (96 + rnd() * 17) * k, z: rnd() });
  order.sort((a, b) => a.z - b.z);
  const flagBearer = variant === 0 ? 5 : 2, cheer = variant === 0 ? [1, 6] : [4, 7];
  for (const p of order) {
    const look = randomLook(P, rnd), pose = rnd();
    let arms = pose < 0.45 ? { l: armPose('rail'), r: armPose('rail') } : pose < 0.7 ? { l: armPose('down'), r: armPose('hip') } : { l: armPose('down'), r: armPose('down') };
    if (cheer.includes(p.i)) { arms = rnd() < 0.5 ? { l: armPose('up'), r: armPose('up') } : { l: armPose('wave'), r: armPose('rail') }; p.H = Math.min(p.H, 101 * k); }
    if (p.i === flagBearer) { arms = { l: armPose('rail'), r: [2.3, 2.9] }; p.H = Math.min(p.H, 100 * k); }
    const hands = drawFigure(ctx, P, p.x, ground - 1 * k, p.H, { ...look, arms, lean: (rnd() - 0.5) * 0.03, stance: 0.02 + rnd() * 0.03, line: LINE.detail * k * 1.25 });
    if (p.i === flagBearer) {
      const hd = hands.r, top = [hd[0] + 7 * k, Math.max(5 * k, hd[1] - 40 * k)];
      const c = P.banners[variant ? 6 : 3], c2 = P.banners[variant ? 1 : 7], cloth = [top, [top[0] + 16 * k, top[1] + 4 * k], [top[0] + 34 * k, top[1] + 1 * k], [top[0] + 33 * k, top[1] + 21 * k], [top[0] + 16 * k, top[1] + 24 * k], lerp2(top, hd, 0.55)];
      inkGroup(ctx, P, [{ trace: (g) => closedCurve(g, cloth, 0.3), fill: c }], LINE.detail * k * 1.2, 1, 'round');
      clipped(ctx, (g) => closedCurve(g, cloth, 0.3), () => {
        if (variant) fillPoly(ctx, [[top[0] - 4 * k, top[1] + 30 * k], [top[0] + 40 * k, top[1] - 4 * k], [top[0] + 40 * k, top[1] + 30 * k]], c2);
        else for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) fillRect(ctx, top[0] - 2 * k + i * 9.4 * k, top[1] - 2 * k + j * 9.4 * k, 9.4 * k, 9.4 * k, c2);
        fillRect(ctx, top[0] + 13 * k, top[1] - 4 * k, 8 * k, 34 * k, inkAlpha(P, 0.25));
      });
      inkTubes(ctx, P, [{ paths: [[[hd[0] - 1.5 * k, hd[1] + 5 * k], [top[0] + 0.6 * k, top[1] - 2 * k]]], width: 1.8 * k, fill: P.woodLight }], LINE.hair * k * 1.3);
      fillEllipse(ctx, hd[0], hd[1], 3.4 * k, 3.4 * k, P.ink); fillEllipse(ctx, hd[0], hd[1], 2.5 * k, 2.5 * k, look.skin);
    }
  }
  if (variant === 1) {
    // supporters' banner tied to the rail
    const bx = posts[1] + 8 * k, bw = posts[2] - posts[1] - 16 * k, by = railY + 3 * k, bh = 40 * k;
    const cloth = (g) => { g.moveTo(bx, by); g.quadraticCurveTo(bx + bw / 2, by + 4 * k, bx + bw, by); g.lineTo(bx + bw - 2 * k, by + bh); g.quadraticCurveTo(bx + bw * 0.7, by + bh + 4 * k, bx + bw / 2, by + bh); g.quadraticCurveTo(bx + bw * 0.3, by + bh - 3 * k, bx + 2 * k, by + bh + 1 * k); g.closePath(); };
    contour(ctx, cloth, P.ink, LINE.detail * k * 1.3, 1, 'round');
    fillTrace(ctx, cloth, P.paint);
    clipped(ctx, cloth, () => { fillRect(ctx, bx, by + bh * 0.78, bw, bh * 0.4, shadeHex(P.paint, 0.2)); fillPoly(ctx, [[bx + bw * 0.42, by], [bx + bw * 0.47, by], [bx + bw * 0.5, by + bh + 6 * k], [bx + bw * 0.44, by + bh + 6 * k]], shadeHex(P.paint, 0.2)); });
    label(ctx, 'ALLEZ !', bx + bw / 2, by + bh * 0.46, bw - 18 * k, 21 * k, { weight: 1.25, color: P.banners[0], slant: 0.12, seed: 5 });
  }
  inkTubes(ctx, P, [
    { paths: [[[posts[0], railY], [posts[3], railY]], [[posts[0], railY + 34 * k], [posts[3], railY + 34 * k]]], width: 4.4 * k, fill: P.metal, light: P.metalLight },
    { paths: posts.map((x) => [[x, ground], [x, railY - 2 * k]]), width: 5.4 * k, fill: P.metal, light: P.metalLight, shade: P.metalShade },
  ], LINE.form * k * 0.85, 'butt');
  for (const x of posts) inkGroup(ctx, P, [{ r: [x - 7 * k, ground - 3 * k, 14 * k, 3.5 * k], fill: P.metalShade }], LINE.detail * k);
}

/**
 * Start lights of the gantry: centre (fx, fy) and radius fr of the five lamps as fractions of the
 * drawing's width / height / width. The drawing shows them unlit; the game overlays the lit lamps.
 */
export const GANTRY_LIGHTS = [0, 1, 2, 3, 4].map((i) => ({ fx: (704 + (i - 2) * 41) / 1408, fy: 142 / 500, fr: 12.5 / 1408 }));

/** Start / finish gantry: two lattice towers, truss beam with the race banner, five-lamp light panel. */
function startGantry(ctx, w, h, P) {
  const k = w / 1408, ground = h - 6 * k, beamTop = 13 * k, beamBot = 113 * k, tw = 84 * k, xl = 24 * k, xr = w - 24 * k, plinth = ground - 28 * k, cx = w / 2;
  for (const x of [xl + tw / 2, xr - tw / 2]) groundShadow(ctx, x + 14 * k, ground, 80 * k, 6 * k);
  // rear plane of the box truss: diagonals the other way, in shade
  const rear = latticeMembers([xl, beamBot], [xr, beamBot], [xl, beamTop], [xr, beamTop], 16, 'zig');
  inkTubes(ctx, P, [{ paths: rear.braces, width: 4 * k, fill: P.metalShade }], LINE.detail * k, 'butt');
  const towers = [xl, xr - tw].map((x) => latticeMembers([x, plinth], [x, beamBot], [x + tw, plinth], [x + tw, beamBot], 5, 'x'));
  drawLattice(ctx, P, towers, 9 * k, 4 * k, null, LINE.form * k);
  const beam = latticeMembers([xl - 4 * k, beamTop], [xr + 4 * k, beamTop], [xl - 4 * k, beamBot], [xr + 4 * k, beamBot], 16, 'zig');
  drawLattice(ctx, P, [beam], 10 * k, 5 * k, null, LINE.form * k);
  // gusset plates at the tower nodes, bearing plates under the beam
  for (const t of towers) {
    for (const strut of t.struts) for (const [x, y] of strut) { inkGroup(ctx, P, [{ r: [x - 7 * k, y - 7 * k, 14 * k, 14 * k], fill: P.metalShade }], LINE.detail * k); fillRect(ctx, x - 7 * k, y - 7 * k, 14 * k, 4 * k, P.metal); fillEllipse(ctx, x, y + 1 * k, 1.8 * k, 1.8 * k, P.ink); }
  }
  // concrete plinths with a painted band
  for (const x of [xl, xr - tw]) {
    inkGroup(ctx, P, [{ r: [x - 14 * k, plinth, tw + 28 * k, ground - plinth], fill: P.concrete }], LINE.silhouette * k);
    fillRect(ctx, x - 14 * k, plinth, tw + 28 * k, 5 * k, P.concreteLight);
    for (let i = 0; i < 6; i++) fillRect(ctx, x - 14 * k + (i * (tw + 28 * k)) / 6, plinth + 5 * k, (tw + 28 * k) / 6, 10 * k, i % 2 ? P.kerbB : P.kerbA);
    fillRect(ctx, x + tw - 8 * k, plinth + 15 * k, 22 * k, ground - plinth - 15 * k, P.concreteShade);
    inkLine(ctx, x - 14 * k, plinth + 15 * k, x + tw + 14 * k, plinth + 15 * k, LINE.detail * k, P.ink);
    inkLine(ctx, x - 14 * k, plinth + 5 * k, x + tw + 14 * k, plinth + 5 * k, LINE.hair * k, P.ink);
  }
  // loudspeakers high on the inner faces
  for (const [x, s] of [[xl + tw, 1], [xr - tw, -1]]) {
    for (const y of [132 * k, 152 * k]) {
      inkGroup(ctx, P, [{ p: [[x + s * 2 * k, y - 4 * k], [x + s * 12 * k, y - 4 * k], [x + s * 30 * k, y - 10 * k], [x + s * 30 * k, y + 8 * k], [x + s * 12 * k, y + 3 * k], [x + s * 2 * k, y + 3 * k]], fill: P.metalLight }], LINE.detail * k);
      fillPoly(ctx, [[x + s * 12 * k, y], [x + s * 30 * k, y], [x + s * 30 * k, y + 8 * k], [x + s * 12 * k, y + 3 * k]], P.metal);
    }
  }
  // banner laced on the beam
  const bx = 262 * k, by = 5 * k, bw = w - 524 * k, bh = 116 * k, red = paintTones(P.banners[0]), cw = 58 * k;
  ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.detail * k; ctx.beginPath();
  for (const x of [bx, bx + bw]) for (const [y0, y1] of [[by + 6 * k, beamTop], [by + bh - 6 * k, beamBot]]) { ctx.moveTo(x, y0); ctx.lineTo(x + (x < cx ? -22 : 22) * k, y1); }
  ctx.stroke();
  inkGroup(ctx, P, [{ r: [bx, by, bw, bh], fill: red.base }], LINE.silhouette * k);
  fillPoly(ctx, [[bx + bw * 0.52, by + bh], [bx + bw, by + bh * 0.2], [bx + bw, by + bh]], red.shade);
  checker(ctx, bx, by, cw, bh, 2, 4, P.ink, P.paint); checker(ctx, bx + bw - cw, by, cw, bh, 2, 4, P.ink, P.paint);
  inkLine(ctx, bx + cw, by, bx + cw, by + bh, LINE.detail * k, P.ink); inkLine(ctx, bx + bw - cw, by, bx + bw - cw, by + bh, LINE.detail * k, P.ink);
  // speed flashes on both sides of the title
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = cx + s * (bw / 2 - cw - 30 * k - i * 32 * k), lean = s * 22 * k, wd = s * (18 - i * 4) * k;
      fillPoly(ctx, [[x - lean, by + 22 * k], [x - lean - wd, by + 22 * k], [x - wd, by + bh - 22 * k], [x, by + bh - 22 * k]], i === 1 ? P.paintYellow : P.paint);
    }
  }
  drawText(ctx, 'GRAND PRIX', cx, by + 35 * k, 23 * k, { style: 'bold', weight: 1.25, color: P.paint, align: 'center', tracking: 0.16, slant: 0.1, seed: 9 });
  drawText(ctx, 'VIRAGE GP', cx, by + bh - 15 * k, 50 * k, { style: 'impact', align: 'center', shadow: { dx: 3 * k, dy: 3.5 * k, color: P.ink }, seed: 2 });
  // light panel: five round lamp housings, unlit (dark red glass)
  const py = 119 * k, ph = 46 * k, pw = 222 * k, glassR = GANTRY_LIGHTS[0].fr * w;
  inkTubes(ctx, P, [{ paths: [[[cx - 78 * k, beamBot + 4 * k], [cx - 78 * k, py + 4 * k]], [[cx + 78 * k, beamBot + 4 * k], [cx + 78 * k, py + 4 * k]]], width: 6 * k, fill: P.metal, light: P.metalLight }], LINE.form * k, 'butt');
  const panel = (g) => roundRectPath(g, cx - pw / 2, py, pw, ph, 7 * k);
  contour(ctx, panel, P.ink, LINE.silhouette * k, 1, 'round');
  fillTrace(ctx, panel, P.uiDark);
  clipped(ctx, panel, () => { fillRect(ctx, cx - pw / 2, py, pw, 5 * k, P.inkSoft); fillRect(ctx, cx - pw / 2, py + ph - 7 * k, pw, 7 * k, P.ink); });
  for (const lamp of GANTRY_LIGHTS) {
    const lx = lamp.fx * w, ly = lamp.fy * h;
    fillEllipse(ctx, lx, ly, glassR + 4.2 * k, glassR + 4.2 * k, P.ink);
    fillEllipse(ctx, lx, ly, glassR + 2.6 * k, glassR + 2.6 * k, P.metalShade);
    fillEllipse(ctx, lx, ly, glassR + 0.8 * k, glassR + 0.8 * k, P.ink);
    fillEllipse(ctx, lx, ly, glassR, glassR, P.lampOff);
    clipped(ctx, (g) => traceEllipse(g, lx, ly, glassR, glassR), () => {
      fillEllipse(ctx, lx - glassR * 0.3, ly - glassR * 0.35, glassR * 0.72, glassR * 0.6, P.lampOffLight);
      fillEllipse(ctx, lx - glassR * 0.1, ly - glassR * 0.05, glassR * 0.78, glassR * 0.62, P.lampOff);
      fillRect(ctx, lx - glassR, ly + glassR * 0.5, glassR * 2, glassR, shadeHex(P.lampOff, 0.4));
    });
    // hood
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3.4 * k; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(lx, ly, glassR + 3.4 * k, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  }
}

/** Mirror helper for symmetric structures: x measured from the left edge, or from the right one. */
function sideX(w, right) { return right ? (x) => w - x : (x) => x; }

/** Bridge over the track. 0: steel footbridge with stair towers; 1: advertising arch on abutments. */
function bridge(ctx, w, h, P, rnd, variant) {
  const k = w / 1440, ground = h - 6 * k;
  const steel = { light: P.metalLight, base: P.metal, shade: P.metalShade };
  if (variant % 2 === 0) {
    const top = 42 * k, deckY = 142 * k, girder = 14 * k, parapet = 94 * k, cIn = 180 * k, cOut = 26 * k;
    for (const right of [false, true]) groundShadow(ctx, sideX(w, right)(103 * k) + 12 * k, ground, 100 * k, 6 * k);
    // far side of the through truss, in shade
    const rear = latticeMembers([cIn, deckY], [w - cIn, deckY], [cIn, top + 4 * k], [w - cIn, top + 4 * k], 12, 'zig');
    inkTubes(ctx, P, [{ paths: rear.braces, width: 4 * k, fill: P.metalShade }], LINE.detail * k, 'butt');
    // spectators on the deck, in the shade of the truss
    const tintCache = new Map();
    const tint = (c) => { if (!tintCache.has(c)) tintCache.set(c, mixHex(c, P.ink, 0.3)); return tintCache.get(c); };
    crowdRow(ctx, P, rnd, cIn + 14 * k, w - cIn - 14 * k, parapet + 2 * k, 11.5 * k, { density: 0.72, arms: 0.14, tint, line: LINE.detail * k * 0.9 });
    // near side of the truss (the banner hangs in front of its lower half)
    const front = latticeMembers([cIn, top], [w - cIn, top], [cIn, deckY - 1 * k], [w - cIn, deckY - 1 * k], 12, 'zig');
    inkTubes(ctx, P, [
      { paths: front.braces, width: 4.6 * k, fill: steel.base },
      { paths: front.struts, width: 5.4 * k, fill: steel.base, light: steel.light },
    ], LINE.form * k * 0.9, 'butt');
    // stair towers: three stepped flights between the columns, landings, handrails
    for (const right of [false, true]) {
      const X = sideX(w, right), levels = [ground - 3 * k, 336 * k, 246 * k, deckY + 2 * k], xa = 52 * k, xb = 154 * k, depth = 13 * k;
      const rails = [], balusters = [], landings = [];
      const flights = [];
      for (let f = 0; f < 3; f++) {
        const from = [X(f % 2 ? xb : xa), levels[f]], to = [X(f % 2 ? xa : xb), levels[f + 1]], n = 10, pts = [from];
        for (let i = 0; i < n; i++) { const q = lerp2(from, to, (i + 1) / n); pts.push([pts[pts.length - 1][0], q[1]], q); }
        const tread = pts.slice();
        pts.push([to[0], to[1] + depth], [from[0] + (to[0] - from[0]) * (f ? 0 : 0.13), Math.min(ground, from[1] + depth)]);
        flights.push({ pts, tread });
        rails.push([[from[0], from[1] - 46 * k], [to[0], to[1] - 46 * k]]);
        for (const t of [0, 0.5, 1]) { const q = lerp2(from, to, t); balusters.push([[q[0], q[1] - 2 * k], [q[0], q[1] - 46 * k]]); }
        // landing at the top of the flight, reaching the column on that side
        const cx2 = X(f % 2 ? cOut : cIn);
        landings.push([Math.min(to[0], cx2), to[1], Math.abs(cx2 - to[0]), 6 * k]);
        rails.push([[to[0], to[1] - 46 * k], [cx2, to[1] - 46 * k]]);
      }
      inkTubes(ctx, P, [{ paths: balusters, width: 2 * k, fill: steel.shade }, { paths: rails, width: 3 * k, fill: steel.base, light: steel.light }], LINE.detail * k, 'butt');
      inkGroup(ctx, P, [...flights.map((f) => ({ p: f.pts, fill: steel.base })), ...landings.map((r) => ({ r, fill: steel.base }))], LINE.form * k * 0.9);
      for (const f of flights) {
        clipped(ctx, (g) => tracePolygon(g, f.pts), () => {
          const a = f.tread[0], z = f.tread[f.tread.length - 1];
          fillPoly(ctx, [[a[0], a[1] + depth * 0.45], [z[0], z[1] + depth * 0.45], [z[0], z[1] + depth + 2 * k], [a[0], a[1] + depth + 2 * k]], steel.shade);
        });
        for (let i = 1; i + 1 < f.tread.length; i += 2) fillRect(ctx, Math.min(f.tread[i][0], f.tread[i + 1][0]), f.tread[i][1], Math.abs(f.tread[i + 1][0] - f.tread[i][0]), 1.8 * k, steel.light);
      }
      for (const r of landings) fillRect(ctx, r[0], r[1], r[2], 2 * k, steel.light);
      inkTubes(ctx, P, [
        { paths: [[[X(cOut), top], [X(cIn), top]]], width: 6 * k, fill: steel.base, light: steel.light },
        { paths: [[[X(cOut), ground - 3 * k], [X(cOut), top - 3 * k]], [[X(cIn), ground - 3 * k], [X(cIn), top - 3 * k]]], width: 9 * k, fill: steel.base, light: steel.light, shade: steel.shade },
      ], LINE.form * k * 0.9, 'butt');
      for (const x of [cOut, cIn]) { inkGroup(ctx, P, [{ r: [X(x) - 15 * k, ground - 7 * k, 30 * k, 7 * k], fill: P.concrete }], LINE.detail * k); fillRect(ctx, X(x) - 15 * k, ground - 7 * k, 30 * k, 2.4 * k, P.concreteLight); }
    }
    // deck girder, parapet with the sponsor banner, top chord
    inkGroup(ctx, P, [{ r: [cOut - 6 * k, deckY, w - 2 * cOut + 12 * k, girder], fill: P.metal }, { r: [cIn, parapet, w - 2 * cIn, deckY - parapet], fill: P.metalLight }], LINE.silhouette * k);
    fillRect(ctx, cOut - 6 * k, deckY, w - 2 * cOut + 12 * k, 3.4 * k, P.metalLight);
    fillRect(ctx, cOut - 6 * k, deckY + girder - 5 * k, w - 2 * cOut + 12 * k, 5 * k, P.metalShade);
    for (let x = cIn + 45 * k; x < w - cIn; x += 45 * k) fillEllipse(ctx, x, deckY + 6.5 * k, 1.6 * k, 1.6 * k, P.ink);
    const panels = ['keltor', 'virage', 'keltor'], pw = (w - 2 * cIn) / 3;
    panels.forEach((id, i) => {
      sponsorPanel(ctx, P, id, cIn + i * pw, parapet, pw, deckY - parapet, { size: 0.52 });
      if (i) inkLine(ctx, cIn + i * pw, parapet, cIn + i * pw, deckY, LINE.detail * k, P.ink);
    });
    fillRect(ctx, cIn, parapet, w - 2 * cIn, 3 * k, 'rgba(255,248,230,0.35)');
    fillRect(ctx, cIn, deckY - 8 * k, w - 2 * cIn, 8 * k, inkAlpha(P, 0.18));
    inkLine(ctx, cIn, deckY, w - cIn, deckY, LINE.form * k, P.ink);
    inkTubes(ctx, P, [{ paths: [front.chords[0]], width: 9 * k, fill: steel.base, light: steel.light, shade: steel.shade }], LINE.form * k * 0.9, 'butt');
    return;
  }
  // ---- advertising arch
  const spring = 150 * k, cx = w / 2, orange = paintTones(P.banners[5]);
  const arc = (rx, ry, x0, x1, n = 48, dy = 0) => { const pts = []; for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, q = Math.max(0, 1 - ((x - cx) / rx) ** 2); pts.push([x, spring + dy - ry * Math.sqrt(q)]); } return pts; };
  const outerRx = 700 * k, outerRy = 136 * k, innerRx = 528 * k, innerRy = 44 * k;
  const face = arc(outerRx, outerRy, cx - outerRx, cx + outerRx).concat(arc(innerRx, innerRy, cx + innerRx, cx - innerRx));
  const soffit = arc(innerRx, innerRy, cx - innerRx, cx + innerRx).concat(arc(innerRx, innerRy, cx + innerRx, cx - innerRx, 48, 7 * k));
  for (const right of [false, true]) {
    const X = sideX(w, right);
    groundShadow(ctx, X(104 * k) + 14 * k, ground, 108 * k, 6 * k);
    const pylon = [[X(14 * k), ground], [X(30 * k), spring - 4 * k], [X(190 * k), spring - 4 * k], [X(190 * k), ground]];
    inkGroup(ctx, P, [{ p: pylon, fill: P.concreteLight }], LINE.silhouette * k);
    clipped(ctx, (g) => tracePolygon(g, pylon), () => {
      // shaded return on the right, cast shadow of the arch at the top
      const sx = right ? w - 76 * k : 138 * k;
      fillRect(ctx, sx, spring - 10 * k, 60 * k, ground - spring + 12 * k, P.concrete);
      fillRect(ctx, sx + 30 * k, spring - 10 * k, 30 * k, ground - spring + 12 * k, P.concreteShade);
      fillPoly(ctx, [[X(0), spring - 6 * k], [X(200 * k), spring - 6 * k], [X(200 * k), spring + 22 * k], [X(0), spring + 34 * k]], inkAlpha(P, 0.3));
      for (let y = spring + 58 * k; y < ground - 30 * k; y += 46 * k) inkLine(ctx, 0, y, w, y, LINE.hair * k, P.inkSoft);
      fillRect(ctx, 0, ground - 22 * k, w, 22 * k, P.concreteShade);
      inkLine(ctx, 0, ground - 22 * k, w, ground - 22 * k, LINE.detail * k, P.ink);
      // painted band
      fillRect(ctx, 0, spring + 62 * k, w, 26 * k, P.kerbA); fillRect(ctx, 0, spring + 80 * k, w, 8 * k, shadeHex(P.kerbA, 0.25));
      inkLine(ctx, 0, spring + 62 * k, w, spring + 62 * k, LINE.hair * k, P.ink); inkLine(ctx, 0, spring + 88 * k, w, spring + 88 * k, LINE.hair * k, P.ink);
    });
    // service door (2.1 m) gives the scale
    const dx = X(right ? 126 * k : 78 * k);
    inkGroup(ctx, P, [{ r: [dx, ground - 104 * k, 48 * k, 101 * k], fill: P.metal }], LINE.detail * k);
    fillRect(ctx, dx, ground - 104 * k, 48 * k, 5 * k, P.metalLight);
    fillRect(ctx, dx + 34 * k, ground - 99 * k, 14 * k, 96 * k, P.metalShade);
    fillRect(ctx, dx + 6 * k, ground - 56 * k, 5 * k, 9 * k, P.ink);
    inkLine(ctx, dx + 4 * k, ground - 80 * k, dx + 30 * k, ground - 80 * k, LINE.hair * k, P.inkSoft);
  }
  contour(ctx, (g) => { tracePolygon(g, face); tracePolygon(g, soffit); }, P.ink, LINE.silhouette * k, 1, 'round');
  fillPoly(ctx, soffit, orange.shade);
  fillPoly(ctx, face, orange.base);
  clipped(ctx, (g) => tracePolygon(g, face), () => {
    fillPoly(ctx, [[cx + 250 * k, spring + 10 * k], [cx + 330 * k, 0], [w, 0], [w, spring + 10 * k]], orange.shade);
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    const rim = arc(outerRx, outerRy, cx - outerRx, cx + outerRx);
    ctx.strokeStyle = P.paint; ctx.lineWidth = 26 * k; ctx.beginPath(); tracePaths(ctx, [rim]); ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.detail * k; ctx.beginPath(); tracePaths(ctx, [arc(outerRx - 13 * k, outerRy - 13 * k, cx - outerRx + 13 * k, cx + outerRx - 13 * k)]); ctx.stroke();
    // white flashes on each side of the name
    ctx.strokeStyle = P.paint;
    for (const [x0, x1, wd] of [[cx - 520 * k, cx - 330 * k, 9], [cx + 330 * k, cx + 520 * k, 9], [cx - 480 * k, cx - 350 * k, 4], [cx + 350 * k, cx + 480 * k, 4]]) {
      ctx.lineWidth = wd * k; ctx.beginPath(); tracePaths(ctx, [arc(614 * k, (wd === 9 ? 98 : 78) * k, x0, x1, 16)]); ctx.stroke();
    }
  });
  inkLine(ctx, cx - innerRx, spring, cx - innerRx, spring + 7 * k, LINE.detail * k, P.ink);
  // sponsor name set along the curve, emblem on both sides
  const name = SPONSORS.orvane.name, size = 50 * k, opts = { style: 'bold', weight: 1.3, color: P.paint, slant: 0.1, align: 'center' };
  const mid = (x) => spring - 90 * k * Math.sqrt(1 - ((x - cx) / (614 * k)) ** 2), spacing = 66 * k;
  for (let i = 0; i < name.length; i++) {
    const x = cx + (i - (name.length - 1) / 2) * spacing, y = mid(x), angle = Math.atan2(mid(x + 1) - mid(x - 1), 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    drawText(ctx, name[i], 0, size / 2 + 2 * k, size, { ...opts, shadow: { dx: 2 * k, dy: 2.5 * k, color: orange.shade } });
    ctx.restore();
  }
  for (const s of [-1, 1]) {
    const x = cx + s * 268 * k, y = mid(x) + 2 * k;
    fillEllipse(ctx, x, y, 30 * k, 30 * k, P.ink);
    emblem(ctx, 'drop', x, y, 21 * k, orange.base, P.ink);
  }
}

/** Painters by family. Missing families fall back to a neutral placeholder (see scenery-painters.js). */
export const TRACKSIDE_PAINTERS = {
  'strip.armco': armco,
  'strip.concrete': concrete,
  'strip.tyres': tyres,
  'strip.fence': fence,
  'strip.pitwall': pitwall,
  'strip.hoarding': hoarding,
  'sign.brake.300': brakeSign('300'),
  'sign.brake.200': brakeSign('200'),
  'sign.brake.100': brakeSign('100'),
  'post.marshal': marshalPost,
  'pole.flag': flagPole,
  'tower.light': lightTower,
  'tower.tv': tvTower,
  'gantry.start': startGantry,
  'bridge': bridge,
  'crowd.group': crowdGroup,
};
