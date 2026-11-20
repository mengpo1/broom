// Forward shader for every opaque mesh (world, props, cars). One module, material chosen per
// vertex. Writes HDR colour and screen-space velocity. A second module renders shadow depth.

import { VIEW_STRUCT, COMMON_WGSL } from './common.wgsl.js';
import { MATERIAL_WGSL } from '../materials.js';

const VERTEX_INPUT = /* wgsl */ `
struct VIn {
  @location(0) position: vec3f,
  @location(1) normal: vec4f,
  @location(2) uv: vec2f,
  @location(3) color: vec4f,
  @location(4) m0: vec4f,
  @location(5) m1: vec4f,
  @location(6) m2: vec4f,
  @location(7) p0: vec4f,
  @location(8) p1: vec4f,
  @location(9) p2: vec4f,
  @location(10) c0: vec4f,
  @location(11) c1: vec4f,
  @location(12) c2: vec4f,
  @location(13) params: vec4f,
}
`;

export const MESH_WGSL = /* wgsl */ `
diagnostic(off, derivative_uniformity);
${VIEW_STRUCT}
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var noiseTex: texture_2d<f32>;
@group(0) @binding(2) var noiseSampler: sampler;
@group(0) @binding(3) var atlasTex: texture_2d<f32>;
@group(0) @binding(4) var shadowTex: texture_depth_2d_array;
@group(0) @binding(5) var shadowSampler: sampler_comparison;
${COMMON_WGSL}
${MATERIAL_WGSL}
${VERTEX_INPUT}

struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) color: vec3f,
  @location(4) @interpolate(flat) mat: u32,
  @location(5) curClip: vec4f,
  @location(6) prevClip: vec4f,
  @location(7) localPos: vec3f,
  @location(8) @interpolate(flat) c0: vec4f,
  @location(9) @interpolate(flat) c1: vec4f,
  @location(10) @interpolate(flat) c2: vec4f,
  @location(11) @interpolate(flat) params: vec4f,
  @location(12) ao: f32,
}

struct FOut {
  @location(0) color: vec4f,
  @location(1) velocity: vec4f,
}

@vertex
fn vs_main(in: VIn) -> VOut {
  var out: VOut;
  let p = vec4f(in.position, 1.0);
  let world = vec3f(dot(in.m0, p), dot(in.m1, p), dot(in.m2, p));
  let prevWorld = vec3f(dot(in.p0, p), dot(in.p1, p), dot(in.p2, p));
  let n = in.normal.xyz;
  out.worldPos = world;
  out.normal = vec3f(dot(in.m0.xyz, n), dot(in.m1.xyz, n), dot(in.m2.xyz, n));
  out.uv = in.uv;
  out.color = in.color.rgb;
  out.mat = u32(in.color.a * 255.0 + 0.5);
  out.clip = view.viewProj * vec4f(world, 1.0);
  out.curClip = view.cleanViewProj * vec4f(world, 1.0);
  out.prevClip = view.prevViewProj * vec4f(prevWorld, 1.0);
  out.localPos = in.position;
  out.c0 = in.c0; out.c1 = in.c1; out.c2 = in.c2; out.params = in.params;
  out.ao = in.normal.w * 0.5 + 0.5;
  return out;
}

struct Surface {
  albedo: vec3f,
  rough: f32,
  metal: f32,
  f0: f32,
  coat: f32,
  trans: f32,
  emissive: vec3f,
  normal: vec3f,
}

fn noiseAt(uv: vec2f) -> vec4f { return textureSample(noiseTex, noiseSampler, uv); }

// Smooth step with a pixel wide transition (antialiased edge).
fn aaStep(edge: f32, x: f32) -> f32 {
  let w = max(fwidth(x), 1e-5);
  return saturate1((x - edge) / w + 0.5);
}

fn liveryColor(pos: vec3f, zone: f32, pattern: f32, c0: vec3f, c1: vec3f, c2: vec3f) -> vec3f {
  // zone: 0 body, 1 front wing, 2 rear wing, 3 engine cover, 4 sidepod
  var col = c0;
  let z = pos.z; let y = pos.y; let x = abs(pos.x);
  if (pattern < 0.5) {
    // nose band + sidepod flash
    col = mix(col, c1, aaStep(-1.55, -z) * (1.0 - aaStep(-1.2, -z)));
    if (zone > 3.5) { col = mix(col, c1, aaStep(0.3, y) * (1.0 - aaStep(0.42, y))); }
    if (zone > 0.5 && zone < 2.5) { col = c2; }
  } else if (pattern < 1.5) {
    // two tone: lower body secondary with pinstripe
    col = mix(c1, c0, aaStep(0.36, y - z * 0.02));
    let stripe = aaStep(0.34, y - z * 0.02) * (1.0 - aaStep(0.38, y - z * 0.02));
    col = mix(col, c2, stripe);
    if (zone > 0.5 && zone < 2.5) { col = c0; }
  } else if (pattern < 2.5) {
    // diagonal sweep toward the rear
    let d = z * 0.55 + y * 1.4;
    col = mix(c0, c1, aaStep(0.55, d));
    col = mix(col, c2, aaStep(0.5, d) * (1.0 - aaStep(0.6, d)));
    if (zone > 1.5 && zone < 2.5) { col = c1; }
  } else if (pattern < 3.5) {
    // centre stripe
    col = mix(c1, c0, aaStep(0.11, x));
    if (zone > 3.5) { col = mix(c0, c2, aaStep(0.44, y)); }
    if (zone > 0.5 && zone < 1.5) { col = c1; }
  } else {
    // front / rear split with accent ring
    col = mix(c0, c1, aaStep(0.45, z));
    col = mix(col, c2, aaStep(0.38, z) * (1.0 - aaStep(0.52, z)));
    if (zone > 1.5 && zone < 2.5) { col = c2; }
  }
  return col;
}

fn digitMask(uv: vec2f, digit: f32) -> f32 {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return 0.0; }
  let cell = vec2f((digit + uv.x) * 0.09375, uv.y * 0.125);
  return textureSampleLevel(atlasTex, noiseSampler, cell, 0.0).r;
}

fn evaluateMaterial(in: VOut, viewDist: f32) -> Surface {
  var s: Surface;
  s.albedo = in.color;
  s.rough = 0.6; s.metal = 0.0; s.f0 = 0.04; s.coat = 0.0; s.trans = 0.0;
  s.emissive = vec3f(0.0);
  s.normal = normalize(in.normal);
  let wp = in.worldPos.xz;
  let near = exp(-viewDist / 70.0);
  switch (in.mat) {
    case MAT_ASPHALT, MAT_PIT_ASPHALT: {
      let grain = noiseAt(in.uv * 0.83).b;
      let fine = noiseAt(in.uv * 3.7 + vec2f(0.37, 0.11)).b;
      let blotch = noiseAt(in.uv * 0.031).r;
      let blotch2 = noiseAt(in.uv * vec2f(0.21, 0.009)).a;
      let streak = noiseAt(in.uv * vec2f(0.6, 0.013)).g;
      let detail = mix(0.5, grain * 0.55 + fine * 0.45, near * 0.75 + 0.25);
      var a = 0.05 * (0.8 + 0.4 * detail) * (0.8 + 0.4 * blotch) * (0.9 + 0.2 * blotch2);
      // resurfaced patches: darker, smoother rectangles of newer tarmac
      let patchCell = floor(vec2f(in.uv.x / 4.4 + 0.5, in.uv.y / 46.0));
      let patchOn = step(0.8, hash21(patchCell)) * aaStep(0.04, 0.5 - abs(fract(in.uv.x / 4.4 + 0.5) - 0.5)) * aaStep(0.004, 0.5 - abs(fract(in.uv.y / 46.0) - 0.5));
      a *= 1.0 - 0.22 * patchOn;
      var rough = 0.86 - detail * 0.06 - 0.05 * patchOn;
      if (in.mat == MAT_PIT_ASPHALT) {
        a *= 1.5;
        a *= 1.0 - 0.3 * smoothstep(0.62, 0.8, noiseAt(wp * 0.05).a);
        s.albedo = vec3f(a, a, a * 1.02);
        s.rough = rough;
        break;
      }
      // rubbered racing line, dusty marbles off line
      let rubber = saturate1(in.color.r * (0.5 + 0.95 * streak));
      a = mix(a * 1.1, a * 0.4, rubber);
      rough = mix(rough, 0.62, rubber);
      // longitudinal tar seam near the centre
      let seam = 1.0 - aaStep(0.035, abs(in.uv.x + 0.4 + 0.25 * (blotch2 - 0.5)));
      a *= 1.0 - 0.3 * seam * step(0.35, blotch);
      // painted edge lines
      let hw = view.trackParams.x;
      let e = abs(in.uv.x);
      let line = aaStep(hw - 0.42, e) * (1.0 - aaStep(hw - 0.14, e)) * in.color.g;
      let wear = 0.72 + 0.28 * smoothstep(0.25, 0.6, grain);
      s.albedo = mix(vec3f(a, a, a * 1.03), vec3f(0.58, 0.58, 0.56) * wear, line);
      s.rough = mix(rough, 0.6, line);
      // micro relief from the aggregate
      let bump = (vec2f(grain, fine) - 0.5) * 0.16 * near;
      s.normal = normalize(s.normal + vec3f(bump.x, 0.0, bump.y));
    }
    case MAT_KERB: {
      let len = view.trackParams.y;
      let t = in.uv.y / len;
      let w = fwidth(t);
      let tri = abs(fract(t) - 0.5);
      let stripe = mix(saturate1((tri - 0.25) / max(w, 1e-5) + 0.5), 0.5, saturate1(w * 1.5 - 0.3));
      let dirt = noiseAt(in.uv * vec2f(0.8, 0.12)).g;
      s.albedo = mix(vec3f(0.78, 0.78, 0.76), view.kerbColor.rgb, stripe) * (0.72 + 0.4 * dirt);
      s.rough = 0.55;
    }
    case MAT_VERGE, MAT_GRAVEL: {
      let n1 = noiseAt(wp * 0.093).g;
      let n2 = noiseAt(wp * 0.0087).r;
      let n3 = noiseAt(wp * 1.21).b;
      let n4 = noiseAt(wp * 0.33).a;
      var grass = mix(view.grassColor.rgb, view.grassColor2.rgb, saturate1(n2 * 1.5 - 0.25 + (n1 - 0.5) * 0.6));
      grass *= 0.72 + 0.56 * mix(0.5, n3 * 0.55 + n4 * 0.45, near);
      grass *= 0.86 + 0.28 * noiseAt(wp * 0.027).a;
      let mow = sin(in.uv.x * 1.15);
      grass *= 1.0 + 0.09 * in.color.b * clamp(mow * 3.0, -1.0, 1.0);
      // worn, dusty strip along the edge of the asphalt
      let edgeDist = abs(in.uv.x) - view.trackParams.x;
      let dirt = (1.0 - smoothstep(0.1, 1.5, edgeDist + (n1 - 0.5) * 0.9)) * in.color.b * step(0.0, edgeDist + 0.3);
      grass = mix(grass, view.gravelColor.rgb * 0.5 * (0.7 + 0.5 * n3), dirt * 0.75);
      let gravel = view.gravelColor.rgb * (0.7 + 0.6 * mix(0.5, n3, near)) * (0.9 + 0.2 * n1);
      var g = in.color.r;
      if (in.mat == MAT_GRAVEL) { g = 1.0; }
      let k = smoothstep(0.35, 0.65, g + (n1 - 0.5) * 0.35);
      s.albedo = mix(grass, gravel, k);
      s.rough = 0.92;
      s.trans = 0.25 * (1.0 - k);
    }
    case MAT_TERRAIN: {
      let n1 = noiseAt(wp * 0.031).g;
      let n2 = noiseAt(wp * 0.0043).r;
      let n3 = noiseAt(wp * 0.37).b;
      s.albedo = in.color * (0.74 + 0.36 * n2 + 0.2 * (n1 - 0.5)) * (0.85 + 0.3 * mix(0.5, n3, near));
      s.rough = 0.93;
    }
    case MAT_CONCRETE: {
      let n1 = noiseAt(in.uv * 0.07).r;
      let n2 = noiseAt(in.uv * 0.9).b;
      let streak = noiseAt(vec2f(in.uv.x * 0.35, in.uv.y * 0.04)).g;
      let joint = 1.0 - 0.28 * (1.0 - aaStep(0.012, abs(fract(in.uv.x / 4.0) - 0.5)));
      s.albedo = in.color * in.c0.rgb * (0.78 + 0.3 * n1) * (0.9 + 0.2 * n2) * (0.82 + 0.25 * streak) * joint;
      s.rough = 0.86;
    }
    case MAT_ARMCO: {
      let prof = cos(in.uv.y * 12.566);
      let up = vec3f(0.0, 1.0, 0.0);
      s.normal = normalize(s.normal + up * prof * 0.55);
      let n1 = noiseAt(in.uv * vec2f(0.15, 0.6)).g;
      s.albedo = vec3f(0.42, 0.44, 0.46) * (0.7 + 0.45 * n1) * (0.82 + 0.18 * step(0.02, abs(fract(in.uv.x / 3.8) - 0.5) - 0.0));
      s.metal = 0.55; s.rough = 0.5 + 0.2 * n1;
    }
    case MAT_PAINT, MAT_ROOF: {
      let n1 = noiseAt(in.uv * 0.3 + wp * 0.05).g;
      s.albedo = in.color * in.c0.rgb * (0.88 + 0.2 * n1);
      s.rough = 0.5;
      if (in.mat == MAT_ROOF) { s.rough = 0.62; }
    }
    case MAT_FOLIAGE: {
      let n1 = noiseAt(wp * 0.21 + in.worldPos.yy * 0.17).g;
      let q = in.worldPos.xy * 0.83 + in.worldPos.zz * vec2f(0.61, 0.47);
      let n2 = noiseAt(q).b;
      let n3 = noiseAt(q * 0.31 + vec2f(0.5, 0.2)).g;
      // leaves: cut irregular holes near the silhouette so crowns do not read as smooth blobs
      let facing = abs(dot(s.normal, normalize(view.cameraPos.xyz - in.worldPos)));
      let leafFade = saturate1(1.3 - viewDist / 260.0);
      if (n2 * 0.6 + n3 * 0.4 < (0.56 - facing * 0.75) * leafFade) { discard; }
      let clump = smoothstep(0.3, 0.7, n3);
      s.albedo = in.color * in.c0.rgb * (0.5 + 0.6 * n1) * (0.6 + 0.6 * mix(0.5, clump * 0.6 + n2 * 0.4, near * 0.6 + 0.4));
      s.normal = normalize(s.normal + (vec3f(n2, n3, n1) - 0.5) * 0.9);
      s.rough = 0.72; s.trans = 0.7;
    }
    case MAT_BARK: {
      let n1 = noiseAt(vec2f(in.uv.x * 2.0, in.uv.y * 0.3)).g;
      s.albedo = in.color * (0.7 + 0.5 * n1);
      s.rough = 0.9;
    }
    case MAT_ROCK: {
      let n1 = noiseAt(in.worldPos.xz * 0.12 + in.worldPos.yy * 0.2).r;
      let n2 = noiseAt(in.worldPos.xy * 0.7 + in.worldPos.zz * 0.5).b;
      s.albedo = in.color * in.c0.rgb * (0.65 + 0.5 * n1) * (0.85 + 0.3 * n2);
      s.rough = 0.88;
    }
    case MAT_CROWD: {
      let g = vec2f(in.uv.x * 2.1, in.uv.y);
      let cell = floor(g);
      let f = fract(g);
      let h = hash21(cell);
      let h2 = hash21(cell + 17.3);
      let occupied = step(0.2, h);
      var shirt = 0.5 + 0.5 * cos(6.2831 * (h2 + vec3f(0.0, 0.33, 0.67)));
      shirt = mix(shirt, vec3f(luminance(shirt)), 0.45) * (0.5 + 0.7 * h);
      let body = 1.0 - smoothstep(0.3, 0.42, length((f - vec2f(0.5, 0.36)) * vec2f(1.0, 1.25)));
      let head = 1.0 - smoothstep(0.11, 0.17, length(f - vec2f(0.5, 0.8)));
      var col = in.color;
      col = mix(col, shirt, body * occupied);
      col = mix(col, vec3f(0.62, 0.45, 0.34) * (0.6 + 0.6 * h2), head * occupied);
      let avg = mix(in.color, vec3f(0.34, 0.31, 0.3), 0.55);
      s.albedo = mix(col, avg, saturate1(fwidth(g.x) * 1.6 - 0.25));
      s.rough = 0.85;
    }
    case MAT_FACADE: {
      let bay = vec2f(3.2, 3.0);
      let g = in.uv / bay;
      let f = fract(g);
      let cell = floor(g);
      let wx = aaStep(0.14, f.x) * (1.0 - aaStep(0.86, f.x));
      let wy = aaStep(0.28, f.y) * (1.0 - aaStep(0.8, f.y));
      let fade = saturate1(fwidth(g.x) * 2.0 - 0.3);
      let win = mix(wx * wy, 0.4, fade);
      let tint = 0.6 + 0.4 * hash21(cell);
      let wall = in.color * in.c0.rgb * (0.85 + 0.25 * noiseAt(in.uv * 0.11).r);
      s.albedo = mix(wall, vec3f(0.02, 0.03, 0.04) * tint, win);
      s.rough = mix(0.8, 0.07, win);
      s.f0 = mix(0.04, 0.08, win);
    }
    case MAT_TYRE_WALL: {
      let col = in.uv.x / 0.62;
      let row = in.uv.y * 4.0;
      let cyl = 0.35 + 0.65 * abs(sin(col * PI));
      let seam = 0.55 + 0.45 * smoothstep(0.0, 0.3, 1.0 - abs(fract(row) - 0.5) * 2.0);
      let fade = saturate1(fwidth(col) * 1.4 - 0.2);
      let shade = mix(cyl * seam, 0.6, fade);
      let block = step(0.5, fract(in.uv.x / 7.44));
      let painted = step(2.0, row) * step(row, 3.0);
      let base = mix(vec3f(0.035), mix(vec3f(0.6, 0.6, 0.58), view.kerbColor.rgb, block), painted * 0.85);
      s.albedo = base * shade;
      s.rough = 0.88;
    }
    case MAT_ATLAS: {
      let row = floor(in.c0.w * 0.5 + 0.01);
      let colIdx = in.c0.w - row * 2.0;
      var auv = in.uv;
      if (in.uv.y >= 0.125 && in.uv.y < 0.625) { auv += vec2f(colIdx * 0.5, row * 0.125); }
      let t = textureSample(atlasTex, noiseSampler, auv);
      s.albedo = t.rgb * (0.9 + 0.15 * noiseAt(in.uv * 3.0).g);
      s.rough = 0.45;
    }
    case MAT_FENCE: {
      s.albedo = in.color;
      s.rough = 0.5; s.metal = 0.6;
    }
    case MAT_EMISSIVE: {
      s.albedo = vec3f(0.0);
      s.emissive = in.color * 6.0;
    }
    case MAT_WATER: {
      let t = view.cameraPos.w;
      let n1 = noiseAt(wp * 0.021 + vec2f(t * 0.006, t * 0.004)).rg - 0.5;
      let n2 = noiseAt(wp * 0.083 - vec2f(t * 0.011, -t * 0.008)).ga - 0.5;
      let amp = 0.2 * near + 0.05;
      s.normal = normalize(vec3f((n1.x + n2.x) * amp, 1.0, (n1.y + n2.y) * amp));
      s.albedo = in.color * 0.35;
      s.rough = 0.08; s.f0 = 0.03;
    }
    case MAT_CAR_PAINT: {
      let zone = floor(in.color.r * 255.0 / 16.0 + 0.5);
      let col = liveryColor(in.localPos, zone, in.params.z, in.c0.rgb, in.c1.rgb, in.c2.rgb);
      let flake = noiseAt(in.localPos.xz * 9.0 + in.localPos.yy * 7.0).b;
      s.albedo = col * col * (0.9 + 0.14 * flake) * 0.85;
      s.rough = 0.5; s.metal = 0.0; s.coat = 1.0;
    }
    case MAT_CARBON: {
      let w = in.uv * 190.0;
      let weave = step(0.5, fract(w.x)) * step(0.5, fract(w.y)) + (1.0 - step(0.5, fract(w.x))) * (1.0 - step(0.5, fract(w.y)));
      let fade = saturate1(fwidth(w.x) * 1.5);
      s.albedo = vec3f(0.016 + 0.007 * mix(weave, 0.5, fade)) + in.color * 0.02;
      s.rough = 0.42; s.coat = 0.3;
    }
    case MAT_RUBBER: {
      // uv.x: angle around the wheel (0..1), uv.y: 0 tread .. 1 sidewall
      let side = smoothstep(0.55, 0.65, in.uv.y);
      let ring = side * (1.0 - smoothstep(0.03, 0.05, abs(in.uv.y - 0.82)));
      let blur = in.params.y;
      let letters = step(0.55, noiseAt(vec2f(in.uv.x * 6.0, 0.37)).g) * ring * (1.0 - blur);
      s.albedo = vec3f(0.03) + vec3f(0.02) * side + vec3f(0.3, 0.3, 0.28) * mix(letters, ring * 0.35, blur);
      s.rough = mix(0.62, 0.78, side);
    }
    case MAT_METAL: {
      s.albedo = in.color; s.metal = 1.0; s.rough = 0.3;
    }
    case MAT_HELMET: {
      let hc = vec3f(in.c0.w, in.c1.w, in.c2.w);
      let band = aaStep(0.02, in.localPos.y - 0.86) * (1.0 - aaStep(0.07, in.localPos.y - 0.86));
      let top = aaStep(0.045, abs(in.localPos.x));
      s.albedo = mix(mix(in.c2.rgb * in.c2.rgb, hc * hc, top), vec3f(0.8), band) * 0.9;
      s.rough = 0.35; s.coat = 1.0;
    }
    case MAT_VISOR: {
      s.albedo = vec3f(0.55, 0.42, 0.25); s.metal = 1.0; s.rough = 0.06;
    }
    case MAT_RIM: {
      // uv: centred coordinates in -1..1 on the wheel face
      let r = length(in.uv);
      let a = atan2(in.uv.y, in.uv.x);
      let blur = in.params.y;
      let spokes = smoothstep(0.25, 0.6, abs(sin(a * 4.0))) ;
      let pattern = mix(spokes, 0.55, blur);
      let hub = 1.0 - smoothstep(0.2, 0.26, r);
      let rimEdge = smoothstep(0.84, 0.9, r);
      let face = mix(0.035, 1.0, max(pattern, max(hub, rimEdge)));
      s.albedo = in.color * face;
      s.metal = 0.55 * face; s.rough = 0.38;
    }
    case MAT_NUMBER: {
      let zone = floor(in.color.r * 255.0 / 16.0 + 0.5);
      let paint = liveryColor(in.localPos, zone, in.params.z, in.c0.rgb, in.c1.rgb, in.c2.rgb);
      let d = length(in.uv - 0.5);
      let disc = 1.0 - aaStep(0.47, d);
      let num = in.params.x;
      let tens = floor(num / 10.0 + 0.001);
      let units = num - tens * 10.0;
      var mask = 0.0;
      let q = vec2f(in.uv.x, in.uv.y);
      if (tens > 0.5) {
        mask = digitMask(vec2f((q.x - 0.17) / 0.33, (q.y - 0.24) / 0.52), tens)
             + digitMask(vec2f((q.x - 0.5) / 0.33, (q.y - 0.24) / 0.52), units);
      } else {
        mask = digitMask(vec2f((q.x - 0.31) / 0.38, (q.y - 0.22) / 0.56), units);
      }
      let plate = mix(vec3f(0.92), vec3f(0.03), saturate1(mask));
      s.albedo = mix(paint * paint * 0.85, plate, disc);
      s.rough = 0.5; s.coat = 1.0;
    }
    case MAT_REV_LIGHTS: {
      let rpm = in.params.y;
      let idx = floor(in.uv.x * 10.0);
      let lit = step(idx / 10.0 + 0.05, rpm);
      let gap = aaStep(0.15, fract(in.uv.x * 10.0)) * (1.0 - aaStep(0.85, fract(in.uv.x * 10.0)));
      var c = vec3f(0.1, 1.0, 0.2);
      if (idx > 3.5) { c = vec3f(1.0, 0.75, 0.05); }
      if (idx > 6.5) { c = vec3f(1.0, 0.08, 0.05); }
      s.albedo = vec3f(0.01);
      s.emissive = c * lit * gap * 2.5;
      s.rough = 0.3;
    }
    case MAT_FABRIC: {
      s.albedo = in.color * (0.85 + 0.3 * noiseAt(in.uv * 6.0).b);
      s.rough = 0.95;
    }
    case MAT_COCKPIT: {
      s.albedo = in.color * 0.6; s.rough = 0.7;
    }
    case MAT_MIRROR: {
      s.albedo = vec3f(0.9); s.metal = 1.0; s.rough = 0.03;
    }
    default: {}
  }
  return s;
}

@fragment
fn fs_main(in: VOut) -> FOut {
  var out: FOut;
  let toCam = view.cameraPos.xyz - in.worldPos;
  let viewDist = length(toCam);
  let V = toCam / viewDist;
  // Ghost cars (just repositioned) are rendered half transparent through a stable checker + TAA.
  if (in.params.w > 0.5 && in.mat >= MAT_CAR_PAINT && in.mat <= MAT_MIRROR) {
    let c = floor(in.clip.xy);
    if (fract((c.x + c.y + view.trackParams.w) * 0.5) < 0.25) { discard; }
  }
  let s = evaluateMaterial(in, viewDist);
  let Ng = normalize(in.normal);
  let N = s.normal;
  let L = view.sunDir.xyz;
  let nl = dot(N, L);
  let nlc = saturate1(nl);
  let nv = max(dot(N, V), 0.001);
  var shadow = 1.0;
  if (nl > -0.4 || s.trans > 0.0) { shadow = sunShadow(in.worldPos, Ng, viewDist); }
  let H = normalize(L + V);
  let nh = saturate1(dot(N, H));
  let vh = saturate1(dot(V, H));
  let f0 = mix(vec3f(s.f0), s.albedo, s.metal);
  let diffuseColor = s.albedo * (1.0 - s.metal);
  let a = max(s.rough * s.rough, 0.003);
  let F = fresnelSchlick(vh, f0);
  let spec = F * (distributionGGX(nh, a) * visibilitySmith(nv, nlc, a));
  let sun = view.sunColor.rgb;
  var color = (diffuseColor / PI + spec) * sun * (nlc * shadow);
  if (s.trans > 0.0) {
    // wrap lighting / light leaking through thin vegetation
    let wrap = saturate1((nl + 0.6) / 1.6) - nlc;
    color += diffuseColor / PI * sun * (wrap * s.trans * (0.35 + 0.65 * shadow));
  }
  let skyAmbient = (view.zenithColor.rgb * 0.62 + view.horizonColor.rgb * 0.38) * view.ambient.x;
  let groundAmbient = view.groundColor.rgb * view.ambient.y;
  let hemi = mix(groundAmbient, skyAmbient, N.y * 0.5 + 0.5);
  color += diffuseColor * hemi * in.ao;
  let envWeight = max(1.0 - smoothstep(0.6, 0.8, s.rough), saturate1(s.metal * 4.0)) * (1.0 - s.coat);
  if (envWeight > 0.001) {
    let R = reflect(-V, N);
    let horizon = saturate1(1.0 + dot(R, Ng) * 2.0);
    let env = environment(R, s.rough);
    color += env * fresnelRough(nv, f0, s.rough) * (in.ao * horizon * mix(0.45, 1.0, shadow) * envWeight);
  }
  if (s.coat > 0.0) {
    let Fc = (0.04 + 0.96 * pow(1.0 - nv, 5.0)) * s.coat;
    let R = reflect(-V, Ng);
    let coatSun = distributionGGX(saturate1(dot(Ng, H)), 0.0025) * visibilitySmith(nv, saturate1(dot(Ng, L)), 0.0025) * saturate1(dot(Ng, L)) * shadow;
    let coatLight = environment(R, 0.02) * mix(0.5, 1.0, shadow) * in.ao + sun * min(coatSun, 60.0);
    color = color * (1.0 - Fc) + coatLight * Fc;
  }
  color += s.emissive;
  color = applyFog(color, in.worldPos);
  out.color = vec4f(color, 1.0);
  let cur = in.curClip.xy / in.curClip.w;
  let prev = in.prevClip.xy / in.prevClip.w;
  out.velocity = vec4f((cur - prev) * vec2f(0.5, -0.5), 0.0, 1.0);
  return out;
}
`;

export const SHADOW_WGSL = /* wgsl */ `
struct ShadowPass { lightViewProj: mat4x4f }
@group(0) @binding(0) var<uniform> shadowPass: ShadowPass;

struct SIn {
  @location(0) position: vec3f,
  @location(4) m0: vec4f,
  @location(5) m1: vec4f,
  @location(6) m2: vec4f,
}

@vertex
fn vs_shadow(in: SIn) -> @builtin(position) vec4f {
  let p = vec4f(in.position, 1.0);
  let world = vec3f(dot(in.m0, p), dot(in.m1, p), dot(in.m2, p));
  return shadowPass.lightViewProj * vec4f(world, 1.0);
}
`;
