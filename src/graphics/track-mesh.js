// Static world geometry generated from track data: road surface, kerbs, verges, barriers,
// pit complex, start area, terrain, distant backdrop. Output is organised in chunks
// (bounding sphere + index ranges) so the renderer can cull.

import { MeshBuilder } from './mesh-builder.js';
import { MAT, ATLAS } from './materials.js';
import { clamp, lerp, smoothstep, mod, mat4Create, mat4FromPose } from '../core/math.js';
import { Random, hashString, fbm2, valueNoise2 } from '../core/random.js';
import { VERGE, gridSlot, trackPose } from '../tracks/track-builder.js';
import { TEAMS } from '../vehicles/liveries.js';

const CHUNK_SAMPLES = 36;
const TERRAIN_CELL = 14;
const TERRAIN_MARGIN = 780;
const TILE_CELLS = 14;
const WHITE = [0.62, 0.62, 0.6];
const pose = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };

function openChunk(b) { return { v0: b.vertexCount, groundFirst: b.indexCount, groundCount: 0, structFirst: 0, structCount: 0 }; }
function midChunk(b, chunk) { chunk.groundCount = b.indexCount - chunk.groundFirst; chunk.structFirst = b.indexCount; }
function closeChunk(b, chunk, chunks) {
  chunk.structCount = b.indexCount - chunk.structFirst;
  if (b.vertexCount === chunk.v0) return null;
  Object.assign(chunk, b.bounds(chunk.v0, b.vertexCount));
  chunks.push(chunk);
  return chunk;
}

/**
 * Ribbon along the track: for every row k in [k0, k1] the callback returns the two edge
 * vertices [d, y, u, v, color] and the function emits quads facing `normalFn(i)`.
 */
function ribbon(b, track, k0, k1, edgeFn, normalFn, mat) {
  const n = track.n;
  let prevA = -1, prevB = -1;
  for (let k = k0; k <= k1; k++) {
    const i = mod(k, n);
    const e = edgeFn(i, k);
    if (!e) { prevA = -1; continue; }
    const nrm = normalFn(i, k);
    const ax = track.x[i] + track.nx[i] * e[0][0], az = track.z[i] + track.nz[i] * e[0][0];
    const bx = track.x[i] + track.nx[i] * e[1][0], bz = track.z[i] + track.nz[i] * e[1][0];
    const a = b.vertex(ax, track.y[i] + e[0][1], az, nrm[0], nrm[1], nrm[2], e[0][2], e[0][3], e[0][4], e[0][5] ?? mat);
    const c = b.vertex(bx, track.y[i] + e[1][1], bz, nrm[0], nrm[1], nrm[2], e[1][2], e[1][3], e[1][4], e[1][5] ?? mat);
    if (prevA >= 0) b.quad(prevA, prevB, c, a);
    prevA = a; prevB = c;
  }
}

function surfaceNormal(track, i) {
  const g = track.grade[i];
  const l = Math.hypot(g, 1);
  return [(-g * track.tx[i]) / l, 1 / l, (-g * track.tz[i]) / l];
}

function buildGround(b, track, theme, k0, k1, aux) {
  const hw = track.halfWidth, n = track.n, ds = track.ds;
  // ---- road: 8 strips across
  const COLS = 9;
  let prevRow = -1;
  for (let k = k0; k <= k1; k++) {
    const i = mod(k, n), s = k * ds;
    const nrm = surfaceNormal(track, i);
    const row = b.vertexCount;
    const intensity = aux.rubber[i];
    for (let c = 0; c < COLS; c++) {
      const d = -hw + (c / (COLS - 1)) * 2 * hw;
      const off = (d - track.line[i]) / 1.7;
      const rubber = Math.exp(-off * off) * intensity;
      b.vertex(track.x[i] + track.nx[i] * d, track.y[i], track.z[i] + track.nz[i] * d, nrm[0], nrm[1], nrm[2], d, s, [rubber, 1, 0], MAT.ASPHALT);
    }
    if (prevRow >= 0) for (let c = 0; c < COLS - 1; c++) b.quad(prevRow + c, prevRow + c + 1, row + c + 1, row + c);
    prevRow = row;
  }
  // ---- kerbs and verges on both sides
  for (const side of [-1, 1]) {
    const kerb = side > 0 ? track.kerbR : track.kerbL;
    const barrier = side > 0 ? track.barrierR : track.barrierL;
    const verge = side > 0 ? track.vergeR : track.vergeL;
    const gravel = side > 0 ? aux.gravelR : aux.gravelL;
    const kerbWidth = (i) => track.kerbWidth * smoothstep(0.05, 0.6, kerb[i]);
    // kerb: inner flush with the road, raised crown, lower outer lip
    for (let half = 0; half < 2; half++) {
      ribbon(b, track, k0, k1, (i, k) => {
        const w = kerbWidth(i);
        if (w < 0.01 && kerbWidth(mod(i + 1, n)) < 0.01 && kerbWidth(mod(i - 1, n)) < 0.01) return null;
        const d0 = hw + w * half * 0.5, d1 = hw + w * (half + 1) * 0.5;
        const y0 = half === 0 ? 0.002 : 0.045, y1 = half === 0 ? 0.045 : 0.012;
        return [[side * d0, y0, half * 0.5, k * ds, WHITE], [side * d1, y1, half * 0.5 + 0.5, k * ds, WHITE]];
      }, (i) => surfaceNormal(track, i), MAT.KERB);
    }
    // verge columns
    const cols = (i) => {
      const B = barrier[i];
      const e = hw + kerbWidth(i);
      const g = gravel[i];
      const pit = verge[i] === VERGE.PIT;
      const mat = pit ? MAT.PIT_ASPHALT : MAT.VERGE;
      return [
        [e, kerbWidth(i) > 0.01 ? 0.012 : 0, 0, mat],
        [Math.min(e + 1.5, B - 0.95), 0, 0, mat],
        [Math.min(hw + 3.4, B - 0.85), 0, g, mat],
        [Math.min(lerp(hw + 3.4, B - 0.5, 0.5), B - 0.7), 0, g, mat],
        [B - 0.5, 0, g, mat],
        [B + 0.5, 0, g * 0.3, pit ? MAT.PIT_ASPHALT : MAT.VERGE],
        [B + (pit ? 11 : 7.5), pit ? 0 : -1.5, 0, pit ? MAT.PIT_ASPHALT : MAT.VERGE],
      ];
    };
    let prev = -1;
    for (let k = k0; k <= k1; k++) {
      const i = mod(k, n), s = k * ds;
      const nrm = surfaceNormal(track, i);
      const c = cols(i);
      const row = b.vertexCount;
      for (let j = 0; j < c.length; j++) {
        const d = side * c[j][0];
        b.vertex(track.x[i] + track.nx[i] * d, track.y[i] + c[j][1], track.z[i] + track.nz[i] * d, nrm[0], nrm[1], nrm[2], d, s, [c[j][2], 0, 1], c[j][3]);
      }
      if (prev >= 0) for (let j = 0; j < c.length - 1; j++) b.quad(prev + j, prev + j + 1, row + j + 1, row + j);
      prev = row;
    }
  }
}

function buildBarriers(b, track, theme, k0, k1, aux) {
  const n = track.n, ds = track.ds;
  for (const side of [-1, 1]) {
    const barrier = side > 0 ? track.barrierR : track.barrierL;
    const verge = side > 0 ? track.vergeR : track.vergeL;
    const inward = (i) => [-side * track.nx[i], 0, -side * track.nz[i]];
    const outward = (i) => [side * track.nx[i], 0, side * track.nz[i]];
    const up = () => [0, 1, 0];
    const skip = (i) => verge[i] === VERGE.PIT && aux.pitWallZone(i);
    if (theme.barrier === 'concrete') {
      const col = theme.wall;
      ribbon(b, track, k0, k1, (i, k) => (skip(i) ? null : [[side * barrier[i], 0, k * ds, 0, col], [side * barrier[i], 1.05, k * ds, 1.05, col]]), inward, MAT.CONCRETE);
      ribbon(b, track, k0, k1, (i, k) => (skip(i) ? null : [[side * barrier[i], 1.05, k * ds, 0, col], [side * (barrier[i] + 0.3), 1.05, k * ds, 0.3, col]]), up, MAT.CONCRETE);
      ribbon(b, track, k0, k1, (i, k) => (skip(i) ? null : [[side * (barrier[i] + 0.3), 0, k * ds, 0, col], [side * (barrier[i] + 0.3), 1.05, k * ds, 1.05, col]]), outward, MAT.CONCRETE);
      // catch fence posts and top rail
      for (let k = k0; k < k1; k += 4) {
        const i = mod(k, n);
        if (skip(i)) continue;
        const d = side * (barrier[i] + 0.15);
        const px = track.x[i] + track.nx[i] * d, pz = track.z[i] + track.nz[i] * d;
        b.beam([px, track.y[i] + 1.05, pz], [px, track.y[i] + 3.1, pz], 0.07, [0.3, 0.32, 0.34], MAT.FENCE);
      }
      ribbon(b, track, k0, k1, (i, k) => (skip(i) ? null : [[side * (barrier[i] + 0.12), 3.04, k * ds, 0, [0.3, 0.32, 0.34]], [side * (barrier[i] + 0.12), 3.12, k * ds, 1, [0.3, 0.32, 0.34]]]), inward, MAT.FENCE);
    } else {
      const g = [0.5, 0.5, 0.5];
      ribbon(b, track, k0, k1, (i, k) => (skip(i) ? null : [[side * barrier[i], 0.3, k * ds, 0, g], [side * barrier[i], 0.82, k * ds, 1, g]]), inward, MAT.ARMCO);
      ribbon(b, track, k0, k1, (i, k) => (skip(i) ? null : [[side * (barrier[i] + 0.07), 0.3, k * ds, 0, g], [side * (barrier[i] + 0.07), 0.82, k * ds, 1, g]]), outward, MAT.ARMCO);
      ribbon(b, track, k0, k1, (i, k) => (skip(i) ? null : [[side * barrier[i], 0.82, k * ds, 0.2, g], [side * (barrier[i] + 0.07), 0.82, k * ds, 0.3, g]]), up, MAT.ARMCO);
      for (let k = k0; k < k1; k += 2) {
        const i = mod(k, n);
        if (skip(i)) continue;
        const d = side * (barrier[i] + 0.14);
        const px = track.x[i] + track.nx[i] * d, pz = track.z[i] + track.nz[i] * d;
        b.beam([px, track.y[i] - 0.1, pz], [px, track.y[i] + 0.86, pz], 0.1, [0.2, 0.2, 0.2], MAT.FENCE, 0.14);
      }
    }
    // tyre walls in front of the barrier where there is a gravel trap
    ribbon(b, track, k0, k1, (i, k) => (verge[i] === VERGE.GRAVEL ? [[side * (barrier[i] - 0.85), 0, k * ds, 0, WHITE], [side * (barrier[i] - 0.85), 0.95, k * ds, 1, WHITE]] : null), inward, MAT.TYRE_WALL);
    ribbon(b, track, k0, k1, (i, k) => (verge[i] === VERGE.GRAVEL ? [[side * (barrier[i] - 0.85), 0.95, k * ds, 0.88, WHITE], [side * (barrier[i] - 0.05), 0.95, k * ds, 0.9, WHITE]] : null), up, MAT.TYRE_WALL);
  }
}

/** Geometry expressed in the local frame of the main straight (origin at the start line). */
function straightFrame(b, track) {
  trackPose(track, 0, 0, pose);
  const m = mat4Create();
  mat4FromPose(m, pose.x, pose.y, pose.z, pose.heading, 0, 0);
  b.setMatrix(m);
  // local: +X right of the track, -Z forward (distance s maps to z = -s)
}

function buildStartArea(b, track, decals) {
  const hw = track.halfWidth;
  straightFrame(b, track);
  if (!decals) { buildGantry(b, hw); b.setMatrix(null); return; }
  const c = ATLAS.checker;
  b.quadPoints([-hw + 0.45, 0.014, 0.6], [hw - 0.45, 0.014, 0.6], [hw - 0.45, 0.014, -0.6], [-hw + 0.45, 0.014, -0.6], [0, 1, 0], [c.u, c.v, c.u + c.w, c.v + c.h * 0.5], WHITE, MAT.ATLAS);
  const slot = { s: 0, d: 0 };
  for (let k = 0; k < 20; k++) {
    gridSlot(track, k, slot);
    const z = -slot.s - 2.35, x = slot.d;
    b.quadPoints([x - 1.25, 0.013, z], [x + 1.25, 0.013, z], [x + 1.25, 0.013, z - 0.14], [x - 1.25, 0.013, z - 0.14], [0, 1, 0], [0, 0, 1, 1], WHITE, MAT.PAINT);
    for (const sx of [-1, 1]) b.quadPoints([x + sx * 1.25 - 0.07, 0.013, z + 1.1], [x + sx * 1.25 + 0.07, 0.013, z + 1.1], [x + sx * 1.25 + 0.07, 0.013, z], [x + sx * 1.25 - 0.07, 0.013, z], [0, 1, 0], [0, 0, 1, 1], WHITE, MAT.PAINT);
  }
  b.setMatrix(null);
}

function buildGantry(b, hw) {
  // gantry over the line
  const px = hw + 2.0, top = 7.4, zg = -7;
  const steel = [0.2, 0.21, 0.23];
  for (const sx of [-1, 1]) {
    b.box(sx * px, top / 2, zg, 0.25, top / 2, 0.25, steel, MAT.PAINT);
    b.box(sx * px, 0.2, zg, 0.6, 0.2, 0.6, [0.5, 0.5, 0.5], MAT.CONCRETE);
  }
  b.box(0, top - 0.1, zg, px + 0.25, 0.14, 0.4, steel, MAT.PAINT);
  b.box(0, top - 1.5, zg, px + 0.25, 0.1, 0.4, steel, MAT.PAINT);
  const bn = ATLAS.banner;
  b.quadPoints([-px + 0.4, top - 1.4, zg + 0.42], [px - 0.4, top - 1.4, zg + 0.42], [px - 0.4, top - 0.2, zg + 0.42], [-px + 0.4, top - 0.2, zg + 0.42], [0, 0, 1], [bn.u, bn.v + bn.h, bn.u + bn.w, bn.v], WHITE, MAT.ATLAS);
  b.quadPoints([px - 0.4, top - 1.4, zg - 0.42], [-px + 0.4, top - 1.4, zg - 0.42], [-px + 0.4, top - 0.2, zg - 0.42], [px - 0.4, top - 0.2, zg - 0.42], [0, 0, -1], [bn.u, bn.v + bn.h, bn.u + bn.w, bn.v], WHITE, MAT.ATLAS);
  // start light panel
  b.box(0, top - 2.2, zg + 0.3, 1.9, 0.42, 0.12, [0.03, 0.03, 0.03], MAT.PAINT);
  for (let i = 0; i < 5; i++) b.box(-1.4 + i * 0.7, top - 2.2, zg + 0.43, 0.2, 0.2, 0.01, [0.25, 0.01, 0.01], MAT.PAINT, { faces: 16 });
}

function buildPitComplex(b, track, theme, decals) {
  const p = track.pit, hw = track.halfWidth, side = p.side;
  straightFrame(b, track);
  const wall = theme.wall;
  const z0 = -p.wallStartS, z1 = -p.wallEndS;
  const zc = (z0 + z1) / 2, hl = Math.abs(z0 - z1) / 2;
  if (!decals) {
    // pit wall between the track and the lane
    b.box(side * p.wallD, 0.5, zc, p.wallThickness / 2, 0.5, hl, wall, MAT.CONCRETE);
    for (let z = z1 + 6; z < z0 - 6; z += 12) b.beam([side * p.wallD, 1.0, z], [side * p.wallD, 2.4, z], 0.06, [0.3, 0.32, 0.34], MAT.FENCE);
    b.box(side * p.wallD, 2.42, zc, 0.03, 0.03, hl - 6, [0.3, 0.32, 0.34], MAT.FENCE);
  }
  // lane edge lines and pit boxes
  const lineX = (x) => b.quadPoints([side * x - 0.07, 0.013, z0 - 4], [side * x + 0.07, 0.013, z0 - 4], [side * x + 0.07, 0.013, z1 + 4], [side * x - 0.07, 0.013, z1 + 4], [0, 1, 0], [0, 0, 1, 1], WHITE, MAT.PAINT);
  if (decals) { lineX(p.wallD + p.wallThickness / 2 + 0.5); lineX(p.boxD - 2.1); }
  for (let k = 0; k < p.boxCount; k++) {
    const zb = -(p.boxFirstS - k * p.boxSpacing) - 2.75;
    const team = TEAMS[k % TEAMS.length];
    const x0 = p.boxD - 1.9, x1 = p.outerD - 0.3;
    if (decals) { for (const zz of [zb - 4.8, zb + 4.8]) b.quadPoints([side * x0, 0.013, zz - 0.06], [side * x1, 0.013, zz - 0.06], [side * x1, 0.013, zz + 0.06], [side * x0, 0.013, zz + 0.06], [0, 1, 0], [0, 0, 1, 1], WHITE, MAT.PAINT); continue; }
    for (const zz of []) b.quadPoints([side * x0, 0.013, zz - 0.06], [side * x1, 0.013, zz - 0.06], [side * x1, 0.013, zz + 0.06], [side * x0, 0.013, zz + 0.06], [0, 1, 0], [0, 0, 1, 1], WHITE, MAT.PAINT);
    // garage door and team stripe on the building front
    const fx = side * (p.outerD + 0.18);
    b.quadPoints([fx, 0.05, zb - side * 4.2], [fx, 0.05, zb + side * 4.2], [fx, 3.3, zb + side * 4.2], [fx, 3.3, zb - side * 4.2], [-side, 0, 0], [0, 0, 1, 1], [0.05, 0.05, 0.06], MAT.COCKPIT);
    b.quadPoints([fx, 3.45, zb - side * 4.6], [fx, 3.45, zb + side * 4.6], [fx, 4.15, zb + side * 4.6], [fx, 4.15, zb - side * 4.6], [-side, 0, 0], [0, 0, 1, 1], team.primary, MAT.PAINT);
  }
  if (decals) { b.setMatrix(null); return; }
  // building
  const bz0 = -(p.boxFirstS + 14), bz1 = -(p.boxFirstS - (p.boxCount - 1) * p.boxSpacing - 12);
  const bzc = (bz0 + bz1) / 2, bhl = Math.abs(bz1 - bz0) / 2;
  const bx = side * (p.outerD + 5.2);
  b.box(bx, 2.25, bzc, 5, 2.25, bhl, [0.8, 0.8, 0.78], MAT.PAINT);
  b.box(bx, 6.0, bzc, 5, 1.5, bhl, theme.buildingColor, MAT.FACADE, { topMat: MAT.ROOF, topColor: [0.25, 0.26, 0.28] });
  b.box(side * (p.outerD + 3.8), 4.58, bzc, 6.6, 0.1, bhl + 0.8, [0.22, 0.23, 0.25], MAT.ROOF);
  b.box(side * (p.outerD + 3.8), 7.6, bzc, 6.6, 0.1, bhl + 0.8, [0.22, 0.23, 0.25], MAT.ROOF);
  // control tower near the start line
  b.box(bx, 6.5, bz0 - 5.5, 4, 6.5, 4, theme.buildingColor, MAT.FACADE, { topMat: MAT.ROOF, topColor: [0.25, 0.26, 0.28] });
  b.box(bx, 13.3, bz0 - 5.5, 5, 0.2, 5, [0.22, 0.23, 0.25], MAT.ROOF);
  // pit entry sign
  const sg = ATLAS.pitSign;
  const sx = side * (hw + 4), sz = -p.entryS + 30;
  b.beam([sx, 0, sz], [sx, 3.2, sz], 0.12, [0.3, 0.3, 0.3], MAT.PAINT);
  b.quadPoints([sx - 1.1, 2.2, sz + 0.08], [sx + 1.1, 2.2, sz + 0.08], [sx + 1.1, 3.3, sz + 0.08], [sx - 1.1, 3.3, sz + 0.08], [0, 0, 1], [sg.u, sg.v + sg.h, sg.u + sg.w, sg.v], WHITE, MAT.ATLAS);
  b.setMatrix(null);
}

/** Coarse grid of distance-to-track and track elevation, used by terrain and prop placement. */
export function buildDistanceGrid(track) {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, meanY = 0;
  for (let i = 0; i < track.n; i++) {
    minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]);
    minZ = Math.min(minZ, track.z[i]); maxZ = Math.max(maxZ, track.z[i]);
    meanY += track.y[i] / track.n;
  }
  const bbox = { minX, maxX, minZ, maxZ };
  const x0 = minX - TERRAIN_MARGIN, z0 = minZ - TERRAIN_MARGIN;
  const nx = Math.ceil((maxX - minX + 2 * TERRAIN_MARGIN) / TERRAIN_CELL) + 1;
  const nz = Math.ceil((maxZ - minZ + 2 * TERRAIN_MARGIN) / TERRAIN_CELL) + 1;
  const dist = new Float32Array(nx * nz).fill(1e6), ty = new Float32Array(nx * nz).fill(meanY);
  const corridor = new Float32Array(nx * nz), sample = new Int32Array(nx * nz).fill(-1);
  const R = 140, rc = Math.ceil(R / TERRAIN_CELL);
  const pit = track.pit;
  for (let i = 0; i < track.n; i++) {
    const cx = Math.round((track.x[i] - x0) / TERRAIN_CELL), cz = Math.round((track.z[i] - z0) / TERRAIN_CELL);
    for (let dz = -rc; dz <= rc; dz++) {
      const gz = cz + dz;
      if (gz < 0 || gz >= nz) continue;
      for (let dx = -rc; dx <= rc; dx++) {
        const gx = cx + dx;
        if (gx < 0 || gx >= nx) continue;
        const px = x0 + gx * TERRAIN_CELL - track.x[i], pz = z0 + gz * TERRAIN_CELL - track.z[i];
        const d = Math.hypot(px, pz);
        const o = gz * nx + gx;
        if (d < dist[o]) {
          dist[o] = d; ty[o] = track.y[i]; sample[o] = i;
          const right = px * track.nx[i] + pz * track.nz[i] > 0;
          let c = right ? track.barrierR[i] : track.barrierL[i];
          const verge = right ? track.vergeR[i] : track.vergeL[i];
          if (verge === VERGE.PIT && (right ? 1 : -1) === pit.side) c += 12;
          corridor[o] = c;
        }
      }
    }
  }
  const at = (array, x, z) => {
    const fx = clamp((x - x0) / TERRAIN_CELL, 0, nx - 1.001), fz = clamp((z - z0) / TERRAIN_CELL, 0, nz - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const o = iz * nx + ix;
    return lerp(lerp(array[o], array[o + 1], tx), lerp(array[o + nx], array[o + nx + 1], tx), tz);
  };
  return { x0, z0, nx, nz, dist, ty, corridor, sample, bbox, meanY, distanceAt: (x, z) => at(dist, x, z) };
}

/** Terrain height function for a theme (shared by terrain mesh and prop placement). */
export function makeHeightField(track, theme, grid) {
  const { bbox, meanY } = grid;
  const seed = (hashString(track.id) % 1000) * 3.7;
  const groundY = meanY - (theme.water ? 7 : 4);
  const waterY = theme.water ? meanY + theme.water.level : -1e9;
  const waterEdge = theme.water ? (theme.water.side > 0 ? bbox.maxZ + 75 : bbox.minZ - 75) : 0;
  const natural = (x, z) => {
    const db = Math.max(0, bbox.minX - x, x - bbox.maxX, bbox.minZ - z, z - bbox.maxZ);
    const amp = theme.terrainAmplitude * (1 + 1.3 * smoothstep(80, 600, db));
    let h = meanY + amp * (fbm2(x * theme.terrainScale + seed, z * theme.terrainScale - seed, 4) - 0.5) * 2;
    if (theme.water) {
      const w = theme.water.side > 0 ? z - waterEdge : waterEdge - z;
      h = lerp(h, waterY - 12, smoothstep(-40, 150, w));
    }
    const edge = smoothstep(TERRAIN_MARGIN - 190, TERRAIN_MARGIN - 20, db);
    return lerp(h, groundY + 0.3, edge);
  };
  const height = (x, z) => {
    const fx = (x - grid.x0) / TERRAIN_CELL, fz = (z - grid.z0) / TERRAIN_CELL;
    const base = natural(x, z);
    if (fx < 0 || fz < 0 || fx >= grid.nx - 1 || fz >= grid.nz - 1) return base;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, o = iz * grid.nx + ix;
    const bl = (a) => lerp(lerp(a[o], a[o + 1], tx), lerp(a[o + grid.nx], a[o + grid.nx + 1], tx), tz);
    const d = bl(grid.dist);
    if (d > 135) return base;
    const c = bl(grid.corridor) + 8;
    return lerp(bl(grid.ty) - 0.55, base, smoothstep(c, c + 90, d));
  };
  return { height, groundY, waterY, waterEdge };
}

function buildTerrain(b, track, theme, grid, field, chunks) {
  const { nx, nz, x0, z0 } = grid;
  const heights = new Float32Array(nx * nz);
  for (let gz = 0; gz < nz; gz++) for (let gx = 0; gx < nx; gx++) heights[gz * nx + gx] = field.height(x0 + gx * TERRAIN_CELL, z0 + gz * TERRAIN_CELL);
  const hAt = (gx, gz) => heights[clamp(gz, 0, nz - 1) * nx + clamp(gx, 0, nx - 1)];
  const sand = theme.gravel;
  for (let tz = 0; tz < nz - 1; tz += TILE_CELLS) {
    for (let tx = 0; tx < nx - 1; tx += TILE_CELLS) {
      const chunk = openChunk(b);
      const w = Math.min(TILE_CELLS, nx - 1 - tx), h = Math.min(TILE_CELLS, nz - 1 - tz);
      const first = b.vertexCount;
      for (let j = 0; j <= h; j++) {
        for (let i = 0; i <= w; i++) {
          const gx = tx + i, gz = tz + j;
          const x = x0 + gx * TERRAIN_CELL, z = z0 + gz * TERRAIN_CELL, y = hAt(gx, gz);
          const sx = (hAt(gx + 1, gz) - hAt(gx - 1, gz)) / (2 * TERRAIN_CELL), sz = (hAt(gx, gz + 1) - hAt(gx, gz - 1)) / (2 * TERRAIN_CELL);
          const l = Math.hypot(sx, 1, sz);
          const slope = Math.hypot(sx, sz);
          const mix = fbm2(x * 0.004 + 9, z * 0.004 + 3, 3);
          let col = [0, 1, 2].map((c) => lerp(theme.terrainLow[c], theme.terrainHigh[c], mix));
          const rock = smoothstep(theme.rockSlope * 0.7, theme.rockSlope * 1.3, slope);
          col = col.map((v, c) => lerp(v, theme.terrainRock[c], rock));
          if (y - grid.meanY > theme.snowLine * 0.5) { const sn = smoothstep(theme.snowLine * 0.5, theme.snowLine, y - grid.meanY) * (1 - rock * 0.6); col = col.map((v) => lerp(v, 0.82, sn)); }
          if (theme.water && y < field.waterY + 1.6) col = col.map((v, c) => lerp(sand[c], v, smoothstep(field.waterY + 0.3, field.waterY + 1.6, y)));
          const near = grid.dist[gz * nx + gx] < grid.corridor[gz * nx + gx] + 30;
          b.vertex(x, y, z, -sx / l, 1 / l, -sz / l, x, z, near ? [0, 0, 1] : col, near ? MAT.VERGE : MAT.TERRAIN);
        }
      }
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const a = first + j * (w + 1) + i;
        b.quad(a, a + 1, a + w + 2, a + w + 1);
      }
      midChunk(b, chunk);
      closeChunk(b, chunk, chunks);
    }
  }
}

function buildBackdrop(b, track, theme, grid, field, chunks) {
  const { bbox } = grid;
  const cx = (bbox.minX + bbox.maxX) / 2, cz = (bbox.minZ + bbox.maxZ) / 2;
  const reach = Math.hypot(bbox.maxX - bbox.minX, bbox.maxZ - bbox.minZ) / 2;
  const chunk = openChunk(b);
  // ground plane to the horizon
  const G = 9000, gy = field.groundY;
  b.quadPoints([cx - G, gy, cz + G], [cx + G, gy, cz + G], [cx + G, gy, cz - G], [cx - G, gy, cz - G], [0, 1, 0], [cx - G, cz + G, cx + G, cz - G], theme.terrainLow, MAT.TERRAIN);
  if (theme.water) {
    const wy = field.waterY, e = field.waterEdge - theme.water.side * 60;
    const za = e, zb = e + theme.water.side * G;
    b.quadPoints([cx - G, wy, Math.max(za, zb)], [cx + G, wy, Math.max(za, zb)], [cx + G, wy, Math.min(za, zb)], [cx - G, wy, Math.min(za, zb)], [0, 1, 0], [0, 0, 1, 1], theme.water.color, MAT.WATER);
  }
  // two rings of hills / mountains
  const seed = (hashString(track.id) % 97) * 1.3;
  const rings = [
    { r: reach + TERRAIN_MARGIN + 500, h: theme.backdropHeight * 0.45, col: theme.backdropColor, freq: 5 },
    { r: reach + TERRAIN_MARGIN + 2100, h: theme.backdropHeight * 1.25, col: theme.backdropFar, freq: 3.2 },
  ];
  for (const ring of rings) {
    const SEG = 120;
    let prev = null;
    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a);
      const nA = fbm2(Math.cos(a) * ring.freq + seed, Math.sin(a) * ring.freq + seed * 0.7, 4);
      const nB = valueNoise2(k * 0.9 + seed, ring.r * 0.01);
      let peak = ring.h * (0.25 + 1.5 * Math.max(0, nA - 0.22) + 0.25 * nB);
      if (theme.water) {
        const toward = theme.water.side * dz;
        peak *= 1 - 0.92 * smoothstep(0.1, 0.6, toward);
      }
      const col = ring.col;
      const snow = smoothstep(theme.snowLine, theme.snowLine * 1.8, peak);
      const topCol = col.map((v) => lerp(v * 1.15, 0.85, snow));
      const row = [
        b.vertex(cx + dx * ring.r, gy - 5, cz + dz * ring.r, -dx * 0.6, 0.8, -dz * 0.6, a * 300, 0, col, MAT.TERRAIN),
        b.vertex(cx + dx * (ring.r + peak * 0.9), gy + peak * 0.55, cz + dz * (ring.r + peak * 0.9), -dx * 0.75, 0.66, -dz * 0.75, a * 300, 60, col, MAT.TERRAIN),
        b.vertex(cx + dx * (ring.r + peak * 1.5), gy + peak, cz + dz * (ring.r + peak * 1.5), -dx * 0.8, 0.6, -dz * 0.8, a * 300, 120, topCol, MAT.TERRAIN),
      ];
      if (prev) { b.quad(prev[0], row[0], row[1], prev[1]); b.quad(prev[1], row[1], row[2], prev[2]); }
      prev = row;
    }
  }
  midChunk(b, chunk);
  closeChunk(b, chunk, chunks);
  chunks[chunks.length - 1].radius = 1e7;
}

/**
 * Build all static geometry for a circuit.
 * @returns {object} { builder, chunks, trackChunkCount, grid, field, aux }
 */
export function buildTrackGeometry(track, theme) {
  const b = new MeshBuilder(1 << 17);
  const chunks = [];
  const n = track.n, ds = track.ds;
  // per-sample helpers
  const rubber = new Float32Array(n), gravelL = new Float32Array(n), gravelR = new Float32Array(n);
  const ahead = Math.round(45 / ds);
  for (let i = 0; i < n; i++) {
    let peak = 0;
    for (let k = -ahead; k <= ahead; k += 3) peak = Math.max(peak, Math.abs(track.lineKappa[mod(i + k, n)]));
    rubber[i] = 0.42 + 0.5 * smoothstep(1 / 500, 1 / 90, peak);
    let gl = 0, gr = 0;
    for (let k = -4; k <= 4; k++) { gl += track.vergeL[mod(i + k, n)] === VERGE.GRAVEL ? 1 / 9 : 0; gr += track.vergeR[mod(i + k, n)] === VERGE.GRAVEL ? 1 / 9 : 0; }
    gravelL[i] = gl; gravelR[i] = gr;
  }
  const pit = track.pit;
  const pitWallZone = (i) => {
    let rel = i * ds; if (rel > track.length / 2) rel -= track.length;
    return rel > pit.wallStartS + 22 && rel < pit.wallEndS - 22;
  };
  const aux = { rubber, gravelL, gravelR, pitWallZone };
  for (let k0 = 0; k0 < n; k0 += CHUNK_SAMPLES) {
    const k1 = Math.min(n, k0 + CHUNK_SAMPLES);
    const chunk = openChunk(b);
    buildGround(b, track, theme, k0, k1, aux);
    midChunk(b, chunk);
    buildBarriers(b, track, theme, k0, k1, aux);
    closeChunk(b, chunk, chunks);
    chunk.sampleFrom = k0; chunk.sampleTo = k1;
  }
  const trackChunkCount = chunks.length;
  const special = openChunk(b);
  buildStartArea(b, track, true);
  buildPitComplex(b, track, theme, true);
  midChunk(b, special);
  buildStartArea(b, track, false);
  buildPitComplex(b, track, theme, false);
  closeChunk(b, special, chunks);
  const grid = buildDistanceGrid(track);
  const field = makeHeightField(track, theme, grid);
  buildTerrain(b, track, theme, grid, field, chunks);
  buildBackdrop(b, track, theme, grid, field, chunks);
  return { builder: b, chunks, trackChunkCount, grid, field, aux, rng: new Random(hashString(track.id) ^ 0x5eed) };
}
