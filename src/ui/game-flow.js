// Game flow: menus, option pages, intro strip, race, pause, results. A small state machine that
// owns the current session (game mode), paints interface pages through PagePainter and drives the
// GameApp. It is the only module that knows about storage and settings.

import { t, setLanguage, LANGUAGE_ORDER } from '../localization/i18n.js';
import { PagePainter, formatTime } from './pages.js';
import { CIRCUITS, SEASONS, getCircuit } from '../tracks/track-catalog.js';
import { DIFFICULTY_ORDER } from '../ai/driver-profiles.js';
import { TYRE_ORDER, WING_LEVELS } from '../vehicles/car-spec.js';
import { DEFAULT_EFFECTS, QUALITY_PRESETS } from '../core/config.js';
import { ACTIONS, DEVICES, DEFAULT_CONTROLS, cloneControls, keyName } from '../input/bindings.js';
import { TrainingSession, SingleRaceSession, ArcadeSession, ChampionshipSession } from '../gameplay/sessions.js';
import { RACE_PHASE } from '../gameplay/race.js';

const INTRO_DURATION = 4.6;
const cycle = (list, value, step) => list[(list.indexOf(value) + step + list.length) % list.length];
const clampStep = (value, step, lo, hi) => Math.max(lo, Math.min(hi, value + step));

export class GameFlow {
  constructor(app, storage, input, audio) {
    this.app = app; this.storage = storage; this.input = input; this.audio = audio;
    this.painter = new PagePainter();
    this.state = 'menu';            // menu | intro | race | pause | results
    this.stack = [];                // menu pages
    this.session = null;
    this.pending = null;            // race configuration waiting behind the intro strip
    this.introModel = null; this.introTime = 0;
    this.resultModel = null; this.resultQueue = [];
    this.endTimer = 0;
    this.dirty = true;
    this.wipe = 1;
    this.choices = { circuitId: 'hazelbrook', laps: 3, opponents: 15, rules: 'arcade', season: 0, qualifying: true };
    this.lastSize = '';
    input.onPointer = (x, y, type) => this.pointer(x, y, type);
    this.applySettings();
    this.push(this.mainMenu());
  }

  get settings() { return this.storage.data.settings; }

  applySettings() {
    const s = this.settings, app = this.app;
    setLanguage(s.language);
    Object.assign(app.effects, DEFAULT_EFFECTS, s.effects);
    app.splitLayout = s.split;
    const preset = QUALITY_PRESETS[s.quality] || QUALITY_PRESETS.high;
    app.quality.detail = preset.detail; app.quality.propDistance = preset.propDistance;
    this.input.setControls(s.controls);
    if (this.audio) this.audio.setSettings(s.audio);
    if (app.hud) app.hud.refreshLabels();
    this.dirty = true;
  }

  saveSettings() { this.storage.save(); this.applySettings(); }

  sound(name) { if (this.audio) this.audio.uiSound(name); }

  // ---- menu pages ------------------------------------------------------------------------------

  push(page) { this.stack.push(page); this.dirty = true; this.wipe = 0; }
  pop() { if (this.stack.length > 1) { this.stack.pop(); this.dirty = true; this.wipe = 0; this.sound('back'); } }
  get page() { return this.stack[this.stack.length - 1]; }

  setupItems(player, includeAero = true) {
    const setup = this.settings.setups[player];
    const prefix = player === 1 ? `${t('setup.player', { n: 2 })} - ` : '';
    const items = [];
    if (includeAero) {
      items.push({ label: prefix + t('setup.wing'), value: () => t(`setup.wing.${setup.wing}`), adjust: (d) => { setup.wing = clampStep(setup.wing, d, 0, WING_LEVELS - 1); } });
      items.push({ label: prefix + t('setup.tyres'), value: () => t(`tyres.${setup.tyres}`), adjust: (d) => { setup.tyres = cycle(TYRE_ORDER, setup.tyres, d); } });
    }
    items.push({ label: prefix + t('setup.gearbox'), value: () => t(`gearbox.${setup.gearbox}`), adjust: () => { setup.gearbox = setup.gearbox === 'auto' ? 'manual' : 'auto'; } });
    return items;
  }

  circuitItem() {
    const ids = CIRCUITS.map((c) => c.id);
    return { label: t('setup.circuit'), value: () => getCircuit(this.choices.circuitId).name, adjust: (d) => { this.choices.circuitId = cycle(ids, this.choices.circuitId, d); } };
  }

  difficultyItem() {
    return { label: t('setup.difficulty'), value: () => t(`difficulty.${this.settings.difficulty}`), adjust: (d) => { this.settings.difficulty = cycle(DIFFICULTY_ORDER, this.settings.difficulty, d); } };
  }

  /** Description of an entry from the dictionary key `<key>.desc`, or null when there is none. */
  describe(key) {
    const k = `${key}.desc`, text = t(k);
    return text === k ? null : text;
  }

  /** Name of a key for the controls page, in the current language. */
  keyLabel(code) {
    const k = `key.${code}`, text = t(k);
    return text === k ? keyName(code) : text;
  }

  mainMenu() {
    const entry = (key, open) => ({ label: t(`menu.${key}`), desc: () => t(`menu.${key}.desc`), accept: open });
    return {
      id: 'main', heading: () => '', hero: { team: 9, yaw: 2.5 },
      items: [
        entry('arcade', () => this.push(this.arcadeMenu())),
        entry('championship', () => this.push(this.championshipMenu())),
        entry('training', () => this.push(this.trainingMenu())),
        entry('turbo', () => this.push(this.turboMenu())),
        entry('duel', () => this.push(this.duelMenu())),
        entry('options', () => this.push(this.optionsMenu())),
      ],
      selected: 0,
    };
  }

  arcadeMenu() {
    return {
      id: 'arcade', heading: () => t('menu.arcade'), hero: { team: 9, yaw: 2.2 },
      info: () => [`${t('results.arcadeScore')} : ${this.storage.data.arcade.best}`],
      items: [...this.setupItems(0, false),
        { label: t('menu.start'), desc: () => t('menu.arcade.desc'), accept: () => this.startSession(new ArcadeSession({ setup: { ...this.settings.setups[0], wing: 2, tyres: 'medium' } })) },
        { label: t('menu.back'), desc: () => this.describe('menu.back'), accept: () => this.pop() }],
      selected: 1,
    };
  }

  championshipMenu() {
    const saved = this.storage.data.championship;
    const unlocked = saved ? saved.unlocked || 1 : 1;
    const items = [];
    if (saved && !saved.finished) {
      items.push({ label: t('menu.resume'), value: () => `${t(SEASONS[saved.season].nameKey)} - ${t('intro.round', { n: saved.round + 1 })}`, desc: () => t('menu.championship.desc'),
        accept: () => this.startSession(new ChampionshipSession(saved, { setup: this.settings.setups[0], qualifying: this.choices.qualifying })) });
    }
    items.push({ label: t('setup.season'), value: () => t(SEASONS[this.choices.season].nameKey), adjust: (d) => { this.choices.season = clampStep(this.choices.season, d, 0, Math.min(SEASONS.length, unlocked) - 1); } });
    items.push(this.difficultyItem());
    items.push({ label: t('hud.qualifying'), value: () => t(this.choices.qualifying ? 'options.on' : 'options.off'), adjust: () => { this.choices.qualifying = !this.choices.qualifying; } });
    items.push(...this.setupItems(0));
    items.push({ label: t('menu.new'), desc: () => t('menu.championship.desc'), accept: () => {
      const session = ChampionshipSession.create(this.choices.season, this.settings.difficulty, { setup: this.settings.setups[0], qualifying: this.choices.qualifying }, unlocked);
      this.storage.data.championship = session.state; this.storage.save();
      this.startSession(session);
    } });
    items.push({ label: t('menu.back'), desc: () => this.describe('menu.back'), accept: () => this.pop() });
    return { id: 'championship', heading: () => t('menu.championship'), hero: { team: 9, yaw: 0.6 }, items, selected: 0,
      track: () => this.app.getTrack(SEASONS[this.choices.season].circuits[saved && !saved.finished && this.page && this.page.selected === 0 ? saved.round : 0]) };
  }

  trackInfo() {
    const def = getCircuit(this.choices.circuitId), track = this.app.getTrack(this.choices.circuitId);
    const record = this.storage.data.records[this.choices.circuitId];
    return [`${def.region}`, `${t('setup.length')} : ${(track.length / 1000).toFixed(3)} KM`, `${t('setup.record')} : ${formatTime(record)}`];
  }

  trainingMenu() {
    return {
      id: 'training', heading: () => t('menu.training'), track: () => this.app.getTrack(this.choices.circuitId), info: () => this.trackInfo(),
      items: [this.circuitItem(), ...this.setupItems(0),
        { label: t('menu.start'), desc: () => t('menu.training.desc'), accept: () => this.startSession(new TrainingSession({ circuitId: this.choices.circuitId, setup: this.settings.setups[0] })) },
        { label: t('menu.back'), desc: () => this.describe('menu.back'), accept: () => this.pop() }],
      selected: 0,
    };
  }

  raceOptions() {
    return [
      this.circuitItem(),
      { label: t('setup.laps'), value: () => String(this.choices.laps), adjust: (d) => { this.choices.laps = clampStep(this.choices.laps, d, 1, 20); } },
      { label: t('setup.opponents'), value: () => String(this.choices.opponents), adjust: (d) => { this.choices.opponents = clampStep(this.choices.opponents, d, 0, 16); } },
      this.difficultyItem(),
    ];
  }

  turboMenu() {
    return {
      id: 'turbo', heading: () => t('menu.turbo'), track: () => this.app.getTrack(this.choices.circuitId), info: () => this.trackInfo(),
      items: [...this.raceOptions(), ...this.setupItems(0, false),
        { label: t('menu.start'), desc: () => t('menu.turbo.desc'), accept: () => this.startSession(new SingleRaceSession('turbo', {
          circuitId: this.choices.circuitId, laps: this.choices.laps, opponents: this.choices.opponents, players: 1, rules: 'turbo', difficulty: this.settings.difficulty, setups: this.settings.setups })) },
        { label: t('menu.back'), desc: () => this.describe('menu.back'), accept: () => this.pop() }],
      selected: 0,
    };
  }

  duelMenu() {
    const rules = ['arcade', 'racing', 'turbo'];
    return {
      id: 'duel', heading: () => t('menu.duel'), track: () => this.app.getTrack(this.choices.circuitId), info: () => this.trackInfo(),
      items: [...this.raceOptions(),
        { label: t('setup.mode'), value: () => t(`duel.rules.${this.choices.rules}`), adjust: (d) => { this.choices.rules = cycle(rules, this.choices.rules, d); } },
        ...this.setupItems(0), ...this.setupItems(1),
        { label: t('menu.start'), desc: () => t('menu.duel.desc'), accept: () => this.startSession(new SingleRaceSession('duel', {
          circuitId: this.choices.circuitId, laps: this.choices.laps, opponents: Math.min(this.choices.opponents, 15), players: 2, rules: this.choices.rules, difficulty: this.settings.difficulty, setups: this.settings.setups })) },
        { label: t('menu.back'), desc: () => this.describe('menu.back'), accept: () => this.pop() }],
      selected: 0,
    };
  }

  optionsMenu() {
    const s = this.settings;
    const volume = (key) => ({ label: t(`options.volume.${key}`), desc: () => this.describe(`options.volume.${key}`), value: () => `${Math.round(s.audio[key] * 100)} %`, adjust: (d) => { s.audio[key] = Math.round(clampStep(s.audio[key], d * 0.1, 0, 1) * 10) / 10; } });
    return {
      id: 'options', heading: () => t('menu.options'), hero: { team: 10, yaw: 2.75 },
      items: [
        { label: t('options.language'), desc: () => this.describe('options.language'), value: () => t(`options.language.${s.language}`), adjust: (d) => { s.language = cycle(LANGUAGE_ORDER, s.language, d); setLanguage(s.language); this.rebuildStack(); } },
        { label: t('options.split'), desc: () => this.describe('options.split'), value: () => t(`options.split.${s.split}`), adjust: () => { s.split = s.split === 'horizontal' ? 'vertical' : 'horizontal'; } },
        { label: t('options.quality'), desc: () => this.describe('options.quality'), value: () => t(`options.quality.${s.quality}`), adjust: (d) => { s.quality = cycle(['low', 'medium', 'high'], s.quality, d); } },
        volume('master'), volume('engine'), volume('effects'), volume('ambience'),
        { label: t('options.effects'), desc: () => this.describe('options.effects'), value: () => '>', accept: () => this.push(this.effectsMenu()) },
        { label: t('options.controls'), desc: () => this.describe('options.controls'), value: () => '>', accept: () => this.push(this.controlsMenu(0)) },
        { label: t('menu.back'), desc: () => this.describe('menu.back'), accept: () => this.pop() },
      ],
      selected: 0, onChange: () => this.saveSettings(),
    };
  }

  effectsMenu() {
    const s = this.settings;
    const items = Object.keys(DEFAULT_EFFECTS).map((key) => ({ label: t(`effect.${key}`), desc: () => this.describe(`effect.${key}`), value: () => t(s.effects[key] ? 'options.on' : 'options.off'), adjust: () => { s.effects[key] = !s.effects[key]; } }));
    items.push({ label: t('menu.back'), desc: () => this.describe('menu.back'), accept: () => this.pop() });
    return { id: 'effects', heading: () => t('options.effects'), hero: { team: 2, yaw: 1.2 }, items, selected: 0, onChange: () => this.saveSettings() };
  }

  controlsMenu(player) {
    const s = this.settings, c = s.controls[player];
    const deviceLabel = (d) => (d.startsWith('gamepad') ? t('options.device.gamepad', { n: +d.slice(7) + 1 }) : t(`options.device.${d}`));
    const items = [
      { label: t('setup.player', { n: player + 1 }), desc: () => this.describe('options.player'), value: () => '<>', adjust: () => { this.stack.pop(); this.push(this.controlsMenu(1 - player)); } },
      { label: t('options.device'), desc: () => this.describe('options.device'), value: () => deviceLabel(c.device), adjust: (d) => { c.device = cycle(DEVICES, c.device, d); } },
    ];
    for (const action of ACTIONS) {
      items.push({ label: t(`action.${action}`), desc: () => this.describe(c.device.startsWith('gamepad') ? 'options.padkeys' : 'options.rebind'), value: () => (this.capturing === action ? t('options.press') : this.keyLabel(c.keys[action])), accept: () => {
        this.capturing = action; this.dirty = true;
        this.input.capture = (code) => { if (code !== 'Escape' || action === 'pause') c.keys[action] = code; this.capturing = null; this.input.clearMenuEvents(); this.saveSettings(); };
      } });
    }
    items.push({ label: t('options.reset'), desc: () => this.describe('options.reset'), accept: () => { s.controls = cloneControls(DEFAULT_CONTROLS); this.saveSettings(); this.stack.pop(); this.push(this.controlsMenu(player)); } });
    items.push({ label: t('menu.back'), desc: () => this.describe('menu.back'), accept: () => this.pop() });
    return { id: 'controls', heading: () => t('options.controls'), hero: { team: player ? 10 : 9, yaw: 2.9 }, items, selected: 1, onChange: () => this.saveSettings() };
  }

  /** Rebuild the open pages after a language change so that labels are translated. */
  rebuildStack() {
    const ids = this.stack.map((p) => p.id), selected = this.stack.map((p) => p.selected);
    const make = { main: () => this.mainMenu(), arcade: () => this.arcadeMenu(), championship: () => this.championshipMenu(), training: () => this.trainingMenu(), turbo: () => this.turboMenu(), duel: () => this.duelMenu(), options: () => this.optionsMenu(), effects: () => this.effectsMenu(), controls: () => this.controlsMenu(0) };
    this.stack = ids.map((id, i) => { const page = make[id](); page.selected = Math.min(selected[i], page.items.length - 1); return page; });
    if (this.app.hud) this.app.hud.refreshLabels();
  }

  // ---- sessions ---------------------------------------------------------------------------------

  startSession(session) {
    this.storage.save();
    this.session = session;
    this.app.session = session;
    this.sound('select');
    this.nextRace();
  }

  nextRace() {
    const app = this.app;
    const config = this.session.nextRace((id) => app.getTrack(id));
    if (!config) { this.toMenu(); return; }
    this.pending = config;
    const track = app.getTrack(config.circuitId), def = getCircuit(config.circuitId);
    const human = config.entries.findIndex((e) => e.human);
    if (app.effects.introPanels && config.kind !== 'training') {
      const params = { circuit: def.name, region: def.region };
      this.introModel = {
        track, theme: track.theme, team: config.entries[human >= 0 ? human : 0].driver.team,
        round: this.session.kind === 'championship' ? `${t(SEASONS[this.session.state.season].nameKey)} - ${t('intro.round', { n: this.session.state.round + 1 })}${config.kind === 'qualifying' ? ` - ${t('hud.qualifying')}` : ''}` : t(`menu.${this.session.kind}`),
        captions: [t('intro.caption.1', params), t('intro.caption.2'), t('intro.caption.3')],
        grid: config.kind === 'qualifying' ? t('hud.qualifying') : `${t('intro.yourGrid', { n: human + 1 })} - ${t('intro.laps', { n: config.laps })}`,
      };
      this.state = 'intro'; this.introTime = 0; this.dirty = true; this.wipe = 0;
      if (this.audio) this.audio.setScene('menu');
      this.sound('panel');
    } else this.beginRace();
  }

  beginRace() {
    const app = this.app, config = this.pending;
    this.pending = null;
    this.lastConfig = config;
    const race = app.startRace(config);
    if (this.session.bind) this.session.bind(race);
    this.state = 'race'; this.endTimer = 0; this.dirty = true;
    app.hud.visible = true;
    if (this.audio) this.audio.setScene('race');
    this.input.updatePointerLock(app.viewCount, true);
    this.input.clearMenuEvents();
    this.input.clearEdges();
  }

  finishRace() {
    const app = this.app, race = app.race;
    const result = this.session.finishRace(race, (id) => app.getTrack(id));
    const data = this.storage.data;
    for (const car of race.cars) if (car.isHuman && car.bestLapTime > 0 && race.rules.profile !== 'turbo') this.storage.recordLap(race.track.id, car.bestLapTime);
    if (this.session.kind === 'arcade' && result.arcade.total > data.arcade.best) { data.arcade.best = result.arcade.total; result.arcade.record = true; }
    if (this.session.kind === 'championship') data.championship = this.session.state;
    this.storage.save();
    this.resultQueue = this.buildResultPages(result, race);
    this.lastResult = result;
    this.showNextResult();
    if (this.audio) this.audio.setScene('results');
    this.input.updatePointerLock(app.viewCount, false);
  }

  buildResultPages(result, race) {
    const pages = [];
    const theme = race.track.theme;
    const heroTeam = result.playerRow ? result.playerRow.driver.team : 9;
    if (result.qualifying) {
      const q = result.qualifying;
      pages.push({ title: t('results.qualifying'), headline: `P${q.position}`, sub: `${race.track.name} - ${formatTime(q.playerTime)}`, heroTeam, theme, columns: ['time'],
        rows: q.grid.map((g, i) => ({ pos: i + 1, name: g.driver.name, teamIndex: g.driver.team, time: formatTime(g.time), human: g.human })) });
      return pages;
    }
    const winner = result.classification[0];
    const rows = result.classification.map((row) => ({
      pos: row.position, name: row.driver.name, teamIndex: row.driver.team, human: row.isHuman, retired: row.retired,
      time: row.retired ? t('results.dnf') : row.position === 1 ? formatTime(row.time) : row.lapsDown > 0 ? t('results.lapsDown', { n: row.lapsDown }) : `+${row.gap.toFixed(3)}`,
      best: formatTime(row.bestLap), points: row.points,
    }));
    let sub = `${race.track.name} - ${t(result.position === 1 ? 'results.caption.win' : 'results.caption.other')}`;
    let headline = t(result.headline, { n: result.position });
    if (result.arcade) sub = `${t('hud.score')} : +${result.arcade.gained} = ${result.arcade.total}${result.arcade.record ? `  ${t('results.newBest')}` : ''}`;
    if (this.session.kind === 'training') { headline = formatTime(result.playerRow ? result.playerRow.bestLap : 0); sub = `${race.track.name} - ${t('hud.best')}`; }
    pages.push({ title: t('results.title'), headline, sub, heroTeam: result.position === 1 || !winner ? heroTeam : winner.driver.team, theme,
      columns: this.session.kind === 'championship' ? ['time', 'best', 'points'] : ['time', 'best'], rows });
    if (result.standings) {
      pages.push({ title: t('results.standings'), headline: result.champion ? t('results.champion') : result.seasonOver ? t('results.seasonEnd') : `${result.round}/${result.rounds}`,
        sub: t(SEASONS[this.session.state.season].nameKey), heroTeam: result.standings[0].driver.team, theme, columns: ['points'],
        rows: result.standings.map((row) => ({ pos: row.position, name: row.driver.name, teamIndex: row.driver.team, human: row.human, points: row.points })) });
    }
    return pages;
  }

  showNextResult() {
    this.resultModel = this.resultQueue.shift();
    this.state = 'results'; this.dirty = true; this.wipe = 0;
    this.app.hud.visible = false;
    this.sound('panel');
  }

  toMenu() {
    this.app.stopRace();
    this.app.session = null; this.session = null;
    this.state = 'menu'; this.dirty = true; this.wipe = 0;
    this.stack.length = 1;
    this.stack[0] = this.mainMenu();
    if (this.audio) this.audio.setScene('menu');
    this.input.updatePointerLock(1, false);
  }

  pauseMenu() {
    return { heading: t('hud.paused'), selected: 0, items: [
      { label: t('menu.resume'), accept: () => this.resume() },
      { label: t(this.session && this.session.kind === 'training' ? 'menu.next' : 'menu.restart'), accept: () => {
        if (this.session.kind === 'training') { this.app.paused = false; this.finishRace(); return; }
        const config = this.lastConfig; this.app.paused = false; if (config) { this.pending = config; this.beginRace(); }
      } },
      { label: t('menu.quit'), accept: () => { this.app.paused = false; this.toMenu(); } },
    ] };
  }

  resume() {
    this.app.paused = false; this.state = 'race'; this.dirty = true;
    if (this.audio) this.audio.resume();
    this.input.updatePointerLock(this.app.viewCount, true);
    this.input.clearEdges();      // the key that closed the pause page must not pause again
  }

  // ---- per-frame ---------------------------------------------------------------------------------

  pointer(x, y, type) {
    if (this.state === 'race') return;
    const canvas = this.app.canvas;
    const kx = canvas.width / canvas.clientWidth, ky = canvas.height / canvas.clientHeight;
    const px = x * kx, py = y * ky;
    for (const hit of this.painter.hits) {
      if (px < hit.x || px > hit.x + hit.w || py < hit.y || py > hit.y + hit.h) continue;
      const page = this.state === 'pause' ? this.pause : this.state === 'menu' ? this.page : null;
      if (page && page.selected !== hit.index) { page.selected = hit.index; this.dirty = true; }
      if (type === 'down') this.input.menuQueue.push('accept');
      return;
    }
  }

  handleMenu(page, event) {
    const item = page.items[page.selected];
    if (event === 'up' || event === 'down') {
      page.selected = (page.selected + (event === 'up' ? -1 : 1) + page.items.length) % page.items.length;
      this.sound('move');
    } else if (event === 'left' || event === 'right') {
      if (item.adjust) { item.adjust(event === 'left' ? -1 : 1); if (page.onChange) page.onChange(); this.sound('move'); }
    } else if (event === 'accept') {
      if (item.accept) { this.sound('select'); item.accept(); } else if (item.adjust) { item.adjust(1); if (page.onChange) page.onChange(); this.sound('move'); }
    } else if (event === 'back') {
      if (this.state === 'pause') this.resume(); else this.pop();
    }
    this.dirty = true;
  }

  update(app, dt) {
    const input = this.input;
    input.poll();
    const size = `${app.canvas.width}x${app.canvas.height}`;
    if (size !== this.lastSize) { this.lastSize = size; this.painter.resize(app.canvas.width, app.canvas.height); this.dirty = true; }
    this.wipe = Math.min(1, this.wipe + dt * 3.2);
    let event = input.nextMenuEvent();
    if (this.state === 'menu') {
      while (event) { if (!this.capturing) this.handleMenu(this.page, event); event = this.state === 'menu' ? input.nextMenuEvent() : null; }
    } else if (this.state === 'pause') {
      while (event) { this.handleMenu(this.pause, event); event = this.state === 'pause' ? input.nextMenuEvent() : null; }
    } else if (this.state === 'intro') {
      this.introTime += dt;
      let skip = false;
      while (event) { if (event === 'accept' || event === 'back') skip = true; event = input.nextMenuEvent(); }
      if (skip || this.introTime > INTRO_DURATION) this.beginRace();
      else if (this.introTime < 2.9) this.dirty = true;
    } else if (this.state === 'results') {
      let next = false;
      while (event) { if (event === 'accept' || event === 'back') next = true; event = input.nextMenuEvent(); }
      if (next) {
        this.sound('select');
        if (this.resultQueue.length) this.showNextResult();
        else if (this.lastResult && !this.lastResult.done) this.nextRace();
        else this.toMenu();
      }
    } else if (this.state === 'race') {
      input.clearMenuEvents();
      const race = app.race;
      for (let p = 0; p < 2; p++) {
        if (input.take(p, 'pause') && race) { app.paused = true; this.pause = this.pauseMenu(); this.state = 'pause'; this.dirty = true; if (this.audio) this.audio.suspend(); input.updatePointerLock(1, false); }
        if (input.take(p, 'camera') && race && race.playerCars[p]) {
          for (let v = 0; v < app.viewCount; v++) if (app.views[v].carIndex === race.playerCars[p].index) app.views[v].camera = (app.views[v].camera + 1) % 4;
        }
      }
      if (race && race.phase === RACE_PHASE.FINISHED) {
        this.endTimer += dt;
        if (this.endTimer > 1.2) this.finishRace();
      }
    }
    this.present(app);
  }

  /** Paint the current page when needed and tell the renderer how to composite it. */
  present(app) {
    const page = app.frame.page, painter = this.painter;
    if (!painter.canvas) return;
    if (this.state === 'race') { page.visible = false; return; }
    page.visible = true; page.alpha = 1; page.wipe = this.state === 'pause' ? 1 : this.wipe;
    if (!this.dirty) return;
    this.dirty = false;
    if (this.state === 'menu') {
      const p = this.page;
      painter.paintMenu({
        heading: p.heading ? p.heading() : '', selected: p.selected, hero: p.hero, track: p.track ? p.track() : null, info: p.info ? p.info() : null,
        theme: p.track ? p.track().theme : 'forest',
        items: p.items.map((item) => ({ label: item.label, value: item.value ? item.value() : null, adjustable: !!item.adjust, desc: item.desc ? item.desc() : null })),
      });
    } else if (this.state === 'pause') painter.paintPause(this.pause);
    else if (this.state === 'intro') painter.paintIntro(this.introModel, this.introTime);
    else if (this.state === 'results') painter.paintResults(this.resultModel);
    app.renderer.uploadPage(painter.canvas);
  }

  onRaceEvent() {}
  drawFront() {}
}
