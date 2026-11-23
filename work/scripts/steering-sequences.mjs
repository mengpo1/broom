// Records the held-steering manoeuvres in the real game for the validated steering (a) and the
// experimental variants (b1, b2, b3): image by image at 60 images per second (two simulation steps
// per image), from the cockpit, with a caption showing what the steering is doing. The manoeuvres
// are those of the steering bench (src/core/steering-bench.js, the same a person plays with keys 5
// and 6 of index.html#steerlab=...): only the controls are scripted.
//   bend4, bend1          full lock held for 3 s from the entry of a bend of the bench (193 km/h at the
//                         speed the grip allows, radius 100 m; 129 km/h at 85 % of it, radius 72 m)
//   passage               the passage of the reference footage on the circuit fitted on it (the keys
//                         assumed from the hands, the pedals following the speed its display shows)
// Outputs (work/renders/steering by default): one clip per manoeuvre and variant in clips/ (not
// kept in the repository), the telemetry of every run (telemetry-<variant>.json), and, assembled
// by ffmpeg: variant-<name>.mp4 (the three manoeuvres of a variant), compare-<manoeuvre>.mp4 (the
// four variants side by side, same instant), steering-phases.jpg (the cockpit at the stop of phase 1
// and with phase 2 complete, for every variant).
// node work/scripts/steering-sequences.mjs [bend4,bend1,passage|all] [--variants a,b1,b2,b3] [--width 960] [--height 540] [--out work/renders/steering] [--assemble-only]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const width = +arg('width', 960), height = +arg('height', 540), outDir = arg('out', 'work/renders/steering');
const wanted = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'all').split(',');
const variants = arg('variants', 'a,b1,b2,b3').split(',');
const assembleOnly = process.argv.includes('--assemble-only');
mkdirSync(`${root}/${outDir}/clips`, { recursive: true });

const MANOEUVRES = {
  bend4: { demo: { bend: 4, share: 1, seconds: 3 }, tail: 1.2 },
  bend1: { demo: { bend: 1, share: 0.85, seconds: 3 }, tail: 1.2 },
  passage: { demo: { passage: true }, tail: 0.4 },
};
const LABELS = { a: 'A · conduite validée', b1: 'B1 · EXPÉRIMENTAL — braquage en deux temps', b2: 'B2 · EXPÉRIMENTAL — surbraquage, les pneus frottent', b3: 'B3 · EXPÉRIMENTAL — surbraquage et glissade' };

/** Runs in the page: starts the manoeuvre on the bench (nobody drives after it) and defines the per-image step. */
const setup = ([demo, variant, width, height, label]) => {
  const { app, CAMERA, createSteeringBench } = window.virage;
  app.setCanvasSize(width, height);
  window.virage.input.enabled = false;            // no keyboard here: the bench supplies the controls
  const bench = createSteeringBench();
  bench.start({ variant, demo, handOver: false });
  app.views[0].camera = CAMERA.COCKPIT;
  app.present(4, 0); app.present(4, 0);          // let anything left of the start run out
  const run = bench.lastRun, track = bench.race.track;
  let scene = `Passage de la vidéo de référence · appuis supposés d'après les mains · entrée à ${Math.round(run.v0 * 3.6)} km/h, vitesse de la vidéo suivie`;
  if (!demo.passage) {
    const straighter = 1 / 1500; let n = 0, from = -1, to = -1, sum = 0;
    for (let i = 0; i < track.n && to < 0;) {
      if (Math.abs(track.kappa[i]) <= straighter) { i++; continue; }
      let j = i, s = 0; while (j < track.n && Math.abs(track.kappa[j]) > straighter) { s += track.kappa[j]; j++; }
      if (++n === demo.bend) { from = i; to = j; sum = s; }
      i = j;
    }
    const kappa = sum / (to - from);
    scene = `Virage ${demo.bend} à ${kappa > 0 ? 'droite' : 'gauche'} · rayon ${Math.round(1 / Math.abs(kappa))} m · entrée à ${Math.round(run.v0 * 3.6)} km/h · touche maintenue ${demo.seconds} s`;
  }
  const cap = document.createElement('canvas'); cap.width = width; cap.height = height;
  const ctx = cap.getContext('2d'), fr = (v, d) => v.toFixed(d).replace('.', ',');
  window.captureFrame = async () => {
    await app.gpu.device.queue.onSubmittedWorkDone();
    const f = bench.figures(), u = width / 960;
    const x0 = 248 * u, w = 464 * u, y0 = 6 * u, h = 62 * u;
    ctx.fillStyle = 'rgba(244,239,226,0.94)'; ctx.strokeStyle = '#16161f'; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16161f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${13 * u}px Inter, DejaVu Sans, sans-serif`; ctx.fillText(label, x0 + w / 2, y0 + 12 * u, w - 10 * u);
    ctx.font = `500 ${10.5 * u}px Inter, DejaVu Sans, sans-serif`; ctx.fillText(scene, x0 + w / 2, y0 + 28 * u, w - 10 * u);
    const key = f.key > 0 ? 'TOUCHE DROITE ▶' : f.key < 0 ? '◀ TOUCHE GAUCHE' : 'aucune touche';
    const time = f.time !== null && f.time >= 0 ? `t = ${fr(f.time, 2)} s` : 'approche';
    ctx.font = `600 ${11 * u}px Inter, DejaVu Sans, sans-serif`;
    ctx.fillStyle = f.key ? '#b3261e' : '#16161f';
    ctx.fillText(`${time} · ${key}`, x0 + w / 2, y0 + 42 * u, w - 10 * u);
    ctx.fillStyle = '#16161f'; ctx.font = `500 ${10.5 * u}px Inter, DejaVu Sans, sans-serif`;
    ctx.fillText(`braquage ×${fr(Math.abs(f.applied), 2)} · phase 2 : ${Math.round(f.phase2 * 100)} % · glissade ${fr(f.slideDeg, 1)}° · frottement ${fr(f.slip, 2)} · ${Math.round(f.kmh)} km/h`, x0 + w / 2, y0 + 55 * u, w - 10 * u);
    const blob = await new Promise((resolve) => cap.toBlob(resolve, 'image/jpeg', 0.92));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  window.scenarioStep = () => {
    app.simulate(); app.simulate();
    app.present(1 / 60, 0);
    ctx.drawImage(app.canvas, 0, 0, width, height);      // (in the same task as the present: afterwards the picture of a WebGPU canvas can no longer be copied)
    const me = bench.me;
    return { playing: !!bench.run, time: run.time, state: me.state, kmh: +(me.speed * 3.6).toFixed(1), d: +me.d.toFixed(2), surface: me.surface };
  };
  window.runReport = () => ({ marks: run.marks, summary: run.summary(), samples: run.samples });
  return { scene, circuit: track.id, kmh: +(run.v0 * 3.6).toFixed(1), keys: run.keys, speeds: run.speeds };
};

const clip = (name, variant) => `${root}/${outDir}/clips/${name}-${variant}.mp4`;
if (!assembleOnly) {
  const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=medium' });
  for (const variant of variants) {
    const file = `${root}/${outDir}/telemetry-${variant}.json`;
    const telemetry = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { variant, label: LABELS[variant], fps: 60, sampleRateHz: 60, manoeuvres: {} };
    for (const name of Object.keys(MANOEUVRES)) {
      if (!wanted.includes('all') && !wanted.includes(name)) continue;
      const m = MANOEUVRES[name];
      const info = await page.evaluate(setup, [m.demo, variant, width, height, LABELS[variant]]);
      const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', clip(name, variant)], { stdio: ['pipe', 'inherit', 'inherit'] });
      let frames = 0, tail = -1, last = null;
      const events = [];
      for (; frames < 1500; frames++) {
        const r = await page.evaluate(async () => { const info = window.scenarioStep(); return { info, jpeg: await window.captureFrame() }; });
        if (last && r.info.state !== last.state) events.push(`state ${last.state} -> ${r.info.state} at ${r.info.time.toFixed(2)} s`);
        if (last && r.info.surface !== last.surface) events.push(`surface ${last.surface} -> ${r.info.surface} at ${r.info.time.toFixed(2)} s`);
        last = r.info;
        if (!ffmpeg.stdin.write(Buffer.from(r.jpeg, 'base64'))) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
        if (!r.info.playing && tail < 0) tail = frames + Math.round(m.tail * 60);
        if (tail >= 0 && frames >= tail) { frames++; break; }
      }
      ffmpeg.stdin.end();
      await new Promise((resolve) => ffmpeg.on('close', resolve));
      const report = await page.evaluate(() => window.runReport());
      telemetry.manoeuvres[name] = { ...info, frames, marks: report.marks, summary: report.summary, events, samples: report.samples };
      console.log(`${name} ${variant}: ${frames} images, ${info.scene}\n   marks ${JSON.stringify(report.marks)}\n   ${JSON.stringify(report.summary)}${events.length ? `\n   ${events.join('; ')}` : ''}`);
    }
    writeFileSync(file, JSON.stringify(telemetry));
  }
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errors.length) console.log('ERRORS\n' + errors.slice(0, 10).join('\n'));
  await close();
}

// ---- assembly
const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const names = Object.keys(MANOEUVRES).filter((name) => variants.every((v) => existsSync(clip(name, v))));
for (const variant of variants) {
  const mine = Object.keys(MANOEUVRES).filter((name) => existsSync(clip(name, variant)));
  if (mine.length < Object.keys(MANOEUVRES).length) continue;
  const inputs = mine.flatMap((name) => ['-i', clip(name, variant)]);
  run([...inputs, '-filter_complex', `${mine.map((_, i) => `[${i}:v]`).join('')}concat=n=${mine.length}:v=1:a=0[v]`, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', `${root}/${outDir}/variant-${variant}.mp4`]);
  console.log(`-> ${outDir}/variant-${variant}.mp4`);
}
if (variants.length === 4) {
  for (const name of names) {
    // the four variants side by side, same instant (the shorter clips hold their last image)
    const inputs = variants.flatMap((v) => ['-i', clip(name, v)]);
    run([...inputs, '-filter_complex', `${variants.map((_, i) => `[${i}:v]tpad=stop_mode=clone:stop_duration=3[p${i}]`).join(';')};[p0][p1][p2][p3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0:shortest=1,scale=1600:900[v]`,
      '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', `${root}/${outDir}/compare-${name}.mp4`]);
    console.log(`-> ${outDir}/compare-${name}.mp4`);
  }
}

// ---- the cockpit in phase 1 and in phase 2: two images of the manoeuvre in bend 4 for every variant
// (0.30 s after the key: the stop of phase 1, before any phase 2; 2.00 s after: phase 2 complete)
if (variants.length === 4 && variants.every((v) => existsSync(clip('bend4', v)))) {
  const lead = (v) => { const t = JSON.parse(readFileSync(`${root}/${outDir}/telemetry-${v}.json`, 'utf8')).manoeuvres.bend4; return t.frames - Math.round((3 + 1 + MANOEUVRES.bend4.tail) * 60) - 1; };
  const inputs = [], parts = [];
  let n = 0;
  for (const after of [0.3, 2]) for (const v of variants) { inputs.push('-ss', ((lead(v) + Math.round(after * 60)) / 60).toFixed(3), '-i', clip('bend4', v)); parts.push(`[${n++}:v]`); }
  run([...inputs, '-filter_complex', `${parts.join('')}xstack=inputs=8:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0|w0_h0|w0+w1_h0|w0+w1+w2_h0[v]`, '-map', '[v]', '-frames:v', '1', '-q:v', '3', `${root}/${outDir}/steering-phases.jpg`]);
  console.log(`-> ${outDir}/steering-phases.jpg (top: 0.30 s after the key; bottom: 2.00 s after)`);
}
