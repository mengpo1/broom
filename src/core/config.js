// Externalised presentation parameters. Nothing here affects the simulation.
// Angles in radians, distances in metres, times in seconds unless stated otherwise.

export const VIEW_CONFIG = {
  hfov: 1.25,                // horizontal field of view of the cockpit camera at rest (about 72 degrees)
  hfovSpeedGain: 0.16,       // extra field of view at top speed ("perspective stretch")
  hfovBrakeLoss: 0.05,       // field of view removed under hard braking ("compression")
  horizonRatio: 0.43,        // horizon height as a fraction of the view height (full-height view)
  horizonRatioWide: 0.36,    // same for the short views of the horizontal split screen
  horizonRatioTall: 0.36,    // same for the narrow views of the vertical split screen (more road, less sky)
  hfovWide: 1.6,             // field of view of a short, very wide view: the cockpit then fits in its height
  cockpitScaleWide: 0.8,     // extra reduction of the cockpit drawing in a short view
  cockpitScaleTall: 0.84,    // and in a narrow view, so that both mirrors stay inside the frame
  wallClearance: 2.3,        // least lateral distance (m) between the cockpit camera and a barrier
  cockpitDepth: 821,         // how far below the horizon the cockpit drawing reaches in the reference composition (its own units)
  eyeHeight: 0.95,           // driver's eye above the road (same as CAR_DIMENSIONS.eye in the car drawing)
  eyeForward: -0.35,         // eye position along the car, relative to its centre
  drawDistance: 1300,
  yawFollow: 0.82,           // share of the car's heading error shown as view rotation
  pitchFollow: 0.55,         // share of the road grade applied to the horizon
  hfovTall: 1.05,            // field of view of a view taller than wide (vertical split screen)
  chase: { back: 7.5, height: 2.2, side: 0, hfov: 1.0 },
  front: { ahead: 7.5, height: 0.85, side: 1.5, hfov: 0.82 },
  tv: { height: 2.6, ahead: 125, hfovFar: 0.3, hfovNear: 0.95 },   // trackside camera: placed `ahead` metres in front of the car, zooms out as it approaches
};

/** Visual effects, each can be switched off individually (Options menu / saved settings). */
export const DEFAULT_EFFECTS = {
  speedLines: true,          // radial pen lines at the edge of the view
  perspectiveStretch: true,  // field of view breathing with speed / braking
  cockpitShake: true,        // vibration of the cockpit and view
  impactFrames: true,        // flash, burst lines and view jolt on contacts
  onomatopoeia: true,        // lettered sound words on big impacts and at the start
  dust: true,                // drawn dust and smoke puffs
  skidMarks: true,           // tyre marks on the asphalt
  insets: true,              // small caption panels (overtakes, fastest lap...)
  introPanels: true,         // comic strip shown before a race
};

export const QUALITY_PRESETS = {
  low: { sampleCount: 1, detail: 0.6, propDistance: 500, maxProps: 500 },
  medium: { sampleCount: 1, detail: 1, propDistance: 800, maxProps: 900 },
  high: { sampleCount: 4, detail: 1, propDistance: 1100, maxProps: 1400 },
};
