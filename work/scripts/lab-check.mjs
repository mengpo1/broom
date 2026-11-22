// Checks the collision test bench as a person uses it: the game is opened with the launch option
// (index.html#lab=...), the loop runs in real time, the keyboard is the real input path.
// Also checks that nothing of the bench exists without the option.
// node work/scripts/lab-check.mjs
import { openGame, root } from './lib-browser.mjs';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const waitFor = async (page, fn, arg, seconds = 90) => { try { await page.waitForFunction(fn, arg, { timeout: seconds * 1000, polling: 100 }); return true; } catch { return false; } };
const state = (page) => page.evaluate(() => {
  const lab = window.virage.app.lab, me = lab && lab.me;
  return lab ? { name: lab.name, active: lab.active, released: lab.released, tick: lab.tick, events: lab.events.map((e) => e.type), state: me && me.state, speed: me && +(me.speed * 3.6).toFixed(0),
    steer: me && +me.steer.toFixed(3), panel: [...document.querySelectorAll('div')].map((d) => d.textContent).find((x) => /BANC|BENCH/.test(x)) || '' } : null;
});

// ---- with the option: the hop, then the car is handed back
{
  const { page, logs, close } = await openGame({ width: 960, height: 540, hash: 'lab=hop&quality=medium' });
  const s0 = await state(page);
  check('the option starts the bench on the case asked for', !!s0 && s0.name === 'hop' && s0.active, JSON.stringify(s0 && { name: s0.name, tick: s0.tick }));
  check('a line of help is shown, autopilot announced', /BANC D'ESSAI/.test(s0.panel) && /pilote automatique/.test(s0.panel) && /saut récupérable/.test(s0.panel), s0.panel.replace(/\n/g, ' | '));
  const released = await waitFor(page, () => window.virage.app.lab.released);
  const s1 = await state(page);
  check('the real rules produced a hop and a landing', released && s1.events.includes('hop') && s1.events.includes('landing') && !s1.events.includes('crash'), s1.events.join(' '));
  check('the car is handed back driving', s1.released && s1.state === 1 && s1.speed > 60, `state ${s1.state}, ${s1.speed} km/h`);
  check('the help line says so', /À VOUS DE CONDUIRE/.test(s1.panel), s1.panel.split('\n')[0]);
  await page.screenshot({ path: `${root}/work/renders/lab-hop-handed-back.png` });
  // the player's own controls now drive the car
  await page.keyboard.down('ArrowLeft');
  const steered = await waitFor(page, () => window.virage.app.lab.me.steer < -0.2, null, 20);
  const s2 = await state(page);
  await page.keyboard.up('ArrowLeft');
  check('the keyboard steers the car after the hand-over', steered, `steer ${s2.steer}`);
  await page.keyboard.down('ArrowUp');
  const v0 = (await state(page)).speed;
  const faster = await waitFor(page, (v) => window.virage.app.lab.me.speed * 3.6 > v + 15, v0, 30);
  await page.keyboard.up('ArrowUp');
  check('and the throttle accelerates it', faster, `${v0} -> ${(await state(page)).speed} km/h`);
  // keys: another case, then replay
  await page.keyboard.press('Digit3');
  const s3 = await state(page);
  check('key 3 starts the hard accident (E3)', s3.name === 'crash' && !s3.released && /accident violent/.test(s3.panel), `${s3.name}, tick ${s3.tick}`);
  const wrecked = await waitFor(page, () => window.virage.app.lab.me.state === 7, null, 90);
  await page.screenshot({ path: `${root}/work/renders/lab-crash.png` });
  check('E3 is replayed by the real rules (wreck)', wrecked, (await state(page)).events.join(' '));
  const again = await waitFor(page, () => window.virage.app.lab.released, null, 120);
  check('after the accident the car is handed back too', again && (await state(page)).state === 1);
  await page.keyboard.press('Enter');
  const s4 = await state(page);
  check('Enter replays the current case', s4.name === 'crash' && !s4.released && s4.events.length === 0, `tick ${s4.tick}`);
  for (const [key, name] of [['Digit1', 'wheel'], ['Digit4', 'board'], ['Digit5', 'bump'], ['Digit2', 'hop']]) {
    await page.keyboard.press(key);
    const s = await state(page);
    check(`key ${key.slice(-1)} starts the case "${name}"`, s.name === name && s.active && !s.released);
  }
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  check('no console error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await close();
}
// ---- without the option: no bench, and its keys do nothing
{
  const { page, close } = await openGame({ width: 960, height: 540, hash: 'quality=medium' });
  const before = await page.evaluate(() => ({ lab: !!window.virage.app.lab, state: window.virage.flow.state, race: !!window.virage.app.race, panel: [...document.querySelectorAll('div')].some((d) => /BANC|BENCH/.test(d.textContent)) }));
  for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) await page.keyboard.press(key);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ lab: !!window.virage.app.lab, state: window.virage.flow.state, race: !!window.virage.app.race }));
  check('without the option there is no bench and no help line', !before.lab && !before.panel, JSON.stringify(before));
  check('its keys do nothing in the normal game', !after.lab && after.state === before.state && after.race === before.race, JSON.stringify(after));
  // in a normal race neither
  await page.evaluate(() => { window.virage.quickRace({ circuit: 'kestrel-fields', opponents: 3 }); });
  for (const key of ['Digit2', 'Digit3']) await page.keyboard.press(key);
  await page.waitForTimeout(500);
  const racing = await page.evaluate(() => ({ lab: !!window.virage.app.lab, circuit: window.virage.app.race && window.virage.app.race.track.id, cars: window.virage.app.race && window.virage.app.race.cars.length }));
  check('nor during a normal race', !racing.lab && racing.cars === 4, JSON.stringify(racing));
  await close();
}
console.log(failed ? `${failed} check(s) FAILED` : 'LAB OK');
process.exit(failed ? 1 : 0);
