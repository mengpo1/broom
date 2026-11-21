// Car-to-car contacts: oriented boxes, separating axis test, equal-mass impulse response.

import { clamp } from '../core/math.js';
import { CAR_STATE, startSpin, startAirborne } from './car-physics.js';
import { COLLISION_TUNING } from './collision-tuning.js';

/** Events emitted for a contact between two cars: `contact` always (sound, statistics), plus the kind when it has consequences. */
export const CONTACT = { SIMPLE: 'contact', REAR_BUMP: 'bump', WHEEL: 'wheel', LAUNCH: 'launch' };

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
  for (let i = 0; i < n; i++) {
    const a = cars[i];
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
        // wheel over wheel at a high closing speed: the follower rides over the car ahead and takes off
        if (rules.crashes !== false && closing >= T.launchClosingSpeed && follower.speed >= T.launchMinSpeed
          && overlap >= T.launchOverlapMin && overlap <= T.launchOverlapMax) {
          const side = (follower === a ? lateral : -lateral) > 0 ? 1 : -1;
          startAirborne(follower, T.flightTimeCar, T.hardAfterCar, emit, leader.index, side);
          countContact(follower, leader, time, emit, closing);
          contactDamage(follower, leader, closing, rules);
          return true;
        }
        rearContact(follower, leader, closing, rules, time, emit);
        return true;
      }
    } else {
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
 * Speed penalty of the car that ran into another: a fixed loss, at most once per cooldown
 * (reduced for computer-driven cars, see computerPenaltyScale).
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
 * Nose-to-tail contact. The follower loses a fixed amount of speed (and never stays faster than
 * the car it hit); the leader is nudged forward. No change of direction for either.
 */
function rearContact(follower, leader, closing, rules, time, emit) {
  const T = COLLISION_TUNING;
  const lost = penalise(follower, 1, Math.max(T.penaltyFloorSpeed, leader.speed - T.leaderMargin));
  if (lost > 0.5 && follower.bumpClock === follower.clock) {
    leader.speed += T.leaderPush;
    contactDamage(follower, leader, closing, rules);
    if (emit) emit(CONTACT.REAR_BUMP, follower.index, lost, leader.index);
  }
  follower.yawRate *= 0.5;
  countContact(follower, leader, time, emit, closing);
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
