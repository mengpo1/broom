// Two local players in one simulation: independent controls, shared classification, contacts
// between players, split-screen layouts and two independent views.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { computeViewRects } from '../../src/multiplayer/split-screen.js';
import { RaceView, CAMERA } from '../../src/rendering/compositing/race-view.js';
import { DEFAULT_EFFECTS } from '../../src/core/config.js';
import { SingleRaceSession } from '../../src/gameplay/sessions.js';

const track = buildTrack(getCircuit('kestrel-fields'));
function duel(opponents = 4) {
  const entries = DRIVERS.slice(0, opponents).map((driver) => ({ driver }));
  entries.push({ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: PLAYER_DRIVERS[1], human: true, playerIndex: 1 });
  const race = new Race({ track, laps: 2, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 9 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  return race;
}

test('both players are in the same race with their own cars', () => {
  const race = duel();
  assert.equal(race.humanCount, 2);
  assert.ok(race.playerCars[0] && race.playerCars[1] && race.playerCars[0] !== race.playerCars[1]);
  assert.equal(race.playerCars[0].playerIndex, 0); assert.equal(race.playerCars[1].playerIndex, 1);
});

test('controls are independent: one accelerates and turns, the other brakes', () => {
  const race = duel();
  for (let i = 0; i < 3 / SIM_DT; i++) {
    race.setPlayerInput(0, 0.04, 1, 0, 0, false, false);
    race.setPlayerInput(1, 0, 0, 1, 0, false, false);
    race.step(SIM_DT); race.eventCount = 0;
  }
  const a = race.playerCars[0], b = race.playerCars[1];
  // (off the grid at full throttle the player may bump the car ahead, which now costs 48 km/h: the bar is lower than free acceleration)
  assert.ok(a.speed > 15, `player 1 accelerated (${a.speed})`);
  assert.ok(b.speed < 1, `player 2 held on the brakes (${b.speed})`);
  assert.ok(a.steer > 0.03 && Math.abs(b.steer) < 1e-6, 'steering inputs are not shared');
  assert.ok(a.throttle === 1 && b.throttle === 0 && b.brake === 1);
});

test('common classification contains both players and the computer drivers', () => {
  const race = duel(4);
  for (let i = 0; i < 8 / SIM_DT; i++) { race.setPlayerInput(0, 0, 1, 0, 0, false, false); race.setPlayerInput(1, 0, 0.5, 0, 0, false, false); race.step(SIM_DT); race.eventCount = 0; }
  const table = race.classification();
  assert.equal(table.length, 6);
  const humans = table.filter((r) => r.isHuman);
  assert.equal(humans.length, 2);
  assert.notEqual(humans[0].position, humans[1].position);
  const p1 = table.find((r) => r.playerIndex === 0), p2 = table.find((r) => r.playerIndex === 1);
  assert.ok(p1.position < p2.position, 'the player at full throttle is ahead of the one at half throttle');
});

test('players collide with each other', () => {
  const race = duel(0);
  const a = race.playerCars[0], b = race.playerCars[1];
  placeCar(a, track, 400, 0); placeCar(b, track, 420, 0);
  a.state = CAR_STATE.RACING; b.state = CAR_STATE.RACING; a.ghostTimer = 0; b.ghostTimer = 0;
  a.speed = 50; a.gear = 4; b.speed = 15; b.gear = 1;
  let contact = false, leaderBefore = 0, leaderAfter = 0, followerAfter = 0;
  for (let i = 0; i < 2 / SIM_DT; i++) {
    race.setPlayerInput(0, 0, 1, 0, 0, false, false); race.setPlayerInput(1, 0, 0, 0, 0, false, false);
    const before = b.speed;
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) if (race.events[e].type === 'contact' && !contact) { contact = true; leaderBefore = before; leaderAfter = b.speed; followerAfter = a.speed; }
    race.eventCount = 0;
  }
  assert.ok(contact, 'contact event between the two players');
  assert.ok(a.contacts > 0 && b.contacts > 0);
  // arcade contact model: the car that runs into the other pays, the car in front is nudged forward, not shoved
  assert.ok(leaderAfter > leaderBefore && leaderAfter < leaderBefore + 2, `the car in front was nudged forward (${leaderBefore.toFixed(2)} -> ${leaderAfter.toFixed(2)} m/s)`);
  assert.ok(followerAfter < leaderAfter && a.state !== CAR_STATE.RESET, `the car behind was slowed below the one it hit (${followerAfter.toFixed(2)} m/s)`);
});

test('split screen: two non-overlapping views, top/bottom by default, side by side on request', () => {
  const one = computeViewRects(2560, 1440, 1);
  assert.deepEqual(one, [{ x: 0, y: 0, w: 2560, h: 1440 }]);
  const h = computeViewRects(2560, 1440, 2, 'horizontal');
  assert.equal(h.length, 2);
  assert.ok(h[0].y === 0 && h[1].y >= h[0].h && h[0].w === 2560 && h[1].y + h[1].h === 1440);
  const v = computeViewRects(2560, 1440, 2, 'vertical');
  assert.ok(v[0].x === 0 && v[1].x >= v[0].w && v[0].h === 1440 && v[1].x + v[1].w === 2560);
});

test('each view projects the road from its own car', () => {
  const race = duel(2);
  for (let i = 0; i < 4 / SIM_DT; i++) { race.setPlayerInput(0, 0, 1, 0, 0, false, false); race.setPlayerInput(1, 0, 0.2, 0, 0, false, false); race.step(SIM_DT); race.eventCount = 0; }
  const rects = computeViewRects(1280, 720, 2, 'horizontal');
  const views = [new RaceView(0), new RaceView(1)];
  views.forEach((view, i) => {
    view.setRect(rects[i].x, rects[i].y, rects[i].w, rects[i].h);
    view.carIndex = race.playerCars[i].index; view.camera = CAMERA.COCKPIT;
    view.update(1 / 60, race, DEFAULT_EFFECTS, 0);
  });
  assert.ok(views[0].wide && views[1].wide);
  assert.notEqual(views[0].projection.camS, views[1].projection.camS);
  assert.ok(Math.abs(views[0].projection.camS - (race.playerCars[0].s - 0.35)) < 1.5);
  assert.ok(views[0].projection.topRow > 0 && views[1].projection.topRow > 0);
  assert.equal(views[0].projection.height, rects[0].h);
});

test('duel session produces a two-player race configuration', () => {
  const session = new SingleRaceSession('duel', { circuitId: 'kestrel-fields', laps: 2, opponents: 6, players: 2, rules: 'arcade', difficulty: 'amateur', setups: [{ wing: 2, tyres: 'medium', gearbox: 'auto' }, { wing: 4, tyres: 'soft', gearbox: 'manual' }] });
  const config = session.nextRace();
  assert.equal(config.entries.filter((e) => e.human).length, 2);
  assert.equal(config.views.length, 2);
  assert.equal(config.entries[config.views[1]].setup.gearbox, 'manual');
  assert.equal(session.nextRace(), null);
});
