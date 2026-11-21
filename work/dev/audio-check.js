// Development harness, not part of the game: renders scripted races through an
// OfflineAudioContext, measures the result and exposes it as window.runAudioCheck().
// Driven by work/scripts/audio-check.mjs.

import { GameAudio } from '../../src/audio/game-audio.js';
import { PlayerEngineVoice, OpponentEngineVoice, createEngineWave } from '../../src/audio/engine-voice.js';
import { CarNoise } from '../../src/audio/car-noise.js';
import { CrowdAmbience } from '../../src/audio/ambience.js';
import { createNoiseBuffer, createControlBuffer, createPulseBuffer, makeDriveCurve } from '../../src/audio/noise.js';
import { AUDIO_TUNING } from '../../src/audio/audio-tuning.js';

const RATE = 44100;
const FRAME = 1 / 60;
const GEAR_TOP = [27, 39, 51, 64, 78, 93];
const RPM_IDLE = 3500, RPM_MAX = 13500;
const TRACK_LENGTH = 4200;
const DEFAULTS = { enabled: true, master: 0.8, engine: 0.8, effects: 0.8, ambience: 0.6 };
const ENGINE_ONLY = { enabled: true, master: 0.8, engine: 0.8, effects: 0, ambience: 0 };
const EFFECTS_ONLY = { enabled: true, master: 0.8, engine: 0, effects: 0.8, ambience: 0 };
const AMBIENCE_ONLY = { enabled: true, master: 0.8, engine: 0, effects: 0, ambience: 0.8 };

// ---- fake game state

function makeCar(index) {
  return {
    index, rpm: RPM_IDLE, throttle: 0, brake: 0, speed: 0, slip: 0, wheelspin: 0, surface: 0, limiter: false,
    boosting: false, gear: 1, state: 0, s: 0, d: 0, draft: 0, engineOut: false, removed: false,
  };
}

function makeApp(carCount = 1, views = [0]) {
  const cars = [];
  for (let i = 0; i < carCount; i++) cars.push(makeCar(i));
  return { race: { cars, track: { length: TRACK_LENGTH }, phase: 'racing', time: 0 }, viewTargets: views, paused: false };
}

function racing(car, rpm, throttle, speed = 0) {
  car.state = 1; car.rpm = rpm; car.throttle = throttle; car.speed = speed;
  return car;
}

function approach(a, b, rate, dt) { return b + (a - b) * Math.exp(-rate * dt); }

// ---- offline rendering

/**
 * Render `seconds` of audio. `step(t, dt, app, emit, audio, frame)` runs before every
 * audio.update(), 60 times per second of audio time (the offline context is suspended at each
 * frame boundary, so the audio code sees a moving currentTime exactly like in the game).
 */
async function render(seconds, settings, app, step) {
  const context = new OfflineAudioContext(2, Math.round(seconds * RATE), RATE);
  const audio = new GameAudio(settings, context);
  await audio.resume();
  const errors = [];
  const event = { type: '', car: 0, value: 0, other: -1 };
  const emit = (type, car = -1, value = 0, other = -1) => {
    event.type = type; event.car = car; event.value = value; event.other = other;
    audio.onEvent(event, app);
  };
  const run = (frame) => {
    try {
      if (step) step(frame * FRAME, FRAME, app, emit, audio, frame);
      audio.update(app, FRAME);
    } catch (error) {
      errors.push(String(error && error.stack ? error.stack : error));
    }
  };
  const frames = Math.floor(seconds / FRAME);
  for (let frame = 1; frame < frames; frame++) {
    context.suspend(frame * FRAME).then(() => { run(frame); context.resume(); });
  }
  run(0);
  const buffer = await context.startRendering();
  audio.dispose();
  return { left: buffer.getChannelData(0), right: buffer.getChannelData(1), errors, seconds };
}

// ---- measurements

function rmsOf(data, from, to) {
  const a = Math.max(0, Math.floor(from * RATE)), b = Math.min(data.length, Math.floor(to * RATE));
  let sum = 0;
  for (let i = a; i < b; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, b - a));
}

/** RMS of both channels together. */
function level(result, from = 0, to = result.seconds) {
  const l = rmsOf(result.left, from, to), r = rmsOf(result.right, from, to);
  return Math.sqrt((l * l + r * r) / 2);
}

function summary(result) {
  let peak = 0, nan = 0, sumL = 0, sumR = 0;
  const n = result.left.length;
  for (let i = 0; i < n; i++) {
    const l = result.left[i], r = result.right[i];
    if (Number.isNaN(l) || Number.isNaN(r) || !Number.isFinite(l) || !Number.isFinite(r)) { nan++; continue; }
    if (Math.abs(l) > peak) peak = Math.abs(l);
    if (Math.abs(r) > peak) peak = Math.abs(r);
    sumL += l; sumR += r;
  }
  const perSecond = [];
  for (let s = 0; s + 1 <= result.seconds + 1e-6; s++) perSecond.push(level(result, s, s + 1));
  return { peak, nanRatio: nan / n, dcLeft: sumL / n, dcRight: sumR / n, rms: level(result), perSecond };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, angle = (-2 * Math.PI) / size;
    const wr = Math.cos(angle), wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k, b = a + half;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Average magnitude spectrum (Hann windows of `size` samples, 50 % overlap) of the mono mix. */
function spectrum(result, from, to, size = 4096) {
  const a = Math.floor(from * RATE), b = Math.min(result.left.length, Math.floor(to * RATE));
  const mags = new Float64Array(size / 2);
  const re = new Float64Array(size), im = new Float64Array(size);
  let count = 0;
  for (let start = a; start + size <= b; start += size / 2) {
    for (let i = 0; i < size; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
      re[i] = (result.left[start + i] + result.right[start + i]) * 0.5 * w;
      im[i] = 0;
    }
    fft(re, im);
    for (let i = 0; i < size / 2; i++) mags[i] += Math.hypot(re[i], im[i]);
    count++;
  }
  for (let i = 0; i < mags.length; i++) mags[i] /= Math.max(1, count);
  return { mags, binHz: RATE / size };
}

function centroid(result, from, to) {
  const { mags, binHz } = spectrum(result, from, to);
  let num = 0, den = 0;
  for (let i = 1; i < mags.length; i++) { num += i * binHz * mags[i]; den += mags[i]; }
  return den > 0 ? num / den : 0;
}

/** Share of the spectrum magnitude between two frequencies. */
function bandShare(result, from, to, lowHz, highHz) {
  const { mags, binHz } = spectrum(result, from, to);
  let band = 0, all = 0;
  for (let i = 1; i < mags.length; i++) { all += mags[i]; if (i * binHz >= lowHz && i * binHz < highHz) band += mags[i]; }
  return all > 0 ? band / all : 0;
}

function peakFrequency(result, from, to, lowHz, highHz) {
  const { mags, binHz } = spectrum(result, from, to, 8192);
  let best = 0, bestBin = 0;
  for (let i = Math.ceil(lowHz / binHz); i < Math.min(mags.length, highHz / binHz); i++) if (mags[i] > best) { best = mags[i]; bestBin = i; }
  return bestBin * binHz;
}

/** Depth of the amplitude modulation: standard deviation / mean of a 4 ms RMS envelope. */
function modulation(result, from, to) {
  const window = 0.004;
  let sum = 0, sum2 = 0, n = 0;
  for (let t = from; t + window <= to; t += window) {
    const v = level(result, t, t + window);
    sum += v; sum2 += v * v; n++;
  }
  const mean = sum / n;
  return mean > 0 ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) / mean : 0;
}

function round(value, digits = 4) { const k = 10 ** digits; return Math.round(value * k) / k; }

// ---- scenarios

/** Countdown, start, run through the gears, skid, kerb, wall hit and an opponent going by. */
async function raceScenario(settings, seconds = 8) {
  const app = makeApp(7, [0]);
  const cars = app.race.cars, me = cars[0];
  app.race.phase = 'countdown';
  const grid = [[-40, 0], [-32, -3], [-24, 3], [-48, 3], [-56, -3], [-64, 3], [1500, 0]];
  cars.forEach((car, i) => { car.s = (grid[i][0] + TRACK_LENGTH) % TRACK_LENGTH; car.d = grid[i][1]; });
  const accel = [24, 22, 25, 21, 23, 20, 22];
  const lights = [0.4, 0.85, 1.3, 1.75, 2.2];
  const green = 2.6;
  let lit = 0, started = false, hit = false, overtaken = false;
  const drive = (car, i, dt, emit, throttle) => {
    car.throttle = throttle;
    car.speed += accel[i] * (1 - car.speed / 105) * throttle * dt - (1 - throttle) * 4 * dt - car.brake * 30 * dt;
    if (car.speed < 0) car.speed = 0;
    if (car.gear < 6 && car.speed > GEAR_TOP[car.gear - 1] * 0.965) { car.gear++; emit('shift', i, 1); }
    else if (car.gear > 1 && car.speed < GEAR_TOP[car.gear - 2] * 0.86) { car.gear--; emit('shift', i, -1); }
    const target = Math.max(RPM_IDLE, RPM_MAX * Math.min(1.02, car.speed / GEAR_TOP[car.gear - 1]));
    car.rpm = approach(car.rpm, Math.min(RPM_MAX, target + (car.wheelspin > 0 ? RPM_MAX * 0.25 * car.wheelspin : 0)), 22, dt);
    car.limiter = car.speed >= GEAR_TOP[car.gear - 1];
    car.s = (car.s + car.speed * dt) % TRACK_LENGTH;
  };
  const result = await render(seconds, settings, app, (t, dt, _app, emit) => {
    app.race.time = Math.max(0, t - green);
    if (t < green) {
      while (lit < 5 && t >= lights[lit]) { lit++; emit('light', -1, lit); }
      cars.forEach((car, i) => {
        const blip = lit >= 2 && Math.sin(t * 7 + i * 1.7) > 0.2 ? 0.85 : 0.08;
        car.throttle = blip;
        const target = RPM_IDLE + (RPM_MAX - RPM_IDLE) * 0.78 * blip;
        car.rpm = approach(car.rpm, target, car.rpm < target ? 9 : 5, dt);
      });
      return;
    }
    if (!started) {
      started = true;
      app.race.phase = 'racing';
      cars.forEach((car) => { car.state = 1; });
      emit('green', -1, 0);
    }
    const r = t - green;
    // Listener: launch with wheelspin, skid at 3 s, kerb at 3.6 s, wall at 4.2 s.
    me.wheelspin = r < 0.5 ? 0.8 : 0;
    me.slip = r > 3 && r < 3.5 ? 1.3 : 0;
    me.surface = r > 3.6 && r < 4 ? 1 : 0;
    me.brake = r > 4.2 && r < 4.55 ? 1 : 0;
    if (r > 4.2 && !hit) { hit = true; me.speed *= 0.75; emit('wall', 0, 9); }
    drive(me, 0, dt, emit, me.brake > 0 ? 0 : r > 3 && r < 3.5 ? 0.3 : 1);
    for (let i = 1; i < 6; i++) drive(cars[i], i, dt, emit, 1);
    // Car 5 comes from behind and goes by on the right between 3.4 s and 5.4 s.
    if (r > 3.4) {
      const pass = cars[5];
      pass.speed = me.speed + 30;
      pass.s = (me.s + (r - 4.4) * 30 + TRACK_LENGTH) % TRACK_LENGTH;
      pass.d = me.d + 3.5;
      me.draft = r > 4.4 && r < 5 ? 0.8 : 0;
      if (r > 4.4 && !overtaken) { overtaken = true; emit('overtaken', 0, 1); }
    }
  });
  return result;
}

/** Listener car held in a steady state. */
async function steady(settings, seconds, configure, step) {
  const app = makeApp(1, [0]);
  racing(app.race.cars[0], 9000, 1);
  app.race.cars[0].s = TRACK_LENGTH / 2;
  if (configure) configure(app.race.cars[0], app);
  return render(seconds, settings, app, step);
}

/** One event, alone, at 0.1 s. Returns the level before and after. */
async function eventLevel(type, value, other, configure, seconds = 1.2) {
  const app = makeApp(2, [0]);
  const cars = app.race.cars;
  racing(cars[0], 0, 0).engineOut = true;   // silent listener
  racing(cars[1], 0, 0).engineOut = true;
  cars[0].s = TRACK_LENGTH / 2; cars[1].s = TRACK_LENGTH / 2 + 12; cars[1].d = 3;
  if (configure) configure(app);
  let fired = false;
  const result = await render(seconds, EFFECTS_ONLY, app, (t, dt, _app, emit, audio) => {
    if (t >= 0.1 && !fired) {
      fired = true;
      if (type.startsWith('ui:')) audio.uiSound(type.slice(3)); else emit(type, type === 'light' || type === 'green' ? -1 : (other === 'far' || other === 'near' ? 1 : 0), value, typeof other === 'number' ? other : -1);
    }
  });
  return { before: level(result, 0, 0.09), after: level(result, 0.1, Math.min(seconds, 0.9)), stats: summary(result), errors: result.errors };
}

async function runAudioCheck(options = {}) {
  const checks = [];
  const stats = {};
  const errors = [];
  const check = (name, pass, detail) => { checks.push({ name, pass: !!pass, detail }); };
  const collect = (result) => { for (const e of result.errors) errors.push(e); return result; };
  const clean = (name, s) => {
    check(`${name}: no NaN / infinite samples`, s.nanRatio === 0, `ratio ${s.nanRatio}`);
    check(`${name}: peak below 1.0 (no clipping)`, s.peak < 1, `peak ${round(s.peak)}`);
    check(`${name}: DC offset below 0.01`, Math.abs(s.dcLeft) < 0.01 && Math.abs(s.dcRight) < 0.01, `L ${round(s.dcLeft, 5)} R ${round(s.dcRight, 5)}`);
  };

  // 1. Scripted race at the default volumes.
  const race = collect(await raceScenario(DEFAULTS));
  const raceStats = summary(race);
  stats.race = {
    perSecondRms: raceStats.perSecond.map((v) => round(v)), peak: round(raceStats.peak), rms: round(raceStats.rms),
    dcLeft: round(raceStats.dcLeft, 6), dcRight: round(raceStats.dcRight, 6), nanRatio: raceStats.nanRatio,
  };
  clean('race', raceStats);
  check('race: every second is audible', raceStats.perSecond.every((v) => v > 0.004), `min ${round(Math.min(...raceStats.perSecond))}`);
  check('race: not crushed against the limiter', raceStats.rms < 0.3, `rms ${round(raceStats.rms)}`);
  if (options.wav) stats.wav = toWav(race);

  // 2. Same race, every volume at maximum: the limiter must hold.
  const loud = collect(await raceScenario({ enabled: true, master: 1, engine: 1, effects: 1, ambience: 1 }, 8));
  const loudStats = summary(loud);
  stats.raceMaxVolume = { peak: round(loudStats.peak), rms: round(loudStats.rms), nanRatio: loudStats.nanRatio };
  clean('race at max volume', loudStats);

  // 3. Engine tone against rpm and throttle.
  const lowRpm = collect(await steady(ENGINE_ONLY, 1.6, (car) => racing(car, 4500, 1)));
  const highRpm = collect(await steady(ENGINE_ONLY, 1.6, (car) => racing(car, 12500, 1)));
  const throttleOn = collect(await steady(ENGINE_ONLY, 1.6, (car) => racing(car, 9000, 1)));
  const throttleOff = collect(await steady(ENGINE_ONLY, 1.6, (car) => racing(car, 9000, 0)));
  const idle = collect(await steady(ENGINE_ONLY, 1.6, (car) => { racing(car, 3500, 0); car.state = 0; }));
  stats.engine = {
    centroidLowRpm: round(centroid(lowRpm, 0.6, 1.6), 0), centroidHighRpm: round(centroid(highRpm, 0.6, 1.6), 0),
    rmsLowRpm: round(level(lowRpm, 0.6, 1.6)), rmsHighRpm: round(level(highRpm, 0.6, 1.6)),
    rmsThrottleOn: round(level(throttleOn, 0.6, 1.6)), rmsThrottleOff: round(level(throttleOff, 0.6, 1.6)),
    centroidThrottleOn: round(centroid(throttleOn, 0.6, 1.6), 0), centroidThrottleOff: round(centroid(throttleOff, 0.6, 1.6), 0),
    rmsIdle: round(level(idle, 0.6, 1.6)), peakHighRpm: round(summary(highRpm).peak),
  };
  const e = stats.engine;
  check('engine: spectral centroid rises with rpm', e.centroidHighRpm > e.centroidLowRpm * 1.3, `${e.centroidLowRpm} Hz -> ${e.centroidHighRpm} Hz`);
  check('engine: louder on throttle than off', e.rmsThrottleOn > e.rmsThrottleOff * 1.5, `on ${e.rmsThrottleOn} off ${e.rmsThrottleOff}`);
  check('engine: brighter on throttle than off', e.centroidThrottleOn > e.centroidThrottleOff * 1.2, `on ${e.centroidThrottleOn} Hz off ${e.centroidThrottleOff} Hz`);
  check('engine: audible at idle', e.rmsIdle > 0.01, `rms ${e.rmsIdle}`);
  check('engine: harmonically rich (energy above 3x the firing frequency)', bandShare(highRpm, 0.6, 1.6, 3200, 16000) > 0.08, `share ${round(bandShare(highRpm, 0.6, 1.6, 3200, 16000), 3)}`);
  clean('engine high rpm', summary(highRpm));

  // 4. Gear change, rev limiter, turbo.
  let shifted = false;
  const shift = collect(await steady(ENGINE_ONLY, 1.6, (car) => racing(car, 11000, 1), (t, dt, app, emit) => {
    if (t >= 1 && !shifted) { shifted = true; emit('shift', 0, 1); }
  }));
  const limiterOn = collect(await steady(ENGINE_ONLY, 1.6, (car) => { racing(car, 13500, 1); car.limiter = true; }));
  const limiterOff = collect(await steady(ENGINE_ONLY, 1.6, (car) => racing(car, 13500, 1)));
  const boostOn = collect(await steady(ENGINE_ONLY, 1.6, (car) => { racing(car, 11000, 1); car.boosting = true; }));
  const boostOff = collect(await steady(ENGINE_ONLY, 1.6, (car) => racing(car, 11000, 1)));
  stats.engineEvents = {
    shiftDip: round(level(shift, 1.025, 1.075) / level(shift, 0.9, 1)),
    shiftRecovered: round(level(shift, 1.3, 1.5) / level(shift, 0.8, 1)),
    limiterModulation: round(modulation(limiterOn, 0.6, 1.6), 3), steadyModulation: round(modulation(limiterOff, 0.6, 1.6), 3),
    turboBandOn: round(bandShare(boostOn, 0.6, 1.6, 5000, 6500), 4), turboBandOff: round(bandShare(boostOff, 0.6, 1.6, 5000, 6500), 4),
  };
  const g = stats.engineEvents;
  check('shift: torque cut is audible', g.shiftDip < 0.7, `level x${g.shiftDip} during the cut`);
  check('shift: level recovers', g.shiftRecovered > 0.85 && g.shiftRecovered < 1.15, `x${g.shiftRecovered}`);
  check('limiter: stutter modulates the level', g.limiterModulation > 0.2 && g.limiterModulation > g.steadyModulation * 2, `${g.limiterModulation} vs ${g.steadyModulation}`);
  check('turbo: whistle band appears when boosting', g.turboBandOn > g.turboBandOff * 1.3, `${g.turboBandOn} vs ${g.turboBandOff}`);

  // 5. Car noises (engine and crowd muted).
  const noise = async (configure) => level(collect(await steady(EFFECTS_ONLY, 1.4, configure)), 0.6, 1.4);
  stats.carNoise = {
    still: round(await noise((car) => racing(car, 5000, 0, 0)), 5),
    slow: round(await noise((car) => racing(car, 5000, 0.5, 15)), 5),
    fast: round(await noise((car) => racing(car, 12000, 1, 90)), 5),
    cruise: round(await noise((car) => racing(car, 9000, 0.5, 45)), 5),
    skid: round(await noise((car) => { racing(car, 9000, 0.5, 45).slip = 1.3; }), 5),
    wheelspin: round(await noise((car) => { racing(car, 9000, 1, 8).wheelspin = 0.9; }), 5),
    kerb: round(await noise((car) => { racing(car, 9000, 0.5, 45).surface = 1; }), 5),
    grass: round(await noise((car) => { racing(car, 9000, 0.5, 45).surface = 2; }), 5),
    gravel: round(await noise((car) => { racing(car, 9000, 0.5, 45).surface = 3; }), 5),
    brake: round(await noise((car) => { racing(car, 9000, 0, 45).brake = 1; }), 5),
    puncture: round(await noise((car) => { racing(car, 9000, 0.5, 45).puncture = true; }), 5),
  };
  const c = stats.carNoise;
  check('wind: silent at standstill', c.still < 0.0005, `rms ${c.still}`);
  check('wind: rises with speed', c.fast > c.cruise * 1.8 && c.cruise > c.slow * 1.8, `15 m/s ${c.slow}, 45 m/s ${c.cruise}, 90 m/s ${c.fast}`);
  for (const key of ['skid', 'kerb', 'grass', 'gravel', 'brake', 'puncture']) {
    check(`${key}: adds sound at 45 m/s`, c[key] > c.cruise * 1.2, `${c[key]} vs ${c.cruise}`);
  }
  check('wheelspin: squeal at low speed', c.wheelspin > 0.01, `rms ${c.wheelspin}`);

  // 6. One-shot events, each alone.
  const events = [
    ['light', 1], ['green', 0], ['wall', 12], ['wall', 0.8], ['contact', 8, 1], ['crash', 14], ['puncture', 0], ['lap', 80, 1],
    ['finish', 1], ['overtake', 1], ['overtaken', 1], ['pitStart', 6], ['pitDone', 1], ['engine', 0], ['retire', 0], ['reset', 0],
    ['overheat', 0], ['ui:move', 0], ['ui:select', 0], ['ui:back', 0], ['ui:error', 0], ['ui:panel', 0],
  ];
  stats.events = {};
  for (const [type, value, other] of events) {
    const r = await eventLevel(type, value, other);
    for (const err of r.errors) errors.push(err);
    const name = type === 'wall' && value < 2 ? 'wall (scrape)' : type;
    stats.events[name] = round(r.after, 5);
    check(`event ${name}: makes a sound`, r.after > 0.0015 && r.before < 0.0002 && r.stats.nanRatio === 0 && r.stats.peak < 1, `rms ${round(r.after, 5)}, before ${round(r.before, 6)}, peak ${round(r.stats.peak, 3)}`);
  }
  // Events of other cars: audible when close, silent when far, never for private events.
  const near = await eventLevel('crash', 14, 'near');
  const far = await eventLevel('crash', 14, 'far', (app) => { app.race.cars[1].s = TRACK_LENGTH / 2 + 900; });
  const foreignLap = await eventLevel('lap', 80, 'near');
  stats.events.crashNearby = round(near.after, 5); stats.events.crashFar = round(far.after, 6); stats.events.lapOfOtherCar = round(foreignLap.after, 6);
  check('event crash of a nearby car: audible but quieter', near.after > 0.001 && near.after < stats.events.crash, `rms ${round(near.after, 5)} vs own ${stats.events.crash}`);
  check('event crash of a far car: silent', far.after < 0.0002, `rms ${round(far.after, 6)}`);
  check('event lap of another car: silent', foreignLap.after < 0.0002, `rms ${round(foreignLap.after, 6)}`);

  // 7. Opponent voices: distance, pan and Doppler shift. Car 1 goes by on the right at +30 m/s.
  const passApp = makeApp(2, [0]);
  racing(passApp.race.cars[0], 0, 0, 50).engineOut = true;
  passApp.race.cars[0].s = 1000;
  const pass = collect(await render(4, ENGINE_ONLY, passApp, (t) => {
    const other = racing(passApp.race.cars[1], 11000, 1, 80);
    other.s = 1000 + (t - 2) * 30; other.d = 4;
  }));
  stats.opponent = {
    rmsFar: round(level(pass, 0.2, 0.6), 5), rmsNear: round(level(pass, 1.8, 2.2), 5),
    leftNear: round(rmsOf(pass.left, 1.8, 2.2), 5), rightNear: round(rmsOf(pass.right, 1.8, 2.2), 5),
    pitchApproaching: round(peakFrequency(pass, 0.5, 1.5, 300, 3000), 0), pitchReceding: round(peakFrequency(pass, 2.5, 3.5, 300, 3000), 0),
  };
  const o = stats.opponent;
  check('opponent: louder when close', o.rmsNear > o.rmsFar * 2 && o.rmsFar > 0.0005, `far ${o.rmsFar} near ${o.rmsNear}`);
  check('opponent: panned to its side', o.rightNear > o.leftNear * 1.5, `L ${o.leftNear} R ${o.rightNear}`);
  check('opponent: Doppler shift (higher pitch approaching)', o.pitchApproaching > o.pitchReceding * 1.08, `${o.pitchApproaching} Hz -> ${o.pitchReceding} Hz`);
  clean('opponent pass', summary(pass));

  // Voice stealing: 9 cars shuffling around the listener, more than the pool can play.
  const packApp = makeApp(10, [0]);
  racing(packApp.race.cars[0], 9000, 0.6, 60).s = 2000;
  const pack = collect(await render(4, ENGINE_ONLY, packApp, (t) => {
    for (let i = 1; i < 10; i++) {
      const car = racing(packApp.race.cars[i], 8000 + 500 * i, 0.8, 60 + 12 * Math.cos(t * 1.3 + i));
      car.s = 2000 + 70 * Math.sin(t * (0.7 + 0.13 * i) + i * 2.1);
      car.d = ((i % 3) - 1) * 3.5;
    }
  }));
  // A steal must never produce a click: compare the largest sample step with the steady run.
  let jump = 0;
  for (let i = 1; i < pack.left.length; i++) jump = Math.max(jump, Math.abs(pack.left[i] - pack.left[i - 1]));
  stats.voiceStealing = { peak: round(summary(pack).peak), largestStep: round(jump) };
  clean('voice stealing', summary(pack));
  check('voice stealing: no click', jump < 0.25, `largest sample step ${round(jump)}`);

  // 8. Two listeners: player 1 on the left, player 2 on the right.
  const split = async (loudIndex) => {
    const app = makeApp(2, [0, 1]);
    racing(app.race.cars[loudIndex], 10000, 1);
    racing(app.race.cars[1 - loudIndex], 0, 0).engineOut = true;
    const result = collect(await render(1.4, ENGINE_ONLY, app));
    return { left: rmsOf(result.left, 0.5, 1.4), right: rmsOf(result.right, 0.5, 1.4) };
  };
  const p1 = await split(0), p2 = await split(1);
  stats.splitScreen = { player1: { left: round(p1.left), right: round(p1.right) }, player2: { left: round(p2.left), right: round(p2.right) } };
  check('split screen: player 1 leans left', p1.left > p1.right * 1.2 && p1.right > p1.left * 0.2, `L ${round(p1.left)} R ${round(p1.right)}`);
  check('split screen: player 2 leans right', p2.right > p2.left * 1.2 && p2.left > p2.right * 0.2, `L ${round(p2.left)} R ${round(p2.right)}`);

  // 9. Crowd.
  const crowdAt = async (s, step) => collect(await steady(AMBIENCE_ONLY, 3, (car) => { racing(car, 0, 0).engineOut = true; car.s = s; }, step));
  const crowdNear = await crowdAt(5), crowdFar = await crowdAt(TRACK_LENGTH * 0.2);
  let cheered = false;
  const cheer = await crowdAt(TRACK_LENGTH * 0.2, (t, dt, app, emit) => { if (t >= 1 && !cheered) { cheered = true; emit('green', -1, 0); } });
  stats.crowd = {
    nearStart: round(level(crowdNear, 1, 3), 5), farFromStart: round(level(crowdFar, 1, 3), 5),
    beforeCheer: round(level(cheer, 0.4, 1), 5), duringCheer: round(level(cheer, 1.3, 2.2), 5),
  };
  check('crowd: louder near the start/finish line', stats.crowd.nearStart > stats.crowd.farFromStart * 1.5 && stats.crowd.farFromStart > 0.0005, `near ${stats.crowd.nearStart} far ${stats.crowd.farFromStart}`);
  check('crowd: cheers on green', stats.crowd.duringCheer > stats.crowd.beforeCheer * 2, `${stats.crowd.beforeCheer} -> ${stats.crowd.duringCheer}`);
  clean('crowd', summary(crowdNear));

  // 10. Scenes, pause, suspend and settings.
  const control = collect(await steady(DEFAULTS, 6.2, (car) => { racing(car, 9000, 1, 60); car.s = 5; }, (t, dt, app, emit, audio) => {
    audio.setScene(t >= 1 && t < 2 ? 'menu' : 'race');
    app.paused = t >= 3 && t < 3.6;
    if (t >= 4.2 && t < 4.8) audio.suspend(); else if (t >= 4.8) audio.resume();
    if (t >= 5.3) audio.setSettings({ enabled: t >= 5.8 });
  }));
  stats.control = {
    race: round(level(control, 0.5, 1), 5), menu: round(level(control, 1.4, 2), 6), raceAgain: round(level(control, 2.5, 3), 5),
    paused: round(level(control, 3.3, 3.6), 6), unpaused: round(level(control, 3.9, 4.2), 5),
    suspended: round(level(control, 4.5, 4.8), 6), resumed: round(level(control, 5.05, 5.3), 5),
    disabled: round(level(control, 5.65, 5.8), 6), enabled: round(level(control, 6, 6.2), 5),
  };
  const k = stats.control;
  check('scene: silent in the menu, back in the race', k.menu < 0.0002 && k.raceAgain > k.race * 0.7, `race ${k.race} menu ${k.menu} race ${k.raceAgain}`);
  check('pause: silent while app.paused', k.paused < 0.0005 && k.unpaused > k.race * 0.7, `paused ${k.paused} then ${k.unpaused}`);
  check('suspend()/resume(): silent then back', k.suspended < 0.0005 && k.resumed > k.race * 0.7, `suspended ${k.suspended} then ${k.resumed}`);
  check('settings: enabled=false mutes', k.disabled < 0.0005 && k.enabled > k.race * 0.5, `disabled ${k.disabled} then ${k.enabled}`);
  const half = collect(await steady({ ...DEFAULTS, master: 0.4 }, 1.4, (car) => racing(car, 9000, 1, 60)));
  const full = collect(await steady(DEFAULTS, 1.4, (car) => racing(car, 9000, 1, 60)));
  stats.control.masterHalfRatio = round(level(half, 0.6, 1.4) / level(full, 0.6, 1.4), 3);
  check('settings: master volume scales the output', stats.control.masterHalfRatio > 0.15 && stats.control.masterHalfRatio < 0.6, `x${stats.control.masterHalfRatio} at half volume`);
  // Menu blips still play while the game is suspended.
  let blipped = false;
  const blip = collect(await steady(DEFAULTS, 1.2, (car) => racing(car, 9000, 1, 60), (t, dt, app, emit, audio) => {
    audio.suspend();
    if (t >= 0.6 && !blipped) { blipped = true; audio.uiSound('select'); }
  }));
  stats.control.uiWhileSuspended = round(level(blip, 0.6, 0.9), 5);
  check('ui: menu sounds play while suspended', stats.control.uiWhileSuspended > 0.002 && level(blip, 0.3, 0.6) < 0.0005, `rms ${stats.control.uiWhileSuspended}`);

  // 11. Real-time context: the lifecycle must not throw.
  stats.realtime = await realtimeSmoke(errors);
  check('real time: lifecycle runs without error', stats.realtime.ok, JSON.stringify(stats.realtime));

  check('no exception in update() / onEvent()', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  return { stats, checks, errors };
}

/** Exercise the public API on a real AudioContext (no measurement: there may be no audio device). */
async function realtimeSmoke(errors) {
  const report = { ok: false, states: [] };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    const audio = new GameAudio(DEFAULTS);
    audio.uiSound('move');          // before the first gesture: ignored
    audio.update(makeApp(), FRAME); // idem
    const first = await Promise.race([audio.resume(), wait(1500).then(() => 'timeout')]);
    await Promise.race([audio.resume(), wait(500)]);
    report.resume = first;
    report.states.push(audio.context ? audio.context.state : 'none');
    const app = makeApp(6, [0, 1]);
    app.race.cars.forEach((car, i) => { racing(car, 6000 + 900 * i, 0.7, 40 + i); car.s = 100 + i * 9; car.d = (i % 2) * 3; });
    const event = { type: '', car: 0, value: 0, other: -1 };
    const types = ['light', 'green', 'shift', 'wall', 'contact', 'crash', 'puncture', 'lap', 'finish', 'overtake', 'overtaken', 'pitStart', 'pitDone', 'engine', 'retire', 'reset', 'overheat', 'sector', 'raceEnd'];
    audio.setScene('race');
    for (let frame = 0; frame < 40; frame++) {
      event.type = types[frame % types.length]; event.car = frame % 6; event.value = 5; event.other = (frame + 1) % 6;
      audio.onEvent(event, app);
      app.viewTargets = frame < 20 ? [0, 1] : [2];
      audio.update(app, FRAME);
      await wait(8);
    }
    for (const name of ['move', 'select', 'back', 'error', 'panel', 'unknown']) audio.uiSound(name);
    audio.setSettings({ master: 0.5, engine: 1, effects: 0.3, ambience: 0 });
    audio.suspend();
    await wait(450);
    report.states.push(audio.context.state);
    audio.uiSound('select');
    await wait(100);
    await Promise.race([audio.resume(), wait(1000)]);
    report.states.push(audio.context.state);
    audio.setScene('menu');
    await wait(100);
    audio.setScene('results');
    audio.setScene('race');
    audio.update(app, FRAME);
    audio.setSettings({ enabled: false });
    audio.setSettings({ enabled: true });
    audio.dispose();
    audio.dispose();
    audio.update(app, FRAME);
    audio.onEvent(event, app);
    audio.uiSound('move');
    report.ok = true;
  } catch (error) {
    errors.push(`real time: ${error && error.stack ? error.stack : error}`);
  }
  return report;
}

/** 16-bit stereo WAV of a render, base64 encoded (for listening tests). */
function toWav(result) {
  const n = result.left.length;
  const bytes = new Uint8Array(44 + n * 4);
  const view = new DataView(bytes.buffer);
  const text = (offset, s) => { for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + n * 4, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, result.left[i])) * 32767, true);
    view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, result.right[i])) * 32767, true);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

window.runAudioCheck = runAudioCheck;
// Building blocks for ad-hoc experiments from the browser console or a Playwright script.
window.audioLab = { GameAudio, PlayerEngineVoice, OpponentEngineVoice, CarNoise, CrowdAmbience, createEngineWave, createNoiseBuffer, createControlBuffer, createPulseBuffer, makeDriveCurve, AUDIO_TUNING, render, steady, raceScenario, makeApp, racing, level, rmsOf, summary, spectrum, centroid, bandShare, peakFrequency, modulation, toWav, DEFAULTS, ENGINE_ONLY, EFFECTS_ONLY, AMBIENCE_ONLY };
