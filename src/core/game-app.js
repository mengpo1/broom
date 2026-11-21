// Application core: owns the renderer, the current race, the views and the frame loop.
// Simulation runs at a fixed step; presentation reads the simulation and never writes to it.
// Optional collaborators plug in through small interfaces: input ({ apply(race, app) }),
// audio ({ update(app, dt), onEvent(e, app) }), ui ({ update(app, dt), drawFront(app, view) }).

import { clamp } from './math.js';
import { DEFAULT_EFFECTS, QUALITY_PRESETS } from './config.js';
import { createGpuContext, isSoftwareAdapter } from '../rendering/gpu-context.js';
import { Renderer, MAX_QUADS, MAX_TRACK_SAMPLES } from '../rendering/compositing/renderer.js';
import { RaceView, CAMERA } from '../rendering/compositing/race-view.js';
import { QuadBatch } from '../rendering/drawing/quad-batch.js';
import { buildTrackAttributes } from '../rendering/drawing/track-attributes.js';
import { SceneBuilder } from '../rendering/drawing/scene-builder.js';
import { getPalette, shaderColors } from '../art/palettes/palettes.js';
import { ArtLibrary, CAR_ANGLES } from '../art/art-library.js';
import { ALL_TEAMS } from '../vehicles/liveries.js';
import { buildSceneryLayout } from '../tracks/scenery-layout.js';
import { getCircuit } from '../tracks/track-catalog.js';
import { buildTrack } from '../tracks/track-builder.js';
import { Race, RACE_PHASE, SIM_DT } from '../gameplay/race.js';
import { computeViewRects } from '../multiplayer/split-screen.js';

export class GameApp {
  constructor(canvas) {
    this.canvas = canvas;
    this.gpu = null;
    this.renderer = null;
    this.art = null;             // ArtLibrary: atlases and sprite lookup (set by init)
    this.scene = null;           // SceneBuilder (set by init)
    this.race = null;
    this.track = null;
    this.palette = null;
    this.tracks = new Map();
    this.layouts = new Map();
    this.layout = null;
    this.views = [new RaceView(0), new RaceView(1)];
    this.viewCount = 1;
    this.viewTargets = [0];
    this.splitLayout = 'horizontal';
    this.effects = { ...DEFAULT_EFFECTS };
    this.quality = QUALITY_PRESETS.high;
    this.quads = new QuadBatch(MAX_QUADS);
    this.paused = false;
    this.running = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.time = 0;
    this.listeners = [];
    this.input = null;
    this.audio = null;
    this.ui = null;
    this.hud = null;
    this.session = null;         // current game mode controller (gameplay/modes), may be null in automation
    this.forcedSize = null;
    this.frameHook = null;
    this.stats = { fps: 0, frameMs: 0, simMs: 0, buildMs: 0, renderMs: 0 };
    this.frame = { viewCount: 0, views: [], quads: this.quads, page: { visible: false, alpha: 1, wipe: 1 } };
    for (const view of this.views) {
      this.frame.views.push({ rect: view.rect, uniforms: view.uniforms, rows: view.projection.rows, rowCount: 0,
        sceneStart: 0, sceneCount: 0, frontStart: 0, frontCount: 0, overlay: false, scene: false });
    }
    this.onFrame = this.onFrame.bind(this);
  }

  /**
   * @param options { quality: 'low'|'medium'|'high', onError, artFactory(app) -> ArtLibrary, sceneFactory(app) -> SceneBuilder }
   */
  async init(options = {}) {
    this.gpu = await createGpuContext(this.canvas, options.onError);
    this.softwareAdapter = isSoftwareAdapter(this.gpu.info);
    this.quality = { ...(QUALITY_PRESETS[options.quality] || QUALITY_PRESETS.high), ...(options.qualityOverrides || {}) };
    this.renderer = new Renderer(this.gpu, { sampleCount: this.quality.sampleCount, carLayers: CAR_ANGLES * 2 });
    this.renderer.init();
    this.art = new ArtLibrary(this.renderer);
    this.art.buildCars();
    this.art.setLiveries(ALL_TEAMS);
    if (options.registerArt) options.registerArt(this.art, this);
    this.art.buildStatic();
    this.scene = new SceneBuilder(this.art);
    if (options.attachLayers) options.attachLayers(this.scene, this);
    this.resize(true);
  }

  getTrack(circuitId) {
    let track = this.tracks.get(circuitId);
    if (!track) { track = buildTrack(getCircuit(circuitId)); this.tracks.set(circuitId, track); }
    return track;
  }

  on(listener) { this.listeners.push(listener); }
  emit(type, payload) { for (let i = 0; i < this.listeners.length; i++) this.listeners[i](type, payload); }

  /**
   * Start a race. config: { circuitId, laps, entries, rules, difficulty, seed, kind, views, cameras }
   * `views` lists the car indices to follow (one per screen).
   */
  startRace(config) {
    const track = this.getTrack(config.circuitId);
    let layout = this.layouts.get(track.id);
    if (!layout) { layout = buildSceneryLayout(track); this.layouts.set(track.id, layout); }
    this.layout = layout;
    if (this.track !== track) {
      this.track = track;
      this.palette = getPalette(track.theme);
      this.renderer.setTrackAttributes(buildTrackAttributes(track, MAX_TRACK_SAMPLES));
      this.art.loadTheme(track, this.palette, layout);
    }
    this.race = new Race({ ...config, track });
    this.viewTargets = config.views && config.views.length ? config.views.slice(0, 2) : [0];
    this.viewCount = this.viewTargets.length;
    const colors = shaderColors(this.palette);
    colors.fogDensity = layout.theme.fogDensity;
    for (let v = 0; v < this.viewCount; v++) {
      const view = this.views[v];
      view.carIndex = this.viewTargets[v];
      view.camera = config.cameras ? config.cameras[v] ?? CAMERA.COCKPIT : CAMERA.COCKPIT;
      view.configure(track, colors, this.race.rules.flyingStart ? 0 : this.race.cars.length);
      view.yaw = 0; view.pitch = 0; view.impact = 0; view.flash = 0; view.speedLines = 0;
    }
    this.scene.reset(this.race, track, layout, this.palette);
    this.accumulator = 0;
    this.paused = false;
    this.resize(true);
    if (this.hud) this.hud.onRaceStart(this);
    this.emit('raceStart', this.race);
    return this.race;
  }

  stopRace() { this.race = null; this.emit('raceStop', null); }

  setCanvasSize(width, height) { this.forcedSize = { width, height }; this.resize(true); }

  resize(force = false) {
    const canvas = this.canvas;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.forcedSize ? this.forcedSize.width : Math.max(320, Math.round(canvas.clientWidth * ratio));
    const h = this.forcedSize ? this.forcedSize.height : Math.max(200, Math.round(canvas.clientHeight * ratio));
    const changed = canvas.width !== w || canvas.height !== h;
    if (changed) { canvas.width = w; canvas.height = h; }
    if (!changed && !force) return;
    if (this.renderer) this.renderer.resize(w, h);
    const rects = computeViewRects(w, h, this.viewCount, this.splitLayout);
    for (let v = 0; v < this.viewCount; v++) this.views[v].setRect(rects[v].x, rects[v].y, rects[v].w, rects[v].h);
    this.emit('resize', null);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.onFrame);
  }

  stop() { this.running = false; }

  onFrame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.onFrame);
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.1);
    this.lastTime = now;
    this.resize();
    const t0 = performance.now();
    if (this.race && !this.paused) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= SIM_DT && steps < 16) {
        this.simulate();
        this.accumulator -= SIM_DT;
        steps++;
      }
      if (steps === 16) this.accumulator = 0;
    }
    const t1 = performance.now();
    this.present(dt, this.paused ? 0 : this.accumulator);
    this.stats.simMs = t1 - t0; this.stats.frameMs = dt * 1000;
    this.stats.fps = this.stats.fps * 0.95 + (dt > 0 ? 1 / dt : 0) * 0.05;
    if (this.frameHook) this.frameHook(dt, this);
  }

  /** One fixed simulation step, including input sampling and event dispatch. */
  simulate() {
    const race = this.race;
    if (this.input) this.input.apply(race, this);
    race.step(SIM_DT);
    for (let i = 0; i < race.eventCount; i++) this.dispatch(race.events[i]);
    race.eventCount = 0;
  }

  dispatch(event) {
    if (this.scene) this.scene.onEvent(event, this);
    if (this.audio) this.audio.onEvent(event, this);
    if (this.hud) this.hud.onRaceEvent(event, this);
    if (this.ui) this.ui.onRaceEvent(event, this);
    this.emit(event.type, event);
  }

  /** Update presentation state and draw. `ahead` = seconds since the last simulation tick. */
  present(dt, ahead) {
    const renderer = this.renderer;
    if (!renderer) return;
    const t0 = performance.now();
    const race = this.race, frame = this.frame, quads = this.quads;
    const simDt = this.paused ? 0 : dt;
    this.time += dt;
    quads.reset();
    if (this.hud) this.hud.update(this, simDt);
    if (this.ui) this.ui.update(this, dt);
    frame.viewCount = race ? this.viewCount : 0;
    if (race) {
      if (this.scene) this.scene.update(this, simDt, ahead);
      for (let v = 0; v < this.viewCount; v++) {
        const view = this.views[v], fv = frame.views[v];
        view.update(simDt, race, this.effects, ahead);
        const car = race.cars[view.carIndex];
        view.writeUniforms(this.time, car.speed, this.time * 0.0016, this.quality.detail);
        fv.rowCount = view.projection.height; fv.scene = true;
        fv.sceneStart = quads.count;
        if (this.scene) this.scene.buildView(this, view);
        fv.sceneCount = quads.count - fv.sceneStart;
        fv.overlay = view.speedLines > 0.004 || view.flash > 0.004;
        fv.frontStart = quads.count;
        if (this.scene) this.scene.buildFront(this, view);
        if (this.hud) this.hud.drawFront(this, view);
        if (this.ui) this.ui.drawFront(this, view);
        fv.frontCount = quads.count - fv.frontStart;
      }
    }
    const t1 = performance.now();
    renderer.render(frame);
    if (this.audio) this.audio.update(this, dt);
    this.stats.buildMs = t1 - t0; this.stats.renderMs = performance.now() - t1;
  }

  /**
   * Deterministic frame for captures and tests: advance exactly `ticks` simulation steps,
   * render, and resolve once the GPU has finished.
   */
  async advanceFrame(ticks = 2) {
    if (this.race && !this.paused) for (let i = 0; i < ticks; i++) this.simulate();
    this.present(ticks * SIM_DT, 0);
    await this.gpu.device.queue.onSubmittedWorkDone();
  }

  get raceFinished() { return !!this.race && this.race.phase === RACE_PHASE.FINISHED; }
}
