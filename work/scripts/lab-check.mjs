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
// ---- the trackside cases of the bench: breakable board, then the keys of the other new cases
{
  const { page, logs, close } = await openGame({ width: 960, height: 540, hash: 'lab=sign&quality=medium' });
  const s0 = await state(page);
  const info = () => page.evaluate(() => { const lab = window.virage.app.lab, race = lab.race; return { circuit: race.track.id, objects: race.objects.length, down: [...race.objectState].filter((v) => v === 1).length, scenery: window.virage.debug.trackside.scenery, interactions: window.virage.debug.trackside.interactions, air: lab.me.airHeight || 0 }; });
  const i0 = await info();
  check('#lab=sign opens the object bench: its own circuit, where objects can be hit', !!s0 && s0.name === 'sign' && i0.circuit === 'banc-objets' && i0.objects > 10 && /panneau destructible \(EXPÉRIMENTAL\)/.test(s0.panel), JSON.stringify(i0));
  check('the experimental interactions are on for that circuit only, not for the game', i0.interactions === false && i0.scenery === 'enriched');
  const released = await waitFor(page, () => window.virage.app.lab.released);
  const s1 = await state(page), i1 = await info();
  check('the board is knocked down by the real rules, without any flight, and the car is handed back', released && s1.events.includes('object') && !s1.events.includes('launch') && !s1.events.includes('hop') && !s1.events.includes('crash') && i1.down === 1 && i1.air === 0 && s1.state === 1, `${s1.events.join(' ')}; ${i1.down} down; ${s1.speed} km/h`);
  await page.screenshot({ path: `${root}/work/renders/trackside/lab-sign-handed-back.png` });
  for (const [key, name, circuit, text] of [['Digit7', 'rock', 'banc-objets', /obstacle rigide/], ['Digit8', 'gantry', 'banc-objets', /portique/], ['Digit9', 'pillar', 'banc-objets', /support de portique/],
    ['Digit0', 'tunnel', 'banc-objets', /tunnel/], ['KeyO', 'offtrack', 'banc-accotements', /accotements ouverts/], ['KeyK', 'close', 'kestrel-fields', /contact rapproché/], ['Digit6', 'sign', 'banc-objets', /panneau destructible/]]) {
    await page.keyboard.press(key);
    const s = await state(page), i = await info();
    check(`key ${key.replace('Digit', '').replace('Key', '')} starts the case "${name}" on ${circuit}`, s.name === name && s.active && !s.released && i.circuit === circuit && text.test(s.panel), s.panel.split('\n')[0]);
  }
  // the tunnel case, played in real time to its end: no contact
  await page.keyboard.press('Digit0');
  const through = await waitFor(page, () => window.virage.app.lab.released, null, 120);
  const s2 = await state(page);
  check('the tunnel is driven through without any contact, then the car is handed back', through && s2.events.length === 0 && s2.state === 1, `events: ${s2.events.join(' ') || 'none'}`);
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  check('no console error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await close();
}
// ---- the scenery options: by default no object can be hit in a race; #scenery=classic and #objects=interactive do what they say
for (const [hash, want] of [['quality=medium', { scenery: 'enriched', interactions: false, objects: 0, tunnels: 1 }], ['scenery=classic&quality=medium', { scenery: 'classic', interactions: false, objects: 0, tunnels: 0 }], ['objects=interactive&quality=medium', { scenery: 'enriched', interactions: true, objects: 1, tunnels: 1 }]]) {
  const { page, logs, close } = await openGame({ width: 960, height: 540, hash });
  const got = await page.evaluate(() => {
    const { quickRace, debug } = window.virage;
    const race = quickRace({ circuit: 'montclair', opponents: 3 });
    const L = race.track.sceneryLayout;
    return { scenery: debug.trackside.scenery, interactions: debug.trackside.interactions, objects: race.objects.length, tunnels: L.trackside.tunnels.length, obstacles: race.obstacles.length, lab: !!window.virage.app.lab };
  });
  check(`[#${hash}] ${want.scenery} scenery, ${want.interactions ? 'objects that can be hit' : 'no object that can be hit'}`, got.scenery === want.scenery && got.interactions === want.interactions && (got.objects > 0) === (want.objects > 0) && got.tunnels === want.tunnels && got.obstacles === 9 && !got.lab, JSON.stringify(got));
  check(`[#${hash}] no console error`, logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).length === 0);
  await close();
}
console.log(failed ? `${failed} check(s) FAILED` : 'LAB OK');
process.exit(failed ? 1 : 0);
