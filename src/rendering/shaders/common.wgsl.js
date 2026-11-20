// Shared WGSL: per-view uniform block, colour slots and small helpers.
// The layout of `View` must match compositing/view-uniforms.js.

export const COLOR_SLOTS = {
  asphalt: 0, asphaltGroove: 1, asphaltLight: 2, paint: 3, kerbA: 4, kerbB: 5,
  grassA: 6, grassB: 7, grassDark: 8, gravelA: 9, gravelB: 10, pitAsphalt: 11,
  ink: 12, haze: 13, beyondA: 14, beyondB: 15, skyTop: 16, skyMid: 17, skyLow: 18,
  paintYellow: 19, speedLight: 20, speedDark: 21, farGround: 22, mown: 23,
};
export const COLOR_SLOT_COUNT = 32;

export const COMMON_WGSL = /* wgsl */`
struct View {
  rect: vec4f,      // x, y, w, h in framebuffer pixels
  proj: vec4f,      // focal, cx, cy (view pixels), dir
  cam: vec4f,       // camS, camD (view frame), time, speed (m/s)
  track: vec4f,     // length, ds, halfWidth, kerbWidth
  misc: vec4f,      // topRow, heading (turns of the backdrop period), fogDensity, sample count
  pitA: vec4f,      // side, wallD, outerD, laneD
  pitB: vec4f,      // entryS, wallStartS, wallEndS, exitS (relative to the start line)
  fx: vec4f,        // speedLines, focusX, focusY, flash
  sky: vec4f,       // cloud scroll, pitch offset (px), backdrop strength, detail
  flags: vec4f,     // gridCount, rowBase (in rows), paper grain, unused
  colors: array<vec4f, ${COLOR_SLOT_COUNT}>,
};

const C_ASPHALT = 0; const C_GROOVE = 1; const C_ASPHALT_LIGHT = 2; const C_PAINT = 3;
const C_KERB_A = 4; const C_KERB_B = 5; const C_GRASS_A = 6; const C_GRASS_B = 7; const C_GRASS_DARK = 8;
const C_GRAVEL_A = 9; const C_GRAVEL_B = 10; const C_PIT = 11; const C_INK = 12; const C_HAZE = 13;
const C_BEYOND_A = 14; const C_BEYOND_B = 15; const C_SKY_TOP = 16; const C_SKY_MID = 17; const C_SKY_LOW = 18;
const C_YELLOW = 19; const C_SPEED_LIGHT = 20; const C_SPEED_DARK = 21; const C_FAR_GROUND = 22; const C_MOWN = 23;

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
fn hash22(p: vec2f) -> vec2f {
  var p3 = fract(vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2f(1.0, 0.0)), u.x),
             mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), u.x), u.y);
}
// Anti-aliased step: 0 below the edge, 1 above, over a filter width w.
fn aastep(edge: f32, x: f32, w: f32) -> f32 { return clamp((x - edge) / max(w, 1e-6) + 0.5, 0.0, 1.0); }
// Anti-aliased band between a and b.
fn aaband(a: f32, b: f32, x: f32, w: f32) -> f32 { return aastep(a, x, w) * (1.0 - aastep(b, x, w)); }

struct FullscreenOut { @builtin(position) pos: vec4f };
@vertex fn vsFullscreen(@builtin(vertex_index) vi: u32) -> FullscreenOut {
  var o: FullscreenOut;
  let x = f32((vi << 1u) & 2u); let y = f32(vi & 2u);
  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  return o;
}
`;
