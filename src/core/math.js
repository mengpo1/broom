// Minimal allocation-free math helpers. Matrices are column-major Float32Array(16),
// right-handed, Y up, WebGPU clip space (z in [0,1]). Functions write into `out`.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function saturate(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(e0, e1, x) {
  const t = saturate((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
/** Frame-rate independent exponential approach of `a` toward `b`. */
export function damp(a, b, rate, dt) { return b + (a - b) * Math.exp(-rate * dt); }
export function moveToward(a, b, maxDelta) {
  const d = b - a;
  return Math.abs(d) <= maxDelta ? b : a + Math.sign(d) * maxDelta;
}
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export function angleDiff(a, b) { return wrapAngle(a - b); }
export function mod(a, n) { const r = a % n; return r < 0 ? r + n : r; }

export function mat4Create() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
export function mat4Identity(out) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}
export function mat4Copy(out, a) { out.set(a); return out; }

export function mat4Multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

/** Reversed-Z perspective with infinite far plane (depth 1 at near, 0 at infinity). */
export function mat4PerspectiveReverseZ(out, fovY, aspect, near) {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[11] = -1;
  out[14] = near;
  return out;
}

/** Standard orthographic projection, depth 0 at near, 1 at far. */
export function mat4Ortho(out, l, r, b, t, n, f) {
  out.fill(0);
  out[0] = 2 / (r - l);
  out[5] = 2 / (t - b);
  out[10] = -1 / (f - n);
  out[12] = -(r + l) / (r - l);
  out[13] = -(t + b) / (t - b);
  out[14] = -n / (f - n);
  out[15] = 1;
  return out;
}

export function mat4LookAt(out, ex, ey, ez, tx, ty, tz, ux, uy, uz) {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  let l = Math.hypot(zx, zy, zz) || 1;
  zx /= l; zy /= l; zz /= l;
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
  l = Math.hypot(xx, xy, xz) || 1;
  xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * ex + xy * ey + xz * ez);
  out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
  return out;
}

export function mat4Invert(out, m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return mat4Identity(out);
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

/**
 * Build a rigid transform from a position and an orthonormal basis given as
 * yaw (heading in the XZ plane, forward = (cos, 0, sin)), pitch (nose up) and roll (right side down).
 * Local axes: +X right, +Y up, -Z forward.
 */
export function mat4FromPose(out, x, y, z, heading, pitch, roll) {
  const ch = Math.cos(heading), sh = Math.sin(heading);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // forward (unit), with pitch
  const fx = ch * cp, fy = sp, fz = sh * cp;
  // flat right vector
  const rx0 = -sh, rz0 = ch;
  // up0 = right0 x forward ... (right x up = forward in our convention => up = forward x right * -1)
  const ux0 = -(fy * rz0 - fz * 0), uy0 = -(fz * rx0 - fx * rz0), uz0 = -(fx * 0 - fy * rx0);
  // apply roll about forward axis: right = right0*cr - up0*sr ; up = up0*cr + right0*sr
  const rx = rx0 * cr - ux0 * sr, ry = -uy0 * sr, rz = rz0 * cr - uz0 * sr;
  const ux = ux0 * cr + rx0 * sr, uy = uy0 * cr, uz = uz0 * cr + rz0 * sr;
  out[0] = rx; out[1] = ry; out[2] = rz; out[3] = 0;
  out[4] = ux; out[5] = uy; out[6] = uz; out[7] = 0;
  out[8] = -fx; out[9] = -fy; out[10] = -fz; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

export function mat4Translate(out, m, x, y, z) {
  if (out !== m) out.set(m);
  out[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

export function mat4RotateX(out, m, a) {
  if (out !== m) out.set(m);
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < 4; i++) {
    const y = out[4 + i], z = out[8 + i];
    out[4 + i] = y * c + z * s;
    out[8 + i] = z * c - y * s;
  }
  return out;
}

export function mat4RotateY(out, m, a) {
  if (out !== m) out.set(m);
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < 4; i++) {
    const x = out[i], z = out[8 + i];
    out[i] = x * c - z * s;
    out[8 + i] = x * s + z * c;
  }
  return out;
}

export function mat4RotateZ(out, m, a) {
  if (out !== m) out.set(m);
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < 4; i++) {
    const x = out[i], y = out[4 + i];
    out[i] = x * c + y * s;
    out[4 + i] = y * c - x * s;
  }
  return out;
}

export function mat4Scale(out, m, sx, sy, sz) {
  for (let i = 0; i < 4; i++) {
    out[i] = m[i] * sx;
    out[4 + i] = m[4 + i] * sy;
    out[8 + i] = m[8 + i] * sz;
    out[12 + i] = m[12 + i];
  }
  return out;
}

/** Transform point (x,y,z,1) by m, write xyz into out[offset..]. */
export function transformPoint(out, offset, m, x, y, z) {
  out[offset] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[offset + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[offset + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

export function transformDirection(out, offset, m, x, y, z) {
  out[offset] = m[0] * x + m[4] * y + m[8] * z;
  out[offset + 1] = m[1] * x + m[5] * y + m[9] * z;
  out[offset + 2] = m[2] * x + m[6] * y + m[10] * z;
  return out;
}

/** Halton low-discrepancy sequence (used for TAA jitter). */
export function halton(index, base) {
  let f = 1, r = 0;
  while (index > 0) {
    f /= base;
    r += f * (index % base);
    index = Math.floor(index / base);
  }
  return r;
}
