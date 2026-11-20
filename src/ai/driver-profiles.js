// Difficulty levels and the mapping from driver ratings to controller parameters.

/** Four levels, from novice to expert. All values are design choices and can be modded. */
export const DIFFICULTY_LEVELS = {
  novice: { id: 'novice', pace: 0.9, aggression: 0.3, mistakeRate: 1.5, brakeUsage: 0.72, power: 0.95 },
  amateur: { id: 'amateur', pace: 0.94, aggression: 0.5, mistakeRate: 1.2, brakeUsage: 0.78, power: 0.97 },
  pro: { id: 'pro', pace: 0.975, aggression: 0.7, mistakeRate: 0.9, brakeUsage: 0.84, power: 0.99 },
  expert: { id: 'expert', pace: 1.0, aggression: 0.9, mistakeRate: 0.6, brakeUsage: 0.88, power: 1.0 },
};
export const DIFFICULTY_ORDER = ['novice', 'amateur', 'pro', 'expert'];

/** Controller parameters for one driver at one difficulty level. */
export function makeAiSkill(driver, difficulty) {
  return {
    pace: difficulty.pace * (0.95 + 0.05 * driver.pace),
    power: difficulty.power * (driver.power ?? 1),
    aggression: Math.min(1, difficulty.aggression * (0.6 + 0.6 * driver.aggression)),
    mistakesPerMinute: difficulty.mistakeRate * (1.05 - driver.consistency) * 1.6,
    reaction: 0.12 + (1 - driver.reaction) * 0.4,
    lateralRate: 2.6 + 2.2 * driver.aggression,
  };
}
