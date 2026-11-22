// Telemetry of a case of the collision test bench, without pictures: the bench keeps driving after
// the event, the simulation is stepped at 120 Hz and one line is printed every tenth of a second.
// node work/scripts/lab-trace.mjs [hop|wheel|crash|board|bump] [seconds]
import { openGame } from './lib-browser.mjs';

const name = process.argv[2] || 'hop', seconds = +(process.argv[3] || 8);
const { page, logs, close } = await openGame({ width: 640, height: 360, hash: 'manual=1&quality=low' });
const rows = await page.evaluate(([name, seconds]) => {
  const { app, createLab, debug } = window.virage;
  window.virage.input.enabled = false;
  const lab = createLab();
  lab.start(name, { handOver: false });
  const me = lab.me, lead = lab.lead, out = [], L = lab.race.track.length;
  const gapTo = (car) => ((car.s - me.s + L * 1.5) % L) - L / 2;          // metres along the road, centre to centre
  for (let i = 0; i < seconds * 120; i++) {
    app.simulate();
    const events = lab.events.splice(0);
    if (i % 12 === 11 || events.length) out.push({ t: +((i + 1) / 120).toFixed(3), speed: +(me.speed * 3.6).toFixed(1), other: lead ? +(lead.speed * 3.6).toFixed(1) : null,
      state: me.state, d: +me.d.toFixed(2), gap: lead ? +gapTo(lead).toFixed(2) : null, asked: +me.inSteer.toFixed(3),
      disturbance: +debug.hopSteerKick(me).toFixed(3), heading: +(me.headingError * 57.2958).toFixed(2), air: +(me.airHeight || 0).toFixed(2), events: events.map((e) => `${e.type}(${e.car}:${e.value})`).join(' ') });
  }
  return out;
}, [name, seconds]);
for (const r of rows) console.log(`${r.t.toFixed(2).padStart(5)} s  ${String(r.speed).padStart(5)} km/h  other ${r.other}  state ${r.state}  d ${String(r.d).padStart(6)}  gap ${r.gap}  asked ${String(r.asked).padStart(6)}  disturbance ${String(r.disturbance).padStart(6)}  heading ${String(r.heading).padStart(6)}  air ${r.air}  ${r.events}`);
const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (errors.length) console.log('ERRORS\n' + errors.slice(0, 10).join('\n'));
await close();
