// Catalogue of scenery drawings: logical id -> pixel size of the drawing and its size in the
// world (metres). `kind` is 'prop' (upright drawing anchored bottom-centre on the ground) or
// 'strip' (tile repeated along the road; `tile` = track samples covered by one tile).
// `family` entries are expanded into numbered variants (`id.0`, `id.1`, ...).

export const SCENERY_SPECS = [
  // ---- vegetation and natural objects
  { id: 'tree.broadleaf', variants: 3, kind: 'prop', w: 352, h: 432, worldW: 9, worldH: 11 },
  { id: 'tree.pine', variants: 2, kind: 'prop', w: 224, h: 480, worldW: 6, worldH: 13 },
  { id: 'tree.palm', variants: 2, kind: 'prop', w: 288, h: 448, worldW: 6.5, worldH: 10 },
  { id: 'tree.cypress', variants: 1, kind: 'prop', w: 128, h: 448, worldW: 3, worldH: 11 },
  { id: 'bush', variants: 2, kind: 'prop', w: 256, h: 160, worldW: 3.6, worldH: 2.2 },
  { id: 'rock', variants: 2, kind: 'prop', w: 256, h: 168, worldW: 4, worldH: 2.6 },
  // ---- track furniture
  { id: 'sign.brake.300', kind: 'prop', w: 144, h: 160, worldW: 1.7, worldH: 1.9 },
  { id: 'sign.brake.200', kind: 'prop', w: 144, h: 160, worldW: 1.7, worldH: 1.9 },
  { id: 'sign.brake.100', kind: 'prop', w: 144, h: 160, worldW: 1.7, worldH: 1.9 },
  { id: 'post.marshal', kind: 'prop', w: 256, h: 256, worldW: 3.4, worldH: 3.4 },
  { id: 'pole.flag', variants: 3, kind: 'prop', w: 128, h: 464, worldW: 2.2, worldH: 8 },
  { id: 'tower.light', kind: 'prop', w: 96, h: 576, worldW: 3, worldH: 18 },
  { id: 'tower.tv', kind: 'prop', w: 208, h: 464, worldW: 3.4, worldH: 7.5 },
  { id: 'gantry.start', kind: 'prop', w: 1408, h: 500, worldW: 24, worldH: 8.5 },
  { id: 'bridge', variants: 2, kind: 'prop', w: 1440, h: 432, worldW: 30, worldH: 9 },
  { id: 'crowd.group', variants: 2, kind: 'prop', w: 384, h: 128, worldW: 6, worldH: 2 },
  // ---- buildings (only those named by the circuit theme are drawn)
  { id: 'building.villa', variants: 2, kind: 'prop', w: 448, h: 256, worldW: 14, worldH: 8 },
  { id: 'building.chalet', variants: 2, kind: 'prop', w: 384, h: 256, worldW: 12, worldH: 8 },
  { id: 'building.tent', variants: 2, kind: 'prop', w: 384, h: 192, worldW: 12, worldH: 6 },
  { id: 'building.hangar', variants: 1, kind: 'prop', w: 640, h: 192, worldW: 30, worldH: 9 },
  { id: 'building.city', variants: 3, kind: 'prop', w: 384, h: 448, worldW: 22, worldH: 26 },
  { id: 'building.crane', variants: 1, kind: 'prop', w: 320, h: 544, worldW: 20, worldH: 34 },
  { id: 'building.container', variants: 2, kind: 'prop', w: 416, h: 176, worldW: 13, worldH: 5.5 },
  { id: 'building.warehouse', variants: 1, kind: 'prop', w: 640, h: 216, worldW: 30, worldH: 10 },
  // ---- strips along the road
  { id: 'strip.armco', kind: 'strip', w: 512, h: 104, tile: 2, worldH: 1.0 },
  { id: 'strip.concrete', kind: 'strip', w: 512, h: 104, tile: 2, worldH: 1.0 },
  { id: 'strip.tyres', kind: 'strip', w: 512, h: 120, tile: 2, worldH: 1.15 },
  { id: 'strip.fence', kind: 'strip', w: 384, h: 264, tile: 2, worldH: 3.4 },
  { id: 'strip.pitwall', kind: 'strip', w: 640, h: 160, tile: 4, worldH: 2.5 },
  { id: 'strip.pitbuilding', kind: 'strip', w: 768, h: 552, tile: 5, worldH: 9 },
  { id: 'strip.grandstand', kind: 'strip', w: 1024, h: 564, tile: 8, worldH: 11 },
  { id: 'strip.crowdbank', kind: 'strip', w: 1024, h: 216, tile: 8, worldH: 4.2 },
  { id: 'strip.hoarding', variants: 4, kind: 'strip', w: 768, h: 96, tile: 4, worldH: 1.25 },
  { id: 'strip.forest', kind: 'strip', w: 768, h: 576, tile: 8, worldH: 15 },
  { id: 'strip.cliff', kind: 'strip', w: 640, h: 576, tile: 8, worldH: 18 },
  { id: 'strip.facade', kind: 'strip', w: 768, h: 576, tile: 8, worldH: 15 },
];

/** Expand families into individual entries: [{ id, family, variant, ...spec }]. */
export function expandScenerySpecs() {
  const out = [];
  for (const spec of SCENERY_SPECS) {
    if (spec.variants) for (let v = 0; v < spec.variants; v++) out.push({ ...spec, id: `${spec.id}.${v}`, family: spec.id, variant: v });
    else out.push({ ...spec, family: spec.id, variant: 0 });
  }
  return out;
}
