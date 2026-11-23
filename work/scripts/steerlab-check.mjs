// Checks the steering bench and the experimental steering option as a person uses them: the game is
// opened with the launch option (index.html#steerlab=..., index.html#steering=...), the loop runs
// in real time, the keyboard is the real input path. Also checks that without an option nothing of
// the prototype exists: no bench, no variant, the validated steering.
// node work/scripts/steerlab-check.mjs
import { readFileSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const waitFor = async (page, fn, arg, seconds = 60) => { try { await page.waitForFunction(fn, arg, { timeout: seconds * 1000, polling: 50 }); return true; } catch { return false; } };
const state = (page) => page.evaluate(() => {
  const bench = window.virage.app.steerLab, me = bench && bench.me, race = window.virage.app.race;
  return bench ? { variant: bench.variant, active: bench.active, demo: bench.demo, running: !!bench.run, circuit: race && race.track.id, cars: race && race.cars.length,
    steering: me && (me.steering ? me.steering.id : 'a'), custom: !!(me && me.steering && me.steering.custom), delay: me && me.steering ? me.steering.phase2Delay : null,
    phase2: me && +me.steerExtra.toFixed(3), shown: me && +me.steerShown.toFixed(3), steer: me && +me.steer.toFixed(3), kmh: me && +(me.speed * 3.6).toFixed(0), s: me && +me.s.toFixed(0), state: me && me.state,
    marks: bench.lastRun ? bench.lastRun.marks : null, samples: bench.lastRun ? bench.lastRun.samples.length : 0,
    panel: [...document.querySelectorAll('div')].map((d) => d.textContent).find((x) => /BANC DE DIRECTION|STEERING BENCH/.test(x)) || '' } : null;
});

// ---- the bench, opened on B2
{
  const { page, logs, close } = await openGame({ width: 960, height: 540, hash: 'steerlab=b2&quality=medium' });
  const s0 = await state(page);
  check('the option opens the bench on its own circuit, alone, with the variant asked for', !!s0 && s0.active && s0.circuit === 'banc-direction' && s0.cars === 1 && s0.variant === 'b2' && s0.steering === 'b2', JSON.stringify(s0 && { circuit: s0.circuit, cars: s0.cars, steering: s0.steering, kmh: s0.kmh }));
  check('three lines of help: title and variant (marked experimental), keys, figures', /BANC DE DIRECTION \(DÉVELOPPEMENT\) — B2 · EXPÉRIMENTAL/.test(s0.panel) && /Touches 1 à 4/.test(s0.panel) && /braquage ×/.test(s0.panel) && /à vous de conduire/.test(s0.panel), s0.panel.replace(/\n/g, ' | '));
  // the player holds a steering key: phase 2 arrives, and the figures say so
  await page.keyboard.down('ArrowRight');
  const phase2 = await waitFor(page, () => window.virage.app.steerLab.me.steerExtra > 0.6, null, 20);
  const s1 = await state(page);
  await page.screenshot({ path: `${root}/work/renders/steering/steerlab-b2-held.png` });
  await page.keyboard.up('ArrowRight');
  check('B2, key held: phase 2 winds on more lock than the validated full lock', phase2 && s1.shown > 1.2, `phase 2 ${s1.phase2}, lock x${s1.shown}`);
  const shownShare = +(/phase 2 : (\d+) %/.exec(s1.panel) || [0, 0])[1];        // (the line is refreshed ten times a second)
  check('the figures follow', shownShare >= 35 && shownShare <= 100 && /braquage ×1,[2-9]/.test(s1.panel), s1.panel.split('\n')[2]);
  const back = await waitFor(page, () => window.virage.app.steerLab.me.steerExtra === 0 && Math.abs(window.virage.app.steerLab.me.steer) < 0.05, null, 10);
  check('released: phase 2 is given back and the steering returns to the centre', back);
  // key 1: the validated driving, at once, in the same race
  await page.keyboard.press('Digit1');
  const s2 = await state(page);
  check('key 1 selects A, the validated driving, without restarting', s2.variant === 'a' && s2.steering === 'a' && /A · conduite validée/.test(s2.panel), s2.panel.split('\n')[0]);
  await page.keyboard.press('Enter');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1500);
  const s3 = await state(page);
  await page.keyboard.up('ArrowRight');
  check('A, key held: the steering stays at today\'s stop, nothing more', s3.phase2 === 0 && s3.shown === 0 && Math.abs(s3.steer) === 1, `steer ${s3.steer}, phase 2 ${s3.phase2}`);
  for (const [key, name] of [['Digit4', 'b3'], ['Digit2', 'b1'], ['Digit3', 'b2']]) {
    await page.keyboard.press(key);
    const s = await state(page);
    check(`key ${key.slice(-1)} selects ${name.toUpperCase()}`, s.variant === name && s.steering === name && s.panel.includes(`${name.toUpperCase()} · EXPÉRIMENTAL`));
  }
  // Enter: a fresh run before the first bend
  await page.keyboard.press('Enter');
  const s4 = await state(page);
  check('Enter starts again before the first bend, same variant', s4.active && s4.variant === 'b2' && !s4.demo && s4.s > 200 && s4.s < 420 && s4.kmh > 100, `s ${s4.s} m, ${s4.kmh} km/h`);
  // key 5: the measured manoeuvre, then the car is handed back
  await page.keyboard.press('Digit5');
  const s5 = await state(page);
  check('key 5 plays a demonstration (bend 4, to the left, at the speed the grip allows)', s5.running && s5.demo && s5.demo.bend === 4 && /démonstration : virage 4 à gauche/.test(s5.panel), s5.panel.split('\n')[1]);
  const over = await waitFor(page, () => !window.virage.app.steerLab.run, null, 40);
  const s6 = await state(page);
  check('the demonstration held full lock through both phases and recorded its telemetry', over && s6.marks && s6.marks.steeringAtItsStop > 0.2 && s6.marks.phase2Complete > 1.4 && s6.samples > 200, JSON.stringify(s6.marks));
  check('then the car is handed back', !s6.running && /démonstration terminée/.test(s6.panel), s6.panel.split('\n')[1]);
  // independent of the display rate: the game loop of the browser (a few images a second here, irregular) gives the very
  // instants of the measurement made by the simulation alone (work/benchmarks/held-steering.json, same bend, same speed)
  const measured = JSON.parse(readFileSync(`${root}/work/benchmarks/held-steering.json`, 'utf8')).bends.find((b) => b.bend === 4 && b.entryShareOfLimit === 1).runs.b2.marks;
  const instants = ['steeringAtItsStop', 'tyresSqueal', 'phase2Starts', 'tyreMarks', 'tyreSmoke', 'phase2Complete'];
  check('same instants as the simulation alone, whatever the display rate', instants.every((k) => s6.marks[k] === measured[k]), instants.map((k) => `${k} ${s6.marks[k]}/${measured[k]}`).join(', '));
  await page.keyboard.press('Digit5');
  check('key 5 again: the next demonstration', (await state(page)).demo.bend === 3);
  // key 6: the passage of the reference footage, on its own circuit
  await page.keyboard.press('Digit6');
  const s7 = await state(page);
  check('key 6 plays the passage of the reference footage on the circuit fitted on it', s7.running && s7.circuit === 'banc-reference' && s7.demo.passage && /passage de la vidéo de référence/.test(s7.panel), s7.panel.split('\n')[1]);
  await page.keyboard.press('Enter');
  const s8 = await state(page);
  check('Enter comes back to the bench', s8.circuit === 'banc-direction' && !s8.demo && s8.variant === 'b2');
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  check('no console error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await close();
}
// ---- the experimental option in ordinary races, with a setting given by hand
{
  const { page, logs, close } = await openGame({ width: 960, height: 540, hash: 'steering=b3&phase2Delay=0.6&quality=medium' });
  const s = await page.evaluate(() => {
    const { app, quickRace, debug } = window.virage;
    const out = { bench: !!app.steerLab, panel: [...document.querySelectorAll('div')].some((d) => /BANC DE DIRECTION|STEERING BENCH/.test(d.textContent)), debug: debug.steering, names: debug.steeringVariants };
    let race = quickRace({ circuit: 'kestrel-fields', opponents: 3, autoDrive: false });
    out.player = race.playerCars[0].steering && { id: race.playerCars[0].steering.id, delay: race.playerCars[0].steering.phase2Delay, rate: race.playerCars[0].steering.phase2Rate };
    out.computers = race.cars.filter((c) => !c.isHuman).map((c) => c.steering);
    race = quickRace({ circuit: 'kestrel-fields', opponents: 3 });
    out.robotPlayer = race.playerCars[0].steering;
    race = quickRace({ circuit: 'kestrel-fields', opponents: 3, autoDrive: false, steering: 'a' });
    out.explicitA = race.playerCars[0].steering;
    return out;
  });
  check('#steering=b3 applies the variant to the player\'s car in an ordinary race, with the setting given by hand', s.player && s.player.id === 'b3' && s.player.delay === 0.6 && s.player.rate === 0.8 && s.debug === 'b3', JSON.stringify(s.player));
  check('computer-driven cars keep the validated steering', s.computers.every((c) => c === null) && s.robotPlayer === null && s.explicitA === null);
  check('the option alone opens no bench', !s.bench && !s.panel);
  check('no console error', logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).length === 0);
  await close();
}
// ---- without the option, or with an unknown name: the validated driving, no bench, its keys do nothing
for (const hash of ['quality=medium', 'steering=zz&quality=medium']) {
  const { page, close } = await openGame({ width: 960, height: 540, hash });
  const before = await page.evaluate(() => ({ bench: !!window.virage.app.steerLab, variant: window.virage.app.steeringVariant === undefined, state: window.virage.flow.state, race: !!window.virage.app.race, debug: window.virage.debug.steering,
    panel: [...document.querySelectorAll('div')].some((d) => /BANC DE DIRECTION|STEERING BENCH/.test(d.textContent)) }));
  for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) await page.keyboard.press(key);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ bench: !!window.virage.app.steerLab, state: window.virage.flow.state, race: !!window.virage.app.race }));
  check(`[#${hash}] no bench, no help line, no variant`, !before.bench && !before.panel && before.variant && before.debug === 'a', JSON.stringify(before));
  check(`[#${hash}] the keys of the bench do nothing in the normal game`, !after.bench && after.state === before.state && after.race === before.race);
  const racing = await page.evaluate(async () => {
    const { app, quickRace, input } = window.virage;
    const race = quickRace({ circuit: 'kestrel-fields', opponents: 3, autoDrive: false });
    const me = race.playerCars[0];
    return { steering: race.cars.map((c) => c.steering), bench: !!app.steerLab };
  });
  // on the starting straight: full throttle up to 110 km/h, then the steering key is held (from a standstill the car
  // would only turn into the pit wall), and the experimental state is watched for as long as the car keeps turning
  await page.keyboard.down('ArrowUp');
  const rolling = await waitFor(page, () => { const race = window.virage.app.race; return race.phase === 'racing' && race.playerCars[0].speed > 30; }, null, 120);
  await page.keyboard.down('ArrowRight');
  const turning = await waitFor(page, () => window.virage.app.race.playerCars[0].steer === 1, null, 30);
  const held = await page.evaluate(() => new Promise((resolve) => {
    const me = window.virage.app.race.playerCars[0], out = { samples: 0, atStop: 0, extra: 0, shown: 0, hold: 0, drift: 0, kmh: +(me.speed * 3.6).toFixed(0) };
    const t0 = performance.now();
    const watch = () => {
      out.samples++; if (me.steer === 1) out.atStop++;
      out.extra = Math.max(out.extra, me.steerExtra); out.shown = Math.max(out.shown, Math.abs(me.steerShown)); out.hold = Math.max(out.hold, me.steerHold); out.drift = Math.max(out.drift, Math.abs(me.driftYaw));
      if (performance.now() - t0 < 5000) setTimeout(watch, 20); else resolve(out);
    };
    watch();
  }));
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight');
  check(`[#${hash}] in a race every car has the validated steering`, racing.steering.every((v) => v === null) && !racing.bench);
  check(`[#${hash}] a key held for seconds: the stop, and no experimental state at all`, rolling && turning && held.atStop > 3 && held.extra === 0 && held.shown === 0 && held.hold === 0 && held.drift === 0, JSON.stringify(held));
  await close();
}
console.log(failed ? `${failed} check(s) FAILED` : 'STEERLAB OK');
process.exit(failed ? 1 : 0);
