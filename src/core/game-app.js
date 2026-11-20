// Application core: owns the renderer, the current race and the frame loop. Game modes, menus,
// input devices and audio plug into it; none of them is required for the simulation to run.

import { clamp } from './math.js';
import { createGpuContext, isSoftwareAdapter } from '../graphics/gpu-context.js';
import { Renderer, MAX_CARS } from '../graphics/renderer.js';
import { resolveQuality } from '../graphics/quality.js';
import { buildWorld } from '../graphics/world-builder.js';
import { CameraRig, CAMERA_MODE } from '../graphics/cameras.js';
import { Effects } from '../graphics/particles.js';
import { buildCarMesh } from '../vehicles/car-mesh.js';
import { CarVisuals } from '../vehicles/car-visual.js';
import { getCircuit } from '../tracks/track-catalog.js';
import { buildTrack } from '../tracks/track-builder.js';
import { Race, RACE_PHASE, SIM_DT } from '../gameplay/race.js';
import { computeViewRects } from '../multiplayer/split-screen.js';

export class GameApp {
  constructor(sceneCanvas, hudCanvas) {
    this.sceneCanvas = sceneCanvas;
    this.hudCanvas = hudCanvas;
    this.gpu = null;
    this.renderer = null;
    this.race = null;
    this.world = null;
    this.tracks = new Map();
    this.visuals = new CarVisuals();
    this.effects = null;
    this.rigs = [new CameraRig(), new CameraRig()];
    this.viewTargets = [0];
    this.splitLayout = 'horizontal';
    this.paused = false;
    this.running = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.time = 0;
    this.frameDesc = { time: 0, cameras: [], carCount: 0, particleCount: 0, hideDrivers: [-1, -1] };
    this.listeners = [];
    this.input = null;     // set by the input layer: { apply(race) }
    this.audio = null;     // set by the audio layer: { update(app, dt), onEvent(e, app) }
    this.hud = null;       // set by the UI layer: { draw(app, dt) }
    this.forcedSize = null;
    this.frameHook = null; // benchmark / tests
    this.stats = { fps: 0, frameMs: 0, simMs: 0, renderMs: 0 };
    this.worldPose = { tvCameras: [], track: null };
    this.onFrame = this.onFrame.bind(this);
  }

  async init(qualityId = 'high', qualityOverrides = null, onError = null) {
    this.gpu = await createGpuContext(this.sceneCanvas, onError);
    this.softwareAdapter = isSoftwareAdapter(this.gpu.info);
    this.quality = resolveQuality(qualityId, qualityOverrides);
    this.renderer = new Renderer(this.gpu, this.quality);
    this.renderer.init();
    this.renderer.setCarMesh(buildCarMesh());
    this.effects = new Effects(this.renderer, this.quality.particles);
    this.resize();
  }

  /** Change quality settings (recreates the renderer's size dependent resources). */
  setQuality(qualityId, overrides = null) {
    this.quality = resolveQuality(qualityId, overrides);
    const world = this.world;
    this.renderer = new Renderer(this.gpu, this.quality);
    this.renderer.init();
    this.renderer.setCarMesh(buildCarMesh());
    this.effects = new Effects(this.renderer, this.quality.particles);
    if (world) { this.renderer.setWorld(world); this.effects.reset(world.theme); }
    this.visuals.reset();
    this.resize(true);
  }

  getTrack(circuitId) {
    let track = this.tracks.get(circuitId);
    if (!track) { track = buildTrack(getCircuit(circuitId)); this.tracks.set(circuitId, track); }
    return track;
  }

  on(listener) { this.listeners.push(listener); }
  emit(type, payload) { for (const l of this.listeners) l(type, payload); }

  /**
   * Start a race. config: { circuitId, laps, entries, rules, difficulty, seed, kind, views }
   * where views lists the car indices to follow (one per screen).
   */
  startRace(config) {
    const track = this.getTrack(config.circuitId);
    if (!this.world || this.world.track !== track) {
      this.world = buildWorld(track);
      this.renderer.setWorld(this.world);
    } else {
      this.renderer.decalData.fill(0);
      this.renderer.markDecals(0, this.renderer.decalData.length / 28);
    }
    this.worldPose.tvCameras = this.world.tvCameras;
    this.worldPose.track = track;
    this.effects.reset(this.world.theme);
    this.race = new Race({ ...config, track });
    if (this.race.cars.length > MAX_CARS) throw new Error(`At most ${MAX_CARS} cars are supported`);
    this.viewTargets = config.views && config.views.length ? config.views.slice(0, 2) : [0];
    this.visuals.reset();
    for (const rig of this.rigs) { rig.lastMode = -1; rig.tvIndex = -1; }
    this.accumulator = 0;
    this.paused = false;
    this.resize(true);
    this.emit('raceStart', this.race);
    return this.race;
  }

  stopRace() { this.race = null; this.emit('raceStop', null); }

  setCanvasSize(width, height) { this.forcedSize = { width, height }; this.resize(true); }

  resize(force = false) {
    const canvas = this.sceneCanvas;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.forcedSize ? this.forcedSize.width : Math.max(320, Math.round(canvas.clientWidth * ratio));
    const h = this.forcedSize ? this.forcedSize.height : Math.max(200, Math.round(canvas.clientHeight * ratio));
    const changed = canvas.width !== w || canvas.height !== h;
    if (changed) { canvas.width = w; canvas.height = h; this.hudCanvas.width = w; this.hudCanvas.height = h; }
    if ((changed || force) && this.renderer) {
      this.viewRects = computeViewRects(w, h, this.viewTargets.length, this.splitLayout);
      this.renderer.configureViews(this.viewRects);
    }
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
    let alpha = 1;
    if (this.race && !this.paused) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= SIM_DT && steps < 16) {
        this.simulate();
        this.accumulator -= SIM_DT;
        steps++;
      }
      if (steps === 16) this.accumulator = 0;
      alpha = this.accumulator / SIM_DT;
    }
    const t1 = performance.now();
    this.present(this.paused ? 0 : dt, alpha);
    const t2 = performance.now();
    this.stats.simMs = t1 - t0; this.stats.renderMs = t2 - t1; this.stats.frameMs = dt * 1000;
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
    const race = this.race;
    if (event.type === 'wall' || event.type === 'contact') {
      const car = race.cars[event.car];
      if (event.value > 2.5 && this.effects) {
        const i = car.segIndex, track = race.track;
        const side = event.type === 'wall' ? Math.sign(car.d) : 0;
        this.effects.sparks(car.x + track.nx[i] * side * 0.9, car.y, car.z + track.nz[i] * side * 0.9, Math.cos(car.heading), Math.sin(car.heading), event.value);
      }
      this.visuals.addImpact(event.car, clamp(event.value / 18, 0.05, 1));
      if (event.other >= 0) this.visuals.addImpact(event.other, clamp(event.value / 18, 0.05, 1));
    } else if (event.type === 'crash') this.visuals.addImpact(event.car, 1);
    if (this.audio) this.audio.onEvent(event, this);
    this.emit(event.type, event);
  }

  /** Update presentation state and draw. */
  present(dt, alpha) {
    const race = this.race, renderer = this.renderer;
    if (!race || !renderer) return;
    this.time += dt;
    this.visuals.update(race, alpha, dt, renderer.carInstanceData);
    const frame = this.frameDesc;
    frame.time = this.time;
    frame.carCount = race.cars.length;
    frame.particleCount = this.effects.update(race, this.visuals, dt);
    frame.cameras.length = this.viewTargets.length;
    for (let v = 0; v < this.viewTargets.length; v++) {
      const index = this.viewTargets[v], rig = this.rigs[v];
      rig.update(dt, this.visuals.poses[index], race.cars[index], this.worldPose);
      frame.cameras[v] = rig.camera;
      frame.hideDrivers[v] = rig.mode === CAMERA_MODE.COCKPIT ? index : -1;
    }
    renderer.render(frame);
    this.visuals.endFrame();
    if (this.audio) this.audio.update(this, dt);
    if (this.hud) this.hud.draw(this, dt);
  }

  /**
   * Deterministic frame for captures and tests: advance exactly `ticks` simulation steps,
   * render, and resolve once the GPU has finished.
   */
  async advanceFrame(ticks = 2) {
    if (this.race && !this.paused) for (let i = 0; i < ticks; i++) this.simulate();
    this.present(ticks * SIM_DT, 1);
    await this.gpu.device.queue.onSubmittedWorkDone();
  }

  get raceFinished() { return !!this.race && this.race.phase === RACE_PHASE.FINISHED; }
}
