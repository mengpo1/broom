// Stills of the flights caused by a car, taken from the recorded sequences (HOP.mp4 and E3.mp4: cockpit;
// HOPx.mp4 and E3x.mp4: from behind) at instants chosen from their telemetry: the image of the shock, the
// top of the flight, the image where the wheels touch down, and so on. Nothing is rendered again here.
// (Lot 5: the car now flies over the car that threw it up and lands ahead of it; the stills of the previous
// rule, named "...-behind", are removed.)
// node work/scripts/hop-stills.mjs [dir]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { root } from './lib-browser.mjs';

const dir = `${root}/${process.argv[2] || 'work/renders/collisions'}`;
mkdirSync(`${dir}/stills`, { recursive: true });
for (const file of readdirSync(`${dir}/stills`)) if (/^(HOPx?|E3x?)-/.test(file)) rmSync(`${dir}/stills/${file}`);
for (const name of ['HOP', 'HOPx', 'E3', 'E3x']) {
  const frames = JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8')).frames;
  const at = (type) => frames.findIndex((f) => f.events.some((e) => e.type === type));
  const launch = at('launch'), landing = at('landing'), restart = at('restart');
  if (launch < 0 || landing < 0) throw new Error(`${name}: no flight in the telemetry`);
  const peak = frames.reduce((best, f, i) => (f.airHeight > frames[best].airHeight ? i : best), 0);
  const swing = frames.findIndex((f, i) => i > landing && Math.abs(f.steerDisturbance) > 0.2);
  // the image where the car in flight is level with the car it flies over (centre to centre)
  const over = frames.findIndex((f, i) => i > launch && f.gapToOther !== null && f.gapToOther <= 0);
  const s = (seconds) => Math.round(seconds * 60);
  const picks = {
    HOP: [['1-before-contact', launch - 6], ['2-star-on-the-wheel', launch + 1], ['3-in-the-air', peak], ['4-landing-on-its-wheels-ahead', landing + 1],
      ['5-steering-swings', swing], ['6-race-goes-on-other-car-in-the-mirror', landing + s(1.2)]],
    HOPx: [['1-before-contact', launch - 6], ['2-wheel-on-wheel', launch + 1], ['3-level-with-the-other-car', over], ['4-top-of-the-flight', peak],
      ['5-landing-ahead', landing + 1], ['6-steering-swings', swing], ['7-race-goes-on', landing + s(1.5)]],
    E3: [['1-before-contact', launch - 6], ['2-star-on-the-wheel-that-rides-up', launch + 1], ['3-nose-up', launch + s(0.3)], ['4-nose-down', landing - 4],
      ['5-explosion-growing', landing + s(0.3)], ['6-explosion-full', landing + s(0.7)], ['7-plumes', landing + s(1.4)], ['8-stopped', landing + s(2.6)], ['9-restart', restart + s(0.3)]],
    E3x: [['1-before-contact', launch - 6], ['2-contact', launch + 1], ['3-riding-over-shadow-on-the-road', launch + s(0.2)], ['4-over-the-other-car', over],
      ['5-landing-ahead-to-the-side', landing + 1], ['6-other-car-passes-beside-the-wreck', landing + s(0.15)], ['7-explosion', landing + s(0.6)]],
  }[name];
  for (const [label, index] of picks) {
    if (!(index >= 0 && index < frames.length)) throw new Error(`${name}-${label}: instant not found`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}/${name}.mp4`, '-vf', `select='eq(n\\,${index})'`, '-frames:v', '1', '-q:v', '2', `${dir}/stills/${name}-${label}.jpg`]);
    const f = frames[index];
    console.log(`${name}-${label}: image ${index} (${f.t.toFixed(2)} s), ${f.speed} km/h, d ${f.d} m, height ${f.airHeight} m, other car ${f.gapToOther} m ahead`);
  }
}
