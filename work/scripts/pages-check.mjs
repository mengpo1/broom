// Checks the secondary interface pages in the real page and saves a screenshot of each:
// options (French and English), effects, controls, pause, the four cameras, and a mouse click
// on a menu entry. node work/scripts/pages-check.mjs [width height]
import { openGame, root } from './lib-browser.mjs';
const width = +(process.argv[2] || 1280), height = +(process.argv[3] || 720);
const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=low' });
const frames = (n, ticks = 2) => page.evaluate(async ([n, ticks]) => { const { app } = window.virage; for (let i = 0; i < n; i++) await app.advanceFrame(ticks); }, [n, ticks]);
const state = () => page.evaluate(() => { const v = window.virage; return { state: v.flow.state, page: v.flow.page && v.flow.page.id, stack: v.flow.stack ? v.flow.stack.length : undefined, language: v.storage.data.settings.language, camera: v.app.views[0].camera, paused: v.app.paused }; });
const press = async (keys) => { for (const key of keys) { await page.keyboard.press(key); await frames(key === 'Enter' ? 12 : 2); } };
const shot = async (name) => { await frames(14); await page.screenshot({ path: `${root}/work/renders/pages-${name}.png` }); const s = await state(); console.log(name, JSON.stringify(s)); return s; };
const results = [];
const expect = (label, ok) => { results.push({ label, ok: !!ok }); console.log(ok ? 'ok  ' : 'FAIL', label); };

await page.evaluate(([w, h]) => { const v = window.virage; v.app.setCanvasSize(w, h); v.storage.data.settings.effects.introPanels = false; v.storage.data.settings.language = 'fr'; v.flow.applySettings(); v.flow.toMenu(); }, [width, height]);
await frames(10);

// options page (sixth entry of the main menu)
await press(['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']);
let s = await shot('options-fr');
expect('options page opens', s.page === 'options');
// language: French -> English (first entry), page repainted in English
await press(['ArrowRight']);
s = await shot('options-en');
expect('language switches to English', s.language === 'en');
// effects page (8th entry)
await press(['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']);
s = await shot('effects-en');
expect('effects page opens', s.page === 'effects');
await press(['Escape']);
s = await state();
expect('escape returns to options', s.page === 'options');
// controls page (9th entry)
await press(['ArrowDown', 'Enter']);
s = await shot('controls-en');
expect('controls page opens', s.page === 'controls');
await press(['Escape']);
// back to French
await press(['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft']);
s = await state();
expect('language switches back to French', s.language === 'fr');
await press(['Escape']);
s = await state();
expect('escape returns to the main menu', s.page === 'main');

// mouse: click on the fourth entry of the main menu (turbo) — position read from the flow's own hit boxes
const target = await page.evaluate(() => {
  const v = window.virage, boxes = v.flow.painter.hits;
  const b = boxes.find((h) => h.index === 3);
  if (!b) return null;
  const canvas = document.querySelector('canvas'), r = canvas.getBoundingClientRect();
  return { x: r.left + ((b.x + b.w / 2) / canvas.width) * r.width, y: r.top + ((b.y + b.h / 2) / canvas.height) * r.height, index: b.index ?? 3 };
});
if (target) {
  await page.mouse.move(target.x, target.y); await frames(3);
  await page.mouse.click(target.x, target.y); await frames(14);
  s = await shot('click-turbo');
  expect('mouse click opens the turbo page', s.page === 'turbo');
  if (s.page !== 'main') await press(['Escape']);
} else {
  expect('mouse hit boxes available', false);
}

// a race started from the menus after Escape was used there must not start paused
await page.evaluate(() => { const f = window.virage.flow; f.toMenu(); f.page.selected = 3; f.dirty = true; });
await frames(4);
await press(['Enter']);                                                 // turbo page
await press(['Escape']);                                                // back (Escape is also the pause key)
await press(['Enter']);                                                 // turbo page again
await page.evaluate(() => { window.virage.flow.choices.laps = 1; window.virage.flow.choices.opponents = 5; });
await press(['ArrowUp', 'ArrowUp', 'Enter']);                           // start
await frames(20);
s = await state();
expect('race started from the menu is running, not paused', s.state === 'race' && s.paused === false);
await press(['Escape']);
s = await state();
expect('escape pauses', s.state === 'pause');
await press(['Escape']);
await frames(10);
s = await state();
expect('escape resumes and the race keeps running', s.state === 'race' && s.paused === false);
await page.evaluate(() => { window.virage.flow.toMenu(); });
await frames(6);

// race, cameras and pause
await page.evaluate(() => { const v = window.virage; v.quickRace({ circuit: 'hazelbrook', opponents: 11, gridPosition: 6 }); v.flow.state = 'race'; v.flow.dirty = true; v.input.clearEdges(); });
await page.evaluate(async () => { const { app } = window.virage; for (let i = 0; i < 120 * 14; i++) app.simulate(); app.present(3, 0); });
for (const name of ['cockpit', 'chase', 'front', 'trackside']) {
  s = await shot(`camera-${name}`);
  await press(['KeyC']);
}
s = await state();
expect('camera key cycles back to the cockpit after four presses', s.camera === 0);
await press(['Escape']);
s = await shot('pause-fr');
expect('escape pauses the race', s.state === 'pause' && s.paused === true);
await press(['Enter']);
s = await state();
expect('first pause entry resumes', s.state === 'race' && s.paused === false);

const errors = logs.filter((l) => !l.includes('[log]'));
if (errors.length) console.log('ERRORS\n' + errors.slice(0, 20).join('\n'));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `PAGES: ${failed.length} FAILED` : `PAGES OK (${results.length} checks)`);
await close();
process.exit(failed.length || errors.length ? 1 : 0);
