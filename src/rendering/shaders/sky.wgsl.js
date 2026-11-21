// Sky and distant backdrops. Layer rules: the sky is a soft banded gradient fixed to the
// horizon; clouds drift slowly; far relief and near relief are 120-degree panoramas that scroll
// with the viewer's heading (the near one slightly faster) and follow the horizon line.

import { COMMON_WGSL } from './common.wgsl.js';

export const SKY_WGSL = COMMON_WGSL + /* wgsl */`
@group(0) @binding(0) var<uniform> view: View;
@group(1) @binding(0) var backdropSampler: sampler;
@group(1) @binding(1) var backdrop: texture_2d_array<f32>;

const BACKDROP_TAN_TOP = 0.36;    // elevation (tan) at the top of a backdrop texture
const BACKDROP_TAN_BOTTOM = -0.03;

fn layer(u: f32, t: f32, index: i32) -> vec4f {
  let v = (BACKDROP_TAN_TOP - t) / (BACKDROP_TAN_TOP - BACKDROP_TAN_BOTTOM);
  if (v < 0.0) { return vec4f(0.0); }
  return textureSampleLevel(backdrop, backdropSampler, vec2f(u, min(v, 0.999)), index, 0.0);
}

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let px = pos.xy - view.rect.xy;
  let focal = view.proj.x;
  let horizon = view.proj.z + view.sky.y;
  let t = (horizon - px.y) / focal;                       // tan(elevation)
  let ang = atan((px.x - view.proj.y) / focal);
  let turns = ang / 2.0943951;                            // 120 degrees per panorama
  // banded gradient: a handful of flat tones with soft joints
  let g = clamp(t / 0.62, 0.0, 1.0);
  let bands = 9.0;
  let gb = (floor(g * bands) + smoothstep(0.25, 0.75, fract(g * bands))) / bands;
  var c = mix(view.colors[C_SKY_LOW].rgb, view.colors[C_SKY_MID].rgb, smoothstep(0.0, 0.45, gb));
  c = mix(c, view.colors[C_SKY_TOP].rgb, smoothstep(0.35, 1.0, gb));
  let heading = view.misc.y;
  let clouds = layer(heading * 0.92 + turns + view.sky.x, t, 0);
  c = c * (1.0 - clouds.a) + clouds.rgb;
  let farRelief = layer(heading + turns, t, 1);
  c = c * (1.0 - farRelief.a) + farRelief.rgb;
  let nearRelief = layer(heading * 1.06 + turns + 0.37, t * 1.0, 2);
  c = c * (1.0 - nearRelief.a) + nearRelief.rgb;
  if (t < BACKDROP_TAN_BOTTOM) { c = mix(view.colors[C_FAR_GROUND].rgb, view.colors[C_HAZE].rgb, 0.55); }
  return vec4f(c, 1.0);
}
`;
