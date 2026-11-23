// Steering bench — a DEVELOPMENT tool, never reachable from the menus of the game.
// It is switched on by a launch option only (index.html#steerlab=a, b1, b2 or b3, see main.js) and
// lets a person compare, on the same road, the validated steering (A) with the experimental
// two-phase variants (B1, B2, B3: vehicles/steering-variants.js). The road is a development
// circuit of its own (banc-direction, tracks/track-catalog.js): six bends of about 70 to 260 m of
// radius, in both directions, and a last fast curve.
//
// Two uses:
//   - driving: the player drives alone on the bench and changes the variant at any moment (keys 1
//     to 4); a line of figures shows what the steering is doing (hold time, lock applied, phase 2,
//     slide angle, tyre slip, speed);
//   - demonstration (key 5, and the recording scripts): a measured manoeuvre, the same for every
//     variant. The car arrives straight at a chosen share of the speed the grip allows in a bend,
//     then full lock is held for a few seconds from the entry of the bend, the throttle left where
//     it held the speed. Only the controls are scripted (HeldSteeringRun below, also used by the
//     measurement script work/scripts/held-steering.mjs): what the car does is the game;
//   - the passage of the reference footage (key 6): a second development circuit (banc-reference)
//     shaped on the two long turns of that passage, driven with the keys the hands of the footage
//     suggest (REFERENCE_PASSAGE below, a hypothesis), then handed to the player.

import { SIM_DT } from '../gameplay/race.js';
import { CAR_STATE, placeCar, steeringLock } from '../physics/car-physics.js';
import { gripLimit, cornerSpeed } from '../vehicles/car-spec.js';
import { STEERING_REFERENCE, steeringVariant } from '../vehicles/steering-variants.js';

export const BENCH_CIRCUIT = 'banc-direction';
/** Keys of the bench: the variant each one selects. */
export const BENCH_VARIANT_KEYS = { Digit1: 'a', Digit2: 'b1', Digit3: 'b2', Digit4: 'b3' };
/**
 * Demonstrations, in the order key 5 goes through them: the bend (1 = the first after the line),
 * the entry speed as a share of the speed the grip allows there, the seconds of full lock.
 */
export const BENCH_DEMOS = [
  { bend: 4, share: 1, seconds: 3 },
  { bend: 3, share: 1, seconds: 3 },
  { bend: 1, share: 0.85, seconds: 3 },
  { bend: 5, share: 1.15, seconds: 3 },
];
/**
 * The passage of the reference footage studied for the held steering (1:47.8 to 1:56.4 of the 1991
 * recording): a long right-hand turn entered at 318 km/h, then a left-hand turn taken at 215 km/h.
 * `keys` is a HYPOTHESIS on the controls, which the footage does not show: [from, to, side] in
 * seconds from the first movement of the hands, a key being taken as down while the hands are at
 * their second position or beyond and not coming back (docs/specifications/held-steering.md).
 * `speeds` is what the display of the footage shows; the pedals that follow it here are a
 * hypothesis too (the footage does not tell braking from the cost of steering).
 * The development circuit `banc-reference` is fitted on what the validated car does with these
 * keys (work/scripts/reference-passage-track.mjs); the first key goes down `firstKeyAfterBendStart`
 * metres after the start of its first bend.
 */
export const REFERENCE_PASSAGE = {
  circuit: 'banc-reference', videoStart: 107.76, kmh: 318, seconds: 8.9, lead: 70, firstKeyAfterBendStart: -2,
  keys: [[0, 2.36, 1], [2.72, 2.96, 1], [3.16, 4.8, 1], [5.28, 7.48, -1], [8.16, 8.36, 1]],
  // the speed read on the steering-wheel display of the footage, [seconds from the first movement, km/h]
  // (hidden by the driver's arm between 3.8 and 4.8 s and between 5.9 and 7.5 s: the last reading is kept)
  speeds: [[0.44, 317], [0.56, 312], [0.68, 305], [0.8, 300], [0.92, 295], [1.04, 285], [1.16, 275], [1.28, 272], [1.4, 267], [1.52, 262], [1.64, 260], [2.24, 262], [2.36, 271],
    [2.6, 272], [2.72, 275], [2.96, 277], [3.2, 274], [3.32, 266], [3.44, 264], [4.84, 264], [5, 265], [5.16, 262], [5.28, 255], [5.4, 247], [5.56, 235], [5.72, 218], [5.8, 215],
    [7.52, 215], [7.88, 222], [8.12, 229], [8.36, 230], [8.48, 240], [8.72, 243], [8.84, 244]],
};
const KMH = 3.6, DEG = 180 / Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, digits) => +v.toFixed(digits);

/** The bends of a track, in order: where each one starts and ends (m), its mean curvature, radius, side (+1 right, -1 left) and angle (degrees). */
export function trackBends(track, straighterThan = 1 / 1500) {
  const bends = [];
  for (let i = 0; i < track.n;) {
    if (Math.abs(track.kappa[i]) <= straighterThan) { i++; continue; }
    let j = i, sum = 0;
    while (j < track.n && Math.abs(track.kappa[j]) > straighterThan) { sum += track.kappa[j]; j++; }
    const kappa = sum / (j - i);
    bends.push({ number: bends.length + 1, sFrom: i * track.ds, sTo: j * track.ds, kappa, radius: 1 / Math.abs(kappa), side: Math.sign(kappa), turnDeg: (j - i) * track.ds * Math.abs(kappa) * DEG });
    i = j;
  }
  return bends;
}

/** What the steering of a car is doing at this instant (figures of the bench and of the measurements). */
export function steeringState(car) {
  const v = Math.abs(car.speed), aMax = gripLimit(car.params, v, 1, 1), reference = steeringLock(car.params, v, aMax);
  const applied = car.steering ? car.steerShown : car.steer;                      // multiple of the reference full lock
  const angle = applied * reference;
  return {
    request: car.inSteer, steer: car.steer, hold: car.steerHold, phase2: car.steerExtra, applied, wheelDeg: angle * DEG, yawDegS: car.yawRate * DEG, kmh: v * KMH,
    latG: Math.abs(car.accelLat) / 9.81, gripG: aMax / 9.81, askedShare: (v * v * Math.tan(Math.abs(angle))) / car.params.wheelbase / aMax,
    slip: car.slip, slideDeg: Math.atan2(Math.abs(car.vLat), Math.max(1, v)) * DEG, d: car.d, state: car.state,
  };
}

/**
 * The measured manoeuvre: the car is placed at `s0` at `kmh`, driven straight (speed held) for `lead`
 * metres, then full lock toward `side` (+1 right, -1 left) is held for `seconds`, the throttle frozen;
 * the run goes on for `after` seconds with the steering released. Instead of one hold, `keys` gives
 * a sequence of them ([[from, to, side], ...] in seconds from the first one); with `speeds`
 * ([[seconds, km/h], ...], from the first key) the throttle and the brake follow that speed instead
 * of being frozen. Call beforeStep()
 * before every simulation step: it records what the previous step gave (60 samples a second, and
 * the instants at which something first happens: `marks`), then sets the controls of the next one.
 */
export class HeldSteeringRun {
  constructor(race, car, { s0, d0 = 0, kmh, lead, side = 1, seconds, keys = null, speeds = null, after = 1, roadHalfWidth = race.track.halfWidth }) {
    const v0 = kmh / KMH, tops = car.params.spec.gearTopSpeeds;
    placeCar(car, race.track, s0, d0);
    car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = v0;
    car.gear = tops.findIndex((top) => v0 < top * 0.93) + 1 || tops.length;
    this.keys = keys || [[0, seconds, side]];
    this.speeds = speeds; this.brake = 0;
    this.race = race; this.car = car; this.v0 = v0; this.lead = lead; this.side = this.keys[0][2]; this.seconds = this.keys[this.keys.length - 1][1]; this.after = after; this.roadHalfWidth = roadHalfWidth;
    this.sStart = car.progress; this.throttle = 0.5; this.started = -1; this.tick = 0; this.request = 0;
    this.samples = []; this.marks = {}; this.done = false;
  }

  /** Seconds since the key went down (negative before). */
  get time() { return this.started < 0 ? -1 : (this.tick - this.started) * SIM_DT; }

  beforeStep() {
    const car = this.car;
    if (this.started >= 0 && this.tick > this.started && !this.done) this.record();
    if (this.started < 0 && car.progress - this.sStart >= this.lead) this.started = this.tick;
    if (this.started < 0) this.throttle = clamp(this.throttle + (this.v0 - car.speed) * 0.02, 0, 1);      // holds the speed up to the turn-in point
    const t = this.time;
    const key = t >= 0 ? this.keys.find((k) => t >= k[0] - 1e-9 && t < k[1] - 1e-9) : null;
    this.request = key ? key[2] : 0;
    if (key) this.side = key[2];
    if (t >= this.seconds + this.after || (this.started >= 0 && car.state !== CAR_STATE.RACING && car.state !== CAR_STATE.SPIN)) this.done = true;
    if (t >= 0 && this.speeds) {
      // follow the speed asked for at this instant (between two readings: a straight line)
      const sp = this.speeds;
      let target = sp[sp.length - 1][1];
      if (t <= sp[0][0]) target = sp[0][1];
      else for (let i = 1; i < sp.length; i++) if (t <= sp[i][0]) { target = sp[i - 1][1] + ((sp[i][1] - sp[i - 1][1]) * (t - sp[i - 1][0])) / (sp[i][0] - sp[i - 1][0]); break; }
      const error = target / KMH - car.speed;                                     // m/s
      this.brake = error < -0.4 ? clamp(-error * 0.35, 0, 1) : 0;
      this.throttle = error < -0.4 ? 0 : clamp(0.6 + error * 0.5, 0, 1);
    }
    if (!this.done) this.race.setPlayerInput(car.playerIndex || 0, this.request, this.throttle, this.brake, 0, false, false);
    this.tick++;
  }

  record() {
    const car = this.car, t = round(this.time, 3), st = steeringState(car), marks = this.marks;
    const mark = (name, test) => { if (marks[name] === undefined && test) marks[name] = t; };
    mark('steeringAtItsStop', Math.abs(car.steer) >= 1);
    mark('phase2Starts', car.steerExtra > 0);
    mark('phase2Complete', car.steerExtra >= 1);
    mark('tyresSqueal', car.slip > 0.22);
    mark('tyreMarks', car.slip > 0.55);
    mark('tyreSmoke', car.slip > 0.85);
    mark('spin', car.state === CAR_STATE.SPIN);
    if (marks.leavesTheRoad === undefined && Math.abs(car.d) > this.roadHalfWidth) { marks.leavesTheRoad = t; marks.leftOn = car.d * this.side > 0 ? 'inside' : 'outside'; }
    if ((this.tick - this.started) % 2 === 0) {
      this.samples.push({ t, request: this.request, steer: round(st.steer, 3), hold: round(st.hold, 3), phase2: round(st.phase2, 3), applied: round(st.applied, 3), wheelDeg: round(st.wheelDeg, 2),
        yawDegS: round(st.yawDegS, 2), kmh: round(st.kmh, 1), latG: round(st.latG, 2), gripG: round(st.gripG, 2), askedShare: round(st.askedShare, 2), slip: round(st.slip, 2),
        slideDeg: round(st.slideDeg, 2), d: round(st.d, 2), state: st.state });
    }
  }

  /** Figures of the run while the key was held (up to the spin, if any). */
  summary() {
    const end = this.marks.spin ?? this.seconds;
    const during = this.samples.filter((x) => x.t <= end);
    if (!during.length) return null;
    const nearest = (t) => during.reduce((best, x) => (Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best), during[0]);
    const plateau = Math.abs(nearest(Math.min(0.5, end)).yawDegS), turning = during.filter((x) => Math.abs(x.yawDegS) > 1);
    const most = (f) => Math.max(...during.map(f));
    return {
      yawSteadyAfter: (during.find((x) => Math.abs(x.yawDegS) >= 0.95 * plateau) || during[0]).t, yawAtHalfSecond: round(plateau, 1), largestYaw: round(most((x) => Math.abs(x.yawDegS)), 1),
      tightestRadiusM: turning.length ? round(Math.min(...turning.map((x) => (x.kmh / KMH) / (Math.abs(x.yawDegS) / DEG))), 1) : null,
      kmhAtStart: during[0].kmh, kmhAtEnd: during[during.length - 1].kmh, largestAskedShare: round(most((x) => x.askedShare), 2), largestApplied: round(most((x) => Math.abs(x.applied)), 2),
      largestSlip: round(most((x) => x.slip), 2), largestSlideDeg: round(most((x) => x.slideDeg), 2), largestLatG: round(most((x) => x.latG), 2),
      headingTurnedDeg: round(during.reduce((sum, x) => sum + Math.abs(x.yawDegS) / 60, 0), 1), dAtEnd: during[during.length - 1].d,
    };
  }
}

/** The run of the reference passage on its circuit (REFERENCE_PASSAGE): where the car starts, at what speed, with which keys. */
export function passageManoeuvre(track) {
  const P = REFERENCE_PASSAGE, first = trackBends(track)[0].sFrom + P.firstKeyAfterBendStart;
  return { s0: first - P.lead, kmh: P.kmh, lead: P.lead, keys: P.keys, speeds: P.speeds, after: P.seconds - P.keys[P.keys.length - 1][1] };
}

/** The manoeuvre of a demonstration on a track: where the car starts, at what speed, toward which side. */
export function demoManoeuvre(track, params, demo) {
  const bend = trackBends(track)[demo.bend - 1];
  const limit = cornerSpeed(params, bend.kappa, 1), kmh = Math.min(300, limit * demo.share * KMH), lead = Math.max(40, (kmh / KMH) * 1.2);
  return { bend, limitKmh: limit * KMH, kmh, lead, s0: bend.sFrom - lead, side: bend.side, seconds: demo.seconds };
}

export class SteeringBench {
  /**
   * @param app        GameApp
   * @param quickRace  function(options) that starts a race (main.js)
   */
  constructor(app, quickRace) {
    this.app = app; this.quickRace = quickRace;
    this.variant = STEERING_REFERENCE;       // name shown; `custom` holds a hand-tuned copy given at launch, if any
    this.custom = null;
    this.race = null; this.me = null; this.run = null; this.lastRun = null; this.demo = null; this.demoIndex = -1;
    this.handOver = true;                      // false: after a demonstration nobody drives (recordings)
    this.onChange = null;
  }

  get active() { return !!this.race && this.app.race === this.race; }

  /** The variant object in use (null: the validated driving). */
  get steering() { return this.custom && this.custom.id === this.variant ? this.custom : steeringVariant(this.variant) || null; }

  /** Change the variant, at once, in the race under way. False for an unknown name. */
  setVariant(name) {
    const key = String(name || '').toLowerCase();
    if (steeringVariant(key) === undefined) return false;
    this.variant = key;
    if (this.active) this.race.setSteeringVariant(this.steering || STEERING_REFERENCE);
    if (this.onChange) this.onChange(this);
    return true;
  }

  /**
   * A fresh run on the bench, alone on the road, the start skipped. Without `demo` the car is handed
   * to the player 330 m before the first bend, at 140 km/h; with one ({ bend, share, seconds }) the
   * measured manoeuvre is played first; with { passage: true } the passage of the reference footage
   * is played on its own circuit.
   */
  start({ variant = this.variant, demo = null, handOver = true } = {}) {
    if (!this.setVariant(variant)) return false;
    const passage = !!(demo && demo.passage);
    const race = this.quickRace({ circuit: passage ? REFERENCE_PASSAGE.circuit : BENCH_CIRCUIT, opponents: 0, autoDrive: false, rules: 'arcade', laps: 9, seed: 1, steering: this.steering || STEERING_REFERENCE });
    let guard = 0;
    while (race.phase !== 'racing' && guard++ < 6000) { race.step(SIM_DT); race.eventCount = 0; }
    const me = race.playerCars[0], track = race.track;
    this.race = race; this.me = me; this.run = null; this.lastRun = null; this.demo = demo; this.handOver = handOver;
    if (demo) {
      this.run = new HeldSteeringRun(race, me, passage ? passageManoeuvre(track) : demoManoeuvre(track, me.params, demo));
      this.lastRun = this.run;
    } else {
      const first = trackBends(track)[0], v = 140 / KMH, tops = me.params.spec.gearTopSpeeds;
      placeCar(me, track, first.sFrom - 330, 0);
      me.state = CAR_STATE.RACING; me.ghostTimer = 0; me.speed = v; me.gear = tops.findIndex((top) => v < top * 0.93) + 1 || tops.length;
    }
    if (this.onChange) this.onChange(this);
    return true;
  }

  /** The next demonstration of the list (key 5). */
  nextDemo() {
    this.demoIndex = (this.demoIndex + 1) % BENCH_DEMOS.length;
    return this.start({ demo: BENCH_DEMOS[this.demoIndex] });
  }

  /** The passage of the reference footage, with the variant selected (key 6). */
  playPassage() { return this.start({ demo: { passage: true } }); }

  /** What the steering is doing now, with the time and the key of the manoeuvre being played (null when none is). */
  figures() {
    if (!this.active) return null;
    const run = this.run || this.lastRun;
    return { ...steeringState(this.me), time: run ? run.time : null, key: this.run ? this.run.request : 0, playing: !!this.run };
  }

  /** Called before every simulation step, after the player's controls have been read. */
  beforeStep() {
    if (!this.active || !this.run) return;
    this.run.beforeStep();
    if (!this.run.done) return;
    this.run = null;
    if (!this.handOver) this.race.setPlayerInput(0, 0, 0, 0, 0, false, false);
    if (this.onChange) this.onChange(this);
  }

  /** While a demonstration plays, or when nobody is meant to drive after it, the keyboard does not drive the car. */
  get scripted() { return this.active && (!!this.run || (!!this.demo && !this.handOver)); }
}

/**
 * Interactive use (index.html#steerlab=...): three lines above the picture and a few keys, bound
 * only while this option is present. 1 to 4 choose the variant, Enter starts again, 5 plays the
 * next demonstration, 6 the passage of the reference footage.
 */
export function attachSteeringBenchControls(bench, t) {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:5;padding:5px 12px;border:2px solid #16161f;border-radius:4px;'
    + 'background:#f4efe2;color:#16161f;font:600 13px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none;max-width:94vw;white-space:pre-line';
  document.body.appendChild(panel);
  const fr = (v, digits) => v.toFixed(digits).replace('.', t('steerlab.decimal'));
  const refresh = () => {
    const name = bench.custom && bench.custom.id === bench.variant ? `${t(`steerlab.variant.${bench.variant}`)} — ${t('steerlab.custom')}` : t(`steerlab.variant.${bench.variant}`);
    let state = t('steerlab.stopped');
    if (bench.active && bench.demo && bench.demo.passage) state = t(bench.run ? 'steerlab.passage' : 'steerlab.passageDone', { kmh: REFERENCE_PASSAGE.kmh });
    else if (bench.active && bench.demo) {
      const m = demoManoeuvre(bench.race.track, bench.me.params, bench.demo);
      state = t(bench.run ? 'steerlab.demo' : 'steerlab.demoDone', { bend: bench.demo.bend, radius: Math.round(m.bend.radius), side: t(m.side > 0 ? 'steerlab.right' : 'steerlab.left'), kmh: Math.round(m.kmh), seconds: bench.demo.seconds });
    } else if (bench.active) state = t('steerlab.yours');
    let figures = '';
    if (bench.active) {
      const st = steeringState(bench.me);
      figures = `\n${t('steerlab.figures', { hold: fr(st.hold, 2), applied: fr(Math.abs(st.applied), 2), phase2: Math.round(st.phase2 * 100), slide: fr(st.slideDeg, 1), slip: fr(st.slip, 2), kmh: Math.round(st.kmh) })}`;
    }
    panel.textContent = `${t('steerlab.title')} — ${name}\n${state} · ${t('steerlab.keys')}${figures}`;
  };
  bench.onChange = refresh;
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    const chosen = BENCH_VARIANT_KEYS[event.code];
    if (chosen) bench.setVariant(chosen);
    else if (event.code === 'Enter' || event.code === 'NumpadEnter') bench.start();
    else if (event.code === 'Digit5') bench.nextDemo();
    else if (event.code === 'Digit6') bench.playPassage();
  });
  setInterval(refresh, 100);
  refresh();
}
