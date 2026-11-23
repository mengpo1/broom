// Fingerprint of the scenery of every circuit of the catalogue: for each one, the number of strips,
// props and solid boards and a SHA-256 of their complete description (ids, positions, sizes). Takes
// the source tree to load, so that two versions of the game can be compared:
//   node work/scripts/scenery-fingerprint.mjs [path/to/src] [classic]
// With `classic` the trackside objects added later are switched off (the option does not exist in
// older trees, where it is ignored). tests/fixtures/scenery-pr4.json is the output for the source of PR #4.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const src = resolve(process.argv[2] || 'src');
const load = (file) => import(pathToFileURL(`${src}/${file}`).href);
const { buildTrack } = await load('tracks/track-builder.js');
const { CIRCUITS } = await load('tracks/track-catalog.js');
const { buildSceneryLayout } = await load('tracks/scenery-layout.js');
if (process.argv[3] === 'classic') { try { (await load('tracks/trackside-objects.js')).configureTrackside({ scenery: 'classic' }); } catch { /* older tree: nothing to switch off */ } }

export function sceneryFingerprint(track, layout) {
  const hash = createHash('sha256');
  for (const s of layout.strips) hash.update(JSON.stringify([s.id, s.side, s.from, s.count, s.offset, s.absolute, s.base, s.height, s.tile, s.phase]));
  for (const p of layout.props) hash.update(JSON.stringify([p.id, p.s, p.d, p.sample, p.scale, p.flip, p.reach, p.solidHalfWidth, p.obstacle]));
  for (const o of layout.obstacles) hash.update(JSON.stringify([o.index, o.prop, o.s, o.d, o.halfWidth]));
  hash.update(JSON.stringify([...track.barrierL.slice(0, 400)].concat([...track.barrierR.slice(0, 400)])));
  return { strips: layout.strips.length, props: layout.props.length, obstacles: layout.obstacles.length, sha256: hash.digest('hex') };
}

const out = {};
for (const def of CIRCUITS) { const track = buildTrack(def); out[def.id] = sceneryFingerprint(track, buildSceneryLayout(track)); }
console.log(JSON.stringify(out, null, 1));
