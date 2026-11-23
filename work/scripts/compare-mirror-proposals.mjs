// The mirror mounts of the car model side by side, in the same scene seen by the same cameras: the
// mount of the game and the closer proposals that wait for a player's choice (MIRROR_PRESETS,
// src/art/vehicles/car-model.js). Each one is the real build opened with its launch option
// (index.html#mirrors=d ...): the cockpit and the exterior views are all drawn from that single
// definition, and nothing else differs between the pictures.
// Views: cockpit; cockpit with the steering held at full lock (where the hands come nearest to the
// mirrors); front; three quarters from behind (seen from straight behind, the rear wheels hide them).
// node work/scripts/compare-mirror-proposals.mjs [outDir]
// (The first comparison, of the positions A, B and C, is work/renders/comparison/mirror-variants.jpg.)
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, root } from './lib-browser.mjs';
import { MIRROR_PRESETS, MIRROR_DEFAULT } from '../../src/art/vehicles/car-model.js';

const outDir = process.argv[2] || 'work/renders/comparison';
const W = 1280, H = 720;
const REAR_VIEW_YAW = 0.3;                    // rad: the car turned by 17 degrees in front of the camera that follows it
const VIEWS = [
  { id: 'COCKPIT', camera: 'COCKPIT', steer: 0, yaw: 0, steps: 6 },
  { id: 'LOCK', camera: 'COCKPIT', steer: 1, yaw: 0, steps: 6 },
  { id: 'FRONT', camera: 'FRONT', steer: 0, yaw: 0, steps: 40 },
  { id: 'CHASE', camera: 'CHASE', steer: 0, yaw: REAR_VIEW_YAW, steps: 40 },
];
mkdirSync(`${root}/${outDir}/frames`, { recursive: true });

const report = { scene: 'kestrel-fields, 150 km/h, one car behind on the right, one ahead on the left', width: W, height: H, inTheGame: MIRROR_DEFAULT, variants: [] };
/** Runs in the page: the same scene for every mount (the graphics queue is emptied after each picture, never piled up). */
const stage = (page) => page.evaluate(async ([W, H]) => {
    const { app, quickRace, debug } = window.virage;
    window.virage.input.enabled = false;
    app.setCanvasSize(W, H);
    const race = quickRace({ circuit: 'kestrel-fields', opponents: 3, gridPosition: 3, autoDrive: false, rules: 'arcade', seed: 4 });
    let guard = 0;
    while ((race.phase !== 'racing' || race.time < 4) && guard++ < 6000) app.simulate();
    app.present(4, 0); await app.gpu.device.queue.onSubmittedWorkDone();
    app.hud.visible = false;
    const track = race.track, me = race.playerCars[0], others = race.cars.filter((c) => !c.isHuman);
    const need = Math.ceil(700 / track.ds); let run = 0, s0 = 0;
    for (let i = 0; i < track.n * 2; i++) { const k = i % track.n; if (Math.abs(track.kappa[k]) < 1 / 2500) { run++; if (run >= need) { s0 = ((i - need + 1) % track.n) * track.ds; break; } } else run = 0; }
    debug.placeCar(me, track, s0 + 40, 0.5); me.state = 1; me.ghostTimer = 0; me.speed = 150 / 3.6; me.gear = 4;
    // the same other cars in the same places for every mount: one behind on the right, one ahead on the left, one far behind
    const places = [[-13, 2.6], [22, -2.6], [-34, -2.4]];
    // `yaw`: the car is DRAWN turned by this angle (rad) without being driven that way, to see it from three quarters;
    // `steer`: likewise the steering is DRAWN at this position (share of its travel), the car going straight on
    window.mirrorStep = (yaw = 0, steer = 0) => {
      for (let t = 0; t < 2; t++) { me.speed = 150 / 3.6; race.setPlayerInput(0, 0, 0.5, 0, 0, false, false); app.simulate(); }
      others.forEach((c, k) => { debug.placeCar(c, track, me.s + places[k][0], me.d + places[k][1]); c.state = 1; c.ghostTimer = 0; c.speed = me.speed; });
      const heading = me.heading, headingError = me.headingError, wheel = me.steer;
      me.heading += yaw; me.headingError += yaw; me.steer = steer;
      app.present(1 / 60, 0);
      me.heading = heading; me.headingError = headingError; me.steer = wheel;
    };
    for (let i = 0; i < 8; i++) { window.mirrorStep(); await app.gpu.device.queue.onSubmittedWorkDone(); }
    return window.virage.debug.mirrors;
  }, [W, H]);

/** Capture one mount; returns false when the browser lost its graphics process on the way (seen now and then with the software renderer). */
async function capture(key) {
  const { page, logs, close } = await openGame({ width: W, height: H, hash: `manual=1&quality=high&mirrors=${key}` });
  try {
    const used = await stage(page);
    if (used !== key) throw new Error(`the game used the mount "${used}" instead of "${key}"`);
    for (const view of VIEWS) {
      await page.evaluate(async ([camera, yaw, steer, steps]) => { const g = window.virage; g.app.views[0].camera = g.CAMERA[camera]; for (let i = 0; i < steps; i++) { window.mirrorStep(yaw, steer); await g.app.gpu.device.queue.onSubmittedWorkDone(); } }, [view.camera, view.yaw, view.steer, view.steps]);
      await page.screenshot({ path: `${root}/${outDir}/frames/mirror-${key}-${view.id}.png` });
    }
    const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
    if (errors.length) console.log(key, 'ERRORS', errors.slice(0, 5).join('\n'));
    return true;
  } catch (error) {
    console.log(key, 'capture failed, trying again:', String(error.message).split('\n')[0]);
    return false;
  } finally { await close(); }
}

for (const [key, mount] of Object.entries(MIRROR_PRESETS)) {
  let done = false;
  for (let attempt = 0; attempt < 3 && !done; attempt++) done = await capture(key);
  if (!done) throw new Error(`mount ${key} could not be captured`);
  report.variants.push({ id: key, ...mount, inTheGame: key === MIRROR_DEFAULT });
  console.log(key, `${(mount.y * 100).toFixed(1)} cm from the centre line`, 'captured');
}
writeFileSync(`${root}/${outDir}/mirror-proposals.json`, JSON.stringify(report, null, 1));
execFileSync('python3', [`${root}/work/scripts/mirror-proposals-sheet.py`, `${root}/${outDir}`], { stdio: 'inherit' });
