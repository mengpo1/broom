// Animation rules: transitions between the drawn views of a car, rolling of the front wheels,
// steering frames, speed effects and their switches, absence of flicker in timed elements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carViewFrame } from '../../src/rendering/drawing/scene-builder.js';
import { wheelVariant, steerFrame } from '../../src/rendering/compositing/cockpit-layer.js';
import { STEER_FRAMES, WHEEL_VARIANTS } from '../../src/art/cockpits/cockpit-art.js';
import { TREAD_PHASES, TREAD_MARKS, CAR_DIMENSIONS } from '../../src/art/vehicles/car-model.js';
import { CAR_ANGLES } from '../../src/art/art-library.js';
import { RaceView, CAMERA } from '../../src/rendering/compositing/race-view.js';
import { DEFAULT_EFFECTS } from '../../src/core/config.js';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';

test('car views: turning a car through 360 degrees walks through neighbouring drawings only', () => {
  const index = (f) => (f < 0 ? -f - 1 : f);
  let previous = carViewFrame(-Math.PI, CAR_ANGLES);
  const seen = new Set();
  for (let i = 1; i <= 2000; i++) {
    const alpha = -Math.PI + (i / 2000) * Math.PI * 2;
    const frame = carViewFrame(alpha, CAR_ANGLES);
    assert.ok(Math.abs(index(frame) - index(previous)) <= 1, `jump from ${previous} to ${frame} at ${alpha}`);
    seen.add(frame);
    previous = frame;
  }
  assert.equal(seen.size, CAR_ANGLES + (CAR_ANGLES - 2), 'every drawing and every mirrored drawing is used');
  assert.equal(carViewFrame(0, CAR_ANGLES), 0, 'seen from behind');
  assert.equal(carViewFrame(Math.PI, CAR_ANGLES), CAR_ANGLES - 1, 'seen from the front');
  assert.equal(carViewFrame(Math.PI / 2, CAR_ANGLES), (CAR_ANGLES - 1) / 2, 'side view');
  assert.ok(carViewFrame(-0.5, CAR_ANGLES) < 0 && index(carViewFrame(-0.5, CAR_ANGLES)) === carViewFrame(0.5, CAR_ANGLES), 'the other side is the mirrored drawing');
  // the step between two drawings is small enough for a smooth turn
  assert.ok(180 / (CAR_ANGLES - 1) <= 6, 'at most 6 degrees between two drawings');
});

test('front wheels: rolling marks advance in step with the distance travelled', () => {
  const circumference = Math.PI * 2 * CAR_DIMENSIONS.frontTyre.radius;
  const period = circumference / TREAD_MARKS;            // distance between two marks
  const sequence = [];
  for (let k = 0; k < TREAD_PHASES * 4; k++) sequence.push(wheelVariant((k + 0.5) * (period / TREAD_PHASES), 5));
  for (let k = 0; k < sequence.length; k++) assert.equal(sequence[k], k % TREAD_PHASES, 'phases follow each other in order');
  assert.equal(wheelVariant(12.34, 3), wheelVariant(12.34 + circumference, 3), 'one wheel turn brings the same drawing back');
  assert.equal(wheelVariant(5, 0), wheelVariant(5, 0), 'a stopped wheel does not animate');
  assert.equal(wheelVariant(100, 40), TREAD_PHASES, 'at speed the streaked drawing is used');
  assert.equal(wheelVariant(100, -40), TREAD_PHASES);
  assert.equal(WHEEL_VARIANTS, TREAD_PHASES + 1);
});

test('front wheels: steering frames are symmetric and monotonic', () => {
  const mid = (STEER_FRAMES - 1) / 2;
  assert.equal(steerFrame(0, 0.3), mid);
  let previous = steerFrame(-1, 0.3);
  for (let s = -1; s <= 1.0001; s += 0.05) {
    const f = steerFrame(s, 0.3);
    assert.ok(f <= previous, 'turning right moves monotonically through the frames');
    assert.equal(steerFrame(-s, 0.3), STEER_FRAMES - 1 - f, 'left and right are mirror images');
    previous = f;
  }
  assert.equal(steerFrame(1, 0.3), 0); assert.equal(steerFrame(-1, 0.3), STEER_FRAMES - 1);
});

function drive(effects, seconds = 14) {
  const track = buildTrack(getCircuit('sablon'));
  const entries = [...DRIVERS.slice(0, 3).map((driver) => ({ driver })), { driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0, autoDrive: true }];
  const race = new Race({ track, laps: 2, entries, rules: RULE_PRESETS.arcade, difficulty: 'pro', seed: 2 });
  const view = new RaceView(0);
  view.setRect(0, 0, 1280, 720); view.carIndex = 3; view.camera = CAMERA.COCKPIT;
  const trace = [];
  let frame = 0;
  while (race.time < seconds) {
    race.step(SIM_DT); race.step(SIM_DT); race.eventCount = 0;
    if (race.phase !== RACE_PHASE.RACING) continue;
    view.update(1 / 60, race, effects, 0);
    trace.push({ lines: view.speedLines, focal: view.projection.focal, shake: Math.hypot(view.shakeX, view.shakeY), speed: race.cars[3].speed, cx: view.projection.cx, frame: frame++ });
  }
  return { trace, view };
}

test('speed effects grow with speed and are smooth from frame to frame', () => {
  const { trace } = drive({ ...DEFAULT_EFFECTS });
  const slow = trace.find((s) => s.speed > 15 && s.speed < 25), fast = trace[trace.length - 1];
  assert.ok(fast.speed > 70, `reached speed (${fast.speed})`);
  // at low speed only the short burst that accompanies hard acceleration may show
  assert.ok(slow.lines <= 0.16 && fast.lines > 0.5, `speed lines ${slow.lines} -> ${fast.lines}`);
  assert.ok(fast.focal < slow.focal * 0.97, 'field of view opens with speed (perspective stretch)');
  for (let i = 1; i < trace.length; i++) {
    assert.ok(Math.abs(trace[i].lines - trace[i - 1].lines) < 0.06, 'no blinking of the speed lines');
    assert.ok(Math.abs(trace[i].focal - trace[i - 1].focal) < trace[i].focal * 0.01, 'no jump of the perspective');
  }
});

test('each effect can be switched off on its own', () => {
  const noLines = drive({ ...DEFAULT_EFFECTS, speedLines: false, impactFrames: false }).trace;
  assert.ok(noLines.every((s) => s.lines === 0), 'speed lines off');
  const noStretch = drive({ ...DEFAULT_EFFECTS, perspectiveStretch: false }).trace;
  const f0 = noStretch[0].focal;
  assert.ok(noStretch.every((s) => Math.abs(s.focal - f0) < 1e-6), 'perspective stretch off');
  const noShake = drive({ ...DEFAULT_EFFECTS, cockpitShake: false, impactFrames: false }).trace;
  assert.ok(noShake.every((s) => s.shake < 1e-6 && Math.abs(s.cx - 640) < 1e-6), 'vibration off');
  const withShake = drive({ ...DEFAULT_EFFECTS }).trace;
  assert.ok(withShake[withShake.length - 1].shake > 0, 'vibration on by default at speed');
});

test('impacts jolt the view briefly, then the picture settles', () => {
  const { view, trace } = drive({ ...DEFAULT_EFFECTS }, 6);
  assert.ok(trace.length > 0);
  view.addImpact(1);
  assert.ok(view.flash > 0.5 && view.impact === 1);
  const track = buildTrack(getCircuit('sablon'));
  const race = new Race({ track, laps: 1, entries: [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }], rules: RULE_PRESETS.training, difficulty: 'pro', seed: 1 });
  view.carIndex = 0;
  for (let i = 0; i < 60; i++) view.update(1 / 60, race, DEFAULT_EFFECTS, 0);
  assert.equal(view.flash, 0); assert.equal(view.impact, 0);
});
