// EXPERIMENTAL steering variants (src/vehicles/steering-variants.js): a prototype tried side by side
// with the validated driving, never the default. These tests guard both sides: the validated driving
// is exactly what it was whatever is asked for by mistake, and the variants do what their numbers say,
// the same way every time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit, CIRCUITS, DEV_CIRCUITS } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { BASE_CAR_SPEC } from '../../src/vehicles/car-spec.js';
import { STEERING_VARIANTS, STEERING_PARAMETER_RANGES, STEERING_REFERENCE, steeringVariant, resolveSteering } from '../../src/vehicles/steering-variants.js';
import { HeldSteeringRun, trackBends, demoManoeuvre, passageManoeuvre, REFERENCE_PASSAGE, BENCH_CIRCUIT, BENCH_DEMOS, BENCH_VARIANT_KEYS } from '../../src/core/steering-bench.js';
import { steerFrame, heldSteeringWheelTurn, heldSteeringSpan } from '../../src/rendering/compositing/cockpit-layer.js';
import { straightStretch } from './collision-helpers.mjs';

const wide = buildTrack({ ...getCircuit('kestrel-fields'), width: 900 });       // open asphalt: four seconds of full lock stay on the road
const sOpen = straightStretch(wide, 600) + 60;
const NAMES = Object.keys(STEERING_VARIANTS);

function soloRace(track, steering) {
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
  const race = new Race({ track, laps: 3, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 5, steering });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const car = race.playerCars[0], other = race.cars.find((c) => !c.isHuman);
  placeCar(other, track, track.length * 0.97, 0); other.state = CAR_STATE.RACING; other.isHuman = true; other.inThrottle = 0; other.inBrake = 1;
  return { race, car };
}

/** The measured manoeuvre on open asphalt: `kmh`, then full lock (or `request`) to the right for `seconds`. */
function hold(steering, kmh, seconds = 4, { request = 1, after = 1 } = {}) {
  const { race, car } = soloRace(wide, steering);
  const run = new HeldSteeringRun(race, car, { s0: sOpen, kmh, lead: 30, side: request, seconds, after });
  const trace = [];
  for (let i = 0; i < 4000 && !run.done; i++) {
    run.beforeStep();
    if (run.done) break;
    race.step(SIM_DT); race.eventCount = 0;
    if (run.started >= 0) trace.push([car.x, car.z, car.heading, car.speed, car.steer, car.vLat, car.yawRate, car.slip, car.state]);
  }
  return { run, car, trace, marks: run.marks, samples: run.samples, summary: run.summary() };
}

test('steering variants: the reference has no parameters; names, copies with other settings, unknown names', () => {
  assert.equal(STEERING_REFERENCE, 'a');
  assert.equal(STEERING_VARIANTS.a, null);
  assert.deepEqual(NAMES, ['a', 'b1', 'b2', 'b3']);
  assert.equal(steeringVariant('a'), null); assert.equal(steeringVariant(), null); assert.equal(steeringVariant('A'), null);
  assert.equal(steeringVariant('B2'), STEERING_VARIANTS.b2);
  assert.equal(steeringVariant('zz'), undefined); assert.equal(steeringVariant('constructor'), undefined);
  assert.equal(resolveSteering(undefined), null); assert.equal(resolveSteering('zz'), null); assert.equal(resolveSteering('a'), null);
  assert.equal(resolveSteering('b3'), STEERING_VARIANTS.b3);
  for (const name of NAMES.slice(1)) {
    const v = STEERING_VARIANTS[name];
    assert.equal(v.id, name);
    for (const param in STEERING_PARAMETER_RANGES) {
      const [lo, hi] = STEERING_PARAMETER_RANGES[param];
      assert.ok(typeof v[param] === 'number' && v[param] >= lo && v[param] <= hi, `${name}.${param} within its bounds`);
    }
    assert.ok(v.phase2Allowance >= v.phase1Allowance, 'phase 2 never takes lock away');
  }
  // phase 1 of B2 and B3 is today's stop, and B1 never goes beyond it
  assert.equal(STEERING_VARIANTS.b2.phase1Allowance, BASE_CAR_SPEC.overSteerAllowance);
  assert.equal(STEERING_VARIANTS.b3.phase1Allowance, BASE_CAR_SPEC.overSteerAllowance);
  assert.equal(STEERING_VARIANTS.b1.phase2Allowance, BASE_CAR_SPEC.overSteerAllowance);
  // settings given by hand (launch option): a copy, kept within bounds; text that is not a number and unknown names are ignored
  const before = JSON.stringify(STEERING_VARIANTS);
  const custom = steeringVariant('b2', { phase2Delay: '0.5', phase2Allowance: 99, driftGain: 'much', bogus: 3, steering: 'b2', spinAngle: '' });
  assert.notEqual(custom, STEERING_VARIANTS.b2);
  assert.deepEqual(custom, { ...STEERING_VARIANTS.b2, custom: true, phase2Delay: 0.5, phase2Allowance: 4 });
  assert.equal(steeringVariant('b2', { lang: 'fr', steerlab: 'b2' }), STEERING_VARIANTS.b2, 'nothing to change: the variant itself');
  assert.equal(steeringVariant('b2', { phase2Allowance: 0.6 }).phase2Allowance, STEERING_VARIANTS.b2.phase1Allowance, 'phase 2 at least phase 1');
  assert.equal(steeringVariant('a', { phase2Delay: 1 }), null, 'the reference cannot be tuned');
  assert.equal(JSON.stringify(STEERING_VARIANTS), before, 'the variants themselves are never modified');
});

test('steering variants: unset, the name of the reference or an unknown name, a race is the validated driving to the last bit', () => {
  const track = buildTrack(getCircuit('hazelbrook'));
  const trace = (steering) => {
    const entries = [...DRIVERS.slice(0, 5).map((driver) => ({ driver })), { driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }];
    const race = new Race({ track, laps: 2, entries, rules: RULE_PRESETS.racing, difficulty: 'pro', seed: 3, ...(steering === 'unset' ? {} : { steering }) });
    const me = race.playerCars[0], out = [];
    for (let i = 0; i < 40 / SIM_DT; i++) {
      const t = i * SIM_DT;
      // a keyboard driver: keys held for long stretches, both ways, lifting and braking now and then
      const steer = t < 6 ? 0 : (Math.floor(t / 2.5) % 3) - 1;
      race.setPlayerInput(0, steer, t % 9 < 7 ? 1 : 0, t % 9 > 8 ? 1 : 0, 0, false, false);
      race.step(SIM_DT); race.eventCount = 0;
      if (i % 12 === 0) for (const c of race.cars) out.push(c.x, c.z, c.heading, c.speed, c.steer, c.vLat, c.yawRate, c.slip, c.state);
      assert.equal(me.steering, null);
    }
    assert.deepEqual([me.steerHold, me.steerExtra, me.steerShown, me.driftYaw], [0, 0, 0, 0], 'the experimental state is never touched');
    return out;
  };
  const reference = trace('unset');
  assert.ok(reference.length > 10000);
  assert.deepEqual(trace('a'), reference);
  assert.deepEqual(trace('zz'), reference);
  assert.deepEqual(trace(null), reference);
});

test('steering variants: for the cars a player drives only; changed and removed during a race', () => {
  const track = buildTrack(getCircuit('hazelbrook'));
  const entries = [{ driver: DRIVERS[0] }, { driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: PLAYER_DRIVERS[1], human: true, playerIndex: 1, autoDrive: true }];
  const race = new Race({ track, laps: 2, entries, rules: RULE_PRESETS.racing, difficulty: 'pro', seed: 3, steering: 'b3' });
  const [me, robotPlayer] = race.playerCars, computer = race.cars.find((c) => !c.isHuman);
  assert.equal(me.steering, STEERING_VARIANTS.b3);
  assert.equal(robotPlayer.steering, null, 'a player car driven by the computer keeps the validated steering');
  assert.equal(computer.steering, null);
  me.steerHold = 1; me.steerExtra = 0.7; me.steerShown = 1.4; me.driftYaw = 0.2;
  assert.equal(race.setSteeringVariant('zz'), false);
  assert.equal(me.steering, STEERING_VARIANTS.b3, 'an unknown name changes nothing');
  assert.equal(me.steerExtra, 0.7);
  assert.equal(race.setSteeringVariant('b2'), true);
  assert.equal(me.steering, STEERING_VARIANTS.b2);
  assert.deepEqual([me.steerHold, me.steerExtra, me.steerShown, me.driftYaw], [0, 0, 0, 0], 'the new variant starts from rest');
  assert.equal(computer.steering, null); assert.equal(robotPlayer.steering, null);
  const custom = steeringVariant('b2', { phase2Delay: 0.6 });
  assert.equal(race.setSteeringVariant(custom), true);
  assert.equal(me.steering, custom);
  assert.equal(race.setSteeringVariant('a'), true);
  assert.equal(me.steering, null);
});

test('steering variants: the same manoeuvre gives the same result every time', () => {
  for (const name of NAMES.slice(1)) {
    const one = hold(name, 200), two = hold(name, 200);
    assert.ok(one.trace.length > 4 / SIM_DT);
    assert.deepEqual(two.trace, one.trace, name);
    assert.deepEqual(two.marks, one.marks);
  }
});

test('steering variants: two phases at the instants their numbers give', () => {
  const stop = 1 / BASE_CAR_SPEC.steerRate, step = SIM_DT;
  for (const name of NAMES.slice(1)) {
    const v = STEERING_VARIANTS[name], r = hold(name, 250);
    assert.ok(Math.abs(r.marks.steeringAtItsStop - stop) <= step + 1e-9, `${name}: the stop of phase 1 as today (${r.marks.steeringAtItsStop} s)`);
    assert.ok(Math.abs(r.marks.phase2Starts - (stop + v.phase2Delay)) <= 2 * step + 1e-9, `${name}: phase 2 starts ${v.phase2Delay} s after the stop (${r.marks.phase2Starts} s)`);
    // (no bend on open asphalt: the curvature gain of B3 adds nothing here)
    assert.ok(Math.abs(r.marks.phase2Complete - (stop + v.phase2Delay + 1 / v.phase2Rate)) <= 3 * step + 1e-9, `${name}: phase 2 complete (${r.marks.phase2Complete} s)`);
    // the lock applied: phase 1 then phase 2, as multiples of today's full lock
    const at = (t) => r.samples.find((x) => x.t >= t);
    const share1 = v.phase1Allowance / BASE_CAR_SPEC.overSteerAllowance, share2 = v.phase2Allowance / BASE_CAR_SPEC.overSteerAllowance;
    assert.ok(Math.abs(at(stop + v.phase2Delay - 0.02).applied - share1) < 0.02, `${name}: phase 1 at ${share1.toFixed(2)} of today's lock`);
    assert.ok(Math.abs(at(r.marks.phase2Complete + 0.05).applied - share2) < 0.06, `${name}: phase 2 at ${share2.toFixed(2)} of today's lock (${at(r.marks.phase2Complete + 0.05).applied})`);
    let previous = 0;
    for (const x of r.samples.filter((s) => s.t <= r.marks.phase2Complete)) { assert.ok(x.phase2 >= previous, `${name}: phase 2 only grows while the key is held`); previous = x.phase2; }
    // released: phase 2 is given back
    const released = r.samples.filter((x) => x.t > 4 + 1 / v.phase2Return + 0.05 && x.state === CAR_STATE.RACING);
    for (const x of released) assert.equal(x.phase2, 0, `${name}: nothing left of phase 2 ${(1 / v.phase2Return).toFixed(2)} s after the release`);
  }
});

test('steering variants: B2 and B3 are today\'s steering until phase 2 starts; B1 never exceeds today\'s lock', () => {
  const a = hold('a', 200);
  for (const name of ['b2', 'b3']) {
    const r = hold(name, 200), steps = Math.floor((r.marks.phase2Starts - SIM_DT) / SIM_DT) - 1;
    assert.ok(steps > 55);
    assert.deepEqual(r.trace.slice(0, steps), a.trace.slice(0, steps), `${name}: phase 1 is the validated steering, to the last bit`);
    assert.ok(r.summary.largestApplied > 1.5, `${name}: phase 2 winds on more lock (${r.summary.largestApplied})`);
  }
  const b1 = hold('b1', 200);
  assert.ok(b1.samples.every((x) => Math.abs(x.applied) <= 1 + 1e-9), 'B1 never more than today\'s full lock');
  assert.ok(b1.samples.every((x) => x.askedShare <= a.summary.largestAskedShare + 0.01), 'B1 never asks the tyres for more than today');
  const early = (r) => Math.abs(r.samples.find((x) => x.t >= 0.34).yawDegS), late = (r) => Math.abs(r.samples.find((x) => x.t >= 1.6).yawDegS);
  assert.ok(early(b1) < early(a) * 0.92, `B1 turns less at first (${early(b1)} against ${early(a)} deg/s)`);
  assert.ok(Math.abs(late(b1) - late(a)) < late(a) * 0.04, `B1 held: today's turn (${late(b1)} against ${late(a)} deg/s)`);
});

test('steering variants: what phase 2 does - scrub for B2, a slide that ends in a spin for B3, recovery when released in time', () => {
  for (const kmh of [150, 250]) {
    const a = hold('a', kmh), b2 = hold('b2', kmh), b3 = hold('b3', kmh);
    assert.ok(a.summary.largestSlip < 0.3 && a.summary.largestSlideDeg < 1, 'reference: a light squeal, no slide');
    // B2: the tyres smoke, the car loses much more speed, its line ends up tighter; the rear holds
    assert.ok(b2.summary.largestSlip > 0.85, `B2 at ${kmh}: the three stages of tyre protest (${b2.summary.largestSlip})`);
    assert.ok(b2.marks.tyresSqueal < b2.marks.tyreMarks && b2.marks.tyreMarks < b2.marks.tyreSmoke);
    assert.ok(b2.summary.kmhAtEnd < a.summary.kmhAtEnd - 25, `B2 at ${kmh}: scrubs speed off (${b2.summary.kmhAtEnd} against ${a.summary.kmhAtEnd} km/h)`);
    assert.ok(b2.summary.tightestRadiusM < a.summary.tightestRadiusM * 0.85, 'B2: the line tightens');
    assert.ok(b2.summary.largestSlideDeg < 5 && b2.marks.spin === undefined, 'B2: no slide of the rear, no spin');
    assert.ok(b2.samples.every((x) => x.t < 0.5 || x.latG <= x.gripG * 1.12), 'B2: never more lateral acceleration than the grip gives');
    // B3: the rear slides
    assert.ok(b3.summary.largestSlideDeg > 8, `B3 at ${kmh}: the rear slides (${b3.summary.largestSlideDeg} degrees)`);
    assert.ok(b3.summary.kmhAtEnd < a.summary.kmhAtEnd - 25);
  }
  // insisting: a spin, at the slide angle of the variant, some time after phase 2 is complete
  const insist = hold('b3', 150, 4);
  assert.ok(insist.marks.spin > insist.marks.phase2Complete + 0.3, `B3 held: spin at ${insist.marks.spin} s`);
  assert.ok(Math.abs(insist.summary.largestSlideDeg - STEERING_VARIANTS.b3.spinAngle * 180 / Math.PI) < 1);
  // released when the tyres start smoking: the slide dies out, the car drives on
  const released = hold('b3', 150, 1.6, { after: 3 });
  assert.equal(released.marks.spin, undefined);
  assert.ok(released.summary.largestSlideDeg > 3);
  const end = released.samples[released.samples.length - 1];
  assert.equal(end.state, CAR_STATE.RACING);
  assert.ok(end.slideDeg < 0.5 && end.phase2 === 0 && Math.abs(end.yawDegS) < 1, `B3 released: back in line (${end.slideDeg} degrees, ${end.yawDegS} deg/s)`);
  assert.equal(released.car.driftYaw, 0);
});

test('steering variants: nothing at low speed, where the lock is the mechanical one, and nothing below the hold threshold', () => {
  // 40 km/h: full lock is the mechanical stop and asks for less than the grip: no variant has anything to add or to remove
  const slow = hold('a', 40);
  for (const name of NAMES.slice(1)) {
    const r = hold(name, 40);
    assert.deepEqual(r.trace, slow.trace, `${name} at 40 km/h: the validated driving, to the last bit`);
    assert.ok(r.samples.every((x) => Math.abs(x.applied) <= 1 + 1e-9), `${name}: no extra lock shown either`);
  }
  // a stick held short of its end (90 % of the travel): phase 2 never starts; for B2 and B3 this is the validated driving
  const partial = hold('a', 200, 4, { request: 0.9 });
  for (const name of ['b2', 'b3']) {
    const r = hold(name, 200, 4, { request: 0.9 });
    assert.equal(r.marks.phase2Starts, undefined);
    assert.deepEqual(r.trace, partial.trace, `${name}, stick at 90 %: the validated driving`);
  }
  const b1 = hold('b1', 200, 4, { request: 0.9 });
  assert.equal(b1.marks.phase2Starts, undefined, 'B1, stick at 90 %: phase 1 only');
  // at the threshold itself the hold counts
  assert.ok(hold('b2', 200, 4, { request: STEERING_VARIANTS.b2.holdThreshold }).marks.phase2Starts !== undefined);
});

test('steering variants: road curvature - phase 2 of B3 builds up faster in a bend that asks for more than the car can give', () => {
  const bench = buildTrack({ ...getCircuit(BENCH_CIRCUIT), width: 90 });
  const runIn = (name, share) => {
    const { race, car } = soloRace(bench, name);
    const run = new HeldSteeringRun(race, car, demoManoeuvre(bench, car.params, { bend: 4, share, seconds: 2 }));
    for (let i = 0; i < 4000 && !run.done; i++) { run.beforeStep(); if (run.done) break; race.step(SIM_DT); race.eventCount = 0; }
    return run.marks.phase2Complete - run.marks.phase2Starts;
  };
  const open = hold('b3', 200); const flat = open.marks.phase2Complete - open.marks.phase2Starts;
  const slowIn = runIn('b3', 0.85), fastIn = runIn('b3', 1.15);
  assert.ok(Math.abs(flat - 1 / STEERING_VARIANTS.b3.phase2Rate) < 0.03);
  assert.ok(slowIn < flat - 0.2, `in a bend: ${slowIn.toFixed(2)} s against ${flat.toFixed(2)} s in a straight line`);
  assert.ok(fastIn < slowIn - 0.08, `faster into the bend: ${fastIn.toFixed(2)} s against ${slowIn.toFixed(2)} s`);
  // B2 has no curvature gain: the same build-up in the bend as in a straight line
  assert.ok(Math.abs(runIn('b2', 1.15) - 1 / STEERING_VARIANTS.b2.phase2Rate) < 0.03);
});

test('steering variants: the cockpit shows the lock that is simulated, never more', () => {
  // steering wheel: the validated range up to today's full lock, then a continuous extra turn
  assert.equal(heldSteeringWheelTurn(0), 0); assert.equal(heldSteeringWheelTurn(1), 1); assert.equal(heldSteeringWheelTurn(-0.4), -0.4);
  let previous = -Infinity;
  for (let shown = -2.2; shown <= 2.2; shown += 0.01) {
    const turn = heldSteeringWheelTurn(shown);
    assert.ok(turn > previous, 'the wheel never turns back while the lock grows'); previous = turn;
    assert.ok(Math.abs(turn) <= Math.abs(shown) + 1e-9);
    assert.ok(Math.abs(turn) * 0.95 < Math.PI / 2, 'the hands never cross the vertical');
  }
  for (const name of NAMES.slice(1)) {
    const v = STEERING_VARIANTS[name], span = heldSteeringSpan(v);
    assert.ok(span >= 1);
    // the drawings of the front wheels: straight when straight, the last drawing only at the full lock of the variant
    assert.equal(steerFrame(0 / span, 0.2), steerFrame(0, 0.2));
    const full = v.phase2Allowance / BASE_CAR_SPEC.overSteerAllowance;
    assert.equal(steerFrame(Math.min(1, full / span), 0.3), steerFrame(1, 0.3), `${name}: the last drawing at full lock`);
  }
  // at low speed no variant shows more lock than the validated steering applies
  for (const name of NAMES.slice(1)) {
    const r = hold(name, 40, 3);
    assert.ok(Math.abs(r.car.steerShown) <= 1 + 1e-9);
    assert.ok(r.samples.every((x) => Math.abs(x.applied) <= 1 + 1e-9));
  }
});

test('steering bench: a development circuit outside the catalogue, bends of several radii both ways, demonstrations on real bends', () => {
  assert.equal(CIRCUITS.length, 18);
  assert.ok(!CIRCUITS.some((c) => c.id === BENCH_CIRCUIT), 'the bench is not a circuit of the game');
  assert.ok(DEV_CIRCUITS.some((c) => c.id === BENCH_CIRCUIT));
  const track = buildTrack(getCircuit(BENCH_CIRCUIT));
  assert.deepEqual(track.warnings || [], []);
  const bends = trackBends(track);
  assert.ok(bends.length >= 6);
  const radii = bends.map((b) => b.radius);
  assert.ok(Math.min(...radii) < 80 && Math.max(...radii) > 240, `radii from ${Math.min(...radii).toFixed(0)} to ${Math.max(...radii).toFixed(0)} m`);
  assert.ok(bends.some((b) => b.side > 0) && bends.some((b) => b.side < 0), 'right and left');
  for (const b of bends.slice(0, 6)) assert.ok(b.turnDeg > 45, `bend ${b.number}: a real bend (${b.turnDeg.toFixed(0)} degrees)`);
  const { car } = soloRace(track, 'a');
  for (const demo of BENCH_DEMOS) {
    const m = demoManoeuvre(track, car.params, demo);
    assert.ok(m.bend && m.s0 > 0 && m.kmh > 80 && m.kmh <= 300 && Math.abs(m.side) === 1);
    // the approach is straight: nothing but the held key steers the car
    for (let s = m.s0; s < m.bend.sFrom - 2; s += track.ds) assert.ok(Math.abs(track.kappa[Math.floor(s / track.ds)]) < 1 / 1500, `demonstration in bend ${demo.bend}: straight approach`);
  }
  assert.deepEqual(Object.values(BENCH_VARIANT_KEYS), NAMES, 'one key for each variant');
});

test('steering bench: the circuit of the reference passage - the validated car, driven with the keys assumed from the footage, follows it', () => {
  assert.ok(DEV_CIRCUITS.some((c) => c.id === REFERENCE_PASSAGE.circuit) && !CIRCUITS.some((c) => c.id === REFERENCE_PASSAGE.circuit));
  const track = buildTrack(getCircuit(REFERENCE_PASSAGE.circuit));
  assert.deepEqual(track.warnings || [], []);
  const bends = trackBends(track);
  // a long right-hand turn, then a left-hand turn
  assert.deepEqual(bends.slice(0, 2).map((b) => b.side), [1, -1]);
  assert.ok(Math.abs(bends[0].turnDeg - 128) < 3 && Math.abs(bends[1].turnDeg - 67) < 3, `${bends[0].turnDeg.toFixed(0)} and ${bends[1].turnDeg.toFixed(0)} degrees`);
  // the speed read on the footage: readings in order, from the entry at about 318 km/h down to 215 km/h for the left-hand turn
  const speeds = REFERENCE_PASSAGE.speeds;
  for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i][0] > speeds[i - 1][0]);
  assert.ok(Math.abs(REFERENCE_PASSAGE.kmh - speeds[0][1]) <= 2 && Math.min(...speeds.map((p) => p[1])) === 215);
  // the keys: a sequence of holds in order, right then left, as read on the footage (a hypothesis on the controls)
  const keys = REFERENCE_PASSAGE.keys;
  for (let i = 0; i < keys.length; i++) { assert.ok(keys[i][1] > keys[i][0] && (i === 0 || keys[i][0] >= keys[i - 1][1])); assert.equal(Math.abs(keys[i][2]), 1); }
  assert.ok(keys[keys.length - 1][1] <= REFERENCE_PASSAGE.seconds);
  const drive = (steering) => {
    const { race, car } = soloRace(track, steering);
    const run = new HeldSteeringRun(race, car, passageManoeuvre(track));
    let worst = 0, off = false, speedError = 0;
    for (let i = 0; i < 4000 && !run.done; i++) {
      run.beforeStep(); if (run.done) break;
      race.step(SIM_DT); race.eventCount = 0;
      if (run.started < 0) continue;
      worst = Math.max(worst, Math.abs(car.d)); off = off || Math.abs(car.d) > track.halfWidth;
      const reading = speeds.find((p) => Math.abs(p[0] - run.time) < SIM_DT / 2);
      if (reading) speedError = Math.max(speedError, Math.abs(car.speed * 3.6 - reading[1]));
    }
    return { worst, off, run, car, speedError };
  };
  const a = drive('a');
  assert.ok(a.worst < 3 && !a.off, `the validated car stays within 3 m of the centre line (${a.worst.toFixed(2)} m)`);
  assert.equal(a.car.state, CAR_STATE.RACING);
  assert.ok(a.speedError < 12, `and follows the speed of the footage (largest gap ${a.speedError.toFixed(1)} km/h)`);
  assert.ok(a.run.samples.length > REFERENCE_PASSAGE.seconds * 55);
  // the holds of the passage are long enough for phase 2 of every variant: this is where they differ from the validated car
  for (const name of NAMES.slice(1)) {
    const r = drive(name);
    assert.ok(r.run.marks.phase2Complete !== undefined, `${name}: phase 2 is reached during the passage`);
  }
});
