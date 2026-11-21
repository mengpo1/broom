// Screenshot of interface pages: node work/scripts/menu-shot.mjs <out.png> [json options]
// options: { width, height, keys: ['ArrowDown', 'Enter', ...], lang, wait (frames after the keys), eval }
import { openGame, root } from './lib-browser.mjs';
const out = process.argv[2] || 'work/renders/menu.png';
const opt = JSON.parse(process.argv[3] || '{}');
const { page, logs, close } = await openGame({ width: opt.width || 1280, height: opt.height || 720, hash: `manual=1&quality=medium${opt.lang ? `&lang=${opt.lang}` : ''}` });
const frames = async (n) => page.evaluate(async (n) => { const { app } = window.virage; for (let i = 0; i < n; i++) { app.resize(); await app.advanceFrame(2); } }, n);
await page.evaluate((opt) => { window.virage.app.setCanvasSize(opt.width || 1280, opt.height || 720); if (opt.eval) new Function('v', opt.eval)(window.virage); }, opt);
await frames(30);
for (const key of opt.keys || []) { await page.keyboard.press(key); await frames(key === 'Enter' ? 30 : 3); }
await frames(opt.wait ?? 30);
await page.screenshot({ path: `${root}/${out}` });
const state = await page.evaluate(() => ({ state: window.virage.flow.state, page: window.virage.flow.page && window.virage.flow.page.id }));
console.log(JSON.stringify(state));
const errors = logs.filter((l) => !l.includes('[log]'));
if (errors.length) console.log(errors.slice(0, 30).join('\n'));
await close();
