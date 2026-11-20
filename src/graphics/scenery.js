// Instanced trackside scenery: procedural prop meshes and their placement along a circuit.

import { MAT, ATLAS } from './materials.js';
import { clamp, lerp, mod, smoothstep } from '../core/math.js';
import { PROP_INSTANCE_FLOATS } from './renderer.js';

const WHITE = [0.62, 0.62, 0.6];

// ------------------------------------------------------------------ prop meshes
function conifer(b, theme, lod) {
  const col = theme.pineColor, dark = col.map((v) => v * 0.5), tip = col.map((v) => v * 1.35);
  const tiers = lod ? 3 : 7, seg = lod ? 6 : 11;
  if (!lod) b.lathe([0, 0, 0], [[0.24, 0], [0.17, 2.4], [0.1, 6]], 6, 'y', [0.2, 0.13, 0.08], MAT.BARK);
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers;
    const y0 = lerp(1.5, 10.6, f), h = lerp(3.4, 2.0, f) * (lod ? 2.2 : 1);
    const r = lerp(2.9, 0.8, f);
    const start = b.vertexCount;
    b.lathe([0, 0, 0], [[r, y0, 0], [r * 0.62, y0 + h * 0.3, 0.4], [r * 0.18, y0 + h * 0.8, 0.8], [0.02, y0 + h, 1]], seg, 'y', (i) => (i === 0 ? dark : i === 3 ? tip : col), MAT.FOLIAGE, { ao: 0.8 });
    // droop and stagger the skirt of each tier so the outline is ragged
    for (let v = start; v < start + seg + 1; v++) {
      const k = (v - start) % seg;
      const wob = 0.72 + 0.4 * (((k * 7 + t * 3) % 5) / 4);
      b.pos[v * 3] *= wob; b.pos[v * 3 + 2] *= wob; b.pos[v * 3 + 1] -= 0.25 + 0.3 * ((k + t) % 2);
    }
  }
}

function broadleaf(b, theme, lod, rng) {
  const c1 = theme.foliage, c2 = theme.foliage2;
  const bark = [0.2, 0.15, 0.1];
  if (!lod) {
    b.lathe([0, 0, 0], [[0.34, 0], [0.24, 1.2], [0.2, 3.4], [0.12, 5.2]], 7, 'y', bark, MAT.BARK);
    b.beam([0, 3.0, 0], [1.5, 5.2, 0.5], 0.17, bark, MAT.BARK);
    b.beam([0, 3.3, 0], [-1.3, 5.4, -0.8], 0.15, bark, MAT.BARK);
    b.beam([0, 3.6, 0], [0.2, 5.6, 1.5], 0.13, bark, MAT.BARK);
  }
  const blobs = lod
    ? [[0, 6.4, 0, 3.5, 3.1], [1.2, 5.6, 0.6, 2.0, 1.7]]
    : [[0, 6.9, 0, 2.6, 2.3], [1.8, 5.8, 0.6, 2.0, 1.7], [-1.6, 6.0, -1.0, 2.1, 1.8], [0.4, 5.6, -1.9, 1.8, 1.6], [-0.5, 5.8, 1.9, 1.9, 1.6],
      [0.3, 8.3, 0.2, 1.9, 1.5], [1.4, 7.4, -1.1, 1.5, 1.3], [-1.3, 7.6, 0.9, 1.6, 1.3], [-2.4, 5.3, 0.4, 1.3, 1.1], [2.5, 5.0, -0.6, 1.2, 1.0]];
  for (const [x, y, z, r, h] of blobs) {
    const start = b.vertexCount, i0 = b.indexCount;
    const sx = 1 + rng.range(-0.15, 0.15), sz = 1 + rng.range(-0.15, 0.15);
    b.ellipsoid([x, y, z], [r * sx, h, r * sz], lod ? 7 : 11, lod ? 4 : 7, (nx, ny) => [0, 1, 2].map((k) => lerp(c1[k] * 0.55, c2[k], clamp(ny * 0.65 + 0.45, 0, 1))), MAT.FOLIAGE, { aoFn: (nx, ny) => clamp(0.5 + ny * 0.55, 0.3, 1) });
    // lumpy surface
    const ph = rng.range(0, 6.28);
    for (let v = start; v < b.vertexCount; v++) {
      const px = b.pos[v * 3] - x, py = b.pos[v * 3 + 1] - y, pz = b.pos[v * 3 + 2] - z;
      const n = 1 + 0.16 * Math.sin(px * 2.9 + ph) * Math.cos(pz * 2.6 - ph) + 0.1 * Math.sin(py * 4.1 + px * 1.7 + ph);
      b.pos[v * 3] = x + px * n; b.pos[v * 3 + 1] = y + py * n; b.pos[v * 3 + 2] = z + pz * n;
    }
    b.smoothNormals(start, b.vertexCount, i0, b.indexCount);
  }
}

function cypress(b, theme, lod) {
  const col = theme.pineColor.map((v, i) => v * 1.3 + [0.01, 0.03, 0.0][i]);
  if (!lod) b.lathe([0, 0, 0], [[0.18, 0], [0.14, 1.2]], 5, 'y', [0.2, 0.14, 0.09], MAT.BARK);
  b.lathe([0, 0, 0], [[0.5, 0.8, 0], [1.05, 2.6, 0.3], [0.9, 6.5, 0.7], [0.05, 10.5, 1]], lod ? 5 : 8, 'y', (i) => col.map((v) => v * (0.6 + i * 0.16)), MAT.FOLIAGE, { ao: 0.85 });
}

function palm(b, theme, lod) {
  const trunk = [0.3, 0.24, 0.16];
  const pts = [[0, 0, 0], [0.25, 2.4, 0], [0.7, 4.8, 0.1], [1.4, 7.2, 0.2]];
  for (let i = 0; i < pts.length - 1; i++) b.beam(pts[i], pts[i + 1], lerp(0.36, 0.22, i / 3), trunk, MAT.BARK);
  const top = pts[3];
  const fronds = lod ? 5 : 9;
  const col = [theme.foliage[0] * 1.1, theme.foliage[1] * 1.15, theme.foliage[2]];
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz, pz = dx;
    const segs = [[0, 0, 0.1], [1.3, 0.55, 0.42], [2.5, 0.35, 0.5], [3.6, -0.5, 0.3]];
    let prev = null;
    for (const [r, h, w] of segs) {
      const cx = top[0] + dx * r, cy = top[1] + h, cz = top[2] + dz * r;
      const row = [[cx - px * w, cy - 0.08, cz - pz * w], [cx, cy + 0.05, cz], [cx + px * w, cy - 0.08, cz + pz * w]];
      if (prev) {
        for (let k = 0; k < 2; k++) {
          for (const flip of [1, -1]) {
            b.quadPoints(prev[k], prev[k + 1], row[k + 1], row[k], [0, flip, 0], [0, 0, 1, 1], col.map((v) => v * (flip > 0 ? 1 : 0.6)), MAT.FOLIAGE, flip > 0 ? 1 : 0.6);
          }
        }
      }
      prev = row;
    }
  }
}

function bush(b, theme, lod, rng) {
  const c = theme.foliage2.map((v) => v * 0.9);
  const count = lod ? 1 : 3;
  for (let i = 0; i < count; i++) {
    b.ellipsoid([rng.range(-0.6, 0.6) * (count > 1 ? 1 : 0), 0.55, rng.range(-0.6, 0.6) * (count > 1 ? 1 : 0)], [1.1, 0.85, 1.0], lod ? 5 : 7, lod ? 3 : 4, (nx, ny) => c.map((v) => v * (0.6 + 0.4 * clamp(ny + 0.5, 0, 1))), MAT.FOLIAGE, { yMin: -0.5, aoFn: (nx, ny) => clamp(0.5 + ny * 0.6, 0.35, 1) });
  }
}

function rock(b, theme, lod, rng) {
  const c = theme.rockColor;
  const start = b.vertexCount, i0 = b.indexCount;
  b.ellipsoid([0, 0.5, 0], [1.6, 1.1, 1.3], lod ? 5 : 8, lod ? 3 : 5, c, MAT.ROCK, { yMin: -0.45 });
  // displace for an irregular silhouette, then rebuild normals
  for (let v = start; v < b.vertexCount; v++) {
    const px = b.pos[v * 3], py = b.pos[v * 3 + 1], pz = b.pos[v * 3 + 2];
    const n = Math.sin(px * 2.3 + pz * 1.7) * 0.18 + Math.sin(py * 3.1 + px * 1.3) * 0.14;
    b.pos[v * 3] = px * (1 + n); b.pos[v * 3 + 1] = py * (1 + n * 0.6); b.pos[v * 3 + 2] = pz * (1 - n);
  }
  b.smoothNormals(start, b.vertexCount, i0, b.indexCount);
  void rng;
}

function grandstand(b, theme) {
  const W = 12, rows = 11, depth = 10.5, base = 1.6, rise = 5.6;
  // seating: one inclined plane, crowd material (uv.x in metres, uv.y in rows)
  const ny = depth / Math.hypot(depth, rise), nz = -rise / Math.hypot(depth, rise);
  b.quadPoints([-W, base, 0], [W, base, 0], [W, base + rise, depth], [-W, base + rise, depth], [0, ny, nz], [0, 0, W * 2, rows], [0.3, 0.32, 0.38], MAT.CROWD);
  const conc = theme.wall;
  b.box(0, base / 2, -0.15, W, base / 2, 0.15, conc, MAT.CONCRETE);
  b.box(0, (base + rise) / 2, depth + 0.2, W, (base + rise) / 2 + 0.8, 0.2, conc, MAT.CONCRETE);
  for (const sx of [-1, 1]) {
    // wedge following the seating slope
    const x = sx * (W + 0.02);
    const v0 = b.vertex(x, 0, -0.3, sx, 0, 0, 0, 0, conc, MAT.CONCRETE, 0.7);
    const v1 = b.vertex(x, 0, depth + 0.4, sx, 0, 0, depth, 0, conc, MAT.CONCRETE, 0.7);
    const v2 = b.vertex(x, base + rise + 0.9, depth + 0.4, sx, 0, 0, depth, base + rise, conc, MAT.CONCRETE);
    const v3 = b.vertex(x, base + 0.9, -0.3, sx, 0, 0, 0, base, conc, MAT.CONCRETE);
    b.quad(v0, v1, v2, v3);
    const w0 = b.vertex(x - sx * 0.3, 0, -0.3, -sx, 0, 0, 0, 0, conc, MAT.CONCRETE, 0.6);
    const w1 = b.vertex(x - sx * 0.3, 0, depth + 0.4, -sx, 0, 0, depth, 0, conc, MAT.CONCRETE, 0.6);
    const w2 = b.vertex(x - sx * 0.3, base + rise + 0.9, depth + 0.4, -sx, 0, 0, depth, base + rise, conc, MAT.CONCRETE);
    const w3 = b.vertex(x - sx * 0.3, base + 0.9, -0.3, -sx, 0, 0, 0, base, conc, MAT.CONCRETE);
    b.quad(w0, w1, w2, w3);
    for (const z of [1.5, depth - 0.5]) b.beam([sx * (W - 0.4), 0, z], [sx * (W - 0.4), base + rise + 4.2, z], 0.28, [0.25, 0.26, 0.28], MAT.PAINT);
  }
  b.beam([0, 0, depth - 0.5], [0, base + rise + 4.2, depth - 0.5], 0.28, [0.25, 0.26, 0.28], MAT.PAINT);
  // cantilever roof
  b.box(0, base + rise + 4.3, depth / 2 - 0.8, W + 0.6, 0.14, depth / 2 + 1.4, [0.72, 0.72, 0.7], MAT.ROOF);
  b.box(0, base + rise + 4.05, depth / 2 - 0.8, W + 0.5, 0.1, 0.12, [0.25, 0.26, 0.28], MAT.PAINT);
  // advertising strip on the front wall
  const bb = ATLAS.billboard(0);
  b.quadPoints([-W, 0.25, -0.31], [0, 0.25, -0.31], [0, base - 0.15, -0.31], [-W, base - 0.15, -0.31], [0, 0, -1], [bb.u + bb.w, bb.v + bb.h, bb.u, bb.v], WHITE, MAT.ATLAS);
  b.quadPoints([0, 0.25, -0.31], [W, 0.25, -0.31], [W, base - 0.15, -0.31], [0, base - 0.15, -0.31], [0, 0, -1], [bb.u + bb.w, bb.v + bb.h, bb.u, bb.v], WHITE, MAT.ATLAS);
}

function billboard(b) {
  const w = 5, y0 = 1.3, y1 = 3.8;
  const bb = ATLAS.billboard(0);
  for (const sx of [-1, 1]) b.beam([sx * (w - 0.6), 0, 0.12], [sx * (w - 0.6), y1, 0.12], 0.16, [0.25, 0.25, 0.27], MAT.PAINT);
  b.quadPoints([-w, y0, 0], [w, y0, 0], [w, y1, 0], [-w, y1, 0], [0, 0, -1], [bb.u + bb.w, bb.v + bb.h, bb.u, bb.v], WHITE, MAT.ATLAS);
  b.quadPoints([w, y0, 0.06], [-w, y0, 0.06], [-w, y1, 0.06], [w, y1, 0.06], [0, 0, 1], [0, 0, 1, 1], [0.3, 0.3, 0.32], MAT.PAINT);
}

function distanceBoard(b, index) {
  const r = ATLAS.board(index);
  b.beam([0, 0, 0.05], [0, 1.0, 0.05], 0.08, [0.3, 0.3, 0.3], MAT.PAINT);
  b.quadPoints([-0.75, 0.95, 0], [0.75, 0.95, 0], [0.75, 1.7, 0], [-0.75, 1.7, 0], [0, 0, -1], [r.u + r.w, r.v + r.h, r.u, r.v], WHITE, MAT.ATLAS);
  b.quadPoints([0.75, 0.95, 0.04], [-0.75, 0.95, 0.04], [-0.75, 1.7, 0.04], [0.75, 1.7, 0.04], [0, 0, 1], [0, 0, 1, 1], [0.4, 0.4, 0.4], MAT.PAINT);
}

function marshalPost(b) {
  b.box(0, 1.25, 0, 1.3, 1.25, 1.1, [0.85, 0.4, 0.05], MAT.PAINT);
  b.box(0, 1.55, -1.11, 0.9, 0.45, 0.01, [0.03, 0.04, 0.05], MAT.COCKPIT, { faces: 32 });
  b.box(0, 2.6, 0, 1.6, 0.08, 1.4, [0.9, 0.9, 0.88], MAT.ROOF);
}

function lightPole(b) {
  b.lathe([0, 0, 0], [[0.16, 0], [0.09, 13]], 6, 'y', [0.35, 0.36, 0.38], MAT.FENCE);
  b.box(0, 13.2, -0.5, 1.2, 0.35, 0.3, [0.2, 0.2, 0.22], MAT.PAINT);
  b.box(0, 13.2, -0.81, 1.05, 0.26, 0.01, [0.9, 0.9, 0.8], MAT.PAINT, { faces: 32 });
}

function flagPole(b, index) {
  const f = ATLAS.flag(index);
  b.lathe([0, 0, 0], [[0.06, 0], [0.04, 8]], 5, 'y', [0.7, 0.7, 0.72], MAT.FENCE);
  for (const s of [1, -1]) b.quadPoints([0.05, 6.2, 0.01 * s], [2.0, 6.3, 0.2 * s + 0.1], [2.0, 7.7, 0.2 * s + 0.1], [0.05, 7.8, 0.01 * s], [0, 0, s], [f.u, f.v + f.h, f.u + f.w, f.v], WHITE, MAT.ATLAS);
}

function building(b, theme, w, h, d) {
  b.box(0, h / 2, 0, w / 2, h / 2, d / 2, [1, 1, 1], MAT.FACADE, { topMat: MAT.ROOF, topColor: [0.3, 0.3, 0.32], faces: 63 - 8 });
  b.box(0, h + 0.4, 0, w / 2 - 1, 0.4, d / 2 - 1, [0.6, 0.6, 0.6], MAT.CONCRETE, { faces: 63 - 8 });
}

function chalet(b) {
  b.box(0, 1.6, 0, 4, 1.6, 3, [1, 1, 1], MAT.PAINT, { faces: 63 - 8 });
  const roof = [0.32, 0.12, 0.08];
  b.quadPoints([-4.5, 3.0, -3.6], [4.5, 3.0, -3.6], [4.5, 5.4, 0], [-4.5, 5.4, 0], [0, 0.83, -0.55], [0, 0, 1, 1], roof, MAT.ROOF);
  b.quadPoints([4.5, 3.0, 3.6], [-4.5, 3.0, 3.6], [-4.5, 5.4, 0], [4.5, 5.4, 0], [0, 0.83, 0.55], [0, 0, 1, 1], roof, MAT.ROOF);
  for (const sx of [-1, 1]) {
    const a = b.vertex(sx * 4, 3.2, -3, sx, 0, 0, 0, 0, [1, 1, 1], MAT.PAINT);
    const c = b.vertex(sx * 4, 3.2, 3, sx, 0, 0, 1, 0, [1, 1, 1], MAT.PAINT);
    const d = b.vertex(sx * 4, 5.3, 0, sx, 0, 0, 0.5, 1, [1, 1, 1], MAT.PAINT);
    b.triFacing(a, c, d, sx, 0, 0);
  }
}

function tent(b) {
  b.box(0, 1.4, 0, 3.5, 1.4, 3.5, [0.9, 0.9, 0.88], MAT.PAINT, { faces: 63 - 8 - 4 });
  b.lathe([0, 0, 0], [[5.2, 2.7, 0], [0.05, 5.0, 1]], 4, 'y', [0.92, 0.92, 0.9], MAT.ROOF);
}

function container(b) {
  b.box(0, 1.3, 0, 6.1, 1.3, 1.22, [1, 1, 1], MAT.PAINT, { faces: 63 - 8 });
}

function hangar(b) {
  const rings = [];
  for (const z of [-14, 14]) {
    const ring = [];
    for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI; ring.push([Math.cos(a) * 11, Math.sin(a) * 7.5, z]); }
    rings.push(ring);
  }
  b.loft(rings, [1, 1, 1], MAT.ROOF, { closed: false });
  for (const z of [-14, 14]) b.capRing(rings[z < 0 ? 0 : 1], [0, 2.5, z], [0, 0, z], [1, 1, 1], MAT.PAINT);
}

/** Catalogue of prop meshes available for a theme. Each entry: build(b, theme, lod, rng). */
const PROPS = {
  pine: { build: conifer, lod: true, shadow: true, distance: 1 },
  broadleaf: { build: broadleaf, lod: true, shadow: true, distance: 1 },
  cypress: { build: cypress, lod: true, shadow: true, distance: 1 },
  palm: { build: palm, lod: true, shadow: true, distance: 0.9 },
  bush: { build: bush, lod: true, shadow: false, distance: 0.45 },
  rock: { build: rock, lod: true, shadow: true, distance: 0.6 },
  grandstand: { build: grandstand, shadow: true, distance: 2 },
  billboard: { build: billboard, shadow: true, distance: 1.1 },
  board300: { build: (b) => distanceBoard(b, 0), shadow: false, distance: 0.5 },
  board200: { build: (b) => distanceBoard(b, 1), shadow: false, distance: 0.5 },
  board100: { build: (b) => distanceBoard(b, 2), shadow: false, distance: 0.5 },
  marshal: { build: marshalPost, shadow: true, distance: 0.7 },
  lightPole: { build: lightPole, shadow: true, distance: 1 },
  flagA: { build: (b) => flagPole(b, 0), shadow: false, distance: 0.7 },
  flagB: { build: (b) => flagPole(b, 1), shadow: false, distance: 0.7 },
  buildingLow: { build: (b, t) => building(b, t, 22, 12, 16), shadow: true, distance: 2.5 },
  buildingMid: { build: (b, t) => building(b, t, 18, 30, 18), shadow: true, distance: 2.5 },
  buildingTall: { build: (b, t) => building(b, t, 20, 62, 20), shadow: true, distance: 2.5 },
  chalet: { build: chalet, shadow: true, distance: 1.5 },
  tent: { build: tent, shadow: true, distance: 1.2 },
  container: { build: container, shadow: true, distance: 1.2 },
  hangar: { build: hangar, shadow: true, distance: 2 },
};

/**
 * Build prop meshes into the world builder and place instances.
 * @returns {object} { propMeshes, propInstances, propBatches, tvCameras }
 */
export function buildScenery(geometry, track, theme) {
  const { builder: b, chunks, trackChunkCount, grid, field, rng } = geometry;
  const n = track.n, ds = track.ds, hw = track.halfWidth;
  const meshIndex = {}, propMeshes = [];
  const ensureMesh = (name) => {
    if (meshIndex[name] !== undefined) return meshIndex[name];
    const def = PROPS[name];
    const v0 = b.vertexCount;
    const first = b.indexCount;
    def.build(b, theme, false, rng);
    const count = b.indexCount - first;
    let lodFirst = 0, lodCount = 0;
    if (def.lod) { lodFirst = b.indexCount; def.build(b, theme, true, rng); lodCount = b.indexCount - lodFirst; }
    const bounds = b.bounds(v0, b.vertexCount);
    propMeshes.push({ name, first, count, lodFirst, lodCount, castShadow: def.shadow, distanceScale: def.distance, radius: bounds.radius + Math.hypot(bounds.cx, bounds.cz), height: bounds.cy + bounds.radius });
    meshIndex[name] = propMeshes.length - 1;
    return meshIndex[name];
  };
  const placed = [];   // { chunk, mesh, data[16] }
  const exclusions = []; // circles [x, z, r]
  const chunkSamples = chunks[0].sampleTo - chunks[0].sampleFrom;
  const chunkOfSample = (i) => Math.min(trackChunkCount - 1, Math.floor(mod(i, n) / chunkSamples));
  const add = (name, chunk, x, y, z, yaw, scale, tint = [1, 1, 1], design = 0) => {
    const mesh = ensureMesh(name);
    const c = Math.cos(yaw) * scale, s = Math.sin(yaw) * scale;
    // model = T * RotY(yaw) * S ; rows of the 3x4 matrix
    placed.push({ chunk, mesh, data: [c, 0, s, x, 0, scale, 0, y, -s, 0, c, z, tint[0], tint[1], tint[2], design] });
    const ch = chunks[chunk], m = propMeshes[mesh];
    const d = Math.hypot(x - ch.cx, y - ch.cy, z - ch.cz) + (m.radius + m.height) * scale;
    if (d > ch.radius) ch.radius = d;
  };
  const point = (i, d) => [track.x[i] + track.nx[i] * d, track.z[i] + track.nz[i] * d];
  // yaw that makes a prop's -Z axis face the track from the given side
  const facing = (i, side) => {
    // props face along local -Z; we want -Z to point toward the track: direction = -side * normal
    const dx = -side * track.nx[i], dz = -side * track.nz[i];
    return Math.atan2(dx, -dz) * -1;
  };
  const free = (x, z, r) => {
    for (const e of exclusions) if (Math.hypot(x - e[0], z - e[1]) < e[2] + r) return false;
    return true;
  };
  const clearOfTrack = (x, z, wanted) => grid.distanceAt(x, z) > wanted;
  const pit = track.pit;
  const relS = (i) => { let r = i * ds; if (r > track.length / 2) r -= track.length; return r; };

  // ---- grandstands: main straight (opposite the pits) and the outside of the slowest corners
  const standSpots = [];
  for (let s = -150; s <= 60; s += 26) standSpots.push({ i: mod(Math.round(s / ds), n), side: -pit.side });
  const cornerPeaks = [];
  for (let i = 0; i < n; i++) {
    const k = Math.abs(track.kappa[i]);
    if (k > 1 / 110 && k >= Math.abs(track.kappa[mod(i - 1, n)]) && k > Math.abs(track.kappa[mod(i + 1, n)])) cornerPeaks.push({ i, k, sign: Math.sign(track.kappa[i]) });
  }
  cornerPeaks.sort((a, c) => c.k - a.k);
  const chosen = [];
  for (const p of cornerPeaks) {
    if (chosen.length >= 3) break;
    if (Math.abs(relS(p.i)) < 380) continue;
    if (chosen.some((q) => Math.min(mod(p.i - q.i, n), mod(q.i - p.i, n)) * ds < 400)) continue;
    chosen.push(p);
    for (const off of [-10, 0, 10]) standSpots.push({ i: mod(p.i + off, n), side: -p.sign });
  }
  for (const spot of standSpots) {
    const barrier = spot.side > 0 ? track.barrierR[spot.i] : track.barrierL[spot.i];
    const d = spot.side * (barrier + 3.5);
    const [x, z] = point(spot.i, d);
    const [cx, cz] = point(spot.i, spot.side * (barrier + 10));
    if (!clearOfTrack(cx, cz, barrier + 7) || !free(cx, cz, 13)) continue;
    add('grandstand', chunkOfSample(spot.i), x, track.y[spot.i] - 0.2, z, facing(spot.i, spot.side), 1, theme.wall);
    exclusions.push([cx, cz, 15]);
    if (rng.chance(0.5)) {
      const [fx, fz] = point(mod(spot.i + 6, n), spot.side * (barrier + 2.2));
      add(rng.chance(0.5) ? 'flagA' : 'flagB', chunkOfSample(spot.i), fx, track.y[spot.i], fz, rng.range(0, 6.28), 1);
    }
  }
  // pit building footprint
  for (let s = pit.wallStartS; s <= pit.wallEndS; s += 12) {
    const i = mod(Math.round(s / ds), n);
    const [x, z] = point(i, pit.side * (pit.outerD + 7));
    exclusions.push([x, z, 14]);
  }

  // ---- distance boards before heavy braking zones
  for (const p of cornerPeaks) {
    if (p.k < 1 / 75) continue;
    // find the turn-in point (where curvature starts to build) walking backwards
    let entry = p.i;
    for (let k = 0; k < 80 && Math.abs(track.kappa[mod(entry, n)]) > 1 / 400; k++) entry--;
    // only when preceded by a straight
    let straight = 0;
    for (let k = 1; k < 140 && Math.abs(track.kappa[mod(entry - k, n)]) < 1 / 500; k++) straight = k * ds;
    if (straight < 220) continue;
    ['board100', 'board200', 'board300'].forEach((name, bi) => {
      const i = mod(entry - Math.round(((bi + 1) * 100) / ds), n);
      const side = -p.sign;
      const barrier = side > 0 ? track.barrierR[i] : track.barrierL[i];
      const [x, z] = point(i, side * Math.min(barrier - 1.2, hw + 3));
      // face the oncoming cars
      add(name, chunkOfSample(i), x, track.y[i], z, -track.heading[i] - Math.PI / 2 + Math.PI, 1);
    });
  }

  // ---- billboards, marshal posts and light poles along the track
  let nextBillboard = rng.range(40, 120), nextMarshal = 150, nextPole = 30;
  for (let i = 0; i < n; i++) {
    const s = i * ds;
    const rel = relS(i);
    if (s > nextBillboard) {
      nextBillboard = s + rng.range(110, 230);
      const side = Math.abs(track.kappa[i]) > 1 / 300 ? -Math.sign(track.kappa[i]) : (rng.chance(0.5) ? 1 : -1);
      const barrier = side > 0 ? track.barrierR[i] : track.barrierL[i];
      const [x, z] = point(i, side * (barrier + 2.6));
      if (clearOfTrack(x, z, barrier + 1.5) && free(x, z, 6) && !(side === pit.side && rel > pit.entryS - 20 && rel < pit.exitS + 20)) {
        add('billboard', chunkOfSample(i), x, track.y[i] - 0.3, z, facing(i, side), 1, [1, 1, 1], rng.int(0, 7));
        exclusions.push([x, z, 5]);
      }
    }
    if (s > nextMarshal) {
      nextMarshal = s + rng.range(260, 380);
      const side = rng.chance(0.5) ? 1 : -1;
      const barrier = side > 0 ? track.barrierR[i] : track.barrierL[i];
      const [x, z] = point(i, side * (barrier + 2.4));
      if (clearOfTrack(x, z, barrier + 1.5) && free(x, z, 3)) { add('marshal', chunkOfSample(i), x, track.y[i] - 0.2, z, facing(i, side), 1); exclusions.push([x, z, 3]); }
    }
    if (s > nextPole && rel > -330 && rel < 200) {
      nextPole = s + 55;
      const side = -pit.side;
      const barrier = side > 0 ? track.barrierR[i] : track.barrierL[i];
      const [x, z] = point(i, side * (barrier + 1.6));
      add('lightPole', chunkOfSample(i), x, track.y[i], z, facing(i, side), 1);
    }
  }

  // ---- theme buildings
  const cx = (grid.bbox.minX + grid.bbox.maxX) / 2, cz = (grid.bbox.minZ + grid.bbox.maxZ) / 2;
  const nearestTrackChunk = (x, z) => {
    const gx = clamp(Math.round((x - grid.x0) / 14), 0, grid.nx - 1), gz = clamp(Math.round((z - grid.z0) / 14), 0, grid.nz - 1);
    const sample = grid.sample[gz * grid.nx + gx];
    return sample >= 0 ? chunkOfSample(sample) : -1;
  };
  const terrainChunkAt = (x, z) => {
    let best = -1, bestD = 1e18;
    for (let c = trackChunkCount + 1; c < chunks.length - 1; c++) {
      const d = (chunks[c].cx - x) ** 2 + (chunks[c].cz - z) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  };
  const chunkFor = (x, z) => { const c = nearestTrackChunk(x, z); return c >= 0 ? c : terrainChunkAt(x, z); };
  const scatterBuilding = (names, count, minDist, maxDist, tintFn, spacing) => {
    let attempts = 0, done = 0;
    while (done < count && attempts++ < count * 30) {
      const x = rng.range(grid.bbox.minX - 250, grid.bbox.maxX + 250), z = rng.range(grid.bbox.minZ - 250, grid.bbox.maxZ + 250);
      const d = grid.distanceAt(x, z);
      if (d < minDist || d > maxDist || !free(x, z, spacing)) continue;
      if (theme.water && field.height(x, z) < field.waterY + 1) continue;
      const name = names[rng.int(0, names.length - 1)];
      add(name, chunkFor(x, z), x, field.height(x, z) - 0.4, z, rng.int(0, 3) * Math.PI / 2 + rng.range(-0.1, 0.1), 1, tintFn());
      exclusions.push([x, z, spacing]);
      done++;
    }
  };
  const bc = theme.buildingColor;
  const vary = (k) => () => bc.map((v) => v * rng.range(1 - k, 1 + k));
  if (theme.buildings === 'city') { scatterBuilding(['buildingLow', 'buildingMid', 'buildingMid', 'buildingTall'], 46, 70, 420, vary(0.18), 20); }
  else if (theme.buildings === 'docks') {
    scatterBuilding(['buildingLow', 'hangar'], 22, 60, 380, vary(0.15), 24);
    const palette = [[0.6, 0.12, 0.08], [0.1, 0.25, 0.5], [0.7, 0.45, 0.08], [0.15, 0.4, 0.2], [0.5, 0.5, 0.52]];
    scatterBuilding(['container'], 90, 34, 300, () => palette[rng.int(0, palette.length - 1)], 5);
  }
  else if (theme.buildings === 'chalets') scatterBuilding(['chalet'], 16, 60, 320, () => [0.45 * rng.range(0.8, 1.2), 0.3, 0.18], 14);
  else if (theme.buildings === 'villas') scatterBuilding(['buildingLow', 'chalet'], 18, 70, 380, vary(0.12), 20);
  else if (theme.buildings === 'tents') scatterBuilding(['tent'], 14, 40, 200, () => [1, 1, 1], 9);
  else if (theme.buildings === 'hangars') { scatterBuilding(['hangar'], 7, 70, 320, vary(0.1), 30); scatterBuilding(['buildingLow'], 5, 80, 300, vary(0.1), 24); }

  // ---- vegetation: bands along the track, then sparse fill over the terrain
  const treeNames = theme.trees.map((t) => t[0]);
  const treeWeights = theme.trees.map((t) => t[1]);
  const pickTree = () => {
    let r = rng.next() * treeWeights.reduce((a, c) => a + c, 0);
    for (let k = 0; k < treeNames.length; k++) { r -= treeWeights[k]; if (r <= 0) return treeNames[k]; }
    return treeNames[0];
  };
  const tintTree = () => { const v = rng.range(0.78, 1.18); return [v * rng.range(0.92, 1.08), v, v * rng.range(0.9, 1.1)]; };
  const plantAt = (x, z, chunk, name) => {
    const y = field.height(x, z);
    if (theme.water && y < field.waterY + 0.8) return;
    if (!free(x, z, 2.2)) return;
    const big = name !== 'bush' && name !== 'rock';
    add(name, chunk, x, y - 0.25, z, rng.range(0, 6.28), big ? rng.range(0.75, 1.4) : rng.range(0.7, 1.6), name === 'rock' ? [1, 1, 1] : tintTree());
  };
  const step = Math.max(2, Math.round(7 / ds));
  for (let i = 0; i < n; i += step) {
    for (const side of [-1, 1]) {
      const barrier = side > 0 ? track.barrierR[i] : track.barrierL[i];
      const rel = relS(i);
      if (side === pit.side && rel > pit.entryS - 10 && rel < pit.exitS + 10) continue;
      const count = theme.treeDensity * 2.4;
      const whole = Math.floor(count) + (rng.chance(count - Math.floor(count)) ? 1 : 0);
      for (let t = 0; t < whole; t++) {
        const depth = 6 + Math.pow(rng.next(), 1.6) * 95;
        const d = side * (barrier + depth);
        const [x, z] = point(mod(i + rng.int(0, step - 1), n), d);
        if (!clearOfTrack(x, z, barrier + depth - 3)) continue;
        plantAt(x, z, chunkOfSample(i), pickTree());
      }
      if (rng.chance(theme.rocks * 0.5)) {
        const depth = 5 + rng.next() * 40;
        const [x, z] = point(i, side * (barrier + depth));
        if (clearOfTrack(x, z, barrier + depth - 3)) plantAt(x, z, chunkOfSample(i), 'rock');
      }
      if (rng.chance(0.25 * Math.min(1, theme.treeDensity + 0.3))) {
        const depth = 3.5 + rng.next() * 14;
        const [x, z] = point(i, side * (barrier + depth));
        if (clearOfTrack(x, z, barrier + depth - 2)) plantAt(x, z, chunkOfSample(i), 'bush');
      }
    }
  }
  const area = (grid.bbox.maxX - grid.bbox.minX + 900) * (grid.bbox.maxZ - grid.bbox.minZ + 900);
  const fieldCount = Math.round((area / 1e6) * 1500 * theme.fieldDensity);
  for (let t = 0; t < fieldCount; t++) {
    const x = rng.range(grid.bbox.minX - 450, grid.bbox.maxX + 450), z = rng.range(grid.bbox.minZ - 450, grid.bbox.maxZ + 450);
    const d = grid.distanceAt(x, z);
    if (d < 95) continue;
    // clumping: keep points where a low frequency mask is high
    const mask = Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 - 0.4) + Math.sin((x + z) * 0.006);
    if (mask < -0.25) continue;
    plantAt(x, z, chunkFor(x, z), rng.chance(theme.rocks * 0.3) ? 'rock' : pickTree());
  }
  void cx; void cz; void smoothstep;

  // ---- pack: sort by chunk then mesh so each (chunk, mesh) pair is one contiguous batch
  placed.sort((a, c) => a.chunk - c.chunk || a.mesh - c.mesh);
  const propInstances = new Float32Array(placed.length * PROP_INSTANCE_FLOATS);
  const propBatches = [];
  let current = null;
  placed.forEach((p, index) => {
    propInstances.set(p.data, index * PROP_INSTANCE_FLOATS);
    if (!current || current.chunk !== p.chunk || current.mesh !== p.mesh) {
      current = { chunk: p.chunk, mesh: p.mesh, first: index, count: 0 };
      propBatches.push(current);
    }
    current.count++;
  });

  // ---- trackside TV camera positions (outside of the track, raised)
  const tvCameras = [];
  for (let s = 60; s < track.length; s += 260) {
    const i = mod(Math.round(s / ds), n);
    const side = Math.abs(track.kappa[i]) > 1 / 400 ? -Math.sign(track.kappa[i]) : (tvCameras.length % 2 ? 1 : -1);
    const barrier = side > 0 ? track.barrierR[i] : track.barrierL[i];
    const [x, z] = point(i, side * (barrier + 3.5));
    tvCameras.push({ x, y: track.y[i] + 4.5, z, s: i * ds });
  }
  return { propMeshes, propInstances, propBatches, tvCameras };
}
