// Growable triangle mesh with the engine vertex format and a handful of procedural primitives.
// Vertex layout (32 bytes): position f32x3, normal+ao snorm16x4, uv f32x2, colour+material unorm8x4.

export const VERTEX_STRIDE = 32;

export class MeshBuilder {
  constructor(capacity = 8192) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.nrm = new Float32Array(capacity * 4);
    this.uv = new Float32Array(capacity * 2);
    this.col = new Uint8Array(capacity * 4);
    this.indices = new Uint32Array(capacity * 3);
    this.vertexCount = 0;
    this.indexCount = 0;
    this.matrix = null;
  }

  growVertices(extra) {
    if (this.vertexCount + extra <= this.capacity) return;
    let c = this.capacity;
    while (c < this.vertexCount + extra) c *= 2;
    const grow = (old, size) => { const a = new old.constructor(size); a.set(old); return a; };
    this.pos = grow(this.pos, c * 3); this.nrm = grow(this.nrm, c * 4);
    this.uv = grow(this.uv, c * 2); this.col = grow(this.col, c * 4);
    this.capacity = c;
  }

  growIndices(extra) {
    if (this.indexCount + extra <= this.indices.length) return;
    let c = this.indices.length;
    while (c < this.indexCount + extra) c *= 2;
    const a = new Uint32Array(c); a.set(this.indices); this.indices = a;
  }

  /** Set (or clear with null) the transform applied to subsequently added vertices. */
  setMatrix(m) { this.matrix = m; }

  /** Add a vertex. color is [r,g,b] in 0..1, mat a material id, ao in 0..1. */
  vertex(x, y, z, nx, ny, nz, u, v, color, mat, ao = 1) {
    this.growVertices(1);
    const m = this.matrix;
    if (m) {
      const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
      const tz = m[2] * x + m[6] * y + m[10] * z + m[14];
      const tnx = m[0] * nx + m[4] * ny + m[8] * nz;
      const tny = m[1] * nx + m[5] * ny + m[9] * nz;
      const tnz = m[2] * nx + m[6] * ny + m[10] * nz;
      x = tx; y = ty; z = tz; nx = tnx; ny = tny; nz = tnz;
    }
    const i = this.vertexCount++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.nrm[i * 4] = nx; this.nrm[i * 4 + 1] = ny; this.nrm[i * 4 + 2] = nz; this.nrm[i * 4 + 3] = ao * 2 - 1;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    this.col[i * 4] = Math.max(0, Math.min(255, Math.round(color[0] * 255)));
    this.col[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(color[1] * 255)));
    this.col[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(color[2] * 255)));
    this.col[i * 4 + 3] = mat;
    return i;
  }

  tri(a, b, c) {
    this.growIndices(3);
    this.indices[this.indexCount++] = a; this.indices[this.indexCount++] = b; this.indices[this.indexCount++] = c;
  }

  /** Triangle whose winding is chosen so that it faces along (nx, ny, nz). */
  triFacing(a, b, c, nx, ny, nz) {
    const p = this.pos;
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (gx * nx + gy * ny + gz * nz >= 0) this.tri(a, b, c); else this.tri(a, c, b);
  }

  /** Quad from four vertex indices in ring order, facing the stored normal of vertex a. */
  quad(a, b, c, d) {
    const n = this.nrm;
    const nx = n[a * 4] + n[c * 4], ny = n[a * 4 + 1] + n[c * 4 + 1], nz = n[a * 4 + 2] + n[c * 4 + 2];
    this.triFacing(a, b, c, nx, ny, nz);
    this.triFacing(a, c, d, nx, ny, nz);
  }

  /** Flat quad from four points (arrays), with a given normal. uv = [u0, v0, u1, v1]. */
  quadPoints(p0, p1, p2, p3, normal, uv, color, mat, ao = 1) {
    const [nx, ny, nz] = normal;
    const a = this.vertex(p0[0], p0[1], p0[2], nx, ny, nz, uv[0], uv[1], color, mat, ao);
    const b = this.vertex(p1[0], p1[1], p1[2], nx, ny, nz, uv[2], uv[1], color, mat, ao);
    const c = this.vertex(p2[0], p2[1], p2[2], nx, ny, nz, uv[2], uv[3], color, mat, ao);
    const d = this.vertex(p3[0], p3[1], p3[2], nx, ny, nz, uv[0], uv[3], color, mat, ao);
    this.quad(a, b, c, d);
  }

  /**
   * Axis aligned box (in the current transform). faces: bitmask of sides to emit
   * (1 +x, 2 -x, 4 +y, 8 -y, 16 +z, 32 -z), default all. UVs are in metres.
   * opts.aoBottom darkens the lower vertices.
   */
  box(cx, cy, cz, hx, hy, hz, color, mat, opts = {}) {
    const faces = opts.faces ?? 63;
    const aoB = opts.aoBottom ?? 1, aoT = opts.aoTop ?? 1;
    const topColor = opts.topColor || color, topMat = opts.topMat ?? mat;
    const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
    const uvs = opts.uvScale ?? 1;
    const side = (p0, p1, p2, p3, n, w, h) => {
      const a = this.vertex(p0[0], p0[1], p0[2], n[0], n[1], n[2], 0, 0, color, mat, aoB);
      const b = this.vertex(p1[0], p1[1], p1[2], n[0], n[1], n[2], w * uvs, 0, color, mat, aoB);
      const c = this.vertex(p2[0], p2[1], p2[2], n[0], n[1], n[2], w * uvs, h * uvs, color, mat, aoT);
      const d = this.vertex(p3[0], p3[1], p3[2], n[0], n[1], n[2], 0, h * uvs, color, mat, aoT);
      this.quad(a, b, c, d);
    };
    if (faces & 1) side([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], hz * 2, hy * 2);
    if (faces & 2) side([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], hz * 2, hy * 2);
    if (faces & 16) side([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], hx * 2, hy * 2);
    if (faces & 32) side([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], hx * 2, hy * 2);
    if (faces & 4) this.quadPoints([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [0, 0, hx * 2 * uvs, hz * 2 * uvs], topColor, topMat, aoT);
    if (faces & 8) this.quadPoints([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [0, 0, hx * 2 * uvs, hz * 2 * uvs], color, mat, aoB);
  }

  /** Box beam between two points with a square cross-section. */
  beam(p0, p1, thickness, color, mat, thicknessY = thickness) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const ax = dx / len, ay = dy / len, az = dz / len;
    // pick a side vector not parallel to the axis
    let sx = 0, sy = 1, sz = 0;
    if (Math.abs(ay) > 0.9) { sx = 1; sy = 0; }
    let ux = ay * sz - az * sy, uy = az * sx - ax * sz, uz = ax * sy - ay * sx;
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
    const hu = thickness / 2, hv = thicknessY / 2;
    const corner = (p, su, sv) => [p[0] + ux * hu * su + vx * hv * sv, p[1] + uy * hu * su + vy * hv * sv, p[2] + uz * hu * su + vz * hv * sv];
    const sides = [[1, 1, 1, -1, ux, uy, uz], [-1, -1, -1, 1, -ux, -uy, -uz], [1, 1, -1, 1, vx, vy, vz], [-1, -1, 1, -1, -vx, -vy, -vz]];
    const quads = [
      [corner(p0, 1, -1), corner(p0, 1, 1), corner(p1, 1, 1), corner(p1, 1, -1), [ux, uy, uz]],
      [corner(p0, -1, 1), corner(p0, -1, -1), corner(p1, -1, -1), corner(p1, -1, 1), [-ux, -uy, -uz]],
      [corner(p0, 1, 1), corner(p0, -1, 1), corner(p1, -1, 1), corner(p1, 1, 1), [vx, vy, vz]],
      [corner(p0, -1, -1), corner(p0, 1, -1), corner(p1, 1, -1), corner(p1, -1, -1), [-vx, -vy, -vz]],
    ];
    void sides;
    for (const q of quads) this.quadPoints(q[0], q[1], q[2], q[3], q[4], [0, 0, 1, len], color, mat);
  }

  /**
   * Surface of revolution around an axis through `centre`. profile: [[radius, along], ...];
   * axis: 'x' | 'y' | 'z'. Normals are smooth; uv.x = angle fraction, uv.y from profile index
   * (or profile[i][2] when given).
   */
  lathe(centre, profile, segments, axis, color, mat, opts = {}) {
    const rings = profile.length;
    const start = this.vertexCount;
    const place = (r, a, ang) => {
      const c = Math.cos(ang) * r, s = Math.sin(ang) * r;
      if (axis === 'x') return [centre[0] + a, centre[1] + c, centre[2] + s];
      if (axis === 'y') return [centre[0] + c, centre[1] + a, centre[2] + s];
      return [centre[0] + c, centre[1] + s, centre[2] + a];
    };
    for (let i = 0; i < rings; i++) {
      const [r, a, vTex] = profile[i];
      // profile tangent for the normal
      const prev = profile[Math.max(0, i - 1)], next = profile[Math.min(rings - 1, i + 1)];
      let tr = next[0] - prev[0], ta = next[1] - prev[1];
      const tl = Math.hypot(tr, ta) || 1; tr /= tl; ta /= tl;
      const flip = opts.inward ? -1 : 1;
      for (let k = 0; k <= segments; k++) {
        const ang = (k / segments) * Math.PI * 2;
        const p = place(r, a, ang);
        const nr = ta * flip, na = -tr * flip;      // normal in (radial, along) space
        const o = place(nr, na, ang);
        const nx = o[0] - centre[0], ny = o[1] - centre[1], nz = o[2] - centre[2];
        const c = typeof color === 'function' ? color(i, k) : color;
        this.vertex(p[0], p[1], p[2], nx, ny, nz, k / segments, vTex ?? i / (rings - 1), c, mat, opts.ao ?? 1);
      }
    }
    for (let i = 0; i < rings - 1; i++) {
      for (let k = 0; k < segments; k++) {
        const a = start + i * (segments + 1) + k, b = a + 1, c = a + segments + 2, d = a + segments + 1;
        this.quad(a, b, c, d);
      }
    }
  }

  /** Ellipsoid centred at c with radii r. opts.yMin / yMax clip the latitude range (-1..1). */
  ellipsoid(c, r, segments, rings, color, mat, opts = {}) {
    const start = this.vertexCount;
    const lo = Math.asin(opts.yMin ?? -1), hi = Math.asin(opts.yMax ?? 1);
    for (let i = 0; i <= rings; i++) {
      const lat = lo + ((hi - lo) * i) / rings;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let k = 0; k <= segments; k++) {
        const lon = (k / segments) * Math.PI * 2;
        const nx = Math.cos(lon) * cl, ny = sl, nz = Math.sin(lon) * cl;
        const col = typeof color === 'function' ? color(nx, ny, nz) : color;
        const ao = opts.aoFn ? opts.aoFn(nx, ny, nz) : 1;
        this.vertex(c[0] + nx * r[0], c[1] + ny * r[1], c[2] + nz * r[2], nx / r[0], ny / r[1], nz / r[2], k / segments, i / rings, col, mat, ao);
      }
    }
    this.normalizeNormals(start, this.vertexCount);
    for (let i = 0; i < rings; i++) {
      for (let k = 0; k < segments; k++) {
        const a = start + i * (segments + 1) + k;
        this.quad(a, a + 1, a + segments + 2, a + segments + 1);
      }
    }
  }

  /**
   * Loft through cross-sections. Each ring is an array of [x, y, z] with the same point count,
   * treated as closed when opts.closed !== false. Normals are smoothed over the loft.
   * colorFn(ringIndex, pointIndex, point) may return a colour per vertex.
   */
  loft(ringsPoints, color, mat, opts = {}) {
    const closed = opts.closed !== false;
    const m = ringsPoints[0].length;
    const start = this.vertexCount, indexStart = this.indexCount;
    const centres = ringsPoints.map((ring) => {
      const c = [0, 0, 0];
      for (const p of ring) { c[0] += p[0] / m; c[1] += p[1] / m; c[2] += p[2] / m; }
      return c;
    });
    for (let i = 0; i < ringsPoints.length; i++) {
      for (let k = 0; k < m; k++) {
        const p = ringsPoints[i][k];
        const c = typeof color === 'function' ? color(i, k, p) : color;
        const u = opts.uvFn ? opts.uvFn(i, k, p) : [k / m, i / (ringsPoints.length - 1)];
        this.vertex(p[0], p[1], p[2], 0, 0, 0, u[0], u[1], c, opts.matFn ? opts.matFn(i, k, p) : mat, opts.aoFn ? opts.aoFn(i, k, p) : 1);
      }
    }
    const last = closed ? m : m - 1;
    for (let i = 0; i < ringsPoints.length - 1; i++) {
      const cx = (centres[i][0] + centres[i + 1][0]) / 2, cy = (centres[i][1] + centres[i + 1][1]) / 2, cz = (centres[i][2] + centres[i + 1][2]) / 2;
      for (let k = 0; k < last; k++) {
        const a = start + i * m + k, b = start + i * m + ((k + 1) % m);
        const c = start + (i + 1) * m + ((k + 1) % m), d = start + (i + 1) * m + k;
        const p = this.pos;
        const qx = (p[a * 3] + p[b * 3] + p[c * 3] + p[d * 3]) / 4 - cx;
        const qy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1] + p[d * 3 + 1]) / 4 - cy;
        const qz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2] + p[d * 3 + 2]) / 4 - cz;
        const s = opts.inward ? -1 : 1;
        this.triFacing(a, b, c, qx * s, qy * s, qz * s);
        this.triFacing(a, c, d, qx * s, qy * s, qz * s);
      }
    }
    this.smoothNormals(start, this.vertexCount, indexStart, this.indexCount);
    if (opts.capStart) this.capRing(ringsPoints[0], centres[0], [centres[0][0] - centres[1][0], centres[0][1] - centres[1][1], centres[0][2] - centres[1][2]], opts.capColor || (typeof color === 'function' ? color(0, 0, ringsPoints[0][0]) : color), opts.capMat ?? mat);
    const e = ringsPoints.length - 1;
    if (opts.capEnd) this.capRing(ringsPoints[e], centres[e], [centres[e][0] - centres[e - 1][0], centres[e][1] - centres[e - 1][1], centres[e][2] - centres[e - 1][2]], opts.capEndColor || opts.capColor || (typeof color === 'function' ? color(e, 0, ringsPoints[e][0]) : color), opts.capEndMat ?? opts.capMat ?? mat);
  }

  capRing(ring, centre, normal, color, mat) {
    const l = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    const nx = normal[0] / l, ny = normal[1] / l, nz = normal[2] / l;
    const c = this.vertex(centre[0], centre[1], centre[2], nx, ny, nz, 0.5, 0.5, color, mat);
    const first = this.vertexCount;
    for (const p of ring) this.vertex(p[0], p[1], p[2], nx, ny, nz, 0.5, 0.5, color, mat);
    for (let k = 0; k < ring.length; k++) this.triFacing(c, first + k, first + ((k + 1) % ring.length), nx, ny, nz);
  }

  normalizeNormals(from, to) {
    const n = this.nrm;
    for (let i = from; i < to; i++) {
      const l = Math.hypot(n[i * 4], n[i * 4 + 1], n[i * 4 + 2]) || 1;
      n[i * 4] /= l; n[i * 4 + 1] /= l; n[i * 4 + 2] /= l;
    }
  }

  /** Recompute smooth normals for a vertex range from the triangles in an index range. */
  smoothNormals(vFrom, vTo, iFrom, iTo) {
    const n = this.nrm, p = this.pos, idx = this.indices;
    for (let i = vFrom; i < vTo; i++) { n[i * 4] = 0; n[i * 4 + 1] = 0; n[i * 4 + 2] = 0; }
    for (let t = iFrom; t < iTo; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
      const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      for (const v of [a, b, c]) { n[v * 4] += gx; n[v * 4 + 1] += gy; n[v * 4 + 2] += gz; }
    }
    this.normalizeNormals(vFrom, vTo);
  }

  /** Bounding sphere (centre + radius) of the vertices in [from, to). */
  bounds(from, to) {
    const p = this.pos;
    let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
    for (let i = from; i < to; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    return { cx, cy, cz, radius: Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 };
  }

  /** Interleave into GPU-ready buffers. */
  finish() {
    const count = this.vertexCount;
    const buffer = new ArrayBuffer(count * VERTEX_STRIDE);
    const f32 = new Float32Array(buffer), i16 = new Int16Array(buffer), u8 = new Uint8Array(buffer);
    const pack = (v) => Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
    for (let i = 0; i < count; i++) {
      const o = i * 8;
      f32[o] = this.pos[i * 3]; f32[o + 1] = this.pos[i * 3 + 1]; f32[o + 2] = this.pos[i * 3 + 2];
      i16[i * 16 + 6] = pack(this.nrm[i * 4]); i16[i * 16 + 7] = pack(this.nrm[i * 4 + 1]);
      i16[i * 16 + 8] = pack(this.nrm[i * 4 + 2]); i16[i * 16 + 9] = pack(this.nrm[i * 4 + 3]);
      f32[o + 5] = this.uv[i * 2]; f32[o + 6] = this.uv[i * 2 + 1];
      u8[i * 32 + 28] = this.col[i * 4]; u8[i * 32 + 29] = this.col[i * 4 + 1];
      u8[i * 32 + 30] = this.col[i * 4 + 2]; u8[i * 32 + 31] = this.col[i * 4 + 3];
    }
    return { vertexData: buffer, indexData: this.indices.slice(0, this.indexCount), vertexCount: count, indexCount: this.indexCount };
  }
}
