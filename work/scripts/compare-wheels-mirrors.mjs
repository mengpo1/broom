// Before / after comparison of two visual points: the rotation of the front wheels seen from the
// cockpit at several speeds (eight consecutive images, 1/60 s apart, for each speed) and the
// mirrors of the car as seen from three cameras. Two builds of the game are captured the same way.
// node work/scripts/compare-wheels-mirrors.mjs <before.html> <after.html> [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, root } from './lib-browser.mjs';

const builds = { before: process.argv[2] || 'work/renders/sequence/index-before-wheels.html', after: process.argv[3] || 'index.html' };
const outDir = process.argv[4] || 'work/renders/comparison';
const SPEEDS = [8, 40, 120, 250], FRAMES = 8, W = 1280, H = 720;
mkdirSync(`${root}/${outDir}/frames`, { recursive: true });
const manifest = { speeds: SPEEDS, frames: FRAMES, width: W, height: H, builds, variants: {} };
for (const [label, file] of Object.entries(builds)) {
  process.env.VIRAGE_HTML = file;
  const { page, logs, close } = await openGame({ width: W, height: H, hash: 'manual=1&quality=high' });
  await page.evaluate(([W, H]) => {
    const { app, quickRace, debug } = window.virage;
    window.virage.input.enabled = false;
    app.setCanvasSize(W, H);
    const race = quickRace({ circuit: 'kestrel-fields', opponents: 3, gridPosition: 3, autoDrive: false, rules: 'arcade', seed: 4 });
    let guard = 0;
    while ((race.phase !== 'racing' || race.time < 4) && guard++ < 6000) app.simulate();
    app.present(4, 0); app.present(4, 0);
    app.hud.visible = false;
    const track = race.track, me = race.playerCars[0];
    const need = Math.ceil(700 / track.ds); let run = 0, s0 = 0;
    for (let i = 0; i < track.n * 2; i++) { const k = i % track.n; if (Math.abs(track.kappa[k]) < 1 / 2500) { run++; if (run >= need) { s0 = ((i - need + 1) % track.n) * track.ds; break; } } else run = 0; }
    window.cmp = { race, me, s0, track };
    window.cmpPlace = (kmh, offset = 0) => {
      const v = kmh / 3.6, RACING = 1;
      // the build under test may not expose placeCar: move the car with the race's own grid helper when it does not
      if (debug && debug.placeCar) debug.placeCar(me, track, s0 + 40 + offset, 0.5);
      me.state = RACING; me.ghostTimer = 0; me.speed = v;
      const tops = me.params.spec.gearTopSpeeds; me.gear = 1; for (let g = 0; g < tops.length; g++) if (v >= tops[g] * 0.93) me.gear = g + 2;
      me.gear = Math.min(me.gear, tops.length);
    };
    window.cmpStep = (kmh) => {
      for (let t = 0; t < 2; t++) { me.speed = kmh / 3.6; race.setPlayerInput(0, 0, 0.5, 0, 0, false, false); app.simulate(); }
      app.present(1 / 60, 0);
    };
  }, [W, H]);
  const hasDebug = await page.evaluate(() => !!(window.virage.debug && window.virage.debug.placeCar));
  for (const kmh of SPEEDS) {
    await page.evaluate(([kmh]) => { window.cmpPlace(kmh); for (let i = 0; i < 20; i++) window.cmpStep(kmh); }, [kmh]);
    for (let f = 0; f < FRAMES; f++) {
      await page.evaluate(async ([kmh]) => { window.cmpStep(kmh); await window.virage.app.gpu.device.queue.onSubmittedWorkDone(); }, [kmh]);
      await page.screenshot({ path: `${root}/${outDir}/frames/${label}-wheel-${kmh}-${f}.png` });
    }
  }
  // mirrors: the same situation seen from the cockpit, from behind and from the front. The other cars are
  // held in the same places around the player in both builds (one behind on the right, one ahead on the
  // left, one far behind), so that what the mirrors show and hide can be compared.
  await page.evaluate(() => {
    const { app, debug } = window.virage, { race, me, track } = window.cmp, others = race.cars.filter((c) => !c.isHuman);
    const places = [[-13, 2.6], [22, -2.6], [-34, -2.4]];
    window.cmpFormation = (kmh) => {
      for (let t = 0; t < 2; t++) { me.speed = kmh / 3.6; race.setPlayerInput(0, 0, 0.5, 0, 0, false, false); app.simulate(); }
      others.forEach((c, k) => { if (debug && debug.placeCar) debug.placeCar(c, track, me.s + places[k][0], me.d + places[k][1]); c.state = 1; c.ghostTimer = 0; c.speed = me.speed; });
      app.present(1 / 60, 0);
    };
    window.cmpPlace(150);
    for (let i = 0; i < 30; i++) window.cmpFormation(150);
  });
  for (const cam of ['COCKPIT', 'CHASE', 'FRONT']) {
    await page.evaluate(async ([cam]) => { const v = window.virage; v.app.views[0].camera = v.CAMERA[cam]; for (let i = 0; i < 12; i++) window.cmpFormation(150); await v.app.gpu.device.queue.onSubmittedWorkDone(); }, [cam]);
    await page.screenshot({ path: `${root}/${outDir}/frames/${label}-mirror-${cam}.png` });
  }
  manifest.variants[label] = { placeCar: hasDebug };
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errors.length) console.log(label, 'ERRORS', errors.slice(0, 5).join('\n'));
  await close();
  console.log(label, 'captured', file);
}
writeFileSync(`${root}/${outDir}/manifest.json`, JSON.stringify(manifest, null, 1));
execFileSync('python3', [`${root}/work/scripts/compare-sheets.py`, `${root}/${outDir}`], { stdio: 'inherit' });
