// Visual themes for circuits: lighting, sky, ground palette and scenery recipe. Pure data.
// Colours are linear RGB. Sun azimuth is measured in the XZ plane, elevation above the horizon.

const BASE = {
  sunAzimuth: 2.3, sunElevation: 0.82, sunColor: [10.5, 9.8, 8.6], exposure: 0.5,
  zenith: [0.15, 0.34, 0.82], horizon: [0.72, 0.86, 1.04], cloudCoverage: 0.42, cloudScale: 0.45,
  fogDensity: 0.00016, fogFalloff: 0.004, fogColor: [0.66, 0.78, 0.94],
  skyAmbient: 1.15, groundAmbient: 0.55, bloom: 0.5,
  grass: [0.045, 0.105, 0.022], grass2: [0.085, 0.135, 0.03], gravel: [0.42, 0.36, 0.25],
  groundAlbedo: [0.1, 0.13, 0.06], kerb: [0.75, 0.035, 0.03],
  terrainAmplitude: 14, terrainScale: 0.0021, terrainLow: [0.05, 0.1, 0.028], terrainHigh: [0.1, 0.13, 0.045],
  terrainRock: [0.3, 0.28, 0.25], rockSlope: 0.5,
  backdropHeight: 170, backdropColor: [0.1, 0.17, 0.08], backdropFar: [0.2, 0.25, 0.22],
  trees: [['broadleaf', 0.65], ['pine', 0.35]], treeDensity: 1, fieldDensity: 0.5,
  foliage: [0.05, 0.11, 0.022], foliage2: [0.1, 0.17, 0.035], pineColor: [0.028, 0.075, 0.035],
  rocks: 0.05, rockColor: [0.32, 0.3, 0.27],
  barrier: 'armco', wall: [0.62, 0.62, 0.6], buildings: 'none', buildingColor: [0.7, 0.68, 0.64],
  water: null, snowLine: 1e9, crowd: 1,
};

// Vegetation colours given in theme overrides are authored brighter than physically plausible
// albedo; they are scaled once here so every green surface sits in a consistent range.
const GREEN_KEYS = ['grass', 'grass2', 'terrainLow', 'terrainHigh', 'foliage', 'foliage2', 'backdropColor'];
function theme(overrides) {
  const t = { ...BASE, ...overrides };
  for (const key of GREEN_KEYS) {
    const c = overrides[key];
    if (c && c[1] > c[0] * 1.12) t[key] = c.map((v) => v * 0.6);
  }
  return t;
}

export const THEMES = {
  forest: theme({}),
  taiga: theme({
    sunAzimuth: 0.9, sunElevation: 0.5, sunColor: [10, 9, 7.6], zenith: [0.14, 0.3, 0.72], horizon: [0.78, 0.86, 0.98],
    cloudCoverage: 0.5, grass: [0.07, 0.13, 0.045], grass2: [0.11, 0.15, 0.06], trees: [['pine', 0.85], ['broadleaf', 0.15]],
    treeDensity: 1.35, fieldDensity: 0.9, pineColor: [0.025, 0.075, 0.045], terrainAmplitude: 22, backdropHeight: 240,
    backdropColor: [0.05, 0.11, 0.07], fogDensity: 0.00022, terrainLow: [0.07, 0.12, 0.05], terrainHigh: [0.1, 0.14, 0.07],
  }),
  coast: theme({
    sunAzimuth: 4.0, sunElevation: 0.95, sunColor: [11, 10.4, 9.3], zenith: [0.12, 0.33, 0.88], horizon: [0.7, 0.88, 1.08],
    cloudCoverage: 0.3, grass: [0.12, 0.17, 0.045], grass2: [0.2, 0.2, 0.07], gravel: [0.55, 0.48, 0.34],
    trees: [['palm', 0.5], ['cypress', 0.3], ['broadleaf', 0.2]], treeDensity: 0.55, fieldDensity: 0.25,
    terrainAmplitude: 9, terrainLow: [0.2, 0.2, 0.09], terrainHigh: [0.3, 0.27, 0.16], backdropHeight: 110,
    backdropColor: [0.16, 0.19, 0.1], water: { side: 1, level: -3.5, color: [0.03, 0.16, 0.22] }, buildings: 'villas',
    buildingColor: [0.86, 0.8, 0.7], kerb: [0.05, 0.25, 0.7], fogDensity: 0.00013,
  }),
  lake: theme({
    sunAzimuth: 5.2, sunElevation: 0.7, cloudCoverage: 0.36, trees: [['pine', 0.5], ['broadleaf', 0.5]], treeDensity: 0.9,
    water: { side: -1, level: -2.5, color: [0.03, 0.11, 0.14] }, terrainAmplitude: 16, backdropHeight: 260,
    backdropColor: [0.07, 0.14, 0.08], kerb: [0.05, 0.3, 0.6],
  }),
  alpine: theme({
    sunAzimuth: 1.2, sunElevation: 0.72, sunColor: [11.5, 10.8, 9.8], zenith: [0.1, 0.28, 0.85], horizon: [0.68, 0.84, 1.08],
    cloudCoverage: 0.34, grass: [0.09, 0.19, 0.04], grass2: [0.14, 0.23, 0.05], trees: [['pine', 0.9], ['broadleaf', 0.1]],
    treeDensity: 0.95, fieldDensity: 0.6, terrainAmplitude: 38, terrainScale: 0.0017, backdropHeight: 520,
    backdropColor: [0.18, 0.2, 0.2], backdropFar: [0.42, 0.46, 0.52], snowLine: 190, rocks: 0.25, buildings: 'chalets',
    buildingColor: [0.36, 0.22, 0.12], fogDensity: 0.00011, rockSlope: 0.38,
  }),
  highland: theme({
    sunAzimuth: 3.3, sunElevation: 0.55, sunColor: [8.6, 8.2, 7.6], zenith: [0.22, 0.32, 0.56], horizon: [0.74, 0.8, 0.88],
    cloudCoverage: 0.68, cloudScale: 0.55, grass: [0.1, 0.15, 0.04], grass2: [0.17, 0.17, 0.06], trees: [['pine', 0.6], ['broadleaf', 0.4]],
    treeDensity: 0.35, fieldDensity: 0.15, terrainAmplitude: 34, terrainScale: 0.0019, backdropHeight: 300,
    backdropColor: [0.14, 0.17, 0.08], rocks: 0.4, fogDensity: 0.00026, fogColor: [0.72, 0.78, 0.86], skyAmbient: 1.4,
    terrainLow: [0.13, 0.16, 0.05], terrainHigh: [0.2, 0.17, 0.08], kerb: [0.7, 0.45, 0.03],
  }),
  desert: theme({
    sunAzimuth: 2.9, sunElevation: 1.05, sunColor: [12, 11, 9.2], zenith: [0.14, 0.32, 0.78], horizon: [0.9, 0.86, 0.78],
    cloudCoverage: 0.14, grass: [0.42, 0.33, 0.19], grass2: [0.5, 0.4, 0.24], gravel: [0.56, 0.44, 0.27],
    groundAlbedo: [0.4, 0.31, 0.18], trees: [['palm', 0.6], ['bush', 0.4]], treeDensity: 0.14, fieldDensity: 0.05,
    terrainAmplitude: 16, terrainScale: 0.0014, terrainLow: [0.48, 0.37, 0.21], terrainHigh: [0.56, 0.42, 0.24],
    terrainRock: [0.45, 0.3, 0.2], backdropHeight: 200, backdropColor: [0.5, 0.36, 0.22], backdropFar: [0.6, 0.5, 0.42],
    rocks: 0.5, rockColor: [0.5, 0.36, 0.24], fogDensity: 0.00017, fogColor: [0.86, 0.8, 0.7], kerb: [0.75, 0.035, 0.03],
    buildings: 'tents', exposure: 0.52,
  }),
  canyon: theme({
    sunAzimuth: 0.5, sunElevation: 0.78, sunColor: [11.5, 10.2, 8.4], zenith: [0.12, 0.3, 0.8], horizon: [0.88, 0.82, 0.74],
    cloudCoverage: 0.2, grass: [0.36, 0.25, 0.14], grass2: [0.42, 0.3, 0.17], gravel: [0.5, 0.36, 0.22],
    groundAlbedo: [0.36, 0.24, 0.14], trees: [['bush', 0.7], ['pine', 0.3]], treeDensity: 0.22, fieldDensity: 0.08,
    terrainAmplitude: 46, terrainScale: 0.0026, terrainLow: [0.42, 0.27, 0.15], terrainHigh: [0.52, 0.33, 0.18],
    terrainRock: [0.5, 0.28, 0.16], rockSlope: 0.3, backdropHeight: 380, backdropColor: [0.46, 0.27, 0.15],
    backdropFar: [0.58, 0.44, 0.36], rocks: 0.9, rockColor: [0.5, 0.3, 0.18], fogColor: [0.84, 0.76, 0.66], exposure: 0.54,
    kerb: [0.75, 0.3, 0.03],
  }),
  plains: theme({
    sunAzimuth: 3.8, sunElevation: 0.88, cloudCoverage: 0.5, cloudScale: 0.38, grass: [0.11, 0.18, 0.04], grass2: [0.2, 0.22, 0.06],
    trees: [['broadleaf', 0.8], ['bush', 0.2]], treeDensity: 0.16, fieldDensity: 0.06, terrainAmplitude: 3, backdropHeight: 60,
    backdropColor: [0.1, 0.16, 0.06], barrier: 'concrete', buildings: 'hangars', buildingColor: [0.55, 0.57, 0.58],
    terrainLow: [0.13, 0.19, 0.05], terrainHigh: [0.22, 0.22, 0.08], kerb: [0.05, 0.3, 0.65],
  }),
  park: theme({
    sunAzimuth: 5.6, sunElevation: 0.62, sunColor: [10.8, 9.6, 8.0], zenith: [0.14, 0.32, 0.8], horizon: [0.8, 0.86, 0.98],
    cloudCoverage: 0.38, grass: [0.07, 0.17, 0.035], grass2: [0.1, 0.21, 0.04], trees: [['broadleaf', 0.6], ['cypress', 0.4]],
    treeDensity: 0.75, fieldDensity: 0.3, terrainAmplitude: 6, backdropHeight: 90, barrier: 'concrete',
    buildings: 'city', buildingColor: [0.66, 0.62, 0.58], foliage: [0.06, 0.16, 0.03], kerb: [0.75, 0.035, 0.03],
  }),
  docks: theme({
    sunAzimuth: 1.7, sunElevation: 0.58, sunColor: [9.6, 9.0, 8.2], zenith: [0.2, 0.33, 0.66], horizon: [0.76, 0.82, 0.92],
    cloudCoverage: 0.6, cloudScale: 0.5, grass: [0.2, 0.2, 0.19], grass2: [0.26, 0.25, 0.23], gravel: [0.3, 0.3, 0.3],
    groundAlbedo: [0.2, 0.2, 0.2], trees: [['bush', 1]], treeDensity: 0.04, fieldDensity: 0.01, terrainAmplitude: 1,
    terrainLow: [0.22, 0.22, 0.21], terrainHigh: [0.28, 0.27, 0.25], backdropHeight: 40, backdropColor: [0.2, 0.22, 0.24],
    barrier: 'concrete', buildings: 'docks', buildingColor: [0.5, 0.5, 0.52], water: { side: 1, level: -2.2, color: [0.03, 0.09, 0.12] },
    fogDensity: 0.00024, fogColor: [0.7, 0.76, 0.84], kerb: [0.75, 0.55, 0.03],
  }),
  dusk: theme({
    sunAzimuth: 2.6, sunElevation: 0.2, sunColor: [14, 7.8, 3.6], zenith: [0.1, 0.18, 0.5], horizon: [1.3, 0.72, 0.36],
    cloudCoverage: 0.46, exposure: 0.66, grass: [0.1, 0.15, 0.04], grass2: [0.16, 0.17, 0.05], trees: [['broadleaf', 0.5], ['pine', 0.5]],
    treeDensity: 0.7, terrainAmplitude: 26, backdropHeight: 230, backdropColor: [0.08, 0.1, 0.07], fogDensity: 0.00024,
    fogColor: [1.0, 0.62, 0.38], skyAmbient: 1.5, groundAmbient: 0.7, bloom: 0.75, foliage: [0.08, 0.13, 0.03],
  }),
  zenith: theme({
    sunAzimuth: 4.6, sunElevation: 0.68, sunColor: [11.2, 10.4, 9.0], zenith: [0.1, 0.27, 0.86], horizon: [0.7, 0.84, 1.06],
    cloudCoverage: 0.32, grass: [0.1, 0.18, 0.04], grass2: [0.17, 0.2, 0.06], trees: [['pine', 0.4], ['broadleaf', 0.4], ['cypress', 0.2]],
    treeDensity: 0.6, fieldDensity: 0.35, terrainAmplitude: 30, terrainScale: 0.0016, backdropHeight: 440,
    backdropColor: [0.14, 0.18, 0.14], backdropFar: [0.4, 0.44, 0.5], snowLine: 260, rocks: 0.2, buildings: 'city',
    buildingColor: [0.72, 0.72, 0.74],
  }),
};

export function getTheme(id) { return THEMES[id] || THEMES.forest; }

/** Derived lighting constants consumed by the renderer. */
export function buildEnvironment(theme, track) {
  const ce = Math.cos(theme.sunElevation), se = Math.sin(theme.sunElevation);
  const sunDir = [Math.cos(theme.sunAzimuth) * ce, se, Math.sin(theme.sunAzimuth) * ce];
  const skyMean = [0, 1, 2].map((i) => theme.zenith[i] * 0.62 + theme.horizon[i] * 0.38);
  const groundLit = [0, 1, 2].map((i) => theme.groundAlbedo[i] * ((theme.sunColor[i] * se) / Math.PI + skyMean[i] * theme.skyAmbient));
  return {
    sunDir, sunColor: theme.sunColor, exposure: theme.exposure,
    zenith: theme.zenith, horizon: theme.horizon, cloudCoverage: theme.cloudCoverage, cloudScale: theme.cloudScale,
    groundLit, fogDensity: theme.fogDensity, fogFalloff: theme.fogFalloff, fogColor: theme.fogColor,
    skyAmbient: theme.skyAmbient, groundAmbient: theme.groundAmbient, bloom: theme.bloom,
    kerbColor: theme.kerb, grass: theme.grass, grass2: theme.grass2, gravel: theme.gravel,
    trackHalfWidth: track.halfWidth,
  };
}
