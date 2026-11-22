// Stills of the recoverable hop, taken from the recorded sequences (HOP.mp4: cockpit; HOPx.mp4: from
// behind) at instants chosen from their telemetry: the image of the shock, the top of the flight,
// the image where the wheels touch down, and so on. Nothing is rendered again here.
// node work/scripts/hop-stills.mjs [dir]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { root } from './lib-browser.mjs';

const dir = `${root}/${process.argv[2] || 'work/renders/collisions'}`;
mkdirSync(`${dir}/stills`, { recursive: true });
for (const name of ['HOP', 'HOPx']) {
  const frames = JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8')).frames;
  const launch = frames.findIndex((f) => f.events.some((e) => e.type === 'hop'));
  const landing = frames.findIndex((f) => f.events.some((e) => e.type === 'landing'));
  if (launch < 0 || landing < 0) throw new Error(`${name}: no hop in the telemetry`);
  const peak = frames.reduce((best, f, i) => (f.airHeight > frames[best].airHeight ? i : best), 0);
  const swing = frames.findIndex((f, i) => i > landing && Math.abs(f.steerDisturbance) > 0.2);
  // the car is pulling out when it is halfway between the line it landed on and the one it ends on
  const dEnd = frames.at(-1).d, dLand = frames[landing].d;
  const out = frames.findIndex((f, i) => i > landing + 30 && Math.abs(f.d - dLand) > Math.abs(dEnd - dLand) / 2);
  const picks = name === 'HOP'
    ? [['1-before-contact', launch - 6], ['2-star-on-the-wheel', launch + 1], ['3-in-the-air', peak], ['4-landing-on-its-wheels', landing + 1],
      ['5-steering-swings', swing], ['6-pulling-out', out], ['7-race-goes-on', Math.min(frames.length - 1, out + 60)], ['8-line-steady', frames.length - 20]]
    : [['1-before-contact', launch - 6], ['2-contact', launch + 1], ['3-in-the-air-shadow-on-the-road', peak], ['4-landing-behind', landing + 1],
      ['5-steering-swings', swing], ['6-race-goes-on', frames.length - 10]];
  for (const [label, index] of picks) {
    if (index < 0 || index >= frames.length) throw new Error(`${name}-${label}: instant not found`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}/${name}.mp4`, '-vf', `select='eq(n\\,${index})'`, '-frames:v', '1', '-q:v', '2', `${dir}/stills/${name}-${label}.jpg`]);
    const f = frames[index];
    console.log(`${name}-${label}: image ${index} (${f.t.toFixed(2)} s), ${f.speed} km/h, d ${f.d} m, height ${f.airHeight} m`);
  }
}
