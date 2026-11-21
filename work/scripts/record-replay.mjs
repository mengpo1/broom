// Records the demonstration video race-replay.mp4: 60 s, 2560x1440, 60 frames per second.
// The race is replayed deterministically frame by frame (two simulation ticks per frame); each
// frame is read back from the WebGPU canvas and piped to ffmpeg, so the result does not depend on
// the speed of the machine. The soundtrack is rendered by the game's own audio engine on an
// OfflineAudioContext driven by the same frames, then muxed.
//
// node work/scripts/record-replay.mjs [--width 2560] [--height 1440] [--seconds 60] [--from 0] [--to 3600]
//                                     [--out race-replay.mp4] [--segment work/renders/sequence/seg.mp4] [--audio-only] [--no-audio]
// Long recordings can be split with --from/--to into segments, then joined with
//   --join a.mp4,b.mp4 --audio work/renders/sequence/audio.wav --bitrate 5500k --out race-replay.mp4
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const flag = (name) => process.argv.includes(`--${name}`);
const width = +arg('width', 2560), height = +arg('height', 1440), fps = 60;
const seconds = +arg('seconds', 60), total = Math.round(seconds * fps);
const from = +arg('from', 0), to = Math.min(total, +arg('to', total));
const out = arg('out', 'race-replay.mp4');
mkdirSync(`${root}/work/renders/sequence`, { recursive: true });

if (arg('join', '')) {
  const parts = arg('join', '').split(',');
  const list = `${root}/work/renders/sequence/concat.txt`;
  writeFileSync(list, parts.map((p) => `file '${root}/${p}'`).join('\n'));
  const audio = arg('audio', '');
  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  // --bitrate 5500k re-encodes the joined picture at that rate (the segments are near-lossless and
  // far too heavy for a repository); without it the segments are copied as they are
  const bitrate = arg('bitrate', '');
  const video = bitrate ? ['-c:v', 'libx264', '-preset', 'slow', '-b:v', bitrate, '-maxrate', `${Math.round(parseFloat(bitrate) * 1.6)}k`, '-bufsize', `${Math.round(parseFloat(bitrate) * 3)}k`, '-pix_fmt', 'yuv420p', '-r', '60'] : ['-c:v', 'copy'];
  if (audio && existsSync(`${root}/${audio}`)) args.push('-i', `${root}/${audio}`, ...video, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  else args.push(...video);
  args.push('-movflags', '+faststart', `${root}/${out}`);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log('joined', parts.length, 'segments ->', out);
  process.exit(0);
}

/** Runs inside the page: prepares the scripted race and returns nothing; `window.replayStep(i)` advances one frame. */
const setup = ([width, height]) => {
  const { app, quickRace, CAMERA } = window.virage;
  app.splitLayout = 'horizontal';
  app.setCanvasSize(width, height);
  const race = quickRace({ circuit: 'hazelbrook', opponents: 15, gridPosition: 9, seed: 7 });
  const me = race.playerCars[0];
  const view = app.views[0];
  // start a little before the lights go out
  let guard = 0;
  while (race.lights < 2 && guard++ < 2000) app.simulate();
  app.skipRender = true; app.present(0.01, 0); app.skipRender = false;
  // camera script (seconds): cockpit, then exterior views, back to the cockpit
  const cuts = [[0, CAMERA.COCKPIT], [33, CAMERA.CHASE], [40, CAMERA.FRONT], [45.5, CAMERA.TRACKSIDE], [50, CAMERA.COCKPIT]];
  window.replayStep = (frame) => {
    const t = frame / 60;
    let camera = CAMERA.COCKPIT;
    for (const [at, cam] of cuts) if (t >= at) camera = cam;
    if (view.camera !== camera) { view.camera = camera; view.yaw = 0; view.tracksideTimer = -99; }
    app.hud.visible = camera === CAMERA.COCKPIT || camera === CAMERA.CHASE;
    app.simulate(); app.simulate();
    app.present(1 / 60, 0);
    return me.speed;
  };
  return { cars: race.cars.length, lights: race.lights };
};

const { page, logs, close } = await openGame({ width, height, hash: 'manual=1&quality=medium' });
console.log('setup', JSON.stringify(await page.evaluate(setup, [width, height])));

if (!flag('audio-only')) {
  const segment = arg('segment', from === 0 && to === total ? 'work/renders/sequence/video.mp4' : `work/renders/sequence/seg-${String(from).padStart(4, '0')}.mp4`);
  // skip (without drawing) the frames before this segment so that the state is identical
  if (from > 0) await page.evaluate(async (n) => { const { app } = window.virage; app.skipRender = true; for (let i = 0; i < n; i++) window.replayStep(i); app.skipRender = false; }, from);
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', `${root}/${segment}`], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let frame = from; frame < to; frame++) {
    const b64 = await page.evaluate(async (frame) => {
      const { app } = window.virage;
      window.replayStep(frame);
      // read the canvas back in the same task as the draw (before the frame is presented)
      const blob = await new Promise((resolve) => app.canvas.toBlob(resolve, 'image/jpeg', 0.95));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    }, frame);
    if (!ffmpeg.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    if ((frame - from) % 60 === 59) console.log(`frame ${frame + 1}/${to} (${(((Date.now() - t0) / 1000) / (frame - from + 1)).toFixed(2)} s/frame)`);
  }
  ffmpeg.stdin.end();
  await new Promise((resolve) => ffmpeg.on('close', resolve));
  console.log('video segment written:', segment);
} else {
  // soundtrack: same frames, no drawing, the game's audio engine rendering offline
  const wav = await page.evaluate(async ([total]) => {
    const v = window.virage, { app } = v;
    const RATE = 48000;
    const context = new OfflineAudioContext(2, Math.round((total / 60) * RATE), RATE);
    const audio = new v.audio.constructor(v.storage.data.settings.audio, context);
    await audio.resume();
    audio.setScene('race');
    app.audio = audio;
    app.skipRender = true;
    for (let frame = 0; frame < total; frame++) context.suspend(frame / 60).then(() => { window.replayStep(frame); context.resume(); });
    const buffer = await context.startRendering();
    const n = buffer.length, left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    const pcm = new Int16Array(n * 2);
    let peak = 0;
    for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i])); pcm[i * 2] = Math.max(-1, Math.min(1, left[i])) * 32767; pcm[i * 2 + 1] = Math.max(-1, Math.min(1, right[i])) * 32767; }
    const bytes = new Uint8Array(pcm.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { data: btoa(bin), rate: RATE, peak };
  }, [total]);
  const pcm = Buffer.from(wav.data, 'base64');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(wav.rate, 24); header.writeUInt32LE(wav.rate * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  writeFileSync(`${root}/work/renders/sequence/audio.wav`, Buffer.concat([header, pcm]));
  console.log('soundtrack written: work/renders/sequence/audio.wav, peak', wav.peak.toFixed(3));
}
const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
await close();
