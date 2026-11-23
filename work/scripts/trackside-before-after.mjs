// Before / after pictures of the trackside objects: the same build opened twice, with the previous
// scenery (index.html#scenery=classic) and with the enriched one (default), the same car at the
// same place of the same circuit, cockpit view. One sheet per scene (before on the left) and one
// sheet of all scenes: work/renders/trackside/before-after-*.jpg
// node work/scripts/trackside-before-after.mjs [outDir]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';

const outDir = process.argv[2] || 'work/renders/trackside';
const W = 1280, H = 720;
mkdirSync(`${root}/${outDir}/frames`, { recursive: true });
/** Scenes: a circuit and what to look at. `find` runs in the page on the ENRICHED layout and returns the distance s of the camera. */
const SCENES = [
  { name: 'gantry', circuit: 'hazelbrook', what: 'portique', find: 'L.trackside.gantries[0].s - 120' },
  { name: 'chevrons', circuit: 'hazelbrook', what: 'chevrons', find: 'L.props.find((p) => p.id === "sign.chevron").s - 42' },
  { name: 'tunnel-mouth', circuit: 'montclair', what: 'tunnel', find: 'L.trackside.tunnels[0].from - 95' },
  { name: 'tunnel-inside', circuit: 'meridian-docks', what: 'tunnel', find: 'L.trackside.tunnels[0].from + 35' },
  { name: 'desert', circuit: 'ouarzane', what: 'cactus, rochers, sable', find: 'L.props.filter((p) => p.id.startsWith("cactus"))[3].s - 34' },
  { name: 'adverts', circuit: 'grand-zenith', what: 'panneaux publicitaires', find: 'L.props.find((p) => p.id.startsWith("sign.advert.low")).s - 40' },
  { name: 'highland', circuit: 'glenmoor', what: 'rochers, bottes de paille', find: 'L.props.filter((p) => p.id.startsWith("boulder") || p.id === "haybale")[6].s - 30' },
  { name: 'turn-sign', circuit: 'kestrel-fields', what: 'signalisation avant virage', find: 'L.props.find((p) => p.id === "sign.turn").s - 30' },
];

const shots = {};
for (const mode of ['enriched', 'classic']) {
  const { page, logs, close } = await openGame({ width: W, height: H, hash: `manual=1&quality=high${mode === 'classic' ? '&scenery=classic' : ''}` });
  for (const scene of SCENES) {
    const info = await page.evaluate(async ([scene, W, H, s]) => {
      const { app, quickRace, debug } = window.virage;
      window.virage.input.enabled = false;
      app.setCanvasSize(W, H);
      const race = quickRace({ circuit: scene.circuit, opponents: 0, autoDrive: false, rules: 'arcade', seed: 4 });
      let guard = 0;
      while ((race.phase !== 'racing' || race.time < 4) && guard++ < 6000) app.simulate();
      app.present(4, 0); await app.gpu.device.queue.onSubmittedWorkDone();
      app.hud.visible = false;
      const L = race.track.sceneryLayout, me = race.playerCars[0];
      const at = s ?? new Function('L', `return ${scene.find}`)(L);
      debug.placeCar(me, race.track, at, 0); me.state = 1; me.ghostTimer = 0; me.speed = 0;
      for (let i = 0; i < 4; i++) { race.setPlayerInput(0, 0, 0, 1, 0, false, false); app.simulate(); app.present(1 / 60, 0); await app.gpu.device.queue.onSubmittedWorkDone(); }
      return { s: at, props: L.props.length, strips: L.strips.length, quads: app.renderer.stats.quads };
    }, [scene, W, H, shots[scene.name] ? shots[scene.name].s : null]);
    await page.screenshot({ path: `${root}/${outDir}/frames/${scene.name}-${mode}.png` });
    shots[scene.name] = { ...(shots[scene.name] || {}), s: info.s, [mode]: info };
    console.log(mode, scene.name, JSON.stringify(info));
  }
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errors.length) console.log('ERRORS\n' + errors.slice(0, 10).join('\n'));
  await close();
}
writeFileSync(`${root}/${outDir}/before-after.json`, JSON.stringify({ width: W, height: H, scenes: SCENES.map((s) => ({ name: s.name, circuit: s.circuit, what: s.what, ...shots[s.name] })) }, null, 1));
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const label = (text) => `drawbox=x=0:y=0:w=iw:h=44:color=0xf4efe2@0.92:t=fill,drawtext=fontfile=${font}:text='${text}':x=18:y=11:fontsize=24:fontcolor=0x16161f`;
for (const scene of SCENES) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${root}/${outDir}/frames/${scene.name}-classic.png`, '-i', `${root}/${outDir}/frames/${scene.name}-enriched.png`,
    '-filter_complex', `[0:v]${label(`AVANT · ${scene.circuit}`)}[a];[1:v]${label(`APRES · ${scene.what}`)}[b];[a][b]hstack=2`, '-q:v', '3', `${root}/${outDir}/before-after-${scene.name}.jpg`]);
}
const inputs = SCENES.flatMap((s) => ['-i', `${root}/${outDir}/before-after-${s.name}.jpg`]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${SCENES.map((_, i) => `[${i}:v]scale=1600:-1[s${i}]`).join(';')};${SCENES.map((_, i) => `[s${i}]`).join('')}vstack=${SCENES.length}`, '-q:v', '4', `${root}/${outDir}/before-after-all.jpg`]);
console.log(`-> ${outDir}/before-after-*.jpg`);
