// The collision test bench (src/core/collision-lab.js) without a browser: the same module, the same
// scenarios, driven through the real simulation. Only what the page provides is replaced: the race
// is started the way main.js does it (quickRace) and the events of the race are handed to the bench
// the way the application does it.
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
    on(fn) { listeners.push(fn); },
    simulate() {
      const race = app.race;
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
 * Play a case of the bench for `seconds` (the bench keeps driving after the event): the events of the
 * player's car, and one sample of its state every tenth of a second.
 */
export function playCase(name, seconds, { handOver = false } = {}) {
  const { app, lab } = headlessLab();
  if (!lab.start(name, { handOver })) throw new Error(`unknown case ${name}`);
  const me = lab.me, events = [], samples = [];
  let maxAir = 0;
  for (let i = 0; i < seconds / SIM_DT; i++) {
    app.simulate();
    lab.events.length = 0;
    for (const e of app.raw.splice(0)) {
      if (!['bump', 'wheel', 'launch', 'hop', 'landing', 'obstacle', 'object', 'crash', 'wall', 'restart', 'reset', 'contact'].includes(e.type)) continue;
      events.push({ ...e, value: +(+e.value).toFixed(2), t: +((i + 1) * SIM_DT).toFixed(3), mine: e.car === me.index });
    }
    maxAir = Math.max(maxAir, me.airHeight || 0);
    if (i % 12 === 11) samples.push({ t: +((i + 1) * SIM_DT).toFixed(2), kmh: +(me.speed * 3.6).toFixed(1), d: +me.d.toFixed(2), s: +me.s.toFixed(1), state: me.state, surface: me.surface });
  }
  return { lab, race: lab.race, me, events, samples, maxAir, mine: events.filter((e) => e.mine) };
}
