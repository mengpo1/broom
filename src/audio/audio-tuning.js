// Tunable numbers of the procedural audio engine. Levels are linear gains, times are seconds,
// frequencies are hertz. Nothing here is measured from a real car: these are design choices.

export const AUDIO_TUNING = {
  mix: {
    volumeCurve: 2,            // exponent applied to the 0..1 volume settings (2 = perceptual)
    fadeTau: 0.045,            // time constant of bus fades (volume changes, pause, scene changes)
    suspendDelay: 0.25,        // the context is really suspended this long after suspend()
    detachDelay: 0.6,          // the race graph is unplugged this long after leaving the 'race' scene
    compressorThreshold: -15,  // dB
    compressorKnee: 9,         // dB
    compressorRatio: 5,
    compressorAttack: 0.004,
    compressorRelease: 0.2,
    postCompressor: 0.62,      // compensates the make-up gain of the compressor
    limiterKnee: 0.6,          // the safety limiter is linear below this level...
    limiterCeiling: 0.97,      // ...and never exceeds this one
    limiterRange: 2.5,         // input level mapped to the end of the limiter curve
    splitPan: 0.4,             // 2 players: player 1 at -splitPan, player 2 at +splitPan
    resultsCrowd: 0.75,        // crowd level on the results screen
  },

  engine: {
    rpmIdle: 3500,
    rpmMax: 13500,
    rpmFloor: 700,             // below this the engine is considered stopped
    cylinders: [10, 12],       // player 1 / player 2: firing frequency = rpm / 60 * cylinders / 2
    firingPartials: [1, 0.62, 0.42, 0.27, 0.17, 0.1],      // harmonics of the firing frequency
    halfPartials: [0.5, 0.3, 0.18, 0.11, 0.07, 0.04],      // odd multiples of half the firing frequency (bank to bank)
    roughness: 0.05,           // level of every other half engine order (cylinder to cylinder differences)
    pitchTau: 0.024,           // smoothing of the oscillator frequencies
    paramTau: 0.035,           // smoothing of gains and filters
    level: 0.5,                // overall level of a player engine
    levelOff: 0.36,            // closed throttle level relative to full throttle
    levelIdle: 0.55,           // idle rpm level relative to the limiter
    waveOff: 0.5, waveOn: 0.62,     // engine-order wavetable (fundamental = one 4-stroke cycle)
    sawOff: 0.1, sawOn: 0.42,       // saw at the firing frequency (the scream)
    growlOff: 0.2, growlOn: 0.3,    // saw at half the firing frequency
    subLevel: 0.2,                  // square at engine order 1 (mechanical body)
    sawDetune: 1.004, growlDetune: 0.995,
    driveOff: 0.45, driveOn: 2.4,   // gain in front of the distortion, closed / open throttle
    driveAsymmetry: 0.22,           // even harmonics of the distortion curve
    toneClosed: 500, toneTrackOff: 1.6,   // low-pass closed throttle: toneClosed + firing * toneTrackOff
    toneOpen: 5200, toneTrackOn: 6,       // low-pass open throttle: toneOpen + firing * toneTrackOn
    toneMax: 13000,
    bodyFrequency: 360, bodyGain: 5,      // fixed exhaust resonance (peaking, dB)
    formantBase: 1250, formantRange: 1300, formantQ: 1.3, formantGain: 10,  // presence peak, dB at full throttle
    barkLevel: 0.5, barkQ: 1.4, barkMin: 800, barkMax: 3400,  // band-pass at twice the firing frequency, opens with throttle
    raspLevel: 0.2,            // noise mixed in front of the distortion (rasp)
    intakeLevel: 0.2, intakeBase: 1700, intakeRange: 2600, intakeQ: 1.3,
    burbleLevel: 0.85, burbleRate: 0.011, burbleThreshold: 0.5, burbleFrequency: 330, burbleMinRev: 0.22,
    flutterCents: 7,           // slow random pitch flutter
    limiterRate: 23,           // stutter frequency when on the rev limiter
    limiterDepth: 0.42,        // gain swings between 1 - 2 * depth and 1
    limiterWobble: 35,         // cents of pitch wobble on the limiter
    shiftCutTime: 0.075, shiftCutDepth: 0.14, shiftCutAttack: 0.006, shiftCutRelease: 0.02,
    shiftDipCents: 170,        // pitch dip of an upshift
    shiftBlipCents: 230,       // throttle blip of a downshift
    turboLevel: 0.085, turboBase: 2900, turboRange: 3400, turboSpool: 0.16, turboNoise: 0.9,
  },

  opponents: {
    voices: 4,
    cylinders: [12, 10, 8],    // engine layouts, picked from the car index
    level: 0.55,
    levelOff: 0.4, levelIdle: 0.5,
    waveLevel: 0.6, sawLevel: 0.36,
    refDistance: 7,            // m, full level inside this radius
    rolloff: 0.55,             // inverse distance attenuation factor
    maxDistance: 240,          // m, inaudible beyond
    lateralWeight: 1.5,        // lateral metres count more than longitudinal ones when ranking cars
    keepBias: 0.8,             // distance factor favouring cars that already own a voice
    gainTau: 0.04, pitchTau: 0.035,
    stealLevel: 0.004,         // a released voice can be reused once its level is below this
    soundSpeed: 340,
    dopplerScale: 2.2,         // exaggeration of the relative speed
    dopplerMin: 0.72, dopplerMax: 1.36,
    dopplerSoftness: 36,       // m^2, softens the pitch flip while passing
    toneBase: 1300, toneThrottle: 7500, toneBehind: 0.55, toneDistance: 0.012, aheadSoftness: 8,
    panWidth: 3.5, panDepth: 0.12, panAmount: 0.95,
    shiftCut: 0.3, shiftCutTime: 0.07,
  },

  wind: {
    topSpeed: 95,
    level: 0.5, exponent: 1.9, lowFrequency: 220, highFrequency: 1500, q: 0.45,
    hissLevel: 0.2, hissExponent: 3, hissFrequency: 3400,
    buffet: 0.3, draftBuffet: 0.55, buffetRate: 0.0007,
    roadLevel: 0.55, roadLow: 70, roadHigh: 420,
    tau: 0.09,
  },

  tyres: {
    skidLevel: 0.34, slipMin: 0.22, slipFull: 1.15, speedMin: 3, speedFull: 16,
    frequency: 1020, frequencyRange: 330, q: 11, secondRatio: 1.62, secondLevel: 0.45,
    wobbleRate: 6.3, wobbleCents: 55, driftCents: 130,
    spinLevel: 0.85, spinPitch: 0.72,
    tau: 0.045,
  },

  surface: {
    kerbLevel: 0.65, kerbPitch: 1.7, kerbRateMin: 7, kerbRateMax: 58, kerbTone: 150, kerbNoise: 0.55, kerbNoiseFrequency: 340,
    grassLevel: 0.6, grassFrequency: 380,
    gravelLevel: 0.5, gravelFrequency: 1700, gravelCrackle: 0.02,
    speedMin: 1.5, speedFull: 30,
    wheelCircumference: 2.07,  // m, rate of the puncture flapping
    flapLevel: 0.5,
    tau: 0.03,
  },

  brake: { level: 0.2, frequency: 5200, q: 1.1, brakeMin: 0.45, speedMin: 14, speedFull: 60, tau: 0.05 },

  crowd: {
    level: 0.16,               // bed level far from any grandstand
    nearLevel: 0.6,            // extra level at the start/finish grandstand
    falloff: 170,              // m, size of a grandstand's audible zone
    stands: [0, 1, 0.37, 0.45, 0.68, 0.55],   // pairs: lap fraction, relative level
    swell: 0.35, swellMin: 1.4, swellMax: 4.5, swellRate: 0.6,
    countdownBoost: 1.2,
    lowFrequency: 520, midFrequency: 1150, highFrequency: 2500,
    textureRate: 0.00016, texture: 0.5,
    cheerAttack: 0.22, cheerHold: 1.1, cheerRelease: 0.9,
    cheerGreen: 0.9, cheerOvertake: 0.5, cheerFinish: 1, cheerOther: 0.45,
    tau: 0.25,
  },

  sfx: {
    maxActive: 28,             // one-shot graphs alive at once
    level: 0.9,
    lightFrequency: 587, lightTime: 0.13, greenFrequency: 1175, greenTime: 0.6, signalLevel: 0.3,
    uiLevel: 0.22,
    impactMinInterval: 0.09,   // s between two impact sounds of the same listener
    impactSpeedFull: 16,       // m/s giving the loudest impact
    scrapeSpeed: 1.6,          // below this an impact is only a scrape
    hearingDistance: 130,      // m, events of other cars are audible inside this radius
    hearingRef: 10,
    panWidth: 5,
  },
};
