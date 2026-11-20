// Racing line: lateral offset from the centre line that minimises bending energy inside the
// track limits (iterative relaxation on a coarse grid, then interpolated to every sample).

import { clamp, lerp, wrapAngle } from '../core/math.js';

const COARSE_STEP = 4;       // every 4th sample (~10 m)
const ITERATIONS = 700;
const EDGE_MARGIN = 1.6;     // metres kept between the line and the track edge
const LINE_BLEND = 0.9;      // 1 = pure minimum curvature

export function computeRacingLine(track) {
  const { n, x, z, nx, nz, halfWidth, ds } = track;
  const m = Math.floor(n / COARSE_STEP);
  const limit = Math.max(0.5, halfWidth - EDGE_MARGIN);
  const cx = new Float64Array(m), cz = new Float64Array(m), ux = new Float64Array(m), uz = new Float64Array(m);
  const d = new Float64Array(m);
  for (let k = 0; k < m; k++) {
    const i = Math.floor((k * n) / m);
    cx[k] = x[i]; cz[k] = z[i]; ux[k] = nx[i]; uz[k] = nz[i];
  }
  for (let it = 0; it < ITERATIONS; it++) {
    for (let pass = 0; pass < 2; pass++) {
      for (let k = pass; k < m; k += 2) {
        const a2 = (k + m - 2) % m, a1 = (k + m - 1) % m, b1 = (k + 1) % m, b2 = (k + 2) % m;
        const p = (q) => cx[q] + ux[q] * d[q];
        const r = (q) => cz[q] + uz[q] * d[q];
        const targetX = (4 * (p(a1) + p(b1)) - (p(a2) + p(b2))) / 6;
        const targetZ = (4 * (r(a1) + r(b1)) - (r(a2) + r(b2))) / 6;
        const wanted = (targetX - cx[k]) * ux[k] + (targetZ - cz[k]) * uz[k];
        d[k] = clamp(lerp(d[k], wanted, 0.6), -limit, limit);
      }
    }
  }
  // Interpolate back to full resolution (Catmull-Rom style cubic through coarse values).
  const offset = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = (i * m) / n;
    const k = Math.floor(f), t = f - k;
    const p0 = d[(k + m - 1) % m], p1 = d[k % m], p2 = d[(k + 1) % m], p3 = d[(k + 2) % m];
    const v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    offset[i] = clamp(v * LINE_BLEND, -limit, limit);
  }
  // Curvature of the resulting line.
  const kappa = new Float32Array(n);
  const lx = new Float64Array(n), lz = new Float64Array(n);
  for (let i = 0; i < n; i++) { lx[i] = x[i] + nx[i] * offset[i]; lz[i] = z[i] + nz[i] * offset[i]; }
  const span = 2;
  for (let i = 0; i < n; i++) {
    const a = (i + n - span) % n, b = (i + span) % n;
    const h0 = Math.atan2(lz[i] - lz[a], lx[i] - lx[a]);
    const h1 = Math.atan2(lz[b] - lz[i], lx[b] - lx[i]);
    const len = 0.5 * (Math.hypot(lx[i] - lx[a], lz[i] - lz[a]) + Math.hypot(lx[b] - lx[i], lz[b] - lz[i]));
    kappa[i] = wrapAngle(h1 - h0) / Math.max(len, ds);
  }
  const tmp = new Float32Array(n);
  for (let it = 0; it < 3; it++) {
    for (let i = 0; i < n; i++) tmp[i] = 0.25 * kappa[(i + n - 1) % n] + 0.5 * kappa[i] + 0.25 * kappa[(i + 1) % n];
    kappa.set(tmp);
  }
  return { offset, kappa };
}
