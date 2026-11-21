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
import { buildCarModel, buildFrontWheelModel, CAR_DIMENSIONS, TREAD_PHASES } from '../vehicles/car-model.js';
import { drawCar } from '../vehicles/car-illustrator.js';
import { LINE, brushStroke, brushCurve, closedCurve } from '../styles/ink.js';
import { drawText } from '../styles/lettering.js';
import { shadeHex, lightHex, mixHex } from '../palettes/palettes.js';

export const COCKPIT_REF_WIDTH = 2560;
export const COCKPIT_REF_FOCAL = (COCKPIT_REF_WIDTH / 2) / Math.tan(VIEW_CONFIG.hfov / 2);
export const STEER_FRAMES = 5;                 // drawn steering angles of a front wheel, from full right to full left
export const MAX_DRAWN_STEER = 0.26;           // radians at the first / last frame
export const WHEEL_VARIANTS = TREAD_PHASES + 1; // rolling phases, then the streaked "at speed" drawing
export const DIAL = { x: 0, y: 700, r: 92, minAngle: -2.2, maxAngle: 2.2, maxRpm: 14000 };
export const STEERING = { x: 0, y: 872, size: 800, squash: 0.9, extra: 0.55 };   // extra: canvas height added below the wheel for the sleeves
export const MIRROR = { x: -1010, y: 188, w: 300, h: 138 };   // left mirror (centre and size); the right one is its reflection
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
  // stalk running down to the cockpit side, out of the picture
  const stalk = [[cx - 14, cy + hh - 6], [cx - 46, cy + 380], [cx - 64, BOTTOM_LIMIT - oy + oy]];
  brushStroke(ctx, [[cx - 6, cy + hh - 8], [cx - 40, cy + 380], [cx - 52, cy + 760]], 30, { color: INK, taper: 0, swell: 0 });
  brushStroke(ctx, [[cx - 6, cy + hh - 8], [cx - 40, cy + 380], [cx - 52, cy + 760]], 21, { color: '#30323d', taper: 0, swell: 0 });
  brushStroke(ctx, [[cx - 11, cy + hh], [cx - 45, cy + 380], [cx - 57, cy + 760]], 5, { color: '#555866', taper: 0, swell: 0 });
  void stalk;
  const housing = [[cx - hw, cy - hh * 0.72], [cx - hw * 0.86, cy - hh], [cx + hw * 0.9, cy - hh], [cx + hw, cy - hh * 0.6], [cx + hw * 0.94, cy + hh * 0.86], [cx + hw * 0.8, cy + hh], [cx - hw * 0.88, cy + hh], [cx - hw, cy + hh * 0.7]];
  const trace = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
  trace(housing); ctx.fillStyle = shadeHex(colors[0], 0.16); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = colors[0]; ctx.fillRect(cx - hw, cy - hh, MIRROR.w, hh * 0.5);
  ctx.fillStyle = shadeHex(colors[0], 0.46); ctx.fillRect(cx - hw, cy + hh * 0.62, MIRROR.w, hh);
  ctx.restore();
  trace(housing); ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK * 1.15; ctx.lineJoin = 'round'; ctx.stroke();
  // glass
  const g = 16;
  const glass = [[cx - hw + g, cy - hh + g + 6], [cx - hw + g + 10, cy - hh + g], [cx + hw - g - 6, cy - hh + g], [cx + hw - g, cy - hh + g + 12], [cx + hw - g - 4, cy + hh - g], [cx - hw + g + 6, cy + hh - g]];
  trace(glass); ctx.fillStyle = '#9fc9e6'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#d2ecf7'; ctx.fillRect(cx - hw, cy - hh, MIRROR.w, hh * 0.75);
  ctx.fillStyle = '#6f9a5c'; ctx.fillRect(cx - hw, cy - 2, MIRROR.w, hh);                        // verge
  ctx.fillStyle = '#6c6e77';                                                                      // road running away behind
  ctx.beginPath(); ctx.moveTo(cx + hw * 0.1, cy - 2); ctx.lineTo(cx + hw * 0.34, cy - 2); ctx.lineTo(cx + hw, cy + hh * 0.75); ctx.lineTo(cx + hw, cy + hh); ctx.lineTo(cx - hw * 0.55, cy + hh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f1efe6';
  ctx.beginPath(); ctx.moveTo(cx + hw * 0.1, cy - 2); ctx.lineTo(cx + hw * 0.13, cy - 2); ctx.lineTo(cx - hw * 0.44, cy + hh); ctx.lineTo(cx - hw * 0.55, cy + hh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';                                                       // glare
  ctx.beginPath(); ctx.moveTo(cx - hw * 0.5, cy - hh); ctx.lineTo(cx - hw * 0.28, cy - hh); ctx.lineTo(cx - hw * 0.62, cy + hh); ctx.lineTo(cx - hw * 0.84, cy + hh); ctx.closePath(); ctx.fill();
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
  const gloveShade = shadeHex(glove, 0.4), gloveLight = lightHex(glove, 0.3);
  // sleeve from the wrist to beyond the lower corner of the drawing
  const side = ux < 0 ? -1 : 1;
  const wrist = P(-S * 0.085, S * 0.03);
  const elbow = [c + side * S * 0.56, c + S * 1.25];
  const nx = -(elbow[1] - wrist[1]), ny = elbow[0] - wrist[0];
  const nl = Math.hypot(nx, ny) || 1;
  const wx = (nx / nl) * S * 0.06, wy = (ny / nl) * S * 0.06;
  const sleeve = [[wrist[0] - wx * 0.9, wrist[1] - wy * 0.9], [wrist[0] + wx * 0.9, wrist[1] + wy * 0.9], [elbow[0] + wx * 1.8, elbow[1] + wy * 1.8], [elbow[0] - wx * 1.8, elbow[1] - wy * 1.8]];
  ctx.beginPath(); ctx.moveTo(sleeve[0][0], sleeve[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(sleeve[i][0], sleeve[i][1]); ctx.closePath();
  ctx.fillStyle = suit; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = shadeHex(suit, 0.3);
  ctx.beginPath(); ctx.moveTo(sleeve[1][0], sleeve[1][1]); ctx.lineTo(sleeve[2][0], sleeve[2][1]);
  ctx.lineTo(elbow[0] + wx * 0.5, elbow[1] + wy * 0.5); ctx.lineTo(wrist[0] + wx * 0.25, wrist[1] + wy * 0.25); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(sleeve[0][0], sleeve[0][1]); ctx.lineTo(sleeve[3][0], sleeve[3][1]); ctx.moveTo(sleeve[1][0], sleeve[1][1]); ctx.lineTo(sleeve[2][0], sleeve[2][1]); ctx.stroke();
  for (let i = 1; i <= 3; i++) {   // cloth folds
    const t = i / 4.5;
    const fx = wrist[0] + (elbow[0] - wrist[0]) * t, fy = wrist[1] + (elbow[1] - wrist[1]) * t;
    brushCurve(ctx, [[fx - wx * (0.7 + t), fy - wy * (0.7 + t)], [fx - wx * 0.1 + (elbow[0] - wrist[0]) * 0.03, fy - wy * 0.1 + (elbow[1] - wrist[1]) * 0.03], [fx + wx * 0.5, fy + wy * 0.5]], 2.6, { color: INK, taper: 0.45 });
  }
  // cuff
  const cuff = [P(-S * 0.1, -S * 0.035), P(-S * 0.1, S * 0.085), P(-S * 0.062, S * 0.092), P(-S * 0.062, -S * 0.04)];
  ctx.beginPath(); ctx.moveTo(cuff[0][0], cuff[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(cuff[i][0], cuff[i][1]); ctx.closePath();
  ctx.fillStyle = '#f1efe6'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  // back of the hand and fingers wrapped over the rim
  const back = [P(-S * 0.07, -S * 0.045), P(-S * 0.075, S * 0.05), P(-S * 0.03, S * 0.092), P(S * 0.04, S * 0.098), P(S * 0.085, S * 0.07), P(S * 0.092, S * 0.02), P(S * 0.075, -S * 0.04), P(S * 0.0, -S * 0.055)];
  ctx.beginPath(); closedCurve(ctx, back, 0.7);
  ctx.fillStyle = glove; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = gloveShade;
  ctx.beginPath(); closedCurve(ctx, [P(-S * 0.08, S * 0.0), P(-S * 0.02, -S * 0.02), P(S * 0.1, -S * 0.01), P(S * 0.1, -S * 0.08), P(-S * 0.09, -S * 0.08)], 0.6); ctx.fill();
  ctx.fillStyle = gloveLight;
  for (let f = 0; f < 4; f++) { const al = -S * 0.035 + f * S * 0.032; ctx.beginPath(); ctx.ellipse(...P(al, S * 0.07), S * 0.012, S * 0.016, a, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); closedCurve(ctx, back, 0.7); ctx.strokeStyle = INK; ctx.lineWidth = COCKPIT_INK; ctx.stroke();
  for (let f = 1; f < 4; f++) {   // finger separations
    const al = -S * 0.05 + f * S * 0.033;
    brushCurve(ctx, [P(al, S * 0.094), P(al - S * 0.004, S * 0.055), P(al + S * 0.002, S * 0.012)], 3, { color: INK, taperStart: 0.05, taperEnd: 0.6 });
  }
  brushCurve(ctx, [P(-S * 0.055, S * 0.045), P(-S * 0.01, S * 0.038), P(S * 0.06, S * 0.045)], 2.2, { color: INK, taper: 0.4 });   // knuckle seam
  // thumb lying along the inside of the rim
  const thumb = [P(-S * 0.02, -S * 0.03), P(S * 0.05, -S * 0.052), P(S * 0.105, -S * 0.05), P(S * 0.118, -S * 0.03), P(S * 0.1, -S * 0.012), P(S * 0.04, -S * 0.008)];
  ctx.beginPath(); closedCurve(ctx, thumb, 0.7); ctx.fillStyle = glove; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.stroke();
  brushStroke(ctx, [P(S * 0.085, -S * 0.044), P(S * 0.1, -S * 0.024)], 2, { color: INK, taper: 0.3 });
}

function paintSteeringWheel(ctx, S, glove, suit, accent) {
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
  paintHand(ctx, c, rimMid, Math.PI * 1.16, S, glove, suit);
  paintHand(ctx, c, rimMid, -Math.PI * 0.16, S, glove, suit);
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
  const layout = { near: [], far: [], wheels: [], steering: [], dial: null, needle: null };

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
    layout.near.push(`cockpit.near.${p}`); layout.far.push(`cockpit.far.${p}`); layout.steering.push(`cockpit.steering.${p}`);
  });

  // front-left wheel: steering frames x rolling variants, all sharing one crop so frames register
  const steerOf = (k) => ((k - (STEER_FRAMES - 1) / 2) / ((STEER_FRAMES - 1) / 2)) * MAX_DRAWN_STEER;
  const union = { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9 };
  const wheelModels = [];
  for (let k = 0; k < STEER_FRAMES; k++) {
    const row = [];
    for (let v = 0; v < WHEEL_VARIANTS; v++) {
      const wm = buildFrontWheelModel({ steer: steerOf(k), tread: v < TREAD_PHASES ? { phase: v } : { blur: true } });
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
