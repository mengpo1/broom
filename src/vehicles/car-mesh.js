// Procedural single-seater in the spirit of early-1990s open-wheel cars (original design).
// Local frame: +X right, +Y up, -Z forward; origin on the ground at the wheelbase centre.
// The mesh is split into parts that receive their own transform: body, driver, steering wheel,
// front wheel and rear wheel (wheels are modelled at the origin, axle along X).

import { MeshBuilder } from '../graphics/mesh-builder.js';
import { MAT } from '../graphics/materials.js';
import { lerp } from '../core/math.js';

export const CAR_GEOMETRY = {
  frontAxleZ: -1.5, rearAxleZ: 1.4,
  frontTrackHalf: 0.8, rearTrackHalf: 0.76,
  frontWheelRadius: 0.33, rearWheelRadius: 0.345,
  frontWheelWidth: 0.29, rearWheelWidth: 0.39,
  eye: [0, 0.86, 0.12],                // driver's eye point
  steeringCentre: [0, 0.535, -0.4],
  steeringTilt: 0.5,                  // rad, column angle from horizontal
  exhaust: [0.16, 0.3, 1.95],
};

const ZONE = { BODY: 0, FRONT_WING: 1, REAR_WING: 2, ENGINE: 3, SIDEPOD: 4 };
const zoneColor = (zone) => [(zone * 16) / 255, 0, 0];
const CARBON = [0.02, 0.02, 0.02];
const DARK = [0.03, 0.03, 0.035];
const STEEL = [0.32, 0.33, 0.35];

/** Rounded cross-section in the XY plane at depth z. dip lowers the top centre (cockpit opening). */
function section(z, halfWidth, yBottom, yTop, points = 16, squareness = 3, dip = 0, dipWidth = 0.7) {
  const ring = [];
  const cy = (yTop + yBottom) / 2, hy = (yTop - yBottom) / 2;
  for (let k = 0; k < points; k++) {
    const a = (k / points) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const e = 2 / squareness;
    const x = Math.sign(c) * Math.abs(c) ** e * halfWidth;
    let y = cy + Math.sign(s) * Math.abs(s) ** e * hy;
    if (dip > 0 && s > 0) {
      const t = Math.max(0, 1 - Math.abs(x) / (halfWidth * dipWidth));
      y -= dip * t * t * (3 - 2 * t);
    }
    ring.push([x, y, z]);
  }
  return ring;
}

function buildBody(b) {
  const paint = (zone) => zoneColor(zone);
  // ---- monocoque + nose + engine cover (one loft, nose to tail)
  const stations = [
    // z, halfWidth, yBottom, yTop, dip
    [-2.3, 0.05, 0.17, 0.23, 0],
    [-2.2, 0.085, 0.145, 0.265, 0],
    [-1.95, 0.12, 0.12, 0.315, 0],
    [-1.5, 0.17, 0.095, 0.4, 0],
    [-1.05, 0.22, 0.075, 0.475, 0],
    [-0.62, 0.285, 0.065, 0.545, 0],
    [-0.5, 0.31, 0.06, 0.575, 0.02],
    [-0.4, 0.33, 0.06, 0.6, 0.2],
    [-0.1, 0.345, 0.06, 0.61, 0.27],
    [0.25, 0.345, 0.06, 0.615, 0.27],
    [0.42, 0.34, 0.06, 0.63, 0.14],
    [0.52, 0.31, 0.06, 0.8, 0],
    [0.62, 0.25, 0.06, 0.965, 0],
    [0.9, 0.25, 0.06, 0.86, 0],
    [1.25, 0.23, 0.07, 0.66, 0],
    [1.6, 0.18, 0.09, 0.48, 0],
    [1.95, 0.11, 0.12, 0.36, 0],
    [2.02, 0.07, 0.15, 0.32, 0],
  ];
  const rings = stations.map(([z, hw, yb, yt, dip]) => section(z, hw, yb, yt, 18, z < 0.5 ? 2.8 : 2.4, dip, 0.72));
  b.loft(rings, (i, k, p) => {
    // inside of the cockpit opening is dark
    const st = stations[i];
    const inCockpit = st[4] > 0.1 && p[1] < st[3] - 0.05 && Math.abs(p[0]) < st[1] * 0.62 && p[1] > 0.3;
    if (inCockpit) return [0.25, 0.25, 0.27];
    return paint(st[0] > 0.5 ? ZONE.ENGINE : ZONE.BODY);
  }, MAT.CAR_PAINT, {
    capStart: true, capEnd: true,
    matFn: (i, k, p) => {
      const st = stations[i];
      const inCockpit = st[4] > 0.1 && p[1] < st[3] - 0.05 && Math.abs(p[0]) < st[1] * 0.62 && p[1] > 0.3;
      return inCockpit ? MAT.COCKPIT : MAT.CAR_PAINT;
    },
    aoFn: (i, k, p) => (p[1] < 0.12 ? 0.45 : 1),
  });
  // cockpit floor / seat back
  b.box(0, 0.33, 0.0, 0.24, 0.02, 0.42, [0.2, 0.2, 0.22], MAT.COCKPIT, { faces: 4 });
  b.box(0, 0.5, 0.4, 0.2, 0.17, 0.03, [0.25, 0.25, 0.27], MAT.COCKPIT, { faces: 32 });
  // air intake above the driver's head
  b.ellipsoid([0, 0.87, 0.6], [0.11, 0.075, 0.03], 12, 6, [0, 0, 0], MAT.COCKPIT);
  // dashboard with rev lights
  b.box(0, 0.585, -0.47, 0.2, 0.012, 0.045, DARK, MAT.CARBON);
  b.box(0, 0.668, -0.452, 0.125, 0.02, 0.006, DARK, MAT.CARBON);
  b.quadPoints([-0.115, 0.655, -0.445], [0.115, 0.655, -0.445], [0.115, 0.682, -0.445], [-0.115, 0.682, -0.445], [0, 0.2, 0.98], [0, 0, 1, 1], [0, 0, 1], MAT.REV_LIGHTS);
  // windscreen lip
  b.loft([
    [[-0.3, 0.6, -0.42], [-0.15, 0.63, -0.5], [0.15, 0.63, -0.5], [0.3, 0.6, -0.42]],
    [[-0.3, 0.66, -0.4], [-0.15, 0.7, -0.47], [0.15, 0.7, -0.47], [0.3, 0.66, -0.4]],
  ], [0.02, 0.02, 0.03], MAT.VISOR, { closed: false, inward: false });

  // ---- sidepods
  for (const side of [-1, 1]) {
    const pod = [
      [-0.38, 0.19, 0.075, 0.4],
      [-0.2, 0.21, 0.07, 0.43],
      [0.5, 0.21, 0.07, 0.42],
      [1.0, 0.18, 0.07, 0.36],
      [1.38, 0.1, 0.08, 0.27],
    ].map(([z, hw, yb, yt]) => section(z, hw, yb, yt, 12, 3.2).map((p) => [p[0] + side * (0.33 + hw), p[1], p[2]]));
    b.loft(pod, paint(ZONE.SIDEPOD), MAT.CAR_PAINT, { capEnd: true, aoFn: (i, k, p) => (p[1] < 0.12 ? 0.5 : 1) });
    // radiator inlet
    b.capRing(pod[0].map((p) => [p[0], p[1], p[2] + 0.004]), [side * 0.52, 0.24, -0.376], [0, 0, -1], [0, 0, 0], MAT.COCKPIT);
    b.box(side * 0.52, 0.245, -0.39, 0.15, 0.125, 0.008, CARBON, MAT.CARBON, { faces: 32 });
    // mirrors
    b.beam([side * 0.33, 0.6, -0.36], [side * 0.43, 0.66, -0.4], 0.018, DARK, MAT.CARBON);
    b.box(side * 0.47, 0.665, -0.4, 0.05, 0.03, 0.018, paint(ZONE.BODY), MAT.CAR_PAINT, { faces: 63 - 16 });
    b.quadPoints([side * 0.47 - 0.044, 0.64, -0.381], [side * 0.47 + 0.044, 0.64, -0.381], [side * 0.47 + 0.044, 0.69, -0.381], [side * 0.47 - 0.044, 0.69, -0.381], [0, 0.3, 0.95], [0, 0, 1, 1], [1, 1, 1], MAT.MIRROR);
  }

  // ---- floor, diffuser, gearbox
  b.box(0, 0.055, 0.45, 0.7, 0.012, 1.3, CARBON, MAT.CARBON, { aoBottom: 0.3 });
  b.box(0, 0.05, -1.05, 0.2, 0.012, 0.6, CARBON, MAT.CARBON, { aoBottom: 0.3 });
  b.box(0, 0.22, 1.9, 0.1, 0.1, 0.14, STEEL, MAT.METAL);
  for (const side of [-1, 1]) {
    // exhausts
    b.lathe([side * 0.16, 0.3, 1.78], [[0.045, 0], [0.045, 0.2], [0.032, 0.2], [0.032, 0.02]], 10, 'z', [0.45, 0.4, 0.34], MAT.METAL);
    // diffuser strakes
    b.box(side * 0.3, 0.1, 1.85, 0.008, 0.05, 0.16, CARBON, MAT.CARBON);
  }
  // rear light
  b.box(0, 0.33, 2.03, 0.035, 0.03, 0.01, [1, 0.03, 0.02], MAT.EMISSIVE, { faces: 16 });

  // ---- front wing
  const fw = paint(ZONE.FRONT_WING);
  for (const side of [-1, 1]) {
    // main plane with a slight sweep, and a flap
    b.loft([
      [[side * 0.06, 0.1, -2.34], [side * 0.06, 0.125, -2.2], [side * 0.06, 0.115, -2.02], [side * 0.06, 0.095, -2.04]],
      [[side * 0.9, 0.11, -2.3], [side * 0.9, 0.135, -2.17], [side * 0.9, 0.13, -2.0], [side * 0.9, 0.105, -2.02]],
    ], fw, MAT.CAR_PAINT);
    b.loft([
      [[side * 0.22, 0.13, -2.07], [side * 0.22, 0.165, -1.98], [side * 0.22, 0.2, -1.9], [side * 0.22, 0.185, -1.9]],
      [[side * 0.9, 0.14, -2.05], [side * 0.9, 0.185, -1.96], [side * 0.9, 0.235, -1.88], [side * 0.9, 0.215, -1.88]],
    ], fw, MAT.CAR_PAINT);
    // end plate
    b.box(side * 0.915, 0.17, -2.11, 0.012, 0.115, 0.25, paint(ZONE.FRONT_WING), MAT.CAR_PAINT);
  }
  // ---- rear wing
  const rw = paint(ZONE.REAR_WING);
  for (const side of [-1, 1]) b.box(side * 0.49, 0.64, 1.94, 0.012, 0.34, 0.22, rw, MAT.CAR_PAINT);
  const element = (y, z0, z1, thickness, rise) => b.loft([
    [[-0.48, y, z0], [-0.48, y + thickness, z0 + (z1 - z0) * 0.3], [-0.48, y + rise + thickness * 0.4, z1], [-0.48, y + rise - thickness * 0.3, z1]],
    [[0.48, y, z0], [0.48, y + thickness, z0 + (z1 - z0) * 0.3], [0.48, y + rise + thickness * 0.4, z1], [0.48, y + rise - thickness * 0.3, z1]],
  ], rw, MAT.CAR_PAINT);
  element(0.4, 1.78, 2.02, 0.03, 0.04);
  element(0.82, 1.76, 1.98, 0.045, 0.07);
  element(0.9, 1.97, 2.14, 0.03, 0.075);
  b.box(0, 0.6, 1.9, 0.02, 0.22, 0.1, CARBON, MAT.CARBON);

  // ---- suspension (static arms; wheels are separate parts)
  const G = CAR_GEOMETRY;
  for (const side of [-1, 1]) {
    const fx = side * (G.frontTrackHalf - 0.16), fz = G.frontAxleZ;
    b.beam([side * 0.15, 0.37, fz - 0.24], [fx, 0.43, fz], 0.022, DARK, MAT.CARBON, 0.012);
    b.beam([side * 0.17, 0.39, fz + 0.26], [fx, 0.43, fz], 0.022, DARK, MAT.CARBON, 0.012);
    b.beam([side * 0.13, 0.13, fz - 0.26], [fx, 0.2, fz], 0.024, DARK, MAT.CARBON, 0.012);
    b.beam([side * 0.16, 0.13, fz + 0.28], [fx, 0.2, fz], 0.024, DARK, MAT.CARBON, 0.012);
    b.beam([fx, 0.22, fz], [side * 0.17, 0.4, fz + 0.05], 0.018, STEEL, MAT.METAL);
    b.beam([side * 0.16, 0.33, fz - 0.14], [fx, 0.36, fz - 0.12], 0.014, STEEL, MAT.METAL);
    const rx = side * (G.rearTrackHalf - 0.2), rz = G.rearAxleZ;
    b.beam([side * 0.2, 0.4, rz - 0.3], [rx, 0.44, rz], 0.022, DARK, MAT.CARBON, 0.012);
    b.beam([side * 0.12, 0.38, rz + 0.3], [rx, 0.44, rz], 0.022, DARK, MAT.CARBON, 0.012);
    b.beam([side * 0.22, 0.14, rz - 0.3], [rx, 0.2, rz], 0.024, DARK, MAT.CARBON, 0.012);
    b.beam([side * 0.11, 0.15, rz + 0.32], [rx, 0.2, rz], 0.024, DARK, MAT.CARBON, 0.012);
    b.beam([side * 0.1, 0.3, rz], [rx, 0.32, rz], 0.03, STEEL, MAT.METAL);
    // number roundels on the sidepods
    const nz = 0.25;
    b.quadPoints([side * 0.752, 0.13, nz + side * 0.14], [side * 0.752, 0.13, nz - side * 0.14], [side * 0.752, 0.39, nz - side * 0.14], [side * 0.752, 0.39, nz + side * 0.14], [side, 0, 0], [0, 1, 1, 0], zoneColor(ZONE.SIDEPOD), MAT.NUMBER);
  }
  // number on the nose
  b.quadPoints([-0.12, 0.447, -1.02], [0.12, 0.447, -1.02], [0.12, 0.41, -1.3], [-0.12, 0.41, -1.3], [0, 1, 0.13], [0, 1, 1, 0], zoneColor(ZONE.BODY), MAT.NUMBER);
}

function buildDriver(b) {
  // helmet
  b.ellipsoid([0, 0.86, 0.14], [0.125, 0.135, 0.145], 20, 14, [1, 1, 1], MAT.HELMET);
  // visor band on the front
  const visor = [];
  for (let i = 0; i <= 10; i++) {
    const a = lerp(-1.25, 1.25, i / 10);
    visor.push([Math.sin(a) * 0.128, -Math.cos(a) * 0.148]);
  }
  const top = visor.map(([x, z]) => [x * 0.97, 0.915, 0.14 + z * 0.97]);
  const bottom = visor.map(([x, z]) => [x, 0.845, 0.14 + z]);
  b.loft([bottom, top], [0, 0, 0], MAT.VISOR, { closed: false });
  // shoulders and torso
  b.ellipsoid([0, 0.6, 0.2], [0.235, 0.13, 0.15], 14, 8, [0.06, 0.06, 0.08], MAT.FABRIC, { yMin: -0.2 });
  b.ellipsoid([0, 0.72, 0.16], [0.07, 0.07, 0.07], 8, 6, [0.05, 0.05, 0.06], MAT.FABRIC);
}

function buildSteering(b) {
  // Modelled around the origin in the wheel plane (XY), column along +Z; placed by the instance.
  const rim = [];
  const R = 0.125, r = 0.015;
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rim.push([R + Math.cos(a) * r, Math.sin(a) * r]);
  }
  b.lathe([0, 0, 0], rim, 24, 'z', [0.03, 0.03, 0.03], MAT.FABRIC);
  b.box(0, 0, 0.012, 0.12, 0.016, 0.008, DARK, MAT.CARBON);
  b.box(0, -0.06, 0.012, 0.016, 0.06, 0.008, DARK, MAT.CARBON);
  b.lathe([0, 0, 0], [[0.0, 0.012], [0.04, 0.012], [0.045, -0.02], [0.022, -0.03], [0.022, -0.22]], 12, 'z', [0.05, 0.05, 0.05], MAT.CARBON, { inward: true });
  // gloves and forearms, attached to the rim so they follow the steering
  for (const side of [-1, 1]) {
    b.ellipsoid([side * 0.124, 0.012, -0.004], [0.033, 0.042, 0.038], 10, 6, [0.5, 0.05, 0.04], MAT.FABRIC);
    b.beam([side * 0.135, -0.01, 0.03], [side * 0.235, -0.2, 0.3], 0.062, [0.05, 0.05, 0.07], MAT.FABRIC);
  }
}

function buildWheel(b, radius, width, rimColor) {
  const hw = width / 2, sw = radius * 0.3;
  // tyre profile: [radius, along axle, v] ; v: 0 tread .. 1 sidewall
  const profile = [
    [radius - sw, -hw, 1], [radius - sw * 0.35, -hw, 0.82], [radius - 0.012, -hw + 0.02, 0.6], [radius, -hw + 0.05, 0.3],
    [radius, 0, 0], [radius, hw - 0.05, 0.3], [radius - 0.012, hw - 0.02, 0.6], [radius - sw * 0.35, hw, 0.82], [radius - sw, hw, 1],
  ];
  b.lathe([0, 0, 0], profile, 28, 'x', [0, 0, 0], MAT.RUBBER);
  // rim faces (both sides) with centred uv for the spoke pattern
  const rr = radius - sw;
  for (const side of [-1, 1]) {
    const x = side * (hw - 0.03);
    const centre = b.vertex(x, 0, 0, side, 0, 0, 0, 0, rimColor, MAT.RIM);
    const first = b.vertexCount;
    const seg = 20;
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      b.vertex(x, Math.cos(a) * rr, Math.sin(a) * rr, side, 0, 0, Math.cos(a), Math.sin(a), rimColor, MAT.RIM);
    }
    for (let k = 0; k < seg; k++) b.triFacing(centre, first + k, first + k + 1, side, 0, 0);
    // rim lip joining the tyre
    b.lathe([0, 0, 0], side > 0 ? [[rr, hw], [rr, hw - 0.03]] : [[rr, -hw + 0.03], [rr, -hw]], 20, 'x', [0.3, 0.3, 0.32], MAT.METAL, { inward: true });
  }
}

/** Build the whole car. Returns interleaved buffers plus index ranges for each part. */
export function buildCarMesh() {
  const b = new MeshBuilder(32768);
  const parts = {};
  const part = (name, fn) => {
    const first = b.indexCount;
    fn();
    parts[name] = { first, count: b.indexCount - first };
  };
  const G = CAR_GEOMETRY;
  part('body', () => buildBody(b));
  part('driver', () => buildDriver(b));
  part('steering', () => buildSteering(b));
  part('wheelFront', () => buildWheel(b, G.frontWheelRadius, G.frontWheelWidth, [0.62, 0.62, 0.64]));
  part('wheelRear', () => buildWheel(b, G.rearWheelRadius, G.rearWheelWidth, [0.62, 0.62, 0.64]));
  const mesh = b.finish();
  mesh.parts = parts;
  return mesh;
}
