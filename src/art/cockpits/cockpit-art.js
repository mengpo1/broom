// Cockpit drawings. What the driver sees of the car is drawn by the same illustrator as the
// opponents' cars, from the driver's eye and with the game's focal length, so wheels, nose and
// wings sit in a consistent perspective with the road. The picture is split into animable
// layers: front wing (far), front wheel (per steering angle, with rolling marks), bodywork with
// suspension and mirror (near), instrument dial and needle, steering wheel with the hands.
// Symmetric layers are drawn once for the left half and mirrored by the compositor.
//
// All positions are in "reference pixels": the view of a 2560 px wide screen at the rest field
// of view, relative to the point (screen centre, horizon line).

import { VIEW_CONFIG } from '../../core/config.js';
import { buildCarModel, buildFrontWheelModel, CAR_DIMENSIONS, TREAD_PHASES, STREAK_PHASES, FAST_PHASES, MIRROR_MOUNT } from '../vehicles/car-model.js';
import { drawCar } from '../vehicles/car-illustrator.js';
import { LINE, brushStroke, brushCurve, closedCurve } from '../styles/ink.js';
import { drawText } from '../styles/lettering.js';
import { shadeHex, lightHex, mixHex } from '../palettes/palettes.js';

export const COCKPIT_REF_WIDTH = 2560;
export const COCKPIT_REF_FOCAL = (COCKPIT_REF_WIDTH / 2) / Math.tan(VIEW_CONFIG.hfov / 2);
export const STEER_FRAMES = 5;                 // drawn steering angles of a front wheel, from full right to full left
export const MAX_DRAWN_STEER = 0.26;           // radians at the first / last frame
export const WHEEL_VARIANTS = TREAD_PHASES + STREAK_PHASES + FAST_PHASES; // rolling phases, the phases of the rows of dashes "at speed", then those of the tyre turning very fast
export const DIAL = { x: 0, y: 700, r: 92, minAngle: -2.2, maxAngle: 2.2, maxRpm: 14000 };
export const STEERING = { x: 0, y: 872, size: 800, squash: 0.9, extra: 0.55 };   // extra: canvas height added below the wheel for the sleeves
/**
 * Left mirror as the driver sees it (centre and size in the units of the cockpit drawing); the
 * right one is its reflection. It is the projection of the mirror of the car model from the
 * driver's eye, so that the cockpit and the exterior views show the same car.
 */
export const MIRROR = (() => {
  const M = MIRROR_MOUNT, eye = CAR_DIMENSIONS.eye, k = COCKPIT_REF_FOCAL / (M.x - eye[0]);
  return {
    x: -M.y * k, y: (eye[2] - M.z) * k, w: (M.width + 0.012) * k, h: (M.height + 0.01) * k, glassInset: 14,
    armX: -M.arm[1] * k, armY: (eye[2] - M.arm[2]) * k,          // where the arm meets the side of the cockpit
  };
})();
const INK = '#16161f';
const COCKPIT_INK = 4.2;
const BOTTOM_LIMIT = 900;                      // nothing is needed further below the horizon than this

function cropOf(bounds, minX, maxX, pad) {
  const x0 = Math.max(minX, Math.floor(bounds.minX - pad)), x1 = Math.min(maxX, Math.ceil(bounds.maxX + pad));
  const y0 = Math.floor(bounds.minY - pad), y1 = Math.min(BOTTOM_LIMIT, Math.ceil(bounds.maxY + pad));
  return { x: x0, y: y0, w: Math.max(8, x1 - x0), h: Math.max(8, y1 - y0) };
}

/** Hood of the instrument binnacle (symmetric, drawn in the bodywork layer). */
function paintBinnacle(ctx, ox, oy) {
  const r = DIAL.r, cy = DIAL.y;
  const p = (x, y) => [ox + x * r, oy + cy + y * r];
  const outline = [p(-2.1, 2.9), p(-1.95, 0.2), p(-1.4, -0.95), p(-0.55, -1.32), p(0.55, -1.32), p(1.4, -0.95), p(1.95, 0.2), p(2.1, 2.9)];
  ctx.beginPath(); closedCurve(ctx, outline, 0.6);
  ctx.fillStyle = '#262833'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#3a3d4b';
  ctx.beginPath(); closedCurve(ctx, [p(-1.4, -0.78), p(-0.55, -1.16), p(0.55, -1.16), p(1.4, -0.78), p(0.9, -0.9), p(0, -1.02), p(-0.9, -0.9)], 0.6); ctx.fill();
  ctx.fillStyle = '#16171f';
  ctx.beginPath(); ctx.ellipse(ox, oy + cy + 6, r * 1.34, r * 1.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.beginPath(); closedCurve(ctx, outline, 0.6);
  ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK; ctx.lineJoin = 'round'; ctx.stroke();
  for (const [x, y] of [[-1.72, 0.6], [-1.58, -0.3], [-1.08, -0.95]]) {   // rivets
    ctx.fillStyle = '#565866'; ctx.beginPath(); ctx.arc(...p(x, y), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
  }
}

/** Left rear-view mirror on its stalk: housing in the body colour, glass with a drawn reflection. */
function paintMirror(ctx, ox, oy, colors) {
  const cx = ox + MIRROR.x, cy = oy + MIRROR.y, hw = MIRROR.w / 2, hh = MIRROR.h / 2;
  // arm from the side of the cockpit to the inner lower corner of the housing
  const arm = [[ox + MIRROR.armX, oy + MIRROR.armY], [cx + hw * 0.55, cy + hh * 1.3], [cx + hw * 0.5, cy + hh * 0.7]];
  brushStroke(ctx, arm, 26, { color: INK, taper: 0, swell: 0 });
  brushStroke(ctx, arm, 17, { color: '#30323d', taper: 0, swell: 0 });
  brushStroke(ctx, arm.map((q) => [q[0] - 4, q[1] - 5]), 4, { color: '#555866', taper: 0, swell: 0 });
  const housing = [[cx - hw, cy - hh * 0.72], [cx - hw * 0.86, cy - hh], [cx + hw * 0.9, cy - hh], [cx + hw, cy - hh * 0.6], [cx + hw * 0.94, cy + hh * 0.86], [cx + hw * 0.8, cy + hh], [cx - hw * 0.88, cy + hh], [cx - hw, cy + hh * 0.7]];
  const trace = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
  trace(housing); ctx.fillStyle = shadeHex(colors[0], 0.16); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = colors[0]; ctx.fillRect(cx - hw, cy - hh, MIRROR.w, hh * 0.5);
  ctx.fillStyle = shadeHex(colors[0], 0.46); ctx.fillRect(cx - hw, cy + hh * 0.62, MIRROR.w, hh);
  ctx.restore();
  trace(housing); ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK * 1.15; ctx.lineJoin = 'round'; ctx.stroke();
  // glass
  const g = MIRROR.glassInset;
  const glass = [[cx - hw + g, cy - hh + g + 6], [cx - hw + g + 10, cy - hh + g], [cx + hw - g - 6, cy - hh + g], [cx + hw - g, cy - hh + g + 12], [cx + hw - g - 4, cy + hh - g], [cx - hw + g + 6, cy + hh - g]];
  // the glass itself is left open: the compositor draws the rear view behind this layer
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; trace(glass); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  ctx.save(); trace(glass); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';                                                        // glare
  ctx.beginPath(); ctx.moveTo(cx - hw * 0.5, cy - hh); ctx.lineTo(cx - hw * 0.3, cy - hh); ctx.lineTo(cx - hw * 0.64, cy + hh); ctx.lineTo(cx - hw * 0.84, cy + hh); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - hw * 0.2, cy - hh); ctx.lineTo(cx - hw * 0.14, cy - hh); ctx.lineTo(cx - hw * 0.48, cy + hh); ctx.lineTo(cx - hw * 0.54, cy + hh); ctx.closePath(); ctx.fill();
  ctx.restore();
  trace(glass); ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK * 0.7; ctx.stroke();
}

/** Rev counter face (not mirrored: it carries numerals). */
function paintDial(ctx, size) {
  const c = size / 2, r = DIAL.r;
  ctx.fillStyle = '#16171f'; ctx.beginPath(); ctx.arc(c, c, r + 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4efe2'; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
  // shade crescent at the bottom left, as inked dials are drawn (built as a polygon: part of
  // the face outside a second circle shifted toward the light)
  const sx = c + 10, sy = c - 14, cres = [], inner = [];
  for (let i = 0; i <= 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r;
    if (Math.hypot(px - sx, py - sy) > r) cres.push([px, py]);
    const qx = sx + Math.cos(a) * r, qy = sy + Math.sin(a) * r;
    if (Math.hypot(qx - c, qy - c) < r) inner.push([qx, qy]);
  }
  // both runs are contiguous arcs; order the inner one so that the outline closes
  const first = inner.findIndex((q, i) => i > 0 && Math.hypot(q[0] - inner[i - 1][0], q[1] - inner[i - 1][1]) > 12);
  const run = first > 0 ? inner.slice(first).concat(inner.slice(0, first)) : inner;
  const endC = cres[cres.length - 1];
  if (Math.hypot(run[0][0] - endC[0], run[0][1] - endC[1]) > Math.hypot(run[run.length - 1][0] - endC[0], run[run.length - 1][1] - endC[1])) run.reverse();
  ctx.fillStyle = '#d7cfbc';
  ctx.beginPath(); ctx.moveTo(cres[0][0], cres[0][1]);
  for (const q of cres) ctx.lineTo(q[0], q[1]);
  for (const q of run) ctx.lineTo(q[0], q[1]);
  ctx.closePath(); ctx.fill();
  const angleOf = (rpm) => DIAL.minAngle + ((DIAL.maxAngle - DIAL.minAngle) * rpm) / DIAL.maxRpm - Math.PI / 2;
  // red zone
  ctx.strokeStyle = '#d5302a'; ctx.lineWidth = 10; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.arc(c, c, r - 10, angleOf(12500), angleOf(14000)); ctx.stroke();
  for (let k = 0; k <= 28; k++) {
    const a = angleOf(k * 500), major = k % 2 === 0;
    const r0 = r - (major ? 21 : 13), r1 = r - 5;
    brushStroke(ctx, [[c + Math.cos(a) * r0, c + Math.sin(a) * r0], [c + Math.cos(a) * r1, c + Math.sin(a) * r1]], major ? 4.2 : 2.2, { color: INK, taper: 0.1, swell: 0 });
  }
  for (let k = 0; k <= 14; k += 2) {
    const a = angleOf(k * 1000);
    drawText(ctx, String(k), c + Math.cos(a) * (r - 40), c + Math.sin(a) * (r - 40) + 7, 15, { style: 'bold', color: INK, align: 'center', jitter: 0 });
  }
  drawText(ctx, 'RPM', c, c - 22, 9, { style: 'bold', color: '#6b6d78', align: 'center', jitter: 0 });
  drawText(ctx, 'x1000', c, c - 10, 7, { style: 'bold', color: '#6b6d78', align: 'center', jitter: 0 });
  // gear window
  ctx.fillStyle = '#1b1c26'; ctx.fillRect(c - 21, c + 26, 42, 44);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(c - 21, c + 26, 42, 44);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#565866'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c, c, r + 9, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
}

function paintNeedle(ctx, w, h) {
  // points up; pivot at (w/2, h - w/2)
  const cx = w / 2, py = h - w / 2;
  ctx.beginPath(); ctx.moveTo(cx - 5, py); ctx.lineTo(cx - 1.5, 6); ctx.lineTo(cx + 1.5, 6); ctx.lineTo(cx + 5, py); ctx.closePath();
  ctx.fillStyle = '#d5302a'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#22232e'; ctx.beginPath(); ctx.arc(cx, py, w / 2 - 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#565866'; ctx.beginPath(); ctx.arc(cx - 2, py - 2, 3, 0, Math.PI * 2); ctx.fill();
}

/** One gloved hand gripping the rim at angle `a` (canvas angle), with cuff and sleeve. */
function paintHand(ctx, c, rimMid, a, S, glove, suit) {
  const ux = Math.cos(a), uy = Math.sin(a);
  let tx = -uy, ty = ux;
  if (ty > 0) { tx = -tx; ty = -ty; }                       // tangent pointing up the rim
  const hx = c + ux * (rimMid + S * 0.012), hy = c + uy * (rimMid + S * 0.012);
  const P = (along, out) => [hx + tx * along + ux * out, hy + ty * along + uy * out];
  const gloveShade = shadeHex(glove, 0.4), gloveLight = lightHex(glove, 0.3), suitShade = shadeHex(suit, 0.3);
  const shape = (pts, tension = 0.7) => { ctx.beginPath(); closedCurve(ctx, pts, tension); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // ---- forearm: a sleeve that swells toward the elbow, running out of the lower corner of the drawing
  const side = ux < 0 ? -1 : 1;
  const wrist = P(-S * 0.1, S * 0.03);
  const elbow = [c + side * S * 0.35, c + S * 1.3];        // (kept inside the width of the drawing, or its edge would slice the arm)
  const ax = elbow[0] - wrist[0], ay = elbow[1] - wrist[1];
  const al = Math.hypot(ax, ay) || 1;
  const nx = -ay / al, ny = ax / al;                        // across the arm
  const A = (t, w) => [wrist[0] + ax * t + nx * w * S, wrist[1] + ay * t + ny * w * S];
  const sleeve = [A(0, -0.05), A(0.18, -0.074), A(0.5, -0.094), A(1, -0.11), A(1, 0.11), A(0.5, 0.09), A(0.18, 0.066), A(0, 0.048)];
  shape(sleeve, 0.5); ctx.fillStyle = suit; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = suitShade;                                // shade along the underside of the arm
  shape([A(0, 0.012), A(0.3, 0.03), A(0.7, 0.038), A(1, 0.04), A(1, 0.13), A(0, 0.08)], 0.5); ctx.fill();
  ctx.restore();
  shape(sleeve, 0.5); ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK; ctx.stroke();
  // seam along the arm and the folds of the cloth gathered at the wrist and in the crook of the elbow
  brushCurve(ctx, [A(0.04, -0.012), A(0.4, -0.02), A(0.95, -0.016)], 2.2, { color: INK, taper: 0.5 });
  for (const [t, w0, w1, bend] of [[0.07, -0.05, 0.02, 0.03], [0.15, -0.066, -0.005, 0.035], [0.26, 0.068, 0.012, -0.03], [0.62, -0.096, -0.03, 0.04], [0.74, 0.094, 0.03, -0.04], [0.86, -0.104, -0.045, 0.035]]) {
    brushCurve(ctx, [A(t, w0), A(t + bend, (w0 + w1) / 2), A(t + bend * 0.4, w1)], 2.8, { color: INK, taperStart: 0.05, taperEnd: 0.7 });
  }

  // ---- gauntlet: the long cuff of the glove over the end of the sleeve, closed by a strap
  const cuff = [P(-S * 0.135, -S * 0.052), P(-S * 0.14, S * 0.02), P(-S * 0.132, S * 0.094), P(-S * 0.07, S * 0.086), P(-S * 0.062, S * 0.02), P(-S * 0.068, -S * 0.044)];
  shape(cuff, 0.45); ctx.fillStyle = glove; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = gloveShade; shape([P(-S * 0.15, -S * 0.07), P(-S * 0.15, -S * 0.012), P(-S * 0.05, -S * 0.016), P(-S * 0.05, -S * 0.07)], 0.4); ctx.fill();
  ctx.restore();
  shape(cuff, 0.45); ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK * 0.8; ctx.stroke();
  const strap = [P(-S * 0.112, -S * 0.05), P(-S * 0.116, S * 0.092), P(-S * 0.094, S * 0.09), P(-S * 0.09, -S * 0.048)];
  ctx.beginPath(); ctx.moveTo(strap[0][0], strap[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(strap[i][0], strap[i][1]); ctx.closePath();
  ctx.fillStyle = '#f1efe6'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke();

  // ---- back of the hand
  const back = [P(-S * 0.072, -S * 0.046), P(-S * 0.078, S * 0.02), P(-S * 0.066, S * 0.058), P(-S * 0.02, S * 0.066), P(S * 0.05, S * 0.064), P(S * 0.082, S * 0.04), P(S * 0.086, -S * 0.012), P(S * 0.06, -S * 0.046), P(-S * 0.005, -S * 0.056)];
  shape(back); ctx.fillStyle = glove; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = gloveShade;
  shape([P(-S * 0.09, -S * 0.004), P(-S * 0.02, -S * 0.022), P(S * 0.1, -S * 0.012), P(S * 0.1, -S * 0.09), P(-S * 0.09, -S * 0.09)], 0.6); ctx.fill();
  ctx.restore();
  shape(back); ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK; ctx.stroke();
  // stitched panel on the back of the glove
  brushCurve(ctx, [P(-S * 0.058, S * 0.036), P(-S * 0.03, S * 0.012), P(S * 0.02, S * 0.006), P(S * 0.064, S * 0.022)], 2, { color: INK, taper: 0.4 });

  // ---- four fingers closed over the rim, each drawn on its own, of unequal lengths
  const lengths = [0.1, 0.112, 0.108, 0.094];
  for (let f = 0; f < 4; f++) {
    const m = -S * 0.049 + f * S * 0.037, w = S * 0.0175, tip = S * lengths[f], root = S * 0.034;
    const finger = [P(m - w, root), P(m - w * 1.04, (root + tip) / 2), P(m - w * 0.8, tip - w * 0.5), P(m, tip), P(m + w * 0.8, tip - w * 0.5), P(m + w * 1.04, (root + tip) / 2), P(m + w, root)];
    shape(finger, 0.6); ctx.fillStyle = glove; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = gloveShade;                             // far side of each finger in shade
    shape([P(m - w * 1.3, root - S * 0.01), P(m - w * 0.25, root), P(m - w * 0.3, tip + S * 0.01), P(m - w * 1.3, tip + S * 0.01)], 0.4); ctx.fill();
    ctx.fillStyle = gloveLight;                             // light on the first joint
    ctx.beginPath(); ctx.ellipse(...P(m + w * 0.3, root + (tip - root) * 0.3), w * 0.42, w * 0.9, a, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    shape(finger, 0.6); ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK * 0.75; ctx.stroke();
    // joint creases
    brushCurve(ctx, [P(m - w * 0.8, root + (tip - root) * 0.5), P(m, root + (tip - root) * 0.56), P(m + w * 0.8, root + (tip - root) * 0.5)], 1.8, { color: INK, taper: 0.4 });
    brushCurve(ctx, [P(m - w * 0.7, root + (tip - root) * 0.8), P(m, root + (tip - root) * 0.85), P(m + w * 0.7, root + (tip - root) * 0.8)], 1.5, { color: INK, taper: 0.4 });
  }
  // knuckles: short arcs where the fingers leave the hand
  for (let f = 0; f < 4; f++) {
    const m = -S * 0.049 + f * S * 0.037;
    brushCurve(ctx, [P(m - S * 0.013, S * 0.03), P(m, S * 0.04), P(m + S * 0.013, S * 0.03)], 2.4, { color: INK, taper: 0.35 });
  }

  // ---- thumb lying along the inside of the rim
  const thumb = [P(-S * 0.02, -S * 0.03), P(S * 0.05, -S * 0.052), P(S * 0.105, -S * 0.05), P(S * 0.118, -S * 0.03), P(S * 0.1, -S * 0.012), P(S * 0.04, -S * 0.008)];
  shape(thumb); ctx.fillStyle = glove; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = gloveLight; ctx.beginPath(); ctx.ellipse(...P(S * 0.07, -S * 0.022), S * 0.026, S * 0.007, Math.atan2(ty, tx), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  shape(thumb); ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.stroke();
  brushStroke(ctx, [P(S * 0.085, -S * 0.046), P(S * 0.1, -S * 0.024)], 2, { color: INK, taper: 0.3 });
  brushStroke(ctx, [P(S * 0.03, -S * 0.04), P(S * 0.04, -S * 0.018)], 1.8, { color: INK, taper: 0.3 });
}

function paintSteeringWheel(ctx, S, glove, suit, accent, hands = true) {
  const c = S / 2, R = S * 0.452, rimW = S * 0.074, rimMid = R - rimW / 2;
  // spokes (behind the rim)
  const spoke = (a, w0, w1) => {
    const ux = Math.cos(a), uy = Math.sin(a), tx = -uy, ty = ux;
    const r0 = S * 0.1, r1 = R - rimW * 0.7;
    const pts = [[c + ux * r0 + tx * w0, c + uy * r0 + ty * w0], [c + ux * r1 + tx * w1, c + uy * r1 + ty * w1], [c + ux * r1 - tx * w1, c + uy * r1 - ty * w1], [c + ux * r0 - tx * w0, c + uy * r0 - ty * w0]];
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
    ctx.fillStyle = '#a3acb8'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#dfe5ea'; ctx.fillRect(0, 0, S, c - 4);
    ctx.fillStyle = '#66717f'; ctx.fillRect(0, c + 18, S, S);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK; ctx.lineJoin = 'round'; ctx.stroke();
    for (const t of [0.42, 0.62, 0.8]) {
      const rr = r0 + (r1 - r0) * t, hw = (w0 + (w1 - w0) * t) * 0.42;
      ctx.fillStyle = '#22232e'; ctx.beginPath(); ctx.ellipse(c + ux * rr, c + uy * rr, hw, hw, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    }
  };
  spoke(Math.PI, S * 0.05, S * 0.036); spoke(0, S * 0.05, S * 0.036); spoke(Math.PI / 2, S * 0.046, S * 0.034);
  // rim
  ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.arc(c, c, R - rimW, 0, Math.PI * 2, true);
  ctx.fillStyle = '#2d2e38'; ctx.fill('evenodd');
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4c4e5b'; ctx.lineWidth = rimW * 0.3; ctx.beginPath(); ctx.arc(c, c, R - rimW * 0.3, Math.PI * 1.08, Math.PI * 1.62); ctx.stroke();
  ctx.strokeStyle = '#17171f'; ctx.lineWidth = rimW * 0.34; ctx.beginPath(); ctx.arc(c, c, R - rimW * 0.72, Math.PI * 0.05, Math.PI * 0.6); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK * 1.3; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = COCKPIT_INK * 0.8; ctx.beginPath(); ctx.arc(c, c, R - rimW, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 44; k++) {   // stitching on the inner edge
    const a = (k / 44) * Math.PI * 2, r0 = R - rimW + 5, r1 = R - rimW + 15;
    brushStroke(ctx, [[c + Math.cos(a) * r0, c + Math.sin(a) * r0], [c + Math.cos(a + 0.03) * r1, c + Math.sin(a + 0.03) * r1]], 1.6, { color: '#6b6d78', taper: 0.3, swell: 0 });
  }
  // top marker
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(c, c - rimMid, 0, 0, 0); ctx.fillRect(c - 9, c - R + 4, 18, rimW - 8);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.strokeRect(c - 9, c - R + 4, 18, rimW - 8);
  // hub
  ctx.fillStyle = '#30323d'; ctx.beginPath(); ctx.arc(c, c, S * 0.112, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#454856'; ctx.beginPath(); ctx.arc(c - 6, c - 8, S * 0.09, Math.PI, Math.PI * 1.9); ctx.arc(c + 4, c + 2, S * 0.1, Math.PI * 1.9, Math.PI, true); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK; ctx.beginPath(); ctx.arc(c, c, S * 0.112, 0, Math.PI * 2); ctx.stroke();
  drawText(ctx, 'V', c, c + S * 0.03, S * 0.07, { style: 'impact', color: accent, outline: INK, outlineWidth: 3, align: 'center', jitter: 0 });
  for (const [bx, col] of [[-S * 0.185, '#d5302a'], [S * 0.185, '#2f9a5a']]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c + bx, c - S * 0.012, S * 0.017, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
  }
  if (hands) {
    paintHand(ctx, c, rimMid, Math.PI * 1.16, S, glove, suit);
    paintHand(ctx, c, rimMid, -Math.PI * 0.16, S, glove, suit);
  }
}

/**
 * Register the cockpit drawings in the static atlas.
 * @param art     ArtLibrary
 * @param players [{ colors: [body, flanks, wings] hex, glove: hex, suit: hex }] one entry per local player
 * @returns layout used by the compositor (see compositing/cockpit-layer.js)
 */
export function defineCockpitArt(art, players) {
  const eye = CAR_DIMENSIONS.eye, focal = COCKPIT_REF_FOCAL;
  const half = COCKPIT_REF_WIDTH / 2;
  const model = buildCarModel({ detail: 1 });
  const camera = (crop) => ({ eye, focal, cx: -crop.x, cy: -crop.y });
  const probe = { eye, focal, cx: 0, cy: 0 };
  const nearParts = (name) => name === 'tub' || name === 'suspension.left' || name === 'exhaust';
  const farParts = (name) => name === 'frontwing.main' || name === 'frontwing.flap.left' || name === 'frontwing.endplate.left' || name === 'frontwing.pylons';
  const layout = { near: [], far: [], wheels: [], steering: [], steeringFree: [], dial: null, needle: null };

  const nearBounds = drawCar(null, null, model, probe, { measure: true, include: nearParts });
  nearBounds.minY = Math.min(nearBounds.minY, MIRROR.y - MIRROR.h / 2 - 6); nearBounds.maxY = BOTTOM_LIMIT;
  nearBounds.minX = Math.min(nearBounds.minX, MIRROR.x - MIRROR.w / 2 - 6);
  const nearCrop = cropOf(nearBounds, -half - 4, 4, 8);
  const farCrop = cropOf(drawCar(null, null, model, probe, { measure: true, include: farParts }), -half - 4, 4, 8);
  players.forEach((player, p) => {
    const livery = { colors: player.colors };
    art.defineStatic(`cockpit.near.${p}`, nearCrop.w, nearCrop.h, (ctx) => {
      drawCar(ctx, null, model, camera(nearCrop), { livery, ink: COCKPIT_INK, shadow: false, include: nearParts });
      paintMirror(ctx, -nearCrop.x, -nearCrop.y, player.colors);
      paintBinnacle(ctx, -nearCrop.x, -nearCrop.y);
    }, { ox: nearCrop.x, oy: nearCrop.y });
    art.defineStatic(`cockpit.far.${p}`, farCrop.w, farCrop.h, (ctx) => {
      drawCar(ctx, null, model, camera(farCrop), { livery, ink: COCKPIT_INK * 0.8, shadow: false, include: farParts });
    }, { ox: farCrop.x, oy: farCrop.y });
    art.defineStatic(`cockpit.steering.${p}`, STEERING.size, Math.round(STEERING.size * (1 + STEERING.extra)), (ctx, w) => paintSteeringWheel(ctx, w, player.glove, player.suit, player.colors[2]));
    // the same wheel let go of: shown while the car slides out of control
    art.defineStatic(`cockpit.steeringfree.${p}`, STEERING.size, Math.round(STEERING.size * (1 + STEERING.extra)), (ctx, w) => paintSteeringWheel(ctx, w, player.glove, player.suit, player.colors[2], false));
    layout.near.push(`cockpit.near.${p}`); layout.far.push(`cockpit.far.${p}`); layout.steering.push(`cockpit.steering.${p}`); layout.steeringFree.push(`cockpit.steeringfree.${p}`);
  });

  // front-left wheel: steering frames x rolling variants, all sharing one crop so frames register
  const steerOf = (k) => ((k - (STEER_FRAMES - 1) / 2) / ((STEER_FRAMES - 1) / 2)) * MAX_DRAWN_STEER;
  const union = { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9 };
  const wheelModels = [];
  for (let k = 0; k < STEER_FRAMES; k++) {
    const row = [];
    for (let v = 0; v < WHEEL_VARIANTS; v++) {
      const wm = buildFrontWheelModel({ steer: steerOf(k), tread: v < TREAD_PHASES ? { phase: v } : v < TREAD_PHASES + STREAK_PHASES ? { blur: true, phase: v - TREAD_PHASES } : { fast: true, phase: v - TREAD_PHASES - STREAK_PHASES } });
      row.push(wm);
      if (v === 0) {
        const b = drawCar(null, null, wm, probe, { measure: true });
        union.minX = Math.min(union.minX, b.minX); union.maxX = Math.max(union.maxX, b.maxX);
        union.minY = Math.min(union.minY, b.minY); union.maxY = Math.max(union.maxY, b.maxY);
      }
    }
    wheelModels.push(row);
  }
  const wheelCrop = cropOf(union, -half - 200, 0, 8);
  for (let k = 0; k < STEER_FRAMES; k++) {
    const row = [];
    for (let v = 0; v < WHEEL_VARIANTS; v++) {
      const id = `cockpit.wheel.${k}.${v}`;
      const wm = wheelModels[k][v];
      art.defineStatic(id, wheelCrop.w, wheelCrop.h, (ctx) => {
        drawCar(ctx, null, wm, camera(wheelCrop), { livery: { colors: ['#000', '#000', '#000'] }, ink: COCKPIT_INK, shadow: false });
      }, { ox: wheelCrop.x, oy: wheelCrop.y });
      row.push(id);
    }
    layout.wheels.push(row);
  }
  const dialSize = (DIAL.r + 16) * 2;
  art.defineStatic('cockpit.dial', dialSize, dialSize, (ctx, w) => paintDial(ctx, w));
  art.defineStatic('cockpit.needle', 22, DIAL.r - 6, paintNeedle);
  layout.dial = 'cockpit.dial'; layout.needle = 'cockpit.needle';
  return layout;
}

/** Dev helper: colours of a player's overalls and gloves from the team livery. */
export function playerCockpitColors(colors) {
  return { colors, glove: mixHex(colors[2], '#d5302a', 0.0), suit: lightHex(colors[0], 0.1) };
}
