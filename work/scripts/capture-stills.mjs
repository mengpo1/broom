// Reference captures for the independent art review (2560x1440 unless told otherwise):
//   01 cockpit on the grid, 02 high-speed straight, 03 tight corner, 04 overtake,
//   05 exterior view of several cars, 06 collision, 07 split screen, 08 main menu
// plus a short frame sequence (consecutive frames at 60 fps) for the animation checks.
// node work/scripts/capture-stills.mjs [outDir] [width] [height] [circuit]
import { mkdirSync, writeFileSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';

const outDir = process.argv[2] || 'work/renders/review';
const width = +(process.argv[3] || 2560), height = +(process.argv[4] || 1440);
const circuit = process.argv[5] || 'hazelbrook';
mkdirSync(`${root}/${outDir}`, { recursive: true });
const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=high' });
const shot = async (name) => { await page.screenshot({ path: `${root}/${outDir}/${name}.png` }); console.log('saved', name); };
const log = [];

/** Start a race and fast-forward (without drawing) until `until(car, race, app)` is true, then draw. */
const stage = async (name, options) => {
  const info = await page.evaluate(async ([options, width, height]) => {
    const { app, quickRace, CAMERA } = window.virage;
    app.splitLayout = options.layout || 'horizontal';
    app.setCanvasSize(width, height);
    const race = quickRace(options.race);
    const me = race.playerCars[0];
    const until = new Function('car', 'race', 'app', 'track', `return (${options.until});`);
    let steps = 0;
    const limit = (options.maxSeconds || 200) * 120;
    while (steps < limit && !until(me, race, app, race.track)) { app.simulate(); steps++; }
    if (options.before) new Function('car', 'race', 'app', 'CAMERA', options.before)(me, race, app, CAMERA);
    app.present(steps > 400 ? 3 : 0.01, 0);
    for (let f = 0; f < (options.frames ?? 12); f++) await app.advanceFrame(options.ticks ?? 2);
    return { found: steps < limit, time: +race.time.toFixed(2), speed: +(me.speed * 3.6).toFixed(0), s: +me.s.toFixed(0), position: me.position, quads: app.renderer.stats.quads };
  }, [options, width, height]);
  log.push({ name, ...info });
  console.log(name, JSON.stringify(info));
  await shot(name);
};

const straightAhead = 'Math.abs(track.kappa[(car.segIndex + 20) % track.n]) < 0.0008 && Math.abs(track.kappa[(car.segIndex + 60) % track.n]) < 0.0008 && Math.abs(track.kappa[car.segIndex]) < 0.0008';

await stage('01-grid', { race: { circuit, opponents: 15, gridPosition: 7, autoDrive: false }, until: 'race.lights >= 3', frames: 30, ticks: 0 });
await stage('02-straight', { race: { circuit, opponents: 15, gridPosition: 9 }, until: `race.time > 20 && car.speed > 80 && ${straightAhead}`, frames: 24 });
await stage('03-corner', { race: { circuit: 'porto-sereno', opponents: 15, gridPosition: 9 }, until: 'race.time > 12 && Math.abs(track.kappa[car.segIndex]) > 1 / 75 && Math.abs(car.steer) > 0.35 && car.speed > 22', frames: 6 });
await stage('04-overtake', {
  race: { circuit, opponents: 15, gridPosition: 12, difficulty: 'novice' },
  until: `race.time > 6 && race.cars.some((o) => { if (o === car) return false; let dz = o.s - car.s; if (dz > track.length / 2) dz -= track.length; const dd = Math.abs(o.d - car.d); return dz > 2.5 && dz < 7 && dd > 1.9 && dd < 4.2 && car.speed > o.speed + 2 && car.speed > 45; })`,
  frames: 4,
});
await stage('05-exterior', {
  race: { circuit, opponents: 15, gridPosition: 3 },
  until: 'race.time > 7.5',
  before: 'app.views[0].camera = CAMERA.FRONT; app.hud.visible = false;', frames: 40,
});
await stage('05b-chase', {
  race: { circuit: 'montclair', opponents: 15, gridPosition: 8 },
  until: 'race.time > 16 && car.speed > 50',
  before: 'app.views[0].camera = CAMERA.CHASE;', frames: 40,
});
// collision: steer the player into the barrier on a straight and capture just after the hit
{
  const info = await page.evaluate(async ([circuit, width, height, straightAhead]) => {
    const { app, quickRace } = window.virage;
    app.setCanvasSize(width, height);
    const race = quickRace({ circuit, opponents: 15, gridPosition: 9 });
    const me = race.playerCars[0];
    const straight = new Function('car', 'track', `return (${straightAhead});`);
    let steps = 0;
    while (steps < 120 * 120 && !(race.time > 14 && me.speed > 62 && straight(me, race.track))) { app.simulate(); steps++; }
    app.present(3, 0);
    me.autoDrive = false;
    let hit = false;
    app.on((type, e) => { if ((type === 'wall' || type === 'crash') && e.car === me.index && e.value > 5) hit = true; });
    const side = race.track.pit.side;      // toward the side without the pit wall
    for (let f = 0; f < 400 && !hit; f++) { race.setPlayerInput(0, -side * 0.5, 1, 0, 0, false, false); app.simulate(); race.setPlayerInput(0, -side * 0.5, 1, 0, 0, false, false); app.simulate(); await app.advanceFrame(0); }
    for (let f = 0; f < 5; f++) await app.advanceFrame(2);
    return { hit, speed: +(me.speed * 3.6).toFixed(0), wallHits: me.wallHits };
  }, [circuit, width, height, straightAhead]);
  log.push({ name: '06-collision', ...info });
  console.log('06-collision', JSON.stringify(info));
  await shot('06-collision');
}
await stage('07-split', { race: { circuit: 'kestrel-fields', opponents: 10, players: 2, gridPosition: 6 }, until: 'race.time > 9', frames: 20 });
await stage('07b-split-vertical', { race: { circuit: 'costa-brisa', opponents: 10, players: 2, gridPosition: 6 }, layout: 'vertical', until: 'race.time > 12', frames: 20 });
// extra themes for variety
await stage('09-desert', { race: { circuit: 'ouarzane', opponents: 15, gridPosition: 8 }, until: 'race.time > 18 && car.speed > 55', frames: 20 });
await stage('10-dusk', { race: { circuit: 'kagerou-hills', opponents: 15, gridPosition: 8 }, until: 'race.time > 15 && car.speed > 50', frames: 20 });
await stage('11-docks', { race: { circuit: 'meridian-docks', opponents: 15, gridPosition: 8 }, until: 'race.time > 14 && car.speed > 45', frames: 20 });

// animation sequence: six consecutive frames (1/60 s apart) of the high-speed straight
await page.evaluate(async ([circuit, width, height, straightAhead]) => {
  const { app, quickRace } = window.virage;
  app.splitLayout = 'horizontal'; app.setCanvasSize(width, height);
  const race = quickRace({ circuit, opponents: 15, gridPosition: 9 });
  const me = race.playerCars[0];
  const straight = new Function('car', 'track', `return (${straightAhead});`);
  let steps = 0;
  while (steps < 120 * 120 && !(race.time > 20 && me.speed > 75 && straight(me, race.track))) { app.simulate(); steps++; }
  app.present(3, 0);
  for (let f = 0; f < 20; f++) await app.advanceFrame(2);
}, [circuit, width, height, straightAhead]);
for (let f = 0; f < 6; f++) {
  await page.evaluate(() => window.virage.app.advanceFrame(2));
  await shot(`seq-straight-${f}`);
}

// main menu and a results plate
await page.evaluate(() => { const v = window.virage; v.flow.toMenu(); v.app.hud.visible = false; });
await page.evaluate(async () => { const { app } = window.virage; for (let i = 0; i < 40; i++) await app.advanceFrame(2); });
await shot('08-menu');
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
await page.evaluate(async () => { const { app } = window.virage; for (let i = 0; i < 40; i++) await app.advanceFrame(2); });
await shot('08b-menu-circuit');

writeFileSync(`${root}/${outDir}/captures.json`, JSON.stringify(log, null, 2));
const errors = logs.filter((l) => !l.includes('[log]'));
if (errors.length) console.log('ERRORS\n' + errors.slice(0, 20).join('\n'));
await close();
