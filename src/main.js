// Entry point: boots the application and exposes a small automation API used by tests,
// captures and benchmarks (window.virage).

import { placeCar, CAR_STATE, hopSteerKick } from './physics/car-physics.js';
import { COLLISION_TUNING } from './physics/collision-tuning.js';
import { GameApp } from './core/game-app.js';
import { GpuUnavailableError } from './rendering/gpu-context.js';
import { CAMERA } from './rendering/compositing/race-view.js';
import { DRIVERS, PLAYER_DRIVERS } from './vehicles/liveries.js';
import { RULE_PRESETS } from './gameplay/rules.js';
import { PLAYER_TEAMS } from './vehicles/liveries.js';
import { liveryColors } from './art/art-library.js';
import { rgbToHex } from './art/palettes/palettes.js';
import { defineCockpitArt } from './art/cockpits/cockpit-art.js';
import { CockpitLayer } from './rendering/compositing/cockpit-layer.js';
import { TextPainter } from './ui/text-painter.js';
import { Hud, defineHudArt, trackMapSprite } from './ui/hud.js';
import { EffectsLayer, defineEffectsArt } from './rendering/effects/effects-layer.js';
import { Storage } from './persistence/storage.js';
import { InputManager } from './input/input-manager.js';
import { GameAudio } from './audio/game-audio.js';
import { GameFlow } from './ui/game-flow.js';
import { t, setLanguage } from './localization/i18n.js';
import { runBenchmark, describeEnvironment, measureRefreshRate, BENCHMARK_SCENARIOS } from './core/benchmark.js';
import { CollisionLab, attachLabControls } from './core/collision-lab.js';

function parseParams() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const out = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

async function boot() {
  const params = parseParams();
  const canvas = document.getElementById('scene');
  const app = new GameApp(canvas);
  const notice = document.getElementById('notice');
  const storage = new Storage();
  setLanguage(params.lang || storage.data.settings.language);
  notice.hidden = false;
  notice.textContent = `${t('game.title')} — ${t('game.loading')}`;
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    const text = new TextPainter();
    let cockpitLayout = null;
    await app.init({
      quality: params.quality || storage.data.settings.quality,
      onProgress: (done, total) => { notice.textContent = `${t('game.title')} — ${t('game.loading')} ${Math.round((done / total) * 100)} %`; },
      registerArt: (art) => {
        const players = PLAYER_TEAMS.map((team) => {
          const colors = liveryColors(team).map((c) => rgbToHex(c[0], c[1], c[2]));
          return { colors, glove: colors[2], suit: '#f1efe6' };
        });
        cockpitLayout = defineCockpitArt(art, players);
        text.define(art);
        defineHudArt(art);
        defineEffectsArt(art);
        art.themeExtras = (atlas, track) => { const map = trackMapSprite(track); atlas.define('map.track', 256, 256, map.paint, map.meta); };
      },
      attachLayers: (scene, appRef) => {
        text.resolve(appRef.art);
        appRef.text = text;
        scene.cockpit = new CockpitLayer(appRef.art, cockpitLayout, text);
        appRef.hud = new Hud(appRef, text);
        scene.effects = new EffectsLayer(appRef.art);
        scene.lamps = [appRef.art.sprite('hud.lamp.off'), appRef.art.sprite('hud.lamp.red'), appRef.art.sprite('hud.lamp.green')];
        scene.shadow = appRef.art.sprite('fx.shadow');
      },
    });
  } catch (error) {
    const message = error instanceof GpuUnavailableError ? t('error.webgpu') : `Initialisation failed: ${error.message}`;
    notice.hidden = false;
    notice.textContent = `${t('game.title')} — ${message}`;
    console.error(error);
    window.virageFailed = true;
    return;
  }
  notice.hidden = true;
  const input = new InputManager(canvas, storage.data.settings.controls);
  const audio = new GameAudio(storage.data.settings.audio);
  input.onGesture = () => { audio.resume(); };
  app.input = input;
  app.audio = audio;
  const flow = new GameFlow(app, storage, input, audio);
  app.ui = flow;
  audio.setScene('menu');
  /** Quick race used by automation: AI field with an optionally computer-driven player. */
  const quickRace = (options = {}) => {
    const count = options.opponents ?? 15;
    const players = options.players ?? 1;
    const entries = DRIVERS.slice(0, count).map((driver) => ({ driver }));
    const humans = [];
    for (let p = 0; p < players; p++) humans.push({ driver: PLAYER_DRIVERS[p], human: true, playerIndex: p, autoDrive: options.autoDrive !== false, setup: options.setup });
    const position = Math.min(entries.length, options.gridPosition ?? entries.length);
    entries.splice(position, 0, ...humans);
    flow.state = 'race'; app.hud.visible = options.hud !== false; app.session = null;
    return app.startRace({
      circuitId: options.circuit || 'hazelbrook', laps: options.laps ?? 3, entries,
      rules: { ...RULE_PRESETS[options.rules || 'racing'], ...(options.rulesOverride || {}) },
      difficulty: options.difficulty || 'pro', seed: options.seed ?? 1,
      views: humans.map((h) => entries.indexOf(h)), cameras: options.cameras,
    });
  };
  /** Benchmarks (index.html#benchmark=solo|grid|split|all&seconds=60): results on screen and in window.virageBenchmark. */
  const benchmark = async (kinds, seconds) => {
    // the display's refresh rate is measured with the game loop stopped, so that it is the screen's and not the renderer's
    const wasRunning = app.running;
    app.stop();
    const refreshRateHz = await measureRefreshRate();
    if (wasRunning) app.start();
    const results = { environment: describeEnvironment(app), refreshRateHz, runs: [] };
    for (const kind of kinds) {
      const run = await runBenchmark(app, kind, seconds, { circuit: params.circuit, start: (config) => { flow.state = 'race'; app.hud.visible = true; app.session = null; app.startRace(config); } });
      results.runs.push(run);
      console.log('[benchmark]', JSON.stringify(run));
    }
    app.stopRace(); flow.toMenu();
    window.virageBenchmark = results;
    notice.hidden = false;
    notice.style.whiteSpace = 'pre';
    notice.textContent = results.runs.map((r) => `${r.scenario}: ${r.fps.toFixed(1)} fps — interval moy. ${r.frameInterval.mean.toFixed(2)} ms, p99 ${r.frameInterval.p99.toFixed(2)} ms, max ${r.frameInterval.max.toFixed(2)} ms — GPU ${r.gpuPass ? `${r.gpuPass.mean.toFixed(2)} / p99 ${r.gpuPass.p99.toFixed(2)} / max ${r.gpuPass.max.toFixed(2)} ms` : 'n/d'} — CPU ${r.cpuFrame.mean.toFixed(2)} ms — > 16,7 ms : ${r.framesOver16_7ms}/${r.frames}`).join('\n');
    return results;
  };
  /**
   * Collision test bench, a development tool (core/collision-lab.js). It exists only when asked for:
   * by the launch option index.html#lab=wheel|hop|crash|board|bump, which also binds its keys, or by
   * an automation script. Nothing in the menus or in a normal race creates it.
   */
  const createLab = () => { if (!app.lab) app.lab = new CollisionLab(app, quickRace); return app.lab; };
  // `debug` gives the automation scripts what they need to stage a situation (work/scripts/collision-sequences.mjs)
  window.virage = { app, quickRace, CAMERA, params, flow, storage, input, audio, benchmark, describeEnvironment, measureRefreshRate, createLab, debug: { placeCar, CAR_STATE, COLLISION_TUNING, hopSteerKick } };
  if (params.auto) quickRace({ circuit: params.circuit, opponents: params.opponents ? +params.opponents : undefined, players: params.players ? +params.players : 1 });
  if (params.lab) {
    const lab = createLab();
    attachLabControls(lab, t);
    lab.start(CollisionLab.resolve(params.lab) || 'hop');
  }
  if (!params.manual) app.start();
  if (params.benchmark) benchmark(params.benchmark === 'all' ? Object.keys(BENCHMARK_SCENARIOS) : params.benchmark.split(','), +(params.seconds || 60));
  window.dispatchEvent(new Event('virage-ready'));
}

boot();
