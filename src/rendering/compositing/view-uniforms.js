// CPU-side image of the per-view uniform block (see shaders/common.wgsl.js `View`).

import { COLOR_SLOTS, COLOR_SLOT_COUNT } from '../shaders/common.wgsl.js';

export const VIEW_UNIFORM_FLOATS = 40 + COLOR_SLOT_COUNT * 4;
export const U = { rect: 0, proj: 4, cam: 8, track: 12, misc: 16, pitA: 20, pitB: 24, fx: 28, sky: 32, flags: 36, colors: 40 };

export function createViewUniforms() { return new Float32Array(VIEW_UNIFORM_FLOATS); }

export function set4(data, offset, a, b, c, d) {
  data[offset] = a; data[offset + 1] = b; data[offset + 2] = c; data[offset + 3] = d;
}

/** Copy a palette ({ slotName: [r,g,b] in 0..1 }) into the colour slots. */
export function setColors(data, palette) {
  for (const name in COLOR_SLOTS) {
    const c = palette[name];
    if (!c) continue;
    const o = U.colors + COLOR_SLOTS[name] * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 1;
  }
}
