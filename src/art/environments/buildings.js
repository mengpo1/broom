// Buildings and large structures: pit building, grandstands, spectator banks, facades and the
// free-standing buildings of each circuit theme. Painter contract: (ctx, w, h, P, rnd, variant).
// Strips tile seamlessly from the left edge to the right edge; props stand on the bottom edge.
// Everything is drawn at real scale (pixels per metre derived from the spec): a door is 2.1 m,
// a storey about 3 m, a person 1.75 m. Light comes from the upper left.

import { LINE, closedCurve, brushStroke, brushCurve, tracePolygon, clipped, blobPoints } from '../styles/ink.js';
import { mixHex, shadeHex, lightHex } from '../palettes/palettes.js';
import { groundShadow } from './vegetation.js';
import { inkAlpha, paintTones, fillRect, fillPoly, fillTrace, traceEllipse, fillEllipse, inkLine, contour, inkGroup, inkTubes, latticeMembers, drawLattice, label, clipTile, wrapped, scratchCanvas, drawFigure, randomLook, armPose, crowdRow, sponsorPanel, emblem, roundRectPath, lerp2 } from './trackside.js';

const TAU = Math.PI * 2;

// ---- architectural kit --------------------------------------------------------------------------

/** Ruled parallel lines over a rectangle (cladding ribs, planks, slats, courses). */
function ribs(ctx, x, y, w, h, pitch, color, width, vertical = true) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
  ctx.beginPath();
  if (vertical) for (let p = x + pitch; p < x + w - 0.5; p += pitch) { ctx.moveTo(p, y); ctx.lineTo(p, y + h); }
  else for (let p = y + pitch; p < y + h - 0.5; p += pitch) { ctx.moveTo(x, p); ctx.lineTo(x + w, p); }
  ctx.stroke();
}

/**
 * Batch of rectangular windows: ink reveal, glass in three values (shadow of the reveal, base,
 * sky reflection), optional glazing bars, sills and drawn blinds. cells: [[x, y, w, h], ...].
 * o: { line, glass, shade, light, bars: [cols, rows], frame, sill, blinds (chance), rnd }.
 */
function windows(ctx, P, cells, o = {}) {
  const lw = o.line ?? LINE.detail;
  const each = (fn) => { ctx.beginPath(); for (const c of cells) fn(c); };
  each((c) => ctx.rect(c[0] - lw, c[1] - lw, c[2] + lw * 2, c[3] + lw * 2.4)); ctx.fillStyle = P.ink; ctx.fill();
  each((c) => ctx.rect(c[0], c[1], c[2], c[3])); ctx.fillStyle = o.glass || P.glass; ctx.fill();
  each((c) => { ctx.moveTo(c[0] + c[2], c[1] + c[3] * 0.4); ctx.lineTo(c[0] + c[2], c[1] + c[3]); ctx.lineTo(c[0] + c[2] * 0.35, c[1] + c[3]); ctx.closePath(); }); ctx.fillStyle = o.light || P.glassLight; ctx.fill();
  each((c) => { ctx.rect(c[0], c[1], c[2], c[3] * 0.26); ctx.rect(c[0], c[1], c[2] * 0.16, c[3]); }); ctx.fillStyle = o.shade || P.glassShade; ctx.fill();
  if (o.blinds && o.rnd) {
    each((c) => { if (o.rnd() < o.blinds) ctx.rect(c[0], c[1], c[2], c[3] * (0.3 + o.rnd() * 0.45)); }); ctx.fillStyle = o.blindColor || P.wallLight; ctx.fill();
  }
  if (o.bars) {
    each((c) => {
      for (let i = 1; i < o.bars[0]; i++) { ctx.moveTo(c[0] + (c[2] * i) / o.bars[0], c[1]); ctx.lineTo(c[0] + (c[2] * i) / o.bars[0], c[1] + c[3]); }
      for (let j = 1; j < o.bars[1]; j++) { ctx.moveTo(c[0], c[1] + (c[3] * j) / o.bars[1]); ctx.lineTo(c[0] + c[2], c[1] + (c[3] * j) / o.bars[1]); }
    });
    ctx.strokeStyle = o.frame || P.paint; ctx.lineWidth = Math.max(1, lw * 0.9); ctx.lineCap = 'butt'; ctx.stroke();
  }
  if (o.sill) {
    each((c) => ctx.rect(c[0] - lw * 2.5, c[1] + c[3] + lw, c[2] + lw * 5, lw * 2.6)); ctx.fillStyle = o.sill; ctx.fill();
    each((c) => ctx.rect(c[0] - lw * 2.5, c[1] + c[3] + lw * 3.6, c[2] + lw * 5, lw * 0.9)); ctx.fillStyle = P.ink; ctx.fill();
  }
}

/** Open louvred shutters on both sides of a window cell. */
function shutterPair(ctx, P, c, color, lw = LINE.detail) {
  const sw = c[2] * 0.5, shade = shadeHex(color, 0.3);
  for (const x of [c[0] - sw - lw, c[0] + c[2] + lw]) {
    fillRect(ctx, x - lw, c[1] - lw, sw + lw * 2, c[3] + lw * 2.4, P.ink);
    fillRect(ctx, x, c[1], sw, c[3], color);
    fillRect(ctx, x + sw * 0.62, c[1], sw * 0.38, c[3], shade);
    ribs(ctx, x, c[1], sw, c[3], Math.max(3, c[3] / 9), shade, Math.max(0.8, lw * 0.6), false);
  }
}

/** Roller shutter: slats from the lintel down to (1 - open) of the opening. The caller paints the interior first. */
function rollerDoor(ctx, P, x, y, w, h, open, k) {
  const sh = h * (1 - open);
  if (sh < 2) return;
  fillRect(ctx, x, y, w, sh, P.metal);
  ribs(ctx, x, y, w, sh, 9 * k, P.metalShade, 1.3 * k, false);
  fillRect(ctx, x, y, w * 0.34, sh, 'rgba(255,248,230,0.22)');
  fillRect(ctx, x, y, w, Math.min(sh, 9 * k), inkAlpha(P, 0.34));
  fillRect(ctx, x, y + sh - 8 * k, w, 8 * k, P.metalShade);
  inkLine(ctx, x, y + sh - 8 * k, x + w, y + sh - 8 * k, LINE.hair * k, P.ink);
  inkLine(ctx, x, y + sh, x + w, y + sh, LINE.form * k, P.ink);
}

/** Person sitting on the ground facing the viewer, knees up. H is the standing height; (x, y) the seat. */
function drawSitter(ctx, P, x, y, H, look, lw) {
  const u = H, shY = y - 0.36 * u, hy = y - 0.475 * u, rx = 0.053 * u, ry = 0.068 * u, kneeY = y - 0.25 * u;
  const torso = [[x - 0.034 * u, shY - 0.02 * u], [x + 0.034 * u, shY - 0.02 * u], [x + 0.118 * u, shY + 0.014 * u], [x + 0.105 * u, y], [x - 0.105 * u, y], [x - 0.118 * u, shY + 0.014 * u]];
  const shin = (s) => (g) => roundRectPath(g, x + s * 0.075 * u - 0.036 * u, kneeY, 0.072 * u, y - kneeY + 0.02 * u, 0.03 * u);
  const shoe = (s) => [[x + s * 0.075 * u - 0.05 * u, y + 0.045 * u], [x + s * 0.075 * u - 0.04 * u, y + 0.005 * u], [x + s * 0.075 * u + 0.04 * u, y + 0.005 * u], [x + s * 0.075 * u + 0.05 * u, y + 0.045 * u]];
  const hairPath = (g) => { g.moveTo(x - rx * 1.08, hy); g.ellipse(x, hy, rx * 1.08, ry * 1.06, 0, Math.PI, TAU); g.quadraticCurveTo(x, hy - ry * (look.hat === 'cap' ? 0.1 : 0.5), x - rx * 1.08, hy); g.closePath(); };
  const shirtShade = shadeHex(look.shirt, 0.3), skinShade = shadeHex(look.skin, 0.26);
  contour(ctx, (g) => { tracePolygon(g, torso); traceEllipse(g, x, hy, rx, ry); hairPath(g); g.rect(x - 0.026 * u, shY - 0.05 * u, 0.052 * u, 0.05 * u); }, P.ink, lw, 1, 'round');
  fillPoly(ctx, torso, look.shirt);
  fillPoly(ctx, [[x + 0.045 * u, shY - 0.02 * u], [x + 0.13 * u, shY], [x + 0.11 * u, y], [x + 0.05 * u, y]], shirtShade);
  fillRect(ctx, x - 0.026 * u, shY - 0.05 * u, 0.052 * u, 0.05 * u, skinShade);
  fillEllipse(ctx, x, hy, rx, ry, look.skin);
  clipped(ctx, (g) => traceEllipse(g, x, hy, rx, ry), () => fillEllipse(ctx, x + rx * 0.95, hy + ry * 0.15, rx * 0.62, ry * 1.2, skinShade));
  fillTrace(ctx, hairPath, look.hat === 'cap' || look.hat === 'sunhat' ? look.hatColor : look.hair);
  // arms resting on the knees, then the shins in front
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const j = [x + s * 0.105 * u, shY + 0.04 * u], e = [x + s * 0.15 * u, shY + 0.15 * u], hd = [x + s * 0.085 * u, kneeY + 0.01 * u];
    ctx.strokeStyle = P.ink; ctx.lineWidth = 0.052 * u + lw * 2; ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
    ctx.strokeStyle = look.sleeves === 'long' ? (s > 0 ? shirtShade : look.shirt) : s > 0 ? skinShade : look.skin; ctx.lineWidth = 0.052 * u; ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
    ctx.strokeStyle = s > 0 ? shirtShade : look.shirt; ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
  }
  contour(ctx, (g) => { for (const s of [-1, 1]) { shin(s)(g); tracePolygon(g, shoe(s)); } }, P.ink, lw, 1, 'round');
  fillTrace(ctx, shin(-1), look.trousers); fillTrace(ctx, shin(1), shadeHex(look.trousers, 0.3));
  fillPoly(ctx, shoe(-1), P.ink); fillPoly(ctx, shoe(1), P.ink);
}

/** Garden parasol planted at (x, y): pole and a scalloped canopy of radius r in two colours. */
function parasol(ctx, P, x, y, r, height, colorA, colorB, k) {
  const cy = y - height, lean = r * 0.08;
  inkTubes(ctx, P, [{ paths: [[[x, y], [x + lean, cy - r * 0.2]]], width: 2.4 * k, fill: P.metalLight }], LINE.detail * k);
  const cx = x + lean, top = cy - r * 0.62;
  const dome = (g) => { g.moveTo(cx - r, cy); g.quadraticCurveTo(cx - r * 0.6, top, cx, top - r * 0.06); g.quadraticCurveTo(cx + r * 0.6, top, cx + r, cy); for (let i = 3; i >= 0; i--) g.quadraticCurveTo(cx - r + (i + 0.5) * r * 0.5, cy - r * 0.14, cx - r + i * r * 0.5, cy); g.closePath(); };
  contour(ctx, dome, P.ink, LINE.form * k, 1, 'round');
  fillTrace(ctx, dome, colorA);
  clipped(ctx, dome, () => {
    fillPoly(ctx, [[cx - r * 0.5, cy + 2], [cx - r * 0.2, top - r * 0.1], [cx + r * 0.05, top - r * 0.1], [cx, cy + 2]], colorB);
    fillPoly(ctx, [[cx + r * 0.5, cy + 2], [cx + r * 0.32, top], [cx + r * 0.6, top + r * 0.2], [cx + r * 1.05, cy + 2]], colorB);
    fillPoly(ctx, [[cx + r * 0.12, cy + 2], [cx + r * 0.1, top - r * 0.2], [cx + r * 1.1, top], [cx + r * 1.1, cy + 2]], inkAlpha(P, 0.2));
    for (const f of [-0.5, 0, 0.5]) brushStroke(ctx, [[cx + f * r * 0.1, top], [cx + f * r * 0.7, top + r * 0.3], [cx + f * r, cy - r * 0.08]], LINE.hair * k * 1.2, { color: P.ink, taper: 0.1 });
  });
  fillEllipse(ctx, cx, top - r * 0.08, 2.2 * k, 2.2 * k, P.ink);
}

/** Small two-colour pennant on a stick from (x, y) up to (x + dx, y - len). */
function pennant(ctx, P, x, y, dx, len, cw, ch, colorA, colorB, k) {
  const tx = x + dx, ty = y - len;
  inkTubes(ctx, P, [{ paths: [[[x, y], [tx, ty]]], width: 1.8 * k, fill: P.woodLight }], LINE.hair * k * 1.3);
  const cloth = [[tx, ty], [tx + cw * 0.5, ty + ch * 0.16], [tx + cw, ty + ch * 0.04], [tx + cw * 0.96, ty + ch * 0.9], [tx + cw * 0.5, ty + ch], [tx + dx * -0.2, ty + ch * 0.86]];
  const path = (g) => closedCurve(g, cloth, 0.3);
  contour(ctx, path, P.ink, LINE.detail * k, 1, 'round');
  fillTrace(ctx, path, colorA);
  clipped(ctx, path, () => { fillPoly(ctx, [[tx - 4 * k, ty + ch * 1.2], [tx + cw * 1.1, ty - ch * 0.1], [tx + cw * 1.1, ty + ch * 1.2]], colorB); fillRect(ctx, tx + cw * 0.38, ty - 4 * k, cw * 0.2, ch * 1.4, inkAlpha(P, 0.24)); });
}

// ---- strips -------------------------------------------------------------------------------------

/** Main grandstand: banner wall, ten rows of spectators, steel columns every 10 m, cantilever roof. */
function grandstand(ctx, w, h, P, rnd) {
  const k = w / 1024;
  ctx.save(); clipTile(ctx, w, h);
  const fasciaTop = 10 * k, fasciaBot = 44 * k, wallTop = 166 * k, railY = 446 * k, bannerBot = 506 * k;
  const columns = [w * 0.25, w * 0.75], aisles = [0, w * 0.5], aisleHalf = 27 * k;
  const inAisle = (x) => aisles.some((a) => { const d = (((x - a) % w) + w) % w; return Math.min(d, w - d) < aisleHalf + 9 * k; });
  const rows = [];
  let base = railY;
  for (let r = 9; r >= 0; r--) { const u = 15 * k * (0.7 + (0.3 * r) / 9); rows[r] = { u, base, top: base - u * 1.62 }; base -= u * 1.62; }
  const tierTop = rows[0].top;
  // roof underside seen from below: three flat values getting deeper toward the back wall
  const soffit = [P.metal, shadeHex(P.metal, 0.3), shadeHex(P.metalShade, 0.32)];
  fillRect(ctx, 0, fasciaBot - 2 * k, w, 44 * k, soffit[0]);
  fillRect(ctx, 0, 84 * k, w, 44 * k, soffit[1]);
  fillRect(ctx, 0, 126 * k, w, wallTop - 126 * k, soffit[2]);
  for (const y of [64 * k, 105 * k, 146 * k]) inkLine(ctx, 0, y, w, y, LINE.hair * k, P.inkSoft);
  inkLine(ctx, 0, 84 * k, w, 84 * k, LINE.detail * k, P.ink); inkLine(ctx, 0, 126 * k, w, 126 * k, LINE.detail * k, P.ink);
  // secondary rafters, then the main rafters over the columns (white steel, shaded flank)
  for (let i = 0; i < 16; i++) {
    const x = (i + 0.5) * (w / 16);
    fillRect(ctx, x - 2.5 * k, fasciaBot, 5 * k, wallTop - fasciaBot, P.ink); fillRect(ctx, x - 1.4 * k, fasciaBot, 2.8 * k, wallTop - fasciaBot, soffit[0]);
  }
  for (const cx of columns) {
    fillRect(ctx, cx - 11 * k, fasciaBot, 22 * k, wallTop - fasciaBot, P.ink);
    fillRect(ctx, cx - 9 * k, fasciaBot, 18 * k, wallTop - fasciaBot, shadeHex(P.paint, 0.14));
    fillRect(ctx, cx - 9 * k, fasciaBot, 6 * k, wallTop - fasciaBot, P.paint);
    fillRect(ctx, cx + 2 * k, fasciaBot, 7 * k, wallTop - fasciaBot, shadeHex(P.paint, 0.36));
    fillRect(ctx, cx + 11 * k, fasciaBot, 12 * k, wallTop - fasciaBot, inkAlpha(P, 0.24));
  }
  // back wall with the glazed boxes
  fillRect(ctx, 0, wallTop, w, tierTop - wallTop + 20 * k, P.concrete);
  fillRect(ctx, 0, wallTop, w, 13 * k, P.concreteShade);
  const boxes = [];
  for (let i = 0; i < 16; i++) boxes.push([i * (w / 16) + 5 * k, wallTop + 22 * k, w / 16 - 10 * k, 40 * k]);
  windows(ctx, P, boxes, { line: LINE.detail * k, glass: P.glass, shade: P.glassShade, light: P.glassLight, blinds: 0.22, rnd, blindColor: P.concreteLight, sill: P.concreteLight });
  // guests behind some of the panes
  for (let i = 0; i < 16; i++) {
    if (rnd() < 0.55) continue;
    const bx = boxes[i][0] + boxes[i][2] * (0.3 + rnd() * 0.4), by = boxes[i][1] + boxes[i][3];
    fillTrace(ctx, (g) => { g.moveTo(bx - 9 * k, by); g.quadraticCurveTo(bx - 9 * k, by - 15 * k, bx - 3 * k, by - 16 * k); g.lineTo(bx + 3 * k, by - 16 * k); g.quadraticCurveTo(bx + 9 * k, by - 15 * k, bx + 9 * k, by); g.closePath(); traceEllipse(g, bx, by - 21 * k, 4 * k, 5 * k); }, mixHex(P.glassShade, P.ink, 0.55));
  }
  inkLine(ctx, 0, wallTop, w, wallTop, LINE.form * k, P.ink);
  inkLine(ctx, 0, wallTop + 76 * k, w, wallTop + 76 * k, LINE.detail * k, P.ink);
  fillRect(ctx, 0, wallTop + 76 * k, w, tierTop - wallTop - 56 * k, P.concreteShade);
  // the tier (seats, stair aisles, crowd) is painted once for half a tile and stamped twice:
  // the stand is built of identical 10 m bays
  const half = w / 2, y0 = Math.floor(tierTop - 36 * k), tierH = Math.ceil(railY - y0), tier = scratchCanvas(half, tierH), t = tier.getContext('2d');
  t.translate(0, -y0);
  // seats: plastic shells in three values, visible wherever nobody sits
  const seat = mixHex(P.banners[2], P.concrete, 0.3), seatShade = shadeHex(seat, 0.42), seatLight = lightHex(seat, 0.35);
  for (let r = 0; r < 10; r++) {
    const { u, base: by, top } = rows[r], count = Math.max(1, Math.round(half / (u * 2.12))), step = half / count, off = r % 2 ? 0.5 : 0;
    fillRect(t, 0, top - 1, half, by - top + 2, seatShade);
    t.fillStyle = seat; t.beginPath();
    for (let i = -1; i <= count; i++) { const x = (i + 0.5 + off) * step; roundRectPath(t, x - u * 0.82, by - u * 1.12, u * 1.64, u * 1.2, u * 0.3); }
    t.fill();
    t.fillStyle = seatLight; t.beginPath();
    for (let i = -1; i <= count; i++) { const x = (i + 0.5 + off) * step; t.rect(x - u * 0.6, by - u * 1.08, u * 1.2, u * 0.18); }
    t.fill();
    inkLine(t, 0, top, half, top, LINE.hair * k, P.ink);
  }
  // stair aisles: lit treads, risers in the base value, central handrail
  for (const a of [0, half]) {
    fillRect(t, a - aisleHalf, tierTop, aisleHalf * 2, railY - tierTop, P.concrete);
    for (let r = 0; r < 10; r++) {
      fillRect(t, a - aisleHalf, rows[r].top, aisleHalf * 2, rows[r].u * 0.6, P.concreteLight);
      inkLine(t, a - aisleHalf, rows[r].top + rows[r].u * 0.6, a + aisleHalf, rows[r].top + rows[r].u * 0.6, LINE.hair * k, P.ink);
    }
    fillRect(t, a + aisleHalf - 8 * k, tierTop, 8 * k, railY - tierTop, inkAlpha(P, 0.22));
    inkLine(t, a - aisleHalf, tierTop, a - aisleHalf, railY, LINE.detail * k, P.ink); inkLine(t, a + aisleHalf, tierTop, a + aisleHalf, railY, LINE.detail * k, P.ink);
    inkTubes(t, P, [{ paths: [[[a, rows[1].base], [a, railY - 4 * k]], [[a - 5 * k, rows[1].base], [a + 5 * k, rows[1].base]], [[a - 5 * k, rows[5].base], [a + 5 * k, rows[5].base]]], width: 2.6 * k, fill: P.metalLight }], LINE.detail * k);
  }
  // the crowd, back rows first; the three top rows sit in the shadow of the roof
  const shadowBot = rows[2].base - rows[3].u * 0.2;
  for (let r = 0; r < 10; r++) {
    crowdRow(t, P, rnd, 0, half, rows[r].base, rows[r].u, { density: 0.9, stagger: r % 2 ? 0.5 : 0, arms: 0.08, wrap: half, skip: inAisle, shade: r > 3, line: Math.max(0.9, LINE.detail * k * (0.8 + r * 0.03)) });
    if (r === 2) fillRect(t, 0, y0, half, shadowBot - y0, inkAlpha(P, 0.26));
  }
  fillRect(ctx, 0, wallTop, w, y0 - wallTop, inkAlpha(P, 0.26));
  ctx.drawImage(tier, 0, 0, half, tierH, 0, y0, half, tierH);
  ctx.drawImage(tier, 0, 0, half, tierH, half, y0, half, tierH);
  // what differs from one bay to the next: fans on their feet, a steward and a latecomer on the stairs
  for (const r of [3, 5, 7, 9]) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, rows[r].base - rows[r].u * 0.16); ctx.clip();
    crowdRow(ctx, P, rnd, 0, w, rows[r].base, rows[r].u * 1.04, { density: 0.11, stagger: r % 2 ? 0.5 : 0, arms: 0.8, wrap: w, skip: inAisle, line: Math.max(0.9, LINE.detail * k * (0.8 + r * 0.03)) });
    ctx.restore();
  }
  drawFigure(ctx, P, w * 0.5 - 9 * k, rows[5].base + 2 * k, 70 * k, { shirt: P.banners[5], trousers: P.inkSoft, skin: P.skin[1], hair: P.ink, hat: 'cap', hatColor: P.banners[5], sleeves: 'long', arms: { l: armPose('hip'), r: armPose('down') }, line: LINE.detail * k });
  drawFigure(ctx, P, w * 0.5 + 11 * k, rows[8].base + 2 * k, 82 * k, { ...randomLook(P, rnd), arms: { l: armPose('down'), r: armPose('wave') }, line: LINE.detail * k * 1.1 });
  // a few supporters' pennants (kept away from the tile edges)
  for (let i = 0; i < 4; i++) {
    const r = 3 + Math.floor(rnd() * 6), x = w * (0.08 + 0.22 * i + rnd() * 0.1);
    if (inAisle(x) || columns.some((c) => Math.abs(c - x) < 40 * k)) continue;
    pennant(ctx, P, x, rows[r].base - rows[r].u * 1.9, (rnd() - 0.3) * 10 * k, 42 * k, 32 * k, 22 * k, P.banners[Math.floor(rnd() * 7)], P.banners[Math.floor(rnd() * 7)], k);
  }
  // stair numbers hanging from the roof over the aisles
  for (const [a, text] of [[0, 'A1'], [w * 0.5, 'A2'], [w, 'A1']]) {
    inkTubes(ctx, P, [{ paths: [[[a - 16 * k, wallTop - 62 * k], [a - 16 * k, wallTop - 40 * k]], [[a + 16 * k, wallTop - 62 * k], [a + 16 * k, wallTop - 40 * k]]], width: 1.8 * k, fill: P.metal }], LINE.hair * k * 1.3, 'butt');
    inkGroup(ctx, P, [{ r: [a - 26 * k, wallTop - 40 * k, 52 * k, 30 * k], fill: P.paint }], LINE.form * k * 0.9);
    fillRect(ctx, a - 26 * k, wallTop - 40 * k, 52 * k, 7 * k, P.kerbA);
    fillPoly(ctx, [[a + 26 * k, wallTop - 26 * k], [a + 26 * k, wallTop - 10 * k], [a + 4 * k, wallTop - 10 * k]], shadeHex(P.paint, 0.16));
    label(ctx, text, a, wallTop - 21 * k, 44 * k, 14 * k, { weight: 1.25, color: P.ink, slant: 0.06, seed: 2 });
  }
  // front rail, banner wall of the sponsors, concrete base
  const ids = ['montevo', 'freinor', 'virage', 'solgane'];
  ids.forEach((id, i) => {
    sponsorPanel(ctx, P, id, (i * w) / 4, railY, w / 4, bannerBot - railY, { size: 0.5 });
    inkLine(ctx, (i * w) / 4, railY, (i * w) / 4, bannerBot, LINE.detail * k, P.ink);
  });
  fillRect(ctx, 0, railY, w, 4 * k, inkAlpha(P, 0.22));
  fillRect(ctx, 0, bannerBot, w, h - bannerBot, P.concrete);
  fillRect(ctx, 0, bannerBot, w, 6 * k, P.concreteLight);
  fillRect(ctx, 0, bannerBot + 6 * k, w, 5 * k, P.concreteShade);
  fillRect(ctx, 0, h - 14 * k, w, 14 * k, P.concreteShade);
  for (let i = 0; i < 8; i++) {
    const x = (i + 0.5) * (w / 8);
    inkLine(ctx, i * (w / 8), bannerBot + 11 * k, i * (w / 8), h, LINE.hair * k, P.inkSoft);
    fillRect(ctx, x - 20 * k, bannerBot + 21 * k, 40 * k, 11 * k, P.ink);
    ribs(ctx, x - 20 * k, bannerBot + 21 * k, 40 * k, 11 * k, 5 * k, P.concreteShade, 1.2 * k, true);
  }
  wrapped(ctx, w, rnd, (r) => {
    for (let i = 0; i < 9; i++) { const x = r() * w, y = bannerBot + (12 + r() * 22) * k; brushStroke(ctx, [[x, y], [x + 0.6 * k, y + (8 + r() * 14) * k]], (1.2 + r() * 1.4) * k, { color: P.concreteShade, taperStart: 0, taperEnd: 0.7 }); }
  });
  inkLine(ctx, 0, bannerBot, w, bannerBot, LINE.form * k, P.ink);
  inkLine(ctx, 0, h - 14 * k, w, h - 14 * k, LINE.hair * k, P.inkSoft);
  inkTubes(ctx, P, [{ paths: [[[-4, railY - 3 * k], [w + 4, railY - 3 * k]]], width: 5 * k, fill: P.metal, light: P.metalLight }], LINE.form * k * 0.9, 'butt');
  fillRect(ctx, 0, h - 5 * k, w, 5 * k, inkAlpha(P, 0.4));
  // steel columns: cast shadow on the tier, haunch under the rafter
  for (const cx of columns) {
    fillPoly(ctx, [[cx + 7 * k, wallTop], [cx + 22 * k, wallTop], [cx + 22 * k, railY - 30 * k], [cx + 7 * k, railY - 8 * k]], inkAlpha(P, 0.2));
    inkGroup(ctx, P, [{ p: [[cx - 30 * k, wallTop - 2 * k], [cx + 30 * k, wallTop - 2 * k], [cx + 7 * k, wallTop + 40 * k], [cx - 7 * k, wallTop + 40 * k]], fill: P.metalShade }, { r: [cx - 7 * k, wallTop, 14 * k, railY - wallTop + 2 * k], fill: P.metal }, { r: [cx - 13 * k, railY - 4 * k, 26 * k, 9 * k], fill: P.metalShade }], LINE.form * k);
    fillRect(ctx, cx - 7 * k, wallTop + 38 * k, 4 * k, railY - wallTop - 42 * k, P.metalLight);
    fillRect(ctx, cx + 3 * k, wallTop + 38 * k, 4 * k, railY - wallTop - 42 * k, P.metalShade);
    fillPoly(ctx, [[cx - 30 * k, wallTop - 2 * k], [cx - 7 * k, wallTop - 2 * k], [cx - 7 * k, wallTop + 40 * k]], P.metal);
    for (let y = wallTop + 80 * k; y < railY - 20 * k; y += 86 * k) { fillEllipse(ctx, cx, y, 1.8 * k, 1.8 * k, P.ink); fillEllipse(ctx, cx, y + 9 * k, 1.8 * k, 1.8 * k, P.ink); }
  }
  // floodlights under the front edge, then the roof fascia over everything
  for (const [grow, dy, hgt, color] of [[LINE.detail * k, 0, 9 * k, P.ink], [0, 0, 9 * k, P.glassLight], [0, 0, 3 * k, P.metalShade]]) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 16; i++) ctx.rect((i + 0.5) * (w / 16) - 9 * k - grow, fasciaBot + dy, 18 * k + grow * 2, hgt + grow * 1.6);
    ctx.fill();
  }
  fillRect(ctx, 0, fasciaBot + LINE.silhouette * k, w, 9 * k, inkAlpha(P, 0.3));
  fillRect(ctx, 0, fasciaTop - LINE.form * k, w, fasciaBot - fasciaTop + LINE.form * k + LINE.silhouette * k, P.ink);
  fillRect(ctx, 0, fasciaTop, w, fasciaBot - fasciaTop, P.paint);
  fillRect(ctx, 0, fasciaTop, w, 4 * k, P.metalLight);
  fillRect(ctx, 0, fasciaBot - 12 * k, w, 7 * k, P.kerbA);
  fillRect(ctx, 0, fasciaBot - 5 * k, w, 5 * k, shadeHex(P.paint, 0.3));
  inkLine(ctx, 0, fasciaBot - 12 * k, w, fasciaBot - 12 * k, LINE.hair * k, P.ink); inkLine(ctx, 0, fasciaBot - 5 * k, w, fasciaBot - 5 * k, LINE.hair * k, P.ink);
  const letter = 'ABCD'[Math.floor(rnd() * 4)];
  for (const cx of [w * 0.25, w * 0.75]) label(ctx, 'TRIBUNE ' + letter, cx, fasciaTop + 11.5 * k, 300 * k, 13 * k, { weight: 1.2, color: P.ink, tracking: 0.12, slant: 0.08 });
  ctx.restore();
}

/** Pit building: one garage per tile, glazed hospitality floor with balcony, roof edge with flags. */
function pitBuilding(ctx, w, h, P, rnd) {
  const k = w / 768;
  ctx.save(); clipTile(ctx, w, h);
  const roofTop = 62 * k, roofBot = 86 * k, floorY = 262 * k, slabBot = 276 * k, fasciaBot = 332 * k, pier = 106 * k;
  const doorX = pier, doorW = w - 2 * pier, doorTop = 350 * k, doorH = h - doorTop, team = paintTones(P.banners[2]);
  const dim = (c, t = 0.5) => mixHex(c, P.ink, t), bayNumber = String(4 + Math.floor(rnd() * 20)).padStart(2, '0');
  // ---- first floor: curtain wall behind the balcony
  fillRect(ctx, 0, roofBot, w, floorY - roofBot, P.glass);
  fillRect(ctx, 0, roofBot, w, 30 * k, P.glassShade);
  fillRect(ctx, 0, floorY - 40 * k, w, 40 * k, shadeHex(P.glass, 0.2));
  for (let i = 0; i < 8; i++) {
    const x = i * 96 * k, f = (i * 37) % 5;
    // sky reflections, different in each pane; ceiling lights of the lounge
    fillPoly(ctx, [[x + (14 + f * 6) * k, floorY], [x + (58 + f * 6) * k, roofBot + 30 * k], [x + (78 + f * 5) * k, roofBot + 30 * k], [x + (34 + f * 6) * k, floorY]], P.glassLight);
    if (f % 2) fillPoly(ctx, [[x + 4 * k, floorY - 60 * k], [x + 30 * k, roofBot + 30 * k], [x + 38 * k, roofBot + 30 * k], [x + 4 * k, floorY - 40 * k]], P.glassLight);
    fillRect(ctx, x + 22 * k, roofBot + 12 * k, 20 * k, 4 * k, P.glassLight); fillRect(ctx, x + 58 * k, roofBot + 12 * k, 20 * k, 4 * k, P.glassLight);
  }
  inkLine(ctx, 0, roofBot + 30 * k, w, roofBot + 30 * k, LINE.hair * k, P.ink);
  for (let i = 0; i <= 8; i++) { fillRect(ctx, i * 96 * k - 3.5 * k, roofBot, 7 * k, floorY - roofBot, P.ink); fillRect(ctx, i * 96 * k - 2 * k, roofBot, 2.4 * k, floorY - roofBot, P.metalLight); }
  fillRect(ctx, 0, roofBot + 74 * k, w, 3 * k, P.ink);
  // guests on the balcony
  const guests = [[136, 0], [236, 1], [286, 0], [442, 2], [520, 0], [628, 1]];
  for (const [gx, kind] of guests) {
    const look = randomLook(P, rnd);
    if (kind === 1) { look.shirt = team.base; look.hat = 'cap'; look.hatColor = team.base; }
    if (kind === 2) { look.shirt = P.paint; look.sleeves = 'long'; }
    const pose = rnd();
    drawFigure(ctx, P, gx * k + (rnd() - 0.5) * 16 * k, floorY, (102 + rnd() * 9) * k, { ...look, arms: pose < 0.55 ? { l: armPose('rail'), r: armPose('rail') } : pose < 0.8 ? { l: armPose('down'), r: armPose('hip') } : { l: armPose('wave'), r: armPose('rail') }, lean: (rnd() - 0.5) * 0.03, line: LINE.detail * k * 1.2 });
  }
  // balcony rail: posts, handrail, two cables
  const railTop = floorY - 67 * k, posts = [];
  for (let i = 0; i < 8; i++) posts.push([[(i + 0.5) * 96 * k, floorY], [(i + 0.5) * 96 * k, railTop]]);
  inkTubes(ctx, P, [{ paths: [[[-4, floorY - 22 * k], [w + 4, floorY - 22 * k]], [[-4, floorY - 44 * k], [w + 4, floorY - 44 * k]]], width: 1.4 * k, fill: P.metalLight }, { paths: posts, width: 3.6 * k, fill: P.metal, light: P.metalLight }, { paths: [[[-4, railTop], [w + 4, railTop]]], width: 5 * k, fill: P.metal, light: P.metalLight }], LINE.detail * k, 'butt');
  // ---- roof edge and what stands on it
  // team pennants on short masts
  [150, 384, 618].forEach((fx, i) => {
    const x = fx * k, c = P.banners[[0, 1, 4][i]], c2 = P.banners[[3, 7, 3][i]];
    inkTubes(ctx, P, [{ paths: [[[x, roofTop], [x, 10 * k]]], width: 2.4 * k, fill: P.metalLight }], LINE.detail * k);
    const cloth = [[x + 1.5 * k, 12 * k], [x + 24 * k, 17 * k], [x + 44 * k, 24 * k], [x + 22 * k, 30 * k], [x + 1.5 * k, 38 * k]];
    const path = (g) => closedCurve(g, cloth, 0.2);
    contour(ctx, path, P.ink, LINE.detail * k * 1.2, 1, 'round');
    fillTrace(ctx, path, c);
    clipped(ctx, path, () => { fillPoly(ctx, [[x, 8 * k], [x + 13 * k, 8 * k], [x + 13 * k, 42 * k], [x, 42 * k]], c2); fillRect(ctx, x + 20 * k, 8 * k, 8 * k, 36 * k, inkAlpha(P, 0.25)); });
    inkLine(ctx, x + 13 * k, 13 * k, x + 13 * k, 36 * k, LINE.hair * k, P.ink);
  });
  // air-conditioning unit, antenna mast with a dish
  inkGroup(ctx, P, [{ r: [236 * k, roofTop - 30 * k, 66 * k, 30 * k], fill: P.metalLight }], LINE.form * k);
  fillRect(ctx, 280 * k, roofTop - 30 * k, 22 * k, 30 * k, P.metal);
  ribs(ctx, 240 * k, roofTop - 24 * k, 36 * k, 20 * k, 5 * k, P.metalShade, 1.2 * k, false);
  inkTubes(ctx, P, [{ paths: [[[520 * k, roofTop], [520 * k, 12 * k]], [[508 * k, 26 * k], [532 * k, 26 * k]], [[512 * k, 36 * k], [528 * k, 36 * k]]], width: 2 * k, fill: P.metal }], LINE.detail * k);
  inkGroup(ctx, P, [{ trace: (g) => traceEllipse(g, 538 * k, 48 * k, 9 * k, 11 * k), fill: P.concreteLight }], LINE.detail * k, 1, 'round');
  fillEllipse(ctx, 540 * k, 50 * k, 5 * k, 7 * k, P.concrete);
  inkGroup(ctx, P, [{ r: [-4, roofTop, w + 8, roofBot - roofTop], fill: P.concreteLight }], LINE.silhouette * k);
  fillRect(ctx, 0, roofTop + 9 * k, w, 6 * k, team.base);
  fillRect(ctx, 0, roofBot - 6 * k, w, 6 * k, P.concrete);
  inkLine(ctx, 0, roofTop + 9 * k, w, roofTop + 9 * k, LINE.hair * k, P.ink); inkLine(ctx, 0, roofTop + 15 * k, w, roofTop + 15 * k, LINE.hair * k, P.ink);
  fillRect(ctx, 0, roofBot + LINE.silhouette * k * 0.8, w, 12 * k, inkAlpha(P, 0.38));
  // ---- balcony slab and team fascia
  inkGroup(ctx, P, [{ r: [-4, floorY, w + 8, slabBot - floorY], fill: P.concreteLight }, { r: [-4, slabBot, w + 8, fasciaBot - slabBot], fill: team.base }], LINE.form * k);
  fillRect(ctx, 0, slabBot - 4 * k, w, 4 * k, P.concrete);
  inkLine(ctx, 0, slabBot, w, slabBot, LINE.detail * k, P.ink);
  fillRect(ctx, 0, slabBot + LINE.detail * k * 0.5, w, 7 * k, team.shade);
  fillRect(ctx, 0, fasciaBot - 12 * k, w, 5 * k, P.paintYellow);
  fillRect(ctx, 0, fasciaBot - 7 * k, w, 7 * k, team.shade);
  emblem(ctx, 'gear', w * 0.5 - 150 * k, slabBot + 25 * k, 14 * k, P.paintYellow, team.base);
  label(ctx, 'KELTOR RACING', w * 0.5 + 16 * k, slabBot + 25 * k, 280 * k, 22 * k, { weight: 1.25, color: P.paint, slant: 0.12, seed: 4 });
  // ---- ground floor: garage interior, seen under the half-open shutter
  const floorLine = h - 30 * k;
  fillRect(ctx, doorX, doorTop, doorW, doorH, P.ink);
  fillRect(ctx, doorX, doorTop + doorH * 0.5, doorW, doorH * 0.5 - 30 * k, dim(P.concreteShade, 0.62));
  fillRect(ctx, doorX, floorLine, doorW, 30 * k, dim(P.pitAsphalt, 0.5));
  fillPoly(ctx, [[doorX, h], [doorX + 60 * k, floorLine + 8 * k], [doorX + doorW - 150 * k, floorLine + 8 * k], [doorX + doorW - 60 * k, h]], dim(P.pitAsphalt, 0.18));
  inkLine(ctx, doorX, floorLine, doorX + doorW, floorLine, LINE.hair * k, P.ink);
  // work bench, screen, a front wing on its trestles, tool trolley, tyres in their blankets
  const bx = doorX + doorW * 0.5;
  fillRect(ctx, bx - 150 * k, floorLine - 52 * k, 300 * k, 6 * k, dim(P.metal, 0.5));
  fillRect(ctx, bx - 144 * k, floorLine - 46 * k, 5 * k, 46 * k, dim(P.metal, 0.6)); fillRect(ctx, bx + 139 * k, floorLine - 46 * k, 5 * k, 46 * k, dim(P.metal, 0.6));
  fillRect(ctx, bx + 40 * k, floorLine - 96 * k, 58 * k, 36 * k, dim(P.glassLight, 0.25)); fillRect(ctx, bx + 44 * k, floorLine - 78 * k, 50 * k, 3 * k, dim(P.glass, 0.2)); fillRect(ctx, bx + 44 * k, floorLine - 70 * k, 34 * k, 3 * k, dim(P.glass, 0.2));
  const wing = dim(P.banners[2], 0.3);
  fillPoly(ctx, [[bx - 130 * k, floorLine - 26 * k], [bx - 10 * k, floorLine - 30 * k], [bx - 10 * k, floorLine - 20 * k], [bx - 130 * k, floorLine - 14 * k]], wing);
  fillRect(ctx, bx - 136 * k, floorLine - 44 * k, 8 * k, 34 * k, dim(P.paint, 0.3)); fillRect(ctx, bx - 14 * k, floorLine - 44 * k, 8 * k, 30 * k, dim(P.paint, 0.4));
  fillRect(ctx, bx - 112 * k, floorLine - 14 * k, 4 * k, 22 * k, dim(P.metal, 0.4)); fillRect(ctx, bx - 40 * k, floorLine - 18 * k, 4 * k, 26 * k, dim(P.metal, 0.4));
  const tx = doorX + 72 * k, trolley = dim(P.banners[0], 0.3);
  fillRect(ctx, tx - 2 * k, h - 78 * k, 62 * k, 64 * k, P.ink);
  fillRect(ctx, tx, h - 76 * k, 58 * k, 60 * k, trolley);
  fillRect(ctx, tx + 38 * k, h - 76 * k, 20 * k, 60 * k, dim(P.banners[0], 0.55));
  fillRect(ctx, tx - 3 * k, h - 80 * k, 64 * k, 6 * k, dim(P.metalLight, 0.25));
  for (let i = 0; i < 4; i++) { inkLine(ctx, tx, h - 62 * k + i * 12 * k, tx + 58 * k, h - 62 * k + i * 12 * k, LINE.hair * k, P.ink); fillRect(ctx, tx + 20 * k, h - 69 * k + i * 12 * k, 18 * k, 2.6 * k, dim(P.metalLight, 0.2)); }
  fillEllipse(ctx, tx + 8 * k, h - 9 * k, 6 * k, 6 * k, P.ink); fillEllipse(ctx, tx + 50 * k, h - 9 * k, 6 * k, 6 * k, P.ink);
  const sx = doorX + doorW - 92 * k;
  for (let i = 0; i < 3; i++) {
    const y = h - 12 * k - (i + 1) * 23 * k;
    fillTrace(ctx, (g) => roundRectPath(g, sx - 2 * k, y - 2 * k, 68 * k, 25 * k, 8 * k), P.ink);
    fillTrace(ctx, (g) => roundRectPath(g, sx, y, 64 * k, 21 * k, 7 * k), i === 2 ? dim(P.tyreLight, 0.15) : dim(P.banners[0], 0.35));
    fillRect(ctx, sx + 8 * k, y + 3 * k, 30 * k, 3.4 * k, i === 2 ? dim(P.metalLight, 0.45) : dim(P.banners[5], 0.2));
  }
  fillRect(ctx, sx - 6 * k, h - 13 * k, 76 * k, 5 * k, dim(P.metal, 0.4));
  rollerDoor(ctx, P, doorX, doorTop, doorW, doorH, 0.52, k);
  // door guides and piers
  for (const x of [doorX, doorX + doorW]) {
    fillRect(ctx, x - 6 * k, doorTop, 12 * k, doorH, P.ink);
    fillRect(ctx, x - 4.4 * k, doorTop, 8.8 * k, doorH, P.metalShade); fillRect(ctx, x - 4.4 * k, doorTop, 3 * k, doorH, P.metal);
  }
  fillRect(ctx, 0, fasciaBot, w, doorTop - fasciaBot, P.concrete);
  fillRect(ctx, 0, fasciaBot + LINE.form * k * 0.5, w, 8 * k, inkAlpha(P, 0.34));
  inkLine(ctx, doorX, doorTop, doorX + doorW, doorTop, LINE.form * k, P.ink);
  for (const dx of [0, w]) {
    fillRect(ctx, dx - pier + 6 * k, fasciaBot, 2 * pier - 12 * k, h - fasciaBot, P.concreteLight);
    fillRect(ctx, dx - pier + 6 * k, fasciaBot, 2 * pier - 12 * k, 9 * k, inkAlpha(P, 0.3));
    fillRect(ctx, dx + pier - 44 * k, fasciaBot, 38 * k, h - fasciaBot, P.concrete);
    fillRect(ctx, dx - pier + 6 * k, h - 16 * k, 2 * pier - 12 * k, 16 * k, P.concreteShade);
    inkLine(ctx, dx - pier + 6 * k, h - 16 * k, dx + pier - 6 * k, h - 16 * k, LINE.hair * k, P.ink);
    // numbered bay sign, service door, extinguisher, conduit
    inkGroup(ctx, P, [{ r: [dx - 38 * k, fasciaBot + 22 * k, 76 * k, 46 * k], fill: P.paint }], LINE.form * k);
    fillRect(ctx, dx - 38 * k, fasciaBot + 22 * k, 76 * k, 11 * k, team.base);
    fillPoly(ctx, [[dx + 38 * k, fasciaBot + 44 * k], [dx + 38 * k, fasciaBot + 68 * k], [dx + 6 * k, fasciaBot + 68 * k]], shadeHex(P.paint, 0.14));
    label(ctx, bayNumber, dx, fasciaBot + 51 * k, 60 * k, 24 * k, { weight: 1.25, color: P.ink, slant: 0.06, seed: 1 });
    label(ctx, 'BOX', dx, fasciaBot + 27.5 * k, 60 * k, 6.5 * k, { color: P.paint, tracking: 0.2 });
    const ddx = dx - 27 * k, ddy = h - 129 * k;
    inkGroup(ctx, P, [{ r: [ddx, ddy, 55 * k, 129 * k], fill: P.metal }], LINE.form * k);
    fillRect(ctx, ddx, ddy, 55 * k, 6 * k, P.metalLight);
    fillRect(ctx, ddx + 38 * k, ddy + 6 * k, 17 * k, 123 * k, P.metalShade);
    fillRect(ctx, ddx + 9 * k, ddy + 16 * k, 22 * k, 30 * k, P.ink); fillRect(ctx, ddx + 11 * k, ddy + 18 * k, 18 * k, 26 * k, P.glassShade); fillPoly(ctx, [[ddx + 29 * k, ddy + 28 * k], [ddx + 29 * k, ddy + 44 * k], [ddx + 17 * k, ddy + 44 * k]], P.glass);
    fillRect(ctx, ddx + 42 * k, ddy + 66 * k, 5 * k, 12 * k, P.ink);
    const red = paintTones(P.banners[0]);
    inkGroup(ctx, P, [{ trace: (g) => roundRectPath(g, dx + 56 * k, h - 78 * k, 14 * k, 34 * k, 4 * k), fill: red.base }, { r: [dx + 60 * k, h - 84 * k, 6 * k, 7 * k], fill: P.ink }], LINE.detail * k, 1, 'round');
    fillRect(ctx, dx + 57 * k, h - 76 * k, 4 * k, 30 * k, red.light); fillRect(ctx, dx + 56 * k, h - 66 * k, 14 * k, 7 * k, P.paint);
    inkTubes(ctx, P, [{ paths: [[[dx - 62 * k, fasciaBot + 2 * k], [dx - 62 * k, h - 60 * k]]], width: 3 * k, fill: P.metal }], LINE.detail * k, 'butt');
    inkGroup(ctx, P, [{ r: [dx - 72 * k, h - 76 * k, 20 * k, 26 * k], fill: P.metalLight }], LINE.detail * k);
    fillRect(ctx, dx - 60 * k, h - 76 * k, 8 * k, 26 * k, P.metal);
  }
  inkLine(ctx, 0, fasciaBot, w, fasciaBot, LINE.form * k, P.ink);
  fillRect(ctx, 0, h - 4 * k, w, 4 * k, inkAlpha(P, 0.4));
  ctx.restore();
}

/** Grass bank with spectators sitting and standing, parasols, pennants; a wire fence at its foot. */
function crowdBank(ctx, w, h, P, rnd) {
  const k = w / 1024;
  ctx.save(); clipTile(ctx, w, h);
  const crestAt = (x) => (120 + 7 * Math.sin((x / w) * TAU + 1) + 4 * Math.sin((x / w) * TAU * 3 + 2.2)) * k;
  const body = [];
  for (let x = -16 * k; x <= w + 16 * k; x += 16 * k) body.push([x, crestAt(x)]);
  body.push([w + 16 * k, h + 8], [-16 * k, h + 8]);
  contour(ctx, (g) => tracePolygon(g, body), P.ink, LINE.form * k, 0, 'round');
  fillPoly(ctx, body, P.grassA);
  clipped(ctx, (g) => tracePolygon(g, body), () => {
    // lit shoulder of the bank, broad darker bands, deep green at the foot
    const strip = (dy0, dy1, phase, color) => { const pts = []; for (let x = -16 * k; x <= w + 16 * k; x += 16 * k) pts.push([x, crestAt(x) + (dy0 + 3 * Math.sin((x / w) * TAU * 4 + phase)) * k]); for (let x = w + 16 * k; x >= -16 * k; x -= 16 * k) pts.push([x, crestAt(x) + (dy1 + 5 * Math.sin((x / w) * TAU * 5 + phase * 2)) * k]); fillPoly(ctx, pts, color); };
    strip(-4, 9, 0.4, P.mown); strip(34, 52, 1.7, P.grassB); strip(72, 110, 2.9, P.grassDark);
    for (let i = 0; i < 40; i++) {
      const x = (0.02 + rnd() * 0.96) * w, y = crestAt(x) + (6 + rnd() * 84) * k, s = (3 + rnd() * 4) * k;
      brushStroke(ctx, [[x, y], [x - s * 0.3, y - s]], LINE.hair * k * 1.3, { color: P.ink, taperStart: 0, taperEnd: 0.6 });
      brushStroke(ctx, [[x + s * 0.5, y], [x + s * 0.7, y - s * 0.8]], LINE.hair * k * 1.3, { color: P.ink, taperStart: 0, taperEnd: 0.6 });
    }
  });
  // tall pennants planted on the crest (clear of the edges)
  for (const [fx, a, b] of [[0.21, 0, 3], [0.64, 2, 1], [0.86, 5, 7]]) pennant(ctx, P, w * fx, crestAt(w * fx) + 4 * k, 3 * k, 106 * k, 44 * k, 28 * k, P.banners[a], P.banners[b], k);
  // everything on the bank is listed back to front; what stands near a tile edge is drawn again on the other side
  const items = [], lookOf = () => randomLook(P, rnd), parasolAt = [0.12, 0.47, 0.76];
  const shade = (x, y, rx) => fillEllipse(ctx, x + 5 * k, y + 1 * k, rx, 4 * k, inkAlpha(P, 0.28));
  // crest: people standing against the sky
  for (let i = 0; i < 15; i++) {
    const x = (i + 0.2 + rnd() * 0.6) * (w / 15), pose = rnd(), look = lookOf(), H = (74 + rnd() * 12) * k, lean = (rnd() - 0.5) * 0.03, stance = 0.02 + rnd() * 0.03;
    if (rnd() < 0.22) continue;
    const arms = pose < 0.2 ? { l: armPose('up'), r: armPose('up') } : pose < 0.4 ? { l: armPose('down'), r: armPose('wave') } : pose < 0.65 ? { l: armPose('hip'), r: armPose('hip') } : undefined;
    items.push({ x, reach: 36 * k, draw: () => drawFigure(ctx, P, x, crestAt(x) + 5 * k, H, { ...look, arms, lean, stance, line: LINE.detail * k * 1.05 }) });
  }
  // parasols with their owners, half-way up
  for (const [fx, a, b] of [[parasolAt[0], 0, 3], [parasolAt[1], 1, 2], [parasolAt[2], 3, 4]]) {
    const x = w * fx + (rnd() - 0.5) * 30 * k, y = crestAt(x) + 46 * k, la = lookOf(), lb = lookOf();
    items.push({ x, reach: 60 * k, draw: () => { shade(x, y, 46 * k); drawSitter(ctx, P, x - 22 * k, y - 2 * k, 84 * k, la, LINE.detail * k); drawSitter(ctx, P, x + 26 * k, y + 2 * k, 82 * k, lb, LINE.detail * k); parasol(ctx, P, x, y + 4 * k, 44 * k, 78 * k, P.banners[a], P.banners[b], k); } });
  }
  // rows of people sitting on the slope, a few standing among them
  for (const [dy, n] of [[40, 13], [74, 12]]) {
    for (let i = 0; i < n; i++) {
      const x = (i + 0.25 + rnd() * 0.5) * (w / n), y = crestAt(x) + (dy + rnd() * 10) * k, look = lookOf(), what = rnd(), H = (80 + rnd() * 10) * k, wave = rnd() < 0.4;
      if (dy < 60 && parasolAt.some((f) => { const d = (((x - w * f) % w) + w) % w; return Math.min(d, w - d) < 70 * k; })) continue;
      if (what < 0.12) continue;
      items.push({ x, reach: 40 * k, draw: () => {
        shade(x, y, 20 * k);
        if (what < 0.3) drawFigure(ctx, P, x, y, H, { ...look, arms: wave ? { l: armPose('wave'), r: armPose('down') } : { l: armPose('hip'), r: armPose('down') }, stance: 0.03, line: LINE.detail * k * 1.1 });
        else drawSitter(ctx, P, x, y, H, look, LINE.detail * k * 1.05);
        // cool box next to some of them
        if (what > 0.9) inkGroup(ctx, P, [{ r: [x + 20 * k, y - 12 * k, 22 * k, 14 * k], fill: P.banners[2] }, { r: [x + 19 * k, y - 16 * k, 24 * k, 5 * k], fill: P.paint }], LINE.detail * k);
      } });
    }
  }
  for (const item of items) {
    item.draw();
    for (const dx of [-w, w]) { if (item.x + dx > -item.reach && item.x + dx < w + item.reach) { ctx.save(); ctx.translate(dx, 0); item.draw(); ctx.restore(); } }
  }
  // wire fence at the foot of the bank
  const posts = [];
  for (let i = 0; i < 8; i++) posts.push([[(i + 0.5) * (w / 8), h], [(i + 0.5) * (w / 8), h - 30 * k]]);
  inkTubes(ctx, P, [{ paths: [[[-4, h - 12 * k], [w + 4, h - 12 * k]], [[-4, h - 25 * k], [w + 4, h - 25 * k]]], width: 1.3 * k, fill: P.metalLight }, { paths: posts, width: 5 * k, fill: P.wood, light: P.woodLight, shade: P.woodShade }], LINE.detail * k, 'butt');
  fillRect(ctx, 0, h - 3 * k, w, 3 * k, inkAlpha(P, 0.35));
  ctx.restore();
}

/** Dockside street front: brick warehouse, sheet-metal shed, narrow town house with a café. */
function facade(ctx, w, h, P, rnd) {
  const k = w / 768, m = 38.4 * k;
  ctx.save(); clipTile(ctx, w, h);
  const lw = LINE.detail * k;
  // ---- brick warehouse, four storeys
  const ax = 100 * k, aw = 300 * k, aTop = h - 13.2 * m, brick = { light: P.brickLight, base: P.brick, shade: P.brickShade };
  inkGroup(ctx, P, [{ r: [ax, aTop, aw, h - aTop], fill: brick.base }], LINE.silhouette * k);
  fillRect(ctx, ax, aTop, 16 * k, h - aTop, brick.light); fillRect(ctx, ax + aw - 16 * k, aTop, 16 * k, h - aTop, brick.shade);
  for (let i = 0; i < 70; i++) {
    const x = ax + 18 * k + rnd() * (aw - 56 * k), y = aTop + 30 * k + rnd() * (h - aTop - 40 * k), len = (10 + rnd() * 22) * k;
    if (rnd() < 0.3) fillRect(ctx, x, y, 9 * k, 4 * k, rnd() < 0.5 ? brick.light : brick.shade);
    else inkLine(ctx, x, y, x + len, y, LINE.hair * k, brick.shade);
  }
  // cornice and parapet
  fillRect(ctx, ax, aTop + 16 * k, aw, 12 * k, brick.light);
  fillRect(ctx, ax, aTop + 28 * k, aw, 9 * k, inkAlpha(P, 0.34));
  inkLine(ctx, ax, aTop + 16 * k, ax + aw, aTop + 16 * k, lw, P.ink); inkLine(ctx, ax, aTop + 28 * k, ax + aw, aTop + 28 * k, LINE.form * k, P.ink);
  for (let x = ax + 12 * k; x < ax + aw - 8 * k; x += 14 * k) fillRect(ctx, x, aTop + 28 * k, 6 * k, 5 * k, brick.base);
  const floorH = 2.72 * m, groundH = 4.05 * m, cells = [];
  for (let f = 0; f < 3; f++) for (let c = 0; c < 3; c++) if (!(f === 0 && c === 1)) cells.push([ax + aw * (1 / 6 + c / 3) - 29 * k, aTop + 54 * k + f * floorH, 58 * k, 66 * k]);
  // segmental brick arches over the openings
  for (const c of cells) { fillTrace(ctx, (g) => { g.moveTo(c[0] - 5 * k, c[1] + 4 * k); g.quadraticCurveTo(c[0] + c[2] / 2, c[1] - 16 * k, c[0] + c[2] + 5 * k, c[1] + 4 * k); g.lineTo(c[0] + c[2] + 5 * k, c[1] - 6 * k); g.quadraticCurveTo(c[0] + c[2] / 2, c[1] - 26 * k, c[0] - 5 * k, c[1] - 6 * k); g.closePath(); }, brick.light); }
  windows(ctx, P, cells, { line: lw, bars: [3, 4], frame: P.wallLight, sill: P.concreteLight, glass: P.glassShade, shade: shadeHex(P.glassShade, 0.35), light: P.glass });
  for (const c of cells) brushStroke(ctx, [[c[0] + c[2] * 0.3, c[1] + c[3] + 6 * k], [c[0] + c[2] * 0.32, c[1] + c[3] + (16 + rnd() * 16) * k]], 1.6 * k, { color: brick.shade, taperStart: 0, taperEnd: 0.7 });
  // loading door of the top floor with its hoist beam
  const ldx = ax + aw / 2 - 31 * k, ldy = aTop + 44 * k;
  inkGroup(ctx, P, [{ r: [ldx, ldy, 62 * k, 80 * k], fill: P.wood }], lw);
  fillRect(ctx, ldx + 31 * k, ldy, 31 * k, 80 * k, P.woodShade); ribs(ctx, ldx, ldy, 62 * k, 80 * k, 10.3 * k, P.ink, LINE.hair * k, true);
  fillRect(ctx, ldx, ldy, 62 * k, 8 * k, inkAlpha(P, 0.35));
  inkGroup(ctx, P, [{ r: [ax + aw / 2 - 6 * k, aTop + 30 * k, 12 * k, 12 * k], fill: P.metalShade }], lw);
  brushStroke(ctx, [[ax + aw / 2, aTop + 42 * k], [ax + aw / 2 + 1 * k, aTop + 64 * k]], 1.6 * k, { color: P.ink, taper: 0.05 });
  ctx.strokeStyle = P.ink; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(ax + aw / 2 + 1 * k, aTop + 69 * k, 5 * k, -Math.PI * 0.5, Math.PI * 0.9); ctx.stroke();
  // painted sign band
  const signY = h - groundH - 3 * k;
  fillRect(ctx, ax + 16 * k, signY, aw - 32 * k, 27 * k, P.wallLight);
  fillRect(ctx, ax + 16 * k, signY + 22 * k, aw - 32 * k, 5 * k, P.wall);
  inkLine(ctx, ax + 16 * k, signY, ax + aw - 16 * k, signY, lw, P.ink); inkLine(ctx, ax + 16 * k, signY + 27 * k, ax + aw - 16 * k, signY + 27 * k, lw, P.ink);
  label(ctx, 'ENTREPÔTS MARLOC', ax + aw / 2, signY + 11.5 * k, aw - 60 * k, 14 * k, { weight: 1.2, color: P.brickShade, tracking: 0.08, seed: 6 });
  // ground floor: roller door, entrance, barred window
  const rdx = ax + 28 * k, rdw = 128 * k, rdy = h - 2.95 * m;
  fillRect(ctx, rdx - 5 * k, rdy - 5 * k, rdw + 10 * k, h - rdy + 5 * k, P.ink);
  fillRect(ctx, rdx, rdy, rdw, h - rdy, P.ink);
  rollerDoor(ctx, P, rdx, rdy, rdw, h - rdy, 0, k * 1.1);
  fillRect(ctx, rdx - 5 * k, rdy - 13 * k, rdw + 10 * k, 9 * k, P.concreteLight); inkLine(ctx, rdx - 5 * k, rdy - 13 * k, rdx + rdw + 5 * k, rdy - 13 * k, lw, P.ink);
  const pdx = ax + 186 * k, pdy = h - 2.1 * m;
  inkGroup(ctx, P, [{ r: [pdx, pdy - 22 * k, 36 * k, 2.1 * m + 22 * k], fill: P.shutterShade }], lw);
  fillRect(ctx, pdx + 4 * k, pdy - 18 * k, 28 * k, 14 * k, P.glassShade); fillPoly(ctx, [[pdx + 32 * k, pdy - 14 * k], [pdx + 32 * k, pdy - 4 * k], [pdx + 16 * k, pdy - 4 * k]], P.glass);
  fillRect(ctx, pdx, pdy, 36 * k, 2.1 * m, P.shutter); fillRect(ctx, pdx + 24 * k, pdy, 12 * k, 2.1 * m, P.shutterShade);
  inkLine(ctx, pdx, pdy, pdx + 36 * k, pdy, lw, P.ink); fillRect(ctx, pdx + 5 * k, pdy + 36 * k, 4 * k, 8 * k, P.ink);
  ctx.strokeStyle = P.ink; ctx.lineWidth = lw; ctx.strokeRect(pdx + 7 * k, pdy + 8 * k, 14 * k, 22 * k); ctx.strokeRect(pdx + 7 * k, pdy + 50 * k, 14 * k, 22 * k);
  windows(ctx, P, [[ax + 240 * k, h - 2.3 * m, 36 * k, 40 * k]], { line: lw, bars: [4, 1], frame: P.ink, sill: P.concreteLight, glass: P.glassShade, light: P.glass, shade: shadeHex(P.glassShade, 0.4) });
  inkGroup(ctx, P, [{ p: [[pdx + 8 * k, pdy - 40 * k], [pdx + 28 * k, pdy - 40 * k], [pdx + 34 * k, pdy - 30 * k], [pdx + 2 * k, pdy - 30 * k]], fill: P.metalShade }], lw);
  fillRect(ctx, pdx + 10 * k, pdy - 30 * k, 16 * k, 4 * k, P.paintYellow);
  inkTubes(ctx, P, [{ paths: [[[ax + aw - 24 * k, aTop + 30 * k], [ax + aw - 24 * k, h - 4 * k]]], width: 5 * k, fill: P.metalShade, light: P.metal }], lw, 'butt');
  for (let y = aTop + 90 * k; y < h - 20 * k; y += 110 * k) fillRect(ctx, ax + aw - 29 * k, y, 10 * k, 3 * k, P.ink);
  fillRect(ctx, ax, h - 14 * k, aw, 14 * k, brick.shade); inkLine(ctx, ax, h - 14 * k, ax + aw, h - 14 * k, LINE.hair * k, P.ink);
  // ---- sheet-metal shed
  const bx = 400 * k, bw = 268 * k, eaves = h - 8.3 * m, ridge = eaves - 36 * k, clad = paintTones(mixHex(P.shutter, P.concreteLight, 0.45), 0.3, 0.3);
  const gable = [[bx, h], [bx, eaves], [bx + bw / 2, ridge], [bx + bw, eaves], [bx + bw, h]];
  inkGroup(ctx, P, [{ p: gable, fill: clad.base }], LINE.silhouette * k);
  clipped(ctx, (g) => tracePolygon(g, gable), () => {
    fillRect(ctx, bx + bw - 30 * k, ridge, 30 * k, h - ridge, clad.shade);
    fillRect(ctx, bx, ridge, 24 * k, h - ridge, clad.light);
    ribs(ctx, bx, ridge, bw, h - ridge, 10 * k, clad.shade, LINE.hair * k * 1.3, true);
    // flashing along the verges, its shadow below
    ctx.lineJoin = 'miter'; ctx.strokeStyle = inkAlpha(P, 0.3); ctx.lineWidth = 30 * k; ctx.beginPath(); ctx.moveTo(bx, eaves); ctx.lineTo(bx + bw / 2, ridge); ctx.lineTo(bx + bw, eaves); ctx.stroke();
    ctx.strokeStyle = P.metalLight; ctx.lineWidth = 16 * k; ctx.beginPath(); ctx.moveTo(bx, eaves); ctx.lineTo(bx + bw / 2, ridge); ctx.lineTo(bx + bw, eaves); ctx.stroke();
    fillRect(ctx, bx, h - 22 * k, bw, 22 * k, P.concrete); fillRect(ctx, bx, h - 22 * k, bw, 5 * k, P.concreteLight);
  });
  inkLine(ctx, bx, h - 22 * k, bx + bw, h - 22 * k, lw, P.ink);
  windows(ctx, P, [0, 1, 2, 3].map((i) => [bx + 44 * k + i * 48 * k, eaves + 22 * k, 38 * k, 24 * k]), { line: lw, bars: [2, 1], frame: P.metalLight, glass: P.glassShade, light: P.glass, shade: shadeHex(P.glassShade, 0.35) });
  label(ctx, 'QUAI 4', bx + bw / 2, eaves + 86 * k, bw - 70 * k, 40 * k, { weight: 1.3, color: P.paint, slant: 0, seed: 8, jitter: 0.8 });
  // sliding door, half open on the dark interior
  const sdx = bx + 44 * k, sdw = 156 * k, sdy = h - 4.4 * m, leaf = sdw / 2;
  fillRect(ctx, sdx - 4 * k, sdy - 4 * k, sdw + 8 * k, h - sdy + 4 * k, P.ink);
  fillRect(ctx, sdx + leaf, h - 30 * k, leaf, 30 * k, mixHex(P.pitAsphalt, P.ink, 0.55));
  fillRect(ctx, sdx + leaf + 14 * k, h - 64 * k, 40 * k, 40 * k, mixHex(P.wood, P.ink, 0.45)); fillRect(ctx, sdx + leaf + 18 * k, h - 100 * k, 34 * k, 34 * k, mixHex(P.woodLight, P.ink, 0.5));
  inkLine(ctx, sdx + leaf + 14 * k, h - 44 * k, sdx + leaf + 54 * k, h - 44 * k, LINE.hair * k, P.ink);
  const door = paintTones(mixHex(P.shutterShade, P.concrete, 0.25));
  for (const [x, wd] of [[sdx, leaf], [sdx + leaf * 0.34, leaf]]) {
    inkGroup(ctx, P, [{ r: [x, sdy, wd, h - sdy - 2 * k], fill: door.base }], lw);
    fillRect(ctx, x + wd * 0.7, sdy, wd * 0.3, h - sdy - 2 * k, door.shade);
    ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.3; ctx.strokeRect(x + 6 * k, sdy + 6 * k, wd - 12 * k, (h - sdy) * 0.45); ctx.strokeRect(x + 6 * k, sdy + (h - sdy) * 0.5, wd - 12 * k, (h - sdy) * 0.45);
    ctx.beginPath(); ctx.moveTo(x + 6 * k, sdy + (h - sdy) * 0.95); ctx.lineTo(x + wd - 6 * k, sdy + (h - sdy) * 0.5); ctx.stroke();
  }
  inkGroup(ctx, P, [{ r: [sdx - 60 * k + leaf * 0.34, sdy - 12 * k, sdw + 60 * k, 9 * k], fill: P.metal }], lw);
  fillRect(ctx, sdx - 60 * k + leaf * 0.34, sdy - 12 * k, sdw + 60 * k, 3 * k, P.metalLight);
  fillRect(ctx, sdx, sdy - 3 * k + lw, sdw, 8 * k, inkAlpha(P, 0.3));
  // lamp, pipe run, bollards
  inkTubes(ctx, P, [{ paths: [[[bx + bw - 34 * k, eaves + 60 * k], [bx + bw - 34 * k, h - 24 * k]], [[bx + bw - 34 * k, eaves + 60 * k], [bx + bw - 6 * k, eaves + 60 * k]]], width: 5 * k, fill: P.metalShade, light: P.metal }], lw, 'butt');
  inkGroup(ctx, P, [{ r: [bx + bw - 46 * k, h - 110 * k, 24 * k, 34 * k], fill: P.metalLight }], lw); fillRect(ctx, bx + bw - 32 * k, h - 110 * k, 10 * k, 34 * k, P.metal);
  inkTubes(ctx, P, [{ paths: [[[sdx + sdw * 0.6, sdy - 44 * k], [sdx + sdw * 0.6, sdy - 30 * k]]], width: 2.4 * k, fill: P.metalShade }], lw, 'butt');
  inkGroup(ctx, P, [{ p: [[sdx + sdw * 0.6 - 12 * k, sdy - 20 * k], [sdx + sdw * 0.6 - 6 * k, sdy - 30 * k], [sdx + sdw * 0.6 + 6 * k, sdy - 30 * k], [sdx + sdw * 0.6 + 12 * k, sdy - 20 * k]], fill: P.metalShade }], lw);
  fillRect(ctx, sdx + sdw * 0.6 - 7 * k, sdy - 20 * k, 14 * k, 4 * k, P.paintYellow);
  for (const x of [bx + 22 * k, bx + bw - 70 * k]) {
    inkGroup(ctx, P, [{ trace: (g) => roundRectPath(g, x - 6 * k, h - 40 * k, 12 * k, 40 * k, 5 * k), fill: P.paintYellow }], lw, 1, 'round');
    fillRect(ctx, x - 6 * k, h - 30 * k, 12 * k, 7 * k, P.ink); fillRect(ctx, x - 6 * k, h - 15 * k, 12 * k, 7 * k, P.ink);
  }
  // ---- narrow town house (spans the tile edge)
  for (const dx of [0, w]) {
    const cx0 = dx - 100 * k, cw = 200 * k, cTop = h - 13.5 * m, wall = { light: P.wallLight, base: P.wall, shade: P.wallShade };
    const mansard = [[cx0 + 3 * k, cTop], [cx0 + 16 * k, cTop - 34 * k], [cx0 + cw - 16 * k, cTop - 34 * k], [cx0 + cw - 3 * k, cTop]];
    // chimney stack
    inkGroup(ctx, P, [{ r: [cx0 + cw - 62 * k, cTop - 46 * k, 34 * k, 30 * k], fill: P.brick }, { r: [cx0 + cw - 58 * k, cTop - 54 * k, 8 * k, 9 * k], fill: P.roof }, { r: [cx0 + cw - 42 * k, cTop - 54 * k, 8 * k, 9 * k], fill: P.roof }], LINE.form * k);
    fillRect(ctx, cx0 + cw - 40 * k, cTop - 46 * k, 12 * k, 30 * k, P.brickShade); fillRect(ctx, cx0 + cw - 64 * k, cTop - 46 * k, 38 * k, 5 * k, P.brickLight);
    inkGroup(ctx, P, [{ p: mansard, fill: P.metal }, { r: [cx0, cTop, cw, h - cTop], fill: wall.light }], LINE.silhouette * k);
    clipped(ctx, (g) => tracePolygon(g, mansard), () => {
      fillRect(ctx, cx0, cTop - 34 * k, 70 * k, 34 * k, P.metalLight); fillRect(ctx, cx0 + cw - 50 * k, cTop - 34 * k, 50 * k, 34 * k, P.metalShade);
      ribs(ctx, cx0, cTop - 34 * k, cw, 34 * k, 18 * k, P.inkSoft, LINE.hair * k, true);
    });
    // dormers
    for (const f of [0.28, 0.72]) {
      const x = cx0 + cw * f;
      inkGroup(ctx, P, [{ p: [[x - 16 * k, cTop - 4 * k], [x - 16 * k, cTop - 24 * k], [x, cTop - 32 * k], [x + 16 * k, cTop - 24 * k], [x + 16 * k, cTop - 4 * k]], fill: wall.light }], lw);
      windows(ctx, P, [[x - 9 * k, cTop - 22 * k, 18 * k, 16 * k]], { line: LINE.hair * k * 1.3, bars: [2, 1], glass: P.glassShade, light: P.glass, shade: shadeHex(P.glassShade, 0.4) });
    }
    // cornice, string courses, shaded return on the right
    fillRect(ctx, cx0 + cw - 22 * k, cTop, 22 * k, h - cTop, wall.base);
    fillRect(ctx, cx0, cTop, cw, 10 * k, P.paint); fillRect(ctx, cx0, cTop + 10 * k, cw, 8 * k, inkAlpha(P, 0.3));
    inkLine(ctx, cx0, cTop + 10 * k, cx0 + cw, cTop + 10 * k, LINE.form * k, P.ink); inkLine(ctx, cx0 - 3 * k, cTop, cx0 + cw + 3 * k, cTop, LINE.form * k, P.ink);
    const shop = h - 3.5 * m, cellsC = [];
    for (let f = 0; f < 4; f++) {
      const y = cTop + 34 * k + f * (shop - cTop - 26 * k) / 4;
      for (const fx of [0.27, 0.73]) cellsC.push([cx0 + cw * fx - 17 * k, y, 34 * k, (f === 3 ? 72 : 60) * k]);
      if (f) inkLine(ctx, cx0, y - 14 * k, cx0 + cw, y - 14 * k, LINE.hair * k, P.wallShade);
    }
    for (const c of cellsC) shutterPair(ctx, P, c, P.shutter, lw);
    windows(ctx, P, cellsC, { line: lw, bars: [2, 3], frame: P.paint, sill: P.concreteLight, blinds: 0.3, rnd, blindColor: P.paint });
    // first-floor balcony with its iron rail
    const by = cellsC[6][1] + 72 * k;
    inkGroup(ctx, P, [{ r: [cx0 + 14 * k, by, cw - 28 * k, 7 * k], fill: P.concreteLight }], lw);
    fillRect(ctx, cx0 + 14 * k, by + 7 * k + lw, cw - 28 * k, 6 * k, inkAlpha(P, 0.3));
    ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.4; ctx.beginPath();
    for (let x = cx0 + 18 * k; x <= cx0 + cw - 18 * k; x += 7.5 * k) { ctx.moveTo(x, by); ctx.lineTo(x, by - 30 * k); }
    ctx.stroke();
    inkLine(ctx, cx0 + 14 * k, by - 30 * k, cx0 + cw - 14 * k, by - 30 * k, LINE.form * k, P.ink); inkLine(ctx, cx0 + 14 * k, by - 8 * k, cx0 + cw - 14 * k, by - 8 * k, LINE.hair * k * 1.3, P.ink);
    // café front: sign band, awning, glazed front and door
    const dark = P.shutterShade;
    fillRect(ctx, cx0, shop, cw, h - shop, dark);
    inkLine(ctx, cx0, shop, cx0 + cw, shop, LINE.form * k, P.ink);
    label(ctx, 'CAFÉ DU PORT', cx0 + cw / 2, shop + 13 * k, cw - 30 * k, 12 * k, { weight: 1.15, color: P.paintYellow, tracking: 0.06, seed: 12 });
    const glassY = shop + 60 * k;
    windows(ctx, P, [[cx0 + 14 * k, glassY, 74 * k, h - glassY - 22 * k], [cx0 + 138 * k, glassY, 48 * k, h - glassY - 22 * k]], { line: lw, bars: [2, 1], frame: P.woodLight, glass: P.glassShade, light: P.glass, shade: shadeHex(P.glassShade, 0.4) });
    inkGroup(ctx, P, [{ r: [cx0 + 98 * k, h - 2.1 * m, 32 * k, 2.1 * m], fill: P.wood }], lw);
    fillRect(ctx, cx0 + 102 * k, h - 2.1 * m + 6 * k, 24 * k, 40 * k, P.glassShade); fillPoly(ctx, [[cx0 + 126 * k, h - 2.1 * m + 22 * k], [cx0 + 126 * k, h - 2.1 * m + 46 * k], [cx0 + 110 * k, h - 2.1 * m + 46 * k]], P.glass);
    fillRect(ctx, cx0 + 121 * k, h - 40 * k, 4 * k, 9 * k, P.paintYellow);
    const awn = [[cx0 + 6 * k, shop + 26 * k], [cx0 + cw - 6 * k, shop + 26 * k], [cx0 + cw + 2 * k, shop + 54 * k], [cx0 - 2 * k, shop + 54 * k]];
    fillPoly(ctx, [[cx0 + 4 * k, shop + 58 * k], [cx0 + cw - 4 * k, shop + 58 * k], [cx0 + cw - 10 * k, shop + 76 * k], [cx0 + 10 * k, shop + 76 * k]], inkAlpha(P, 0.4));
    inkGroup(ctx, P, [{ p: awn, fill: P.paint }, { r: [cx0 - 2 * k, shop + 54 * k, cw + 4 * k, 9 * k], fill: P.paint }], LINE.form * k);
    for (let i = 0; i < 9; i += 2) {
      const t0 = i / 9, t1 = (i + 1) / 9;
      fillPoly(ctx, [lerp2(awn[0], awn[1], t0), lerp2(awn[0], awn[1], t1), lerp2(awn[3], awn[2], t1), lerp2(awn[3], awn[2], t0)], P.banners[0]);
      fillRect(ctx, awn[3][0] + (cw + 4 * k) * t0, shop + 54 * k, (cw + 4 * k) / 9, 9 * k, shadeHex(P.banners[0], 0.25));
    }
    inkLine(ctx, cx0 - 2 * k, shop + 54 * k, cx0 + cw + 2 * k, shop + 54 * k, lw, P.ink);
    fillRect(ctx, cx0, h - 12 * k, cw, 12 * k, P.concreteShade); inkLine(ctx, cx0, h - 12 * k, cx0 + cw, h - 12 * k, LINE.hair * k, P.ink);
  }
  fillRect(ctx, 0, h - 4 * k, w, 4 * k, inkAlpha(P, 0.4));
  ctx.restore();
}

// ---- free-standing buildings (props) ------------------------------------------------------------

function archPath(g, x, y, w, h) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); }

/** Tiled roof plane: three values (lit left part, base, shaded right part) and a few tile courses. */
function tiledRoof(ctx, P, poly, k, o = {}) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const tones = o.tones || { light: lightHex(P.roof, 0.28), base: P.roof, shade: P.roofShade };
  fillPoly(ctx, poly, tones.base);
  clipped(ctx, (g) => tracePolygon(g, poly), () => {
    fillPoly(ctx, [[x0, y1], [x0, y0], [x0 + (x1 - x0) * 0.42, y0], [x0 + (x1 - x0) * 0.3, y1]], tones.light);
    fillPoly(ctx, [[x1, y1], [x1, y0], [x1 - (x1 - x0) * (o.shade ?? 0.2), y0], [x1 - (x1 - x0) * ((o.shade ?? 0.2) + 0.1), y1]], tones.shade);
    fillRect(ctx, x0, y1 - 4 * k, x1 - x0, 4 * k, tones.shade);
    ribs(ctx, x0, y0, x1 - x0, y1 - y0, o.course || 8 * k, tones.shade, LINE.hair * k, false);
    for (let i = 0; i < (o.marks ?? 14); i++) {
      const x = x0 + (x1 - x0) * (0.06 + 0.88 * ((i * 0.618) % 1)), y = y0 + (y1 - y0) * (0.15 + 0.7 * ((i * 0.377) % 1));
      brushCurve(ctx, [[x - 5 * k, y], [x - 2.5 * k, y + 2.4 * k], [x, y], [x + 2.5 * k, y + 2.4 * k], [x + 5 * k, y]], LINE.hair * k * 1.3, { color: P.ink, taper: 0.3 });
    }
  });
}

/** Mediterranean house. 0: two-storey block with a pergola wing; 1: house with a square tower and an arcade. */
function villa(ctx, w, h, P, rnd, variant) {
  const k = w / 448, m = 32 * k, ground = h - 6 * k, lw = LINE.detail * k;
  const wall = { light: P.wallLight, base: P.wall, shade: P.wallShade };
  groundShadow(ctx, w / 2 + 12 * k, ground, w * 0.45, 6 * k);
  const openings = (cells, shut = true) => { if (shut) for (const c of cells) shutterPair(ctx, P, c, P.shutter, lw); windows(ctx, P, cells, { line: lw, bars: [2, 3], frame: P.paint, sill: P.concreteLight, blinds: 0.25, rnd }); };
  const plinth = (x0, x1) => { fillRect(ctx, x0, ground - 11 * k, x1 - x0, 11 * k, wall.shade); inkLine(ctx, x0, ground - 11 * k, x1, ground - 11 * k, LINE.hair * k, P.ink); };
  if (variant % 2 === 0) {
    const x0 = 58 * k, x1 = 296 * k, eaves = ground - 6 * m, ridge = eaves - 40 * k, wx1 = 420 * k, wingTop = ground - 3.3 * m;
    // wing with a pergola on its terrace
    const posts = [x1 + 14 * k, x1 + 62 * k, wx1 - 10 * k];
    inkTubes(ctx, P, [{ paths: posts.map((x) => [[x, wingTop], [x, wingTop - 66 * k]]), width: 4.4 * k, fill: P.wood, light: P.woodLight }, { paths: [[[x1, wingTop - 66 * k], [wx1 + 6 * k, wingTop - 66 * k]]], width: 6 * k, fill: P.wood, light: P.woodLight, shade: P.woodShade }], lw, 'butt');
    for (let x = x1 + 8 * k; x < wx1 + 4 * k; x += 15 * k) inkGroup(ctx, P, [{ r: [x, wingTop - 75 * k, 5 * k, 8 * k], fill: P.woodLight }], LINE.hair * k * 1.3);
    inkGroup(ctx, P, [{ r: [x1 - 2 * k, wingTop, wx1 - x1 + 2 * k, ground - wingTop], fill: wall.light }, { r: [x1 - 2 * k, wingTop - 9 * k, wx1 - x1 + 6 * k, 10 * k], fill: wall.base }], LINE.silhouette * k);
    fillRect(ctx, x1, wingTop - 9 * k, wx1 - x1 + 4 * k, 3 * k, wall.light);
    fillRect(ctx, wx1 - 22 * k, wingTop + 1 * k, 22 * k, ground - wingTop, wall.base);
    fillPoly(ctx, [[x1, wingTop + 1 * k], [x1 + 30 * k, wingTop + 1 * k], [x1 + 8 * k, ground], [x1, ground]], inkAlpha(P, 0.26));
    const arch = (g) => archPath(g, x1 + 34 * k, ground - 76 * k, 56 * k, 76 * k);
    contour(ctx, arch, P.ink, lw, 0, 'round');
    fillTrace(ctx, arch, mixHex(P.ink, P.wallShade, 0.3));
    clipped(ctx, arch, () => { fillRect(ctx, x1 + 34 * k, ground - 14 * k, 56 * k, 14 * k, mixHex(P.wallShade, P.ink, 0.35)); fillRect(ctx, x1 + 58 * k, ground - 44 * k, 22 * k, 30 * k, mixHex(P.wood, P.ink, 0.45)); fillEllipse(ctx, x1 + 46 * k, ground - 18 * k, 7 * k, 9 * k, mixHex(P.roof, P.ink, 0.35)); });
    plinth(x1, wx1);
    // vine on the pergola
    const vine = [[x1 + 30 * k, wingTop - 70 * k, 20], [x1 + 60 * k, wingTop - 76 * k, 17], [x1 + 92 * k, wingTop - 70 * k, 19], [wx1 - 8 * k, wingTop - 58 * k, 16], [wx1 - 4 * k, wingTop - 34 * k, 11]];
    const clumps = vine.map(([x, y, r]) => blobPoints(x, y, r * k, r * 0.7 * k, 5, 0.2, rnd));
    contour(ctx, (g) => { for (const c of clumps) closedCurve(g, c); }, P.ink, LINE.form * k, 1, 'round');
    for (const c of clumps) fillTrace(ctx, (g) => closedCurve(g, c), P.leafShade);
    for (const [x, y, r] of vine) fillTrace(ctx, (g) => closedCurve(g, blobPoints(x - r * 0.16 * k, y - r * 0.16 * k, r * 0.76 * k, r * 0.5 * k, 5, 0.18, rnd)), P.leaf);
    for (const [x, y, r] of vine) fillTrace(ctx, (g) => closedCurve(g, blobPoints(x - r * 0.3 * k, y - r * 0.28 * k, r * 0.42 * k, r * 0.26 * k, 4, 0.2, rnd)), P.leafLight);
    for (const [x, y, r] of vine) for (let i = 0; i < 4; i++) fillEllipse(ctx, x + (rnd() - 0.5) * r * 1.5 * k, y + (rnd() - 0.3) * r * 0.9 * k, 2.3 * k, 2.3 * k, P.crowd[6]);
    // main block: hipped tiled roof, chimney
    const roofPoly = [[x0 - 16 * k, eaves + 2 * k], [x0 + 36 * k, ridge], [x1 - 36 * k, ridge], [x1 + 16 * k, eaves + 2 * k]];
    inkGroup(ctx, P, [{ r: [x1 - 96 * k, ridge - 18 * k, 20 * k, 34 * k], fill: wall.base }, { r: [x1 - 99 * k, ridge - 22 * k, 26 * k, 6 * k], fill: P.roof }, { p: roofPoly, fill: P.roof }, { r: [x0, eaves, x1 - x0, ground - eaves], fill: wall.light }], LINE.silhouette * k);
    fillRect(ctx, x1 - 96 * k, ridge - 16 * k, 8 * k, 30 * k, wall.light);
    tiledRoof(ctx, P, roofPoly, k);
    inkLine(ctx, x0 - 16 * k, eaves + 2 * k, x1 + 16 * k, eaves + 2 * k, LINE.form * k, P.ink);
    fillRect(ctx, x0, eaves + 2 * k + LINE.form * k * 0.5, x1 - x0, 10 * k, inkAlpha(P, 0.32));
    fillRect(ctx, x1 - 26 * k, eaves + 12 * k, 26 * k, ground - eaves - 12 * k, wall.base);
    fillRect(ctx, x0, ground - 3.1 * m, x1 - x0, 4 * k, wall.base); inkLine(ctx, x0, ground - 3.1 * m + 4 * k, x1, ground - 3.1 * m + 4 * k, LINE.hair * k, P.wallShade);
    const span = x1 - x0, up = eaves + 26 * k;
    openings([0.18, 0.5, 0.82].map((f) => [x0 + span * f - 13 * k, up, 26 * k, f === 0.5 ? 52 * k : 42 * k]));
    openings([0.18, 0.82].map((f) => [x0 + span * f - 14 * k, ground - 70 * k, 28 * k, 46 * k]));
    // balcony over the arched door
    const dx = x0 + span * 0.5;
    inkGroup(ctx, P, [{ r: [dx - 34 * k, up + 53 * k, 68 * k, 6 * k], fill: P.concreteLight }], lw);
    ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.3; ctx.beginPath();
    for (let x = dx - 31 * k; x <= dx + 31 * k; x += 6.2 * k) { ctx.moveTo(x, up + 53 * k); ctx.lineTo(x, up + 33 * k); }
    ctx.stroke(); inkLine(ctx, dx - 34 * k, up + 33 * k, dx + 34 * k, up + 33 * k, LINE.form * k * 0.8, P.ink);
    fillRect(ctx, dx - 34 * k, up + 59 * k + lw, 68 * k, 6 * k, inkAlpha(P, 0.3));
    const door = (g) => archPath(g, dx - 17 * k, ground - 72 * k, 34 * k, 72 * k);
    contour(ctx, door, P.ink, lw, 0, 'round');
    fillTrace(ctx, door, P.wood);
    clipped(ctx, door, () => { fillRect(ctx, dx, ground - 72 * k, 17 * k, 72 * k, P.woodShade); fillRect(ctx, dx - 17 * k, ground - 72 * k, 34 * k, 18 * k, P.glassShade); fillPoly(ctx, [[dx + 17 * k, ground - 64 * k], [dx + 17 * k, ground - 54 * k], [dx, ground - 54 * k]], P.glass); inkLine(ctx, dx - 17 * k, ground - 54 * k, dx + 17 * k, ground - 54 * k, lw, P.ink); inkLine(ctx, dx, ground - 54 * k, dx, ground, LINE.hair * k, P.ink); });
    plinth(x0, x1);
    inkGroup(ctx, P, [{ r: [dx - 26 * k, ground - 5 * k, 52 * k, 5 * k], fill: P.concreteLight }], lw);
    return;
  }
  // ---- tower villa
  const tx0 = 66 * k, tx1 = 160 * k, tEaves = ground - 6.7 * m, mx1 = 404 * k, eaves = ground - 5.5 * m, ridge = eaves - 36 * k;
  const roofPoly = [[tx1 - 4 * k, ridge], [mx1 - 18 * k, ridge], [mx1 + 16 * k, eaves + 2 * k], [tx1 - 4 * k, eaves + 2 * k]];
  inkGroup(ctx, P, [{ r: [mx1 - 78 * k, ridge - 20 * k, 20 * k, 30 * k], fill: wall.base }, { p: roofPoly, fill: P.roof }, { r: [tx1 - 2 * k, eaves, mx1 - tx1 + 2 * k, ground - eaves], fill: wall.light }], LINE.silhouette * k);
  fillRect(ctx, mx1 - 78 * k, ridge - 20 * k, 8 * k, 26 * k, wall.light); fillRect(ctx, mx1 - 81 * k, ridge - 24 * k, 26 * k, 6 * k, P.roofShade);
  tiledRoof(ctx, P, roofPoly, k, { shade: 0.12 });
  inkLine(ctx, tx1, eaves + 2 * k, mx1 + 16 * k, eaves + 2 * k, LINE.form * k, P.ink);
  fillRect(ctx, tx1, eaves + 2 * k + LINE.form * k * 0.5, mx1 - tx1, 10 * k, inkAlpha(P, 0.32));
  fillPoly(ctx, [[tx1, eaves + 12 * k], [tx1 + 34 * k, eaves + 12 * k], [tx1 + 12 * k, ground], [tx1, ground]], inkAlpha(P, 0.26));
  fillRect(ctx, mx1 - 24 * k, eaves + 12 * k, 24 * k, ground - eaves - 12 * k, wall.base);
  // arcade on the ground floor, shuttered windows above each arch
  const archW = 54 * k, archH = 78 * k, upper = [];
  for (let i = 0; i < 3; i++) {
    const ax = tx1 + 26 * k + i * 72 * k, arch = (g) => archPath(g, ax, ground - archH, archW, archH);
    contour(ctx, arch, P.ink, lw, 0, 'round');
    fillTrace(ctx, arch, mixHex(P.ink, P.wallShade, 0.32));
    clipped(ctx, arch, () => {
      fillRect(ctx, ax, ground - 12 * k, archW, 12 * k, mixHex(P.wallShade, P.ink, 0.3));
      fillRect(ctx, ax + archW * 0.3, ground - 58 * k, archW * 0.4, 46 * k, mixHex(i === 1 ? P.wood : P.glass, P.ink, 0.45));
      fillPoly(ctx, [[ax, ground], [ax, ground - archH], [ax + 13 * k, ground - archH], [ax + 6 * k, ground]], P.ink);
    });
    upper.push([ax + archW / 2 - 13 * k, eaves + 24 * k, 26 * k, 42 * k]);
  }
  openings(upper);
  fillRect(ctx, tx1, ground - 3 * m, mx1 - tx1, 4 * k, wall.base);
  plinth(tx1, mx1);
  // tower with a pyramid roof and a belvedere
  const cap = [[tx0 - 12 * k, tEaves + 2 * k], [(tx0 + tx1) / 2, tEaves - 30 * k], [tx1 + 12 * k, tEaves + 2 * k]];
  inkGroup(ctx, P, [{ p: cap, fill: P.roof }, { r: [tx0, tEaves, tx1 - tx0, ground - tEaves], fill: wall.light }], LINE.silhouette * k);
  tiledRoof(ctx, P, cap, k, { shade: 0.34, marks: 5 });
  inkLine(ctx, tx0 - 12 * k, tEaves + 2 * k, tx1 + 12 * k, tEaves + 2 * k, LINE.form * k, P.ink);
  fillRect(ctx, tx0, tEaves + 2 * k + LINE.form * k * 0.5, tx1 - tx0, 9 * k, inkAlpha(P, 0.32));
  fillRect(ctx, tx1 - 22 * k, tEaves + 11 * k, 22 * k, ground - tEaves - 11 * k, wall.base);
  const tc = (tx0 + tx1) / 2;
  for (const s of [-1, 1]) {
    const a = (g) => archPath(g, tc + s * 19 * k - 12 * k, tEaves + 22 * k, 24 * k, 38 * k);
    contour(ctx, a, P.ink, lw, 0, 'round'); fillTrace(ctx, a, mixHex(P.ink, P.wallShade, 0.3));
  }
  fillRect(ctx, tx0, tEaves + 64 * k, tx1 - tx0, 4 * k, wall.base); inkLine(ctx, tx0, tEaves + 68 * k, tx1, tEaves + 68 * k, LINE.hair * k, P.wallShade);
  openings([[tc - 13 * k, tEaves + 84 * k, 26 * k, 42 * k]]);
  const door = (g) => archPath(g, tc - 17 * k, ground - 70 * k, 34 * k, 70 * k);
  contour(ctx, door, P.ink, lw, 0, 'round');
  fillTrace(ctx, door, P.wood);
  clipped(ctx, door, () => { fillRect(ctx, tc, ground - 70 * k, 17 * k, 70 * k, P.woodShade); ribs(ctx, tc - 17 * k, ground - 70 * k, 34 * k, 70 * k, 8.5 * k, P.ink, LINE.hair * k, true); });
  fillEllipse(ctx, tc + 4 * k, ground - 34 * k, 1.8 * k, 1.8 * k, P.paintYellow);
  plinth(tx0, tx1);
  inkGroup(ctx, P, [{ r: [tc - 26 * k, ground - 5 * k, 52 * k, 5 * k], fill: P.concreteLight }], lw);
}

/** Alpine chalet. 0: gable front with a full-width balcony; 1: long side under a broad roof. */
function chalet(ctx, w, h, P, rnd, variant) {
  const k = w / 384, ground = h - 6 * k, lw = LINE.detail * k;
  const wood = { light: P.woodLight, base: P.wood, shade: P.woodShade }, roof = { light: lightHex(P.roof, 0.25), base: P.roof, shade: P.roofShade };
  groundShadow(ctx, w / 2 + 10 * k, ground, w * 0.46, 6 * k);
  const openings = (cells) => { for (const c of cells) shutterPair(ctx, P, c, P.pine, lw); windows(ctx, P, cells, { line: lw, bars: [2, 2], frame: P.paint, sill: P.woodLight }); };
  const balustrade = (x0, x1, y, hgt) => {
    inkGroup(ctx, P, [{ r: [x0, y - hgt, x1 - x0, hgt + 7 * k], fill: wood.light }], LINE.form * k);
    fillRect(ctx, x0, y, x1 - x0, 7 * k, wood.shade);
    ribs(ctx, x0, y - hgt + 5 * k, x1 - x0, hgt - 5 * k, 11 * k, wood.shade, LINE.hair * k * 1.4, true);
    for (let x = x0 + 5.5 * k; x < x1; x += 11 * k) fillPoly(ctx, [[x, y - hgt * 0.62], [x + 2.6 * k, y - hgt * 0.48], [x, y - hgt * 0.34], [x - 2.6 * k, y - hgt * 0.48]], P.ink);
    inkLine(ctx, x0, y, x1, y, lw, P.ink); inkLine(ctx, x0, y - hgt + 5 * k, x1, y - hgt + 5 * k, LINE.hair * k, P.ink);
    // geraniums along the rail
    fillRect(ctx, x0 + 6 * k, y - hgt - 6 * k, x1 - x0 - 12 * k, 7 * k, P.leafShade);
    for (let x = x0 + 9 * k; x < x1 - 8 * k; x += 6.5 * k) fillEllipse(ctx, x + (rnd() - 0.5) * 3 * k, y - hgt - 5 * k + (rnd() - 0.5) * 4 * k, 2.6 * k, 2.6 * k, rnd() < 0.75 ? P.banners[0] : P.leafLight);
    fillRect(ctx, x0, y + 7 * k + lw, x1 - x0, 11 * k, inkAlpha(P, 0.32));
  };
  const masonry = (x0, x1, y) => {
    fillRect(ctx, x0, y, x1 - x0, ground - y, P.paint);
    fillRect(ctx, x1 - 24 * k, y, 24 * k, ground - y, shadeHex(P.paint, 0.16));
    fillRect(ctx, x0, ground - 15 * k, x1 - x0, 15 * k, P.rock);
    for (let x = x0 + 8 * k; x < x1 - 10 * k; x += 23 * k) { fillTrace(ctx, (g) => roundRectPath(g, x, ground - 13 * k, 17 * k, 10 * k, 3 * k), P.rockLight); }
    inkLine(ctx, x0, ground - 15 * k, x1, ground - 15 * k, LINE.hair * k, P.ink);
  };
  if (variant % 2 === 0) {
    const x0 = 48 * k, x1 = 336 * k, apex = [192 * k, 16 * k], floorY = ground - 74 * k;
    const slope = 112 / 184, roofY = (x) => apex[1] + Math.abs(x - apex[0]) * slope;
    const gable = [[x0, ground], [x0, roofY(x0) + 12 * k], [apex[0], apex[1] + 14 * k], [x1, roofY(x1) + 12 * k], [x1, ground]];
    const roofBand = [[6 * k, roofY(6 * k)], apex, [378 * k, roofY(378 * k)], [372 * k, roofY(372 * k) + 17 * k], [apex[0], apex[1] + 17 * k], [12 * k, roofY(12 * k) + 17 * k]];
    // stone chimney behind the roof
    inkGroup(ctx, P, [{ r: [262 * k, 34 * k, 22 * k, 40 * k], fill: P.rock }, { r: [258 * k, 30 * k, 30 * k, 6 * k], fill: P.rockShade }], LINE.form * k);
    fillRect(ctx, 262 * k, 36 * k, 8 * k, 36 * k, P.rockLight);
    inkGroup(ctx, P, [{ p: gable, fill: wood.base }, { p: roofBand, fill: roof.base }], LINE.silhouette * k);
    clipped(ctx, (g) => tracePolygon(g, gable), () => {
      ribs(ctx, x0, 0, x1 - x0, floorY, 9 * k, wood.shade, LINE.hair * k * 1.2, false);
      fillRect(ctx, x0, 0, 40 * k, floorY, 'rgba(255,248,230,0.16)');
      fillRect(ctx, x1 - 30 * k, 0, 30 * k, floorY, wood.shade);
      // shadow of the roof overhang along both slopes
      ctx.strokeStyle = inkAlpha(P, 0.34); ctx.lineWidth = 30 * k; ctx.lineJoin = 'miter';
      ctx.beginPath(); ctx.moveTo(6 * k, roofY(6 * k) + 17 * k); ctx.lineTo(apex[0], apex[1] + 17 * k); ctx.lineTo(378 * k, roofY(378 * k) + 17 * k); ctx.stroke();
      masonry(x0, x1, floorY);
    });
    clipped(ctx, (g) => tracePolygon(g, roofBand), () => {
      fillPoly(ctx, [[apex[0], 0], [w, 0], [w, h], [apex[0], h]], roof.shade);
      ctx.strokeStyle = roof.light; ctx.lineWidth = 7 * k; ctx.beginPath(); ctx.moveTo(6 * k, roofY(6 * k)); ctx.lineTo(apex[0], apex[1]); ctx.stroke();
      ctx.strokeStyle = wood.light; ctx.lineWidth = 8 * k; ctx.beginPath(); ctx.moveTo(12 * k, roofY(12 * k) + 17 * k); ctx.lineTo(apex[0], apex[1] + 17 * k); ctx.lineTo(372 * k, roofY(372 * k) + 17 * k); ctx.stroke();
    });
    ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.3; ctx.lineJoin = 'miter'; ctx.beginPath(); ctx.moveTo(10 * k, roofY(10 * k) + 12 * k); ctx.lineTo(apex[0], apex[1] + 12 * k); ctx.lineTo(374 * k, roofY(374 * k) + 12 * k); ctx.stroke();
    // attic window, first floor behind the balcony, ground floor
    openings([[apex[0] - 12 * k, 62 * k, 24 * k, 26 * k]]);
    openings([[x0 + 44 * k, floorY - 62 * k, 28 * k, 56 * k], [apex[0] - 14 * k, floorY - 62 * k, 28 * k, 56 * k], [x1 - 72 * k, floorY - 62 * k, 28 * k, 56 * k]]);
    openings([[x0 + 40 * k, floorY + 22 * k, 30 * k, 30 * k], [x1 - 70 * k, floorY + 22 * k, 30 * k, 30 * k]]);
    inkGroup(ctx, P, [{ r: [apex[0] - 16 * k, ground - 64 * k, 32 * k, 64 * k], fill: wood.base }], lw);
    fillRect(ctx, apex[0], ground - 64 * k, 16 * k, 64 * k, wood.shade); ribs(ctx, apex[0] - 16 * k, ground - 64 * k, 32 * k, 64 * k, 8 * k, P.ink, LINE.hair * k, true);
    fillEllipse(ctx, apex[0] + 9 * k, ground - 30 * k, 1.8 * k, 1.8 * k, P.paintYellow);
    // brackets under the eaves, balcony
    inkTubes(ctx, P, [{ paths: [[[x0, roofY(x0) + 48 * k], [x0 - 26 * k, roofY(x0 - 26 * k) + 16 * k]], [[x1, roofY(x1) + 48 * k], [x1 + 26 * k, roofY(x1 + 26 * k) + 16 * k]]], width: 4 * k, fill: wood.shade }], lw, 'butt');
    balustrade(x0 - 12 * k, x1 + 12 * k, floorY, 30 * k);
    // firewood stacked against the wall
    inkGroup(ctx, P, [{ r: [x1 + 6 * k, ground - 28 * k, 32 * k, 28 * k], fill: wood.shade }], lw);
    for (let i = 0; i < 12; i++) fillEllipse(ctx, x1 + 11 * k + (i % 4) * 7.4 * k, ground - 5 * k - Math.floor(i / 4) * 8.4 * k, 3.3 * k, 3.3 * k, i % 3 ? wood.light : wood.base);
    return;
  }
  // ---- long side: the roof plane faces the viewer
  const x0 = 34 * k, x1 = 350 * k, eaves = 112 * k, ridge = 34 * k, floorY = ground - 72 * k;
  const plane = [[12 * k, eaves], [34 * k, ridge], [350 * k, ridge], [372 * k, eaves]];
  inkGroup(ctx, P, [{ r: [282 * k, 12 * k, 24 * k, 40 * k], fill: P.rock }, { r: [278 * k, 9 * k, 32 * k, 6 * k], fill: P.rockShade }, { p: plane, fill: roof.base }, { r: [x0, eaves, x1 - x0, ground - eaves], fill: wood.base }], LINE.silhouette * k);
  fillRect(ctx, 282 * k, 15 * k, 9 * k, 36 * k, P.rockLight);
  tiledRoof(ctx, P, plane, k, { tones: roof, course: 11 * k, shade: 0.1, marks: 10 });
  fillRect(ctx, 12 * k, eaves - 6 * k, 360 * k, 6 * k, wood.light); inkLine(ctx, 12 * k, eaves - 6 * k, 372 * k, eaves - 6 * k, LINE.hair * k, P.ink);
  // dormer
  const dx = 150 * k;
  inkGroup(ctx, P, [{ p: [[dx - 26 * k, eaves - 10 * k], [dx - 26 * k, 70 * k], [dx, 50 * k], [dx + 26 * k, 70 * k], [dx + 26 * k, eaves - 10 * k]], fill: wood.base }, { p: [[dx - 34 * k, 74 * k], [dx, 44 * k], [dx + 34 * k, 74 * k], [dx + 30 * k, 80 * k], [dx, 54 * k], [dx - 30 * k, 80 * k]], fill: roof.shade }], LINE.form * k);
  openings([[dx - 10 * k, 72 * k, 20 * k, 24 * k]]);
  inkLine(ctx, 12 * k, eaves, 372 * k, eaves, LINE.form * k, P.ink);
  ribs(ctx, x0, eaves, x1 - x0, floorY - eaves, 9 * k, wood.shade, LINE.hair * k * 1.2, false);
  fillRect(ctx, x0, eaves + LINE.form * k * 0.5, x1 - x0, 13 * k, inkAlpha(P, 0.34));
  fillRect(ctx, x1 - 26 * k, eaves, 26 * k, floorY - eaves, wood.shade);
  masonry(x0, x1, floorY);
  openings([[x0 + 40 * k, eaves + 22 * k, 26 * k, 40 * k], [x0 + 140 * k, eaves + 22 * k, 26 * k, 40 * k], [x1 - 70 * k, eaves + 22 * k, 26 * k, 40 * k]]);
  openings([[x0 + 44 * k, floorY + 22 * k, 30 * k, 30 * k], [x1 - 150 * k, floorY + 22 * k, 30 * k, 30 * k]]);
  inkGroup(ctx, P, [{ r: [x1 - 84 * k, ground - 64 * k, 32 * k, 64 * k], fill: wood.base }], lw);
  fillRect(ctx, x1 - 68 * k, ground - 64 * k, 16 * k, 64 * k, wood.shade); ribs(ctx, x1 - 84 * k, ground - 64 * k, 32 * k, 64 * k, 8 * k, P.ink, LINE.hair * k, true);
  balustrade(x0 - 10 * k, x1 + 10 * k, floorY, 28 * k);
  // bench
  inkGroup(ctx, P, [{ r: [x0 + 104 * k, ground - 16 * k, 56 * k, 5 * k], fill: wood.light }, { r: [x0 + 108 * k, ground - 11 * k, 4 * k, 11 * k], fill: wood.shade }, { r: [x0 + 152 * k, ground - 11 * k, 4 * k, 11 * k], fill: wood.shade }], lw);
}

/** Hospitality marquee (0) or desert tent (1), with pennants. */
function tent(ctx, w, h, P, rnd, variant) {
  const k = w / 384, m = 32 * k, ground = h - 5 * k, lw = LINE.detail * k;
  groundShadow(ctx, w / 2 + 10 * k, ground, w * 0.46, 5 * k);
  const tri = (x, y, c) => { inkTubes(ctx, P, [{ paths: [[[x, y], [x, y - 22 * k]]], width: 1.8 * k, fill: P.metalLight }], LINE.hair * k * 1.3); inkGroup(ctx, P, [{ p: [[x + 1 * k, y - 22 * k], [x + 21 * k, y - 16 * k], [x + 1 * k, y - 10 * k]], fill: c }], LINE.hair * k * 1.5, 1, 'round'); };
  if (variant % 2 === 0) {
    const eaves = ground - 2.5 * m, peakY = 30 * k, x0 = 30 * k, mod = 162 * k, canvas = { light: P.paint, base: shadeHex(P.paint, 0.12), shade: shadeHex(P.paint, 0.3) };
    // interior seen through the open bays
    fillRect(ctx, x0 + 4 * k, eaves, mod * 2 - 8 * k, ground - eaves, mixHex(P.ink, P.concreteShade, 0.35));
    fillRect(ctx, x0 + 4 * k, ground - 20 * k, mod * 2 - 8 * k, 20 * k, mixHex(P.wood, P.ink, 0.45));
    const dimLook = () => { const l = randomLook(P, rnd); for (const key of ['shirt', 'trousers', 'skin', 'hair', 'hatColor']) l[key] = mixHex(l[key], P.ink, 0.3); return l; };
    for (const gx of [x0 + 62 * k, x0 + 96 * k, x0 + mod + 20 * k]) drawFigure(ctx, P, gx, ground - 6 * k, (52 + rnd() * 5) * k, { ...dimLook(), arms: { l: armPose('hip'), r: armPose('down') }, line: LINE.hair * k * 1.5 });
    inkGroup(ctx, P, [{ r: [x0 + 74 * k, ground - 38 * k, 14 * k, 3 * k], fill: mixHex(P.paint, P.ink, 0.3) }, { r: [x0 + 80 * k, ground - 35 * k, 2.4 * k, 30 * k], fill: mixHex(P.metal, P.ink, 0.3) }], LINE.hair * k * 1.4);
    // side walls: bays with arched windows, open bays in the middle
    const bay = mod / 4, bays = ['window', 'open', 'open', 'window', 'open', 'window', 'window', 'wall'];
    bays.forEach((kind, i) => {
      const bx = x0 + i * bay;
      if (kind === 'open') return;
      fillRect(ctx, bx, eaves, bay, ground - eaves, canvas.light);
      fillRect(ctx, bx + bay * 0.72, eaves, bay * 0.28, ground - eaves, canvas.base);
      if (kind === 'window') {
        const win = (g) => archPath(g, bx + 9 * k, eaves + 20 * k, bay - 18 * k, 44 * k);
        contour(ctx, win, P.ink, LINE.hair * k * 1.2, 0, 'round'); fillTrace(ctx, win, P.glass);
        clipped(ctx, win, () => { fillRect(ctx, bx, eaves, bay, 34 * k, P.glassShade); fillPoly(ctx, [[bx + bay, eaves + 36 * k], [bx + bay, ground], [bx + 14 * k, ground]], P.glassLight); inkLine(ctx, bx + bay / 2, eaves, bx + bay / 2, ground, LINE.hair * k, P.paint); inkLine(ctx, bx, eaves + 42 * k, bx + bay, eaves + 42 * k, LINE.hair * k, P.paint); });
      } else { emblem(ctx, 'drop', bx + bay / 2, eaves + 34 * k, 11 * k, P.banners[5], canvas.light); label(ctx, 'ORVANE', bx + bay / 2, eaves + 56 * k, bay - 8 * k, 7 * k, { color: P.banners[5], weight: 1.2 }); }
    });
    // tied-back curtains of the entrance
    for (const [cx, s] of [[x0 + bay, 1], [x0 + bay * 3, -1], [x0 + bay * 4, 1], [x0 + bay * 5, -1]]) {
      const c = [[cx, eaves], [cx + s * 16 * k, eaves], [cx + s * 6 * k, eaves + 44 * k], [cx + s * 10 * k, ground], [cx, ground]];
      inkGroup(ctx, P, [{ p: c, fill: s > 0 ? canvas.light : canvas.base }], lw, 0, 'round');
    }
    fillRect(ctx, x0, eaves + lw, mod * 2, 9 * k, inkAlpha(P, 0.3));
    inkTubes(ctx, P, [{ paths: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [[x0 + i * bay, ground], [x0 + i * bay, eaves]]), width: 3 * k, fill: P.metal, light: P.metalLight }], lw, 'butt');
    // twin peaked roofs with a striped valance
    const roofs = [0, 1].map((i) => { const xl = x0 + i * mod - 6 * k, xr = x0 + (i + 1) * mod + 6 * k, xc = (xl + xr) / 2; return { xl, xr, xc, path: (g) => { g.moveTo(xl, eaves); g.quadraticCurveTo(xc - 34 * k, eaves - 26 * k, xc, peakY); g.quadraticCurveTo(xc + 34 * k, eaves - 26 * k, xr, eaves); g.lineTo(xr, eaves + 13 * k); g.lineTo(xl, eaves + 13 * k); g.closePath(); } }; });
    contour(ctx, (g) => { for (const r of roofs) r.path(g); }, P.ink, LINE.silhouette * k, 1, 'round');
    for (const r of roofs) {
      fillTrace(ctx, r.path, canvas.light);
      clipped(ctx, r.path, () => {
        fillTrace(ctx, (g) => { g.moveTo(r.xc, peakY - 4 * k); g.quadraticCurveTo(r.xc + 10 * k, eaves - 30 * k, r.xc + 22 * k, eaves + 2 * k); g.lineTo(r.xr + 4 * k, eaves + 2 * k); g.lineTo(r.xr + 4 * k, peakY - 4 * k); g.closePath(); }, canvas.shade);
        fillTrace(ctx, (g) => { g.moveTo(r.xc, peakY - 4 * k); g.quadraticCurveTo(r.xc - 6 * k, eaves - 30 * k, r.xc - 26 * k, eaves + 2 * k); g.lineTo(r.xc + 22 * k, eaves + 2 * k); g.quadraticCurveTo(r.xc + 10 * k, eaves - 30 * k, r.xc, peakY - 4 * k); g.closePath(); }, canvas.base);
        for (let i = 0; i < 9; i++) fillRect(ctx, r.xl + (i * (r.xr - r.xl)) / 9, eaves, (r.xr - r.xl) / 9, 14 * k, i % 2 ? P.paint : P.kerbA);
        fillRect(ctx, r.xl, eaves + 8 * k, r.xr - r.xl, 6 * k, inkAlpha(P, 0.18));
        inkLine(ctx, r.xl, eaves, r.xr, eaves, lw, P.ink);
        brushCurve(ctx, [[r.xc, peakY + 4 * k], [r.xc - 5 * k, eaves - 30 * k], [r.xc - 25 * k, eaves - 2 * k]], LINE.hair * k * 1.3, { color: P.ink, taper: 0.1 });
        brushCurve(ctx, [[r.xc, peakY + 4 * k], [r.xc + 9 * k, eaves - 30 * k], [r.xc + 22 * k, eaves - 2 * k]], lw, { color: P.ink, taper: 0.1 });
      });
      tri(r.xc, peakY + 2 * k, P.banners[r.xc < w / 2 ? 0 : 2]);
    }
    // bunting between the peaks, wooden deck
    const b0 = [roofs[0].xc, peakY - 12 * k], b1 = [roofs[1].xc, peakY - 12 * k];
    for (let i = 1; i < 10; i++) { const t = i / 10, x = b0[0] + (b1[0] - b0[0]) * t, y = b0[1] + 26 * k * 4 * t * (1 - t); fillPoly(ctx, [[x - 4 * k, y], [x + 4 * k, y], [x, y + 9 * k]], P.banners[i % 6]); }
    brushCurve(ctx, [b0, [(b0[0] + b1[0]) / 2, b0[1] + 26 * k], b1], LINE.hair * k * 1.2, { color: P.ink, taper: 0.02 });
    inkGroup(ctx, P, [{ r: [x0 - 8 * k, ground - 6 * k, mod * 2 + 16 * k, 6 * k], fill: P.woodLight }], lw);
    return;
  }
  // ---- desert tent: dark woven cloth on three poles, open front, rugs
  const dark = P.trunkShade, cream = P.wallLight, poles = [[96 * k, 44 * k], [192 * k, 34 * k], [288 * k, 44 * k]], edge = 104 * k;
  const top = [[20 * k, edge + 4 * k], [58 * k, 76 * k], poles[0], [144 * k, 54 * k], poles[1], [240 * k, 54 * k], poles[2], [326 * k, 76 * k], [364 * k, edge + 4 * k]];
  const hem = [[364 * k, edge + 4 * k], [324 * k, edge - 4 * k], [258 * k, edge + 3 * k], [192 * k, edge - 6 * k], [126 * k, edge + 3 * k], [60 * k, edge - 4 * k], [20 * k, edge + 4 * k]];
  // guy ropes and pegs
  ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.3; ctx.beginPath();
  for (const [a, b] of [[[20 * k, edge + 4 * k], [4 * k, ground]], [[364 * k, edge + 4 * k], [380 * k, ground]], [poles[0], [10 * k, ground - 2 * k]], [poles[2], [374 * k, ground - 2 * k]]]) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke();
  // interior: back cloth in dimmed stripes, rugs, cushions, low table
  const dim = (c, t = 0.45) => mixHex(c, P.ink, t);
  fillRect(ctx, 44 * k, edge - 8 * k, 296 * k, ground - edge + 8 * k, dim(dark, 0.5));
  for (let i = 0; i < 9; i++) fillRect(ctx, 44 * k + i * 33 * k, edge - 8 * k, 33 * k, ground - edge - 20 * k, dim([P.banners[0], cream, dark, P.banners[5]][i % 4], 0.55));
  fillPoly(ctx, [[58 * k, ground], [80 * k, ground - 26 * k], [304 * k, ground - 26 * k], [326 * k, ground]], dim(P.banners[0], 0.2));
  for (let i = 0; i < 8; i++) fillPoly(ctx, [[86 * k + i * 28 * k, ground - 20 * k], [96 * k + i * 28 * k, ground - 12 * k], [86 * k + i * 28 * k, ground - 4 * k], [76 * k + i * 28 * k, ground - 12 * k]], dim(i % 2 ? P.paintYellow : cream, 0.25));
  for (const [cx, c] of [[110 * k, 6], [150 * k, 5], [262 * k, 1]]) { fillEllipse(ctx, cx, ground - 30 * k, 17 * k, 8 * k, P.ink); fillEllipse(ctx, cx, ground - 31 * k, 15 * k, 6.5 * k, dim(P.banners[c], 0.25)); }
  inkGroup(ctx, P, [{ r: [196 * k, ground - 34 * k, 34 * k, 4 * k], fill: dim(P.wood, 0.25) }, { r: [210 * k, ground - 30 * k, 6 * k, 8 * k], fill: dim(P.woodShade, 0.25) }, { trace: (g) => traceEllipse(g, 213 * k, ground - 41 * k, 6 * k, 7 * k), fill: dim(P.metalLight, 0.2) }], LINE.hair * k * 1.4, 0, 'round');
  // side flaps
  for (const s of [-1, 1]) {
    const xe = s < 0 ? 20 * k : 364 * k, flap = [[xe, edge + 4 * k], [xe + s * 8 * k, ground], [xe - s * 34 * k, ground], [xe - s * 40 * k, edge - 4 * k]];
    inkGroup(ctx, P, [{ p: flap, fill: s < 0 ? cream : shadeHex(cream, 0.25) }], LINE.form * k, 1, 'round');
    clipped(ctx, (g) => tracePolygon(g, flap), () => { for (const [y, c] of [[edge + 22 * k, dark], [edge + 34 * k, P.banners[0]], [edge + 58 * k, dark]]) fillRect(ctx, xe - 44 * k, y, 88 * k, 8 * k, s < 0 ? c : shadeHex(c, 0.25)); });
  }
  // roof cloth: facets between the poles, pale woven stripes
  const cloth = top.concat(hem);
  contour(ctx, (g) => tracePolygon(g, cloth), P.ink, LINE.silhouette * k, 1, 'round');
  fillPoly(ctx, cloth, dark);
  clipped(ctx, (g) => tracePolygon(g, cloth), () => {
    const lit = lightHex(dark, 0.18), deep = shadeHex(dark, 0.4);
    for (const [px, py] of poles) { fillPoly(ctx, [[px, py], [px - 48 * k, py + 12 * k], [px - 66 * k, edge + 10 * k], [px - 8 * k, edge + 10 * k]], lit); fillPoly(ctx, [[px, py], [px + 48 * k, py + 12 * k], [px + 60 * k, edge + 10 * k], [px + 20 * k, edge + 10 * k]], deep); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    for (const [dy, wd, c] of [[16, 5, cream], [26, 2.4, P.banners[0]], [48, 5, cream]]) {
      ctx.strokeStyle = c; ctx.lineWidth = wd * k; ctx.beginPath();
      top.forEach(([x, y], i) => { const yy = y + dy * k * (i === 0 || i === top.length - 1 ? 0.2 : 1); if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); });
      ctx.stroke();
    }
    fillRect(ctx, 0, edge - 4 * k, w, 14 * k, inkAlpha(P, 0.3));
  });
  // fringe, front poles, pole tops with pennants
  for (let x = 28 * k; x < 360 * k; x += 9 * k) brushStroke(ctx, [[x, edge + 1 * k], [x + 1 * k, edge + 9 * k]], LINE.hair * k * 1.6, { color: P.ink, taperStart: 0, taperEnd: 0.6 });
  inkTubes(ctx, P, [{ paths: [[[60 * k, ground], [60 * k, edge - 3 * k]], [[192 * k, ground], [192 * k, edge - 5 * k]], [[324 * k, ground], [324 * k, edge - 3 * k]]], width: 4 * k, fill: P.wood, light: P.woodLight }], lw, 'butt');
  poles.forEach(([px, py], i) => { inkTubes(ctx, P, [{ paths: [[[px, py + 3 * k], [px, py - 8 * k]]], width: 3.4 * k, fill: P.wood }], lw); tri(px, py - 6 * k, P.banners[[0, 1, 5][i]]); });
}

/** Aerodrome hangar: arched sheet roof, sliding doors open on a light aircraft, lean-to, windsock. */
function hangar(ctx, w, h, P, rnd) {
  const k = w / 640, ground = h - 5 * k, lw = LINE.detail * k;
  groundShadow(ctx, w / 2 + 12 * k, ground, w * 0.47, 5 * k);
  const x0 = 60 * k, x1 = 600 * k, eaves = 104 * k, apex = 12 * k, cx = (x0 + x1) / 2;
  const arcY = (x) => eaves - (eaves - apex) * Math.sqrt(Math.max(0, 1 - ((x - cx) / ((x1 - x0) / 2 + 2 * k)) ** 2));
  const front = [[x0, ground]];
  for (let i = 0; i <= 40; i++) { const x = x0 + ((x1 - x0) * i) / 40; front.push([x, arcY(x)]); }
  front.push([x1, ground]);
  // lean-to office on the left
  inkGroup(ctx, P, [{ r: [10 * k, ground - 62 * k, 54 * k, 62 * k], fill: P.wallLight }, { r: [6 * k, ground - 68 * k, 60 * k, 7 * k], fill: P.metalShade }], LINE.form * k);
  fillRect(ctx, 10 * k, ground - 61 * k + lw, 54 * k, 6 * k, inkAlpha(P, 0.3));
  windows(ctx, P, [[18 * k, ground - 46 * k, 20 * k, 18 * k]], { line: lw, bars: [2, 1], sill: P.concreteLight });
  inkGroup(ctx, P, [{ r: [44 * k, ground - 45 * k, 15 * k, 45 * k], fill: P.shutter }], lw); fillRect(ctx, 53 * k, ground - 45 * k, 6 * k, 45 * k, P.shutterShade);
  inkGroup(ctx, P, [{ p: front, fill: P.metalLight }], LINE.silhouette * k, 1, 'round');
  const doorTop = 66 * k, dx0 = 104 * k, dx1 = 556 * k;
  clipped(ctx, (g) => tracePolygon(g, front), () => {
    fillRect(ctx, x1 - 44 * k, 0, 44 * k, h, P.metal);
    ribs(ctx, x0, 0, x1 - x0, h, 9 * k, P.metal, LINE.hair * k * 1.3, true);
    // shadow of the roof edge on the gable
    ctx.strokeStyle = inkAlpha(P, 0.26); ctx.lineWidth = 22 * k; ctx.lineJoin = 'round'; ctx.beginPath(); front.slice(1, -1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.strokeStyle = P.paint; ctx.lineWidth = 9 * k; ctx.beginPath(); front.slice(1, -1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  });
  label(ctx, 'AÉRO-CLUB', cx, 44 * k, 220 * k, 17 * k, { weight: 1.25, color: P.banners[0], tracking: 0.1, seed: 3 });
  // interior and aircraft behind the doors
  const gap0 = 250 * k, gap1 = 420 * k, dark = mixHex(P.ink, P.metalShade, 0.3);
  fillRect(ctx, dx0 - 3 * k, doorTop - 3 * k, dx1 - dx0 + 6 * k, ground - doorTop + 3 * k, P.ink);
  fillRect(ctx, gap0, doorTop, gap1 - gap0, ground - doorTop, dark);
  fillRect(ctx, gap0, ground - 18 * k, gap1 - gap0, 18 * k, mixHex(P.pitAsphalt, P.ink, 0.45));
  const px = (gap0 + gap1) / 2, py = ground - 40 * k, plane = mixHex(P.paint, P.ink, 0.22);
  clipped(ctx, (g) => g.rect(gap0, doorTop, gap1 - gap0, ground - doorTop), () => {
    inkTubes(ctx, P, [{ paths: [[[px - 30 * k, py - 16 * k], [px - 14 * k, py + 2 * k]], [[px + 30 * k, py - 16 * k], [px + 14 * k, py + 2 * k]], [[px - 10 * k, py + 12 * k], [px - 24 * k, ground - 8 * k]], [[px + 10 * k, py + 12 * k], [px + 24 * k, ground - 8 * k]]], width: 2.4 * k, fill: mixHex(P.metal, P.ink, 0.3) }], LINE.hair * k * 1.3);
    inkGroup(ctx, P, [{ r: [px - 120 * k, py - 22 * k, 240 * k, 7 * k], fill: plane }, { trace: (g) => traceEllipse(g, px, py, 17 * k, 18 * k), fill: plane }, { r: [px - 3 * k, py - 46 * k, 6 * k, 26 * k], fill: mixHex(P.banners[0], P.ink, 0.25) }], lw, 1, 'round');
    fillRect(ctx, px - 120 * k, py - 18 * k, 240 * k, 3 * k, mixHex(P.banners[0], P.ink, 0.25));
    fillEllipse(ctx, px + 6 * k, py + 3 * k, 10 * k, 12 * k, mixHex(P.paint, P.ink, 0.4));
    fillTrace(ctx, (g) => roundRectPath(g, px - 12 * k, py - 14 * k, 24 * k, 10 * k, 4 * k), mixHex(P.glass, P.ink, 0.35));
    fillEllipse(ctx, px, py + 2 * k, 4.4 * k, 4.4 * k, P.ink); fillEllipse(ctx, px, py + 2 * k, 2.4 * k, 2.4 * k, mixHex(P.metalLight, P.ink, 0.2));
    inkTubes(ctx, P, [{ paths: [[[px - 3 * k, py - 24 * k], [px + 3 * k, py + 28 * k]]], width: 4 * k, fill: mixHex(P.wood, P.ink, 0.3) }], LINE.hair * k * 1.3);
    for (const s of [-1, 1]) { fillEllipse(ctx, px + s * 25 * k, ground - 8 * k, 5 * k, 7 * k, P.ink); }
    fillRect(ctx, gap0, doorTop, gap1 - gap0, 12 * k, inkAlpha(P, 0.4));
  });
  // door leaves on their track
  const leaf = (lx, lw2, tone) => {
    inkGroup(ctx, P, [{ r: [lx, doorTop, lw2, ground - doorTop - 2 * k], fill: tone }], lw);
    fillRect(ctx, lx + lw2 - 10 * k, doorTop, 10 * k, ground - doorTop - 2 * k, P.metalShade);
    ribs(ctx, lx, doorTop, lw2 - 10 * k, ground - doorTop - 2 * k, 12 * k, P.metalShade, LINE.hair * k, true);
    windows(ctx, P, [[lx + 10 * k, doorTop + 22 * k, lw2 - 30 * k, 16 * k]], { line: LINE.hair * k * 1.3, bars: [3, 1], frame: P.metalLight, glass: P.glassShade, light: P.glass, shade: shadeHex(P.glassShade, 0.4) });
  };
  leaf(dx0, 76 * k, P.metal); leaf(dx0 + 70 * k, 80 * k, P.metal); leaf(dx1 - 150 * k, 80 * k, P.metal); leaf(dx1 - 76 * k, 76 * k, P.metal);
  inkGroup(ctx, P, [{ r: [dx0 - 8 * k, doorTop - 9 * k, dx1 - dx0 + 16 * k, 8 * k], fill: P.metalShade }], lw);
  fillRect(ctx, dx0 - 8 * k, doorTop - 9 * k, dx1 - dx0 + 16 * k, 2.6 * k, P.metal);
  fillRect(ctx, dx0, doorTop + lw, dx1 - dx0, 7 * k, inkAlpha(P, 0.3));
  fillRect(ctx, x0, ground - 9 * k, x1 - x0, 9 * k, P.concreteShade); fillRect(ctx, gap0, ground - 9 * k, gap1 - gap0, 9 * k, mixHex(P.pitAsphalt, P.ink, 0.3)); inkLine(ctx, x0, ground - 9 * k, x1, ground - 9 * k, LINE.hair * k, P.ink);
  // windsock
  inkTubes(ctx, P, [{ paths: [[[622 * k, ground], [622 * k, 58 * k]]], width: 2.6 * k, fill: P.metalLight }], lw);
  const sock = [[622 * k, 60 * k], [622 * k, 76 * k], [590 * k, 78 * k], [590 * k, 68 * k]];
  inkGroup(ctx, P, [{ p: sock, fill: P.banners[5] }], lw, 1, 'round');
  clipped(ctx, (g) => tracePolygon(g, sock), () => { fillRect(ctx, 606 * k, 56 * k, 8 * k, 26 * k, P.paint); fillRect(ctx, 590 * k, 56 * k, 8 * k, 26 * k, P.paint); fillRect(ctx, 588 * k, 73 * k, 36 * k, 6 * k, inkAlpha(P, 0.22)); });
}

/** Grid of window cells for a facade: columns x rows inside a rectangle. */
function windowGrid(x, y, w, h, cols, rows, ww, wh) {
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([x + (w * (c + 0.5)) / cols - ww / 2, y + (h * (r + 0.5)) / rows - wh / 2, ww, wh]);
  return cells;
}

/** Roof equipment: air handling unit, tank, antenna. */
function roofKit(ctx, P, x, y, k, kind) {
  const lw = LINE.detail * k;
  if (kind === 'unit') {
    inkGroup(ctx, P, [{ r: [x, y - 16 * k, 34 * k, 16 * k], fill: P.metalLight }], lw);
    fillRect(ctx, x + 22 * k, y - 16 * k, 12 * k, 16 * k, P.metal); ribs(ctx, x + 2 * k, y - 13 * k, 18 * k, 11 * k, 3.4 * k, P.metalShade, LINE.hair * k, false);
  } else if (kind === 'tank') {
    inkTubes(ctx, P, [{ paths: [[[x + 4 * k, y], [x + 4 * k, y - 12 * k]], [[x + 22 * k, y], [x + 22 * k, y - 12 * k]], [[x + 4 * k, y - 2 * k], [x + 22 * k, y - 11 * k]]], width: 1.8 * k, fill: P.metalShade }], LINE.hair * k * 1.3, 'butt');
    inkGroup(ctx, P, [{ r: [x, y - 36 * k, 26 * k, 25 * k], fill: P.wood }, { p: [[x - 2 * k, y - 36 * k], [x + 13 * k, y - 46 * k], [x + 28 * k, y - 36 * k]], fill: P.metalShade }], lw);
    fillRect(ctx, x + 17 * k, y - 36 * k, 9 * k, 25 * k, P.woodShade); ribs(ctx, x, y - 36 * k, 26 * k, 25 * k, 5.2 * k, P.woodShade, LINE.hair * k, true);
  } else if (kind === 'mast') {
    inkTubes(ctx, P, [{ paths: [[[x, y], [x, y - 46 * k]], [[x - 7 * k, y - 34 * k], [x + 7 * k, y - 34 * k]], [[x - 5 * k, y - 40 * k], [x + 5 * k, y - 40 * k]], [[x - 9 * k, y - 26 * k], [x + 9 * k, y - 26 * k]]], width: 1.5 * k, fill: P.metalShade }], LINE.hair * k * 1.3);
  } else {
    inkGroup(ctx, P, [{ r: [x, y - 22 * k, 30 * k, 22 * k], fill: P.concreteLight }, { r: [x - 2 * k, y - 25 * k, 34 * k, 4 * k], fill: P.concrete }], lw);
    fillRect(ctx, x + 20 * k, y - 21 * k, 10 * k, 21 * k, P.concrete); fillRect(ctx, x + 6 * k, y - 14 * k, 8 * k, 14 * k, P.ink);
  }
}

/** Mid-rise city blocks. 0: flats with balconies; 1: glazed office block on a podium; 2: old block and tower. */
function cityBlock(ctx, w, h, P, rnd, variant) {
  const k = w / 384, m = 17.45 * k, ground = h - 5 * k, lw = LINE.detail * k * 0.9, storey = 3 * m;
  const wall = { light: P.wallLight, base: P.wall, shade: P.wallShade };
  groundShadow(ctx, w / 2 + 12 * k, ground, w * 0.46, 5 * k);
  const body = (x, top, bw, tones, shadeW = 0.16) => {
    inkGroup(ctx, P, [{ r: [x, top, bw, ground - top], fill: tones.light }], LINE.silhouette * k);
    fillRect(ctx, x + bw * (1 - shadeW), top, bw * shadeW, ground - top, tones.base);
  };
  const parapet = (x, top, bw, tones) => { fillRect(ctx, x, top, bw, 5 * k, tones.light); fillRect(ctx, x, top + 5 * k, bw, 5 * k, inkAlpha(P, 0.28)); inkLine(ctx, x, top + 5 * k, x + bw, top + 5 * k, lw, P.ink); };
  const shops = (x, bw, colors) => {
    const sy = ground - 3.4 * m;
    fillRect(ctx, x, sy, bw, ground - sy, P.inkSoft);
    const n = colors.length, cw = bw / n;
    colors.forEach((c, i) => {
      windows(ctx, P, [[x + i * cw + 5 * k, sy + 20 * k, cw - 10 * k, ground - sy - 26 * k]], { line: lw, bars: [3, 1], frame: P.metalLight, glass: P.glassShade, light: P.glass, shade: shadeHex(P.glassShade, 0.4) });
      inkGroup(ctx, P, [{ p: [[x + i * cw + 2 * k, sy + 4 * k], [x + (i + 1) * cw - 2 * k, sy + 4 * k], [x + (i + 1) * cw, sy + 18 * k], [x + i * cw, sy + 18 * k]], fill: c }], lw);
      fillRect(ctx, x + i * cw, sy + 14 * k, cw, 4 * k, shadeHex(c, 0.3));
    });
    inkLine(ctx, x, sy, x + bw, sy, LINE.form * k, P.ink);
  };
  if (variant % 3 === 0) {
    // lower brick wing, then seven storeys of flats with stacked balconies
    const brick = { light: P.brickLight, base: P.brick, shade: P.brickShade };
    const sx = 8 * k, sTop = ground - 4 * storey - 6 * k, sw = 112 * k;
    body(sx, sTop, sw, brick, 0.14);
    parapet(sx, sTop, sw, brick);
    windows(ctx, P, windowGrid(sx + 4 * k, sTop + 12 * k, sw - 12 * k, ground - 3.4 * m - sTop - 14 * k, 3, 3, 21 * k, 28 * k), { line: lw, bars: [2, 2], sill: P.concreteLight, blinds: 0.3, rnd });
    shops(sx, sw, [P.banners[4], P.banners[1]]);
    const x0 = 96 * k, bw = 250 * k, top = ground - 7 * storey - 4 * k;
    roofKit(ctx, P, x0 + 40 * k, top, k, 'lift'); roofKit(ctx, P, x0 + 150 * k, top, k, 'tank'); roofKit(ctx, P, x0 + 208 * k, top, k, 'mast');
    body(x0, top, bw, wall);
    parapet(x0, top, bw, wall);
    fillPoly(ctx, [[x0, sTop], [x0 + 30 * k, sTop], [x0 + 12 * k, ground], [x0, ground]], inkAlpha(P, 0.2));
    const pitch = (ground - 3.4 * m - top - 16 * k) / 6;
    for (let f = 0; f < 6; f++) {
      const fy = top + 10 * k + f * pitch;
      // recessed balconies in two stacks, windows between
      for (const bx of [x0 + 18 * k, x0 + 148 * k]) {
        fillRect(ctx, bx - lw, fy + 6 * k - lw, 64 * k + lw * 2, pitch - 10 * k + lw * 2, P.ink);
        fillRect(ctx, bx, fy + 6 * k, 64 * k, pitch - 10 * k, mixHex(P.wallShade, P.ink, 0.45));
        fillRect(ctx, bx + 6 * k, fy + 12 * k, 22 * k, pitch - 16 * k, P.glassShade); fillPoly(ctx, [[bx + 28 * k, fy + 26 * k], [bx + 28 * k, fy + pitch - 4 * k], [bx + 14 * k, fy + pitch - 4 * k]], P.glass);
        if ((f * 7 + bx) % 3 < 1) fillRect(ctx, bx + 36 * k, fy + 14 * k, 18 * k, 12 * k, P.crowd[(f * 3 + Math.round(bx)) % P.crowd.length]);
        fillRect(ctx, bx, fy + pitch - 22 * k, 64 * k, 18 * k, f % 2 ? wall.light : P.glassLight);
        fillRect(ctx, bx + 44 * k, fy + pitch - 22 * k, 20 * k, 18 * k, f % 2 ? wall.base : P.glass);
        inkLine(ctx, bx, fy + pitch - 22 * k, bx + 64 * k, fy + pitch - 22 * k, lw, P.ink);
      }
    }
    windows(ctx, P, [...windowGrid(x0 + 86 * k, top + 10 * k, 58 * k, 6 * pitch, 2, 6, 19 * k, 27 * k), ...windowGrid(x0 + 214 * k, top + 10 * k, 30 * k, 6 * pitch, 1, 6, 19 * k, 27 * k)], { line: lw, bars: [2, 1], sill: P.concreteLight, blinds: 0.35, rnd });
    shops(x0 + 34 * k, bw - 34 * k, [P.banners[0], P.banners[2], P.banners[5]]);
    // entrance of the flats
    inkGroup(ctx, P, [{ r: [x0 + 8 * k, ground - 2.2 * m, 20 * k, 2.2 * m], fill: P.wood }, { r: [x0 + 4 * k, ground - 2.2 * m - 7 * k, 28 * k, 6 * k], fill: P.concrete }], lw);
    fillRect(ctx, x0 + 18 * k, ground - 2.2 * m, 10 * k, 2.2 * m, P.woodShade); fillRect(ctx, x0 + 11 * k, ground - 2.2 * m + 5 * k, 6 * k, 14 * k, P.glassShade);
  } else if (variant % 3 === 1) {
    // office block: curtain wall with sky reflections, concrete podium
    const x0 = 78 * k, bw = 236 * k, top = ground - 7.4 * storey;
    roofKit(ctx, P, x0 + 24 * k, top, k, 'unit'); roofKit(ctx, P, x0 + 70 * k, top, k, 'unit'); roofKit(ctx, P, x0 + 170 * k, top, k, 'lift'); roofKit(ctx, P, x0 + 214 * k, top, k, 'mast');
    inkGroup(ctx, P, [{ r: [x0, top, bw, ground - top], fill: P.glass }], LINE.silhouette * k);
    const rows = 7, cols = 9, cw = bw / cols, ch = (ground - 2.2 * storey - top - 8 * k) / rows;
    clipped(ctx, (g) => g.rect(x0, top, bw, ground - top), () => {
      fillPoly(ctx, [[x0, top + 220 * k], [x0 + 150 * k, top], [x0 + 236 * k, top], [x0, top + 330 * k]], P.glassLight);
      fillPoly(ctx, [[x0 + 60 * k, ground], [x0 + bw, top + 120 * k], [x0 + bw, top + 190 * k], [x0 + 120 * k, ground]], P.glassLight);
      fillRect(ctx, x0 + bw * 0.84, top, bw * 0.16, ground - top, inkAlpha(P, 0.24));
      for (let r = 0; r <= rows; r++) { fillRect(ctx, x0, top + 8 * k + r * ch - 7 * k, bw, 9 * k, P.glassShade); inkLine(ctx, x0, top + 8 * k + r * ch + 2 * k, x0 + bw, top + 8 * k + r * ch + 2 * k, LINE.hair * k, P.ink); }
      ribs(ctx, x0, top, bw, ground - top, cw, P.ink, LINE.hair * k * 1.2, true);
      ctx.fillStyle = P.metalLight; for (let c = 1; c < cols; c++) ctx.fillRect(x0 + c * cw - 1.6 * k, top, 1.1 * k, ground - top);
    });
    fillRect(ctx, x0, top, bw, 6 * k, P.metalLight); inkLine(ctx, x0, top + 6 * k, x0 + bw, top + 6 * k, lw, P.ink);
    // podium with entrance canopy and the company name
    const px0 = 30 * k, pw = 330 * k, pTop = ground - 2.2 * storey, conc = { light: P.concreteLight, base: P.concrete, shade: P.concreteShade };
    body(px0, pTop, pw, conc, 0.12);
    fillRect(ctx, px0, pTop, pw, 20 * k, P.concreteLight); inkLine(ctx, px0, pTop + 20 * k, px0 + pw, pTop + 20 * k, lw, P.ink);
    fillRect(ctx, px0, pTop + 20 * k + lw, pw, 6 * k, inkAlpha(P, 0.28));
    label(ctx, 'KORVEX', px0 + pw * 0.3, pTop + 10 * k, 120 * k, 11 * k, { weight: 1.3, color: P.banners[5], tracking: 0.14 });
    emblem(ctx, 'nut', px0 + 22 * k, pTop + 10 * k, 7 * k, P.banners[5], P.concreteLight);
    windows(ctx, P, windowGrid(px0 + 8 * k, pTop + 32 * k, pw - 16 * k, ground - pTop - 38 * k, 8, 1, 30 * k, ground - pTop - 46 * k), { line: lw, bars: [2, 3], frame: P.metalLight, glass: P.glassShade, light: P.glass, shade: shadeHex(P.glassShade, 0.4) });
    inkGroup(ctx, P, [{ r: [px0 + pw * 0.42, ground - 2.3 * m, 44 * k, 2.3 * m], fill: P.glassShade }, { r: [px0 + pw * 0.42 - 16 * k, ground - 2.3 * m - 9 * k, 76 * k, 7 * k], fill: P.metalLight }], lw);
    fillRect(ctx, px0 + pw * 0.42 + 4 * k, ground - 2.3 * m + 4 * k, 16 * k, 2.3 * m - 4 * k, P.glass); fillRect(ctx, px0 + pw * 0.42 + 24 * k, ground - 2.3 * m + 4 * k, 16 * k, 2.3 * m - 4 * k, P.glass);
  } else {
    // slim tower behind, old block with a zinc mansard in front
    const tx = 190 * k, tw = 150 * k, tTop = ground - 8 * storey, conc = { light: P.concreteLight, base: P.concrete, shade: P.concreteShade };
    roofKit(ctx, P, tx + 20 * k, tTop, k, 'unit'); roofKit(ctx, P, tx + 84 * k, tTop, k, 'lift'); roofKit(ctx, P, tx + 132 * k, tTop, k, 'mast');
    body(tx, tTop, tw, conc);
    parapet(tx, tTop, tw, conc);
    for (let f = 0; f < 8; f++) { fillRect(ctx, tx + 6 * k, tTop + 16 * k + f * storey, tw - 12 * k, 30 * k, P.ink); }
    windows(ctx, P, windowGrid(tx + 7 * k, tTop + 17 * k, tw - 14 * k, 8 * storey - storey + 28 * k, 6, 8, 20 * k, 28 * k).map((c, i) => [c[0], tTop + 17 * k + Math.floor(i / 6) * storey, c[2], 28 * k]), { line: 0.01, blinds: 0.3, rnd, blindColor: P.concreteLight });
    fillRect(ctx, tx + tw * 0.84, tTop + 10 * k, tw * 0.16, ground - tTop - 10 * k, inkAlpha(P, 0.2));
    const ox = 30 * k, ow = 196 * k, oTop = ground - 5 * storey - 10 * k;
    const mans = [[ox + 3 * k, oTop], [ox + 14 * k, oTop - 40 * k], [ox + ow - 14 * k, oTop - 40 * k], [ox + ow - 3 * k, oTop]];
    for (const cxm of [ox + 46 * k, ox + 150 * k]) { inkGroup(ctx, P, [{ r: [cxm, oTop - 58 * k, 22 * k, 22 * k], fill: P.brick }, { r: [cxm + 3 * k, oTop - 64 * k, 5 * k, 7 * k], fill: P.roof }, { r: [cxm + 13 * k, oTop - 64 * k, 5 * k, 7 * k], fill: P.roof }], lw); fillRect(ctx, cxm + 14 * k, oTop - 58 * k, 8 * k, 20 * k, P.brickShade); }
    inkGroup(ctx, P, [{ p: mans, fill: P.metal }, { r: [ox, oTop, ow, ground - oTop], fill: wall.light }], LINE.silhouette * k);
    clipped(ctx, (g) => tracePolygon(g, mans), () => { fillRect(ctx, ox, oTop - 40 * k, 64 * k, 40 * k, P.metalLight); fillRect(ctx, ox + ow - 44 * k, oTop - 40 * k, 44 * k, 40 * k, P.metalShade); ribs(ctx, ox, oTop - 40 * k, ow, 40 * k, 14 * k, P.inkSoft, LINE.hair * k, true); });
    for (let i = 0; i < 5; i++) {
      const dxm = ox + ow * (0.1 + i * 0.2);
      inkGroup(ctx, P, [{ p: [[dxm - 11 * k, oTop - 3 * k], [dxm - 11 * k, oTop - 26 * k], [dxm, oTop - 33 * k], [dxm + 11 * k, oTop - 26 * k], [dxm + 11 * k, oTop - 3 * k]], fill: wall.light }], lw);
      windows(ctx, P, [[dxm - 6 * k, oTop - 24 * k, 12 * k, 17 * k]], { line: LINE.hair * k * 1.2, glass: P.glassShade, light: P.glass, shade: shadeHex(P.glassShade, 0.4) });
    }
    fillRect(ctx, ox + ow * 0.86, oTop, ow * 0.14, ground - oTop, wall.base);
    fillRect(ctx, ox, oTop, ow, 7 * k, P.paint); fillRect(ctx, ox, oTop + 7 * k, ow, 6 * k, inkAlpha(P, 0.3));
    inkLine(ctx, ox - 3 * k, oTop, ox + ow + 3 * k, oTop, LINE.form * k, P.ink); inkLine(ctx, ox, oTop + 7 * k, ox + ow, oTop + 7 * k, lw, P.ink);
    const cells = windowGrid(ox + 4 * k, oTop + 16 * k, ow - 8 * k, 4 * storey, 5, 4, 19 * k, 33 * k);
    for (const c of cells) shutterPair(ctx, P, c, P.shutter, LINE.hair * k * 1.2);
    windows(ctx, P, cells, { line: lw, bars: [2, 3], sill: P.concreteLight, blinds: 0.3, rnd, blindColor: P.paint });
    for (let f = 1; f < 4; f++) inkLine(ctx, ox, oTop + 16 * k + f * storey - 5 * k, ox + ow, oTop + 16 * k + f * storey - 5 * k, LINE.hair * k, P.wallShade);
    // iron balcony along the second floor
    const by = oTop + 16 * k + storey + 43 * k;
    fillRect(ctx, ox + 8 * k, by, ow - 16 * k, 4 * k, P.concreteLight); inkLine(ctx, ox + 8 * k, by + 4 * k, ox + ow - 8 * k, by + 4 * k, lw, P.ink); inkLine(ctx, ox + 8 * k, by - 14 * k, ox + ow - 8 * k, by - 14 * k, lw, P.ink);
    ribs(ctx, ox + 8 * k, by - 14 * k, ow - 16 * k, 14 * k, 4.5 * k, P.ink, LINE.hair * k, true);
    shops(ox, ow, [P.banners[0], P.shutter, P.banners[1], P.banners[6]]);
  }
}

/** Harbour gantry crane seen from the side: portal legs, boom, A-frame with stays, machinery house, trolley and container. */
function crane(ctx, w, h, P) {
  const k = w / 320, m = 16 * k, ground = h - 5 * k, lw = LINE.detail * k;
  const paint = paintTones(mixHex(P.banners[0], P.banners[5], 0.45), 0.3, 0.36);
  groundShadow(ctx, 190 * k, ground, 120 * k, 5 * k);
  const legA = 118 * k, legB = 262 * k, sill = ground - 16 * k, portal = ground - 13 * m, girder = ground - 21 * m, apexY = ground - 32.6 * m, tip = 8 * k, tail = 306 * k;
  // stays from the apex to the boom and to the back of the girder
  inkTubes(ctx, P, [{ paths: [[[legA + 4 * k, apexY], [tip + 16 * k, girder - 6 * k]], [[legA + 4 * k, apexY], [66 * k, girder - 6 * k]], [[legA + 4 * k, apexY], [tail - 10 * k, girder - 6 * k]], [[legA + 4 * k, apexY], [legB, girder - 6 * k]]], width: 2.4 * k, fill: paint.shade }], lw, 'butt');
  // cables and spreader with a container under the trolley
  const trolleyX = 62 * k, loadY = ground - 12.5 * m;
  ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.3; ctx.beginPath();
  for (const dx of [-22, -12, 12, 22]) { ctx.moveTo(trolleyX + dx * 0.5 * k, girder + 16 * k); ctx.lineTo(trolleyX + dx * k * 1.6, loadY - 8 * k); }
  ctx.stroke();
  const box = paintTones(mixHex(P.banners[2], P.concrete, 0.2));
  inkGroup(ctx, P, [{ r: [trolleyX - 44 * k, loadY - 9 * k, 88 * k, 6 * k], fill: P.paintYellow }, { r: [trolleyX - 49 * k, loadY - 3 * k, 98 * k, 41 * k], fill: box.base }], LINE.form * k);
  fillRect(ctx, trolleyX - 49 * k, loadY - 3 * k, 98 * k, 5 * k, box.light); fillRect(ctx, trolleyX - 49 * k, loadY + 31 * k, 98 * k, 7 * k, box.shade);
  ribs(ctx, trolleyX - 49 * k, loadY + 2 * k, 98 * k, 29 * k, 7 * k, box.shade, LINE.hair * k * 1.2, true);
  label(ctx, 'MARLOC', trolleyX, loadY + 16 * k, 70 * k, 11 * k, { weight: 1.3, color: P.paint });
  // bracing between the legs
  const lower = latticeMembers([legA, sill], [legA, portal], [legB, sill], [legB, portal], 1, 'x');
  const upper = latticeMembers([legA, portal], [legA, girder], [legB, portal], [legB, girder], 1, 'zig');
  inkTubes(ctx, P, [{ paths: [...lower.braces, ...upper.braces], width: 4 * k, fill: paint.shade }], lw, 'butt');
  // A-frame
  inkTubes(ctx, P, [{ paths: [[[legA, girder], [legA + 4 * k, apexY]], [[legB - 60 * k, girder], [legA + 4 * k, apexY]], [[legA + 2 * k, girder - 70 * k], [legB - 96 * k, girder - 70 * k]]], width: 6 * k, fill: paint.base, light: paint.light, shade: paint.shade }], LINE.form * k, 'butt');
  // legs, portal beam, sill beams
  inkGroup(ctx, P, [{ r: [legA - 7 * k, girder, 14 * k, sill - girder], fill: paint.base }, { r: [legB - 7 * k, girder, 14 * k, sill - girder], fill: paint.base }, { r: [legA - 7 * k, portal - 7 * k, legB - legA + 14 * k, 14 * k], fill: paint.base }, { r: [legA - 22 * k, sill - 6 * k, 44 * k, 12 * k], fill: paint.base }, { r: [legB - 22 * k, sill - 6 * k, 44 * k, 12 * k], fill: paint.base }], LINE.silhouette * k);
  for (const x of [legA, legB]) {
    fillRect(ctx, x - 7 * k, girder, 4.5 * k, sill - girder - 6 * k, paint.light); fillRect(ctx, x + 2.5 * k, girder, 4.5 * k, sill - girder - 6 * k, paint.shade);
    fillRect(ctx, x - 22 * k, sill - 6 * k, 44 * k, 3.4 * k, paint.light);
    for (let i = 0; i < 4; i++) fillPoly(ctx, [[x - 20 * k + i * 11 * k, sill + 6 * k], [x - 14 * k + i * 11 * k, sill + 6 * k], [x - 9 * k + i * 11 * k, sill], [x - 15 * k + i * 11 * k, sill]], P.ink);
    for (const dx of [-13, 0, 13]) { fillEllipse(ctx, x + dx * k, sill + 10.5 * k, 5 * k, 5 * k, P.ink); fillEllipse(ctx, x + dx * k, sill + 10.5 * k, 2.2 * k, 2.2 * k, P.metal); }
  }
  fillRect(ctx, legA - 7 * k, portal - 7 * k, legB - legA + 14 * k, 4 * k, paint.light); fillRect(ctx, legA - 7 * k, portal + 2 * k, legB - legA + 14 * k, 5 * k, paint.shade);
  fillRect(ctx, legA - 60 * k, ground - 2 * k, 240 * k, 2 * k, P.ink);
  // stair on the landside leg
  const stair = [];
  for (let i = 0; i < 6; i++) { const y0 = sill - 8 * k - i * 30 * k; stair.push([[legB + 8 * k, y0], [legB + 26 * k, y0 - 30 * k]], [[legB + 8 * k, y0 - 30 * k], [legB + 26 * k, y0 - 30 * k]]); }
  inkTubes(ctx, P, [{ paths: stair, width: 1.8 * k, fill: P.metalLight }, { paths: [[[legB + 27 * k, sill - 8 * k], [legB + 27 * k, sill - 190 * k]]], width: 2 * k, fill: P.metal }], LINE.hair * k * 1.3, 'butt');
  // boom and girder: box truss with a red and white tip
  const truss = latticeMembers([tip, girder - 6 * k], [tail, girder - 6 * k], [tip, girder + 12 * k], [tail, girder + 12 * k], 16, 'zig');
  drawLattice(ctx, P, [truss], 6 * k, 3 * k, paint, LINE.form * k * 0.9);
  for (let i = 0; i < 3; i++) fillRect(ctx, tip + i * 12 * k, girder - 9 * k, 6 * k, 6 * k, P.paint);
  // machinery house, operator cab on the trolley
  const hx = 196 * k, hy = girder - 42 * k;
  inkGroup(ctx, P, [{ r: [hx, hy, 86 * k, 34 * k], fill: P.paint }, { r: [hx - 3 * k, hy - 5 * k, 92 * k, 6 * k], fill: P.metalShade }], LINE.form * k);
  fillRect(ctx, hx + 64 * k, hy + 1 * k, 22 * k, 33 * k, shadeHex(P.paint, 0.2)); fillRect(ctx, hx, hy + 26 * k, 86 * k, 8 * k, paint.base);
  windows(ctx, P, [[hx + 8 * k, hy + 8 * k, 12 * k, 10 * k], [hx + 28 * k, hy + 8 * k, 12 * k, 10 * k]], { line: LINE.hair * k * 1.2 });
  label(ctx, '07', hx + 64 * k, hy + 13 * k, 22 * k, 11 * k, { weight: 1.3, color: P.ink });
  inkGroup(ctx, P, [{ r: [trolleyX - 20 * k, girder + 12 * k, 40 * k, 8 * k], fill: P.metalShade }, { p: [[trolleyX + 22 * k, girder + 16 * k], [trolleyX + 46 * k, girder + 16 * k], [trolleyX + 46 * k, girder + 34 * k], [trolleyX + 28 * k, girder + 40 * k], [trolleyX + 22 * k, girder + 34 * k]], fill: P.paint }], lw);
  fillPoly(ctx, [[trolleyX + 26 * k, girder + 24 * k], [trolleyX + 43 * k, girder + 24 * k], [trolleyX + 43 * k, girder + 33 * k], [trolleyX + 29 * k, girder + 37 * k], [trolleyX + 26 * k, girder + 33 * k]], P.glassShade);
  fillPoly(ctx, [[trolleyX + 43 * k, girder + 27 * k], [trolleyX + 43 * k, girder + 33 * k], [trolleyX + 33 * k, girder + 36 * k]], P.glass);
  // warning light on the apex
  fillEllipse(ctx, legA + 4 * k, apexY - 4 * k, 3.6 * k, 3.6 * k, P.ink); fillEllipse(ctx, legA + 4 * k, apexY - 4 * k, 2.2 * k, 2.2 * k, P.banners[0]);
}

const SHIPPERS = ['MARLOC', 'TRANSBORA', 'CARGOLIS', 'NORDVIK', 'SEALVA'];

/** One shipping container seen from the side: corrugated panel, frame, corner castings, fictional markings. */
function containerBox(ctx, P, x, y, bw, bh, color, name, k, rnd) {
  const t = paintTones(color, 0.26, 0.34);
  inkGroup(ctx, P, [{ r: [x, y, bw, bh], fill: t.base }], LINE.form * k);
  ribs(ctx, x + 6 * k, y + 7 * k, bw - 12 * k, bh - 15 * k, 6.5 * k, t.shade, 1.5 * k, true);
  ctx.fillStyle = t.light; for (let px = x + 6 * k + 6.5 * k; px < x + bw - 6.5 * k; px += 6.5 * k) ctx.fillRect(px + 1.2 * k, y + 7 * k, 1.1 * k, bh - 15 * k);
  fillRect(ctx, x, y, bw, 6 * k, t.light); fillRect(ctx, x, y + bh - 8 * k, bw, 8 * k, t.shade);
  fillRect(ctx, x, y, 5 * k, bh, t.base); fillRect(ctx, x + bw - 6 * k, y, 6 * k, bh, t.shade);
  inkLine(ctx, x, y + 6 * k, x + bw, y + 6 * k, LINE.hair * k, P.ink); inkLine(ctx, x, y + bh - 8 * k, x + bw, y + bh - 8 * k, LINE.hair * k, P.ink);
  for (const cx of [x, x + bw - 8 * k]) for (const cy of [y, y + bh - 7 * k]) { fillRect(ctx, cx, cy, 8 * k, 7 * k, P.ink); fillRect(ctx, cx + 1.4 * k, cy + 1.4 * k, 5.2 * k, 4.2 * k, P.metalShade); fillRect(ctx, cx + 3 * k, cy + 2.6 * k, 2.4 * k, 2 * k, P.ink); }
  // markings: shipping line, code, data plate
  const light = color === P.paint || color === P.banners[1], ink = light ? P.ink : P.paint;
  label(ctx, name, x + bw * 0.34, y + bh * 0.42, bw * 0.52, 15 * k, { weight: 1.3, color: ink, slant: 0.06, seed: name.length });
  label(ctx, name.slice(0, 3) + 'U ' + (100000 + Math.floor(rnd() * 899999)), x + bw * 0.82, y + bh * 0.24, bw * 0.3, 5.5 * k, { color: ink, jitter: 0.3 });
  fillRect(ctx, x + bw * 0.74, y + bh * 0.52, bw * 0.16, 12 * k, ink); fillRect(ctx, x + bw * 0.745, y + bh * 0.535, bw * 0.15, 3 * k, t.base);
  // wear: rust runs and scuffs
  for (let i = 0; i < 4; i++) { const px = x + 10 * k + rnd() * (bw - 20 * k), py = y + 8 * k + rnd() * bh * 0.4; brushStroke(ctx, [[px, py], [px + 0.6 * k, py + (8 + rnd() * 16) * k]], (1.2 + rnd() * 1.6) * k, { color: mixHex(t.shade, P.brickShade, 0.5), taperStart: 0, taperEnd: 0.7 }); }
}

/** Stacked shipping containers with fictional markings (two arrangements). */
function containers(ctx, w, h, P, rnd, variant) {
  const k = w / 416, ground = h - 5 * k, ch = 83 * k, long = 390 * k, short = 194 * k;
  const muted = (i) => mixHex(P.banners[i], P.concrete, 0.18);
  groundShadow(ctx, w / 2 + 10 * k, ground, w * 0.48, 5 * k);
  const x0 = 13 * k;
  if (variant % 2 === 0) {
    containerBox(ctx, P, x0, ground - ch, long, ch, muted(2), SHIPPERS[0], k, rnd);
    containerBox(ctx, P, x0, ground - 2 * ch, short, ch, muted(5), SHIPPERS[1], k, rnd);
    containerBox(ctx, P, x0 + short + 2 * k, ground - 2 * ch, short, ch, muted(4), SHIPPERS[2], k, rnd);
    fillRect(ctx, x0, ground - ch + LINE.form * k * 0.6, long, 6 * k, inkAlpha(P, 0.3));
  } else {
    containerBox(ctx, P, x0, ground - ch, short, ch, muted(0), SHIPPERS[3], k, rnd);
    containerBox(ctx, P, x0 + short + 2 * k, ground - ch, short, ch, P.paint, SHIPPERS[4], k, rnd);
    containerBox(ctx, P, x0 + 58 * k, ground - 2 * ch, short, ch, muted(1), SHIPPERS[0], k, rnd);
    fillRect(ctx, x0 + 58 * k, ground - ch + LINE.form * k * 0.6, short, 6 * k, inkAlpha(P, 0.3));
  }
}

/** Dock warehouse: brick base, sheet cladding, saw-tooth roof, four loading doors on a raised dock. */
function warehouse(ctx, w, h, P, rnd) {
  const k = w / 640, m = 21.33 * k, ground = h - 5 * k, lw = LINE.detail * k;
  groundShadow(ctx, w / 2 + 12 * k, ground, w * 0.48, 5 * k);
  const x0 = 14 * k, x1 = 626 * k, eaves = ground - 6.6 * m, brickTop = ground - 2.6 * m, dock = ground - 1.1 * m, teeth = 4, tw = (x1 - x0) / teeth, peak = eaves - 44 * k;
  // saw-tooth roof: glazed faces toward the light, sheet slopes behind
  const shapes = [];
  for (let i = 0; i < teeth; i++) { const tx = x0 + i * tw; shapes.push({ p: [[tx, eaves + 2 * k], [tx, peak], [tx + 16 * k, peak], [tx + tw, eaves + 2 * k]], fill: P.metal }); }
  inkGroup(ctx, P, [...shapes, { r: [x0, eaves, x1 - x0, ground - eaves], fill: P.metalLight }], LINE.silhouette * k);
  for (let i = 0; i < teeth; i++) {
    const tx = x0 + i * tw;
    fillPoly(ctx, [[tx + 16 * k, peak], [tx + tw, eaves + 2 * k], [tx + tw * 0.62, eaves + 2 * k]], P.metalShade);
    fillRect(ctx, tx, peak, 16 * k, eaves - peak, P.glass); fillRect(ctx, tx, peak, 16 * k, 10 * k, P.glassShade); fillPoly(ctx, [[tx + 16 * k, peak + 20 * k], [tx + 16 * k, eaves], [tx + 4 * k, eaves]], P.glassLight);
    inkLine(ctx, tx + 16 * k, peak, tx + 16 * k, eaves, lw, P.ink); inkLine(ctx, tx, peak + (eaves - peak) * 0.5, tx + 16 * k, peak + (eaves - peak) * 0.5, LINE.hair * k, P.ink);
    for (let j = 1; j < 5; j++) inkLine(ctx, tx + 16 * k + (tw - 16 * k) * (j / 5), peak + (eaves - peak) * (j / 5) + 2 * k, tx + 16 * k + (tw - 16 * k) * (j / 5) - 6 * k, eaves + 2 * k, LINE.hair * k, P.inkSoft);
  }
  // cladding above, brick below
  ribs(ctx, x0, eaves, x1 - x0, brickTop - eaves, 8 * k, P.metal, LINE.hair * k * 1.3, true);
  fillRect(ctx, x1 - 40 * k, eaves, 40 * k, brickTop - eaves, P.metal);
  fillRect(ctx, x0, eaves + LINE.form * k, x1 - x0, 8 * k, inkAlpha(P, 0.26));
  inkLine(ctx, x0, eaves, x1, eaves, LINE.form * k, P.ink);
  fillRect(ctx, x0, brickTop, x1 - x0, ground - brickTop, P.brick);
  fillRect(ctx, x1 - 40 * k, brickTop, 40 * k, ground - brickTop, P.brickShade); fillRect(ctx, x0, brickTop, x1 - x0, 4 * k, P.brickLight);
  inkLine(ctx, x0, brickTop, x1, brickTop, lw, P.ink);
  for (let i = 0; i < 50; i++) { const x = x0 + 6 * k + rnd() * (x1 - x0 - 30 * k), y = brickTop + 8 * k + rnd() * (ground - brickTop - 12 * k); inkLine(ctx, x, y, x + (6 + rnd() * 14) * k, y, LINE.hair * k, rnd() < 0.3 ? P.brickLight : P.brickShade); }
  const sx = x0 + 486 * k, sy = eaves + 16 * k;
  inkGroup(ctx, P, [{ r: [sx, sy, 112 * k, 46 * k], fill: P.paint }], lw);
  fillRect(ctx, sx, sy, 112 * k, 13 * k, P.banners[2]);
  fillPoly(ctx, [[sx + 112 * k, sy + 24 * k], [sx + 112 * k, sy + 46 * k], [sx + 60 * k, sy + 46 * k]], shadeHex(P.paint, 0.14));
  label(ctx, 'ENTREPÔTS', sx + 56 * k, sy + 6.5 * k, 100 * k, 6.5 * k, { color: P.paint, tracking: 0.2 });
  label(ctx, 'TRANSBORA', sx + 56 * k, sy + 30 * k, 100 * k, 15 * k, { weight: 1.3, color: P.banners[2], slant: 0.08, seed: 5 });
  // loading doors: one open, one half open
  const doorW = 68 * k, doorTop = ground - 4.9 * m, open = [0, 1, 0.45, 0];
  for (let i = 0; i < 4; i++) {
    const dx = x0 + 44 * k + i * 112 * k;
    fillRect(ctx, dx - 4 * k, doorTop - 4 * k, doorW + 8 * k, dock - doorTop + 4 * k, P.ink);
    fillRect(ctx, dx, doorTop, doorW, dock - doorTop, mixHex(P.ink, P.concreteShade, 0.25));
    if (open[i] > 0) {
      // pallets and crates in the half-light
      fillRect(ctx, dx + 8 * k, dock - 26 * k, 26 * k, 22 * k, mixHex(P.woodLight, P.ink, 0.45)); fillRect(ctx, dx + 36 * k, dock - 34 * k, 24 * k, 30 * k, mixHex(P.wood, P.ink, 0.45)); fillRect(ctx, dx + 6 * k, dock - 4 * k, 56 * k, 4 * k, mixHex(P.wood, P.ink, 0.6));
      inkLine(ctx, dx + 8 * k, dock - 14 * k, dx + 34 * k, dock - 14 * k, LINE.hair * k, P.ink);
    }
    rollerDoor(ctx, P, dx, doorTop, doorW, dock - doorTop, open[i], k * 0.8);
    // number disc above the door
    fillEllipse(ctx, dx + doorW / 2, doorTop - 30 * k, 11 * k, 11 * k, P.ink); fillEllipse(ctx, dx + doorW / 2, doorTop - 30 * k, 9.4 * k, 9.4 * k, P.paint);
    label(ctx, String(i + 1), dx + doorW / 2, doorTop - 30 * k, 14 * k, 11 * k, { weight: 1.3, color: P.ink });
    // rubber bumpers
    for (const bx of [dx - 2 * k, dx + doorW - 6 * k]) fillRect(ctx, bx, dock + 3 * k, 8 * k, 12 * k, P.ink);
  }
  // canopy over the doors
  const cy = doorTop - 14 * k, cxa = x0 + 30 * k, cxb = x0 + 462 * k;
  fillRect(ctx, cxa, cy + 8 * k, cxb - cxa, 12 * k, inkAlpha(P, 0.34));
  inkGroup(ctx, P, [{ r: [cxa - 6 * k, cy, cxb - cxa + 12 * k, 8 * k], fill: P.metal }], LINE.form * k);
  fillRect(ctx, cxa - 6 * k, cy, cxb - cxa + 12 * k, 3 * k, P.metalLight);
  ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.hair * k * 1.4; ctx.beginPath();
  for (let x = cxa + 68 * k; x < cxb; x += 112 * k) { ctx.moveTo(x, cy); ctx.lineTo(x + 24 * k, cy - 18 * k); }
  ctx.stroke();
  // raised dock with steps, office door and window on the right
  inkGroup(ctx, P, [{ r: [x0 - 6 * k, dock, 486 * k, ground - dock], fill: P.concreteLight }, { r: [x0 + 480 * k, dock + 8 * k, 14 * k, ground - dock - 8 * k], fill: P.concrete }, { r: [x0 + 494 * k, dock + 16 * k, 14 * k, ground - dock - 16 * k], fill: P.concrete }], LINE.form * k);
  fillRect(ctx, x0 - 6 * k, dock + 6 * k, 486 * k, ground - dock - 6 * k, P.concrete); fillRect(ctx, x0 - 6 * k, ground - 7 * k, 486 * k, 7 * k, P.concreteShade);
  for (let i = 0; i < 9; i++) fillPoly(ctx, [[x0 + i * 54 * k, dock + 6 * k], [x0 + 14 * k + i * 54 * k, dock + 6 * k], [x0 + 8 * k + i * 54 * k, dock + 12 * k], [x0 - 6 * k + i * 54 * k, dock + 12 * k]], P.paintYellow);
  const ox = x0 + 520 * k;
  inkGroup(ctx, P, [{ r: [ox, ground - 2.1 * m, 20 * k, 2.1 * m], fill: P.shutter }], lw); fillRect(ctx, ox + 13 * k, ground - 2.1 * m, 7 * k, 2.1 * m, P.shutterShade);
  windows(ctx, P, [[ox + 32 * k, ground - 38 * k, 30 * k, 22 * k]], { line: lw, bars: [3, 1], sill: P.concreteLight });
  inkTubes(ctx, P, [{ paths: [[[x1 - 12 * k, eaves + 4 * k], [x1 - 12 * k, ground - 2 * k]], [[x0 + 8 * k, eaves + 4 * k], [x0 + 8 * k, dock]]], width: 3.4 * k, fill: P.metalShade, light: P.metal }], lw, 'butt');
  // pallet stack on the dock
  inkGroup(ctx, P, [{ r: [x0 + 398 * k, dock - 22 * k, 30 * k, 18 * k], fill: P.woodLight }, { r: [x0 + 394 * k, dock - 5 * k, 38 * k, 5 * k], fill: P.wood }], lw);
  fillRect(ctx, x0 + 416 * k, dock - 22 * k, 12 * k, 18 * k, P.wood);
}

/** Painters by family. */
export const BUILDING_PAINTERS = {
  'strip.grandstand': grandstand,
  'strip.pitbuilding': pitBuilding,
  'strip.crowdbank': crowdBank,
  'strip.facade': facade,
  'building.villa': villa,
  'building.chalet': chalet,
  'building.tent': tent,
  'building.hangar': hangar,
  'building.city': cityBlock,
  'building.crane': crane,
  'building.container': containers,
  'building.warehouse': warehouse,
};
