// 2D road projection: perspective, curves, elevation, continuity, resizing, point projection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { getCircuit } from '../../src/tracks/track-catalog.js';
import { createProjection, updateProjection, projectPoint, projectAtDepth, rowDepth, focalForFov, depthOf, ROW_FLOATS } from '../../src/rendering/projection/road-projection.js';

const track = buildTrack(getCircuit('hazelbrook'));
const hilly = buildTrack(getCircuit('roca-alta'));
const cam = (over = {}) => ({ s: 100, d: 0, eyeHeight: 0.95, yaw: 0, dir: 1, width: 1280, height: 720, focal: focalForFov(1280, 1.25), cx: 640, cy: 310, drawDistance: 1300, ...over });
const straightS = (t) => { for (let i = 0; i < t.n; i++) { let ok = true; for (let k = 0; k < 120; k++) if (Math.abs(t.kappa[(i + k) % t.n]) > 1e-4) { ok = false; break; } if (ok) return i * t.ds + 5; } return 0; };
const cornerS = (t, sign) => { for (let i = 0; i < t.n; i++) if (Math.sign(t.kappa[i]) === sign && Math.abs(t.kappa[i]) > 1 / 120 && Math.abs(t.kappa[(i + t.n - 30) % t.n]) < 1 / 400) return ((i - 20 + t.n) % t.n) * t.ds; throw new Error('no corner'); };

test('rows are filled from the bottom of the view up to the horizon without holes', () => {
  const p = createProjection();
  updateProjection(p, track, cam({ s: straightS(track) }));
  assert.ok(p.topRow > 0 && p.topRow < 400, `topRow ${p.topRow}`);
  for (let r = p.topRow; r < p.height; r++) assert.ok(rowDepth(p, r) > 0, `row ${r} empty`);
  for (let r = 0; r < p.topRow; r++) assert.equal(rowDepth(p, r), 0);
});

test('perspective: depth grows monotonically toward the horizon and scale shrinks', () => {
  const p = createProjection();
  updateProjection(p, track, cam({ s: straightS(track) }));
  for (let r = p.topRow; r < p.height - 1; r++) {
    assert.ok(p.rows[r * ROW_FLOATS] >= p.rows[(r + 1) * ROW_FLOATS] - 1e-3, `depth order at row ${r}`);
    assert.ok(p.rows[r * ROW_FLOATS + 2] <= p.rows[(r + 1) * ROW_FLOATS + 2] + 1e-3, `scale order at row ${r}`);
  }
  // an object twice as far is drawn half as large
  const a = {}, b = {};
  projectAtDepth(p, 20, 0, 0, a); projectAtDepth(p, 40, 0, 0, b);
  assert.ok(Math.abs(a.scale / b.scale - 2) < 1e-6);
});

test('straight road is centred; a right-hand corner bends the road to the right, a left-hand one to the left', () => {
  const p = createProjection();
  updateProjection(p, track, cam({ s: straightS(track) }));
  for (let r = p.topRow + 5; r < p.height; r += 20) assert.ok(Math.abs(p.rows[r * ROW_FLOATS + 1] - 640) < 3, `centre at row ${r}`);
  updateProjection(p, track, cam({ s: cornerS(track, 1) }));
  assert.ok(p.rows[(p.topRow + 4) * ROW_FLOATS + 1] > 700, 'right corner shifts the far road right');
  const left = buildTrack(getCircuit('porto-sereno'));
  updateProjection(p, left, cam({ s: cornerS(left, -1) }));
  assert.ok(p.rows[(p.topRow + 4) * ROW_FLOATS + 1] < 580, 'left corner shifts the far road left');
});

test('road centre line is continuous from row to row (no visual breaks) on every circuit sample', () => {
  const p = createProjection();
  for (const t of [track, hilly]) {
    for (let s = 0; s < t.length; s += 37) {
      updateProjection(p, t, cam({ s, d: 2 }));
      for (let r = p.topRow + 1; r < p.height - 1; r++) {
        const z0 = p.rows[r * ROW_FLOATS], z1 = p.rows[(r + 1) * ROW_FLOATS];
        // lateral position of the centre line in metres at both rows
        const x0 = (p.rows[r * ROW_FLOATS + 1] - p.cx) / p.rows[r * ROW_FLOATS + 2], x1 = (p.rows[(r + 1) * ROW_FLOATS + 1] - p.cx) / p.rows[(r + 1) * ROW_FLOATS + 2];
        assert.ok(Number.isFinite(x0) && Number.isFinite(z0));
        // the road cannot move sideways faster than its direction allows (bend angle is bounded)
        assert.ok(Math.abs(x0 - x1) <= (z0 - z1) * 3.3 + 0.05, `break of ${(x0 - x1).toFixed(2)} m over ${(z0 - z1).toFixed(2)} m at s=${s} row=${r}`);
      }
    }
  }
});

test('elevation: climbing road rises on screen, crests hide what lies behind them', () => {
  const p = createProjection();
  let minTop = 1e9, maxTop = -1e9, crest = false;
  for (let s = 0; s < hilly.length; s += 25) {
    updateProjection(p, hilly, cam({ s }));
    minTop = Math.min(minTop, p.topRow); maxTop = Math.max(maxTop, p.topRow);
    for (let r = p.topRow; r < p.height - 1; r++) if (p.rows[r * ROW_FLOATS] > p.rows[(r + 1) * ROW_FLOATS] * 1.3 + 6) crest = true;
  }
  assert.ok(maxTop - minTop > 25, `horizon row should move with the relief (${minTop}..${maxTop})`);
  assert.ok(crest, 'a crest (depth jump between two rows) is expected on a hilly circuit');
});

test('projected points agree with the row table and place opponents correctly', () => {
  const p = createProjection();
  const s0 = straightS(track);
  updateProjection(p, track, cam({ s: s0 }));
  const out = {};
  assert.ok(projectPoint(p, s0 + 30, 0, 0, out));
  const row = Math.round(out.y - 0.5);
  assert.ok(Math.abs(rowDepth(p, row) - 30) < 0.6, `row depth ${rowDepth(p, row)}`);
  assert.ok(Math.abs(out.x - 640) < 2);
  const right = {}, left = {}, near = {}, far = {};
  projectPoint(p, s0 + 30, 3, 0, right); projectPoint(p, s0 + 30, -3, 0, left);
  assert.ok(right.x > out.x && left.x < out.x, 'a car on the right of the track is drawn on the right');
  projectPoint(p, s0 + 15, 0, 0, near); projectPoint(p, s0 + 60, 0, 0, far);
  assert.ok(near.y > out.y && far.y < out.y, 'nearer cars are lower on screen');
  assert.equal(projectPoint(p, s0 - 10, 0, 0, out), false, 'a car behind the viewer is not projected');
  assert.ok(Math.abs(depthOf(p, s0 + track.length - 5) + 5) < 1e-3, 'depth wraps around the lap');
});

test('rear view mirrors lateral positions', () => {
  const p = createProjection();
  const s0 = straightS(track) + 100;
  updateProjection(p, track, cam({ s: s0, dir: -1 }));
  const out = {};
  assert.ok(projectPoint(p, s0 - 30, 3, 0, out));
  assert.ok(out.x < 640, 'looking backwards, the right side of the track is on the left of the picture');
});

test('resizing the view scales the picture without changing its content', () => {
  const a = createProjection(), b = createProjection();
  const s = cornerS(track, 1);
  updateProjection(a, track, cam({ s, d: 1.5 }));
  updateProjection(b, track, cam({ s, d: 1.5, width: 2560, height: 1440, focal: focalForFov(2560, 1.25), cx: 1280, cy: 620 }));
  assert.ok(Math.abs(b.topRow - a.topRow * 2) <= 2);
  for (const z of [5, 20, 80, 300]) {
    const pa = {}, pb = {};
    projectAtDepth(a, z, 4, 1, pa); projectAtDepth(b, z, 4, 1, pb);
    assert.ok(Math.abs(pb.x - pa.x * 2) < 1e-2 && Math.abs(pb.y - pa.y * 2) < 1e-2 && Math.abs(pb.scale - pa.scale * 2) < 1e-4);
  }
});

test('camera yaw slides the road sideways proportionally to depth', () => {
  const p = createProjection();
  const s = straightS(track);
  updateProjection(p, track, cam({ s, yaw: 0.1 }));
  const near = {}, far = {};
  projectAtDepth(p, 10, 0, 0, near); projectAtDepth(p, 100, 0, 0, far);
  assert.ok(near.x < 640 && Math.abs(near.x - far.x) < 1, 'pure yaw shifts every depth by the same screen offset');
});
