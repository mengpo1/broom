// Art library: turns logical ids into drawn sprites. It owns the in-memory atlases (static
// drawings shared by every race, drawings of the current circuit theme, car views, backdrops)
// and is the only place that knows *how* something is drawn. Scene and game code ask for
// `sprite(id)` / `cars[angle]` and never depend on the drawing technique, so procedural drawings
// can be replaced one by one by artist-made images.

import { AtlasBuilder, makeCanvas } from '../rendering/drawing/atlas.js';
import { ATLAS_LAYER_SIZE, ATLAS_LAYERS, CAR_LAYER_WIDTH, CAR_LAYER_HEIGHT, BACKDROP_WIDTH, BACKDROP_HEIGHT, BACKDROP_LAYERS } from '../rendering/compositing/renderer.js';
import { MAX_LIVERIES } from '../rendering/shaders/quad.wgsl.js';
import { hashString } from '../core/random.js';
import { seeded } from './styles/ink.js';
import { hexToRgb } from './palettes/palettes.js';
import { buildCarModel } from './vehicles/car-model.js';
import { drawCarFitted } from './vehicles/car-illustrator.js';
import { expandScenerySpecs } from './environments/scenery-specs.js';
import { sceneryPainter } from './environments/scenery-painters.js';
import { paintBackdropLayer } from './environments/backdrops.js';

export const CAR_ANGLES = 33;                 // views from 0 (rear) to 180 degrees (front); the other side is mirrored
export const CAR_VIEW_PITCH = 0.085;          // elevation of the viewpoint used for the car views
const STATIC_LAYERS = 9;
const THEME_LAYERS = ATLAS_LAYERS - STATIC_LAYERS;

/** Which team colour goes to which livery zone (body, flanks, wings) for each paint pattern. */
const LIVERY_PATTERNS = [['primary', 'secondary', 'accent'], ['primary', 'primary', 'secondary'], ['primary', 'secondary', 'secondary'],
  ['secondary', 'primary', 'accent'], ['primary', 'accent', 'secondary']];

export function liveryColors(team) {
  const pattern = LIVERY_PATTERNS[team.pattern % LIVERY_PATTERNS.length];
  return pattern.map((key) => team[key]);
}

export class ArtLibrary {
  constructor(renderer) {
    this.renderer = renderer;
    this.staticAtlas = new AtlasBuilder(ATLAS_LAYER_SIZE, 0, STATIC_LAYERS);
    this.themeAtlas = new AtlasBuilder(ATLAS_LAYER_SIZE, STATIC_LAYERS, THEME_LAYERS);
    this.cars = [];
    this.specs = new Map(expandScenerySpecs().map((s) => [s.id, s]));
    this.themeKey = null;
    this.timings = {};
  }

  /** Register a drawing of the static set (cockpit, HUD, effects...) before buildStatic(). */
  defineStatic(id, width, height, paint, meta) { this.staticAtlas.define(id, width, height, paint, meta); }

  buildStatic() {
    const t0 = performance.now();
    const canvases = this.staticAtlas.build();
    for (let i = 0; i < canvases.length; i++) this.renderer.uploadLayer('atlas', i, canvases[i]);
    this.timings.static = performance.now() - t0;
  }

  /** Draw the car from every angle: one layer of fixed colours and one livery mask per angle. */
  buildCars() {
    const t0 = performance.now();
    const model = buildCarModel({ detail: 0 });
    const fixed = makeCanvas(CAR_LAYER_WIDTH, CAR_LAYER_HEIGHT), mask = makeCanvas(CAR_LAYER_WIDTH, CAR_LAYER_HEIGHT);
    const ctx = fixed.getContext('2d'), mctx = mask.getContext('2d');
    this.cars.length = 0;
    for (let i = 0; i < CAR_ANGLES; i++) {
      ctx.clearRect(0, 0, CAR_LAYER_WIDTH, CAR_LAYER_HEIGHT);
      mctx.clearRect(0, 0, CAR_LAYER_WIDTH, CAR_LAYER_HEIGHT);
      const yaw = (i / (CAR_ANGLES - 1)) * Math.PI;
      const meta = drawCarFitted(ctx, mctx, model, CAR_LAYER_WIDTH, CAR_LAYER_HEIGHT, { yaw, pitch: CAR_VIEW_PITCH, distance: 16 }, { margin: 10 });
      this.renderer.uploadLayer('cars', i * 2, fixed);
      this.renderer.uploadLayer('cars', i * 2 + 1, mask);
      this.cars.push({ layer: i * 2, ppm: meta.ppm, ax: meta.ax, ay: meta.ay, w: CAR_LAYER_WIDTH, h: CAR_LAYER_HEIGHT });
    }
    this.timings.cars = performance.now() - t0;
  }

  /** Upload the livery table: three colours per team row. */
  setLiveries(teams) {
    const data = new Float32Array(MAX_LIVERIES * 3 * 4);
    teams.slice(0, MAX_LIVERIES).forEach((team, row) => {
      liveryColors(team).forEach((c, k) => {
        const rgb = typeof c === 'string' ? hexToRgb(c) : c;
        data.set([rgb[0], rgb[1], rgb[2], 1], (row * 3 + k) * 4);
      });
    });
    this.renderer.setPalette(data);
  }

  /** Paint what the circuit needs: scenery named by its layout, and the backdrop panoramas. */
  loadTheme(track, palette, layout) {
    const key = `${track.theme}:${track.id}`;
    if (key === this.themeKey) return;
    this.themeKey = key;
    const t0 = performance.now();
    const ids = new Set();
    for (const s of layout.strips) ids.add(s.id);
    for (const p of layout.props) ids.add(p.id);
    this.themeAtlas = new AtlasBuilder(ATLAS_LAYER_SIZE, STATIC_LAYERS, THEME_LAYERS);
    for (const id of ids) {
      const spec = this.specs.get(id);
      if (!spec) throw new Error(`No scenery spec for ${id}`);
      const paint = sceneryPainter(spec.family);
      const seed = hashString(`${id}:${track.theme}`);
      this.themeAtlas.define(id, spec.w, spec.h, (ctx, w, h) => paint(ctx, w, h, palette, seeded(seed), spec.variant, spec),
        { kind: spec.kind, worldW: spec.worldW || 0, worldH: spec.worldH, tile: spec.tile || 0, wrapX: spec.kind === 'strip' });
    }
    const canvases = this.themeAtlas.build();
    for (let i = 0; i < canvases.length; i++) this.renderer.uploadLayer('atlas', STATIC_LAYERS + i, canvases[i]);
    const backdrop = makeCanvas(BACKDROP_WIDTH, BACKDROP_HEIGHT), bctx = backdrop.getContext('2d');
    for (let layer = 0; layer < BACKDROP_LAYERS; layer++) {
      paintBackdropLayer(layer, bctx, BACKDROP_WIDTH, BACKDROP_HEIGHT, palette, layout.theme.backdrop, seeded(hashString(`backdrop:${track.id}:${layer}`)), layout.theme);
      this.renderer.uploadLayer('backdrop', layer, backdrop);
    }
    this.timings.theme = performance.now() - t0;
  }

  sprite(id) {
    if (this.themeAtlas.has(id)) return this.themeAtlas.get(id);
    return this.staticAtlas.get(id);
  }

  has(id) { return this.themeAtlas.has(id) || this.staticAtlas.has(id); }
}
