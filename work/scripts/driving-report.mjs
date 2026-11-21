// Reproducible measurements of the driving model (no rendering): acceleration, top speed, braking
// distances, cornering grip, lap times of the computer drivers. Used by docs/specifications.
// node work/scripts/driving-report.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit, CIRCUITS } from '../../src/tracks/track-catalog.js';
import { BASE_CAR_SPEC, DRIVING_PROFILES, deriveCarParams, gripLimit, GRAVITY } from '../../src/vehicles/car-spec.js';
import { CAR_STATE, createCarState, placeCar, stepCar } from '../../src/physics/car-physics.js';
import { resolveRules, RULE_PRESETS } from '../../src/gameplay/rules.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { DRIVERS } from '../../src/vehicles/liveries.js';

const track = buildTrack(getCircuit('sablon'));
const rules = resolveRules(RULE_PRESETS.training, track);
const DT = 1 / 120;
function car(profile, setup) {
  const c = createCarState(0);
  c.params = deriveCarParams(BASE_CAR_SPEC, setup, DRIVING_PROFILES[profile], null);
  c.isHuman = true; placeCar(c, track, 20, 0); c.state = CAR_STATE.RACING; c.rpm = BASE_CAR_SPEC.rpmIdle;
  return c;
}
const report = { date: new Date().toISOString(), profiles: {}, wings: [], laps: [] };
for (const profile of ['arcade', 'racing', 'turbo']) {
  const c = car(profile, null);
  let t100 = 0, t200 = 0, t300 = 0, d400 = 0;
  for (let i = 0; i < 20 / DT; i++) {
    c.inThrottle = 1; c.inBoost = false; stepCar(c, track, DT, rules, null);
    const t = (i + 1) * DT;
    if (!t100 && c.speed >= 27.78) t100 = t; if (!t200 && c.speed >= 55.56) t200 = t; if (!t300 && c.speed >= 83.33) t300 = t;
    if (!d400 && c.odometer >= 402.3) d400 = t;
  }
  const top = c.topSpeed * 3.6;
  const brake = (from) => { const b = car(profile, null); b.speed = from / 3.6; b.gear = 6; let d = 0, t = 0; while (b.speed > 0.3 && t < 10) { b.inBrake = 1; b.inThrottle = 0; const o = b.odometer; stepCar(b, track, DT, rules, null); d += b.odometer - o; t += DT; } return { distance: +d.toFixed(1), time: +t.toFixed(2) }; };
  const p = c.params;
  report.profiles[profile] = {
    zeroTo100: +t100.toFixed(2), zeroTo200: +t200.toFixed(2), zeroTo300: t300 ? +t300.toFixed(2) : null, quarterMile: +d400.toFixed(2), topSpeedKmh: +top.toFixed(0),
    brake100: brake(100), brake200: brake(200), brake300: brake(300),
    lateralG: { at100: +(gripLimit(p, 27.78) / GRAVITY).toFixed(2), at200: +(gripLimit(p, 55.56) / GRAVITY).toFixed(2), at300: +(gripLimit(p, 83.33) / GRAVITY).toFixed(2) },
  };
}
for (let wing = 0; wing < 5; wing++) {
  const c = car('racing', { wing });
  for (let i = 0; i < 22 / DT; i++) { c.inThrottle = 1; stepCar(c, track, DT, rules, null); }
  report.wings.push({ wing, topSpeedKmh: +(c.topSpeed * 3.6).toFixed(0), lateralGAt250: +(gripLimit(c.params, 69.4) / GRAVITY).toFixed(2) });
}
for (const def of CIRCUITS) {
  const t = buildTrack(def);
  const race = new Race({ track: t, laps: 2, entries: [{ driver: DRIVERS[0] }], rules: RULE_PRESETS.training, difficulty: 'expert', seed: 1 });
  let steps = 0;
  while (race.phase !== RACE_PHASE.FINISHED && steps < 600 / SIM_DT) { race.step(SIM_DT); race.eventCount = 0; steps++; }
  const c = race.cars[0];
  report.laps.push({ circuit: def.id, name: def.name, lengthM: +t.length.toFixed(0), bestLap: +c.bestLapTime.toFixed(3), averageKmh: +((t.length / c.bestLapTime) * 3.6).toFixed(0), topKmh: +(c.topSpeed * 3.6).toFixed(0) });
}
mkdirSync(new URL('../benchmarks/', import.meta.url), { recursive: true });
writeFileSync(new URL('../benchmarks/driving-report.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.profiles, null, 1));
console.log(report.wings.map((w) => `wing ${w.wing}: ${w.topSpeedKmh} km/h, ${w.lateralGAt250} g`).join(' | '));
console.log(report.laps.map((l) => `${l.circuit} ${l.lengthM} m ${l.bestLap}s ${l.averageKmh} km/h`).join('\n'));
