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
// and 'ox,y' a dot. A leading '~' marks a light stroke (drawn with the thinner accent pen; light
// strokes come last). Horizontal bars rise slightly to the right, as a right-handed pen does.
const SOURCE = {
  A: '5 5|0,0 40,100 82,0|11,29 68,33',
  B: '13 8|0,0 0,100 26,102 c52,102 52,79 c52,57 27,56 0,54|27,56 32,56 c60,57 60,28 c60,0 30,0 0,0',
  C: '8 6|76,87 c64,101.5 c24,101.5 c0,74 c0,26 c24,-1.5 c64,-1.5 78,15',
  D: '13 8|0,0 0,100 24,102 c52,102 c74,78 74,50 c74,23 c50,0 24,0 0,0',
  E: '13 8|54,103 0,100 0,0 56,3|0,51 46,54',
  F: '13 5|54,103 0,100 0,0|0,50 44,53',
  G: '8 10|76,88 c64,101.5 c24,101.5 c0,74 c0,26 c24,-1.5 c56,-1.5 c80,6 80,30 80,47 46,45',
  H: '13 13|0,0 0,100|70,0 70,100|0,49 70,53',
  I: '13 13|0,0 0,100',
  J: '5 12|48,100 48,28 c48,-1.5 24,-1.5 c4,-1.5 0,22',
  K: '13 5|0,0 0,100|62,100 0,42|19,60 64,0',
  L: '13 8|0,100 0,0 54,3',
  M: '12 12|0,0 6,100 47,22 88,100 94,0',
  N: '13 13|0,0 0,100 70,0 70,100',
  O: '8 8|e45,50,45,51.5',
  P: '13 5|0,0 0,100 26,102 c57,102 57,74 c57,47 27,47 0,45',
  Q: '8 8|e45,50,45,51.5|52,24 c66,6 92,-10',
  R: '13 6|0,0 0,100 26,102 c56,102 56,76 c56,51 27,50 0,48|28,50 c46,28 63,0',
  S: '8 8|55,84 c44,101.5 c16,101.5 c2,89 c2,66 c14,56 c46,45 c60,36 c60,13 c45,-1.5 c14,-1.5 0,17',
  T: '5 5|0,99 74,103|37,101 37,0',
  U: '12 12|0,100 0,32 c0,12 c15,-1.5 35,-1.5 c55,-1.5 c70,12 70,32 70,100',
  V: '4 4|0,100 38,0 76,100',
  W: '4 4|0,100 26,0 55,80 84,0 110,100',
  X: '6 6|3,100 70,0|68,100 0,0',
  Y: '4 4|0,100 36,46 72,100|36,46 36,0',
  Z: '8 8|2,99 66,102 0,0 70,3',
  0: '=86|e29,50,29,51.5,0.52',
  1: '=86|8,74 32,100 32,0|10,0 54,1',
  2: '=86|3,78 c7,101.5 c44,101.5 c56,92 c56,60 0,0 58,2',
  3: '=86|7,95 c20,101.5 c46,101.5 c54,90 c54,64 c48,53 37,53 c50,53 c58,43 c58,12 c45,-1.5 c10,-1.5 0,13',
  4: '=86|42,0 42,100 1,32 58,35',
  5: '=86|52,102 9,100 7,54|7,54 c27,57 c46,66 c58,56 c58,12 c45,-1.5 c10,-1.5 0,14',
  6: '=86|47,95 c41,101.5 c25,101.5 c0,84 c0,17 c17,-1.5 c41,-1.5 c58,17 c58,43 c41,60.5 c17,60.5 1,40',
  7: '=86|2,99 58,102 c39,60 24,0|22,50 54,53',
  8: '=86|c54,90 c43,101.5 c15,101.5 c4,90 c4,66 c13,58 c45,44 c58,36 c58,12 c45,-1.5 c13,-1.5 c0,12 c0,36 c13,44 c45,58 c54,66 z',
  9: '=86|11,5 c17,-1.5 c33,-1.5 c58,16 c58,83 c41,101.5 c17,101.5 c0,83 c0,57 c17,39.5 c41,39.5 57,60',
  ' ': '=34',
  '.': '14 11|o0,3',
  ',': '12 11|7,6 c7,-8 0,-17',
  ':': '14 12|o0,12|o0,58',
  ';': '12 12|o6,58|7,6 c7,-8 0,-17',
  '!': '12 12|2,100 0,36|o0,3',
  '?': '8 8|2,80 c7,101.5 c40,101.5 c52,92 c52,62 c26,56 26,34|o26,3',
  "'": '8 8|4,104 0,78',
  '"': '8 8|4,104 0,78|22,104 18,78',
  '-': '8 8|0,42 32,45',
  '–': '8 8|0,42 56,46',
  '+': '8 8|0,45 52,48|26,72 26,22',
  '/': '5 5|0,-6 44,106',
  '(': '8 4|22,110 c0,84 c0,16 22,-10',
  ')': '4 8|0,110 c22,84 c22,16 0,-10',
  '%': '8 8|12,0 68,100|~e15,78,15,19|~e65,22,15,19',
  '&': '8 4|70,0 24,58 c8,78 c8,101.5 c50,101.5 c54,76 c0,46 c0,-1.5 c44,-1.5 68,48',
  '#': '7 7|15,0 24,100|46,0 55,100|0,32 68,35|2,65 70,68',
  '°': '7 7|~e14,85,14,15',
  '<': '8 8|50,82 0,48 50,14',
  '>': '8 8|0,82 50,48 0,14',
  '=': '8 8|0,60 52,63|0,32 52,35',
  '*': '7 7|21,97 21,53|1,86 41,64|1,64 41,86',
  _: '2 2|0,-14 60,-14',
  '×': '8 8|2,72 48,24|2,24 48,72',
  '«': '8 8|24,70 0,46 24,22|52,70 28,46 52,22',
  '»': '8 8|0,70 24,46 0,22|28,70 52,46 28,22',
  'Œ': '8 5|e36,50,36,51.5|118,103 70,100 70,0 120,3|70,51 110,54',
  'Æ': '4 5|0,0 50,100 100,103|50,100 50,0 102,3|50,51 92,54|17,33 50,35',
  // the crossbar "I" of comic lettering, used when the letter stands alone (the English pronoun)
  'I serif': '8 8|16,0 16,100|0,99 32,102|0,0 32,3',
};

// Accent strokes, x relative to the centre of the base letter. Keys are Unicode combining marks,
// so accented capitals are composed from their canonical decomposition. As in hand-lettered
// albums, a capital that carries an accent is drawn a little shorter (ACCENT_SQUASH) so that the
// accent stays clear of the line above at the usual tight line spacing.
const ACCENTS = {
  '\u0301': '-8,106 12,122',
  '\u0300': '8,106 -12,122',
  '\u0302': '-17,105 0,121 17,105',
  '\u0308': 'o-13,113|o13,113',
  '\u0303': '-19,108 c-10,122 0,113 c10,104 19,118',
  '\u0327': '1,-1 -2,-9 c11,-9 c11,-26 -8,-23',
};
const ACCENTED = 'ÉÈÊËÀÂÄÇÙÛÜÎÏÔÖÁÍÓÚÌÒÑÃÕŸ';
const ACCENT_ANCHOR = { C: 43 };
const ACCENT_SQUASH = 0.9;

// Kerning for the worst pairs (grid units), keyed by base letters.
const KERN_SOURCE = 'AV-11 AW-7 AY-12 AT-10 VA-11 WA-7 YA-12 TA-10 LT-10 LV-10 LY-11 LW-6 PA-7 FA-8 TJ-9 FJ-9 PJ-9'
  + ' TO-3 OT-3 VO-3 OV-3 YO-4 OY-4 AO-2 OA-2 AC-2 AG-2 AQ-2 DA-2 KO-3 RT-3 RV-3 RY-4 XO-2 OX-2'
  + ' T.-10 V.-10 Y.-11 P.-10 F.-10 T,-10 V,-10 Y,-11 P,-10 F,-10 L\'-10 A\'-8 \'A-10 L"-10 A"-8 "A-10 T--6 -T-6 7.-6 7,-6';

const UNIT = 0.01;
const DOT_RADIUS = 2.4;
const ROUND = 0.46;
const BOW_MIN = 28, BOW_X = -0.013, BOW_Y = 0.018;
const BASE_PEN = 0.11;
const INK = '#16161f';

// pen = stroke width (em), slant = tangent of the lean, stretch = horizontal widening, gap = extra
// letter space (em), minBearing = least side bearing (em), wobble = share of the hand irregularities,
// accentPen = pen ratio of the light strokes. The advance of a glyph grows with the pen width.
const STYLES = {
  caption: { pen: 0.12, slant: 0.14, stretch: 1, gap: 0.012, minBearing: 0, block: false, wobble: 1, accentPen: 0.88, color: INK, outline: null },
  bold: { pen: 0.17, slant: 0.14, stretch: 1.05, gap: 0.012, minBearing: 0.06, block: false, wobble: 1, accentPen: 0.8, color: INK, outline: null },
  impact: { pen: 0.26, slant: 0.12, stretch: 1.14, gap: -0.015, minBearing: 0.12, block: true, wobble: 0.7, accentPen: 0.62, color: '#ffd42a', outline: INK },
};
const OUTLINE_WIDTH = 0.045;

function numbers(text) { return text.split(',').map(Number); }

/**
 * Append a straight segment. Long ones are bowed a little toward the upper left (the arc of a
 * wrist): the same gentle curve on every stem and bar is what keeps the lettering from looking
 * ruled, without making it shaky.
 */
function bowTo(out, bx, by) {
  const ax = out[out.length - 2], ay = out[out.length - 1];
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
  if (length > BOW_MIN) {
    const nx = -dy / length, ny = dx / length, sag = (nx * BOW_X + ny * BOW_Y) * length;
    const steps = Math.ceil(length / 12);
    for (let s = 1; s < steps; s++) {
      const t = s / steps, k = 4 * t * (1 - t) * sag;
      out.push(ax + dx * t + nx * k, ay + dy * t + ny * k);
    }
  }
  out.push(bx, by);
}

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
    if (p[2]) { bowTo(out, p[0], p[1]); continue; }
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
  const tokens = source.replace('~', '').trim().split(/\s+/);
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

/**
 * Glyph record: w = advance (em), s = polylines (em), a = index of the first light stroke (accents,
 * small rings), k = kerning letter, l / r = side bearings (em), lift = true when the light strokes
 * are accents (they move away from the letter as the pen gets heavier).
 */
function buildGlyph(char, source) {
  const parts = source.split('|');
  const strokes = parts.slice(1).map(expandStroke);
  const [min, max] = boundsX(strokes);
  let shift, advance, left = 100, right = 100;
  if (parts[0][0] === '=') {
    advance = Number(parts[0].slice(1));
    shift = (advance - (max - min)) / 2 - min;
  } else {
    [left, right] = numbers(parts[0].replace(' ', ','));
    shift = left - min;
    advance = left + (max - min) + right;
  }
  const light = parts.findIndex((part) => part[0] === '~');
  return { w: advance * UNIT, s: toEm(strokes, shift), a: light < 0 ? strokes.length : light - 1, k: char, l: left * UNIT, r: right * UNIT };
}

function buildAccented(char, glyphs) {
  const [base, mark] = char.normalize('NFD');
  const glyph = glyphs[base];
  const [min, max] = boundsX(glyph.s);
  const anchor = ACCENT_ANCHOR[base] === undefined ? (min + max) / 2 / UNIT : min / UNIT + ACCENT_ANCHOR[base];
  // a wide accent on the narrow I needs a little more room
  const pad = base === 'I' && mark !== '\u0301' && mark !== '\u0300' ? 0.05 : 0;
  const squash = mark === '\u0327' ? 1 : ACCENT_SQUASH;
  const s = glyph.s.map((stroke) => stroke.map((v, i) => Math.round((i % 2 ? v * squash : v + pad) * 1e4) / 1e4));
  return { w: glyph.w + 2 * pad, s: s.concat(toEm(ACCENTS[mark].split('|').map(expandStroke), anchor + pad / UNIT)), a: glyph.s.length, k: base, l: glyph.l + pad, r: glyph.r + pad, lift: true };
}

function buildGlyphs() {
  const glyphs = Object.create(null);
  for (const char of Object.keys(SOURCE)) glyphs[char] = buildGlyph(char, SOURCE[char]);
  for (const char of ACCENTED) glyphs[char] = buildAccented(char, glyphs);
  glyphs['Œ'].k = 'O';
  glyphs['I serif'].k = 'I';
  return glyphs;
}

/**
 * Expanded glyph table: char -> { w: advance in em, s: [[x0, y0, x1, y1, ...], ...] } (cap height 1,
 * baseline 0, y up; a polyline whose last point repeats the first is closed). 'I serif' is the
 * crossbar I. Advances are those of the reference pen: use glyphAdvance for a given style.
 */
export const GLYPHS = buildGlyphs();

/** Every supported character (uppercase forms). */
export const LETTERING_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?\'"-–+/()%&#°<>=*_×ÉÈÊËÀÂÄÇÙÛÜÎÏÔÖŒÆÁÍÓÚÌÒÑÃÕŸ«»';

const KERN = {};
for (const pair of KERN_SOURCE.split(' ')) KERN[pair.slice(0, 2)] = Number(pair.slice(2)) * UNIT;

const ALIASES = { '’': "'", '‘': "'", '`': "'", '´': "'", '“': '"', '”': '"', '„': '"', '—': '–', '−': '-', '\u2011': '-', '·': '.', '\u00a0': ' ', '\u202f': ' ', '\u2009': ' ', '\t': ' ', '\n': ' ', '[': '(', ']': ')', '\\': '/', 'º': '°' };

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
    if (chars[i] === 'I' && options.crossbarI !== false && !isAlphanumeric(chars[i - 1]) && !isAlphanumeric(chars[i + 1])) glyph = GLYPHS['I serif'];
    if (previous) pen += (KERN[previous.k + glyph.k] || 0) * style.stretch + tracking;
    // heavy pens need a minimum of air around open-sided letters (T, F, L...)
    pen += Math.max(0, style.minBearing - glyph.l);
    glyphs.push(glyph);
    xs.push(pen);
    pen += glyph.w * style.stretch + extra + Math.max(0, style.minBearing - glyph.r);
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

/**
 * Extension factor of one stroke end: 0 = flush (it butts against another stroke), 1 = squared
 * free end, 0.4 = free end of a curve, ~0 = free but not extended (it faces the dot of "!" or "?").
 * Where two ends meet in a corner, the end of the earlier stroke is squared and covers the other.
 */
function endFactor(strokes, lengths, index, atEnd, baseCount) {
  const pts = strokes[index], own = lengths[index], total = own[own.length - 1];
  const n = pts.length / 2;
  const px = atEnd ? pts[2 * n - 2] : pts[0], py = atEnd ? pts[2 * n - 1] : pts[1];
  let best = Infinity, nearEnd = false, nearest = -1;
  for (let j = 0; j < strokes.length; j++) {
    const other = strokes[j], len = lengths[j], length = len[len.length - 1], closed = isClosed(other);
    for (let k = 0; k + 1 < len.length; k++) {
      if (j === index && (atEnd ? total - len[k + 1] : len[k]) < 0.2) continue;
      const [d, t] = segmentDistance(px, py, other[2 * k], other[2 * k + 1], other[2 * k + 2], other[2 * k + 3]);
      if (closed && length < 0.3 && d < 0.42 && j < baseCount && index < baseCount) return 1e-6;
      if (d >= best) continue;
      const at = len[k] + t * (len[k + 1] - len[k]);
      best = d;
      nearest = j;
      nearEnd = !closed && (at < 0.05 || length - at < 0.05);
    }
  }
  if (best < 0.075) return nearEnd && nearest >= index ? 1 : 0;
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
    // (kept shorter than the neighbouring segments, or the cut would kink a tightly curved stroke)
    const half = Math.min(0.012, 0.3 * ul, 0.3 * vl);
    out.push(x - tx * half, y - ty * half, x + tx * half, y + ty * half);
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
      e: glyph.s.map((pts, i) => (isClosed(pts) ? [0, 0] : [endFactor(glyph.s, lengths, i, false, glyph.a), endFactor(glyph.s, lengths, i, true, glyph.a)])),
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
  const closed = isClosed(pts);
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

/** Width in pixels of one line of text. options: { style, tracking, weight, crossbarI }. */
export function measureText(text, size, options) {
  const o = options || {};
  return layout(text, styleOf(o), o).width * size;
}

/**
 * Draw one line of text with its baseline at y; `size` is the cap height in pixels. Returns the width.
 * options: { style: 'caption' | 'bold' | 'impact', color, outline: null | color, outlineWidth (px),
 *   align: 'left' | 'center' | 'right', tracking (em), slant (radians), weight (pen multiplier),
 *   shadow: null | { dx, dy, color } (px), seed, bounce (0..1 per-letter size / baseline / rotation
 *   variation for onomatopoeia), jitter (hand irregularity multiplier, default 1; 0 = none),
 *   crossbarI (default true: an "I" standing alone gets the crossbar form) }.
 * 'impact' defaults to a yellow fill with an ink outline (pass outline: null for none). The hand
 * irregularities depend only on the characters, their position and the seed: never on the frame.
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
  // (the pen only follows the bounce, so that plain text is stroked as a single path per pass)
  const mats = [], scales = [];
  for (let i = 0; i < count; i++) {
    const glyph = run.glyphs[i], code = glyph.k.charCodeAt(0) + glyph.s.length;
    const grow = 1 + bounce * 0.17 * noise(code, i, seed, 3), scale = grow * (1 + wobble * 0.02 * noise(code, i, seed, 6));
    const angle = wobble * 0.0175 * noise(code, i, seed, 1) + bounce * 0.1 * noise(code, i, seed, 4);
    const rise = wobble * 0.01 * noise(code, i, seed, 2) + bounce * 0.085 * ((i % 2 ? -0.6 : 0.6) + 0.5 * noise(code, i, seed, 5));
    const cos = Math.cos(angle), sin = Math.sin(angle), s = size * scale;
    const a = s * cos * style.stretch, b = -s * sin * style.stretch;
    const c = s * (cos * slant - sin), d = -s * (sin * slant + cos);
    const cx = left + (run.xs[i] + (glyph.w * style.stretch + run.extra) / 2) * size, cy = y - (0.5 + rise) * size;
    mats.push([a, b, c, d, cx - a * glyph.w / 2 - c * 0.5, cy - b * glyph.w / 2 - d * 0.5]);
    scales.push(grow);
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
          const lift = part && glyph.lift ? (glyph.s[k][1] > 0.5 ? accentLift : -accentLift) : 0;
          if (block) {
            const half = (lineWidth - 2 * grow) / 2, e = block.e[k];
            tracePolyline(ctx, block.s[k], m, lift, e[0] && e[0] * half + grow, e[1] && e[1] * half + grow);
          } else tracePolyline(ctx, glyph.s[k], m, lift, 0, 0);
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
 * sits at y (accents rise about 0.3 em above it). `align` positions the rows inside [x, x + maxWidth].
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
  const st = STYLES[style] || STYLES.caption, glyph = glyphOf(ch);
  return glyph.w * st.stretch + st.pen - BASE_PEN + st.gap + Math.max(0, st.minBearing - glyph.l) + Math.max(0, st.minBearing - glyph.r);
}
