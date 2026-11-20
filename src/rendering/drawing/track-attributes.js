// Per-sample track attributes uploaded once per circuit for the ground shader:
//   [kerbL, kerbR, barrierL, barrierR] [vergeL, vergeR, racing line offset, 0]

export function buildTrackAttributes(track, capacity) {
  if (track.n > capacity) throw new Error(`Track has ${track.n} samples, renderer supports ${capacity}`);
  const data = new Float32Array(capacity * 8);
  for (let i = 0; i < track.n; i++) {
    const o = i * 8;
    data[o] = track.kerbL[i]; data[o + 1] = track.kerbR[i];
    data[o + 2] = track.barrierL[i]; data[o + 3] = track.barrierR[i];
    data[o + 4] = track.vergeL[i]; data[o + 5] = track.vergeR[i];
    data[o + 6] = track.line ? track.line[i] : 0; data[o + 7] = 0;
  }
  return data;
}
