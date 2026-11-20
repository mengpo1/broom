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
 * wrap (tile width: figures crossing an edge are repeated), line, flags (chance) }.
 */
export function crowdRow(ctx, P, rnd, x0, x1, yBase, u, o = {}) {
  const lw = o.line ?? Math.max(0.9, u * 0.1), tint = o.tint || ((c) => c);
  const count = Math.max(1, Math.round((x1 - x0) / (u * 2.12))), step = (x1 - x0) / count;
  const people = [];
  for (let i = 0; i < count; i++) {
    const look = randomLook(P, rnd), keep = rnd() < (o.density ?? 0.94), arm = rnd(), side = rnd() < 0.5 ? -1 : 1;
    const person = { x: x0 + (i + 0.5 + (o.stagger || 0)) * step + (rnd() - 0.5) * u * 0.3, y: yBase, s: u * (0.93 + rnd() * 0.14), look, arms: arm < (o.arms ?? 0.1) ? (arm < (o.arms ?? 0.1) * 0.4 ? 2 : 1) : 0, side, lift: rnd() < 0.12 ? u * 0.35 : 0 };
    if (!keep) continue;
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
  const cols = 8, pitch = w / cols, rowH = 36.4 * k, top = 6 * k, a = pitch * 0.5 - 2.2 * k, b = rowH * 0.5 - 1.3 * k;
  const black = { light: P.tyreLight, base: P.tyre, shade: shadeHex(P.tyre, 0.45) };
  const white = { light: P.paint, base: mixHex(P.paint, P.concrete, 0.3), shade: shadeHex(P.paint, 0.42) };
  const red = { light: lightHex(P.kerbA, 0.32), base: P.kerbA, shade: shadeHex(P.kerbA, 0.4) };
  // dark backing between the tyres
  fillRect(ctx, 0, top + b, w, h - top - b, P.ink);
  const list = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      list.push({ cx: (c + 0.5) * pitch + (rnd() - 0.5) * 2.4 * k, cy: top + (r + 0.5) * rowH + (rnd() - 0.5) * 1.2 * k, a: a * (0.985 + rnd() * 0.03), b, tone: r === 2 ? black : (r + c) % 2 ? red : white, painted: r < 2, seed: r * 8 + c });
    }
  }
  const outline = (t) => superEllipse(t.cx, t.cy, t.a, t.b, 3.6, 32);
  contour(ctx, (g) => { for (const t of list) tracePolygon(g, outline(t)); }, P.ink, LINE.form * k, 0, 'round');
  for (const t of list) {
    const shape = outline(t);
    fillPoly(ctx, shape, t.tone.shade);
    clipped(ctx, (g) => tracePolygon(g, shape), () => {
      // tread face in the base value, shifted toward the light; shoulder below stays in shade
      fillPoly(ctx, superEllipse(t.cx - t.a * 0.1, t.cy - t.b * 0.2, t.a * 0.95, t.b * 0.86, 3.2, 24), t.tone.base);
      fillPoly(ctx, superEllipse(t.cx + t.a * 1.02, t.cy + t.b * 0.1, t.a * 0.2, t.b * 1.1, 2, 12), t.tone.shade);
      // upper shoulder catches the light
      brushCurve(ctx, [[t.cx - t.a * 0.86, t.cy - t.b * 0.42], [t.cx - t.a * 0.5, t.cy - t.b * 0.7], [t.cx + t.a * 0.2, t.cy - t.b * 0.74], [t.cx + t.a * 0.7, t.cy - t.b * 0.6]], t.b * 0.34, { color: t.tone.light, taper: 0.3, swell: 0.1, seed: t.seed });
      if (t.painted) {
        // worn paint: rubber showing through
        const n = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const x = t.cx + (rnd() - 0.5) * t.a * 1.4, y = t.cy + (rnd() - 0.2) * t.b * 0.9, len = (5 + rnd() * 14) * k;
          brushStroke(ctx, [[x, y], [x + len, y + (rnd() - 0.5) * 2 * k]], (1.2 + rnd() * 2) * k, { color: mixHex(t.tone.shade, P.tyre, 0.6), taper: 0.4 });
        }
      }
    });
    // edge of the tread band on each shoulder
    brushCurve(ctx, [[t.cx - t.a * 0.9, t.cy + t.b * 0.34], [t.cx - t.a * 0.4, t.cy + t.b * 0.6], [t.cx + t.a * 0.4, t.cy + t.b * 0.6], [t.cx + t.a * 0.9, t.cy + t.b * 0.34]], LINE.detail * k, { color: P.ink, taper: 0.25 });
    brushCurve(ctx, [[t.cx - t.a * 0.55, t.cy - t.b * 0.94], [t.cx, t.cy - t.b * 0.9], [t.cx + t.a * 0.86, t.cy - t.b * 0.5]], LINE.hair * k, { color: t.painted ? P.inkSoft : P.tyreLight, taper: 0.4 });
  }
  // steel strap bolted through the middle row
  const sy = top + rowH * 1.5, sh = 8 * k;
  fillRect(ctx, 0, sy - sh / 2 - LINE.detail * k, w, sh + LINE.detail * k * 2.6, P.ink);
  fillRect(ctx, 0, sy - sh / 2, w, sh, P.metalShade);
  fillRect(ctx, 0, sy - sh / 2, w, sh * 0.36, P.metal);
  for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) * pitch;
    fillRect(ctx, c * pitch - 3.5 * k, sy - sh / 2, 7 * k, sh, shadeHex(P.metalShade, 0.4));
    fillEllipse(ctx, x, sy, 4.2 * k, 4.2 * k, P.ink); fillEllipse(ctx, x - 0.3 * k, sy - 0.4 * k, 2.6 * k, 2.6 * k, P.metalLight);
  }
  fillRect(ctx, cols * pitch - 3.5 * k, sy - sh / 2, 7 * k, sh, shadeHex(P.metalShade, 0.4));
  fillRect(ctx, 0, h - 7 * k, w, 7 * k, inkAlpha(P, 0.45));
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
  diamondMesh(ctx, 0, top, w, bend, px, (bend - top) / 7, mesh, LINE.hair * k);
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

/** Painters by family. Missing families fall back to a neutral placeholder (see scenery-painters.js). */
export const TRACKSIDE_PAINTERS = {
  'strip.armco': armco,
  'strip.concrete': concrete,
  'strip.tyres': tyres,
  'strip.fence': fence,
  'strip.pitwall': pitwall,
  'strip.hoarding': hoarding,
};
