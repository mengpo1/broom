// Animation rules: transitions between the drawn views of a car, rolling of the front wheels,
// steering frames, speed effects and their switches, absence of flicker in timed elements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carViewFrame } from '../../src/rendering/drawing/scene-builder.js';
import { wheelVariant, rollingVariant, streakVariant, streakBlend, steerFrame, streakCyclesPerMetre, advanceStreak, WHEEL_SYNC_SPEED, WHEEL_BLEND_SPEED } from '../../src/rendering/compositing/cockpit-layer.js';
import { STEER_FRAMES, WHEEL_VARIANTS, MIRROR, COCKPIT_REF_FOCAL } from '../../src/art/cockpits/cockpit-art.js';
import { TREAD_PHASES, TREAD_MARKS, CAR_DIMENSIONS, STREAK_PHASES, STREAK_BANDS, MIRROR_MOUNT, buildCarModel, buildFrontWheelModel } from '../../src/art/vehicles/car-model.js';
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
  assert.ok(180 / (CAR_ANGLES - 1) <= 7.5, 'at most 7.5 degrees between two drawings');
});

test('front wheels: rolling marks advance in step with the distance travelled', () => {
  const circumference = Math.PI * 2 * CAR_DIMENSIONS.frontTyre.radius;
  const period = circumference / TREAD_MARKS;            // distance between two marks
  const sequence = [];
  for (let k = 0; k < TREAD_PHASES * 4; k++) sequence.push(wheelVariant((k + 0.5) * (period / TREAD_PHASES), 3));
  for (let k = 0; k < sequence.length; k++) assert.equal(sequence[k], k % TREAD_PHASES, 'phases follow each other in order');
  assert.equal(wheelVariant(12.34, 3), wheelVariant(12.34 + circumference, 3), 'one wheel turn brings the same drawing back');
  assert.equal(wheelVariant(5, 0), wheelVariant(5, 0), 'a stopped wheel does not animate');
  assert.equal(wheelVariant(100, 40), TREAD_PHASES, 'at speed the streaked drawing is used');
  assert.equal(wheelVariant(100, -40), TREAD_PHASES);
  assert.equal(WHEEL_VARIANTS, TREAD_PHASES + STREAK_PHASES);
});

test('front wheels at speed: the streaks cycle forward with the distance travelled, faster with speed, the same at any display rate', () => {
  // exact synchronisation is only possible while a mark moves by less than one drawn phase per image (60 images per second)
  const phaseAngle = (Math.PI * 2) / TREAD_MARKS / TREAD_PHASES;
  assert.ok((WHEEL_SYNC_SPEED / CAR_DIMENSIONS.frontTyre.radius) / 60 <= phaseAngle * 1.001, 'marks never skip a phase below the synchronisation speed');
  // above it: every speed shows the three streak drawings in order, never backwards, never frozen
  let previousRate = 0;
  for (const kmh of [20, 60, 120, 200, 300]) {
    const v = kmh / 3.6, rate = streakCyclesPerMetre(v) * v;          // pattern cycles per second
    assert.ok(rate > previousRate, `the cycling rate grows with speed (${kmh} km/h: ${rate.toFixed(2)} per second)`);
    assert.ok(rate >= 6 && rate <= 10, 'between 6 and 10 cycles per second: a new drawing every two or three pictures, and readable from 30 images per second up');
    previousRate = rate;
    for (const fps of [30, 60, 144]) {
      let turn = 0, odometer = 0, last = wheelVariant(0, v, 0), changes = 0;
      for (let i = 0; i < fps; i++) {
        odometer += v / fps; turn = advanceStreak(turn, v / fps, v);
        const now = wheelVariant(odometer, v, turn);
        assert.ok(now >= TREAD_PHASES && now < WHEEL_VARIANTS);
        if (now !== last) { assert.equal(now - TREAD_PHASES, (last - TREAD_PHASES + 1) % STREAK_PHASES, `phases follow each other forward (${kmh} km/h, ${fps} images per second)`); changes++; }
        last = now;
      }
      // after one second the pattern has turned by the same amount whatever the display rate
      assert.ok(Math.abs(changes - rate * STREAK_PHASES) <= 1.01, `${kmh} km/h at ${fps} images per second: ${changes} phase changes for ${(rate * STREAK_PHASES).toFixed(1)} expected`);
    }
  }
  // reversing turns the pattern the other way; standing still leaves it where it is
  assert.ok(advanceStreak(0.5, -0.2, -8) < 0.5 && advanceStreak(0.5, 0, 0) === 0.5);
});

test('front wheels: the marks fade into the streaks between two speeds, without a jump from one drawing to the other', () => {
  assert.equal(streakBlend(0), 0); assert.equal(streakBlend(WHEEL_BLEND_SPEED), 0);
  assert.equal(streakBlend(WHEEL_SYNC_SPEED), 1); assert.equal(streakBlend(90), 1); assert.equal(streakBlend(-90), 1);
  assert.ok(WHEEL_BLEND_SPEED < WHEEL_SYNC_SPEED && WHEEL_BLEND_SPEED > 1.5, 'the marks alone are kept for the lowest speeds');
  let previous = 0;
  for (let v = 0; v <= 6; v += 0.05) {
    const b = streakBlend(v);
    assert.ok(b >= previous && b - previous < 0.03, `smooth and rising (${v.toFixed(2)} m/s)`);
    previous = b;
    // the marks are still exactly synchronised wherever they are visible, and the two drawings are of the right kind
    if (b < 1) assert.ok(rollingVariant(1.234 + v) < TREAD_PHASES);
    assert.ok(streakVariant(v) >= TREAD_PHASES && streakVariant(v) < WHEEL_VARIANTS);
  }
  // the streak cycle does not slow down or jump where it appears: same law on both sides of the fade
  const before = streakCyclesPerMetre(WHEEL_SYNC_SPEED - 0.01) * (WHEEL_SYNC_SPEED - 0.01), after = streakCyclesPerMetre(WHEEL_SYNC_SPEED + 0.01) * (WHEEL_SYNC_SPEED + 0.01);
  assert.ok(Math.abs(after - before) < 0.05, 'continuous cycling rate at the end of the fade');
});

test('front wheels at speed: the streak pattern slides as one piece, in the direction of the rolling marks', () => {
  // tread strokes of the drawn model: [mean angle around the hub, lateral position]
  const strokes = (tread) => {
    const tyre = buildFrontWheelModel({ steer: 0, tread }).parts[0], D = CAR_DIMENSIONS, out = [];
    for (const l of tyre.lines) {
      if (!l.hex || l.pts.length < 2) continue;
      const a = l.pts[0], b = l.pts.at(-1);
      const radius = Math.hypot(a[0] - D.frontAxleX, a[2] - D.frontTyre.radius);
      if (Math.abs(radius - D.frontTyre.radius) > 0.01) continue;                  // on the tread only
      // an arc is symmetric about its middle: the middle of its chord gives the angle of its centre
      out.push({ angle: Math.atan2((a[2] + b[2]) / 2 - D.frontTyre.radius, (a[0] + b[0]) / 2 - D.frontAxleX), lat: +(a[1] - D.frontTrack).toFixed(3) });
    }
    return out;
  };
  const wrap = (a, period) => ((a % period) + period * 1.5) % period - period / 2;
  const spacing = (Math.PI * 2) / STREAK_BANDS;
  const phases = [0, 1, 2].map((phase) => strokes({ blur: true, phase }));
  assert.ok(phases[0].length >= STREAK_BANDS * 5, `streaks found on the tread (${phases[0].length})`);
  // the dashes of all lanes sit in rows: no lane is staggered against its neighbours by more than a fraction of a phase step
  for (const st of phases[0]) assert.ok(Math.abs(wrap(st.angle - phases[0][0].angle, spacing)) < 0.25 * (spacing / 3), 'lanes are aligned in rows');
  // and the dashes are short: a long stroke sliding along itself would not show the rotation
  const tyre = buildFrontWheelModel({ steer: 0, tread: { blur: true, phase: 0 } }).parts[0];
  for (const l of tyre.lines) if (l.hex && l.weight > 2) { const a = l.pts[0], b = l.pts.at(-1); assert.ok(Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.45 * spacing * CAR_DIMENSIONS.frontTyre.radius * 1.05, 'dashes shorter than half the spacing of the rows'); }
  // one phase moves every stroke by a third of the spacing, all the same way
  const step = (from, to) => { const steps = from.map((st, i) => wrap(to[i].angle - st.angle, spacing)); for (const d of steps) assert.ok(Math.abs(d - steps[0]) < 1e-3, 'all strokes move together'); return steps[0]; };
  const s01 = step(phases[0], phases[1]), s12 = step(phases[1], phases[2]);
  assert.ok(Math.abs(Math.abs(s01) - spacing / 3) < 1e-3 && Math.abs(s12 - s01) < 1e-3, `a third of the spacing per phase (${s01.toFixed(3)} rad)`);
  // same direction as the rolling marks of the slow drawing
  const marks = [0, 1].map((phase) => strokes({ phase }));
  const markStep = wrap(marks[1][0].angle - marks[0][0].angle, (Math.PI * 2) / TREAD_MARKS);
  assert.equal(Math.sign(s01), Math.sign(markStep), 'streaks and marks turn the same way');
});

test('mirrors: the cockpit shows the mirrors of the car model where the driver would see them', () => {
  // the model used by the exterior views: the mirror housing is centred on MIRROR_MOUNT
  const model = buildCarModel();
  const parts = model.parts || model;
  const left = parts.find((p) => p.name === 'mirror.left'), right = parts.find((p) => p.name === 'mirror.right');
  assert.ok(left && right, 'the model has two mirrors');
  const centre = (part) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < part.pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], part.pos[i + a]); hi[a] = Math.max(hi[a], part.pos[i + a]); }
    return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2, hi[1] - lo[1], hi[2] - lo[2]];
  };
  const cl = centre(left), cr = centre(right);
  assert.ok(Math.abs(cl[0] - MIRROR_MOUNT.x) < 0.03 && Math.abs(cl[1] - MIRROR_MOUNT.y) < 0.01 && Math.abs(cl[2] - MIRROR_MOUNT.z) < 0.01, `left mirror of the model at ${cl.slice(0, 3)}`);
  assert.ok(Math.abs(cr[1] + cl[1]) < 1e-9 && Math.abs(cr[2] - cl[2]) < 1e-9, 'the right mirror is the reflection of the left one');
  assert.ok(Math.abs(cl[3] - MIRROR_MOUNT.width) < 0.01 && Math.abs(cl[4] - MIRROR_MOUNT.height) < 0.01, 'size of the housing');
  // the cockpit drawing: perspective projection of that point from the driver's eye (x forward, y to the left, z up)
  const eye = CAR_DIMENSIONS.eye, depth = MIRROR_MOUNT.x - eye[0];
  assert.ok(depth > 0.3, 'the mirror is in front of the eye');
  const scale = COCKPIT_REF_FOCAL / depth;
  assert.ok(Math.abs(MIRROR.x - (-(MIRROR_MOUNT.y - eye[1]) * scale)) < 1e-6, 'horizontal position');
  assert.ok(Math.abs(MIRROR.y - (eye[2] - MIRROR_MOUNT.z) * scale) < 1e-6, 'vertical position');
  assert.ok(MIRROR.y > 0, 'below the horizon: the mirror is lower than the eye');
  assert.ok(MIRROR.w >= MIRROR_MOUNT.width * scale && MIRROR.w < MIRROR_MOUNT.width * scale * 1.2, 'apparent width (housing plus its outline)');
  assert.ok(MIRROR.h >= MIRROR_MOUNT.height * scale && MIRROR.h < MIRROR_MOUNT.height * scale * 1.25, 'apparent height');
  // it sits outside the cockpit side and inside the front wheel, as on the model
  assert.ok(MIRROR_MOUNT.y > Math.abs(MIRROR_MOUNT.arm[1]) && MIRROR_MOUNT.y + MIRROR_MOUNT.width / 2 < CAR_DIMENSIONS.frontTrack - CAR_DIMENSIONS.frontTyre.width / 2, 'between the cockpit side and the inner face of the wheel');
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
