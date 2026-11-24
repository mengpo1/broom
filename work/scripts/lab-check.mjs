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
  // (lot 5) the hop comes from a wheel on a wheel, and the car comes down ahead of the car it flew over
  const place = await page.evaluate(() => {
    const lab = window.virage.app.lab, a = lab.me, b = lab.lead, f = [Math.cos(b.heading), Math.sin(b.heading)];
    return { ahead: (a.x - b.x) * f[0] + (a.z - b.z) * f[1], side: -(a.x - b.x) * f[1] + (a.z - b.z) * f[0], length: a.params.halfLength + b.params.halfLength, width: a.params.halfWidth + b.params.halfWidth, bump: lab.events.some((e) => e.type === 'bump' || e.type === 'wheel') };
  });
  check('handed back AHEAD of the car it flew over, clear of it', place.ahead > place.length && !place.bump, `${(place.ahead - place.length).toFixed(2)} m ahead of its nose, ${Math.abs(place.side).toFixed(2)} m to the side`);
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
  for (const [key, name] of [['Digit1', 'wheel'], ['Digit4', 'board'], ['Digit5', 'bump'], ['Digit6', 'body'], ['Digit7', 'under'], ['Digit2', 'hop']]) {
    await page.keyboard.press(key);
    const s = await state(page);
    check(`key ${key.slice(-1)} starts the case "${name}"`, s.name === name && s.active && !s.released);
  }
  // case 6: a contact between bodies with the energy of a hop gives a bump, and the car never leaves the ground
  await page.keyboard.press('Digit6');
  await page.evaluate(() => { const lab = window.virage.app.lab; window.__air = 0; const step = lab.race.step.bind(lab.race); lab.race.step = (dt) => { step(dt); window.__air = Math.max(window.__air, lab.me.airHeight || 0); }; });
  const bumped = await waitFor(page, () => window.virage.app.lab.released, null, 60);
  const s6 = await state(page), air = await page.evaluate(() => window.__air);
  check('case 6 (nose against rear wheel): a bump, no hop, the car stays on the ground', bumped && s6.events.includes('bump') && !s6.events.includes('hop') && !s6.events.includes('launch') && air === 0, `${s6.events.join(' ')}, highest ${air} m`);
  check('its help line names the case', /pas de saut/.test(s6.panel), s6.panel.split('\n')[0]);
  // case 7 (securing of PR #8): a third car keeps itself under the car in flight. The landing waits, for well under the
  // limit, and the car is handed back on free ground: in no car, without having been put back on the track
  await page.keyboard.press('Digit7');
  await page.evaluate(() => {
    const lab = window.virage.app.lab, me = lab.me, step = lab.race.step.bind(lab.race);
    const over = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z; let min = Infinity; for (const h of [a.heading, a.heading + Math.PI / 2, b.heading, b.heading + Math.PI / 2]) { const ax = Math.cos(h), az = Math.sin(h), r = (c) => c.params.halfLength * Math.abs(ax * Math.cos(c.heading) + az * Math.sin(c.heading)) + c.params.halfWidth * Math.abs(-ax * Math.sin(c.heading) + az * Math.cos(c.heading)); const o = r(a) + r(b) - Math.abs(dx * ax + dz * az); if (o <= 0) return 0; min = Math.min(min, o); } return min; };
    window.__wait = { waited: 0, under: 0, air: 0, atLanding: -1, resets: me.resets, was: me.state };
    lab.race.step = (dt) => {
      step(dt);
      const w = window.__wait;
      if (me.state === 6) { w.air += dt; if (me.airWaiting) w.waited += dt; if (over(me, lab.third) > 0) w.under += dt; }
      else if (w.was === 6) w.atLanding = Math.max(...lab.race.cars.filter((c) => c !== me && !c.removed).map((c) => over(me, c)));
      w.was = me.state; w.putBack = me.resets > w.resets;
    };
  });
  const back7 = await waitFor(page, () => window.virage.app.lab.released, null, 60);
  const s7 = await state(page), w7 = await page.evaluate(() => window.__wait);
  check('case 7: the third car did come under the car in flight, and the landing waited', back7 && s7.events.includes('hop') && w7.under > 0.3 && w7.waited > 0.3, `under it ${w7.under.toFixed(2)} s, landing put off ${w7.waited.toFixed(2)} s, ${w7.air.toFixed(2)} s in the air`);
  check('case 7: the wait is short and ends by a landing on free ground', w7.waited < 1.3 && w7.atLanding === 0 && !w7.putBack && !s7.events.includes('reset') && !s7.events.includes('crash'), `in a car at the landing: ${w7.atLanding} m; put back on the track: ${w7.putBack}; ${s7.events.join(' ')}`);
  check('case 7: the car is handed back driving, and its help line names the case', s7.released && s7.state === 1 && /sous la voiture en vol/.test(s7.panel), `${s7.speed} km/h — ${s7.panel.split('\n')[0]}`);
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  check('no console error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await close();
}
// ---- without the option: no bench, and its keys do nothing
{
  const { page, close } = await openGame({ width: 960, height: 540, hash: 'quality=medium' });
  const before = await page.evaluate(() => ({ lab: !!window.virage.app.lab, state: window.virage.flow.state, race: !!window.virage.app.race, panel: [...document.querySelectorAll('div')].some((d) => /BANC|BENCH/.test(d.textContent)) }));
  for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7']) await page.keyboard.press(key);
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
