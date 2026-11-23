// EXPERIMENTAL parameters of the contacts with the trackside objects of tracks/trackside-objects.js.
// Kept apart from collision-tuning.js on purpose: nothing here is validated, and nothing here is
// read unless a circuit is built with interactions on (launch option #objects=interactive, or the
// collision test bench). The validated braking boards do not use this file.
//
// A reaction never throws a car in the air: the only launches of the game remain the validated
// ones (wheel over wheel, and the braking boards above their launch speed).

export const TRACKSIDE_TUNING = {
  /** m, height of a car above the road: what must fit under an OVERHEAD structure, added to the height of a flight. */
  carHeight: 1.05,
  /** s, a car pressed against a rigid object is not reported again before this delay (the contact itself is always resolved). */
  repeatDelay: 0.6,
  /** m/s, below this speed a contact with a rigid object is resolved silently (parking against it). */
  quietSpeed: 1.5,
  /**
   * Reactions, by the `reaction` key of the catalogue.
   * BREAKABLE objects (kind: 'break'): the object goes down and stays down for the race.
   *   speedKeep  share of its speed the car keeps
   *   jolt       0..1, shake felt by the driver (the bump of the existing contacts)
   * SOLID objects (kind: 'solid'): the object does not move.
   *   stopKeep     share of its speed the car keeps when it hits the object squarely
   *   glanceKeep   share kept when it only catches it with a corner (overlap below glanceOverlap, m)
   *   spinSpeed    m/s of impact above which a square hit sends the car into the existing spin
   * word: comic sound word shown to the driver (a key of the effects layer), or null
   * sound: { gain 0..1, weight 4..20 (dull to sharp), hard: metallic or not } for the impact sound
   */
  reactions: {
    cone: { kind: 'break', speedKeep: 0.985, jolt: 0.12, word: null, sound: { gain: 0.35, weight: 4, hard: false } },
    lightSign: { kind: 'break', speedKeep: 0.92, jolt: 0.5, word: 'CRAC', sound: { gain: 0.7, weight: 9, hard: true } },
    board: { kind: 'break', speedKeep: 0.84, jolt: 0.8, word: 'CRAC', sound: { gain: 0.9, weight: 12, hard: true } },
    bale: { kind: 'break', speedKeep: 0.78, jolt: 0.7, word: 'CRAC', sound: { gain: 0.6, weight: 6, hard: false } },
    tyres: { kind: 'break', speedKeep: 0.6, jolt: 1, word: 'BANG', sound: { gain: 0.8, weight: 7, hard: false } },
    bush: { kind: 'break', speedKeep: 0.88, jolt: 0.45, word: null, sound: { gain: 0.45, weight: 5, hard: false } },
    barrel: { kind: 'solid', stopKeep: 0.3, glanceKeep: 0.8, glanceOverlap: 0.5, spinSpeed: 30, word: 'BANG', sound: { gain: 0.9, weight: 14, hard: true } },
    trunk: { kind: 'solid', stopKeep: 0.1, glanceKeep: 0.7, glanceOverlap: 0.45, spinSpeed: 20, word: 'BANG', sound: { gain: 1, weight: 16, hard: false } },
    rock: { kind: 'solid', stopKeep: 0.08, glanceKeep: 0.65, glanceOverlap: 0.45, spinSpeed: 18, word: 'BANG', sound: { gain: 1, weight: 18, hard: true } },
    pillar: { kind: 'solid', stopKeep: 0.08, glanceKeep: 0.65, glanceOverlap: 0.4, spinSpeed: 18, word: 'BANG', sound: { gain: 1, weight: 18, hard: true } },
  },
};
