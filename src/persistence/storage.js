// Saved data: settings, lap records, arcade high score and championship progress, kept in the
// browser's localStorage under one versioned key. Works offline; when storage is unavailable
// (private mode, blocked access) the game simply runs with defaults and does not save.

import { DEFAULT_EFFECTS } from '../core/config.js';
import { DEFAULT_CONTROLS, cloneControls } from '../input/bindings.js';

const KEY = 'virage-gp-bd:v1';

export function defaultSave() {
  return {
    settings: {
      language: 'fr', quality: 'high', split: 'horizontal',
      audio: { enabled: true, master: 0.8, engine: 0.8, effects: 0.8, ambience: 0.6 },
      effects: { ...DEFAULT_EFFECTS },
      controls: cloneControls(DEFAULT_CONTROLS),
      setups: [{ wing: 2, tyres: 'medium', gearbox: 'auto' }, { wing: 2, tyres: 'medium', gearbox: 'auto' }],
      difficulty: 'amateur',
    },
    records: {},            // circuitId -> best lap in seconds
    arcade: { best: 0 },
    championship: null,     // see gameplay/championship.js
  };
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  for (const key of Object.keys(base)) {
    const b = base[key], s = saved[key];
    if (s === undefined || s === null) continue;
    if (Array.isArray(b)) { if (Array.isArray(s) && s.length === b.length) base[key] = b.map((item, i) => (typeof item === 'object' ? merge(item, s[i]) : s[i])); }
    else if (typeof b === 'object' && b !== null) base[key] = merge(b, s);
    else if (typeof s === typeof b) base[key] = s;
  }
  return base;
}

export class Storage {
  constructor(backend) {
    this.backend = backend === undefined ? Storage.browserBackend() : backend;
    this.data = defaultSave();
    this.load();
  }

  static browserBackend() {
    try {
      const probe = '__virage_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (error) { return null; }
  }

  load() {
    const fresh = defaultSave();
    if (!this.backend) { this.data = fresh; return; }
    try {
      const raw = this.backend.getItem(KEY);
      const saved = raw ? JSON.parse(raw) : null;
      this.data = merge(fresh, saved);
      if (saved) {
        // free-form sections are copied as they are
        if (saved.records && typeof saved.records === 'object') this.data.records = saved.records;
        if (saved.championship && typeof saved.championship === 'object') this.data.championship = saved.championship;
      }
    } catch (error) { this.data = fresh; }
  }

  save() {
    if (!this.backend) return false;
    try { this.backend.setItem(KEY, JSON.stringify(this.data)); return true; } catch (error) { return false; }
  }

  /** Record a lap time; returns true when it is a new best for the circuit. */
  recordLap(circuitId, seconds) {
    if (!(seconds > 0)) return false;
    const best = this.data.records[circuitId];
    if (best && best <= seconds) return false;
    this.data.records[circuitId] = seconds;
    this.save();
    return true;
  }
}
