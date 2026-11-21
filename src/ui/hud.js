// Race interface drawn in the comic vocabulary: paper cartouches with an ink border and an
// offset flat shadow, yellow caption boxes for timing and messages, hand lettering. Everything
// is emitted as quads in the view's foreground; nothing is allocated per frame.
// Layout adapts to the view: full screen, wide strip (horizontal split) or tall half (vertical split).

import { clamp, mod } from '../core/math.js';
import { t } from '../localization/i18n.js';
import { TextBuffer } from './text-painter.js';
import { RACE_PHASE } from '../gameplay/race.js';
import { CAR_STATE } from '../physics/car-physics.js';
import { BASE_CAR_SPEC } from '../vehicles/car-spec.js';
import { QUAD_MODE } from '../rendering/drawing/quad-batch.js';
import { CAMERA } from '../rendering/compositing/race-view.js';
import { tracePolygon } from '../art/styles/ink.js';

const PAPER = [0.957, 0.937, 0.886], CAPTION = [0.965, 0.886, 0.478], INK = [0.086, 0.086, 0.122], RED = [0.835, 0.188, 0.165];
const GREEN = [0.184, 0.604, 0.353], AMBER = [0.941, 0.765, 0.188], BLUE = [0.184, 0.373, 0.659];
const MAP_SIZE = 256;

/** Register HUD drawings (lamps, map dot) in the static atlas. */
export function defineHudArt(art) {
  const lamp = (id, core, glow) => art.defineStatic(id, 72, 72, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#16161f'; ctx.beginPath(); ctx.arc(c, c, 33, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(c, c, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(c - 3, c - 3, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(c - 9, c - 11, 7, 4, -0.6, 0, Math.PI * 2); ctx.fill();
  });
  lamp('hud.lamp.off', '#4a2326', '#2f1719');
  lamp('hud.lamp.red', '#ff5a3c', '#d5302a');
  lamp('hud.lamp.green', '#7dff8a', '#2f9a5a');
  art.defineStatic('hud.dot', 40, 40, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#16161f'; ctx.beginPath(); ctx.arc(c, c, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c, c, 12, 0, Math.PI * 2); ctx.fill();
  });
}

/** Painter of the circuit map (theme atlas). Returns { paint, meta } with the world-to-map transform. */
export function trackMapSprite(track) {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < track.n; i++) { minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]); minZ = Math.min(minZ, track.z[i]); maxZ = Math.max(maxZ, track.z[i]); }
  const scale = (MAP_SIZE - 36) / Math.max(maxX - minX, maxZ - minZ);
  const ox = MAP_SIZE / 2 - ((minX + maxX) / 2) * scale, oz = MAP_SIZE / 2 - ((minZ + maxZ) / 2) * scale;
  const paint = (ctx) => {
    const pts = [];
    for (let i = 0; i < track.n; i += 2) pts.push([ox + track.x[i] * scale, oz + track.z[i] * scale]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); tracePolygon(ctx, pts);
    ctx.strokeStyle = '#16161f'; ctx.lineWidth = 13; ctx.stroke();
    ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 6.5; ctx.stroke();
    // start line tick
    const nx = track.nx[0], nz = track.nz[0];
    ctx.strokeStyle = '#d5302a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(pts[0][0] - nx * 11, pts[0][1] - nz * 11); ctx.lineTo(pts[0][0] + nx * 11, pts[0][1] + nz * 11); ctx.stroke();
  };
  return { paint, meta: { mapScale: scale, mapOx: ox, mapOz: oz } };
}

class ViewMessages {
  constructor() { this.text = ''; this.timer = 0; this.life = 0; this.kind = 0; }
  show(text, life = 2.2, kind = 0) { this.text = text; this.timer = 0; this.life = life; this.kind = kind; }
}

export class Hud {
  constructor(app, text) {
    this.text = text;
    this.buf = new TextBuffer(48);
    this.lamps = [app.art.sprite('hud.lamp.off'), app.art.sprite('hud.lamp.red'), app.art.sprite('hud.lamp.green')];
    this.dot = app.art.sprite('hud.dot');
    this.messages = [new ViewMessages(), new ViewMessages()];
    this.greenTimer = 10;
    this.map = null;
    this.visible = true;
    this.labels = {};
    this.refreshLabels();
  }

  /** Cache translated labels (call again after a language change). */
  refreshLabels() {
    for (const key of ['position', 'lap', 'time', 'last', 'best', 'score', 'speed', 'tyres', 'fuel', 'damage', 'boost', 'quota', 'pit', 'paused', 'wrongWay']) this.labels[key] = t(`hud.${key}`);
  }

  onRaceStart(app) {
    this.map = app.art.has('map.track') ? app.art.sprite('map.track') : null;
    this.greenTimer = 10;
    for (const m of this.messages) m.life = 0;
  }

  onRaceEvent(event, app) {
    const race = app.race;
    if (event.type === 'green') { this.greenTimer = 0; for (let v = 0; v < app.viewCount; v++) this.messages[v].show(t('hud.go'), 1.6, 1); return; }
    for (let v = 0; v < app.viewCount; v++) {
      if (app.views[v].carIndex !== event.car) continue;
      const m = this.messages[v], car = race.cars[event.car];
      switch (event.type) {
        case 'overtake': if (app.effects.insets) m.show(t('hud.overtake', { n: car.position }), 1.8, 0); break;
        case 'overtaken': if (app.effects.insets) m.show(t('hud.overtaken', { n: car.position }), 1.6, 2); break;
        case 'lap':
          if (car.lap === race.laps - 1 && !car.finished) m.show(t('hud.finalLap'), 2.6, 1);
          else if (event.other === 1 && car.lap > 1) m.show(t('hud.fastestLap'), 2.2, 0);
          break;
        case 'finish': m.show(t('hud.finish'), 4, 1); break;
        case 'puncture': m.show(t('hud.puncture'), 3, 2); break;
        case 'engine': m.show(t('hud.engine'), 3, 2); break;
        case 'retire': m.show(t('hud.retired'), 4, 2); break;
        case 'overheat': m.show(t('hud.overheat'), 2.5, 2); break;
        case 'fuelOut': m.show(t('hud.lowFuel'), 3, 2); break;
        case 'pitStart': m.show(t('hud.pitIn'), Math.max(1.5, event.value), 0); break;
        case 'pitDone': m.show(t('hud.pitGo'), 1.6, 1); break;
        default:
      }
    }
  }

  update(app, dt) {
    this.greenTimer += dt;
    for (const m of this.messages) if (m.life > 0) { m.timer += dt; if (m.timer > m.life) m.life = 0; }
  }

  // ---- drawing helpers -----------------------------------------------------------------------
  panel(q, x, y, w, h, u, color, skew = 0) {
    const s = skew * u, b = 3 * u, sh = 6 * u;
    q.quad(x + s + sh, y + sh, 1, x + w + s + sh, y + sh, 1, x + sh, y + h + sh, 1, x + w + sh, y + h + sh, 1, 0, 0, 0, 0, 0, QUAD_MODE.FLAT, INK[0], INK[1], INK[2], 0.55, 0);
    q.quad(x + s - b, y - b, 1, x + w + s + b, y - b, 1, x - b, y + h + b, 1, x + w + b, y + h + b, 1, 0, 0, 0, 0, 0, QUAD_MODE.FLAT, INK[0], INK[1], INK[2], 1, 0);
    q.quad(x + s, y, 1, x + w + s, y, 1, x, y + h, 1, x + w, y + h, 1, 0, 0, 0, 0, 0, QUAD_MODE.FLAT, color[0], color[1], color[2], 1, 0);
  }

  bar(q, x, y, w, h, u, value, color) {
    q.rect(x - 2 * u, y - 2 * u, w + 4 * u, h + 4 * u, INK[0], INK[1], INK[2], 1);
    q.rect(x, y, w, h, 0.78, 0.75, 0.69, 1);
    q.rect(x, y, w * clamp(value, 0, 1), h, color[0], color[1], color[2], 1);
  }

  label(q, key, x, y, size, color = INK, align = 0) { return this.text.draw(q, 'b', this.labels[key], x, y, size, color[0], color[1], color[2], 1, align); }

  drawFront(app, view) {
    if (!this.visible) return;
    const race = app.race, q = app.quads, r = view.rect, text = this.text, buf = this.buf;
    const car = race.cars[view.carIndex];
    const session = app.session;
    const u = Math.max(0.5, Math.min(r.w / 2560, (r.h / 1440) * (view.wide ? 1.5 : 1))) * (r.w < r.h ? 1.25 : 1);
    const m = 26 * u;
    const compact = view.wide || r.w < r.h;

    // ---- position and lap
    let x = m, y = m;
    this.panel(q, x, y, 232 * u, 112 * u, u, PAPER, 10);
    this.label(q, 'position', x + 18 * u, y + 24 * u, 13 * u);
    buf.clear().int(car.position);
    const px = text.drawBuffer(q, 'o', buf, x + 16 * u, y + 100 * u, 54 * u, 1, 0.83, 0.16, 1, 0);
    buf.clear().char(47).int(race.cars.length);
    text.drawBuffer(q, 'b', buf, px + 6 * u, y + 96 * u, 26 * u, INK[0], INK[1], INK[2], 1, 0);
    x += 252 * u;
    this.panel(q, x, y, 190 * u, 112 * u, u, PAPER, 10);
    this.label(q, 'lap', x + 18 * u, y + 24 * u, 13 * u);
    const laps = Number.isFinite(race.laps) ? race.laps : 0;
    buf.clear().int(Math.min(car.lap + 1, laps || car.lap + 1));
    if (laps) buf.char(47).int(laps);
    text.drawBuffer(q, 'b', buf, x + 16 * u, y + 94 * u, 42 * u, INK[0], INK[1], INK[2], 1, 0);

    // ---- timing (and arcade score)
    const arcade = session && session.kind === 'arcade';
    const rows = arcade ? 4 : 3;
    const tw = 330 * u, th = (22 + rows * 30) * u;
    x = r.w - m - tw; y = m;
    this.panel(q, x, y, tw, th, u, CAPTION, 10);
    let ry = y + 34 * u;
    const lapTime = race.phase === RACE_PHASE.COUNTDOWN || car.finished ? 0 : race.time - car.lapStartTime;
    const row = (key, seconds) => {
      this.label(q, key, x + 16 * u, ry, 17 * u);
      buf.clear().time(seconds);
      text.drawBuffer(q, 'b', buf, x + tw - 16 * u, ry, 22 * u, INK[0], INK[1], INK[2], 1, 1);
      ry += 30 * u;
    };
    row('time', lapTime); row('last', car.lastLapTime); row('best', car.bestLapTime);
    if (arcade) {
      this.label(q, 'score', x + 16 * u, ry, 17 * u, RED);
      buf.clear().int(session.score(car.playerIndex), 6);
      text.drawBuffer(q, 'b', buf, x + tw - 16 * u, ry, 22 * u, RED[0], RED[1], RED[2], 1, 1);
    }

    // ---- speed, gear and (when the dash dial is out of the picture) a rev bar
    const dialShown = app.scene.cockpit && app.scene.cockpit.dialVisible(view);
    const sw = 232 * u, sh = (dialShown ? 74 : 104) * u;
    x = m; y = compact ? r.h - m - sh : m + 132 * u;
    this.panel(q, x, y, sw, sh, u, PAPER, 10);
    buf.clear().int(Math.abs(car.speed) * 3.6);
    text.drawBuffer(q, 'o', buf, x + 132 * u, y + 60 * u, 42 * u, 1, 1, 1, 1, 1);
    this.label(q, 'speed', x + 140 * u, y + 58 * u, 17 * u);
    if (!dialShown) {
      const rpm = clamp(car.rpm / BASE_CAR_SPEC.rpmMax, 0, 1);
      this.bar(q, x + 16 * u, y + 76 * u, 150 * u, 14 * u, u, rpm, rpm > 0.92 ? RED : rpm > 0.75 ? AMBER : GREEN);
      buf.clear();
      if (car.reverse) buf.char(82); else buf.int(car.gear);
      text.drawBuffer(q, 'o', buf, x + 200 * u, y + 96 * u, 30 * u, 1, 0.83, 0.16, 1, 0.5);
    }

    // ---- car condition
    const rules = race.rules;
    const turbo = race.profile.boost;
    if (rules.wear || rules.fuel || rules.damage || turbo) {
      const count = (rules.wear ? 1 : 0) + (rules.fuel ? 1 : 0) + (rules.damage ? 1 : 0) + (turbo ? 1 : 0);
      const cw = 230 * u, ch = (16 + count * 28) * u;
      x = r.w - m - cw; y = compact ? r.h - m - ch : m + th + 20 * u;
      this.panel(q, x, y, cw, ch, u, PAPER, 10);
      let by = y + 14 * u;
      const gauge = (key, value, color) => {
        this.label(q, key, x + 14 * u, by + 15 * u, 14 * u);
        this.bar(q, x + 112 * u, by + 2 * u, 102 * u, 13 * u, u, value, color);
        by += 28 * u;
      };
      if (rules.wear) { const life = 1 - car.tyreWear; gauge('tyres', car.puncture ? 0 : life, life < 0.3 ? RED : life < 0.55 ? AMBER : GREEN); }
      if (rules.fuel) { const f = car.fuel / BASE_CAR_SPEC.fuelCapacity; gauge('fuel', f, f < 0.15 ? RED : BLUE); }
      if (rules.damage) gauge('damage', car.damage, car.damage > 0.6 ? RED : AMBER);
      if (turbo) gauge('boost', car.boostHeat, car.boostLock > 0 ? RED : AMBER);
    }

    // ---- circuit map with the field
    if (this.map && !view.wide) {
      const ms = 190 * u;
      x = m; y = m + 132 * u + sh + 26 * u;
      if (compact) y = m + 132 * u;
      this.panel(q, x, y, ms + 16 * u, ms + 16 * u, u, PAPER, 8);
      q.sprite(this.map, x + 8 * u, y + 8 * u, ms, ms, 1, 1, 1, 1, 0, false);
      const k = ms / MAP_SIZE, map = this.map, cars = race.cars;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < cars.length; i++) {
          const c = cars[i];
          const own = i === view.carIndex;
          if (c.removed || own !== (pass === 1)) continue;
          const dx = x + 8 * u + (map.mapOx + c.x * map.mapScale) * k, dy = y + 8 * u + (map.mapOz + c.z * map.mapScale) * k;
          const ds = (own ? 22 : 13) * u;
          const col = own ? RED : c.isHuman ? GREEN : BLUE;
          q.sprite(this.dot, dx - ds / 2, dy - ds / 2, ds, ds, col[0], col[1], col[2], 1, 0, false);
        }
      }
    }

    // ---- start lights
    if (race.phase === RACE_PHASE.COUNTDOWN || this.greenTimer < 1.2) {
      const size = 58 * u, gap = 10 * u, total = 5 * size + 4 * gap;
      const lx = r.w / 2 - total / 2, ly = m;
      this.panel(q, lx - 14 * u, ly, total + 28 * u, size + 20 * u, u, [0.13, 0.14, 0.18], 0);
      const green = race.phase !== RACE_PHASE.COUNTDOWN;
      for (let i = 0; i < 5; i++) {
        const sp = green ? this.lamps[2] : i < race.lights ? this.lamps[1] : this.lamps[0];
        q.sprite(sp, lx + i * (size + gap), ly + 10 * u, size, size, 1, 1, 1, 1, 0, false);
      }
    }

    // ---- messages: caption box sliding in under the top edge
    const msg = this.messages[view.index];
    let status = null;
    if (msg.life > 0) status = msg.text;
    else if (car.wrongWayTimer > 1.2) status = this.labels.wrongWay;
    else if (app.paused) status = this.labels.paused;
    if (status) {
      const tIn = msg.life > 0 ? clamp(msg.timer / 0.18, 0, 1) : 1;
      const tOut = msg.life > 0 ? clamp((msg.life - msg.timer) / 0.2, 0, 1) : 1;
      const size = 34 * u;
      const w = text.measure('b', status, size) + 56 * u, h = 64 * u;
      const mx = r.w / 2 - w / 2, my = m + 96 * u - (1 - tIn) * 40 * u;
      const color = msg.life > 0 && msg.kind === 2 ? PAPER : CAPTION;
      const alphaOk = tOut > 0.02;
      if (alphaOk) {
        this.panel(q, mx, my, w, h, u, color, 14);
        const tc = msg.life > 0 && msg.kind === 2 ? RED : INK;
        text.draw(q, 'b', status, r.w / 2 + 6 * u, my + 46 * u, size, tc[0], tc[1], tc[2], 1, 0.5);
      }
    }
    // ---- pit lane reminder
    if (car.inPit && car.state !== CAR_STATE.SERVICE && view.camera === CAMERA.COCKPIT) {
      this.label(q, 'pit', r.w / 2, r.h * 0.3, 30 * u, RED, 0.5);
    }
    void mod;
  }
}
