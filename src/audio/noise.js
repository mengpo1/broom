// Building blocks shared by every sound generator: seamless noise buffers, looping noise
// sources, waveshaper curves and a de-zippered AudioParam wrapper.

import { Random } from '../core/random.js';

export const NOISE_WHITE = 0;
export const NOISE_PINK = 1;
export const NOISE_BROWN = 2;

/**
 * Looping noise buffer (mono). Coloured noise is filtered twice over the same white sequence and
 * the second pass is kept: that is the periodic steady state, so the loop point is seamless.
 * The result has no DC component and a fixed RMS level whatever the colour.
 */
export function createNoiseBuffer(context, seconds, color, seed, rms = 0.25) {
  const rate = context.sampleRate;
  const length = Math.max(2, Math.floor(seconds * rate));
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const rng = new Random(seed);
  for (let i = 0; i < length; i++) data[i] = rng.next() * 2 - 1;
  if (color !== NOISE_WHITE) {
    const white = new Float32Array(data);
    const leak = Math.exp((-2 * Math.PI * 24) / rate); // brown noise: leaky integrator, 24 Hz corner
    let b0 = 0, b1 = 0, b2 = 0, brown = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < length; i++) {
        const w = white[i];
        if (color === NOISE_PINK) { // Paul Kellet's economy pink filter
          b0 = 0.99765 * b0 + w * 0.099046;
          b1 = 0.963 * b1 + w * 0.2965164;
          b2 = 0.57 * b2 + w * 1.0526913;
          data[i] = b0 + b1 + b2 + w * 0.1848;
        } else {
          brown = brown * leak + w;
          data[i] = brown;
        }
      }
    }
  }
  let mean = 0;
  for (let i = 0; i < length; i++) mean += data[i];
  mean /= length;
  let power = 0;
  for (let i = 0; i < length; i++) { data[i] -= mean; power += data[i] * data[i]; }
  const scale = rms / Math.sqrt(power / length || 1);
  for (let i = 0; i < length; i++) {
    const v = data[i] * scale;
    data[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return buffer;
}

/** Start a looping source on a noise buffer. `offset` (0..1) decorrelates sources sharing a buffer. */
export function createNoiseSource(context, buffer, playbackRate = 1, offset = 0) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.playbackRate.value = playbackRate;
  source.start(0, (offset % 1) * buffer.duration);
  return source;
}

/** Soft clipper tanh(k (x + asymmetry)), re-centred and normalised to a peak of 1. */
export function makeDriveCurve(asymmetry = 0.2, hardness = 2.2, samples = 2049) {
  const curve = new Float32Array(samples);
  const offset = Math.tanh(hardness * asymmetry);
  let peak = 0;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(hardness * (x + asymmetry)) - offset;
    peak = Math.max(peak, Math.abs(curve[i]));
  }
  for (let i = 0; i < samples; i++) curve[i] /= peak;
  return curve;
}

/** Gate: silent below `threshold`, then rising to 1. Turns slow noise into sparse pulses. */
export function makeGateCurve(threshold = 0.5, power = 1.5, samples = 1025) {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = x > threshold ? Math.pow((x - threshold) / (1 - threshold), power) : 0;
  }
  return curve;
}

/**
 * Safety limiter curve for an input pre-scaled by 1 / range: linear below `knee`, then a smooth
 * saturation that never exceeds `ceiling` (the waveshaper clamps anything beyond the range).
 */
export function makeLimiterCurve(knee, ceiling, range, samples = 8193) {
  const curve = new Float32Array(samples);
  const span = ceiling - knee;
  for (let i = 0; i < samples; i++) {
    const u = ((i / (samples - 1)) * 2 - 1) * range;
    const a = Math.abs(u);
    const y = a <= knee ? a : knee + span * Math.tanh((a - knee) / span);
    curve[i] = u < 0 ? -y : y;
  }
  return curve;
}

/**
 * AudioParam driven once per frame without zipper noise: every change is an exponential approach
 * (setTargetAtTime). Unchanged targets are skipped so the automation timeline stays short.
 */
export class SmoothParam {
  constructor(param, tau, value = param.value, controlRate = false) {
    this.param = param;
    this.tau = tau;
    this.target = value;
    // Filter parameters only need one value per render quantum: much cheaper coefficient updates.
    if (controlRate) { try { param.automationRate = 'k-rate'; } catch (error) { /* fixed rate parameter */ } }
    param.value = value;
  }

  set(value, time) {
    const delta = value - this.target;
    const tolerance = 1e-7 + 1e-5 * (this.target < 0 ? -this.target : this.target);
    if (delta < tolerance && delta > -tolerance) return;
    this.target = value;
    this.param.setTargetAtTime(value, time, this.tau);
  }

  /** Jump without smoothing (only for silent voices). */
  jump(value, time) {
    this.target = value;
    this.param.cancelScheduledValues(time);
    this.param.setValueAtTime(value, time);
  }
}

/** Stop a list of scheduled sources and disconnect a list of nodes, ignoring already stopped ones. */
export function releaseNodes(sources, nodes) {
  for (let i = 0; i < sources.length; i++) { try { sources[i].stop(); } catch (error) { /* never started or already stopped */ } }
  for (let i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (error) { /* already disconnected */ } }
  sources.length = 0;
  nodes.length = 0;
}
