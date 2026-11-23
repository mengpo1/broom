// EXPERIMENTAL contacts between cars and the interactive trackside objects (tracks/trackside-objects.js).
// Called by the race only when its circuit has such objects, i.e. never in the normal game: the list
// is empty unless interactions are switched on. The validated braking boards keep their own code
// (obstacles.js) and are not in this list.
//
// The same rules for every car, driven by a player or by the computer. Deterministic: no random
// number, nothing but the state of the cars and of the objects.
//   BREAKABLE  the object goes down for the rest of the race, the car loses part of its speed
//   SOLID      the object stays; the car is stopped against it, or pushed aside when it only
//              catches it with a corner; a hard square hit ends in the existing spin
// No reaction throws a car in the air.

import { CAR_STATE, startSpin } from './car-physics.js';
import { TRACKSIDE_TUNING } from './trackside-tuning.js';
import { INTERACTION } from '../tracks/trackside-objects.js';

/** Move a car by (along, across) metres in the frame of the road where it is, world position included. */
function shiftCar(car, track, along, across) {
  const i = car.segIndex;
  car.x += track.tx[i] * along + track.nx[i] * across;
  car.z += track.tz[i] * along + track.nz[i] * across;
  car.s += along; car.d += across;
}

/** True when a car, wheels on the ground or in flight, fits under a structure with this clearance (m). */
export function passesUnder(clearance, car) {
  return (car.airHeight || 0) + TRACKSIDE_TUNING.carHeight < clearance;
}

/**
 * @param state     Uint8Array, one per object: 1 = knocked down in this race
 * @param cooldown  Float32Array, one per car: seconds before a rigid contact of that car is reported again
 * @param emit      function(type, carIndex, value, otherIndex): 'object' carries the impact speed and the object index
 * @returns number of contacts reported during this step
 */
export function collideTracksideObjects(cars, track, objects, state, cooldown, dt, emit) {
  const T = TRACKSIDE_TUNING, half = track.length / 2;
  let hits = 0;
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    if (cooldown[i] > 0) cooldown[i] -= dt;
    if (car.removed || car.inPit || (car.state !== CAR_STATE.RACING && car.state !== CAR_STATE.SPIN)) continue;
    if (Math.abs(car.d) < track.halfWidth - car.params.halfWidth) continue;       // nothing stands on the asphalt
    const hw = car.params.halfWidth, hl = car.params.halfLength;
    for (let k = 0; k < objects.length; k++) {
      if (state[k]) continue;
      const o = objects[k];
      const across = o.d - car.d, overlapAcross = hw + o.halfWidth - Math.abs(across);
      if (overlapAcross <= 0) continue;
      let along = o.s - car.s;
      if (along > half) along -= track.length; else if (along < -half) along += track.length;
      const overlapAlong = hl + o.halfDepth - Math.abs(along);
      if (overlapAlong <= 0) continue;
      const r = T.reactions[o.reaction];
      if (!r) continue;
      const spinning = car.state === CAR_STATE.SPIN;
      const impact = spinning ? Math.hypot(car.velX, car.velZ) : Math.abs(car.speed);
      if (r.kind === 'break' && o.profile === INTERACTION.BREAKABLE) {
        state[k] = 1; hits++;
        if (emit) emit('object', car.index, impact, k);
        if (spinning) { car.velX *= r.speedKeep; car.velZ *= r.speedKeep; }
        else { car.speed *= r.speedKeep; car.bumpClock = car.clock; car.bumpStrength = r.jolt; }
        continue;
      }
      // ---- rigid object: take the car out of the volume, by the shorter way
      const glancing = overlapAcross < r.glanceOverlap;
      const loud = impact > T.quietSpeed && cooldown[i] <= 0;
      if (glancing) {
        shiftCar(car, track, 0, -Math.sign(across || 1) * overlapAcross);
        if (spinning) { car.velX *= r.glanceKeep; car.velZ *= r.glanceKeep; }
        else if (loud) { car.speed *= r.glanceKeep; car.vLat = -Math.sign(across || 1) * Math.min(3, impact * 0.08); car.bumpClock = car.clock; car.bumpStrength = 0.7; }
        if (loud) { hits++; cooldown[i] = T.repeatDelay; if (emit) emit('object', car.index, impact * 0.5, k); }
        continue;
      }
      // square hit: back to the face of the object, most of the speed lost
      const forward = spinning ? Math.sign(along || 1) : Math.sign(car.speed || 1) * Math.sign(Math.cos(car.headingError) || 1);
      shiftCar(car, track, -Math.sign(along || forward) * overlapAlong, 0);
      if (spinning) { car.velX *= r.stopKeep; car.velZ *= r.stopKeep; }
      else {
        car.speed *= r.stopKeep; car.yawRate *= 0.3;
        if (loud) { car.bumpClock = car.clock; car.bumpStrength = 1; }
      }
      if (loud) {
        hits++; cooldown[i] = T.repeatDelay;
        if (emit) emit('object', car.index, impact, k);
        if (!spinning && impact >= r.spinSpeed) startSpin(car, impact * 0.35, across >= 0 ? -1 : 1, emit);
      }
    }
  }
  return hits;
}
