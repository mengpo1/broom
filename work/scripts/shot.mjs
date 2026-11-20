// Quick development screenshot: node work/scripts/shot.mjs <out.png> [json options]
// options: { width, height, race: {...quickRace options}, simSeconds, frames, layout, eval }
import { openGame, root } from './lib-browser.mjs';
const out = process.argv[2] || 'work/renders/dev.png';
const opt = JSON.parse(process.argv[3] || '{}');
const { page, logs, close } = await openGame({ width: opt.width || 1280, height: opt.height || 720, hash: `quality=${opt.quality || 'medium'}` });
const t0 = Date.now();
const info = await page.evaluate(async (opt) => {
  const { app, quickRace } = window.virage;
  app.setCanvasSize(opt.width || 1280, opt.height || 720);
  if (opt.layout) app.splitLayout = opt.layout;
  const race = quickRace(opt.race || {});
  if (opt.effects) Object.assign(app.effects, opt.effects);
  const warm = opt.simSeconds ?? 8;
  for (let i = 0; i < warm * 120; i++) app.simulate();
  if (opt.eval) new Function('app', 'race', opt.eval)(app, race);
  const t = performance.now();
  const frames = opt.frames ?? 4;
  for (let f = 0; f < frames; f++) await app.advanceFrame(2);
  const car = race.cars[app.viewTargets[0]];
  return { ms: (performance.now() - t) / frames, gpu: app.gpu.info, stats: app.renderer.stats, build: app.stats.buildMs, speed: car.speed * 3.6, s: car.s, pos: car.position };
}, opt).catch((e) => ({ error: e.message }));
await page.screenshot({ path: `${root}/${out}` });
console.log(JSON.stringify(info), `total ${(Date.now() - t0)} ms`);
const errors = logs.filter((l) => !l.includes('[log]'));
if (errors.length) console.log(errors.slice(0, 30).join('\n'));
await close();
