// Scene composition for one view: walks the projected road from the horizon toward the viewer
// and emits quads back to front (painter's order) for, in each road segment:
//   objects standing behind tall strips, strips (tree line, stand, fence, barrier...),
//   objects in front, then cars. Levels of detail: far strips are merged over several segments,
// small objects have a shorter draw distance, sprite mip levels do the rest.
// Reads the simulation, never writes it. No allocation per frame.

import { mod, wrapAngle } from '../../core/math.js';
import { MAX_NODES, depthOf, segmentAt, projectAtDepth, projectNode } from '../projection/road-projection.js';
import { QUAD_MODE } from './quad-batch.js';
import { CAMERA } from '../compositing/race-view.js';
import { CAR_STATE } from '../../physics/car-physics.js';
import { RACE_PHASE } from '../../gameplay/race.js';
import { GANTRY_LIGHTS } from '../../art/environments/trackside.js';
import { hexToRgb } from '../../art/palettes/palettes.js';

const DEFAULT_GANTRY_LIGHTS = [0.42, 0.46, 0.5, 0.54, 0.58].map((fx) => ({ fx, fy: 0.3, fr: 0.014 }));

const MAX_CARS = 32;
const NEAR_CAR = 1.9;        // a car whose centre is nearer than this (alongside, already out of the picture) is not drawn
const NEAR_CAR_FADE = 0.5;   // and it fades in over this distance, so that it never pops
const pt = { x: 0, y: 0, scale: 0, z: 0, theta: 0 };
const ptB = { x: 0, y: 0, scale: 0, z: 0, theta: 0 };

/**
 * Which drawing of a car to show for an angle between its nose and the line of sight
 * (radians, 0 = seen from behind, positive = nose pointing to the right). Drawings cover 0..180
 * degrees; the other side uses the same drawing mirrored. Returns the drawing index, or
 * -(index + 1) when it must be mirrored.
 */
export function carViewFrame(alpha, count) {
  const step = Math.PI / (count - 1);
  const mirrored = alpha < 0;
  let index = Math.round(Math.abs(alpha) / step);
  if (index > count - 1) index = count - 1;
  return mirrored && index > 0 && index < count - 1 ? -(index + 1) : index;
}

export class SceneBuilder {
  constructor(art) {
    this.ambient = [1, 1, 1];
    this.mirror = { sky: [0.8, 0.9, 0.95], relief: [0.6, 0.7, 0.8], verge: [0.4, 0.65, 0.3], road: [0.42, 0.43, 0.47], line: [0.95, 0.94, 0.9], barrier: [0.72, 0.71, 0.69] };
    this.art = art;
    this.layout = null;
    this.track = null;
    this.carS = new Float32Array(MAX_CARS); this.carD = new Float32Array(MAX_CARS);
    this.carZ = new Float32Array(MAX_CARS); this.carNext = new Int16Array(MAX_CARS);
    this.segHead = new Int16Array(MAX_NODES);
    this.carCount = 0;
    this.carAngleStep = Math.PI / (art.cars.length - 1 || 1);
    this.effects = null;       // optional EffectsLayer: { reset, onEvent, update, buildView }
    this.cockpit = null;       // optional CockpitLayer: { buildFront }
    this.lamps = null;         // [off, red, green] lamp sprites for the start gantry
    this.gantryLights = GANTRY_LIGHTS || DEFAULT_GANTRY_LIGHTS;
    this.lightsLit = 0; this.lightsGreen = false; this.greenTimer = 99;
  }

  /** Bind a race: resolve the drawings named by the circuit layout. */
  reset(race, track, layout, palette) {
    this.track = track; this.layout = layout;
    this.obstacleDown = race.obstacleDown || null;
    // light of the place over the cars and the cockpit; colours of the rear view in the mirrors
    this.ambient = hexToRgb(palette.ambient);
    this.mirror = {
      sky: hexToRgb(palette.skyLow), relief: hexToRgb(palette.farRelief), verge: hexToRgb(palette.grassA),
      road: hexToRgb(palette.asphalt), line: hexToRgb(palette.paint), barrier: hexToRgb(palette.concrete),
    };
    this.greenTimer = 99;
    for (const strip of layout.strips) {
      strip.sprite = this.art.sprite(strip.id);
      // buildings along the road are volumes: the end of a run shows a gable of this depth (m)
      strip.gable = /grandstand/.test(strip.id) ? 7 : /pitbuilding|facade/.test(strip.id) ? 10 : /crowdbank/.test(strip.id) ? 5 : 0;
      strip.gableWindows = /pitbuilding|facade/.test(strip.id);
      strip.edgeTrees = /forest/.test(strip.id);          // a tree mass ends on the outline of its last trees, not on a straight cut
    }
    // the tree drawn at both ends of a tree mass: the first kind of tree this circuit plants
    this.edgeTree = null;
    for (const prop of layout.props) if (prop.id.startsWith('tree.')) { this.edgeTree = this.art.sprite(prop.id); break; }
    this.gableWall = hexToRgb(palette.concrete); this.gableTop = hexToRgb(palette.metalShade); this.gableGlass = hexToRgb(palette.glassShade); this.inkColor = hexToRgb(palette.ink);
    for (const prop of layout.props) {
      prop.sprite = this.art.sprite(prop.id);
      prop.lights = prop.id === 'gantry.start';
    }
    // order the strips of every sample from the farthest from the road to the nearest
    const dist = (s, i) => (s.absolute ? s.offset - (s.side > 0 ? track.barrierR[i] : track.barrierL[i]) : s.offset);
    for (let i = 0; i < track.n; i++) {
      const list = layout.stripsAt[i];
      list.sort((a, b) => dist(layout.strips[b], i) - dist(layout.strips[a], i));
      // an object is drawn just before the first strip on its side that stands nearer to the road
      // than itself (so a bush behind the guard rail stays behind it, a tree behind the stand too)
      for (let q = layout.propStart[i]; q < layout.propStart[i + 1]; q++) {
        const prop = layout.props[q], side = prop.d > 0 ? 1 : -1;
        const beyond = Math.abs(prop.d) - (side > 0 ? track.barrierR[i] : track.barrierL[i]);
        prop.slot = list.length;
        for (let k = 0; k < list.length; k++) {
          const strip = layout.strips[list[k]];
          if (strip.side === side && dist(strip, i) < beyond) { prop.slot = k; break; }
        }
      }
    }
    if (this.effects) this.effects.reset(race, track, palette);
  }

  onEvent(event, app) {
    if (event.type === 'wall' || event.type === 'contact' || event.type === 'crash') {
      const strength = event.type === 'crash' ? 1 : Math.min(1, event.value / 16);
      for (let v = 0; v < app.viewCount; v++) {
        const view = app.views[v];
        if (view.carIndex === event.car || view.carIndex === event.other) view.addImpact(strength);
      }
    }
    if (event.type === 'green') this.greenTimer = 0;
    if (this.effects) this.effects.onEvent(event, app);
  }

  /** Per-frame state shared by all views: extrapolated car positions. */
  update(app, dt, ahead) {
    const cars = app.race.cars;
    this.carCount = Math.min(cars.length, MAX_CARS);
    for (let i = 0; i < this.carCount; i++) {
      const car = cars[i];
      const c = Math.cos(car.headingError), s = Math.sin(car.headingError);
      const moving = car.state === CAR_STATE.RACING || car.state === CAR_STATE.RETIRED;
      this.carS[i] = car.s + (moving ? (car.speed * c - car.vLat * s) * ahead : 0);
      this.carD[i] = car.d + (moving ? (car.speed * s + car.vLat * c) * ahead : 0);
    }
    this.greenTimer += dt;
    this.lightsGreen = app.race.phase !== RACE_PHASE.COUNTDOWN && this.greenTimer < 2.5;
    this.lightsLit = app.race.phase === RACE_PHASE.COUNTDOWN ? app.race.lights : 0;
    if (this.effects) this.effects.update(app, dt);
  }

  buildView(app, view) {
    this.viewSerial = (this.viewSerial || 0) + 1;
    const p = view.projection, quads = app.quads, layout = this.layout, track = this.track;
    const cars = app.race.cars, n = track.n;
    const W = view.rect.w, H = view.rect.h;
    const detail = app.quality.detail, propReach = app.quality.propDistance;
    const nodeCount = p.nodeCount, dir = p.dir;
    const segHead = this.segHead, carNext = this.carNext, carZ = this.carZ;
    for (let k = 0; k < nodeCount; k++) segHead[k] = -1;
    const ownCar = view.camera === CAMERA.COCKPIT ? view.carIndex : -1;
    for (let i = 0; i < this.carCount; i++) {
      if (i === ownCar || cars[i].removed) continue;
      const z = depthOf(p, this.carS[i]);
      if (z < NEAR_CAR || z > p.farZ - 3) continue;
      carZ[i] = z;
      const k = segmentAt(p, z);
      // keep each segment's list sorted far to near
      let prev = -1, cur = segHead[k];
      while (cur >= 0 && carZ[cur] > z) { prev = cur; cur = carNext[cur]; }
      carNext[i] = cur;
      if (prev < 0) segHead[k] = i; else carNext[prev] = i;
    }
    const yawAngle = Math.atan(p.yawTan);
    if (this.effects) this.effects.beginView(app, view);
    for (let k = nodeCount - 2; k >= 0; k--) {
      const zNear = p.nodeZ[k], zFar = p.nodeZ[k + 1];
      const sample = p.segSample[k];
      const from = layout.propStart[sample], to = layout.propStart[sample + 1];
      const list = layout.stripsAt[sample];
      if (list.length) {
        const lodStep = dir > 0 ? (zNear > 700 ? 4 : zNear > 320 ? 2 : 1) : 1;
        for (let q = 0; q < list.length; q++) {
          if (to > from) this.emitProps(quads, p, layout, from, to, q, dir, W, propReach, detail);
          const strip = layout.strips[list[q]];
          let step = lodStep < strip.tile ? lodStep : strip.tile;
          if (step > 1 && (sample % step !== 0 || k === 0)) { if (sample % step !== 0) continue; step = 1; }
          if (strip.gable > 0 && k > 0 && sample === (dir > 0 ? strip.from : (strip.from + strip.count - 1) % track.n)) this.emitGable(quads, p, track, strip, k, sample);
          const kEnd = Math.min(k + step, nodeCount - 1);
          this.emitStrip(quads, p, track, strip, k, kEnd, sample, W, H);
          if (strip.edgeTrees && this.edgeTree) {
            // (far away the strip is drawn in pieces of several samples: the ends fall inside a piece)
            const rel = mod(sample - strip.from, track.n), toLast = strip.count - 1 - rel;
            if (rel < step) this.emitEdgeTree(quads, p, track, strip, dir > 0 ? k : kEnd);
            if (toLast >= 0 && toLast < step) this.emitEdgeTree(quads, p, track, strip, dir > 0 ? Math.min(k + toLast + 1, nodeCount - 1) : k);
          }
        }
      }
      if (to > from) this.emitProps(quads, p, layout, from, to, list.length, dir, W, propReach, detail);
      for (let i = segHead[k]; i >= 0; i = carNext[i]) this.emitCar(quads, p, cars[i], i, yawAngle, W);
      if (this.effects) this.effects.buildSegment(app, view, k, zNear, zFar);
    }
  }

  /** Tree standing on the end of a tree-mass strip, hiding its straight edge behind an irregular outline. */
  emitEdgeTree(quads, p, track, strip, node) {
    if (node < 1) return;
    const side = strip.side, sampleAt = p.nodeSample[node];
    const d = side * (strip.absolute ? strip.offset : (side > 0 ? track.barrierR : track.barrierL)[sampleAt] + strip.offset);
    projectNode(p, node, d, strip.base, pt);
    const sp = this.edgeTree, h = strip.height * 1.1 * pt.scale, w = h * (sp.w / sp.h) * 1.15;
    if (h < 6 || h > sp.h * 2.4) return;
    quads.sprite(sp, pt.x - w * 0.5, pt.y - h, w, h, 1, 1, 1, 1, pt.z, false);
    quads.sprite(sp, pt.x - w * 0.5 - side * w * 0.42, pt.y - h * 0.86, w * 0.86, h * 0.86, 1, 1, 1, 1, pt.z, true);   // a second, smaller one steps the edge down
  }

  /** End wall of a building strip, facing the camera at the start of its run: a plain inked gable. */
  emitGable(quads, p, track, strip, k, sample) {
    const side = strip.side, barrier = side > 0 ? track.barrierR : track.barrierL;
    const d0 = side * (strip.absolute ? strip.offset : barrier[sample] + strip.offset);
    projectNode(p, k, d0, strip.base, pt);
    const x0 = pt.x, y = pt.y, z = pt.z, scale = pt.scale, h = strip.height * scale;
    projectNode(p, k, d0 + side * strip.gable, strip.base, ptB);
    const xa = Math.min(x0, ptB.x), xb = Math.max(x0, ptB.x);
    if (xb - xa < 2 || h < 4) return;
    const wall = this.gableWall, top = this.gableTop, ink = this.inkColor, line = Math.max(1, 0.09 * scale);
    const flat = (x, yy, w, hh, c, shade) => quads.quad(x, yy, 1, x + w, yy, 1, x, yy + hh, 1, x + w, yy + hh, 1, 0, 0, 0, 0, 0, QUAD_MODE.FLAT, c[0] * shade, c[1] * shade, c[2] * shade, 1, z);
    flat(xa, y - h, xb - xa, h, wall, 1);
    flat(xa, y - h, xb - xa, h * 0.1, top, 1);                       // edge of the roof
    flat(xa, y - h * 0.34, xb - xa, h * 0.34, wall, 0.86);           // plinth in shade
    flat(xa, y - h, xb - xa, line, ink, 1); flat(xa, y - h * 0.9, xb - xa, line * 0.6, ink, 1); flat(xa, y - h * 0.34, xb - xa, line * 0.6, ink, 1);
    flat(xa, y - h, line, h, ink, 1); flat(xb - line, y - h, line, h, ink, 1);
    // two rows of windows and a service door, so that the wall reads as a building
    const gw = xb - xa, glass = this.gableGlass;
    if (gw > 30 && strip.gableWindows) {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
        const wx = xa + gw * (0.14 + col * 0.27), wy = y - h * (0.82 - row * 0.22), ww = gw * 0.18, wh = h * 0.12;
        flat(wx - line * 0.5, wy - line * 0.5, ww + line, wh + line, ink, 1);
        flat(wx, wy, ww, wh, glass, 1);
        flat(wx, wy, ww, wh * 0.35, glass, 1.25);
      }
      flat(xa + gw * 0.42 - line * 0.5, y - h * 0.2 - line * 0.5, gw * 0.16 + line, h * 0.2, ink, 1);
      flat(xa + gw * 0.42, y - h * 0.2, gw * 0.16, h * 0.2, top, 0.8);
    }
  }

  emitStrip(quads, p, track, strip, kNear, kFar, sample, W, H) {
    const sp = strip.sprite, n = track.n, dir = p.dir, side = strip.side;
    const barrier = side > 0 ? track.barrierR : track.barrierL;
    const sampleFar = p.nodeSample[kFar];
    const sampleNear = kNear === 0 ? sample : p.nodeSample[kNear];
    const dNear = side * (strip.absolute ? strip.offset : barrier[sampleNear] + strip.offset);
    const dFar = side * (strip.absolute ? strip.offset : barrier[sampleFar] + strip.offset);
    let zN, xN, yNb, yNt;
    const clipped = kNear === 0;       // the first segment starts at the near plane, not at a node
    if (clipped) {
      zN = p.near;
      if (p.nodeZ[kFar] <= zN + 0.05) return;
      if (!projectAtDepth(p, zN, dNear, strip.base, pt)) return;
      xN = pt.x; yNb = pt.y; yNt = pt.y - strip.height * pt.scale;
    } else {
      projectNode(p, kNear, dNear, strip.base, pt);
      zN = pt.z; xN = pt.x; yNb = pt.y; yNt = pt.y - strip.height * pt.scale;
    }
    projectNode(p, kFar, dFar, strip.base, ptB);
    const zF = ptB.z, xF = ptB.x, yFb = ptB.y, yFt = ptB.y - strip.height * ptB.scale;
    if ((xN < -4 && xF < -4) || (xN > W + 4 && xF > W + 4)) return;
    if (yNt > H + 2 && yFt > H + 2) return;
    // texture coordinate along the track, in tiles
    const tile = strip.tile;
    let aPos, bPos;       // sample positions of the lower-s and higher-s ends
    if (dir > 0) {
      bPos = sampleFar;
      aPos = clipped ? sampleFar - (p.nodeZ[kFar] - zN) / p.ds : sampleFar - (kFar - kNear);
    } else {
      // looking backwards: the near end has the higher s
      const nearPos = clipped ? sampleFar + (p.nodeZ[kFar] - zN) / p.ds : sampleFar + (kFar - kNear);
      aPos = sampleFar; bPos = nearPos;
    }
    let ua = mod(aPos - strip.from + strip.phase, tile) / tile;
    let ub = ua + (bPos - aPos) / tile;
    if (ub > 1.0001) { ua -= ub - 1; ub = 1; if (ua < 0) ua = 0; }
    let uNear = dir > 0 ? ua : ub, uFar = dir > 0 ? ub : ua;
    if (side > 0) { uNear = 1 - uNear; uFar = 1 - uFar; }   // lettering reads left to right from the road
    const du = sp.u1 - sp.u0;
    quads.quad(xN, yNt, zN, xF, yFt, zF, xN, yNb, zN, xF, yFb, zF,
      sp.u0 + du * uNear, sp.v0, sp.u0 + du * uFar, sp.v1, sp.layer, QUAD_MODE.SPRITE, 1, 1, 1, 1, zN);   // hidden by crests nearer than its near end (testing the middle would nibble its foot)
    if (strip.edgeTrees && this.edgeTree) {
      // where the road bends, a tree mass turns away from the eye and its outline would be a
      // straight vertical line (the edge of a flat drawing): a tree stands on that fold
      const facing = (xF - xN) * -side > 0;
      if (strip.foldView === this.viewSerial && strip.foldNode === kFar && strip.foldFacing !== facing) this.emitEdgeTree(quads, p, track, strip, kFar);
      strip.foldView = this.viewSerial; strip.foldNode = kNear; strip.foldFacing = facing;
    }
  }

  emitProps(quads, p, layout, from, to, slot, dir, W, reachLimit, detail) {
    // inside a sample objects are stored by increasing s: walk them far to near
    const start = dir > 0 ? to - 1 : from, end = dir > 0 ? from - 1 : to, inc = dir > 0 ? -1 : 1;
    for (let q = start; q !== end; q += inc) {
      const prop = layout.props[q];
      if (prop.slot !== slot || (prop.obstacle >= 0 && this.obstacleDown && this.obstacleDown[prop.obstacle])) continue;
      const z = depthOf(p, prop.s);
      const reach = prop.reach < reachLimit ? prop.reach : reachLimit;
      if (z < 1.2 || z > reach * detail) continue;
      if (!projectAtDepth(p, z, prop.d, 0, pt)) continue;
      const sp = prop.sprite;
      const w = sp.worldW * prop.scale * pt.scale, h = sp.worldH * prop.scale * pt.scale;
      if (h < 3 || pt.x + w * 0.5 < 0 || pt.x - w * 0.5 > W) continue;
      // fade in at the limit of the draw distance instead of popping; an object the camera is right
      // against would be drawn far above the size it was inked at, so it is left out
      if (h > (sp.h || h) * 2.4) continue;                 // (dropped outright: a half-faded object reads as a ghost)
      const fade = z > reach * detail - 60 ? (reach * detail - z) / 60 : 1;
      quads.sprite(sp, pt.x - w * 0.5, pt.y - h, w, h, 1, 1, 1, fade, z, prop.flip);
      if (prop.lights && this.lamps && z < 400) {
        const left = pt.x - w * 0.5, top = pt.y - h;
        for (let i = 0; i < this.gantryLights.length; i++) {
          const l = this.gantryLights[i];
          const lamp = this.lightsGreen ? this.lamps[2] : i < this.lightsLit ? this.lamps[1] : null;
          if (!lamp) continue;
          const s = l.fr * w * 2.5;
          quads.sprite(lamp, left + l.fx * w - s / 2, top + l.fy * h - s / 2, s, s, 1, 1, 1, 1, z, false);
        }
      }
    }
  }

  emitCar(quads, p, car, index, yawAngle, W) {
    const z = this.carZ[index];
    if (!projectAtDepth(p, z, this.carD[index], car.airHeight || 0, pt)) return;      // a car in flight is drawn above the road
    // angle between the car's nose and the line of sight (0 = seen from behind, + = nose to the right)
    const lateral = (pt.x - p.cx) / p.focal;
    let alpha = wrapAngle(pt.theta - yawAngle + car.headingError + (p.dir < 0 ? Math.PI : 0) - Math.atan(lateral));
    const frame = carViewFrame(alpha, this.art.cars.length);
    const flip = frame < 0;
    const cs = this.art.cars[flip ? -frame - 1 : frame];
    const k = pt.scale / cs.ppm;
    const w = cs.w * k, h = cs.h * k;
    const left = pt.x - (flip ? cs.w - cs.ax : cs.ax) * k, top = pt.y - cs.ay * k;
    if (left > W || left + w < 0) return;
    // cars that cannot be hit are drawn lighter: being put back on the track, restarting, or stopped after an accident
    let ghost = car.ghostTimer > 0 || car.state === CAR_STATE.RESET || (car.state === CAR_STATE.WRECKED && car.speed < 0.5) ? 0.55 : 1;
    if (z < NEAR_CAR + NEAR_CAR_FADE) ghost *= (z - NEAR_CAR) / NEAR_CAR_FADE;
    const u0 = flip ? 1 : 0, u1 = flip ? 0 : 1;
    quads.quad(left, top, 1, left + w, top, 1, left, top + h, 1, left + w, top + h, 1,
      u0, 0, u1, 1, cs.layer, QUAD_MODE.CAR + car.teamIndex, this.ambient[0], this.ambient[1], this.ambient[2], ghost, z > 3.4 ? z - 2.9 : 0.5);   // clip test at the car's near end: the drawing extends in front of its centre
  }

  /** Cockpit and other per-view foreground drawings. */
  buildFront(app, view) {
    if (this.cockpit) this.cockpit.buildFront(app, view);
    if (this.effects) this.effects.buildFront(app, view);
    if (app.viewCount > 1) {
      // split screen: each view is a panel of the page, with its inked frame
      const r = view.rect, w = Math.max(2, Math.round(Math.min(app.canvas.width, app.canvas.height) * 0.0035));
      const q = app.quads, i = 0.086, j = 0.086, b = 0.122;
      q.rect(0, 0, r.w, w, i, j, b, 1); q.rect(0, r.h - w, r.w, w, i, j, b, 1);
      q.rect(0, 0, w, r.h, i, j, b, 1); q.rect(r.w - w, 0, w, r.h, i, j, b, 1);
    }
  }
}
