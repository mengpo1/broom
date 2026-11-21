// HUD text drawn with baked glyph sprites of the comic lettering (art/styles/lettering.js).
// Two baked sets: 'b' bold white glyphs (tinted at draw time, used on paper cartouches) and
// 'o' outlined white glyphs with an ink contour (readable directly over the scene).
// Drawing allocates nothing; numbers are formatted into a reusable character buffer.

import { LETTERING_CHARSET, drawText, glyphAdvance } from '../art/styles/lettering.js';

const BAKE = { b: { cap: 44, style: 'bold', chars: LETTERING_CHARSET }, o: { cap: 88, style: 'bold', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:!?\'-+/%°ÉÈÊÀÇÔ' } };
const INK = '#16161f';

/** Reusable character buffer for numbers and times. */
export class TextBuffer {
  constructor(capacity = 48) { this.codes = new Uint16Array(capacity); this.length = 0; }
  clear() { this.length = 0; return this; }
  char(code) { if (this.length < this.codes.length) this.codes[this.length++] = code; return this; }
  text(str) { for (let i = 0; i < str.length; i++) this.char(str.charCodeAt(i)); return this; }
  /** Non-negative integer, left padded with zeros to `digits`. */
  int(value, digits = 1) {
    let v = Math.max(0, Math.floor(value));
    let count = 1;
    for (let p = 10; p <= v; p *= 10) count++;
    if (count < digits) count = digits;
    const start = this.length;
    for (let i = count - 1; i >= 0; i--) {
      if (start + i < this.codes.length) this.codes[start + i] = 48 + (v % 10);
      v = Math.floor(v / 10);
    }
    this.length = Math.min(this.codes.length, start + count);
    return this;
  }
  /** Lap time as M:SS.mmm (or -:--.--- when there is none). */
  time(seconds) {
    if (!(seconds > 0)) return this.text('-:--.---');
    const ms = Math.round(seconds * 1000);
    this.int(Math.floor(ms / 60000)).char(58).int(Math.floor(ms / 1000) % 60, 2).char(46).int(ms % 1000, 3);
    return this;
  }
}

export class TextPainter {
  constructor() {
    this.sets = { b: this.makeSet(BAKE.b), o: this.makeSet(BAKE.o) };
    this.scratch = new TextBuffer(96);
  }

  makeSet(bake) {
    return { cap: bake.cap, style: bake.style, chars: bake.chars, sprites: new Array(0x180).fill(null), advance: new Float32Array(0x180), padX: Math.ceil(bake.cap * 0.22), baseline: Math.ceil(bake.cap * 1.34), height: Math.ceil(bake.cap * 1.78) };
  }

  /** Register glyph drawings in the static atlas. */
  define(art) {
    for (const key of Object.keys(this.sets)) {
      const set = this.sets[key];
      for (const ch of set.chars) {
        if (ch === ' ') continue;
        const adv = glyphAdvance(ch, set.style) * set.cap;
        const w = Math.ceil(adv) + set.padX * 2;
        art.defineStatic(`glyph.${key}.${ch.charCodeAt(0)}`, w, set.height, (ctx) => {
          const options = key === 'o'
            ? { style: 'bold', color: '#ffffff', outline: INK, outlineWidth: set.cap * 0.2, jitter: 0, slant: 0.14 }
            : { style: 'bold', color: '#ffffff', jitter: 0 };
          drawText(ctx, ch, set.padX, set.baseline, set.cap, options);
        });
      }
    }
  }

  /** Look the sprites up once the atlas is built. */
  resolve(art) {
    for (const key of Object.keys(this.sets)) {
      const set = this.sets[key];
      const space = glyphAdvance(' ', set.style);
      for (let code = 0; code < 0x180; code++) set.advance[code] = space;
      for (const ch of set.chars) {
        const code = ch.charCodeAt(0);
        // outlined lettering needs air between the characters, or their contours weld together
        set.advance[code] = glyphAdvance(ch, set.style) + (key === 'o' && ch !== ' ' ? 0.09 : 0);
        if (ch !== ' ') set.sprites[code] = art.sprite(`glyph.${key}.${code}`);
      }
      // lowercase maps to capitals, unknown characters to '?'
      for (let code = 97; code <= 122; code++) { set.sprites[code] = set.sprites[code - 32]; set.advance[code] = set.advance[code - 32]; }
      for (const [lower, upper] of [['é', 'É'], ['è', 'È'], ['ê', 'Ê'], ['à', 'À'], ['ç', 'Ç'], ['ô', 'Ô'], ['ù', 'Ù'], ['î', 'Î'], ['â', 'Â'], ['û', 'Û'], ['ë', 'Ë'], ['ï', 'Ï']]) {
        const lc = lower.charCodeAt(0), uc = upper.charCodeAt(0);
        set.sprites[lc] = set.sprites[uc]; set.advance[lc] = set.advance[uc];
      }
    }
  }

  /** Width in pixels of a string at cap height `size`. */
  measure(setKey, text, size) {
    const set = this.sets[setKey];
    let w = 0;
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); w += set.advance[c < 0x180 ? c : 63]; }
    return w * size;
  }

  measureBuffer(setKey, buffer, size) {
    const set = this.sets[setKey];
    let w = 0;
    for (let i = 0; i < buffer.length; i++) w += set.advance[buffer.codes[i]];
    return w * size;
  }

  /** Draw a string with its baseline at y. align: 0 left, 0.5 centre, 1 right. */
  draw(quads, setKey, text, x, y, size, r, g, b, a, align = 0) {
    const buffer = this.scratch.clear().text(text);
    return this.drawBuffer(quads, setKey, buffer, x, y, size, r, g, b, a, align);
  }

  drawBuffer(quads, setKey, buffer, x, y, size, r, g, b, a, align = 0) {
    const set = this.sets[setKey];
    const k = size / set.cap;
    let pen = x;
    if (align > 0) pen -= this.measureBuffer(setKey, buffer, size) * align;
    const top = y - set.baseline * k, h = set.height * k;
    for (let i = 0; i < buffer.length; i++) {
      let code = buffer.codes[i];
      if (code >= 0x180) code = 63;
      const sp = set.sprites[code];
      if (sp) quads.sprite(sp, pen - set.padX * k, top, sp.w * k, h, r, g, b, a, 0, false);
      pen += set.advance[code] * size;
    }
    return pen;
  }
}
