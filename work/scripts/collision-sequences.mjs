// Records the collision scenarios in the real game, image by image at 60 images per second (two
// simulation steps per image): an mp4, a contact sheet of the stages of the movement and the
// telemetry of every image. The situations are staged by the test bench of the game itself
// (src/core/collision-lab.js, the same that a person opens with index.html#lab=...): two real cars
// are placed and driven with ordinary controls until they meet; everything else is the game.
// E2 to E5 are the events of the analysis report; HOP is the recoverable hop (original gameplay); BODY is a contact
// between bodies with the energy of a hop (a bump). HOPslow and HOPslowx show the wheel contact of the hop four times
// slower (one simulation step per image, 30 images per second), from the cockpit and from behind.
// node work/scripts/collision-sequences.mjs [E2,HOP,HOPx,HOPslow,HOPslowx,E3,E3x,E4,E5,BODY,HOLD,HOLDx,HOLDslowx|all] [--width 1280] [--height 720] [--out work/renders/collisions]
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
  HOP: { title: 'recoverable hop: a front wheel on a rear wheel, the car flies over the other one and lands ahead of it', lab: 'hop', seconds: 8, camera: 'COCKPIT' },
  HOPx: { title: 'the same hop seen from behind', lab: 'hop', seconds: 8, camera: 'CHASE' },
  HOPslow: { title: 'the wheel contact of the hop, four times slower, from the cockpit', lab: 'hop', seconds: 1.7, from: 1.25, slow: true, camera: 'COCKPIT' },
  HOPslowx: { title: 'the wheel contact of the hop, four times slower, from behind', lab: 'hop', seconds: 1.7, from: 1.25, slow: true, camera: 'CHASE' },
  BODY: { title: 'nose against a rear wheel with the energy of a hop: a bump, nothing leaves the ground', lab: 'body', seconds: 4, camera: 'COCKPIT' },
  E3: { title: 'launch over a car, hard landing, explosion, stop, restart', lab: 'crash', seconds: 9.5, camera: 'COCKPIT' },
  E3x: { title: 'the same launch seen from behind', lab: 'crash', seconds: 8, camera: 'CHASE' },
  E4: { title: 'repeated rear-end bumps', lab: 'bump', seconds: 10, camera: 'COCKPIT' },
  E5: { title: 'launch on a roadside board, light landing, slide', lab: 'board', seconds: 6.5, camera: 'COCKPIT' },
  // (securing of PR #8) the hop with a third car that keeps itself under the car in flight: the landing waits, the car
  // gets clear of it and comes down on free ground. From behind, from the cockpit, and from behind four times slower
  HOLDx: { title: 'a third car stays under the car in flight: the landing waits, the car gets clear of it and lands on free ground (from behind)', lab: 'under', seconds: 7, camera: 'CHASE' },
  HOLD: { title: 'the same from the cockpit', lab: 'under', seconds: 7, camera: 'COCKPIT' },
  HOLDslowx: { title: 'the same four times slower, from behind', lab: 'under', seconds: 1.9, from: 1.45, slow: true, camera: 'CHASE' },
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
  // (slow motion: the scene is first played, unseen, up to `from` seconds; then one simulation step per image)
  const ticks = sc.slow ? 1 : 2, skipped = Math.round((sc.from || 0) * 120);
  for (let i = 0; i < skipped; i++) app.simulate();
  if (skipped) lab.events.length = 0;
  const place = (c) => (c ? [+c.x.toFixed(3), +c.z.toFixed(3), +c.heading.toFixed(5)] : null);
  window.scenarioStep = (frame) => {
    const t = (skipped + frame * ticks) / 120;
    for (let i = 0; i < ticks; i++) app.simulate();
    app.present(ticks / 120, 0);
    const view = app.views[0], events = lab.events.splice(0);
    return { frame, t: +t.toFixed(3), speed: +(me.speed * 3.6).toFixed(1), state: me.state, d: +me.d.toFixed(2), airHeight: +(me.airHeight || 0).toFixed(2),
      pitch: +(view.crashPitch || 0).toFixed(3), contactDive: +(view.contactDive || 0).toFixed(3), brakeDive: +(view.dive * 0.045).toFixed(3), events,
      other: lab.lead ? +(lab.lead.speed * 3.6).toFixed(1) : null,
      // steering: what the driver asks for (share of the travel), what the game adds to it after a recoverable landing,
      // where the front wheels are, and the heading of the car relative to the road (degrees)
      steerAsked: +me.inSteer.toFixed(3), steerDisturbance: +window.virage.debug.hopSteerKick(me).toFixed(3), steer: +me.steer.toFixed(3),
      headingToRoad: +(me.headingError * 57.2958).toFixed(2), gapToOther: lab.lead ? +((((lab.lead.s - me.s + L * 1.5) % L) - L / 2)).toFixed(2) : null,   // metres along the road, centre to centre
      // (lot 5) where the two cars are: x, z (m) and heading (rad), for the diagrams seen from above
      place: place(me), placeOther: place(lab.lead), s: +me.s.toFixed(2),
      // (only for the case with a third car) is the landing waiting, for how long so far, and where that car is
      ...(lab.third ? { waiting: !!me.airWaiting, waited: +(me.airWaited || 0).toFixed(3), placeThird: place(lab.third), third: +(lab.third.speed * 3.6).toFixed(1), gapToThird: +((((lab.third.s - me.s + L * 1.5) % L) - L / 2)).toFixed(2) } : {}) };
  };
  return { board: lab.board ? { s: lab.board.s, d: lab.board.d } : null, cars: lab.race.cars.length, parameters: lab.scenario };
};

const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=medium' });
for (const name of Object.keys(SCENARIOS)) {
  if (!wanted.includes('all') && !wanted.includes(name)) continue;
  const sc = SCENARIOS[name], total = Math.round(sc.seconds * (sc.slow ? 120 : 60)), rate = sc.slow ? 30 : 60;
  console.log(name, sc.title, JSON.stringify(await page.evaluate(setup, [sc, width, height])));
  const file = `${root}/${outDir}/${name}.mp4`;
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(rate), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(rate), '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
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
  writeFileSync(`${root}/${outDir}/${name}.json`, JSON.stringify({ scenario: name, ...sc, fps: rate, simulationStepsPerImage: sc.slow ? 1 : 2, width, height, frames: telemetry }));
  // contact sheet: every sixth image (0.1 s apart) around the event
  const first = telemetry.findIndex((f) => f.events.some((e) => ['wheel', 'bump', 'launch', 'obstacle'].includes(e.type)));
  const start = Math.max(0, first - 12), step = name === 'E3' || name === 'E5' || name === 'HOP' || sc.slow ? 6 : 4, cols = 6, rows = name === 'E3' ? 6 : 4;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', `select='gte(n\\,${start})*not(mod(n-${start}\\,${step}))',scale=480:-1,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', `${root}/${outDir}/${name}-sheet.jpg`]);
  console.log(`  -> ${outDir}/${name}.mp4 (${total} images), sheet from image ${start} every ${step}`);
}
const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (errors.length) console.log('ERRORS\n' + errors.slice(0, 10).join('\n'));
await close();
