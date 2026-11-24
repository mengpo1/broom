// Car-to-car contacts: oriented boxes, separating axis test, equal-mass impulse response.
// The body of a car is its box. One contact is decided on the wheels instead (wheel-contacts.js): a front
// wheel running into the back of a rear wheel, the bodies not touching; it is the only one that can lift a
// car into a recoverable hop.

import { clamp } from '../core/math.js';
import { CAR_STATE, LANDING, placeCar, startSpin, startAirborne, startHop, putBackOnTrack } from './car-physics.js';
import { COLLISION_TUNING } from './collision-tuning.js';
import { wheelStrike } from './wheel-contacts.js';

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

/** Velocity of a car as the flights see it: a car in the air moves with its own velocity, whatever way it points. */
function motionOf(car, out) {
  if (car.state === CAR_STATE.AIRBORNE) { out[0] = car.velX; out[1] = car.velZ; return; }
  worldVelocity(car, out);
}

let field = null;                        // the cars of the step being resolved (for the flight plans)
let touched = new Uint8Array(32);         // per car: its body touched another car in this step
let apart = new Int16Array(256);          // pairs of cars close to each other whose bodies did not touch

/**
 * Resolve contacts between all cars. Returns the number of contacts handled.
 * @param emit  function(type, carIndex, value, otherIndex)
 * @param dt    length of the simulation step (s)
 * @param track the track (used only by the last resort of a flight that cannot end: the car is put back on it)
 */
export function resolveCarContacts(cars, rules, time, emit, dt = 1 / 120, track = null) {
  let count = 0, pairs = 0;
  const n = cars.length;
  field = cars;
  if (touched.length < n) touched = new Uint8Array(n);
  touched.fill(0, 0, n);
  // a car in flight comes down past the car it flew over, and never on another car
  for (let i = 0; i < n; i++) if (cars[i].state === CAR_STATE.AIRBORNE) holdLanding(cars[i], cars, dt, track, emit);
  // the bodies first
  for (let i = 0; i < n; i++) {
    const a = cars[i];
    if (!collidable(a)) continue;
    for (let j = i + 1; j < n; j++) {
      const b = cars[j];
      if (!collidable(b)) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx * dx + dz * dz > 30) continue;
      if (resolvePair(a, b, dx, dz, rules, time, emit)) {
        count++; touched[i] = 1; touched[j] = 1;
        if (!collidable(a)) break;          // thrown in the air by this contact: nothing else touches it in this step
      } else if (pairs + 2 <= apart.length) { apart[pairs++] = i; apart[pairs++] = j; }
    }
  }
  // then the wheels: only between cars whose bodies did not touch, and only for a car whose body touched nothing in
  // this step (whatever the order of the cars in the list, a contact between bodies comes before a wheel on a wheel)
  for (let k = 0; k < pairs; k += 2) {
    const i = apart[k], j = apart[k + 1], a = cars[i], b = cars[j];
    if (!collidable(a) || !collidable(b)) continue;
    if ((!touched[i] && wheelHop(a, b, rules, time, emit)) || (!touched[j] && wheelHop(b, a, rules, time, emit))) count++;
  }
  field = null;
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
        const partial = overlap >= T.launchOverlapMin && overlap <= T.launchOverlapMax;
        const side = (follower === a ? lateral : -lateral) > 0 ? 1 : -1;
        // the nose on a rear wheel at a high closing speed: the follower rides over the car ahead, takes off,
        // flies over it and comes down ahead of it (when its speed cannot carry it past, it does not take off)
        if (rules.crashes !== false && closing >= T.launchClosingSpeed && follower.speed >= T.launchMinSpeed
          && partial && rearmed(follower)) {
          const flight = flightPlan(follower, leader, field, T.flightTimeCar, T.flightTimeCarMax, T.airDecel, true);
          if (flight && startAirborne(follower, flight.time, T.hardAfterCar, emit, leader.index, side)) {
            follower.velX += flight.driftX; follower.velZ += flight.driftZ;
            countContact(follower, leader, time, emit, closing);
            contactDamage(follower, leader, closing, rules);
            return true;
          }
        }
        // (a contact between bodies never lifts a car into a recoverable hop: that takes a wheel on a wheel, see wheelHop)
        rearContact(follower, leader, closing, rules, time, emit);
        return true;
      }
    } else {
      // side by side: the wheels rub (E2). Tyres that come together sideways do not lift a car.
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
 * Overlap of the boxes of two cars along the axis where it is smallest (0 when they are apart), the
 * second car seen (dx, dz) metres from the first. `grow` (m) lengthens the first box at both ends.
 */
function boxOverlap(a, b, dx, dz, grow = 0) {
  const pa = a.params, pb = b.params;
  const ca = Math.cos(a.heading), sa = Math.sin(a.heading), cb = Math.cos(b.heading), sb = Math.sin(b.heading);
  let min = 1e9;
  for (let k = 0; k < 4; k++) {
    const ax = k === 0 ? ca : k === 1 ? -sa : k === 2 ? cb : -sb, az = k === 0 ? sa : k === 1 ? ca : k === 2 ? sb : cb;
    const ra = (pa.halfLength + grow) * Math.abs(ax * ca + az * sa) + pa.halfWidth * Math.abs(-ax * sa + az * ca);
    const rb = pb.halfLength * Math.abs(ax * cb + az * sb) + pb.halfWidth * Math.abs(-ax * sb + az * cb);
    const overlap = ra + rb - Math.abs(dx * ax + dz * az);
    if (overlap <= 0) return 0;
    if (overlap < min) min = overlap;
  }
  return min;
}

const flight = { time: 0, driftX: 0, driftZ: 0 };
const FLIGHT_SEARCH_STEP = 1 / 120, FLIGHT_PATH_STEP = 1 / 60;
const spot = new Float64Array(2);

/**
 * Where a car now in flight will be `t` seconds from now (written in `out`), as far as its flight tells: it follows
 * its velocity and slows down until it lands, then drives on at the speed it has left (a hop), stops in a short
 * distance (the hard accident) or slides (a launch on a roadside object). A car whose landing is waiting is taken
 * to go on as it does now.
 */
function placeOfFlight(o, t, out) {
  const T = COLLISION_TUNING, v = Math.hypot(o.velX, o.velZ);
  out[0] = o.x; out[1] = o.z;
  if (v < 1e-3) return;
  let reach;
  if (o.airWaiting) reach = v * t;
  else {
    const decel = o.airKind === LANDING.RECOVERABLE ? T.hopAirDecel : T.airDecel;
    const up = Math.min(t, Math.max(0, o.airDuration - o.airTime), v / decel), then = t - up, landing = v - decel * up;
    reach = v * up - 0.5 * decel * up * up;
    if (then > 0 && up < v / decel) {
      if (o.airKind === LANDING.RECOVERABLE) reach += landing * then;
      else {
        const start = o.airHard ? landing * T.hardLandingSpeedFactor : landing, slowing = o.airHard ? start / T.hardLandingStopTime : T.slideDecelStart;
        const moving = Math.min(then, start / slowing);
        reach += start * moving - 0.5 * slowing * moving * moving;
      }
    }
  }
  out[0] += (o.velX / v) * reach; out[1] += (o.velZ / v) * reach;
}

/**
 * Flight of a car over the car that throws it in the air: how long it stays up, and how much it is
 * thrown to the side. Returns null when its speed cannot carry it past the other car, or when no
 * free place to come down is found: there is then no take-off.
 *
 * The flight itself is free: the car follows its velocity and loses `decel` m/s every second. Past
 * the other car means its tail ahead of the nose of that car by flightClearance. Whether it can get
 * past is judged on the speed the other car has now (a rule a driver can read: so many km/h of
 * closing speed). The time in the air is `baseTime`, or longer (up to `maxTime`) when that is what
 * getting past takes, the other car going on as it does now (its speed, and its acceleration when it
 * is speeding up); then longer still, step by step, until the place where the car comes down is free
 * of every car of the field, each one going on at its present velocity, and each car already in
 * flight following its own flight (placeOfFlight): two cars thrown in the air almost together are not
 * sent to the same place. The landing can still wait if a car changes its speed or its line meanwhile
 * (holdLanding).
 * With `aside` (a flight that ends with the car stopped: the hard accident), the car also goes to
 * one side, just enough to come down beside the path of the other car (flightSideClearance between
 * the two) and not in front of it: the side where it would come down anyway, the sideways motion of
 * the other car counted.
 */
function flightPlan(car, other, cars, baseTime, maxTime, decel, aside) {
  const T = COLLISION_TUNING;
  worldVelocity(car, va); worldVelocity(other, vb);
  const speed = Math.hypot(va[0], va[1]);
  if (speed < 1) return null;
  const ux = va[0] / speed, uz = va[1] / speed;
  const otherAlong = vb[0] * ux + vb[1] * uz, otherAcross = -vb[0] * uz + vb[1] * ux;
  const closing = speed - otherAlong;
  const distance = (other.x - car.x) * ux + (other.z - car.z) * uz + car.params.halfLength + other.params.halfLength + T.flightClearance;
  let time = baseTime;
  if (distance > 0) {
    // distance gained on the other car after t seconds: closing * t - loss * t^2 / 2
    const root = closing * closing - 2 * decel * distance;
    if (closing <= 0 || root < 0) return null;
    if ((decel > 0 ? (closing - Math.sqrt(root)) / decel : distance / closing) > maxTime) return null;
    // the same with the other car speeding up as it does now; if it then cannot be passed, up until it stops gaining
    const loss = decel + Math.max(0, other.accelLong || 0), rootNow = closing * closing - 2 * loss * distance;
    const first = loss > 0 ? (rootNow >= 0 ? (closing - Math.sqrt(rootNow)) / loss : closing / loss) : distance / closing;
    const last = loss > 0 && rootNow >= 0 ? (closing + Math.sqrt(rootNow)) / loss : Infinity;      // after this the other car would have caught it up
    time = Math.min(Math.max(baseTime, first), last, maxTime);
  }
  const side = -(car.x - other.x) * uz + (car.z - other.z) * ux;         // metres to the right of the other car, across the motion
  const room = car.params.halfWidth + other.params.halfWidth + T.flightSideClearance;
  for (; time <= maxTime + 1e-9; time += FLIGHT_SEARCH_STEP) {
    // where the car comes down after `time` seconds: along its motion, and to the side when it is thrown aside
    const reach = speed * time - 0.5 * decel * time * time;
    let shift = 0;
    if (aside) {
      const free = side - otherAcross * time;                            // where it would be, across, relative to the other car
      if (Math.abs(free) < room) shift = (free > 0 || (free === 0 && side >= 0) ? room : -room) - free;
    }
    const lx = car.x + ux * reach - uz * shift, lz = car.z + uz * reach + ux * shift;
    let clear = true;
    for (let i = 0; i < cars.length && clear; i++) {
      const o = cars[i];
      if (o === car || o.removed || o.inPit || o.state === CAR_STATE.RESET) continue;
      let dx, dz, margin = T.flightClearance * 0.5;
      if (o.state === CAR_STATE.AIRBORNE) { placeOfFlight(o, time, spot); dx = spot[0] - lx; dz = spot[1] - lz; margin += T.flightClearance; }   // (less sure: more room)
      else { worldVelocity(o, vb); dx = o.x + vb[0] * time - lx; dz = o.z + vb[1] * time - lz; }
      if (dx * dx + dz * dz <= 36 && boxOverlap(car, o, dx, dz, margin) > 0) clear = false;
    }
    if (!clear) continue;
    const travel = time - (0.5 * decel * time * time) / speed;           // the sideways speed fades with the speed of the car
    const drift = shift / Math.max(0.1, travel);
    // and on the way there it does not go through a car already in flight (seen from above: two cars in the air at the
    // same place would be in each other as surely as on the ground). A longer flight follows the same path: no take-off
    for (let i = 0; i < cars.length; i++) {
      const o = cars[i];
      if (o === car || o.removed || o.state !== CAR_STATE.AIRBORNE) continue;
      const far = (o.x - car.x) * (o.x - car.x) + (o.z - car.z) * (o.z - car.z);
      if (far > 14400) continue;
      for (let t = FLIGHT_PATH_STEP; t < time; t += FLIGHT_PATH_STEP) {
        const along = speed * t - 0.5 * decel * t * t, across = drift * (t - (0.5 * decel * t * t) / speed);
        placeOfFlight(o, t, spot);
        const dx = spot[0] - (car.x + ux * along - uz * across), dz = spot[1] - (car.z + uz * along + ux * across);
        if (dx * dx + dz * dz <= 36 && boxOverlap(car, o, dx, dz, T.flightClearance) > 0) return null;
      }
    }
    flight.time = time; flight.driftX = -uz * drift; flight.driftZ = ux * drift;
    return flight;
  }
  return null;
}

/**
 * Recoverable hop. The front wheel of `follower` has just run into the back of a rear wheel of
 * `leader` (wheel-contacts.js), fast enough, the two cars heading the same way, and the flight can
 * carry it past: it takes off. Called only when the bodies of the two cars do not touch.
 */
function wheelHop(follower, leader, rules, time, emit) {
  const T = COLLISION_TUNING;
  if (rules.crashes === false || follower.state !== CAR_STATE.RACING || leader.state !== CAR_STATE.RACING) return false;
  if (follower.speed < T.hopMinSpeed || leader.speed <= 0 || !rearmed(follower)) return false;
  if (time - follower.lastContactTime < T.hopAfterContactTime) return false;      // its body has just touched a car
  const cl = Math.cos(leader.heading), sl = Math.sin(leader.heading);
  if (Math.cos(follower.heading) * cl + Math.sin(follower.heading) * sl < T.hopAlignedCos) return false;
  worldVelocity(follower, va); worldVelocity(leader, vb);
  const closing = (va[0] - vb[0]) * cl + (va[1] - vb[1]) * sl;           // speed at which the wheel arrives on the other, along the car ahead
  if (closing < T.hopClosingSpeed) return false;
  const side = wheelStrike(follower, leader, T.hopTyreOverlapMin);
  if (!side) return false;
  const plan = flightPlan(follower, leader, field, T.hopFlightTime, T.hopFlightTimeMax, T.hopAirDecel, false);
  if (!plan || !startHop(follower, emit, leader.index, side, plan.time)) return false;
  countContact(follower, leader, time, emit, closing);
  contactDamage(follower, leader, closing, rules);
  return true;
}

/**
 * The landing of a car in flight waits when it has to, for a limited time, and the car is never set down in another one.
 *
 * Its time in the air is planned so that it comes down past the car that threw it up, in a place free of every
 * car (flightPlan). In the last moments of the flight that place is looked at again. The car stays up, at the
 * height it has then:
 *  - if it would not be past the other car yet while still gaining on it (that car sped up more than expected):
 *    for at most flightHoldMax seconds;
 *  - if a car is under it or would be where it lands (a car changed its speed or its line during the flight).
 *
 * In the second case it does not simply wait for that car to leave: a car that keeps pace with it would hold it up
 * for as long as it likes. While a car is below, the car in flight GETS CLEAR OF IT: its speed along its path is
 * kept at least flightYieldSpeed away from the speed of every car below. Left to itself it goes on losing speed as
 * in any flight; when that would bring it within that margin of a car below, it takes the nearest speed that does
 * not: just above (it holds its speed and passes that car; over a stopped car it glides on at that speed) or just
 * below (it lets that car go; below a car that crawls or has stopped, that can mean drifting back off it). It is
 * never faster than when the wait began, apart from that slow glide; and once it has let a car go it never goes
 * faster again while something is below, so that a car cannot make it go to and fro. Whatever a car below does,
 * it is therefore passed or let go within about a second (two lengths of car at that difference of speed, twice
 * that if the car changed its mind once), and nothing is moved by hand: the car in flight goes on moving by its
 * own velocity, the cars below are not touched.
 *
 * Cars can still take turns under it. All the waits of a flight together are limited to flightWaitMax: beyond,
 * as a last resort, the car is put back on the track on a free place (putBack), as a car that has left the road
 * is. It is not set down where it is: that could be in another car.
 */
function holdLanding(car, cars, dt, track, emit) {
  const T = COLLISION_TUNING, left = car.airDuration - car.airTime;
  if (!car.airHold && left >= T.flightHoldTime) return;
  const decel = car.airKind === LANDING.RECOVERABLE ? T.hopAirDecel : T.airDecel;
  // its line of travel, and its speed along it (negative when it is drifting back off a slow car below)
  const v = Math.hypot(car.velX, car.velZ);
  if (v > 1e-3) { const k = (car.airBack ? -1 : 1) / v; car.airDirX = car.velX * k; car.airDirZ = car.velZ * k; }
  const ux = car.airDirX, uz = car.airDirZ, speed = car.airBack ? -v : v;
  // left to itself it goes on losing speed; where it will be when it lands: at the end of the step in which its time
  // in the air runs out, `ahead` seconds from now (a whole number of steps: the cars are looked at where they will be then)
  const natural = speed > 0 ? Math.max(0, speed - decel * dt) : Math.min(0, speed + decel * dt);
  const ahead = Math.max(1, Math.ceil(left / dt - 1e-6)) * dt;
  const travel = speed > 0 ? Math.max(0, speed * ahead - 0.5 * decel * ahead * ahead) : Math.min(0, speed * ahead + 0.5 * decel * ahead * ahead);
  const lx = car.x + ux * travel, lz = car.z + uz * travel;
  // not past the car that threw it up yet, though still gaining on it
  let wait = false;
  const other = car.launchOther >= 0 ? cars[car.launchOther] : null;
  if (speed >= 1 && other && other !== car && !other.removed && car.airTime - car.airPlanned < T.flightHoldMax) {
    motionOf(other, vb);
    const along = vb[0] * ux + vb[1] * uz;
    const behind = (other.x + vb[0] * ahead - lx) * ux + (other.z + vb[1] * ahead - lz) * uz + car.params.halfLength + other.params.halfLength + T.flightClearance * 0.8;   // > 0: not past it yet
    wait = behind > 0 && speed - decel * ahead - along > 0.5;
  }
  // the cars under it now, or where it will land (it only starts coming down once nothing is below), and how fast they go along its line
  let below = 0;
  for (let i = 0; i < cars.length; i++) {
    const o = cars[i];
    if (o === car || o.removed || o.inPit || o.state === CAR_STATE.RESET) continue;
    const nx = o.x - car.x, nz = o.z - car.z;
    if (nx * nx + nz * nz > 1600) continue;
    motionOf(o, vb);
    let under = nx * nx + nz * nz <= 30 && boxOverlap(car, o, nx, nz, T.flightClearance * 0.5) > 0;
    if (!under) {
      const dx = o.x + vb[0] * ahead - lx, dz = o.z + vb[1] * ahead - lz;
      under = dx * dx + dz * dz <= 30 && boxOverlap(car, o, dx, dz, T.flightClearance * 0.5) > 0;
    }
    if (!under) continue;
    if (below < paces.length) paces[below++] = vb[0] * ux + vb[1] * uz;
  }
  if (!below && !wait) { car.airWaiting = false; car.airMode = 0; return; }
  // the landing is put off again by flightHoldTime
  if (!car.airWaiting) { car.airHold = Math.max(car.airHeight, 0.05); car.airWaiting = true; car.airMode = 0; car.airCap = Math.max(speed, T.flightYieldSpeed); }
  car.airWaited += dt;
  if (car.airWaited > T.flightWaitMax) { putBack(car, cars, track, emit); return; }
  // its speed for the next step: its own if that keeps it clear of the speed of every car below; otherwise the nearest
  // speed that does, just above (it holds its speed and passes them, if that is no faster than it may go: airCap) or
  // just below (it lets them go, and from then on never goes faster than that: airCap comes down with it)
  let next = Math.min(natural, car.airCap);
  car.airMode = 0;
  if (below && paced(next, below, T.flightYieldSpeed)) {
    const over = clearOf(next, below, T.flightYieldSpeed, 1), under = clearOf(next, below, T.flightYieldSpeed, -1);
    if (over <= car.airCap + 1e-9 && over - next <= next - under) { car.airMode = 1; next = over; } else { car.airMode = -1; next = under; car.airCap = under; }
  }
  car.airSpeed = next;                                                  // (applied by the next step of the car: it moves by its velocity, as ever)
  // and the arc is stretched so that the car stays at the height it has as the wait begins (each time it begins); it
  // comes down from there, in that same time, once the way is clear
  car.airDuration = car.airTime + T.flightHoldTime;
  const u = Math.min(0.999, (car.airTime + dt) / car.airDuration);      // share of the flight done at the next step, where the height is read
  car.airPeak = car.airHold / (4 * u * (1 - u));
}

const paces = new Float64Array(24);        // speeds, along the line of a car in flight, of the cars below it

/** Is `speed` within `margin` of the speed of one of the first `n` cars below? */
function paced(speed, n, margin) {
  for (let i = 0; i < n; i++) if (speed > paces[i] - margin + 1e-9 && speed < paces[i] + margin - 1e-9) return true;
  return false;
}
/** The nearest speed above (`way` = 1) or below (-1) `speed` that is at least `margin` away from the speed of every car below. */
function clearOf(speed, n, margin, way) {
  for (let pass = 0; pass <= n; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) if (speed > paces[i] - margin + 1e-9 && speed < paces[i] + margin - 1e-9) { speed = paces[i] + way * margin; moved = true; }
    if (!moved) break;
  }
  return speed;
}

/** Is the place where `car` stands clear of every other car, with a length of margin ahead and behind? */
function standsClear(car, cars) {
  for (let i = 0; i < cars.length; i++) {
    const o = cars[i];
    if (o === car || o.removed) continue;
    const dx = o.x - car.x, dz = o.z - car.z;
    if (dx * dx + dz * dz <= 100 && boxOverlap(car, o, dx, dz, 2 * car.params.halfLength) > 0) return false;
  }
  return true;
}

/**
 * Last resort of a flight whose landing has waited flightWaitMax in all: the car is taken out of the air and put
 * back on the track, stationary, on the nearest free place behind where it is (its own line first, then the middle
 * of the road, then either side), as a car that has left the road is (same protection, same event). Always done:
 * returns true.
 */
function putBack(car, cars, track, emit) {
  if (track) {
    const s0 = car.s, room = Math.max(0, track.halfWidth - car.params.halfWidth - 0.5);
    const own = clamp(car.d, -room, room);
    for (let k = 0; k < 160; k++) {
      for (let lane = 0; lane < 4; lane++) {
        placeCar(car, track, s0 - k * 1.5, lane === 0 ? own : lane === 1 ? 0 : lane === 2 ? room * 0.6 : -room * 0.6);
        if (standsClear(car, cars)) { putBackOnTrack(car, track, car.s, car.d, emit); return true; }
      }
    }
    putBackOnTrack(car, track, s0, 0, emit);          // (a road full of cars for 240 m: where any car is put back)
    return true;
  }
  // (called without a track, which the game never does: straight back along its line, to the first free place)
  const x0 = car.x, z0 = car.z;
  for (let k = 1; k < 160; k++) {
    car.x = x0 - car.airDirX * k * 1.5; car.z = z0 - car.airDirZ * k * 1.5;
    if (standsClear(car, cars)) break;
  }
  car.velX = 0; car.velZ = 0; car.speed = 0; car.vLat = 0; car.yawRate = 0; car.airHeight = 0;
  car.airWaiting = false; car.airMode = 0; car.airBack = false; car.rearmClock = car.clock;
  car.state = car.engineOut ? CAR_STATE.RETIRED : CAR_STATE.RACING; car.ghostTimer = 2.5; car.stuckTimer = 0; car.resets++;
  if (emit) emit('reset', car.index, 0);
  return true;
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
