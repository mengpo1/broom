// 2D road projection ("simulated perspective"). Pure math, no GPU and no DOM, so it runs in
// tests. There is no 3D camera: the road is described as a list of nodes ahead of the viewer
// (distance along the track, accumulated lateral bend, elevation) which are projected with a
// single perspective division. From those nodes the module fills one record per screen row
// (the "row table") that the road shader and the sprite clipping read.
//
// View frame: `z` is the distance ahead of the eye measured along the track, lateral values are
// positive to the right of the viewer. `dir` is +1 when looking along the track direction and
// -1 when looking backwards (rear cameras, wrong-way driving): lateral track offsets are then
// mirrored (view lateral = dir * d).

import { mod } from '../../core/math.js';

export const ROW_FLOATS = 8;      // z, centreX, scale, s, dz/dy, nodeParam, 0, 0
export const MAX_NODES = 640;

export function createProjection(maxRows = 2160) {
  return {
    width: 1, height: 1, focal: 1, cx: 0, cy: 0, dir: 1,
    camS: 0, camD: 0, camY: 0, yawTan: 0, near: 0.45, drawDistance: 1300, curveGain: 1,
    track: null, ds: 1, length: 1, baseIndex: 0, frac: 0, firstGap: 0,
    nodeCount: 0,
    nodeZ: new Float32Array(MAX_NODES), nodeX: new Float32Array(MAX_NODES),
    nodeTheta: new Float32Array(MAX_NODES), nodeKappa: new Float32Array(MAX_NODES),
    nodeY: new Float32Array(MAX_NODES), nodeScreenY: new Float32Array(MAX_NODES),
    nodeSample: new Int32Array(MAX_NODES), segSample: new Int32Array(MAX_NODES),
    maxRows, rows: new Float32Array(maxRows * ROW_FLOATS), topRow: 0, farZ: 0,
  };
}

/**
 * Rebuild nodes and row table for one view.
 * @param p     projection state (createProjection)
 * @param track track data (tracks/track-builder.js)
 * @param cam   { s, d, eyeHeight, yaw, dir, width, height, focal, cx, cy, drawDistance }
 *              yaw is the view direction relative to the road tangent (rad, + right), already
 *              expressed for the chosen dir.
 */
export function updateProjection(p, track, cam) {
  const n = track.n, ds = track.ds, length = track.length;
  p.track = track; p.ds = ds; p.length = length;
  p.width = cam.width; p.height = Math.min(cam.height, p.maxRows);
  p.focal = cam.focal; p.cx = cam.cx; p.cy = cam.cy;
  const dir = cam.dir < 0 ? -1 : 1;
  p.dir = dir;
  p.camS = mod(cam.s, length);
  p.camD = cam.d * dir;
  let yawTan = Math.tan(Math.max(-1.2, Math.min(1.2, cam.yaw)));
  if (yawTan > 1.6) yawTan = 1.6; else if (yawTan < -1.6) yawTan = -1.6;
  p.yawTan = yawTan;
  if (cam.drawDistance) p.drawDistance = cam.drawDistance;

  const f0 = p.camS / ds;
  const i0 = Math.floor(f0) % n;
  const frac = f0 - Math.floor(f0);
  p.baseIndex = i0; p.frac = frac;
  const firstGap = dir > 0 ? (1 - frac) * ds : frac * ds;
  p.firstGap = firstGap;
  const y0 = track.y[i0] + (track.y[(i0 + 1) % n] - track.y[i0]) * frac;
  p.camY = y0 + cam.eyeHeight;

  const { nodeZ, nodeX, nodeTheta, nodeKappa, nodeY, nodeScreenY, nodeSample, segSample } = p;
  const gain = p.curveGain * dir;
  const maxNodes = Math.min(MAX_NODES, n - 2);
  nodeZ[0] = 0; nodeX[0] = 0; nodeTheta[0] = 0; nodeY[0] = y0; nodeSample[0] = i0;
  nodeScreenY[0] = 1e9;
  let count = 1;
  let x = 0, theta = 0, zPrev = 0;
  for (let k = 0; k < maxNodes - 1; k++) {
    const seg = dir > 0 ? (i0 + k) % n : mod(i0 - k, n);
    const kappa = track.kappa[seg] * gain;
    segSample[k] = seg; nodeKappa[k] = kappa;
    const z = firstGap + k * ds;
    const dz = z - zPrev;
    x += theta * dz + 0.5 * kappa * dz * dz;
    theta += kappa * dz;
    if (theta > 3) theta = 3; else if (theta < -3) theta = -3;
    const sample = dir > 0 ? (i0 + k + 1) % n : mod(i0 - k, n);
    const kn = k + 1;
    nodeZ[kn] = z; nodeX[kn] = x; nodeTheta[kn] = theta; nodeSample[kn] = sample;
    nodeY[kn] = track.y[sample];
    nodeScreenY[kn] = z > 1e-3 ? p.cy + (p.focal * (p.camY - nodeY[kn])) / z : 1e9;
    count = kn + 1;
    zPrev = z;
    if (z > p.drawDistance) break;
  }
  segSample[count - 1] = segSample[count - 2]; nodeKappa[count - 1] = 0;
  p.nodeCount = count;
  p.farZ = nodeZ[count - 1];
  fillRows(p);
}

function fillRows(p) {
  const { rows, nodeZ, nodeX, nodeTheta, nodeKappa, nodeY, nodeScreenY } = p;
  const height = p.height, f = p.focal, cy = p.cy, cx = p.cx, near = p.near;
  const camY = p.camY, camD = p.camD, yawTan = p.yawTan, dir = p.dir, camS = p.camS, length = p.length;
  for (let r = 0, o = 0; r < height; r++, o += ROW_FLOATS) rows[o] = 0;
  let filled = height;
  const last = p.nodeCount - 1;
  for (let k = 0; k < last; k++) {
    const zA = nodeZ[k], zB = nodeZ[k + 1];
    if (zB <= near || zB - zA < 1e-5) continue;
    const g = (nodeY[k + 1] - nodeY[k]) / (zB - zA);
    const a = camY - nodeY[k] + g * zA;          // eye height above the segment's plane at z = 0
    if (a <= 1e-4) continue;                      // plane seen edge-on or from below
    const zStart = zA < near ? near : zA;
    const sA = zA < near ? cy + (f * a) / zStart - f * g : nodeScreenY[k];
    const sB = nodeScreenY[k + 1];
    if (sB >= sA) continue;                       // facing away (behind a crest)
    let rTop = Math.ceil(sB - 0.5);
    let rBot = Math.ceil(sA - 0.5) - 1;
    if (rBot >= filled) rBot = filled - 1;
    if (rTop < 0) rTop = 0;
    if (rTop > rBot) continue;
    const fa = f * a, fg = f * g;
    for (let r = rBot; r >= rTop; r--) {
      let z = fa / (r + 0.5 - cy + fg);
      if (z < zStart) z = zStart; else if (z > zB) z = zB;
      const t = z - zA;
      const lateral = nodeX[k] + nodeTheta[k] * t + 0.5 * nodeKappa[k] * t * t - camD - z * yawTan;
      const scale = f / z;
      const o = r * ROW_FLOATS;
      let s = camS + dir * z;
      if (s >= length) s -= length; else if (s < 0) s += length;
      rows[o] = z; rows[o + 1] = cx + lateral * scale; rows[o + 2] = scale; rows[o + 3] = s;
      rows[o + 4] = (z * z) / fa; rows[o + 5] = k + t / (zB - zA); rows[o + 6] = 0; rows[o + 7] = 0;
    }
    filled = rTop;
    if (filled <= 0) break;
  }
  p.topRow = filled;
}

/** Signed distance ahead of the eye (view frame) for a track distance s, in (-L/2, L/2]. */
export function depthOf(p, s) {
  let z = (s - p.camS) * p.dir;
  const half = p.length / 2;
  if (z > half) z -= p.length; else if (z <= -half) z += p.length;
  return z;
}

/** Index of the node segment containing depth z (z must be within [0, farZ]). */
export function segmentAt(p, z) {
  if (z <= p.firstGap) return 0;
  let k = 1 + Math.floor((z - p.firstGap) / p.ds);
  if (k > p.nodeCount - 2) k = p.nodeCount - 2;
  return k;
}

/**
 * Project a point given in view-relative depth z, track lateral offset d and height h above the
 * road surface. Writes x, y (pixels in the view), scale (pixels per metre) and z into `out`.
 * Returns false when the point is outside the projected range.
 */
export function projectAtDepth(p, z, d, h, out) {
  if (z < 0.05 || z > p.farZ) return false;
  const k = segmentAt(p, z);
  const zA = p.nodeZ[k], zB = p.nodeZ[k + 1];
  const t = z - zA;
  const span = zB - zA;
  const ground = span > 1e-5 ? p.nodeY[k] + ((p.nodeY[k + 1] - p.nodeY[k]) * t) / span : p.nodeY[k];
  const lateral = p.nodeX[k] + p.nodeTheta[k] * t + 0.5 * p.nodeKappa[k] * t * t + p.dir * d - p.camD - z * p.yawTan;
  const scale = p.focal / z;
  out.x = p.cx + lateral * scale;
  out.y = p.cy + (p.camY - ground - h) * scale;
  out.scale = scale; out.z = z;
  out.theta = p.nodeTheta[k] + p.nodeKappa[k] * t;
  return true;
}

/** Project a point given in track coordinates (s, d, h). */
export function projectPoint(p, s, d, h, out) {
  return projectAtDepth(p, depthOf(p, s), d, h, out);
}

/** Project node k displaced laterally by track offset d and raised by h. Always valid for k >= 1. */
export function projectNode(p, k, d, h, out) {
  const z = p.nodeZ[k];
  const scale = p.focal / z;
  out.x = p.cx + (p.nodeX[k] + p.dir * d - p.camD - z * p.yawTan) * scale;
  out.y = p.cy + (p.camY - p.nodeY[k] - h) * scale;
  out.scale = scale; out.z = z;
  return out;
}

/** Depth of the nearest ground drawn on a screen row (0 when the row shows no ground). */
export function rowDepth(p, row) {
  if (row < 0 || row >= p.height) return 0;
  return p.rows[row * ROW_FLOATS];
}

/** Focal length in pixels for a horizontal field of view (radians) and a view width. */
export function focalForFov(width, hfov) {
  return (width * 0.5) / Math.tan(hfov * 0.5);
}
