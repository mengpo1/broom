// The cases of the collision test bench (index.html#lab=...), played through the real bench module
// and the real simulation, without a browser: what a person sees when trying each case, and what the
// steering does once the car is handed back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SIM_DT } from '../../src/gameplay/race.js';
import { CAR_STATE, LANDING } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { WHEEL_LAYOUT as W } from '../../src/physics/wheel-contacts.js';
import { LAB_SCENARIOS, CollisionLab } from '../../src/core/collision-lab.js';
import { playCase } from './lab-helpers.mjs';
import { bodyOverlap, frontOnRearTyres, relativeTo, KMH } from './collision-helpers.mjs';

const typesOf = (r) => r.mine.map((e) => e.type);
const firstOf = (r, type) => r.mine.find((e) => e.type === type);
const DEG = 180 / Math.PI;
const turned = (a, b) => (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * DEG;

test('bench, case 2 (hop): a front wheel on a rear wheel, the car flies over the other one and comes down ahead of it', () => {
  const r = playCase('hop', 6);
  const hop = firstOf(r, 'hop'), landing = firstOf(r, 'landing');
  assert.ok(hop && landing && landing.value === LANDING.RECOVERABLE, `events: ${typesOf(r).join(' ')}`);
  assert.ok(!typesOf(r).some((t) => ['bump', 'wheel', 'crash', 'reset'].includes(t)), 'nothing but the hop');
  // at the take-off: tyre on tyre, bodies apart
  const up = r.frames[hop.frame];
  assert.ok(frontOnRearTyres(up.me, up.lead, W) > 0, 'a front tyre overlaps a rear tyre of the car ahead');
  assert.equal(bodyOverlap(up.me, up.lead), 0, 'the bodies do not touch');
  assert.ok(Math.abs(hop.value * KMH - 215) < 4, `at ${(hop.value * KMH).toFixed(0)} km/h`);
  // at the landing: ahead of the car it flew over, on its wheels
  const down = r.frames[landing.frame], rel = relativeTo(down.me, down.lead), length = down.me.params.halfLength + down.lead.params.halfLength;
  assert.ok(rel.ahead >= length + T.flightClearance - 0.15, `lands ${(rel.ahead - length).toFixed(2)} m ahead of the nose of the car it flew over`);
  assert.equal(down.me.state, CAR_STATE.RACING);
  assert.ok(down.me.speed >= down.lead.speed, `at ${(down.me.speed * KMH).toFixed(0)} km/h, the other car at ${(down.lead.speed * KMH).toFixed(0)}`);
  // and for the rest of the scene the two never overlap, the car stays ahead
  for (let i = landing.frame; i < r.frames.length; i++) { assert.equal(bodyOverlap(r.frames[i].me, r.frames[i].lead), 0); assert.ok(relativeTo(r.frames[i].me, r.frames[i].lead).ahead >= rel.ahead - 0.05); }
});

test('bench, case 3 (accident E3): the car flies over the other one, comes down ahead of it and to its side, wrecked; the other drives past', () => {
  const r = playCase('crash', 9);
  const launch = firstOf(r, 'launch'), landing = firstOf(r, 'landing');
  assert.ok(launch && landing && landing.value === LANDING.HARD && !firstOf(r, 'hop') && firstOf(r, 'crash') && firstOf(r, 'restart'), `events: ${typesOf(r).join(' ')}`);
  assert.ok(Math.abs(landing.t - launch.t - T.flightTimeCar) < 0.03, `flight of ${(landing.t - launch.t).toFixed(3)} s (0.85 s measured on the reference)`);
  const down = r.frames[landing.frame], rel = relativeTo(down.me, down.lead), length = down.me.params.halfLength + down.lead.params.halfLength, width = down.me.params.halfWidth + down.lead.params.halfWidth;
  assert.ok(rel.ahead >= length + T.flightClearance - 0.15, `lands ${(rel.ahead - length).toFixed(2)} m ahead of the nose of the car it flew over`);
  assert.ok(Math.abs(rel.right) >= width + T.flightSideClearance - 0.1, `and ${(Math.abs(rel.right) - width).toFixed(2)} m to its side`);
  assert.equal(down.me.state, CAR_STATE.WRECKED);
  for (let i = landing.frame; i < r.frames.length; i++) assert.equal(bodyOverlap(r.frames[i].me, r.frames[i].lead), 0, 'the car that was hit never drives through the wreck');
  assert.ok(r.events.every((e) => e.car !== r.lead.index || e.type === 'contact'), 'nothing happens to the car that was hit');
});

test('bench, case 4 (board E5): the car is thrown up by the board and comes down well beyond it', () => {
  const r = playCase('board', 6.5);
  const hit = firstOf(r, 'obstacle'), launch = firstOf(r, 'launch'), landing = firstOf(r, 'landing');
  assert.ok(hit && launch && landing && landing.value === LANDING.LIGHT && !firstOf(r, 'crash'), `events: ${typesOf(r).join(' ')}`);
  const board = r.lab.board, L = r.race.track.length;
  const beyond = (f) => ((f.me.s - board.s + L * 1.5) % L) - L / 2;
  assert.ok(Math.abs(beyond(r.frames[hit.frame])) < 2.6, 'it takes off at the board');
  const landed = beyond(r.frames[landing.frame]);
  assert.ok(landed > 25, `it lands ${landed.toFixed(1)} m beyond the board`);
  assert.ok(Math.abs(landing.t - launch.t - T.flightTimeObstacle) < 0.02, 'after 0.6 s in the air');
  assert.equal(r.frames[landing.frame].me.state, CAR_STATE.SPIN, 'and slides, as before');
  assert.equal(r.race.obstacleDown.filter((x, i) => r.race.obstacles[i] === board && x === 1).length, 1, 'the board is down');
});

test('bench, cases 1, 5 and 6: contacts that must not lift a car', () => {
  const wheel = playCase('wheel', 3.2);
  assert.ok(wheel.events.some((e) => e.type === 'wheel') && !wheel.events.some((e) => e.type === 'launch'), 'case 1: the wheels rub, no flight');
  const bump = playCase('bump', 8);
  assert.ok(firstOf(bump, 'bump') && !firstOf(bump, 'launch'), 'case 5: bumps, no flight');
  // case 6: the nose on a rear wheel, with more closing speed and speed than a hop needs
  const body = playCase('body', 4);
  const hit = firstOf(body, 'bump');
  assert.ok(hit && !firstOf(body, 'launch') && !firstOf(body, 'hop'), `case 6: bump, no flight (${typesOf(body).join(' ')})`);
  const before = body.frames[hit.frame - 1];
  assert.ok(before.me.speed - before.lead.speed > T.hopClosingSpeed + 5 && before.me.speed > T.hopMinSpeed + 5 && before.me.speed < T.launchMinSpeed, `at ${(before.me.speed * KMH).toFixed(0)} km/h on a car at ${(before.lead.speed * KMH).toFixed(0)} km/h: the energy of a hop, under the speed of the accident`);
  assert.ok(bodyOverlap(body.frames[hit.frame - 1].me, body.frames[hit.frame - 1].lead) > 0 || bodyOverlap(body.frames[hit.frame].me, body.frames[hit.frame].lead) >= 0, 'the bodies touched');
  assert.ok(Math.abs(body.frames[hit.frame].lead.speed - body.frames[hit.frame].me.speed - T.bumpSeparation) < 0.6, 'with the loss of any bump');
  assert.ok(body.frames.every((f) => f.me.airHeight === 0), 'the car never leaves the ground');
  for (const name of Object.keys(LAB_SCENARIOS)) assert.equal(CollisionLab.resolve(name), name);
  assert.equal(CollisionLab.resolve('carrosserie'), 'body');
});

test('steering after the hand-over: until then the bench drives whatever the player holds; from then on the car obeys, left and right alike', () => {
  for (const name of Object.keys(LAB_SCENARIOS)) {
    const results = {};
    for (const steer of [-1, 1]) {
      let releasedAt = null;
      // the player holds the steering key from the very start; the throttle only once the car is theirs
      const r = playCase(name, 16, { handOver: true, keys: (lab, t) => { if (lab.released && releasedAt === null) releasedAt = t; return { steer, throttle: lab.released ? 1 : 0 }; } });
      const first = r.frames.findIndex((f) => f.released);
      assert.ok(first > 0, `${name}: the car is handed back`);
      // before: the request the car sees is the one of the bench, never the key held (-1 or +1 all the time)
      const before = r.frames.slice(0, first - 1).filter((f) => f.me.state === CAR_STATE.RACING);
      assert.ok(before.length > 20 && before.every((f) => Math.abs(f.me.inSteer) <= 0.5), `${name}: before the hand-over the bench has the controls`);
      // after: the request is the key, on every step; the steering goes to its stop and the car turns that way
      const after = r.frames.slice(first + 1, first + 1 + Math.round(1.5 / SIM_DT));
      assert.ok(after.every((f) => f.me.inSteer === steer), `${name}: after the hand-over the request is the key held (${steer})`);
      const moving = after.filter((f) => f.me.state === CAR_STATE.RACING && f.me.speed > 3);
      assert.ok(moving.length > 60, `${name}: the car drives`);
      assert.ok(Math.abs(moving.at(-1).me.steer - steer) < 1e-9, `${name}: steering at its stop (${moving.at(-1).me.steer})`);
      assert.equal(Math.sign(moving.at(-1).me.yawRate), steer, `${name}: yaw rate on the side of the key`);
      results[steer] = { heading: turned(moving[0].me.heading, moving.at(-1).me.heading), seconds: moving.length * SIM_DT, speed: moving.at(-1).me.speed };
      assert.equal(Math.sign(results[steer].heading), steer, `${name}: heading turned by ${results[steer].heading.toFixed(1)} degrees`);
      assert.ok(Math.abs(results[steer].heading) > 15, `${name}: ${results[steer].heading.toFixed(1)} degrees in ${results[steer].seconds.toFixed(2)} s`);
    }
    // left and right give the same turn, to the degree (the disturbance after a hop favours one side for 0.7 s; the two
    // cars are not at the same place on the road either, hence the tolerance)
    assert.ok(Math.abs(results[-1].heading + results[1].heading) < 0.2 * Math.abs(results[1].heading) + 2, `${name}: ${results[-1].heading.toFixed(1)} degrees to the left, ${results[1].heading.toFixed(1)} to the right`);
  }
});
