// Turns a declarative circuit definition (polygon corners with fillet radii) into
// uniformly sampled track data used by physics, AI and rendering. Pure data: no GPU, no DOM.
//
// Conventions: world is Y up; the track lies mostly in the XZ plane. Heading angle `h`
// gives forward = (cos h, sin h) in (x, z); right = (-sin h, cos h). Lateral offset `d`
// is positive to the right of the centre line. Curvature > 0 turns right.

import { clamp, lerp, smoothstep, wrapAngle, mod } from '../core/math.js';
import { computeRacingLine } from './racing-line.js';

export const SURFACE = { ASPHALT: 0, KERB: 1, GRASS: 2, GRAVEL: 3, PIT: 4 };
export const VERGE = { GRASS: 0, GRAVEL: 1, PIT: 2 };

const SAMPLE_SPACING = 2.5;
const KERB_WIDTH = 1.5;

/** Default pit lane layout, distances relative to the start line (negative = before it). */
const PIT_LAYOUT = {
  entryS: -300, wallStartS: -240, wallEndS: 110, exitS: 170,
  wallGap: 1.3, wallThickness: 0.5, laneWidth: 10, speedLimit: 22.2,
  boxFirstS: -36, boxSpacing: 13, boxCount: 9,
};

function closedSmooth(values, iterations) {
  const n = values.length;
  const tmp = new Float32Array(n);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      tmp[i] = 0.25 * values[(i + n - 1) % n] + 0.5 * values[i] + 0.25 * values[(i + 1) % n];
    }
    values.set(tmp);
  }
}

function resampleClosed(px, pz, count) {
  const n = px.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    cum[i + 1] = cum[i] + Math.hypot(px[j] - px[i], pz[j] - pz[i]);
  }
  const total = cum[n];
  const m = count || Math.max(16, Math.round(total / SAMPLE_SPACING));
  const ox = new Float32Array(m), oz = new Float32Array(m);
  let seg = 0;
  for (let k = 0; k < m; k++) {
    const target = (k / m) * total;
    while (seg < n - 1 && cum[seg + 1] < target) seg++;
    const span = cum[seg + 1] - cum[seg] || 1;
    const t = (target - cum[seg]) / span;
    const j = (seg + 1) % n;
    ox[k] = lerp(px[seg], px[j], t);
    oz[k] = lerp(pz[seg], pz[j], t);
  }
  return { x: ox, z: oz, length: total };
}

/** Expand polygon corners with fillet radii into a dense closed polyline starting at the start line. */
function traceCorners(def, warnings) {
  const corners = def.corners.map((c) => ({ x: c[0], z: c[1], r: c[2], y: c[3] || 0 }));
  const n = corners.length;
  const info = [];
  for (let i = 0; i < n; i++) {
    const p = corners[(i + n - 1) % n], c = corners[i], q = corners[(i + 1) % n];
    let d1x = c.x - p.x, d1z = c.z - p.z, d2x = q.x - c.x, d2z = q.z - c.z;
    const l1 = Math.hypot(d1x, d1z), l2 = Math.hypot(d2x, d2z);
    d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
    const turn = Math.atan2(d1x * d2z - d1z * d2x, d1x * d2x + d1z * d2z);
    info.push({ c, d1x, d1z, d2x, d2z, turn, lenIn: l1, r: c.r, tangent: c.r * Math.tan(Math.abs(turn) / 2) });
  }
  // Shrink radii that do not fit on their edges.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < n; i++) {
      const a = info[i], b = info[(i + 1) % n];
      const available = b.lenIn;
      const need = a.tangent + b.tangent;
      if (need > available * 0.98) {
        const k = (available * 0.98) / need;
        a.r *= k; b.r *= k;
        a.tangent *= k; b.tangent *= k;
        if (pass === 0) warnings.push(`radius shrunk at corners ${i}/${(i + 1) % n}`);
      }
    }
  }
  const last = info[n - 1], first = info[0];
  const straightLen = first.lenIn - last.tangent - first.tangent;
  const startDistance = def.startDistance ?? 330;
  if (straightLen < startDistance + 200) warnings.push(`main straight too short (${straightLen.toFixed(0)} m)`);
  // Start point on the edge from the last corner to corner 0.
  const exitX = last.c.x + last.d2x * last.tangent, exitZ = last.c.z + last.d2z * last.tangent;
  const sx = exitX + last.d2x * startDistance, sz = exitZ + last.d2z * startDistance;

  const px = [], pz = [], stations = [];
  let cx = sx, cz = sz, travelled = 0;
  const lineTo = (x, z) => {
    const len = Math.hypot(x - cx, z - cz);
    const steps = Math.max(1, Math.ceil(len));
    for (let k = 0; k < steps; k++) {
      px.push(lerp(cx, x, k / steps)); pz.push(lerp(cz, z, k / steps));
    }
    travelled += len; cx = x; cz = z;
  };
  for (let i = 0; i < n; i++) {
    const a = info[i];
    const ax = a.c.x - a.d1x * a.tangent, az = a.c.z - a.d1z * a.tangent;
    lineTo(ax, az);
    const sign = Math.sign(a.turn) || 1;
    const ox = ax + -a.d1z * a.r * sign, oz = az + a.d1x * a.r * sign;
    const arcLen = Math.abs(a.turn) * a.r;
    const steps = Math.max(2, Math.ceil(arcLen));
    const rx = ax - ox, rz = az - oz;
    for (let k = 0; k < steps; k++) {
      const ang = (a.turn * k) / steps;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      px.push(ox + rx * ca - rz * sa); pz.push(oz + rx * sa + rz * ca);
    }
    stations.push({ s: travelled + arcLen / 2, y: a.c.y });
    travelled += arcLen;
    cx = a.c.x + a.d2x * a.tangent; cz = a.c.z + a.d2z * a.tangent;
  }
  lineTo(sx, sz);
  return { px, pz, stations, denseLength: travelled };
}

function buildElevation(stations, denseLength, n, length) {
  const y = new Float32Array(n);
  const scale = length / denseLength;
  const st = stations.map((k) => ({ s: k.s * scale, y: k.y }));
  const count = st.length;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * length;
    let k = 0;
    while (k < count && st[k].s <= s) k++;
    const a = st[(k + count - 1) % count], b = st[k % count];
    let s0 = a.s, s1 = b.s;
    if (k === 0) s0 -= length;
    if (k === count) s1 += length;
    y[i] = lerp(a.y, b.y, smoothstep(s0, s1, s));
  }
  closedSmooth(y, 24);
  return y;
}

/**
 * @param {object} def circuit definition (see track-catalog.js)
 * @returns {object} track data
 */
export function buildTrack(def) {
  const warnings = [];
  const traced = traceCorners(def, warnings);
  let res = resampleClosed(traced.px, traced.pz);
  closedSmooth(res.x, 5);
  closedSmooth(res.z, 5);
  res = resampleClosed(res.x, res.z, res.x.length);
  const n = res.x.length;
  const length = res.length;
  const ds = length / n;
  const x = res.x, z = res.z;
  const y = buildElevation(traced.stations, traced.denseLength, n, length);

  const heading = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n);
  const nx = new Float32Array(n), nz = new Float32Array(n);
  const kappa = new Float32Array(n), grade = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    const dx = x[b] - x[a], dz = z[b] - z[a];
    const l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l; tz[i] = dz / l;
    nx[i] = -tz[i]; nz[i] = tx[i];
    heading[i] = Math.atan2(dz, dx);
    grade[i] = (y[b] - y[a]) / (2 * ds);
  }
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    kappa[i] = wrapAngle(heading[b] - heading[a]) / (2 * ds);
  }
  closedSmooth(kappa, 2);

  const halfWidth = (def.width ?? 13) / 2;
  const track = {
    def, id: def.id, name: def.name, theme: def.theme || 'forest',
    n, ds, length, x, y, z, tx, tz, nx, nz, heading, kappa, grade,
    halfWidth, kerbWidth: KERB_WIDTH, warnings,
    kerbL: new Float32Array(n), kerbR: new Float32Array(n),
    barrierL: new Float32Array(n), barrierR: new Float32Array(n),
    vergeL: new Uint8Array(n), vergeR: new Uint8Array(n),
    pit: null, line: null, lineKappa: null,
    sectors: [length / 3, (2 * length) / 3],
  };
  layoutEdges(track, def);
  layoutPit(track, def);
  const line = computeRacingLine(track);
  track.line = line.offset;
  track.lineKappa = line.kappa;
  return track;
}

/** Kerbs, verge widths and barrier offsets on both sides. */
function layoutEdges(track, def) {
  const { n, ds, kappa, x, z, nx, nz, tx, tz, halfWidth } = track;
  const absK = new Float32Array(n);
  for (let i = 0; i < n; i++) absK[i] = Math.abs(kappa[i]);
  const around = (m) => Math.round(m / ds);
  const exitShift = around(30), lookAhead = around(130), lookBehind = around(25);
  const baseVerge = def.verge ?? 9;
  const desiredL = new Float32Array(n), desiredR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // Inside kerb through the corner; outside kerb from mid corner to ~30 m past the exit.
    const inside = smoothstep(1 / 300, 1 / 150, absK[i]);
    let exitR = 0, exitL = 0;
    for (let k = 2; k <= exitShift; k += 2) {
      const j = (i + n - k) % n;
      const strength = smoothstep(1 / 260, 1 / 130, absK[j]);
      if (kappa[j] > 0) exitL = Math.max(exitL, strength); else exitR = Math.max(exitR, strength);
    }
    track.kerbR[i] = Math.max(kappa[i] > 0 ? inside : 0, exitR);
    track.kerbL[i] = Math.max(kappa[i] < 0 ? inside : 0, exitL);
    // Run-off: widen the verge on the outside of an upcoming or current corner.
    let peak = 0, peakSign = 0;
    for (let k = -lookBehind; k <= lookAhead; k += 3) {
      const j = mod(i + k, n);
      const weight = k > 0 ? 1 - (k / lookAhead) * 0.5 : 1;
      if (absK[j] * weight > peak) { peak = absK[j] * weight; peakSign = Math.sign(kappa[j]); }
    }
    const runoff = smoothstep(1 / 220, 1 / 70, peak);
    desiredR[i] = baseVerge + (peakSign < 0 ? runoff * 15 : 0);
    desiredL[i] = baseVerge + (peakSign > 0 ? runoff * 15 : 0);
    track.vergeR[i] = peakSign < 0 && runoff > 0.55 ? VERGE.GRAVEL : VERGE.GRASS;
    track.vergeL[i] = peakSign > 0 && runoff > 0.55 ? VERGE.GRAVEL : VERGE.GRASS;
  }
  // Clearance against other parts of the circuit, per side.
  const skip = around(45);
  const clearL = new Float32Array(n).fill(1e9), clearR = new Float32Array(n).fill(1e9);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j += 2) {
      const gap = Math.min(mod(i - j, n), mod(j - i, n));
      if (gap < skip) continue;
      const dx = x[j] - x[i], dz = z[j] - z[i];
      const dist = Math.hypot(dx, dz);
      if (dist > 90) continue;
      const lateral = dx * nx[i] + dz * nz[i];
      const along = dx * tx[i] + dz * tz[i];
      if (Math.abs(lateral) < Math.abs(along) * 0.6) continue;
      if (lateral > 0) clearR[i] = Math.min(clearR[i], dist); else clearL[i] = Math.min(clearL[i], dist);
    }
  }
  const minBarrier = halfWidth + 2.2;
  track.minClearance = 1e9;
  for (let i = 0; i < n; i++) {
    const radius = 1 / Math.max(absK[i], 1e-5);
    const foldLimitR = kappa[i] > 0 ? radius * 0.72 : 1e9;
    const foldLimitL = kappa[i] < 0 ? radius * 0.72 : 1e9;
    track.minClearance = Math.min(track.minClearance, clearL[i], clearR[i]);
    track.barrierR[i] = Math.max(minBarrier, Math.min(halfWidth + desiredR[i], clearR[i] / 2 - 0.6, foldLimitR));
    track.barrierL[i] = Math.max(minBarrier, Math.min(halfWidth + desiredL[i], clearL[i] / 2 - 0.6, foldLimitL));
  }
  // Smooth the walls but never exceed the hard limits.
  const limR = Float32Array.from(track.barrierR), limL = Float32Array.from(track.barrierL);
  for (let pass = 0; pass < 3; pass++) {
    closedSmooth(track.barrierR, 6);
    closedSmooth(track.barrierL, 6);
    for (let i = 0; i < n; i++) {
      track.barrierR[i] = Math.max(minBarrier, Math.min(track.barrierR[i], limR[i]));
      track.barrierL[i] = Math.max(minBarrier, Math.min(track.barrierL[i], limL[i]));
    }
  }
  if (track.minClearance < 2 * minBarrier + 1) {
    track.warnings.push(`layout too tight: clearance ${track.minClearance.toFixed(1)} m`);
  }
}

function layoutPit(track, def) {
  const side = def.pitSide ?? 1;
  const p = { ...PIT_LAYOUT, ...(def.pit || {}) };
  const { n, ds, halfWidth, length } = track;
  const wallD = halfWidth + p.wallGap + p.wallThickness / 2;
  const outerD = wallD + p.wallThickness / 2 + p.laneWidth;
  const laneD = wallD + p.wallThickness / 2 + 2.6;
  const boxD = outerD - 2.4;
  track.pit = {
    side, entryS: p.entryS, wallStartS: p.wallStartS, wallEndS: p.wallEndS, exitS: p.exitS,
    wallD, wallThickness: p.wallThickness, laneD, boxD, outerD, speedLimit: p.speedLimit,
    boxFirstS: p.boxFirstS, boxSpacing: p.boxSpacing, boxCount: p.boxCount,
  };
  const barrier = side > 0 ? track.barrierR : track.barrierL;
  const verge = side > 0 ? track.vergeR : track.vergeL;
  const kerb = side > 0 ? track.kerbR : track.kerbL;
  const from = Math.floor(p.entryS / ds), to = Math.ceil(p.exitS / ds);
  for (let k = from; k <= to; k++) {
    const i = mod(k, n);
    const s = k * ds;
    const ramp = Math.min(smoothstep(p.entryS, p.wallStartS, s), 1 - smoothstep(p.wallEndS, p.exitS, s));
    barrier[i] = lerp(barrier[i], outerD, ramp);
    if (ramp > 0.02) { verge[i] = VERGE.PIT; kerb[i] = 0; }
  }
  if (Math.abs(track.kappa[mod(from, n)]) > 1e-3 || Math.abs(track.kappa[mod(to, n)]) > 1e-3) {
    track.warnings.push('pit lane overlaps a corner');
  }
  void length;
}

/** Signed distance along the track from the start line, in (-length/2, length/2]. */
export function relativeS(track, s) {
  let r = mod(s, track.length);
  if (r > track.length / 2) r -= track.length;
  return r;
}

/** World pose at track coordinates (s, d). Writes x,y,z,heading,grade into `out`. */
export function trackPose(track, s, d, out) {
  const f = mod(s, track.length) / track.ds;
  const i = Math.floor(f) % track.n, j = (i + 1) % track.n, t = f - Math.floor(f);
  const cx = lerp(track.x[i], track.x[j], t), cz = lerp(track.z[i], track.z[j], t);
  const nxv = lerp(track.nx[i], track.nx[j], t), nzv = lerp(track.nz[i], track.nz[j], t);
  out.x = cx + nxv * d;
  out.z = cz + nzv * d;
  out.y = lerp(track.y[i], track.y[j], t);
  out.heading = track.heading[i] + wrapAngle(track.heading[j] - track.heading[i]) * t;
  out.grade = lerp(track.grade[i], track.grade[j], t);
  return out;
}

/**
 * Project a world position on the centre line. `hint` is the previous sample index (or -1 for a
 * global search). Writes index, s, d into `out`.
 */
export function locateOnTrack(track, px, pz, hint, out) {
  const { n, x, z, tx, tz, nx, nz, ds } = track;
  let best = -1, bestDist = 1e18;
  if (hint >= 0) {
    for (let k = -6; k <= 10; k++) {
      const i = mod(hint + k, n);
      const dx = px - x[i], dz = pz - z[i];
      const dist = dx * dx + dz * dz;
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    if (bestDist > 60 * 60) best = -1;
  }
  if (best < 0) {
    bestDist = 1e18;
    for (let i = 0; i < n; i++) {
      const dx = px - x[i], dz = pz - z[i];
      const dist = dx * dx + dz * dz;
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
  }
  const dx = px - x[best], dz = pz - z[best];
  let along = dx * tx[best] + dz * tz[best];
  let index = best;
  if (along < 0) { index = (best + n - 1) % n; along += ds; }
  const t = clamp(along / ds, 0, 1);
  const j = (index + 1) % n;
  const cx = lerp(x[index], x[j], t), cz = lerp(z[index], z[j], t);
  const nxv = lerp(nx[index], nx[j], t), nzv = lerp(nz[index], nz[j], t);
  out.index = index;
  out.s = (index + t) * ds;
  out.d = (px - cx) * nxv + (pz - cz) * nzv;
  return out;
}

/** Linear interpolation of a per-sample array at distance s. */
export function sampleArray(track, array, s) {
  const f = mod(s, track.length) / track.ds;
  const i = Math.floor(f) % track.n, j = (i + 1) % track.n;
  return lerp(array[i], array[j], f - Math.floor(f));
}

/** Is distance `s` inside the pit zone section [a, b] given relative to the start line? */
export function inPitRange(track, s, a, b) {
  const r = relativeS(track, s);
  return r >= a && r <= b;
}

/** Surface type under lateral offset d at sample index i. */
export function surfaceAt(track, i, d) {
  const ad = Math.abs(d);
  if (ad <= track.halfWidth) return SURFACE.ASPHALT;
  const right = d > 0;
  const kerb = right ? track.kerbR[i] : track.kerbL[i];
  if (kerb > 0.5 && ad <= track.halfWidth + track.kerbWidth) return SURFACE.KERB;
  const verge = right ? track.vergeR[i] : track.vergeL[i];
  if (verge === VERGE.PIT) return SURFACE.PIT;
  if (verge === VERGE.GRAVEL && ad > track.halfWidth + 3) return SURFACE.GRAVEL;
  return SURFACE.GRASS;
}

/** Starting grid slot k (0 = pole): staggered two-by-two formation behind the line. */
export function gridSlot(track, k, out) {
  out.s = -(8 + k * 8);
  out.d = (k % 2 === 0 ? -1 : 1) * track.halfWidth * 0.45;
  return out;
}

/** Pit box position (track coordinates) for a team index. */
export function pitBox(track, teamIndex, out) {
  const p = track.pit;
  out.s = p.boxFirstS - (teamIndex % p.boxCount) * p.boxSpacing;
  out.d = p.side * p.boxD;
  return out;
}
