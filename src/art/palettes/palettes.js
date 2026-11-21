// Colour scripts ("gammes") of the comic art direction. Plain data: one base palette and one
// set of overrides per circuit theme. Every drawing and shader reads colours from here by name,
// so a palette can be re-tuned or replaced without touching drawing code.
// Colours are sRGB hex strings. Rules (see docs/art-direction): flat tones, three values per
// material (light / base / shade), backgrounds less saturated than the track, ink is never
// pure black.

export const BASE_PALETTE = {
  ink: '#16161f', inkSoft: '#3a3d4d', paper: '#f4efe2',
  // sky
  skyTop: '#2f6fbe', skyMid: '#6fa9de', skyLow: '#c8e2f2', cloudLight: '#fbfaf3', cloudShade: '#c3d3e6', cloudDeep: '#9db4d2',
  haze: '#cfe2ee',
  // ground
  asphalt: '#6c6e77', asphaltGroove: '#51535d', asphaltLight: '#82848c', paint: '#f1efe6', paintYellow: '#f0c330',
  kerbA: '#d5302a', kerbB: '#f1efe6', pitAsphalt: '#7e8088',
  grassA: '#6fa646', grassB: '#64993f', grassDark: '#3f7a35', mown: '#7fb654',
  gravelA: '#d8c59b', gravelB: '#b9a273', beyondA: '#5a933f', beyondB: '#4d8438', farGround: '#6d9d55',
  waterA: '#3f86b8', waterB: '#5ea0c9',
  // vegetation: light / base / shade
  leafLight: '#86bd4c', leaf: '#5d9a3c', leafShade: '#356b33', leafDeep: '#234a2d',
  pineLight: '#4f8f55', pine: '#2f6b47', pineShade: '#1c4737', trunk: '#6b4a35', trunkShade: '#43302a',
  palmLight: '#8cc152', palm: '#4f9a45', palmShade: '#2c6a3a', palmTrunkLight: '#c2a783', palmTrunk: '#97795c', palmTrunkShade: '#5f4a42', dateFruit: '#e0902f',
  cypressLight: '#5f9150', cypress: '#37683f', cypressShade: '#1f4434',
  dryLight: '#c9b36d', dry: '#a58f4f', dryShade: '#75643a',
  // relief (backdrops): far is hazier than near
  farReliefLight: '#b4cbe0', farRelief: '#96b3d1', farReliefShade: '#7c9cc0', snow: '#f4f7fa',
  nearReliefLight: '#7fae6b', nearRelief: '#5c9058', nearReliefShade: '#3f7350',
  rockLight: '#c9b7a3', rock: '#a08a78', rockShade: '#6f5d57', rockDeep: '#4a3d45',
  // structures
  concreteLight: '#dcdad2', concrete: '#b7b6b0', concreteShade: '#85868a',
  metalLight: '#d6dde4', metal: '#a3aebb', metalShade: '#66717f',
  woodLight: '#c9945a', wood: '#9a6a3f', woodShade: '#63412c',
  roof: '#b5483a', roofShade: '#7d3030', glass: '#7fb3d4', glassShade: '#4a7da6', glassLight: '#d2ecf7',
  wallLight: '#f1e6cf', wall: '#d9c8a7', wallShade: '#a8977f',
  tyre: '#2b2c34', tyreLight: '#4a4c57',
  brickLight: '#cf8f6c', brick: '#ad664c', brickShade: '#77433f', shutter: '#3d7a86', shutterShade: '#2a5566',
  lampOff: '#571b22', lampOffLight: '#8c2f36',
  banners: ['#d5302a', '#f0c330', '#2f6fbe', '#f1efe6', '#2f9a5a', '#e9792b', '#7a4fa8', '#16161f'],
  crowd: ['#d5302a', '#f0c330', '#2f6fbe', '#f1efe6', '#2f9a5a', '#e9792b', '#e58aa6', '#7a4fa8', '#3a3d4d', '#8fc6e8'],
  skin: ['#f1c9a5', '#d9a57c', '#a8704a', '#7a4a32'],
  // effects
  speedLight: '#ffffff', speedDark: '#16161f', dust: '#d9c9a4', dustShade: '#b29f78', smoke: '#eceae4', smokeShade: '#b9bcc4',
  impactYellow: '#ffd42a', impactRed: '#e0312b', impactOrange: '#f58a1f',
  // light of the place, multiplied over what is not painted per theme (cars, cockpit)
  ambient: '#ffffff',
  // interface
  caption: '#f6e27a', captionShade: '#d9bf46', panel: '#f4efe2', panelShade: '#d7cfbc', uiRed: '#d5302a', uiBlue: '#2f5fa8', uiDark: '#22232e',
};

const OVERRIDES = {
  forest: {},
  taiga: {
    skyTop: '#3a6fae', skyMid: '#84aed6', skyLow: '#d6e4ee', haze: '#d3e0e8',
    grassA: '#6c9a4c', grassB: '#608d45', grassDark: '#3d6e3c', mown: '#7aa857', beyondA: '#4c7d42', beyondB: '#3f6f3d', farGround: '#5f8a55',
    farReliefLight: '#aabfd2', farRelief: '#8ea8c2', farReliefShade: '#7391b0', nearReliefLight: '#4f8560', nearRelief: '#376a52', nearReliefShade: '#24503f',
  },
  coast: {
    skyTop: '#1f74c8', skyMid: '#62b0e6', skyLow: '#c9ebf6', haze: '#d2ecf2', kerbA: '#2a62b5',
    grassA: '#9ab04e', grassB: '#8ca546', grassDark: '#62863a', mown: '#a9bd5b', gravelA: '#ead7a6', gravelB: '#cdb681',
    beyondA: '#88a04a', beyondB: '#7a9341', farGround: '#8aa862', waterA: '#2c8fc2', waterB: '#58b3d6',
    nearReliefLight: '#b9b87a', nearRelief: '#93a05f', nearReliefShade: '#6a7f52', farReliefLight: '#bcd3e4', farRelief: '#9dbcd6', farReliefShade: '#83a6c8',
    wallLight: '#fbf2df', wall: '#ecd9b8', wallShade: '#b9a58a', roof: '#c8603f',
  },
  lake: {
    skyTop: '#2c6cb8', skyMid: '#74a9da', skyLow: '#cfe4f0', kerbA: '#2a62b5', waterA: '#3a7fae', waterB: '#62a0c6',
    beyondA: '#558c40', beyondB: '#497f3a',
  },
  alpine: {
    skyTop: '#1f63b8', skyMid: '#5ea2e0', skyLow: '#c4e0f4', haze: '#d4e6f2',
    grassA: '#74b04a', grassB: '#68a443', grassDark: '#3f7f38', mown: '#86c05a', beyondA: '#5c9a44', beyondB: '#4f8c3c', farGround: '#72a85c',
    farReliefLight: '#c2d2e2', farRelief: '#9fb4cc', farReliefShade: '#7f97b6', nearReliefLight: '#6d9f62', nearRelief: '#4b8055', nearReliefShade: '#33634a',
    roof: '#7a4a35', roofShade: '#553427', wallLight: '#e9d9bf', wall: '#b98d62', wallShade: '#80583c',
  },
  highland: {
    skyTop: '#55789f', skyMid: '#93adc6', skyLow: '#d6dfe6', cloudShade: '#aebccb', cloudDeep: '#8898ac', haze: '#d2dae0',
    grassA: '#8a9c4a', grassB: '#7d9044', grassDark: '#5b7139', mown: '#98aa55', beyondA: '#74873f', beyondB: '#677a3a', farGround: '#7d8f55',
    kerbA: '#e0a12a', farReliefLight: '#aab7c4', farRelief: '#8f9fb0', farReliefShade: '#74869a',
    nearReliefLight: '#8f9a5a', nearRelief: '#6f7d4c', nearReliefShade: '#535f43', leafLight: '#8fa650', leaf: '#6b8540', leafShade: '#465f35',
  },
  desert: {
    skyTop: '#2a78c4', skyMid: '#7db8e2', skyLow: '#f0e3c8', haze: '#eddfc6', cloudShade: '#e3d6c4',
    asphalt: '#74727a', asphaltGroove: '#58565f', asphaltLight: '#8b8990',
    grassA: '#d9b877', grassB: '#cfac6b', grassDark: '#a98850', mown: '#e2c486', gravelA: '#e8d2a0', gravelB: '#c9b07b',
    beyondA: '#cfa965', beyondB: '#c09a59', farGround: '#d8b77e',
    farReliefLight: '#e0c6a8', farRelief: '#cfa98a', farReliefShade: '#b58b73', nearReliefLight: '#dba86a', nearRelief: '#c2874f', nearReliefShade: '#96603e',
    rockLight: '#dfb07a', rock: '#c08a56', rockShade: '#8f5f40', rockDeep: '#5f3d38', leafLight: '#a9b356', leaf: '#7f9145', leafShade: '#566b38',
    dust: '#e6cf9e', dustShade: '#c3a873',
  },
  canyon: {
    skyTop: '#2470c0', skyMid: '#78b3e0', skyLow: '#f2dfc4', haze: '#eed9c0', kerbA: '#e0762a',
    asphalt: '#73707a', asphaltGroove: '#57545e',
    grassA: '#cf9a62', grassB: '#c48d57', grassDark: '#9c6a42', mown: '#d9a870', gravelA: '#e3c08c', gravelB: '#c49d68',
    beyondA: '#c08552', beyondB: '#b17746', farGround: '#cf9c6c',
    farReliefLight: '#e2b79a', farRelief: '#cf9478', farReliefShade: '#b0745f', nearReliefLight: '#dd935a', nearRelief: '#bf6f41', nearReliefShade: '#8d4b33',
    rockLight: '#e39a5e', rock: '#c47442', rockShade: '#8e4c32', rockDeep: '#5c2f30', leafLight: '#a3ad55', leaf: '#7b8a44', leafShade: '#536338',
    dust: '#e3bf90', dustShade: '#bd9566',
  },
  plains: {
    skyTop: '#3474c4', skyMid: '#7db1e2', skyLow: '#d3e7f3', kerbA: '#2a62b5',
    grassA: '#86ae4a', grassB: '#7aa143', grassDark: '#55803a', mown: '#96bd58', beyondA: '#9aa84c', beyondB: '#b0a850', farGround: '#93ab58',
    nearReliefLight: '#84ab5b', nearRelief: '#628c50', nearReliefShade: '#466d46',
  },
  park: {
    skyTop: '#3072c2', skyMid: '#79aee0', skyLow: '#d6e6ee', grassA: '#63a548', grassB: '#589840', grassDark: '#377536', mown: '#73b556',
    beyondA: '#4f8f3d', beyondB: '#438036', leafLight: '#7fbb4c', leaf: '#549a3c', leafShade: '#2f6a33',
    farReliefLight: '#b9c7d8', farRelief: '#9fb0c7', farReliefShade: '#8497b3',
  },
  docks: {
    skyTop: '#557fa8', skyMid: '#95b3cc', skyLow: '#d9e2e8', cloudShade: '#b3c0cd', cloudDeep: '#8d9cae', haze: '#d3dce2', kerbA: '#e0b52a', kerbB: '#2b2c34',
    asphalt: '#666870', grassA: '#8e9088', grassB: '#84867e', grassDark: '#6a6c68', mown: '#9a9c94', gravelA: '#a3a39b', gravelB: '#86867f',
    beyondA: '#7c7e78', beyondB: '#71736e', farGround: '#8a8d88', waterA: '#3d6f8e', waterB: '#5c8ba6',
    farReliefLight: '#b4c0cc', farRelief: '#9aa8b8', farReliefShade: '#7f8fa2', nearReliefLight: '#9aa3ad', nearRelief: '#7b8794', nearReliefShade: '#5d6a78',
  },
  dusk: {
    ambient: '#f7cfb9',
    skyTop: '#3b4f95', skyMid: '#c9789a', skyLow: '#fbc77a', cloudLight: '#ffe2b0', cloudShade: '#e0879a', cloudDeep: '#8f5f9a', haze: '#f3c08e',
    ink: '#191527', asphalt: '#6a6474', asphaltGroove: '#4f4a5b', asphaltLight: '#857c88', paint: '#f6e6cf', kerbB: '#f6e6cf',
    grassA: '#7d9443', grassB: '#70883d', grassDark: '#4a6736', mown: '#8da44f', beyondA: '#66803c', beyondB: '#587236', farGround: '#8a8f58',
    gravelA: '#dcbf8f', gravelB: '#b99a6c',
    leafLight: '#a3a94a', leaf: '#6c8a3c', leafShade: '#3f5c38', leafDeep: '#2a3f35', pineLight: '#6f8f4e', pine: '#3f6645', pineShade: '#254438',
    farReliefLight: '#c99aa9', farRelief: '#a97c9f', farReliefShade: '#86639a', nearReliefLight: '#7f8a55', nearRelief: '#56704c', nearReliefShade: '#3a5346',
    concreteLight: '#ecd8c0', concrete: '#c2ae9f', concreteShade: '#8b7d82', speedLight: '#fff1d0',
  },
  zenith: {
    skyTop: '#1c5fb8', skyMid: '#5b9fe0', skyLow: '#c2def4', haze: '#d2e5f2',
    grassA: '#72ac48', grassB: '#66a041', grassDark: '#3f7c37', mown: '#84bc58',
    farReliefLight: '#c0d0e2', farRelief: '#9cb2cc', farReliefShade: '#7c96b8',
  },
};

const cache = new Map();

/** Palette (hex strings) for a circuit theme id. */
export function getPalette(themeId) {
  let p = cache.get(themeId);
  if (!p) { p = { ...BASE_PALETTE, ...(OVERRIDES[themeId] || {}) }; cache.set(themeId, p); }
  return p;
}

/** '#rrggbb' -> [r, g, b] in 0..1 (display-referred sRGB, as used by the shaders). */
export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export function rgbToHex(r, g, b) {
  const q = (x) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return `#${((1 << 24) | (q(r) << 16) | (q(g) << 8) | q(b)).toString(16).slice(1)}`;
}

/** Mix two hex colours (t = 0 gives a). */
export function mixHex(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  return rgbToHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
}

/** Comic shade of a colour: darker and pulled toward the ink hue (never toward grey). */
export function shadeHex(hex, amount = 0.35, ink = '#1b1b3a') { return mixHex(hex, ink, amount); }
/** Comic light of a colour: lighter and slightly warm. */
export function lightHex(hex, amount = 0.3) { return mixHex(hex, '#fff8e6', amount); }

/** Shader colour slots ({ name: [r,g,b] }) from a palette. */
export function shaderColors(palette) {
  const out = {};
  for (const key of ['asphalt', 'asphaltGroove', 'asphaltLight', 'paint', 'kerbA', 'kerbB', 'grassA', 'grassB', 'grassDark',
    'gravelA', 'gravelB', 'pitAsphalt', 'ink', 'haze', 'beyondA', 'beyondB', 'skyTop', 'skyMid', 'skyLow', 'paintYellow',
    'speedLight', 'speedDark', 'farGround', 'mown']) out[key] = hexToRgb(palette[key]);
  return out;
}
