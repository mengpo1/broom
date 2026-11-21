// Offline verification of the procedural audio module (src/audio/).
//   node work/scripts/audio-check.mjs [--wav out.wav] [--json]
// Bundles work/dev/audio-check.js into a throw-away page, renders scripted races through an
// OfflineAudioContext in Chromium and checks the result: no NaN, no clipping, no DC offset,
// engine pitch/brightness against rpm and throttle, every event audible, panning, Doppler,
// scenes, pause... Exits with a non-zero status when a check or the page fails.
import { writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { openStandalone } from './lib-browser.mjs';

const args = process.argv.slice(2);
const wavIndex = args.indexOf('--wav');
const wavPath = wavIndex >= 0 ? resolve(args[wavIndex + 1] || 'audio-check.wav') : null;
const asJson = args.includes('--json');

const t0 = Date.now();
const { page, logs, close, file } = await openStandalone({ entry: 'work/dev/audio-check.js', width: 640, height: 360 });
let report = null, failure = null;
try {
  await page.waitForFunction(() => typeof window.runAudioCheck === 'function', null, { timeout: 15000 });
  report = await page.evaluate((options) => window.runAudioCheck(options), { wav: !!wavPath });
} catch (error) {
  failure = error;
}
await close();
try { rmSync(file); } catch { /* already gone */ }

const consoleErrors = logs.filter((line) => line.startsWith('[error]') || line.startsWith('[pageerror]') || line.startsWith('[warning]'));
let failed = 0;
const line = (pass, name, detail) => { if (!pass) failed++; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

if (report) {
  const { stats, checks } = report;
  if (wavPath && stats.wav) { writeFileSync(wavPath, Buffer.from(stats.wav, 'base64')); console.log(`wrote ${wavPath}`); }
  delete stats.wav;
  if (asJson) console.log(JSON.stringify(stats, null, 2));
  else {
    console.log('--- statistics');
    for (const [section, values] of Object.entries(stats)) console.log(`${section}: ${JSON.stringify(values)}`);
  }
  console.log('--- checks');
  for (const check of checks) line(check.pass, check.name, check.detail);
} else {
  line(false, 'page ran the audio check', failure ? failure.message : 'no report');
}
line(consoleErrors.length === 0, 'no console error or warning', consoleErrors.slice(0, 5).join(' | '));
console.log(`${failed ? `${failed} check(s) FAILED` : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
