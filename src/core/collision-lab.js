// Collision test bench — a DEVELOPMENT tool, never reachable from the menus of the game.
// It is switched on by a launch option only (index.html#lab=hop, see main.js) and replays, on
// demand, the situations that are rare in a normal race: a wheel contact, a recoverable hop, the
// hard accident (E3), the launch on a roadside board (E5), repeated bumps (E4).
//
// Nothing here is a canned animation: the bench only PLACES two real cars and DRIVES them with
// ordinary controls (steering, throttle) until they meet. The contact, the flight, the landing and
// their staging are produced by the rules of the game, exactly as in a race. After the event the
// car is handed back to the player. The recording script (work/scripts/collision-sequences.mjs)
// uses this same module, so the videos show what the bench lets a person try.

import { SIM_DT } from '../gameplay/race.js';
import { CAR_STATE, placeCar } from '../physics/car-physics.js';

/**
 * Scenarios. Speeds in km/h, distances in metres. `me`: the player's car (back: gap behind the car
 * ahead, side: lateral offset from it); `other`: the car ahead, scripted at a constant speed.
 * `release`: the event after which the car is handed back to the player. When the bench keeps driving
 * after the event (recordings), it first holds its line for `afterHold` seconds (hands steady: what
 * the steering does then is the disturbance of the landing, which belongs to the game), then moves
 * smoothly, in `afterMove` seconds, to the lateral offset `afterSide` to go past the car ahead.
 */
export const LAB_SCENARIOS = {
  wheel: { key: 'Digit1', circuit: 'kestrel-fields', me: { speed: 146, back: 7, side: -3.2 }, other: { speed: 118 }, steerTo: -1.7, steerFrom: 0.45, hold: 146, release: 'wheel' },
  // (the same staging as the accident below, with less speed; `back` makes the contact happen at the same instant, for comparison)
  hop: { key: 'Digit2', circuit: 'kestrel-fields', me: { speed: 200, back: 23, side: -0.93 }, other: { speed: 150 }, steerTo: -0.93, steerFrom: 0, hold: 200, afterHold: 0.8, afterMove: 1.2, afterSide: -2.9, release: 'landing' },
  crash: { key: 'Digit3', circuit: 'kestrel-fields', me: { speed: 262, back: 34, side: -0.93 }, other: { speed: 188 }, steerTo: -0.93, steerFrom: 0, hold: 262, release: 'landing' },
  board: { key: 'Digit4', circuit: 'hazelbrook', board: true, me: { speed: 245, back: 70 }, release: 'landing' },
  // a first contact at about 40 km/h of closing speed, then the follower comes back gently on the car ahead (5 km/h faster)
  bump: { key: 'Digit5', circuit: 'kestrel-fields', me: { speed: 146, back: 12, side: 0 }, other: { speed: 105 }, steerTo: 0, steerFrom: 0, hold: 146, afterBump: 5, release: 'bump' },
  // ---- trackside objects (tracks/trackside-objects.js). The objects of the bench circuit can be hit: EXPERIMENTAL
  // interactions are on for that circuit only. `object`: the object aimed at (the car drives on the verge, on its line);
  // `pass`: something to drive under on the road, the car is handed back `after` metres beyond it;
  // `leave`: the car leaves the road toward `d` metres beyond the usual barrier line, for `seconds`.
  sign: { key: 'Digit6', circuit: 'banc-objets', object: { family: 'sign.advert.low', side: 1 }, me: { speed: 150, back: 150 }, release: 'object' },
  rock: { key: 'Digit7', circuit: 'banc-objets', object: { family: 'boulder', side: -1 }, me: { speed: 110, back: 130 }, release: 'object' },
  gantry: { key: 'Digit8', circuit: 'banc-objets', pass: { prop: 'gantry.banner.0', after: 50 }, me: { speed: 250, back: 280 }, release: 'passed' },
  pillar: { key: 'Digit9', circuit: 'banc-objets', object: { family: 'gantry.banner', support: true, side: -1 }, me: { speed: 100, back: 130 }, release: 'object' },
  tunnel: { key: 'Digit0', circuit: 'banc-objets', pass: { tunnel: true, after: 90 }, me: { speed: 220, back: 240 }, release: 'passed' },
  // EXPERIMENTAL open verges: a copy of a circuit whose limits are moved outward (track builder: openVerges)
  offtrack: { key: 'KeyO', circuit: 'banc-accotements', leave: { beyond: 7, seconds: 4.6 }, me: { speed: 160 }, release: 'passed' },
  // two cars side by side at almost the same speed, one drifting slowly onto the other (the validated contact rules)
  close: { key: 'KeyK', circuit: 'kestrel-fields', me: { speed: 183, back: -3.6, side: -3.1 }, other: { speed: 180 }, steerTo: -1.8, steerFrom: 0.8, hold: 183, release: 'wheel' },
};
/** Other names accepted by the launch option (the names of the events in the analysis report, and French). */
export const LAB_ALIASES = { e2: 'wheel', roue: 'wheel', saut: 'hop', e3: 'crash', accident: 'crash', e5: 'board', panneau: 'board', e4: 'bump', tamponnage: 'bump',
  destructible: 'sign', rocher: 'rock', rigide: 'rock', portique: 'gantry', pilier: 'pillar', support: 'pillar', sortie: 'offtrack', accotement: 'offtrack', contact: 'close' };
const WATCHED = ['bump', 'wheel', 'launch', 'hop', 'landing', 'obstacle', 'object', 'crash', 'wall', 'restart', 'reset', 'contact'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Scripted driver after a recoverable landing: lateral error (m) to heading asked for (rad), times the speed (m/s). */
const LAB_AFTER_GAIN = 1.5;

export class CollisionLab {
  /**
   * @param app        GameApp
   * @param quickRace  function(options) that starts a race (main.js)
   */
  constructor(app, quickRace) {
    this.app = app; this.quickRace = quickRace;
    this.name = null; this.scenario = null; this.race = null;
    this.me = null; this.lead = null; this.board = null;
    this.tick = 0; this.left = false; this.backTick = -1; this.bumped = false; this.triggered = false; this.released = false;
    this.handOver = true;                      // false: the bench keeps driving after the event (recordings)
    this.events = [];
    this.onChange = null;                      // called when the scenario starts or the car is handed back
    app.on((type, e) => {
      if (!this.race || app.race !== this.race || !WATCHED.includes(type)) return;
      this.events.push({ type, car: e.car, value: +(+e.value).toFixed(2) });
      if (e.car !== this.me.index) return;
      if (type === 'bump') this.bumped = true;
      if (type === this.scenario.release) this.triggered = true;
    });
  }

  static resolve(name) {
    const key = String(name || '').toLowerCase();
    return LAB_SCENARIOS[key] ? key : LAB_ALIASES[key] || null;
  }

  get active() { return !!this.race && this.app.race === this.race; }

  /** Build the situation: a fresh race, the start skipped, the cars placed and launched at their speeds. */
  start(name, { handOver = true } = {}) {
    const key = CollisionLab.resolve(name);
    if (!key) return false;
    const sc = LAB_SCENARIOS[key], app = this.app;
    const race = this.quickRace({ circuit: sc.circuit, opponents: 3, gridPosition: 3, autoDrive: false, rules: 'arcade', laps: 4, seed: 4 });
    // past the start (lights, first seconds), without sounds or messages: the simulation alone
    let guard = 0;
    while ((race.phase !== 'racing' || race.time < 4) && guard++ < 6000) { race.step(SIM_DT); race.eventCount = 0; }
    const track = race.track, me = race.playerCars[0], others = race.cars.filter((c) => !c.isHuman);
    const kmh = (v) => v / 3.6;
    const gearFor = (car, v) => { const tops = car.params.spec.gearTopSpeeds; for (let g = 0; g < tops.length; g++) if (v < tops[g] * 0.93) return g + 1; return tops.length; };
    const put = (car, s, d, speed) => { placeCar(car, track, s, d); car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = kmh(speed); car.gear = gearFor(car, kmh(speed)); };
    this.name = key; this.scenario = sc; this.race = race; this.me = me; this.lead = null; this.board = null;
    this.tick = 0; this.left = false; this.backTick = -1; this.bumped = false; this.triggered = false; this.released = false;
    this.handOver = handOver; this.events.length = 0;
    this.line = null; this.target = null; this.passAt = -1; this.leaveUntil = -1;
    if (sc.object || sc.pass || sc.leave) {
      const layout = track.sceneryLayout, objects = race.objects;
      others.forEach((c, k) => put(c, track.length * 0.5 + k * 40, 0, 150));       // (the other cars: parked far away, driving on)
      if (sc.object) {
        // the object aimed at; every other experimental object is taken out of the way, so that this contact is the only one
        const o = objects.find((x) => x.family === sc.object.family && !!x.support === !!sc.object.support && x.d * sc.object.side > 0);
        this.target = o;
        objects.forEach((x, k) => { if (x !== o) race.objectState[k] = 2; });
        put(me, o.s - sc.me.back, o.d, sc.me.speed);
        this.line = { d: o.d, speed: sc.me.speed };
      } else if (sc.pass) {
        const at = sc.pass.tunnel ? layout.trackside.tunnels[0].from : layout.props.find((p) => p.id === sc.pass.prop).s;
        const beyond = sc.pass.tunnel ? layout.trackside.tunnels[0].length : 0;
        put(me, at - sc.me.back, 0, sc.me.speed);
        this.line = { d: 0, speed: sc.me.speed };
        this.passAt = me.progress + sc.me.back + beyond + sc.pass.after;
        this.target = { s: at, length: beyond };
      } else {
        // a straight away from the pits where the ground beyond the usual barrier line is open on one side and clear of objects
        const corridor = (i, side) => { const d = side * (track.closedBarrierR ? (side > 0 ? track.closedBarrierR[i] : track.closedBarrierL[i]) + sc.leave.beyond : 0); return d; };
        let found = null;
        for (let i = 0; i < track.n && !found; i += 4) {
          for (const side of [1, -1]) {
            const usual = side > 0 ? track.closedBarrierR[i] : track.closedBarrierL[i];
            const open = (side > 0 ? track.barrierR[i] : track.barrierL[i]) - usual;
            if (open < sc.leave.beyond + 12 || usual > track.halfWidth + 10) continue;        // (an ordinary grass verge, not a gravel trap)
            let straight = true;
            for (let k = -10; k <= 150 && straight; k++) if (Math.abs(track.kappa[(i + k + track.n) % track.n]) > 1 / 900) straight = false;
            if (straight) { found = { i, side, d: corridor(i, side) }; break; }
          }
        }
        if (!found) found = { i: Math.round(track.n * 0.4), side: 1, d: corridor(Math.round(track.n * 0.4), 1) };
        // the strip of ground the car will cross is cleared of the objects planted there; the others stay, and can be hit
        const s0 = found.i * track.ds;
        objects.forEach((x, k) => {
          let ds = x.s - s0; if (ds < -track.length / 2) ds += track.length;
          if (ds > -30 && ds < 520 && x.d * found.side > 0 && Math.abs(x.d) < Math.abs(found.d) + 5) race.objectState[k] = 2;
        });
        put(me, s0, 0, sc.me.speed);
        this.line = { d: found.d, speed: sc.me.speed };
        this.leaveUntil = Math.round(sc.leave.seconds / SIM_DT);
        this.target = { s: found.i * track.ds, d: found.d, side: found.side };
      }
    } else if (sc.board) {
      // a braking board at the end of a straight; the car leaves the road toward it. Only this board is
      // left standing: the reference case is a single obstacle.
      const o = race.obstacles.find((b) => { const i = Math.floor(b.s / track.ds) % track.n; return Math.abs(track.kappa[(i - 20 + track.n) % track.n]) < 0.001; }) || race.obstacles[0];
      this.board = o;
      race.obstacles.forEach((b, i) => { if (b !== o) race.obstacleDown[i] = 1; });
      put(me, o.s - sc.me.back, Math.sign(o.d) * (track.halfWidth - 1.5), sc.me.speed);
      others.forEach((c, k) => put(c, o.s + track.length / 2 + k * 40, 0, 150));
    } else {
      // longest straight away from the pits
      const need = Math.ceil(520 / track.ds); let run = 0, s0 = 0;
      for (let i = 0; i < track.n * 2; i++) {
        const k = i % track.n, rel = k * track.ds > track.length / 2 ? k * track.ds - track.length : k * track.ds;
        const pits = rel > track.pit.entryS - 40 && rel < track.pit.exitS + 40;
        if (Math.abs(track.kappa[k]) < 1 / 2500 && !pits) { run++; if (run >= need) { s0 = ((i - need + 1) % track.n) * track.ds; break; } } else run = 0;
      }
      const lead = others[0];
      put(lead, s0 + 60, 0.6, sc.other.speed);
      put(me, s0 + 60 - 4.2 - sc.me.back, 0.6 + sc.me.side, sc.me.speed);
      others.slice(1).forEach((c, k) => put(c, s0 + track.length / 2 + k * 40, 0, 150));
      // the car ahead is scripted (constant speed, straight): taken away from the computer driver
      this.lead = lead; lead.isHuman = true; this.leadSpeed = kmh(sc.other.speed); this.leadD = lead.d;
    }
    if (this.onChange) this.onChange(this);
    return true;
  }

  /**
   * Called before every simulation step, after the player's controls have been read. Until the car
   * is handed back, the bench supplies the controls of the player's car; the car ahead stays scripted.
   */
  beforeStep() {
    if (!this.active) return;
    const sc = this.scenario, me = this.me, race = this.race;
    if (this.handOver && !this.released && ((this.triggered && me.state === CAR_STATE.RACING) || this.tick > 14 / SIM_DT)) {
      this.released = true;
      if (this.onChange) this.onChange(this);
    }
    // (cases that end by position or by time rather than by an event)
    if (this.passAt >= 0 && me.progress >= this.passAt) this.triggered = true;
    if (this.leaveUntil >= 0 && this.tick >= this.leaveUntil) this.triggered = true;
    if (!this.released && this.line) {
      // trackside cases: the car is driven along a line parallel to the road, at a held speed; nothing else is scripted
      let steer = 0, throttle = 0, brake = 0;
      if (me.state === CAR_STATE.RACING) {
        const line = this.triggered && this.leaveUntil >= 0 ? 0 : this.line.d;          // (after an excursion the recordings come back to the road)
        const slant = this.leaveUntil >= 0 ? 0.12 : 0.22;                                 // (an excursion leaves and rejoins the road at a shallow angle)
        const want = clamp((line - me.d) * 0.035, -slant, slant);
        steer = clamp((want - me.headingError) * 3, -0.5, 0.5);
        // once the case is over the recordings slow down: 110 km/h for the bend that follows a passage, a stop after a contact
        const speed = !this.triggered ? this.line.speed : this.scenario.object ? 0 : Math.min(this.line.speed, 110);
        throttle = speed > 0 ? clamp(0.5 + (speed / 3.6 - me.speed) * 0.4, 0, 1) : 0;
        brake = speed > 0 && me.speed > speed / 3.6 + 4 ? 0.7 : 0;
      }
      race.setPlayerInput(0, steer, throttle, brake, 0, false, false);
    } else if (!this.released) {
      let steer = 0, throttle = 1;
      if (me.state !== CAR_STATE.RACING) this.left = true;               // after the accident: straight on, full throttle
      else if (this.left && this.backTick < 0) this.backTick = this.tick;  // first step back on its wheels
      if (me.state === CAR_STATE.RACING) {
        if (this.board && !this.left) { steer = clamp((this.board.d - me.d) * 0.22 - me.headingError * 2.4, -0.5, 0.5); throttle = 0.6; }
        else if (this.board) {
          // after the accident the car is where it stopped, across the verge: it is driven back to the road gently
          const want = clamp((0 - me.d) * 0.05, -0.5, 0.5);              // heading wanted relative to the track
          steer = clamp((want - me.headingError) * 2.2, -1, 1);
          throttle = Math.abs(want - me.headingError) > 0.5 ? 0.22 : 0.6;
        } else {
          const lead = this.lead;
          let side = this.tick < Math.round(sc.steerFrom / SIM_DT) ? sc.me.side : sc.steerTo;
          if (this.left && sc.afterSide !== undefined) {
            // back on its wheels: the same line for a moment, then out from behind the car ahead, without a jerk
            const u = clamp(((this.tick - this.backTick) * SIM_DT - (sc.afterHold || 0)) / (sc.afterMove || 1), 0, 1);
            side = sc.steerTo + (sc.afterSide - sc.steerTo) * u * u * (3 - 2 * u);
          }
          steer = clamp((lead.d + side - me.d) * 0.3 - me.headingError * 2.2, -0.4, 0.4);
          if (this.left && sc.afterSide !== undefined) {
            // (a calmer hand for this part: the heading asked for shrinks with the speed, so that the car settles on its line without weaving)
            const want = clamp((lead.d + side - me.d) * LAB_AFTER_GAIN / Math.max(20, me.speed), -0.08, 0.08);
            steer = clamp((want - me.headingError) * 6, -0.4, 0.4);
          }
          const hold = this.bumped && sc.afterBump ? lead.speed * 3.6 + sc.afterBump : sc.hold;
          if (hold && !this.left) throttle = clamp(0.5 + (hold / 3.6 - me.speed) * 0.4, 0, 1);
        }
      }
      race.setPlayerInput(0, steer, throttle, 0, 0, false, false);
    }
    const lead = this.lead;
    if (lead && lead.state === CAR_STATE.RACING) {
      const dv = this.leadSpeed - lead.speed;
      lead.inThrottle = clamp(0.35 + dv * 0.4, 0, 1); lead.inBrake = dv < -2 ? 0.3 : 0;
      lead.inSteer = clamp((this.leadD - lead.d) * 0.3 - lead.headingError * 2.2, -0.3, 0.3);
    }
    this.tick++;
  }
}

/**
 * Interactive use (index.html#lab=...): a line of help above the picture and a few keys, bound only
 * while this option is present. 1 to 5 choose a case, Enter replays the current one.
 */
export function attachLabControls(lab, t) {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:5;padding:5px 12px;border:2px solid #16161f;border-radius:4px;'
    + 'background:#f4efe2;color:#16161f;font:600 13px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none;max-width:94vw';
  document.body.appendChild(panel);
  const refresh = () => {
    const state = !lab.active ? t('lab.stopped') : lab.released ? t('lab.yours') : t('lab.auto');
    panel.textContent = `${t('lab.title')} — ${t(`lab.case.${lab.name}`)} — ${state}\n${t('lab.keys')}`;
    panel.style.whiteSpace = 'pre-line';
  };
  lab.onChange = refresh;
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    const chosen = Object.keys(LAB_SCENARIOS).find((name) => LAB_SCENARIOS[name].key === event.code);   // (1 to 0, then O and K)
    if (chosen) lab.start(chosen);
    else if (event.code === 'Enter' || event.code === 'NumpadEnter') lab.start(lab.name);
  });
  // the line also follows what happens outside the bench (race left from the pause menu)
  setInterval(refresh, 500);
  refresh();
}
