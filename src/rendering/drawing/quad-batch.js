// Allocation-free writer for textured quads. One quad = 4 vertices of 12 floats:
//   position x, y (view pixels), perspective weight w, depth for crest clipping (0 = never hidden)
//   u, v, atlas layer, mode * 64 + palette row
//   tint r, g, b, a (multiplies the premultiplied texel)
// Corner order: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right.

export const QUAD_FLOATS = 48;
export const QUAD_MODE = { SPRITE: 0, CAR: 64, FLAT: 128 };

export class QuadBatch {
  constructor(maxQuads) {
    this.max = maxQuads;
    this.data = new Float32Array(maxQuads * QUAD_FLOATS);
    this.count = 0;
    this.dropped = 0;
  }

  reset() { this.count = 0; this.dropped = 0; }

  quad(x0, y0, w0, x1, y1, w1, x2, y2, w2, x3, y3, w3, u0, v0, u1, v1, layer, mode, r, g, b, a, zTest) {
    if (this.count >= this.max) { this.dropped++; return; }
    const d = this.data;
    let o = this.count * QUAD_FLOATS;
    this.count++;
    d[o] = x0; d[o + 1] = y0; d[o + 2] = w0; d[o + 3] = zTest; d[o + 4] = u0; d[o + 5] = v0; d[o + 6] = layer; d[o + 7] = mode;
    d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = a; o += 12;
    d[o] = x1; d[o + 1] = y1; d[o + 2] = w1; d[o + 3] = zTest; d[o + 4] = u1; d[o + 5] = v0; d[o + 6] = layer; d[o + 7] = mode;
    d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = a; o += 12;
    d[o] = x2; d[o + 1] = y2; d[o + 2] = w2; d[o + 3] = zTest; d[o + 4] = u0; d[o + 5] = v1; d[o + 6] = layer; d[o + 7] = mode;
    d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = a; o += 12;
    d[o] = x3; d[o + 1] = y3; d[o + 2] = w3; d[o + 3] = zTest; d[o + 4] = u1; d[o + 5] = v1; d[o + 6] = layer; d[o + 7] = mode;
    d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = a;
  }

  /** Axis-aligned sprite; (x, y) is the top-left corner. `flip` mirrors horizontally. */
  sprite(sp, x, y, w, h, r, g, b, a, zTest, flip) {
    const u0 = flip ? sp.u1 : sp.u0, u1 = flip ? sp.u0 : sp.u1;
    this.quad(x, y, 1, x + w, y, 1, x, y + h, 1, x + w, y + h, 1, u0, sp.v0, u1, sp.v1, sp.layer, QUAD_MODE.SPRITE, r, g, b, a, zTest);
  }

  /** Sprite rotated by `angle` (radians, clockwise on screen) around the point (cx, cy); (px, py) is the pivot inside the sprite in 0..1. */
  rotated(sp, cx, cy, w, h, angle, px, py, r, g, b, a) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const lx = -px * w, rx = (1 - px) * w, ty = -py * h, by = (1 - py) * h;
    this.quad(
      cx + lx * c - ty * s, cy + lx * s + ty * c, 1, cx + rx * c - ty * s, cy + rx * s + ty * c, 1,
      cx + lx * c - by * s, cy + lx * s + by * c, 1, cx + rx * c - by * s, cy + rx * s + by * c, 1,
      sp.u0, sp.v0, sp.u1, sp.v1, sp.layer, QUAD_MODE.SPRITE, r, g, b, a, 0);
  }

  /** Flat-colour rectangle. */
  rect(x, y, w, h, r, g, b, a) {
    this.quad(x, y, 1, x + w, y, 1, x, y + h, 1, x + w, y + h, 1, 0, 0, 0, 0, 0, QUAD_MODE.FLAT, r, g, b, a, 0);
  }
}
