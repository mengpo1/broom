// Full-canvas composition of the interface page (menus, result pages, panel frames) over the
// race views, with a comic-panel wipe used for transitions.

export const BLIT_WGSL = /* wgsl */`
struct Blit { params: vec4f, size: vec4f };   // params: alpha, wipe (0..1), wipe mode, time
@group(0) @binding(0) var<uniform> blit: Blit;
@group(0) @binding(1) var pageSampler: sampler;
@group(0) @binding(2) var page: texture_2d<f32>;

struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  var o: VOut;
  let x = f32((vi << 1u) & 2u); let y = f32(vi & 2u);
  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  o.uv = vec2f(x, y);
  return o;
}
@fragment fn fs(i: VOut) -> @location(0) vec4f {
  var c = textureSampleLevel(page, pageSampler, i.uv, 0.0) * blit.params.x;
  let wipe = blit.params.y;
  if (wipe < 1.0) {
    // diagonal panel wipe: three slanted strips opening one after the other
    let strip = floor(i.uv.x * 3.0 + i.uv.y * 0.35);
    let local = (i.uv.y + strip * 0.18 + i.uv.x * 0.25) / 1.8;
    if (local > wipe * 1.25) { discard; }
  }
  if (c.a <= 0.0) { discard; }
  return c;
}
`;
