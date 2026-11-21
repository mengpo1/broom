// Reference benchmark: runs a race scenario in real time for a fixed duration and measures, per
// frame, the interval between frames, the CPU time of the frame (simulation, scene building,
// command encoding) and the GPU time of the render pass (WebGPU timestamp queries, when the
// adapter offers them). Used by index.html#benchmark=... on the user's machine and by
// tests/performance/benchmark.mjs.

import { DRIVERS, PLAYER_DRIVERS } from '../vehicles/liveries.js';
import { RULE_PRESETS } from '../gameplay/rules.js';

export const BENCHMARK_SCENARIOS = {
  solo: { label: 'solo race (player alone)', opponents: 0, players: 1 },
  grid: { label: 'race with the full field (16 opponents)', opponents: 16, players: 1 },
  split: { label: 'split screen (2 players + 14 opponents)', opponents: 14, players: 2 },
};

function summarize(values, count) {
  if (count === 0) return { mean: 0, p50: 0, p99: 0, max: 0, min: 0, count: 0 };
  const sorted = Array.from(values.subarray(0, count)).sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < count; i++) sum += sorted[i];
  const at = (q) => sorted[Math.min(count - 1, Math.floor(q * count))];
  return { mean: sum / count, p50: at(0.5), p99: at(0.99), max: sorted[count - 1], min: sorted[0], count };
}

/**
 * @param app GameApp (its loop must be running)
 * @param kind key of BENCHMARK_SCENARIOS
 * @param seconds measured duration (after a 3 s warm-up)
 * @param options { circuit, start(config) -> race } `start` lets the caller route the race through its own flow
 */
export function runBenchmark(app, kind, seconds = 60, options = {}) {
  const scenario = BENCHMARK_SCENARIOS[kind];
  if (!scenario) throw new Error(`Unknown benchmark scenario: ${kind}`);
  const entries = DRIVERS.slice(0, scenario.opponents).map((driver) => ({ driver }));
  const views = [];
  for (let p = 0; p < scenario.players; p++) {
    const slot = Math.min(entries.length, Math.floor(entries.length * 0.5) + p);
    entries.splice(slot, 0, { driver: PLAYER_DRIVERS[p], human: true, playerIndex: p, autoDrive: true });
  }
  entries.forEach((e, i) => { if (e.human) views.push(i); });
  const config = { circuitId: options.circuit || 'hazelbrook', laps: 99, entries, rules: { ...RULE_PRESETS.arcade }, difficulty: 'pro', seed: 42, views, kind: 'benchmark' };
  if (options.start) options.start(config); else app.startRace(config);
  const capacity = Math.ceil(seconds * 400);
  const interval = new Float32Array(capacity), cpu = new Float32Array(capacity), gpu = new Float32Array(capacity);
  let frames = 0, gpuSamples = 0, lastSerial = app.renderer.gpuTimeSerial, elapsed = -3, heapStart = 0, heapEnd = 0, quads = 0;
  const renderer = app.renderer;
  renderer.timingEnabled = true;
  const heap = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
  return new Promise((resolve) => {
    app.frameHook = (dt) => {
      elapsed += dt;
      if (elapsed < 0) { heapStart = heap(); lastSerial = renderer.gpuTimeSerial; return; }
      if (frames < capacity) {
        interval[frames] = dt * 1000;
        cpu[frames] = app.stats.simMs + app.stats.buildMs + app.stats.renderMs;
        frames++;
        quads += renderer.stats.quads;
      }
      if (renderer.gpuTimeSerial !== lastSerial && gpuSamples < capacity) { lastSerial = renderer.gpuTimeSerial; gpu[gpuSamples++] = renderer.gpuTimeMs; }
      if (elapsed >= seconds) {
        heapEnd = heap();
        app.frameHook = null;
        renderer.timingEnabled = false;
        const iv = summarize(interval, frames);
        let over = 0;
        for (let i = 0; i < frames; i++) if (interval[i] > 16.7) over++;
        let gpuOver = 0;
        for (let i = 0; i < gpuSamples; i++) if (gpu[i] > 16.7) gpuOver++;
        resolve({
          scenario: kind, label: scenario.label, seconds: elapsed, frames, width: app.canvas.width, height: app.canvas.height,
          fps: frames / elapsed, frameInterval: iv, framesOver16_7ms: over,
          cpuFrame: summarize(cpu, frames),
          gpuPass: gpuSamples ? summarize(gpu, gpuSamples) : null, gpuSamplesOver16_7ms: gpuOver, gpuTimestampQueries: !!renderer.querySet,
          meanQuads: frames ? quads / frames : 0,
          jsHeapMB: heapEnd ? heapEnd / 1048576 : null, jsHeapGrowthKB: heapEnd ? (heapEnd - heapStart) / 1024 : null,
          adapter: app.gpu.info, softwareAdapter: app.softwareAdapter, sampleCount: renderer.sampleCount,
        });
      }
    };
  });
}

/** Environment facts visible from the page (the Linux side is collected by work/scripts/system-report.mjs). */
export function describeEnvironment(app) {
  return {
    userAgent: navigator.userAgent, platform: navigator.platform, cores: navigator.hardwareConcurrency || null, deviceMemoryGB: navigator.deviceMemory || null,
    screen: { width: screen.width, height: screen.height, pixelRatio: window.devicePixelRatio, colorDepth: screen.colorDepth },
    webgpu: !!navigator.gpu, adapter: app ? app.gpu.info : null, features: app ? app.gpu.features : [], limits: app ? app.gpu.limits : null,
    canvasFormat: app ? app.gpu.format : null, language: navigator.language,
  };
}

/** Refresh rate estimated from requestAnimationFrame over about one second. */
export function measureRefreshRate() {
  return new Promise((resolve) => {
    const stamps = [];
    const tick = (now) => {
      stamps.push(now);
      if (stamps.length < 90 && now - stamps[0] < 1500) requestAnimationFrame(tick);
      else {
        const deltas = [];
        for (let i = 1; i < stamps.length; i++) deltas.push(stamps[i] - stamps[i - 1]);
        deltas.sort((a, b) => a - b);
        const median = deltas[Math.floor(deltas.length / 2)] || 16.7;
        resolve(1000 / median);
      }
    };
    requestAnimationFrame(tick);
  });
}
