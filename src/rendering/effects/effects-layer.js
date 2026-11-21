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
import { drawText, measureText } from '../../art/styles/lettering.js';
import { hexToRgb } from '../../art/palettes/palettes.js';
import { COLLISION_TUNING } from '../../physics/collision-tuning.js';
import { CAMERA } from '../compositing/race-view.js';
import { cockpitPlacement } from '../compositing/cockpit-layer.js';
import { COCKPIT_REF_FOCAL } from '../../art/cockpits/cockpit-art.js';
import { CAR_DIMENSIONS } from '../../art/vehicles/car-model.js';

const MAX_PARTICLES = 320, MAX_MARKS = 420, MAX_POPS = 8, MAX_FLASHES = 6;
const WORDS = ['CRAC !', 'BANG !', 'SCRIIII', 'BOUM !', 'TCHAK !', 'VROOAAR !', 'RRRRRRAAAH', 'VRRAAOOUM', 'WAAAAOOOR'];
const WORD = { CRAC: 0, BANG: 1, SCRI: 2, BOUM: 3, TCHAK: 4, VROAR: 5, FLATOUT: 6 };
const FLATOUT_WORDS = 3;        // the engine at full cry has several spellings
const WORD_COLORS = ['#ffd42a', '#f58a1f', '#f1efe6', '#e0312b', '#ffd42a', '#e0312b', '#f1efe6', '#ffd42a', '#f58a1f'];
/** Phases of an explosion, seconds after the hard landing (MEASURED on the reference footage: 0.48 / 0.44 / 0.2 / 0.12 s, plumes 0.6 s). */
export const BLAST = { grow: 0.48, full: 0.92, dark: 1.12, smokeEnd: 1.24, plumeStart: 1.0, end: 1.6 };
const FLATOUT_SPEED = 76;       // m/s: the engine at full cry gets its own lettering, now and then
const pt = { x: 0, y: 0, scale: 0, z: 0, theta: 0 };
const ptB = { x: 0, y: 0, scale: 0, z: 0, theta: 0 };

/** Register effect drawings in the static atlas. */
export function defineEffectsArt(art) {
  const puff = (id, seed, lobes) => art.defineStatic(id, 256, 256, (ctx, w) => {
    const rnd = seeded(seed), c = 80;
    ctx.scale(w / 160, w / 160);                                           // drawn on a 160 unit grid
    const shape = blobPoints(c, c, 62, 58, lobes, 0.2, rnd);
    ctx.lineJoin = 'round';
    ctx.beginPath(); closedCurve(ctx, shape); ctx.strokeStyle = 'rgba(22,22,31,0.85)'; ctx.lineWidth = 3.6; ctx.stroke();
    ctx.fillStyle = '#dcdcdc'; ctx.fill();                                  // shade tone (tinted at draw time)
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); closedCurve(ctx, blobPoints(c - 9, c - 11, 52, 46, lobes, 0.22, rnd)); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 3; i++) {                                           // curl marks
      const a = 0.4 + i * 0.9, rr = 30 + i * 6;
      brushStroke(ctx, [[c + Math.cos(a) * rr, c + Math.sin(a) * rr], [c + Math.cos(a + 0.35) * (rr + 5), c + Math.sin(a + 0.35) * (rr + 5)], [c + Math.cos(a + 0.7) * rr, c + Math.sin(a + 0.7) * rr]], 2.6, { color: 'rgba(22,22,31,0.55)', taper: 0.4 });
    }
  });
  puff('fx.puff.0', 11, 6); puff('fx.puff.1', 29, 7); puff('fx.puff.2', 47, 5);
  // fireball of an explosion: lobed flames in three flat tones under an ink outline (two drawings that alternate)
  const fire = (id, seed) => art.defineStatic(id, 384, 384, (ctx, w) => {
    const rnd = seeded(seed), c = w / 2;
    ctx.lineJoin = 'round';
    const outer = blobPoints(c, c + 6, 150, 158, 11, 0.3, rnd);
    ctx.beginPath(); closedCurve(ctx, outer); ctx.strokeStyle = '#16161f'; ctx.lineWidth = 11; ctx.stroke();
    ctx.fillStyle = '#d5302a'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#f58a1f'; ctx.beginPath(); closedCurve(ctx, blobPoints(c - 6, c + 16, 112, 118, 9, 0.28, rnd)); ctx.fill();
    ctx.fillStyle = '#ffd42a'; ctx.beginPath(); closedCurve(ctx, blobPoints(c - 10, c + 26, 74, 78, 8, 0.3, rnd)); ctx.fill();
    ctx.fillStyle = '#fff6c8'; ctx.beginPath(); closedCurve(ctx, blobPoints(c - 12, c + 34, 36, 38, 6, 0.25, rnd)); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 7; i++) {                                           // licks of flame drawn with the pen
      const a = -Math.PI * (0.1 + rnd() * 0.8), r0 = 60 + rnd() * 40, r1 = r0 + 30 + rnd() * 30;
      brushStroke(ctx, [[c + Math.cos(a) * r0, c + Math.sin(a) * r0], [c + Math.cos(a + 0.2) * (r0 + r1) * 0.5, c + Math.sin(a + 0.2) * (r0 + r1) * 0.5], [c + Math.cos(a - 0.1) * r1, c + Math.sin(a - 0.1) * r1]], 5, { color: '#16161f', taperStart: 0.2, taperEnd: 0.8 });
    }
  });
  fire('fx.fire.0', 71); fire('fx.fire.1', 97);
  // shadow of a car thrown in the air: a flat inked shape left on the road
  art.defineStatic('fx.shadow', 160, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, Math.PI * 2); ctx.fill();
  });
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
      const options = { style: 'impact', color: WORD_COLORS[i], outline: '#16161f', outlineWidth: 12, align: 'center', bounce: 0.12, seed: 3 + i, shadow: { dx: 8, dy: 9, color: '#16161f' } };
      const size = Math.min(112, (112 * (w - 90)) / measureText(word, 112, options));
      drawText(ctx, word, w / 2, h * 0.5 + size * 0.42, size, options);
    });
  });
}

export class EffectsLayer {
  constructor(art) {
    this.puffs = [art.sprite('fx.puff.0'), art.sprite('fx.puff.1'), art.sprite('fx.puff.2')];
    this.spark = art.sprite('fx.spark');
    this.burst = art.sprite('fx.burst');
    this.fire = [art.sprite('fx.fire.0'), art.sprite('fx.fire.1')];
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
    // contact flashes: short stars drawn in the world, at the point where two cars (or a car and a
    // board) touch; attached to a car they travel with it
    this.flashes = Array.from({ length: MAX_FLASHES }, () => ({ car: -1, other: -1, wheel: false, owner: -1, ahead: 0, right: 0, up: 0, s: 0, d: 0, h: 0, age: 9, life: 0, size: 1, seg: -1, z: 0 }));
    this.flashCursor = 0;
    this.typedCar = -1; this.typedClock = 9;
    // explosions after a hard landing: one per car at most, attached to the car, timed on the car's own clock
    this.blasts = Array.from({ length: 4 }, () => ({ car: -1, seg: -1, z: 0 }));
    this.popClock = [9, 9];
    this.roarClock = [0, 0]; this.wasFlatOut = [false, false];
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
    for (const f of this.flashes) f.life = 0;
    for (const b of this.blasts) b.car = -1;
    this.typedCar = -1; this.typedClock = 9;
    this.popClock[0] = 9; this.popClock[1] = 9;
    this.roarClock[0] = 0; this.roarClock[1] = 0; this.wasFlatOut[0] = false; this.wasFlatOut[1] = false;
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
    p.age = 0; p.life = word === WORD.VROAR ? 1.3 : word >= WORD.FLATOUT ? 1.5 : 0.85; p.x = x; p.y = y; p.word = word; p.size = size; p.burst = burst;
    p.angle = (this.random() - 0.5) * 0.3;
  }

  onEvent(event, app) {
    const fx = app.effects, race = app.race;
    if (event.type === 'green') {
      if (fx.onomatopoeia) for (let v = 0; v < app.viewCount; v++) this.pop(v, WORD.VROAR, 0.5, 0.36, 1.15, false);
      return;
    }
    if (event.type === 'bump' || event.type === 'wheel') { this.onTypedContact(event, app); return; }
    if (event.type === 'obstacle') { this.onObstacle(event, app); return; }
    if (event.type === 'launch' || event.type === 'landing') { this.onFlight(event, app); return; }
    // (a contact that already has its own staging does not get the generic burst as well)
    if (event.type === 'contact' && this.typedClock < 0.1 && (event.car === this.typedCar || event.other === this.typedCar)) return;
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
      // one burst and one sound word at a time: effects punctuate, they do not pile up
      if (this.popClock[v] < 0.5 && event.type !== 'crash') continue;
      if (event.type === 'crash' && this.popClock[v] < 0.12) continue;
      this.popClock[v] = 0;
      const sideX = event.type === 'wall' ? (car.d > 0 ? 0.78 : 0.22) : 0.5 + (this.random() - 0.5) * 0.3;
      if (fx.impactFrames) this.pop(v, -1, sideX, 0.52, 0.4 + strength * 0.35, true);
      if (fx.onomatopoeia && strength > 0.45) {
        const word = event.type === 'crash' ? WORD.BOUM : event.type === 'wall' ? (strength > 0.7 ? WORD.CRAC : WORD.SCRI) : (strength > 0.7 ? WORD.BANG : WORD.TCHAK);
        this.pop(v, word, clamp(sideX + (sideX > 0.5 ? -0.13 : 0.13), 0.2, 0.8), 0.37, 0.7 + strength * 0.3, false);   // the word springs from the impact
      }
    }
  }

  /**
   * Star at a point of the world. `car` >= 0 attaches it to that car: (s, d) are then offsets from the car.
   * `other` >= 0 names the second car of a contact (`wheel`: side by side): their drivers see the star on
   * their own cockpit drawing instead (see buildFront), where the world point is hidden or out of view.
   */
  flash(car, s, d, h, size, life, other = -1, wheel = false) {
    const f = this.flashes[this.flashCursor];
    this.flashCursor = (this.flashCursor + 1) % MAX_FLASHES;
    f.car = car; f.other = other; f.wheel = wheel; f.owner = -1; f.s = s; f.d = d; f.h = h; f.size = size; f.age = 0; f.life = life;
    return f;
  }

  /**
   * The driver of car `owner` sees this star on the cockpit drawing, at a point of the car given in
   * metres from its centre (ahead, to the right, above the ground) and brought back to a place the
   * driver can see: an impact beside or behind the cockpit shows on the front wheel of that side.
   */
  onCockpit(f, owner, ahead, right, up) {
    const D = CAR_DIMENSIONS, reach = D.frontTrack + D.frontTyre.width * 0.5;
    f.owner = owner;
    if (ahead < D.frontAxleX) { f.ahead = D.frontAxleX; f.right = (right >= 0 ? 1 : -1) * reach; f.up = D.frontTyre.radius; }
    else { f.ahead = Math.min(ahead, 2.4); f.right = clamp(right, -reach, reach); f.up = up; }
  }

  /** Rear-end bump or wheel-to-wheel contact: a spark where the cars touch, a few flying sparks, a sound word. */
  onTypedContact(event, app) {
    const fx = app.effects, race = app.race, track = this.track;
    const car = race.cars[event.car], other = race.cars[event.other];
    let ds = other.s - car.s;
    if (ds > track.length / 2) ds -= track.length; else if (ds < -track.length / 2) ds += track.length;
    const wheel = event.type === 'wheel';
    this.typedCar = event.car; this.typedClock = 0;
    if (fx.impactFrames) this.flash(event.car, ds * 0.5, (other.d - car.d) * 0.5, wheel ? 0.36 : 0.42, wheel ? 1.5 : 1.2, COLLISION_TUNING.sparkLife, event.other, wheel);
    if (fx.dust) {
      for (let k = 0; k < 5; k++) {
        this.spawn(1, car.s + ds * 0.5, car.d + (other.d - car.d) * 0.5, 0.35, car.speed * 0.8 + (this.random() - 0.5) * 6, (this.random() - 0.5) * 7, 1.5 + this.random() * 3, 0.25 + this.random() * 0.2, 0.22, 0.2, [1, 0.85, 0.3], 1);
      }
    }
    if (!fx.onomatopoeia) return;
    for (let v = 0; v < app.viewCount; v++) {
      const view = app.views[v];
      if ((view.carIndex !== event.car && view.carIndex !== event.other) || this.popClock[v] < 0.5) continue;
      this.popClock[v] = 0;
      const mine = race.cars[view.carIndex], theirs = mine === car ? other : car;
      const x = wheel ? (theirs.d > mine.d ? 0.68 : 0.32) : 0.5 + (this.random() - 0.5) * 0.2;
      this.pop(v, wheel ? WORD.TCHAK : WORD.BANG, x, 0.33, 0.6, false);
    }
  }

  /** Take-off and landing of a car: jolt and sound word for its driver, dust where it comes down, explosion if it is a hard one. */
  onFlight(event, app) {
    const fx = app.effects, race = app.race, car = race.cars[event.car];
    const landing = event.type === 'landing', hard = landing && event.value > 0;
    if (landing && fx.dust) {
      for (let k = 0; k < (hard ? 8 : 5); k++) this.spawn(0, car.s + (this.random() - 0.5) * 3, car.d + (this.random() - 0.5) * 2.4, 0.3, car.speed * 0.5, (this.random() - 0.5) * 4, 1, 0.8 + this.random() * 0.5, 1.2, 2.2, car.surface === SURFACE.ASPHALT ? this.smoke : this.dust, 1);
    }
    if (hard && fx.explosions !== false) {
      const slot = this.blasts.find((b) => b.car === event.car) || this.blasts.find((b) => b.car < 0) || this.blasts[0];
      slot.car = event.car;
    }
    // thrown in the air by another car: a star on the front wheel that rode over it
    if (!landing && event.other >= 0 && car.launchSide && fx.impactFrames) {
      const D = CAR_DIMENSIONS, side = car.launchSide;
      const f = this.flash(event.car, D.frontAxleX, side * D.frontTrack, D.frontTyre.radius, 1.6, COLLISION_TUNING.sparkLife);
      this.onCockpit(f, event.car, D.frontAxleX, side, D.frontTyre.radius);
    }
    for (let v = 0; v < app.viewCount; v++) {
      const view = app.views[v];
      if (view.carIndex !== event.car) continue;
      view.addImpact(landing ? (hard ? 1 : 0.7) : 0.8);
      // (one sound word at a time: a board that throws the car has already had its own)
      if (fx.onomatopoeia && !landing && this.popClock[v] > 0.3) { this.popClock[v] = 0; this.pop(v, WORD.BANG, 0.5 + car.launchSide * 0.14, 0.4, 0.9, false); }
    }
  }

  /** A roadside board is knocked down: star on the spot, splinters, dust, a sound word for the driver. */
  onObstacle(event, app) {
    const fx = app.effects, race = app.race;
    const car = race.cars[event.car], o = race.obstacles[event.other];
    if (!o) return;
    if (fx.impactFrames) {
      const f = this.flash(-1, o.s, o.d, 0.9, 2.6, 0.22);
      // where the board is, seen from the car (it may be hit sideways, out of the driver's sight, during a slide)
      let ds = o.s - car.s;
      if (ds > this.track.length / 2) ds -= this.track.length; else if (ds < -this.track.length / 2) ds += this.track.length;
      const dd = o.d - car.d, ch = Math.cos(car.headingError), sh = Math.sin(car.headingError);
      this.onCockpit(f, event.car, ds * ch + dd * sh, -ds * sh + dd * ch, 0.9);
    }
    if (fx.dust) {
      for (let k = 0; k < 10; k++) {
        this.spawn(1, o.s, o.d + (this.random() - 0.5) * 1.4, 0.4 + this.random() * 1.2, car.speed * (0.3 + this.random() * 0.5), (this.random() - 0.5) * 9, 3 + this.random() * 5, 0.45 + this.random() * 0.3, 0.3, 0.2, [0.95, 0.94, 0.9], 1);
      }
      for (let k = 0; k < 3; k++) this.spawn(0, o.s + this.random() * 2, o.d + (this.random() - 0.5), 0.4, car.speed * 0.3, (this.random() - 0.5) * 2, 1.2, 0.7 + this.random() * 0.3, 1, 1.6, this.dust, 1);
    }
    for (let v = 0; v < app.viewCount; v++) {
      const view = app.views[v];
      if (view.carIndex !== event.car) continue;
      view.addImpact(0.6);
      if (fx.onomatopoeia && this.popClock[v] > 0.3) { this.popClock[v] = 0; this.pop(v, WORD.CRAC, o.d > car.d ? 0.62 : 0.38, 0.35, 0.8, false); }
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
    for (const f of this.flashes) if (f.life > 0) { f.age += dt; if (f.age > f.life) f.life = 0; }
    this.typedClock += dt;
    for (const list of this.pops) for (const p of list) if (p.life > 0) { p.age += dt; if (p.age > p.life) p.life = 0; }
    this.popClock[0] += dt; this.popClock[1] += dt;
    // the engine at full cry: a sound word low in the picture when a player reaches top speed
    for (let v = 0; v < app.viewCount && v < 2; v++) {
      this.roarClock[v] -= dt;
      const followed = cars[app.views[v].carIndex];
      const flat = !!followed && followed.speed > FLATOUT_SPEED && followed.throttle > 0.8;
      if (flat && !this.wasFlatOut[v] && this.roarClock[v] <= 0 && fx.onomatopoeia && this.popClock[v] > 1) {
        // left or right of the car, clear of the mirrors and instruments whatever the shape of the view
        const shape = app.views[v], right = this.random() < 0.5;
        const y = shape.wide ? 0.27 : shape.tall ? 0.5 : 0.62;
        this.pop(v, WORD.FLATOUT + Math.floor(this.random() * FLATOUT_WORDS) % FLATOUT_WORDS, right ? 0.72 : 0.28, y, shape.wide ? 0.6 : 0.7 + this.random() * 0.25, false);
        this.roarClock[v] = 16;
      }
      this.wasFlatOut[v] = flat;
    }
    const count = Math.min(cars.length, 32);
    for (let i = 0; i < count; i++) {
      const car = cars[i];
      if (car.removed || car.state === CAR_STATE.GRID || car.state === CAR_STATE.SERVICE) continue;
      const v = Math.abs(car.speed);
      const loose = car.surface === SURFACE.GRASS || car.surface === SURFACE.GRAVEL;
      const sliding = car.slip > 0.55 || car.wheelspin > 0.35 || car.state === CAR_STATE.SPIN;
      const smoking = car.slip > 0.85 || car.wheelspin > 0.6 || car.state === CAR_STATE.SPIN;       // tyre smoke needs a real slide
      if (fx.dust && ((loose && v > 7) || (smoking && v > 4))) {
        this.emitTimer[i] -= dt * (loose ? 5 + v * 0.25 : 6);
        while (this.emitTimer[i] < 0) {
          this.emitTimer[i] += 1;
          const side = this.random() < 0.5 ? -0.75 : 0.75;
          const color = loose ? (car.surface === SURFACE.GRAVEL ? this.dust : this.dirt) : this.smoke;
          this.spawn(0, car.s - 1.5 + this.random() * 0.6, car.d + side + (this.random() - 0.5) * 0.4, 0.25,
            car.speed * (loose ? 0.25 : 0.12), (this.random() - 0.5) * 1.5, 1.0 + this.random() * 1.0, 0.6 + this.random() * 0.4,
            loose ? 0.8 : 0.5, loose ? 1.7 : 1.0, color, 1);
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
    // explosions: placed with their car; over when the car's clock has run past the last phase
    for (const b of this.blasts) {
      b.seg = -1;
      if (b.car < 0) continue;
      const car = app.race.cars[b.car], age = car.clock - car.landClock;
      if (age < 0 || age > BLAST.end || !car.landHard) { b.car = -1; continue; }
      b.z = depthOf(p, car.s + 1.3);
      if (b.z > 0.6 && b.z < p.farZ - 3) b.seg = segmentAt(p, b.z);
    }
    // where each contact flash is along the projected road in this view
    for (const f of this.flashes) {
      f.seg = -1;
      if (f.life <= 0) continue;
      const anchor = f.car >= 0 ? app.race.cars[f.car] : null;
      f.z = depthOf(p, anchor ? anchor.s + f.s : f.s);
      if (f.z > 0.6 && f.z < p.farZ - 3) f.seg = segmentAt(p, f.z);
    }
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
    const p = view.projection, quads = app.quads;
    for (const f of this.flashes) {
      if (f.seg !== k) continue;
      if (view.camera === CAMERA.COCKPIT && (view.carIndex === f.owner || (f.other >= 0 && (view.carIndex === f.car || view.carIndex === f.other)))) continue;   // on the cockpit instead
      const anchor = f.car >= 0 ? app.race.cars[f.car] : null;
      if (!projectAtDepth(p, f.z, anchor ? anchor.d + f.d : f.d, f.h, pt)) continue;
      // the star snaps to full size at once, then shrinks: a drawn flash, not a fade
      const t = f.age / f.life;
      const size = Math.min(view.rect.h * 0.3, f.size * pt.scale) * (t < 0.25 ? 0.7 + 1.2 * t : 1 - (t - 0.25) * 0.55);
      quads.rotated(this.burst, pt.x, pt.y, size, size, f.s * 7, 0.5, 0.5, 1, 1, 1, 1);
    }
    for (const b of this.blasts) if (b.seg === k) this.drawBlast(app, view, b);
    let i = this.segHead[k];
    if (i < 0) return;
    for (; i >= 0; i = this.pnext[i]) {
      if (!projectAtDepth(p, this.pz[i], this.pd[i], this.ph[i], pt)) continue;
      const t = this.page[i] / this.plife[i];
      if (this.pkind[i] === 1) {
        if (this.pz[i] < 4) continue;                         // a spark against the lens would be a blurred blot
        const s = Math.min(view.rect.h * 0.03, this.psize[i] * pt.scale) * (1 - t * 0.8);
        quads.sprite(this.spark, pt.x - s / 2, pt.y - s / 2, s, s, this.pr[i], this.pg[i], this.pb[i], 1, this.pz[i], false);
      } else {
        // drawn smoke stays opaque (no ghosting of contours), swells, then shrinks away at the end of its life
        // (a puff is always opaque: it swells in, shrinks away, never fills the picture, and none is drawn against the camera)
        if (this.pz[i] < 6) continue;
        const cap = view.rect.h * 0.16;
        const grow = t < 0.1 ? t / 0.1 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        const size = Math.min(cap, (this.psize[i] + this.pgrow[i] * Math.sqrt(t)) * pt.scale) * grow;
        if (size < 2) continue;
        const alpha = 1;
        quads.sprite(this.puffs[i % 3], pt.x - size / 2, pt.y - size * 0.85, size, size, this.pr[i], this.pg[i], this.pb[i], alpha, this.pz[i], (i & 1) === 1);
      }
    }
  }

  /**
   * Explosion of a wrecked car, in four drawn phases timed on the car's clock since the landing:
   * the fireball grows, burns at full size (two drawings alternate), darkens, turns to smoke;
   * two plumes then rise from the front wheels. Opaque flat drawings, no fading.
   */
  drawBlast(app, view, b) {
    const car = app.race.cars[b.car];
    // seen from the car's own cockpit the explosion belongs to the cockpit drawing (see buildFront)
    if (view.camera === CAMERA.COCKPIT && view.carIndex === b.car) return;
    const p = view.projection, age = car.clock - car.landClock, cap = view.rect.h * 0.42;
    const side = car.launchSide || -1;
    if (age < BLAST.smokeEnd && projectAtDepth(p, b.z, car.d + side * 0.8, 0.55, pt)) {
      this.blastFire(app.quads, age, pt.x, pt.y, Math.min(cap, 2.6 * pt.scale));
    }
    if (age > BLAST.plumeStart && age < BLAST.end) {
      const u = (age - BLAST.plumeStart) / (BLAST.end - BLAST.plumeStart);
      for (let w = -1; w <= 1; w += 2) {
        if (!projectAtDepth(p, b.z + 0.3, car.d + w * 0.85, 0.7 + u * 1.3, pt)) continue;
        this.blastPlume(app.quads, u, pt.x, pt.y, Math.min(cap * 0.5, 0.8 * pt.scale), w);
      }
    }
  }

  /** Fireball of an explosion at (x, y), `size` pixels across at full size, `age` seconds after the landing. */
  blastFire(quads, age, x, y, size) {
    let scale, r = 1, g = 1, bl = 1, sprite = this.fire[Math.floor(age / 0.08) & 1];
    if (age < BLAST.grow) scale = 0.15 + 0.85 * Math.sqrt(age / BLAST.grow);
    else if (age < BLAST.full) scale = 1 + 0.06 * Math.sin((age - BLAST.grow) * 30);
    else if (age < BLAST.dark) { const u = (age - BLAST.full) / (BLAST.dark - BLAST.full); scale = 1 - 0.15 * u; r = 0.78; g = 0.42; bl = 0.4; }
    else { scale = 1.05; sprite = this.puffs[1]; r = 0.2; g = 0.2; bl = 0.25; }
    const s = size * scale;
    quads.sprite(sprite, x - s / 2, y - s * 0.62, s, s, r, g, bl, 1, 0, false);
  }

  /** One of the two dark plumes that end an explosion (u = 0..1 along its life). */
  blastPlume(quads, u, x, y, size, side) {
    const s = size * (1 + 0.75 * u) * (u > 0.75 ? 1 - (u - 0.75) * 2.4 : 1);
    quads.sprite(this.puffs[side > 0 ? 0 : 2], x - s / 2, y - s / 2, s, s, 0.22, 0.22, 0.28, 1, 0, side > 0);
  }

  /** Screen-space bursts and sound words of this view. */
  buildFront(app, view) {
    const quads = app.quads, r = view.rect;
    // explosion of the followed car, seen from its cockpit: on the front wheel that took the hit,
    // then a plume over each front wheel (positions in the units of the cockpit drawing)
    if (view.camera === CAMERA.COCKPIT) {
      for (const b of this.blasts) {
        if (b.car !== view.carIndex) continue;
        const car = app.race.cars[b.car], age = car.clock - car.landClock;
        if (age < 0 || age > BLAST.end || !car.landHard) continue;
        const place = cockpitPlacement(view), k = place.k, cx = r.w / 2, side = car.launchSide || -1;
        if (age < BLAST.smokeEnd) this.blastFire(quads, age, cx + side * 800 * k, place.oy + 430 * k, 470 * k);
        if (age > BLAST.plumeStart) {
          const t = (age - BLAST.plumeStart) / (BLAST.end - BLAST.plumeStart);
          for (let w = -1; w <= 1; w += 2) this.blastPlume(quads, t, cx + w * 820 * k, place.oy + (330 - 260 * t) * k, 200 * k, w);
        }
      }
    }
    // contact spark of the followed car, seen from its cockpit: on the front wheel that touched (side by
    // side) or at the tip of the nose (bump from behind), placed like the cockpit drawing itself, by
    // projecting the point of the car from the driver's eye
    if (view.camera === CAMERA.COCKPIT) {
      for (const f of this.flashes) {
        if (f.life <= 0) continue;
        const D = CAR_DIMENSIONS, eye = D.eye;
        let ahead, right, up;
        if (f.owner === view.carIndex) { ahead = f.ahead; right = f.right; up = f.up; }
        else if (f.other >= 0 && (view.carIndex === f.car || view.carIndex === f.other)) {
          const mine = app.race.cars[view.carIndex], theirs = app.race.cars[view.carIndex === f.car ? f.other : f.car];
          if (f.wheel) { ahead = D.frontAxleX; right = (theirs.d > mine.d ? 1 : -1) * (D.frontTrack + D.frontTyre.width * 0.5); up = D.frontTyre.radius; }
          else if (view.carIndex === f.car) { ahead = mine.params.halfLength; right = clamp((theirs.d - mine.d) * 0.5, -0.6, 0.6); up = 0.42; }
          else continue;                                           // bumped from behind: nothing to see ahead
        } else continue;
        const place = cockpitPlacement(view), scale = (COCKPIT_REF_FOCAL / (ahead - eye[0])) * place.k;
        const t = f.age / f.life;
        const size = Math.min(r.h * 0.26, f.size * scale) * (t < 0.25 ? 0.7 + 1.2 * t : 1 - (t - 0.25) * 0.55);
        quads.rotated(this.burst, r.w / 2 + right * scale, place.oy + (eye[2] - up) * scale, size, size, f.s * 7, 0.5, 0.5, 1, 1, 1, 1);
      }
    }
    const u = Math.min(r.w / 2560, (r.h / 1440) * (view.wide ? 1.6 : 1));
    for (const p of this.pops[view.index]) {
      if (p.life <= 0) continue;
      const t = p.age / p.life;
      const popIn = clamp(p.age / (p.burst ? 0.07 : 0.18), 0, 1);
      const scale = ((p.burst ? 0.55 : 0.15) + (p.burst ? 0.45 : 0.85) * popIn + (p.burst ? t * 0.35 : Math.sin(p.age * 38) * 0.02)) * p.size * u;
      const alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      const cx = p.x * r.w, cy = p.y * r.h;
      if (p.burst) {
        const s = 620 * scale;
        const out = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;         // leaves by shrinking, never by fading
        quads.rotated(this.burst, cx, cy, s * out, s * out, p.angle * 2, 0.5, 0.5, 1, 1, 1, 1);
      } else {
        const sp = this.words[p.word];
        const out = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
        quads.rotated(sp, cx, cy, sp.w * scale * out, sp.h * scale * out, p.angle - 0.08, 0.5, 0.5, 1, 1, 1, 1);
      }
    }
  }
}
