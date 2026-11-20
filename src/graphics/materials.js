// Material identifiers shared by the procedural geometry builders and the mesh shader.
// The id travels in the alpha channel of the vertex colour.

export const MAT = {
  ASPHALT: 0, KERB: 1, VERGE: 2, GRAVEL: 3, CONCRETE: 4, ARMCO: 5, PAINT: 6, FOLIAGE: 7,
  CROWD: 8, FACADE: 9, TYRE_WALL: 10, ATLAS: 11, PIT_ASPHALT: 12, EMISSIVE: 13, TERRAIN: 14, WATER: 15,
  CAR_PAINT: 16, CARBON: 17, RUBBER: 18, METAL: 19, HELMET: 20, VISOR: 21, RIM: 22, NUMBER: 23,
  REV_LIGHTS: 24, FABRIC: 25, COCKPIT: 26, MIRROR: 27, BARK: 28, ROCK: 29, FENCE: 30, ROOF: 31,
};

/** WGSL constant declarations generated from MAT. */
export const MATERIAL_WGSL = Object.entries(MAT)
  .map(([name, id]) => `const MAT_${name} = ${id}u;`)
  .join('\n');

/** Atlas layout (uv rectangles) for the procedurally drawn sign texture, see procedural-textures.js. */
export const ATLAS = {
  size: 1024,
  digitWidth: 96 / 1024, digitHeight: 128 / 1024,
  // billboards: 2 columns x 4 rows of 512x128 starting at y = 128
  billboard: (index) => ({ u: (index % 2) * 0.5, v: 0.125 + Math.floor(index / 2) * 0.125, w: 0.5, h: 0.125 }),
  // distance boards 300/200/100: three 256x128 cells at y = 640
  board: (index) => ({ u: index * 0.25, v: 0.625, w: 0.25, h: 0.125 }),
  banner: { u: 0, v: 0.75, w: 1, h: 0.125 },
  checker: { u: 0, v: 0.875, w: 0.25, h: 0.125 },
  arrows: { u: 0.25, v: 0.875, w: 0.25, h: 0.125 },
  pitSign: { u: 0.5, v: 0.875, w: 0.25, h: 0.125 },
  flag: (index) => ({ u: 0.75 + (index % 2) * 0.125, v: 0.875, w: 0.125, h: 0.125 }),
};
