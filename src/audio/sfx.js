// One-shot sounds, synthesised on demand from oscillators and filtered noise: start signal,
// impacts, crash, puncture, pit stop, engine failure, lap chimes and menu blips. Graphs are
// built per event (never per frame) and unplug themselves when their source ends.

import { clamp, saturate } from '../core/math.js';
import { Random } from '../core/random.js';
import { AUDIO_TUNING } from './audio-tuning.js';

const X = AUDIO_TUNING.sfx;
const PANS = [-0.8, -0.4, 0, 0.4, 0.8];

export class SfxPlayer {
  /**
   * @param res            shared resources: { white, pink } noise buffers
   * @param destination    bus of the race one-shots
   * @param uiDestination  bus of the menu sounds (stays open while the game is paused)
   */
  constructor(context, res, destination, uiDestination) {
    this.context = context;
    this.res = res;
    this.rng = new Random(0x5f3);
    this.active = 0;
    this.lastImpact = [-1, -1, -1];
    this.nodes = [];
    // Fixed pan positions: a one-shot picks the closest instead of creating its own panner.
    this.buses = PANS.map((pan) => {
      const node = context.createStereoPanner();
      node.pan.value = pan;
      node.connect(destination);
      this.nodes.push(node);
      return node;
    });
    // Beeps go through a low-pass: softer, early arcade flavour.
    this.soft = this.softener(destination);
    this.uiSoft = this.softener(uiDestination);
    this.uiOut = uiDestination;
  }

  softener(destination) {
    const node = this.context.createBiquadFilter();
    node.type = 'lowpass';
    node.frequency.value = 3400;
    node.Q.value = 0.5;
    node.connect(destination);
    this.nodes.push(node);
    return node;
  }

  bus(pan) {
    const index = Number.isFinite(pan) ? clamp(Math.round((pan + 0.8) / 0.4), 0, PANS.length - 1) : 2;
    return this.buses[index];
  }

  // ---- primitives

  launch(source, last, time, duration, offset = 0) {
    this.active++;
    source.onended = () => { this.active--; last.disconnect(); };
    source.start(time, offset);
    source.stop(time + duration);
  }

  /** Percussive envelope: linear attack then exponential decay (`decay` = time to about -43 dB). */
  envelope(param, time, attack, decay, level) {
    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(level, time + attack);
    param.setTargetAtTime(0, time + attack, decay * 0.2);
  }

  /** Oscillator with a pitch glide f0 -> f1 and a percussive envelope. */
  tone(destination, time, type, f0, f1, attack, decay, level) {
    if (this.active >= X.maxActive || !(level > 0)) return;
    const context = this.context;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, time);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, time + attack + decay);
    const gain = context.createGain();
    this.envelope(gain.gain, time, attack, decay, level * X.level);
    osc.connect(gain); gain.connect(destination);
    this.launch(osc, gain, time, attack + decay * 1.5);
  }

  /** Steady tone with short fades. */
  beep(destination, time, type, frequency, duration, level) {
    if (this.active >= X.maxActive || !(level > 0)) return;
    const context = this.context;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level * X.level, time + 0.005);
    gain.gain.setTargetAtTime(0, time + duration, 0.012);
    osc.connect(gain); gain.connect(destination);
    this.launch(osc, gain, time, duration + 0.1);
  }

  /** Filtered noise burst with a filter sweep f0 -> f1. */
  noise(destination, time, buffer, type, f0, f1, q, attack, decay, level) {
    if (this.active >= X.maxActive || !(level > 0)) return;
    const context = this.context;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, time);
    if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f1, time + attack + decay);
    const gain = context.createGain();
    this.envelope(gain.gain, time, attack, decay, level * X.level);
    source.connect(filter); filter.connect(gain); gain.connect(destination);
    this.launch(source, gain, time, attack + decay * 1.5, this.rng.next() * buffer.duration);
  }

  /** Noise chopped by a square LFO (rattle), with a flat envelope. */
  rattle(destination, time, frequency, q, rate, duration, level) {
    if (this.active >= X.maxActive || !(level > 0)) return;
    const context = this.context;
    const source = context.createBufferSource();
    source.buffer = this.res.white;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const chop = context.createGain();
    chop.gain.value = 0.5;
    const lfo = context.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = rate;
    const depth = context.createGain();
    depth.gain.value = 0.5;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level * X.level, time + 0.01);
    gain.gain.setTargetAtTime(0, time + duration, 0.015);
    source.connect(filter); filter.connect(chop); chop.connect(gain); gain.connect(destination);
    lfo.connect(depth); depth.connect(chop.gain);
    lfo.start(time); lfo.stop(time + duration + 0.12);
    this.launch(source, gain, time, duration + 0.12, this.rng.next() * source.buffer.duration);
  }

  /** Series of soft slaps at a fixed rate, fading out: a flat tyre beating the bodywork. */
  flaps(destination, time, rate, count, level) {
    if (this.active >= X.maxActive || !(level > 0)) return;
    const context = this.context;
    const source = context.createBufferSource();
    source.buffer = this.res.pink;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    filter.Q.value = 1.2;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    const period = 1 / rate;
    for (let i = 0; i < count; i++) {
      const t = time + i * period;
      gain.gain.setTargetAtTime(level * X.level * (1 - (0.8 * i) / count), t, 0.004);
      gain.gain.setTargetAtTime(0, t + 0.014, period * 0.16);
    }
    source.connect(filter); filter.connect(gain); gain.connect(destination);
    this.launch(source, gain, time, count * period + 0.2, this.rng.next() * source.buffer.duration);
  }

  // ---- start signal and menus

  startLight(time) {
    this.beep(this.soft, time, 'square', X.lightFrequency, X.lightTime, X.signalLevel * 0.55);
    this.beep(this.soft, time, 'sine', X.lightFrequency * 2, X.lightTime, X.signalLevel * 0.3);
  }

  startGreen(time) {
    this.beep(this.soft, time, 'square', X.greenFrequency, X.greenTime, X.signalLevel * 0.6);
    this.beep(this.soft, time, 'sine', X.greenFrequency * 2, X.greenTime, X.signalLevel * 0.35);
    this.beep(this.soft, time, 'triangle', X.greenFrequency * 1.5, X.greenTime * 0.5, X.signalLevel * 0.25);
  }

  ui(name, time) {
    const out = this.uiSoft, level = X.uiLevel;
    switch (name) {
      case 'move':
        this.beep(out, time, 'square', 880, 0.028, level * 0.5);
        break;
      case 'select':
        this.beep(out, time, 'square', 660, 0.05, level * 0.6);
        this.beep(out, time + 0.065, 'square', 990, 0.1, level * 0.6);
        break;
      case 'back':
        this.beep(out, time, 'square', 660, 0.05, level * 0.6);
        this.beep(out, time + 0.065, 'square', 440, 0.1, level * 0.6);
        break;
      case 'error':
        this.beep(out, time, 'sawtooth', 147, 0.09, level * 0.9);
        this.beep(out, time + 0.13, 'sawtooth', 110, 0.16, level * 0.9);
        break;
      case 'panel': // a page of the comic being turned: soft swish plus a papery flick
        this.noise(this.uiOut, time, this.res.pink, 'bandpass', 420, 2600, 0.8, 0.07, 0.22, level * 4);
        this.noise(this.uiOut, time + 0.05, this.res.white, 'highpass', 3200, 5200, 0.7, 0.02, 0.09, level * 0.5);
        break;
      default:
        break;
    }
  }

  // ---- race events

  /**
   * Wall or car contact. `slot` (0, 1: listeners, 2: others) rate-limits scraping contacts.
   * @param speed impact speed in m/s
   */
  impact(slot, pan, level, speed, wall, time) {
    if (time - this.lastImpact[slot] < X.impactMinInterval && this.lastImpact[slot] >= 0) return;
    this.lastImpact[slot] = time;
    const out = this.bus(pan), white = this.res.white;
    if (speed < X.scrapeSpeed) {
      this.noise(out, time, white, 'bandpass', 1500, 900, 1.2, 0.004, 0.09, 1.1 * level);
      return;
    }
    const s = saturate(speed / X.impactSpeedFull);
    const power = (0.3 + 0.7 * s) * level;
    this.noise(out, time, white, 'lowpass', 2600 + 3200 * s, 420, 0.7, 0.002, 0.1 + 0.24 * s, 1.1 * power);
    this.tone(out, time, 'sine', 132, 42, 0.003, 0.16 + 0.22 * s, 1.1 * power);
    if (wall) { // ring of the barrier
      const f = 390 + 80 * this.rng.next();
      this.tone(out, time, 'triangle', f, f * 0.96, 0.002, 0.14, 0.2 * power);
      this.tone(out, time, 'triangle', f * 2.76, f * 2.7, 0.002, 0.07, 0.1 * power);
    } else { // bodywork crunch
      this.noise(out, time + 0.015, white, 'bandpass', 2500, 1400, 2, 0.002, 0.09, 0.45 * power);
    }
  }

  /** Big accident: long crunch, low thump and scattered debris. */
  crash(pan, level, time) {
    const out = this.bus(pan), rng = this.rng;
    this.noise(out, time, this.res.pink, 'lowpass', 6000, 260, 0.8, 0.003, 0.8, 1.5 * level);
    this.tone(out, time, 'sine', 96, 30, 0.004, 0.5, 1.1 * level);
    this.tone(out, time + 0.03, 'triangle', 318, 190, 0.002, 0.32, 0.22 * level);
    this.tone(out, time + 0.03, 'triangle', 517, 320, 0.002, 0.24, 0.16 * level);
    for (let i = 0; i < 6; i++) {
      const f = 1500 + 3500 * rng.next();
      this.noise(out, time + 0.06 + 0.55 * rng.next(), this.res.white, 'bandpass', f, f * 0.7, 3, 0.001, 0.04 + 0.05 * rng.next(), (0.3 + 0.3 * rng.next()) * level);
    }
  }

  /** Tyre failure: pop, escaping air, then flapping at the wheel rate. */
  puncture(pan, level, speed, time) {
    const out = this.bus(pan);
    this.noise(out, time, this.res.white, 'highpass', 1800, 900, 0.7, 0.001, 0.1, 0.8 * level);
    this.tone(out, time, 'sine', 180, 60, 0.002, 0.14, 0.7 * level);
    this.noise(out, time + 0.02, this.res.white, 'bandpass', 5200, 2400, 1.5, 0.01, 0.55, 0.3 * level);
    const rate = clamp(speed / AUDIO_TUNING.surface.wheelCircumference, 6, 24);
    this.flaps(out, time + 0.12, rate, Math.round(rate * 2.2), 1.3 * level);
  }

  lap(best, time) {
    const out = this.soft, level = X.uiLevel;
    this.beep(out, time, 'triangle', 1319, 0.06, level);
    this.beep(out, time + 0.08, 'triangle', 1976, 0.11, level);
    if (best) this.beep(out, time + 0.2, 'triangle', 2637, 0.2, level);
  }

  finish(time) {
    const out = this.soft, level = X.uiLevel;
    this.beep(out, time, 'square', 784, 0.08, level * 0.6);
    this.beep(out, time + 0.1, 'square', 988, 0.08, level * 0.6);
    this.beep(out, time + 0.2, 'square', 1175, 0.08, level * 0.6);
    this.beep(out, time + 0.3, 'square', 1568, 0.4, level * 0.6);
    this.beep(out, time + 0.3, 'triangle', 784, 0.4, level * 0.8);
  }

  /** Airy pass-by: rising when gaining a place, falling when losing one. */
  whoosh(pan, rising, level, time) {
    const out = this.bus(pan);
    if (rising) this.noise(out, time, this.res.pink, 'bandpass', 500, 2400, 1.3, 0.12, 0.26, 2 * level);
    else this.noise(out, time, this.res.pink, 'bandpass', 1900, 380, 1.3, 0.1, 0.3, 2 * level);
  }

  /** Pit stop: the car drops on its jacks and four wheel guns rattle. */
  pitStart(pan, level, time) {
    const out = this.bus(pan), rng = this.rng;
    this.tone(out, time, 'sine', 100, 55, 0.004, 0.14, 0.5 * level);
    for (let i = 0; i < 4; i++) {
      const t = time + 0.22 + i * 0.4 + 0.1 * rng.next();
      const duration = 0.2 + 0.1 * rng.next();
      this.rattle(out, t, 2500 + 500 * rng.next(), 2.2, 38 + 8 * rng.next(), duration, 0.4 * level);
      this.tone(out, t, 'sawtooth', 210, 280, 0.02, duration, 0.05 * level);
    }
  }

  pitDone(pan, level, time) {
    const out = this.bus(pan);
    this.tone(out, time, 'sine', 92, 44, 0.003, 0.18, 0.8 * level);
    this.noise(out, time, this.res.white, 'bandpass', 3000, 1200, 1, 0.004, 0.12, 0.2 * level);
    this.beep(this.soft, time + 0.06, 'square', 880, 0.07, X.uiLevel * 0.6 * level);
    this.beep(this.soft, time + 0.16, 'square', 1320, 0.15, X.uiLevel * 0.6 * level);
  }

  /** Blown engine: bang, dying whine, sputter and escaping steam. */
  engineFailure(pan, level, time) {
    const out = this.bus(pan);
    this.noise(out, time, this.res.white, 'lowpass', 3200, 300, 0.8, 0.002, 0.28, 1.2 * level);
    this.tone(out, time, 'sine', 112, 34, 0.003, 0.34, 1.1 * level);
    this.tone(this.soft, time + 0.02, 'sawtooth', 540, 48, 0.03, 1.3, 0.2 * level);
    this.noise(out, time + 0.05, this.res.white, 'highpass', 2600, 1300, 0.7, 0.06, 1.7, 0.3 * level);
    for (let i = 0; i < 5; i++) this.tone(out, time + 0.18 + i * 0.1 * (1 + 0.3 * i), 'square', 74, 48, 0.002, 0.06, 0.28 * level);
  }

  retire(time) {
    const out = this.soft, level = X.uiLevel;
    this.beep(out, time, 'triangle', 440, 0.12, level);
    this.beep(out, time + 0.17, 'triangle', 349, 0.12, level);
    this.beep(out, time + 0.34, 'triangle', 262, 0.3, level);
  }

  /** Car put back on the track. */
  reset(pan, time) {
    this.noise(this.bus(pan), time, this.res.pink, 'bandpass', 300, 2800, 1.5, 0.24, 0.16, 0.6);
    this.beep(this.soft, time + 0.28, 'triangle', 988, 0.07, X.uiLevel * 0.8);
  }

  /** Boost overheated: alarm and steam. */
  overheat(pan, time) {
    const level = X.uiLevel * 0.7;
    for (let i = 0; i < 3; i++) this.beep(this.soft, time + i * 0.15, 'square', i % 2 ? 1109 : 1480, 0.08, level);
    this.noise(this.bus(pan), time, this.res.white, 'highpass', 3200, 2200, 0.7, 0.03, 0.9, 0.28);
  }

  /** Turbo blow-off when the boost is released. */
  blowOff(pan, level, time) {
    this.noise(this.bus(pan), time, this.res.white, 'bandpass', 5200, 2300, 1.2, 0.004, 0.17, 0.4 * level);
  }

  dispose() {
    for (let i = 0; i < this.nodes.length; i++) this.nodes[i].disconnect();
    this.nodes.length = 0;
  }
}
