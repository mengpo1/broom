// A car that has retired. While it is still on the track (it slows down, stops, and stays there for a few seconds,
// drawn like any car) it is an obstacle. A computer car is then taken off the track: it is no longer drawn, no longer
// heard, no longer on the map, the other drivers no longer see it. From that moment it must not be in the way either.
// (Found by the independent review of PR #8: it stayed solid, an invisible obstacle, for the rest of the race.)
// Not to be confused with a wreck, the car stopped on the track after a hard landing until it restarts: it is drawn,
// and cannot be hit (accidents.test.mjs: "a wrecked or flying car cannot be hit"). That is unchanged here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { field, hold, SIM_DT, CAR_STATE, KMH, bodyOverlap } from './flight-helpers.mjs';

const track = buildTrack(getCircuit('kestrel-fields'));

/** A car breaks down at 100 km/h in the middle of the road; returns the field once it has stopped, and for how long it has been stopped. */
function brokenDown({ human }) {
  const f = field(track, 2);
  const [x, r] = f.cars;
  f.put(r, 150, 0, 100, null); r.isHuman = human; r.engineOut = true;
  f.put(x, -400, 5, 0, null);                                           // the other car waits out of the way
  let stoppedFor = 0;
  f.runUntil = (seconds) => { for (let i = 0; i < seconds / SIM_DT; i++) { f.tick(); if (r.state === CAR_STATE.RETIRED && Math.abs(r.speed) < 0.5) stoppedFor += SIM_DT; } return stoppedFor; };
  return { f, x, r, stopped: () => stoppedFor };
}
/** The other car is sent at 150 km/h along the line where the retired car stands; returns what happened to it. */
function driveOnto(f, x, r) {
  f.put(x, f.along(r) - 70, f.across(r), 150, hold(150, r.d));
  const from = f.events.length, d0 = x.d;
  let over = 0, slowest = Infinity, off = 0;
  for (let i = 0; i < 3 / SIM_DT; i++) { f.tick(); over = Math.max(over, bodyOverlap(x, r)); slowest = Math.min(slowest, x.speed * KMH); off = Math.max(off, Math.abs(x.d - d0)); }
  return { over, slowest, off, events: f.events.slice(from).filter((e) => e.car === x.index || e.car === r.index).map((e) => e.type), passed: f.along(x) > f.along(r) + 10 };
}

test('a retired computer car still on the track is an obstacle; once it has been taken off the track it is not', (t) => {
  // still there: stopped for a second, drawn, in the way
  {
    const { f, x, r, stopped } = brokenDown({ human: false });
    while (stopped() < 1) f.runUntil(0.25);
    assert.equal(r.state, CAR_STATE.RETIRED); assert.equal(r.removed, false, 'still on the track a second after it stopped');
    const out = driveOnto(f, x, r);
    assert.ok(out.events.includes('contact'), `the car that arrives hits it (${out.events.join(' ') || 'nothing happened'})`);
    assert.ok(out.slowest < 140, `and is slowed (${out.slowest.toFixed(0)} km/h at the lowest)`);
    t.diagnostic(`stopped for 1 s, still on the track: ${out.events.join(' ')}; the car that arrives slowed to ${out.slowest.toFixed(0)} km/h`);
  }
  // taken off the track (three seconds after it stopped): nothing is there any more
  {
    const { f, x, r, stopped } = brokenDown({ human: false });
    while (stopped() < 3.5) f.runUntil(0.25);
    assert.equal(r.removed, true, 'taken off the track three seconds after it stopped');
    const out = driveOnto(f, x, r);
    assert.ok(out.passed && out.over > 1, `the car drives over the place where it stood (${out.over.toFixed(2)} m of overlap with where it was)`);
    assert.deepEqual(out.events.filter((e) => ['contact', 'bump', 'wheel', 'crash', 'launch', 'hop'].includes(e)), [], 'without any contact');
    assert.ok(out.slowest > 148 && out.off < 0.05, `without being slowed (${out.slowest.toFixed(1)} km/h at the lowest) or pushed aside (${out.off.toFixed(3)} m)`);
    t.diagnostic(`taken off the track: the car that arrives keeps ${out.slowest.toFixed(1)} km/h and its line; no event`);
  }
});

test('a retired player car is never taken off the track: it stays where it stopped, drawn, and in the way', () => {
  const { f, x, r, stopped } = brokenDown({ human: true });
  while (stopped() < 8) f.runUntil(0.25);
  assert.equal(r.removed, false); assert.equal(r.state, CAR_STATE.RETIRED);
  const out = driveOnto(f, x, r);
  assert.ok(out.events.includes('contact') && out.slowest < 140, `still an obstacle eight seconds after it stopped (${out.events.join(' ')}; ${out.slowest.toFixed(0)} km/h)`);
});
