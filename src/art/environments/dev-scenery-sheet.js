// Development contact sheet for scenery drawings (not part of the game bundle).
// args: { filter: 'tree' (substring of the id) or ['tree','bush'], theme: 'forest', backdrop: 'mountains' (shows the panoramas instead),
//         scale: 1, bg: '#...' }
import { expandScenerySpecs } from './scenery-specs.js';
import { sceneryPainter, hasSceneryPainter } from './scenery-painters.js';
import { paintBackdropLayer, backdropHorizon } from './backdrops.js';
import { getPalette } from '../palettes/palettes.js';
import { seeded } from '../styles/ink.js';
import { hashString } from '../../core/random.js';
import { drawText } from '../styles/lettering.js';

window.renderPreview = (canvas, args) => {
  const ctx = canvas.getContext('2d');
  const theme = args.theme || 'forest';
  const P = getPalette(theme);
  const W = canvas.width, H = canvas.height;
  if (args.backdrop) {
    // sky bands, then the three panoramas, shown 1.25 periods wide to check the horizontal wrap
    const bw = 4096, bh = 768;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.8);
    g.addColorStop(0, P.skyTop); g.addColorStop(0.6, P.skyMid); g.addColorStop(1, P.skyLow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const k = W / (bw * 1.25);
    const layer = new OffscreenCanvas(bw, bh), lctx = layer.getContext('2d');
    const y0 = H * 0.75 - backdropHorizon(bh) * k;
    for (let i = 0; i < 3; i++) {
      paintBackdropLayer(i, lctx, bw, bh, P, args.backdrop, seeded(hashString(`backdrop:sheet:${i}`)), { backdrop: args.backdrop });
      ctx.drawImage(layer, 0, y0, bw * k, bh * k);
      ctx.drawImage(layer, bw * k, y0, bw * k, bh * k);
    }
    ctx.fillStyle = P.farGround; ctx.fillRect(0, H * 0.75, W, H * 0.25);
    ctx.fillStyle = '#ff00ff'; ctx.fillRect(bw * k - 1, 0, 2, 12);     // marks the wrap seam
    drawText(ctx, `${args.backdrop} / ${theme} (seam at the pink tick)`, 16, H - 20, 20, { color: P.ink });
    return 'backdrop';
  }
  ctx.fillStyle = args.bg || '#9fb6a6'; ctx.fillRect(0, 0, W, H);
  const filters = [].concat(args.filter || '');
  const specs = expandScenerySpecs().filter((s) => filters.some((f) => s.id.includes(f)));
  const scale = args.scale || 1;
  let x = 16, y = 16, rowH = 0;
  const missing = [];
  for (const spec of specs) {
    const repeat = spec.kind === 'strip' ? 2 : 1;
    const w = spec.w * scale * repeat, h = spec.h * scale;
    if (x + w > W - 16) { x = 16; y += rowH + 40; rowH = 0; }
    if (!hasSceneryPainter(spec.family)) missing.push(spec.id);
    const paint = sceneryPainter(spec.family);
    for (let r = 0; r < repeat; r++) {
      ctx.save();
      ctx.translate(x + r * spec.w * scale, y);
      ctx.scale(scale, scale);
      ctx.beginPath(); ctx.rect(0, 0, spec.w, spec.h); ctx.clip();
      paint(ctx, spec.w, spec.h, P, seeded(hashString(`${spec.id}:${theme}`)), spec.variant, spec);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    drawText(ctx, `${spec.id}  ${spec.worldW ? spec.worldW + 'x' : ''}${spec.worldH} m`, x, y + h + 22, 13, { color: '#16161f' });
    x += w + 24; rowH = Math.max(rowH, h);
  }
  return { drawn: specs.length, missing };
};
