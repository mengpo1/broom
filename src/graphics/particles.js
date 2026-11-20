// CPU particle pool (smoke, dust, sparks), skid marks and contact shadows. Writes straight into
// the renderer's preallocated arrays; no allocation after construction.

import { MAX_PARTICLES, PARTICLE_FLOATS, MAX_DECAL_QUADS, DECAL_VERTEX_FLOATS, MAX_CARS } from './renderer.js';
import { CAR_STATE } from '../physics/car-physics.js';
import { CAR_GEOMETRY } from '../vehicles/car-mesh.js';
import { SURFACE } from '../tracks/track-builder.js';

const KIND = { SMOKE: 0, DUST: 1, SPARK: 2 };
const SHADOW_QUADS = MAX_CARS;
const SKID_QUADS = MAX_DECAL_QUADS - SHADOW_QUADS;

export class Effects {
  constructor(renderer, density = 1) {
    this.renderer = renderer;
    this.density = density;
    const n = MAX_PARTICLES;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
    this.life = new Float32Array(n); this.maxLife = new Float32Array(n);
    this.size = new Float32Array(n); this.growth = new Float32Array(n);
    this.r = new Float32Array(n); this.g = new Float32Array(n); this.b = new Float32Array(n); this.a = new Float32Array(n);
    this.kind = new Uint8Array(n); this.rot = new Float32Array(n);
    this.count = 0;
    this.seed = 12345;
    this.skidCursor = 0;
    this.lastWheel = new Float32Array(MAX_CARS * 2 * 4); // x, y, z, active per rear wheel
    this.accumulator = new Float32Array(MAX_CARS);
    this.time = 0;
    this.theme = null;
  }

  reset(theme) {
    this.count = 0; this.skidCursor = 0; this.lastWheel.fill(0); this.theme = theme; this.time = 0;
  }

  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  spawn(kind, x, y, z, vx, vy, vz, size, growth, life, r, g, b, a) {
    if (this.count >= MAX_PARTICLES) return;
    const i = this.count++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.size[i] = size; this.growth[i] = growth; this.life[i] = life; this.maxLife[i] = life;
    this.r[i] = r; this.g[i] = g; this.b[i] = b; this.a[i] = a; this.kind[i] = kind; this.rot[i] = this.random() * 6.28;
  }

  /** Burst of sparks at a contact point. */
  sparks(x, y, z, dirX, dirZ, strength) {
    const count = Math.min(26, Math.round((4 + strength * 1.6) * this.density));
    for (let k = 0; k < count; k++) {
      const s = 3 + this.random() * (4 + strength * 0.6);
      this.spawn(KIND.SPARK, x, y + 0.2 + this.random() * 0.3, z, dirX * s + (this.random() - 0.5) * 6, 1.5 + this.random() * 4, dirZ * s + (this.random() - 0.5) * 6,
        0.035 + this.random() * 0.035, 0, 0.25 + this.random() * 0.45, 1, 0.62, 0.22, 1);
    }
  }

  addSkid(carIndex, wheel, x, y, z, rx, rz, width, strength) {
    const o = (carIndex * 2 + wheel) * 4, lw = this.lastWheel;
    const data = this.renderer.decalData;
    if (lw[o + 3] > 0) {
      const dx = x - lw[o], dz = z - lw[o + 2];
      const len = Math.hypot(dx, dz);
      if (len < 0.35) return;
      if (len < 6) {
        const quad = SHADOW_QUADS + this.skidCursor;
        this.skidCursor = (this.skidCursor + 1) % SKID_QUADS;
        let v = quad * 4 * DECAL_VERTEX_FLOATS;
        const hw = width / 2;
        const put = (px, py, pz, u, vv) => { data[v] = px; data[v + 1] = py + 0.016; data[v + 2] = pz; data[v + 3] = u; data[v + 4] = vv; data[v + 5] = strength; data[v + 6] = this.time; v += DECAL_VERTEX_FLOATS; };
        put(lw[o] - rx * hw, lw[o + 1], lw[o + 2] - rz * hw, -1, 0);
        put(lw[o] + rx * hw, lw[o + 1], lw[o + 2] + rz * hw, 1, 0);
        put(x + rx * hw, y, z + rz * hw, 1, len);
        put(x - rx * hw, y, z - rz * hw, -1, len);
        this.renderer.markDecals(quad, 1);
      }
    }
    lw[o] = x; lw[o + 1] = y; lw[o + 2] = z; lw[o + 3] = 1;
  }

  /**
   * Emit effects from the cars' state, advance particles and fill GPU arrays.
   * @returns {number} live particle count
   */
  update(race, visuals, dt) {
    this.time += dt;
    const theme = this.theme, G = CAR_GEOMETRY;
    const decals = this.renderer.decalData;
    const cars = race.cars;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i], pose = visuals.poses[i];
      // ---- contact shadow quad
      let v = i * 4 * DECAL_VERTEX_FLOATS;
      const ch = Math.cos(pose.heading), sh = Math.sin(pose.heading);
      const fx = ch, fz = sh, rx = -sh, rz = ch;
      const visible = pose.visible ? 0.72 : 0;
      for (let k = 0; k < 4; k++) {
        const cu = k === 0 || k === 3 ? -1 : 1, cv = k < 2 ? -1 : 1;
        decals[v] = pose.x + fx * cv * 2.75 + rx * cu * 1.3;
        decals[v + 1] = pose.y + 0.02 + (cv * 2.75) * Math.sin(pose.pitch);
        decals[v + 2] = pose.z + fz * cv * 2.75 + rz * cu * 1.3;
        decals[v + 3] = cu; decals[v + 4] = cv; decals[v + 5] = visible; decals[v + 6] = -1;
        v += DECAL_VERTEX_FLOATS;
      }
      if (!pose.visible) continue;
      const speed = Math.abs(car.speed);
      const moving = car.state === CAR_STATE.RACING || car.state === CAR_STATE.SPIN || car.state === CAR_STATE.RETIRED;
      const offRoad = car.surface === SURFACE.GRASS || car.surface === SURFACE.GRAVEL;
      const slide = Math.max(car.slip - 0.22, car.wheelspin - 0.25, car.state === CAR_STATE.SPIN ? 1 : 0);
      // ---- skid marks from the rear wheels
      for (let w = 0; w < 2; w++) {
        const side = w === 0 ? -1 : 1;
        const wx = pose.x + fx * -G.rearAxleZ + rx * side * G.rearTrackHalf;
        const wz = pose.z + fz * -G.rearAxleZ + rz * side * G.rearTrackHalf;
        if (moving && slide > 0 && !offRoad && speed > 3) this.addSkid(i, w, wx, pose.y, wz, rx, rz, G.rearWheelWidth * 0.9, Math.min(0.85, 0.3 + slide * 0.7));
        else this.lastWheel[(i * 2 + w) * 4 + 3] = 0;
      }
      // ---- smoke / dust
      let rate = 0, kind = KIND.SMOKE;
      if (moving && !offRoad && slide > 0 && speed > 4) rate = 22 * Math.min(1.5, slide + 0.3);
      else if (moving && offRoad && speed > 6) { rate = Math.min(40, 8 + speed * 0.7); kind = KIND.DUST; }
      if (car.engineOut && car.state === CAR_STATE.RETIRED) { rate = 16; kind = KIND.SMOKE; }
      this.accumulator[i] += rate * dt * this.density;
      while (this.accumulator[i] >= 1) {
        this.accumulator[i] -= 1;
        const side = this.random() < 0.5 ? -1 : 1;
        const back = kind === KIND.DUST && this.random() < 0.4 ? -G.frontAxleZ : -G.rearAxleZ;
        const x = pose.x + fx * back + rx * side * G.rearTrackHalf, z = pose.z + fz * back + rz * side * G.rearTrackHalf;
        const carry = 0.25 + this.random() * 0.2;
        if (kind === KIND.DUST) {
          const c = car.surface === SURFACE.GRAVEL ? theme.gravel : [theme.grass[0] * 1.6 + 0.12, theme.grass[1] * 1.2 + 0.1, theme.grass[2] + 0.06];
          this.spawn(KIND.DUST, x, pose.y + 0.15, z, fx * car.speed * carry + (this.random() - 0.5) * 2, 0.8 + this.random() * 1.6, fz * car.speed * carry + (this.random() - 0.5) * 2,
            0.45 + this.random() * 0.4, 2.2, 0.9 + this.random() * 0.9, c[0], c[1], c[2], 0.34);
        } else {
          const dark = car.engineOut ? 0.12 : 0.82;
          this.spawn(KIND.SMOKE, x, pose.y + 0.18, z, fx * car.speed * carry * 0.6 + (this.random() - 0.5) * 1.2, 0.6 + this.random() * 1.0, fz * car.speed * carry * 0.6 + (this.random() - 0.5) * 1.2,
            0.4 + this.random() * 0.3, 1.9, 1.0 + this.random() * 1.0, dark, dark, dark, car.engineOut ? 0.55 : 0.3);
        }
      }
    }
    this.renderer.markDecals(0, SHADOW_QUADS);
    // ---- integrate and write instances
    const out = this.renderer.particleData;
    let live = 0;
    for (let i = 0; i < this.count; i++) {
      const life = this.life[i] - dt;
      if (life <= 0) continue;
      const spark = this.kind[i] === KIND.SPARK;
      if (spark) this.vy[i] -= 9.81 * dt; else { const drag = Math.exp(-1.6 * dt); this.vx[i] *= drag; this.vz[i] *= drag; this.vy[i] *= Math.exp(-0.9 * dt); }
      const x = this.px[i] + this.vx[i] * dt, y = this.py[i] + this.vy[i] * dt, z = this.pz[i] + this.vz[i] * dt;
      const size = this.size[i] + this.growth[i] * dt;
      if (live !== i) {
        this.vx[live] = this.vx[i]; this.vy[live] = this.vy[i]; this.vz[live] = this.vz[i];
        this.maxLife[live] = this.maxLife[i]; this.growth[live] = this.growth[i];
        this.r[live] = this.r[i]; this.g[live] = this.g[i]; this.b[live] = this.b[i]; this.a[live] = this.a[i];
        this.kind[live] = this.kind[i]; this.rot[live] = this.rot[i];
      }
      this.px[live] = x; this.py[live] = y; this.pz[live] = z; this.life[live] = life; this.size[live] = size;
      const t = life / this.maxLife[live];
      const fade = spark ? t : Math.min(1, t * 1.6) * Math.min(1, (1 - t) * 8);
      const o = live * PARTICLE_FLOATS;
      out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = size;
      out[o + 4] = this.r[live]; out[o + 5] = this.g[live]; out[o + 6] = this.b[live]; out[o + 7] = this.a[live] * fade;
      out[o + 8] = this.rot[live] + (1 - t) * 0.8; out[o + 9] = this.kind[live]; out[o + 10] = 0; out[o + 11] = 0;
      live++;
    }
    this.count = live;
    return live;
  }
}
