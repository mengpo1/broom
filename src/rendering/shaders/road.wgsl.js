// Ground layer: asphalt, markings, kerbs, verges. One full-view triangle; every pixel reads the
// row table produced by projection/road-projection.js and converts its position to track
// coordinates (s along, d across). Everything is drawn as flat tones with inked edges and
// analytic anti-aliasing; fine marks fade with distance (level of detail by distance).

import { COMMON_WGSL } from './common.wgsl.js';

export const ROAD_WGSL = COMMON_WGSL + /* wgsl */`
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var<storage, read> rows: array<vec4f>;
@group(0) @binding(2) var<storage, read> attrs: array<vec4f>;

fn col(i: i32) -> vec3f { return view.colors[i].rgb; }

// Short longitudinal pen strokes: cells of (lane, block) each holding at most one dash.
fn dashField(s: f32, d: f32, laneW: f32, blockL: f32, widthM: f32, density: f32, mpp: f32, mpr: f32, seed: f32) -> vec2f {
  let lane = floor(d / laneW); let block = floor(s / blockL);
  let h = hash22(vec2f(lane + seed, block));
  let h2 = hash22(vec2f(block + seed * 3.7, lane));
  if (h.x > density) { return vec2f(0.0, h2.y); }
  let len = blockL * (0.25 + 0.5 * h.y);
  let start = block * blockL + (blockL - len) * h2.x;
  let centre = (lane + 0.2 + 0.6 * h2.y) * laneW;
  let across = 1.0 - aastep(widthM * 0.5, abs(d - centre), mpp);
  let along = aaband(start, start + len, s, mpr);
  let thin = clamp(widthM / mpp, 0.0, 1.0);
  return vec2f(across * along * thin, h2.y);
}

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let px = pos.xy - view.rect.xy;
  let rowBase = u32(view.flags.y) * 2u;
  let ri = u32(clamp(px.y, 0.0, view.rect.w - 1.0));
  let r0 = rows[rowBase + ri * 2u];
  let r1 = rows[rowBase + ri * 2u + 1u];
  let z = r0.x;
  let haze = col(C_HAZE);
  if (z <= 0.0) {
    if (px.y >= view.proj.z + view.sky.y) { return vec4f(mix(col(C_FAR_GROUND), haze, 0.55), 1.0); }
    discard;
  }
  let mpp = 1.0 / r0.z;            // metres per pixel across the road
  let mpr = max(r1.x, 1e-4);       // metres per pixel row along the road
  let dir = view.proj.w;
  let d = (px.x - r0.y) * mpp * dir;
  let s = r0.w;
  let hw = view.track.z; let kw = view.track.w; let ds = view.track.y; let len = view.track.x;
  let n = u32(view.misc.w);
  let fi = s / ds;
  let i0 = u32(fi) % n; let i1 = (i0 + 1u) % n; let fr = fract(fi);
  let a0 = attrs[i0 * 2u]; let a1 = attrs[i1 * 2u];
  let b0 = attrs[i0 * 2u + 1u]; let b1 = attrs[i1 * 2u + 1u];
  let aa = mix(a0, a1, fr);
  let lineOffset = mix(b0.z, b1.z, fr);
  let right = d > 0.0;
  let ad = abs(d);
  let kerb = select(aa.x, aa.y, right);
  let kwEnd = kw * smoothstep(0.0, 1.0, kerb);        // a kerb narrows to a point at its ends instead of stopping square
  let barrier = select(aa.z, aa.w, right);
  let verge = select(b0.x, b0.y, right);
  var sRel = s; if (sRel > len * 0.5) { sRel = sRel - len; }
  let detail = clamp(1.0 - z / 420.0, 0.0, 1.0) * view.sky.w;
  let inkW = clamp(0.085 / mpp, 0.0, 3.2) * mpp;      // ink line half-width: thinner with distance
  let inkA = clamp(0.085 / mpp, 0.0, 1.0);
  let ink = col(C_INK);
  var c: vec3f;

  let pitSide = view.pitA.x;
  let onPitSide = (d * pitSide) > 0.0;
  let pitZone = verge > 1.5 && onPitSide;

  if (ad <= hw) {
    // ---------------------------------------------------------------- asphalt
    c = col(C_ASPHALT);
    // rubber laid on the racing line: a darker band with a wandering, hand-drawn edge (two scales
    // of wobble, so that it never runs straight like a seam) and a lighter fringe along it
    let wob = (vnoise(vec2f(s * 0.045, 7.0)) - 0.5) * 1.0 + (vnoise(vec2f(s * 0.21, 19.0)) - 0.5) * 0.45;
    let gd = abs(d - lineOffset * 0.9);
    let groove = 1.0 - aastep(1.45 + wob, gd, mpp * 2.0 + 0.05);
    let fringe = 1.0 - aastep(2.0 + wob * 1.6, gd, mpp * 2.0 + 0.05);
    c = mix(c, col(C_GROOVE), fringe * 0.22 + groove * 0.36);
    let patchN = vnoise(vec2f(s * 0.021, d * 0.16 + 11.0));
    c = mix(c, col(C_ASPHALT_LIGHT), aastep(0.66, patchN, 0.02 + mpr * 0.02) * 0.35 * (1.0 - groove));
    let dash = dashField(s, d, 0.9, 13.0, 0.05, 0.5, mpp, mpr, 1.0);
    c = mix(c, select(col(C_GROOVE), col(C_ASPHALT_LIGHT), dash.y > 0.45), dash.x * 0.75 * detail);
    let dash2 = dashField(s + 5.0, d, 1.7, 29.0, 0.09, 0.3, mpp, mpr, 9.0);
    c = mix(c, ink, dash2.x * 0.3 * detail);
    // start line and grid boxes
    let grid = view.flags.x;
    if (grid > 0.0) {
      if (abs(sRel) < 0.6) {
        let chk = (floor(d / 0.6) + floor((sRel + 0.6) / 0.6));
        let m = fract(chk * 0.5) * 2.0;
        c = mix(c, select(vec3f(0.08), col(C_PAINT), m > 0.5), aaband(-0.6, 0.6, sRel, mpr));
      }
      let kf = floor((2.9 - sRel - 8.0) / 8.0 + 0.5);
      if (kf >= 0.0 && kf < grid) {
        let slotS = -(8.0 + 8.0 * kf) + 2.9;
        let side = select(1.0, -1.0, fract(kf * 0.5) < 0.25);
        let ld = abs(d - side * hw * 0.45);
        let ls = sRel - slotS;
        let front = aaband(0.0, 0.22, ls, mpr) * (1.0 - aastep(1.25, ld, mpp));
        let ticks = aaband(-1.5, 0.22, ls, mpr) * aaband(1.08, 1.25, ld, mpp);
        c = mix(c, col(C_PAINT), max(front, ticks) * 0.92);
      }
    }
    // edge paint and ink contour
    c = mix(c, col(C_PAINT), aaband(hw - 0.42, hw - 0.2, ad, mpp) * 0.95);
    c = mix(c, ink, (1.0 - aastep(inkW, hw - ad, mpp)) * inkA * 0.9);
  } else if (kerb > 0.02 && ad <= hw + kwEnd) {
    // ---------------------------------------------------------------- kerb
    let period = 5.0;
    let ph = fract(s / period);
    let w = mpr / period;
    let stripe = aastep(0.5, ph, w) * (1.0 - aastep(1.0, ph, w)) + (1.0 - aastep(0.0, ph, w));
    let fade = clamp(1.0 - (mpr - 1.2) / 2.0, 0.0, 1.0);
    c = mix(mix(col(C_KERB_A), col(C_KERB_B), 0.5), mix(col(C_KERB_A), col(C_KERB_B), stripe), fade);
    let edge = min(abs(ph - 0.5), min(ph, 1.0 - ph)) * period;
    c = mix(c, ink, (1.0 - aastep(inkW * 0.8, edge, mpr)) * inkA * 0.8 * fade);
    c = mix(c, vec3f(1.0), aaband(hw + 0.12, hw + 0.3, ad, mpp) * 0.35);
    c = mix(c, c * 0.72, aastep(hw + kw - 0.4, ad, mpp));
    c = mix(c, ink, (1.0 - aastep(inkW, min(ad - hw, hw + kw - ad), mpp)) * inkA);
  } else if (pitZone && ad < barrier) {
    // ---------------------------------------------------------------- pit lane apron
    c = col(C_PIT);
    let wallD = view.pitA.y; let outerD = view.pitA.z;
    let inWall = sRel > view.pitB.y && sRel < view.pitB.z;
    let dash = dashField(s, d, 1.1, 17.0, 0.05, 0.4, mpp, mpr, 4.0);
    c = mix(c, col(C_GROOVE), dash.x * 0.5 * detail);
    if (inWall) {
      c = mix(c, col(C_PAINT), aaband(wallD + 0.8, wallD + 0.98, ad, mpp) * 0.9);
      c = mix(c, col(C_YELLOW), aaband(outerD - 4.6, outerD - 4.42, ad, mpp) * 0.9);
      let boxPh = fract((sRel + 3.0) / 13.0) * 13.0;
      let boxLine = (1.0 - aastep(0.09, abs(boxPh - 6.5), mpr)) * aastep(outerD - 4.5, ad, mpp);
      c = mix(c, col(C_PAINT), boxLine * 0.8);
    } else {
      c = mix(c, col(C_PAINT), aaband(hw + 0.25, hw + 0.45, ad, mpp) * 0.9);
    }
    c = mix(c, ink, (1.0 - aastep(inkW, ad - hw, mpp)) * inkA * 0.9);
  } else if (ad < barrier) {
    // ---------------------------------------------------------------- verge
    let vEdge = hw + kwEnd;
    let gravel = verge > 0.5 && verge < 1.5 && ad > hw + 3.0;
    if (gravel) {
      c = col(C_GRAVEL_A);
      // raked furrows: thin, wavering, broken lines along the trap
      let rakeRow = floor(d / 1.15 + 0.5);
      let rake = abs(d + (vnoise(vec2f(s * 0.11, rakeRow)) - 0.5) * 0.5 - rakeRow * 1.15);
      let rakeOn = step(0.42, vnoise(vec2f(s * 0.045 + rakeRow * 3.7, rakeRow)));
      c = mix(c, col(C_GRAVEL_B), (1.0 - aastep(0.045, rake, mpp)) * rakeOn * 0.5 * clamp(0.12 / mpp, 0.0, 1.0));
      // grains: round pebbles of several sizes, the larger ones with a spot of shade
      let cell = vec2f(floor(d / 0.55), floor(s / 0.55));
      let h = hash22(cell);
      let pd = vec2f(d - (cell.x + 0.2 + 0.6 * h.x) * 0.55, s - (cell.y + 0.2 + 0.6 * h.y) * 0.55);
      let grain = 0.035 + 0.075 * hash21(cell + vec2f(7.0, 3.0));
      let pebble = (1.0 - aastep(grain, length(pd), max(mpp, mpr * 0.5))) * step(h.x * h.y, 0.42);
      c = mix(c, mix(col(C_GRAVEL_B), ink, 0.22), pebble * 0.75 * detail * clamp(0.1 / mpp, 0.0, 1.0));
      c = mix(c, ink, (1.0 - aastep(inkW, ad - (hw + 3.0), mpp)) * inkA * 0.7);
    } else {
      // mowing stripes run along the track (they converge toward the horizon with the road)
      let warp = (vnoise(vec2f(s * 0.02, 3.0)) - 0.5) * 1.6;
      let band = fract((ad + warp) / 3.6);
      let bw = mpp / 3.6 + 0.004;
      let stripe = aastep(0.5, band, bw) * (1.0 - aastep(1.0, band, bw)) + (1.0 - aastep(0.0, band, bw));
      let bandFade = clamp(1.0 - (mpp - 0.5) / 0.9, 0.0, 1.0);
      c = mix(mix(col(C_GRASS_A), col(C_GRASS_B), 0.5), mix(col(C_GRASS_A), col(C_GRASS_B), stripe), bandFade);
      let blot = vnoise(vec2f(s * 0.028 + 31.0, d * 0.085));
      c = mix(c, col(C_GRASS_DARK), aastep(0.7, blot, 0.015 + mpr * 0.01) * 0.5);
      c = mix(c, col(C_MOWN), (1.0 - aastep(vEdge + 1.3, ad, mpp)) * 0.75);
      let tuft = dashField(s, d, 0.8, 5.0, 0.07, 0.42, mpp, mpr, 21.0);
      c = mix(c, mix(col(C_GRASS_DARK), ink, 0.35), tuft.x * 0.85 * detail);
      c = mix(c, ink, (1.0 - aastep(inkW, ad - vEdge, mpp)) * inkA * 0.85);
    }
    // contact shadow at the foot of the barrier
    c = mix(c, c * 0.62 + ink * 0.1, aaband(barrier - 0.55, barrier + 0.1, ad, mpp) * 0.8);
  } else {
    // ---------------------------------------------------------------- beyond the barriers
    let blot = vnoise(vec2f(s * 0.017 + 5.0, d * 0.03));
    c = mix(col(C_BEYOND_A), col(C_BEYOND_B), aastep(0.52, blot, 0.01 + mpr * 0.008));
    let farDash = dashField(s, d, 2.2, 19.0, 0.12, 0.25, mpp, mpr, 33.0);
    c = mix(c, col(C_GRASS_DARK), farDash.x * 0.5 * detail);
  }

  // crest contour: ink where the next row up belongs to much farther ground
  if (ri > 0u) {
    let zUp = rows[rowBase + (ri - 1u) * 2u].x;
    if (zUp <= 0.0 || zUp > z * 1.18 + 6.0) { c = mix(c, ink, 0.55 * clamp(60.0 / z + 0.25, 0.0, 1.0)); }
  }
  let fog = 1.0 - exp(-z * view.misc.z);
  c = mix(c, haze, fog * 0.9);
  return vec4f(c, 1.0);
}
`;
