// Records the collision scenarios in the real game, image by image at 60 images per second (two
// simulation steps per image): an mp4, a contact sheet of the stages of the movement and the
// telemetry of every image. The situations are staged by the test bench of the game itself
// (src/core/collision-lab.js, the same that a person opens with index.html#lab=...): two real cars
// are placed and driven with ordinary controls until they meet; everything else is the game.
// E2 to E5 are the events of the analysis report; HOP is the recoverable hop (original gameplay).
// node work/scripts/collision-sequences.mjs [E2,HOP,HOPx,E3,E3x,E4,E5|all|trackside|SIGN,ROCK,GANTRY,PILLAR,TUNNEL,OFFTRACK,CLOSE] [--width 1280] [--height 720] [--out work/renders/collisions]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const width = +arg('width', 1280), height = +arg('height', 720), outDir = arg('out', 'work/renders/collisions');
const wanted = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'all').split(',');
mkdirSync(`${root}/${outDir}`, { recursive: true });

/** What to record: a case of the test bench (its parameters live in collision-lab.js), a camera, a duration. */
const SCENARIOS = {
  E2: { title: 'wheel-to-wheel side contact', lab: 'wheel', seconds: 3.2, camera: 'COCKPIT' },
  HOP: { title: 'recoverable hop: wheel over wheel at a medium closing speed, the race goes on', lab: 'hop', seconds: 8, camera: 'COCKPIT' },
  HOPx: { title: 'the same hop seen from behind', lab: 'hop', seconds: 8, camera: 'CHASE' },
  E3: { title: 'launch over a car, hard landing, explosion, stop, restart', lab: 'crash', seconds: 9.5, camera: 'COCKPIT' },
  E3x: { title: 'the same launch seen from behind', lab: 'crash', seconds: 8, camera: 'CHASE' },
  E4: { title: 'repeated rear-end bumps', lab: 'bump', seconds: 10, camera: 'COCKPIT' },
  E5: { title: 'launch on a roadside board, light landing, slide', lab: 'board', seconds: 6.5, camera: 'COCKPIT' },
  // ---- trackside objects (EXPERIMENTAL interactions, bench circuits only). Not part of `all`: ask for `trackside` or for a name.
  SIGN: { group: 'trackside', title: 'breakable advertising board on the verge: knocked down, the car drives on', lab: 'sign', seconds: 6.5, camera: 'COCKPIT' },
  SIGNx: { group: 'trackside', title: 'the same board seen from behind', lab: 'sign', seconds: 6.5, camera: 'CHASE' },
  ROCK: { group: 'trackside', title: 'rigid obstacle (boulder) on the verge: the car is stopped and spins', lab: 'rock', seconds: 7.5, camera: 'COCKPIT' },
  ROCKx: { group: 'trackside', title: 'the same boulder seen from behind', lab: 'rock', seconds: 7.5, camera: 'CHASE' },
  GANTRY: { group: 'trackside', title: 'under a gantry at 250 km/h: no contact', lab: 'gantry', seconds: 7, camera: 'COCKPIT' },
  PILLAR: { group: 'trackside', title: 'support of a gantry, reachable on the verge: rigid', lab: 'pillar', seconds: 7.5, camera: 'COCKPIT' },
  TUNNEL: { group: 'trackside', title: 'through a tunnel at 220 km/h: no contact, the light changes', lab: 'tunnel', seconds: 9, camera: 'COCKPIT' },
  OFFTRACK: { group: 'trackside', title: 'open verges (prototype): the car drives beyond the usual barrier line and comes back', lab: 'offtrack', seconds: 11, camera: 'COCKPIT' },
  OFFTRACKx: { group: 'trackside', title: 'the same excursion seen from behind', lab: 'offtrack', seconds: 11, camera: 'CHASE' },
  CLOSE: { group: 'trackside', title: 'close contact between two cars side by side (validated rules)', lab: 'close', seconds: 5, camera: 'COCKPIT' },
};

/** Runs in the page: starts the case on the test bench (which keeps driving after the event) and defines the per-image step. */
const setup = ([sc, width, height]) => {
  const { app, CAMERA, createLab } = window.virage;
  app.setCanvasSize(width, height);
  window.virage.input.enabled = false;            // no keyboard here: the bench supplies the controls
  const lab = createLab();
  lab.start(sc.lab, { handOver: false });
  const me = lab.me, L = lab.race.track.length;
  app.views[0].camera = CAMERA[sc.camera];
  app.present(4, 0); app.present(4, 0);          // let anything left of the start run out
  window.scenarioStep = (frame) => {
    const t = frame / 60;
    app.simulate(); app.simulate();
    app.present(1 / 60, 0);
    const view = app.views[0], events = lab.events.splice(0);
    return { frame, t: +t.toFixed(3), speed: +(me.speed * 3.6).toFixed(1), state: me.state, d: +me.d.toFixed(2), airHeight: +(me.airHeight || 0).toFixed(2),
      pitch: +(view.crashPitch || 0).toFixed(3), contactDive: +(view.contactDive || 0).toFixed(3), brakeDive: +(view.dive * 0.045).toFixed(3), events,
      other: lab.lead ? +(lab.lead.speed * 3.6).toFixed(1) : null,
      // steering: what the driver asks for (share of the travel), what the game adds to it after a recoverable landing,
      // where the front wheels are, and the heading of the car relative to the road (degrees)
      steerAsked: +me.inSteer.toFixed(3), steerDisturbance: +window.virage.debug.hopSteerKick(me).toFixed(3), steer: +me.steer.toFixed(3),
      headingToRoad: +(me.headingError * 57.2958).toFixed(2), gapToOther: lab.lead ? +((((lab.lead.s - me.s + L * 1.5) % L) - L / 2)).toFixed(2) : null };   // metres along the road, centre to centre
  };
  return { board: lab.board ? { s: lab.board.s, d: lab.board.d } : null, cars: lab.race.cars.length, parameters: lab.scenario };
};

const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=medium' });
for (const name of Object.keys(SCENARIOS)) {
  const sc = SCENARIOS[name], total = Math.round(sc.seconds * 60);
  if (!wanted.includes(name) && !(sc.group ? wanted.includes(sc.group) : wanted.includes('all'))) continue;
  console.log(name, sc.title, JSON.stringify(await page.evaluate(setup, [sc, width, height])));
  const file = `${root}/${outDir}/${name}.mp4`;
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const telemetry = [];
  for (let frame = 0; frame < total; frame++) {
    const r = await page.evaluate(async (frame) => {
      const { app } = window.virage;
      const info = window.scenarioStep(frame);
      await app.gpu.device.queue.onSubmittedWorkDone();
      const blob = await new Promise((resolve) => app.canvas.toBlob(resolve, 'image/jpeg', 0.93));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { info, jpeg: btoa(bin) };
    }, frame);
    telemetry.push(r.info);
    if (r.info.events.length) console.log(`  ${r.info.t.toFixed(2)} s  ${r.info.events.map((e) => `${e.type}(${e.value})`).join(' ')}  speed ${r.info.speed}`);
    if (!ffmpeg.stdin.write(Buffer.from(r.jpeg, 'base64'))) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
  }
  ffmpeg.stdin.end();
  await new Promise((resolve) => ffmpeg.on('close', resolve));
  writeFileSync(`${root}/${outDir}/${name}.json`, JSON.stringify({ scenario: name, ...sc, fps: 60, width, height, frames: telemetry }));
  // contact sheet: every sixth image (0.1 s apart) around the event
  const first = telemetry.findIndex((f) => f.events.some((e) => ['wheel', 'bump', 'launch', 'obstacle', 'object'].includes(e.type)));
  const start = Math.max(0, first - 12), step = name === 'E3' || name === 'E5' || name === 'HOP' ? 6 : 4, cols = 6, rows = name === 'E3' ? 6 : 4;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', `select='gte(n\\,${start})*not(mod(n-${start}\\,${step}))',scale=480:-1,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', `${root}/${outDir}/${name}-sheet.jpg`]);
  console.log(`  -> ${outDir}/${name}.mp4 (${total} images), sheet from image ${start} every ${step}`);
}
const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (errors.length) console.log('ERRORS\n' + errors.slice(0, 10).join('\n'));
await close();
