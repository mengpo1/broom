// Construction drawing of the single-seater: an early-1990s style open-wheel car described as
// volumes (lofted bodywork, plates, revolved tyres, rods), the way a comic artist blocks a car
// in perspective before inking it. This is drawing data only: the simulation never reads it and
// the illustrator (car-illustrator.js) turns it into inked 2D artwork at load time.
//
// Car frame: x forward, y to the driver's left, z up, origin on the ground under the middle of
// the car. Units are metres. All dimensions are design choices for a generic period car.

/** Surface roles; the illustrator maps them to livery zones or fixed materials. */
export const ROLE = {
  BODY: 'body', SIDE: 'side', WING: 'wing', HELMET: 'helmet',
  TYRE: 'tyre', RIM: 'rim', CARBON: 'carbon', METAL: 'metal', BLACK: 'black', VISOR: 'visor',
  GLASS: 'glass', WHITE: 'white', RED: 'red', SUIT: 'suit', GLOVE: 'glove', DASH: 'dash',
};

export const CAR_DIMENSIONS = {
  frontAxleX: 1.55, rearAxleX: -1.35, frontTrack: 0.9, rearTrack: 0.82,
  frontTyre: { radius: 0.325, width: 0.29 }, rearTyre: { radius: 0.33, width: 0.42 },
  eye: [-0.35, 0, 0.95],       // driver's eye, used by the cockpit drawing
};

/** Left mirror of the car: centre of the housing, its size, and where its arm meets the cockpit side (the cockpit view is drawn from these). */
export const MIRROR_MOUNT = { x: 0.4, y: 0.42, z: 0.675, width: 0.14, height: 0.075, arm: [0.4, 0.3, 0.6] };

function sgnPow(v, e) { return v < 0 ? -Math.pow(-v, e) : Math.pow(v, e); }

class PartBuilder {
  constructor(name, options = {}) {
    this.name = name;
    this.ink = options.ink ?? 1;           // contour weight multiplier (0 = no contour)
    this.bias = options.bias ?? 0;         // depth bias in metres (positive = drawn earlier)
    this.gloss = !!options.gloss;          // curved paintwork: gets a drawn highlight band
    this.outward = options.outward || null; // side the part faces: seen from there it overlaps its neighbours
    this.pos = []; this.nor = [];          // flat arrays, 3 per vertex
    this.faces = [];                       // { idx: [...], role }
    this.rods = [];                        // { a: [x,y,z], b: [x,y,z], radius, role }
    this.lines = [];                       // { pts: [[x,y,z]...], normal: [x,y,z], weight }
  }
  vertex(x, y, z, nx, ny, nz) {
    const l = Math.hypot(nx, ny, nz) || 1;
    this.pos.push(x, y, z); this.nor.push(nx / l, ny / l, nz / l);
    return this.pos.length / 3 - 1;
  }
  face(idx, role) { this.faces.push({ idx, role }); }
}

/**
 * Lofted body: cross-sections along x. Each section: { x, y (centre), zb, zt, w, zm?, nt?, nb? }.
 * zm is the height of the widest point (defaults to 45% up); nt / nb are the superellipse
 * exponents of the upper and lower halves (2 = round, larger = boxier).
 */
function loft(part, keys, options) {
  const around = options.around ?? 24, spacing = options.spacing ?? 0.06;
  const roleAt = options.role;
  // densify the key sections with a smooth (Catmull-Rom) interpolation of every parameter
  const fields = ['x', 'y', 'zb', 'zt', 'w', 'zm', 'nt', 'nb'];
  const ks = keys.map((k) => ({ y: 0, nt: 2.4, nb: 4, ...k, zm: k.zm ?? k.zb + (k.zt - k.zb) * 0.45 }));
  const sections = [];
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[Math.max(0, i - 1)], b = ks[i], c = ks[i + 1], d = ks[Math.min(ks.length - 1, i + 2)];
    const steps = Math.max(1, Math.round(Math.abs(c.x - b.x) / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const sec = {};
      for (const f of fields) {
        sec[f] = 0.5 * (2 * b[f] + (-a[f] + c[f]) * t + (2 * a[f] - 5 * b[f] + 4 * c[f] - d[f]) * t2 + (-a[f] + 3 * b[f] - 3 * c[f] + d[f]) * t3);
      }
      sec.w = Math.max(sec.w, 0.004);
      sections.push(sec);
    }
  }
  sections.push({ ...ks[ks.length - 1] });
  const rings = sections.length;
  const point = (sec, j) => {
    const a = (j / around) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const up = sa >= 0;
    const e = 2 / (up ? sec.nt : sec.nb);
    const h = up ? sec.zt - sec.zm : sec.zm - sec.zb;
    return [sec.x, sec.y + sec.w * sgnPow(ca, e), sec.zm + h * sgnPow(sa, e)];
  };
  const grid = sections.map((sec) => { const row = []; for (let j = 0; j < around; j++) row.push(point(sec, j)); return row; });
  const index = [];
  for (let i = 0; i < rings; i++) {
    const row = [];
    for (let j = 0; j < around; j++) {
      const p = grid[i][j];
      const pu = grid[Math.min(rings - 1, i + 1)][j], pd = grid[Math.max(0, i - 1)][j];
      const pr = grid[i][(j + 1) % around], pl = grid[i][(j + around - 1) % around];
      const ux = pu[0] - pd[0], uy = pu[1] - pd[1], uz = pu[2] - pd[2];
      const vx = pr[0] - pl[0], vy = pr[1] - pl[1], vz = pr[2] - pl[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const sec = sections[i];
      if (ny * (p[1] - sec.y) + nz * (p[2] - sec.zm) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      row.push(part.vertex(p[0], p[1], p[2], nx, ny, nz));
    }
    index.push(row);
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < around; j++) {
      const j1 = (j + 1) % around;
      const a = grid[i][j], c = grid[i + 1][j1];
      const cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2, cz = (a[2] + c[2]) / 2;
      const role = roleAt(cx, cy, cz, (j + 0.5) / around, j, i, around);
      if (role) part.face([index[i][j], index[i][j1], index[i + 1][j1], index[i + 1][j]], role);
    }
  }
  const cap = (i, role, dirX) => {
    if (!role) return;
    const sec = sections[i];
    // concentric rings so that large caps are made of small faces (reliable depth ordering)
    const levels = Math.max(1, Math.round(Math.max(sec.w, (sec.zt - sec.zb) / 2) / 0.07));
    const rows = [];
    for (let r = 1; r <= levels; r++) {
      const t = r / levels, row = [];
      for (let j = 0; j < around; j++) {
        const p = grid[i][j];
        row.push(part.vertex(sec.x, sec.y + (p[1] - sec.y) * t, sec.zm + (p[2] - sec.zm) * t, dirX, 0, 0));
      }
      rows.push(row);
    }
    const c = part.vertex(sec.x, sec.y, sec.zm, dirX, 0, 0);
    for (let j = 0; j < around; j++) part.face([c, rows[0][j], rows[0][(j + 1) % around]], role);
    for (let r = 0; r < levels - 1; r++) for (let j = 0; j < around; j++) part.face([rows[r][j], rows[r + 1][j], rows[r + 1][(j + 1) % around], rows[r][(j + 1) % around]], role);
  };
  cap(0, options.capStart, sections[0].x > sections[rings - 1].x ? 1 : -1);
  cap(rings - 1, options.capEnd, sections[0].x > sections[rings - 1].x ? -1 : 1);
  // implicit description of the same volume (negative inside), used to trim parts that run into each other
  const descending = sections[0].x > sections[rings - 1].x;
  part.solid = (x, y, z) => {
    const first = sections[0].x, last = sections[rings - 1].x;
    if (descending ? (x > first || x < last) : (x < first || x > last)) return 1;
    let lo = 0, hi = rings - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if ((sections[mid].x >= x) === descending) lo = mid; else hi = mid; }
    const a = sections[lo], b = sections[hi];
    const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
    const mix = (f) => a[f] + (b[f] - a[f]) * t;
    const zm = mix('zm'), up = z >= zm;
    const h = up ? mix('zt') - zm : zm - mix('zb');
    const n = up ? mix('nt') : mix('nb');
    return Math.pow(Math.abs(y - mix('y')) / mix('w'), n) + Math.pow(Math.abs(z - zm) / Math.max(h, 1e-4), n) - 1;
  };
  return part;
}

/**
 * Trim a part where it runs into another volume: faces inside `solid` (an implicit function,
 * negative inside) are removed and the faces crossing its surface are cut along it, so that two
 * interpenetrating volumes meet on one clean line instead of fighting for the same pixels.
 * The cut edges are flagged so that the illustrator inks them as a light junction line.
 */
function trimPart(part, solid) {
  const count = part.pos.length / 3;
  const f = new Float64Array(count);
  for (let i = 0; i < count; i++) f[i] = solid(part.pos[i * 3], part.pos[i * 3 + 1], part.pos[i * 3 + 2]);
  const cache = new Map();
  const cutVertex = (inner, outer) => {
    const key = inner * 1000003 + outer;
    let v = cache.get(key);
    if (v !== undefined) return v;
    const a = inner * 3, b = outer * 3;
    let lo = 0, hi = 1;
    for (let k = 0; k < 16; k++) {
      const t = (lo + hi) / 2;
      if (solid(part.pos[a] + (part.pos[b] - part.pos[a]) * t, part.pos[a + 1] + (part.pos[b + 1] - part.pos[a + 1]) * t, part.pos[a + 2] + (part.pos[b + 2] - part.pos[a + 2]) * t) <= 0) lo = t; else hi = t;
    }
    const t = hi, m = 1 - t;
    v = part.vertex(
      part.pos[a] * m + part.pos[b] * t, part.pos[a + 1] * m + part.pos[b + 1] * t, part.pos[a + 2] * m + part.pos[b + 2] * t,
      part.nor[a] * m + part.nor[b] * t, part.nor[a + 1] * m + part.nor[b + 1] * t, part.nor[a + 2] * m + part.nor[b + 2] * t,
    );
    cache.set(key, v);
    return v;
  };
  const kept = [];
  for (const face of part.faces) {
    const idx = face.idx, n = idx.length;
    let inside = 0;
    for (let k = 0; k < n; k++) if (f[idx[k]] <= 0) inside++;
    if (inside === 0) { kept.push(face); continue; }
    if (inside === n) continue;
    const out = [], cut = [];
    for (let k = 0; k < n; k++) {
      const p = idx[k], q = idx[(k + 1) % n];
      const pin = f[p] <= 0, qin = f[q] <= 0;
      if (!pin) { out.push(p); cut.push(face.cut ? face.cut[k] : false); }
      if (pin !== qin) {
        // leaving the kept side: the next edge runs along the cut; entering it: back on an original edge
        if (qin) { out.push(cutVertex(q, p)); cut.push(true); }
        else { out.push(cutVertex(p, q)); cut.push(face.cut ? face.cut[k] : false); }
      }
    }
    if (out.length >= 3) kept.push({ idx: out, role: face.role, cut });
  }
  part.faces = kept;
}

/** Flat quad subdivided into cells no larger than `cell`, one shared normal. corners: a,b,c,d in order. */
function panel(part, a, b, c, d, normal, role, cell = 0.14) {
  const nu = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / cell));
  const nv = Math.max(1, Math.ceil(Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / cell));
  const idx = [];
  for (let v = 0; v <= nv; v++) {
    const row = [];
    for (let u = 0; u <= nu; u++) {
      const fu = u / nu, fv = v / nv;
      const x = (a[0] * (1 - fu) + b[0] * fu) * (1 - fv) + (d[0] * (1 - fu) + c[0] * fu) * fv;
      const y = (a[1] * (1 - fu) + b[1] * fu) * (1 - fv) + (d[1] * (1 - fu) + c[1] * fu) * fv;
      const z = (a[2] * (1 - fu) + b[2] * fu) * (1 - fv) + (d[2] * (1 - fu) + c[2] * fu) * fv;
      row.push(part.vertex(x, y, z, normal[0], normal[1], normal[2]));
    }
    idx.push(row);
  }
  for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) part.face([idx[v][u], idx[v][u + 1], idx[v + 1][u + 1], idx[v + 1][u]], role);
}

/**
 * Box given by 8 corners derived from centre/size and an optional pitch (rotation about the
 * lateral axis, positive raises the rear edge). roles: one role or { top, bottom, front, rear, left, right }.
 */
function box(part, cx, cy, cz, sx, sy, sz, roles, pitch = 0, cell = 0.14) {
  const r = typeof roles === 'string' ? { top: roles, bottom: roles, front: roles, rear: roles, left: roles, right: roles } : roles;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const P = (dx, dy, dz) => [cx + dx * cp + dz * sp, cy + dy, cz - dx * sp + dz * cp];
  const N = (dx, dy, dz) => [dx * cp + dz * sp, dy, -dx * sp + dz * cp];
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  if (r.top) panel(part, P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), N(0, 0, 1), r.top, cell);
  if (r.bottom) panel(part, P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), N(0, 0, -1), r.bottom, cell);
  if (r.front) panel(part, P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(hx, -hy, hz), N(1, 0, 0), r.front, cell);
  if (r.rear) panel(part, P(-hx, -hy, -hz), P(-hx, hy, -hz), P(-hx, hy, hz), P(-hx, -hy, hz), N(-1, 0, 0), r.rear, cell);
  if (r.left) panel(part, P(-hx, hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(-hx, hy, hz), N(0, 1, 0), r.left, cell);
  if (r.right) panel(part, P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), N(0, -1, 0), r.right, cell);
}

/** Plate: convex polygon in the xz plane [[x,z]...] extruded between y0 and y1. */
function plate(part, outline, y0, y1, roleOut, roleIn, roleEdge) {
  const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
  let cxm = 0, czm = 0;
  for (const p of outline) { cxm += p[0]; czm += p[1]; }
  cxm /= outline.length; czm /= outline.length;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of outline) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
  // orientation of the outline (for inside tests)
  let area = 0;
  for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const orient = area >= 0 ? 1 : -1;
  const clipCell = (poly) => {
    for (let i = 0; i < outline.length && poly.length >= 3; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k], q = poly[(k + 1) % poly.length];
        const dp = ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * orient;
        const dq = ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) * orient;
        if (dp >= 0) out.push(p);
        if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
      poly = out;
    }
    return poly;
  };
  const cell = 0.11;
  const nxCells = Math.max(1, Math.ceil((maxX - minX) / cell)), nzCells = Math.max(1, Math.ceil((maxZ - minZ) / cell));
  const side = (y, ny, role) => {
    for (let ix = 0; ix < nxCells; ix++) for (let iz = 0; iz < nzCells; iz++) {
      const x0 = minX + ((maxX - minX) * ix) / nxCells, x1 = minX + ((maxX - minX) * (ix + 1)) / nxCells;
      const z0 = minZ + ((maxZ - minZ) * iz) / nzCells, z1 = minZ + ((maxZ - minZ) * (iz + 1)) / nzCells;
      const poly = clipCell([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
      if (poly.length < 3) continue;
      part.face(poly.map((q) => part.vertex(q[0], y, q[1], 0, ny, 0)), typeof role === 'function' ? role((x0 + x1) / 2, (z0 + z1) / 2) : role);
    }
  };
  side(hi, 1, y1 > y0 ? roleOut : roleIn);
  side(lo, -1, y1 > y0 ? roleIn : roleOut);
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n];
    let nx = b[1] - a[1], nz = -(b[0] - a[0]);
    if (nx * ((a[0] + b[0]) / 2 - cxm) + nz * ((a[1] + b[1]) / 2 - czm) < 0) { nx = -nx; nz = -nz; }
    panel(part, [a[0], lo, a[1]], [b[0], lo, b[1]], [b[0], hi, b[1]], [a[0], hi, a[1]], [nx, 0, nz], roleEdge, 0.2);
  }
}

/** Wheel: tyre as a surface of revolution about the lateral axis, rim discs on both sides. */
function wheel(name, cx, cy, cz, radius, width, outerSign, spin = false, brakePhase = 0, brakeBlur = false) {
  const tyre = new PartBuilder(`${name}.tyre`, { ink: 1 });
  const hw = width / 2, rimR = radius * 0.6, shoulder = 0.055;
  // profile from the inner bead across the tread to the outer bead: [lateral, radius]
  const profile = [[-hw + 0.012, rimR], [-hw, rimR + 0.05], [-hw, radius - shoulder]];
  for (let k = 1; k <= 4; k++) { const a = (k / 5) * Math.PI / 2; profile.push([-hw + shoulder * (1 - Math.cos(a)), radius - shoulder * (1 - Math.sin(a))]); }
  const tread = 5;
  for (let k = 0; k <= tread; k++) profile.push([-hw + shoulder + ((width - 2 * shoulder) * k) / tread, radius]);
  for (let k = 1; k <= 4; k++) { const a = (k / 5) * Math.PI / 2; profile.push([hw - shoulder * (1 - Math.sin(a)), radius - shoulder * (1 - Math.cos(a))]); }
  profile.push([hw, radius - shoulder], [hw, rimR + 0.05], [hw - 0.012, rimR]);
  const seg = 40, idx = [];
  for (let i = 0; i < profile.length; i++) {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(profile.length - 1, i + 1)];
    let nl = -(b[1] - a[1]), nr = b[0] - a[0];
    if (nr < 0 && Math.abs(nl) < 1e-6) { nl = 0; nr = 1; }
    if (i <= 2) { nl = -1; nr = 0.15; } else if (i >= profile.length - 3) { nl = 1; nr = 0.15; }
    const row = [];
    for (let s = 0; s < seg; s++) {
      const t = (s / seg) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
      row.push(tyre.vertex(cx + profile[i][1] * ct, cy + profile[i][0], cz + profile[i][1] * st, nr * ct, nl, nr * st));
    }
    idx.push(row);
  }
  for (let i = 0; i < profile.length - 1; i++) for (let s = 0; s < seg; s++) {
    const s1 = (s + 1) % seg;
    tyre.face([idx[i][s], idx[i][s1], idx[i + 1][s1], idx[i + 1][s]], ROLE.TYRE);
  }
  const rim = new PartBuilder(`${name}.rim`, { ink: 0.55 });
  for (const sign of [-1, 1]) {
    const y = cy + sign * (hw - 0.035);
    const outer = sign === outerSign;
    // outer face: wheel nut, hub and the dish of the rim; inner face: upright, brake disc and the rim edge
    const rings = outer
      ? (spin ? [[0, ROLE.METAL], [0.04, ROLE.BLACK], [0.07, ROLE.METAL], [rimR * 0.5, ROLE.RIM], [rimR * 0.82, ROLE.METAL], [rimR + 0.004, ROLE.METAL]]
        : [[0, ROLE.METAL], [0.045, ROLE.BLACK], [0.075, ROLE.RIM], [rimR * 0.8, ROLE.RIM], [rimR + 0.004, ROLE.METAL]])
      : [[0, ROLE.BLACK], [0.05, ROLE.CARBON], [0.085, ROLE.METAL], [rimR * 0.76, ROLE.BLACK], [rimR + 0.004, ROLE.RIM]];
    const ridx = [];
    for (let r = 0; r < rings.length; r++) {
      const row = [];
      for (let s = 0; s < seg; s++) {
        const t = (s / seg) * Math.PI * 2;
        row.push(rim.vertex(cx + rings[r][0] * Math.cos(t), y, cz + rings[r][0] * Math.sin(t), 0, sign, 0));
      }
      ridx.push(row);
    }
    for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < seg; s++) {
      const s1 = (s + 1) % seg;
      const spoke = !spin && r === 2 && outer && s % 8 < 2;     // five dark spoke windows on the visible face (at rest)
      rim.face([ridx[r][s], ridx[r][s1], ridx[r + 1][s1], ridx[r + 1][s]], spoke ? ROLE.CARBON : rings[r + 1][1]);
    }
    if (!outer) {
      // brake: vent slots on the disc (they turn with the wheel) and the caliper gripping its rear edge
      const slots = 8, turn = spin ? 0 : ((brakePhase || 0) / 3) * ((Math.PI * 2) / slots);
      if (spin || brakeBlur) {
        for (const [rr, from, to] of [[rimR * 0.34, 0.4, 2.2], [rimR * 0.5, 2.9, 4.9], [rimR * 0.64, 5.2, 7.0]]) {
          const pts = [];
          for (let k = 0; k <= 12; k++) { const t = from + ((to - from) * k) / 12; pts.push([cx + rr * Math.cos(t), y + sign * 0.004, cz + rr * Math.sin(t)]); }
          rim.lines.push({ pts, normal: [0, sign, 0], weight: 0.8, hex: '#59616d' });
        }
      } else {
        for (let k = 0; k < slots; k++) {
          const t = turn + (k / slots) * Math.PI * 2, r0 = rimR * 0.46, r1 = rimR * 0.7;
          rim.lines.push({ pts: [[cx + r0 * Math.cos(t), y + sign * 0.004, cz + r0 * Math.sin(t)], [cx + r1 * Math.cos(t + 0.22), y + sign * 0.004, cz + r1 * Math.sin(t + 0.22)]], normal: [0, sign, 0], weight: 0.8, hex: '#59616d' });
        }
      }
      box(rim, cx - rimR * 0.6, y + sign * 0.02, cz + rimR * 0.05, 0.055, 0.035, 0.13, ROLE.METAL, 0, 0.1);      // caliper: a small casting on the rear edge of the disc
    }
    if (outer) {
      // sidewall marking: a pale ring, as drawn on racing tyres
      const mark = [];
      for (let s = 0; s <= seg; s++) { const t = (s / seg) * Math.PI * 2; mark.push([cx + (radius - 0.085) * Math.cos(t), cy + sign * hw, cz + (radius - 0.085) * Math.sin(t)]); }
      tyre.lines.push({ pts: mark, normal: [0, sign, 0], weight: 0.9, color: 'tyreMark' });
      if (spin) {
        // a turning wheel: the spokes melt into a disc, drawn as a few concentric pen arcs
        const arcs = [[rimR * 0.42, 0.3, 2.0], [rimR * 0.62, 2.6, 4.6], [rimR * 0.8, 4.9, 6.6], [rimR * 0.5, 3.6, 4.7]];
        for (const [rr, from, to] of arcs) {
          const pts = [];
          for (let k = 0; k <= 12; k++) { const t = from + ((to - from) * k) / 12; pts.push([cx + rr * Math.cos(t), y + sign * 0.004, cz + rr * Math.sin(t)]); }
          rim.lines.push({ pts, normal: [0, sign, 0], weight: 0.8, hex: '#6b7480' });
        }
      }
    }
  }
  return [tyre, rim];
}

function sphere(part, cx, cy, cz, rx, ry, rz, roleAt, lat = 12, lon = 22) {
  const idx = [];
  for (let i = 0; i <= lat; i++) {
    const row = [];
    const a = (i / lat) * Math.PI;
    for (let j = 0; j < lon; j++) {
      const b = (j / lon) * Math.PI * 2;
      const nx = Math.sin(a) * Math.cos(b), ny = Math.sin(a) * Math.sin(b), nz = Math.cos(a);
      row.push(part.vertex(cx + rx * nx, cy + ry * ny, cz + rz * nz, nx / rx, ny / ry, nz / rz));
    }
    idx.push(row);
  }
  for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
    const j1 = (j + 1) % lon;
    const role = roleAt(i, j, lat, lon);
    if (i === 0) part.face([idx[0][j], idx[1][j1], idx[1][j]], role);
    else if (i === lat - 1) part.face([idx[i][j], idx[i][j1], idx[i + 1][j]], role);
    else part.face([idx[i][j], idx[i][j1], idx[i + 1][j1], idx[i + 1][j]], role);
  }
  part.solid = (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 - 1;
}

function mirrorPart(src, name) {
  const p = new PartBuilder(name, { ink: src.ink, bias: src.bias, gloss: src.gloss, outward: src.outward ? [src.outward[0], -src.outward[1], src.outward[2]] : null });
  for (let i = 0; i < src.pos.length; i += 3) {
    p.pos.push(src.pos[i], -src.pos[i + 1], src.pos[i + 2]);
    p.nor.push(src.nor[i], -src.nor[i + 1], src.nor[i + 2]);
  }
  for (const f of src.faces) {
    p.face(f.idx.slice().reverse(), f.role);
    if (f.cut) {
      // edge k of the reversed polygon is edge n-2-k of the source
      const n = f.idx.length, cut = new Array(n);
      for (let k = 0; k < n; k++) cut[k] = f.cut[(2 * n - 2 - k) % n];
      p.faces[p.faces.length - 1].cut = cut;
    }
  }
  if (src.solid) p.solid = (x, y, z) => src.solid(x, -y, z);
  for (const r of src.rods) p.rods.push({ ...r, a: [r.a[0], -r.a[1], r.a[2]], b: [r.b[0], -r.b[1], r.b[2]] });
  for (const l of src.lines) p.lines.push({ ...l, pts: l.pts.map((q) => [q[0], -q[1], q[2]]), normal: [l.normal[0], -l.normal[1], l.normal[2]] });
  return p;
}

/**
 * Build the car. options: { spin: true to draw the wheels as turning discs (cars seen in the race),
 * detail: 0 (sprites) | 1 (large illustrations), steer: front wheel
 * angle in radians (+ left), cockpit: true to add what only the driver sees (dash, wheel rim) }.
 * Returns { parts, bounds }.
 */
export function buildCarModel(options = {}) {
  const detail = options.detail ?? 0;
  const spacing = detail > 0 ? 0.04 : 0.07;
  const around = detail > 0 ? 32 : 22;
  const D = CAR_DIMENSIONS;
  const parts = [];

  // ---- nose and monocoque (the "tub")
  const tub = new PartBuilder('tub', { ink: 1, gloss: true });
  loft(tub, [
    { x: 2.27, zb: 0.205, zt: 0.265, w: 0.03, nt: 2, nb: 2 },
    { x: 2.2, zb: 0.185, zt: 0.29, w: 0.062, nt: 2.2, nb: 2.4 },
    { x: 1.95, zb: 0.15, zt: 0.35, w: 0.115, nt: 2.4, nb: 3 },
    { x: 1.55, zb: 0.115, zt: 0.435, w: 0.185, nt: 2.6, nb: 4 },
    { x: 1.1, zb: 0.09, zt: 0.51, w: 0.25, nt: 2.8, nb: 5 },
    { x: 0.6, zb: 0.08, zt: 0.585, w: 0.3, nt: 3, nb: 5 },
    { x: 0.2, zb: 0.08, zt: 0.605, w: 0.33, nt: 3.2, nb: 5 },
    { x: -0.3, zb: 0.08, zt: 0.62, w: 0.34, nt: 3.2, nb: 5 },
    { x: -0.46, zb: 0.08, zt: 0.62, w: 0.335, nt: 3.2, nb: 5 },
  ], {
    around, spacing,
    role: (x, y, z, u, j, i, n) => {
      const top = Math.abs(u - 0.25);
      if (x < 0.47 && x > -0.36 && top < 0.19 && z > 0.45) return ROLE.BLACK;                // cockpit opening
      if (x > 1.98) return ROLE.WING;                                                          // nose tip in the accent colour
      if (top < 1.5 / n && x > 0.5) return ROLE.WING;                                          // centre stripe
      return ROLE.BODY;
    },
    capStart: ROLE.WING, capEnd: ROLE.CARBON,
  });
  // panel lines: nose cone joint and bulkhead
  for (const lx of [1.98, 0.6]) {
    const ring = [];
    for (let j = 0; j <= 16; j++) {
      const a = (j / 16) * Math.PI;
      const k = lx > 1 ? { w: 0.112, zb: 0.152, zt: 0.347, zm: 0.24 } : { w: 0.3, zb: 0.08, zt: 0.585, zm: 0.31 };
      ring.push([lx, k.w * sgnPow(Math.cos(a), 0.8) * 1.01, k.zm + (k.zt - k.zm) * sgnPow(Math.sin(a), 0.75) * 1.01]);
    }
    tub.lines.push({ pts: ring, normal: [0.2, 0, 1], weight: 0.8 });
  }
  parts.push(tub);

  // ---- engine cover (lower, wide) and airbox spine (tall, narrow)
  const cover = new PartBuilder('cover', { ink: 1, gloss: true });
  loft(cover, [
    { x: -0.4, zb: 0.08, zt: 0.615, w: 0.335, nt: 3.2, nb: 5 },
    { x: -0.8, zb: 0.08, zt: 0.6, w: 0.31, nt: 3, nb: 5 },
    { x: -1.2, zb: 0.09, zt: 0.52, w: 0.25, nt: 2.8, nb: 4.5 },
    { x: -1.6, zb: 0.12, zt: 0.42, w: 0.17, nt: 2.6, nb: 4 },
    { x: -1.93, zb: 0.16, zt: 0.36, w: 0.11, nt: 2.4, nb: 3 },
  ], { around, spacing, role: (x, y, z, u, j, i, n) => (u > 0.56 && u < 0.94 ? ROLE.CARBON : (j === 0 || j === Math.round(n / 2) - 1) ? ROLE.SIDE : ROLE.BODY), capStart: null, capEnd: ROLE.CARBON });
  parts.push(cover);
  const spine = new PartBuilder('airbox', { ink: 1, gloss: true });
  loft(spine, [
    { x: -0.36, zb: 0.79, zt: 1.0, w: 0.118, nt: 2.6, nb: 2.6 },
    { x: -0.46, zb: 0.7, zt: 1.01, w: 0.13, nt: 2.6, nb: 2.6 },
    { x: -0.62, zb: 0.52, zt: 1.0, w: 0.14, nt: 2.6, nb: 3 },
    { x: -0.95, zb: 0.45, zt: 0.9, w: 0.135, nt: 2.4, nb: 3 },
    { x: -1.3, zb: 0.4, zt: 0.74, w: 0.11, nt: 2.4, nb: 3 },
    { x: -1.65, zb: 0.33, zt: 0.57, w: 0.08, nt: 2.2, nb: 3 },
    { x: -1.93, zb: 0.3, zt: 0.44, w: 0.05, nt: 2, nb: 3 },
  ], {
    around, spacing,
    role: (x, y, z, u, j, i, n) => (Math.abs(u - 0.25) < 3.5 / n && x > -0.78 ? ROLE.WING : ROLE.BODY),
    capStart: ROLE.BLACK, capEnd: ROLE.CARBON,
  });
  parts.push(spine);

  // ---- sidepods
  const pod = new PartBuilder('sidepod.left', { ink: 1, gloss: true });
  loft(pod, [
    { x: 0.44, y: 0.5, zb: 0.1, zt: 0.4, w: 0.19, nt: 4, nb: 6 },
    { x: 0.2, y: 0.515, zb: 0.09, zt: 0.425, w: 0.21, nt: 3.6, nb: 6 },
    { x: -0.5, y: 0.52, zb: 0.09, zt: 0.42, w: 0.22, nt: 3.4, nb: 6 },
    { x: -1.0, y: 0.47, zb: 0.09, zt: 0.36, w: 0.18, nt: 3.2, nb: 5 },
    { x: -1.33, y: 0.38, zb: 0.1, zt: 0.28, w: 0.1, nt: 3, nb: 4 },
    { x: -1.5, y: 0.32, zb: 0.11, zt: 0.22, w: 0.05, nt: 2.6, nb: 3 },
  ], {
    around, spacing,
    role: (x, y, z, u, j, i, n) => (u > 0.56 && u < 0.94 ? ROLE.CARBON : j === Math.round(n * 0.08) || j === Math.round(n * 0.08) + 1 ? ROLE.WING : ROLE.SIDE),
    capStart: ROLE.BLACK, capEnd: ROLE.CARBON,
  });
  // where the volumes run into each other they are trimmed so that they meet on a clean line
  const podRight = (x, y, z) => pod.solid(x, -y, z);
  const podSolid = pod.solid;
  const tubSolid = tub.solid, coverSolid0 = cover.solid;
  trimPart(cover, tubSolid);                 // the front of the engine cover is tucked inside the tub
  trimPart(pod, (x, y, z) => Math.min(tubSolid(x, y, z), coverSolid0(x, y, z)));     // the central body as one volume
  for (const body of [tub, cover]) { trimPart(body, podSolid); trimPart(body, podRight); }
  const coverSolid = cover.solid;
  trimPart(cover, spine.solid); trimPart(spine, coverSolid);
  parts.push(pod, mirrorPart(pod, 'sidepod.right'));

  // ---- floor
  const floor = new PartBuilder('floor', { ink: 0.8 });
  box(floor, -0.2, 0, 0.07, 1.41, 1.44, 0.04, ROLE.CARBON, 0, 0.14);        // full width between the axles
  box(floor, -1.3, 0, 0.07, 0.8, 0.92, 0.04, ROLE.CARBON, 0, 0.14);         // narrow tail between the rear wheels
  parts.push(floor);

  // ---- front wing
  const fw = new PartBuilder('frontwing.main', { ink: 0.9 });
  box(fw, 2.1, 0, 0.1, 0.34, 1.396, 0.03, { top: ROLE.WING, bottom: ROLE.WING, front: ROLE.WING, rear: ROLE.WING }, 0, 0.12);
  parts.push(fw);
  const flap = new PartBuilder('frontwing.flap.left', { ink: 0.8 });
  box(flap, 1.96, 0.405, 0.175, 0.2, 0.585, 0.02, { top: ROLE.BODY, bottom: ROLE.BODY, front: ROLE.BODY, rear: ROLE.BODY, right: ROLE.BODY }, 0.42, 0.11);
  parts.push(flap, mirrorPart(flap, 'frontwing.flap.right'));
  const fep = new PartBuilder('frontwing.endplate.left', { ink: 0.9, outward: [0, 1, 0] });
  plate(fep, [[1.84, 0.05], [2.31, 0.05], [2.31, 0.19], [2.12, 0.3], [1.84, 0.3]], 0.7, 0.715, (x, z) => (z < 0.13 ? ROLE.WING : ROLE.SIDE), ROLE.SIDE, ROLE.SIDE);
  parts.push(fep, mirrorPart(fep, 'frontwing.endplate.right'));
  const pyl = new PartBuilder('frontwing.pylons', { ink: 0.6 });
  box(pyl, 2.07, 0.07, 0.155, 0.1, 0.02, 0.09, ROLE.CARBON);
  box(pyl, 2.07, -0.07, 0.155, 0.1, 0.02, 0.09, ROLE.CARBON);
  parts.push(pyl);

  // ---- rear wing
  const rep = new PartBuilder('rearwing.endplate.left', { ink: 1, outward: [0, 1, 0] });
  plate(rep, [[-1.72, 0.3], [-2.27, 0.3], [-2.27, 0.97], [-1.82, 0.97], [-1.72, 0.8]], 0.5, 0.515, (x, z) => (z > 0.84 ? ROLE.WING : z < 0.45 ? ROLE.BODY : ROLE.SIDE), ROLE.SIDE, ROLE.SIDE);
  parts.push(rep, mirrorPart(rep, 'rearwing.endplate.right'));
  const rw = new PartBuilder('rearwing.main', { ink: 0.9 });
  box(rw, -2.06, 0, 0.8, 0.33, 0.996, 0.035, { top: ROLE.WING, bottom: ROLE.WING, front: ROLE.WING, rear: ROLE.WING }, -0.16, 0.12);
  parts.push(rw);
  const rf = new PartBuilder('rearwing.flap', { ink: 0.9 });
  box(rf, -2.17, 0, 0.915, 0.19, 0.996, 0.025, { top: ROLE.BODY, bottom: ROLE.BODY, front: ROLE.BODY, rear: ROLE.WHITE }, -0.5, 0.12);
  parts.push(rf);
  const beam = new PartBuilder('rearwing.beam', { ink: 0.7 });
  box(beam, -2.05, 0, 0.42, 0.2, 0.996, 0.022, { top: ROLE.CARBON, bottom: ROLE.CARBON, front: ROLE.CARBON, rear: ROLE.CARBON }, -0.1, 0.12);
  box(beam, -1.99, 0, 0.59, 0.13, 0.035, 0.36, ROLE.CARBON, 0, 0.12);
  parts.push(beam);
  const light = new PartBuilder('rearlight', { ink: 0.6 });
  box(light, -1.96, 0, 0.3, 0.03, 0.09, 0.075, ROLE.RED);
  parts.push(light);

  // ---- driver
  const helmet = new PartBuilder('helmet', { ink: 0.9, gloss: true });
  const hLat = detail > 0 ? 16 : 10, hLon = detail > 0 ? 28 : 20;
  sphere(helmet, -0.06, 0, 0.8, 0.15, 0.135, 0.14, (i, j, lat, lon) => {
    const a = (i + 0.5) / lat;                    // 0 = crown, 1 = chin
    const front = Math.min(j, lon - 1 - j) / lon; // 0 = facing forward
    if (a > 0.36 && a < 0.62 && front < 0.2) return ROLE.VISOR;
    if (a > 0.66) return ROLE.CARBON;
    const side = Math.abs(((j + 0.5) / lon) % 0.5 - 0.25);
    if (side > 0.2 && a < 0.36) return ROLE.WHITE;   // band over the crown
    return ROLE.HELMET;
  }, hLat, hLon);
  parts.push(helmet);
  const shoulders = new PartBuilder('driver', { ink: 0.6 });
  sphere(shoulders, -0.16, 0, 0.6, 0.23, 0.26, 0.125, () => ROLE.SUIT, detail > 0 ? 10 : 6, detail > 0 ? 24 : 14);     // shoulders rising out of the cockpit opening
  const shoulderSolid = shoulders.solid;
  trimPart(shoulders, tub.solid); trimPart(tub, shoulderSolid);
  parts.push(shoulders);
  const screen = new PartBuilder('windscreen', { ink: 0.6 });
  box(screen, 0.5, 0, 0.615, 0.01, 0.34, 0.05, ROLE.GLASS, -0.55);
  parts.push(screen);

  // ---- mirrors
  const mirror = new PartBuilder('mirror.left', { ink: 0.7 });
  const MM = MIRROR_MOUNT;
  box(mirror, MM.x, MM.y, MM.z, 0.04, MM.width, MM.height, { top: ROLE.BODY, bottom: ROLE.BODY, front: ROLE.BODY, rear: ROLE.GLASS, left: ROLE.BODY, right: ROLE.BODY });
  mirror.rods.push({ a: MM.arm, b: [MM.x, MM.y - 0.02, MM.z - 0.02], radius: 0.009, role: ROLE.CARBON });
  parts.push(mirror, mirrorPart(mirror, 'mirror.right'));

  // ---- suspension, steering and driveshafts
  const steer = options.steer ?? 0;
  const susp = new PartBuilder('suspension.left', { ink: 0.5 });
  const rod = (a, b, radius = 0.011, role = ROLE.CARBON) => susp.rods.push({ a, b, radius, role });
  // front wishbones, push rod and steering arm: the inner ends sit on the skin of the tub
  rod([1.72, 0.122, 0.352], [1.55, 0.74, 0.445]); rod([1.3, 0.2, 0.43], [1.55, 0.74, 0.445]);
  rod([1.76, 0.128, 0.168], [1.55, 0.75, 0.175]); rod([1.32, 0.2, 0.14], [1.55, 0.75, 0.175]);
  rod([1.55, 0.73, 0.19], [1.5, 0.13, 0.42], 0.009);
  rod([1.68, 0.15, 0.3], [1.67 - Math.sin(steer) * 0.12, 0.74, 0.33], 0.008, ROLE.METAL);
  rod([-1.1, 0.17, 0.4], [-1.35, 0.6, 0.42]); rod([-1.54, 0.12, 0.4], [-1.35, 0.6, 0.42]);
  rod([-1.08, 0.2, 0.14], [-1.35, 0.61, 0.17]); rod([-1.56, 0.14, 0.15], [-1.35, 0.61, 0.17]);
  rod([-1.35, 0.1, 0.33], [-1.35, 0.6, 0.33], 0.02, ROLE.METAL);
  rod([-1.35, 0.6, 0.19], [-1.25, 0.14, 0.42], 0.009);
  parts.push(susp, mirrorPart(susp, 'suspension.right'));
  const exhaust = new PartBuilder('exhaust', { ink: 0.5 });
  exhaust.rods.push({ a: [-1.8, 0.09, 0.4], b: [-1.97, 0.1, 0.41], radius: 0.028, role: ROLE.METAL });
  exhaust.rods.push({ a: [-1.8, -0.09, 0.4], b: [-1.97, -0.1, 0.41], radius: 0.028, role: ROLE.METAL });
  exhaust.rods.push({ a: [1.2, 0, 0.5], b: [1.2, 0, 0.6], radius: 0.004, role: ROLE.CARBON });
  parts.push(exhaust);

  // ---- wheels (front wheels may be steered about their vertical axis)
  const spin = !!options.spin;
  parts.push(...placeWheel('wheel.fl', D.frontAxleX, D.frontTrack, D.frontTyre, steer, null, spin));
  parts.push(...placeWheel('wheel.fr', D.frontAxleX, -D.frontTrack, D.frontTyre, steer, null, spin));
  parts.push(...placeWheel('wheel.rl', D.rearAxleX, D.rearTrack, D.rearTyre, 0, null, spin));
  parts.push(...placeWheel('wheel.rr', D.rearAxleX, -D.rearTrack, D.rearTyre, 0, null, spin));

  return { parts: parts.map(finishPart), dimensions: D };
}


/** Build a wheel at its place on the car, steered by `steerAngle` about the vertical axis. */
function placeWheel(name, x, y, tyre, steerAngle, tread = null, spin = false) {
  const [t, r] = wheel(name, 0, 0, 0, tyre.radius, tyre.width, Math.sign(y), spin, tread && tread.phase ? tread.phase : 0, !!(tread && tread.blur));
  if (tread) addTreadMarks(t, tyre, tread);
  t.outward = [0, Math.sign(y) * 0.5, 0]; r.outward = [0, Math.sign(y) * 0.5, 0];
  const c = Math.cos(steerAngle), s = Math.sin(steerAngle);
  for (const p of [t, r]) {
    for (let i = 0; i < p.pos.length; i += 3) {
      const px = p.pos[i], py = p.pos[i + 1];
      p.pos[i] = x + px * c - py * s; p.pos[i + 1] = y + px * s + py * c; p.pos[i + 2] += tyre.radius;
      const nx = p.nor[i], ny = p.nor[i + 1];
      p.nor[i] = nx * c - ny * s; p.nor[i + 1] = nx * s + ny * c;
    }
    for (const l of p.lines) {
      l.pts = l.pts.map((q) => [x + q[0] * c - q[1] * s, y + q[0] * s + q[1] * c, q[2] + tyre.radius]);
      l.normal = [l.normal[0] * c - l.normal[1] * s, l.normal[0] * s + l.normal[1] * c, l.normal[2]];
    }
  }
  return [t, r];
}

/** Number of rolling marks around a tyre and of drawn phases between two marks. */
export const TREAD_MARKS = 9;
export const TREAD_PHASES = 3;
/** Drawn phases of the streaks shown at speed: cycled, they make the tyre visibly turn. */
export const STREAK_PHASES = 3;
/** Groups of streaks around a tyre: close enough for two of them to be in sight on the tread, so that a phase is a short step. */
export const STREAK_BANDS = 12;

/**
 * Pen marks on the tread that make the rolling of a slick tyre visible.
 * tread: { phase: 0..TREAD_PHASES-1 } for distinct marks, or { blur: true } for the streaks drawn
 * at speed. Rolling forward moves the marks from the rear of the tyre over the top.
 */
function addTreadMarks(part, tyre, tread) {
  const r = tyre.radius * 1.004;
  const lanes = [-0.07, 0.02, 0.07, -0.03, 0.05, -0.08, 0, 0.08, -0.05];
  const arc = (lat, from, to, hex, weight) => {
    const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 0.07));
    const pts = [];
    for (let i = 0; i <= steps; i++) { const t = from + ((to - from) * i) / steps; pts.push([r * Math.cos(t), lat, r * Math.sin(t)]); }
    const mid = (from + to) / 2;
    part.lines.push({ pts, normal: [Math.cos(mid), 0, Math.sin(mid)], weight, hex });
  };
  const period = (Math.PI * 2) / TREAD_MARKS;
  if (tread.blur) {
    // a tyre turning fast: STREAK_BANDS rows of short dashes around the tyre, one dash per lane, every
    // lane of a row on (nearly) the same angle. A dash that slides along itself looks still: what
    // shows the rotation is the row, a mark across the tread, moving as one piece. A phase moves all
    // the rows together by a third of their spacing, the same way as the marks of the slow drawing.
    const spacing = (Math.PI * 2) / STREAK_BANDS, shift = ((tread.phase || 0) / STREAK_PHASES) * spacing;
    const lengths = [0.3, 0.38, 0.27, 0.36, 0.4, 0.29, 0.34], offsets = [0, 0.03, -0.02, 0.04, -0.03, 0.02, -0.04];   // shares of the spacing: ragged rows
    for (let lane = 0; lane < 7; lane++) {
      const lat = -0.085 + lane * 0.028, half = (lengths[lane] * spacing) / 2;
      for (let k = 0; k < STREAK_BANDS; k++) {
        const centre = (k + offsets[lane]) * spacing - shift;
        arc(lat, centre - half, centre + half, lane % 2 ? '#7a7d90' : '#0e0e14', 2.1);
      }
    }
    return;
  }
  for (let i = 0; i < TREAD_MARKS; i++) {
    const t0 = i * period - (tread.phase / TREAD_PHASES) * period;
    const len = 0.2 + (i % 3) * 0.05;
    // (drawn boldly: on a slick tyre these marks are the only thing that shows the wheel turning)
    arc(lanes[i % lanes.length], t0, t0 + len, i % 2 ? '#7a7d90' : '#0e0e14', 2.6);
    arc(lanes[(i + 4) % lanes.length], t0 + 0.3, t0 + 0.3 + len * 0.6, i % 2 ? '#0e0e14' : '#7a7d90', 2);
  }
}

/** Front-left wheel alone (cockpit drawing): { steer, tread } -> { parts }. */
export function buildFrontWheelModel(options = {}) {
  const D = CAR_DIMENSIONS;
  const parts = placeWheel('wheel.fl', D.frontAxleX, D.frontTrack, D.frontTyre, options.steer ?? 0, options.tread || null);
  return { parts: parts.map(finishPart), dimensions: D };
}

/** Freeze a part: typed arrays plus edge adjacency (used for contour and crease detection). */
function finishPart(p) {
  const pos = new Float32Array(p.pos), nor = new Float32Array(p.nor);
  const count = pos.length / 3;
  // weld identical positions so that edges shared by different faces of a solid are recognised
  const weld = new Int32Array(count);
  const seen = new Map();
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(pos[i * 3] * 5000)},${Math.round(pos[i * 3 + 1] * 5000)},${Math.round(pos[i * 3 + 2] * 5000)}`;
    let id = seen.get(key);
    if (id === undefined) { id = seen.size; seen.set(key, id); }
    weld[i] = id;
  }
  const edgeMap = new Map();
  const faces = p.faces;
  for (let f = 0; f < faces.length; f++) {
    const idx = faces[f].idx, n = idx.length;
    faces[f].edges = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      const a = weld[idx[k]], b = weld[idx[(k + 1) % n]];
      if (a === b) { faces[f].edges[k] = -1; continue; }
      const key = a < b ? a * 1000003 + b : b * 1000003 + a;
      let e = edgeMap.get(key);
      if (!e) { e = { id: edgeMap.size, faces: [] }; edgeMap.set(key, e); }
      e.faces.push(f);
      faces[f].edges[k] = e.id;
    }
  }
  const edges = new Array(edgeMap.size);
  for (const e of edgeMap.values()) edges[e.id] = e.faces;
  return { name: p.name, ink: p.ink, bias: p.bias, gloss: p.gloss, outward: p.outward, pos, nor, faces, edges, rods: p.rods, lines: p.lines };
}
