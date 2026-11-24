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
  launchClosingSpeed: 15,        // DESIGN m/s of closing speed needed to ride over the car ahead (and the flight must be able to
                                 // carry the car past the other one: about 57 km/h with the values below, see flightPlan)
  launchMinSpeed: 50,            // DESIGN m/s, the follower must be at least this fast (E3: 73 m/s; E4, no launch: 29 to 41 m/s)
  launchOverlapMin: 0.2,         // DESIGN share of the width overlapping: the nose on a rear wheel, not nose to tail
  launchOverlapMax: 0.8,
  flightTimeCar: 0.85,           // MEASURED s (E3)
  flightTimeObstacle: 0.6,       // MEASURED s, by analogy (E5)
  airDecel: 13.9,                // MEASURED m/s^2 (50 km/h per second) while airborne
  airPeakHeight: 1.3,            // DESIGN m, height reached by the car in a 0.85 s flight (scaled with the square of the flight time)
  hardAfterCar: true,            // DESIGN a launch over a car ends in a hard landing (E3)
  hardAfterObstacle: false,      // DESIGN a launch over an obstacle ends in a light landing (E5)

  // ---- flights over a car (lot 5, a decision of the player: a car thrown in the air clears what threw it and comes
  // down ahead of it; before, it was held behind). All DESIGN. The flight is a free one: the car follows its
  // velocity and slows down as in any flight (airDecel). What is chosen at the take-off is how long it stays up:
  // the measured or designed time, or longer when that is what it takes to come down clear of the other car; and
  // the take-off only happens when its speed allows it to get past (see flightPlan in collisions.js).
  flightClearance: 0.5,          // m between the tail of the car that flew and the nose of the car it flew over, where it lands
  flightSideClearance: 0.4,      // m between the two cars side by side at the landing: the car is thrown a little to the side
                                 // it was already on, so that it does not come down in the path of the car it flew over
  flightTimeCarMax: 1.1,         // s: longest flight of the hard accident (0.85 s measured, more only when needed to get past)
  flightHoldTime: 0.12,          // s: the landing waits when the car is not past the other one yet although still gaining on it
  flightHoldMax: 0.5,            //    (that car sped up more than expected), or when a third car is under it: it stays up
                                 //    flightHoldTime longer, step after step, for at most flightHoldMax seconds

  // ---- recoverable hop: an ORIGINAL gameplay choice. Nothing like it is shown by the reference footage,
  // which only has the hard accident (E3) and the launch on an obstacle (E5). All values are DESIGN.
  // It comes from a contact between WHEELS and nothing else (lot 5): the front wheel of the car behind runs into
  // the back of a rear wheel of the car ahead (wheel-contacts.js), the bodies of the two cars not touching. Fast
  // enough, the wheel climbs the other one: the car flies over the car it touched, comes down ahead of it on its
  // wheels and drives on. A contact between bodies (nose against tail, nose against wheel, side by side) never lifts
  // a car into a hop: it stays a bump or a wheel rub, or becomes the hard accident under its own conditions.
  hopClosingSpeed: 10,           // m/s (36 km/h): relative speed below which the wheels never lift the car. The flight must
                                 // also be able to carry it past the other car: with the loss of speed of any flight
                                 // (airDecel) and the longest hop (hopFlightTimeMax), that takes about 56 km/h
  hopMinSpeed: 33,               // m/s (119 km/h): the car behind must be at least this fast
  hopAlignedCos: 0.94,           // angle: the two cars head within about 20 degrees of each other
  hopTyreOverlapMin: 0.04,       // m of tread in contact, seen from above: a tyre that only grazes the corner of another does not climb it
  hopFlightTime: 0.45,           // s in the air at least (the hard accident: 0.85 s)
  hopFlightTimeMax: 0.85,        // s at most: a slower arrival needs a longer flight to get past; beyond, no hop
  hopAirDecel: 13.9,             // m/s^2 lost in the air during a hop: the same as in any flight (airDecel). The hop costs
                                 // nothing at the shock and nothing at the landing: what it costs is the time spent in the air
  hopPeakHeight: 0.55,           // m at the top of the shortest hop; longer hops rise as the flight of the accident does
                                 // (airPeakHeight scaled with the square of the flight time), never lower than this
  hopLandingSpeedFactor: 1,      // share of its speed the car keeps as its wheels touch down (the hard accident: 0.15)
  hopWobbleTime: 0.7,            // s during which the steering is disturbed after the landing
  hopWobbleSteer: 0.3,           // peak of the disturbance, share of the steering travel
  hopWobbleSwings: 1,            // whole swings in that time (one: away from the car it touched, then back): they cancel
                                 // out, the car ends up heading as before, about half a metre to the side
  hopRearmTime: 1.5,             // s after such a landing during which the car cannot be thrown in the air again

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
