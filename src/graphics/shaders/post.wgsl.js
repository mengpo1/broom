// Post-processing chain: ambient occlusion, temporal antialiasing, bloom, final composite.

import { VIEW_STRUCT } from './common.wgsl.js';

const FULLSCREEN = /* wgsl */ `
struct FsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
}
@vertex
fn vs_fullscreen(@builtin(vertex_index) i: u32) -> FsOut {
  var out: FsOut;
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  out.clip = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(p.x, 1.0 - p.y);
  return out;
}
`;

export const SSAO_WGSL = /* wgsl */ `
${VIEW_STRUCT}
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var depthTex: texture_depth_2d;
${FULLSCREEN}

fn viewPos(uv: vec2f, size: vec2f) -> vec3f {
  let px = vec2i(clamp(uv * size, vec2f(0.0), size - 1.0));
  let d = max(textureLoad(depthTex, px, 0), 1e-6);
  let z = view.cameraRight.w / d;
  let t = view.cameraUp.w;
  return vec3f((uv.x * 2.0 - 1.0) * t * size.x / size.y * z, (1.0 - uv.y * 2.0) * t * z, z);
}

@fragment
fn fs_ssao(in: FsOut) -> @location(0) vec4f {
  let size = view.viewport.xy;
  let px = vec2i(clamp(in.uv * size, vec2f(0.0), size - 1.0));
  let rawDepth = textureLoad(depthTex, px, 0);
  if (rawDepth <= 0.0) { return vec4f(1.0); }
  let p = viewPos(in.uv, size);
  if (p.z > 220.0) { return vec4f(1.0); }
  let texel = view.viewport.zw;
  let pr = viewPos(in.uv + vec2f(texel.x, 0.0), size);
  let pl = viewPos(in.uv - vec2f(texel.x, 0.0), size);
  let pu = viewPos(in.uv - vec2f(0.0, texel.y), size);
  let pd = viewPos(in.uv + vec2f(0.0, texel.y), size);
  var dx = pr - p; if (abs(pl.z - p.z) < abs(pr.z - p.z)) { dx = p - pl; }
  var dy = pu - p; if (abs(pd.z - p.z) < abs(pu.z - p.z)) { dy = p - pd; }
  let n = normalize(cross(dx, dy));
  let radius = 0.9;
  let rpx = clamp(radius / p.z / (2.0 * view.cameraUp.w) * size.y, 3.0, 90.0);
  let noise = fract(52.9829189 * fract(dot(in.clip.xy, vec2f(0.06711056, 0.00583715))) + view.trackParams.w * 0.618);
  var occ = 0.0;
  const N = 8;
  for (var i = 0; i < N; i++) {
    let fi = (f32(i) + noise) / f32(N);
    let ang = fi * 6.2831 * 2.4 + noise * 6.2831;
    let off = vec2f(cos(ang), sin(ang)) * (rpx * sqrt(fi)) * texel;
    let q = viewPos(in.uv + off, size);
    let v = q - p;
    let dist = length(v) + 1e-4;
    occ += max(0.0, dot(n, v) / dist - 0.12) * (1.0 / (1.0 + dist * dist / (radius * radius)));
  }
  let fade = 1.0 - smoothstep(120.0, 220.0, p.z);
  let ao = 1.0 - saturate(occ / f32(N) * 2.2) * fade;
  return vec4f(ao, 0.0, 0.0, 1.0);
}
`;

export const TAA_WGSL = /* wgsl */ `
${VIEW_STRUCT}
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var colorTex: texture_2d<f32>;
@group(0) @binding(2) var velocityTex: texture_2d<f32>;
@group(0) @binding(3) var depthTex: texture_depth_2d;
@group(0) @binding(4) var historyTex: texture_2d<f32>;
@group(0) @binding(5) var aoTex: texture_2d<f32>;
@group(0) @binding(6) var linearSampler: sampler;
${FULLSCREEN}

fn tonemapWeight(c: vec3f) -> f32 { return 1.0 / (1.0 + dot(c, vec3f(0.2126, 0.7152, 0.0722))); }

@fragment
fn fs_taa(in: FsOut) -> @location(0) vec4f {
  let size = view.viewport.xy;
  let px = vec2i(in.clip.xy);
  let maxPx = vec2i(size) - 1;
  // Closest fragment in a 3x3 cross decides the velocity (keeps silhouettes stable).
  var bestDepth = textureLoad(depthTex, px, 0);
  var bestPx = px;
  let offsets = array<vec2i, 4>(vec2i(-1, -1), vec2i(1, -1), vec2i(-1, 1), vec2i(1, 1));
  for (var i = 0; i < 4; i++) {
    let q = clamp(px + offsets[i], vec2i(0), maxPx);
    let d = textureLoad(depthTex, q, 0);
    if (d > bestDepth) { bestDepth = d; bestPx = q; }
  }
  let velocity = textureLoad(velocityTex, bestPx, 0).xy;
  let ao = mix(1.0, textureSampleLevel(aoTex, linearSampler, in.uv, 0.0).r, view.ambient.z);
  let cur = textureLoad(colorTex, px, 0).rgb * ao;
  var lo = cur; var hi = cur;
  var m1 = cur; var m2 = cur * cur;
  let cross = array<vec2i, 8>(vec2i(-1, 0), vec2i(1, 0), vec2i(0, -1), vec2i(0, 1), vec2i(-1, -1), vec2i(1, -1), vec2i(-1, 1), vec2i(1, 1));
  for (var i = 0; i < 8; i++) {
    let c = textureLoad(colorTex, clamp(px + cross[i], vec2i(0), maxPx), 0).rgb * ao;
    lo = min(lo, c); hi = max(hi, c);
    m1 += c; m2 += c * c;
  }
  let mean = m1 / 9.0;
  let sigma = sqrt(max(m2 / 9.0 - mean * mean, vec3f(0.0)));
  lo = max(lo, mean - sigma * 1.25);
  hi = min(hi, mean + sigma * 1.25);
  let prevUv = in.uv - velocity;
  var history = textureSampleLevel(historyTex, linearSampler, prevUv, 0.0).rgb;
  let valid = prevUv.x >= 0.0 && prevUv.x <= 1.0 && prevUv.y >= 0.0 && prevUv.y <= 1.0 && view.jitter.z > -10.0;
  history = clamp(history, lo, hi);
  let speed = length(velocity * size);
  var blend = mix(0.1, 0.22, saturate(speed / 60.0));
  if (!valid) { blend = 1.0; }
  let wc = tonemapWeight(cur) * blend;
  let wh = tonemapWeight(history) * (1.0 - blend);
  let result = (cur * wc + history * wh) / max(wc + wh, 1e-5);
  return vec4f(max(result, vec3f(0.0)), 1.0);
}
`;

export const BLOOM_WGSL = /* wgsl */ `
@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
${FULLSCREEN}

@fragment
fn fs_prefilter(in: FsOut) -> @location(0) vec4f {
  let texel = 1.0 / vec2f(textureDimensions(srcTex));
  var sum = vec3f(0.0);
  var wsum = 0.0;
  let taps = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  for (var i = 0; i < 4; i++) {
    let c = textureSampleLevel(srcTex, linearSampler, in.uv + taps[i] * texel, 0.0).rgb;
    let l = dot(c, vec3f(0.2126, 0.7152, 0.0722));
    let w = 1.0 / (1.0 + l);          // Karis average against fireflies
    let soft = max(l - 0.8, 0.0);
    let contribution = c * (soft / max(l, 1e-4));
    sum += contribution * w; wsum += w;
  }
  return vec4f(sum / wsum, 1.0);
}

@fragment
fn fs_down(in: FsOut) -> @location(0) vec4f {
  let texel = 1.0 / vec2f(textureDimensions(srcTex));
  var c = textureSampleLevel(srcTex, linearSampler, in.uv, 0.0).rgb * 4.0;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(-1.0, -1.0) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(1.0, -1.0) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(-1.0, 1.0) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(1.0, 1.0) * texel, 0.0).rgb;
  return vec4f(c / 8.0, 1.0);
}

@fragment
fn fs_up(in: FsOut) -> @location(0) vec4f {
  let texel = 1.0 / vec2f(textureDimensions(srcTex));
  var c = vec3f(0.0);
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(-1.0, 0.0) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(1.0, 0.0) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(0.0, -1.0) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(0.0, 1.0) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(-0.7, -0.7) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(0.7, -0.7) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(-0.7, 0.7) * texel, 0.0).rgb;
  c += textureSampleLevel(srcTex, linearSampler, in.uv + vec2f(0.7, 0.7) * texel, 0.0).rgb;
  return vec4f(c / 8.0 * 0.62, 1.0);
}
`;

export const COMPOSITE_WGSL = /* wgsl */ `
${VIEW_STRUCT}
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var colorTex: texture_2d<f32>;
@group(0) @binding(2) var velocityTex: texture_2d<f32>;
@group(0) @binding(3) var bloomTex: texture_2d<f32>;
@group(0) @binding(4) var linearSampler: sampler;
${FULLSCREEN}

// Filmic curve (ACES fit by Krzysztof Narkowicz, public domain).
fn tonemap(x: vec3f) -> vec3f {
  let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
  return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}

fn toSrgb(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3f(0.0031308));
}

@fragment
fn fs_composite(in: FsOut) -> @location(0) vec4f {
  let rect = view.outputRect;
  let uv = (in.clip.xy - rect.xy) / rect.zw;
  let size = view.viewport.xy;
  var color = textureSampleLevel(colorTex, linearSampler, uv, 0.0).rgb;
  // light sharpening to offset TAA softness
  let t = view.viewport.zw;
  let around = textureSampleLevel(colorTex, linearSampler, uv + vec2f(t.x, 0.0), 0.0).rgb
    + textureSampleLevel(colorTex, linearSampler, uv - vec2f(t.x, 0.0), 0.0).rgb
    + textureSampleLevel(colorTex, linearSampler, uv + vec2f(0.0, t.y), 0.0).rgb
    + textureSampleLevel(colorTex, linearSampler, uv - vec2f(0.0, t.y), 0.0).rgb;
  let sharp = color + (color - around * 0.25) * 0.3;
  color = clamp(sharp, color * 0.6, color * 1.6 + vec3f(0.02));
  // motion blur along the screen-space velocity of this pixel
  let strength = view.ambient.w;
  if (strength > 0.0) {
    let vel = textureSampleLevel(velocityTex, linearSampler, uv, 0.0).xy;
    var v = vel * strength;
    let lenPx = length(v * size);
    let maxPx = 0.022 * size.y;
    if (lenPx > maxPx) { v *= maxPx / lenPx; }
    if (lenPx > 1.2) {
      let vLen = length(vel);
      let noise = fract(52.9829189 * fract(dot(in.clip.xy, vec2f(0.06711056, 0.00583715))));
      var acc = color; var wsum = 1.0;
      const TAPS = 6;
      for (var i = 0; i < TAPS; i++) {
        let f = (f32(i) + noise) / f32(TAPS) - 0.5;
        let suv = uv + v * f;
        let sv = length(textureSampleLevel(velocityTex, linearSampler, suv, 0.0).xy);
        // do not smear slow (foreground) pixels into fast ones
        let w = saturate(sv / max(vLen, 1e-5) * 2.0 - 0.6) * step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
        acc += textureSampleLevel(colorTex, linearSampler, suv, 0.0).rgb * w;
        wsum += w;
      }
      color = acc / wsum;
    }
  }
  let bloom = textureSampleLevel(bloomTex, linearSampler, uv, 0.0).rgb;
  color += bloom * view.trackParams.z;
  color *= view.sunColor.w;
  // gentle vignette
  let q = uv - 0.5;
  color *= 1.0 - dot(q, q) * 0.32;
  var ldr = toSrgb(tonemap(color));
  let dither = fract(52.9829189 * fract(dot(in.clip.xy + view.trackParams.w * 7.0, vec2f(0.06711056, 0.00583715)))) - 0.5;
  ldr += dither / 255.0;
  return vec4f(ldr, 1.0);
}
`;
