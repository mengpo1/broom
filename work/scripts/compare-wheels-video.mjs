// Before / after video of the cockpit: front wheel rotation (and mirrors) at constant speeds and
// through a continuous acceleration. Two builds of the game play the same thing on a straight; the
// lower part of each picture is stacked, "before" above "after". With --only after, a single build
// is recorded (used to look at other display rates).
//
// node work/scripts/compare-wheels-video.mjs <before.html> <after.html> [out.mp4]
//      [--speeds 40,120,200,250,300,322] [--ramp 0:322:8] [--fps 60] [--only after] [--reuse-before]
// --speeds  constant speeds in km/h, 1.6 s each        --ramp  from:to:seconds, a linear acceleration
// --fps     images per second of the recording: the simulation always runs at 120 steps per second
// --reuse-before keeps the images of the first build from an earlier run and records only the second.
// --steady  the vibration of the cockpit is switched off (an option of the game): the tyre alone changes,
//           which is what the measurements need; the videos meant to be watched are recorded without it.
// A manifest (<out>.json) describes the segments for work/scripts/wheel-motion-check.py.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, root } from './lib-browser.mjs';

const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--') && !['--reuse-before', '--steady'].includes(all[i - 1])));
const option = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const reuseBefore = process.argv.includes('--reuse-before'), steady = process.argv.includes('--steady'), only = option('only', null);
const builds = { before: positional[0] || 'work/renders/sequence/index-pr2.html', after: positional[1] || 'index.html' };
const out = positional[2] || 'work/renders/comparison/wheels-before-after.mp4';
const fps = +option('fps', 60), W = 1280, H = 720, CROP_TOP = 300, SECONDS = 1.6;
const segments = option('speeds', '40,120,200,250,300,322').split(',').filter(Boolean).map((v) => ({ from: +v, to: +v, seconds: SECONDS, label: `${v} km/h` }));
const ramp = option('ramp', '0:322:8');
if (ramp && ramp !== 'none') { const [from, to, seconds] = ramp.split(':').map(Number); segments.push({ from, to, seconds, label: `${from} a ${to} km/h` }); }
for (const s of segments) s.frames = Math.round(s.seconds * fps);
const names = Object.keys(builds).filter((n) => !only || n === only);
const tmp = `${root}/work/renders/sequence/cmp-video-${fps}${steady ? '-steady' : ''}`;
if (!reuseBefore) rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

for (const name of names) {
  if (reuseBefore && name === 'before') continue;
  process.env.VIRAGE_HTML = builds[name];
  const { page, logs, close } = await openGame({ width: W, height: H, hash: 'manual=1&quality=high' });
  await page.evaluate(([W, H, fps, steady]) => {
    const { app, quickRace, debug } = window.virage;
    window.virage.input.enabled = false;
    if (steady) app.effects.cockpitShake = false;
    app.setCanvasSize(W, H);
    const race = quickRace({ circuit: 'kestrel-fields', opponents: 3, gridPosition: 3, autoDrive: false, rules: 'arcade', seed: 4 });
    let guard = 0;
    while ((race.phase !== 'racing' || race.time < 4) && guard++ < 6000) app.simulate();
    app.present(4, 0); app.present(4, 0);
    app.hud.visible = false;
    const track = race.track, me = race.playerCars[0];
    const need = Math.ceil(900 / track.ds); let run = 0, s0 = 0, best = 0;
    for (let i = 0; i < track.n * 2; i++) { const k = i % track.n; if (Math.abs(track.kappa[k]) < 1 / 2500) { run++; if (run > best) { best = run; s0 = ((i - run + 1) % track.n) * track.ds; } if (run >= need) break; } else run = 0; }
    window.cmpPlace = (kmh) => {
      const v = kmh / 3.6;
      if (debug && debug.placeCar) debug.placeCar(me, track, s0 + 40, 0.5);
      me.state = 1; me.ghostTimer = 0; me.speed = v;
    };
    let pending = 0;
    // one image: the simulation steps that fall in it (120 per second whatever the display rate), then the picture
    window.cmpStep = (kmh) => {
      const v = kmh / 3.6, tops = me.params.spec.gearTopSpeeds;
      pending += 120 / fps;
      const ticks = Math.floor(pending + 1e-9); pending -= ticks;
      for (let t = 0; t < ticks; t++) {
        me.speed = v; me.gear = 1; for (let g = 0; g < tops.length; g++) if (v >= tops[g] * 0.93) me.gear = Math.min(tops.length, g + 2);
        race.setPlayerInput(0, 0, 0.5, 0, 0, false, false); app.simulate();
      }
      app.present(1 / fps, 0);
    };
  }, [W, H, fps, steady]);
  let index = 0;
  for (const seg of segments) {
    const at = (f) => seg.from + ((seg.to - seg.from) * f) / Math.max(1, seg.frames - 1);
    await page.evaluate(([kmh]) => { window.cmpPlace(kmh); for (let i = 0; i < 20; i++) window.cmpStep(kmh); }, [at(0)]);
    for (let f = 0; f < seg.frames; f++) {
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
      writeFileSync(`${tmp}/${name}-${String(index++).padStart(5, '0')}.jpg`, Buffer.from(b64, 'base64'));
    }
  }
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errors.length) console.log(name, 'ERRORS', errors.slice(0, 5).join('\n'));
  await close();
  console.log(name, 'recorded', index, 'images from', builds[name]);
}

const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
let first = 0;
const spans = segments.map((s) => { const span = [first, first + s.frames - 1]; first += s.frames; return span; });
const text = (state) => segments.map((s, i) => `drawtext=fontfile=${font}:text='${state} - ${s.label}':x=24:y=18:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:enable='between(n,${spans[i][0]},${spans[i][1]})'`).join(',');
const chain = (input, state, name) => `[${input}:v]crop=${W}:${H - CROP_TOP}:0:${CROP_TOP},${text(state)}[${name}]`;
const encode = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', `${root}/${out}`];
if (names.length === 2) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${tmp}/before-%05d.jpg`, '-framerate', String(fps), '-i', `${tmp}/after-%05d.jpg`,
    '-filter_complex', `${chain(0, 'AVANT', 'a')};${chain(1, 'APRES', 'b')};[a][b]vstack=inputs=2[v]`, '-map', '[v]', ...encode], { stdio: 'inherit' });
} else {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${tmp}/${names[0]}-%05d.jpg`,
    '-filter_complex', `${chain(0, `${fps} images/s`, 'v')}`, '-map', '[v]', ...encode], { stdio: 'inherit' });
}
writeFileSync(`${root}/${out.replace(/\.mp4$/, '.json')}`, JSON.stringify({ video: out, fps, steady, halves: names, halfHeight: H - CROP_TOP, builds, segments: segments.map((s, i) => ({ label: s.label, fromKmh: s.from, toKmh: s.to, frames: s.frames, first: spans[i][0] })) }, null, 1));
console.log('->', out, `(${first} images at ${fps} images/s: ${segments.map((s) => s.label).join(' / ')})`);
