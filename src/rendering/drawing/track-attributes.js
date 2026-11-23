// Per-sample track attributes uploaded once per circuit for the ground shader:
//   [kerbL, kerbR, barrierL, barrierR] [vergeL, vergeR, racing line offset, cover]
// cover: shade over the road from what spans it (tracks/trackside-objects.js): 1 inside a tunnel, less
// under a bridge or a gantry, 0 elsewhere and everywhere when those objects are not placed.

export function buildTrackAttributes(track, capacity) {
  if (track.n > capacity) throw new Error(`Track has ${track.n} samples, renderer supports ${capacity}`);
  const data = new Float32Array(capacity * 8);
  const cover = track.sceneryLayout && track.sceneryLayout.trackside ? track.sceneryLayout.trackside.cover : null;
  for (let i = 0; i < track.n; i++) {
    const o = i * 8;
    data[o] = track.kerbL[i]; data[o + 1] = track.kerbR[i];
    data[o + 2] = track.barrierL[i]; data[o + 3] = track.barrierR[i];
    data[o + 4] = track.vergeL[i]; data[o + 5] = track.vergeR[i];
    data[o + 6] = track.line ? track.line[i] : 0; data[o + 7] = cover ? cover[i] : 0;
  }
  return data;
}
