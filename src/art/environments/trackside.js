// Trackside furniture and the strips that run along the road. Strip painters have the signature
// (ctx, w, h, P, rnd, variant) and must tile seamlessly from the left edge to the right edge
// (the atlas repeats them along the track); the top edge keeps a little transparent margin so
// the silhouette stays anti-aliased. Light comes from above.

import { LINE, brushStroke } from '../styles/ink.js';

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

/** Painters by family. Missing families fall back to a neutral placeholder (see scenery-painters.js). */
export const TRACKSIDE_PAINTERS = {
  'strip.armco': armco,
};
