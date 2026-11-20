// Sky dome, particles and ground decals (skid marks, contact shadows).

import { VIEW_STRUCT, COMMON_WGSL } from './common.wgsl.js';

const HEADER = /* wgsl */ `
${VIEW_STRUCT}
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var noiseTex: texture_2d<f32>;
@group(0) @binding(2) var noiseSampler: sampler;
@group(0) @binding(3) var atlasTex: texture_2d<f32>;
@group(0) @binding(4) var shadowTex: texture_depth_2d_array;
@group(0) @binding(5) var shadowSampler: sampler_comparison;
${COMMON_WGSL}
struct FOut {
  @location(0) color: vec4f,
  @location(1) velocity: vec4f,
}
`;

export const SKY_WGSL = /* wgsl */ `
${HEADER}
struct SkyOut {
  @builtin(position) clip: vec4f,
  @location(0) ndc: vec2f,
}

@vertex
fn vs_sky(@builtin(vertex_index) i: u32) -> SkyOut {
  var out: SkyOut;
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  out.clip = vec4f(p, 0.0, 1.0);
  out.ndc = p;
  return out;
}

@fragment
fn fs_sky(in: SkyOut) -> FOut {
  var out: FOut;
  let near = view.invViewProj * vec4f(in.ndc, 1.0, 1.0);
  let dir = normalize(near.xyz / near.w - view.cameraPos.xyz);
  var col = skyColor(dir, 0.0);
  // sun disc
  let sd = dot(dir, view.sunDir.xyz);
  let clouds = cloudLayer(dir, 0.0).x;
  col += view.sunColor.rgb * 14.0 * smoothstep(0.99985, 0.99996, sd) * (1.0 - clouds);
  // distant haze below the horizon line (rarely visible, behind terrain)
  if (dir.y < 0.0) { col = mix(view.fogColor.rgb, view.groundColor.rgb, saturate1(-dir.y * 6.0)); }
  out.color = vec4f(col, 1.0);
  let cur = view.cleanViewProj * vec4f(dir, 0.0);
  let prev = view.prevViewProj * vec4f(dir, 0.0);
  out.velocity = vec4f((cur.xy / cur.w - prev.xy / prev.w) * vec2f(0.5, -0.5), 0.0, 1.0);
  return out;
}
`;

export const PARTICLE_WGSL = /* wgsl */ `
${HEADER}
struct PIn {
  @builtin(vertex_index) vertex: u32,
  @location(0) posSize: vec4f,     // world position, size (m)
  @location(1) color: vec4f,       // rgb, alpha
  @location(2) misc: vec4f,        // rotation, kind (0 smoke, 1 dust, 2 spark, 3 debris), stretch x, stretch y
}
struct POut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) @interpolate(flat) misc: vec4f,
  @location(3) worldPos: vec3f,
}

@vertex
fn vs_particle(in: PIn) -> POut {
  var out: POut;
  let corner = vec2f(f32(in.vertex & 1u), f32((in.vertex >> 1u) & 1u)) * 2.0 - 1.0;
  let c = cos(in.misc.x); let s = sin(in.misc.x);
  let rc = vec2f(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  let world = in.posSize.xyz + (view.cameraRight.xyz * rc.x + view.cameraUp.xyz * rc.y) * in.posSize.w;
  out.clip = view.viewProj * vec4f(world, 1.0);
  out.uv = corner;
  out.color = in.color;
  out.misc = in.misc;
  out.worldPos = world;
  return out;
}

@fragment
fn fs_particle(in: POut) -> FOut {
  var out: FOut;
  let r = length(in.uv);
  if (r > 1.0) { discard; }
  var alpha = in.color.a;
  var col = in.color.rgb;
  if (in.misc.y > 1.5 && in.misc.y < 2.5) {
    // spark: hot core
    alpha *= smoothstep(1.0, 0.0, r);
    col *= 14.0;
    out.color = vec4f(col * alpha, 0.0);
  } else {
    let n = textureSampleLevel(noiseTex, noiseSampler, in.uv * 0.23 + in.misc.xx * 0.31, 1.0).g;
    alpha *= smoothstep(1.0, 0.25, r) * (0.55 + 0.9 * n);
    let light = view.sunColor.rgb * (0.22 + 0.1 * (1.0 - r)) + (view.zenithColor.rgb + view.horizonColor.rgb) * 0.5 * view.ambient.x;
    col = applyFog(col * light, in.worldPos);
    out.color = vec4f(col * alpha, alpha);
  }
  out.velocity = vec4f(0.0);
  return out;
}
`;

export const DECAL_WGSL = /* wgsl */ `
${HEADER}
struct DIn {
  @location(0) position: vec3f,
  @location(1) data: vec4f,        // u, v, strength, birth time (negative: contact shadow)
}
struct DOut {
  @builtin(position) clip: vec4f,
  @location(0) data: vec4f,
  @location(1) worldPos: vec3f,
}

@vertex
fn vs_decal(in: DIn) -> DOut {
  var out: DOut;
  out.clip = view.viewProj * vec4f(in.position, 1.0);
  out.data = in.data;
  out.worldPos = in.position;
  return out;
}

@fragment
fn fs_decal(in: DOut) -> FOut {
  var out: FOut;
  var alpha = 0.0;
  if (in.data.w < 0.0) {
    // soft contact shadow under a car: uv in -1..1
    let q = in.data.xy;
    let d = length(q * vec2f(1.0, 1.0));
    alpha = in.data.z * (1.0 - smoothstep(0.35, 1.0, d));
  } else {
    let age = view.cameraPos.w - in.data.w;
    let fade = 1.0 - smoothstep(25.0, 40.0, age);
    let across = 1.0 - smoothstep(0.55, 1.0, abs(in.data.x));
    let n = textureSampleLevel(noiseTex, noiseSampler, vec2f(in.data.x * 0.6, in.data.y * 0.05), 0.0).g;
    alpha = in.data.z * fade * across * (0.55 + 0.6 * n);
  }
  let f = fogFactor(in.worldPos);
  alpha *= 1.0 - f;
  out.color = vec4f(vec3f(0.004) * alpha, alpha);
  out.velocity = vec4f(0.0);
  return out;
}
`;
