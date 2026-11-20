// Noises of a listener's own car besides the engine: wind and road rumble rising with speed,
// tyre squeal (slip and wheelspin), surface rumble (kerbs, grass, gravel), brake hiss and the
// flapping of a punctured tyre. One instance per listener, panned like its engine.

import { clamp, lerp, saturate, smoothstep } from '../core/math.js';
import { AUDIO_TUNING } from './audio-tuning.js';
import { SmoothParam, createNoiseSource, releaseNodes } from './noise.js';

const W = AUDIO_TUNING.wind;
const T = AUDIO_TUNING.tyres;
const S = AUDIO_TUNING.surface;
const B = AUDIO_TUNING.brake;
const SURFACE_ASPHALT = 0, SURFACE_KERB = 1, SURFACE_GRASS = 2, SURFACE_GRAVEL = 3, SURFACE_PIT = 4;
const CAR_RESET = 3;
const SLOW_NOISE_PEAK = 2.3; // brings the slow control noise (RMS 0.25, uniform) to a -1..1 range

function makeGain(context, value) {
  const node = context.createGain();
  node.gain.value = value;
  return node;
}

function makeFilter(context, type, frequency, q) {
  const node = context.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

export class CarNoise {
  /** @param res shared resources: { white, pink, brown } noise buffers */
  constructor(context, res, destination, seed = 0) {
    this.sources = [];
    this.nodes = [];
    const keep = (node) => { this.nodes.push(node); return node; };
    const run = (node) => { this.sources.push(node); this.nodes.push(node); return node; };
    const phase = 0.137 * (seed + 1);

    const panner = keep(context.createStereoPanner());
    panner.connect(destination);
    this.pan = new SmoothParam(panner.pan, 0.08, 0);
    const white = run(createNoiseSource(context, res.white, 1, phase + 0.4));
    const pink = run(createNoiseSource(context, res.pink, 1, phase + 0.2));
    const brown = run(createNoiseSource(context, res.brown, 1, phase));
    const wander = run(createNoiseSource(context, res.white, W.buffetRate, phase + 0.7)); // slow random control signal

    // Wind: band-passed pink noise opening with speed, buffeted by the slow noise (stronger in a slipstream).
    const windFilter = keep(makeFilter(context, 'bandpass', W.lowFrequency, W.q));
    const windGain = keep(makeGain(context, 0));
    const buffet = keep(makeGain(context, 0));
    pink.connect(windFilter); windFilter.connect(windGain); windGain.connect(panner);
    wander.connect(buffet); buffet.connect(windGain.gain);
    this.windFrequency = new SmoothParam(windFilter.frequency, W.tau, W.lowFrequency, true);
    this.wind = new SmoothParam(windGain.gain, W.tau, 0);
    this.buffet = new SmoothParam(buffet.gain, W.tau, 0);
    // Air hiss at high speed.
    const hissFilter = keep(makeFilter(context, 'highpass', W.hissFrequency, 0.7));
    const hissGain = keep(makeGain(context, 0));
    white.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(panner);
    this.hiss = new SmoothParam(hissGain.gain, W.tau, 0);
    // Road rumble.
    const roadFilter = keep(makeFilter(context, 'lowpass', W.roadLow, 0.8));
    const roadGain = keep(makeGain(context, 0));
    brown.connect(roadFilter); roadFilter.connect(roadGain); roadGain.connect(panner);
    this.roadFrequency = new SmoothParam(roadFilter.frequency, W.tau, W.roadLow, true);
    this.road = new SmoothParam(roadGain.gain, W.tau, 0);

    // Tyre squeal: two resonant bands on white noise, pitch wobbled by an LFO and a slow drift.
    const squealA = keep(makeFilter(context, 'bandpass', T.frequency, T.q));
    const squealB = keep(makeFilter(context, 'bandpass', T.frequency * T.secondRatio, T.q * 1.2));
    const squealBGain = keep(makeGain(context, T.secondLevel));
    const squealGain = keep(makeGain(context, 0));
    white.connect(squealA); squealA.connect(squealGain);
    white.connect(squealB); squealB.connect(squealBGain); squealBGain.connect(squealGain);
    squealGain.connect(panner);
    const wobble = run(context.createOscillator());
    wobble.frequency.value = T.wobbleRate * (1 + 0.07 * seed);
    wobble.start();
    const wobbleDepth = keep(makeGain(context, T.wobbleCents));
    const driftDepth = keep(makeGain(context, T.driftCents * SLOW_NOISE_PEAK));
    wobble.connect(wobbleDepth); wander.connect(driftDepth);
    wobbleDepth.connect(squealA.detune); wobbleDepth.connect(squealB.detune);
    driftDepth.connect(squealA.detune); driftDepth.connect(squealB.detune);
    this.squealA = new SmoothParam(squealA.frequency, T.tau, T.frequency, true);
    this.squealB = new SmoothParam(squealB.frequency, T.tau, T.frequency * T.secondRatio, true);
    this.squeal = new SmoothParam(squealGain.gain, T.tau, 0);

    // Kerb thump: a low sawtooth whose rate follows the speed, also chopping a band of noise.
    // The same generator at wheel rate is the flapping of a punctured tyre.
    const thumpOsc = run(context.createOscillator());
    thumpOsc.type = 'sawtooth';
    thumpOsc.frequency.value = S.kerbRateMin;
    thumpOsc.start();
    const thumpTone = keep(makeFilter(context, 'lowpass', S.kerbTone, 0.7));
    const thumpGain = keep(makeGain(context, 0));
    const rattleBand = keep(makeFilter(context, 'bandpass', S.kerbNoiseFrequency, 0.8));
    const rattle = keep(makeGain(context, 0.5));
    const rattleDepth = keep(makeGain(context, 0.5));
    const rattleLevel = keep(makeGain(context, S.kerbNoise * 4));
    thumpOsc.connect(thumpTone); thumpTone.connect(thumpGain);
    brown.connect(rattleBand); rattleBand.connect(rattle); rattle.connect(rattleLevel); rattleLevel.connect(thumpGain);
    thumpOsc.connect(rattleDepth); rattleDepth.connect(rattle.gain);
    thumpGain.connect(panner);
    this.thumpRate = new SmoothParam(thumpOsc.frequency, 0.05, S.kerbRateMin);
    this.thump = new SmoothParam(thumpGain.gain, S.tau, 0);

    // Grass and gravel: rough low noise, plus a crackling band for gravel.
    const roughFilter = keep(makeFilter(context, 'lowpass', S.grassFrequency, 0.9));
    const roughGain = keep(makeGain(context, 0));
    brown.connect(roughFilter); roughFilter.connect(roughGain); roughGain.connect(panner);
    this.rough = new SmoothParam(roughGain.gain, S.tau, 0);
    const gravelBand = keep(makeFilter(context, 'bandpass', S.gravelFrequency, 0.6));
    const gravelChop = keep(makeGain(context, 0.5));
    const gravelGain = keep(makeGain(context, 0));
    const crackle = run(createNoiseSource(context, res.white, S.gravelCrackle, phase + 0.55));
    const crackleDepth = keep(makeGain(context, 0.5 * SLOW_NOISE_PEAK));
    white.connect(gravelBand); gravelBand.connect(gravelChop); gravelChop.connect(gravelGain); gravelGain.connect(panner);
    crackle.connect(crackleDepth); crackleDepth.connect(gravelChop.gain);
    this.gravel = new SmoothParam(gravelGain.gain, S.tau, 0);

    // Brake hiss.
    const brakeBand = keep(makeFilter(context, 'bandpass', B.frequency, B.q));
    const brakeGain = keep(makeGain(context, 0));
    white.connect(brakeBand); brakeBand.connect(brakeGain); brakeGain.connect(panner);
    this.brake = new SmoothParam(brakeGain.gain, B.tau, 0);
  }

  setPan(pan, time) { this.pan.set(pan, time); }

  /** Follow a car. `gain` scales everything (0 mutes). */
  update(car, time, gain) {
    const level = car.state === CAR_RESET ? 0 : gain;
    const speed = car.speed < 0 ? -car.speed : car.speed;
    const v = saturate(speed / W.topSpeed);
    const surface = car.surface;
    const draft = saturate(car.draft || 0);
    const tarmac = surface === SURFACE_ASPHALT || surface === SURFACE_KERB || surface === SURFACE_PIT;

    const wind = W.level * Math.pow(v, W.exponent) * (1 - 0.25 * draft) * level;
    this.wind.set(wind, time);
    this.windFrequency.set(lerp(W.lowFrequency, W.highFrequency, v), time);
    this.buffet.set(wind * Math.min(0.9, W.buffet * v + W.draftBuffet * draft) * SLOW_NOISE_PEAK, time);
    this.hiss.set(W.hissLevel * Math.pow(v, W.hissExponent) * level, time);
    this.road.set(W.roadLevel * Math.pow(v, 0.8) * (tarmac ? 1 : 0.5) * level, time);
    this.roadFrequency.set(lerp(W.roadLow, W.roadHigh, v), time);

    const slide = smoothstep(T.slipMin, T.slipFull, car.slip) * smoothstep(T.speedMin, T.speedFull, speed);
    const spin = saturate(car.wheelspin) * T.spinLevel;
    const squeal = tarmac ? (slide > spin ? slide : spin) : 0;
    const pitch = (T.frequency + T.frequencyRange * saturate(car.slip * 0.6)) * lerp(1, T.spinPitch, spin / (spin + slide + 0.001));
    this.squealA.set(pitch, time);
    this.squealB.set(pitch * T.secondRatio, time);
    this.squeal.set(T.skidLevel * squeal * level, time);

    const rolling = smoothstep(S.speedMin, S.speedFull, speed);
    let thump = 0;
    if (surface === SURFACE_KERB) {
      thump = S.kerbLevel * (0.35 + 0.65 * rolling) * smoothstep(0.5, 3, speed);
      this.thumpRate.set(clamp(speed / S.kerbPitch, S.kerbRateMin, S.kerbRateMax), time);
    } else if (car.puncture === true) {
      thump = S.flapLevel * smoothstep(1, 12, speed);
      this.thumpRate.set(clamp(speed / S.wheelCircumference, 2, 40), time);
    }
    this.thump.set(thump * level, time);
    const grass = surface === SURFACE_GRASS ? S.grassLevel * rolling : 0;
    const gravel = surface === SURFACE_GRAVEL ? S.gravelLevel * rolling : 0;
    this.rough.set((grass + gravel * 0.8) * level, time);
    this.gravel.set(gravel * level, time);

    this.brake.set(B.level * smoothstep(B.brakeMin, 1, car.brake) * smoothstep(B.speedMin, B.speedFull, speed) * level, time);
  }

  silence(time) {
    this.wind.set(0, time); this.buffet.set(0, time); this.hiss.set(0, time); this.road.set(0, time);
    this.squeal.set(0, time); this.thump.set(0, time); this.rough.set(0, time); this.gravel.set(0, time);
    this.brake.set(0, time);
  }

  dispose() { releaseNodes(this.sources, this.nodes); }
}
