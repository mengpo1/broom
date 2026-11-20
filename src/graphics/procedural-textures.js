// Textures generated at start-up: a tileable noise atlas and a sign atlas drawn with Canvas 2D.
// Nothing is loaded from files.

import { ATLAS } from './materials.js';

function latticeHash(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tileable value noise with `period` cells across the unit square. */
function tileNoise(u, v, period, seed) {
  const x = u * period, y = v * period;
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const x0 = xi % period, x1 = (xi + 1) % period, y0 = yi % period, y1 = (yi + 1) % period;
  const a = latticeHash(x0, y0, seed), b = latticeHash(x1, y0, seed);
  const c = latticeHash(x0, y1, seed), d = latticeHash(x1, y1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function tileFbm(u, v, period, octaves, seed) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(u, v, period << o, seed + o * 31);
    norm += amp; amp *= 0.5;
  }
  return sum / norm;
}

/** RGBA8 noise: R low frequency fbm, G medium fbm, B fine grain, A mid fbm (decorrelated). */
export function createNoiseTexture(device, size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, o = (y * size + x) * 4;
      const stretch = (n, k) => Math.max(0, Math.min(1, (n - 0.5) * k + 0.5));
      data[o] = stretch(tileFbm(u, v, 4, 5, 11), 1.9) * 255;
      data[o + 1] = stretch(tileFbm(u, v, 8, 4, 23), 1.9) * 255;
      data[o + 2] = stretch(tileNoise(u, v, 64, 37) * 0.6 + tileNoise(u, v, 128, 41) * 0.4, 1.5) * 255;
      data[o + 3] = stretch(tileFbm(u, v, 16, 3, 53), 1.9) * 255;
    }
  }
  const mipCount = Math.log2(size) + 1;
  const texture = device.createTexture({
    label: 'noise', size: [size, size], format: 'rgba8unorm', mipLevelCount: mipCount,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  let level = data, w = size;
  for (let mip = 0; mip < mipCount; mip++) {
    device.queue.writeTexture({ texture, mipLevel: mip }, level, { bytesPerRow: w * 4 }, [w, w]);
    if (w === 1) break;
    const nw = w >> 1, next = new Uint8Array(nw * nw * 4);
    for (let y = 0; y < nw; y++) {
      for (let x = 0; x < nw; x++) {
        for (let c = 0; c < 4; c++) {
          const i = (y * 2 * w + x * 2) * 4 + c;
          next[(y * nw + x) * 4 + c] = (level[i] + level[i + 4] + level[i + w * 4] + level[i + w * 4 + 4]) >> 2;
        }
      }
    }
    level = next; w = nw;
  }
  return texture;
}

// Fictional trackside brands (invented names, simple geometric marks).
const BILLBOARDS = [
  { text: 'VIRAGE', bg: '#c8102e', fg: '#ffffff', mark: 'chevron' },
  { text: 'APEX OIL', bg: '#f2c200', fg: '#151515', mark: 'drop' },
  { text: 'NORDWIND', bg: '#0b3d91', fg: '#ffffff', mark: 'bars' },
  { text: 'KORVA', bg: '#f4f4f4', fg: '#0f6b3c', mark: 'circle' },
  { text: 'SOLENE', bg: '#111111', fg: '#ff7a00', mark: 'sun' },
  { text: 'TELLURA', bg: '#0f6b3c', fg: '#f4f4f4', mark: 'triangle' },
  { text: 'MISTRAL', bg: '#e8e8ee', fg: '#c8102e', mark: 'chevron' },
  { text: 'OKTAN 98', bg: '#1b1b3a', fg: '#f2c200', mark: 'bars' },
];

function drawMark(ctx, kind, x, y, s, color) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  if (kind === 'chevron') { ctx.moveTo(x - s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 0.1, y); ctx.lineTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x - s * 0.15, y + s * 0.5); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x - s * 0.15, y - s * 0.5); ctx.fill(); }
  else if (kind === 'drop') { ctx.arc(x, y + s * 0.12, s * 0.36, 0, Math.PI * 2); ctx.moveTo(x - s * 0.3, y); ctx.lineTo(x, y - s * 0.6); ctx.lineTo(x + s * 0.3, y); ctx.fill(); }
  else if (kind === 'bars') { for (let i = 0; i < 3; i++) ctx.fillRect(x - s * 0.5 + i * s * 0.36, y - s * 0.5 + i * s * 0.12, s * 0.24, s - i * s * 0.24); }
  else if (kind === 'circle') { ctx.arc(x, y, s * 0.42, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, Math.PI * 2); ctx.fill(); }
  else if (kind === 'sun') { ctx.arc(x, y, s * 0.26, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.36, y + Math.sin(a) * s * 0.36); ctx.lineTo(x + Math.cos(a) * s * 0.52, y + Math.sin(a) * s * 0.52); ctx.stroke(); } }
  else { ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x + s * 0.5, y + s * 0.45); ctx.lineTo(x - s * 0.5, y + s * 0.45); ctx.fill(); }
}

function paintAtlas(ctx, size, title) {
  const font = (px, style = 'bold italic') => `${style} ${px}px "Helvetica Neue", Arial, "DejaVu Sans", sans-serif`;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // digits: white on black, used as masks
  ctx.fillStyle = '#fff'; ctx.font = font(118, 'bold');
  for (let d = 0; d < 10; d++) ctx.fillText(String(d), d * 96 + 48, 68);
  // billboards
  BILLBOARDS.forEach((b, i) => {
    const x = (i % 2) * 512, y = 128 + Math.floor(i / 2) * 128;
    ctx.fillStyle = b.bg; ctx.fillRect(x, y, 512, 128);
    drawMark(ctx, b.mark, x + 72, y + 64, 76, b.fg);
    ctx.fillStyle = b.fg; ctx.font = font(64);
    ctx.fillText(b.text, x + 300, y + 68, 360);
    ctx.strokeStyle = b.fg; ctx.lineWidth = 5; ctx.strokeRect(x + 7, y + 7, 498, 114);
  });
  // distance boards
  ['300', '200', '100'].forEach((t, i) => {
    const x = i * 256, y = 640;
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x, y, 256, 128);
    ctx.fillStyle = '#111'; ctx.font = font(104, 'bold'); ctx.fillText(t, x + 128, y + 70);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.strokeRect(x + 6, y + 6, 244, 116);
  });
  // start banner
  ctx.fillStyle = '#101418'; ctx.fillRect(0, 768, 1024, 128);
  ctx.fillStyle = '#c8102e'; ctx.fillRect(0, 768, 1024, 12); ctx.fillRect(0, 884, 1024, 12);
  ctx.fillStyle = '#fff'; ctx.font = font(84);
  ctx.fillText(title, 512, 836, 900);
  // checker
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = (x + y) % 2 ? '#f2f2f2' : '#0c0c0c'; ctx.fillRect(x * 32, 896 + y * 32, 32, 32); }
  // corner arrows
  ctx.fillStyle = '#f2c200'; ctx.fillRect(256, 896, 256, 128);
  ctx.fillStyle = '#111';
  for (let i = 0; i < 3; i++) { const x = 290 + i * 76; ctx.beginPath(); ctx.moveTo(x, 916); ctx.lineTo(x + 46, 960); ctx.lineTo(x, 1004); ctx.lineTo(x + 26, 1004); ctx.lineTo(x + 72, 960); ctx.lineTo(x + 26, 916); ctx.fill(); }
  // pit sign
  ctx.fillStyle = '#0b3d91'; ctx.fillRect(512, 896, 256, 128);
  ctx.fillStyle = '#fff'; ctx.font = font(88, 'bold'); ctx.fillText('PIT', 640, 964);
  // flags
  ctx.fillStyle = '#c8102e'; ctx.fillRect(768, 896, 128, 128);
  ctx.fillStyle = '#fff'; ctx.fillRect(768, 938, 128, 44);
  ctx.fillStyle = '#f2c200'; ctx.fillRect(896, 896, 128, 128);
  ctx.fillStyle = '#0b3d91'; ctx.beginPath(); ctx.moveTo(896, 896); ctx.lineTo(1024, 960); ctx.lineTo(896, 1024); ctx.fill();
}

/** Sign atlas (digits, fictional billboards, boards, banner). */
export function createAtlasTexture(device, title = 'VIRAGE GP') {
  const size = ATLAS.size;
  const mipCount = Math.log2(size) + 1;
  const texture = device.createTexture({
    label: 'atlas', size: [size, size], format: 'rgba8unorm', mipLevelCount: mipCount,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const base = new OffscreenCanvas(size, size);
  paintAtlas(base.getContext('2d'), size, title);
  let source = base;
  for (let mip = 0, w = size; mip < mipCount; mip++, w = Math.max(1, w >> 1)) {
    if (mip > 0) {
      const c = new OffscreenCanvas(w, w);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, w, w);
      source = c;
    }
    device.queue.copyExternalImageToTexture({ source }, { texture, mipLevel: mip }, [w, w]);
  }
  return texture;
}
