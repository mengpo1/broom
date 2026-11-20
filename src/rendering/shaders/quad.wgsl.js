// Sprite / strip / panel quads. Vertices arrive in view pixels with a perspective weight w so
// that strips receding along the road are textured correctly. Fragments are hidden by nearer
// ground using the row table (hill crests), which replaces a depth buffer.
//   mode 0: atlas sprite (premultiplied) * tint
//   mode 1: car sprite: fixed colours layer + livery mask layer (r,g,b weights) and a palette row
//   mode 2: flat colour

import { COMMON_WGSL } from './common.wgsl.js';

export const MAX_LIVERIES = 24;

export const QUAD_WGSL = COMMON_WGSL + /* wgsl */`
struct Palette { colors: array<vec4f, ${MAX_LIVERIES * 3}> };
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var<storage, read> rows: array<vec4f>;
@group(1) @binding(0) var spriteSampler: sampler;
@group(1) @binding(1) var atlas: texture_2d_array<f32>;
@group(1) @binding(2) var cars: texture_2d_array<f32>;
@group(1) @binding(3) var<uniform> palette: Palette;

struct VIn { @location(0) p: vec4f, @location(1) t: vec4f, @location(2) tint: vec4f };
struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) @interpolate(flat) info: vec4f,   // layer, mode, palette, zTest
  @location(2) tint: vec4f,
};

@vertex fn vs(v: VIn) -> VOut {
  var o: VOut;
  let w = max(v.p.z, 1e-4);
  let ndc = vec2f(v.p.x / view.rect.z * 2.0 - 1.0, 1.0 - v.p.y / view.rect.w * 2.0);
  o.pos = vec4f(ndc * w, 0.5 * w, w);
  o.uv = v.t.xy;
  let mp = v.t.w;
  let mode = floor(mp / 64.0);
  o.info = vec4f(v.t.z, mode, mp - mode * 64.0, v.p.w);
  o.tint = v.tint;
  return o;
}

@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let zTest = i.info.w;
  let gx = dpdx(i.uv); let gy = dpdy(i.uv);
  if (zTest > 0.0) {
    let ri = u32(clamp(i.pos.y - view.rect.y, 0.0, view.rect.w - 1.0));
    let zRow = rows[u32(view.flags.y) * 2u + ri * 2u].x;
    if (zRow > 0.0 && zRow < zTest * 0.985 - 0.35) { discard; }
  }
  var c: vec4f;
  let mode = i.info.y;
  if (mode < 0.5) {
    c = textureSampleGrad(atlas, spriteSampler, i.uv, i32(i.info.x), gx, gy);
    c = vec4f(c.rgb * i.tint.rgb, c.a) * i.tint.a;
  } else if (mode < 1.5) {
    let layer = i32(i.info.x);
    let fixedC = textureSampleGrad(cars, spriteSampler, i.uv, layer, gx, gy);
    let mask = textureSampleGrad(cars, spriteSampler, i.uv, layer + 1, gx, gy);
    let p = i32(i.info.z) * 3;
    let rgb = fixedC.rgb + mask.r * palette.colors[p].rgb + mask.g * palette.colors[p + 1].rgb + mask.b * palette.colors[p + 2].rgb;
    c = vec4f(rgb * i.tint.rgb, fixedC.a) * i.tint.a;
  } else {
    c = vec4f(i.tint.rgb * i.tint.a, i.tint.a);
  }
  if (zTest > 0.0) {
    let fog = (1.0 - exp(-zTest * view.misc.z)) * 0.8;
    c = vec4f(mix(c.rgb, view.colors[C_HAZE].rgb * c.a, fog), c.a);
  }
  return c;
}
`;
