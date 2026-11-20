// Entry point: boots the application and exposes a small automation API used by tests,
// captures and benchmarks (window.virage).

import { GameApp } from './core/game-app.js';
import { GpuUnavailableError } from './graphics/gpu-context.js';
import { DRIVERS, PLAYER_DRIVERS } from './vehicles/liveries.js';
import { RULE_PRESETS } from './gameplay/rules.js';
import { CAMERA_MODE } from './graphics/cameras.js';

function parseParams() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const out = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

async function boot() {
  const params = parseParams();
  const app = new GameApp(document.getElementById('scene'), document.getElementById('hud'));
  const ui = document.getElementById('ui');
  try {
    await app.init(params.quality || 'high');
  } catch (error) {
    const message = error instanceof GpuUnavailableError ? error.message : `Initialisation failed: ${error.message}`;
    ui.innerHTML = `<div style="margin:15vh auto;max-width:640px;padding:24px;background:#151a22;border-radius:8px">
      <h1>Virage GP</h1><p>${message}</p><p>WebGPU est requis (Chrome / Chromium récent avec accélération matérielle).</p></div>`;
    console.error(error);
    return;
  }
  /** Quick race used by automation: AI field with an optionally computer-driven player. */
  const quickRace = (options = {}) => {
    const count = options.opponents ?? 17;
    const players = options.players ?? 1;
    const entries = DRIVERS.slice(0, count).map((driver) => ({ driver }));
    const humans = [];
    for (let p = 0; p < players; p++) humans.push({ driver: PLAYER_DRIVERS[p], human: true, playerIndex: p, autoDrive: options.autoDrive !== false, setup: options.setup });
    const position = Math.min(entries.length, options.gridPosition ?? entries.length);
    entries.splice(position, 0, ...humans);
    const race = app.startRace({
      circuitId: options.circuit || 'hazelbrook', laps: options.laps ?? 3, entries,
      rules: { ...RULE_PRESETS[options.rules || 'racing'], ...(options.rulesOverride || {}) },
      difficulty: options.difficulty || 'pro', seed: options.seed ?? 1,
      views: humans.map((h) => entries.indexOf(h)),
    });
    return race;
  };
  window.virage = { app, quickRace, CAMERA_MODE, params };
  if (params.auto) {
    quickRace({ circuit: params.circuit, opponents: params.opponents ? +params.opponents : undefined, players: params.players ? +params.players : 1 });
    app.start();
  }
  window.dispatchEvent(new Event('virage-ready'));
}

boot();
