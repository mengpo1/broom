// Entry point: boots the application and exposes a small automation API used by tests,
// captures and benchmarks (window.virage).

import { GameApp } from './core/game-app.js';
import { GpuUnavailableError } from './rendering/gpu-context.js';
import { CAMERA } from './rendering/compositing/race-view.js';
import { DRIVERS, PLAYER_DRIVERS } from './vehicles/liveries.js';
import { RULE_PRESETS } from './gameplay/rules.js';

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
  try {
    await app.init({ quality: params.quality || 'high' });
  } catch (error) {
    const message = error instanceof GpuUnavailableError ? error.message : `Initialisation failed: ${error.message}`;
    notice.hidden = false;
    notice.textContent = `Virage GP — ${message} WebGPU est requis (Chrome / Chromium récent avec accélération matérielle).`;
    console.error(error);
    return;
  }
  /** Quick race used by automation: AI field with an optionally computer-driven player. */
  const quickRace = (options = {}) => {
    const count = options.opponents ?? 15;
    const players = options.players ?? 1;
    const entries = DRIVERS.slice(0, count).map((driver) => ({ driver }));
    const humans = [];
    for (let p = 0; p < players; p++) humans.push({ driver: PLAYER_DRIVERS[p], human: true, playerIndex: p, autoDrive: options.autoDrive !== false, setup: options.setup });
    const position = Math.min(entries.length, options.gridPosition ?? entries.length);
    entries.splice(position, 0, ...humans);
    return app.startRace({
      circuitId: options.circuit || 'hazelbrook', laps: options.laps ?? 3, entries,
      rules: { ...RULE_PRESETS[options.rules || 'racing'], ...(options.rulesOverride || {}) },
      difficulty: options.difficulty || 'pro', seed: options.seed ?? 1,
      views: humans.map((h) => entries.indexOf(h)), cameras: options.cameras,
    });
  };
  window.virage = { app, quickRace, CAMERA, params };
  if (params.auto) {
    quickRace({ circuit: params.circuit, opponents: params.opponents ? +params.opponents : undefined, players: params.players ? +params.players : 1 });
    app.start();
  }
  window.dispatchEvent(new Event('virage-ready'));
}

boot();
