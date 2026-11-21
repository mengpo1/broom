// Building blocks shared by every sound generator: seamless noise, control and pulse buffers,
// looping sources, waveshaper curves and a de-zippered AudioParam wrapper.
// Every buffer is played at its natural rate: resampled playback is ten times more expensive.

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

/**
 * Slow random control signal in -1..1: random points, `pointsPerSecond` of them, joined by
 * smooth (cosine) interpolation. The last point joins the first one: seamless loop.
 */
export function createControlBuffer(context, seconds, pointsPerSecond, seed) {
  const rate = context.sampleRate;
  const count = Math.max(2, Math.round(seconds * pointsPerSecond));
  const length = Math.floor((count / pointsPerSecond) * rate);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const rng = new Random(seed);
  const points = new Float32Array(count);
  for (let i = 0; i < count; i++) points[i] = rng.next() * 2 - 1;
  for (let i = 0; i < length; i++) {
    const f = (i / length) * count;
    const k = Math.floor(f);
    const t = 0.5 - 0.5 * Math.cos((f - k) * Math.PI);
    data[i] = points[k % count] + (points[(k + 1) % count] - points[k % count]) * t;
  }
  return buffer;
}

/**
 * Sparse random pulses (0..1): raised-cosine bumps of random width and height at random times,
 * `pulsesPerSecond` on average. Band-passed they pop (overrun burble), as a gain they crackle.
 */
export function createPulseBuffer(context, seconds, pulsesPerSecond, minWidth, maxWidth, seed) {
  const rate = context.sampleRate;
  const length = Math.floor(seconds * rate);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const rng = new Random(seed);
  let time = 0;
  for (;;) {
    time += -Math.log(1 - rng.next()) / pulsesPerSecond; // Poisson arrivals
    if (time >= seconds) break;
    const width = Math.max(2, Math.floor((minWidth + (maxWidth - minWidth) * rng.next()) * rate));
    const height = 0.35 + 0.65 * rng.next();
    const start = Math.floor(time * rate);
    for (let i = 0; i < width; i++) {
      const index = (start + i) % length; // a pulse cut by the end continues at the start
      data[index] = Math.min(1, data[index] + height * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / width)));
    }
  }
  return buffer;
}

/** Start a looping source on a buffer. `offset` (0..1) decorrelates sources sharing a buffer. */
export function createNoiseSource(context, buffer, offset = 0) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
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
 * One value per render quantum (3 ms) instead of one per sample: enough for filters and
 * modulation inputs, and several times cheaper to process.
 */
export function setControlRate(param) {
  try { param.automationRate = 'k-rate'; } catch (error) { /* fixed rate parameter */ }
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
    if (controlRate) setControlRate(param);
    param.value = value;
  }

  set(value, time) {
    if (!Number.isFinite(value)) return; // a NaN from the simulation must never reach the audio graph
    const delta = value - this.target;
    const tolerance = 1e-7 + 4e-4 * (this.target < 0 ? -this.target : this.target); // under 1 cent / 0.004 dB
    if (delta < tolerance && delta > -tolerance) return;
    this.target = value;
    this.param.setTargetAtTime(value, time, this.tau);
  }

  /** Jump without smoothing (only for silent voices). */
  jump(value, time) {
    if (!Number.isFinite(value)) return;
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
