// Inks the construction drawing of car-model.js into 2D artwork (Canvas 2D paths), at load time.
// It is an illustrator, not a real-time renderer: surfaces become flat tone shapes (gloss /
// light / base / shade), contours are found on the volume and drawn with a pen whose weight
// depends on the kind of edge (heavy silhouette, light crease) and on its orientation (heavier
// underneath, on the shadow side). Output is either final colours (large illustrations, the
// cockpit) or a pair of layers "fixed colours + livery mask" recoloured per team by the shader.

import { ROLE } from './car-model.js';
import { mixHex } from '../palettes/palettes.js';
import { drawText, measureText } from '../styles/lettering.js';

const LIGHT = (() => { const v = [0.12, 0, 1]; const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
const TONE_SHADE = 0.4, TONE_LIGHT = 0.8, TONE_GLOSS = 0.972;
const INK = '#16161f';
/** Footprint of the cast shadow on the ground (rounded outline around wheels and wings). */
const SHADOW_OUTLINE = (() => {
  const pts = [];
  const corners = [[2.2, 0.62, 0.2], [1.75, 1.0, 0.16], [-1.6, 1.0, 0.16], [-2.2, 0.5, 0.2]];
  const all = corners.concat(corners.slice().reverse().map((c) => [c[0], -c[1], c[2]]));
  for (let i = 0; i < all.length; i++) {
    const p = all[(i + all.length - 1) % all.length], c = all[i], n = all[(i + 1) % all.length];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, a = 1 - t, r = c[2] * 2.2;
      const ax = c[0] + (p[0] - c[0]) * r * 0.25, ay = c[1] + (p[1] - c[1]) * r * 0.25;
      const bx = c[0] + (n[0] - c[0]) * r * 0.25, by = c[1] + (n[1] - c[1]) * r * 0.25;
      pts.push([a * a * ax + 2 * a * t * c[0] + t * t * bx, a * a * ay + 2 * a * t * c[1] + t * t * by]);
    }
  }
  return pts;
})();
const SHADE_INK = '#1b1b3a';
/** Blend factors of the four tones relative to the base colour (shared with the mask encoding). */
export const TONE_MIX = { shade: 0.46, mid: 0.15, gloss: 0.9 };

/** Fixed materials: [shade, base, light] */
const FIXED = {
  [ROLE.TYRE]: ['#17171f', '#2d2e38', '#555866'],
  [ROLE.RIM]: ['#6b7480', '#bcc3cc', '#eef1f3'],
  [ROLE.METAL]: ['#59616d', '#a3acb8', '#dfe5ea'],
  [ROLE.CARBON]: ['#191a23', '#30323d', '#555866'],
  [ROLE.BLACK]: ['#101016', '#15151d', '#1d1d27'],
  [ROLE.VISOR]: ['#141826', '#27304a', '#6f86b8'],
  [ROLE.GLASS]: ['#4a7da6', '#86b9d8', '#d2ecf7'],
  [ROLE.WHITE]: ['#b4b9c8', '#f1efe6', '#ffffff'],
  [ROLE.RED]: ['#7d1f22', '#d5302a', '#f0705a'],
  [ROLE.SUIT]: ['#8f1f22', '#c9302c', '#e2605a'],
  [ROLE.GLOVE]: ['#15151d', '#2b2c36', '#4a4c58'],
  [ROLE.DASH]: ['#1b1c26', '#2a2c38', '#3e4150'],
};
const LIVERY_CHANNEL = { [ROLE.BODY]: 0, [ROLE.SIDE]: 1, [ROLE.WING]: 2, [ROLE.HELMET]: 1 };

function css(r, g, b) { return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`; }
function hexRgb(hex) { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }

/**
 * Colour resolver. With `livery` ({ colors: [hex, hex, hex] }) roles resolve to final colours on
 * one canvas; without it two canvases are painted in lockstep (fixed colours and livery mask).
 * Returns for (role, tone) the fill styles [fixedStyle, maskStyle].
 */
function makeColorTable(livery) {
  const table = new Map();
  const shadeInk = hexRgb(SHADE_INK);
  for (const role of Object.values(ROLE)) {
    const channel = LIVERY_CHANNEL[role];
    const tones = [];
    if (channel === undefined) {
      const f = FIXED[role];
      tones.push([f[0], '#000'], [f[1], '#000'], [f[2], '#000'], [mixHex(f[2], '#ffffff', 0.5), '#000']);
    } else if (livery) {
      const base = livery.colors[channel];
      tones.push([mixHex(base, SHADE_INK, TONE_MIX.shade), '#000'], [mixHex(base, SHADE_INK, TONE_MIX.mid), '#000'], [base, '#000'], [mixHex(base, '#ffffff', TONE_MIX.gloss), '#000']);
    } else {
      const m = (v) => { const c = [0, 0, 0]; c[channel] = v * 255; return css(c[0], c[1], c[2]); };
      tones.push(
        [css(shadeInk[0] * TONE_MIX.shade, shadeInk[1] * TONE_MIX.shade, shadeInk[2] * TONE_MIX.shade), m(1 - TONE_MIX.shade)],
        [css(shadeInk[0] * TONE_MIX.mid, shadeInk[1] * TONE_MIX.mid, shadeInk[2] * TONE_MIX.mid), m(1 - TONE_MIX.mid)],
        ['#000', m(1)],
        [css(255 * TONE_MIX.gloss, 255 * TONE_MIX.gloss, 255 * TONE_MIX.gloss), m(1 - TONE_MIX.gloss)],
      );
    }
    table.set(role, tones);
  }
  return table;
}

/** Clip polygon (flat [x,y,t,...] triples) against t >= thr (keep = 1) or t < thr (keep = -1). */
function clipTone(src, n, thr, keep, out) {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const a = i * 3, b = ((i + 1) % n) * 3;
    const ta = (src[a + 2] - thr) * keep, tb = (src[b + 2] - thr) * keep;
    if (ta >= 0) { out[m * 3] = src[a]; out[m * 3 + 1] = src[a + 1]; out[m * 3 + 2] = src[a + 2]; m++; }
    if ((ta >= 0) !== (tb >= 0)) {
      const k = ta / (ta - tb);
      out[m * 3] = src[a] + (src[b] - src[a]) * k; out[m * 3 + 1] = src[a + 1] + (src[b + 1] - src[a + 1]) * k; out[m * 3 + 2] = thr; m++;
    }
  }
  return m;
}

/**
 * Camera for the illustrator.
 *  orbit: { yaw (0 = seen from behind, + = from the car's right side), pitch (elevation, rad),
 *           distance (m), target [x,y,z], scale (px per metre at the target), cx, cy }
 *  eye:   { eye [x,y,z], focal (px), cx, cy, pitch } looking along +x (cockpit drawing)
 */
function makeCamera(cam) {
  if (cam.eye) {
    const p = cam.pitch || 0, cp = Math.cos(p), sp = Math.sin(p);
    return { pos: cam.eye, f: [cp, 0, -sp], r: [0, -1, 0], u: [sp, 0, cp], k: cam.focal, cx: cam.cx, cy: cam.cy, near: 0.1, perspective: true };
  }
  const ce = Math.cos(cam.pitch), se = Math.sin(cam.pitch), cyaw = Math.cos(cam.yaw), syaw = Math.sin(cam.yaw);
  const f = [cyaw * ce, syaw * ce, -se];
  const r = [syaw, -cyaw, 0];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const t = cam.target || [0, 0, 0.35];
  const pos = [t[0] - f[0] * cam.distance, t[1] - f[1] * cam.distance, t[2] - f[2] * cam.distance];
  return { pos, f, r, u, k: cam.distance * cam.scale, cx: cam.cx, cy: cam.cy, near: 0.1, perspective: true };
}

/**
 * Draw the car.
 * @param ctx      Canvas 2D context receiving final or fixed colours
 * @param maskCtx  context of the livery mask layer, or null when `livery` is given
 * @param model    result of buildCarModel
 * @param cam      camera description (see makeCamera)
 * @param options  { livery: { colors: [3 hex] } | null, ink: silhouette width in px, shadow: true,
 *                   include(partName) -> boolean, measure: true to only compute bounds }
 * @returns bounds { minX, minY, maxX, maxY } of everything drawn (before clipping)
 */
export function drawCar(ctx, maskCtx, model, cam, options = {}) {
  const camera = makeCamera(cam);
  const colors = makeColorTable(options.livery || null);
  const inkBase = options.ink ?? 3;
  const include = options.include || null;
  const measure = !!options.measure;
  const bounds = { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9 };
  const { pos: cp, f, r, u, k, cx, cy, near } = camera;
  const elements = [];
  const projected = [];

  for (let pi = 0; pi < model.parts.length; pi++) {
    const part = model.parts[pi];
    if (include && !include(part.name)) { projected.push(null); continue; }
    const count = part.pos.length / 3;
    const sx = new Float32Array(count), sy = new Float32Array(count), zc = new Float32Array(count), tone = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = part.pos[i * 3] - cp[0], y = part.pos[i * 3 + 1] - cp[1], z = part.pos[i * 3 + 2] - cp[2];
      const d = x * f[0] + y * f[1] + z * f[2];
      const dz = d > near ? d : near;
      zc[i] = d;
      sx[i] = cx + ((x * r[0] + y * r[1] + z * r[2]) / dz) * k;
      sy[i] = cy - ((x * u[0] + y * u[1] + z * u[2]) / dz) * k;
      tone[i] = 0.5 + 0.5 * (part.nor[i * 3] * LIGHT[0] + part.nor[i * 3 + 1] * LIGHT[1] + part.nor[i * 3 + 2] * LIGHT[2]);
      if (d > near) {
        if (sx[i] < bounds.minX) bounds.minX = sx[i]; if (sx[i] > bounds.maxX) bounds.maxX = sx[i];
        if (sy[i] < bounds.minY) bounds.minY = sy[i]; if (sy[i] > bounds.maxY) bounds.maxY = sy[i];
      }
    }
    const faces = part.faces;
    // parts on the outside of the car (wheels, end plates) overlap their neighbours when seen from their side
    let partBias = part.bias;
    if (part.outward) {
      const o = part.outward, m = Math.hypot(o[0], o[1], o[2]);
      partBias += (o[0] * f[0] + o[1] * f[1] + o[2] * f[2] < 0 ? -0.22 : 0.22) * m;
    }
    const visible = new Uint8Array(faces.length), normals = new Float32Array(faces.length * 3);
    for (let fi = 0; fi < faces.length; fi++) {
      const idx = faces[fi].idx, n = idx.length;
      // Newell normal, oriented by the authored vertex normals
      let nx = 0, ny = 0, nz = 0, ax = 0, ay = 0, az = 0, mx = 0, my = 0, mz = 0, depth = 0, behind = 0;
      for (let q = 0; q < n; q++) {
        const a = idx[q] * 3, b = idx[(q + 1) % n] * 3;
        nx += (part.pos[a + 1] - part.pos[b + 1]) * (part.pos[a + 2] + part.pos[b + 2]);
        ny += (part.pos[a + 2] - part.pos[b + 2]) * (part.pos[a] + part.pos[b]);
        nz += (part.pos[a] - part.pos[b]) * (part.pos[a + 1] + part.pos[b + 1]);
        ax += part.nor[a]; ay += part.nor[a + 1]; az += part.nor[a + 2];
        mx += part.pos[a]; my += part.pos[a + 1]; mz += part.pos[a + 2];
        depth += zc[idx[q]];
        if (zc[idx[q]] <= near) behind++;
      }
      if (nx * ax + ny * ay + nz * az < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      normals[fi * 3] = nx; normals[fi * 3 + 1] = ny; normals[fi * 3 + 2] = nz;
      mx /= n; my /= n; mz /= n;
      const facing = nx * (cp[0] - mx) + ny * (cp[1] - my) + nz * (cp[2] - mz);
      if (facing > 1e-5 && behind === 0) {
        visible[fi] = 1;
        elements.push({ kind: 0, part: pi, index: fi, depth: depth / n + partBias });
      }
    }
    for (let ri = 0; ri < part.rods.length; ri++) {
      const rod = part.rods[ri];
      const len = Math.hypot(rod.b[0] - rod.a[0], rod.b[1] - rod.a[1], rod.b[2] - rod.a[2]);
      const pieces = Math.max(1, Math.round(len / 0.1));
      for (let s = 0; s < pieces; s++) {
        const t0 = s / pieces, t1 = (s + 1) / pieces;
        const seg = [];
        let ok = true, dsum = 0;
        for (const t of [t0, t1]) {
          const x = rod.a[0] + (rod.b[0] - rod.a[0]) * t - cp[0], y = rod.a[1] + (rod.b[1] - rod.a[1]) * t - cp[1], z = rod.a[2] + (rod.b[2] - rod.a[2]) * t - cp[2];
          const d = x * f[0] + y * f[1] + z * f[2];
          if (d <= near) { ok = false; break; }
          seg.push(cx + ((x * r[0] + y * r[1] + z * r[2]) / d) * k, cy - ((x * u[0] + y * u[1] + z * u[2]) / d) * k, d);
          dsum += d;
        }
        if (ok) elements.push({ kind: 1, part: pi, index: ri, depth: dsum / 2 - 0.03, seg, first: s === 0, last: s === pieces - 1 });
      }
    }
    for (let li = 0; li < part.lines.length; li++) {
      const line = part.lines[li];
      for (let s = 0; s < line.pts.length - 1; s++) {
        const seg = [];
        let ok = true, dsum = 0;
        for (const p of [line.pts[s], line.pts[s + 1]]) {
          const x = p[0] - cp[0], y = p[1] - cp[1], z = p[2] - cp[2];
          const d = x * f[0] + y * f[1] + z * f[2];
          if (d <= near || line.normal[0] * -x + line.normal[1] * -y + line.normal[2] * -z <= 0) { ok = false; break; }
          seg.push(cx + ((x * r[0] + y * r[1] + z * r[2]) / d) * k, cy - ((x * u[0] + y * u[1] + z * u[2]) / d) * k, d);
          dsum += d;
        }
        if (ok) elements.push({ kind: 2, part: pi, index: li, depth: dsum / 2 - 0.1, seg });
      }
    }
    projected.push({ sx, sy, zc, tone, visible, normals, drawn: new Uint8Array(faces.length) });
  }
  if (measure) return bounds;
  elements.sort((a, b) => b.depth - a.depth);

  const targets = maskCtx ? [ctx, maskCtx] : [ctx];
  for (const t of targets) { t.lineJoin = 'round'; t.lineCap = 'round'; }
  // Faces of one colour that follow each other in the drawing order are filled as a single path
  // (far fewer canvas calls). The batch is flushed whenever anything else has to be drawn.
  const pending = new Float32Array(8192);      // [n, x0, y0, x1, y1, ..., n, ...]
  let pendingLen = 0, pendingStyles = null;
  const flush = () => {
    if (!pendingStyles) return;
    for (let ti = 0; ti < targets.length; ti++) {
      const t = targets[ti];
      t.beginPath();
      for (let i = 0; i < pendingLen;) {
        const n = pending[i++];
        t.moveTo(pending[i], pending[i + 1]);
        for (let q = 1; q < n; q++) t.lineTo(pending[i + q * 2], pending[i + q * 2 + 1]);
        t.closePath();
        i += n * 2;
      }
      t.fillStyle = pendingStyles[ti]; t.fill();
      t.strokeStyle = pendingStyles[ti]; t.lineWidth = 1.5; t.stroke();      // hides the hairline seams between neighbouring faces
    }
    pendingLen = 0; pendingStyles = null;
  };
  const fillPoly = (buf, n, styles) => {
    if (styles !== pendingStyles || pendingLen + 1 + n * 2 > pending.length) { flush(); pendingStyles = styles; }
    // one winding direction for all, so that overlapping faces of a batch add up under the nonzero rule
    let area = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += buf[i * 3] * buf[j * 3 + 1] - buf[j * 3] * buf[i * 3 + 1]; }
    pending[pendingLen++] = n;
    if (area >= 0) for (let i = 0; i < n; i++) { pending[pendingLen++] = buf[i * 3]; pending[pendingLen++] = buf[i * 3 + 1]; }
    else for (let i = n - 1; i >= 0; i--) { pending[pendingLen++] = buf[i * 3]; pending[pendingLen++] = buf[i * 3 + 1]; }
  };
  const strokeSeg = (x0, y0, x1, y1, width, styleFixed, styleMask, cap) => {
    flush();
    for (let ti = 0; ti < targets.length; ti++) {
      const t = targets[ti];
      t.beginPath(); t.moveTo(x0, y0); t.lineTo(x1, y1);
      t.strokeStyle = ti === 0 ? styleFixed : styleMask; t.lineWidth = width; t.lineCap = cap || 'round';
      t.stroke();
      t.lineCap = 'round';
    }
  };

  // ground shadow under the car
  if (options.shadow !== false) {
    const blob = options.shadowOutline || SHADOW_OUTLINE;
    ctx.beginPath();
    let started = false;
    for (const b of blob) {
      const x = b[0] - 0.12 - cp[0], y = b[1] - cp[1], z = 0.004 - cp[2];
      const d = x * f[0] + y * f[1] + z * f[2];
      if (d <= near) continue;
      const px = cx + ((x * r[0] + y * r[1] + z * r[2]) / d) * k, py = cy - ((x * u[0] + y * u[1] + z * u[2]) / d) * k;
      if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; }
      if (px < bounds.minX) bounds.minX = px; if (px > bounds.maxX) bounds.maxX = px;
      if (py < bounds.minY) bounds.minY = py; if (py > bounds.maxY) bounds.maxY = py;
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(18,18,30,0.5)';
    ctx.fill();
  }

  const a = new Float32Array(64), b = new Float32Array(64), c = new Float32Array(64);
  const thresholds = [TONE_SHADE, TONE_LIGHT, TONE_GLOSS];
  for (const el of elements) {
    const part = model.parts[el.part], pr = projected[el.part];
    if (el.kind === 0) {
      const face = part.faces[el.index], idx = face.idx, n = idx.length;
      const tones = colors.get(face.role);
      const glossy = part.gloss && (LIVERY_CHANNEL[face.role] !== undefined || face.role === ROLE.VISOR || face.role === ROLE.WHITE);
      let lo = 1, hi = 0;
      for (let q = 0; q < n; q++) {
        const v = idx[q];
        a[q * 3] = pr.sx[v]; a[q * 3 + 1] = pr.sy[v]; a[q * 3 + 2] = pr.tone[v];
        if (pr.tone[v] < lo) lo = pr.tone[v]; if (pr.tone[v] > hi) hi = pr.tone[v];
      }
      // split the face along the tone boundaries so that shadow shapes have clean curved edges
      let cur = a, curN = n, spare = b;
      const levels = glossy ? 3 : 2;
      for (let level = 0; level < levels && curN >= 3; level++) {
        const thr = thresholds[level];
        if (hi < thr) break;
        if (lo < thr) {
          const m = clipTone(cur, curN, thr, -1, c);
          if (m >= 3) fillPoly(c, m, tones[level]);
          curN = clipTone(cur, curN, thr, 1, spare);
          const tmp = cur; cur = spare; spare = tmp;
          lo = thr;
        }
      }
      if (curN >= 3) {
        const level = hi < TONE_SHADE ? 0 : hi < TONE_LIGHT ? 1 : (hi < TONE_GLOSS || !glossy) ? 2 : 3;
        fillPoly(cur, curN, tones[level]);
      }
      pr.drawn[el.index] = 1;
      if (part.ink <= 0) continue;
      const nx = pr.normals[el.index * 3], ny = pr.normals[el.index * 3 + 1], nz = pr.normals[el.index * 3 + 2];
      const down = Math.max(0, -(nx * u[0] + ny * u[1] + nz * u[2]));
      for (let q = 0; q < n; q++) {
        const e = face.edges[q];
        if (e < 0) continue;
        const adj = part.edges[e];
        let kind = 2;         // 2 silhouette, 1 crease, 0 smooth interior
        let pending = false;
        if (face.cut && face.cut[q]) kind = 1;       // junction with another volume: a light line
        else for (let j = 0; j < adj.length; j++) {
          const o = adj[j];
          if (o === el.index || !pr.visible[o]) continue;
          const dot = nx * pr.normals[o * 3] + ny * pr.normals[o * 3 + 1] + nz * pr.normals[o * 3 + 2];
          const creased = dot < 0.72 || part.faces[o].role !== face.role;
          kind = creased ? Math.min(kind, 1) : 0;
          if (!pr.drawn[o]) pending = true;
          if (kind === 0) break;
        }
        if (kind === 0 || (kind === 1 && pending)) continue;
        const v0 = idx[q], v1 = idx[(q + 1) % n];
        const width = kind === 2 ? inkBase * part.ink * (0.8 + 0.6 * down) : inkBase * 0.42 * Math.min(1, part.ink + 0.2);
        strokeSeg(pr.sx[v0], pr.sy[v0], pr.sx[v1], pr.sy[v1], width, INK, '#000');
      }
    } else if (el.kind === 1) {
      const rod = part.rods[el.index], s = el.seg;
      const scale = k / ((s[2] + s[5]) / 2);
      const w = Math.max(1.3, rod.radius * 2 * scale);
      const tones = colors.get(rod.role);
      const inkW = w + inkBase * part.ink * 1.5;
      // a rod is drawn in short pieces (for depth sorting): the colour of each piece overlaps its
      // neighbours a little so that no notch shows between them; the two real ends get a joint
      const ex = s[3] - s[0], ey = s[4] - s[1], el2 = Math.hypot(ex, ey) || 1, ox = (ex / el2) * 1.5, oy = (ey / el2) * 1.5;
      const x0 = el.first ? s[0] : s[0] - ox, y0 = el.first ? s[1] : s[1] - oy, x1 = el.last ? s[3] : s[3] + ox, y1 = el.last ? s[4] : s[4] + oy;
      strokeSeg(s[0], s[1], s[3], s[4], inkW, INK, '#000', 'butt');
      if (el.first) strokeSeg(s[0], s[1], s[0] + ox * 0.1, s[1] + oy * 0.1, inkW * 1.25, INK, '#000', 'round');
      if (el.last) strokeSeg(s[3], s[4], s[3] - ox * 0.1, s[4] - oy * 0.1, inkW * 1.25, INK, '#000', 'round');
      strokeSeg(x0, y0, x1, y1, w, tones[1][0], tones[1][1], 'butt');
      strokeSeg(x0, y0 - w * 0.22, x1, y1 - w * 0.22, w * 0.3, tones[2][0], tones[2][1], 'butt');
    } else {
      const line = part.lines[el.index], s = el.seg;
      const style = line.hex || (line.color === 'tyreMark' ? '#70737f' : INK);
      strokeSeg(s[0], s[1], s[3], s[4], inkBase * 0.4 * (line.weight || 1), style, '#000');
    }
  }
  flush();
  if (options.number) drawNumberDecals(ctx, camera, String(options.number), options.numberColors || ['#16161f', '#f1efe6']);
  return bounds;
}

/** Race number lettered on flat panels of the car (large illustrations only): rear wing end plates and nose. */
const NUMBER_PANELS = [
  { origin: [-1.8, 0.5165, 0.8], u: [-0.4, 0, 0], v: [0, 0, -0.27], normal: [0, 1, 0] },         // left end plate, read from the left
  { origin: [-2.2, -0.5165, 0.8], u: [0.4, 0, 0], v: [0, 0, -0.27], normal: [0, -1, 0] },        // right end plate
  { origin: [1.2, -0.11, 0.474], u: [0, 0.22, 0], v: [0.3, 0, -0.022], normal: [0.07, 0, 1] },   // top of the nose, read from the front
];
function drawNumberDecals(ctx, camera, text, colors) {
  const { pos: cp, f, r, u, k, cx, cy } = camera;
  const project = (p) => {
    const x = p[0] - cp[0], y = p[1] - cp[1], z = p[2] - cp[2];
    const d = x * f[0] + y * f[1] + z * f[2];
    return d > 0.1 ? [cx + ((x * r[0] + y * r[1] + z * r[2]) / d) * k, cy - ((x * u[0] + y * u[1] + z * u[2]) / d) * k] : null;
  };
  for (const panel of NUMBER_PANELS) {
    const o = panel.origin, n = panel.normal;
    if (n[0] * (cp[0] - o[0]) + n[1] * (cp[1] - o[1]) + n[2] * (cp[2] - o[2]) <= 0.4) continue;   // facing away or seen edge-on
    const p0 = project(o), p1 = project([o[0] + panel.u[0], o[1] + panel.u[1], o[2] + panel.u[2]]), p2 = project([o[0] + panel.v[0], o[1] + panel.v[1], o[2] + panel.v[2]]);
    if (!p0 || !p1 || !p2) continue;
    // affine frame of the panel: unit square (0..1, 0..1) -> screen
    ctx.save();
    ctx.transform(p1[0] - p0[0], p1[1] - p0[1], p2[0] - p0[0], p2[1] - p0[1], p0[0], p0[1]);
    ctx.scale(1 / 100, 1 / 100);                       // work in a 100 x 100 box
    const size = 56, w = measureText(text, size, { style: 'bold' });
    ctx.fillStyle = colors[1];
    ctx.beginPath(); ctx.ellipse(50, 50, Math.max(32, w * 0.5 + 10), 42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#16161f'; ctx.lineWidth = 3; ctx.stroke();
    drawText(ctx, text, 50, 50 + size * 0.5, size, { style: 'bold', color: colors[0], align: 'center', jitter: 0, slant: 0 });
    ctx.restore();
  }
}

/**
 * Fit the car seen from an orbit camera inside a cell and draw it.
 * Returns placement metadata: { ppm (px per metre at the car), ax, ay (cell position of the car's
 * ground centre) }.
 */
export function drawCarFitted(ctx, maskCtx, model, width, height, view, options = {}) {
  const margin = options.margin ?? 8;
  const probe = { yaw: view.yaw, pitch: view.pitch, distance: view.distance, target: view.target, scale: 1, cx: 0, cy: 0 };
  const b = drawCar(null, null, model, probe, { measure: true, include: options.include });
  // the ground shadow reaches a little beyond the bodywork
  const bw = (b.maxX - b.minX) * 1.03, bh = (b.maxY - b.minY) * 1.06;
  const scale = Math.min((width - 2 * margin) / bw, (height - 2 * margin) / bh, options.maxScale || 1e9);
  const cx = width / 2 - ((b.minX + b.maxX) / 2) * scale;
  const cy = height - margin - b.maxY * scale * 1.0 - (height - 2 * margin - bh * scale) / 2;
  const cam = { ...probe, scale, cx, cy };
  drawCar(ctx, maskCtx, model, cam, { ...options, ink: (options.inkWorld ?? 0.0095) * scale * (options.inkGain ?? 1) });
  // project the ground centre for placement
  const camera = makeCamera(cam);
  const x = -camera.pos[0], y = -camera.pos[1], z = -camera.pos[2];
  const d = x * camera.f[0] + y * camera.f[1] + z * camera.f[2];
  return {
    ppm: (camera.k / d),
    ax: cx + ((x * camera.r[0] + y * camera.r[1] + z * camera.r[2]) / d) * camera.k,
    ay: cy - ((x * camera.u[0] + y * camera.u[1] + z * camera.u[2]) / d) * camera.k,
  };
}
