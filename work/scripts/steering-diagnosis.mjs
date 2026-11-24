// Steering diagnosis (lot 5): is the car able to turn, and does anything change after a recoverable hop?
// A measurement of the game as it is; nothing is changed. Pure simulation at 120 Hz, through the real
// Race (same step function as the game). Three parts:
//   1. left against right, in a normal race, at several speeds: request, steering position, yaw rate,
//      heading, speed and state of the car;
//   2. the same steering applied to a car that has just come down from a recoverable hop, against a car
//      in a normal race at the SAME speed;
//   3. what the cockpit draws: which of the five drawings of the front wheels is shown along the travel.
// node work/scripts/steering-diagnosis.mjs [out.json]
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit, CIRCUITS } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { BASE_CAR_SPEC as SPEC, gripLimit, cornerSpeed } from '../../src/vehicles/car-spec.js';
import { placeCar, CAR_STATE, steeringLock } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { steerFrame } from '../../src/rendering/compositing/cockpit-layer.js';
import { STEER_FRAMES, MAX_DRAWN_STEER } from '../../src/art/cockpits/cockpit-art.js';
import { straightStretch, twoCars } from '../../tests/gameplay/collision-helpers.mjs';

const out = process.argv[2] || 'work/benchmarks/steering-diagnosis.json';
const KMH = 3.6, DEG = 180 / Math.PI, r1 = (v) => +v.toFixed(1), r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3);
const turned = (h, h0) => (((h - h0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * DEG;
const SAMPLE_AT = [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2];

// asphalt everywhere the car goes: a copy of a circuit widened to 900 m (the circuits of the game are not touched)
const wide = buildTrack({ ...getCircuit('kestrel-fields'), width: 900 });
const s0 = straightStretch(wide, 600) + 60;
const report = { note: 'measurement of the game as it is; nothing is changed', simulationStepSeconds: SIM_DT, track: 'kestrel-fields widened to 900 m (asphalt everywhere)' };

function soloRace(rules) {
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
  const race = new Race({ track: wide, laps: 3, entries, rules, difficulty: 'amateur', seed: 5 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const car = race.playerCars[0], other = race.cars.find((c) => !c.isHuman);
  placeCar(other, wide, s0 + wide.length / 2, 0); other.state = CAR_STATE.RACING;
  return { race, car };
}
function launch(car, v) {
  const tops = car.params.spec.gearTopSpeeds;
  car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = v; car.gear = tops.findIndex((t) => v < t * 0.93) + 1 || tops.length;
}

/** Hold a steering request for `seconds` and record the car. `feed(i)` sets the controls before each step. */
function hold(race, car, steer, throttle, seconds, playerIndex = 0) {
  const h0 = car.heading, x0 = car.x, z0 = car.z, rows = [], trace = [];
  const fx = Math.cos(h0), fz = Math.sin(h0);
  let fullLockAt = null, states = new Set();
  for (let i = 1; i <= Math.round(seconds / SIM_DT); i++) {
    race.setPlayerInput(playerIndex, steer, throttle, 0, 0, false, false);
    race.step(SIM_DT); race.eventCount = 0;
    const t = i * SIM_DT;
    states.add(car.state);
    if (fullLockAt === null && Math.abs(car.steer) >= 0.999) fullLockAt = t;
    const side = -(car.x - x0) * fz + (car.z - z0) * fx;                       // metres to the right of the initial line
    trace.push({ t, steer: car.steer, yaw: car.yawRate * DEG, heading: turned(car.heading, h0), side, speed: car.speed * KMH });
    if (SAMPLE_AT.some((s) => Math.abs(s - t) < SIM_DT / 2)) {
      rows.push({ t: r1(t), inSteer: r2(car.inSteer), steer: r3(car.steer), yawDegPerSecond: r1(car.yawRate * DEG), headingDeg: r2(turned(car.heading, h0)), sideMetres: r2(side),
        speedKmh: r1(car.speed * KMH), state: car.state });
    }
  }
  return { fullLockAfterSeconds: fullLockAt === null ? null : r3(fullLockAt), states: [...states], rows, trace };
}

// ---- 1. left against right in a normal race
report.leftRight = [];
for (const [rulesName, rules] of [['arcade', RULE_PRESETS.arcade], ['racing', RULE_PRESETS.training], ['turbo', RULE_PRESETS.turbo]]) {
  for (const kmh of [60, 100, 150, 200, 250]) {
    const sides = {};
    for (const steer of [-1, 1]) {
      const { race, car } = soloRace(rules);
      placeCar(car, wide, s0, 0); launch(car, kmh / KMH);
      sides[steer < 0 ? 'left' : 'right'] = hold(race, car, steer, 1, 2);
    }
    // largest difference between the two sides once mirrored
    let worst = 0;
    for (let i = 0; i < sides.left.trace.length; i++) {
      const l = sides.left.trace[i], r = sides.right.trace[i];
      worst = Math.max(worst, Math.abs(l.steer + r.steer), Math.abs(l.yaw + r.yaw) / 100, Math.abs(l.heading + r.heading) / 100, Math.abs(l.speed - r.speed) / 100);
    }
    const v = kmh / KMH, params = soloRace(rules).car.params, aMax = gripLimit(params, v, 1, 1), lock = steeringLock(params, v, aMax);
    report.leftRight.push({ profile: rulesName, startKmh: kmh, lockOfTheSimulationDeg: r2(lock * DEG), gripLimitMs2: r1(aMax),
      left: { fullLockAfterSeconds: sides.left.fullLockAfterSeconds, rows: sides.left.rows }, right: { fullLockAfterSeconds: sides.right.fullLockAfterSeconds, rows: sides.right.rows },
      largestMirrorDifference: +worst.toExponential(2) });
  }
}

// ---- 2. after a recoverable hop, against a normal race at the same speed
report.afterHop = [];
for (const steer of [-1, 1, 0]) {
  for (const throttle of [1, 0]) {
    // the real contact, on the wide copy: the hop of the bench (since lot 5: a front wheel on a rear wheel, 215 km/h onto
    // a car at 150 km/h, 1.95 m to its side; before: 200 km/h, half a car width to the side). The first staging that
    // gives a hop with the rules of the sources being measured is used, so that the script also runs on PR #4.
    let race, a, b, landed = false, hopSeen = false, staging = null;
    for (const st of [{ lateral: 1.95, kmhA: 215, gap: 4, name: 'front wheel on rear wheel, 215 km/h onto 150 km/h' }, { lateral: 0.93, kmhA: 200, gap: 2, name: 'half a car width to the side, 200 km/h onto 150 km/h (rules of PR #4)' }]) {
      ({ race, a, b } = twoCars(wide, { gap: st.gap, lateral: st.lateral, speedA: st.kmhA / KMH, speedB: 150 / KMH, straight: 600 }));
      landed = false; hopSeen = false;
      const hold = (car, kmh) => Math.max(0, Math.min(1, 0.35 + (kmh / KMH - car.speed) * 0.4));
      let guard = 0;
      while (!landed && guard++ < 3 / SIM_DT) {
        race.setPlayerInput(0, 0, a.state === CAR_STATE.RACING ? hold(a, st.kmhA) : 0, 0, 0, false, false); race.setPlayerInput(1, 0, hold(b, 150), 0, 0, false, false);
        race.step(SIM_DT);
        for (let e = 0; e < race.eventCount; e++) { const ev = race.events[e]; if (ev.car === a.index && ev.type === 'hop') hopSeen = true; if (ev.car === a.index && ev.type === 'landing') landed = true; }
        race.eventCount = 0;
      }
      if (hopSeen && landed) { staging = st.name; break; }
    }
    if (!hopSeen || !landed) { report.afterHop.push({ steer, throttle, error: 'no hop produced by the contact' }); continue; }
    const landingKmh = a.speed * KMH, launchSide = a.launchSide;
    // the car ahead is kept out of the way of the measurement (it drives on, straight)
    const after = (() => {
      const h0 = a.heading, x0 = a.x, z0 = a.z, fx = Math.cos(h0), fz = Math.sin(h0), rows = [], trace = [];
      for (let i = 1; i <= Math.round(2 / SIM_DT); i++) {
        race.setPlayerInput(0, steer, throttle, 0, 0, false, false); race.setPlayerInput(1, 0, 1, 0, 0, false, false);
        race.step(SIM_DT); race.eventCount = 0;
        const t = i * SIM_DT, side = -(a.x - x0) * fz + (a.z - z0) * fx;
        trace.push({ t, steer: a.steer, yaw: a.yawRate * DEG, heading: turned(a.heading, h0), side, speed: a.speed * KMH });
        if (SAMPLE_AT.some((s) => Math.abs(s - t) < SIM_DT / 2)) rows.push({ t: r1(t), inSteer: r2(a.inSteer), steer: r3(a.steer), yawDegPerSecond: r1(a.yawRate * DEG), headingDeg: r2(turned(a.heading, h0)), sideMetres: r2(side), speedKmh: r1(a.speed * KMH), state: a.state });
      }
      return { rows, trace };
    })();
    // the reference: a car in a normal race, at the speed the other one landed at
    const { race: race2, car } = soloRace(RULE_PRESETS.arcade);
    placeCar(car, wide, s0, 0); launch(car, landingKmh / KMH);
    const normal = hold(race2, car, steer, throttle, 2);
    const diffAt = (t) => { const i = Math.round(t / SIM_DT) - 1, x = after.trace[i], y = normal.trace[i]; return { t, steer: r3(x.steer - y.steer), yawDegPerSecond: r1(x.yaw - y.yaw), headingDeg: r2(x.heading - y.heading), sideMetres: r2(x.side - y.side), speedKmh: r1(x.speed - y.speed) }; };
    let lastDifferent = 0;
    for (let i = 0; i < after.trace.length; i++) if (Math.abs(after.trace[i].steer - normal.trace[i].steer) > 1e-9) lastDifferent = after.trace[i].t;
    report.afterHop.push({ request: steer < 0 ? 'full left' : steer > 0 ? 'full right' : 'hands off', throttle, hop: staging, landingSpeedKmh: r1(landingKmh), sideOfTheCarThatWasHit: launchSide > 0 ? 'right' : 'left',
      disturbanceSeconds: T.hopWobbleTime, disturbancePeakShareOfTravel: T.hopWobbleSteer,
      afterTheHop: after.rows, normalRaceAtTheSameSpeed: normal.rows, difference: [0.2, 0.35, 0.5, 0.7, 1, 2].map(diffAt),
      steeringPositionIdenticalFromSeconds: r3(lastDifferent + SIM_DT) });
  }
}

// ---- 3. what the cockpit draws
const drawnLock = (v) => SPEC.steerLock * (0.45 + 0.55 / (1 + Math.abs(v) / 28));        // cockpit-layer.js: display value
report.drawings = { frontWheelDrawings: STEER_FRAMES, notchesEachSide: (STEER_FRAMES - 1) / 2, largestAngleDrawnDeg: r1(MAX_DRAWN_STEER * DEG), steeringWheelRotationAtFullLockDeg: r1(0.95 * DEG), bySpeed: [] };
{
  const params = soloRace(RULE_PRESETS.arcade).car.params, mid = (STEER_FRAMES - 1) / 2;
  for (const kmh of [30, 60, 100, 150, 200, 250, 300]) {
    const v = kmh / KMH, shown = drawnLock(v), aMax = gripLimit(params, v, 1, 1), lock = steeringLock(params, v, aMax);
    // share of the steering travel during which each drawing is shown, and when the drawing changes after the key is pressed
    const changes = [];
    let previous = mid, shares = new Array(STEER_FRAMES).fill(0);
    const steps = Math.ceil(1 / (SPEC.steerRate * SIM_DT) - 1e-9);
    for (let i = 1; i <= steps; i++) {
      const steer = Math.min(1, i * SPEC.steerRate * SIM_DT), frame = steerFrame(-steer, shown);       // steering left: frames above the middle one
      shares[frame] += 1 / steps;
      if (frame !== previous) { changes.push({ notch: Math.abs(frame - mid), afterSeconds: r3(i * SIM_DT), atShareOfTravel: r2(steer), simulatedAngleDeg: r2(steer * lock * DEG) }); previous = frame; }
    }
    report.drawings.bySpeed.push({ kmh, angleOfTheSimulationAtFullLockDeg: r2(lock * DEG), angleDrawnAtFullLockDeg: r1(Math.min(shown, MAX_DRAWN_STEER) * DEG),
      notchAtFullLock: Math.abs(steerFrame(-1, shown) - mid), changes });
  }
}

// ---- 4. the tightest circle the car can follow at each speed, against the bends of the circuits (arcade profile)
{
  const params = soloRace(RULE_PRESETS.arcade).car.params;
  const radiusAt = (v) => {
    const aMax = gripLimit(params, v, 1, 1), lock = steeringLock(params, v, aMax), wanted = (v * Math.tan(lock)) / params.wheelbase, slip = Math.max(0, (v * wanted) / aMax - 1);
    const yaw = slip > 0 ? (wanted * (1 + Math.min(slip, 0.5) * 0.12)) / (1 + slip) : wanted;
    return { radius: v / yaw, yaw, slip, aMax };
  };
  const speeds = [60, 100, 150, 200, 250, 300];
  report.turningCircle = speeds.map((kmh) => { const r = radiusAt(kmh / KMH); return { kmh, radiusM: r1(r.radius), yawDegPerSecond: r1(r.yaw * DEG), lateralG: r2(((kmh / KMH) * r.yaw) / 9.81), secondsForAQuarterTurn: r2((Math.PI / 2) / r.yaw) }; });
  // highest speed at which a bend of a given radius can be followed at full lock
  const speedFor = (radius) => { let lo = 5, hi = 110; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (radiusAt(m).radius < radius) lo = m; else hi = m; } return lo; };
  report.circuits = [];
  for (const def of CIRCUITS) {
    const track = buildTrack(def), n = track.n;
    // bends: runs of samples whose radius, on the centre line, is under 400 m
    const bends = [];
    let current = null;
    for (let k = 0; k < n; k++) {
      const radius = 1 / Math.max(1e-6, Math.abs(track.kappa[k]));
      if (radius < 400) { if (!current) { current = { from: k, radius, lineRadius: 1e9 }; bends.push(current); } current.radius = Math.min(current.radius, radius); current.lineRadius = Math.min(current.lineRadius, 1 / Math.max(1e-6, Math.abs(track.lineKappa[k]))); current.to = k; }
      else current = null;
    }
    const tight = bends.reduce((a, b) => (b.radius < a.radius ? b : a), bends[0]);
    const count = (limit) => bends.filter((b) => b.lineRadius < limit).length;
    report.circuits.push({ id: def.id, bends: bends.length, tightestRadiusM: r1(tight.radius), tightestOnTheRacingLineM: r1(Math.min(...bends.map((b) => b.lineRadius))),
      highestSpeedThroughTheTightestKmh: r1(speedFor(Math.min(...bends.map((b) => b.lineRadius))) * KMH), limitSpeedOfTheComputerThereKmh: r1(cornerSpeed(params, 1 / Math.min(...bends.map((b) => b.lineRadius)), 0.9) * KMH),
      bendsTooTightAt150: count(radiusAt(150 / KMH).radius), bendsTooTightAt200: count(radiusAt(200 / KMH).radius), bendsTooTightAt250: count(radiusAt(250 / KMH).radius) });
  }
}

writeFileSync(out, JSON.stringify(report, (k, v) => (k === 'trace' ? undefined : v), 1));

console.log('1. Left against right, normal race, full throttle, two seconds (arcade)');
for (const r of report.leftRight.filter((x) => x.profile === 'arcade')) {
  const at = (side, t) => r[side].rows.find((x) => x.t === t);
  console.log(`  ${String(r.startKmh).padStart(3)} km/h: lock ${String(r.lockOfTheSimulationDeg).padStart(5)} deg; full lock after ${r.left.fullLockAfterSeconds} / ${r.right.fullLockAfterSeconds} s; yaw at 0.5 s ${at('left', 0.5).yawDegPerSecond} / ${at('right', 0.5).yawDegPerSecond} deg/s; heading at 1 s ${at('left', 1).headingDeg} / ${at('right', 1).headingDeg} deg; at 2 s ${at('left', 2).headingDeg} / ${at('right', 2).headingDeg} deg; mirror difference ${r.largestMirrorDifference}`);
}
console.log('   other profiles, largest mirror difference:', report.leftRight.filter((x) => x.profile !== 'arcade').map((x) => `${x.profile} ${x.startKmh}: ${x.largestMirrorDifference}`).join(', '));
console.log('\n2. After a recoverable hop against a normal race at the same speed');
for (const r of report.afterHop) {
  if (r.error) { console.log('  ', r.error); continue; }
  console.log(`  ${r.request.padEnd(10)} throttle ${r.throttle}, ${r.hop}: landed at ${r.landingSpeedKmh} km/h, hit on the ${r.sideOfTheCarThatWasHit}: differences (hop - normal)`);
  for (const d of r.difference) console.log(`     t ${String(d.t).padEnd(4)} s: steer ${String(d.steer).padStart(6)}, yaw ${String(d.yawDegPerSecond).padStart(5)} deg/s, heading ${String(d.headingDeg).padStart(6)} deg, side ${String(d.sideMetres).padStart(5)} m, speed ${d.speedKmh} km/h`);
  console.log(`     steering position identical from ${r.steeringPositionIdenticalFromSeconds} s after the landing`);
}
console.log('\n3. Drawings of the front wheels (steering left from the centre, key held)');
for (const r of report.drawings.bySpeed) console.log(`  ${String(r.kmh).padStart(3)} km/h: simulation ${String(r.angleOfTheSimulationAtFullLockDeg).padStart(5)} deg, drawn ${r.angleDrawnAtFullLockDeg} deg, notch ${r.notchAtFullLock} of ${report.drawings.notchesEachSide}; ${r.changes.map((c) => `notch ${c.notch} at ${c.afterSeconds} s (${Math.round(c.atShareOfTravel * 100)} %)`).join(', ')}`);
console.log('\n4. Tightest circle at full lock (arcade)');
console.log('  ' + report.turningCircle.map((r) => `${r.kmh} km/h: ${r.radiusM} m (${r.yawDegPerSecond} deg/s, ${r.lateralG} g, quarter turn in ${r.secondsForAQuarterTurn} s)`).join('; '));
for (const c of report.circuits) console.log(`  ${c.id.padEnd(18)} ${String(c.bends).padStart(2)} bends, tightest ${String(c.tightestRadiusM).padStart(5)} m (racing line ${String(c.tightestOnTheRacingLineM).padStart(5)} m: at most ${c.highestSpeedThroughTheTightestKmh} km/h at full lock); too tight at 150 / 200 / 250 km/h: ${c.bendsTooTightAt150} / ${c.bendsTooTightAt200} / ${c.bendsTooTightAt250}`);
console.log('->', out);
