// What happens when a steering key is held down? A measurement of the game as it is, without
// changing anything: how long the steering takes to reach its stop, the angle really used by the
// simulation at each speed, what the cockpit shows (the five drawings of the front wheels, the
// rotation of the steering wheel), and the behaviour of the car over four seconds of full lock on
// a very wide stretch of asphalt (a copy of a circuit widened to 900 m, so that the car never
// leaves the road). Pure simulation at 120 Hz; the keyboard gives -1, 0 or +1 with no ramp of its
// own (src/input/input-manager.js), so "key held" is a constant request of full lock.
// node work/scripts/steering-study.mjs [out.json]
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { BASE_CAR_SPEC as SPEC, DRIVING_PROFILES, deriveCarParams, gripLimit } from '../../src/vehicles/car-spec.js';
import { placeCar, CAR_STATE, steeringLock } from '../../src/physics/car-physics.js';
import { steerFrame } from '../../src/rendering/compositing/cockpit-layer.js';
import { STEER_FRAMES, MAX_DRAWN_STEER } from '../../src/art/cockpits/cockpit-art.js';
import { straightStretch } from '../../tests/gameplay/collision-helpers.mjs';

const out = process.argv[2] || 'work/benchmarks/steering-study.json';
const KMH = 3.6, DEG = 180 / Math.PI, r1 = (v) => +v.toFixed(1), r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3);
const SPEEDS = [30, 60, 100, 150, 200, 250, 300];
const report = { note: 'measurement of the current game; nothing is changed', simulationStepSeconds: SIM_DT };

// ---- 1. from the key to the stop of the steering
const stepsTo = (rate) => Math.ceil(1 / (rate * SIM_DT) - 1e-9);
report.keyToFullLock = {
  keyboardRamp: 'none: the request is -1, 0 or +1 at once',
  steerRatePerSecond: SPEC.steerRate, steerReturnRatePerSecond: SPEC.steerReturnRate,
  secondsFromCentreToFullLock: r3(stepsTo(SPEC.steerRate) * SIM_DT), secondsFromFullLockToCentre: r3(stepsTo(SPEC.steerReturnRate) * SIM_DT),
  secondsFromFullLockToOppositeLock: r3((stepsTo(SPEC.steerReturnRate) + stepsTo(SPEC.steerRate)) * SIM_DT),
  afterThat: 'the steering stays at its stop for as long as the key is held: there is no second stage',
};

// ---- 2. the angle the simulation really uses, and what the cockpit draws
/** Lock used by the cockpit drawing of the front wheels (src/rendering/compositing/cockpit-layer.js): a display value, not the one of the simulation. */
const drawnLock = (v) => SPEC.steerLock * (0.45 + 0.55 / (1 + Math.abs(v) / 28));
const STEERING_WHEEL_TURN = 0.95;             // rad of rotation of the drawn steering wheel at full lock (cockpit-layer.js)
report.byProfile = {};
for (const [name, profile] of Object.entries(DRIVING_PROFILES)) {
  const params = deriveCarParams(SPEC, null, profile, null);
  const rows = [];
  for (const kmh of SPEEDS) {
    const v = kmh / KMH, aMax = gripLimit(params, v, 1, 1), lock = steeringLock(params, v, aMax);
    const yawWanted = (v * Math.tan(lock)) / params.wheelbase, asked = (v * yawWanted) / aMax, slip = Math.max(0, asked - 1);
    const yaw = slip > 0 ? (yawWanted * (1 + Math.min(slip, 0.5) * 0.12)) / (1 + slip) : yawWanted;
    // the drawings: one of five, chosen from the request and the display lock
    const shown = drawnLock(v), full = steerFrame(1, shown), mid = (STEER_FRAMES - 1) / 2;
    const requestFor = (frames) => Math.min(1, ((frames - 0.5) / mid) * MAX_DRAWN_STEER / shown);      // request from which the drawing is `frames` steps from the centre
    rows.push({ kmh, gripLimitMs2: r1(aMax), lockOfTheSimulationDeg: r2(lock * DEG), askedShareOfGrip: r2(asked), slipAtFullLock: r2(slip),
      steadyYawDegPerSecond: r1(yaw * DEG), steadyLateralG: r2((v * yaw) / 9.81), turningRadiusM: r1(v / yaw), scrubMs2: r1(SPEC.slipScrub * Math.min(slip, 1.5)),
      lockDrawnDeg: r1(Math.min(shown, MAX_DRAWN_STEER) * DEG), drawingAtFullLock: `${Math.abs(full - mid)} of ${mid} steps from the centre`,
      firstStepAfterSeconds: r3(requestFor(1) / SPEC.steerRate), secondStepAfterSeconds: Math.abs(full - mid) >= 2 ? r3(requestFor(2) / SPEC.steerRate) : null });
  }
  report.byProfile[name] = { steerAssist: profile.steerAssist, gripScale: profile.gripScale, rows };
}
report.drawings = { frontWheelDrawings: STEER_FRAMES, stepsEachSide: (STEER_FRAMES - 1) / 2, largestAngleDrawnDeg: r1(MAX_DRAWN_STEER * DEG), lockAtRestDeg: r1(SPEC.steerLock * DEG),
  steeringWheelRotationAtFullLockDeg: r1(STEERING_WHEEL_TURN * DEG), steeringWheelFollows: 'the request (-1..1), whatever the speed; reached with the stop of the steering' };

// ---- 3. four seconds of full lock on a very wide stretch of asphalt
const def = getCircuit('kestrel-fields');
const track = buildTrack({ ...def, width: 900 });
const s0 = straightStretch(track, 600) + 60;
const SAMPLES = [0.1, 0.2, 0.3, 0.5, 1, 2, 3, 4];
report.hold = { track: 'kestrel-fields widened to 900 m (asphalt everywhere the car goes)', seconds: 4, runs: [] };
for (const [rulesName, rules] of [['arcade', RULE_PRESETS.arcade], ['racing', RULE_PRESETS.training], ['turbo', RULE_PRESETS.turbo]]) {
  for (const kmh of [60, 100, 150, 200, 250]) {
    for (const throttle of [1, 0]) {
      const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
      const race = new Race({ track, laps: 3, entries, rules, difficulty: 'amateur', seed: 5 });
      while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
      const car = race.playerCars[0], other = race.cars.find((c) => !c.isHuman);
      placeCar(other, track, s0 + track.length / 2, 0); other.state = CAR_STATE.RACING;
      placeCar(car, track, s0, 0);
      const v0 = kmh / KMH, tops = car.params.spec.gearTopSpeeds;
      car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = v0; car.gear = tops.findIndex((t) => v0 < t * 0.93) + 1 || tops.length;
      const heading0 = car.heading, samples = [], events = new Set();
      let peakSlip = 0, peakSlide = 0, offRoad = false, steadyAt = null, plateau = 0;
      const trace = [];
      for (let i = 1; i <= 4 / SIM_DT; i++) {
        race.setPlayerInput(0, 1, throttle, 0, 0, false, false);
        race.step(SIM_DT);
        for (let e = 0; e < race.eventCount; e++) if (race.events[e].car === car.index) events.add(race.events[e].type);
        race.eventCount = 0;
        const t = i * SIM_DT, slide = Math.atan2(Math.abs(car.vLat), Math.max(1, car.speed)) * DEG;
        peakSlip = Math.max(peakSlip, car.slip); peakSlide = Math.max(peakSlide, slide);
        if (car.surface !== 0) offRoad = true;
        trace.push(Math.abs(car.yawRate));
        if (SAMPLES.some((s) => Math.abs(s - t) < SIM_DT / 2)) {
          const aMax = gripLimit(car.params, car.speed, 1, 1);
          samples.push({ t: r1(t), steer: r2(Math.abs(car.steer)), speedKmh: r1(car.speed * KMH), yawDegPerSecond: r1(Math.abs(car.yawRate) * DEG), lateralG: r2(Math.abs(car.accelLat) / 9.81),
            shareOfGrip: r2(Math.abs(car.accelLat) / aMax), slip: r2(car.slip), slideAngleDeg: r2(slide), state: car.state });
        }
      }
      // when the yaw rate first comes within 5 % of the value it has half a second after the key was pressed
      plateau = trace[Math.round(0.5 / SIM_DT) - 1];
      steadyAt = (trace.findIndex((y) => y >= plateau * 0.95) + 1) * SIM_DT;
      report.hold.runs.push({ profile: rulesName, startKmh: kmh, throttle, yawSteadyAfterSeconds: r2(steadyAt), peakSlip: r2(peakSlip), peakSlideAngleDeg: r2(peakSlide),
        headingTurnedDeg: r1(Math.abs(((car.heading - heading0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * DEG), spin: events.has('spin') || car.state === CAR_STATE.SPIN,
        leftTheAsphalt: offRoad, tyreSquealFromSlip: 0.22, tyreMarksFromSlip: 0.55, tyreSmokeFromSlip: 0.85, events: [...events], samples });
    }
  }
}
writeFileSync(out, JSON.stringify(report, null, 1));

// ---- tables
const k = report.keyToFullLock;
console.log(`Key to full lock: ${k.secondsFromCentreToFullLock} s; back to centre: ${k.secondsFromFullLockToCentre} s; lock to lock: ${k.secondsFromFullLockToOppositeLock} s`);
for (const [name, p] of Object.entries(report.byProfile)) {
  console.log(`\n${name} (steering aid ${p.steerAssist})`);
  for (const r of p.rows) console.log(`  ${String(r.kmh).padStart(3)} km/h: lock ${String(r.lockOfTheSimulationDeg).padStart(5)} deg, asks ${r.askedShareOfGrip} x grip (slip ${r.slipAtFullLock}), ${String(r.steadyYawDegPerSecond).padStart(5)} deg/s, ${r.steadyLateralG} g, radius ${String(r.turningRadiusM).padStart(6)} m, scrub ${r.scrubMs2} m/s2 | drawn ${r.lockDrawnDeg} deg, ${r.drawingAtFullLock}, steps after ${r.firstStepAfterSeconds} s and ${r.secondStepAfterSeconds} s`);
}
console.log('\nFour seconds of full lock:');
for (const r of report.hold.runs) {
  const s = (t) => r.samples.find((x) => x.t === t);
  console.log(`  ${r.profile.padEnd(6)} ${String(r.startKmh).padStart(3)} km/h throttle ${r.throttle}: steady after ${r.yawSteadyAfterSeconds} s; yaw at 0.5/1/2/4 s: ${[0.5, 1, 2, 4].map((t) => s(t).yawDegPerSecond).join(' / ')} deg/s; speed ${[0.5, 1, 2, 4].map((t) => s(t).speedKmh).join(' / ')}; share of grip ${[0.5, 4].map((t) => s(t).shareOfGrip).join(' / ')}; peak slip ${r.peakSlip}, slide angle ${r.peakSlideAngleDeg} deg; turned ${r.headingTurnedDeg} deg; spin ${r.spin}; off asphalt ${r.leftTheAsphalt}`);
}
console.log('->', out);
