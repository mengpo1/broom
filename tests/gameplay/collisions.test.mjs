// Arcade collisions on the ground: rear-end bumps, wheel-to-wheel contacts, simple contacts and
// roadside boards. Scenarios E2 and E4 of docs/research/vroom-gameplay-analysis.md are replayed
// and compared with the measurements of the report (approximate references, hence tolerances).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { getSceneryLayout } from '../../src/tracks/scenery-layout.js';
import { contactDive } from '../../src/rendering/compositing/crash-camera.js';
import { straightStretch, twoCars, run, KMH } from './collision-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));

test('E4 rear-end bump when following closely: the follower loses about 48 km/h, keeps its line, the car ahead is not disturbed', () => {
  // report: 115 -> 67 km/h and 104 -> 56 km/h while staying behind a car, no change of direction, no launch
  const { race, a, b } = twoCars(track, { gap: 0.3, lateral: 0, speedA: 110 / KMH, speedB: 107 / KMH });
  const log = run(race, 1.2, { throttleA: 0.3, throttleB: 0.3 });
  const bump = log.events.find((e) => e.type === 'bump');
  assert.ok(bump, 'a bump event is emitted');
  assert.equal(bump.car, a.index); assert.equal(bump.other, b.index);
  const before = log.atEvent(bump).a.speed * KMH, after = log.afterFirst('bump', a).speed * KMH, leader = log.atEvent(bump).b.speed * KMH;
  assert.ok(Math.abs(before - 115) < 6, `follower at ${before.toFixed(1)} km/h at the contact (reference 115)`);
  assert.ok(before - after > 46 && before - after < 56, `follower ${before.toFixed(1)} -> ${after.toFixed(1)} km/h (reference 115 -> 67)`);
  // the rule: it leaves the contact 48 km/h slower than the car it hit, so the two separate
  assert.ok(Math.abs(leader - after - T.bumpSeparation * KMH) < 1.5, `car ahead at ${leader.toFixed(1)} km/h, follower at ${after.toFixed(1)}`);
  assert.equal(log.events.filter((e) => e.type === 'bump').length, 1, 'one bump, not a series');
  assert.equal(a.state, CAR_STATE.RACING); assert.equal(b.state, CAR_STATE.RACING);
  assert.ok(Math.abs(a.headingError) < 0.03 && Math.abs(a.d - log.start.a.d) < 0.15, 'the follower keeps its line');
  const leaderGain = log.afterFirst('bump', b).speed - log.atEvent(bump).b.speed;
  assert.ok(Math.abs(leaderGain) < 0.3, `the car ahead is not disturbed (${leaderGain.toFixed(2)} m/s)`);
  assert.ok(log.events.every((e) => e.type !== 'crash' && e.type !== 'launch'), 'no accident');
});

test('E4 rear-end bump at a higher closing speed: the loss grows with the closing speed', () => {
  // report: 145 -> 60 km/h and 146 -> 52 km/h (85 to 94 km/h lost) on the first two contacts
  const { race, a, b } = twoCars(track, { gap: 2, lateral: 0, speedA: 145 / KMH, speedB: 104 / KMH });
  const log = run(race, 0.6, { throttleA: 0.3, throttleB: 0.3 });
  const bump = log.events.find((e) => e.type === 'bump');
  assert.ok(bump, 'bump');
  const before = log.atEvent(bump).a.speed * KMH, after = log.afterFirst('bump', a).speed * KMH;
  assert.ok(after > 50 && after < 62, `follower ${before.toFixed(1)} -> ${after.toFixed(1)} km/h (reference 145 -> 60, 146 -> 52)`);
  assert.ok(before - after > 80 && before - after < 100, `${(before - after).toFixed(1)} km/h lost (reference 85 to 94)`);
  assert.equal(a.state, CAR_STATE.RACING, 'in line and below the launch speed: no flight');
  assert.ok(Math.abs(log.afterFirst('bump', b).speed - log.atEvent(bump).b.speed) < 0.3, 'the car ahead is not thrown forward');
  // against a much slower car the loss is bounded: a bump never brings a car below the floor speed
  const slow = twoCars(track, { gap: 3, lateral: 0, speedA: 145 / KMH, speedB: 50 / KMH });
  const slowLog = run(slow.race, 0.5, { throttleA: 0.5, throttleB: 0.3 });
  assert.ok(slowLog.events.some((e) => e.type === 'bump'));
  assert.ok(slowLog.afterFirst('bump', slow.a).speed >= T.penaltyFloorSpeed - 0.01, 'floor speed');
});

test('repeated bumps: every bump separates the cars; the next one needs a new approach, there is no pushing', () => {
  // the follower keeps the throttle wide open behind a slower car, as in E4 (six bumps in 12 s, 1.4 to 4.6 s apart)
  const { race, a, b } = twoCars(track, { gap: 8, lateral: 0, speedA: 110 / KMH, speedB: 80 / KMH });
  const log = run(race, 8, { throttleA: 1, throttleB: 0.3 });
  const bumps = log.events.filter((e) => e.type === 'bump');
  assert.ok(bumps.length >= 3, `several bumps while charging on (${bumps.length})`);
  for (let i = 1; i < bumps.length; i++) {
    const interval = bumps[i].time - bumps[i - 1].time;
    assert.ok(interval > 1.0 && interval < 4.6, `bumps ${interval.toFixed(2)} s apart (reference 1.4 to 4.6)`);
    // between two bumps the cars really came apart: the gap between them opened by more than half a metre
    let widest = 0;
    for (let f = bumps[i - 1].frame; f < bumps[i].frame; f++) widest = Math.max(widest, log.frames[f].b.s - log.frames[f].a.s);
    const touching = log.frames[bumps[i - 1].frame].b.s - log.frames[bumps[i - 1].frame].a.s;
    assert.ok(widest - touching > 0.5, `the cars separated by ${(widest - touching).toFixed(2)} m between two bumps`);
  }
  // every loss of speed of the follower is a bump that was signalled: no silent contact
  for (let f = bumps[0].frame + 1; f < log.frames.length; f++) {
    const drop = log.frames[f - 1].a.speed - log.frames[f].a.speed;
    if (drop > 0.5) assert.ok(bumps.some((e) => e.frame === f), `speed drop of ${(drop * KMH).toFixed(1)} km/h at ${log.frames[f].time.toFixed(2)} s without a bump`);
  }
  assert.equal(a.state, CAR_STATE.RACING);
  assert.ok(a.speed > T.penaltyFloorSpeed - 0.01, 'bumping never stalls the car');
  for (const e of bumps) assert.ok(Math.abs(log.frames[e.frame].b.speed - log.frames[e.frame - 1].b.speed) < 0.3, 'the car ahead is not disturbed by a bump');
});

test('E2 wheel-to-wheel side contact: about 90 km/h lost by the faster car, no swerve, a spark between the wheels', () => {
  // report: "14x" -> "5x" km/h in one step, cars stay side by side, spark for 0.16 s
  const { race, a, b } = twoCars(track, { gap: 0.6, lateral: 2.15, speedA: 145 / KMH, speedB: 120 / KMH, steerA: 0.25 });
  const log = run(race, 1.2, { throttleA: 0.2, throttleB: 0.5, steerA: (t) => (t < 0.35 ? 0.3 : 0) });
  const wheel = log.events.find((e) => e.type === 'wheel');
  assert.ok(wheel, 'a wheel contact event is emitted');
  assert.equal(wheel.car, a.index, 'the faster car pays');
  const lost = wheel.value * KMH;
  assert.ok(lost > 80 && lost < 100, `speed lost: ${lost.toFixed(1)} km/h (reference about 90)`);
  assert.ok(log.events.every((e) => e.type !== 'bump' && e.type !== 'crash' && e.type !== 'launch'));
  assert.equal(a.state, CAR_STATE.RACING); assert.equal(b.state, CAR_STATE.RACING);
  assert.ok(Math.abs(a.headingError) < 0.2 && Math.abs(b.headingError) < 0.1, 'neither car is turned round');
  assert.ok(Math.abs(log.frames[wheel.frame].b.speed - log.atEvent(wheel).b.speed) < 0.5, 'the slower car keeps its speed');
  assert.ok(Math.abs(a.d - b.d) >= 1.7 || Math.abs(b.s - a.s) >= 4, `the cars do not overlap (${Math.abs(a.d - b.d).toFixed(2)} m across, ${Math.abs(b.s - a.s).toFixed(2)} m along)`);
  assert.equal(log.events.filter((e) => e.type === 'wheel').length, 1, 'rubbing does not repeat the penalty at once');
});

test('damage rule (competition): a bump or a launch damages both cars as any contact did; no damage in arcade rules', () => {
  // same scale as the simple contacts: (closing speed - 3 m/s) x 0.008 for each car
  const racing = twoCars(track, { gap: 0.8, lateral: 0, speedA: 150 / KMH, speedB: 100 / KMH, rules: RULE_PRESETS.racing });
  const log = run(racing.race, 0.6, { throttleA: 0.3, throttleB: 0.35 });
  const bump = log.events.find((e) => e.type === 'bump');
  assert.ok(bump, 'bump under competition rules');
  const closing = (log.atEvent(bump).a.speed - log.atEvent(bump).b.speed);
  const expected = (closing - 3) * 0.008;
  assert.ok(expected > 0.05, `closing speed ${closing.toFixed(1)} m/s`);
  assert.ok(Math.abs(racing.a.damage - expected) < 0.02 && Math.abs(racing.b.damage - expected) < 0.02, `damage ${racing.a.damage.toFixed(3)} / ${racing.b.damage.toFixed(3)} for ${expected.toFixed(3)} expected`);
  // pushing on does not add damage tick after tick: only the contacts that cost speed do
  const before = racing.a.damage;
  run(racing.race, 0.5, { throttleA: 1, throttleB: 0.35 });
  assert.equal(racing.a.damage, before, 'no damage while held behind the car ahead');
  // wheel over wheel at speed: the launch contact counts too
  const flight = twoCars(track, { gap: 2, lateral: 0.95, speedA: 262 / KMH, speedB: 188 / KMH, rules: RULE_PRESETS.racing });
  const flightLog = run(flight.race, 0.5, { throttleA: 0.6, throttleB: 0.6 });
  assert.ok(flightLog.events.some((e) => e.type === 'launch'), 'launch under competition rules');
  assert.ok(flight.a.damage > 0.08 && flight.b.damage > 0.08, `launch damage ${flight.a.damage.toFixed(3)} / ${flight.b.damage.toFixed(3)}`);
  // arcade rules: never any damage
  const arcade = twoCars(track, { gap: 0.8, lateral: 0, speedA: 150 / KMH, speedB: 100 / KMH });
  run(arcade.race, 0.6, { throttleA: 0.3, throttleB: 0.35 });
  assert.equal(arcade.a.damage, 0); assert.equal(arcade.b.damage, 0);
});

test('simple contact: cars crossing at an angle exchange an impulse, without fixed penalty', () => {
  // car A cuts across toward car B (whichever sign of heading does that on this track)
  let setup = null, log = null;
  for (const sign of [1, -1]) {
    setup = twoCars(track, { gap: 1.8, lateral: 6.9, speedA: 25, speedB: 5, headingA: sign * 0.7 });
    log = run(setup.race, 0.8, { throttleA: 0, throttleB: 0 });
    if (log.events.some((e) => e.type === 'contact')) break;
  }
  const { a, b } = setup;
  assert.ok(log.events.some((e) => e.type === 'contact'), 'contact event');
  assert.ok(log.events.every((e) => e.type !== 'bump' && e.type !== 'wheel'), 'not classified as a bump or a wheel contact');
  assert.ok(a.contacts > 0 && b.contacts > 0);
});

test('contact dive of the view: 5 to 8 % of the view height, over in 0.4 s, driven by the car clock', () => {
  const car = { clock: 10, bumpClock: 10 };
  let peak = 0, peakAt = 0;
  for (let t = 0; t <= 0.5; t += 1 / 240) {
    car.clock = 10 + t;
    const v = contactDive(car);
    assert.ok(v >= 0);
    if (v > peak) { peak = v; peakAt = t; }
  }
  assert.ok(peak >= 0.05 && peak <= 0.08, `peak ${peak}`);
  assert.ok(Math.abs(peakAt - T.contactDiveIn) < 0.02, `peak at ${peakAt}s`);
  car.clock = 10 + T.contactDiveIn + T.contactDiveOut; assert.equal(contactDive(car), 0);
  car.clock = 9.9; assert.equal(contactDive(car), 0);
  // same state, same value: nothing depends on how often it is sampled
  car.clock = 10.1; assert.equal(contactDive(car), contactDive({ clock: 10.1, bumpClock: 10 }));
});

test('roadside boards: solid objects on the verge, never on the asphalt, the same for the race and the scenery', () => {
  for (const id of ['hazelbrook', 'kestrel-fields', 'ouarzane', 'kagerou-hills']) {
    const tr = buildTrack(getCircuit(id));
    const layout = getSceneryLayout(tr);
    assert.equal(getSceneryLayout(tr), layout, 'one layout per track');
    assert.ok(layout.obstacles.length >= 3, `${id}: ${layout.obstacles.length} boards`);
    for (const o of layout.obstacles) {
      const prop = layout.props[o.prop];
      assert.equal(prop.obstacle, o.index); assert.equal(prop.s, o.s); assert.equal(prop.d, o.d);
      const i = Math.floor(o.s / tr.ds) % tr.n;
      const barrier = o.d > 0 ? tr.barrierR[i] : tr.barrierL[i];
      assert.ok(Math.abs(o.d) - o.halfWidth > tr.halfWidth - 0.05, `${id}: board clear of the asphalt`);
      assert.ok(Math.abs(o.d) < barrier, `${id}: board in front of the barrier`);
    }
  }
});

test('hitting a board below the launch speed: knocked down once, speed cut, the car drives on', () => {
  const tr = buildTrack(getCircuit('hazelbrook'));
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
  const race = new Race({ track: tr, laps: 2, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 3 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const car = race.playerCars[0], o = race.obstacles[0];
  placeCar(car, tr, o.s - 12, o.d);
  car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = 30; car.gear = 3;
  let hit = null, speedBefore = 0;
  for (let i = 0; i < 1.2 / SIM_DT; i++) {
    race.setPlayerInput(0, 0, 0, 0, 0, false, false);
    const before = car.speed;
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) if (race.events[e].type === 'obstacle' && !hit) { hit = { ...race.events[e] }; speedBefore = before; }
    race.eventCount = 0;
    if (hit && !hit.after) hit.after = car.speed;
  }
  assert.ok(hit, 'obstacle event');
  assert.equal(hit.other, 0); assert.equal(race.obstacleDown[0], 1);
  assert.ok(speedBefore < T.obstacleLaunchSpeed);
  assert.ok(Math.abs(hit.after / speedBefore - T.obstacleSpeedFactor) < 0.06, `speed kept: ${(hit.after / speedBefore).toFixed(2)}`);
  assert.equal(car.state, CAR_STATE.RACING);
  assert.ok(car.bumpClock > 0 && contactDive({ clock: car.bumpClock + 0.1, bumpClock: car.bumpClock }) > 0.03, 'the view dives');
  // driving through the same place again: the board is gone
  placeCar(car, tr, o.s - 12, o.d); car.state = CAR_STATE.RACING; car.speed = 30;
  let again = false;
  for (let i = 0; i < 1.2 / SIM_DT; i++) { race.setPlayerInput(0, 0, 0, 0, 0, false, false); race.step(SIM_DT); for (let e = 0; e < race.eventCount; e++) if (race.events[e].type === 'obstacle') again = true; race.eventCount = 0; }
  assert.ok(!again, 'a board is knocked down only once');
});

test('straight stretch helper finds a flat straight on the test track', () => {
  const s = straightStretch(track, 260);
  assert.ok(s >= 0);
});
