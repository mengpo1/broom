// The wheels in the collision model, and the rule decided on them (lot 5): a recoverable hop comes
// from the front wheel of a car running into the back of a rear wheel of another one, the bodies of
// the two cars not touching, and from nothing else. Every other contact keeps its validated outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { BASE_CAR_SPEC } from '../../src/vehicles/car-spec.js';
import { CAR_STATE, LANDING } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { WHEEL_LAYOUT as W, wheelStrike, wheelRectangles } from '../../src/physics/wheel-contacts.js';
import { CAR_DIMENSIONS } from '../../src/art/vehicles/car-model.js';
import { twoCars, run, KMH, holdSpeed, bodyOverlap, frontOnRearTyres, relativeTo, tyreOf, polygonOverlap } from './collision-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));
const first = (log, type, car) => log.events.find((e) => e.type === type && (car === undefined || e.car === car));

test('the wheels of the collision model are those of the drawing of the car, without the simulation reading the drawing', () => {
  // same figures in the two places (the drawing counts y to the left, the model to the right: the car is symmetrical)
  assert.equal(W.frontAxleX, CAR_DIMENSIONS.frontAxleX); assert.equal(W.rearAxleX, CAR_DIMENSIONS.rearAxleX);
  assert.equal(W.frontTrack, CAR_DIMENSIONS.frontTrack); assert.equal(W.rearTrack, CAR_DIMENSIONS.rearTrack);
  assert.deepEqual(W.frontTyre, CAR_DIMENSIONS.frontTyre); assert.deepEqual(W.rearTyre, CAR_DIMENSIONS.rearTyre);
  assert.ok(Math.abs(W.frontAxleX - W.rearAxleX - BASE_CAR_SPEC.wheelbase) < 1e-9, 'the axles are a wheelbase apart');
  // the tyres stand out of the body sideways and lie inside it lengthwise: two tyres can touch while the bodies do not
  const hw = BASE_CAR_SPEC.collisionHalfWidth, hl = BASE_CAR_SPEC.collisionHalfLength;
  const frontOut = W.frontTrack + W.frontTyre.width / 2 - hw, rearOut = W.rearTrack + W.rearTyre.width / 2 - hw;
  assert.ok(frontOut > 0.08 && frontOut < 0.15 && rearOut > 0.08 && rearOut < 0.15, `tyres ${frontOut.toFixed(3)} m (front) and ${rearOut.toFixed(3)} m (rear) outside the body`);
  assert.ok(W.frontAxleX + W.frontTyre.radius < hl && -W.rearAxleX + W.rearTyre.radius < hl, 'no tyre beyond the nose or the tail of the body');
  // the module that holds them imports nothing from the art folder
  const rects = wheelRectangles({ x: 10, z: -4, heading: 0 });
  assert.deepEqual(rects.map((r) => r.name), ['front.right', 'front.left', 'rear.right', 'rear.left']);
  assert.ok(Math.abs(rects[0].cx - (10 + W.frontAxleX)) < 1e-12 && Math.abs(rects[0].cz - (-4 + W.frontTrack)) < 1e-12, 'right is +z for a car heading along +x');
});

/** A bare car for the geometric test: position, heading, and where it was one step earlier. */
const bare = (x, z, heading, speed, sideSpeed = 0) => ({ x, z, heading, prevX: x - (Math.cos(heading) * speed - Math.sin(heading) * sideSpeed) * SIM_DT, prevZ: z - (Math.sin(heading) * speed + Math.cos(heading) * sideSpeed) * SIM_DT, prevHeading: heading, params: { halfLength: 2.1, halfWidth: 0.93 } });

test('wheel strike: the front wheel must go in through the back of the rear wheel', () => {
  const lead = (speed = 40) => bare(0, 0, 0, speed);
  // distance between centres at which a front tyre reaches the back of a rear tyre, cars parallel
  const reach = W.frontAxleX + W.frontTyre.radius - (W.rearAxleX - W.rearTyre.radius);
  assert.ok(Math.abs(reach - 3.555) < 1e-9);
  const b = lead();
  // from behind, the follower to the LEFT of the leader (negative z): its right front wheel on the left rear wheel
  const out = {};
  const left = bare(-reach + 0.1, -1.95, 0, 58);
  assert.equal(wheelStrike(left, b, 0, out), 1, 'right front wheel');
  assert.equal(out.wheel, -1, 'on the left rear wheel');
  assert.ok(Math.abs(out.depth - 0.1) < 1e-9 && Math.abs(out.overlap - (W.frontTrack + W.frontTyre.width / 2 + W.rearTrack + W.rearTyre.width / 2 - 1.95)) < 1e-9, `gone in by ${out.depth.toFixed(3)} m, ${out.overlap.toFixed(3)} m of tread`);
  // the mirror image gives the other wheel
  assert.equal(wheelStrike(bare(-reach + 0.1, 1.95, 0, 58), b, 0, out), -1, 'left front wheel');
  assert.equal(out.wheel, 1, 'on the right rear wheel');
  // not there yet: no contact
  assert.equal(wheelStrike(bare(-reach - 0.05, -1.95, 0, 58), b), 0, 'still behind: nothing');
  // too far to the side: the tyres pass each other
  assert.equal(wheelStrike(bare(-reach + 0.1, -2.1, 0, 58), b), 0, 'tyres not in line');
  // already inside one step earlier (it did not come in during this step): not a new strike
  assert.equal(wheelStrike(bare(-reach + 0.3, -1.95, 0, 12), b), 0, 'already overlapping: nothing new');
  // the same overlap reached SIDEWAYS: the tyre comes against the flank of the other one, it was not behind it
  // (65 km/h faster than the other car and moving in at 6 m/s: one step earlier the tyres were side by side, 5 cm apart)
  const sideways = bare(-reach + 0.3, -2.06, 0, 58, 6);
  const before = (c) => ({ ...c, x: c.prevX, z: c.prevZ, heading: c.prevHeading });
  assert.ok(polygonOverlap(tyreOf(sideways, W, 'front', 1), tyreOf(b, W, 'rear', -1)) > 0, 'the tyres overlap now');
  assert.equal(polygonOverlap(tyreOf(before(sideways), W, 'front', 1), tyreOf(before(b), W, 'rear', -1)), 0, 'and did not one step earlier');
  assert.ok(before(sideways).x + W.frontAxleX + W.frontTyre.radius > before(b).x + W.rearAxleX - W.rearTyre.radius, 'the front tyre was already alongside, not behind');
  assert.equal(wheelStrike(sideways, b), 0, 'sideways: no strike, whatever the difference of speed');
  // a tyre that only grazes the corner of the other one: below the tread that must be in contact
  const graze = bare(-reach + 0.1, -(W.frontTrack + W.frontTyre.width / 2 + W.rearTrack + W.rearTyre.width / 2) + 0.02, 0, 58);
  assert.equal(wheelStrike(graze, b, 0), 1); assert.equal(wheelStrike(graze, b, T.hopTyreOverlapMin), 0, 'grazing: not enough tread');
  // oblique: the follower turned 10 degrees toward the leader, its wheel going in through the back
  const angle = 10 * Math.PI / 180;
  let found = 0;
  for (let x = -4.2; x < -3.0 && !found; x += 0.02) {
    const o = bare(x, -2.25, angle, 58);
    if (polygonOverlap(tyreOf(o, W, 'front', 1), tyreOf(b, W, 'rear', -1)) > 0) { found = wheelStrike(o, b); assert.equal(found, 1, `oblique strike at x = ${x.toFixed(2)}`); }
  }
  assert.equal(found, 1, 'an oblique arrival through the back is a strike');
  // rear wheel against front wheel (the leader's wheels are never the striking ones)
  assert.equal(wheelStrike(b, bare(-reach + 0.1, -1.95, 0, 58)), 0, 'the car ahead does not strike the car behind');
});

test('wheel strike at an angle: a tyre that passes the back of the other one beside it and then meets its flank is not a strike', () => {
  // (found by an independent review) every arrival of a grid, at 6, 11 and 17 degrees of convergence: the step is cut
  // in 300 and the first instant at which the two tyres touch is looked at. Just before that instant the two tyres are
  // apart: if the front tyre already reaches into the width of the rear tyre, what separates them is the back face,
  // and the touch is on it; if it is still entirely beside the rear tyre, the touch is on the flank.
  const b = bare(0, 0, 0, 36);
  const rl = W.rearTyre.radius, rw = W.rearTyre.width / 2, fl = W.frontTyre.radius, fw = W.frontTyre.width / 2;
  let strikes = 0, flankTouches = 0, flankThePreviousTestAccepted = 0;
  for (const angle of [0.1, 0.2, 0.3]) {
    for (let x = -4.7; x <= -2.9; x += 0.03) {
      for (let z = -3.2; z <= -1.5; z += 0.02) {
        const a = bare(x, z, angle, 70);
        if (polygonOverlap(tyreOf(a, W, 'front', 1), tyreOf(b, W, 'rear', -1)) <= 0) continue;
        const at = (c, k) => ({ ...c, x: c.prevX + (c.x - c.prevX) * k, z: c.prevZ + (c.z - c.prevZ) * k });
        if (polygonOverlap(tyreOf(at(a, 0), W, 'front', 1), tyreOf(at(b, 0), W, 'rear', -1)) > 0) continue;      // already touching one step earlier
        let first = -1;
        for (let k = 1; k <= 300 && first < 0; k++) if (polygonOverlap(tyreOf(at(a, k / 300), W, 'front', 1), tyreOf(at(b, k / 300), W, 'rear', -1)) > 0) first = k;
        // just before the first touch: how far the front tyre (on the left of the other one) reaches into its width
        const tyre = tyreOf(at(a, (first - 1) / 300), W, 'front', 1), leftEdge = at(b, (first - 1) / 300).z - W.rearTrack - rw;
        const reachesIn = Math.max(...tyre.map((p) => p[1])) - leftEdge;
        const throughTheBack = reachesIn > 0.004;
        const strike = wheelStrike(a, b, T.hopTyreOverlapMin);
        if (strike) { strikes++; assert.ok(throughTheBack, `angle ${angle}, car at (${x.toFixed(2)}, ${z.toFixed(2)}): counted as a strike although the first touch is on the flank`); }
        if (!throughTheBack) {
          flankTouches++;
          // what the test accepted before this correction: tyres overlapping now, the front one behind the plane of the back face one step earlier
          const along0 = (a.prevX + Math.cos(angle) * W.frontAxleX - Math.sin(angle) * W.frontTrack) - (b.prevX + W.rearAxleX);
          if (along0 + fl * Math.cos(angle) + fw * Math.sin(angle) <= -rl) flankThePreviousTestAccepted++;
        }
      }
    }
  }
  assert.ok(strikes > 300, `${strikes} strikes through the back face in the grid`);
  assert.ok(flankTouches > 50, `${flankTouches} first touches on the flank, none counted as a strike`);
  assert.ok(flankThePreviousTestAccepted > 0, `${flankThePreviousTestAccepted} of them were counted before the correction`);
});

/** What a contact gave to the car behind: 'hop', 'accident', 'bump', 'rub', 'contact' or 'none'. */
function outcome(log, a) {
  const mine = log.events.filter((e) => e.car === a.index).map((e) => e.type);
  return mine.includes('hop') ? 'hop' : mine.includes('launch') ? 'accident' : mine.includes('bump') ? 'bump' : log.events.some((e) => e.type === 'wheel') ? 'rub' : log.events.some((e) => e.type === 'contact') ? 'contact' : 'none';
}
const arrive = (options, seconds = 1.6, inputs = {}) => {
  const setup = twoCars(track, { gap: 4, straight: 700, ...options, speedA: options.kmhA / KMH, speedB: options.kmhB / KMH });
  const log = run(setup.race, seconds, { throttleA: holdSpeed(setup.a, options.kmhA), throttleB: holdSpeed(setup.b, options.kmhB), ...inputs });
  return { ...setup, log, outcome: outcome(log, setup.a) };
};

test('by kind of contact, with the energy of a hop (215 km/h on a car at 150 km/h): only a wheel on a wheel lifts the car', () => {
  const table = [
    // [what touches, lateral offset between the two cars (m), expected]
    ['nose against tail, in line', 0, 'bump'],
    ['nose against tail, slightly offset', 0.3, 'bump'],
    ['front wing against rear wheel', 1.5, 'bump'],
    ['front wing against rear wheel, at the edge', 1.7, 'bump'],
    ['front wheel on rear wheel', 1.9, 'hop'],
    ['front wheel on rear wheel', 1.95, 'hop'],
    ['front wheel on rear wheel', 2.0, 'hop'],
    ['tyres grazing', 2.06, 'none'],
    ['no contact', 2.1, 'none'],
    ['no contact', 2.4, 'none'],
  ];
  for (const [what, lateral, expected] of table) {
    for (const sign of [1, -1]) {
      const r = arrive({ lateral: lateral * sign, kmhA: 215, kmhB: 150 });
      assert.equal(r.outcome, expected, `${what}, ${lateral * sign} m: ${r.outcome}`);
      if (expected === 'hop') {
        assert.equal(r.a.launchSide, sign > 0 ? 1 : -1, 'the wheel that hit is the one on the side of the other car');
        assert.equal(first(r.log, 'landing', r.a.index).value, LANDING.RECOVERABLE);
        assert.ok(!first(r.log, 'bump') && !first(r.log, 'wheel') && !first(r.log, 'crash'), 'nothing but the hop');
      }
      if (expected === 'none') assert.equal(r.log.events.filter((e) => ['contact', 'bump', 'wheel', 'launch', 'hop'].includes(e.type)).length, 0, `${what}: no event at all`);
    }
  }
  // the nose on a rear wheel (partial overlap of the bodies): never a hop. Below the speed of the accident it is a bump...
  for (const lateral of [0.5, 0.93, 1.3]) assert.equal(arrive({ lateral, kmhA: 175, kmhB: 110 }).outcome, 'bump', `nose on wheel at 175 km/h, ${lateral} m: bump`);
  // ...and with the energy of the accident it is the accident (E3), not a hop
  for (const lateral of [0.5, 0.93, 1.3]) assert.equal(arrive({ lateral, kmhA: 215, kmhB: 150 }).outcome, 'accident', `nose on wheel at 215 km/h, ${lateral} m: accident`);
});

test('side by side: tyres that come together sideways rub (E2) and never lift a car, whatever the difference of speed', () => {
  // the car behind is already alongside the rear of the other one and drifts into it, 65 km/h faster
  for (const gap of [-3.4, -3.0, -2.6]) {
    const r = arrive({ gap, lateral: 2.25, kmhA: 215, kmhB: 150, headingA: 0.04 }, 1.2);
    assert.ok(!first(r.log, 'launch'), `alongside (${gap} m), drifting in: no flight`);
    assert.ok(first(r.log, 'wheel'), `alongside (${gap} m): the wheels rub`);
  }
  // fully alongside at the speeds of E2: the validated wheel contact and its penalty
  const e2 = twoCars(track, { gap: 0.6, lateral: 2.15, speedA: 145 / KMH, speedB: 120 / KMH });
  const log = run(e2.race, 1.2, { throttleA: 0.2, throttleB: 0.5, steerA: (t) => (t < 0.35 ? 0.3 : 0) });
  const wheel = first(log, 'wheel');
  assert.ok(wheel && !first(log, 'launch'), 'E2: wheel contact, no flight');
  assert.ok(wheel.value * KMH > 80 && wheel.value * KMH < 100, `E2 penalty unchanged (${(wheel.value * KMH).toFixed(1)} km/h)`);
});

test('energy and direction: closing speed, speed of the car, angle between the cars, accidents switched off', () => {
  const base = { lateral: 1.95 };
  assert.equal(arrive({ ...base, kmhA: 215, kmhB: 150 }).outcome, 'hop');
  // the wheels touch in every case below, and nothing happens: as before, tyres at the edge of the cars are no obstacle
  assert.equal(arrive({ ...base, kmhA: 180, kmhB: 150 }).outcome, 'none', 'closing at 30 km/h: under hopClosingSpeed');
  assert.equal(arrive({ ...base, kmhA: 110, kmhB: 45 }).outcome, 'none', 'closing fast but too slow a car');
  assert.ok(110 / KMH < T.hopMinSpeed && 30 / KMH < T.hopClosingSpeed);
  assert.equal(arrive({ ...base, kmhA: 215, kmhB: 150, rules: { ...RULE_PRESETS.arcade, crashes: false } }).outcome, 'none', 'accidents switched off: no hop');
  // the car ahead going the other way, or across: never a hop
  const wrongWay = twoCars(track, { gap: 30, lateral: 1.95, speedA: 215 / KMH, speedB: 0, straight: 700 });
  wrongWay.b.heading += Math.PI; wrongWay.b.speed = 60 / KMH;
  assert.ok(!first(run(wrongWay.race, 1, { throttleA: 0.5 }), 'hop'), 'head on: no hop');
});

test('swept over 900 arrivals: every hop starts with a front tyre in the back of a rear tyre and the bodies apart; nothing else lifts a car', (t) => {
  // lateral offsets every 5 cm on both sides, three angles of arrival, three pairs of speeds
  const counts = { hop: 0, accident: 0, bump: 0, rub: 0, contact: 0, none: 0 };
  let runs = 0;
  for (const [kmhA, kmhB] of [[215, 150], [262, 188], [175, 110]]) {
    for (const headingA of [0, 0.05, 0.1]) {
      for (let lateral = -2.5; lateral <= 2.5001; lateral += 0.05) {
        // (the angle turns the car toward the right: toward the other car when it starts on its left)
        const setup = twoCars(track, { gap: 4, lateral, speedA: kmhA / KMH, speedB: kmhB / KMH, headingA, straight: 700 });
        const { race, a, b } = setup;
        let kind = 'none', tyresTouched = false, bodiesTouchedFirst = false;
        for (let i = 0; i < 1.3 / SIM_DT && kind === 'none'; i++) {
          race.setPlayerInput(0, 0, holdSpeed(a, kmhA)(), 0, 0, false, false); race.setPlayerInput(1, 0, holdSpeed(b, kmhB)(), 0, 0, false, false);
          race.step(SIM_DT);
          const types = [];
          for (let e = 0; e < race.eventCount; e++) types.push(race.events[e].type);
          race.eventCount = 0;
          if (types.includes('hop')) {
            kind = 'hop';
            // the independent geometry of the helpers, on the positions of the step where the car took off
            const tyres = frontOnRearTyres(a, b, W), rel = relativeTo(a, b);
            assert.ok(tyres > 0, `hop at ${lateral.toFixed(2)} m, ${headingA} rad: a front tyre overlaps a rear tyre (${tyres.toFixed(3)} m)`);
            assert.equal(bodyOverlap(a, b), 0, `hop at ${lateral.toFixed(2)} m: the bodies do not touch`);
            assert.ok(!bodiesTouchedFirst, `hop at ${lateral.toFixed(2)} m: no contact between the bodies before it`);
            assert.ok(rel.ahead < -(W.frontAxleX - W.rearAxleX) + 0.2, `hop at ${lateral.toFixed(2)} m: the car is behind (${rel.ahead.toFixed(2)} m)`);
            assert.ok(Math.abs(rel.right) > a.params.halfWidth + b.params.halfWidth - 0.35, `hop at ${lateral.toFixed(2)} m: at the edge of the other car (${rel.right.toFixed(2)} m to the side)`);
            assert.ok(a.speed >= T.hopMinSpeed - 0.5, 'fast enough');
          } else if (types.includes('launch')) kind = 'accident';
          else if (types.includes('bump')) kind = 'bump';
          else if (types.includes('wheel')) kind = 'rub';
          else if (types.includes('contact')) kind = 'contact';
          if (kind !== 'none' && kind !== 'hop') bodiesTouchedFirst = true;
          if (frontOnRearTyres(a, b, W) > 0) tyresTouched = true;
        }
        counts[kind]++; runs++;
        if (kind === 'hop') assert.equal(a.state, CAR_STATE.AIRBORNE);
        // when no tyre ever met a tyre there is no hop (stated the other way round above; here: the count is consistent)
        if (!tyresTouched) assert.notEqual(kind, 'hop');
      }
    }
  }
  t.diagnostic(`${runs} arrivals: ${JSON.stringify(counts)}`);
  assert.ok(runs >= 900, `${runs} arrivals`);
  assert.ok(counts.hop > 20 && counts.accident > 50 && counts.bump > 100 && counts.none > 100, `outcomes: ${JSON.stringify(counts)}`);
  // the hops are a small share of the arrivals: the window is the tyres, a hand's width each side
  assert.ok(counts.hop < runs * 0.12, `${counts.hop} hops in ${runs} arrivals`);
});
