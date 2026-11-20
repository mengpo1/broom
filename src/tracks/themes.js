// Circuit themes: the *logical* scenery recipe of each environment (which kinds of trees,
// barriers, buildings and backdrop). Colours live in art/palettes; drawings in art/environments.
// Pure data, consumed by tracks/scenery-layout.js.

const BASE = {
  trees: [['tree.broadleaf', 0.65], ['tree.pine', 0.35]], treeDensity: 1, bushDensity: 0.4, rockDensity: 0.05,
  forestWall: 0.6,            // share of the lap lined with a continuous tree mass behind the barriers
  barrier: 'strip.armco', runoffBarrier: 'strip.tyres', fence: 0.35,
  grandstands: 3, crowdBanks: 0.25, hoardings: 0.5,
  buildings: [], buildingDensity: 0, backdrop: 'hills', water: 0, bridges: 1, wallStrip: null,
  fogDensity: 0.00055,
};

export const THEMES = {
  forest: { ...BASE },
  taiga: { ...BASE, trees: [['tree.pine', 0.85], ['tree.broadleaf', 0.15]], treeDensity: 1.3, forestWall: 0.8, backdrop: 'mountains', fogDensity: 0.0007 },
  coast: { ...BASE, trees: [['tree.palm', 0.5], ['tree.cypress', 0.3], ['tree.broadleaf', 0.2]], treeDensity: 0.5, forestWall: 0.1, bushDensity: 0.6,
    buildings: ['building.villa'], buildingDensity: 0.5, backdrop: 'sea', water: 1, barrier: 'strip.concrete', fogDensity: 0.00045 },
  lake: { ...BASE, trees: [['tree.pine', 0.5], ['tree.broadleaf', 0.5]], treeDensity: 0.9, backdrop: 'mountains', water: -1, forestWall: 0.5 },
  alpine: { ...BASE, trees: [['tree.pine', 0.9], ['tree.broadleaf', 0.1]], treeDensity: 0.95, rockDensity: 0.25, forestWall: 0.5,
    buildings: ['building.chalet'], buildingDensity: 0.4, backdrop: 'mountains', fogDensity: 0.0004 },
  highland: { ...BASE, trees: [['tree.pine', 0.6], ['tree.broadleaf', 0.4]], treeDensity: 0.3, rockDensity: 0.4, forestWall: 0.1, bushDensity: 0.7,
    backdrop: 'hills', fogDensity: 0.0009, grandstands: 2 },
  desert: { ...BASE, trees: [['tree.palm', 0.6], ['bush', 0.4]], treeDensity: 0.14, rockDensity: 0.45, forestWall: 0, bushDensity: 0.5,
    buildings: ['building.tent'], buildingDensity: 0.4, backdrop: 'dunes', barrier: 'strip.concrete', fogDensity: 0.0006 },
  canyon: { ...BASE, trees: [['bush', 0.7], ['tree.pine', 0.3]], treeDensity: 0.2, rockDensity: 0.9, forestWall: 0, bushDensity: 0.6,
    backdrop: 'mesas', wallStrip: 'strip.cliff', fogDensity: 0.0005, grandstands: 2 },
  plains: { ...BASE, trees: [['tree.broadleaf', 0.8], ['bush', 0.2]], treeDensity: 0.16, forestWall: 0.05, barrier: 'strip.concrete',
    buildings: ['building.hangar'], buildingDensity: 0.5, backdrop: 'flat', bridges: 2 },
  park: { ...BASE, trees: [['tree.broadleaf', 0.6], ['tree.cypress', 0.4]], treeDensity: 0.75, forestWall: 0.35, barrier: 'strip.concrete', fence: 0.7,
    buildings: ['building.city'], buildingDensity: 0.5, backdrop: 'city', grandstands: 4 },
  docks: { ...BASE, trees: [['bush', 1]], treeDensity: 0.04, forestWall: 0, bushDensity: 0.1, barrier: 'strip.concrete', fence: 0.9,
    buildings: ['building.crane', 'building.container', 'building.warehouse'], buildingDensity: 1, backdrop: 'city', water: 1, wallStrip: 'strip.facade', fogDensity: 0.0009 },
  dusk: { ...BASE, trees: [['tree.broadleaf', 0.5], ['tree.pine', 0.5]], treeDensity: 0.7, backdrop: 'hills', fogDensity: 0.0009 },
  zenith: { ...BASE, trees: [['tree.pine', 0.4], ['tree.broadleaf', 0.4], ['tree.cypress', 0.2]], treeDensity: 0.6, forestWall: 0.3,
    buildings: ['building.city'], buildingDensity: 0.3, backdrop: 'mountains', grandstands: 5, bridges: 2, fogDensity: 0.0004 },
};

export function getTheme(id) { return THEMES[id] || THEMES.forest; }
