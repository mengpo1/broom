// Shared constants of the distant backdrop panoramas (used by the painters and by the sky shader).

export const BACKDROP_PERIOD = (Math.PI * 2) / 3;   // one panorama covers 120 degrees of heading
export const BACKDROP_TAN_TOP = 0.36;               // tan(elevation) at the top edge of a panorama
export const BACKDROP_TAN_BOTTOM = -0.03;           // tan(elevation) at its bottom edge (just below the horizon)
