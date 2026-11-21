// Computer driver. Produces the same inputs as a human (steer, throttle, brake) and is run
// through the same physics. Follows the racing line with pure pursuit, tracks a target speed
// profile, negotiates traffic with rate-limited lateral moves, uses the pit lane and makes
// occasional mistakes. No rubber banding: the pace only depends on skill and car condition.

import { clamp, lerp, moveToward, smoothstep } from '../core/math.js';
import { Random } from '../core/random.js';
import { gripLimit } from '../vehicles/car-spec.js';
import { CAR_STATE, steeringLock } from '../physics/car-physics.js';
import { SURFACE, sampleArray, trackPose, relativeS } from '../tracks/track-builder.js';

const pose = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const EDGE_MARGIN = 1.15;
const SIDE_GAP = 2.1;          // lateral centre distance kept from a car alongside
const PASS_GAP = 2.5;          // lateral centre distance targeted while overtaking
const MISTAKE = { NONE: 0, LATE_BRAKE: 1, WIDE: 2, LIFT: 3 };

export function createAiController(skill, seed) {
  const rng = new Random(seed);
  return {
    skill, rng,
    offset: 0, passSide: 0, paceScale: 1,
    mistakeKind: MISTAKE.NONE, mistakeLeft: 0, mistakeSign: 1,
    mistakeTimer: 10 + rng.range(0, 40),
    startDelay: skill.reaction * rng.range(0.7, 1.3),
    pitDecisionLap: -1, holdBrake: false,
  };
}

function nextMistakeDelay(ai) {
  const rate = Math.max(0.02, ai.skill.mistakesPerMinute);
  return (-Math.log(1 - ai.rng.next() * 0.999) * 60) / rate;
}

/** Decide once per lap whether to stop for service. */
function decidePitStop(ai, car, race, rel) {
  const rules = race.rules, pit = race.track.pit;
  if (!rules.pitStops || car.isHuman || car.finished) return;
  if (ai.pitDecisionLap === car.lap || rel < pit.entryS - 420 || rel > pit.entryS - 240) return;
  ai.pitDecisionLap = car.lap;
  const lapsLeft = race.laps - car.lap - 1;
  if (lapsLeft < 1) return;
  const fuelPerLap = rules.fuel ? 100 / rules.fuelRangeLaps : 0;
  const lowFuel = rules.fuel && car.fuel < fuelPerLap * Math.min(lapsLeft + 0.3, 1.6);
  const worn = rules.wear && (car.puncture || car.tyreWear > 0.74);
  const damaged = rules.damage && car.damage > 0.55;
  if (lowFuel || worn || damaged) car.wantsPit = true;
}

export function updateAiController(ai, car, race, dt) {
  const track = race.track, skill = ai.skill;
  car.inShift = 0; car.inBoost = false; car.inReset = false;
  if (car.state !== CAR_STATE.RACING) { car.inSteer = 0; car.inThrottle = 0; car.inBrake = 0; return; }
  const v = Math.max(0, car.speed);
  const hw = track.halfWidth;
  const halfLength = track.length / 2;

  // ---- mistakes
  if (ai.mistakeLeft > 0) ai.mistakeLeft -= dt; else ai.mistakeKind = MISTAKE.NONE;
  ai.mistakeTimer -= dt;
  if (ai.mistakeTimer <= 0) {
    ai.mistakeTimer = nextMistakeDelay(ai);
    if (race.time > 8 && !car.inPit && !car.finished && !car.autoDrive) {
      ai.mistakeKind = 1 + ai.rng.int(0, 2);
      ai.mistakeLeft = ai.mistakeKind === MISTAKE.LIFT ? 0.7 : 2.2;
      ai.mistakeSign = ai.rng.chance(0.5) ? 1 : -1;
    }
  }

  // ---- reference path and speed
  const look = 6 + v * 0.28;
  const sLook = car.s + look;
  const lineD = sampleArray(track, track.line, sLook);
  let pace = skill.pace * ai.paceScale;
  if (car.finished) pace *= 0.55;
  if (ai.mistakeKind === MISTAKE.LATE_BRAKE) pace *= 1.08;
  let condition = Math.sqrt(1 - 0.2 * car.tyreWear * car.tyreWear);
  if (car.puncture) condition *= 0.72;
  if (race.rules.damage) condition *= 1 - 0.07 * car.damage;
  let vTarget = sampleArray(track, race.speedProfile, car.s + 3 + v * 0.06) * pace * condition;

  // ---- traffic
  let minD = -(hw - EDGE_MARGIN), maxD = hw - EDGE_MARGIN;
  let offsetTarget = ai.mistakeKind === MISTAKE.WIDE ? ai.mistakeSign * 1.7 : 0;
  let blocker = null, blockerGap = 1e9, follower = null, followerGap = 1e9;
  const horizon = 14 + v * 0.8;
  const cars = race.cars;
  for (let k = 0; k < cars.length; k++) {
    const o = cars[k];
    if (o === car || o.removed || o.inPit !== car.inPit || o.state === CAR_STATE.RESET || o.state === CAR_STATE.AIRBORNE) continue;      // a wreck is driven round like any stopped car
    let ds = o.s - car.s;
    if (ds > halfLength) ds -= track.length; else if (ds < -halfLength) ds += track.length;
    if (ds > -5.2 && ds < 5.2) {
      if (o.d > car.d) maxD = Math.min(maxD, o.d - SIDE_GAP); else minD = Math.max(minD, o.d + SIDE_GAP);
    } else if (ds >= 5.2 && ds < horizon) {
      if (ds < blockerGap) {
        const pathD = sampleArray(track, track.line, o.s) + ai.offset;
        if (Math.abs(o.d - pathD) < 2.3 || Math.abs(o.d - car.d) < 1.7) { blocker = o; blockerGap = ds; }
      }
    } else if (ds <= -5.2 && ds > -14 && -ds < followerGap) { follower = o; followerGap = -ds; }
  }
  if (blocker) {
    const blockerSpeed = blocker.state === CAR_STATE.RACING ? Math.max(0, blocker.speed * Math.cos(blocker.headingError)) : 0;
    const slow = blocker.state !== CAR_STATE.RACING || blockerSpeed < v * 0.6;
    if (v - blockerSpeed > -1.5 || slow) {
      const roomRight = hw - EDGE_MARGIN - (blocker.d + PASS_GAP - 0.2);
      const roomLeft = blocker.d - PASS_GAP + 0.2 + (hw - EDGE_MARGIN);
      if (ai.passSide === 0 || (ai.passSide > 0 ? roomRight : roomLeft) < 0) {
        const bias = (car.d - blocker.d) * 0.6;
        ai.passSide = roomRight + bias >= roomLeft - bias ? 1 : -1;
        if ((ai.passSide > 0 ? roomRight : roomLeft) < 0) ai.passSide = -ai.passSide;
      }
      const room = ai.passSide > 0 ? roomRight : roomLeft;
      if (room >= 0) offsetTarget = blocker.d + ai.passSide * PASS_GAP - sampleArray(track, track.line, blocker.s);
      if (Math.abs(blocker.d - car.d) < 2.05) {
        const gap = blockerGap - 4.6;
        const cushion = 1.5 + (1 - skill.aggression) * 3.5;
        vTarget = Math.min(vTarget, Math.max(slow ? 6 : 0, blockerSpeed + (gap - cushion) * 1.6));
      }
    }
  } else {
    ai.passSide = 0;
    // Defensive move: cover the inside of the next corner when someone is closing on a straight.
    if (follower && follower.speed > v + 1.5 && skill.aggression > 0.55 && Math.abs(track.kappa[car.segIndex]) < 0.002) {
      const ahead = track.lineKappa[(car.segIndex + Math.round(120 / track.ds)) % track.n];
      if (Math.abs(ahead) > 0.004) offsetTarget = Math.sign(ahead) * 1.6 * skill.aggression - lineD * 0.5;
    }
  }
  ai.offset = moveToward(ai.offset, offsetTarget, skill.lateralRate * dt);
  let dTarget = lineD + ai.offset;
  if (minD > maxD) dTarget = car.d; else dTarget = clamp(dTarget, minD, maxD);
  if (Math.abs(ai.offset) > 1 && Math.abs(track.lineKappa[car.segIndex]) > 0.004) {
    vTarget *= 1 - Math.min(0.06, Math.abs(ai.offset) * 0.012);
  }
  if (car.surface === SURFACE.GRASS || car.surface === SURFACE.GRAVEL) vTarget = Math.min(vTarget, 32);

  // ---- pit lane routing
  const pit = track.pit;
  const rel = relativeS(track, car.s);
  decidePitStop(ai, car, race, rel);
  if (race.rules.pitStops && (car.wantsPit || car.inPit)) {
    const edgeD = pit.side * (hw - 1.7), laneD = pit.side * pit.laneD;
    const relLook = rel + look * 0.8;
    if (car.wantsPit && !car.inPit && rel > pit.entryS - 230 && rel < pit.entryS) {
      dTarget = lerp(dTarget, edgeD, smoothstep(pit.entryS - 230, pit.entryS - 90, rel));
    }
    if (relLook >= pit.entryS && rel <= pit.exitS + 40 && (car.inPit || car.wantsPit)) {
      const tIn = smoothstep(pit.entryS, pit.wallStartS - 12, relLook);
      const tOut = smoothstep(pit.wallEndS + 12, pit.exitS + 30, relLook);
      dTarget = lerp(edgeD, laneD, Math.min(tIn, 1 - tOut));
      if (car.wantsPit) {
        const dist = car.pitBoxS - rel;
        if (dist < 34 && dist > -3) {
          dTarget = lerp(laneD, pit.side * pit.boxD, smoothstep(34, 12, dist - look * 0.5));
          vTarget = Math.min(vTarget, Math.sqrt(2 * 5 * Math.max(0, dist - 0.4)) + 0.5);
          if (dist < 1.6) ai.holdBrake = true;        // on the marks: stop completely so the crew can work
        } else if (dist <= -3) car.wantsPit = false;
      }
      ai.offset = dTarget - lineD;
    }
    if (car.wantsPit || car.inPit) {
      const toLimit = pit.wallStartS - 15 - rel;
      if (rel < pit.wallEndS && toLimit < 400) {
        vTarget = Math.min(vTarget, Math.sqrt(pit.speedLimit * pit.speedLimit * 0.92 + 2 * 11 * Math.max(0, toLimit)));
      }
    }
  }

  // ---- steering: pure pursuit toward the look-ahead point
  trackPose(track, sLook, dTarget, pose);
  const dx = pose.x - car.x, dz = pose.z - car.z;
  const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
  const side = -dx * sh + dz * ch;
  const curvature = (2 * side) / Math.max(dx * dx + dz * dz, 1);
  const lock = steeringLock(car.params, v, gripLimit(car.params, v, 1, 1));
  car.inSteer = clamp(Math.atan(car.params.wheelbase * curvature) / lock, -1, 1);

  // ---- pedals
  const err = vTarget - v;
  if (err >= 0) {
    car.inThrottle = clamp(0.25 + err * 0.45, 0, 1);
    car.inBrake = 0;
  } else {
    car.inThrottle = err > -1 ? 0.2 : 0;
    car.inBrake = clamp((-err - 0.5) * 0.3, 0, 1);
  }
  if (ai.holdBrake) { car.inThrottle = 0; car.inBrake = 1; ai.holdBrake = false; }
  if (ai.mistakeKind === MISTAKE.LIFT) car.inThrottle *= 0.2;
  if (race.time < ai.startDelay && !car.autoDrive) { car.inThrottle = 0; car.inBrake = 0; }
  if (car.params.profile.boost) {
    car.inBoost = Math.abs(track.lineKappa[car.segIndex]) < 0.002 && car.boostHeat < 0.7 && err > 3 && !car.inPit;
  }
}
