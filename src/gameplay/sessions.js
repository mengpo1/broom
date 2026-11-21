// Game modes. A session knows which races to run and what a result means; it produces plain race
// configurations for GameApp.startRace and plain result summaries for the interface. It does not
// touch rendering, input or storage directly (the flow in ui/game-flow.js does).

import { DRIVERS, PLAYER_DRIVERS } from '../vehicles/liveries.js';
import { RULE_PRESETS, pointsForPosition } from './rules.js';
import { SEASONS, getCircuit } from '../tracks/track-catalog.js';
import { CAR_STATE } from '../physics/car-physics.js';
import { newChampionship, currentCircuit, roundCount, buildGrid, applyRaceResult, standings } from './championship.js';

export const ARCADE = { field: 11, laps: 2, overtakeScore: 300, positionScore: 200, timeBudget: 4200, cleanBonus: 500 };
const ARCADE_CIRCUITS = SEASONS.flatMap((s) => s.circuits);
const ARCADE_LEVELS = ['novice', 'novice', 'amateur', 'amateur', 'amateur', 'pro', 'pro', 'pro', 'pro', 'expert'];

/** Race entries: computer drivers in rating order with the humans inserted at the given grid slots. */
export function buildEntries(opponentCount, humans) {
  const entries = DRIVERS.slice(0, opponentCount).map((driver) => ({ driver }));
  const sorted = humans.slice().sort((a, b) => a.grid - b.grid);
  for (const h of sorted) {
    const slot = Math.max(0, Math.min(entries.length, h.grid));
    entries.splice(slot, 0, { driver: PLAYER_DRIVERS[h.player], human: true, playerIndex: h.player, setup: h.setup, autoDrive: !!h.autoDrive });
  }
  return entries;
}

function viewsOf(entries) {
  const views = [];
  for (let p = 0; p < 2; p++) { const i = entries.findIndex((e) => e.human && e.playerIndex === p); if (i >= 0) views.push(i); }
  return views;
}

function summarize(race, playerIndex = 0) {
  const classification = race.classification();
  const car = race.playerCars[playerIndex];
  const row = car ? classification.find((r) => r.carIndex === car.index) : null;
  return { classification, playerRow: row, retired: !car || car.state === CAR_STATE.RETIRED, position: row ? row.position : 0, laps: race.laps, trackName: race.track.name };
}

/** Free practice: alone on track, endless timed laps. */
export class TrainingSession {
  constructor(options) { this.kind = 'training'; this.options = options; this.started = false; }
  nextRace() {
    if (this.started) return null;
    this.started = true;
    const entries = buildEntries(0, [{ player: 0, grid: 0, setup: this.options.setup }]);
    return { circuitId: this.options.circuitId, laps: Infinity, entries, rules: { ...RULE_PRESETS.training }, difficulty: 'pro', views: [0], kind: 'training' };
  }
  finishRace(race) { return { ...summarize(race), headline: 'results.title', done: true }; }
  score() { return 0; }
}

/** Single race against the field (used by Turbo and by the two-player duel). */
export class SingleRaceSession {
  constructor(kind, options) { this.kind = kind; this.options = options; this.started = false; }
  nextRace() {
    if (this.started) return null;
    this.started = true;
    const o = this.options;
    const count = o.opponents;
    const humans = [];
    for (let p = 0; p < o.players; p++) humans.push({ player: p, grid: Math.max(0, Math.round(count * 0.6) + p), setup: o.setups[p] });
    const entries = buildEntries(count, humans);
    return { circuitId: o.circuitId, laps: o.laps, entries, rules: { ...RULE_PRESETS[o.rules] }, difficulty: o.difficulty, views: viewsOf(entries), kind: this.kind, seed: o.seed };
  }
  finishRace(race) {
    const s = summarize(race, 0);
    const headline = s.retired ? 'results.out' : s.position === 1 ? 'results.win' : s.position <= 3 ? 'results.podium' : 'results.finish';
    return { ...s, headline, done: true };
  }
  score() { return 0; }
}

/** Arcade: start last, overtake enough cars to reach the next circuit; the score accumulates. */
export class ArcadeSession {
  constructor(options) { this.kind = 'arcade'; this.options = options; this.stage = 0; this.total = 0; this.race = null; this.over = false; }
  target() { return Math.max(3, 9 - this.stage); }                 // finishing position required to go on
  level() { return ARCADE_LEVELS[Math.min(this.stage, ARCADE_LEVELS.length - 1)]; }
  circuitId() { return ARCADE_CIRCUITS[this.stage % ARCADE_CIRCUITS.length]; }
  nextRace() {
    if (this.over) return null;
    const entries = buildEntries(ARCADE.field, [{ player: 0, grid: ARCADE.field, setup: this.options.setup }]);
    return { circuitId: this.circuitId(), laps: ARCADE.laps, entries, rules: { ...RULE_PRESETS.arcade }, difficulty: this.level(), views: viewsOf(entries), kind: 'arcade', seed: 100 + this.stage };
  }
  bind(race) { this.race = race; }
  /** Live score shown during the race. */
  score() {
    const car = this.race ? this.race.playerCars[0] : null;
    return this.total + (car ? car.overtakes * ARCADE.overtakeScore : 0);
  }
  finishRace(race) {
    const s = summarize(race, 0);
    const car = race.playerCars[0];
    const qualified = !s.retired && car.finished && s.position <= this.target();
    let gained = car.overtakes * ARCADE.overtakeScore;
    if (!s.retired && car.finished) {
      gained += (race.cars.length - s.position) * ARCADE.positionScore;
      gained += Math.max(0, Math.round(ARCADE.timeBudget - car.finishTime * 12));
      if (car.wallHits === 0 && car.contacts === 0) gained += ARCADE.cleanBonus;
    }
    this.total += gained;
    const result = { ...s, headline: qualified ? 'results.arcadeNext' : 'results.arcadeOut', arcade: { gained, total: this.total, qualified, target: this.target(), stage: this.stage + 1 }, done: !qualified };
    if (qualified) this.stage++; else this.over = true;
    this.race = null;
    return result;
  }
}

/** Championship season: for each round a flying qualifying lap, then the race; points and standings. */
export class ChampionshipSession {
  /** @param state saved championship state (see championship.js) @param options { setup, qualifying: true } */
  constructor(state, options) { this.kind = 'championship'; this.state = state; this.options = options; this.phase = 'qualifying'; this.playerTime = 0; this.grid = null; }
  static create(seasonIndex, difficulty, options, unlocked) { return new ChampionshipSession(newChampionship(seasonIndex, difficulty, unlocked), options); }
  roundLabel() { return this.state.round + 1; }
  nextRace(getTrack) {
    const state = this.state;
    if (state.finished) return null;
    const circuitId = currentCircuit(state);
    if (this.phase === 'qualifying' && this.options.qualifying !== false) {
      const entries = buildEntries(0, [{ player: 0, grid: 0, setup: this.options.setup }]);
      return { circuitId, laps: 1, entries, rules: { ...RULE_PRESETS.training, flyingStart: true }, difficulty: state.difficulty, views: [0], kind: 'qualifying' };
    }
    this.phase = 'race';
    const track = getTrack(circuitId);
    this.grid = buildGrid(track, state, this.playerTime);
    const entries = this.grid.map((g) => (g.human ? { driver: g.driver, human: true, playerIndex: 0, setup: this.options.setup } : { driver: g.driver }));
    const def = getCircuit(circuitId);
    return { circuitId, laps: this.options.laps || def.laps || 5, entries, rules: { ...RULE_PRESETS.racing }, difficulty: state.difficulty, views: viewsOf(entries), kind: 'race', seed: 500 + state.season * 10 + state.round };
  }
  finishRace(race, getTrack) {
    const s = summarize(race, 0);
    if (race.kind === 'qualifying') {
      const car = race.playerCars[0];
      this.playerTime = car.bestLapTime || 0;
      this.phase = 'race';
      const grid = buildGrid(getTrack(currentCircuit(this.state)), this.state, this.playerTime);
      return { ...s, headline: 'results.qualifying', qualifying: { grid, playerTime: this.playerTime, position: grid.findIndex((g) => g.human) + 1 }, done: false };
    }
    for (const row of s.classification) row.points = row.retired ? 0 : pointsForPosition(row.position);
    applyRaceResult(this.state, s.classification);
    this.phase = 'qualifying'; this.playerTime = 0;
    const table = standings(this.state);
    const headline = s.retired ? 'results.out' : s.position === 1 ? 'results.win' : s.position <= 3 ? 'results.podium' : 'results.finish';
    return { ...s, headline, standings: table, seasonOver: this.state.finished, champion: this.state.finished && table[0].human, round: this.state.round, rounds: roundCount(this.state), done: this.state.finished };
  }
  score() { return 0; }
}
