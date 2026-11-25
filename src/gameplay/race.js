// A race session: owns the cars, runs the fixed-step simulation, start procedure, timing,
// classification and pit stops. Independent of rendering, input devices and number of views.

import { Random, hashString } from '../core/random.js';
import { BASE_CAR_SPEC, DRIVING_PROFILES, deriveCarParams, sanitizeSetup } from '../vehicles/car-spec.js';
import { CAR_STATE, createCarState, placeCar, stepCar } from '../physics/car-physics.js';
import { resolveCarContacts, updateDrafts } from '../physics/collisions.js';
import { collideObstacles } from '../physics/obstacles.js';
import { getSceneryLayout } from '../tracks/scenery-layout.js';
import { gridSlot, pitBox, relativeS } from '../tracks/track-builder.js';
import { DIFFICULTY_LEVELS, makeAiSkill } from '../ai/driver-profiles.js';
import { createAiController, updateAiController } from '../ai/driver-ai.js';
import { buildSpeedProfile } from '../ai/speed-profile.js';
import { resolveRules } from './rules.js';

export const RACE_PHASE = { COUNTDOWN: 'countdown', RACING: 'racing', FINISHED: 'finished' };
export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;

const MAX_EVENTS = 160;
const slot = { s: 0, d: 0 };

/**
 * @typedef {object} RaceEntry
 * @property {object} driver        driver record (see vehicles/liveries.js)
 * @property {boolean} [human]      controlled by a player
 * @property {number} [playerIndex] 0 or 1 for humans
 * @property {object} [setup]       { wing, tyres, gearbox }
 * @property {boolean} [autoDrive]  let the computer drive a human car (demo, tests)
 */
export class Race {
  /**
   * @param {object} config { track, laps, entries: RaceEntry[], rules, difficulty, seed, kind }
   */
  constructor(config) {
    this.track = config.track;
    this.laps = config.laps ?? this.track.def.laps ?? 5;
    this.kind = config.kind || 'race';
    this.rules = resolveRules(config.rules, this.track);
    this.difficulty = DIFFICULTY_LEVELS[config.difficulty] || DIFFICULTY_LEVELS.pro;
    this.seed = (config.seed ?? hashString(this.track.id)) >>> 0;
    this.rng = new Random(this.seed);
    this.profile = DRIVING_PROFILES[this.rules.profile] || DRIVING_PROFILES.racing;
    this.phase = RACE_PHASE.COUNTDOWN;
    this.time = 0;
    this.tick = 0;
    this.countdown = this.rules.countdown;
    this.lights = 0;
    this.goHold = this.rng.range(0.5, 1.3);
    this.leaderFinished = false;
    this.finishCount = 0;
    this.endTimer = 0;
    this.cars = [];
    this.controllers = [];
    this.playerCars = [null, null];
    // solid roadside objects of this track, and which ones have been knocked down in this race
    this.obstacles = getSceneryLayout(this.track).obstacles;
    this.obstacleDown = new Uint8Array(this.obstacles.length);
    this.events = Array.from({ length: MAX_EVENTS }, () => ({ type: '', car: 0, value: 0, other: -1 }));
    this.eventCount = 0;
    this.emit = (type, car, value = 0, other = -1) => {
      if (this.eventCount >= MAX_EVENTS) return;
      const e = this.events[this.eventCount++];
      e.type = type; e.car = car; e.value = value; e.other = other;
    };

    const entries = config.entries;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const car = createCarState(i);
      car.driver = entry.driver;
      car.isHuman = !!entry.human;
      car.playerIndex = entry.human ? entry.playerIndex ?? 0 : -1;
      car.autoDrive = !!entry.autoDrive;
      car.teamIndex = entry.driver.team;
      const skill = makeAiSkill(entry.driver, car.isHuman ? DIFFICULTY_LEVELS.expert : this.difficulty);
      const setup = sanitizeSetup(entry.setup);
      car.setup = setup;
      car.compound = setup.tyres; car.nextCompound = setup.tyres;
      car.params = deriveCarParams(BASE_CAR_SPEC, setup, this.profile, car.isHuman ? null : skill);
      car.fuel = BASE_CAR_SPEC.fuelCapacity;
      car.gridPosition = i + 1; car.position = i + 1;
      if (this.rules.flyingStart) placeCar(car, this.track, -360 - i * 14, 0);
      else { gridSlot(this.track, i, slot); placeCar(car, this.track, slot.s, slot.d); }
      car.progress = relativeS(this.track, car.s);
      pitBox(this.track, car.teamIndex, slot);
      car.pitBoxS = slot.s + (i % 2) * 5.5;
      car.rpm = BASE_CAR_SPEC.rpmIdle;
      this.cars.push(car);
      this.controllers.push(createAiController(skill, this.seed ^ hashString(entry.driver.id)));
      if (car.isHuman) this.playerCars[car.playerIndex] = car;
    }
    this.order = this.cars.map((c) => c.index);
    this.humanCount = this.cars.filter((c) => c.isHuman).length;
    const reference = deriveCarParams(BASE_CAR_SPEC, null, this.profile, null);
    this.speedProfile = buildSpeedProfile(this.track, reference, this.difficulty.brakeUsage);
  }

  /** Feed one player's controls (called by the input layer before each step). */
  setPlayerInput(playerIndex, steer, throttle, brake, shift, boost, reset) {
    const car = this.playerCars[playerIndex];
    if (!car || car.pitAuto || car.autoDrive || car.finished) return;
    car.inSteer = steer; car.inThrottle = throttle; car.inBrake = brake;
    if (shift) car.inShift = shift;
    car.inBoost = !!boost;
    if (reset) car.inReset = true;
  }

  /** Advance the simulation by one fixed step. */
  step(dt = SIM_DT) {
    this.tick++;
    const cars = this.cars, n = cars.length;
    if (this.phase === RACE_PHASE.COUNTDOWN) {
      this.countdown -= dt;
      const lit = Math.min(5, Math.max(0, Math.floor((this.rules.countdown - this.countdown) / (this.rules.countdown / 5.5))));
      if (lit !== this.lights) { this.lights = lit; this.emit('light', -1, lit); }
      for (let i = 0; i < n; i++) {
        const car = cars[i];
        if (!car.isHuman || car.autoDrive) car.inThrottle = this.lights >= 3 ? 0.55 + 0.25 * Math.sin(this.tick * 0.11 + i) : 0.1;
        stepCar(car, this.track, dt, this.rules, this.emit);
      }
      if (this.countdown <= -this.goHold || (this.rules.flyingStart && this.countdown <= 2.5)) this.start();
      return;
    }
    this.time += dt;
    for (let i = 0; i < n; i++) {
      const car = cars[i];
      if (!car.isHuman || car.pitAuto || car.autoDrive || car.finished) updateAiController(this.controllers[i], car, this, dt);
    }
    if ((this.tick & 3) === 0) updateDrafts(cars);
    for (let i = 0; i < n; i++) if (!cars[i].removed) stepCar(cars[i], this.track, dt, this.rules, this.emit);
    resolveCarContacts(cars, this.rules, this.time, this.emit, dt, this.track);
    if (this.obstacles.length) collideObstacles(cars, this.track, this.obstacles, this.obstacleDown, this.emit);
    for (let i = 0; i < n; i++) {
      const car = cars[i];
      if (car.removed) continue;
      this.updatePit(car, dt);
      this.updateLaps(car);
      this.updateRetirement(car, dt);
    }
    this.updateOrder();
    this.updateEnd(dt);
  }

  start() {
    this.phase = RACE_PHASE.RACING;
    this.time = 0;
    this.lights = 0;
    for (const car of this.cars) { car.state = CAR_STATE.RACING; car.lapStartTime = 0; car.sectorStart = 0; }
    this.emit('green', -1, 0);
  }

  updatePit(car, dt) {
    const rules = this.rules, pit = this.track.pit;
    if (car.state === CAR_STATE.SERVICE) {
      car.serviceTimer -= dt;
      if (car.serviceTimer <= 0) this.finishService(car);
      return;
    }
    if (!car.inPit) { car.servicedThisVisit = false; car.pitAuto = false; return; }
    if (!rules.pitStops) return;
    const rel = relativeS(this.track, car.s);
    if (car.isHuman && !car.autoDrive) {
      if (!car.wantsPit && !car.servicedThisVisit && rel < pit.wallStartS) car.wantsPit = true;
      car.pitAuto = car.state === CAR_STATE.RACING;
    }
    if (car.state === CAR_STATE.RACING && car.wantsPit && Math.abs(rel - car.pitBoxS) < 2.4 && Math.abs(car.speed) < 1.3) {
      car.state = CAR_STATE.SERVICE;
      const refuel = rules.fuel ? 2.4 * (1 - car.fuel / BASE_CAR_SPEC.fuelCapacity) : 0;
      car.serviceTotal = 3 + refuel + (rules.damage ? 5 * car.damage : 0);
      car.serviceTimer = car.serviceTotal;
      this.emit('pitStart', car.index, car.serviceTotal);
    }
  }

  finishService(car) {
    car.state = CAR_STATE.RACING;
    car.tyreWear = 0; car.puncture = false; car.damage = 0;
    car.fuel = BASE_CAR_SPEC.fuelCapacity;
    car.wantsPit = false; car.servicedThisVisit = true; car.pitStops++;
    if (car.nextCompound !== car.compound) {
      car.compound = car.nextCompound;
      car.setup = { ...car.setup, tyres: car.compound };
      const skill = car.isHuman ? null : this.controllers[car.index].skill;
      car.params = deriveCarParams(BASE_CAR_SPEC, car.setup, this.profile, skill);
    }
    this.emit('pitDone', car.index, car.pitStops);
  }

  updateLaps(car) {
    if (car.finished || car.state === CAR_STATE.RETIRED) return;
    const length = this.track.length;
    if (this.rules.flyingStart && !car.timingStarted) {
      if (car.progress >= 0) {
        car.timingStarted = true;
        car.lapStartTime = this.time - car.progress / Math.max(car.speed, 1);
        car.sectorStart = car.lapStartTime;
        this.emit('lapStart', car.index, 0);
      }
      return;
    }
    const inLap = car.progress - car.lap * length;
    const sector = inLap < this.track.sectors[0] ? 0 : inLap < this.track.sectors[1] ? 1 : 2;
    if (sector > car.sector) {
      car.lastSectorTime = this.time - car.sectorStart;
      car.sectorStart = this.time;
      car.sector = sector;
      this.emit('sector', car.index, sector);
    }
    if (inLap >= length) {
      const crossed = this.time - (inLap - length) / Math.max(car.speed, 1);
      const lapTime = crossed - car.lapStartTime;
      car.lap++;
      car.lastLapTime = lapTime;
      car.lapTimes.push(lapTime);
      const best = !car.bestLapTime || lapTime < car.bestLapTime;
      if (best) car.bestLapTime = lapTime;
      car.lapStartTime = crossed; car.sectorStart = crossed; car.sector = 0;
      this.emit('lap', car.index, lapTime, best ? 1 : 0);
      if (this.rules.failures && !car.isHuman && this.rng.chance(this.rules.failureChancePerLap)) {
        car.engineOut = true;
        this.emit('engine', car.index, 0);
      }
      if (car.lap >= this.laps || this.leaderFinished) {
        car.finished = true;
        car.finishTime = crossed;
        car.finishOrder = this.finishCount++;
        if (this.cars.length > 1 || Number.isFinite(this.laps)) this.leaderFinished = true;
        this.emit('finish', car.index, car.finishOrder + 1);
      }
    }
  }

  updateRetirement(car, dt) {
    if (car.state === CAR_STATE.RACING) {
      const dead = car.engineOut || (this.rules.fuel && car.fuel <= 0) || (this.rules.damage && car.damage >= 1);
      if (dead && !car.finished) { car.engineOut = true; car.state = CAR_STATE.RETIRED; car.retireTimer = 0; this.emit('retire', car.index, 0); }
    } else if (car.state === CAR_STATE.RETIRED && Math.abs(car.speed) < 0.5) {
      car.retireTimer = (car.retireTimer || 0) + dt;
      if (car.retireTimer > 3 && !car.isHuman) car.removed = true;
    }
  }

  orderKey(car) {
    if (car.finished) return 1e12 + car.lap * 1e6 - car.finishTime;
    if (car.state === CAR_STATE.RETIRED) return car.progress - 1e8;
    return car.progress;
  }

  updateOrder() {
    const order = this.order, cars = this.cars;
    for (let i = 1; i < order.length; i++) {
      const idx = order[i], key = this.orderKey(cars[idx]);
      let j = i - 1;
      while (j >= 0 && this.orderKey(cars[order[j]]) < key) { order[j + 1] = order[j]; j--; }
      order[j + 1] = idx;
    }
    const counting = this.time > 2.5;
    for (let i = 0; i < order.length; i++) {
      const car = cars[order[i]];
      const position = i + 1;
      if (position !== car.position) {
        if (counting && car.state === CAR_STATE.RACING && !car.finished) {
          if (position < car.position) { car.overtakes += car.position - position; this.emit('overtake', car.index, car.position - position); }
          else this.emit('overtaken', car.index, position - car.position);
        }
        car.position = position;
      }
    }
  }

  updateEnd(dt) {
    if (this.phase !== RACE_PHASE.RACING) return;
    let humansDone = this.humanCount > 0, allDone = true;
    for (const car of this.cars) {
      const done = car.finished || car.state === CAR_STATE.RETIRED;
      if (!done) allDone = false;
      if (car.isHuman && !done) humansDone = false;
    }
    if (allDone || humansDone) this.endTimer += dt;
    else if (this.leaderFinished && this.humanCount === 0) { this.endTimer += dt * 0.1; }
    if (this.endTimer > (allDone ? 1.5 : 4)) {
      this.phase = RACE_PHASE.FINISHED;
      this.emit('raceEnd', -1, 0);
    }
  }

  /** Current classification, best first. */
  classification() {
    const leader = this.cars[this.order[0]];
    return this.order.map((index, i) => {
      const car = this.cars[index];
      const retired = car.state === CAR_STATE.RETIRED || car.removed;
      let gap = 0, lapsDown = 0;
      if (i > 0) {
        if (car.finished && leader.finished) { lapsDown = leader.lap - car.lap; gap = car.finishTime - leader.finishTime; }
        else { lapsDown = Math.floor((leader.progress - car.progress) / this.track.length); gap = (leader.progress - car.progress) / Math.max(20, leader.speed); }
      }
      return {
        position: i + 1, carIndex: index, driver: car.driver, isHuman: car.isHuman, playerIndex: car.playerIndex,
        laps: car.lap, finished: car.finished, retired, time: car.finished ? car.finishTime : this.time,
        gap, lapsDown: Math.max(0, lapsDown), bestLap: car.bestLapTime, pitStops: car.pitStops,
      };
    });
  }
}
