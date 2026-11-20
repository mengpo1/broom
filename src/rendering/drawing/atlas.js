// In-memory texture atlas: drawings are painted once with Canvas 2D (vector paths) and packed
// into square layers that become a WebGPU texture array. Game code only handles sprite records
// looked up by logical id, so a painted sprite can later be replaced by artist-made artwork
// without touching simulation or scene code.

export function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  return c;
}

export class AtlasBuilder {
  /**
   * @param layerSize  edge of a square layer in pixels
   * @param firstLayer index of this builder's first layer inside the GPU texture array
   * @param maxLayers  number of layers this builder may use
   */
  constructor(layerSize, firstLayer, maxLayers, padding = 6) {
    this.layerSize = layerSize; this.firstLayer = firstLayer; this.maxLayers = maxLayers; this.padding = padding;
    this.pending = [];
    this.sprites = new Map();
    this.canvases = [];
  }

  /**
   * Register a drawing. `paint(ctx, width, height)` draws inside [0,width]x[0,height].
   * `meta` is copied on the sprite record (world size, anchor...).
   */
  define(id, width, height, paint, meta = null) {
    width = Math.ceil(width); height = Math.ceil(height);
    if (width + 2 * this.padding > this.layerSize || height + 2 * this.padding > this.layerSize) {
      throw new Error(`Sprite ${id} (${width}x${height}) does not fit an atlas layer`);
    }
    this.pending.push({ id, width, height, paint, meta });
  }

  /** Pack and paint everything registered since the last build. Returns the layer canvases. */
  build() {
    const size = this.layerSize, pad = this.padding;
    const items = this.pending.slice().sort((a, b) => b.height - a.height || b.width - a.width);
    this.pending.length = 0;
    this.canvases = [];
    this.sprites.clear();
    const shelves = [];   // { layer, y, height, x }
    let layerCount = 0, nextY = 0;
    const contexts = [];
    const openLayer = () => {
      if (layerCount >= this.maxLayers) throw new Error(`Atlas overflow: more than ${this.maxLayers} layers needed`);
      const canvas = makeCanvas(size, size);
      this.canvases.push(canvas);
      contexts.push(canvas.getContext('2d'));
      nextY = 0;
      return layerCount++;
    };
    openLayer();
    for (const item of items) {
      const w = item.width + 2 * pad, h = item.height + 2 * pad;
      let shelf = null;
      for (const sh of shelves) {
        if (sh.height >= h && sh.height <= h * 1.35 && sh.x + w <= size) { shelf = sh; break; }
      }
      if (!shelf) {
        if (nextY + h > size) openLayer();
        shelf = { layer: layerCount - 1, y: nextY, height: h, x: 0 };
        shelves.push(shelf);
        nextY += h;
      }
      const x = shelf.x + pad, y = shelf.y + pad;
      shelf.x += w;
      const ctx = contexts[shelf.layer];
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, item.width, item.height); ctx.clip();
      ctx.translate(x, y);
      item.paint(ctx, item.width, item.height);
      ctx.restore();
      if (item.meta && item.meta.wrapX) {
        // tiles repeated along the road: bleed each side edge into the opposite padding
        const canvas = this.canvases[shelf.layer];
        ctx.drawImage(canvas, x + item.width - pad, y, pad, item.height, x - pad, y, pad, item.height);
        ctx.drawImage(canvas, x, y, pad, item.height, x + item.width, y, pad, item.height);
      }
      const sprite = {
        id: item.id, layer: this.firstLayer + shelf.layer, x, y, w: item.width, h: item.height,
        u0: x / size, v0: y / size, u1: (x + item.width) / size, v1: (y + item.height) / size,
      };
      if (item.meta) Object.assign(sprite, item.meta);
      this.sprites.set(item.id, sprite);
    }
    return this.canvases;
  }

  get(id) {
    const sprite = this.sprites.get(id);
    if (!sprite) throw new Error(`Unknown sprite: ${id}`);
    return sprite;
  }

  has(id) { return this.sprites.has(id); }
}
