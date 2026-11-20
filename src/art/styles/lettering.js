// Procedural comic-book hand lettering ("lettrage BD"). Every glyph is a pen skeleton: a few
// polylines in an em box (cap height = 1, baseline y = 0, y up, x to the right) that is stroked
// with Canvas 2D paths. No font files, no system fonts, no fillText. Three styles share the same
// skeleton: 'caption' (monoline round pen), 'bold' (heavier pen, headings and HUD values) and
// 'impact' (outlined block letters for titles and onomatopoeia).
// All capitals: lowercase input maps to uppercase, unknown characters fall back to '?'.

// ---- skeleton source -------------------------------------------------------------------------
// Grid: 100 units = cap height. An entry is 'left right|stroke|stroke...' (side bearings measured
// from the skeleton bounds) or '=advance|stroke...' (fixed advance, skeleton centred: tabular
// digits). A stroke is a list of points: 'x,y' is on the curve, 'cx,y' is a quadratic control
// point (two consecutive controls imply an on-curve midpoint, TrueType style) and a final 'z'
// closes the stroke. 'ecx,cy,rx,ry[,k]' is a closed round (k = squareness, 0.414 = true ellipse)
// and 'ox,y' a dot. Horizontal bars rise slightly to the right, as a right-handed pen does.
const SOURCE = {
  A: '4 4|0,0 36,100 72,0|10,28 61,31',
  B: '13 7|0,0 0,100 22,101 c45,101 45,78 c45,55 23,55 0,54|23,55 27,55 c52,55 52,27 c52,0 25,0 0,0',
  C: '8 4|65,86 c54,101.5 c22,101.5 c0,71 c0,29 c22,-1.5 c54,-1.5 65,14',
  D: '13 8|0,0 0,100 20,101 c42,101 c64,76 64,50 c64,24 c42,0 20,0 0,0',
  E: '13 5|46,101 0,99 0,0 48,2|0,51 38,53',
  F: '13 3|46,101 0,99 0,0|0,50 37,52',
  G: '8 10|65,87 c54,101.5 c22,101.5 c0,71 c0,29 c20,-1.5 c46,-1.5 c68,6 68,30 68,46 40,45',
  H: '13 13|0,0 0,100|62,0 62,100|0,49 62,52',
  I: '13 13|0,0 0,100',
  J: '4 12|40,100 40,26 c40,-1.5 19,-1.5 c3,-1.5 0,19',
  K: '13 3|0,0 0,100|54,100 0,43|17,61 56,0',
  L: '13 3|0,100 0,0 46,2',
  M: '12 12|0,0 5,100 41,20 77,100 82,0',
  N: '13 13|0,0 0,100 62,0 62,100',
  O: '8 8|e39,50,39,51.5',
  P: '13 5|0,0 0,100 23,101 c49,101 49,74 c49,47 23,47 0,46',
  Q: '8 8|e39,50,39,51.5|45,24 c58,6 80,-9',
  R: '13 4|0,0 0,100 23,101 c48,101 48,76 c48,51 23,50 0,49|24,50 c41,27 55,0',
  S: '8 8|47,84 c37,101.5 c14,101.5 c2,89 c2,66 c12,56 c39,45 c51,36 c51,13 c38,-1.5 c12,-1.5 0,17',
  T: '4 4|0,99 64,102|32,100 32,0',
  U: '12 12|0,100 0,30 c0,12 c13,-1.5 30,-1.5 c47,-1.5 c60,12 60,30 60,100',
  V: '3 3|0,100 33,0 66,100',
  W: '4 4|0,100 23,0 48,78 73,0 96,100',
  X: '5 5|2,100 60,0|58,100 0,0',
  Y: '3 3|0,100 31,47 62,100|31,47 31,0',
  Z: '6 6|2,99 58,101 0,0 60,2',
  0: '=74|e26,50,26,51.5,0.5',
  1: '=74|7,76 29,100 29,0|9,0 49,0',
  2: '=74|3,79 c7,101.5 c40,101.5 c50,92 c50,60 0,0 52,2',
  3: '=74|3,82 c8,101.5 c40,101.5 c47,90 c47,64 c38,54 20,53 c40,53 c51,42 c51,12 c40,-1.5 c8,-1.5 0,18',
  4: '=74|40,0 40,100 0,32 54,34',
  5: '=74|46,101 8,100 5,56 c16,64 c38,64 c51,52 c51,12 c40,-1.5 c8,-1.5 0,16',
  6: '=74|46,90 c38,101.5 c22,101.5 c0,84 c0,17.5 c15.2,-1.5 c36.8,-1.5 c52,17.5 c52,44.5 c36.8,63.5 c15.2,63.5 1,42',
  7: '=74|2,99 52,101 c35,60 22,0|20,50 48,52',
  8: '=74|c48,90 c38,101.5 c14,101.5 c4,90 c4,66 c12,58 c40,44 c52,36 c52,12 c40,-1.5 c12,-1.5 c0,12 c0,36 c12,44 c40,58 c48,66 z',
  9: '=74|6,10 c14,-1.5 c30,-1.5 c52,16 c52,82.5 c36.8,101.5 c15.2,101.5 c0,82.5 c0,55.5 c15.2,36.5 c36.8,36.5 51,58',
  ' ': '=30',
  '.': '11 11|o0,3',
  ',': '9 11|6,5 c6,-8 0,-16',
  ':': '11 11|o0,12|o0,56',
  ';': '9 11|o5,56|6,5 c6,-8 0,-16',
  '!': '12 12|1,100 0,30|o0,3',
  '?': '8 8|2,80 c6,101.5 c36,101.5 c46,92 c46,64 c23,54 23,29|o23,3',
  "'": '8 8|3,104 0,78',
  '"': '8 8|3,104 0,78|19,104 16,78',
  '-': '8 8|0,42 30,44',
  '–': '8 8|0,42 52,45',
  '+': '8 8|0,46 48,48|24,70 24,24',
  '/': '5 5|0,-6 40,106',
  '(': '8 4|20,110 c0,84 c0,16 20,-10',
  ')': '4 8|0,110 c20,84 c20,16 0,-10',
  '%': '8 8|10,0 62,100|e13,78,13,17|e59,22,13,17',
  '&': '8 4|58,0 16,62 c5,78 c10,101.5 c38,101.5 c42,76 c0,50 c0,-1.5 c36,-1.5 56,46',
  '#': '7 7|14,0 22,100|42,0 50,100|0,32 62,34|2,66 64,68',
  '°': '7 7|e12,86,12,14',
  '<': '8 8|46,82 0,48 46,14',
  '>': '8 8|0,82 46,48 0,14',
  '=': '8 8|0,60 48,62|0,32 48,34',
  '*': '7 7|20,97 20,53|1,86 39,64|1,64 39,86',
  _: '2 2|0,-14 56,-14',
  '×': '8 8|2,70 46,24|2,24 46,70',
  '«': '8 8|22,68 0,46 22,24|48,68 26,46 48,24',
  '»': '8 8|0,68 22,46 0,24|26,68 48,46 26,24',
  'Œ': '8 5|e31,50,31,51.5,0.46|104,101 60,99 60,0 106,2|60,51 96,53',
  'Æ': '4 5|0,0 44,100 88,101|44,100 44,0 90,2|44,51 80,53|15,33 44,34',
  // the crossbar "I" of comic lettering, used when the letter stands alone (the English pronoun)
  'I serif': '8 8|15,0 15,100|0,99 30,101|0,0 30,2',
};

// Accent strokes, x relative to the centre of the base letter. Keys are Unicode combining marks,
// so accented capitals are composed from their canonical decomposition.
const ACCENTS = {
  '́': '-7,115 11,133',
  '̀': '7,115 -11,133',
  '̂': '-15,115 0,131 15,115',
  '̈': 'o-12,124|o12,124',
  '̃': '-17,119 c-9,133 0,124 c9,115 17,129',
  '̧': '1,-1 -2,-9 c10,-9 c10,-25 -7,-22',
};
const ACCENTED = 'ÉÈÊËÀÂÄÇÙÛÜÎÏÔÖÁÍÓÚÌÒÑÃÕŸ';
const ACCENT_ANCHOR = { C: 37 };

// Kerning for the worst pairs (grid units), keyed by base letters.
const KERN_SOURCE = 'AV-9 AW-6 AY-10 AT-9 VA-9 WA-6 YA-10 TA-9 LT-9 LV-9 LY-10 LW-6 PA-6 FA-7 TJ-8 FJ-8 PJ-8'
  + ' TO-3 OT-3 VO-3 OV-3 YO-4 OY-4 AO-2 OA-2 AC-2 AG-2 AQ-2 DA-2 KO-3 RT-3 RV-3 RY-4 XO-2 OX-2'
  + ' T.-9 V.-9 Y.-10 P.-9 F.-9 T,-9 V,-9 Y,-10 P,-9 F,-9 L\'-9 A\'-7 \'A-9 L"-9 A"-7 "A-9 T--6 -T-6 7.-6 7,-6';

const UNIT = 0.01;
const DOT_RADIUS = 2.4;
const ROUND = 0.44;
const BASE_PEN = 0.11;
const INK = '#16161f';

const STYLES = {
  caption: { pen: 0.11, slant: 0.14, stretch: 1, gap: 0, block: false, wobble: 1, accentPen: 0.88, color: INK, outline: null },
  bold: { pen: 0.17, slant: 0.14, stretch: 1.05, gap: 0.005, block: false, wobble: 1, accentPen: 0.8, color: INK, outline: null },
  impact: { pen: 0.26, slant: 0.12, stretch: 1.14, gap: 0.055, block: true, wobble: 0.7, accentPen: 0.62, color: '#ffd42a', outline: INK },
};
const OUTLINE_WIDTH = 0.045;

function numbers(text) { return text.split(',').map(Number); }

/** Flatten a list of [x, y, onCurve] points (quadratic, implied midpoints) into a flat polyline. */
function flatten(points, closed) {
  const seq = [];
  const count = points.length;
  for (let i = 0; i < count; i++) {
    const p = points[i], q = points[(i + 1) % count];
    seq.push(p);
    if (!p[2] && !q[2] && (closed || i < count - 1)) seq.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, true]);
  }
  if (closed) {
    seq.push(...seq.splice(0, seq.findIndex((p) => p[2])));
    seq.push(seq[0]);
  }
  const out = [seq[0][0], seq[0][1]];
  for (let i = 1; i < seq.length; i++) {
    const p = seq[i];
    if (p[2]) { out.push(p[0], p[1]); continue; }
    const ax = out[out.length - 2], ay = out[out.length - 1], b = seq[++i];
    const ux = p[0] - ax, uy = p[1] - ay, vx = b[0] - p[0], vy = b[1] - p[1];
    const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
    const steps = Math.max(1, Math.min(Math.ceil(turn / 0.07), Math.ceil((Math.hypot(ux, uy) + Math.hypot(vx, vy)) / 1.2)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, u = 1 - t;
      out.push(u * u * ax + 2 * u * t * p[0] + t * t * b[0], u * u * ay + 2 * u * t * p[1] + t * t * b[1]);
    }
  }
  return out;
}

function ring(cx, cy, rx, ry, k) {
  const corners = [[1, k], [k, 1], [-k, 1], [-1, k], [-1, -k], [-k, -1], [k, -1], [1, -k]];
  return flatten(corners.map(([a, b]) => [cx + a * rx, cy + b * ry, false]), true);
}

function expandStroke(source) {
  const tokens = source.trim().split(/\s+/);
  const head = tokens[0];
  if (head[0] === 'o') { const [x, y] = numbers(head.slice(1)); return ring(x, y, DOT_RADIUS, DOT_RADIUS, 0.414); }
  if (head[0] === 'e') { const [cx, cy, rx, ry, k] = numbers(head.slice(1)); return ring(cx, cy, rx, ry, k || ROUND); }
  const closed = tokens[tokens.length - 1] === 'z';
  if (closed) tokens.pop();
  return flatten(tokens.map((t) => (t[0] === 'c' ? [...numbers(t.slice(1)), false] : [...numbers(t), true])), closed);
}

function boundsX(strokes) {
  let min = Infinity, max = -Infinity;
  for (const s of strokes) for (let i = 0; i < s.length; i += 2) { min = Math.min(min, s[i]); max = Math.max(max, s[i]); }
  return min > max ? [0, 0] : [min, max];
}

function toEm(strokes, shift) {
  return strokes.map((s) => s.map((v, i) => Math.round((i % 2 ? v : v + shift) * UNIT * 1e4) / 1e4));
}

/** Glyph record: w = advance (em), s = polylines (em), a = index of the first accent stroke, k = kerning letter. */
function buildGlyph(char, source) {
  const parts = source.split('|');
  const strokes = parts.slice(1).map(expandStroke);
  const [min, max] = boundsX(strokes);
  let shift, advance;
  if (parts[0][0] === '=') {
    advance = Number(parts[0].slice(1));
    shift = (advance - (max - min)) / 2 - min;
  } else {
    const [left, right] = numbers(parts[0].replace(' ', ','));
    shift = left - min;
    advance = left + (max - min) + right;
  }
  return { w: advance * UNIT, s: toEm(strokes, shift), a: strokes.length, k: char };
}

function buildAccented(char, glyphs) {
  const [base, mark] = char.normalize('NFD');
  const glyph = glyphs[base];
  const [min, max] = boundsX(glyph.s);
  const anchor = ACCENT_ANCHOR[base] === undefined ? (min + max) / 2 / UNIT : min / UNIT + ACCENT_ANCHOR[base];
  // a wide accent on the narrow I needs a little more room
  const pad = base === 'I' && mark !== '́' && mark !== '̀' ? 0.05 : 0;
  const s = glyph.s.map((stroke) => stroke.map((v, i) => (i % 2 ? v : Math.round((v + pad) * 1e4) / 1e4)));
  return { w: glyph.w + 2 * pad, s: s.concat(toEm(ACCENTS[mark].split('|').map(expandStroke), anchor + pad / UNIT)), a: glyph.s.length, k: base };
}

function buildGlyphs() {
  const glyphs = {};
  for (const char of Object.keys(SOURCE)) glyphs[char] = buildGlyph(char, SOURCE[char]);
  for (const char of ACCENTED) glyphs[char] = buildAccented(char, glyphs);
  glyphs['Œ'].k = 'O';
  glyphs['I serif'].k = 'I';
  return glyphs;
}

/** Expanded glyph table: char -> { w: advance in em, s: [[x0, y0, x1, y1, ...], ...] } (cap height 1, y up). */
export const GLYPHS = buildGlyphs();

/** Every supported character (uppercase forms). */
export const LETTERING_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?\'"-–+/()%&#°<>=*_×ÉÈÊËÀÂÄÇÙÛÜÎÏÔÖŒÆÁÍÓÚÌÒÑÃÕŸ«»';

const KERN = {};
for (const pair of KERN_SOURCE.split(' ')) KERN[pair.slice(0, 2)] = Number(pair.slice(2)) * UNIT;

const ALIASES = { '’': "'", '‘': "'", '`': "'", '´': "'", '“': '"', '”': '"', '„': '"', '—': '–', '−': '-', '‑': '-', '·': '.', ' ': ' ', ' ': ' ', ' ': ' ', '\t': ' ', '\n': ' ', '[': '(', ']': ')', '\\': '/', 'º': '°' };

function normalize(text) {
  return Array.from(String(text).toUpperCase().replace(/…/g, '...'), (c) => ALIASES[c] || c);
}

function isAlphanumeric(c) { return c !== undefined && /[A-Z0-9À-ÖØ-ÞŒŸ]/.test(c); }

function styleOf(options) { return STYLES[options && options.style] || STYLES.caption; }

/** Position the glyphs of one line. Returns { glyphs, xs, extra, width } in em. */
function layout(text, style, options) {
  const chars = normalize(text);
  const extra = style.pen * (options.weight || 1) - BASE_PEN + style.gap;
  const tracking = options.tracking || 0;
  const glyphs = [], xs = [];
  let pen = 0, previous = null;
  for (let i = 0; i < chars.length; i++) {
    let glyph = GLYPHS[chars[i]] || GLYPHS['?'];
    if (chars[i] === 'I' && !isAlphanumeric(chars[i - 1]) && !isAlphanumeric(chars[i + 1])) glyph = GLYPHS['I serif'];
    if (previous) pen += (KERN[previous.k + glyph.k] || 0) * style.stretch + tracking;
    glyphs.push(glyph);
    xs.push(pen);
    pen += glyph.w * style.stretch + extra;
    previous = glyph;
  }
  return { glyphs, xs, extra, width: pen };
}

/** Deterministic noise in [-1, 1) from a character code, its position, a seed and a channel. */
function noise(code, index, seed, channel) {
  let h = Math.imul(code + 1, 374761393) ^ Math.imul(index + 1, 668265263) ^ Math.imul(seed + 7, 1274126177) ^ Math.imul(channel, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 2147483648 - 1;
}

// ---- block letters ('impact') ------------------------------------------------------------------
// The thick pen uses mitred joins and flat ends. Canvas has no clipped mitre, so sharp corners
// (A, M, N, V, W...) are split in two close vertices, which cuts the spike flat at pen distance,
// and stroke ends are squared off by hand: free ends are extended by half the pen width, ends
// that butt against another stroke (the bar of an A, the arm of a K) are left flush.
const blockCache = new Map();

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t];
}

function arcLengths(pts) {
  const lengths = [0];
  for (let i = 2; i < pts.length; i += 2) lengths.push(lengths[lengths.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
  return lengths;
}

function isClosed(pts) { const n = pts.length; return n > 4 && pts[0] === pts[n - 2] && pts[1] === pts[n - 1]; }

/** Extension factor of one stroke end: 0 = flush (junction), 1 = squared free end, 0.4 = free end of a curve. */
function endFactor(strokes, lengths, index, atEnd) {
  const pts = strokes[index], own = lengths[index], total = own[own.length - 1];
  const n = pts.length / 2;
  const px = atEnd ? pts[2 * n - 2] : pts[0], py = atEnd ? pts[2 * n - 1] : pts[1];
  let best = Infinity, nearEnd = false;
  for (let j = 0; j < strokes.length; j++) {
    const other = strokes[j], len = lengths[j], length = len[len.length - 1], closed = isClosed(other);
    for (let k = 0; k + 1 < len.length; k++) {
      if (j === index && (atEnd ? total - len[k + 1] : len[k]) < 0.2) continue;
      const [d, t] = segmentDistance(px, py, other[2 * k], other[2 * k + 1], other[2 * k + 2], other[2 * k + 3]);
      if (d >= best) continue;
      const at = len[k] + t * (len[k + 1] - len[k]);
      best = d;
      nearEnd = !closed && (at < 0.05 || length - at < 0.05);
    }
  }
  if (best < 0.075) return nearEnd ? 1 : 0;
  // curved end: the direction turns noticeably within the first 0.15 em
  const step = atEnd ? -1 : 1;
  let i = atEnd ? n - 1 : 0;
  const d0 = Math.atan2(pts[2 * (i + step) + 1] - pts[2 * i + 1], pts[2 * (i + step)] - pts[2 * i]);
  let turned = 0;
  while (i + step >= 0 && i + step < n && Math.abs(own[i + step] - own[atEnd ? n - 1 : 0]) < 0.15) {
    const d1 = Math.atan2(pts[2 * (i + step) + 1] - pts[2 * i + 1], pts[2 * (i + step)] - pts[2 * i]);
    turned = Math.max(turned, Math.abs(Math.atan2(Math.sin(d1 - d0), Math.cos(d1 - d0))));
    i += step;
  }
  return turned > 0.35 ? 0.4 : 1;
}

function splitSharpCorners(pts) {
  const closed = isClosed(pts);
  const count = pts.length / 2 - (closed ? 1 : 0);
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = pts[2 * i], y = pts[2 * i + 1];
    const p = closed ? (i + count - 1) % count : i - 1, q = closed ? (i + 1) % count : i + 1;
    if (p < 0 || q >= count) { out.push(x, y); continue; }
    let ux = x - pts[2 * p], uy = y - pts[2 * p + 1], vx = pts[2 * q] - x, vy = pts[2 * q + 1] - y;
    const ul = Math.hypot(ux, uy) || 1, vl = Math.hypot(vx, vy) || 1;
    ux /= ul; uy /= ul; vx /= vl; vy /= vl;
    if (ux * vx + uy * vy > -0.375) { out.push(x, y); continue; }
    // across the corner: perpendicular to the bisector, oriented along the direction of travel
    let tx = -(vy - uy), ty = vx - ux;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    if (tx * (ux + vx) + ty * (uy + vy) < 0) { tx = -tx; ty = -ty; }
    out.push(x - tx * 0.012, y - ty * 0.012, x + tx * 0.012, y + ty * 0.012);
  }
  if (closed) out.push(out[0], out[1]);
  return out;
}

function blockGlyph(glyph) {
  let block = blockCache.get(glyph);
  if (!block) {
    const lengths = glyph.s.map(arcLengths);
    block = {
      s: glyph.s.map(splitSharpCorners),
      e: glyph.s.map((pts, i) => (isClosed(pts) ? [0, 0] : [endFactor(glyph.s, lengths, i, false), endFactor(glyph.s, lengths, i, true)])),
    };
    blockCache.set(glyph, block);
  }
  return block;
}

// ---- drawing -------------------------------------------------------------------------------------
let scratch = new Float64Array(512);

/**
 * Add one polyline to the current path. m = [a, b, c, d, e, f] maps em to pixels
 * (px = a x + c y + e, py = b x + d y + f); `lift` moves the stroke vertically in em (accents);
 * ext0 / ext1 extend the two ends in pixels (squared block-letter ends).
 */
function tracePolyline(ctx, pts, m, lift, ext0, ext1) {
  const n = pts.length;
  if (scratch.length < n) scratch = new Float64Array(n * 2);
  for (let i = 0; i < n; i += 2) {
    const x = pts[i], y = pts[i + 1] + lift;
    scratch[i] = m[0] * x + m[2] * y + m[4];
    scratch[i + 1] = m[1] * x + m[3] * y + m[5];
  }
  const closed = n > 4 && pts[0] === pts[n - 2] && pts[1] === pts[n - 1];
  if (ext0 > 0 && n >= 4) {
    const dx = scratch[0] - scratch[2], dy = scratch[1] - scratch[3], l = Math.hypot(dx, dy) || 1;
    scratch[0] += dx / l * ext0; scratch[1] += dy / l * ext0;
  }
  if (ext1 > 0 && n >= 4) {
    const dx = scratch[n - 2] - scratch[n - 4], dy = scratch[n - 1] - scratch[n - 3], l = Math.hypot(dx, dy) || 1;
    scratch[n - 2] += dx / l * ext1; scratch[n - 1] += dy / l * ext1;
  }
  ctx.moveTo(scratch[0], scratch[1]);
  const last = closed ? n - 2 : n;
  for (let i = 2; i < last; i += 2) ctx.lineTo(scratch[i], scratch[i + 1]);
  if (closed) ctx.closePath();
}

/** Width in pixels of one line of text. options: { style, tracking, weight }. */
export function measureText(text, size, options) {
  const o = options || {};
  return layout(text, styleOf(o), o).width * size;
}

/**
 * Draw one line of text with its baseline at y; `size` is the cap height in pixels. Returns the width.
 * options: { style: 'caption' | 'bold' | 'impact', color, outline: null | color, outlineWidth (px),
 *   align: 'left' | 'center' | 'right', tracking (em), slant (radians), weight (pen multiplier),
 *   shadow: null | { dx, dy, color } (px), seed, bounce (0..1 per-letter size / baseline / rotation
 *   variation for onomatopoeia), jitter (hand irregularity multiplier, default 1) }.
 */
export function drawText(ctx, text, x, y, size, options) {
  const o = options || {}, style = styleOf(o);
  const run = layout(text, style, o);
  const width = run.width * size;
  const count = run.glyphs.length;
  if (!ctx || !count) return width;
  const left = x - (o.align === 'center' ? width / 2 : o.align === 'right' ? width : 0);
  const pen = style.pen * (o.weight || 1) * size;
  const slant = Math.tan(o.slant === undefined ? style.slant : o.slant);
  const seed = o.seed | 0, bounce = o.bounce || 0;
  const wobble = (o.jitter === undefined ? 1 : o.jitter) * style.wobble;
  const outline = o.outline === undefined ? style.outline : o.outline;
  const outlineWidth = outline ? (o.outlineWidth === undefined ? OUTLINE_WIDTH * size : o.outlineWidth) : 0;
  const accentPen = pen * style.accentPen;
  const accentLift = ((pen + accentPen) / 2 + outlineWidth) / size - BASE_PEN;

  // one em-to-pixel matrix per glyph: stretch, slant about mid height, hand irregularities, bounce
  const mats = [], scales = [];
  for (let i = 0; i < count; i++) {
    const glyph = run.glyphs[i], code = glyph.k.charCodeAt(0) + glyph.s.length;
    const scale = 1 + bounce * 0.17 * noise(code, i, seed, 3);
    const angle = wobble * 0.0175 * noise(code, i, seed, 1) + bounce * 0.1 * noise(code, i, seed, 4);
    const rise = wobble * 0.01 * noise(code, i, seed, 2) + bounce * 0.085 * ((i % 2 ? -0.6 : 0.6) + 0.5 * noise(code, i, seed, 5));
    const cos = Math.cos(angle), sin = Math.sin(angle), s = size * scale;
    const a = s * cos * style.stretch, b = -s * sin * style.stretch;
    const c = s * (cos * slant - sin), d = -s * (sin * slant + cos);
    const cx = left + (run.xs[i] + (glyph.w * style.stretch + run.extra) / 2) * size, cy = y - (0.5 + rise) * size;
    mats.push([a, b, c, d, cx - a * glyph.w / 2 - c * 0.5, cy - b * glyph.w / 2 - d * 0.5]);
    scales.push(scale);
  }

  const passes = [];
  if (o.shadow) passes.push([o.shadow.color || INK, outlineWidth, o.shadow.dx === undefined ? 0.05 * size : o.shadow.dx, o.shadow.dy === undefined ? 0.05 * size : o.shadow.dy]);
  if (outlineWidth > 0) passes.push([outline, outlineWidth, 0, 0]);
  passes.push([o.color || style.color, 0, 0, 0]);

  ctx.save();
  ctx.lineCap = style.block ? 'butt' : 'round';
  ctx.lineJoin = style.block ? 'miter' : 'round';
  ctx.miterLimit = 2;
  for (const [color, grow, dx, dy] of passes) {
    ctx.strokeStyle = color;
    // accents are drawn with a lighter pen, in a second batch
    for (let part = 0; part < 2; part++) {
      let current = -1;
      for (let i = 0; i < count; i++) {
        const glyph = run.glyphs[i];
        const from = part ? glyph.a : 0, to = part ? glyph.s.length : glyph.a;
        if (from >= to) continue;
        const lineWidth = (part ? accentPen : pen) * scales[i] + 2 * grow;
        if (lineWidth !== current) {
          if (current >= 0) ctx.stroke();
          ctx.beginPath();
          ctx.lineWidth = current = lineWidth;
        }
        const m = mats[i];
        m[4] += dx; m[5] += dy;
        const block = style.block ? blockGlyph(glyph) : null;
        for (let k = from; k < to; k++) {
          const lift = part ? (glyph.s[k][1] > 0.5 ? accentLift : -accentLift) : 0;
          if (block) tracePolyline(ctx, block.s[k], m, lift, block.e[k][0] * lineWidth / 2, block.e[k][1] * lineWidth / 2);
          else tracePolyline(ctx, glyph.s[k], m, lift, 0, 0);
        }
        m[4] -= dx; m[5] -= dy;
      }
      if (current >= 0) ctx.stroke();
    }
  }
  ctx.restore();
  return width;
}

/** Break a text into lines no wider than maxWidth (spaces and explicit \n). */
function wrapLines(text, maxWidth, size, options) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    // French punctuation: never start a line with "!", "?", ":", ";" or "»", nor end one with "«"
    const words = paragraph.split(' ').filter(Boolean).reduce((list, word) => {
      const glue = list.length && (/^[!?:;»]+$/.test(word) || list[list.length - 1].endsWith('«'));
      if (glue) list[list.length - 1] += ' ' + word; else list.push(word);
      return list;
    }, []);
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (line && measureText(candidate, size, options) > maxWidth) { lines.push(line); line = word; } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Draw word-wrapped text in a box whose top-left corner is (x, y): the cap line of the first row
 * sits at y (accents rise about 0.4 em above it). `align` positions the rows inside [x, x + maxWidth].
 * options: those of drawText plus lineHeight (em, default 1.35). A null ctx only measures.
 * Returns { width, height, lines }.
 */
export function drawTextBox(ctx, text, x, y, maxWidth, size, options) {
  const o = options || {};
  const lineHeight = (o.lineHeight || 1.35) * size;
  const lines = wrapLines(text, maxWidth, size, o);
  const anchor = x + (o.align === 'center' ? maxWidth / 2 : o.align === 'right' ? maxWidth : 0);
  let width = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = Object.assign({}, o, { seed: (o.seed | 0) + i * 131 });
    width = Math.max(width, drawText(ctx, lines[i], anchor, y + size + i * lineHeight, size, row));
  }
  return { width, height: size + (lines.length - 1) * lineHeight, lines };
}

function glyphOf(ch) {
  const char = normalize(ch)[0];
  return GLYPHS[ch] || GLYPHS[char] || GLYPHS['?'];
}

/** Expanded skeleton polylines of one character, in em (cap height 1, baseline 0, y up). Do not mutate. */
export function glyphOutline(ch) { return glyphOf(ch).s; }

/** Advance width of one character in em for a style (default 'caption'). */
export function glyphAdvance(ch, style) {
  const st = STYLES[style] || STYLES.caption;
  return glyphOf(ch).w * st.stretch + st.pen - BASE_PEN + st.gap;
}
