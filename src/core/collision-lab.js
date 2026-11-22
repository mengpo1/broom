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
 * `release`: the event after which the car is handed back to the player. `afterSide`: when the bench
 * keeps driving after the event (recordings), the lateral offset it then takes to go past the car ahead.
 */
export const LAB_SCENARIOS = {
  wheel: { key: 'Digit1', circuit: 'kestrel-fields', me: { speed: 146, back: 7, side: -3.2 }, other: { speed: 118 }, steerTo: -1.7, steerFrom: 0.45, hold: 146, release: 'wheel' },
  // (the same staging as the accident below, with less speed; `back` makes the contact happen at the same instant, for comparison)
  hop: { key: 'Digit2', circuit: 'kestrel-fields', me: { speed: 200, back: 23, side: -0.93 }, other: { speed: 150 }, steerTo: -0.93, steerFrom: 0, hold: 200, afterSide: -3.4, release: 'landing' },
  crash: { key: 'Digit3', circuit: 'kestrel-fields', me: { speed: 262, back: 34, side: -0.93 }, other: { speed: 188 }, steerTo: -0.93, steerFrom: 0, hold: 262, release: 'landing' },
  board: { key: 'Digit4', circuit: 'hazelbrook', board: true, me: { speed: 245, back: 70 }, release: 'landing' },
  // a first contact at about 40 km/h of closing speed, then the follower comes back gently on the car ahead (5 km/h faster)
  bump: { key: 'Digit5', circuit: 'kestrel-fields', me: { speed: 146, back: 12, side: 0 }, other: { speed: 105 }, steerTo: 0, steerFrom: 0, hold: 146, afterBump: 5, release: 'bump' },
};
/** Other names accepted by the launch option (the names of the events in the analysis report, and French). */
export const LAB_ALIASES = { e2: 'wheel', roue: 'wheel', saut: 'hop', e3: 'crash', accident: 'crash', e5: 'board', panneau: 'board', e4: 'bump', tamponnage: 'bump' };
const WATCHED = ['bump', 'wheel', 'launch', 'hop', 'landing', 'obstacle', 'crash', 'restart', 'reset', 'contact'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class CollisionLab {
  /**
   * @param app        GameApp
   * @param quickRace  function(options) that starts a race (main.js)
   */
  constructor(app, quickRace) {
    this.app = app; this.quickRace = quickRace;
    this.name = null; this.scenario = null; this.race = null;
    this.me = null; this.lead = null; this.board = null;
    this.tick = 0; this.left = false; this.bumped = false; this.triggered = false; this.released = false;
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
    this.tick = 0; this.left = false; this.bumped = false; this.triggered = false; this.released = false;
    this.handOver = handOver; this.events.length = 0;
    if (sc.board) {
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
    if (!this.released) {
      let steer = 0, throttle = 1;
      if (me.state !== CAR_STATE.RACING) this.left = true;               // after the accident: straight on, full throttle
      if (me.state === CAR_STATE.RACING) {
        if (this.board && !this.left) { steer = clamp((this.board.d - me.d) * 0.22 - me.headingError * 2.4, -0.5, 0.5); throttle = 0.6; }
        else if (this.board) {
          // after the accident the car is where it stopped, across the verge: it is driven back to the road gently
          const want = clamp((0 - me.d) * 0.05, -0.5, 0.5);              // heading wanted relative to the track
          steer = clamp((want - me.headingError) * 2.2, -1, 1);
          throttle = Math.abs(want - me.headingError) > 0.5 ? 0.22 : 0.6;
        } else {
          const lead = this.lead, side = this.left && sc.afterSide !== undefined ? sc.afterSide : this.tick < Math.round(sc.steerFrom / SIM_DT) ? sc.me.side : sc.steerTo;
          steer = clamp((lead.d + side - me.d) * 0.3 - me.headingError * 2.2, -0.4, 0.4);
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
    const chosen = Object.keys(LAB_SCENARIOS).find((name) => LAB_SCENARIOS[name].key === event.code);
    if (chosen) lab.start(chosen);
    else if (event.code === 'Enter' || event.code === 'NumpadEnter') lab.start(lab.name);
  });
  // the line also follows what happens outside the bench (race left from the pause menu)
  setInterval(refresh, 500);
  refresh();
}
