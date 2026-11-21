// Public facade of the procedural audio engine. Owns the AudioContext, the mixing buses
// (master / engine / effects / ambience), the engine and noise voices of the listeners, a small
// pool of opponent engine voices, the crowd, and maps race events to one-shot sounds.
//
//   listeners' engines + opponent voices -> raceEngines -> engineBus ---+
//   listeners' car noises -> raceFx ------+-> effectsBus ---------------+-> gate -+
//   one-shot effects ----------------------+                             |        |
//   crowd -> ambienceBus -----------------------------------------------+        v
//   menu sounds -> uiBus -------------------------------------------------------> mix
//   mix -> compressor -> safety limiter -> master -> destination

import { clamp, saturate } from '../core/math.js';
import { AUDIO_TUNING } from './audio-tuning.js';
import { NOISE_WHITE, NOISE_PINK, NOISE_BROWN, SmoothParam, createNoiseBuffer, createControlBuffer, createPulseBuffer, makeDriveCurve, makeLimiterCurve } from './noise.js';
import { PlayerEngineVoice, OpponentEngineVoice, createEngineWave, createStutterWave } from './engine-voice.js';
import { CarNoise } from './car-noise.js';
import { CrowdAmbience } from './ambience.js';
import { SfxPlayer } from './sfx.js';

const MIX = AUDIO_TUNING.mix;
const ENGINE = AUDIO_TUNING.engine;
const OPPONENTS = AUDIO_TUNING.opponents;
const CROWD = AUDIO_TUNING.crowd;
const SFX = AUDIO_TUNING.sfx;
const CAR_RETIRED = 5;
const VOLUME_KEYS = ['master', 'engine', 'effects', 'ambience'];

function volume(value) { return Math.pow(saturate(value), MIX.volumeCurve); }

function wrapDistance(delta, length) {
  if (length > 0) {
    delta %= length;
    if (delta > length * 0.5) delta -= length;
    else if (delta < -length * 0.5) delta += length;
  }
  return delta;
}

export class GameAudio {
  /**
   * @param settings { enabled, master, engine, effects, ambience } volumes 0..1
   * @param context  optional BaseAudioContext (tests render through an OfflineAudioContext);
   *                 otherwise an AudioContext is created by the first resume().
   */
  constructor(settings, context) {
    this.settings = { enabled: true, master: 0.8, engine: 0.8, effects: 0.8, ambience: 0.6 };
    this.context = null;
    this.ownsContext = false;
    this.offline = false;
    this.ready = false;
    this.disposed = false;
    this.suspended = false;
    this.scene = 'race';
    this.paused = false;
    this.stalled = false;        // update() stopped coming (hidden tab, race left without setScene)
    this.lastUpdate = 0;
    this.watchdog = 0;
    this.suspendTimer = 0;
    this.detachToken = 0;
    this.raceAttached = false;
    this.crowdAttached = false;
    this.listenerCount = -1;
    this.slots = [null, null];   // per listener: { engine, noise, car, pan, boosting }
    this.voices = [];            // opponent engine voices
    // Scratch state of the opponent voice allocator and of event localisation (no per-frame allocation).
    const n = OPPONENTS.voices;
    this.pickCar = new Int32Array(n);
    this.pickListener = new Int32Array(n);
    this.pickVoice = new Int32Array(n);
    this.pickScore = new Float32Array(n);
    this.pickDs = new Float32Array(n);
    this.pickDd = new Float32Array(n);
    this.hear = { gain: 0, pan: 0, slot: 2 };
    this.setSettings(settings);
    if (context) {
      this.context = context;
      this.offline = typeof context.startRendering === 'function';
      this.build();
    }
  }

  // ---- lifecycle

  /** Create (first call, from a user gesture) and start the audio context. Idempotent. */
  resume() {
    if (this.disposed) return Promise.resolve(false);
    if (!this.context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) return Promise.resolve(false);
      try {
        this.context = new Context({ latencyHint: 'interactive' });
      } catch (error) {
        return Promise.resolve(false);
      }
      this.ownsContext = true;
    }
    if (!this.ready) this.build();
    this.suspended = false;
    this.applySettings();
    return this.syncContext();
  }

  /** Silence everything but the menu sounds and freeze the graph (pause, menus). */
  suspend() {
    this.suspended = true;
    if (!this.ready) return;
    this.applySettings();
    this.syncContext();
  }

  /** Volumes can be changed at any time; missing keys keep their value. */
  setSettings(settings) {
    if (settings) {
      for (let i = 0; i < VOLUME_KEYS.length; i++) {
        const key = VOLUME_KEYS[i];
        if (typeof settings[key] === 'number' && !Number.isNaN(settings[key])) this.settings[key] = saturate(settings[key]);
      }
      if (settings.enabled !== undefined) this.settings.enabled = !!settings.enabled;
    }
    if (this.ready) { this.applySettings(); this.syncContext(); }
  }

  /** 'menu' | 'race' | 'results': engines and car noises only exist in the race scene. */
  setScene(scene) {
    if (scene === this.scene) return;
    this.scene = scene;
    this.paused = false;
    this.stalled = false;
    if (this.ready) this.applyScene();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.suspendTimer) { clearTimeout(this.suspendTimer); this.suspendTimer = 0; }
    if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = 0; }
    if (this.ready) {
      this.ready = false;
      for (let v = 0; v < this.slots.length; v++) {
        const slot = this.slots[v];
        if (slot) { slot.engine.dispose(); slot.noise.dispose(); }
        this.slots[v] = null;
      }
      for (let v = 0; v < this.voices.length; v++) this.voices[v].dispose();
      this.voices.length = 0;
      this.crowd.dispose();
      this.sfx.dispose();
      for (let i = 0; i < this.nodes.length; i++) this.nodes[i].disconnect();
      this.nodes.length = 0;
    }
    if (this.ownsContext && this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
  }

  // ---- graph

  build() {
    const context = this.context;
    const res = {
      white: createNoiseBuffer(context, 2.5, NOISE_WHITE, 11),
      pink: createNoiseBuffer(context, 3.5, NOISE_PINK, 23),
      brown: createNoiseBuffer(context, 3, NOISE_BROWN, 37),
      wander: createControlBuffer(context, 10, MIX.wanderRate, 41),
      flutter: createControlBuffer(context, 6, MIX.flutterRate, 43),
      pops: createPulseBuffer(context, 4, ENGINE.burbleRate, 0.0012, 0.003, 47),
      grit: createPulseBuffer(context, 3, AUDIO_TUNING.surface.gravelGrit, 0.0005, 0.002, 53),
      waves: {},
      stutterWave: createStutterWave(context),
      driveCurve: makeDriveCurve(ENGINE.driveAsymmetry),
    };
    const layouts = ENGINE.cylinders.concat(OPPONENTS.cylinders);
    for (let i = 0; i < layouts.length; i++) {
      if (!res.waves[layouts[i]]) res.waves[layouts[i]] = createEngineWave(context, layouts[i]);
    }
    this.res = res;
    this.nodes = [];
    const gain = (value) => {
      const node = context.createGain();
      node.gain.value = value;
      this.nodes.push(node);
      return node;
    };

    // Master chain.
    const master = gain(0);
    master.connect(context.destination);
    const limiter = context.createWaveShaper();
    limiter.curve = makeLimiterCurve(MIX.limiterKnee, MIX.limiterCeiling, MIX.limiterRange);
    limiter.connect(master);
    const post = gain(MIX.postCompressor / MIX.limiterRange);
    post.connect(limiter);
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = MIX.compressorThreshold;
    compressor.knee.value = MIX.compressorKnee;
    compressor.ratio.value = MIX.compressorRatio;
    compressor.attack.value = MIX.compressorAttack;
    compressor.release.value = MIX.compressorRelease;
    compressor.connect(post);
    this.nodes.push(limiter, compressor);
    this.compressor = compressor; // compressor.reduction can be shown by a debug overlay
    const mix = gain(1);
    mix.connect(compressor);
    const gate = gain(1);
    gate.connect(mix);

    // Buses matching the settings keys.
    this.engineBus = gain(0);
    this.effectsBus = gain(0);
    this.ambienceBus = gain(0);
    const uiBus = gain(0);
    this.engineBus.connect(gate); this.effectsBus.connect(gate); this.ambienceBus.connect(gate);
    uiBus.connect(mix);
    this.mixBus = mix;
    this.raceEngines = gain(0);
    this.raceFx = gain(0);
    this.crowdIn = gain(0);

    const tau = MIX.fadeTau;
    this.masterGain = new SmoothParam(master.gain, tau, 0);
    this.gateGain = new SmoothParam(gate.gain, tau, 1);
    this.engineGain = new SmoothParam(this.engineBus.gain, tau, 0);
    this.effectsGain = new SmoothParam(this.effectsBus.gain, tau, 0);
    this.ambienceGain = new SmoothParam(this.ambienceBus.gain, tau, 0);
    this.uiGain = new SmoothParam(uiBus.gain, tau, 0);
    this.raceEnginesGain = new SmoothParam(this.raceEngines.gain, tau, 0);
    this.raceFxGain = new SmoothParam(this.raceFx.gain, tau, 0);
    this.crowdGain = new SmoothParam(this.crowdIn.gain, tau, 0);

    this.sfx = new SfxPlayer(context, res, this.effectsBus, uiBus);
    this.crowd = new CrowdAmbience(context, res, this.crowdIn);
    for (let v = 0; v < OPPONENTS.voices; v++) this.voices.push(new OpponentEngineVoice(context, res, this.raceEngines));
    this.ready = true;
    this.ensureSlot(0);
    this.applySettings();
    this.applyScene();
    // Engines must not drone on when the frames stop (hidden tab...): a slow timer checks update() is alive.
    if (!this.offline) this.watchdog = setInterval(() => this.checkStall(), 250);
  }

  checkStall() {
    if (!this.ready || this.stalled || this.paused || this.scene !== 'race') return;
    if (this.context.currentTime - this.lastUpdate > MIX.stallTime) { this.stalled = true; this.applyScene(); }
  }

  ensureSlot(index) {
    if (this.slots[index]) return this.slots[index];
    const cylinders = ENGINE.cylinders[index % ENGINE.cylinders.length];
    const slot = {
      engine: new PlayerEngineVoice(this.context, this.res, this.raceEngines, cylinders),
      noise: new CarNoise(this.context, this.res, this.raceFx, index),
      car: null, pan: 0, boosting: false,
    };
    this.slots[index] = slot;
    return slot;
  }

  applySettings() {
    const settings = this.settings, time = this.context.currentTime;
    this.masterGain.set(settings.enabled ? volume(settings.master) : 0, time);
    this.gateGain.set(this.suspended ? 0 : 1, time);
    this.engineGain.set(volume(settings.engine), time);
    this.effectsGain.set(volume(settings.effects), time);
    this.ambienceGain.set(volume(settings.ambience), time);
    this.uiGain.set(volume(settings.effects), time);
  }

  applyScene() {
    const time = this.context.currentTime;
    const race = this.scene === 'race';
    const level = race && !this.paused && !this.stalled ? 1 : 0;
    this.raceEnginesGain.set(level, time);
    this.raceFxGain.set(level, time);
    this.crowdGain.set(race ? level : this.scene === 'results' ? MIX.resultsCrowd : 0, time);
    if (this.scene === 'results') this.crowd.hold(CROWD.level + CROWD.nearLevel * 0.5, time);
    if (race) {
      this.detachToken++;
      this.attach(true, true);
    } else {
      this.silenceVoices(time);
      this.attach(false, this.scene === 'results');
      this.scheduleDetach(time + MIX.detachDelay);
    }
  }

  /** Plug the race sub-graphs in (true) or leave them as they are (false). */
  attach(race, crowd) {
    if (race && !this.raceAttached) {
      this.raceEngines.connect(this.engineBus);
      this.raceFx.connect(this.effectsBus);
      this.raceAttached = true;
    }
    if (crowd && !this.crowdAttached) {
      this.crowdIn.connect(this.ambienceBus);
      this.crowdAttached = true;
    }
  }

  /**
   * Unplug what the current scene does not use once it has faded out, so that it costs no
   * processing in the menus. Timed on the audio clock by a silent source (works offline too).
   */
  scheduleDetach(time) {
    const token = ++this.detachToken;
    const timer = this.context.createConstantSource();
    timer.offset.value = 0;
    timer.connect(this.mixBus);
    timer.onended = () => {
      timer.disconnect();
      if (token !== this.detachToken || !this.ready || this.scene === 'race') return;
      if (this.raceAttached) {
        this.raceEngines.disconnect();
        this.raceFx.disconnect();
        this.raceAttached = false;
      }
      if (this.crowdAttached && this.scene !== 'results') {
        this.crowdIn.disconnect();
        this.crowdAttached = false;
      }
    };
    timer.start();
    timer.stop(time);
  }

  silenceVoices(time) {
    for (let v = 0; v < this.slots.length; v++) {
      const slot = this.slots[v];
      if (slot) { slot.engine.silence(time); slot.noise.silence(time); slot.car = null; slot.boosting = false; }
    }
    for (let v = 0; v < this.voices.length; v++) {
      const voice = this.voices[v];
      voice.gain.set(0, time);
      voice.carIndex = -1;
      voice.level = 0;
    }
  }

  /** Run or halt the real-time context according to `enabled` and suspend(). */
  syncContext() {
    const context = this.context;
    if (!context || this.offline) return Promise.resolve(true);
    if (this.suspendTimer) { clearTimeout(this.suspendTimer); this.suspendTimer = 0; }
    if (this.settings.enabled && !this.suspended) {
      if (context.state === 'running') return Promise.resolve(true);
      return context.resume().then(() => true, () => false);
    }
    // Let the fade-out finish before halting the context.
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = 0;
      if (this.context === context && (this.suspended || !this.settings.enabled) && context.state === 'running') context.suspend().catch(() => {});
    }, MIX.suspendDelay * 1000);
    return Promise.resolve(true);
  }

  // ---- per frame

  /** Once per rendered frame while a race is on screen. */
  update(app, dt) {
    if (!this.ready || this.suspended || !this.settings.enabled || this.scene !== 'race') return;
    const race = app.race;
    if (!race) return;
    const time = this.context.currentTime;
    const paused = !!app.paused;
    this.lastUpdate = time;
    if (paused !== this.paused || this.stalled) { this.paused = paused; this.stalled = false; this.applyScene(); }
    if (paused) return;

    const cars = race.cars, targets = app.viewTargets, slots = this.slots;
    let count = targets ? targets.length : 0;
    if (count > 2) count = 2;
    if (count !== this.listenerCount) this.setListenerCount(count, time);

    // Listeners: engine and car noises.
    for (let v = 0; v < 2; v++) {
      const slot = slots[v];
      if (!slot) continue;
      const car = v < count ? cars[targets[v]] : undefined;
      if (car && !car.removed) {
        slot.car = car;
        slot.engine.update(car, time, 1);
        slot.noise.update(car, time, 1);
        const boosting = !!car.boosting;
        if (slot.boosting && !boosting) this.sfx.blowOff(slot.pan, 1, time);
        slot.boosting = boosting;
      } else if (slot.car) {
        slot.car = null;
        slot.boosting = false;
        slot.engine.silence(time);
        slot.noise.silence(time);
      }
    }

    const length = race.track ? race.track.length : 0;
    this.updateOpponents(cars, targets, count, length, time, dt);

    // Crowd: louder next to the grandstands.
    let proximity = 0;
    const stands = CROWD.stands;
    for (let v = 0; v < count; v++) {
      const me = slots[v].car;
      if (!me) continue;
      for (let j = 0; j < stands.length; j += 2) {
        const x = wrapDistance(me.s - stands[j] * length, length) / CROWD.falloff;
        const near = stands[j + 1] * Math.exp(-x * x);
        if (near > proximity) proximity = near;
      }
    }
    this.crowd.update(proximity, race.phase === 'countdown' ? CROWD.countdownBoost : 1, time, dt);
  }

  setListenerCount(count, time) {
    this.listenerCount = count;
    for (let v = 0; v < count; v++) {
      const slot = this.ensureSlot(v);
      slot.pan = count > 1 ? (v === 0 ? -MIX.splitPan : MIX.splitPan) : 0;
      slot.engine.setPan(slot.pan, time);
      slot.noise.setPan(slot.pan, time);
    }
  }

  voiceOf(carIndex) {
    const voices = this.voices;
    for (let v = 0; v < voices.length; v++) if (voices[v].carIndex === carIndex) return v;
    return -1;
  }

  /** Give the voice pool to the nearest running cars and update it. */
  updateOpponents(cars, targets, count, length, time, dt) {
    const voices = this.voices, slots = this.slots, n = voices.length;
    const pickCar = this.pickCar, pickListener = this.pickListener, pickVoice = this.pickVoice;
    const pickScore = this.pickScore, pickDs = this.pickDs, pickDd = this.pickDd;
    const maxScore = OPPONENTS.maxDistance * OPPONENTS.maxDistance;
    let picked = 0;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (car.removed || car.engineOut || car.state === CAR_RETIRED) continue;
      if (count > 0 && (i === targets[0] || (count > 1 && i === targets[1]))) continue;
      let score = maxScore, listener = -1, bestDs = 0, bestDd = 0;
      for (let v = 0; v < count; v++) {
        const me = slots[v].car;
        if (!me) continue;
        const ds = wrapDistance(car.s - me.s, length), dd = car.d - me.d;
        const d2 = ds * ds + dd * dd;
        if (d2 < score) { score = d2; listener = v; bestDs = ds; bestDd = dd; }
      }
      if (listener < 0) continue;
      if (this.voiceOf(i) >= 0) score *= OPPONENTS.keepBias * OPPONENTS.keepBias;
      if (picked === n && score >= pickScore[n - 1]) continue;
      // Insertion in the list of the n nearest cars.
      let k = picked < n ? picked : n - 1;
      while (k > 0 && pickScore[k - 1] > score) {
        pickCar[k] = pickCar[k - 1]; pickListener[k] = pickListener[k - 1]; pickScore[k] = pickScore[k - 1];
        pickDs[k] = pickDs[k - 1]; pickDd[k] = pickDd[k - 1];
        k--;
      }
      pickCar[k] = i; pickListener[k] = listener; pickScore[k] = score; pickDs[k] = bestDs; pickDd[k] = bestDd;
      if (picked < n) picked++;
    }

    // Keep the voices of the cars still in the list, hand free voices to the newcomers. A voice
    // whose car left the list fades out first and is only reused once silent: no click.
    for (let v = 0; v < n; v++) voices[v].keep = false;
    for (let k = 0; k < picked; k++) {
      const v = this.voiceOf(pickCar[k]);
      pickVoice[k] = v;
      if (v >= 0) voices[v].keep = true;
    }
    for (let k = 0; k < picked; k++) {
      if (pickVoice[k] >= 0) continue;
      for (let v = 0; v < n; v++) {
        const voice = voices[v];
        if (voice.carIndex < 0 && !voice.keep) {
          voice.assign(pickCar[k]);
          voice.keep = true;
          pickVoice[k] = v;
          break;
        }
      }
    }
    const spread = count > 1 ? 0.55 : 1;
    for (let k = 0; k < picked; k++) {
      const v = pickVoice[k];
      if (v < 0) continue;
      const slot = slots[pickListener[k]];
      voices[v].update(cars[pickCar[k]], slot.car, pickDs[k], pickDd[k], slot.pan, spread, time, dt, 1);
    }
    for (let v = 0; v < n; v++) {
      const voice = voices[v];
      if (!voice.keep && voice.carIndex >= 0) voice.release(time, dt);
    }
  }

  // ---- events

  /** Listener slot watching a car, or -1. */
  slotOf(carIndex, app) {
    const targets = app.viewTargets;
    if (!targets) return -1;
    if (targets[0] === carIndex && this.slots[0]) return 0;
    if (targets.length > 1 && targets[1] === carIndex && this.slots[1]) return 1;
    return -1;
  }

  /**
   * How well an event of a car is heard: fills this.hear { gain, pan, slot } and returns the
   * gain (1 for a listener's own car, fading with the distance to the nearest listener otherwise).
   */
  locate(carIndex, app) {
    const hear = this.hear;
    hear.gain = 0; hear.pan = 0; hear.slot = 2;
    const race = app.race;
    const car = race ? race.cars[carIndex] : undefined;
    if (!car) return 0;
    const own = this.slotOf(carIndex, app);
    if (own >= 0) {
      hear.gain = 1; hear.pan = this.slots[own].pan; hear.slot = own;
      return 1;
    }
    const targets = app.viewTargets;
    const count = targets ? Math.min(2, targets.length) : 0;
    const length = race.track ? race.track.length : 0;
    for (let v = 0; v < count; v++) {
      const me = race.cars[targets[v]];
      if (!me) continue;
      const ds = wrapDistance(car.s - me.s, length), dd = car.d - me.d;
      const distance = Math.sqrt(ds * ds + dd * dd);
      if (distance >= SFX.hearingDistance) continue;
      const gain = (SFX.hearingRef / (SFX.hearingRef + distance)) * (1 - distance / SFX.hearingDistance);
      if (gain > hear.gain) {
        const base = this.slots[v] ? this.slots[v].pan : 0;
        hear.gain = gain;
        hear.pan = clamp(base + (count > 1 ? 0.55 : 1) * dd / Math.sqrt(dd * dd + SFX.panWidth * SFX.panWidth), -1, 1);
      }
    }
    return hear.gain;
  }

  /** Race events: { type, car, value, other }. The event object is not retained. */
  onEvent(event, app) {
    if (!this.ready || this.suspended || !this.settings.enabled || this.scene !== 'race') return;
    const time = this.context.currentTime, sfx = this.sfx, hear = this.hear;
    const type = event.type, index = event.car;
    const value = Number.isFinite(event.value) ? event.value : 0;
    switch (type) {
      case 'light':
        sfx.startLight(time);
        break;
      case 'green':
        sfx.startGreen(time);
        this.crowd.cheer(CROWD.cheerGreen, time);
        break;
      case 'shift': {
        const targets = app.viewTargets;
        let mine = false;
        for (let v = 0; v < 2; v++) {
          if (this.slots[v] && targets && v < targets.length && targets[v] === index) { this.slots[v].engine.shift(value, time); mine = true; }
        }
        if (!mine) {
          const v = this.voiceOf(index);
          if (v >= 0) this.voices[v].shift();
        }
        break;
      }
      case 'wall':
      case 'obstacle':
      case 'landing':
      case 'contact': {
        let gain = this.locate(index, app);
        if (type === 'contact' && gain < 1 && event.other >= 0) {
          const pan = hear.pan, slot = hear.slot;
          if (this.locate(event.other, app) > gain) gain = hear.gain;
          else { hear.gain = gain; hear.pan = pan; hear.slot = slot; }
        }
        if (gain > 0.02) sfx.impact(hear.slot, hear.pan, gain, type === 'landing' ? 14 : Math.min(20, Math.abs(value)), type !== 'contact', time);
        break;
      }
      case 'crash':
        if (this.locate(index, app) > 0.02) sfx.crash(hear.pan, hear.gain, time);
        break;
      case 'puncture':
        if (this.locate(index, app) > 0.02) sfx.puncture(hear.pan, hear.gain, Math.abs(app.race.cars[index].speed) || 0, time);
        break;
      case 'lap':
        if (this.slotOf(index, app) >= 0) sfx.lap(event.other === 1, time);
        break;
      case 'finish':
        if (this.slotOf(index, app) >= 0) { sfx.finish(time); this.crowd.cheer(CROWD.cheerFinish, time); }
        else if (value === 1) this.crowd.cheer(CROWD.cheerOther, time);
        break;
      case 'overtake':
        if (this.locate(index, app) === 1) { this.crowd.cheer(CROWD.cheerOvertake, time); sfx.whoosh(hear.pan, true, 0.5, time); }
        break;
      case 'overtaken':
        if (this.locate(index, app) === 1) sfx.whoosh(hear.pan, false, 0.5, time);
        break;
      case 'pitStart':
        if (this.locate(index, app) > 0.02) sfx.pitStart(hear.pan, hear.gain, time);
        break;
      case 'pitDone':
        if (this.locate(index, app) > 0.02) sfx.pitDone(hear.pan, hear.gain, time);
        break;
      case 'engine':
        if (this.locate(index, app) > 0.02) sfx.engineFailure(hear.pan, hear.gain, time);
        break;
      case 'retire':
        if (this.slotOf(index, app) >= 0) sfx.retire(time);
        break;
      case 'reset':
        if (this.locate(index, app) === 1) sfx.reset(hear.pan, time);
        break;
      case 'overheat':
        if (this.locate(index, app) === 1) sfx.overheat(hear.pan, time);
        break;
      default:
        break;
    }
  }

  /** Menu sounds: 'move' | 'select' | 'back' | 'error' | 'panel'. They also play while suspended. */
  uiSound(name) {
    if (!this.ready || !this.settings.enabled) return;
    const context = this.context;
    if (this.suspended && !this.offline) {
      // Wake the context for the blip, then let it go back to sleep.
      if (context.state !== 'running') context.resume().catch(() => {});
      if (this.suspendTimer) clearTimeout(this.suspendTimer);
      this.suspendTimer = setTimeout(() => {
        this.suspendTimer = 0;
        if (this.context === context && this.suspended && context.state === 'running') context.suspend().catch(() => {});
      }, 700);
    }
    this.sfx.ui(name, context.currentTime);
  }
}
