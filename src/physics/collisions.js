// Car-to-car contacts: oriented boxes, separating axis test, equal-mass impulse response.

import { clamp } from '../core/math.js';
import { CAR_STATE, LANDING, startSpin, startAirborne, startHop } from './car-physics.js';
import { COLLISION_TUNING } from './collision-tuning.js';

/** Events emitted for a contact between two cars: `contact` always (sound, statistics), plus the kind when it has consequences. */
export const CONTACT = { SIMPLE: 'contact', REAR_BUMP: 'bump', WHEEL: 'wheel', LAUNCH: 'launch', HOP: 'hop' };

const axes = new Float64Array(8);

function collidable(car) {
  return (car.state === CAR_STATE.RACING || car.state === CAR_STATE.SPIN || car.state === CAR_STATE.RETIRED)
    && car.ghostTimer <= 0 && !car.inPit;
}

function worldVelocity(car, out) {
  if (car.state === CAR_STATE.SPIN) { out[0] = car.velX; out[1] = car.velZ; return; }
  const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
  out[0] = ch * car.speed - sh * car.vLat;
  out[1] = sh * car.speed + ch * car.vLat;
}

function applyVelocity(car, vx, vz) {
  if (car.state === CAR_STATE.SPIN) { car.velX = vx; car.velZ = vz; return; }
  const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
  car.speed = vx * ch + vz * sh;
  car.vLat = -vx * sh + vz * ch;
}

const va = new Float64Array(2), vb = new Float64Array(2);

/**
 * Resolve contacts between all cars. Returns the number of contacts handled.
 * @param emit function(type, carIndex, value, otherIndex)
 */
export function resolveCarContacts(cars, rules, time, emit) {
  let count = 0;
  const n = cars.length;
  // cars that have just come down from a hop first (whatever their place in the list): they are set
  // clear of the others and at their landing speed before any contact is looked for
  for (let i = 0; i < n; i++) if (cars[i].hopLanded) landHop(cars[i], cars);
  for (let i = 0; i < n; i++) {
    const a = cars[i];
    if (a.state === CAR_STATE.AIRBORNE && a.launchOther >= 0) {
      if (a.airKind === LANDING.RECOVERABLE) keepHopClear(a, cars); else holdFlightBehind(a, cars);
    }
    if (!collidable(a)) continue;
    for (let j = i + 1; j < n; j++) {
      const b = cars[j];
      if (!collidable(b)) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx * dx + dz * dz > 30) continue;
      if (resolvePair(a, b, dx, dz, rules, time, emit)) count++;
    }
  }
  return count;
}

function resolvePair(a, b, dx, dz, rules, time, emit) {
  const pa = a.params, pb = b.params;
  const ca = Math.cos(a.heading), sa = Math.sin(a.heading);
  const cb = Math.cos(b.heading), sb = Math.sin(b.heading);
  // axes: a forward, a right, b forward, b right
  axes[0] = ca; axes[1] = sa; axes[2] = -sa; axes[3] = ca;
  axes[4] = cb; axes[5] = sb; axes[6] = -sb; axes[7] = cb;
  let minOverlap = 1e9, nx = 0, nz = 0, minAxis = 0;
  for (let k = 0; k < 4; k++) {
    const ax = axes[k * 2], az = axes[k * 2 + 1];
    const ra = pa.halfLength * Math.abs(ax * ca + az * sa) + pa.halfWidth * Math.abs(-ax * sa + az * ca);
    const rb = pb.halfLength * Math.abs(ax * cb + az * sb) + pb.halfWidth * Math.abs(-ax * sb + az * cb);
    const dist = dx * ax + dz * az;
    const overlap = ra + rb - Math.abs(dist);
    if (overlap <= 0) return false;
    if (overlap < minOverlap) {
      minOverlap = overlap; minAxis = k;
      const sign = dist >= 0 ? 1 : -1;
      nx = ax * sign; nz = az * sign;
    }
  }
  // Separate (normal points from a to b).
  const push = minOverlap * 0.5 + 0.01;
  a.x -= nx * push; a.z -= nz * push;
  b.x += nx * push; b.z += nz * push;
  // Two cars driving in the same direction: arcade contacts, with explicit, testable outcomes.
  const T = COLLISION_TUNING;
  if (a.state === CAR_STATE.RACING && b.state === CAR_STATE.RACING && ca * cb + sa * sb > T.alignedCos && a.speed > 0 && b.speed > 0) {
    if ((minAxis & 1) === 0) {
      // separated along a car: nose to tail. The follower is the one behind.
      const follower = dx * ca + dz * sa > 0 ? a : b, leader = follower === a ? b : a;
      const closing = follower.speed - leader.speed;
      if (closing > 0.3) {
        const lateral = -dx * sa + dz * ca;                       // sideways offset of b seen from a
        const overlap = clamp((pa.halfWidth + pb.halfWidth - Math.abs(lateral)) / (2 * Math.min(pa.halfWidth, pb.halfWidth)), 0, 1);
        const wheelOverWheel = overlap >= T.launchOverlapMin && overlap <= T.launchOverlapMax;
        const side = (follower === a ? lateral : -lateral) > 0 ? 1 : -1;
        // wheel over wheel at a high closing speed: the follower rides over the car ahead and takes off
        if (rules.crashes !== false && closing >= T.launchClosingSpeed && follower.speed >= T.launchMinSpeed
          && wheelOverWheel && rearmed(follower)) {
          startAirborne(follower, T.flightTimeCar, T.hardAfterCar, emit, leader.index, side);
          countContact(follower, leader, time, emit, closing);
          contactDamage(follower, leader, closing, rules);
          return true;
        }
        // the same contact with less energy, or tyre against tyre at the very edge of the cars (less overlap than the
        // accident needs): a hop the car recovers from
        if (overlap > T.hopOverlapMin && overlap <= T.launchOverlapMax && hopEnergy(follower, closing, ca * cb + sa * sb, rules)) {
          startHop(follower, emit, leader.index, side, Math.abs(dx * ca + dz * sa), leader.speed);
          countContact(follower, leader, time, emit, closing);
          contactDamage(follower, leader, closing, rules);
          return true;
        }
        rearContact(follower, leader, closing, rules, time, emit);
        return true;
      }
    } else {
      // side by side. When the car behind has only its front wheel beside the rear wheel of the car ahead
      // and arrives fast enough, that wheel lifts it: a hop. Otherwise the wheels rub (E2).
      const along = dx * ca + dz * sa;                             // how far b is ahead of a
      const follower = along > 0 ? a : b, leader = follower === a ? b : a;
      const closing = follower.speed - leader.speed;
      const lengthwise = (pa.halfLength + pb.halfLength - Math.abs(along)) / (pa.halfLength + pb.halfLength);
      if (lengthwise <= T.hopSideOverlapMax && hopEnergy(follower, closing, ca * cb + sa * sb, rules)) {
        const lateral = -dx * sa + dz * ca, side = (follower === a ? lateral : -lateral) > 0 ? 1 : -1;
        startHop(follower, emit, leader.index, side, Math.abs(along), leader.speed);
        // thrown clear of the car it touched: it flies parallel to it, drifting away sideways
        const lh = leader.heading, fx = Math.cos(lh), fz = Math.sin(lh);
        const forward = follower.velX * fx + follower.velZ * fz;
        follower.velX = fx * forward + fz * side * T.hopSideKick;
        follower.velZ = fz * forward - fx * side * T.hopSideKick;
        countContact(follower, leader, time, emit, closing);
        contactDamage(follower, leader, closing, rules);
        return true;
      }
      sideContact(a, b, nx, nz, rules, time, emit);
      return true;
    }
  }
  worldVelocity(a, va); worldVelocity(b, vb);
  const rel = (vb[0] - va[0]) * nx + (vb[1] - va[1]) * nz;
  if (rel >= 0) return true;
  const restitution = Math.min(pa.profile.contactRestitution, pb.profile.contactRestitution);
  const impulse = (-(1 + restitution) * rel) / 2;
  const impact = -rel;
  // Tangential scrub: cars rubbing lose a little speed.
  const scrub = clamp(impact * 0.012, 0, 0.12);
  applyVelocity(a, (va[0] - nx * impulse) * (1 - scrub), (va[1] - nz * impulse) * (1 - scrub));
  applyVelocity(b, (vb[0] + nx * impulse) * (1 - scrub), (vb[1] + nz * impulse) * (1 - scrub));
  // Yaw kick from the contact offset along each car.
  const offA = (dx * 0.5) * ca + (dz * 0.5) * sa;
  const offB = (-dx * 0.5) * cb + (-dz * 0.5) * sb;
  const latA = -nx * sa + nz * ca, latB = -nx * sb + nz * cb;
  a.yawRate += clamp(-offA * latA * impulse * 0.035, -1.2, 1.2);
  b.yawRate += clamp(offB * latB * impulse * 0.035, -1.2, 1.2);
  if (time - a.lastContactTime > 0.4) { a.contacts++; if (emit) emit('contact', a.index, impact, b.index); }
  if (time - b.lastContactTime > 0.4) b.contacts++;
  a.lastContactTime = time; b.lastContactTime = time;
  contactDamage(a, b, impact, rules);
  if (rules.crashes !== false) {
    const limit = Math.min(pa.profile.carCrashImpact, pb.profile.carCrashImpact);
    if (impact > limit) {
      // The car carrying more speed into the contact loses control; both do in a very heavy hit.
      const intoA = va[0] * nx + va[1] * nz, intoB = -(vb[0] * nx + vb[1] * nz);
      const spinDir = nx * ca + nz * sa > 0 ? 1 : -1;
      if (intoA >= intoB || impact > limit * 1.5) startSpin(a, impact, spinDir, emit);
      if (intoB > intoA || impact > limit * 1.5) startSpin(b, impact, -spinDir, emit);
    }
  }
  return true;
}

/** Damage rule (competition): both cars are damaged according to the speed at which they met, whatever the kind of contact. */
function contactDamage(a, b, impact, rules) {
  if (!rules.damage) return;
  const dmg = Math.max(0, impact - 3) * 0.008;
  a.damage = Math.min(1, a.damage + dmg); b.damage = Math.min(1, b.damage + dmg);
}

function countContact(a, b, time, emit, impact) {
  if (time - a.lastContactTime > 0.4) { a.contacts++; if (emit) emit('contact', a.index, impact, b.index); }
  if (time - b.lastContactTime > 0.4) b.contacts++;
  a.lastContactTime = time; b.lastContactTime = time;
}

/**
 * Speed penalty of a car that ran into another: a fixed loss, at most once per cooldown
 * (reduced for computer-driven cars, see computerPenaltyScale), and never above `ceiling`.
 * Returns the speed lost (m/s).
 */
function penalise(car, losses, ceiling) {
  const T = COLLISION_TUNING;
  const before = car.speed;
  let after = before;
  if (car.clock - car.lastPenaltyClock >= T.penaltyCooldown) {
    after = before - losses * T.contactSpeedLoss * (car.isHuman && !car.autoDrive ? 1 : T.computerPenaltyScale);
    car.lastPenaltyClock = car.clock;
    car.bumpClock = car.clock; car.bumpStrength = losses;
  }
  if (after > ceiling) after = ceiling;
  const floor = Math.min(before, T.penaltyFloorSpeed);
  if (after < floor) after = floor;
  car.speed = after;
  return before - after;
}

/**
 * Nose-to-tail contact. The follower loses the contact loss and leaves the contact slower than
 * the car it hit: by a wide margin for a player (the two separate at once, so every bump is a
 * contact that can be seen: no pushing, no penalty without a new contact), by a narrow one for a
 * computer-driven car. The car ahead is not disturbed and neither car changes direction.
 */
function rearContact(follower, leader, closing, rules, time, emit) {
  const T = COLLISION_TUNING;
  const player = follower.isHuman && !follower.autoDrive;
  const lost = penalise(follower, 1, Math.max(T.penaltyFloorSpeed, leader.speed - (player ? T.bumpSeparation : T.computerBumpSeparation)));
  // a player's loss of speed is always a signalled bump; a computer car held behind another inside the cooldown is not one
  if (lost > 0.5 && (player || follower.bumpClock === follower.clock)) {
    follower.lastPenaltyClock = follower.clock;
    follower.bumpClock = follower.clock; follower.bumpStrength = 1;
    contactDamage(follower, leader, closing, rules);
    if (emit) emit(CONTACT.REAR_BUMP, follower.index, lost, leader.index);
  }
  follower.yawRate *= 0.5;
  countContact(follower, leader, time, emit, closing);
}

/** A car that has just come down from a hop cannot be thrown in the air again at once. */
function rearmed(car) { return car.clock - car.rearmClock >= COLLISION_TUNING.hopRearmTime; }

/**
 * Energy of a wheel-over-wheel contact that lifts the car behind without wrecking it: explicit
 * thresholds on the relative speed, the speed of the car and the angle between the two
 * (the geometry of the contact is checked by the caller).
 */
function hopEnergy(follower, closing, cosAngle, rules) {
  const T = COLLISION_TUNING;
  return rules.crashes !== false && closing >= T.hopClosingSpeed && follower.speed >= T.hopMinSpeed
    && cosAngle >= T.hopAlignedCos && rearmed(follower);
}

/** Overlap of the boxes of two cars along the axis where it is smallest (0 when they are apart); the push direction goes to `out`. */
function boxOverlap(a, b, out) {
  const pa = a.params, pb = b.params, dx = b.x - a.x, dz = b.z - a.z;
  const ca = Math.cos(a.heading), sa = Math.sin(a.heading), cb = Math.cos(b.heading), sb = Math.sin(b.heading);
  let min = 1e9;
  for (let k = 0; k < 4; k++) {
    const ax = k === 0 ? ca : k === 1 ? -sa : k === 2 ? cb : -sb, az = k === 0 ? sa : k === 1 ? ca : k === 2 ? sb : cb;
    const ra = pa.halfLength * Math.abs(ax * ca + az * sa) + pa.halfWidth * Math.abs(-ax * sa + az * ca);
    const rb = pb.halfLength * Math.abs(ax * cb + az * sb) + pb.halfWidth * Math.abs(-ax * sb + az * cb);
    const dist = dx * ax + dz * az, overlap = ra + rb - Math.abs(dist);
    if (overlap <= 0) return 0;
    if (overlap < min) { min = overlap; const sign = dist >= 0 ? 1 : -1; out[0] = ax * sign; out[1] = az * sign; }
  }
  return min;
}

const pushOut = new Float64Array(2);

/**
 * A car in a recoverable hop stays clear of the others: it does not gain ground on the car that
 * lifted it, and it is moved out of the way of any car it would come down into. Only the car in
 * flight is moved; nothing is taken from anyone's speed here.
 */
function keepHopClear(car, cars) {
  const other = cars[car.launchOther];
  const v = Math.hypot(car.velX, car.velZ);
  if (other && other !== car && !other.removed && v > 1) {
    const ux = car.velX / v, uz = car.velZ / v;
    const along = (other.x - car.x) * ux + (other.z - car.z) * uz;
    if (along < car.launchAlong) { car.x -= ux * (car.launchAlong - along); car.z -= uz * (car.launchAlong - along); }
  }
  for (let i = 0; i < cars.length; i++) {
    const o = cars[i];
    if (o === car || o.removed || o.inPit || (o.state !== CAR_STATE.RACING && o.state !== CAR_STATE.SPIN && o.state !== CAR_STATE.RETIRED && o.state !== CAR_STATE.WRECKED)) continue;
    const dx = o.x - car.x, dz = o.z - car.z;
    if (dx * dx + dz * dz > 30) continue;
    const overlap = boxOverlap(car, o, pushOut);
    if (overlap > 0) { car.x -= pushOut[0] * (overlap + 0.01); car.z -= pushOut[1] * (overlap + 0.01); }
  }
}

/**
 * Landing of a recoverable hop (called once, in the step where the car comes down): it is clear of
 * every other car, and slower than the car it rode over when that car is still racing, so that the
 * two separate as they do after a bump. That limit is a safeguard: the speed was already brought
 * to this value by the shock and the flight (startHop), so it only acts when the car ahead slowed
 * down while the other was in the air.
 */
function landHop(car, cars) {
  const T = COLLISION_TUNING;
  car.hopLanded = false;
  keepHopClear(car, cars);
  const other = cars[car.launchOther];
  if (other && other !== car && !other.removed && other.state === CAR_STATE.RACING) {
    const limit = Math.max(T.penaltyFloorSpeed, other.speed - T.hopSeparation);
    if (car.speed > limit) car.speed = limit;
  }
}

/**
 * A car thrown in the air by another one does not fly past it: it is carried behind the car it
 * rode over and comes down there (its own speed, shown to its driver, goes on falling as in any flight).
 */
function holdFlightBehind(car, cars) {
  const other = cars[car.launchOther];
  if (!other || other === car || other.removed) return;
  const v = Math.hypot(car.velX, car.velZ);
  if (v < 1) return;
  const ux = car.velX / v, uz = car.velZ / v;
  const along = (other.x - car.x) * ux + (other.z - car.z) * uz;
  const gap = car.params.halfLength + other.params.halfLength + COLLISION_TUNING.flightGapBehind;
  if (along > 0 && along < gap) { car.x -= ux * (gap - along); car.z -= uz * (gap - along); }
}

/**
 * Side-by-side contact (wheel against wheel on open-wheel cars). The faster car pays, both are
 * pushed apart sideways, neither is turned.
 */
function sideContact(a, b, nx, nz, rules, time, emit) {
  const T = COLLISION_TUNING;
  worldVelocity(a, va); worldVelocity(b, vb);
  const closing = Math.max(0, -((vb[0] - va[0]) * nx + (vb[1] - va[1]) * nz));       // speed at which the cars came together sideways
  const faster = a.speed >= b.speed ? a : b, other = faster === a ? b : a;
  const lost = penalise(faster, T.sideContactLosses, faster.speed);
  if (lost > 0.5) contactDamage(a, b, closing, rules);
  // the car that was hit is not made to pay in turn while the two are still side by side
  if (lost > 0.5) other.lastPenaltyClock = other.clock;
  // lateral axis of a car is (-sin h, cos h); the normal (nx, nz) points from a to b
  const la = -nx * Math.sin(a.heading) + nz * Math.cos(a.heading), lb = -nx * Math.sin(b.heading) + nz * Math.cos(b.heading);
  const awayA = la >= 0 ? -1 : 1, awayB = lb >= 0 ? 1 : -1;
  if (lost > 0.5) { a.vLat = awayA * T.sideKick; b.vLat = awayB * T.sideKick; }      // pushed apart once, at the contact that costs
  else {                                                                             // then only kept from leaning on each other
    if (a.vLat * awayA < 0) a.vLat = 0;
    if (b.vLat * awayB < 0) b.vLat = 0;
  }
  a.yawRate *= 0.5; b.yawRate *= 0.5;
  if (lost > 0.5 && emit) emit(CONTACT.WHEEL, faster.index, lost, other.index);
  countContact(faster, other, time, emit, Math.abs(a.speed - b.speed) + 2);
}

/**
 * Slipstream factor for every car (0..1), from the nearest car ahead inside a narrow cone.
 */
export function updateDrafts(cars) {
  const n = cars.length;
  for (let i = 0; i < n; i++) {
    const a = cars[i];
    a.draft = 0;
    if (a.state !== CAR_STATE.RACING || a.speed < 30) continue;
    const ch = Math.cos(a.heading), sh = Math.sin(a.heading);
    let best = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const b = cars[j];
      if (b.state !== CAR_STATE.RACING || b.speed < 20) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const ahead = dx * ch + dz * sh;
      if (ahead < 3 || ahead > 48) continue;
      const side = Math.abs(-dx * sh + dz * ch);
      if (side > 2) continue;
      const f = (1 - (ahead - 3) / 45) * (1 - side / 2);
      if (f > best) best = f;
    }
    a.draft = best;
  }
}
