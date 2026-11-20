// Quick development screenshot: node work/scripts/shot.mjs <out.png> [json options]
import { openGame, root } from './lib-browser.mjs';
const out = process.argv[2] || 'work/renders/dev.png';
const opt = JSON.parse(process.argv[3] || '{}');
const { browser, page, logs, close } = await openGame({ width: opt.width || 1280, height: opt.height || 720, hash: `quality=${opt.quality || 'high'}` });
const t0 = Date.now();
const info = await page.evaluate(async (opt) => {
  const { app, quickRace, CAMERA_MODE } = window.virage;
  app.setCanvasSize(opt.width || 1280, opt.height || 720);
  const race = quickRace(opt.race || {});
  for (const rig of app.rigs) rig.mode = CAMERA_MODE[opt.camera || 'COCKPIT'];
  if (opt.free) { Object.assign(app.rigs[0].free, opt.free); }
  if (opt.layout) { app.splitLayout = opt.layout; app.resize(true); }
  const warm = opt.simSeconds ?? 8;
  // fast-forward the simulation without rendering, then render a few frames for TAA
  for (let i = 0; i < warm * 120; i++) app.simulate();
  const t = performance.now();
  for (let f = 0; f < (opt.frames ?? 6); f++) await app.advanceFrame(2);
  return { ms: (performance.now() - t) / (opt.frames ?? 6), gpu: app.gpu.info, draws: app.renderer.stats.draws, world: app.world.stats, speed: race.cars[app.viewTargets[0]].speed * 3.6 };
}, opt).catch((e) => ({ error: e.message }));
await page.screenshot({ path: `${root}/${out}` });
console.log(JSON.stringify(info), `total ${(Date.now() - t0)} ms`);
const errors = logs.filter((l) => !l.includes('[log]'));
if (errors.length) console.log(errors.slice(0, 30).join('\n'));
await close();
