// Stages the collision scenarios of the analysis report (E2, E3, E4, E5) in the real game and
// records each one image by image at 60 images per second (two simulation steps per image):
// an mp4, a contact sheet of the stages of the movement and the telemetry of every image.
// node work/scripts/collision-sequences.mjs [E2,E3,E4,E5,E3x|all] [--width 1280] [--height 720] [--out work/renders/collisions]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const width = +arg('width', 1280), height = +arg('height', 720), outDir = arg('out', 'work/renders/collisions');
const wanted = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'all').split(',');
mkdirSync(`${root}/${outDir}`, { recursive: true });

/** Scenario descriptions. Speeds in km/h, distances in metres; the car ahead is scripted (constant speed). */
const SCENARIOS = {
  E2: { title: 'wheel-to-wheel side contact', seconds: 3.2, circuit: 'kestrel-fields', me: { speed: 146, back: 7, side: -3.2 }, other: { speed: 118 }, steerTo: -1.7, steerFrom: 0.45, hold: 146, camera: 'COCKPIT' },
  E3: { title: 'launch over a car, hard landing, explosion, stop, restart', seconds: 9.5, circuit: 'kestrel-fields', me: { speed: 262, back: 34, side: -0.93 }, other: { speed: 188 }, steerTo: -0.93, steerFrom: 0, hold: 262, camera: 'COCKPIT' },
  E3x: { title: 'the same launch seen from behind', seconds: 4.2, circuit: 'kestrel-fields', me: { speed: 262, back: 34, side: -0.93 }, other: { speed: 188 }, steerTo: -0.93, steerFrom: 0, hold: 262, camera: 'CHASE' },
  // E4: a first contact at about 40 km/h of closing speed (report: 145 -> 60), then the follower comes back gently on the car ahead
  // (5 km/h faster) and bumps it again, as a driver who stays behind it does (report: 115 -> 67, 104 -> 56)
  E4: { title: 'repeated rear-end bumps', seconds: 10, circuit: 'kestrel-fields', me: { speed: 146, back: 12, side: 0 }, other: { speed: 105 }, steerTo: 0, steerFrom: 0, hold: 146, afterBump: 5, camera: 'COCKPIT' },
  E5: { title: 'launch on a roadside board, light landing, slide', seconds: 6.5, circuit: 'hazelbrook', board: true, me: { speed: 245, back: 70 }, camera: 'COCKPIT' },
};

/** Runs in the page: builds the situation. */
const setup = ([sc, width, height]) => {
  const { app, quickRace, CAMERA, debug } = window.virage;
  app.setCanvasSize(width, height);
  window.virage.input.enabled = false;            // the scenario supplies the controls
  const race = quickRace({ circuit: sc.circuit, opponents: 3, gridPosition: 3, autoDrive: false, rules: 'arcade', laps: 4, seed: 4 });
  let guard = 0;
  while ((race.phase !== 'racing' || race.time < 4) && guard++ < 6000) app.simulate();      // past the start messages
  const track = race.track, me = race.playerCars[0], others = race.cars.filter((c) => !c.isHuman);
  const kmh = (v) => v / 3.6;
  const gearFor = (car, v) => { const tops = car.params.spec.gearTopSpeeds; for (let g = 0; g < tops.length; g++) if (v < tops[g] * 0.93) return g + 1; return tops.length; };
  const put = (car, s, d, speed) => { debug.placeCar(car, track, s, d); car.state = debug.CAR_STATE.RACING; car.ghostTimer = 0; car.speed = kmh(speed); car.gear = gearFor(car, kmh(speed)); };
  const sc0 = window.scenario = { sc, events: [], target: null, board: null };
  app.on((type, e) => { if (['bump', 'wheel', 'launch', 'landing', 'obstacle', 'crash', 'restart', 'reset', 'contact'].includes(type)) sc0.events.push({ type, car: e.car, value: +(+e.value).toFixed(2) }); if (type === 'bump') sc0.bumped = true; });
  if (sc.board) {
    // a braking board at the end of a straight; the car leaves the road toward it
    const o = race.obstacles.find((b) => { const i = Math.floor(b.s / track.ds) % track.n; return Math.abs(track.kappa[(i - 20 + track.n) % track.n]) < 0.001; }) || race.obstacles[0];
    sc0.board = o;
    race.obstacles.forEach((b, i) => { if (b !== o) race.obstacleDown[i] = 1; });      // only this board: the reference case is a single obstacle
    put(me, o.s - sc.me.back, Math.sign(o.d) * (track.halfWidth - 1.5), sc.me.speed);
    others.forEach((c, k) => put(c, o.s + track.length / 2 + k * 40, 0, 150));
  } else {
    // longest straight away from the pits
    const need = Math.ceil(520 / track.ds); let run = 0, s0 = 0;
    for (let i = 0; i < track.n * 2; i++) {
      const k = i % track.n, rel = k * track.ds > track.length / 2 ? k * track.ds - track.length : k * track.ds;
      const pits = rel > track.pit.entryS - 40 && rel < track.pit.exitS + 40;
      if (Math.abs(track.kappa[k]) < 1 / 2500 && !pits) { run++; if (run >= need) { s0 = ((i - need + 1) % track.n) * track.ds; break; } } else run = 0;
    }
    const lead = others[0];
    put(lead, s0 + 60, 0.6, sc.other.speed);
    put(me, s0 + 60 - 4.2 - sc.me.back, 0.6 + sc.me.side, sc.me.speed);
    others.slice(1).forEach((c, k) => put(c, s0 + track.length / 2 + k * 40, 0, 150));
    sc0.target = lead;
    // the car ahead is scripted (constant speed, straight): taken away from the computer driver
    lead.isHuman = true; sc0.leadSpeed = kmh(sc.other.speed); sc0.leadD = lead.d;
  }
  app.views[0].camera = CAMERA[sc.camera];
  app.present(4, 0); app.present(4, 0);          // let the start messages of the interface run out
  window.scenarioStep = (frame) => {
    const t = frame / 60;
    for (let tick = 0; tick < 2; tick++) {
      let steer = 0, throttle = 1, brake = 0;
      if (me.state !== debug.CAR_STATE.RACING) sc0.left = true;          // after the accident: straight on, full throttle
      if (me.state === debug.CAR_STATE.RACING) {
        if (sc0.board && !sc0.left) { steer = Math.max(-0.5, Math.min(0.5, (sc0.board.d - me.d) * 0.22 - me.headingError * 2.4)); throttle = 0.6; }
        else if (sc0.board) {
          // after the accident the car is handed back where it stopped, across the verge: drive it back to the road gently
          const want = Math.max(-0.5, Math.min(0.5, (0 - me.d) * 0.05));                 // heading wanted relative to the track
          steer = Math.max(-1, Math.min(1, (want - me.headingError) * 2.2));
          throttle = Math.abs(want - me.headingError) > 0.5 ? 0.22 : 0.6;
        }
        else {
          const lead = sc0.target, side = t < sc.steerFrom ? sc.me.side : sc.steerTo;
          steer = Math.max(-0.4, Math.min(0.4, (lead.d + side - me.d) * 0.3 - me.headingError * 2.2));
          const hold = sc0.bumped && sc.afterBump ? lead.speed * 3.6 + sc.afterBump : sc.hold;
          if (hold && !sc0.left) throttle = Math.max(0, Math.min(1, 0.5 + (hold / 3.6 - me.speed) * 0.4));
        }
      }
      race.setPlayerInput(0, steer, throttle, brake, 0, false, false);
      const lead = sc0.target;
      if (lead && lead.state === debug.CAR_STATE.RACING) {
        const dv = sc0.leadSpeed - lead.speed;
        lead.inThrottle = Math.max(0, Math.min(1, 0.35 + dv * 0.4)); lead.inBrake = dv < -2 ? 0.3 : 0;
        lead.inSteer = Math.max(-0.3, Math.min(0.3, (sc0.leadD - lead.d) * 0.3 - lead.headingError * 2.2));
      }
      app.simulate();
    }
    app.present(1 / 60, 0);
    const view = app.views[0], events = sc0.events.splice(0);
    return { frame, t: +t.toFixed(3), speed: +(me.speed * 3.6).toFixed(1), state: me.state, d: +me.d.toFixed(2), airHeight: +(me.airHeight || 0).toFixed(2),
      pitch: +(view.crashPitch || 0).toFixed(3), contactDive: +(view.contactDive || 0).toFixed(3), brakeDive: +(view.dive * 0.045).toFixed(3), events,
      other: sc0.target ? +(sc0.target.speed * 3.6).toFixed(1) : null };
  };
  return { board: sc0.board ? { s: sc0.board.s, d: sc0.board.d } : null, cars: race.cars.length };
};

const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=medium' });
for (const name of Object.keys(SCENARIOS)) {
  if (!wanted.includes('all') && !wanted.includes(name)) continue;
  const sc = SCENARIOS[name], total = Math.round(sc.seconds * 60);
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
  const first = telemetry.findIndex((f) => f.events.some((e) => ['wheel', 'bump', 'launch', 'obstacle'].includes(e.type)));
  const start = Math.max(0, first - 12), step = name === 'E3' || name === 'E5' ? 6 : 4, cols = 6, rows = name === 'E3' ? 6 : 4;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', `select='gte(n\\,${start})*not(mod(n-${start}\\,${step}))',scale=480:-1,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', `${root}/${outDir}/${name}-sheet.jpg`]);
  console.log(`  -> ${outDir}/${name}.mp4 (${total} images), sheet from image ${start} every ${step}`);
}
const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (errors.length) console.log('ERRORS\n' + errors.slice(0, 10).join('\n'));
await close();
