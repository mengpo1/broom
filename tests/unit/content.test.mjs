// Content and data: circuits, scenery layout, localisation, storage, game modes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { CIRCUITS, SEASONS, getCircuit } from '../../src/tracks/track-catalog.js';
import { buildSceneryLayout } from '../../src/tracks/scenery-layout.js';
import { THEMES } from '../../src/tracks/themes.js';
import { expandScenerySpecs } from '../../src/art/environments/scenery-specs.js';
import { hasSceneryPainter } from '../../src/art/environments/scenery-painters.js';
import { getPalette, BASE_PALETTE } from '../../src/art/palettes/palettes.js';
import { FR } from '../../src/localization/fr.js';
import { EN } from '../../src/localization/en.js';
import { t, setLanguage } from '../../src/localization/i18n.js';
import { Storage, defaultSave } from '../../src/persistence/storage.js';
import { ArcadeSession, ChampionshipSession, TrainingSession } from '../../src/gameplay/sessions.js';
import { newChampionship, applyRaceResult, standings, buildGrid, qualifyingTimes, CHAMPIONSHIP_FIELD } from '../../src/gameplay/championship.js';
import { DRIVERS, PLAYER_DRIVERS } from '../../src/vehicles/liveries.js';
import { Race, RACE_PHASE, SIM_DT } from '../../src/gameplay/race.js';
import { TextBuffer } from '../../src/ui/text-painter.js';

test('three seasons of six original circuits, each a closed, drivable loop', () => {
  assert.equal(SEASONS.length, 3);
  assert.equal(CIRCUITS.length, 18);
  for (const season of SEASONS) assert.equal(season.circuits.length, 6);
  assert.equal(new Set(CIRCUITS.map((c) => c.id)).size, 18);
  for (const def of CIRCUITS) {
    const track = buildTrack(def);
    assert.ok(track.length > 2500 && track.length < 8000, `${def.id}: length ${track.length}`);
    const gap = Math.hypot(track.x[0] - track.x[track.n - 1], track.z[0] - track.z[track.n - 1]);
    assert.ok(gap < track.ds * 1.6, `${def.id}: loop closes (${gap})`);
    let turned = 0;
    for (let i = 0; i < track.n; i++) turned += track.kappa[i] * track.ds;
    assert.ok(Math.abs(Math.abs(turned) - Math.PI * 2) < 0.2, `${def.id}: one full turn (${turned})`);
    assert.ok(THEMES[track.theme], `${def.id}: theme ${track.theme}`);
    assert.ok(track.pit && track.halfWidth > 5 && track.line.length === track.n);
    for (let i = 0; i < track.n; i += 7) assert.ok(track.barrierL[i] > track.halfWidth && track.barrierR[i] > track.halfWidth);
  }
});

test('scenery layout: deterministic, every object has a drawing, objects stay off the road', () => {
  const specs = new Map(expandScenerySpecs().map((s) => [s.id, s]));
  for (const id of ['hazelbrook', 'porto-sereno', 'roca-alta', 'meridian-docks', 'ouarzane']) {
    const track = buildTrack(getCircuit(id));
    const a = buildSceneryLayout(track), b = buildSceneryLayout(track);
    assert.equal(a.props.length, b.props.length);
    assert.deepEqual(a.props.slice(0, 50).map((p) => [p.id, p.s, p.d]), b.props.slice(0, 50).map((p) => [p.id, p.s, p.d]));
    assert.ok(a.strips.length > 6 && a.props.length > 50, `${id}: ${a.strips.length} strips, ${a.props.length} props`);
    for (const strip of a.strips) { assert.ok(specs.has(strip.id), `spec for ${strip.id}`); assert.equal(specs.get(strip.id).kind, 'strip'); assert.ok(hasSceneryPainter(specs.get(strip.id).family), `painter for ${strip.id}`); }
    let last = -1;
    for (const prop of a.props) {
      assert.ok(specs.has(prop.id), `spec for ${prop.id}`);
      assert.ok(hasSceneryPainter(specs.get(prop.id).family), `painter for ${prop.id}`);
      assert.ok(prop.sample >= last, 'props are indexed along the lap'); last = prop.sample;
      const spans = prop.id.startsWith('gantry') || prop.id.startsWith('bridge');
      if (!spans) assert.ok(Math.abs(prop.d) > track.halfWidth + 1, `${prop.id} stands off the road (${prop.d})`);
    }
    assert.equal(a.propStart[track.n], a.props.length);
    assert.equal(a.props.filter((p) => p.id === 'gantry.start').length, 1);
  }
});

test('palettes: every theme defines every colour name', () => {
  for (const theme of Object.keys(THEMES)) {
    const p = getPalette(theme);
    for (const key of Object.keys(BASE_PALETTE)) assert.ok(p[key], `${theme}.${key}`);
    assert.notEqual(p.ink.toLowerCase(), '#000000', 'ink is never pure black');
  }
});

test('localisation: French and English dictionaries have the same keys; placeholders are filled', () => {
  assert.deepEqual(Object.keys(FR).sort(), Object.keys(EN).sort());
  for (const key of Object.keys(FR)) {
    const holes = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join();
    assert.equal(holes(FR[key]), holes(EN[key]), `placeholders of ${key}`);
  }
  setLanguage('en');
  assert.equal(t('hud.overtake', { n: 3 }), 'OVERTAKE! P3');
  setLanguage('fr');
  assert.equal(t('hud.overtake', { n: 3 }), 'DÉPASSEMENT ! P3');
  assert.equal(t('missing.key'), 'missing.key');
});

test('storage: saves and reloads settings, records and championship; survives broken data', () => {
  const store = new Map();
  const backend = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  const a = new Storage(backend);
  assert.deepEqual(a.data.settings.effects, defaultSave().settings.effects);
  a.data.settings.language = 'en'; a.data.settings.effects.speedLines = false; a.data.settings.controls[1].keys.throttle = 'KeyI';
  assert.equal(a.recordLap('hazelbrook', 61.5), true);
  assert.equal(a.recordLap('hazelbrook', 63), false);
  assert.equal(a.recordLap('hazelbrook', 60.1), true);
  a.data.championship = newChampionship(1, 'pro');
  assert.ok(a.save());
  const b = new Storage(backend);
  assert.equal(b.data.settings.language, 'en');
  assert.equal(b.data.settings.effects.speedLines, false);
  assert.equal(b.data.settings.effects.dust, true, 'unknown keys keep their defaults');
  assert.equal(b.data.settings.controls[1].keys.throttle, 'KeyI');
  assert.equal(b.data.records.hazelbrook, 60.1);
  assert.equal(b.data.championship.season, 1);
  store.set('virage-gp-bd:v1', '{not json');
  assert.equal(new Storage(backend).data.settings.language, 'fr');
  assert.equal(new Storage(null).save(), false, 'no storage available: the game still runs');
});

test('championship: qualifying grid, points for the first six, standings, season end', () => {
  const track = buildTrack(getCircuit('hazelbrook'));
  const state = newChampionship(0, 'pro');
  const times = qualifyingTimes(track, state);
  assert.equal(times.length, CHAMPIONSHIP_FIELD);
  assert.ok(times.every((q) => q.time > 45 && q.time < 70));
  assert.deepEqual(qualifyingTimes(track, state).map((q) => q.time), times.map((q) => q.time), 'deterministic');
  const fastest = Math.min(...times.map((q) => q.time));
  assert.equal(buildGrid(track, state, fastest - 1)[0].human, true, 'a faster lap gives pole');
  assert.equal(buildGrid(track, state, 0)[CHAMPIONSHIP_FIELD].human, true, 'no time: last on the grid');
  const drivers = [...DRIVERS.slice(0, CHAMPIONSHIP_FIELD), PLAYER_DRIVERS[0]];
  for (let round = 0; round < 6; round++) {
    assert.equal(state.finished, false);
    const order = [PLAYER_DRIVERS[0], ...DRIVERS.slice(0, CHAMPIONSHIP_FIELD)];
    applyRaceResult(state, order.map((driver, i) => ({ driver, position: i + 1, retired: i === 3 })));
  }
  assert.equal(state.finished, true);
  assert.equal(state.unlocked, 2, 'the next season is unlocked');
  const table = standings(state);
  assert.equal(table.length, drivers.length);
  assert.equal(table[0].human, true); assert.equal(table[0].points, 60);
  assert.equal(table.find((r) => r.driver === DRIVERS[2]).points, 0, 'a retired car scores nothing');
  assert.equal(table.find((r) => r.driver === DRIVERS[4]).points, 6);
});

function finish(session, getTrack, drivePlayer = true) {
  const config = session.nextRace(getTrack);
  const race = new Race({ ...config, track: getTrack(config.circuitId) });
  if (session.bind) session.bind(race);
  for (const car of race.cars) if (car.isHuman) car.autoDrive = drivePlayer;
  let steps = 0;
  while (race.phase !== RACE_PHASE.FINISHED && steps < 900 / SIM_DT) { race.step(SIM_DT); race.eventCount = 0; steps++; if (!drivePlayer && race.time > 200) break; }
  return { result: session.finishRace(race, getTrack), race, config };
}

test('game modes: arcade progression and score, championship round, training', () => {
  const tracks = new Map();
  const getTrack = (id) => { if (!tracks.has(id)) tracks.set(id, buildTrack(getCircuit(id))); return tracks.get(id); };
  const setup = { wing: 2, tyres: 'medium', gearbox: 'auto' };
  const arcade = new ArcadeSession({ setup });
  const first = finish(arcade, getTrack);
  assert.equal(first.config.entries.findIndex((e) => e.human), first.config.entries.length - 1, 'arcade: the player starts last');
  assert.ok(first.result.arcade.qualified, `computer-driven player qualifies (P${first.result.position}, target ${first.result.arcade.target})`);
  assert.ok(first.result.arcade.total > 0 && arcade.stage === 1 && arcade.score() === first.result.arcade.total);
  assert.notEqual(arcade.circuitId(), first.config.circuitId, 'next circuit');
  const champ = ChampionshipSession.create(0, 'amateur', { setup, qualifying: true }, 1);
  const quali = finish(champ, getTrack);
  assert.equal(quali.config.kind, 'qualifying');
  assert.ok(quali.result.qualifying.playerTime > 40 && quali.result.qualifying.grid.length === CHAMPIONSHIP_FIELD + 1 && quali.result.done === false);
  const round = finish(champ, getTrack);
  assert.equal(round.config.kind, 'race');
  assert.equal(round.config.entries.findIndex((e) => e.human) + 1, quali.result.qualifying.position, 'the race grid follows qualifying');
  assert.ok(round.result.standings && champ.state.round === 1 && round.result.classification.every((r) => typeof r.points === 'number'));
  const training = new TrainingSession({ circuitId: 'sablon', setup });
  const tConfig = training.nextRace();
  assert.equal(tConfig.entries.length, 1); assert.equal(tConfig.laps, Infinity);
  assert.equal(training.nextRace(), null);
});

test('HUD number formatting is exact and allocation-free', () => {
  const buf = new TextBuffer(24);
  const str = () => String.fromCharCode(...buf.codes.subarray(0, buf.length));
  buf.clear().time(83.4567); assert.equal(str(), '1:23.457');
  buf.clear().time(0); assert.equal(str(), '-:--.---');
  buf.clear().time(59.9996); assert.equal(str(), '1:00.000');
  buf.clear().int(7, 3); assert.equal(str(), '007');
  buf.clear().int(312).char(47).int(16); assert.equal(str(), '312/16');
  buf.clear().int(0); assert.equal(str(), '0');
});
