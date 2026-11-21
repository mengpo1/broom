// Solid roadside objects (boards standing on the verge). A car that runs into one knocks it
// down for the rest of the race; fast enough, it is thrown in the air (car-physics.js: startAirborne),
// otherwise it loses part of its speed.
// The list comes from the logical scenery layout of the track: position (s, d) and half width.

import { CAR_STATE, startAirborne } from './car-physics.js';
import { COLLISION_TUNING } from './collision-tuning.js';

/**
 * @param down  Uint8Array, one flag per obstacle: 1 = already knocked down in this race
 * @param emit  function(type, carIndex, value, otherIndex): 'obstacle' carries the impact speed and the obstacle index
 * @returns number of obstacles hit during this step
 */
export function collideObstacles(cars, track, obstacles, down, emit) {
  const T = COLLISION_TUNING, half = track.length / 2;
  let hits = 0;
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    if (car.removed || car.inPit || (car.state !== CAR_STATE.RACING && car.state !== CAR_STATE.SPIN)) continue;
    if (Math.abs(car.d) < track.halfWidth) continue;            // nothing stands on the asphalt
    const reachS = car.params.halfLength + T.obstacleHalfDepth, hw = car.params.halfWidth;
    for (let k = 0; k < obstacles.length; k++) {
      if (down[k]) continue;
      const o = obstacles[k];
      if (Math.abs(o.d - car.d) > hw + o.halfWidth) continue;
      let ds = o.s - car.s;
      if (ds > half) ds -= track.length; else if (ds < -half) ds += track.length;
      if (Math.abs(ds) > reachS) continue;
      down[k] = 1; hits++;
      const impact = car.state === CAR_STATE.SPIN ? Math.hypot(car.velX, car.velZ) : Math.abs(car.speed);
      if (emit) emit('obstacle', car.index, impact, k);
      if (car.state === CAR_STATE.RACING && car.speed >= T.obstacleLaunchSpeed) {
        startAirborne(car, T.flightTimeObstacle, T.hardAfterObstacle, emit, -1, o.d > car.d ? 1 : -1);
      } else if (car.state === CAR_STATE.RACING) {
        car.speed *= T.obstacleSpeedFactor;
        car.bumpClock = car.clock; car.bumpStrength = 1;
      } else { car.velX *= T.obstacleSpeedFactor; car.velZ *= T.obstacleSpeedFactor; }
    }
  }
  return hits;
}
