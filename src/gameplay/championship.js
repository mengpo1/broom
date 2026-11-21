// Championship: three seasons of six rounds, qualifying then race, points for the first six.
// Pure data and functions (saved as JSON by persistence/storage.js).

import { SEASONS } from '../tracks/track-catalog.js';
import { POINTS_TABLE } from './rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../vehicles/liveries.js';
import { Random, hashString } from '../core/random.js';
import { BASE_CAR_SPEC, DRIVING_PROFILES, deriveCarParams } from '../vehicles/car-spec.js';
import { DIFFICULTY_LEVELS, makeAiSkill } from '../ai/driver-profiles.js';
import { buildSpeedProfile, estimateLapTime } from '../ai/speed-profile.js';

export const CHAMPIONSHIP_FIELD = 15;      // computer drivers entered in a season
/** Measured ratio between the computer drivers' real best laps and the analytic estimate (see docs/specifications). */
export const QUALIFYING_CALIBRATION = 1.035;

export function newChampionship(seasonIndex, difficulty, unlocked = 1) {
  return { season: seasonIndex, round: 0, difficulty, points: {}, history: [], finished: false, unlocked: Math.max(unlocked, seasonIndex + 1) };
}

export function currentCircuit(state) { return SEASONS[state.season].circuits[state.round]; }
export function roundCount(state) { return SEASONS[state.season].circuits.length; }

/** Championship entrants (computer drivers), best rated first. */
export function championshipDrivers() { return DRIVERS.slice(0, CHAMPIONSHIP_FIELD); }

/** Simulated qualifying times of the computer drivers on a track: [{ driver, time }]. Deterministic per round. */
export function qualifyingTimes(track, state) {
  const difficulty = DIFFICULTY_LEVELS[state.difficulty] || DIFFICULTY_LEVELS.amateur;
  const profile = DRIVING_PROFILES.racing;
  const reference = deriveCarParams(BASE_CAR_SPEC, null, profile, null);
  const speeds = buildSpeedProfile(track, reference, difficulty.brakeUsage);
  const rng = new Random(hashString(`quali:${track.id}:${state.season}:${state.round}`));
  return championshipDrivers().map((driver) => {
    const skill = makeAiSkill(driver, difficulty);
    const params = deriveCarParams(BASE_CAR_SPEC, null, profile, skill);
    const time = estimateLapTime(track, params, speeds, skill.pace) * QUALIFYING_CALIBRATION * (1 + rng.range(0, 0.007));
    return { driver, time };
  });
}

/**
 * Starting grid from the qualifying session.
 * @param playerTime the player's lap in seconds (0 or negative = no time: starts last)
 * @returns ordered list of { driver, time, human }
 */
export function buildGrid(track, state, playerTime) {
  const grid = qualifyingTimes(track, state).map((q) => ({ ...q, human: false }));
  grid.push({ driver: PLAYER_DRIVERS[0], time: playerTime > 0 ? playerTime : Infinity, human: true });
  grid.sort((a, b) => a.time - b.time);
  return grid;
}

/** Add the points of a finished race and move to the next round. classification: Race.classification(). */
export function applyRaceResult(state, classification) {
  const order = [];
  for (const row of classification) {
    const points = row.retired ? 0 : POINTS_TABLE[row.position - 1] || 0;
    state.points[row.driver.id] = (state.points[row.driver.id] || 0) + points;
    order.push(row.driver.id);
  }
  state.history.push(order);
  state.round++;
  if (state.round >= roundCount(state)) {
    state.finished = true;
    state.unlocked = Math.min(SEASONS.length, Math.max(state.unlocked, state.season + 2));
  }
  return state;
}

/** Standings: [{ driver, points, position }] best first. */
export function standings(state) {
  const all = [...championshipDrivers(), PLAYER_DRIVERS[0]];
  const rows = all.map((driver) => ({ driver, points: state.points[driver.id] || 0, human: driver.id === PLAYER_DRIVERS[0].id }));
  rows.sort((a, b) => b.points - a.points || (a.human ? -1 : 0) - (b.human ? -1 : 0));
  rows.forEach((row, i) => { row.position = i + 1; });
  return rows;
}
