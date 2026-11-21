// Screen-space finishing drawn over the scene of one view: comic speed lines radiating from the
// vanishing point (periphery only, so the racing line stays readable) and a flash for impacts.

import { COMMON_WGSL } from './common.wgsl.js';

export const OVERLAY_WGSL = COMMON_WGSL + /* wgsl */`
@group(0) @binding(0) var<uniform> view: View;

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let px = pos.xy - view.rect.xy;
  let intensity = view.fx.x;
  let flash = view.fx.w;
  let focus = vec2f(view.fx.y, view.fx.z);
  let h = max(view.rect.w, view.rect.z * 0.42);
  let p = (px - focus) / h;
  let r = length(p * vec2f(0.82, 1.0));
  var outC = vec4f(0.0);
  if (intensity > 0.004) {
    // Long pen strokes that stream away from the vanishing point along the ground on both sides
    // of the road (never across the sky): each one lives for a good part of a second.
    let cells = 96.0;
    let a = (atan2(p.y, p.x) / 6.2831853 + 0.5) * cells;
    let cell = floor(a);
    let f = fract(a) - 0.5;
    let hsh = hash22(vec2f(cell, 17.0));
    let hs2 = hash22(vec2f(cell, 91.0));
    let present = step(hsh.x, 0.2 + 0.45 * intensity);
    let speedK = 0.45 + 0.5 * hs2.x;
    let phase = fract(view.cam.z * speedK * (0.45 + 0.55 * intensity) + hsh.y);
    let start = mix(0.3, 1.0, phase);
    let len = 0.2 + 0.3 * hs2.y + 0.25 * intensity;
    let along = (r - start) / len;
    let taper = clamp(along * 1.5, 0.0, 1.0) * clamp((1.0 - along) * 2.5, 0.0, 1.0);
    let halfW = (0.05 + 0.17 * hs2.y) * taper;
    let aw = cells * 0.16 / max(r * h, 1.0);         // one pixel in cell units
    let line = (1.0 - aastep(halfW, abs(f), aw)) * step(0.0, along) * step(along, 1.0);
    let life = smoothstep(0.0, 0.12, phase) * (1.0 - smoothstep(0.82, 1.0, phase));
    let ground = smoothstep(0.015, 0.07, p.y);       // below the horizon only
    let periphery = smoothstep(0.34, 0.58, r) * (0.3 + 0.7 * smoothstep(0.05, 0.3, abs(p.x))) * ground;
    let alpha = line * present * periphery * life * clamp(intensity * 1.6, 0.0, 1.0);
    let lightLine = hs2.x > 0.38;
    let rgb = select(view.colors[C_SPEED_DARK].rgb, view.colors[C_SPEED_LIGHT].rgb, lightLine);
    let al = alpha * select(0.5, 0.82, lightLine);
    outC = vec4f(rgb * al, al);
  }
  if (flash > 0.004) {
    let fa = clamp(flash, 0.0, 1.0) * 0.55;
    outC = vec4f(outC.rgb * (1.0 - fa) + vec3f(1.0, 0.98, 0.9) * fa, outC.a * (1.0 - fa) + fa);
  }
  if (outC.a <= 0.0) { discard; }
  return outC;
}
`;
