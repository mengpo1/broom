// Engine synthesis.
// PlayerEngineVoice: the full cockpit engine. Engine-order wavetable plus detuned saws at the
// firing frequency and its half, throttle driven distortion, exhaust formants, intake noise,
// overrun burble, rev limiter stutter, gear change torque cut and turbo whistle.
// OpponentEngineVoice: a cheap voice for nearby cars with distance attenuation, stereo
// position and a Doppler-like pitch shift.

import { TAU, clamp, lerp, saturate, smoothstep, damp } from '../core/math.js';
import { Random } from '../core/random.js';
import { AUDIO_TUNING } from './audio-tuning.js';
import { SmoothParam, createNoiseSource, releaseNodes } from './noise.js';

const E = AUDIO_TUNING.engine;
const O = AUDIO_TUNING.opponents;
const CAR_RETIRED = 5;

/**
 * Wavetable of a 4-stroke engine. The fundamental is one engine cycle (two crank turns), so
 * harmonic `cylinders` is the firing frequency. Firing harmonics dominate, odd multiples of half
 * the firing frequency give the bank-to-bank growl and every other order adds roughness.
 */
export function createEngineWave(context, cylinders, seed = 7) {
  const count = cylinders * E.firingPartials.length + 1;
  const real = new Float32Array(count), imag = new Float32Array(count);
  const rng = new Random(seed + cylinders * 131);
  for (let n = 1; n < count; n++) {
    let amplitude = E.roughness / (1 + n * 0.05);
    const twice = (2 * n) / cylinders; // in halves of the firing frequency
    if (Number.isInteger(twice)) {
      const index = Math.floor((twice - 1) / 2);
      amplitude += twice % 2 === 0 ? E.firingPartials[index] || 0 : E.halfPartials[index] || 0;
    }
    if (n === 2) amplitude += 0.2;  // engine order 1
    if (n === 4) amplitude += 0.14; // engine order 2
    const phase = rng.next() * TAU; // scattered phases keep the crest factor low
    real[n] = amplitude * Math.cos(phase);
    imag[n] = amplitude * Math.sin(phase);
  }
  return context.createPeriodicWave(real, imag);
}

function makeGain(context, value) {
  const node = context.createGain();
  node.gain.value = value;
  return node;
}

function makeFilter(context, type, frequency, q, gain = 0) {
  const node = context.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  node.gain.value = gain;
  return node;
}

function makeOscillator(context, type, wave, frequency) {
  const node = context.createOscillator();
  if (wave) node.setPeriodicWave(wave); else node.type = type;
  node.frequency.value = frequency;
  node.start();
  return node;
}

export class PlayerEngineVoice {
  /**
   * @param res  shared resources: { white, waves: {cylinders: PeriodicWave}, driveCurve, gateCurve }
   */
  constructor(context, res, destination, cylinders = E.cylinders[0]) {
    this.context = context;
    this.cylinders = cylinders;
    this.sources = [];
    this.nodes = [];
    const pitchTau = E.pitchTau, tau = E.paramTau;
    const idle = E.rpmIdle / 60;
    const keep = (node) => { this.nodes.push(node); return node; };
    const run = (node) => { this.sources.push(node); this.nodes.push(node); return node; };

    // Output chain: level -> shift torque cut -> limiter stutter -> pan.
    const sum = keep(makeGain(context, 0));
    this.cut = keep(makeGain(context, 1));
    const stutter = keep(makeGain(context, 1));
    const panner = keep(context.createStereoPanner());
    sum.connect(this.cut); this.cut.connect(stutter); stutter.connect(panner); panner.connect(destination);
    this.level = new SmoothParam(sum.gain, tau, 0);
    this.pan = new SmoothParam(panner.pan, 0.08, 0);
    this.stutterBase = new SmoothParam(stutter.gain, 0.012, 1);

    // Pitch modulation bus in cents: shift blips, limiter wobble and a slow random flutter.
    const detune = keep(makeGain(context, 1));
    this.blip = run(context.createConstantSource());
    this.blip.offset.value = 0;
    this.blip.connect(detune);
    this.blip.start();
    const flutter = run(createNoiseSource(context, res.white, 0.0004, 0.17 * cylinders));
    const flutterDepth = keep(makeGain(context, E.flutterCents * 2.3));
    flutter.connect(flutterDepth); flutterDepth.connect(detune);

    // Partials, mixed into the drive gain in front of the distortion.
    const drive = keep(makeGain(context, E.driveOff));
    this.drive = new SmoothParam(drive.gain, tau, E.driveOff);
    const partial = (type, wave, ratio, level) => {
      const osc = run(makeOscillator(context, type, wave, idle * ratio));
      const gain = keep(makeGain(context, level));
      detune.connect(osc.detune);
      osc.connect(gain); gain.connect(drive);
      return { frequency: new SmoothParam(osc.frequency, pitchTau, idle * ratio), gain: new SmoothParam(gain.gain, tau, level) };
    };
    const firingRatio = cylinders * 0.5;
    this.wave = partial('sine', res.waves[cylinders], 0.5, E.waveOff);
    this.saw = partial('sawtooth', null, firingRatio * E.sawDetune, E.sawOff);
    this.growl = partial('sawtooth', null, firingRatio * 0.5 * E.growlDetune, E.growlOff);
    this.sub = partial('square', null, 1, E.subLevel);

    // Distortion, DC blocker, exhaust resonances and the tone low-pass.
    const shaper = keep(context.createWaveShaper());
    shaper.curve = res.driveCurve;
    shaper.oversample = '2x';
    const dcBlock = keep(makeFilter(context, 'highpass', 38, 0.7));
    const body = keep(makeFilter(context, 'peaking', E.bodyFrequency, 1, E.bodyGain));
    const formant = keep(makeFilter(context, 'peaking', E.formantBase, E.formantQ, 0));
    const tone = keep(makeFilter(context, 'lowpass', E.toneClosed, 0.6));
    drive.connect(shaper); shaper.connect(dcBlock); dcBlock.connect(body); body.connect(formant); formant.connect(tone); tone.connect(sum);
    this.formantFrequency = new SmoothParam(formant.frequency, tau, E.formantBase, true);
    this.formantGain = new SmoothParam(formant.gain, tau, 0, true);
    this.tone = new SmoothParam(tone.frequency, tau, E.toneClosed, true);
    // Exhaust bark: band-pass around twice the firing frequency that opens with the throttle.
    const bark = keep(makeFilter(context, 'bandpass', E.barkMin, E.barkQ));
    const barkGain = keep(makeGain(context, 0));
    dcBlock.connect(bark); bark.connect(barkGain); barkGain.connect(sum);
    this.barkFrequency = new SmoothParam(bark.frequency, tau, E.barkMin, true);
    this.bark = new SmoothParam(barkGain.gain, tau, 0);

    // Intake roar (direct) and rasp (the same noise fed into the distortion).
    const air = run(createNoiseSource(context, res.white, 1, 0.31 * cylinders));
    const intake = keep(makeFilter(context, 'bandpass', E.intakeBase, E.intakeQ));
    const intakeGain = keep(makeGain(context, 0));
    const raspGain = keep(makeGain(context, 0));
    air.connect(intake); intake.connect(intakeGain); intakeGain.connect(sum);
    intake.connect(raspGain); raspGain.connect(drive);
    this.intakeFrequency = new SmoothParam(intake.frequency, tau, E.intakeBase, true);
    this.intake = new SmoothParam(intakeGain.gain, tau, 0);
    this.rasp = new SmoothParam(raspGain.gain, tau, 0);

    // Overrun burble: slow noise gated into sparse pulses, ringing in a low band-pass.
    const pops = run(createNoiseSource(context, res.white, E.burbleRate, 0.53 * cylinders));
    const popsBoost = keep(makeGain(context, 2.3));
    const gate = keep(context.createWaveShaper());
    gate.curve = res.gateCurve;
    const popsFilter = keep(makeFilter(context, 'bandpass', E.burbleFrequency, 1.1));
    const popsGain = keep(makeGain(context, 0));
    pops.connect(popsBoost); popsBoost.connect(gate); gate.connect(popsFilter); popsFilter.connect(popsGain); popsGain.connect(sum);
    this.burble = new SmoothParam(popsGain.gain, 0.05, 0);

    // Rev limiter: a smoothed square LFO chops the gain and wobbles the pitch.
    const lfo = run(makeOscillator(context, 'square', null, E.limiterRate));
    const lfoSmooth = keep(makeFilter(context, 'lowpass', 140, 0.5));
    const stutterDepth = keep(makeGain(context, 0));
    const wobble = keep(makeGain(context, 0));
    lfo.connect(lfoSmooth); lfoSmooth.connect(stutterDepth); stutterDepth.connect(stutter.gain);
    lfoSmooth.connect(wobble); wobble.connect(detune);
    this.stutterDepth = new SmoothParam(stutterDepth.gain, 0.012, 0);
    this.wobble = new SmoothParam(wobble.gain, 0.02, 0);

    // Turbo whistle: sine plus a narrow noise band, straight to the panner.
    const whistle = run(makeOscillator(context, 'sine', null, E.turboBase));
    const whistleBand = keep(makeFilter(context, 'bandpass', E.turboBase, 16));
    const whistleNoise = keep(makeGain(context, E.turboNoise * 6));
    const turbo = keep(makeGain(context, 0));
    air.connect(whistleBand); whistleBand.connect(whistleNoise); whistleNoise.connect(turbo);
    whistle.connect(turbo); turbo.connect(panner);
    this.whistleFrequency = new SmoothParam(whistle.frequency, E.turboSpool, E.turboBase);
    this.whistleBand = new SmoothParam(whistleBand.frequency, E.turboSpool, E.turboBase, true);
    this.turbo = new SmoothParam(turbo.gain, E.turboSpool * 0.5, 0);
  }

  setPan(pan, time) { this.pan.set(pan, time); }

  /** Follow a car. `gain` scales the whole voice (0 mutes it). */
  update(car, time, gain) {
    const alive = !car.engineOut && car.state !== CAR_RETIRED;
    const rawRpm = car.rpm > 0 ? car.rpm : 0;
    const rpm = clamp(rawRpm, E.rpmFloor, E.rpmMax * 1.03);
    const rev = saturate((rpm - E.rpmIdle) / (E.rpmMax - E.rpmIdle));
    const running = smoothstep(E.rpmFloor, E.rpmIdle * 0.8, rawRpm) * gain;
    const throttle = alive ? saturate(car.throttle) : 0;
    const crank = rpm / 60;
    const firing = crank * this.cylinders * 0.5;

    this.wave.frequency.set(crank * 0.5, time);
    this.saw.frequency.set(firing * E.sawDetune, time);
    this.growl.frequency.set(firing * 0.5 * E.growlDetune, time);
    this.sub.frequency.set(crank, time);
    this.wave.gain.set(lerp(E.waveOff, E.waveOn, throttle), time);
    this.saw.gain.set(lerp(E.sawOff, E.sawOn, throttle) * (0.55 + 0.45 * rev), time);
    this.growl.gain.set(lerp(E.growlOff, E.growlOn, throttle), time);
    this.sub.gain.set(E.subLevel * (1 - 0.6 * rev), time);

    this.drive.set(lerp(E.driveOff, E.driveOn, throttle), time);
    this.tone.set(Math.min(E.toneMax, lerp(E.toneClosed + firing * E.toneTrackOff, E.toneOpen + firing * E.toneTrackOn, throttle)), time);
    this.formantFrequency.set(E.formantBase + E.formantRange * rev, time);
    this.formantGain.set(E.formantGain * throttle, time);
    this.barkFrequency.set(clamp(firing * 2, E.barkMin, E.barkMax), time);
    this.bark.set(E.barkLevel * throttle * throttle, time);

    this.intakeFrequency.set(E.intakeBase + E.intakeRange * rev, time);
    this.intake.set(E.intakeLevel * throttle * (0.3 + 0.7 * rev), time);
    this.rasp.set(E.raspLevel * (0.25 + 0.75 * throttle), time);
    const lift = 1 - throttle;
    this.burble.set(E.burbleLevel * lift * lift * smoothstep(E.burbleMinRev, E.burbleMinRev + 0.2, rev), time);

    const limiting = car.limiter && alive && throttle > 0.3 ? 1 : 0;
    this.stutterDepth.set(limiting * E.limiterDepth, time);
    this.stutterBase.set(1 - limiting * E.limiterDepth, time);
    this.wobble.set(limiting * E.limiterWobble, time);

    const boost = car.boosting && alive ? 1 : 0;
    const whistle = E.turboBase + E.turboRange * rev;
    this.whistleFrequency.set(whistle, time);
    this.whistleBand.set(whistle, time);
    this.turbo.set(boost * E.turboLevel * gain, time);

    this.level.set(running * E.level * lerp(E.levelOff, 1, throttle) * lerp(E.levelIdle, 1, rev), time);
  }

  /** Torque cut and pitch dip (upshift) or throttle blip (downshift) of a gear change. */
  shift(direction, time) {
    const gain = this.cut.gain, cents = this.blip.offset;
    const end = time + E.shiftCutTime;
    gain.cancelScheduledValues(time);
    gain.setTargetAtTime(E.shiftCutDepth, time, E.shiftCutAttack);
    gain.setTargetAtTime(1, end, E.shiftCutRelease);
    cents.cancelScheduledValues(time);
    cents.setTargetAtTime(direction > 0 ? -E.shiftDipCents : E.shiftBlipCents, time, 0.01);
    cents.setTargetAtTime(0, end, 0.025);
  }

  silence(time) {
    this.level.set(0, time);
    this.turbo.set(0, time);
  }

  dispose() { releaseNodes(this.sources, this.nodes); }
}

export class OpponentEngineVoice {
  constructor(context, res, destination) {
    this.context = context;
    this.res = res;
    this.carIndex = -1;   // car owning the voice, -1 when free
    this.keep = false;    // scratch flag of the voice allocator
    this.level = 0;       // estimate of the smoothed output gain
    this.cylinders = O.cylinders[0];
    this.detune = 1;
    this.fresh = true;
    this.shiftTimer = 0;
    this.sources = [];
    this.nodes = [];
    const idle = E.rpmIdle / 60;
    const oscWave = makeOscillator(context, 'sine', res.waves[this.cylinders], idle * 0.5);
    const oscSaw = makeOscillator(context, 'sawtooth', null, idle * this.cylinders * 0.5);
    const waveGain = makeGain(context, O.waveLevel), sawGain = makeGain(context, O.sawLevel);
    const tone = makeFilter(context, 'lowpass', O.toneBase, 0.9);
    const gain = makeGain(context, 0);
    const panner = context.createStereoPanner();
    oscWave.connect(waveGain); waveGain.connect(tone);
    oscSaw.connect(sawGain); sawGain.connect(tone);
    tone.connect(gain); gain.connect(panner); panner.connect(destination);
    this.sources.push(oscWave, oscSaw);
    this.nodes.push(oscWave, oscSaw, waveGain, sawGain, tone, gain, panner);
    this.oscWave = oscWave;
    this.waveFrequency = new SmoothParam(oscWave.frequency, O.pitchTau, idle * 0.5);
    this.sawFrequency = new SmoothParam(oscSaw.frequency, O.pitchTau, idle * this.cylinders * 0.5);
    this.sawGain = new SmoothParam(sawGain.gain, O.gainTau, O.sawLevel);
    this.tone = new SmoothParam(tone.frequency, O.gainTau, O.toneBase, true);
    this.gain = new SmoothParam(gain.gain, O.gainTau, 0);
    this.pan = new SmoothParam(panner.pan, O.gainTau, 0);
  }

  /** Give the (silent) voice to a car: engine layout and a slight detune depend on the car. */
  assign(carIndex) {
    this.carIndex = carIndex;
    const cylinders = O.cylinders[carIndex % O.cylinders.length];
    if (cylinders !== this.cylinders) {
      this.cylinders = cylinders;
      this.oscWave.setPeriodicWave(this.res.waves[cylinders]);
    }
    this.detune = 1 + (((carIndex * 7919) % 11) - 5) * 0.006;
    this.fresh = true;
    this.shiftTimer = 0;
    this.level = 0;
  }

  shift() { this.shiftTimer = O.shiftCutTime; }

  /**
   * @param ds,dd     position of the car relative to the listener (metres, + ahead / + right)
   * @param basePan   pan of the listener itself (split screen), panScale shrinks the spread
   */
  update(car, listener, ds, dd, basePan, panScale, time, dt, gain) {
    const rawRpm = car.rpm > 0 ? car.rpm : 0;
    const rpm = clamp(rawRpm, E.rpmFloor, E.rpmMax * 1.03);
    const rev = saturate((rpm - E.rpmIdle) / (E.rpmMax - E.rpmIdle));
    const throttle = saturate(car.throttle);
    const flat = ds * ds + dd * dd;
    const distance = Math.sqrt(flat);

    // Doppler-like shift from the closing speed along the line between the two cars.
    const radial = ((car.speed - listener.speed) * ds) / Math.sqrt(flat + O.dopplerSoftness);
    const doppler = clamp(O.soundSpeed / (O.soundSpeed + radial * O.dopplerScale), O.dopplerMin, O.dopplerMax);
    const crank = (rpm / 60) * doppler * this.detune;

    const attenuation = O.refDistance / (O.refDistance + O.rolloff * Math.max(0, distance - O.refDistance));
    const edge = 1 - smoothstep(O.maxDistance * 0.65, O.maxDistance, distance);
    let level = attenuation * edge * lerp(O.levelOff, 1, throttle) * lerp(O.levelIdle, 1, rev)
      * smoothstep(E.rpmFloor, E.rpmIdle * 0.8, rawRpm) * O.level * gain;
    if (this.shiftTimer > 0) { this.shiftTimer -= dt; level *= O.shiftCut; }
    // An exhaust points backwards: cars ahead are brighter than cars behind.
    const ahead = 0.5 + (0.5 * ds) / (Math.abs(ds) + O.aheadSoftness);
    const cutoff = ((O.toneBase + O.toneThrottle * throttle) * lerp(O.toneBehind, 1, ahead)) / (1 + distance * O.toneDistance);
    const pan = clamp(basePan + (panScale * O.panAmount * dd) / Math.sqrt(dd * dd + ds * ds * O.panDepth + O.panWidth * O.panWidth), -1, 1);

    if (this.fresh) {
      this.fresh = false;
      this.waveFrequency.jump(crank * 0.5, time);
      this.sawFrequency.jump(crank * this.cylinders * 0.5 * 1.003, time);
      this.pan.jump(pan, time);
      this.tone.jump(cutoff, time);
    } else {
      this.waveFrequency.set(crank * 0.5, time);
      this.sawFrequency.set(crank * this.cylinders * 0.5 * 1.003, time);
      this.pan.set(pan, time);
      this.tone.set(cutoff, time);
    }
    this.sawGain.set(O.sawLevel * (0.4 + 0.6 * throttle), time);
    this.gain.set(level, time);
    this.level = damp(this.level, level, 1 / O.gainTau, dt);
  }

  /** Fade out; the voice becomes free once it is inaudible (click-free voice stealing). */
  release(time, dt) {
    this.gain.set(0, time);
    this.level = damp(this.level, 0, 1 / O.gainTau, dt);
    if (this.level < O.stealLevel) { this.carIndex = -1; this.level = 0; }
  }

  dispose() { releaseNodes(this.sources, this.nodes); }
}
