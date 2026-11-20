// Shared WGSL: per-view uniforms, procedural sky, fog, cascaded shadows and BRDF helpers.

/** Number of floats in the View uniform block (keep in sync with the struct below). */
export const VIEW_UNIFORM_FLOATS = 188;

/** Float offsets of each field inside the View block. */
export const VIEW_OFFSETS = {
  viewProj: 0, prevViewProj: 16, cleanViewProj: 32, invViewProj: 48, shadowMat: 64,
  cameraPos: 112, sunDir: 116, sunColor: 120, zenithColor: 124, horizonColor: 128, groundColor: 132,
  fogColor: 136, ambient: 140, cascadeSplits: 144, viewport: 148, jitter: 152, trackParams: 156,
  kerbColor: 160, grassColor: 164, grassColor2: 168, gravelColor: 172, cameraRight: 176, cameraUp: 180, outputRect: 184,
};

export const VIEW_STRUCT = /* wgsl */ `
struct View {
  viewProj: mat4x4f,        // jittered, used for rasterisation
  prevViewProj: mat4x4f,    // previous frame, unjittered
  cleanViewProj: mat4x4f,   // current frame, unjittered
  invViewProj: mat4x4f,     // inverse of cleanViewProj
  shadowMat: array<mat4x4f, 3>,
  cameraPos: vec4f,         // xyz, w = time (s)
  sunDir: vec4f,            // xyz toward the sun, w = shadow softness (texels)
  sunColor: vec4f,          // rgb radiance, w = exposure
  zenithColor: vec4f,       // rgb, w = cloud coverage
  horizonColor: vec4f,      // rgb, w = cloud scale
  groundColor: vec4f,       // lit ground colour for reflections, w = fog density
  fogColor: vec4f,          // rgb, w = fog height falloff
  ambient: vec4f,           // x sky ambient, y ground ambient, z ao strength, w motion blur strength
  cascadeSplits: vec4f,     // far distance of each cascade, w = 1 / shadow map size
  viewport: vec4f,          // w, h, 1/w, 1/h (render resolution)
  jitter: vec4f,            // current xy and previous xy, in uv units
  trackParams: vec4f,       // x half width, y kerb stripe length, z bloom strength, w frame index
  kerbColor: vec4f,
  grassColor: vec4f,
  grassColor2: vec4f,
  gravelColor: vec4f,
  cameraRight: vec4f,        // xyz, w = near plane distance
  cameraUp: vec4f,           // xyz, w = tan(fovY / 2)
  outputRect: vec4f,         // x, y, w, h of this view on the canvas, in pixels
}
`;

export const COMMON_WGSL = /* wgsl */ `
const PI = 3.14159265;

fn saturate1(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}

fn hash22(p: vec2f) -> vec2f {
  let n = hash21(p);
  return vec2f(n, hash21(p + n * 37.1));
}

fn luminance(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

// ---------------------------------------------------------------------------- sky
fn skyGradient(dir: vec3f) -> vec3f {
  let up = max(dir.y, 0.0);
  let t = pow(1.0 - up, 4.0);
  var col = mix(view.zenithColor.rgb, view.horizonColor.rgb, t);
  let sd = max(dot(dir, view.sunDir.xyz), 0.0);
  let glow = 0.035 * pow(sd, 5.0) + 0.16 * pow(sd, 40.0);
  col += view.sunColor.rgb * glow * (0.35 + 0.65 * t);
  return col;
}

// Returns (density, brightness) of the cloud layer in direction dir.
fn cloudLayer(dir: vec3f, lod: f32) -> vec2f {
  if (dir.y < 0.015 || view.zenithColor.w <= 0.001) { return vec2f(0.0); }
  let scale = view.horizonColor.w;
  let p = dir.xz / (dir.y + 0.16) * scale + vec2f(0.004, 0.0015) * view.cameraPos.w;
  let n1 = textureSampleLevel(noiseTex, noiseSampler, p, lod).r;
  let n2 = textureSampleLevel(noiseTex, noiseSampler, p * 3.1 + vec2f(0.31, 0.17), lod).g;
  let n = n1 * 0.72 + n2 * 0.28;
  let cov = view.zenithColor.w;
  let density = smoothstep(1.0 - cov, 1.0 - cov + 0.3, n) * smoothstep(0.015, 0.12, dir.y);
  // Cheap self shadowing: compare with a sample offset toward the sun.
  let ps = p + view.sunDir.xz * 0.035;
  let ns = textureSampleLevel(noiseTex, noiseSampler, ps, lod + 1.0).r;
  let lit = saturate1(0.62 + (n1 - ns) * 2.6);
  return vec2f(density, lit);
}

fn skyColor(dir: vec3f, lod: f32) -> vec3f {
  var col = skyGradient(dir);
  let c = cloudLayer(dir, lod);
  let sd = max(dot(dir, view.sunDir.xyz), 0.0);
  let cloudBase = mix(view.horizonColor.rgb * 0.75 + view.zenithColor.rgb * 0.25, view.sunColor.rgb * 0.24 + view.horizonColor.rgb * 0.75, c.y);
  let silver = view.sunColor.rgb * 0.22 * pow(sd, 12.0) * (1.0 - c.x * 0.6);
  col = mix(col, cloudBase + silver, c.x * 0.92);
  return col;
}

// Environment lookup for reflections: sky above, lit ground below, blurred by roughness.
fn environment(dir: vec3f, rough: f32) -> vec3f {
  let blur = rough * rough;
  let sky = skyColor(vec3f(dir.x, abs(dir.y) + 0.004, dir.z), 1.0 + rough * 6.0);
  // A dark band of distant scenery just above the horizon gives paint a readable horizon line.
  let band = smoothstep(0.1, 0.0, dir.y) * (1.0 - blur);
  let skyBanded = mix(sky, view.groundColor.rgb * 0.5 + sky * 0.12, band * 0.75);
  let ground = view.groundColor.rgb;
  let h = smoothstep(-0.015 - blur * 0.6, 0.015 + blur * 0.6, dir.y);
  let sharp = mix(ground, skyBanded, h);
  let average = mix(ground, (view.zenithColor.rgb + view.horizonColor.rgb) * 0.5, saturate1(dir.y * 0.5 + 0.5));
  return mix(sharp, average, blur);
}

fn fogFactor(worldPos: vec3f) -> f32 {
  let d = worldPos - view.cameraPos.xyz;
  let dist = length(d);
  let midY = (worldPos.y + view.cameraPos.y) * 0.5;
  let heightTerm = exp(-max(midY, 0.0) * view.fogColor.w);
  return 1.0 - exp(-dist * view.groundColor.w * heightTerm);
}

fn applyFog(color: vec3f, worldPos: vec3f) -> vec3f {
  let dir = normalize(worldPos - view.cameraPos.xyz);
  let f = fogFactor(worldPos);
  let sd = max(dot(dir, view.sunDir.xyz), 0.0);
  let fogCol = view.fogColor.rgb + view.sunColor.rgb * 0.05 * pow(sd, 8.0);
  return mix(color, fogCol, f);
}

// ---------------------------------------------------------------------------- shadows
fn shadowTap(uv: vec2f, layer: i32, depth: f32) -> f32 {
  return textureSampleCompareLevel(shadowTex, shadowSampler, uv, layer, depth);
}

fn cascadeShadow(worldPos: vec3f, normal: vec3f, layer: i32) -> f32 {
  let texel = view.cascadeSplits.w;
  let scale = 1.0 + f32(layer) * 2.2;
  let p = worldPos + normal * (0.035 * scale);
  let sc = view.shadowMat[layer] * vec4f(p, 1.0);
  let uv = vec2f(sc.x * 0.5 + 0.5, 0.5 - sc.y * 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || sc.z > 1.0) { return 1.0; }
  let depth = sc.z - 0.0006 * scale;
  let r = texel * view.sunDir.w;
  var s = 0.0;
  s += shadowTap(uv + vec2f(-r, -r), layer, depth);
  s += shadowTap(uv + vec2f(r, -r), layer, depth);
  s += shadowTap(uv + vec2f(-r, r), layer, depth);
  s += shadowTap(uv + vec2f(r, r), layer, depth);
  s += shadowTap(uv, layer, depth);
  return s * 0.2;
}

fn sunShadow(worldPos: vec3f, normal: vec3f, viewDist: f32) -> f32 {
  let splits = view.cascadeSplits.xyz;
  if (viewDist > splits.z) { return 1.0; }
  var layer = 2;
  var far = splits.z;
  if (viewDist < splits.x) { layer = 0; far = splits.x; }
  else if (viewDist < splits.y) { layer = 1; far = splits.y; }
  var s = cascadeShadow(worldPos, normal, layer);
  let band = far * 0.12;
  let t = saturate1((viewDist - (far - band)) / band);
  if (t > 0.0) {
    var next = 1.0;
    if (layer < 2) { next = cascadeShadow(worldPos, normal, layer + 1); }
    s = mix(s, next, t);
  }
  return s;
}

// ---------------------------------------------------------------------------- BRDF
fn distributionGGX(nh: f32, a: f32) -> f32 {
  let a2 = a * a;
  let d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 1e-5);
}

fn visibilitySmith(nv: f32, nl: f32, a: f32) -> f32 {
  let k = a * 0.5 + 0.0001;
  return 0.25 / ((nv * (1.0 - k) + k) * (nl * (1.0 - k) + k));
}

fn fresnelSchlick(c: f32, f0: vec3f) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - c, 5.0);
}

fn fresnelRough(c: f32, f0: vec3f, rough: f32) -> vec3f {
  return f0 + (max(vec3f(1.0 - rough), f0) - f0) * pow(1.0 - c, 5.0);
}
`;
