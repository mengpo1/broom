// Parameters of the arcade collision model: contacts between cars, roadside obstacles, flights
// and landings. Kept apart from the driving profiles (car-spec.js): nothing here changes how a
// car accelerates, brakes, steers or grips in normal driving.
//
// Two kinds of numbers live here and must not be confused:
//  - MEASURED: read on a reference gameplay video (docs/research/vroom-gameplay-analysis.md).
//    They are approximate (25 fps footage of a ~18 fps game), not historical constants.
//  - DESIGN: thresholds the footage cannot give (one example of each accident). They are
//    choices, to be tuned by play-testing.

export const COLLISION_TUNING = {
  // ---- contacts on the ground
  contactSpeedLoss: 13.33,       // MEASURED m/s (48 km/h) lost by the car that runs into another (E4: 115 -> 67, 104 -> 56)
  sideContactLosses: 2,          // MEASURED a wheel-to-wheel side contact costs about twice that (E2: ~140 -> ~50 km/h)
  bumpSeparation: 13.33,         // DESIGN m/s: after a rear-end bump a player's car drives at least this much slower than the car
                                 // it hit (same value as the loss): the two always separate, and the next bump is a new,
                                 // visible contact. The loss is therefore 48 km/h plus the closing speed (E4: 48 when
                                 // following closely, 85 to 94 at about 40 km/h of closing speed).
  computerBumpSeparation: 0.5,   // DESIGN m/s: the same for computer-driven cars, which also brake by themselves behind a car;
                                 // a larger value makes a pack concertina (measured on full races)
  sideKick: 1.2,                 // DESIGN m/s of lateral velocity pushing two cars apart after a side contact
  penaltyCooldown: 1.0,          // DESIGN s between two speed penalties of the same car (rubbing sideways, or a computer car pushing)
  computerPenaltyScale: 0.3,     // DESIGN share of the fixed loss applied to computer-driven cars: the field keeps flowing (1 = same as the players)
  penaltyFloorSpeed: 5,          // DESIGN m/s: a penalty never brings a car below this
  alignedCos: 0.8,               // DESIGN cars heading within ~37 degrees of each other count as "same direction"
  contactDive: 0.065,            // MEASURED view dive at a contact, fraction of the view height (5 to 8 %)
  contactDiveIn: 0.16,           // MEASURED s to reach it
  contactDiveOut: 0.24,          // MEASURED s to come back
  sparkLife: 0.16,               // MEASURED s (E2)

  // ---- roadside obstacles (boards)
  obstacleSpeedFactor: 0.6,      // DESIGN share of its speed a car keeps when it knocks a board down below the launch speed
  obstacleLaunchSpeed: 40,       // DESIGN m/s above which hitting a board throws the car in the air (E5 happened at 67 m/s)
  obstacleHalfDepth: 0.35,       // DESIGN m, thickness of a board along the track

  // ---- launches
  launchClosingSpeed: 15,        // DESIGN m/s of closing speed needed to ride over the car ahead
  launchMinSpeed: 50,            // DESIGN m/s, the follower must be at least this fast (E3: 73 m/s; E4, no launch: 29 to 41 m/s)
  launchOverlapMin: 0.2,         // DESIGN share of the width overlapping: wheel over wheel, not nose to tail
  launchOverlapMax: 0.8,
  flightTimeCar: 0.85,           // MEASURED s (E3)
  flightTimeObstacle: 0.6,       // MEASURED s, by analogy (E5)
  airDecel: 13.9,                // MEASURED m/s^2 (50 km/h per second) while airborne
  airPeakHeight: 1.3,            // DESIGN m, height reached by the car in a 0.85 s flight (scaled with the square of the flight time)
  flightGapBehind: 0,            // MEASURED (E3: after the flight the cars that were hit are just ahead) m kept between the nose
                                 // of a car in flight and the tail of the car that launched it: it comes down behind it
  hardAfterCar: true,            // DESIGN a launch over a car ends in a hard landing (E3)
  hardAfterObstacle: false,      // DESIGN a launch over an obstacle ends in a light landing (E5)

  // ---- landings
  hardLandingSpeedFactor: 0.15,  // MEASURED 228 -> 35 km/h in one step
  hardLandingStopTime: 0.85,     // MEASURED s from the landing to standstill
  wreckHoldTime: 3.2,            // MEASURED s at standstill before the car restarts
  restartGhostTime: 2,           // DESIGN s during which the restarting car cannot be hit
  slideYawRate: 1.5,             // MEASURED rad/s, the car turns slowly while it slides after a light landing (~75 degrees in 0.84 s)
  slideDecelStart: 8.3,          // MEASURED m/s^2 (30 km/h per second) just after a light landing
  slideDecelEnd: 50,             // MEASURED m/s^2 (180 km/h per second) at the end of the slide
  slideDecelDelay: 0.6,          // MEASURED s before the deceleration starts to grow
  slideDecelRamp: 0.7,           // MEASURED s to reach the final deceleration
};
