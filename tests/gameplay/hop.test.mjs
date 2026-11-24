// Recoverable hop: the intermediate level between a contact without consequence on the trajectory
// and the hard accident (E3). An original gameplay choice, not shown by the reference footage.
// Since lot 5 (decisions of the player after the trials of PR #4) it comes from a contact between
// wheels and nothing else: the front wheel of the car behind runs into the back of a rear wheel of the
// car ahead and climbs it. The car flies over the car it touched, comes down AHEAD of it on its wheels,
// its steering is disturbed for a moment, and it drives on. (What triggers it is tested in
// wheel-contacts.test.mjs; this file is about the flight, the landing and what follows.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE, LANDING, hopSteerKick, startHop } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { crashPitch, crashPitchDuration, CRASH_CAMERA as C } from '../../src/rendering/compositing/crash-camera.js';
import { twoCars, run, KMH, holdSpeed, bodyOverlap, relativeTo } from './collision-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));

/**
 * The reference hop of these tests: 215 km/h onto a car doing 150 km/h, 1.95 m to its left: the right
 * front wheel runs into the back of its left rear wheel, the bodies of the two cars 9 cm apart.
 */
const KMH_A = 215, KMH_B = 150;
const wheelHop = (options = {}) => twoCars(track, { gap: 4, lateral: 1.95, speedA: (options.kmhA ?? KMH_A) / KMH, speedB: (options.kmhB ?? KMH_B) / KMH, straight: 700, ...options });
const first = (log, type) => log.events.find((e) => e.type === type);
const holding = (setup, more = {}) => ({ throttleA: holdSpeed(setup.a, setup.kmhA ?? KMH_A), throttleB: holdSpeed(setup.b, setup.kmhB ?? KMH_B), ...more });
const length = (a, b) => a.params.halfLength + b.params.halfLength;

/** Step a race built by twoCars, tick by tick, with a callback after each tick. Returns the events. */
function stepThrough(setup, seconds, inputs, each) {
  const { race } = setup, events = [];
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    const t = i * SIM_DT, val = (v) => (typeof v === 'function' ? v(t) : v ?? 0);
    race.setPlayerInput(0, val(inputs.steerA), val(inputs.throttleA), val(inputs.brakeA), 0, false, false);
    race.setPlayerInput(1, 0, val(inputs.throttleB), val(inputs.brakeB), 0, false, false);
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) events.push({ type: race.events[e].type, car: race.events[e].car, other: race.events[e].other, value: race.events[e].value, tick: i });
    race.eventCount = 0;
    if (each) each(i, t + SIM_DT);
  }
  return events;
}

test('recoverable hop: a front wheel on a rear wheel lifts the car behind; it flies, comes down on its wheels and drives', () => {
  const setup = wheelHop();
  const { race, a, b } = setup;
  const log = run(race, 1.8, holding(setup));
  const launch = first(log, 'launch'), hop = first(log, 'hop'), landing = first(log, 'landing');
  assert.ok(launch && hop && landing, 'launch, hop and landing events');
  assert.equal(hop.car, a.index); assert.equal(hop.other, b.index); assert.equal(hop.time, launch.time);
  const before = log.atEvent(launch), flying = log.frames[launch.frame];
  assert.equal(flying.a.state, CAR_STATE.AIRBORNE);
  assert.ok(before.a.speed - before.b.speed >= T.hopClosingSpeed, `closing speed ${((before.a.speed - before.b.speed) * KMH).toFixed(0)} km/h`);
  // a flight between the shortest and the longest hop, lower than the accident
  const flight = landing.time - launch.time;
  assert.ok(flight >= T.hopFlightTime - SIM_DT && flight <= T.hopFlightTimeMax + 2 * SIM_DT, `flight ${flight.toFixed(3)} s`);
  const peak = Math.max(...log.frames.map((f) => f.a.airHeight));
  assert.ok(peak >= T.hopPeakHeight - 0.02 && peak < T.airPeakHeight, `peak ${peak.toFixed(2)} m: visible, lower than the accident`);
  // it comes down on its wheels and drives: no wreck, no slide, no explosion
  assert.equal(landing.value, LANDING.RECOVERABLE);
  const landed = log.frames[landing.frame];
  assert.equal(landed.a.state, CAR_STATE.RACING, 'driving again in the step where it lands');
  assert.equal(a.landKind, LANDING.RECOVERABLE); assert.equal(a.landHard, false);
  assert.ok(log.events.every((e) => e.type !== 'crash' && e.type !== 'reset' && e.type !== 'restart' && e.type !== 'bump' && e.type !== 'wheel'), 'no explosion, no repositioning, no other contact');
  // the car ahead is not disturbed
  assert.ok(Math.abs(flying.b.speed - before.b.speed) < 0.3 && b.state === CAR_STATE.RACING);
  assert.ok(Math.abs(log.frames.at(-1).b.d - log.start.b.d) < 0.05, 'and keeps its line');
});

test('the hop clears the car that caused it: it flies past it and comes down ahead of it, without ever being moved', () => {
  const setup = wheelHop();
  const { a, b } = setup;
  let launchTick = -1, landTick = -1, atLaunch = null, atLanding = null, worstAfter = 0, lowest = Infinity;
  let px = a.x, pz = a.z;
  stepThrough(setup, 4, holding(setup), (i) => {
    const flying = a.state === CAR_STATE.AIRBORNE;
    // no teleport: at every step of the flight the car is where its velocity takes it, to the micrometre
    if (flying && launchTick >= 0) assert.ok(Math.hypot(a.x - px - a.velX * SIM_DT, a.z - pz - a.velZ * SIM_DT) < 1e-6, `flight step ${i}: moved by its own velocity only`);
    // nor at any other step of the scene: never further in a step than its speed allows (plus the few centimetres of a contact)
    assert.ok(Math.hypot(a.x - px, a.z - pz) < Math.max(Math.abs(a.speed), Math.hypot(a.velX, a.velZ)) * SIM_DT + 0.08, `step ${i}: no jump of position`);
    px = a.x; pz = a.z;
    if (flying && launchTick < 0) { launchTick = i; atLaunch = relativeTo(a, b); }
    if (launchTick >= 0 && landTick < 0 && !flying) { landTick = i; atLanding = relativeTo(a, b); assert.equal(bodyOverlap(a, b), 0, 'clear of the other car as it lands'); }
    if (landTick >= 0) { worstAfter = Math.max(worstAfter, bodyOverlap(a, b)); lowest = Math.min(lowest, relativeTo(a, b).ahead); }
  });
  assert.ok(launchTick > 0 && landTick > launchTick, 'the hop happened');
  assert.ok(atLaunch.ahead < -3.3 && atLaunch.ahead > -3.7, `it takes off behind the other car (${atLaunch.ahead.toFixed(2)} m: front wheel against rear wheel)`);
  assert.ok(atLanding.ahead >= length(a, b) + T.flightClearance - 0.15, `it lands ahead of it: ${atLanding.ahead.toFixed(2)} m between centres, its tail ${(atLanding.ahead - length(a, b)).toFixed(2)} m ahead of the other nose`);
  assert.ok(Math.abs(atLanding.right - atLaunch.right) < 0.02, 'the flight is straight: no step to the side');
  // after the landing: never overlapping, and it stays ahead (it lands at least as fast as the other car)
  assert.equal(worstAfter, 0, 'no car is driven through after the landing');
  assert.ok(lowest >= atLanding.ahead - 0.05, 'the car it flew over does not come back on it');
});

test('what a hop costs is the time in the air: nothing at the shock, the loss of any flight, nothing at the landing', () => {
  const setup = wheelHop();
  const { a, b } = setup;
  const speeds = [], leader = [];
  let launchTick = -1, landTick = -1;
  stepThrough(setup, 2.6, holding(setup), (i) => {
    speeds.push(a.speed); leader.push(b.speed);
    if (launchTick < 0 && a.state === CAR_STATE.AIRBORNE) launchTick = i;
    if (launchTick >= 0 && landTick < 0 && a.state === CAR_STATE.RACING) landTick = i;
  });
  assert.ok(launchTick > 0 && landTick > launchTick, 'the hop happened');
  // at the shock: no step of speed (the car needs its speed to get past)
  assert.ok(Math.abs(speeds[launchTick] - speeds[launchTick - 1]) < 0.2, `change of speed at the shock: ${((speeds[launchTick] - speeds[launchTick - 1]) * KMH).toFixed(2)} km/h`);
  // in the air: the steady loss of any flight, step after step
  assert.equal(T.hopAirDecel, T.airDecel, 'the same loss as in any flight');
  for (let i = launchTick + 1; i < landTick; i++) assert.ok(Math.abs(speeds[i - 1] - speeds[i] - T.hopAirDecel * SIM_DT) < 1e-9, `flight step ${i}`);
  // as the wheels touch down: no step (only that same steady loss, for the last step of the flight)
  const atLanding = speeds[landTick - 1] - speeds[landTick];
  assert.ok(Math.abs(atLanding - T.hopAirDecel * SIM_DT) < 1e-6, `change of speed in the landing step: ${(atLanding * KMH).toFixed(3)} km/h`);
  assert.equal(T.hopLandingSpeedFactor, 1);
  // the whole cost: the loss of the flight
  const flight = (landTick - launchTick) * SIM_DT, cost = speeds[launchTick - 1] - speeds[landTick];
  assert.ok(Math.abs(cost - T.hopAirDecel * flight) < 0.35, `${(cost * KMH).toFixed(0)} km/h lost in ${flight.toFixed(2)} s of flight`);
  // it lands at least as fast as the car it flew over: the two do not meet again
  assert.ok(speeds[landTick] >= leader[landTick] - 0.1, `lands at ${(speeds[landTick] * KMH).toFixed(0)} km/h, the other car at ${(leader[landTick] * KMH).toFixed(0)}`);
  // and afterwards the car drives: over the following second no step of speed either
  for (let i = landTick + 1; i < landTick + 120; i++) assert.ok(Math.abs(speeds[i] - speeds[i - 1]) < 0.25, `step ${i} after the landing: ${((speeds[i] - speeds[i - 1]) * KMH).toFixed(2)} km/h`);
  // the car is never sped up by a hop
  const car = { ...a, state: CAR_STATE.RACING, heading: 0, vLat: 0, velX: 0, velZ: 0, speed: 40, clock: 100, rearmClock: -10 };
  startHop(car, null, 1, 1, 0.6);
  assert.equal(Math.hypot(car.velX, car.velZ), 40);
  assert.equal(car.airDuration, 0.6); assert.equal(car.airKind, LANDING.RECOVERABLE);
});

test('a slower arrival needs a longer flight to get past; too slow to get past, the car does not take off', () => {
  const flights = [];
  for (const kmhA of [205, 208, 211, 215, 222, 230, 245, 262]) {
    const setup = wheelHop({ kmhA });
    setup.kmhA = kmhA;
    const { a, b } = setup;
    const log = run(setup.race, 1.8, holding(setup));
    const launch = first(log, 'launch'), landing = first(log, 'landing');
    if (!launch) { flights.push({ kmhA, flight: null }); assert.equal(log.events.filter((e) => ['bump', 'wheel', 'contact'].includes(e.type)).length, 0, `${kmhA} km/h: no take-off and no other contact`); continue; }
    const at = log.frames[landing.frame], gap = ((at.a.s - at.b.s + track.length * 1.5) % track.length) - track.length / 2 - length(a, b);
    flights.push({ kmhA, flight: landing.time - launch.time, gap, peak: Math.max(...log.frames.map((f) => f.a.airHeight)) });
    assert.ok(gap >= T.flightClearance - 0.15, `${kmhA} km/h: lands ${gap.toFixed(2)} m ahead of the nose of the other car`);
    assert.ok(at.a.speed >= at.b.speed - 0.1, `${kmhA} km/h: still at least as fast as the other car`);
  }
  const made = flights.filter((f) => f.flight !== null);
  assert.equal(flights[0].flight, null, `closing at ${flights[0].kmhA - KMH_B} km/h: not enough to get past, no take-off`);
  assert.ok(made.length >= 6, `hops from ${made[0].kmhA - KMH_B} km/h of closing speed`);
  assert.ok(made[0].kmhA - KMH_B >= 55 && made[0].kmhA - KMH_B <= 62, 'the take-off needs about 58 km/h of closing speed');
  for (let i = 1; i < made.length; i++) assert.ok(made[i].flight <= made[i - 1].flight + SIM_DT, `faster arrival, flight not longer (${made.map((f) => f.flight.toFixed(2)).join(' ')})`);
  assert.ok(made[0].flight > 0.7 && made[0].flight <= T.hopFlightTimeMax + 2 * SIM_DT, `the slowest hop is the longest: ${made[0].flight.toFixed(3)} s`);
  assert.ok(Math.abs(made.at(-1).flight - Math.max(T.hopFlightTime, made.at(-1).flight)) < 1e-9 && made.at(-1).flight < 0.55, `the fastest is about the shortest: ${made.at(-1).flight.toFixed(3)} s`);
  // the height follows the time in the air, never under the height of the shortest hop, never above the accident
  for (const f of made) assert.ok(f.peak >= T.hopPeakHeight - 0.01 && f.peak <= T.airPeakHeight * (T.hopFlightTimeMax / T.flightTimeCar) ** 2 + 0.05, `${f.kmhA} km/h: peak ${f.peak.toFixed(2)} m`);
  assert.ok(made[0].peak > made.at(-1).peak, 'the longest hop is the highest');
});

test('the landing waits rather than set the car down on another one: the car ahead speeding up, a third car in the way', () => {
  // the car that is flown over accelerates hard during the flight
  const fleeing = wheelHop({ kmhA: 230 });
  let landed = false, hopped = false;
  stepThrough(fleeing, 2.5, { throttleA: 1, throttleB: (t) => (fleeing.a.state === CAR_STATE.AIRBORNE || hopped ? 1 : holdSpeed(fleeing.b, KMH_B)()) }, () => {
    const { a, b } = fleeing;
    if (a.state === CAR_STATE.AIRBORNE) hopped = true;
    if (hopped && !landed && a.state !== CAR_STATE.AIRBORNE) { landed = true; assert.equal(bodyOverlap(a, b), 0, 'clear of the fleeing car as it lands'); }
    if (landed) assert.equal(bodyOverlap(a, b), 0, 'and never driven through afterwards');
  });
  assert.ok(hopped && landed, 'the hop happened');
  // a third car exactly where the hop would come down
  const reference = wheelHop();
  let spot = null, flightTime = 0, t0 = -1;
  stepThrough(reference, 1.6, holding(reference), (i) => {
    const { a, b } = reference;
    if (a.state === CAR_STATE.AIRBORNE && t0 < 0) t0 = i;
    if (t0 >= 0 && spot === null && a.state === CAR_STATE.RACING) { spot = relativeTo(a, b); flightTime = (i - t0) * SIM_DT; }
  });
  const crowded = wheelHop();
  const third = crowded.race.cars.find((c) => !c.isHuman);
  placeCar(third, track, crowded.b.s + spot.ahead + 1, crowded.b.d + spot.right);
  third.state = CAR_STATE.RACING; third.ghostTimer = 0; third.speed = KMH_B / KMH; third.gear = crowded.b.gear; third.isHuman = true;
  let up = -1, down = -1, worst = 0;
  stepThrough(crowded, 2.2, holding(crowded), (i) => {
    const { a, b } = crowded;
    third.inThrottle = holdSpeed(third, KMH_B)(); third.inSteer = 0;
    if (a.state === CAR_STATE.AIRBORNE && up < 0) up = i;
    if (up >= 0 && down < 0 && a.state !== CAR_STATE.AIRBORNE) { down = i; assert.equal(bodyOverlap(a, third), 0, 'not set down on the third car'); assert.equal(bodyOverlap(a, b), 0); }
    if (down >= 0) worst = Math.max(worst, bodyOverlap(a, third), bodyOverlap(a, b));
  });
  assert.ok(up > 0 && down > up, 'the hop happened with a third car in the way');
  assert.ok((down - up) * SIM_DT > flightTime + 0.02, `the landing waited: ${((down - up) * SIM_DT).toFixed(3)} s in the air instead of ${flightTime.toFixed(3)} s`);
  assert.ok((down - up) * SIM_DT <= flightTime + T.flightHoldMax + T.flightHoldTime + 2 * SIM_DT, 'within the longest wait allowed');
  assert.equal(worst, 0, 'no car driven through after the landing');
  assert.equal(third.state, CAR_STATE.RACING);
});

test('after a hop the driver has the car back: the steering swings once and settles, then answers as on any car', () => {
  const setup = wheelHop();
  const { race, a } = setup;
  let landedAt = -1, headingAtLanding = 0, dAtLanding = 0, maxSwing = 0, maxSide = 0, kicks = 0;
  stepThrough(setup, 2.6, { throttleA: (t) => (landedAt < 0 ? holdSpeed(a, KMH_A)() : 0.5), throttleB: holdSpeed(setup.b, KMH_B) }, (i, t) => {
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
  assert.ok(Math.abs(a.d) > Math.abs(dAtLanding), 'the swing takes it away from the car it touched, not onto it');
  assert.equal(hopSteerKick(a), 0);
  // the steering then answers as on a car that never left the ground, at the same speed
  const turn = (car, r) => { const h0 = car.heading; for (let i = 0; i < 60; i++) { r.setPlayerInput(0, 0.4, 0, 0, 0, false, false); r.setPlayerInput(1, 0, 0.3, 0, 0, false, false); r.step(SIM_DT); r.eventCount = 0; } return car.heading - h0; };
  const speed = a.speed, hopped = turn(a, race);
  const fresh = twoCars(track, { gap: 60, lateral: 4, speedA: speed, speedB: speed, straight: 700 });
  fresh.a.gear = a.gear;
  const reference = turn(fresh.a, fresh.race);
  assert.ok(Math.abs(hopped) > 0.02 && Math.sign(hopped) === Math.sign(reference), 'the car turns the way it is steered');
  assert.ok(Math.abs(hopped - reference) < 0.02 * Math.abs(reference), `same response as an untouched car (${hopped.toFixed(4)} against ${reference.toFixed(4)} rad in half a second)`);
  // left and right alike
  const turnLeft = (car, r) => { const h0 = car.heading; for (let i = 0; i < 60; i++) { r.setPlayerInput(0, -0.4, 0, 0, 0, false, false); r.setPlayerInput(1, 0, 0.3, 0, 0, false, false); r.step(SIM_DT); r.eventCount = 0; } return car.heading - h0; };
  const again = twoCars(track, { gap: 60, lateral: 4, speedA: speed, speedB: speed, straight: 700 });
  again.a.gear = a.gear;
  assert.ok(Math.abs(turnLeft(again.a, again.race) + reference) < 1e-9, 'to the left exactly as to the right');
  // and during the wobble itself the driver is not locked out: holding the wheel to one side turns the car that way
  const down = (s) => s.a.landKind === LANDING.RECOVERABLE && s.a.state === CAR_STATE.RACING;
  for (const steer of [0.5, -0.5]) {
    const held = wheelHop();
    let h0 = null;
    stepThrough(held, 1.9, holding(held, { steerA: () => (down(held) ? steer : 0) }), () => { if (h0 === null && down(held)) h0 = held.a.heading; });
    const free = wheelHop();
    let f0 = null;
    stepThrough(free, 1.9, holding(free), () => { if (f0 === null && down(free)) f0 = free.a.heading; });
    const turned = (held.a.heading - h0) - (free.a.heading - f0);
    assert.ok(Math.abs(turned) > 0.1 && Math.sign(turned) === Math.sign(steer), `steering ${steer > 0 ? 'right' : 'left'} during the wobble turns the car that way (${(turned * 57.3).toFixed(1)} degrees)`);
  }
});

test('a hop never stops the car: no standstill, no explosion, no repositioning, it accelerates again', () => {
  const setup = wheelHop();
  const { a } = setup;
  const states = new Set();
  let landedTick = -1, landedSpeed = 0, landedS = 0, slowest = Infinity;
  const events = stepThrough(setup, 4.4, { throttleA: 1, throttleB: holdSpeed(setup.b, KMH_B) }, (i) => {
    states.add(a.state);
    if (landedTick < 0 && a.landKind === LANDING.RECOVERABLE && a.state === CAR_STATE.RACING) { landedTick = i; landedSpeed = a.speed; landedS = a.progress; }
    if (landedTick >= 0) slowest = Math.min(slowest, a.speed);
    assert.ok(a.ghostTimer <= 0, 'never a ghost');
  });
  assert.ok(landedTick > 0);
  assert.deepEqual([...states].sort(), [CAR_STATE.RACING, CAR_STATE.AIRBORNE], 'only racing and flying: never wrecked, sliding or being put back');
  for (const type of ['crash', 'reset', 'restart', 'manualReset']) assert.ok(events.every((e) => e.type !== type || e.car !== a.index), `no ${type} event`);
  assert.ok(slowest > 40, `never slower than ${(slowest * KMH).toFixed(0)} km/h after the landing`);
  assert.ok(a.speed > landedSpeed + 10, `back on the throttle: ${(landedSpeed * KMH).toFixed(0)} -> ${(a.speed * KMH).toFixed(0)} km/h`);
  assert.ok(a.progress - landedS > 150, 'it goes on round the track');
  assert.equal(a.resets, 0);
});

test('low energy: below the thresholds nothing changes, the validated contacts keep their outcome', () => {
  // the nose on a rear wheel, closing slowly: the validated bump (the speed of the car ahead less 48 km/h)
  const slowClosing = twoCars(track, { gap: 2, lateral: 0.93, speedA: 160 / KMH, speedB: 140 / KMH, straight: 700 });
  const log1 = run(slowClosing.race, 1.2, { throttleA: 0.6, throttleB: 0.5 });
  const bump = first(log1, 'bump');
  assert.ok(bump && !first(log1, 'launch'), 'bump, no flight');
  const at = log1.atEvent(bump);
  assert.ok(Math.abs(at.b.speed - log1.frames[bump.frame].a.speed - T.bumpSeparation) < 0.5, 'the bump rule is unchanged');
  // the same contact with the closing speed that used to give a hop (50 km/h, at 200 km/h): now the same bump
  const former = twoCars(track, { gap: 2, lateral: 0.93, speedA: 200 / KMH, speedB: 150 / KMH, straight: 700 });
  const log2 = run(former.race, 1.2, { throttleA: 1, throttleB: 0.6 });
  const bump2 = first(log2, 'bump');
  assert.ok(bump2 && !first(log2, 'launch') && !first(log2, 'hop'), 'body against wheel: bump, no flight');
  assert.ok(Math.abs(log2.atEvent(bump2).b.speed - log2.frames[bump2.frame].a.speed - T.bumpSeparation) < 0.5, 'with the loss of any bump');
  // nose to tail in line: bump
  const inLine = twoCars(track, { gap: 2, lateral: 0, speedA: 200 / KMH, speedB: 150 / KMH, straight: 700 });
  const log3 = run(inLine.race, 1, { throttleA: 1, throttleB: 0.6 });
  assert.ok(first(log3, 'bump') && !first(log3, 'launch'), 'in line: bump, no flight');
  // side by side, wheels interlocked, at the speeds of E2: the validated wheel contact (about 96 km/h for the faster car)
  const e2 = twoCars(track, { gap: 0.6, lateral: 2.15, speedA: 145 / KMH, speedB: 120 / KMH, steerA: 0.25 });
  const log4 = run(e2.race, 1.2, { throttleA: 0.2, throttleB: 0.5, steerA: (t) => (t < 0.35 ? 0.3 : 0) });
  const wheel = first(log4, 'wheel');
  assert.ok(wheel && !first(log4, 'launch'), 'E2: wheel contact, no flight');
  assert.ok(wheel.value * KMH > 80 && wheel.value * KMH < 100, `E2 penalty unchanged (${(wheel.value * KMH).toFixed(1)} km/h)`);
});

test('the hard accident E3 is kept: the nose on a rear wheel at high energy, hard landing, wreck', () => {
  assert.ok(T.hopMinSpeed < T.launchMinSpeed, 'the accident needs a faster car than the hop');
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
    const setup = wheelHop();
    const trace = [];
    const events = stepThrough(setup, 3, holding(setup), () => { for (const c of [setup.a, setup.b]) trace.push(c.x, c.z, c.heading, c.speed, c.state, c.airHeight, c.steer, c.airDuration); });
    return { trace, events };
  };
  const one = record(), two = record();
  assert.ok(one.events.some((e) => e.type === 'hop'));
  assert.deepEqual(one.events, two.events);
  assert.equal(one.trace.length, two.trace.length);
  for (let i = 0; i < one.trace.length; i++) if (one.trace[i] !== two.trace[i]) assert.fail(`traces differ at value ${i}: ${one.trace[i]} against ${two.trace[i]}`);
  // whichever of the two cars comes first in the list: the same hop (the cars exchanged, the car behind with the higher index)
  const swapped = wheelHop();
  {
    const { a, b } = swapped, s = [a.s, a.d, a.speed, a.gear], l = [b.s, b.d, b.speed, b.gear];
    placeCar(a, track, l[0], l[1]); a.speed = l[2]; a.gear = l[3]; a.state = CAR_STATE.RACING;
    placeCar(b, track, s[0], s[1]); b.speed = s[2]; b.gear = s[3]; b.state = CAR_STATE.RACING;
  }
  const events = [];
  for (let i = 0; i < 1.8 / SIM_DT; i++) {
    swapped.race.setPlayerInput(1, 0, holdSpeed(swapped.b, KMH_A)(), 0, 0, false, false); swapped.race.setPlayerInput(0, 0, holdSpeed(swapped.a, KMH_B)(), 0, 0, false, false);
    swapped.race.step(SIM_DT);
    for (let e = 0; e < swapped.race.eventCount; e++) events.push({ type: swapped.race.events[e].type, car: swapped.race.events[e].car, tick: i });
    swapped.race.eventCount = 0;
  }
  const hop = events.find((e) => e.type === 'hop'), landing = events.find((e) => e.type === 'landing');
  assert.ok(hop && hop.car === swapped.b.index && landing && landing.car === swapped.b.index, 'the car behind hops whatever its index');
  assert.equal(hop.tick, one.events.find((e) => e.type === 'hop').tick, 'at the same step');
  assert.equal(landing.tick, one.events.find((e) => e.type === 'landing').tick, 'and lands at the same step');
  // the staging is a function of the simulated state only: the view pitch is the same however often it is sampled
  const car = { state: CAR_STATE.AIRBORNE, airKind: LANDING.RECOVERABLE, airTime: 0.2, airDuration: T.hopFlightTime, clock: 5, landClock: -10 };
  assert.equal(crashPitch(car), crashPitch({ ...car }));
  assert.ok(crashPitch(car) < 0 && Math.abs(crashPitch(car)) <= C.hopNoseUp, 'nose up, far less than in the accident');
  const landed = (t) => crashPitch({ state: CAR_STATE.RACING, landKind: LANDING.RECOVERABLE, clock: 5 + t, landClock: 5 });
  assert.ok(landed(0.01) > 0 && landed(0.01) <= C.hopNoseDown + 1e-9 && C.hopNoseDown < C.noseDown / 2, 'a small dip at the landing: the horizon stays in the picture');
  assert.equal(landed(crashPitchDuration('hop') + 0.01), 0);
  assert.ok(crashPitchDuration('hop') < 0.5 && crashPitchDuration('hop') < crashPitchDuration(true) / 3, 'level again within half a second');
});

test('a car that has just come down cannot be thrown in the air again at once', () => {
  assert.ok(T.hopRearmTime >= 1);
  // the same wheel contact, the car behind having landed from a hop a moment before: it is not thrown up again
  const justLanded = wheelHop();
  justLanded.a.rearmClock = justLanded.a.clock;
  const log = run(justLanded.race, 1.2, holding(justLanded));
  assert.ok(!first(log, 'launch'), 'inside the re-arm time: no take-off');
  // and once that time has passed it is
  const later = wheelHop();
  later.a.rearmClock = later.a.clock - T.hopRearmTime;
  assert.ok(first(run(later.race, 1.2, holding(later)), 'hop'), 'after the re-arm time: hop');
  // the landing itself starts that time
  const setup = wheelHop();
  let landedClock = null;
  stepThrough(setup, 1.8, holding(setup), () => { if (landedClock === null && setup.a.landKind === LANDING.RECOVERABLE && setup.a.state === CAR_STATE.RACING) landedClock = setup.a.clock; });
  assert.ok(landedClock !== null && Math.abs(setup.a.rearmClock - landedClock) < 1e-9, 'counted from the landing');
});
