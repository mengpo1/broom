// Interface pages painted as comic-book plates ("planches"): panels separated by white gutters,
// caption boxes, hand lettering, inked car illustrations. A page is painted into one canvas the
// size of the screen only when its content changes, then composited by the renderer.
// All texts come from the localisation dictionaries; all drawings from the art modules.

import { t } from '../localization/i18n.js';
import { drawText, measureText, drawTextBox } from '../art/styles/lettering.js';
import { brushStroke, tracePolygon, seeded } from '../art/styles/ink.js';
import { makeCanvas } from '../rendering/drawing/atlas.js';
import { buildCarModel } from '../art/vehicles/car-model.js';
import { drawCar, drawCarFitted } from '../art/vehicles/car-illustrator.js';
import { liveryColors } from '../art/art-library.js';
import { rgbToHex, getPalette } from '../art/palettes/palettes.js';
import { ALL_TEAMS, DRIVERS, PLAYER_DRIVERS } from '../vehicles/liveries.js';
import { paintBackdropLayer, backdropHorizon } from '../art/environments/backdrops.js';
import { getTheme } from '../tracks/themes.js';
import { hashString } from '../core/random.js';

const INK = '#16161f', PAPER = '#f4efe2', PAPER_SHADE = '#e4dcc8', CAPTION = '#f6e27a', RED = '#d5302a', BLUE = '#2f5fa8';

export function formatTime(seconds) {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return '-:--.---';
  const ms = Math.round(seconds * 1000);
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

/** Race number of the first driver of a team (for illustrations). */
export function teamNumber(teamIndex) {
  const driver = [...PLAYER_DRIVERS, ...DRIVERS].find((d) => d.team === teamIndex);
  return driver ? driver.number : '';
}

export function teamHex(teamIndex) {
  return liveryColors(ALL_TEAMS[teamIndex]).map((c) => rgbToHex(c[0], c[1], c[2]));
}

export class PagePainter {
  constructor() {
    this.canvas = null; this.ctx = null;
    this.W = 0; this.H = 0; this.S = 1;
    this.heroModel = null;
    this.cache = new Map();
    this.hits = [];
  }

  resize(width, height) {
    if (this.canvas && this.W === width && this.H === height) return;
    this.canvas = makeCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');
    this.W = width; this.H = height; this.S = height / 1440;
    this.cache.clear();
  }

  // ---- building blocks ------------------------------------------------------------------------

  /** Panel with an ink frame; corners [[x,y] x4] allow slanted gutters. Returns after clipping to it: call ctx.restore(). */
  beginPanel(corners) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); tracePolygon(ctx, corners); ctx.clip();
  }

  endPanel(corners) {
    const ctx = this.ctx;
    ctx.restore();
    ctx.beginPath(); tracePolygon(ctx, corners);
    ctx.strokeStyle = INK; ctx.lineWidth = 7 * this.S; ctx.lineJoin = 'miter'; ctx.stroke();
  }

  /** Caption box (récitatif) with wrapped text. */
  caption(text, x, y, maxWidth, size, options = {}) {
    const ctx = this.ctx, S = this.S, pad = size * 0.7;
    const box = drawTextBox(null, text, 0, 0, maxWidth - pad * 2, size, { style: options.style || 'caption' });
    const w = (options.fixedWidth ? maxWidth : box.width + pad * 2), h = box.height + pad * 1.7;
    ctx.fillStyle = INK; ctx.fillRect(x + 6 * S, y + 7 * S, w, h);
    ctx.fillStyle = options.fill || CAPTION; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5 * S; ctx.strokeRect(x, y, w, h);
    drawTextBox(ctx, text, x + pad, y + pad * 0.85, maxWidth - pad * 2, size, { style: options.style || 'caption', color: options.color || INK });
    return { w, h };
  }

  /** Flat sky-and-track backdrop used behind car illustrations, with speed strokes. */
  speedBackdrop(x, y, w, h, palette, seed, horizon = 0.56) {
    const ctx = this.ctx, rnd = seeded(seed);
    ctx.fillStyle = palette.skyMid; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = palette.skyTop; ctx.fillRect(x, y, w, h * 0.22);
    ctx.fillStyle = palette.skyLow; ctx.fillRect(x, y + h * (horizon - 0.14), w, h * 0.14);
    ctx.fillStyle = palette.nearRelief; ctx.fillRect(x, y + h * (horizon - 0.05), w, h * 0.05);
    ctx.fillStyle = palette.grassA; ctx.fillRect(x, y + h * horizon, w, h * 0.08);
    ctx.fillStyle = palette.asphalt; ctx.fillRect(x, y + h * (horizon + 0.07), w, h);
    ctx.fillStyle = palette.kerbA;
    for (let i = 0; i < 14; i++) if (i % 2 === 0) ctx.fillRect(x + (i / 14) * w, y + h * (horizon + 0.055), w / 14, h * 0.022);
    ctx.fillStyle = INK; ctx.fillRect(x, y + h * (horizon + 0.075), w, 3 * this.S);
    for (let i = 0; i < 46; i++) {       // horizontal speed strokes
      const yy = y + h * (0.06 + rnd() * 0.9), xx = x + rnd() * w, len = w * (0.08 + rnd() * 0.3);
      const light = yy > y + h * horizon ? rnd() < 0.5 : rnd() < 0.8;
      brushStroke(ctx, [[xx, yy], [xx + len * 0.5, yy + 1], [xx + len, yy]], (2 + rnd() * 4) * this.S, { color: light ? 'rgba(255,255,255,0.75)' : 'rgba(22,22,31,0.55)', taper: 0.45 });
    }
  }

  /** Cached car illustration (final colours) fitted in w x h. */
  car(key, w, h, view, livery) {
    const id = `${key}:${Math.round(w)}x${Math.round(h)}`;
    let canvas = this.cache.get(id);
    if (!canvas) {
      if (!this.heroModel) this.heroModel = buildCarModel({ detail: 1 });
      canvas = makeCanvas(Math.ceil(w), Math.ceil(h));
      drawCarFitted(canvas.getContext('2d'), null, this.heroModel, canvas.width, canvas.height, view, { livery, inkWorld: 0.0085, margin: 12 * this.S, number: livery.number });
      this.cache.set(id, canvas);
    }
    return canvas;
  }

  /** Close-up of the cockpit area of a car (intro strip). */
  carCloseUp(key, w, h, livery) {
    const id = `close:${key}:${Math.round(w)}x${Math.round(h)}`;
    let canvas = this.cache.get(id);
    if (!canvas) {
      if (!this.heroModel) this.heroModel = buildCarModel({ detail: 1 });
      canvas = makeCanvas(Math.ceil(w), Math.ceil(h));
      const scale = h / 1.15;
      drawCar(canvas.getContext('2d'), null, this.heroModel, { yaw: 2.2, pitch: 0.2, distance: 5, target: [0.15, 0, 0.62], scale, cx: w * 0.52, cy: h * 0.5 }, { livery, ink: 5 * this.S, shadow: false, number: livery.number });
      this.cache.set(id, canvas);
    }
    return canvas;
  }

  /** Ink drawing of a circuit outline inside a box. */
  trackMap(track, x, y, w, h, color = INK) {
    const ctx = this.ctx;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < track.n; i++) { minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]); minZ = Math.min(minZ, track.z[i]); maxZ = Math.max(maxZ, track.z[i]); }
    const k = Math.min(w / (maxX - minX), h / (maxZ - minZ)) * 0.9;
    const ox = x + w / 2 - ((minX + maxX) / 2) * k, oz = y + h / 2 - ((minZ + maxZ) / 2) * k;
    const pts = [];
    for (let i = 0; i < track.n; i += 2) pts.push([ox + track.x[i] * k, oz + track.z[i] * k]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); tracePolygon(ctx, pts);
    ctx.strokeStyle = color; ctx.lineWidth = 19 * this.S; ctx.stroke();
    ctx.strokeStyle = '#f1efe6'; ctx.lineWidth = 13 * this.S; ctx.stroke();
    ctx.strokeStyle = '#6c6e77'; ctx.lineWidth = 9 * this.S; ctx.stroke();
    const nx = track.nx[0], nz = track.nz[0], tx = track.tx[0], tz = track.tz[0];
    ctx.strokeStyle = RED; ctx.lineWidth = 6 * this.S;
    ctx.beginPath(); ctx.moveTo(pts[0][0] - nx * 14 * this.S, pts[0][1] - nz * 14 * this.S); ctx.lineTo(pts[0][0] + nx * 14 * this.S, pts[0][1] + nz * 14 * this.S); ctx.stroke();
    // direction arrow
    const ax = pts[0][0] + tx * 40 * this.S + nx * 30 * this.S, az = pts[0][1] + tz * 40 * this.S + nz * 30 * this.S;
    ctx.fillStyle = RED; ctx.beginPath();
    ctx.moveTo(ax + tx * 22 * this.S, az + tz * 22 * this.S); ctx.lineTo(ax - tx * 10 * this.S + nx * 12 * this.S, az - tz * 10 * this.S + nz * 12 * this.S); ctx.lineTo(ax - tx * 10 * this.S - nx * 12 * this.S, az - tz * 10 * this.S - nz * 12 * this.S); ctx.closePath(); ctx.fill();
  }

  /**
   * View of the place where a circuit lies: sky and the circuit's own distant scenery (the
   * panoramas of the race), over open ground. Cached per circuit and size.
   * @param horizon height of the horizon in the picture, as a fraction of h
   * @param zoom    how much of the panorama is shown (1 = its natural scale for this height)
   */
  vista(track, w, h, horizon, zoom = 1) {
    const key = `vista:${track.id}:${Math.round(w)}x${Math.round(h)}:${horizon}:${zoom}`;
    let canvas = this.cache.get(key);
    if (canvas) return canvas;
    canvas = makeCanvas(Math.ceil(w), Math.ceil(h));
    const ctx = canvas.getContext('2d'), P = getPalette(track.theme), theme = getTheme(track.theme);
    const yH = Math.round(h * horizon);
    const sky = ctx.createLinearGradient(0, 0, 0, yH);
    sky.addColorStop(0, P.skyTop); sky.addColorStop(0.55, P.skyMid); sky.addColorStop(1, P.skyLow);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, yH + 2);
    ctx.fillStyle = P.farGround; ctx.fillRect(0, yH, w, h - yH);
    // the three panoramas of the race, painted once per circuit at their native size and kept:
    // everything below their horizon line (haze meant to sink into the ground) is left out
    const sw = 4096, sh = 768, stripHorizonPx = Math.floor(backdropHorizon(sh));
    let strip = this.cache.get(`panorama:${track.id}`);
    if (!strip) {
      strip = makeCanvas(sw, stripHorizonPx);
      const layer = makeCanvas(sw, sh), lctx = layer.getContext('2d'), sctx = strip.getContext('2d');
      for (let index = 0; index < 3; index++) {
        paintBackdropLayer(index, lctx, sw, sh, P, theme.backdrop, seeded(hashString(`backdrop:${track.id}:${index}`)), theme);
        sctx.drawImage(layer, 0, 0, sw, stripHorizonPx, 0, 0, sw, stripHorizonPx);
      }
      // one circuit at a time: the panoramas and views of the previous one are dropped
      for (const k of [...this.cache.keys()]) if ((k.startsWith('panorama:') || k.startsWith('vista:')) && !k.includes(`:${track.id}`)) this.cache.delete(k);
      this.cache.set(`panorama:${track.id}`, strip);
    }
    const bandH = yH * 1.25 * zoom, k = bandH / sh;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // the panorama repeats (it covers a third of a turn): laid side by side to the full width
    for (let x = 0; x < w; x += sw * k - 1) ctx.drawImage(strip, 0, 0, sw, stripHorizonPx, x, yH - stripHorizonPx * k, sw * k, stripHorizonPx * k);
    this.cache.set(key, canvas);
    return canvas;
  }

  /** Scenery of an illustrated circuit plan: woods around the track, grandstand and pits by the start line. */
  mapScenery(track, x, y, w, h, P) {
    const ctx = this.ctx, S = this.S;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < track.n; i++) { minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]); minZ = Math.min(minZ, track.z[i]); maxZ = Math.max(maxZ, track.z[i]); }
    const k = Math.min(w / (maxX - minX), h / (maxZ - minZ)) * 0.9;
    const ox = x + w / 2 - ((minX + maxX) / 2) * k, oz = y + h / 2 - ((minZ + maxZ) / 2) * k;
    const rnd = seeded(hashString(`map:${track.id}`));
    const step = Math.max(1, Math.floor(track.n / 160));
    const near = (px, py, limit) => {
      for (let i = 0; i < track.n; i += step) { const dx = ox + track.x[i] * k - px, dy = oz + track.z[i] * k - py; if (dx * dx + dy * dy < limit * limit) return true; }
      return false;
    };
    // clumps of trees, kept clear of the road
    ctx.lineJoin = 'round';
    for (let n = 0; n < 150; n++) {
      const px = x - 40 * S + rnd() * (w + 80 * S), py = y - 20 * S + rnd() * (h + 60 * S), r = (9 + rnd() * 9) * S;
      if (near(px, py, 30 * S + r)) continue;
      // a clump seen from above: two or three overlapping flat discs under one contour
      const dark = rnd() < 0.5;
      const blobs = [[0, 0, r], [r * (0.5 + rnd() * 0.3), r * (rnd() - 0.5) * 0.8, r * (0.55 + rnd() * 0.25)], [-r * 0.4 * rnd(), r * (0.5 + rnd() * 0.3), r * (0.5 + rnd() * 0.2)]];
      ctx.beginPath(); for (const [bx, by, br] of blobs) { ctx.moveTo(px + bx + br, py + by); ctx.arc(px + bx, py + by, br, 0, Math.PI * 2); }
      ctx.strokeStyle = INK; ctx.lineWidth = 4 * S; ctx.stroke();
      ctx.fillStyle = dark ? P.pine : P.leaf; ctx.fill();
      ctx.beginPath(); ctx.arc(px + r * 0.2, py + r * 0.25, r * 0.5, 0, Math.PI * 2); ctx.fillStyle = dark ? P.pineShade : P.leafShade; ctx.fill();
    }
    // grandstand on one side of the start line, pit building on the other
    const sx = ox + track.x[0] * k, sy = oz + track.z[0] * k;
    const tx = track.tx[0], tz = track.tz[0], nx = track.nx[0], nz = track.nz[0];
    const block = (side, len, depth, gap, roof, body) => {
      const cx = sx + nx * side * gap * S, cy = sy + nz * side * gap * S;
      const hx = tx * len * S * 0.5, hy = tz * len * S * 0.5, dx = nx * side * depth * S, dy = nz * side * depth * S;
      ctx.beginPath(); ctx.moveTo(cx - hx, cy - hy); ctx.lineTo(cx + hx, cy + hy); ctx.lineTo(cx + hx + dx, cy + hy + dy); ctx.lineTo(cx - hx + dx, cy - hy + dy); ctx.closePath();
      ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3 * S; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - hx + dx * 0.45, cy - hy + dy * 0.45); ctx.lineTo(cx + hx + dx * 0.45, cy + hy + dy * 0.45); ctx.lineTo(cx + hx + dx, cy + hy + dy); ctx.lineTo(cx - hx + dx, cy - hy + dy); ctx.closePath();
      ctx.fillStyle = roof; ctx.fill(); ctx.stroke();
    };
    const pitSide = track.pit ? track.pit.side : 1;
    block(-pitSide, 150, 30, 22, P.roof, P.crowd[2]);
    block(pitSide, 190, 24, 26, P.metalLight, P.concrete);
  }

  paperBackground() {
    const ctx = this.ctx, W = this.W, H = this.H, S = this.S;
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    // faint printing dots in two corners
    ctx.fillStyle = PAPER_SHADE;
    for (let gy = 0; gy < 26; gy++) for (let gx = 0; gx < 40; gx++) {
      const r = Math.max(0, 5.5 - (gx + gy) * 0.16) * S;
      if (r < 0.6) continue;
      ctx.beginPath(); ctx.arc(W - (gx * 17 + 12) * S, H - (gy * 17 + 12) * S, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  title(x, y, size) {
    const ctx = this.ctx, S = this.S;
    drawText(ctx, t('game.title'), x, y, size, { style: 'impact', color: RED, outline: INK, outlineWidth: size * 0.13, shadow: { dx: 9 * S, dy: 10 * S, color: INK }, bounce: 0.05, seed: 4 });
    drawText(ctx, t('game.subtitle'), x + 6 * S, y + size * 0.64, size * 0.22, { style: 'bold', color: INK });      // clear of the title's drop shadow
  }

  // ---- pages -----------------------------------------------------------------------------------

  /**
   * Menu page. model: { heading, items: [{ label, value, desc, locked }], selected, hero: { team, yaw },
   *                     track (optional track data for a map panel), info: [lines], theme }
   */
  paintMenu(model) {
    const ctx = this.ctx, W = this.W, H = this.H, S = this.S;
    this.hits.length = 0;
    this.paperBackground();
    const m = 44 * S, g = 26 * S;
    const leftW = W * 0.56;
    const palette = getPalette(model.theme || 'forest');
    // ---- panel 1: illustration
    const p1 = [[m, m], [leftW + 60 * S, m], [leftW - 20 * S, H * 0.68], [m, H * 0.68]];
    this.beginPanel(p1);
    if (model.track) {
      // an illustrated plan: the circuit laid on its ground, under the skyline of the place
      const tp = getPalette(model.track.theme);
      // two registers, as on a comic page: a strip showing the site, and below it the plan seen from above
      const bandH = H * 0.68 * 0.24;
      ctx.drawImage(this.vista(model.track, leftW + 80 * S, bandH, 0.72), m, m);
      ctx.fillStyle = tp.farGround; ctx.fillRect(m, m + bandH, leftW + 80 * S, H * 0.68);
      ctx.fillStyle = PAPER; ctx.fillRect(m, m + bandH - 5 * S, leftW + 80 * S, 10 * S);
      ctx.fillStyle = INK; ctx.fillRect(m, m + bandH - 7.5 * S, leftW + 80 * S, 3.5 * S); ctx.fillRect(m, m + bandH + 4 * S, leftW + 80 * S, 3.5 * S);
      const mx = m + 70 * S, my = m + bandH + 30 * S, mw = leftW - 200 * S, mh = H * 0.68 - bandH - m - 50 * S;
      this.mapScenery(model.track, mx, my, mw, mh, tp);
      this.trackMap(model.track, mx, my, mw, mh);
      drawText(ctx, model.track.name, m + 44 * S, m + 104 * S, 62 * S, { style: 'impact', color: '#ffd42a', outline: INK, outlineWidth: 9 * S, shadow: { dx: 6 * S, dy: 7 * S, color: INK }, seed: 2 });
    } else {
      this.speedBackdrop(m, m, leftW + 80 * S, H * 0.68, palette, 7);
      const hero = model.hero || { team: 9, yaw: 2.5 };
      const cw = leftW - 60 * S, ch = H * 0.62 - m;
      const car = this.car(`hero:${hero.team}:${hero.yaw}`, cw, ch, { yaw: hero.yaw, pitch: 0.13, distance: 6.2 }, { colors: teamHex(hero.team), number: hero.number ?? teamNumber(hero.team) });
      ctx.drawImage(car, m + 10 * S, m + 40 * S);
    }
    this.endPanel(p1);
    // ---- title block
    const titleRoom = W - m - (leftW + 110 * S) - 20 * S;
    const titleSize = Math.min(150 * S, (150 * S * titleRoom) / measureText(t('game.title'), 150 * S, { style: 'impact' }));
    this.title(leftW + 110 * S, m + 40 * S + titleSize, titleSize);
    if (model.heading) drawText(ctx, model.heading, leftW + 116 * S, m + 346 * S, 48 * S, { style: 'bold', color: BLUE });
    // ---- panel 2: list
    const lx = leftW + 70 * S, ly = m + 382 * S, lw = W - m - lx;
    const rowH = Math.min(92 * S, (H - ly - m - 30 * S) / Math.max(1, model.items.length));
    const size = Math.min(40 * S, rowH * 0.46);
    model.items.forEach((item, i) => {
      const y = ly + i * rowH;
      const selected = i === model.selected;
      const x = lx + (selected ? -14 * S : 0);
      if (selected) {
        ctx.fillStyle = INK; ctx.fillRect(x + 7 * S, y + 8 * S, lw, rowH - 14 * S);
        ctx.fillStyle = CAPTION; ctx.fillRect(x, y, lw, rowH - 14 * S);
        ctx.strokeStyle = INK; ctx.lineWidth = 4 * S; ctx.strokeRect(x, y, lw, rowH - 14 * S);
        ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(x - 34 * S, y + rowH * 0.18); ctx.lineTo(x - 8 * S, y + rowH * 0.42); ctx.lineTo(x - 34 * S, y + rowH * 0.66); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 3 * S; ctx.stroke();
      } else {
        ctx.fillStyle = '#fbf8ee'; ctx.fillRect(x, y, lw, rowH - 14 * S);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5 * S; ctx.strokeRect(x, y, lw, rowH - 14 * S);
      }
      const base = y + (rowH - 14 * S) / 2 + size * 0.5;
      const color = item.locked ? '#9a968a' : INK;
      drawText(ctx, item.label, x + 24 * S, base, size, { style: selected ? 'bold' : 'caption', color, jitter: 0 });
      if (item.value !== undefined && item.value !== null) {
        const vw = measureText(String(item.value), size, { style: 'bold' });
        const vx = x + lw - 60 * S - vw;
        drawText(ctx, String(item.value), vx, base, size, { style: 'bold', color: item.locked ? '#9a968a' : RED, jitter: 0 });
        if (selected && item.adjustable) {
          ctx.fillStyle = INK;
          ctx.beginPath(); ctx.moveTo(vx - 34 * S, base - size * 0.5); ctx.lineTo(vx - 14 * S, base - size * 0.95); ctx.lineTo(vx - 14 * S, base - size * 0.05); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x + lw - 22 * S, base - size * 0.5); ctx.lineTo(x + lw - 42 * S, base - size * 0.95); ctx.lineTo(x + lw - 42 * S, base - size * 0.05); ctx.closePath(); ctx.fill();
        }
      }
      this.hits.push({ x: lx - 14 * S, y, w: lw + 14 * S, h: rowH - 14 * S, index: i });
    });
    // ---- panel 3: caption and hints
    const item = model.items[model.selected];
    const cy = H * 0.68 + g;
    const p3 = [[m, cy], [leftW - 24 * S, cy], [leftW - 74 * S, H - m], [m, H - m]];
    this.beginPanel(p3);
    ctx.fillStyle = '#fbf8ee'; ctx.fillRect(m, cy, leftW, H - cy);
    if (!model.track) {
      // third panel of the plate: a close-up on the driver, with the caption box laid over it
      const hero = model.hero || { team: 9, yaw: 2.5 };
      const cw = leftW * 0.6, chh = H - m - cy + 60 * S;
      ctx.fillStyle = palette.asphalt; ctx.fillRect(m + leftW * 0.36, cy, leftW, H - cy);
      ctx.fillStyle = palette.asphaltGroove; ctx.fillRect(m + leftW * 0.36, cy, leftW, (H - cy) * 0.34);
      ctx.drawImage(this.carCloseUp(String(hero.team), cw, chh, { colors: teamHex(hero.team), number: hero.number ?? teamNumber(hero.team) }), m + leftW * 0.36, cy - 30 * S);
      ctx.fillStyle = '#fbf8ee';
      ctx.beginPath(); ctx.moveTo(m, cy); ctx.lineTo(m + leftW * 0.42, cy); ctx.lineTo(m + leftW * 0.34, H - m); ctx.lineTo(m, H - m); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 5 * S; ctx.beginPath(); ctx.moveTo(m + leftW * 0.42, cy); ctx.lineTo(m + leftW * 0.34, H - m); ctx.stroke();
    }
    if (model.track) {
      const vw = leftW * 0.5, vx = m + leftW - vw - 40 * S;
      ctx.drawImage(this.vista(model.track, vw, H - cy, 0.62, 1.5), vx, cy);
      ctx.fillStyle = '#fbf8ee';
      ctx.beginPath(); ctx.moveTo(vx - 2, cy); ctx.lineTo(vx + 70 * S, cy); ctx.lineTo(vx + 10 * S, H - m); ctx.lineTo(vx - 2, H - m); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 5 * S; ctx.beginPath(); ctx.moveTo(vx + 70 * S, cy); ctx.lineTo(vx + 10 * S, H - m); ctx.stroke();
    }
    this.endPanel(p3);
    let ty = cy + 34 * S;
    if (model.info) for (const line of model.info) { drawText(ctx, line, m + 36 * S, ty + 30 * S, 30 * S, { style: 'bold', color: INK, jitter: 0 }); ty += 46 * S; }
    if (item && item.desc) this.caption(item.desc, m + 34 * S, ty + 6 * S, model.track ? leftW * 0.46 : leftW * 0.5, 27 * S);
    drawText(ctx, t('menu.hint'), W - m - 10 * S, H - m - 8 * S, 19 * S, { style: 'caption', color: '#6b6d78', align: 'right', jitter: 0 });
  }

  /** Pause overlay: translucent veil and a small panel. model: { heading, items, selected } */
  paintPause(model) {
    const ctx = this.ctx, W = this.W, H = this.H, S = this.S;
    this.hits.length = 0;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(22,22,31,0.5)'; ctx.fillRect(0, 0, W, H);
    const pw = 760 * S, ph = (230 + model.items.length * 96) * S, px = (W - pw) / 2, py = (H - ph) / 2;
    ctx.fillStyle = INK; ctx.fillRect(px + 12 * S, py + 14 * S, pw, ph);
    ctx.fillStyle = PAPER; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = INK; ctx.lineWidth = 7 * S; ctx.strokeRect(px, py, pw, ph);
    drawText(ctx, model.heading, W / 2, py + 130 * S, 84 * S, { style: 'impact', color: RED, outline: INK, outlineWidth: 10 * S, align: 'center', seed: 2 });
    model.items.forEach((item, i) => {
      const y = py + 190 * S + i * 96 * S, x = px + 70 * S, w = pw - 140 * S, h = 76 * S;
      const selected = i === model.selected;
      ctx.fillStyle = selected ? CAPTION : '#fbf8ee'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = INK; ctx.lineWidth = (selected ? 4.5 : 2.5) * S; ctx.strokeRect(x, y, w, h);
      drawText(ctx, item.label, W / 2, y + 54 * S, 38 * S, { style: selected ? 'bold' : 'caption', color: INK, align: 'center', jitter: 0 });
      this.hits.push({ x, y, w, h, index: i });
    });
  }

  /**
   * Result plate. model: { headline, sub, rows: [{ pos, name, team, teamIndex, time, best, points, human, retired }],
   *                        columns: ['time','best','points'], heroTeam, footer, theme, standings: bool }
   */
  paintResults(model) {
    const ctx = this.ctx, W = this.W, H = this.H, S = this.S;
    this.hits.length = 0;
    this.paperBackground();
    const m = 44 * S;
    const leftW = W * 0.44;
    const palette = getPalette(model.theme || 'forest');
    const p1 = [[m, m], [leftW + 50 * S, m], [leftW - 30 * S, H * 0.62], [m, H * 0.62]];
    this.beginPanel(p1);
    this.speedBackdrop(m, m, leftW + 60 * S, H * 0.62, palette, 13, 0.6);
    const car = this.car(`result:${model.heroTeam}:${model.heroNumber || ''}`, leftW - 60 * S, H * 0.56 - m, { yaw: 0.62, pitch: 0.12, distance: 6.5 }, { colors: teamHex(model.heroTeam), number: model.heroNumber ?? teamNumber(model.heroTeam) });
    ctx.drawImage(car, m + 10 * S, m + 60 * S);
    this.endPanel(p1);
    drawText(ctx, model.headline, m + 30 * S, H * 0.62 + 150 * S, 104 * S, { style: 'impact', color: '#ffd42a', outline: INK, outlineWidth: 12 * S, shadow: { dx: 8 * S, dy: 9 * S, color: INK }, bounce: 0.08, seed: 5 });
    if (model.sub) this.caption(model.sub, m + 20 * S, H * 0.62 + 200 * S, leftW - 60 * S, 30 * S);
    // ---- table
    const tx = leftW + 90 * S, tw = W - m - tx;
    drawText(ctx, model.title, tx, m + 76 * S, 70 * S, { style: 'impact', color: RED, outline: INK, outlineWidth: 9 * S, seed: 1 });
    const top = m + 120 * S;
    const rowH = Math.min(70 * S, (H - top - m - 80 * S) / Math.max(1, model.rows.length));
    const size = Math.min(30 * S, rowH * 0.5);
    const cols = model.columns;
    const colW = 250 * S;
    model.rows.forEach((row, i) => {
      const y = top + i * rowH;
      ctx.fillStyle = row.human ? CAPTION : i % 2 ? '#fbf8ee' : '#ede6d3';
      ctx.fillRect(tx, y, tw, rowH - 6 * S);
      if (row.human) { ctx.strokeStyle = INK; ctx.lineWidth = 3.5 * S; ctx.strokeRect(tx, y, tw, rowH - 6 * S); }
      const base = y + (rowH - 6 * S) / 2 + size * 0.5;
      drawText(ctx, String(row.pos), tx + 62 * S, base, size * 1.15, { style: 'bold', color: INK, align: 'right', jitter: 0 });
      const colors = teamHex(row.teamIndex);
      ctx.fillStyle = colors[0]; ctx.fillRect(tx + 80 * S, y + 8 * S, 16 * S, rowH - 22 * S);
      ctx.fillStyle = colors[1]; ctx.fillRect(tx + 96 * S, y + 8 * S, 8 * S, rowH - 22 * S);
      ctx.strokeStyle = INK; ctx.lineWidth = 2 * S; ctx.strokeRect(tx + 80 * S, y + 8 * S, 24 * S, rowH - 22 * S);
      drawText(ctx, row.name, tx + 122 * S, base, size, { style: row.human ? 'bold' : 'caption', color: INK, jitter: 0 });
      cols.forEach((col, c) => {
        const value = row[col];
        if (value === undefined || value === null) return;
        drawText(ctx, String(value), tx + tw - 24 * S - (cols.length - 1 - c) * colW, base, size, { style: col === 'points' ? 'bold' : 'caption', color: row.retired && col === 'time' ? RED : INK, align: 'right', jitter: 0 });
      });
    });
    if (model.footer) drawText(ctx, model.footer, tx, H - m - 20 * S, 26 * S, { style: 'bold', color: BLUE, jitter: 0 });
    drawText(ctx, t('menu.continue'), W - m - 10 * S, H - m - 20 * S, 34 * S, { style: 'bold', color: RED, align: 'right', jitter: 0 });
    this.hits.push({ x: 0, y: 0, w: W, h: H, index: 0 });
  }

  /**
   * Intro strip: three panels appearing one after the other. model: { track, captions: [3], team, round, grid, theme }
   * `time` in seconds since the start of the strip.
   */
  paintIntro(model, time) {
    const ctx = this.ctx, W = this.W, H = this.H, S = this.S;
    this.hits.length = 0;
    this.paperBackground();
    const m = 44 * S, g = 28 * S;
    const palette = getPalette(model.theme || 'forest');
    const livery = { colors: teamHex(model.team), number: model.number ?? teamNumber(model.team) };
    const appear = (index) => Math.max(0, Math.min(1, (time - index * 0.85) / 0.28));
    // panel 1: the circuit
    const a1 = appear(0);
    if (a1 > 0) {
      const top = H * 0.46;
      const off = (1 - a1) * -60 * S;
      const p = [[m, m + off], [W - m, m + off], [W - m, top - 40 * S + off], [m, top + off]];
      ctx.globalAlpha = a1;
      this.beginPanel(p);
      ctx.fillStyle = palette.skyLow; ctx.fillRect(m, m + off, W, top);
      ctx.fillStyle = palette.grassA; ctx.fillRect(m, m + off + top * 0.5, W, top);
      ctx.fillStyle = palette.grassB;
      for (let i = 0; i < 9; i++) ctx.fillRect(m + i * W * 0.12, m + off + top * 0.5, W * 0.06, top);
      this.trackMap(model.track, W * 0.4, m + off + 20 * S, W * 0.56, top - m - 70 * S);
      drawText(ctx, model.track.name, m + 50 * S, m + off + 150 * S, 110 * S, { style: 'impact', color: '#ffd42a', outline: INK, outlineWidth: 13 * S, shadow: { dx: 8 * S, dy: 9 * S, color: INK }, seed: 3 });
      if (model.round) drawText(ctx, model.round, m + 56 * S, m + off + 236 * S, 40 * S, { style: 'bold', color: INK });
      this.endPanel(p);
      this.caption(model.captions[0], m + 50 * S, top - 150 * S + off, W * 0.34, 28 * S);
      ctx.globalAlpha = 1;
    }
    const top2 = H * 0.46 + g;
    const split = W * 0.58;
    // panel 2: the car
    const a2 = appear(1);
    if (a2 > 0) {
      const off = (1 - a2) * -80 * S;
      const p = [[m + off, top2], [split + off, top2 - 40 * S * 0.62], [split - 70 * S + off, H - m], [m + off, H - m]];
      ctx.globalAlpha = a2;
      this.beginPanel(p);
      this.speedBackdrop(m + off, top2 - 40 * S, split, H - top2, palette, 21, 0.5);
      const car = this.car(`intro:${model.team}`, split - m - 90 * S, H - top2 - m - 30 * S, { yaw: 2.62, pitch: 0.1, distance: 6 }, livery);
      ctx.drawImage(car, m + off + 10 * S, top2 + 10 * S);
      this.endPanel(p);
      this.caption(model.captions[1], m + off + 36 * S, top2 + 20 * S, split * 0.6, 26 * S);
      if (model.grid) this.caption(model.grid, m + off + 36 * S, H - m - 110 * S, split * 0.5, 30 * S, { fill: PAPER, style: 'bold' });
      ctx.globalAlpha = 1;
    }
    // panel 3: close-up
    const a3 = appear(2);
    if (a3 > 0) {
      const off = (1 - a3) * 80 * S;
      const x0 = split + g;
      const p = [[x0 + off, top2 - 40 * S * 0.62 - 12 * S], [W - m + off, top2 - 40 * S], [W - m + off, H - m], [x0 - 70 * S + off, H - m]];
      ctx.globalAlpha = a3;
      this.beginPanel(p);
      ctx.fillStyle = palette.asphalt; ctx.fillRect(x0 - 80 * S + off, top2 - 60 * S, W, H);
      ctx.fillStyle = palette.asphaltGroove; ctx.fillRect(x0 - 80 * S + off, top2 - 60 * S, W, (H - top2) * 0.3);
      const close = this.carCloseUp(String(model.team), W - m - x0 + 80 * S, H - top2 - m + 40 * S, livery);
      ctx.drawImage(close, x0 - 70 * S + off, top2 - 30 * S);
      this.endPanel(p);
      this.caption(model.captions[2], x0 + off + 10 * S, H - m - 150 * S, (W - m - x0) * 0.82, 26 * S);
      ctx.globalAlpha = 1;
    }
    this.hits.push({ x: 0, y: 0, w: W, h: H, index: 0 });
  }

  /** Loading / message plate. */
  paintMessage(text) {
    const ctx = this.ctx, W = this.W, H = this.H, S = this.S;
    this.paperBackground();
    this.title(W * 0.5 - 420 * S, H * 0.42, 190 * S);
    drawText(ctx, text, W / 2, H * 0.66, 44 * S, { style: 'bold', color: INK, align: 'center' });
  }
}
