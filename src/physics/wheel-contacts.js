// Wheels of a car in the collision model, and the one contact between two cars that is decided on
// the wheels themselves: the front wheel of a car running into the back of a rear wheel of another.
//
// The body of a car is the box of the collision model (car-spec.js: collisionHalfLength, collisionHalfWidth).
// The tyres stand out of it sideways by about a hand's width, as on the drawing of the car: a contact
// between two tyres can therefore happen while the two boxes do not touch. That contact, and no other,
// can lift the car behind into a recoverable hop (collisions.js).
//
// The figures below are those of the collision model. They are the same as on the drawing of the car
// (art/vehicles/car-model.js, CAR_DIMENSIONS): a test compares the two, the simulation never reads the drawing.

/** Car frame: x forward from the centre of the car, y to its right. Metres. */
export const WHEEL_LAYOUT = {
  frontAxleX: 1.55, rearAxleX: -1.35,                 // axles (the wheelbase of car-spec.js: 2.9 m)
  frontTrack: 0.9, rearTrack: 0.82,                   // centre of a tyre to the centre line of the car
  frontTyre: { radius: 0.325, width: 0.29 },          // seen from above a tyre is a rectangle: 2 x radius long, `width` wide
  rearTyre: { radius: 0.33, width: 0.42 },
};

/** Corners of the wheel rectangles of a car, for tests and diagrams: [{ name, cx, cz, halfLength, halfWidth }] in the world. */
export function wheelRectangles(car, layout = WHEEL_LAYOUT) {
  const f = Math.cos(car.heading), g = Math.sin(car.heading), out = [];
  for (const [name, ax, track, tyre] of [['front', layout.frontAxleX, layout.frontTrack, layout.frontTyre], ['rear', layout.rearAxleX, layout.rearTrack, layout.rearTyre]]) {
    for (const side of [1, -1]) {
      out.push({ name: `${name}.${side > 0 ? 'right' : 'left'}`, cx: car.x + f * ax - g * side * track, cz: car.z + g * ax + f * side * track, halfLength: tyre.radius, halfWidth: tyre.width / 2, heading: car.heading });
    }
  }
  return out;
}

/**
 * Has a front wheel of `a` just run into the BACK of a rear wheel of `b`?
 *
 * Yes when, seen from above, the two tyres overlap now, one step earlier the front wheel was still
 * entirely behind the rear face of that rear wheel, and at the instant its leading edge crossed the
 * plane of that face it was in line with the rear tyre: it came from behind and went in through the
 * back. Two tyres that come together sideways do not count, whatever the difference of speed between
 * the cars: their first contact is on their flanks. That includes a tyre arriving at an angle from
 * behind and from the side, which passes the plane of the back face beside the other tyre and only
 * then meets its flank.
 *
 * Positions one step earlier are the `prev` fields of the cars (written at the start of each step).
 * The front wheels are taken along the car: at the speeds where this matters the steering angle is
 * a few degrees at most and moves the corners of a tyre by about two centimetres.
 *
 * @param out  optional object receiving { side, wheel, overlap, depth }: side of `a` whose wheel hit
 *             (+1 right, -1 left), side of the wheel of `b` that was hit, width of tyre in contact (m),
 *             and how far the front wheel has gone in (m)
 * @returns +1 / -1 (side of `a` whose front wheel hit) or 0
 */
export function wheelStrike(a, b, minOverlap = 0, out = null, layout = WHEEL_LAYOUT) {
  const fa = Math.cos(a.heading), ga = Math.sin(a.heading), fb = Math.cos(b.heading), gb = Math.sin(b.heading);
  const pfa = Math.cos(a.prevHeading), pga = Math.sin(a.prevHeading), pfb = Math.cos(b.prevHeading), pgb = Math.sin(b.prevHeading);
  const fl = layout.frontTyre.radius, fw = layout.frontTyre.width / 2, rl = layout.rearTyre.radius, rw = layout.rearTyre.width / 2;
  // half extents of the front wheel of `a` along and across `b`, now and one step earlier
  const cosd = fa * fb + ga * gb, sind = ga * fb - fa * gb;
  const ex = fl * Math.abs(cosd) + fw * Math.abs(sind), ey = fl * Math.abs(sind) + fw * Math.abs(cosd);
  const pcosd = pfa * pfb + pga * pgb, psind = pga * pfb - pfa * pgb;
  const pex = fl * Math.abs(pcosd) + fw * Math.abs(psind);
  // half extents of the rear wheel of `b` along and across `a` (the two other axes of the overlap test)
  const bx = rl * Math.abs(cosd) + rw * Math.abs(sind), by = rl * Math.abs(sind) + rw * Math.abs(cosd);
  for (let sa = 1; sa >= -1; sa -= 2) {
    // centre of the front wheel of `a` on its side `sa`
    const ax = a.x + fa * layout.frontAxleX - ga * sa * layout.frontTrack, az = a.z + ga * layout.frontAxleX + fa * sa * layout.frontTrack;
    const pax = a.prevX + pfa * layout.frontAxleX - pga * sa * layout.frontTrack, paz = a.prevZ + pga * layout.frontAxleX + pfa * sa * layout.frontTrack;
    for (let sb = 1; sb >= -1; sb -= 2) {
      const bxc = b.x + fb * layout.rearAxleX - gb * sb * layout.rearTrack, bzc = b.z + gb * layout.rearAxleX + fb * sb * layout.rearTrack;
      const dx = ax - bxc, dz = az - bzc;
      // now: the two rectangles overlap (separating axes: along and across each car)
      const along = dx * fb + dz * gb, across = -dx * gb + dz * fb;
      const depth = rl + ex - Math.abs(along), overlap = rw + ey - Math.abs(across);
      if (depth <= 0 || overlap <= minOverlap) continue;
      if (bx + fl - Math.abs(dx * fa + dz * ga) <= 0 || by + fw - Math.abs(-dx * ga + dz * fa) <= 0) continue;
      // one step earlier: the front wheel entirely behind the rear face of the rear wheel
      const pbx = b.prevX + pfb * layout.rearAxleX - pgb * sb * layout.rearTrack, pbz = b.prevZ + pgb * layout.rearAxleX + pfb * sb * layout.rearTrack;
      const palong = (pax - pbx) * pfb + (paz - pbz) * pgb;
      if (along >= 0 || palong + pex > -rl + 1e-9) continue;
      // between the two: where it was, sideways, when its leading edge crossed the plane of that rear face
      const lead0 = palong + pex, lead1 = along + ex, share = lead1 > lead0 ? (-rl - lead0) / (lead1 - lead0) : 0;
      const pacross = -(pax - pbx) * pgb + (paz - pbz) * pfb, crossing = pacross + (across - pacross) * share;
      if (rw + ey - Math.abs(crossing) <= minOverlap) continue;
      if (out) { out.side = sa; out.wheel = sb; out.overlap = overlap; out.depth = depth; }
      return sa;
    }
  }
  return 0;
}
