// Performance benchmark of the real build in Chromium (Playwright), real-time loop:
//   solo race, race with every opponent, split screen — 60 s each at 2560x1440 by default.
// node tests/performance/benchmark.mjs [--seconds 60] [--width 2560] [--height 1440] [--quality high] [--out work/benchmarks/name.json]
// GPU, CPU and frame-interval figures are reported separately. The adapter is recorded: on a
// software rasteriser (SwiftShader, llvmpipe) the numbers say nothing about a real GPU.
import { mkdirSync, writeFileSync } from 'node:fs';
import { openGame, root } from '../../work/scripts/lib-browser.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const seconds = +arg('seconds', 60), width = +arg('width', 2560), height = +arg('height', 1440), quality = arg('quality', 'high');
const out = arg('out', `work/benchmarks/benchmark-${width}x${height}.json`);
const { page, logs, close } = await openGame({ width, height, hash: `quality=${quality}`, extraArgs: ['--enable-precise-memory-info', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
await page.evaluate(([w, h]) => window.virage.app.setCanvasSize(w, h), [width, height]);
const results = await page.evaluate((seconds) => window.virage.benchmark(['solo', 'grid', 'split'], seconds), seconds);
results.viewport = { width, height }; results.quality = quality; results.date = new Date().toISOString();
mkdirSync(`${root}/work/benchmarks`, { recursive: true });
writeFileSync(`${root}/${out}`, JSON.stringify(results, null, 2));
const f = (v) => (v === null || v === undefined ? 'n/a' : v.toFixed(2));
for (const r of results.runs) {
  console.log(`${r.scenario.padEnd(6)} ${r.frames} frames, ${f(r.fps)} fps | interval mean ${f(r.frameInterval.mean)} p99 ${f(r.frameInterval.p99)} max ${f(r.frameInterval.max)} ms, >16.7 ms: ${r.framesOver16_7ms} | GPU pass ${r.gpuPass ? `mean ${f(r.gpuPass.mean)} p99 ${f(r.gpuPass.p99)} max ${f(r.gpuPass.max)} ms (${r.gpuPass.count} samples)` : 'no timestamp query'} | CPU ${f(r.cpuFrame.mean)} ms (max ${f(r.cpuFrame.max)}) | heap ${f(r.jsHeapMB)} MB, growth ${f(r.jsHeapGrowthKB)} KB | quads ${r.meanQuads.toFixed(0)}`);
}
console.log('adapter', JSON.stringify(results.environment.adapter), 'refresh', f(results.refreshRateHz), 'Hz ->', out);
const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
await close();
