// Crowd ambience: a bed of formant-filtered noise with slow random swells, louder next to the
// grandstands (start/finish straight first), and cheer bursts on race events.

import { lerp, saturate } from '../core/math.js';
import { Random } from '../core/random.js';
import { AUDIO_TUNING } from './audio-tuning.js';
import { SmoothParam, createNoiseSource, releaseNodes } from './noise.js';

const C = AUDIO_TUNING.crowd;

export class CrowdAmbience {
  /** @param res shared resources: { white, pink } noise buffers */
  constructor(context, res, destination) {
    this.context = context;
    this.sources = [];
    this.nodes = [];
    this.rng = new Random(0xc0de);
    this.swell = 0;
    this.swellTarget = 0;
    this.swellTimer = 0;
    const keep = (node) => { this.nodes.push(node); return node; };
    const run = (node) => { this.sources.push(node); this.nodes.push(node); return node; };
    const filter = (type, frequency, q) => {
      const node = keep(context.createBiquadFilter());
      node.type = type; node.frequency.value = frequency; node.Q.value = q;
      return node;
    };
    const gain = (value) => { const node = keep(context.createGain()); node.gain.value = value; return node; };

    // Two decorrelated voices bands, left and right, each modulated by its own slow noise.
    const band = (offset, frequency, q, pan, level) => {
      const source = run(createNoiseSource(context, res.pink, 1, offset));
      const formant = filter('bandpass', frequency, q);
      const amp = gain(level);
      const texture = run(createNoiseSource(context, res.white, C.textureRate * (1 + offset), offset + 0.31));
      const depth = gain(level * C.texture * 2.3);
      const panner = keep(context.createStereoPanner());
      panner.pan.value = pan;
      source.connect(formant); formant.connect(amp); amp.connect(panner);
      texture.connect(depth); depth.connect(amp.gain);
      return panner;
    };
    const left = band(0.11, C.lowFrequency, 0.7, -0.6, 1);
    const right = band(0.57, C.midFrequency, 0.8, 0.6, 0.8);
    const high = band(0.83, C.highFrequency, 1.1, 0, 0.9); // shouts and whistles, cheers only

    const bed = gain(0);
    const cheer = gain(0);
    const output = gain(1);
    left.connect(bed); right.connect(bed);
    left.connect(cheer); right.connect(cheer); high.connect(cheer);
    bed.connect(output); cheer.connect(output);
    output.connect(destination);
    this.bed = new SmoothParam(bed.gain, C.tau, 0);
    this.cheerGain = cheer.gain;
    this.output = output;
  }

  /**
   * @param proximity  0..1 closeness of the listeners to a grandstand
   * @param excitement extra level factor (countdown...)
   */
  update(proximity, excitement, time, dt) {
    this.swellTimer -= dt;
    if (this.swellTimer <= 0) {
      this.swellTimer = lerp(C.swellMin, C.swellMax, this.rng.next());
      this.swellTarget = this.rng.next() * 2 - 1;
    }
    this.swell += (this.swellTarget - this.swell) * saturate(dt * C.swellRate);
    const level = (C.level + C.nearLevel * proximity) * (1 + C.swell * this.swell) * excitement;
    this.bed.set(level, time);
  }

  /** Steady bed when nothing calls update (results screen). */
  hold(level, time) { this.bed.set(level, time); }

  /** Cheer burst. `amount` 0..1. */
  cheer(amount, time) {
    const gain = this.cheerGain;
    gain.cancelScheduledValues(time);
    gain.setTargetAtTime(amount * 1.6, time, C.cheerAttack);
    gain.setTargetAtTime(0, time + C.cheerHold * (0.6 + 0.4 * amount), C.cheerRelease);
  }

  dispose() { releaseNodes(this.sources, this.nodes); }
}
