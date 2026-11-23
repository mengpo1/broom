// Drawings of the trackside objects of tracks/trackside-objects.js: direction boards, advertising
// boards of the fictional sponsors of the game, gantries, tunnel portal and vault, lone trees and
// plants, rocks, small accessories, and the strips at the foot of the barriers.
// Same rules as trackside.js: painters have the signature (ctx, w, h, P, rnd, variant, spec), props
// stand on the bottom edge, light comes from the upper left, ink contour under flat colours.
// Every drawing is original; nothing here copies a sign, a brand or an illustration of another game.
// To replace one, register another painter for the same family (scenery-painters.js).

import { LINE, tracePolygon, clipped, brushStroke } from '../styles/ink.js';
import { mixHex, shadeHex, lightHex } from '../palettes/palettes.js';
import { groundShadow, foliageMass, grassTuft, ringPoints, inkUnion, trunk } from './vegetation.js';
import { inkGroup, inkTubes, contour, fillRect, fillPoly, fillTrace, fillEllipse, inkLine, label, sponsorPanel, roundRectPath, latticeMembers, drawLattice, wrapped } from './trackside.js';

const jit = (rnd, amount) => (rnd() - 0.5) * 2 * amount;
const steelPosts = (ctx, P, k, xs, y0, y1, width = 7) => inkTubes(ctx, P, [{ paths: xs.map((x) => [[x, y0], [x, y1]]), width: width * k, fill: P.metal, light: P.metalLight, shade: P.metalShade }], LINE.form * k, 'butt');
const strokePath = (ctx, trace, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.beginPath(); trace(ctx); ctx.stroke(); };

/** Board with two chevrons pointing to the right (drawn mirrored for a left-hand bend), on two posts. */
function chevronSign(ctx, w, h, P) {
  const k = w / 176, ground = h - 6 * k, bx = 8 * k, by = 8 * k, bw = 160 * k, bh = 116 * k, red = P.banners[0];
  groundShadow(ctx, w / 2 + 8 * k, ground, 70 * k, 5 * k);
  steelPosts(ctx, P, k, [44 * k, 132 * k], by + bh - 6 * k, ground - 2 * k);
  const face = (g) => roundRectPath(g, bx, by, bw, bh, 8 * k);
  contour(ctx, face, P.ink, LINE.silhouette * k, 1, 'round');
  fillTrace(ctx, face, P.paint);
  clipped(ctx, face, () => {
    fillPoly(ctx, [[bx + bw * 0.45, by + bh], [bx + bw, by + bh * 0.45], [bx + bw, by + bh]], shadeHex(P.paint, 0.14));
    for (const x0 of [18, 82]) {
      const x = bx + x0 * k, y = by + 16 * k, a = 34 * k, t = 30 * k, hh = bh - 32 * k;
      const arrow = [[x, y], [x + t, y], [x + t + a, y + hh / 2], [x + t, y + hh], [x, y + hh], [x + a, y + hh / 2]];
      fillPoly(ctx, arrow, red);
      fillPoly(ctx, [[x + a, y + hh / 2], [x + t + a, y + hh / 2], [x + t, y + hh], [x, y + hh]], shadeHex(red, 0.24));
      strokePath(ctx, (g) => tracePolygon(g, arrow), P.ink, LINE.detail * k);
    }
  });
  strokePath(ctx, (g) => roundRectPath(g, bx + 5 * k, by + 5 * k, bw - 10 * k, bh - 10 * k, 5 * k), P.ink, LINE.hair * k * 1.4);
  for (const x of [44 * k, 132 * k]) for (const y of [by + 5 * k, by + bh - 5 * k]) fillEllipse(ctx, x, y, 1.7 * k, 1.7 * k, P.ink);
}

/** Direction sign before a bend: blue panel, white arrow bending to the right, on one post. */
function turnSign(ctx, w, h, P) {
  const k = w / 128, ground = h - 6 * k, bx = 10 * k, by = 8 * k, bw = 108 * k, bh = 116 * k, blue = P.banners[2];
  groundShadow(ctx, w / 2 + 6 * k, ground, 34 * k, 4.5 * k);
  steelPosts(ctx, P, k, [w / 2], by + bh - 6 * k, ground - 2 * k, 8);
  inkGroup(ctx, P, [{ r: [w / 2 - 11 * k, ground - 5 * k, 22 * k, 5 * k], fill: P.metalShade }], LINE.detail * k);
  const face = (g) => roundRectPath(g, bx, by, bw, bh, 12 * k);
  contour(ctx, face, P.ink, LINE.silhouette * k, 1, 'round');
  fillTrace(ctx, face, blue);
  clipped(ctx, face, () => {
    fillPoly(ctx, [[bx + bw * 0.4, by + bh], [bx + bw, by + bh * 0.5], [bx + bw, by + bh]], shadeHex(blue, 0.26));
    fillRect(ctx, bx, by, bw, 3 * k, lightHex(blue, 0.3));
  });
  // the arrow: a stem coming up, bending to the right, with a head
  const stem = [[bx + 34 * k, by + bh - 16 * k], [bx + 34 * k, by + 52 * k], [bx + 44 * k, by + 40 * k], [bx + 66 * k, by + 40 * k]];
  for (const [color, width] of [[P.ink, 19 * k], [P.paint, 14 * k]]) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(stem[0][0], stem[0][1]); for (const p of stem.slice(1)) ctx.lineTo(p[0], p[1]); ctx.stroke();
  }
  const head = [[bx + 62 * k, by + 20 * k], [bx + 94 * k, by + 40 * k], [bx + 62 * k, by + 60 * k]];
  inkGroup(ctx, P, [{ p: head, fill: P.paint }], LINE.detail * k, 0, 'round');
  strokePath(ctx, (g) => roundRectPath(g, bx + 6 * k, by + 6 * k, bw - 12 * k, bh - 12 * k, 8 * k), P.paint, LINE.detail * k * 1.6);
}

const LOW_BOARDS = [['orvane', 'gommex'], ['keltor'], ['nitral', 'solgane']];
/** Advertising board on short posts: one or two panels of fictional sponsors in a galvanised frame. */
function advertLow(ctx, w, h, P, rnd, variant) {
  const k = w / 416, ground = h - 6 * k, bx = 8 * k, by = 14 * k, bw = 400 * k, bh = 118 * k, names = LOW_BOARDS[variant % LOW_BOARDS.length];
  groundShadow(ctx, w / 2 + 12 * k, ground, 190 * k, 6 * k);
  const posts = [52 * k, w / 2, w - 52 * k];
  steelPosts(ctx, P, k, posts, by + bh - 4 * k, ground - 2 * k, 8);
  // raking struts behind
  inkTubes(ctx, P, [{ paths: [[[posts[0], by + bh + 6 * k], [posts[0] + 26 * k, ground - 3 * k]], [[posts[2], by + bh + 6 * k], [posts[2] - 26 * k, ground - 3 * k]]], width: 4 * k, fill: P.metalShade }], LINE.detail * k, 'butt');
  inkGroup(ctx, P, [{ r: [bx, by, bw, bh], fill: P.metal }], LINE.silhouette * k);
  const pw = (bw - 12 * k) / names.length;
  names.forEach((id, i) => {
    const x = bx + 6 * k + i * pw;
    sponsorPanel(ctx, P, id, x, by + 6 * k, pw - (i < names.length - 1 ? 4 * k : 0), bh - 12 * k);
    strokePath(ctx, (g) => g.rect(x, by + 6 * k, pw - (i < names.length - 1 ? 4 * k : 0), bh - 12 * k), P.ink, LINE.detail * k);
  });
  fillRect(ctx, bx, by, bw, 2.5 * k, P.metalLight);
}

const HIGH_BOARDS = ['brizal', 'montevo'];
/** Advertising board on tall lattice posts, seen from far over the barriers. */
function advertHigh(ctx, w, h, P, rnd, variant) {
  const k = w / 352, ground = h - 6 * k, bx = 8 * k, by = 10 * k, bw = 336 * k, bh = 150 * k;
  groundShadow(ctx, w / 2 + 14 * k, ground, 150 * k, 6 * k);
  const legs = [[70 * k, 96 * k], [256 * k, 282 * k]].map(([x0, x1]) => latticeMembers([x0, ground - 4 * k], [x0, by + bh - 2 * k], [x1, ground - 4 * k], [x1, by + bh - 2 * k], 6, 'x'));
  drawLattice(ctx, P, legs, 6 * k, 3 * k, null, LINE.form * k);
  for (const x of [64 * k, 250 * k]) { inkGroup(ctx, P, [{ r: [x, ground - 9 * k, 38 * k, 9 * k], fill: P.concrete }], LINE.form * k); fillRect(ctx, x, ground - 9 * k, 38 * k, 2.4 * k, P.concreteLight); }
  inkGroup(ctx, P, [{ r: [bx, by, bw, bh], fill: P.metal }], LINE.silhouette * k);
  sponsorPanel(ctx, P, HIGH_BOARDS[variant % HIGH_BOARDS.length], bx + 7 * k, by + 7 * k, bw - 14 * k, bh - 14 * k, { size: 0.42 });
  strokePath(ctx, (g) => g.rect(bx + 7 * k, by + 7 * k, bw - 14 * k, bh - 14 * k), P.ink, LINE.detail * k);
  fillPoly(ctx, [[bx + bw * 0.6, by + bh - 7 * k], [bx + bw - 7 * k, by + bh * 0.55], [bx + bw - 7 * k, by + bh - 7 * k]], 'rgba(22,22,36,0.16)');
  // lamps on brackets above the board
  for (const x of [bx + bw * 0.25, bx + bw * 0.5, bx + bw * 0.75]) { inkLine(ctx, x, by, x + 6 * k, by - 7 * k, LINE.detail * k, P.ink); fillEllipse(ctx, x + 8 * k, by - 7 * k, 4 * k, 2.6 * k, P.ink); }
}

const GANTRY_SPONSORS = [['virage', 'turbal', 'freinor'], ['pistona', 'korvex']];
/**
 * Race gantry over the road. 0: box truss on two lattice towers carrying three boards.
 * 1: a gate of fat painted tubes with a banner. Towers centred 10.6 m from the middle, 5.3 m of clearance.
 */
function bannerGantry(ctx, w, h, P, rnd, variant) {
  const k = w / 1408, ground = h - 6 * k, tw = 52 * k, xl = 56 * k, xr = w - 56 * k - tw, beamTop = 22 * k, beamBot = 123 * k;
  for (const x of [xl, xr]) groundShadow(ctx, x + tw / 2 + 12 * k, ground, 60 * k, 6 * k);
  const names = GANTRY_SPONSORS[variant % 2];
  if (variant % 2 === 0) {
    const towers = [xl, xr].map((x) => latticeMembers([x, ground - 16 * k], [x, beamBot], [x + tw, ground - 16 * k], [x + tw, beamBot], 5, 'x'));
    drawLattice(ctx, P, towers, 8 * k, 3.6 * k, null, LINE.form * k);
    const beam = latticeMembers([xl - 6 * k, beamTop], [xr + tw + 6 * k, beamTop], [xl - 6 * k, beamBot], [xr + tw + 6 * k, beamBot], 18, 'zig');
    drawLattice(ctx, P, [beam], 9 * k, 4.4 * k, null, LINE.form * k);
    for (const x of [xl, xr]) {
      inkGroup(ctx, P, [{ r: [x - 12 * k, ground - 18 * k, tw + 24 * k, 18 * k], fill: P.concrete }], LINE.silhouette * k);
      fillRect(ctx, x - 12 * k, ground - 18 * k, tw + 24 * k, 4 * k, P.concreteLight);
      for (let i = 0; i < 4; i++) fillRect(ctx, x - 12 * k + (i * (tw + 24 * k)) / 4, ground - 14 * k, (tw + 24 * k) / 4, 6 * k, i % 2 ? P.kerbB : P.kerbA);
    }
    const bx = 190 * k, bw = (w - 380 * k) / names.length, by = beamTop + 8 * k, bh = beamBot - beamTop - 16 * k;
    names.forEach((id, i) => {
      const x = bx + i * bw + 8 * k;
      inkGroup(ctx, P, [{ r: [x, by, bw - 16 * k, bh], fill: P.paint }], LINE.form * k);
      sponsorPanel(ctx, P, id, x + 3 * k, by + 3 * k, bw - 22 * k, bh - 6 * k);
    });
  } else {
    // two legs and a lintel made of one fat tube, striped at the feet
    const tube = paintTonesOf(P.banners[1]), r = 26 * k, y = beamTop + 30 * k;
    const gate = (g) => { g.moveTo(xl + tw / 2, ground - 4 * k); g.lineTo(xl + tw / 2, y + 60 * k); g.quadraticCurveTo(xl + tw / 2, y, xl + tw / 2 + 70 * k, y); g.lineTo(xr + tw / 2 - 70 * k, y); g.quadraticCurveTo(xr + tw / 2, y, xr + tw / 2, y + 60 * k); g.lineTo(xr + tw / 2, ground - 4 * k); };
    for (const [color, width, dy] of [[P.ink, 2 * r + LINE.silhouette * 2 * k, 0], [P.ink, 2 * r + LINE.silhouette * 2 * k, 2.4 * k], [tube.base, 2 * r, 0]]) {
      ctx.save(); ctx.translate(dy * 0.4, dy); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'butt'; ctx.beginPath(); gate(ctx); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(-r * 0.42, -r * 0.42); ctx.strokeStyle = tube.light; ctx.lineWidth = r * 0.36; ctx.beginPath(); gate(ctx); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(r * 0.46, r * 0.46); ctx.strokeStyle = tube.shade; ctx.lineWidth = r * 0.4; ctx.beginPath(); gate(ctx); ctx.stroke(); ctx.restore();
    for (const x of [xl + tw / 2, xr + tw / 2]) {
      for (let i = 0; i < 4; i++) { fillRect(ctx, x - r, ground - 4 * k - (i + 1) * 26 * k, 2 * r, 13 * k, P.ink); }
      inkGroup(ctx, P, [{ r: [x - r - 10 * k, ground - 10 * k, 2 * r + 20 * k, 10 * k], fill: P.concreteShade }], LINE.form * k);
    }
    // banner hung under the lintel
    const bx = 250 * k, bw = w - 500 * k, by = y + r + 6 * k, bh = beamBot - by - 2 * k + 14 * k;
    ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.detail * k; ctx.beginPath();
    for (const x of [bx + 20 * k, bx + bw / 2, bx + bw - 20 * k]) { ctx.moveTo(x, y + r - 2 * k); ctx.lineTo(x, by + 2 * k); }
    ctx.stroke();
    inkGroup(ctx, P, [{ r: [bx, by, bw, bh], fill: P.paint }], LINE.form * k);
    const pw = bw / names.length;
    names.forEach((id, i) => sponsorPanel(ctx, P, id, bx + i * pw + 3 * k, by + 3 * k, pw - 6 * k, bh - 6 * k));
    inkLine(ctx, bx + pw, by, bx + pw, by + bh, LINE.detail * k, P.ink);
  }
}
function paintTonesOf(hex) { return { light: lightHex(hex, 0.32), base: hex, shade: shadeHex(hex, 0.3) }; }

/** Shape of the opening of a tunnel (world: 28.4 m wide, 5.8 m high, flat vault with rounded haunches). */
function tunnelOpening(g, w, h, k, ground) {
  const x0 = w / 2 - 14.2 * 45.18 * k, x1 = w / 2 + 14.2 * 45.18 * k, top = ground - 5.8 * 45.18 * k, r = 60 * k;
  g.moveTo(x0, ground + 4 * k); g.lineTo(x0, top + r); g.quadraticCurveTo(x0, top, x0 + r, top); g.lineTo(x1 - r, top); g.quadraticCurveTo(x1, top, x1, top + r); g.lineTo(x1, ground + 4 * k); g.closePath();
}

/** Tunnel mouth: concrete face with a striped arch ring, set in a bank of rock and grass. The opening is empty. */
function tunnelPortal(ctx, w, h, P, rnd) {
  const k = w / 1536, ground = h - 4 * k;
  const face = (g) => { g.rect(0, 30 * k, w, ground - 30 * k); };
  const ring = (g) => { const s = 1.07; g.save?.(); tunnelOpening(g, w, h, k, ground); };
  const stone = paintTonesOf(P.concrete), bank = [P.rockShade, P.rock, P.rockLight];
  // the bank: an irregular top edge
  const crest = [[0, 64 * k]];
  for (let x = 0; x <= w; x += 96 * k) crest.push([x + jit(rnd, 20 * k), (30 + rnd() * 34) * k]);
  crest.push([w, 64 * k], [w, ground], [0, ground]);
  ctx.save();
  ctx.beginPath(); tracePolygon(ctx, crest); tunnelOpening(ctx, w, h, k, ground); ctx.clip('evenodd');
  ctx.fillStyle = bank[1]; ctx.fillRect(0, 0, w, h);
  // strata and grass on top
  for (let i = 0; i < 9; i++) { const y = (70 + i * 22 + jit(rnd, 5)) * k; brushStroke(ctx, [[jit(rnd, 30 * k), y], [w * 0.33, y + jit(rnd, 9 * k)], [w * 0.66, y + jit(rnd, 9 * k)], [w, y + jit(rnd, 6 * k)]], LINE.detail * k * 1.2, { color: i % 3 ? P.rockShade : P.rockDeep, taper: 0.1, swell: 0.3, seed: i }); }
  ctx.fillStyle = P.grassDark; ctx.beginPath(); tracePolygon(ctx, crest.slice(0, crest.length - 2).concat([[w, 84 * k], [0, 84 * k]])); ctx.fill();
  ctx.fillStyle = P.grassA; ctx.beginPath(); tracePolygon(ctx, crest.slice(0, crest.length - 2).concat([[w, 70 * k], [0, 70 * k]])); ctx.fill();
  // concrete face around the opening
  const fx0 = w / 2 - 16.6 * 45.18 * k, fx1 = w / 2 + 16.6 * 45.18 * k, ftop = ground - 8.3 * 45.18 * k;
  fillRect(ctx, fx0, ftop, fx1 - fx0, ground - ftop, stone.base);
  fillRect(ctx, fx0, ftop, fx1 - fx0, 8 * k, stone.light);
  fillPoly(ctx, [[fx0 + (fx1 - fx0) * 0.5, ground], [fx1, ftop + 40 * k], [fx1, ground]], stone.shade);
  for (let x = fx0 + 80 * k; x < fx1 - 20 * k; x += 118 * k) inkLine(ctx, x, ftop + 8 * k, x, ground, LINE.hair * k * 1.3, P.concreteShade);
  inkLine(ctx, fx0, ftop + 52 * k, fx1, ftop + 52 * k, LINE.detail * k, P.ink);
  strokePath(ctx, (g) => g.rect(fx0, ftop, fx1 - fx0, ground - ftop + 8 * k), P.ink, LINE.silhouette * k);
  ctx.restore();
  // arch ring in warning stripes, then the ink edge of the opening
  ctx.save();
  ctx.beginPath(); tunnelOpening(ctx, w, h, k, ground); ctx.lineWidth = 40 * k; ctx.strokeStyle = P.ink; ctx.stroke();
  ctx.lineWidth = 32 * k; ctx.strokeStyle = P.banners[1]; ctx.setLineDash([34 * k, 34 * k]); ctx.stroke();
  ctx.restore();
  // what is behind the ring inside the mouth stays empty: punch the opening out again, keeping the inner ink line
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); tunnelOpening(ctx, w, h, k, ground); ctx.fill(); ctx.restore();
  strokePath(ctx, (g) => tunnelOpening(g, w, h, k, ground), P.ink, LINE.silhouette * k * 1.5);
  // a lamp row on the lintel and the name plate of the tunnel
  const top = ground - 5.8 * 45.18 * k;
  inkGroup(ctx, P, [{ r: [w / 2 - 150 * k, top - 92 * k, 300 * k, 46 * k], fill: P.paint }], LINE.form * k);
  label(ctx, 'TUNNEL', w / 2, top - 69 * k, 270 * k, 30 * k, { weight: 1.2, color: P.ink, slant: 0.06, seed: 5 });
  void face; void ring; void bank;
}

/** One rib of the vault inside a tunnel: piers and a ceiling in shadow, lamps along the edge. The opening is empty. */
function tunnelArch(ctx, w, h, P) {
  const k = w / 1536, ground = h - 4 * k, dark = mixHex(P.concreteShade, P.ink, 0.55), darker = mixHex(P.concreteShade, P.ink, 0.74);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, ground + 4 * k); tunnelOpening(ctx, w, h, k, ground); ctx.clip('evenodd');
  ctx.fillStyle = darker; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = dark; ctx.fillRect(0, ground - 6.6 * 45.18 * k, w, 0.8 * 45.18 * k);
  ctx.restore();
  strokePath(ctx, (g) => tunnelOpening(g, w, h, k, ground), P.ink, LINE.silhouette * k * 2);
  const top = ground - 5.8 * 45.18 * k;
  for (let i = -5; i <= 5; i++) { const x = w / 2 + i * 104 * k; fillEllipse(ctx, x, top - 12 * k, 15 * k, 7 * k, P.ink); fillEllipse(ctx, x, top - 12 * k, 11 * k, 4.5 * k, P.paintYellow || '#f0c330'); }
}

/** Wall of a tunnel, seen from the road: plinth, tiled wall with a lit band, then the dark of the vault. Tiles seamlessly. */
function tunnelWall(ctx, w, h, P) {
  const lit = (5.8 / 13) * h, y0 = h - lit, dark = mixHex(P.concreteShade, P.ink, 0.7), wall = mixHex(P.concrete, P.ink, 0.42), light = mixHex(P.concreteLight, P.ink, 0.2);
  fillRect(ctx, 0, 0, w, y0 + 2, dark);
  fillRect(ctx, 0, y0, w, lit, wall);
  fillRect(ctx, 0, y0 + lit * 0.22, w, lit * 0.16, light);
  fillRect(ctx, 0, y0 + lit * 0.22, w, 2, P.ink); fillRect(ctx, 0, y0 + lit * 0.38, w, 2, P.ink);
  for (let x = 0; x < w; x += w / 8) { fillRect(ctx, x, y0, 1.6, lit * 0.78, mixHex(wall, P.ink, 0.5)); fillEllipse(ctx, x + w / 16, y0 + lit * 0.3, 14, 5, P.paintYellow || '#f0c330'); }
  fillRect(ctx, 0, h - lit * 0.2, w, lit * 0.2, mixHex(P.concreteShade, P.ink, 0.35));
  for (let x = 0; x < w; x += w / 8) fillRect(ctx, x, h - lit * 0.2, w / 16, lit * 0.07, mixHex(P.kerbA, P.ink, 0.3));
  fillRect(ctx, 0, y0, w, 3, P.ink); fillRect(ctx, 0, h - lit * 0.2, w, 2, P.ink);
}

/** Lone oak: a short heavy trunk under a broad crown. */
function oak(ctx, w, h, P, rnd) {
  const k = w / 448, cx = w * 0.5, ground = h - 7 * k;
  groundShadow(ctx, cx + 14 * k, ground, 170 * k, 9 * k);
  trunk(ctx, cx, ground, h * 0.5, 30 * k, 22 * k, P, k, rnd, 4 * k);
  inkTubes(ctx, P, [{ paths: [[[cx - 6 * k, h * 0.56], [cx - 70 * k, h * 0.4]], [[cx + 8 * k, h * 0.54], [cx + 78 * k, h * 0.42]]], width: 11 * k, fill: P.trunk, shade: P.trunkShade }], LINE.form * k);
  const clumps = [[-0.52, 0.4, 0.36, 1], [0.5, 0.42, 0.38, 1], [0, 0.42, 0.44, 1], [-0.34, 0.24, 0.4], [0.32, 0.26, 0.42], [-0.62, 0.34, 0.26], [0.64, 0.33, 0.27], [0, 0.17, 0.4], [-0.14, 0.32, 0.36], [0.2, 0.36, 0.3]]
    .map(([x, y, r, dark]) => ({ x: cx + (x + jit(rnd, 0.03)) * w * 0.5, y: (y + jit(rnd, 0.02)) * h, r: r * w * 0.5 * (0.95 + rnd() * 0.1), squash: 0.82, dark: !!dark }));
  foliageMass(ctx, clumps, { ink: P.ink, shade: P.leafShade, base: P.leaf, light: P.leafLight, deep: P.leafDeep }, k, rnd, { density: 1.1 });
  for (const x of [-0.3, 0.26]) grassTuft(ctx, cx + x * w * 0.5, h - 4 * k, 13 * k, P.ink, k, rnd);
}

/** Poplar: a tall narrow column of foliage on a thin trunk. */
function poplar(ctx, w, h, P, rnd) {
  const k = w / 144, cx = w * 0.5, ground = h - 6 * k;
  groundShadow(ctx, cx + 8 * k, ground, 46 * k, 5.5 * k);
  trunk(ctx, cx, ground, h * 0.72, 9 * k, 6 * k, P, k, rnd, 0);
  const clumps = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8, y = h * (0.8 - t * 0.72), r = w * (0.36 - Math.abs(t - 0.38) * 0.2 - t * 0.1);
    clumps.push({ x: cx + jit(rnd, 5 * k) + (i % 2 ? 7 : -7) * k, y, r: Math.max(12 * k, r), squash: 1.25, dark: i < 3 });
  }
  foliageMass(ctx, clumps, { ink: P.ink, shade: P.cypressShade, base: P.leaf, light: P.leafLight, deep: P.leafDeep }, k, rnd, { density: 1.2 });
}

/** Cactus. 0: a column with two arms; 1: a clump of flat pads with flowers. */
function cactus(ctx, w, h, P, rnd, variant) {
  const k = w / 144, cx = w * 0.5, ground = h - 6 * k, tones = { light: P.palmLight, base: P.palm, shade: P.palmShade };
  groundShadow(ctx, cx + 8 * k, ground, 46 * k, 5.5 * k);
  const ribs = (x, y0, y1, half) => { for (const dx of [-0.45, 0.1, 0.55]) brushStroke(ctx, [[x + dx * half, y0], [x + dx * half + k, (y0 + y1) / 2], [x + dx * half, y1]], LINE.hair * k * 1.5, { color: P.ink, taper: 0.35 }); };
  if (variant % 2 === 0) {
    const limb = (pts, width) => {
      for (const [color, wd, dx] of [[P.ink, width + LINE.silhouette * 2 * k, 0], [tones.base, width, 0], [tones.light, width * 0.3, -width * 0.27], [tones.shade, width * 0.34, width * 0.3]]) {
        ctx.save(); ctx.translate(dx, 0); ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.restore();
      }
    };
    limb([[cx - 4 * k, h * 0.62], [cx - 40 * k, h * 0.62], [cx - 40 * k, h * 0.36]], 18 * k);
    limb([[cx + 4 * k, h * 0.5], [cx + 42 * k, h * 0.5], [cx + 42 * k, h * 0.22]], 17 * k);
    limb([[cx, ground - 2 * k], [cx, h * 0.1]], 30 * k);
    ribs(cx, h * 0.16, ground - 10 * k, 15 * k); ribs(cx - 40 * k, h * 0.38, h * 0.58, 9 * k); ribs(cx + 42 * k, h * 0.26, h * 0.46, 8.5 * k);
  } else {
    const pads = [[0, 0.78, 30, 38], [-0.42, 0.6, 24, 30], [0.4, 0.58, 26, 32], [-0.1, 0.4, 24, 30], [0.5, 0.34, 18, 22], [-0.56, 0.36, 16, 20]];
    const shapes = pads.map(([x, y, rx, ry]) => ringPoints(cx + x * w * 0.5, y * h, rx * k, ry * k, 12, 0.05, rnd));
    inkUnion(ctx, (g) => { for (const s of shapes) tracePolygon(g, s); }, P.ink, LINE.silhouette, k);
    shapes.forEach((s, i) => {
      const [x, y, rx, ry] = pads[i], px = cx + x * w * 0.5, py = y * h;
      ctx.beginPath(); tracePolygon(ctx, s); ctx.fillStyle = tones.base; ctx.fill();
      clipped(ctx, (g) => tracePolygon(g, s), () => { fillEllipse(ctx, px - rx * k * 0.3, py - ry * k * 0.3, rx * k * 0.7, ry * k * 0.7, tones.light); fillEllipse(ctx, px + rx * k * 0.55, py + ry * k * 0.5, rx * k * 0.8, ry * k * 0.8, tones.shade); });
      strokePath(ctx, (g) => tracePolygon(g, s), P.ink, LINE.detail * k);
      for (let q = 0; q < 5; q++) fillEllipse(ctx, px + jit(rnd, rx * k * 0.6), py + jit(rnd, ry * k * 0.6), 1.1 * k, 1.1 * k, P.ink);
      if (i > 2) { fillEllipse(ctx, px, py - ry * k, 5.5 * k, 5.5 * k, P.ink); fillEllipse(ctx, px, py - ry * k, 3.6 * k, 3.6 * k, P.banners[i % 2 ? 0 : 1]); }
    });
  }
  for (const x of [-0.5, 0.44]) grassTuft(ctx, cx + x * w * 0.5, h - 4 * k, 9 * k, P.ink, k, rnd, P.dry);
}

const BOULDERS = [
  { outline: [[14, 168], [8, 118], [40, 60], [104, 26], [176, 36], [232, 86], [246, 140], [236, 168]], light: [[40, 60], [104, 26], [176, 36], [150, 78], [70, 92]], shade: [[176, 36], [232, 86], [246, 140], [236, 168], [150, 168], [150, 78]] },
  { outline: [[10, 168], [22, 104], [70, 50], [130, 58], [168, 30], [220, 70], [248, 132], [240, 168]], light: [[22, 104], [70, 50], [130, 58], [110, 104], [50, 120]], shade: [[168, 30], [220, 70], [248, 132], [240, 168], [164, 168], [140, 96], [130, 58]] },
];
/** Boulder: a faceted block with a lit top and a shaded flank. */
function boulder(ctx, w, h, P, rnd, variant) {
  const k = w / 256, b = BOULDERS[variant % 2], at = ([x, y]) => [x * k, h - (176 - y - 8) * k + 0];
  const move = new Map(), pt = (p) => { const key = p.join(','); if (!move.has(key)) move.set(key, p[1] >= 160 ? at(p) : at([p[0] + jit(rnd, 5), p[1] + jit(rnd, 4)])); return move.get(key); };
  groundShadow(ctx, w * 0.54, h - 7 * k, w * 0.46, 7 * k);
  const outline = b.outline.map(pt);
  inkUnion(ctx, (g) => tracePolygon(g, outline), P.ink, LINE.silhouette, k);
  ctx.beginPath(); tracePolygon(ctx, outline); ctx.fillStyle = P.rock; ctx.fill();
  clipped(ctx, (g) => tracePolygon(g, outline), () => {
    fillPoly(ctx, b.light.map(pt), P.rockLight); fillPoly(ctx, b.shade.map(pt), P.rockShade);
    for (let i = 0; i < 3; i++) { const p = pt(b.light[(i + 1) % b.light.length]); brushStroke(ctx, [p, [p[0] + (20 + rnd() * 30) * k, p[1] + (26 + rnd() * 30) * k]], LINE.detail * k * 1.1, { color: P.ink, taperStart: 0.1, taperEnd: 0.6, seed: i }); }
  });
  strokePath(ctx, (g) => tracePolygon(g, outline), P.ink, LINE.form * k);
  for (const x of [30, 128, 218]) grassTuft(ctx, (x + jit(rnd, 8)) * k, h - 4 * k, (11 + rnd() * 5) * k, mixHex(P.ink, P.grassDark, 0.15), k, rnd, P.grassDark);
}

/** A few stones and a tuft: small things at the foot of the barriers. */
function stones(ctx, w, h, P, rnd, variant) {
  const k = w / 160, ground = h - 4 * k;
  const list = variant % 2 ? [[34, 16, 12], [86, 22, 15], [128, 12, 9]] : [[26, 13, 10], [62, 9, 7], [104, 20, 14], [140, 10, 8]];
  const shapes = list.map(([x, rx, ry]) => ringPoints(x * k, ground - ry * k * 0.7, rx * k, ry * k, 7, 0.14, rnd));
  inkUnion(ctx, (g) => { for (const s of shapes) tracePolygon(g, s); }, P.ink, LINE.form, k);
  shapes.forEach((s, i) => {
    ctx.beginPath(); tracePolygon(ctx, s); ctx.fillStyle = P.rock; ctx.fill();
    clipped(ctx, (g) => tracePolygon(g, s), () => { fillEllipse(ctx, list[i][0] * k - 3 * k, ground - list[i][2] * k * 1.2, list[i][1] * k * 0.7, list[i][2] * k * 0.6, P.rockLight); fillRect(ctx, list[i][0] * k + list[i][1] * k * 0.3, 0, w, h, P.rockShade); });
  });
  grassTuft(ctx, (variant % 2 ? 60 : 82) * k, h - 3 * k, 12 * k, mixHex(P.ink, P.grassDark, 0.15), k, rnd, P.grassDark);
}

/** Traffic cone on its square base. */
function cone(ctx, w, h, P) {
  const k = w / 56, ground = h - 4 * k, cx = w / 2, orange = paintTonesOf(P.banners[5]);
  groundShadow(ctx, cx + 4 * k, ground, 24 * k, 3.5 * k);
  const body = [[cx - 6 * k, 8 * k], [cx + 6 * k, 8 * k], [cx + 17 * k, ground - 7 * k], [cx - 17 * k, ground - 7 * k]];
  inkGroup(ctx, P, [{ p: body, fill: orange.base }, { r: [cx - 23 * k, ground - 8 * k, 46 * k, 8 * k], fill: orange.shade }], LINE.form * k, 1, 'round');
  clipped(ctx, (g) => tracePolygon(g, body), () => {
    fillRect(ctx, cx + 2 * k, 0, w, h, orange.shade);
    fillRect(ctx, 0, 30 * k, w, 12 * k, P.paint); fillRect(ctx, 0, 54 * k, w, 9 * k, P.paint);
    fillRect(ctx, cx + 2 * k, 30 * k, w, 12 * k, shadeHex(P.paint, 0.18)); fillRect(ctx, cx + 2 * k, 54 * k, w, 9 * k, shadeHex(P.paint, 0.18));
  });
}

/** Reflector post: a white stake with a dark band and a red reflector. */
function markerPost(ctx, w, h, P) {
  const k = w / 40, ground = h - 4 * k, cx = w / 2;
  groundShadow(ctx, cx + 3 * k, ground, 14 * k, 2.6 * k);
  const body = [[cx - 7 * k, ground], [cx - 7 * k, 12 * k], [cx + 7 * k, 6 * k], [cx + 7 * k, ground]];
  inkGroup(ctx, P, [{ p: body, fill: P.paint }], LINE.form * k, 1, 'round');
  clipped(ctx, (g) => tracePolygon(g, body), () => { fillRect(ctx, cx + 2 * k, 0, w, h, shadeHex(P.paint, 0.2)); fillPoly(ctx, [[0, 30 * k], [w, 22 * k], [w, 46 * k], [0, 54 * k]], P.ink); });
  fillRect(ctx, cx - 4 * k, 31 * k, 8 * k, 12 * k, P.banners[0]);
}

/** Stack of tyres strapped together. */
function tyreStack(ctx, w, h, P) {
  const k = w / 136, ground = h - 5 * k, black = { light: lightHex(P.tyreLight, 0.22), base: P.tyreLight, shade: P.tyre };
  groundShadow(ctx, w / 2 + 6 * k, ground, 62 * k, 5 * k);
  const cols = [[36 * k, 4], [98 * k, 4], [67 * k, 3]];
  for (const [cx, count] of cols) {
    for (let i = 0; i < count; i++) {
      const y = ground - (i + 0.5) * 25 * k - (count === 3 ? 4 * k : 0), rx = 31 * k, ry = 13.5 * k;
      const tyre = (g) => { g.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2); };
      contour(ctx, tyre, P.ink, LINE.form * k, 1, 'round');
      fillEllipse(ctx, cx, y, rx, ry, black.base);
      fillEllipse(ctx, cx - 3 * k, y - 4 * k, rx * 0.86, ry * 0.5, black.light);
      fillEllipse(ctx, cx, y - 3 * k, rx * 0.5, ry * 0.42, P.ink);
      fillEllipse(ctx, cx + 9 * k, y + 5 * k, rx * 0.6, ry * 0.4, black.shade);
    }
  }
  fillRect(ctx, 30 * k, ground - 100 * k, 5 * k, 96 * k, P.banners[1]); fillRect(ctx, 96 * k, ground - 100 * k, 5 * k, 96 * k, P.banners[1]);
}

/** Bale of straw bound with two strings. */
function hayBale(ctx, w, h, P, rnd) {
  const k = w / 176, ground = h - 5 * k, straw = { light: P.dryLight, base: P.dry, shade: P.dryShade };
  groundShadow(ctx, w / 2 + 8 * k, ground, 84 * k, 5 * k);
  const front = [[10 * k, ground], [10 * k, 26 * k], [132 * k, 26 * k], [132 * k, ground]], side = [[132 * k, ground], [132 * k, 26 * k], [166 * k, 12 * k], [166 * k, ground - 12 * k]], top = [[10 * k, 26 * k], [44 * k, 12 * k], [166 * k, 12 * k], [132 * k, 26 * k]];
  inkGroup(ctx, P, [{ p: front, fill: straw.base }, { p: side, fill: straw.shade }, { p: top, fill: straw.light }], LINE.form * k, 1, 'round');
  for (const p of [front, side, top]) strokePath(ctx, (g) => tracePolygon(g, p), P.ink, LINE.detail * k);
  for (let i = 0; i < 16; i++) { const x = (14 + rnd() * 114) * k, y = (32 + rnd() * 44) * k; brushStroke(ctx, [[x, y], [x + (8 + rnd() * 10) * k, y + jit(rnd, 3 * k)]], LINE.hair * k * 1.3, { color: straw.shade, taper: 0.4 }); }
  for (const x of [46 * k, 98 * k]) { inkLine(ctx, x, 26 * k, x, ground, LINE.detail * k, P.ink); inkLine(ctx, x, 26 * k, x + 34 * k, 12 * k, LINE.detail * k, P.ink); }
  for (let i = 0; i < 5; i++) { const x = (6 + rnd() * 130) * k; brushStroke(ctx, [[x, ground], [x + jit(rnd, 6 * k), ground + 3 * k]], LINE.detail * k, { color: straw.base, taper: 0.5 }); }
}

/** Oil drum painted in two colours. */
function barrel(ctx, w, h, P) {
  const k = w / 88, ground = h - 5 * k, cx = w / 2, tones = paintTonesOf(P.banners[2]);
  groundShadow(ctx, cx + 5 * k, ground, 38 * k, 4.5 * k);
  const body = (g) => { g.moveTo(cx - 30 * k, 16 * k); g.lineTo(cx - 30 * k, ground - 8 * k); g.quadraticCurveTo(cx, ground + 6 * k, cx + 30 * k, ground - 8 * k); g.lineTo(cx + 30 * k, 16 * k); g.quadraticCurveTo(cx, 2 * k, cx - 30 * k, 16 * k); g.closePath(); };
  contour(ctx, body, P.ink, LINE.form * k, 1, 'round');
  fillTrace(ctx, body, tones.base);
  clipped(ctx, body, () => {
    fillRect(ctx, cx + 8 * k, 0, w, h, tones.shade); fillRect(ctx, cx - 26 * k, 0, 8 * k, h, tones.light);
    fillRect(ctx, 0, 44 * k, w, 22 * k, P.banners[1]); fillRect(ctx, cx + 8 * k, 44 * k, w, 22 * k, shadeHex(P.banners[1], 0.24));
    for (const y of [40 * k, 68 * k]) fillRect(ctx, 0, y, w, 3 * k, P.ink);
  });
  fillEllipse(ctx, cx, 17 * k, 30 * k, 9 * k, P.ink); fillEllipse(ctx, cx, 16.5 * k, 27 * k, 7 * k, tones.light);
  fillEllipse(ctx, cx + 10 * k, 16 * k, 4 * k, 2 * k, P.ink);
}

/** Foot of a barrier in a green country: tufts of grass and a few flowers. Tiles seamlessly; mostly empty. */
function tuftStrip(ctx, w, h, P, rnd) {
  const k = h / 72, ink = mixHex(P.ink, P.grassDark, 0.2);
  wrapped(ctx, w, rnd, (r) => {
    for (let i = 0; i < 14; i++) {
      const x = ((i + r() * 0.8) / 14) * w, size = (20 + r() * 30) * k;
      grassTuft(ctx, x, h - 2 * k, size, ink, k, r, r() < 0.5 ? P.grassDark : P.leaf);
      if (r() < 0.3) { const fx = x + jit(r, 8 * k), fy = h - size * 0.8; fillEllipse(ctx, fx, fy, 3.4 * k, 3.4 * k, P.ink); fillEllipse(ctx, fx, fy, 2.2 * k, 2.2 * k, P.banners[r() < 0.5 ? 1 : 3]); }
    }
  });
}

/** Foot of a barrier in sand or gravel: a low drift with pebbles and dry tufts. Tiles seamlessly. */
function sandStrip(ctx, w, h, P, rnd) {
  const k = h / 72;
  wrapped(ctx, w, rnd, (r) => {
    // (the same height at both ends of the tile, so that the drift runs on without a step)
    const heights = [];
    for (let i = 0; i < 12; i++) heights.push((10 + r() * 22 + (i % 3 === 1 ? 14 : 0)) * k);
    heights.push(heights[0]);
    const crest = [[0, h]];
    for (let i = 0; i <= 12; i++) crest.push([(i / 12) * w, h - heights[i]]);
    crest.push([w, h]);
    ctx.beginPath(); tracePolygon(ctx, crest); ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.form * k * 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = P.gravelA; ctx.fill();
    clipped(ctx, (g) => tracePolygon(g, crest), () => { for (let i = 0; i < 12; i++) { const x = r() * w, y = h - r() * 16 * k; fillEllipse(ctx, x, y, (3 + r() * 5) * k, (2 + r() * 2) * k, P.gravelB); } fillRect(ctx, 0, h - 5 * k, w, 5 * k, P.gravelB); });
    for (let i = 0; i < 5; i++) grassTuft(ctx, r() * w, h - 3 * k, (14 + r() * 16) * k, mixHex(P.ink, P.dryShade, 0.25), k, r, P.dry);
  });
}

export const TRACKSIDE_OBJECT_PAINTERS = {
  'sign.chevron': chevronSign,
  'sign.turn': turnSign,
  'sign.advert.low': advertLow,
  'sign.advert.high': advertHigh,
  'gantry.banner': bannerGantry,
  'tunnel.portal': tunnelPortal,
  'tunnel.arch': tunnelArch,
  'strip.tunnelwall': tunnelWall,
  'tree.oak': oak,
  'tree.poplar': poplar,
  cactus,
  boulder,
  stones,
  cone,
  'marker.post': markerPost,
  tyrestack: tyreStack,
  haybale: hayBale,
  barrel,
  'strip.tufts': tuftStrip,
  'strip.sandbank': sandStrip,
};
