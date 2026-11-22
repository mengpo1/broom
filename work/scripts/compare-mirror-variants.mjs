// Three positions of the mirrors, side by side, in the same scene seen by the same cameras:
// the position of the previous build, a slightly closer one, and a closer one still.
// The mirrors are defined once, in the car model (MIRROR_MOUNT, src/art/vehicles/car-model.js);
// the cockpit and the exterior views are all drawn from it. Each variant is the current build with
// that single definition replaced, so nothing else differs between the pictures.
// node work/scripts/compare-mirror-variants.mjs [outDir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, root } from './lib-browser.mjs';

const outDir = process.argv[2] || 'work/renders/comparison';
const W = 1280, H = 720;
/** y: lateral position of the centre of the left mirror (m from the centre line); arm: the point where its arm meets the cockpit. */
export const VARIANTS = [
  { id: 'A', label: 'position precedente', y: 0.42, arm: [0.4, 0.3, 0.6] },
  { id: 'B', label: 'legerement rapproches (proposition retenue)', y: 0.395, arm: [0.4, 0.25, 0.585] },
  { id: 'C', label: 'un peu plus rapproches', y: 0.37, arm: [0.4, 0.25, 0.585] },
];
const REAR_VIEW_YAW = 0.3;                    // rad: the car turned by 17 degrees in front of the camera that follows it
const MOUNT = /const MIRROR_MOUNT = \{[^}]*\};/;
const bundle = readFileSync(`${root}/index.html`, 'utf8');
if (!MOUNT.test(bundle)) throw new Error('MIRROR_MOUNT not found in index.html');
const current = MOUNT.exec(bundle)[0];
mkdirSync(`${root}/${outDir}/frames`, { recursive: true });
mkdirSync(`${root}/work/renders/sequence`, { recursive: true });

const report = { scene: 'kestrel-fields, 150 km/h, one car behind on the right, one ahead on the left', width: W, height: H, currentDefinition: current, variants: [] };
/** Runs in the page: the same scene for every variant (the graphics queue is emptied after each picture, never piled up). */
const stage = (page) => page.evaluate(async ([W, H]) => {
    const { app, quickRace, debug } = window.virage;
    window.virage.input.enabled = false;
    app.setCanvasSize(W, H);
    const race = quickRace({ circuit: 'kestrel-fields', opponents: 3, gridPosition: 3, autoDrive: false, rules: 'arcade', seed: 4 });
    let guard = 0;
    while ((race.phase !== 'racing' || race.time < 4) && guard++ < 6000) app.simulate();
    app.present(4, 0); app.present(4, 0);
    app.hud.visible = false;
    const track = race.track, me = race.playerCars[0], others = race.cars.filter((c) => !c.isHuman);
    const need = Math.ceil(700 / track.ds); let run = 0, s0 = 0;
    for (let i = 0; i < track.n * 2; i++) { const k = i % track.n; if (Math.abs(track.kappa[k]) < 1 / 2500) { run++; if (run >= need) { s0 = ((i - need + 1) % track.n) * track.ds; break; } } else run = 0; }
    debug.placeCar(me, track, s0 + 40, 0.5); me.state = 1; me.ghostTimer = 0; me.speed = 150 / 3.6; me.gear = 4;
    // the same other cars in the same places in every variant: one behind on the right, one ahead on the left, one far behind
    const places = [[-13, 2.6], [22, -2.6], [-34, -2.4]];
    // `yaw`: the car is DRAWN turned by this angle (rad) without being driven that way, to see it from three quarters
    window.mirrorStep = (yaw = 0) => {
      for (let t = 0; t < 2; t++) { me.speed = 150 / 3.6; race.setPlayerInput(0, 0, 0.5, 0, 0, false, false); app.simulate(); }
      others.forEach((c, k) => { debug.placeCar(c, track, me.s + places[k][0], me.d + places[k][1]); c.state = 1; c.ghostTimer = 0; c.speed = me.speed; });
      const heading = me.heading, headingError = me.headingError;
      me.heading += yaw; me.headingError += yaw;
      app.present(1 / 60, 0);
      me.heading = heading; me.headingError = headingError;
    };
    for (let i = 0; i < 30; i++) { window.mirrorStep(); await app.gpu.device.queue.onSubmittedWorkDone(); }
  }, [W, H]);

/** Capture one variant; returns false when the browser lost its graphics process on the way (seen now and then with the software renderer). */
async function capture(v, file) {
  process.env.VIRAGE_HTML = file;
  const { page, logs, close } = await openGame({ width: W, height: H, hash: 'manual=1&quality=high' });
  try {
    await stage(page);
    for (const cam of ['COCKPIT', 'FRONT', 'CHASE']) {
      // (seen from straight behind, the rear wheels hide the mirrors: the rear view is taken from three quarters)
      const yaw = cam === 'CHASE' ? REAR_VIEW_YAW : 0;
      await page.evaluate(async ([cam, yaw]) => { const g = window.virage; g.app.views[0].camera = g.CAMERA[cam]; for (let i = 0; i < 40; i++) { window.mirrorStep(yaw); await g.app.gpu.device.queue.onSubmittedWorkDone(); } }, [cam, yaw]);
      await page.screenshot({ path: `${root}/${outDir}/frames/mirror-${v.id}-${cam}.png` });
    }
    const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
    if (errors.length) console.log(v.id, 'ERRORS', errors.slice(0, 5).join('\n'));
    return true;
  } catch (error) {
    console.log(v.id, 'capture failed, trying again:', String(error.message).split('\n')[0]);
    return false;
  } finally { await close(); }
}

for (const v of VARIANTS) {
  const definition = `const MIRROR_MOUNT = { x: 0.4, y: ${v.y}, z: 0.675, width: 0.14, height: 0.075, arm: [${v.arm.join(', ')}] };`;
  const file = `work/renders/sequence/index-mirror-${v.id}.html`;
  writeFileSync(`${root}/${file}`, bundle.replace(MOUNT, definition));
  let done = false;
  for (let attempt = 0; attempt < 3 && !done; attempt++) done = await capture(v, file);
  if (!done) throw new Error(`variant ${v.id} could not be captured`);
  report.variants.push({ ...v, definition, isCurrentBuild: definition.replace(/\s/g, '') === current.replace(/\s/g, '') });
  console.log(v.id, v.label, 'captured');
}
writeFileSync(`${root}/${outDir}/mirror-variants.json`, JSON.stringify(report, null, 1));
execFileSync('python3', [`${root}/work/scripts/mirror-variants-sheet.py`, `${root}/${outDir}`], { stdio: 'inherit' });
