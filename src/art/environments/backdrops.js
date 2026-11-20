// Distant backdrops: three 120-degree panoramas per circuit theme (0 clouds, 1 far relief,
// 2 near relief), painted once per circuit. Each must tile horizontally. The bottom edge of the
// canvas sits slightly below the horizon (see backdrop-rules.js); colours get paler with distance.

import { BACKDROP_TAN_TOP, BACKDROP_TAN_BOTTOM } from './backdrop-rules.js';
import { closedCurve, blobPoints } from '../styles/ink.js';

/** y coordinate (pixels) of the horizon line inside a backdrop canvas of height h. */
export function backdropHorizon(h) { return (h * BACKDROP_TAN_TOP) / (BACKDROP_TAN_TOP - BACKDROP_TAN_BOTTOM); }

function ridge(ctx, w, h, base, amp, freq, seed, color) {
  const y0 = backdropHorizon(h);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) {
    const t = (x / w) * Math.PI * 2;
    const y = y0 - base - amp * (0.5 + 0.3 * Math.sin(t * freq + seed) + 0.2 * Math.sin(t * (freq * 2 + 1) + seed * 2.3));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
}

/** Provisional backdrop painter (replaced by the full panoramas of backdrop-painters.js). */
export function paintBackdropLayer(index, ctx, w, h, P, kind, rnd) {
  ctx.clearRect(0, 0, w, h);
  if (index === 0) {
    for (let i = 0; i < 9; i++) {
      const cx = ((i + rnd() * 0.6) / 9) * w, cy = h * (0.2 + rnd() * 0.45), rx = 90 + rnd() * 170, ry = 22 + rnd() * 30;
      for (const dx of [-w, 0, w]) {
        ctx.fillStyle = P.cloudShade; ctx.beginPath(); closedCurve(ctx, blobPoints(cx + dx, cy + 6, rx, ry, 7, 0.2, rnd)); ctx.fill();
        ctx.fillStyle = P.cloudLight; ctx.beginPath(); closedCurve(ctx, blobPoints(cx + dx - 6, cy - 5, rx * 0.92, ry * 0.8, 7, 0.2, rnd)); ctx.fill();
      }
    }
  } else if (index === 1) {
    ridge(ctx, w, h, 20, 90, 3, 1.3, P.farReliefLight);
    ridge(ctx, w, h, 8, 60, 5, 4.1, P.farRelief);
  } else {
    ridge(ctx, w, h, 4, 26, 9, 2.2, P.nearRelief);
    ridge(ctx, w, h, 0, 14, 14, 5.2, P.nearReliefShade);
  }
}
