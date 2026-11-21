// Movements of the view that stage contacts and accidents. Pure functions of the simulated state
// of the followed car (its own clock and the clocks of its last events): the same state always
// gives the same picture, whatever the display rate, and a paused race shows a still image.
// Values are fractions of the view height; positive = the nose goes down (the horizon rises).

import { COLLISION_TUNING } from '../../physics/collision-tuning.js';

/** Brief dive of the view after a contact that cost speed (rear-end bump, wheel contact, board). */
export function contactDive(car) {
  const T = COLLISION_TUNING;
  const t = car.clock - car.bumpClock;
  if (t < 0 || t >= T.contactDiveIn + T.contactDiveOut) return 0;
  const k = t < T.contactDiveIn ? t / T.contactDiveIn : 1 - (t - T.contactDiveIn) / T.contactDiveOut;
  return T.contactDive * k * (2 - k);          // eased: quick into the dive, soft out of it
}
