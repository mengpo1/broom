// Replays the scenarios E1 to E5 of docs/research/vroom-gameplay-analysis.md in the simulation
// (no rendering) and writes the figures to compare with the measurements of the report:
// work/benchmarks/collision-comparison.json. node work/scripts/collision-comparison.mjs
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { placeCar, CAR_STATE } from '../../src/physics/car-physics.js';
import { COLLISION_TUNING as T } from '../../src/physics/collision-tuning.js';
import { VIEW_CONFIG } from '../../src/core/config.js';
import { contactDive, crashPitch, crashPitchDuration, CRASH_CAMERA } from '../../src/rendering/compositing/crash-camera.js';
import { BLAST } from '../../src/rendering/effects/effects-layer.js';
import { twoCars, run, KMH } from '../../tests/gameplay/collision-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));
const r1 = (v) => +v.toFixed(1), r2 = (v) => +v.toFixed(2);
const out = { date: new Date().toISOString(), note: 'reference values are approximate measurements on 25 fps footage (see the analysis report)' };

// ---- E1: braking from 207 to 89 km/h (driving model untouched: reported for the record), view dive
{
  const { race, a } = twoCars(track, { gap: 200, lateral: 5, speedA: 207 / KMH, speedB: 100 / KMH, straight: 500 });
  const log = run(race, 2.5, { brakeA: 1, throttleB: 0.5 });
  const t207 = log.frames.find((f) => f.a.speed * KMH <= 207), t89 = log.frames.find((f) => f.a.speed * KMH <= 89);
  out.E1 = { reference: { brakingKmhPerSecond: 150, viewDivePercent: [3.4, 5] },
    game: { brakingKmhPerSecond: r1((207 - 89) / (t89.time - t207.time)), viewDivePercentAtFullBraking: r1(VIEW_CONFIG.brakeDive * 100) },
    comment: 'braking strength deliberately unchanged (C9 not authorised); only the dive of the view was raised' };
  void a;
}
// ---- E2: wheel-to-wheel
{
  const { race, a, b } = twoCars(track, { gap: 0.6, lateral: 2.15, speedA: 145 / KMH, speedB: 120 / KMH });
  const log = run(race, 1.2, { throttleA: 0.2, throttleB: 0.5, steerA: (t) => (t < 0.35 ? 0.3 : 0) });
  const e = log.events.find((x) => x.type === 'wheel'), before = log.atEvent(e), after = log.frames[e.frame];
  let peak = 0; for (let t = 0; t < 0.5; t += 1 / 240) peak = Math.max(peak, contactDive({ clock: t, bumpClock: 0 }));
  out.E2 = { reference: { speedBefore: '140-149', speedAfter: '50-59', lossKmh: 90, sparkSeconds: 0.16, viewDivePercent: [5.5, 7], viewDiveSeconds: 0.44, swerve: 'none' },
    game: { speedBefore: r1(before.a.speed * KMH), speedAfter: r1(after.a.speed * KMH), lossKmh: r1(e.value * KMH), otherCarChangeKmh: r1((after.b.speed - before.b.speed) * KMH),
      sparkSeconds: T.sparkLife, viewDivePercent: r1(peak * 100), viewDiveSeconds: r2(T.contactDiveIn + T.contactDiveOut), headingChangeDegrees: r1(Math.abs(after.a.heading - before.a.heading) * 57.3),
      events: log.events.map((x) => x.type) } };
  void a; void b;
}
// ---- E3: launch over a car
{
  const { race, a } = twoCars(track, { gap: 2.5, lateral: 0.93, speedA: 262 / KMH, speedB: 190 / KMH, straight: 700 });
  const log = run(race, 9, { throttleA: 1, throttleB: 0.7 });
  const ev = (type) => log.events.find((x) => x.type === type && x.car === a.index);
  const launch = ev('launch'), landing = ev('landing'), restart = ev('restart');
  const stopped = log.frames.findIndex((f, i) => i > landing.frame && f.a.speed < 0.05);
  const at = (t) => log.frames.find((f) => f.time >= log.frames[restart.frame].time + t);
  out.E3 = { reference: { launchSpeed: 262, flightSeconds: 0.85, airLossKmhPerSecond: 50, landing: '228 -> 35 km/h', stopSecondsAfterLanding: 0.84, standstillSeconds: 3.2, launchToRestartSeconds: 4.9,
      restart: '0-100 km/h in 1.0 s', viewNoseUpSeconds: 0.4, viewSettledSecondsAfterLaunch: 2.64, explosionSeconds: 1.25, plumesSeconds: 0.6,
      afterTheFlight: 'the cars that were hit are just ahead, then drive away' },
    game: { launchSpeed: r1(log.atEvent(launch).a.speed * KMH), flightSeconds: r2(landing.time - launch.time),
      airLossKmhPerSecond: r1((log.frames[launch.frame].a.speed - log.atEvent(landing).a.speed) * KMH / (landing.time - launch.time)),
      landing: `${r1(log.atEvent(landing).a.speed * KMH)} -> ${r1(log.frames[landing.frame].a.speed * KMH)} km/h`,
      stopSecondsAfterLanding: r2(log.frames[stopped].time - log.frames[landing.frame].time), standstillSeconds: r2(restart.time - log.frames[stopped].time),
      launchToRestartSeconds: r2(restart.time - launch.time), speedOneSecondAfterRestart: r1(at(1).a.speed * KMH), speedTwoSecondsAfterRestart: r1(at(2).a.speed * KMH),
      viewNoseUpSeconds: r2(CRASH_CAMERA.holdFraction * T.flightTimeCar), viewSettledSecondsAfterLaunch: r2(T.flightTimeCar + crashPitchDuration(true)),
      explosionSeconds: BLAST.smokeEnd, plumesSeconds: r2(BLAST.end - BLAST.plumeStart), peakHeightMetres: r2(Math.max(...log.frames.map((f) => f.a.airHeight))),
      carAheadDisturbed: Math.abs(log.frames[launch.frame].b.speed - log.atEvent(launch).b.speed) > 0.5,
      carAheadAtLandingMetres: r2(log.frames[landing.frame].b.s - log.frames[landing.frame].a.s), carAheadTwoSecondsLaterMetres: r1((log.frames.find((f) => f.time >= landing.time + 2) || log.frames.at(-1)).b.s - (log.frames.find((f) => f.time >= landing.time + 2) || log.frames.at(-1)).a.s) },
    comment: 'restart acceleration is the normal one of the car (driving untouched): slower than the reference game' };
  void crashPitch;
}
// ---- E4: rear-end bumps
{
  const single = (va, vb, gap) => {
    const { race, a } = twoCars(track, { gap, lateral: 0, speedA: va / KMH, speedB: vb / KMH });
    const log = run(race, 1.2, { throttleA: 0.3, throttleB: 0.3 });
    const e = log.events.find((x) => x.type === 'bump');
    return { before: r1(log.atEvent(e).a.speed * KMH), carAhead: r1(log.atEvent(e).b.speed * KMH), after: r1(log.frames[e.frame].a.speed * KMH), lossKmh: r1(e.value * KMH),
      carAheadChangeKmh: r1((log.frames[e.frame].b.speed - log.atEvent(e).b.speed) * KMH), state: a.state };
  };
  // the follower keeps the throttle wide open behind a slower car
  const { race } = twoCars(track, { gap: 8, lateral: 0, speedA: 110 / KMH, speedB: 80 / KMH });
  const series = run(race, 12, { throttleA: 1, throttleB: 0.3 });
  const bumps = series.events.filter((x) => x.type === 'bump');
  let silent = 0;
  for (let f = bumps[0].frame + 1; f < series.frames.length; f++) if (series.frames[f - 1].a.speed - series.frames[f].a.speed > 0.5 && !bumps.some((e) => e.frame === f)) silent++;
  out.E4 = { reference: { unitLossKmh: 48, examples: ['115 -> 67', '104 -> 56', '145 -> 60', '146 -> 52'], bumpsIn12Seconds: 6, secondsBetweenBumps: [1.4, 4.6], viewDivePercent: [5, 8], launch: false, carAhead: 'not affected (hypothesis)' },
    game: { followingCloselyAt115: single(110, 107, 0.3), followingCloselyAt104: single(100, 97, 0.3), closingFastAt145: single(145, 104, 2), bumpsIn12SecondsAtFullThrottle: bumps.length,
      secondsBetweenBumps: bumps.slice(1).map((b, i) => r2(b.time - bumps[i].time)), lossesAtFullThrottleKmh: bumps.map((b) => r1(b.value * KMH)), speedDropsWithoutBump: silent,
      viewDivePercent: r1(T.contactDive * 100), launch: series.events.some((x) => x.type === 'launch') },
    comment: 'rule: the follower leaves the contact 48 km/h slower than the car it hit (loss = 48 km/h + closing speed). At full throttle it comes back as fast as it left, hence a larger loss each time.' };
}
// ---- E5: board
{
  const tr = buildTrack(getCircuit('hazelbrook'));
  const entries = [{ driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0 }, { driver: DRIVERS[0] }];
  const race = new Race({ track: tr, laps: 2, entries, rules: RULE_PRESETS.arcade, difficulty: 'amateur', seed: 3 });
  while (race.phase === RACE_PHASE.COUNTDOWN) { race.step(SIM_DT); race.eventCount = 0; }
  const car = race.playerCars[0], o = race.obstacles[0];
  race.obstacles.forEach((b, i) => { if (b !== o) race.obstacleDown[i] = 1; });       // a single obstacle, as in the reference
  placeCar(car, tr, o.s - 25, o.d); car.state = CAR_STATE.RACING; car.ghostTimer = 0; car.speed = 240 / KMH; car.gear = 5;
  const events = [], frames = [];
  for (let i = 0; i < 6 / SIM_DT; i++) {
    race.setPlayerInput(0, 0, 0, 0, 0, false, false);
    const before = car.speed;
    race.step(SIM_DT);
    for (let e = 0; e < race.eventCount; e++) if (race.events[e].car === car.index) events.push({ type: race.events[e].type, time: i * SIM_DT, before, after: car.speed });
    race.eventCount = 0;
    frames.push({ time: (i + 1) * SIM_DT, speed: car.speed, he: car.headingError, state: car.state, d: car.d });
  }
  const hit = events.find((e) => e.type === 'obstacle'), landing = events.find((e) => e.type === 'landing');
  if (process.argv.includes('--events')) console.log('E5 events', events.map((e) => `${e.type}@${e.time.toFixed(2)} ${(e.before * KMH).toFixed(0)}->${(e.after * KMH).toFixed(0)}`).join(', '));
  const at = (t) => frames.find((f) => f.time >= landing.time + t);
  const stop = frames.find((f) => f.time > landing.time && f.speed < 0.5);
  out.E5 = { reference: { hitSpeed: 240, flightSeconds: 0.6, landing: '227 -> 224 km/h', explosion: false, earlySlideKmhPerSecond: 30, lateSlideKmhPerSecond: 180, stopSecondsAfterLanding: 2.1,
      turnDegreesIn084s: 75, viewSecondDipPercent: 34, viewSettledSecondsAfterContact: 1.7, trembleHz: 12.5 },
    game: { hitSpeed: r1(hit.before * KMH), flightSeconds: r2(landing.time - hit.time), landing: `${r1(landing.before * KMH)} -> ${r1(landing.after * KMH)} km/h`, explosion: events.some((e) => e.type === 'crash'),
      earlySlideKmhPerSecond: r1((at(0.05).speed - at(0.55).speed) * KMH / 0.5), lateSlideKmhPerSecond: r1((at(1.4).speed - at(1.7).speed) * KMH / 0.3), stopSecondsAfterLanding: r2(stop.time - landing.time),
      turnDegreesIn084s: r1(Math.abs(at(0.94).he - at(0.1).he) * 57.3), viewSecondDipPercent: r1(CRASH_CAMERA.dipDepthLight * 100), viewSettledSecondsAfterContact: r2(T.flightTimeObstacle + crashPitchDuration(false)),
      trembleHz: CRASH_CAMERA.trembleHz, handedBackSecondsAfterStop: r2((frames.find((f) => f.time > stop.time && f.state === CAR_STATE.RACING) || { time: NaN }).time - stop.time),
      handedBackWhereItStopped: Math.abs((frames.find((f) => f.time > stop.time && f.state === CAR_STATE.RACING) || { d: NaN }).d - stop.d) < 0.1, automaticRepositioning: events.some((e) => e.type === 'reset') },
    comment: 'after the slide the car is handed back to its driver where it stopped (the reference footage fades out there)' };
}
writeFileSync(new URL('../benchmarks/collision-comparison.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
