// Before / after video of the cockpit at four speeds and through a slow acceleration: front wheel rotation and mirrors.
// Two builds of the game play the same thing (constant speed on a straight, two simulation steps
// per image); the lower part of each picture is stacked, "before" above "after", at 60 images/s.
// node work/scripts/compare-wheels-video.mjs <before.html> <after.html> [out.mp4] [--reuse-before]
// --reuse-before keeps the images of the first build from an earlier run and records only the second.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, root } from './lib-browser.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), reuseBefore = process.argv.includes('--reuse-before');
const builds = { before: args[0] || 'work/renders/sequence/index-before-wheels.html', after: args[1] || 'index.html' };
const out = args[2] || 'work/renders/comparison/wheels-mirrors-before-after.mp4';
// constant speeds (km/h), then a ramp [from, to] through the speeds where the drawing of the tyre changes
const SPEEDS = [8, 40, 120, 250, [4, 30]], FRAMES = 96, W = 1280, H = 720, CROP_TOP = 300;
const label = (v) => (Array.isArray(v) ? `${v[0]} a ${v[1]} km/h` : `${v} km/h`);
const tmp = `${root}/work/renders/sequence/cmp-video`;
if (!reuseBefore) rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

for (const [name, file] of Object.entries(builds)) {
  if (reuseBefore && name === 'before') continue;
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
    window.cmpPlace = (kmh) => {
      const v = kmh / 3.6;
      if (debug && debug.placeCar) debug.placeCar(me, track, s0 + 40, 0.5);
      me.state = 1; me.ghostTimer = 0; me.speed = v;
      const tops = me.params.spec.gearTopSpeeds; me.gear = 1; for (let g = 0; g < tops.length; g++) if (v >= tops[g] * 0.93) me.gear = g + 2;
      me.gear = Math.min(me.gear, tops.length);
    };
    window.cmpStep = (kmh) => {
      for (let t = 0; t < 2; t++) { me.speed = kmh / 3.6; race.setPlayerInput(0, 0, 0.5, 0, 0, false, false); app.simulate(); }
      app.present(1 / 60, 0);
    };
  }, [W, H]);
  let index = 0;
  for (const speed of SPEEDS) {
    const at = (f) => (Array.isArray(speed) ? speed[0] + ((speed[1] - speed[0]) * f) / (FRAMES - 1) : speed);
    await page.evaluate(([kmh]) => { window.cmpPlace(kmh); for (let i = 0; i < 20; i++) window.cmpStep(kmh); }, [at(0)]);
    for (let f = 0; f < FRAMES; f++) {
      const b64 = await page.evaluate(async ([kmh]) => {
        const { app } = window.virage;
        window.cmpStep(kmh);
        await app.gpu.device.queue.onSubmittedWorkDone();
        const blob = await new Promise((resolve) => app.canvas.toBlob(resolve, 'image/jpeg', 0.94));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      }, [at(f)]);
      writeFileSync(`${tmp}/${name}-${String(index++).padStart(4, '0')}.jpg`, Buffer.from(b64, 'base64'));
    }
  }
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errors.length) console.log(name, 'ERRORS', errors.slice(0, 5).join('\n'));
  await close();
  console.log(name, 'recorded', index, 'images from', file);
}

const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const text = (state) => SPEEDS.map((speed, i) => `drawtext=fontfile=${font}:text='${state} - ${label(speed)}':x=24:y=18:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:enable='between(n,${i * FRAMES},${(i + 1) * FRAMES - 1})'`).join(',');
const chain = (input, state, name) => `[${input}:v]crop=${W}:${H - CROP_TOP}:0:${CROP_TOP},${text(state)}[${name}]`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', `${tmp}/before-%04d.jpg`, '-framerate', '60', '-i', `${tmp}/after-%04d.jpg`,
  '-filter_complex', `${chain(0, 'AVANT', 'a')};${chain(1, 'APRES', 'b')};[a][b]vstack=inputs=2[v]`, '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', `${root}/${out}`], { stdio: 'inherit' });
console.log('->', out, `(${SPEEDS.length * FRAMES} images: ${SPEEDS.map(label).join(' / ')}, ${FRAMES / 60} s each)`);
