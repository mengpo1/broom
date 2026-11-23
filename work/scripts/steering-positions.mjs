// Every position the cockpit can show for the steering: the request of the driver from 0 to full
// lock in quarters (what a held key goes through in 0.22 s), at two speeds. For each picture: which
// of the five drawings of the front wheels is used, the rotation of the steering wheel, and the
// angle of the front wheels really used by the simulation at that speed (arcade profile).
// The steering is DRAWN at each position, the car going straight on: this is a catalogue of
// drawings, not a recording (the behaviour over time is measured by steering-study.mjs).
// node work/scripts/steering-positions.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, root } from './lib-browser.mjs';
import { BASE_CAR_SPEC as SPEC, DRIVING_PROFILES, deriveCarParams, gripLimit } from '../../src/vehicles/car-spec.js';
import { steeringLock } from '../../src/physics/car-physics.js';
import { steerFrame } from '../../src/rendering/compositing/cockpit-layer.js';
import { STEER_FRAMES } from '../../src/art/cockpits/cockpit-art.js';

const outDir = process.argv[2] || 'work/renders/steering';
const W = 1280, H = 720, REQUESTS = [0, 0.25, 0.5, 0.75, 1], SPEEDS = [60, 250];
mkdirSync(`${root}/${outDir}/frames`, { recursive: true });
const params = deriveCarParams(SPEC, null, DRIVING_PROFILES.arcade, null);
const drawnLock = (v) => SPEC.steerLock * (0.45 + 0.55 / (1 + Math.abs(v) / 28));
const { page, logs, close } = await openGame({ width: W, height: H, hash: 'manual=1&quality=high' });
await page.evaluate(async ([W, H]) => {
  const { app, quickRace, debug } = window.virage;
  window.virage.input.enabled = false;
  app.setCanvasSize(W, H);
  const race = quickRace({ circuit: 'kestrel-fields', opponents: 3, gridPosition: 3, autoDrive: false, rules: 'arcade', seed: 4 });
  let guard = 0;
  while ((race.phase !== 'racing' || race.time < 4) && guard++ < 6000) app.simulate();
  app.present(4, 0); await app.gpu.device.queue.onSubmittedWorkDone();
  app.hud.visible = false;
  const track = race.track, me = race.playerCars[0], others = race.cars.filter((c) => !c.isHuman);
  const need = Math.ceil(700 / track.ds); let run = 0, s0 = 0;
  for (let i = 0; i < track.n * 2; i++) { const k = i % track.n; if (Math.abs(track.kappa[k]) < 1 / 2500) { run++; if (run >= need) { s0 = ((i - need + 1) % track.n) * track.ds; break; } } else run = 0; }
  window.steerShot = async (kmh, request) => {
    debug.placeCar(me, track, s0 + 40, 0.5); me.state = 1; me.ghostTimer = 0;
    others.forEach((c, k) => { debug.placeCar(c, track, s0 + 400 + k * 40, 0); c.state = 1; c.speed = 0; });
    for (let i = 0; i < 6; i++) {
      me.speed = kmh / 3.6; me.gear = kmh > 200 ? 6 : 3;
      race.setPlayerInput(0, 0, 0.5, 0, 0, false, false); app.simulate(); app.simulate();
      me.speed = kmh / 3.6;
      const wheel = me.steer; me.steer = -request;            // (a request to the left)
      app.present(1 / 60, 0); me.steer = wheel;
      await app.gpu.device.queue.onSubmittedWorkDone();
    }
  };
}, [W, H]);
const shots = [];
for (const kmh of SPEEDS) {
  for (const request of REQUESTS) {
    await page.evaluate(async ([kmh, request]) => { await window.steerShot(kmh, request); }, [kmh, request]);
    const file = `${outDir}/frames/steer-${kmh}-${Math.round(request * 100)}.png`;
    await page.screenshot({ path: `${root}/${file}` });
    const v = kmh / 3.6, lock = steeringLock(params, v, gripLimit(params, v, 1, 1)), mid = (STEER_FRAMES - 1) / 2;
    shots.push({ kmh, request, file, secondsAfterTheKey: +(request / SPEC.steerRate).toFixed(3), drawing: Math.abs(steerFrame(request, drawnLock(v)) - mid), drawingsEachSide: mid,
      steeringWheelDeg: +(request * 0.95 * 180 / Math.PI).toFixed(1), wheelAngleOfTheSimulationDeg: +(request * lock * 180 / Math.PI).toFixed(2), wheelAngleDrawnDeg: +(Math.min(request * drawnLock(v), 0.26) * 180 / Math.PI).toFixed(1) });
    console.log(`${kmh} km/h, request ${request}: drawing ${shots.at(-1).drawing}/${mid}, steering wheel ${shots.at(-1).steeringWheelDeg} deg, simulation ${shots.at(-1).wheelAngleOfTheSimulationDeg} deg`);
  }
}
const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (errors.length) console.log('ERRORS', errors.slice(0, 5).join('\n'));
await close();
writeFileSync(`${root}/${outDir}/steering-positions.json`, JSON.stringify({ width: W, height: H, profile: 'arcade', shots }, null, 1));
execFileSync('python3', ['-c', `
import json, os
from PIL import Image, ImageDraw, ImageFont
root, out = ${JSON.stringify(root)}, ${JSON.stringify(outDir)}
data = json.load(open(os.path.join(root, out, 'steering-positions.json')))
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17); small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
cw, ch, band = 512, 216, 64
speeds = sorted(set(s['kmh'] for s in data['shots'])); requests = sorted(set(s['request'] for s in data['shots']))
sheet = Image.new('RGB', (cw * len(requests), (ch + band) * len(speeds)), (244, 239, 226)); d = ImageDraw.Draw(sheet)
for s in data['shots']:
    c, r = requests.index(s['request']), speeds.index(s['kmh'])
    x, y = c * cw, r * (ch + band)
    img = Image.open(os.path.join(root, s['file'])).convert('RGB').crop((0, 180, 1280, 720)).resize((cw, ch), Image.LANCZOS)
    sheet.paste(img, (x, y + band))
    d.text((x + 6, y + 4), f"{s['kmh']} km/h - demande {int(s['request'] * 100)} % ({s['secondsAfterTheKey']:.2f} s après l'appui)", fill=(22, 22, 31), font=font)
    d.text((x + 6, y + 27), f"dessin des roues : cran {s['drawing']} sur {int(s['drawingsEachSide'])} ; volant tourné de {s['steeringWheelDeg']:.0f}°", fill=(22, 22, 31), font=small)
    d.text((x + 6, y + 43), f"angle des roues : dessiné {s['wheelAngleDrawnDeg']:.1f}°, utilisé par la simulation {s['wheelAngleOfTheSimulationDeg']:.2f}°", fill=(22, 22, 31), font=small)
    if c: d.line((x, y, x, y + ch + band), fill=(22, 22, 31), width=2)
sheet.save(os.path.join(root, out, 'steering-positions.jpg'), quality=90)
print('sheet written:', os.path.join(out, 'steering-positions.jpg'), sheet.size)
`], { stdio: 'inherit' });
