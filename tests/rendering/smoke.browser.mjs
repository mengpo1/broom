// Browser test of the real single-file build (Playwright + Chromium + WebGPU):
//  - loads index.html from disk with networking watched: no request may leave the file;
//  - one view and two views render without WebGPU errors;
//  - layer order is checked on pixels (sky above the horizon, road below, cockpit and HUD on top);
//  - the picture is stable: two consecutive frames at standstill are identical (no flicker);
//  - resizing the canvas keeps the composition.
// node tests/rendering/smoke.browser.mjs
import { openGame, root } from '../../work/scripts/lib-browser.mjs';
import { mkdirSync } from 'node:fs';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const { page, logs, requests, close } = await openGame({ width: 1280, height: 720, hash: 'manual=1&quality=low' });
mkdirSync(`${root}/work/renders/tests`, { recursive: true });

const pixels = async (file) => {
  const buf = await page.screenshot({ path: `${root}/work/renders/tests/${file}` });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const at = (x, y) => Array.from(g.getImageData(Math.round(x * img.width), Math.round(y * img.height), 1, 1).data.slice(0, 3));
    let hash = 0; const d = g.getImageData(0, 0, img.width, img.height).data;
    for (let i = 0; i < d.length; i += 97) hash = (hash * 31 + d[i]) >>> 0;
    return { sky: at(0.33, 0.08), road: at(0.42, 0.58), tyre: at(0.14, 0.86), hud: at(0.092, 0.052), w: img.width, h: img.height, hash };
  }, buf.toString('base64'));
};
const frames = (n, ticks = 2) => page.evaluate(async ([n, ticks]) => { const { app } = window.virage; for (let i = 0; i < n; i++) await app.advanceFrame(ticks); }, [n, ticks]);

// ---- offline, WebGPU up
const info = await page.evaluate(() => ({ gpu: window.virage.app.gpu.info, features: window.virage.app.gpu.features.length, software: window.virage.app.softwareAdapter }));
check('WebGPU device created', !!info.gpu, JSON.stringify(info.gpu));
check('no network request (works offline)', requests.length === 0, requests.slice(0, 3).join(', '));

// ---- one view on the grid (standstill)
await page.evaluate(() => { const v = window.virage; v.app.setCanvasSize(1280, 720); v.quickRace({ circuit: 'hazelbrook', opponents: 15, gridPosition: 6, autoDrive: false }); });
await frames(40, 0);      // let the animated parts (rev needle) settle
const a = await pixels('smoke-grid.png');
await frames(1, 0);
const b = await pixels('smoke-grid-2.png');
const blue = (c) => c[2] > c[0] + 20 && c[2] > 120, grey = (c) => Math.abs(c[0] - c[1]) < 18 && Math.abs(c[1] - c[2]) < 28 && c[0] > 60 && c[0] < 170, dark = (c) => c[0] < 90 && c[1] < 90 && c[2] < 100;
check('layer order: sky at the top', blue(a.sky), a.sky.join());
check('layer order: asphalt below the horizon', grey(a.road), a.road.join());
check('layer order: cockpit (front tyre) over the road', dark(a.tyre), a.tyre.join());
check('layer order: HUD cartouche over everything', a.hud[0] > 200 && a.hud[1] > 190, a.hud.join());
check('no flicker: identical frames at standstill', a.hash === b.hash, `${a.hash} / ${b.hash}`);
const stats = await page.evaluate(() => ({ quads: window.virage.app.renderer.stats.quads, dropped: window.virage.app.quads.dropped, views: window.virage.app.viewCount }));
check('scene emitted quads without overflow', stats.quads > 300 && stats.dropped === 0, JSON.stringify(stats));

// ---- driving: picture changes, simulation advances
await page.evaluate(() => { for (const car of window.virage.app.race.cars) if (car.isHuman) car.autoDrive = true; });
await frames(110, 12);
const c = await pixels('smoke-running.png');
const speed = await page.evaluate(() => { const v = window.virage; return v.app.race.cars[v.app.viewTargets[0]].speed; });
check('race runs and the picture changes', c.hash !== a.hash && speed > 20, `speed ${speed.toFixed(1)} m/s`);

// ---- resize keeps the composition
await page.evaluate(() => window.virage.app.setCanvasSize(960, 540));
await page.setViewportSize({ width: 960, height: 540 });
await frames(2, 0);
const r = await pixels('smoke-resized.png');
check('resize: composition preserved', blue(r.sky) && grey(r.road) && dark(r.tyre), `${r.sky.join()} | ${r.road.join()} | ${r.tyre.join()}`);

// ---- two views
await page.setViewportSize({ width: 1280, height: 720 });
for (const layout of ['horizontal', 'vertical']) {
  const two = await page.evaluate(async (layout) => {
    const v = window.virage;
    v.app.splitLayout = layout; v.app.setCanvasSize(1280, 720);
    v.quickRace({ circuit: 'kestrel-fields', opponents: 6, players: 2 });
    for (let i = 0; i < 600; i++) v.app.simulate();
    await v.app.advanceFrame(2); await v.app.advanceFrame(2);
    const rects = v.app.views.slice(0, v.app.viewCount).map((view) => ({ ...view.rect }));
    return { views: v.app.viewCount, rects, cams: v.app.views.slice(0, 2).map((view) => view.projection.camS), dropped: v.app.quads.dropped };
  }, layout);
  await page.screenshot({ path: `${root}/work/renders/tests/smoke-split-${layout}.png` });
  const [r0, r1] = two.rects;
  const disjoint = layout === 'horizontal' ? r1.y >= r0.y + r0.h : r1.x >= r0.x + r0.w;
  check(`split screen (${layout}): two independent views`, two.views === 2 && disjoint && two.cams[0] !== two.cams[1] && two.dropped === 0, JSON.stringify(two.rects));
}

const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]') || l.includes('[gpu]'));
check('no console or WebGPU validation error', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
