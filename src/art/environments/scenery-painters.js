// Registry of scenery painters: logical family -> drawing function. This is the single place
// where a procedural drawing can be replaced by another implementation (or, later, by artwork
// drawn by an artist and loaded as an image).

import { VEGETATION_PAINTERS } from './vegetation.js';
import { TRACKSIDE_PAINTERS } from './trackside.js';
import { TERRAIN_STRIP_PAINTERS } from './terrain-strips.js';
import { BUILDING_PAINTERS } from './buildings.js';
import { LINE } from '../styles/ink.js';

const PAINTERS = { ...VEGETATION_PAINTERS, ...TRACKSIDE_PAINTERS, ...TERRAIN_STRIP_PAINTERS, ...BUILDING_PAINTERS };

/** Neutral stand-in used when a family has no painter yet: an inked blank panel. */
function placeholder(ctx, w, h, P) {
  const m = 4;
  ctx.fillStyle = P.concrete; ctx.fillRect(m, m, w - 2 * m, h - m);
  ctx.fillStyle = P.concreteShade; ctx.fillRect(m, h * 0.7, w - 2 * m, h * 0.3);
  ctx.strokeStyle = P.ink; ctx.lineWidth = LINE.form; ctx.strokeRect(m, m, w - 2 * m, h - m);
}

export function registerSceneryPainters(table) { Object.assign(PAINTERS, table); }

export function sceneryPainter(family) { return PAINTERS[family] || placeholder; }

export function hasSceneryPainter(family) { return !!PAINTERS[family]; }
