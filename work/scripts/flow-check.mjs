// End-to-end check of the game flow in the real page: menu -> turbo race (computer-driven player)
// -> results -> menu, then arcade and a championship round. Saves screenshots of the result pages.
// node work/scripts/flow-check.mjs [width height]
import { openGame, root } from './lib-browser.mjs';
const width = +(process.argv[2] || 1280), height = +(process.argv[3] || 720);
const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=low' });
const frames = (n, ticks = 2) => page.evaluate(async ([n, ticks]) => { const { app } = window.virage; for (let i = 0; i < n; i++) await app.advanceFrame(ticks); }, [n, ticks]);
const state = () => page.evaluate(() => { const v = window.virage; return { state: v.flow.state, page: v.flow.page && v.flow.page.id, race: v.app.race ? { phase: v.app.race.phase, kind: v.app.race.kind, time: +v.app.race.time.toFixed(1), cars: v.app.race.cars.length } : null }; });
const press = async (keys) => { for (const key of keys) { await page.keyboard.press(key); await frames(2); } };
/** Fast-forward the current race with the computer driving the human cars; render a frame now and then. */
const runRace = async (label) => {
  const result = await page.evaluate(async () => {
    const { app, flow } = window.virage;
    for (const car of app.race.cars) if (car.isHuman) car.autoDrive = true;
    let steps = 0;
    while (flow.state === 'race' && steps < 120 * 60 * 25) {
      for (let i = 0; i < 240 && app.race && app.race.phase !== 'finished'; i++) { app.simulate(); steps++; }
      await app.advanceFrame(app.race && app.race.phase === 'finished' ? 60 : 1);
    }
    return { steps, state: flow.state, model: flow.resultModel ? { title: flow.resultModel.title, headline: flow.resultModel.headline, rows: flow.resultModel.rows.length, first: flow.resultModel.rows[0] } : null };
  });
  console.log(label, JSON.stringify(result));
  await frames(20);
  await page.screenshot({ path: `${root}/work/renders/flow-${label}.png` });
  return result;
};
const out = [];
await page.evaluate(([w, h]) => { const v = window.virage; v.app.setCanvasSize(w, h); v.storage.data.settings.effects.introPanels = false; v.flow.applySettings(); }, [width, height]);
await frames(10);
// ---- turbo: 1 lap
await press(['ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']);
await page.evaluate(() => { window.virage.flow.choices.laps = 1; window.virage.flow.choices.opponents = 7; });
await press(['ArrowUp', 'ArrowUp', 'Enter']);
out.push(await state());
const turbo = await runRace('turbo');
await press(['Enter']); await frames(10);
out.push(await state());
// ---- arcade stage 1
await press(['Enter']); await frames(5); await press(['Enter']); await frames(5);
out.push(await state());
const arcade = await runRace('arcade');
// ---- two players, 1 lap
await page.evaluate(() => window.virage.flow.toMenu()); await frames(5);
await press(['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']);
await press(['ArrowUp', 'ArrowUp', 'Enter']);
out.push(await state());
await frames(30);
await page.screenshot({ path: `${root}/work/renders/flow-duel-grid.png` });
const duel = await runRace('duel');
// ---- championship: qualifying then race
await page.evaluate(() => window.virage.flow.toMenu()); await frames(5);
await press(['ArrowDown', 'Enter']); await frames(5);
await page.evaluate(() => { const f = window.virage.flow; f.page.selected = f.page.items.length - 2; });
await press(['Enter']);
out.push(await state());
const quali = await runRace('qualifying');
await press(['Enter']); await frames(10);
out.push(await state());
const race = await runRace('championship');
await press(['Enter']); await frames(20);
await page.screenshot({ path: `${root}/work/renders/flow-standings.png` });
out.push(await state());
console.log(JSON.stringify(out));
const errors = logs.filter((l) => !l.includes('[log]'));
if (errors.length) console.log('ERRORS\n' + errors.slice(0, 30).join('\n'));
const ok = turbo.state === 'results' && arcade.state === 'results' && duel.state === 'results' && quali.state === 'results' && race.state === 'results' && errors.length === 0;
console.log(ok ? 'FLOW OK' : 'FLOW FAILED');
await close();
process.exit(ok ? 0 : 1);
