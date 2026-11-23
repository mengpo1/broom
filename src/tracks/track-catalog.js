// Circuit definitions. All eighteen circuits are original, fictional layouts.
//
// A circuit is a closed polygon of corners [x, z, filletRadius, elevation?] in metres.
// The edge from the LAST corner to corner 0 is the main straight (start line, grid, pit lane).
// Clockwise layouts (turning right) live in +z and have the pit lane on the right (pitSide 1);
// counter-clockwise layouts live in -z with pitSide -1.

export const SEASONS = [
  { id: 'season-1', nameKey: 'season.1', circuits: ['hazelbrook', 'porto-sereno', 'montclair', 'sablon', 'kestrel-fields', 'aurelia-parc'] },
  { id: 'season-2', nameKey: 'season.2', circuits: ['lindqvist', 'baia-dourada', 'roca-alta', 'tannenring', 'meridian-docks', 'kagerou-hills'] },
  { id: 'season-3', nameKey: 'season.3', circuits: ['silverlake', 'costa-brisa', 'ouarzane', 'glenmoor', 'nova-belvedere', 'grand-zenith'] },
];

export const CIRCUITS = [
  // ---------------------------------------------------------------- Season 1
  {
    id: 'hazelbrook', name: 'Hazelbrook', region: 'Forêt de Hazel', theme: 'forest', pitSide: 1, width: 13.5, laps: 5,
    corners: [[1000, 0, 120], [1080, 380, 100, 3], [760, 520, 70, 6], [660, 880, 80, 9], [250, 900, 90, 6], [-130, 620, 110, 2], [-170, 250, 90, 0], [0, 0, 90, 0]],
  },
  {
    id: 'porto-sereno', name: 'Porto Sereno', region: 'Côte de Sereno', theme: 'coast', pitSide: -1, width: 13, laps: 5,
    corners: [[950, 0, 80], [1000, -300, 90], [760, -420, 50, 2], [820, -700, 60, 5], [500, -820, 70, 8], [380, -520, 45, 6], [150, -640, 50, 4], [-120, -420, 90, 2], [-80, 0, 80]],
  },
  {
    id: 'montclair', name: 'Montclair', region: 'Massif du Clair', theme: 'alpine', pitSide: 1, width: 13, laps: 5,
    corners: [[900, 0, 70, 0], [980, 240, 60, 6], [720, 330, 55, 14], [800, 600, 60, 22], [520, 760, 90, 30], [300, 560, 50, 24], [120, 760, 55, 18], [-150, 560, 80, 10], [-200, 200, 70, 4], [-120, 0, 90, 0]],
  },
  {
    id: 'sablon', name: 'Sablon Raceway', region: 'Plateau du Sablon', theme: 'desert', pitSide: 1, width: 14, laps: 5,
    corners: [[1300, 0, 160], [1450, 400, 140, 2], [1100, 650, 100, 5], [700, 500, 180, 3], [300, 700, 90, 6], [-150, 550, 120, 4], [-250, 150, 100, 1], [0, 0, 110]],
  },
  {
    id: 'kestrel-fields', name: 'Kestrel Fields', region: 'Aérodrome de Kestrel', theme: 'plains', pitSide: -1, width: 14, laps: 5,
    corners: [[1100, 0, 55], [1120, -340, 50], [800, -360, 40], [790, -610, 45], [400, -600, 65], [410, -300, 38], [150, -290, 38], [140, -650, 60], [-200, -660, 85], [-210, 0, 70]],
  },
  {
    id: 'aurelia-parc', name: 'Aurelia Parc', region: 'Jardins d\'Aurelia', theme: 'park', pitSide: 1, width: 12.5, laps: 5,
    corners: [[900, 0, 60], [960, 260, 40, 1], [720, 300, 35, 3], [760, 520, 50, 5], [480, 640, 60, 7], [420, 380, 40, 5], [220, 360, 40, 4], [160, 680, 60, 6], [-140, 640, 70, 3], [-200, 300, 60, 1], [-60, 0, 70]],
  },
  // ---------------------------------------------------------------- Season 2
  {
    id: 'lindqvist', name: 'Lindqvist Skog', region: 'Taïga de Lindqvist', theme: 'taiga', pitSide: -1, width: 13, laps: 5,
    corners: [[1000, 0, 150, 0], [1150, -350, 120, 8], [900, -600, 90, 16], [600, -450, 70, 12], [400, -700, 80, 20], [50, -750, 100, 14], [-200, -500, 70, 6], [-50, -250, 60, 2], [-250, 0, 60, 0]],
  },
  {
    id: 'baia-dourada', name: 'Baia Dourada', region: 'Baie Dorée', theme: 'coast', pitSide: 1, width: 13.5, laps: 5,
    corners: [[1100, 0, 200], [1350, 300, 120, 2], [1200, 650, 80, 6], [850, 600, 60, 9], [760, 330, 40, 6], [520, 330, 40, 5], [430, 700, 80, 9], [50, 780, 100, 6], [-200, 500, 70, 3], [-80, 250, 50, 1], [-260, 0, 70]],
  },
  {
    id: 'roca-alta', name: 'Roca Alta', region: 'Canyon de la Roca', theme: 'canyon', pitSide: -1, width: 12.5, laps: 5,
    corners: [[850, 0, 60, 0], [900, -250, 50, 8], [650, -300, 45, 16], [600, -550, 45, 26], [850, -650, 50, 34], [800, -900, 60, 40], [450, -880, 80, 32], [350, -600, 60, 24], [100, -550, 60, 16], [-50, -800, 70, 10], [-300, -600, 80, 5], [-200, 0, 90, 0]],
  },
  {
    id: 'tannenring', name: 'Tannenring', region: 'Vallée des Sapins', theme: 'alpine', pitSide: 1, width: 13.5, laps: 5,
    corners: [[1200, 0, 130, 0], [1300, 350, 110, -8], [1000, 500, 70, -14], [950, 800, 90, -6], [550, 900, 120, 6], [350, 600, 60, 12], [50, 650, 70, 16], [-250, 450, 100, 10], [-200, 150, 80, 4], [0, 0, 80, 0]],
  },
  {
    id: 'meridian-docks', name: 'Meridian Docks', region: 'Port de Meridian', theme: 'docks', pitSide: 1, width: 12.5, laps: 5,
    corners: [[1000, 0, 42], [1010, 300, 40], [720, 320, 32], [700, 600, 42], [350, 610, 40], [370, 340, 32], [100, 350, 34], [90, 650, 42], [-200, 660, 60], [-210, 0, 60]],
  },
  {
    id: 'kagerou-hills', name: 'Kagerou Hills', region: 'Collines de Kagerou', theme: 'dusk', pitSide: -1, width: 13, laps: 5,
    corners: [[1050, 0, 100, 0], [1200, -300, 90, 6], [1000, -500, 60, 14], [1100, -750, 70, 20], [800, -950, 90, 26], [550, -750, 60, 20], [300, -900, 70, 14], [50, -700, 60, 10], [200, -450, 50, 6], [-50, -300, 60, 2], [-200, 0, 80, 0]],
  },
  // ---------------------------------------------------------------- Season 3
  {
    id: 'silverlake', name: 'Silverlake', region: 'Lac d\'Argent', theme: 'lake', pitSide: 1, width: 13.5, laps: 5,
    corners: [[900, 0, 80], [1100, 200, 100, 2], [1150, 600, 120, 4], [900, 850, 100, 6], [500, 800, 150, 4], [300, 950, 60, 6], [0, 850, 80, 8], [-100, 550, 60, 5], [150, 400, 50, 3], [50, 200, 45, 1], [-150, 0, 60]],
  },
  {
    id: 'costa-brisa', name: 'Costa Brisa', region: 'Corniche de Brisa', theme: 'coast', pitSide: -1, width: 14, laps: 5,
    corners: [[1250, 0, 150], [1400, -400, 130, 4], [1050, -650, 90, 10], [800, -400, 60, 6], [550, -650, 70, 10], [650, -950, 80, 16], [250, -1050, 100, 12], [-100, -800, 90, 8], [100, -500, 60, 4], [-150, -300, 70, 2], [-250, 0, 90]],
  },
  {
    id: 'ouarzane', name: 'Ouarzane', region: 'Erg d\'Ouarzane', theme: 'desert', pitSide: 1, width: 13.5, laps: 5,
    corners: [[1400, 0, 60], [1450, 250, 50, 2], [1150, 350, 45, 5], [1100, 650, 60, 9], [700, 700, 80, 12], [650, 400, 40, 8], [450, 380, 40, 6], [400, 750, 70, 9], [0, 800, 90, 6], [-200, 450, 100, 3], [-100, 0, 100]],
  },
  {
    id: 'glenmoor', name: 'Glenmoor', region: 'Hautes Terres de Glen', theme: 'highland', pitSide: -1, width: 13, laps: 5,
    corners: [[950, 0, 120, 0], [1150, -250, 100, -6], [1100, -600, 90, -12], [800, -700, 70, -4], [650, -450, 60, 6], [400, -550, 60, 14], [350, -850, 80, 22], [0, -900, 100, 16], [-250, -650, 90, 8], [-100, -350, 70, 2], [-300, 0, 80, 0]],
  },
  {
    id: 'nova-belvedere', name: 'Nova Belvedere', region: 'Parc du Belvédère', theme: 'park', pitSide: 1, width: 12, laps: 6,
    corners: [[800, 0, 40], [820, 180, 35, 1], [600, 220, 30, 2], [620, 420, 35, 4], [850, 480, 40, 6], [800, 700, 50, 8], [450, 720, 60, 6], [400, 480, 35, 4], [200, 460, 35, 3], [150, 700, 50, 5], [-150, 650, 60, 3], [-180, 300, 50, 1], [-50, 0, 60]],
  },
  {
    id: 'grand-zenith', name: 'Grand Zenith', region: 'Plateau du Zénith', theme: 'zenith', pitSide: 1, width: 14, laps: 4,
    corners: [[1500, 0, 180, 0], [1750, 350, 150, 5], [1600, 750, 100, 12], [1250, 650, 70, 18], [1150, 950, 80, 24], [800, 1050, 120, 18], [600, 750, 60, 10], [750, 450, 50, 4], [450, 350, 60, 0], [250, 650, 70, 6], [300, 1000, 80, 12], [-100, 1050, 110, 8], [-350, 700, 120, 4], [-250, 250, 90, 0], [0, 0, 100, 0]],
  },
];

/**
 * Development circuits: not part of any season, never listed in the menus, reachable only through a
 * launch option (see core/steering-bench.js).
 * `banc-direction`: a flat test track for the steering. After a long straight, seven bends of
 * different radii, six to the right and one to the left (the fourth). Measured on the built track:
 * 72, 135, 208, 100, 158, 259 and 311 m, turning by 90, 52, 91, 95, 98, 79 and 45 degrees.
 * `banc-reference`: the two long turns of the passage of the reference footage studied for the held
 * steering (a right-hand turn of about 128 degrees entered at 318 km/h, then a left-hand turn of
 * 67 degrees taken at 215 km/h). The footage shows neither the controls nor the shape of the road:
 * these bends are the path of the validated car driven with the keys the hands of the footage
 * suggest, at the speed its display shows, a hypothesis (fitted by
 * work/scripts/reference-passage-track.mjs --fit: the car then stays within 3 m of the centre
 * line); the three other corners only close the loop.
 */
export const DEV_CIRCUITS = [
  {
    id: 'banc-direction', name: 'Banc de direction', region: 'Piste d\'essai', theme: 'plains', pitSide: -1, width: 14, laps: 3,
    corners: [[1100, 0, 60], [1100, 500, 120], [650, 850, 200], [350, 450, 90], [-100, 850, 150], [-400, 400, 250], [0, 0, 300]],
  },
  {
    id: 'banc-reference', name: 'Banc du passage de référence', region: 'Piste d\'essai', theme: 'plains', pitSide: -1, width: 14, laps: 3,
    corners: [[310.4, 0, 159.9], [380.3, 203.6, 157], [261.6, 355.7, 136.9], [477.1, 744.3, 120], [-1000, 744.3, 150], [-1000, 0, 150]],
  },
];

const BY_ID = new Map([...CIRCUITS, ...DEV_CIRCUITS].map((c) => [c.id, c]));

export function getCircuit(id) {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown circuit: ${id}`);
  return def;
}

export function seasonOf(circuitId) {
  return SEASONS.find((s) => s.circuits.includes(circuitId)) || null;
}
