// The collision test bench (src/core/collision-lab.js) without a browser: the same module, the same
// scenarios, driven through the real simulation. Only what the page provides is replaced: the race
// is started the way main.js does it (quickRace), the controls of the player are fed before each step
// the way the application does it (the input layer first, then the bench), and the events of the race
// are handed to the bench.
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { getSceneryLayout } from '../../src/tracks/scenery-layout.js';
import { Race, SIM_DT } from '../../src/gameplay/race.js';
import { RULE_PRESETS } from '../../src/gameplay/rules.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { CollisionLab } from '../../src/core/collision-lab.js';

export function headlessLab() {
  const listeners = [], tracks = new Map();
  const app = {
    race: null,
    raw: [],                     // every event of the race as it was emitted: { type, car, value, other }
    keys: null,                  // what the player holds: { steer, throttle, brake } or null (nothing pressed)
    on(fn) { listeners.push(fn); },
    simulate() {
      const race = app.race, k = app.keys;
      race.setPlayerInput(0, k ? k.steer || 0 : 0, k ? k.throttle || 0 : 0, k ? k.brake || 0 : 0, 0, false, false);     // input layer (game-app.js: input.apply)
      if (app.lab) app.lab.beforeStep();
      race.step(SIM_DT);
      for (let i = 0; i < race.eventCount; i++) {
        const e = race.events[i];
        app.raw.push({ type: e.type, car: e.car, value: e.value, other: e.other });
        for (const fn of listeners) fn(e.type, e);
      }
      race.eventCount = 0;
    },
  };
  const quickRace = (options = {}) => {
    const entries = DRIVERS.slice(0, options.opponents ?? 15).map((driver) => ({ driver }));
    const human = { driver: PLAYER_DRIVERS[0], human: true, playerIndex: 0, autoDrive: options.autoDrive !== false };
    entries.splice(Math.min(entries.length, options.gridPosition ?? entries.length), 0, human);
    const id = options.circuit || 'hazelbrook';
    if (!tracks.has(id)) { const track = buildTrack(getCircuit(id)); getSceneryLayout(track); tracks.set(id, track); }
    app.race = new Race({ track: tracks.get(id), laps: options.laps ?? 3, entries, rules: { ...RULE_PRESETS[options.rules || 'racing'] }, difficulty: options.difficulty || 'pro', seed: options.seed ?? 1 });
    return app.race;
  };
  app.lab = new CollisionLab(app, quickRace);
  return { app, lab: app.lab };
}

/**
 * Play a case of the bench for `seconds`: the events, and the state of the player's car and of the car
 * ahead at every step. `handOver`: false, the bench keeps driving after the event (as in the recordings);
 * true, the car is handed back and `keys(lab, t)` says what the player then holds.
 */
export function playCase(name, seconds, { handOver = false, keys = null } = {}) {
  const { app, lab } = headlessLab();
  if (!lab.start(name, { handOver })) throw new Error(`unknown case ${name}`);
  const me = lab.me, lead = lab.lead, events = [], frames = [];
  for (let i = 0; i < seconds / SIM_DT; i++) {
    const t = i * SIM_DT;
    app.keys = keys ? keys(lab, t) : null;
    app.simulate();
    lab.events.length = 0;
    for (const e of app.raw.splice(0)) {
      if (!['bump', 'wheel', 'launch', 'hop', 'landing', 'obstacle', 'crash', 'wall', 'restart', 'reset', 'contact'].includes(e.type)) continue;
      events.push({ ...e, t: +(t + SIM_DT).toFixed(4), frame: frames.length, mine: e.car === me.index });
    }
    const snap = (c) => (c ? { x: c.x, z: c.z, s: c.s, d: c.d, heading: c.heading, speed: c.speed, state: c.state, steer: c.steer, inSteer: c.inSteer, yawRate: c.yawRate, airHeight: c.airHeight || 0, params: c.params } : null);
    frames.push({ t: t + SIM_DT, released: lab.released, me: snap(me), lead: snap(lead) });
  }
  return { lab, race: lab.race, me, lead, events, frames, mine: events.filter((e) => e.mine) };
}
