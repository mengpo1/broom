// Development specimen of the procedural lettering (see work/scripts/lettering-specimen.mjs).
// Draws on <canvas id="c">; the sheet is chosen by the URL hash or window.letteringSpecimen.draw(name).
import { drawText, drawTextBox, measureText, glyphAdvance, LETTERING_CHARSET } from './lettering.js';

const WIDTH = 2000, HEIGHT = 1500, MARGIN = 50;
const INK = '#16161f', PAPER = '#f4efe2', RED = '#e0312b', YELLOW = '#ffd42a', ORANGE = '#f58a1f', CAPTION = '#f6e27a';
const canvas = document.getElementById('c');
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.style.display = 'block';
const ctx = canvas.getContext('2d');

/** Draw characters one by one in rows (no kerning, a little air between them). Returns the next y. */
function charRows(chars, y, size, options, pitch) {
  let x = MARGIN, baseline = y + size * 1.45;
  const row = Object.assign({ crossbarI: false }, options);
  for (const ch of chars) {
    const advance = (glyphAdvance(ch, options.style) + 0.14) * size;
    if (x + advance > WIDTH - MARGIN) { x = MARGIN; baseline += size * pitch; }
    drawText(ctx, ch, x, baseline, size, row);
    x += advance;
  }
  return baseline + size * 0.45;
}

function label(text, y) { drawText(ctx, text, MARGIN, y, 11, { style: 'bold', color: '#a39884', jitter: 0 }); }

function rule(y) { ctx.fillStyle = '#d7cfbc'; ctx.fillRect(MARGIN, y, WIDTH - 2 * MARGIN, 2); }

const FRENCH = 'VOIX ÉLECTRIQUE : ÇA Y EST, IL DÉPASSE LE N° 27 À 312 KM/H !';
const ENGLISH = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789';

function mainSheet() {
  let y = 22;
  label('CAPTION 24 PX', y);
  y = charRows(LETTERING_CHARSET, y - 4, 24, { style: 'caption' }, 1.9);
  rule(y + 6);
  label('CAPTION 64 PX', y + 26);
  y = charRows(LETTERING_CHARSET, y + 2, 64, { style: 'caption' }, 1.66);
  rule(y + 4);

  y += 66;
  drawText(ctx, FRENCH, MARGIN, y, 40, { style: 'caption' });
  drawText(ctx, ENGLISH, MARGIN, y + 72, 40, { style: 'caption', seed: 3 });
  drawText(ctx, FRENCH, MARGIN, y + 142, 34, { style: 'bold', seed: 5 });
  drawText(ctx, FRENCH, MARGIN, y + 190, 24, { style: 'caption', seed: 11 });
  drawText(ctx, 'THE QUICK BROWN FOX JUMPS', WIDTH - MARGIN, y + 190, 24, { style: 'caption', seed: 12, align: 'right' });
  rule(y + 212);

  // lap times: tabular digits keep the columns aligned
  y += 360;
  drawText(ctx, '1:23.456', MARGIN, y, 112, { style: 'bold' });
  const times = ['1:23.456', '1:11.117', '0:59.870', '2:04.308'];
  times.forEach((time, i) => drawText(ctx, time, 1000, y - 106 + i * 44, 26, { style: 'bold', align: 'right', seed: i }));
  drawText(ctx, '312 KM/H', 1050, y - 52, 52, { style: 'bold', color: PAPER, outline: INK, outlineWidth: 5 });
  drawText(ctx, 'TOUR 7/12 – P3', 1050, y, 28, { style: 'caption', color: RED });

  // caption box ("récitatif")
  const boxX = 1470, boxY = y - 128, boxW = 480, pad = 18, size = 19;
  const story = 'Dernier tour à Virage-sur-Mer ! Léa Duchêne (n° 27) plonge à l\'intérieur... « Ça passe ou ça casse ! » Où est passé le leader ?';
  const box = drawTextBox(null, story, 0, 0, boxW - 2 * pad, size, { style: 'caption' });
  const boxH = box.height + 2 * pad + 8;
  ctx.fillStyle = INK;
  ctx.fillRect(boxX + 5, boxY + 6, boxW, boxH);
  ctx.fillStyle = CAPTION;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  drawTextBox(ctx, story, boxX + pad, boxY + pad + 6, boxW - 2 * pad, size, { style: 'caption' });
  rule(y + 34);

  // onomatopoeia and titles
  y += 208;
  drawText(ctx, 'VROOAAR', MARGIN + 16, y, 118, { style: 'impact', color: RED, bounce: 0.8, seed: 2, shadow: { dx: 8, dy: 8, color: INK } });
  drawText(ctx, 'CRAC !', 1210, y - 4, 108, { style: 'impact', color: YELLOW, bounce: 1, seed: 5, shadow: { dx: 7, dy: 7, color: RED } });
  y += 200;
  drawText(ctx, 'SCRIIIII', MARGIN + 16, y, 108, { style: 'impact', color: YELLOW, bounce: 0.6, seed: 9, shadow: { dx: 7, dy: 7, color: INK } });
  drawText(ctx, 'BANG !', 1090, y + 8, 124, { style: 'impact', color: ORANGE, bounce: 1, seed: 4, shadow: { dx: 9, dy: 9, color: INK } });
  y += 118;
  const x = drawText(ctx, 'VIRAGE GP ', MARGIN, y, 44, { style: 'impact', color: PAPER });
  drawText(ctx, 'ÉDITION BD', MARGIN + x, y, 44, { style: 'impact', color: RED });
  drawText(ctx, 'N° 27 – 312 KM/H', WIDTH - MARGIN, y, 44, { style: 'impact', color: YELLOW, align: 'right' });
}

// the 160 px charset needs two sheets
const SPLIT = LETTERING_CHARSET.indexOf('.');

function charsetSheetA() {
  label('CAPTION 160 PX (1/2)', 22);
  charRows(LETTERING_CHARSET.slice(0, SPLIT), 4, 160, { style: 'caption' }, 1.72);
}

function charsetSheetB() {
  label('CAPTION 160 PX (2/2)', 22);
  charRows(LETTERING_CHARSET.slice(SPLIT), 30, 160, { style: 'caption' }, 1.78);
}

function stylesSheet() {
  let y = 22;
  label('BOLD 64 PX', y);
  y = charRows(LETTERING_CHARSET, y - 18, 64, { style: 'bold' }, 1.8);
  rule(y + 8);
  label('IMPACT 56 PX', y + 26);
  y = charRows(LETTERING_CHARSET, y - 4, 56, { style: 'impact' }, 1.95);
  rule(y + 18);
  y += 100;
  drawText(ctx, 'DÉPART ! ÇA Y EST, IL DÉPASSE LE N° 27 À 312 KM/H', MARGIN, y, 40, { style: 'impact', color: YELLOW });
  drawText(ctx, 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', MARGIN, y + 84, 40, { style: 'impact', color: RED, seed: 2 });
  drawText(ctx, 'WHEN I SAY GO, I MEAN IT: AVATAR LTD. – "TOYOTA" L\'AVION PAYS', MARGIN, y + 150, 34, { style: 'caption' });
  drawText(ctx, 'NAÏVE NOËL GARÇON MAÎTRE CŒUR ÆQUO SEÑOR MÜNCHEN FAÇADE HÔTEL', MARGIN, y + 214, 32, { style: 'bold' });
}

const SHEETS = { main: mainSheet, 'charset-a': charsetSheetA, 'charset-b': charsetSheetB, styles: stylesSheet };

function drawSheet(name) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  (SHEETS[name] || mainSheet)();
  return Object.keys(SHEETS);
}

// measureText must agree with what drawText reports
console.assert(Math.abs(measureText('TABULAR 0123456789', 40) - drawText(null, 'TABULAR 0123456789', 0, 0, 40)) < 1e-6);
window.letteringSpecimen = { draw: drawSheet, sheets: Object.keys(SHEETS) };
drawSheet(location.hash.slice(1));
