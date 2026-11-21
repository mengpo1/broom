// Frames of the trackside camera while the followed car approaches and passes, to check that it
// stays framed. node work/scripts/trackside-check.mjs [circuit] [width height]
import { openGame, root } from './lib-browser.mjs';
const circuit = process.argv[2] || 'hazelbrook';
const width = +(process.argv[3] || 1280), height = +(process.argv[4] || 720);
const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=low' });
await page.evaluate(async ([circuit, width, height]) => {
  const { app, quickRace, CAMERA } = window.virage;
  app.setCanvasSize(width, height);
  const race = quickRace({ circuit, opponents: 11, gridPosition: 6 });
  for (let i = 0; i < 120 * 16; i++) app.simulate();
  app.views[0].camera = CAMERA.TRACKSIDE;
  app.present(3, 0);
  for (let f = 0; f < 4; f++) await app.advanceFrame(2);
}, [circuit, width, height]);
const rows = [];
for (let shot = 0; shot < 16; shot++) {
  const info = await page.evaluate(async () => {
    const { app } = window.virage, view = app.views[0], car = app.race.playerCars[0];
    app.skipRender = true;
    for (let f = 0; f < 11; f++) await app.advanceFrame(2);
    app.skipRender = false;
    await app.advanceFrame(2);
    // where is the car on screen?
    const p = view.projection;
    let z = (car.s - p.camS) * p.dir; if (z > p.length / 2) z -= p.length; else if (z <= -p.length / 2) z += p.length;
    return { gap: +view.tracksideGap.toFixed(1), yaw: +view.yaw.toFixed(3), z: +z.toFixed(1), speed: +(car.speed * 3.6).toFixed(0) };
  });
  rows.push(info);
  await page.screenshot({ path: `${root}/work/renders/trackside-${shot}.png` });
  console.log(shot, JSON.stringify(info));
}
const errors = logs.filter((l) => !l.includes('[log]'));
if (errors.length) console.log('ERRORS\n' + errors.slice(0, 20).join('\n'));
await close();
