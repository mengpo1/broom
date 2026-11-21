// Drawn effects of the race: dust and smoke puffs, sparks, tyre marks on the asphalt, impact
// bursts and lettered sound words. World effects live in track coordinates and are sorted with
// the scenery; bursts and words are screen-space drawings of the view that saw the event.
// Each family obeys its own switch in app.effects. Fixed pools, no allocation per frame.

import { clamp, mod } from '../../core/math.js';
import { MAX_NODES, depthOf, segmentAt, projectAtDepth } from '../projection/road-projection.js';
import { QUAD_MODE } from '../drawing/quad-batch.js';
import { CAR_STATE } from '../../physics/car-physics.js';
import { SURFACE } from '../../tracks/track-builder.js';
import { closedCurve, blobPoints, brushStroke, seeded } from '../../art/styles/ink.js';
import { drawText } from '../../art/styles/lettering.js';
import { hexToRgb } from '../../art/palettes/palettes.js';

const MAX_PARTICLES = 320, MAX_MARKS = 420, MAX_POPS = 8;
const WORDS = ['CRAC !', 'BANG !', 'SCRIIII', 'BOUM !', 'TCHAK !', 'VROOAAR !'];
const WORD = { CRAC: 0, BANG: 1, SCRI: 2, BOUM: 3, TCHAK: 4, VROAR: 5 };
const WORD_COLORS = ['#ffd42a', '#f58a1f', '#f1efe6', '#e0312b', '#ffd42a', '#e0312b'];
const pt = { x: 0, y: 0, scale: 0, z: 0, theta: 0 };
const ptB = { x: 0, y: 0, scale: 0, z: 0, theta: 0 };

/** Register effect drawings in the static atlas. */
export function defineEffectsArt(art) {
  const puff = (id, seed, lobes) => art.defineStatic(id, 160, 160, (ctx, w) => {
    const rnd = seeded(seed), c = w / 2;
    const shape = blobPoints(c, c, 62, 58, lobes, 0.2, rnd);
    ctx.lineJoin = 'round';
    ctx.beginPath(); closedCurve(ctx, shape); ctx.strokeStyle = 'rgba(22,22,31,0.85)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.fillStyle = '#c9c9c9'; ctx.fill();                                  // shade tone (tinted at draw time)
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); closedCurve(ctx, blobPoints(c - 9, c - 11, 52, 46, lobes, 0.22, rnd)); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 3; i++) {                                           // curl marks
      const a = 0.4 + i * 0.9, rr = 30 + i * 6;
      brushStroke(ctx, [[c + Math.cos(a) * rr, c + Math.sin(a) * rr], [c + Math.cos(a + 0.35) * (rr + 5), c + Math.sin(a + 0.35) * (rr + 5)], [c + Math.cos(a + 0.7) * rr, c + Math.sin(a + 0.7) * rr]], 3.4, { color: 'rgba(22,22,31,0.7)', taper: 0.4 });
    }
  });
  puff('fx.puff.0', 11, 6); puff('fx.puff.1', 29, 7); puff('fx.puff.2', 47, 5);
  art.defineStatic('fx.spark', 64, 64, (ctx, w) => {
    const c = w / 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 9 : 28; ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#16161f'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  });
  art.defineStatic('fx.burst', 512, 512, (ctx, w) => {
    const c = w / 2, rnd = seeded(5);
    const star = (r0, r1, n, fill, line) => {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 + 0.1, r = (i % 2 ? r0 : r1) * (0.85 + rnd() * 0.3);
        ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      if (line) { ctx.strokeStyle = '#16161f'; ctx.lineWidth = line; ctx.lineJoin = 'miter'; ctx.stroke(); }
    };
    star(120, 236, 13, '#ffd42a', 9);
    star(80, 168, 11, '#ffffff', 0);
    for (let i = 0; i < 16; i++) {                                           // impact strokes
      const a = (i / 16) * Math.PI * 2 + rnd() * 0.3, r0 = 60 + rnd() * 30, r1 = 120 + rnd() * 40;
      brushStroke(ctx, [[c + Math.cos(a) * r0, c + Math.sin(a) * r0], [c + Math.cos(a) * r1, c + Math.sin(a) * r1]], 5, { color: '#16161f', taperStart: 0.6, taperEnd: 0.1 });
    }
  });
  art.defineStatic('fx.mark', 64, 256, (ctx, w, h) => {
    // tyre mark: a dark band with ragged, lighter edges (tinted, used on the ground)
    const rnd = seeded(3);
    for (let i = 0; i < 26; i++) {
      const x = 8 + rnd() * (w - 16), wid = 3 + rnd() * 9;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`;
      ctx.fillRect(x - wid / 2, 0, wid, h);
    }
  }, { wrapY: true });
  WORDS.forEach((word, i) => {
    art.defineStatic(`fx.word.${i}`, 720, 250, (ctx, w, h) => {
      drawText(ctx, word, w / 2, h * 0.72, 118, { style: 'impact', color: WORD_COLORS[i], outline: '#16161f', outlineWidth: 14, align: 'center', bounce: 0.14, seed: 3 + i, shadow: { dx: 9, dy: 10, color: '#16161f' } });
    });
  });
}

export class EffectsLayer {
  constructor(art) {
    this.puffs = [art.sprite('fx.puff.0'), art.sprite('fx.puff.1'), art.sprite('fx.puff.2')];
    this.spark = art.sprite('fx.spark');
    this.burst = art.sprite('fx.burst');
    this.mark = art.sprite('fx.mark');
    this.words = WORDS.map((w, i) => art.sprite(`fx.word.${i}`));
    const n = MAX_PARTICLES;
    this.ps = new Float32Array(n); this.pd = new Float32Array(n); this.ph = new Float32Array(n);
    this.pvs = new Float32Array(n); this.pvd = new Float32Array(n); this.pvh = new Float32Array(n);
    this.page = new Float32Array(n); this.plife = new Float32Array(n);
    this.psize = new Float32Array(n); this.pgrow = new Float32Array(n);
    this.pr = new Float32Array(n); this.pg = new Float32Array(n); this.pb = new Float32Array(n); this.pa = new Float32Array(n);
    this.pkind = new Uint8Array(n);
    this.pnext = new Int16Array(n); this.pz = new Float32Array(n);
    this.segHead = new Int16Array(MAX_NODES);
    this.cursor = 0;
    this.ms = new Float32Array(MAX_MARKS); this.md = new Float32Array(MAX_MARKS); this.mlen = new Float32Array(MAX_MARKS);
    this.mw = new Float32Array(MAX_MARKS); this.ma = new Float32Array(MAX_MARKS);
    this.markCursor = 0; this.markCount = 0;
    this.emitTimer = new Float32Array(32); this.markOdo = new Float32Array(32);
    // screen-space pops (burst + word), per view
    this.pops = [];
    for (let v = 0; v < 2; v++) this.pops.push(Array.from({ length: MAX_POPS }, () => ({ age: 9, life: 0, x: 0, y: 0, word: -1, size: 1, burst: false, angle: 0 })));
    this.popCursor = [0, 0];
    this.dust = [0.85, 0.79, 0.64]; this.dirt = [0.55, 0.6, 0.38]; this.smoke = [0.93, 0.92, 0.9];
    this.track = null;
    this.seed = 1;
  }

  reset(race, track, palette) {
    this.track = track;
    this.plife.fill(0); this.page.fill(1);
    this.markCount = 0; this.markCursor = 0;
    this.emitTimer.fill(0); this.markOdo.fill(0);
    for (const list of this.pops) for (const p of list) p.life = 0;
    if (palette) { this.dust = hexToRgb(palette.dust); this.dirt = hexToRgb(palette.grassDark); this.smoke = hexToRgb(palette.smoke); }
  }

  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  spawn(kind, s, d, h, vs, vd, vh, life, size, grow, color, alpha) {
    const i = this.cursor;
    this.cursor = (i + 1) % MAX_PARTICLES;
    this.pkind[i] = kind; this.ps[i] = s; this.pd[i] = d; this.ph[i] = h;
    this.pvs[i] = vs; this.pvd[i] = vd; this.pvh[i] = vh;
    this.page[i] = 0; this.plife[i] = life; this.psize[i] = size; this.pgrow[i] = grow;
    this.pr[i] = color[0]; this.pg[i] = color[1]; this.pb[i] = color[2]; this.pa[i] = alpha;
  }

  addMark(s, d, len, width, alpha) {
    const i = this.markCursor;
    this.markCursor = (i + 1) % MAX_MARKS;
    if (this.markCount < MAX_MARKS) this.markCount++;
    this.ms[i] = s; this.md[i] = d; this.mlen[i] = len; this.mw[i] = width; this.ma[i] = alpha;
  }

  pop(viewIndex, word, x, y, size, burst) {
    const list = this.pops[viewIndex];
    const p = list[this.popCursor[viewIndex]];
    this.popCursor[viewIndex] = (this.popCursor[viewIndex] + 1) % MAX_POPS;
    p.age = 0; p.life = word === WORD.VROAR ? 1.3 : 0.85; p.x = x; p.y = y; p.word = word; p.size = size; p.burst = burst;
    p.angle = (this.random() - 0.5) * 0.3;
  }

  onEvent(event, app) {
    const fx = app.effects, race = app.race;
    if (event.type === 'green') {
      if (fx.onomatopoeia) for (let v = 0; v < app.viewCount; v++) this.pop(v, WORD.VROAR, 0.5, 0.36, 1.15, false);
      return;
    }
    const hit = event.type === 'wall' || event.type === 'contact' || event.type === 'crash';
    if (!hit) return;
    const car = race.cars[event.car];
    const strength = event.type === 'crash' ? 1 : clamp(event.value / 16, 0, 1);
    if (fx.dust && strength > 0.15) {
      const side = event.type === 'wall' ? Math.sign(car.d) : 0;
      for (let k = 0; k < 4 + strength * 8; k++) {
        this.spawn(1, car.s + (this.random() - 0.3) * 2, car.d + side * 0.9, 0.3 + this.random() * 0.5,
          car.speed * 0.5 + (this.random() - 0.5) * 12, -side * (2 + this.random() * 6) + (this.random() - 0.5) * 4, 2 + this.random() * 5, 0.3 + this.random() * 0.25, 0.3, 0.2, [1, 0.85, 0.3], 1);
      }
      if (event.type === 'crash') for (let k = 0; k < 6; k++) this.spawn(0, car.s + (this.random() - 0.5) * 3, car.d + (this.random() - 0.5) * 2, 0.5, car.speed * 0.4, (this.random() - 0.5) * 3, 1.5, 1.1 + this.random() * 0.5, 1.6, 3.5, this.smoke, 0.9);
    }
    for (let v = 0; v < app.viewCount; v++) {
      const view = app.views[v];
      const mine = view.carIndex === event.car || view.carIndex === event.other;
      if (!mine || strength < 0.3) continue;
      const sideX = event.type === 'wall' ? (car.d > 0 ? 0.78 : 0.22) : 0.5 + (this.random() - 0.5) * 0.3;
      if (fx.impactFrames) this.pop(v, -1, sideX, 0.5, 0.5 + strength * 0.7, true);
      if (fx.onomatopoeia && strength > 0.45) {
        const word = event.type === 'crash' ? WORD.BOUM : event.type === 'wall' ? (strength > 0.7 ? WORD.CRAC : WORD.SCRI) : (strength > 0.7 ? WORD.BANG : WORD.TCHAK);
        this.pop(v, word, clamp(sideX + (sideX > 0.5 ? -0.16 : 0.16), 0.25, 0.75), 0.3, 0.75 + strength * 0.45, false);
      }
    }
  }

  update(app, dt) {
    if (dt <= 0) return;
    const fx = app.effects, cars = app.race.cars, track = this.track;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.page[i] >= this.plife[i]) continue;
      this.page[i] += dt;
      this.ps[i] += this.pvs[i] * dt; this.pd[i] += this.pvd[i] * dt; this.ph[i] += this.pvh[i] * dt;
      const drag = Math.exp(-(this.pkind[i] === 1 ? 2.5 : 1.6) * dt);
      this.pvs[i] *= drag; this.pvd[i] *= drag;
      if (this.pkind[i] === 1) { this.pvh[i] -= 14 * dt; if (this.ph[i] < 0.05) { this.ph[i] = 0.05; this.pvh[i] *= -0.4; } }
    }
    for (const list of this.pops) for (const p of list) if (p.life > 0) { p.age += dt; if (p.age > p.life) p.life = 0; }
    const count = Math.min(cars.length, 32);
    for (let i = 0; i < count; i++) {
      const car = cars[i];
      if (car.removed || car.state === CAR_STATE.GRID || car.state === CAR_STATE.SERVICE) continue;
      const v = Math.abs(car.speed);
      const loose = car.surface === SURFACE.GRASS || car.surface === SURFACE.GRAVEL;
      const sliding = car.slip > 0.55 || car.wheelspin > 0.35 || car.state === CAR_STATE.SPIN;
      if (fx.dust && ((loose && v > 7) || (sliding && v > 4))) {
        this.emitTimer[i] -= dt * (loose ? 6 + v * 0.35 : 14);
        while (this.emitTimer[i] < 0) {
          this.emitTimer[i] += 1;
          const side = this.random() < 0.5 ? -0.75 : 0.75;
          const color = loose ? (car.surface === SURFACE.GRAVEL ? this.dust : this.dirt) : this.smoke;
          this.spawn(0, car.s - 1.5 + this.random() * 0.6, car.d + side + (this.random() - 0.5) * 0.4, 0.25,
            car.speed * (loose ? 0.25 : 0.12), (this.random() - 0.5) * 1.5, 1.2 + this.random() * 1.2, 0.75 + this.random() * 0.5,
            loose ? 1.1 : 0.8, loose ? 3.4 : 2.6, color, loose ? 0.95 : 0.8);
        }
      }
      const locked = car.brake > 0.92 && v > 24 && car.surface === SURFACE.ASPHALT && car.accelLong < -24;
      if (fx.skidMarks && car.surface !== SURFACE.GRASS && car.surface !== SURFACE.GRAVEL && (sliding || locked) && v > 5) {
        if (Math.abs(car.odometer - this.markOdo[i]) > 2.2) {
          this.markOdo[i] = car.odometer;
          const alpha = clamp(0.35 + car.slip * 0.4, 0.3, 0.8);
          this.addMark(mod(car.s - 1.4, track.length), car.d - 0.72, 2.4, 0.3, alpha);
          this.addMark(mod(car.s - 1.4, track.length), car.d + 0.72, 2.4, 0.3, alpha);
        }
      }
    }
  }

  /** Start of a view: tyre marks (they lie on the ground, under everything else) and particle buckets. */
  beginView(app, view) {
    const p = view.projection, quads = app.quads, sp = this.mark;
    const W = view.rect.w;
    for (let i = 0; i < this.markCount; i++) {
      const z0 = depthOf(p, this.ms[i]);
      const zA = p.dir > 0 ? z0 : z0 - this.mlen[i], zB = zA + this.mlen[i];
      if (zA < 1.5 || zB > 320) continue;
      const hw = this.mw[i] * 0.5, d = this.md[i];
      if (!projectAtDepth(p, zA, d, 0.01, pt) || !projectAtDepth(p, zB, d, 0.01, ptB)) continue;
      if ((pt.x < -60 && ptB.x < -60) || (pt.x > W + 60 && ptB.x > W + 60)) continue;
      const wA = hw * pt.scale, wB = hw * ptB.scale;
      const fade = this.ma[i] * clamp(1.4 - zB / 230, 0, 1);
      quads.quad(ptB.x - wB, ptB.y, zB, ptB.x + wB, ptB.y, zB, pt.x - wA, pt.y, zA, pt.x + wA, pt.y, zA,
        sp.u0, sp.v0, sp.u1, sp.v1, sp.layer, QUAD_MODE.SPRITE, 0.1, 0.1, 0.13, fade, zA);
    }
    const head = this.segHead;
    for (let k = 0; k < p.nodeCount; k++) head[k] = -1;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.page[i] >= this.plife[i]) continue;
      const z = depthOf(p, this.ps[i]);
      if (z < 0.8 || z > 420) continue;
      this.pz[i] = z;
      const k = segmentAt(p, z);
      this.pnext[i] = head[k]; head[k] = i;
    }
  }

  buildSegment(app, view, k) {
    let i = this.segHead[k];
    if (i < 0) return;
    const p = view.projection, quads = app.quads;
    for (; i >= 0; i = this.pnext[i]) {
      if (!projectAtDepth(p, this.pz[i], this.pd[i], this.ph[i], pt)) continue;
      const t = this.page[i] / this.plife[i];
      if (this.pkind[i] === 1) {
        const s = this.psize[i] * pt.scale * (1 - t * 0.5);
        quads.sprite(this.spark, pt.x - s / 2, pt.y - s / 2, s, s, this.pr[i], this.pg[i], this.pb[i], 1 - t * t, this.pz[i], false);
      } else {
        const size = (this.psize[i] + this.pgrow[i] * Math.sqrt(t)) * pt.scale;
        const alpha = this.pa[i] * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
        quads.sprite(this.puffs[i % 3], pt.x - size / 2, pt.y - size * 0.85, size, size, this.pr[i], this.pg[i], this.pb[i], alpha, this.pz[i], (i & 1) === 1);
      }
    }
  }

  /** Screen-space bursts and sound words of this view. */
  buildFront(app, view) {
    const quads = app.quads, r = view.rect;
    const u = Math.min(r.w / 2560, (r.h / 1440) * (view.wide ? 1.6 : 1));
    for (const p of this.pops[view.index]) {
      if (p.life <= 0) continue;
      const t = p.age / p.life;
      const popIn = clamp(p.age / 0.07, 0, 1);
      const scale = (0.55 + 0.45 * popIn + (p.burst ? t * 0.35 : Math.sin(p.age * 38) * 0.02)) * p.size * u;
      const alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      const cx = p.x * r.w, cy = p.y * r.h;
      if (p.burst) {
        const s = 620 * scale;
        quads.rotated(this.burst, cx, cy, s, s, p.angle * 2, 0.5, 0.5, 1, 1, 1, alpha * (1 - t * 0.5));
      } else {
        const sp = this.words[p.word];
        quads.rotated(sp, cx, cy, sp.w * scale * 1.5, sp.h * scale * 1.5, p.angle - 0.08, 0.5, 0.5, 1, 1, 1, alpha);
      }
    }
  }
}
