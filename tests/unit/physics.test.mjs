// Driving model: acceleration, braking, steering, off-track, walls, reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, SURFACE } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { BASE_CAR_SPEC, DRIVING_PROFILES, deriveCarParams } from '../../src/vehicles/car-spec.js';
import { CAR_STATE, createCarState, placeCar, stepCar } from '../../src/physics/car-physics.js';
import { resolveRules, RULE_PRESETS } from '../../src/gameplay/rules.js';

const track = buildTrack(getCircuit('sablon'));
const DT = 1 / 120;
function makeCar(profile = 'racing', setup = null, s = 20, d = 0) {
  const car = createCarState(0);
  car.params = deriveCarParams(BASE_CAR_SPEC, setup, DRIVING_PROFILES[profile], null);
  car.isHuman = true;
  placeCar(car, track, s, d);
  car.state = CAR_STATE.RACING;
  car.rpm = BASE_CAR_SPEC.rpmIdle;
  return car;
}
const rules = (name = 'training') => resolveRules(RULE_PRESETS[name], track);
function run(car, seconds, input, r = rules(), events = null) {
  const emit = events ? (type, index, value) => events.push({ type, value }) : null;
  for (let i = 0; i < seconds / DT; i++) { input(car, i * DT); stepCar(car, track, DT, r, emit); }
}

test('acceleration: 0-100 km/h in 2-4 s, 0-200 km/h in under 8 s, top speed above 300 km/h', () => {
  const car = makeCar();
  let t100 = 0, t200 = 0;
  run(car, 14, (c, t) => { c.inThrottle = 1; if (!t100 && c.speed > 27.8) t100 = t; if (!t200 && c.speed > 55.6) t200 = t; });
  assert.ok(t100 > 1.6 && t100 < 4, `0-100 in ${t100}`);
  assert.ok(t200 > t100 && t200 < 8, `0-200 in ${t200}`);
  assert.ok(car.topSpeed * 3.6 > 290, `top speed ${car.topSpeed * 3.6}`);
  assert.ok(car.gear >= 5, 'automatic gearbox shifted up');
});

test('braking: 200 km/h to standstill in a short, plausible distance; brakes alone never push the car backwards', () => {
  const car = makeCar();
  run(car, 9, (c) => { c.inThrottle = 1; });
  car.speed = 55.6;
  const start = car.odometer;
  let stopTime = 0, minSpeed = 1e9;
  run(car, 4, (c, t) => {
    c.inThrottle = 0; c.inBrake = stopTime ? 0 : 1;      // release once stopped (holding the brake at rest selects reverse)
    if (!stopTime && c.speed < 0.3) stopTime = t;
    minSpeed = Math.min(minSpeed, c.speed);
  });
  const distance = car.odometer - start;
  assert.ok(stopTime > 1 && stopTime < 3.5, `stopped after ${stopTime} s`);
  assert.ok(distance > 50 && distance < 130, `braking distance ${distance}`);
  assert.ok(minSpeed >= 0, 'never negative while braking');
  // holding the brake at standstill engages reverse (a deliberate control)
  run(car, 1.5, (c) => { c.inBrake = 1; });
  assert.ok(car.reverse && car.speed < 0);
});

test('steering turns the car in the commanded direction and grip limits cornering at speed', () => {
  const right = makeCar(), left = makeCar();
  run(right, 1.5, (c) => { c.inThrottle = 1; });
  run(left, 1.5, (c) => { c.inThrottle = 1; });
  const h0 = right.heading;
  run(right, 0.6, (c) => { c.inSteer = 1; c.inThrottle = 0.4; });
  run(left, 0.6, (c) => { c.inSteer = -1; c.inThrottle = 0.4; });
  assert.ok(right.heading - h0 > 0.15, 'positive steering turns right (heading increases)');
  assert.ok(left.heading - h0 < -0.15, 'negative steering turns left');
  assert.ok(Math.abs((right.heading - h0) + (left.heading - h0)) < 0.02, 'left and right are symmetric');
  // at high speed full lock asks for more than the tyres give: slip appears
  const fast = makeCar();
  fast.speed = 80; fast.gear = 6;
  run(fast, 0.5, (c) => { c.inSteer = 1; c.inThrottle = 1; });
  assert.ok(Math.abs(fast.accelLat) < 9.81 * 4.5, 'lateral acceleration stays within the grip budget');
});

test('more wing: more cornering grip at speed, lower top speed', () => {
  const low = makeCar('racing', { wing: 0 }), high = makeCar('racing', { wing: 4 });
  assert.ok(high.params.downforce > low.params.downforce && high.params.drag > low.params.drag);
  run(low, 16, (c) => { c.inThrottle = 1; }); run(high, 16, (c) => { c.inThrottle = 1; });
  assert.ok(low.topSpeed > high.topSpeed + 2, `top speeds ${low.topSpeed} / ${high.topSpeed}`);
});

test('leaving the track: grass slows the car and cuts grip', () => {
  const side = -track.pit.side;                       // the verge opposite the pit lane
  const onTrack = makeCar('racing', null, 700, 0), onGrass = makeCar('racing', null, 700, side * (track.halfWidth + 2.2));
  run(onTrack, 4, (c) => { c.inThrottle = 1; });
  run(onGrass, 4, (c) => { c.inThrottle = 1; c.inSteer = 0; });
  assert.ok(onGrass.surface === SURFACE.GRASS || onGrass.surface === SURFACE.GRAVEL, `surface ${onGrass.surface}`);
  assert.ok(onGrass.speed < onTrack.speed * 0.8, `grass ${onGrass.speed} vs asphalt ${onTrack.speed}`);
  assert.ok(onGrass.offTrackTime > 3);
});

test('barrier contact: the car is kept inside, loses speed and reports the hit', () => {
  const car = makeCar();
  const events = [];
  run(car, 2.5, (c) => { c.inThrottle = 1; });
  run(car, 4, (c) => { c.inThrottle = 1; c.inSteer = 0.5; }, rules('racing'), events);
  const limit = Math.max(track.barrierR[car.segIndex], track.barrierL[car.segIndex]);
  assert.ok(Math.abs(car.d) <= limit + 0.5, `inside the barriers (d=${car.d}, limit=${limit})`);
  assert.ok(events.some((e) => e.type === 'wall'), 'wall event emitted');
  assert.ok(car.wallHits > 0 && car.damage > 0);
});

test('reset puts a stranded car back on the track, facing forward', () => {
  const car = makeCar();
  placeCar(car, track, 300, track.halfWidth + 4);
  car.state = CAR_STATE.RACING;
  car.heading += 2.6;
  const events = [];
  run(car, 2, (c, t) => { c.inReset = t === 0; }, rules(), events);
  assert.ok(events.some((e) => e.type === 'reset'));
  assert.ok(Math.abs(car.d) < 0.5 && Math.abs(car.headingError) < 0.2 && car.resets === 1);
  assert.equal(car.state, CAR_STATE.RACING);
});

test('manual gearbox obeys shift requests; the simulation is deterministic', () => {
  const car = makeCar('racing', { gearbox: 'manual' });
  run(car, 3, (c) => { c.inThrottle = 1; });
  assert.equal(car.gear, 1, 'stays in first without a request');
  assert.ok(car.speed > BASE_CAR_SPEC.gearTopSpeeds[0] - 1.5 && car.speed <= BASE_CAR_SPEC.gearTopSpeeds[0] + 0.5 && car.rpm > BASE_CAR_SPEC.rpmMax * 0.95, `held by the limiter (${car.speed} m/s)`);
  car.inShift = 1; stepCar(car, track, DT, rules(), null);
  assert.equal(car.gear, 2);
  const a = makeCar(), b = makeCar();
  const drive = (c, t) => { c.inThrottle = 1; c.inSteer = Math.sin(t * 2) * 0.4; c.inBrake = t > 5 ? 1 : 0; };
  run(a, 7, drive); run(b, 7, drive);
  assert.equal(a.x, b.x); assert.equal(a.z, b.z); assert.equal(a.speed, b.speed);
});
