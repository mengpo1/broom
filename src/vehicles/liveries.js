// Fictional teams, liveries and drivers. No real brands, sponsors or people.
// Colours are linear-ish sRGB triplets in 0..1; pattern selects a procedural paint layout.

export const TEAMS = [
  { id: 'aquila', name: 'Aquila Corse', primary: [0.82, 0.04, 0.05], secondary: [0.95, 0.95, 0.95], accent: [0.98, 0.78, 0.1], pattern: 0, helmet: [0.9, 0.1, 0.1] },
  { id: 'boreal', name: 'Boréal Racing', primary: [0.05, 0.16, 0.55], secondary: [0.92, 0.92, 0.95], accent: [0.95, 0.75, 0.1], pattern: 1, helmet: [0.1, 0.3, 0.8] },
  { id: 'solaris', name: 'Solaris GP', primary: [0.98, 0.72, 0.05], secondary: [0.08, 0.08, 0.1], accent: [0.9, 0.1, 0.1], pattern: 2, helmet: [0.95, 0.8, 0.1] },
  { id: 'verdance', name: 'Verdance Motorsport', primary: [0.03, 0.33, 0.16], secondary: [0.93, 0.9, 0.78], accent: [0.9, 0.6, 0.1], pattern: 3, helmet: [0.1, 0.5, 0.25] },
  { id: 'nocturne', name: 'Nocturne Engineering', primary: [0.06, 0.06, 0.07], secondary: [0.85, 0.68, 0.25], accent: [0.85, 0.68, 0.25], pattern: 1, helmet: [0.12, 0.12, 0.14] },
  { id: 'cobalt', name: 'Cobalt Works', primary: [0.9, 0.92, 0.95], secondary: [0.05, 0.35, 0.75], accent: [0.9, 0.15, 0.15], pattern: 4, helmet: [0.95, 0.95, 0.95] },
  { id: 'magenta', name: 'Scuderia Magenta', primary: [0.75, 0.05, 0.42], secondary: [0.1, 0.1, 0.12], accent: [0.98, 0.98, 0.98], pattern: 2, helmet: [0.85, 0.15, 0.5] },
  { id: 'tangerine', name: 'Tangerine Autosport', primary: [0.95, 0.38, 0.03], secondary: [0.05, 0.1, 0.3], accent: [0.95, 0.95, 0.95], pattern: 0, helmet: [0.95, 0.45, 0.05] },
  { id: 'glacier', name: 'Glacier Team', primary: [0.2, 0.7, 0.8], secondary: [0.95, 0.95, 0.97], accent: [0.05, 0.1, 0.25], pattern: 3, helmet: [0.3, 0.8, 0.9] },
];

/**
 * Driver ratings in 0..1: pace (corner speed), consistency (fewer mistakes),
 * aggression (overtaking/defending), reaction (start), power (engine quality).
 */
export const DRIVERS = [
  { id: 'd01', name: 'M. Valmont', team: 0, number: 1, pace: 1.0, consistency: 0.95, aggression: 0.8, reaction: 0.9, power: 1.0 },
  { id: 'd02', name: 'K. Lindholm', team: 1, number: 2, pace: 0.97, consistency: 0.92, aggression: 0.7, reaction: 0.85, power: 0.99 },
  { id: 'd03', name: 'R. Okafor', team: 2, number: 3, pace: 0.95, consistency: 0.85, aggression: 0.95, reaction: 0.95, power: 0.98 },
  { id: 'd04', name: 'T. Brandt', team: 0, number: 4, pace: 0.92, consistency: 0.9, aggression: 0.6, reaction: 0.7, power: 1.0 },
  { id: 'd05', name: 'S. Arakawa', team: 3, number: 5, pace: 0.9, consistency: 0.97, aggression: 0.5, reaction: 0.8, power: 0.97 },
  { id: 'd06', name: 'L. Ferreira', team: 4, number: 6, pace: 0.88, consistency: 0.8, aggression: 0.9, reaction: 0.9, power: 0.97 },
  { id: 'd07', name: 'J. Whitlock', team: 1, number: 7, pace: 0.85, consistency: 0.88, aggression: 0.65, reaction: 0.75, power: 0.99 },
  { id: 'd08', name: 'A. Novak', team: 5, number: 8, pace: 0.82, consistency: 0.9, aggression: 0.55, reaction: 0.8, power: 0.96 },
  { id: 'd09', name: 'P. Castel', team: 2, number: 9, pace: 0.8, consistency: 0.75, aggression: 0.85, reaction: 0.85, power: 0.98 },
  { id: 'd10', name: 'H. Sorensen', team: 6, number: 10, pace: 0.76, consistency: 0.85, aggression: 0.6, reaction: 0.7, power: 0.95 },
  { id: 'd11', name: 'D. Marchetti', team: 3, number: 11, pace: 0.72, consistency: 0.8, aggression: 0.75, reaction: 0.8, power: 0.97 },
  { id: 'd12', name: 'E. Vasquez', team: 7, number: 12, pace: 0.68, consistency: 0.82, aggression: 0.7, reaction: 0.75, power: 0.95 },
  { id: 'd13', name: 'B. Thackeray', team: 4, number: 14, pace: 0.62, consistency: 0.78, aggression: 0.5, reaction: 0.65, power: 0.97 },
  { id: 'd14', name: 'Y. Demir', team: 8, number: 15, pace: 0.56, consistency: 0.7, aggression: 0.8, reaction: 0.9, power: 0.94 },
  { id: 'd15', name: 'C. Aldana', team: 5, number: 16, pace: 0.5, consistency: 0.85, aggression: 0.4, reaction: 0.6, power: 0.96 },
  { id: 'd16', name: 'N. Kowalczyk', team: 6, number: 17, pace: 0.42, consistency: 0.7, aggression: 0.65, reaction: 0.7, power: 0.95 },
  { id: 'd17', name: 'F. Dubreuil', team: 7, number: 18, pace: 0.34, consistency: 0.65, aggression: 0.55, reaction: 0.6, power: 0.95 },
  { id: 'd18', name: 'G. Halloran', team: 8, number: 19, pace: 0.25, consistency: 0.6, aggression: 0.45, reaction: 0.55, power: 0.94 },
];

/** Human player entries (seat in a customer team with its own livery). */
export const PLAYER_DRIVERS = [
  { id: 'p1', name: 'PLAYER 1', team: 9, number: 27, pace: 1, consistency: 1, aggression: 0.7, reaction: 0.8, power: 1 },
  { id: 'p2', name: 'PLAYER 2', team: 10, number: 28, pace: 1, consistency: 1, aggression: 0.7, reaction: 0.8, power: 1 },
];

export const PLAYER_TEAMS = [
  { id: 'player-1', name: 'Équipe Virage', primary: [0.9, 0.9, 0.92], secondary: [0.85, 0.05, 0.1], accent: [0.05, 0.1, 0.35], pattern: 4, helmet: [0.95, 0.95, 0.95] },
  { id: 'player-2', name: 'Équipe Virage B', primary: [0.1, 0.1, 0.12], secondary: [0.1, 0.75, 0.6], accent: [0.95, 0.95, 0.95], pattern: 2, helmet: [0.1, 0.75, 0.6] },
];

export const ALL_TEAMS = [...TEAMS, ...PLAYER_TEAMS];
