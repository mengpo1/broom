// Recoverable hop: the intermediate level between a contact without consequence on the trajectory
// and the hard accident (E3). An original gameplay choice, not shown by the reference footage.
// Interlocked wheels lift the car behind when it arrives fast enough; it flies for a short while,
// comes down on its wheels, its steering is disturbed for a moment, and it drives on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE, LANDING, hopSteerKick, startHop } from '../../src/physics/car-physics.js';
import { wheelBehindWheel } from '../../src/physics/collisions.js';
import { CAR_DIMENSIONS } from '../../src/art/vehicles/car-model.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { crashPitch, crashPitchDuration, CRASH_CAMERA as C } from '../../src/rendering/compositing/crash-camera.js';
import { twoCars, run, KMH } from './collision-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));

// (After the third human test the hop was found far too frequent. It now needs the real geometry of a front wheel
// behind a rear wheel - the cars offset by about a track width - and more energy. The two set-ups below were moved
// accordingly: they used to be half a car width apart (0.93 m: nose on the wheel, now a bump or the accident E3), and
// side by side with the front wheel BESIDE the rear wheel (now the wheel contact E2).)
/** The reference hop of these tests: 200 km/h onto a car doing 150 km/h, offset by 1.7 m: the front tyre right behind the rear tyre. */
const rearHop = (options = {}) => twoCars(track, { gap: 2, lateral: 1.7, speedA: 200 / KMH, speedB: 150 / KMH, straight: 700, ...options });
/** From the side: the car behind drifts into the car ahead when its nose is only just alongside the tail: its front wheel is still behind the rear wheel. */
const sideHop = (options = {}) => twoCars(track, { gap: -0.3, lateral: 1.95, speedA: 200 / KMH, speedB: 150 / KMH, headingA: 0.05, straight: 700, ...options });
const first = (log, type) => log.events.find((e) => e.type === type);

/** Overlap (m) of the boxes of two cars, 0 when they are apart: separating axis test, as in the game. */
function boxOverlap(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const axes = [[Math.cos(a.heading), Math.sin(a.heading)], [-Math.sin(a.heading), Math.cos(a.heading)], [Math.cos(b.heading), Math.sin(b.heading)], [-Math.sin(b.heading), Math.cos(b.heading)]];
  let min = Infinity;
  for (const [ax, az] of axes) {
    const reach = (c) => c.params.halfLength * Math.abs(ax * Math.cos(c.heading) + az * Math.sin(c.heading)) + c.params.halfWidth * Math.abs(-ax * Math.sin(c.heading) + az * Math.cos(c.heading));
    const overlap = reach(a) + reach(b) - Math.abs(dx * ax + dz * az);
    if (overlap <= 0) return 0;
    min = Math.min(min, overlap);
  }
  return min;
}

/** Step a race built by twoCars, tick by tick, with a callback after each tick. Returns the events. */
function stepThrough(setup, seconds, inputs, each) {
  const { race } = setup, events = [];
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    const t = i * SIM_DT, val = (v) => (typeof v === 'function' ? v(t) : v ?? 0);
    race.setPlayerInput(0, val(inputs.steerA), val(inputs.throttleA), val(inputs.brakeA), 0, false, false);
    race.setPlayerInput(1, 0, val(inputs.throttleB), 0, 0, false, false);
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) events.push({ type: race.events[e].type, car: race.events[e].car, other: race.events[e].other, value: race.events[e].value, tick: i });
    race.eventCount = 0;
    if (each) each(i, t + SIM_DT);
  }
  return events;
}

test('recoverable hop: wheels interlocked at a medium closing speed lift the car behind; a short flight, it comes down on its wheels', () => {
  const { race, a, b } = rearHop();
  const log = run(race, 1.5, { throttleA: 1, throttleB: 0.6 });
  const launch = first(log, 'launch'), hop = first(log, 'hop'), landing = first(log, 'landing');
  assert.ok(launch && hop && landing, 'launch, hop and landing events');
  assert.equal(hop.car, a.index); assert.equal(hop.other, b.index); assert.equal(hop.time, launch.time);
  const before = log.atEvent(launch), flying = log.frames[launch.frame];
  assert.equal(flying.a.state, CAR_STATE.AIRBORNE);
  const closing = before.a.speed - before.b.speed;
  assert.ok(closing >= T.hopClosingSpeed && closing < T.launchClosingSpeed, `closing speed ${(closing * KMH).toFixed(0)} km/h, between the hop and the accident thresholds`);
  // a short flight, lower than the accident
  assert.ok(Math.abs(landing.time - launch.time - T.hopFlightTime) < 2 * SIM_DT, `flight ${(landing.time - launch.time).toFixed(3)} s`);
  assert.ok(T.hopFlightTime < T.flightTimeCar * 0.6, 'much shorter than the flight of the accident');
  const peak = Math.max(...log.frames.map((f) => f.a.airHeight));
  assert.ok(Math.abs(peak - T.hopPeakHeight) < 0.02 && peak > 0.3 && peak < T.airPeakHeight * 0.6, `peak ${peak.toFixed(2)} m: visible, lower than the accident`);
  // it comes down on its wheels and drives: no wreck, no slide, no explosion
  assert.equal(landing.value, LANDING.RECOVERABLE);
  const landed = log.frames[landing.frame];
  assert.equal(landed.a.state, CAR_STATE.RACING, 'driving again in the step where it lands');
  assert.equal(a.landKind, LANDING.RECOVERABLE); assert.equal(a.landHard, false);
  assert.ok(log.events.every((e) => e.type !== 'crash' && e.type !== 'reset' && e.type !== 'restart'), 'no explosion, no repositioning');
  // it keeps part of its speed: far more than after the accident, and less than the car it rode over
  assert.ok(landed.a.speed > before.a.speed * 0.5, `${(before.a.speed * KMH).toFixed(0)} -> ${(landed.a.speed * KMH).toFixed(0)} km/h`);
  assert.ok(Math.abs(before.b.speed - landed.a.speed - T.hopSeparation) < 0.5, `it lands ${((before.b.speed - landed.a.speed) * KMH).toFixed(0)} km/h slower than the car it rode over was at the shock`);
  assert.ok(landed.b.speed - landed.a.speed > T.hopSeparation - 0.5, 'and at least as much slower than that car is now: the two separate');
  // the car ahead is not disturbed
  assert.ok(Math.abs(flying.b.speed - before.b.speed) < 0.3 && b.state === CAR_STATE.RACING);
});

test('the speed of a hop is lost where its cause is seen: at the shock and during the flight, none as the wheels touch down', () => {
  // (the first version took it at the landing: the speed fell by 77 km/h in one image with nothing to explain it)
  const setup = rearHop();
  const { a, b } = setup;
  const speeds = [], leader = [];
  let launchTick = -1, landTick = -1;
  stepThrough(setup, 2.4, { throttleA: 1, throttleB: 0.6 }, (i) => {
    speeds.push(a.speed); leader.push(b.speed);
    if (launchTick < 0 && a.state === CAR_STATE.AIRBORNE) launchTick = i;
    if (launchTick >= 0 && landTick < 0 && a.state === CAR_STATE.RACING) landTick = i;
  });
  assert.ok(launchTick > 0 && landTick > launchTick, 'the hop happened');
  // at the shock: slowed to a little less than the car whose wheel it rides over
  const gap = T.hopSeparation - T.airDecel * T.hopFlightTime;
  assert.ok(gap > 0 && gap < T.hopSeparation);
  assert.ok(Math.abs(speeds[launchTick] - (leader[launchTick] - gap)) < 0.3, `after the shock: ${(speeds[launchTick] * KMH).toFixed(1)} km/h, the car ahead at ${(leader[launchTick] * KMH).toFixed(1)}`);
  assert.ok(speeds[launchTick - 1] - speeds[launchTick] > 10, `the shock costs ${((speeds[launchTick - 1] - speeds[launchTick]) * KMH).toFixed(0)} km/h`);
  // in the air: the steady loss of any flight, step after step
  for (let i = launchTick + 1; i < landTick; i++) assert.ok(Math.abs(speeds[i - 1] - speeds[i] - T.airDecel * SIM_DT) < 1e-9, `flight step ${i}`);
  // as the wheels touch down: no step (only that same steady loss, for the last step of the flight)
  const atLanding = speeds[landTick - 1] - speeds[landTick];
  assert.ok(Math.abs(atLanding - T.airDecel * SIM_DT) < 1e-6, `change of speed in the landing step: ${(atLanding * KMH).toFixed(3)} km/h`);
  // and afterwards the car drives: over the following second no step of speed either
  for (let i = landTick + 1; i < landTick + 120; i++) assert.ok(Math.abs(speeds[i] - speeds[i - 1]) < 0.25, `step ${i} after the landing: ${((speeds[i] - speeds[i - 1]) * KMH).toFixed(2)} km/h`);
  assert.equal(T.hopLandingSpeedFactor, 1);
  // the car is never sped up by a hop: when the car ahead is the faster one over the ground, nothing is added
  const car = { ...a, state: CAR_STATE.RACING, velX: 40, velZ: 0, speed: 40, clock: 100, rearmClock: -10 };
  startHop(car, null, 1, 1, 3, 80);
  assert.ok(Math.abs(Math.hypot(car.velX, car.velZ) - 40) < 1e-9);
});

test('recoverable hop from the side: a front wheel still behind the rear wheel is lifted; wheels side by side only rub (E2)', () => {
  const side = sideHop();
  const log = run(side.race, 1.5, { throttleA: 0.8, throttleB: 0.6 });
  const hop = first(log, 'hop'), landing = first(log, 'landing');
  assert.ok(hop && landing && landing.value === LANDING.RECOVERABLE, 'hop from a side contact');
  assert.ok(log.events.every((e) => e.type !== 'wheel' && e.type !== 'bump' && e.type !== 'crash'), 'neither car pays a rubbing penalty for it');
  assert.equal(side.a.state, CAR_STATE.RACING); assert.equal(side.b.state, CAR_STATE.RACING);
  // thrown clear: after the landing the two are apart and do not come together again
  const end = log.frames.at(-1);
  assert.ok(Math.abs(end.a.d - end.b.d) > side.a.params.halfWidth + side.b.params.halfWidth + 0.3, `apart by ${Math.abs(end.a.d - end.b.d).toFixed(2)} m at the end`);
  // the same arrival with the front wheel beside the rear wheel (it used to hop), or fully alongside, is the validated
  // wheel contact, whatever the closing speed
  for (const gap of [-1.5, -3.2]) {
    const alongside = twoCars(track, { gap, lateral: 2.1, speedA: 200 / KMH, speedB: 150 / KMH, headingA: 0.03, straight: 700 });
    const rub = run(alongside.race, 1, { throttleA: 0.8, throttleB: 0.6 });
    assert.ok(first(rub, 'wheel') && !first(rub, 'launch'), `${-gap} m alongside: wheel contact, no flight`);
    assert.ok(Math.abs(first(rub, 'wheel').value * KMH - 96) < 3, 'with its validated penalty');
  }
});

test('after a hop the driver has the car back: the steering swings once and settles, then answers as on any car', () => {
  const { race, a } = rearHop();
  let landedAt = -1, headingAtLanding = 0, dAtLanding = 0, maxSwing = 0, maxSide = 0, kicks = 0;
  stepThrough({ race }, 2.2, { throttleA: 0.5, throttleB: 0.6 }, (i, t) => {
    if (landedAt < 0 && a.landKind === LANDING.RECOVERABLE && a.state === CAR_STATE.RACING) { landedAt = t; headingAtLanding = a.heading; dAtLanding = a.d; }
    if (landedAt < 0) return;
    const since = t - landedAt;
    if (hopSteerKick(a) !== 0) { kicks++; assert.ok(since < T.hopWobbleTime + SIM_DT, 'the disturbance ends with the wobble time'); }
    maxSwing = Math.max(maxSwing, Math.abs(a.heading - headingAtLanding)); maxSide = Math.max(maxSide, Math.abs(a.d - dAtLanding));
    assert.ok(Math.abs(a.d) < track.halfWidth - 1, 'the car stays on the road without any correction');
  });
  assert.ok(landedAt > 0 && kicks > 0.8 * T.hopWobbleTime / SIM_DT, 'the steering is disturbed after the landing');
  assert.ok(maxSwing > 0.01 && maxSwing < 0.08, `the car swings by ${(maxSwing * 57.3).toFixed(1)} degrees: felt, not dangerous`);
  assert.ok(maxSide > 0.2 && maxSide < 1.5, `and moves ${maxSide.toFixed(2)} m sideways`);
  assert.ok(Math.abs(a.heading - headingAtLanding) < 0.006, 'left alone, it ends up heading where it was');
  assert.equal(hopSteerKick(a), 0);
  // the steering then answers as on a car that never left the ground, at the same speed
  const turn = (car, r) => { const h0 = car.heading; for (let i = 0; i < 60; i++) { r.setPlayerInput(0, 0.4, 0, 0, 0, false, false); r.setPlayerInput(1, 0, 0.3, 0, 0, false, false); r.step(SIM_DT); r.eventCount = 0; } return car.heading - h0; };
  const speed = a.speed, hopped = turn(a, race);
  const fresh = twoCars(track, { gap: 60, lateral: 4, speedA: speed, speedB: speed, straight: 700 });
  fresh.a.gear = a.gear;
  const reference = turn(fresh.a, fresh.race);
  assert.ok(Math.abs(hopped) > 0.02 && Math.sign(hopped) === Math.sign(reference), 'the car turns the way it is steered');
  assert.ok(Math.abs(hopped - reference) < 0.12 * Math.abs(reference), `same response as an untouched car (${hopped.toFixed(4)} against ${reference.toFixed(4)} rad in half a second)`);
  // and during the wobble itself the driver is not locked out: holding the wheel to one side turns the car that way
  const held = rearHop();
  let h0 = null;
  stepThrough(held, 1.6, { throttleA: 0.5, throttleB: 0.6, steerA: () => (held.a.landKind === LANDING.RECOVERABLE && held.a.state === CAR_STATE.RACING ? 0.5 : 0) }, () => { if (h0 === null && held.a.landKind === LANDING.RECOVERABLE && held.a.state === CAR_STATE.RACING) h0 = held.a.heading; });
  const free = rearHop();
  let f0 = null;
  stepThrough(free, 1.6, { throttleA: 0.5, throttleB: 0.6 }, () => { if (f0 === null && free.a.landKind === LANDING.RECOVERABLE && free.a.state === CAR_STATE.RACING) f0 = free.a.heading; });
  assert.ok(Math.abs((held.a.heading - h0) - (free.a.heading - f0)) > 0.1, 'steering during the wobble changes where the car goes');
});

test('a hop never stops the car: no standstill, no explosion, no repositioning, it accelerates again', () => {
  const { race, a } = rearHop();
  const states = new Set();
  let landedTick = -1, landedSpeed = 0, landedS = 0, slowest = Infinity;
  const events = stepThrough({ race }, 4, { throttleA: 1, throttleB: 0.6 }, (i) => {
    states.add(a.state);
    if (landedTick < 0 && a.landKind === LANDING.RECOVERABLE && a.state === CAR_STATE.RACING) { landedTick = i; landedSpeed = a.speed; landedS = a.progress; }
    if (landedTick >= 0) slowest = Math.min(slowest, a.speed);
    assert.ok(a.ghostTimer <= 0, 'never a ghost');
  });
  assert.ok(landedTick > 0);
  assert.deepEqual([...states].sort(), [CAR_STATE.RACING, CAR_STATE.AIRBORNE], 'only racing and flying: never wrecked, sliding or being put back');
  for (const type of ['crash', 'reset', 'restart', 'manualReset']) assert.ok(events.every((e) => e.type !== type || e.car !== a.index), `no ${type} event`);
  assert.ok(slowest > 25, `never slower than ${(slowest * KMH).toFixed(0)} km/h after the landing`);
  assert.ok(a.speed > landedSpeed + 15, `back on the throttle: ${(landedSpeed * KMH).toFixed(0)} -> ${(a.speed * KMH).toFixed(0)} km/h`);
  assert.ok(a.progress - landedS > 120, 'it goes on round the track');
  assert.equal(a.resets, 0);
});

test('what triggers a hop is a front wheel behind a rear wheel: neither the nose on a wheel nor the nose in the gearbox', () => {
  // (Rewritten after the third human test. This test used to accept a hop for any sideways offset from 0.5 to 1.75 m.
  // Only the offsets where at least half of the front tyre stands behind the rear tyre hop now: from about 1.5 m, the
  // nose passing outside the rear wheel. Closer to the axis the nose or the wing meets the wheel: bump, or accident E3.)
  const tyreShare = (lateral) => { const out = []; const { a, b } = rearHop({ lateral }); wheelBehindWheel(a, b, out); return out[0]; };
  for (const lateral of [1.55, 1.7, 1.8]) {
    const { race, a } = rearHop({ lateral });
    const log = run(race, 1.5, { throttleA: 1, throttleB: 0.6 });
    const landing = first(log, 'landing');
    assert.ok(tyreShare(lateral) >= T.hopTyreOverlapMin, `offset ${lateral} m: ${(tyreShare(lateral) * 100).toFixed(0)} % of the front tyre behind the rear tyre`);
    assert.ok(first(log, 'hop') && landing && landing.value === LANDING.RECOVERABLE, `offset ${lateral} m: hop`);
    assert.ok(log.events.every((e) => e.type !== 'bump' && e.type !== 'wheel' && e.type !== 'crash'), `offset ${lateral} m: nothing but the hop`);
    assert.equal(a.state, CAR_STATE.RACING);
  }
  for (const lateral of [0, 0.3, 0.5, 0.93, 1.2, 1.4]) {
    const { race, a, b } = rearHop({ lateral });
    const log = run(race, 1.5, { throttleA: 1, throttleB: 0.6 });
    const bump = first(log, 'bump');
    assert.ok(tyreShare(lateral) < T.hopTyreOverlapMin || lateral < 0.5, `offset ${lateral} m: the tyres are not one behind the other`);
    assert.ok(bump && !first(log, 'launch'), `offset ${lateral} m: bump, no flight`);
    assert.ok(Math.abs(log.atEvent(bump).b.speed - log.frames[bump.frame].a.speed - T.bumpSeparation) < 0.5, `offset ${lateral} m: the validated bump (48 km/h slower than the car ahead)`);
    assert.equal(a.state, CAR_STATE.RACING); assert.equal(b.state, CAR_STATE.RACING);
  }
  // with the energy of the accident: E3 in its own window (untouched), a hop where the tyres are one behind the other
  for (const [lateral, outcome] of [[0.93, 'accident'], [1.2, 'accident'], [1.7, 'hop']]) {
    const { race, a } = twoCars(track, { gap: 2, lateral, speedA: 262 / KMH, speedB: 188 / KMH, straight: 700 });
    const log = run(race, 1.5, { throttleA: 1, throttleB: 0.7 });
    assert.ok(first(log, 'launch'), `offset ${lateral} m at high energy: launch`);
    assert.equal(!!first(log, 'hop'), outcome === 'hop', `offset ${lateral} m at high energy: ${outcome}`);
    assert.equal(a.airKind, outcome === 'hop' ? LANDING.RECOVERABLE : LANDING.HARD);
  }
  // and without any overlap there is no contact at all
  const clear = rearHop({ lateral: 2.0 });
  assert.equal(run(clear.race, 1.5, { throttleA: 1, throttleB: 0.6 }).events.filter((e) => ['bump', 'wheel', 'launch'].includes(e.type)).length, 0);
});

test('wheel geometry: the test of a front wheel behind a rear wheel uses the dimensions of the car model', () => {
  const W = T.wheels, D = CAR_DIMENSIONS;
  assert.deepEqual([W.frontAxle, W.rearAxle, W.frontTrack, W.rearTrack, W.frontTyreWidth, W.rearTyreWidth, W.frontTyreRadius, W.rearTyreRadius],
    [D.frontAxleX, D.rearAxleX, D.frontTrack, D.rearTrack, D.frontTyre.width, D.rearTyre.width, D.frontTyre.radius, D.rearTyre.radius]);
  assert.ok(Math.abs(T.hopAxleGapMin - (W.frontTyreRadius + W.rearTyreRadius)) < 0.01, 'one tyre behind the other: the axles are at least two tyre radii apart');
  // two cars side by side on a straight line, the car behind `back` metres behind and `side` metres to the side
  const pose = (back, side, heading = 0) => [{ x: -back, z: side, heading }, { x: 0, z: 0, heading: 0 }];
  const measure = (back, side, heading) => { const out = []; const [f, l] = pose(back, side, heading); const ok = wheelBehindWheel(f, l, out); return { ok, share: out[0], gap: out[1] }; };
  // nose to tail (4.2 m between the centres): the share of the front tyre in line with the rear tyre, by offset
  assert.equal(measure(4.2, 0).share, 0, 'in line: the wheel compared is on the other side of the car, nothing in line');
  assert.ok(Math.abs(measure(4.2, 1.72).share - 1) < 1e-9, 'offset by the sum of the two half tracks: the whole front tyre is behind the rear tyre');
  assert.ok(Math.abs(measure(4.2, 1.51).share - 0.5) < 0.01 && measure(4.2, 1.52).ok && !measure(4.2, 1.5).ok, 'the hop starts where half of the front tyre is behind the rear tyre (1.51 m)');
  assert.ok(Math.abs(measure(4.2, 0.93).share) < 1e-9 && !measure(4.2, 0.93).ok, 'half a car width apart (the staging of E3): the nose is on the wheel, no tyre behind a tyre');
  assert.ok(Math.abs(measure(4.2, 1.7).gap - (4.2 - W.frontAxle + W.rearAxle)) < 1e-9, 'nose to tail the front wheel is 1.3 m behind the rear axle');
  // the same on either side
  assert.deepEqual(measure(4.2, -1.7), measure(4.2, 1.7));
  // side by side (1.87 m between the axes): it depends on how far the nose is alongside the tail
  assert.ok(measure(3.6, 1.87).ok, 'nose 0.6 m alongside the tail: the front wheel is still behind the rear wheel');
  assert.ok(!measure(3.5, 1.87).ok && measure(3.5, 1.87).share > 0.5, 'nose 0.7 m alongside: the tyres begin to be side by side');
  assert.ok(!measure(2.9, 1.87).ok && Math.abs(measure(2.9, 1.87).gap) < 1e-9, 'front axle level with the rear axle: wheels side by side');
  assert.ok(!measure(0, 1.87).ok, 'fully alongside');
  // the car behind turned toward the car ahead: its wheel is measured where it really is
  assert.ok(measure(4.2, 1.9, -0.1).share > measure(4.2, 1.9).share - 0.6 && Number.isFinite(measure(4.2, 1.9, -0.1).gap));
});

test('no series of hops behind one car: for a while after the landing, a new contact with the same car is an ordinary bump', () => {
  // the driver stays flat out in the same lane behind the car it has just hopped over (kept slower by the test)
  // (left alone, the car is moved half a metre away by the steering disturbance and goes past: here its driver steers back)
  const { race, a, b } = rearHop();
  const lane = a.d;
  let landedAt = -1;
  const backInLane = () => Math.max(-0.4, Math.min(0.4, (lane - a.d) * 0.3 - a.headingError * 2.2));
  const events = stepThrough({ race }, 6, { throttleA: 1, throttleB: 0.25, steerA: backInLane }, (i, t) => { if (landedAt < 0 && a.landKind === LANDING.RECOVERABLE && a.state === CAR_STATE.RACING) landedAt = t; });
  const mine = events.filter((e) => e.car === a.index && ['hop', 'bump', 'wheel', 'launch', 'crash'].includes(e.type));
  assert.equal(mine.filter((e) => e.type === 'hop').length, 1, 'one hop only');
  // (at the very edge of the cars the same arrival is read as nose to tail or as side by side: bump or wheel contact, both validated)
  const again = mine.filter((e) => e.type === 'bump' || e.type === 'wheel');
  assert.ok(again.length >= 1, 'it caught the car again');
  for (const e of again) assert.ok(e.tick * SIM_DT - landedAt < T.hopSamePairTime, 'inside the time during which it cannot hop over that car again');
  assert.ok(mine.every((e) => e.type !== 'crash') && mine.filter((e) => e.type === 'launch').length === 1, 'and no accident: the tyres are one behind the other, outside the window of E3');
  assert.equal(a.state, CAR_STATE.RACING); assert.equal(b.state, CAR_STATE.RACING);
  assert.ok(T.hopSamePairTime > T.hopRearmTime);
  // over another car it can hop again once re-armed: the memory is for the same car only
  const car = { ...a, landKind: LANDING.RECOVERABLE, launchOther: b.index, clock: 100, rearmClock: 100 - T.hopRearmTime - 0.1, speed: 60 };
  assert.ok(car.clock - car.rearmClock < T.hopSamePairTime && car.clock - car.rearmClock >= T.hopRearmTime);
});

test('frequency: in full races the hop is occasional, and every one of them is a front wheel behind a rear wheel with enough energy', () => {
  // Four complete computer-driven races of 16 cars and 3 laps (two circuits, arcade and competition rules), always the
  // same: with the first rules they gave 10 hops (5, 3, 1 and 1); the statistics over 108 races are in
  // work/benchmarks/hop-frequency-*.json. The budget below is a guard against the hop becoming frequent again.
  let total = 0;
  const perRace = [];
  for (const [circuit, rules] of [['hazelbrook', RULE_PRESETS.arcade], ['meridian-docks', RULE_PRESETS.arcade], ['hazelbrook', RULE_PRESETS.racing], ['meridian-docks', RULE_PRESETS.racing]]) {
    const entries = DRIVERS.slice(0, 15).map((driver) => ({ driver }));
    entries.push({ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0, autoDrive: true });
    const race = new Race({ track: buildTrack(getCircuit(circuit)), laps: 3, entries, rules, difficulty: 'pro', seed: 11 });
    const speeds = race.cars.map(() => 0), lastHop = race.cars.map(() => -1e9), out = [];
    let hops = 0, steps = 0;
    while (race.phase !== RACE_PHASE.FINISHED && steps++ < 120 * 60 * 20) {
      for (let i = 0; i < race.cars.length; i++) speeds[i] = race.cars[i].speed;
      race.step(SIM_DT);
      for (let e = 0; e < race.eventCount; e++) {
        const ev = race.events[e];
        if (ev.type !== 'hop') continue;
        hops++;
        const f = race.cars[ev.car], l = race.cars[ev.other];
        wheelBehindWheel(f, l, out);
        assert.ok(out[0] >= T.hopTyreOverlapMin - 0.1 && out[1] >= T.hopAxleGapMin - 0.1, `${circuit}: hop with ${(out[0] * 100).toFixed(0)} % of the front tyre behind the rear tyre, ${out[1].toFixed(2)} m behind its axle`);
        assert.ok(speeds[ev.car] - speeds[ev.other] >= T.hopClosingSpeed - 0.01 && speeds[ev.car] >= T.hopMinSpeed - 0.01, `${circuit}: hop at ${(speeds[ev.car] * KMH).toFixed(0)} km/h, ${((speeds[ev.car] - speeds[ev.other]) * KMH).toFixed(0)} km/h faster than the car ahead`);
        assert.ok(race.time - lastHop[ev.car] > 10, `${circuit}: not a series of hops of the same car`);
        lastHop[ev.car] = race.time;
      }
      race.eventCount = 0;
    }
    assert.equal(race.phase, RACE_PHASE.FINISHED);
    perRace.push(hops); total += hops;
  }
  assert.ok(total <= 4, `hops in the four races: ${perRace.join(', ')} (at most one per race on average)`);
  assert.ok(perRace.every((n) => n <= 2), `never more than two in a race: ${perRace.join(', ')}`);
});

test('low energy: below the hop thresholds nothing changes, the validated contacts keep their outcome', () => {
  // (the sideways offsets of this test follow the new geometry of the hop: 1.7 m, tyre behind tyre)
  // wheel behind wheel, closing too slowly: the validated bump (the car ahead's speed less 48 km/h)
  const slowClosing = twoCars(track, { gap: 2, lateral: 1.7, speedA: 160 / KMH, speedB: 140 / KMH, straight: 700 });
  const log1 = run(slowClosing.race, 1.2, { throttleA: 0.6, throttleB: 0.5 });
  const bump = first(log1, 'bump');
  assert.ok(bump && !first(log1, 'launch'), 'bump, no flight');
  const at = log1.atEvent(bump);
  assert.ok(at.a.speed - at.b.speed < T.hopClosingSpeed, 'below the closing speed of a hop');
  assert.ok(Math.abs(at.b.speed - log1.frames[bump.frame].a.speed - T.bumpSeparation) < 0.5, 'the bump rule is unchanged');
  // fast enough in closing speed, but too slow a car
  const slowCar = twoCars(track, { gap: 2, lateral: 1.7, speedA: 110 / KMH, speedB: 60 / KMH, straight: 700 });
  const log2 = run(slowCar.race, 1, { throttleA: 0.5, throttleB: 0.3 });
  assert.ok(first(log2, 'bump') && !first(log2, 'launch'), 'too slow: bump, no flight');
  assert.ok(log2.atEvent(first(log2, 'bump')).a.speed < T.hopMinSpeed);
  // the energies that gave a hop before the thresholds were raised (40 km/h of closing speed; 140 km/h): bumps now
  for (const [speedA, speedB, why] of [[192, 150, 'closing speed'], [140, 90, 'speed']]) {
    const before = twoCars(track, { gap: 2, lateral: 1.7, speedA: speedA / KMH, speedB: speedB / KMH, straight: 700 });
    const log = run(before.race, 1.2, { throttleA: 0.45, throttleB: 0.45 });
    const hit = first(log, 'bump');
    assert.ok(hit && !first(log, 'launch'), `${speedA} km/h onto ${speedB}: bump, no flight (${why})`);
    const at2 = log.atEvent(hit), closing = (at2.a.speed - at2.b.speed) * KMH;
    assert.ok(closing > 36 && at2.a.speed * KMH > 119, `it would have hopped with the first thresholds (${closing.toFixed(0)} km/h of closing speed at ${(at2.a.speed * KMH).toFixed(0)} km/h)`);
    assert.ok(why === 'closing speed' ? at2.a.speed - at2.b.speed < T.hopClosingSpeed : at2.a.speed < T.hopMinSpeed);
  }
  assert.ok(T.hopClosingSpeed * KMH >= 45 && T.hopMinSpeed * KMH >= 150, 'above the two validated reference contacts (E2: about 25 km/h of closing speed; E4: about 41)');
  // hop energy but nose to tail in line: no wheel to ride over
  const inLine = twoCars(track, { gap: 2, lateral: 0, speedA: 200 / KMH, speedB: 150 / KMH, straight: 700 });
  const log3 = run(inLine.race, 1, { throttleA: 1, throttleB: 0.6 });
  assert.ok(first(log3, 'bump') && !first(log3, 'launch'), 'in line: bump, no flight');
  // side by side, wheels interlocked, at the speeds of E2: the validated wheel contact (about 96 km/h for the faster car)
  const e2 = twoCars(track, { gap: 0.6, lateral: 2.15, speedA: 145 / KMH, speedB: 120 / KMH, steerA: 0.25 });
  const log4 = run(e2.race, 1.2, { throttleA: 0.2, throttleB: 0.5, steerA: (t) => (t < 0.35 ? 0.3 : 0) });
  const wheel = first(log4, 'wheel');
  assert.ok(wheel && !first(log4, 'launch'), 'E2: wheel contact, no flight');
  assert.ok(wheel.value * KMH > 80 && wheel.value * KMH < 100, `E2 penalty unchanged (${(wheel.value * KMH).toFixed(1)} km/h)`);
  // the crash rule switched off (no accidents): no hop either
  const off = rearHop({ rules: { ...RULE_PRESETS.arcade, crashes: false } });
  const log5 = run(off.race, 1, { throttleA: 1, throttleB: 0.6 });
  assert.ok(!first(log5, 'launch') && first(log5, 'bump'), 'accidents switched off: bump');
});

test('the hard accident E3 is kept: same contact with more energy, hard landing, wreck', () => {
  assert.ok(T.hopClosingSpeed < T.launchClosingSpeed && T.hopMinSpeed < T.launchMinSpeed, 'the hop sits below the accident');
  const { race, a, b } = twoCars(track, { gap: 2.5, lateral: 0.93, speedA: 262 / KMH, speedB: 190 / KMH, straight: 700 });
  const log = run(race, 6, { throttleA: 1, throttleB: 0.7 });
  const launch = first(log, 'launch'), landing = first(log, 'landing');
  assert.ok(launch && landing && !first(log, 'hop'), 'launch, not a hop');
  assert.equal(log.frames[launch.frame].a.state, CAR_STATE.AIRBORNE);
  assert.equal(a.airKind, LANDING.HARD); assert.equal(landing.value, LANDING.HARD);
  assert.ok(Math.abs(landing.time - launch.time - T.flightTimeCar) < 2 * SIM_DT, 'flight of 0.85 s');
  assert.ok(Math.abs(Math.max(...log.frames.map((f) => f.a.airHeight)) - T.airPeakHeight) < 0.01, 'peak of 1.3 m');
  const landed = log.frames[landing.frame];
  assert.equal(landed.a.state, CAR_STATE.WRECKED);
  assert.ok(Math.abs(landed.a.speed / log.atEvent(landing).a.speed - T.hardLandingSpeedFactor) < 0.01, 'speed cut to 15 %');
  assert.ok(first(log, 'crash') && first(log, 'restart'), 'explosion, then restart');
  const restart = first(log, 'restart');
  assert.ok(Math.abs(restart.time - landing.time - (T.hardLandingStopTime + T.wreckHoldTime)) < 0.05, 'standstill of 3.2 s after the stop');
  assert.equal(b.state, CAR_STATE.RACING);
});

test('the launch on a board E5 is kept: light landing, slide, no hop', () => {
  const tr = buildTrack(getCircuit('hazelbrook'));
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
  const race = new Race({ track: tr, laps: 2, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 3 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const car = race.playerCars[0], o = race.obstacles[0];
  placeCar(car, tr, o.s - 25, o.d);
  car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = 240 / KMH; car.gear = 5;
  const events = [];
  let peak = 0, stateAfterLanding = -1;
  for (let i = 0; i < 2 / SIM_DT; i++) {
    race.setPlayerInput(0, 0, 0, 0, 0, false, false);
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) if (race.events[e].car === car.index) { events.push({ type: race.events[e].type, value: race.events[e].value, tick: i }); if (race.events[e].type === 'landing') stateAfterLanding = car.state; }
    race.eventCount = 0;
    peak = Math.max(peak, car.airHeight);
  }
  const launch = events.find((e) => e.type === 'launch'), landing = events.find((e) => e.type === 'landing');
  assert.ok(launch && landing && events.every((e) => e.type !== 'hop' && e.type !== 'crash'), 'launch and landing, no hop, no explosion');
  assert.equal(landing.value, LANDING.LIGHT); assert.equal(car.landKind, LANDING.LIGHT);
  assert.ok(Math.abs((landing.tick - launch.tick) * SIM_DT - T.flightTimeObstacle) < 2 * SIM_DT, 'flight of 0.6 s');
  assert.ok(Math.abs(peak - T.airPeakHeight * (T.flightTimeObstacle / T.flightTimeCar) ** 2) < 0.01, 'same height as before');
  assert.equal(stateAfterLanding, CAR_STATE.SPIN, 'it slides out of control');
  assert.equal(hopSteerKick(car), 0);
});

test('deterministic at 120 Hz: the same hop gives the same race, step for step', () => {
  assert.equal(SIM_DT, 1 / 120);
  const record = () => {
    const setup = rearHop();
    const trace = [];
    const events = stepThrough(setup, 3, { throttleA: 1, throttleB: 0.6 }, () => { for (const c of [setup.a, setup.b]) trace.push(c.x, c.z, c.heading, c.speed, c.state, c.airHeight, c.steer); });
    return { trace, events };
  };
  const one = record(), two = record();
  assert.ok(one.events.some((e) => e.type === 'hop'));
  assert.deepEqual(one.events, two.events);
  assert.equal(one.trace.length, two.trace.length);
  for (let i = 0; i < one.trace.length; i++) if (one.trace[i] !== two.trace[i]) assert.fail(`traces differ at value ${i}: ${one.trace[i]} against ${two.trace[i]}`);
  // the staging is a function of the simulated state only: the view pitch is the same however often it is sampled
  const car = { state: CAR_STATE.AIRBORNE, airKind: LANDING.RECOVERABLE, airTime: 0.2, airDuration: T.hopFlightTime, clock: 5, landClock: -10 };
  assert.equal(crashPitch(car), crashPitch({ ...car }));
  assert.ok(crashPitch(car) < 0 && Math.abs(crashPitch(car)) <= C.hopNoseUp, 'nose up, far less than in the accident');
  const landed = (t) => crashPitch({ state: CAR_STATE.RACING, landKind: LANDING.RECOVERABLE, clock: 5 + t, landClock: 5 });
  assert.ok(landed(0.01) > 0 && landed(0.01) <= C.hopNoseDown + 1e-9 && C.hopNoseDown < C.noseDown / 2, 'a small dip at the landing: the horizon stays in the picture');
  assert.equal(landed(crashPitchDuration('hop') + 0.01), 0);
  assert.ok(crashPitchDuration('hop') < 0.5 && crashPitchDuration('hop') < crashPitchDuration(true) / 3, 'level again within half a second');
});

test('no car is driven through: in flight and at the landing the hopping car stays clear of every other car', () => {
  // from behind: it comes down behind the car it rode over, without gaining ground on it
  const rear = rearHop();
  let launchAlong = null, worst = 0, landed = false;
  const along = (a, b) => (b.x - a.x) * Math.cos(a.heading) + (b.z - a.z) * Math.sin(a.heading);
  stepThrough(rear, 1.6, { throttleA: 1, throttleB: 0.6 }, () => {
    const { a, b } = rear;
    if (a.state === CAR_STATE.AIRBORNE && launchAlong === null) launchAlong = along(a, b);
    if (launchAlong === null) return;
    worst = Math.max(worst, boxOverlap(a, b));
    if (a.state === CAR_STATE.AIRBORNE) assert.ok(along(a, b) > launchAlong - 0.05, 'no ground gained on the car ahead during the flight');
    if (!landed && a.state === CAR_STATE.RACING) { landed = true; assert.equal(boxOverlap(a, b), 0, 'clear of it at the landing'); assert.ok(along(a, b) > 0, 'still behind it'); }
  });
  assert.ok(landed && worst < 0.03, `largest overlap with the car ahead: ${worst.toFixed(3)} m`);
  // from the side, with a third car running alongside on the other side: the hop is thrown toward it and must not land in it
  const side = sideHop();
  const third = side.race.cars.find((c) => !c.isHuman);
  placeCar(third, track, side.a.s + 1.5, side.a.d - 2.05);
  third.state = CAR_STATE.RACING; third.ghostTimer = 0; third.speed = 200 / KMH; third.gear = side.a.gear; third.isHuman = true; third.inThrottle = 0.6;
  let hopped = false, landedSide = false, worstB = 0, worstC = 0;
  stepThrough(side, 1.6, { throttleA: 0.8, throttleB: 0.6 }, () => {
    const { a, b } = side;
    third.inThrottle = 0.6; third.inSteer = 0;
    if (a.state === CAR_STATE.AIRBORNE) hopped = true;
    if (!hopped) return;
    worstB = Math.max(worstB, boxOverlap(a, b)); worstC = Math.max(worstC, boxOverlap(a, third));
    if (!landedSide && a.state === CAR_STATE.RACING) { landedSide = true; assert.equal(boxOverlap(a, b), 0, 'clear of the car it touched'); assert.equal(boxOverlap(a, third), 0, 'clear of the third car'); }
  });
  assert.ok(hopped && landedSide, 'the side hop happened');
  assert.ok(worstB < 0.03 && worstC < 0.03, `largest overlaps: ${worstB.toFixed(3)} m with the car touched, ${worstC.toFixed(3)} m with the third car`);
  assert.equal(third.state, CAR_STATE.RACING);
});

test('a car that has just come down cannot be thrown in the air again at once', () => {
  const { race, a } = rearHop();
  const events = stepThrough({ race }, 3.5, { throttleA: 1, throttleB: 0.3 });
  const launches = events.filter((e) => e.type === 'launch' && e.car === a.index), landing = events.find((e) => e.type === 'landing');
  assert.ok(launches.length >= 1 && landing);
  for (const l of launches.slice(1)) assert.ok((l.tick - landing.tick) * SIM_DT >= T.hopRearmTime - SIM_DT, 'next launch only after the re-arm time');
});

test('the landing of a hop is settled before contacts are looked for, whichever car comes first in the list', () => {
  // (the car ahead has the lower index here: its pair with the hopping car is examined before that car's own turn)
  for (const swap of [false, true]) {
    const setup = rearHop();
    const { race } = setup;
    const follower = swap ? setup.b : setup.a, leader = swap ? setup.a : setup.b;
    if (swap) {
      // exchange the places of the two cars: the one with the higher index is now behind
      const s = [setup.a.s, setup.a.d, setup.a.speed, setup.a.gear], l = [setup.b.s, setup.b.d, setup.b.speed, setup.b.gear];
      placeCar(setup.a, track, l[0], l[1]); setup.a.speed = l[2]; setup.a.gear = l[3]; setup.a.state = CAR_STATE.RACING;
      placeCar(setup.b, track, s[0], s[1]); setup.b.speed = s[2]; setup.b.gear = s[3]; setup.b.state = CAR_STATE.RACING;
    }
    const events = [];
    for (let i = 0; i < 1.2 / SIM_DT; i++) {
      race.setPlayerInput(follower.playerIndex, 0, 1, 0, 0, false, false); race.setPlayerInput(leader.playerIndex, 0, 0.6, 0, 0, false, false);
      race.step(SIM_DT);
      for (let e = 0; e < race.eventCount; e++) events.push({ type: race.events[e].type, car: race.events[e].car, tick: i });
      race.eventCount = 0;
    }
    const landing = events.find((e) => e.type === 'landing');
    assert.ok(landing && landing.car === follower.index, `hop of the car behind (index ${follower.index})`);
    assert.ok(events.every((e) => e.type !== 'bump' && e.type !== 'wheel'), `no bump or rubbing at the landing (car behind has index ${follower.index})`);
  }
});
