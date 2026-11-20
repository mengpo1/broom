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
  for (const ch of chars) {
    const advance = (glyphAdvance(ch, options.style) + 0.14) * size;
    if (x + advance > WIDTH - MARGIN) { x = MARGIN; baseline += size * pitch; }
    drawText(ctx, ch, x, baseline, size, options);
    x += advance;
  }
  return baseline + size * 0.45;
}

function label(text, y) { drawText(ctx, text, MARGIN, y, 13, { style: 'bold', color: '#9a8f7c' }); }

function rule(y) { ctx.fillStyle = '#d7cfbc'; ctx.fillRect(MARGIN, y, WIDTH - 2 * MARGIN, 2); }

function mainSheet() {
  let y = 34;
  label('CAPTION 24 PX', y);
  y = charRows(LETTERING_CHARSET, y - 14, 24, { style: 'caption' }, 1.9);
  rule(y + 8);
  label('CAPTION 64 PX', y + 36);
  y = charRows(LETTERING_CHARSET, y + 10, 64, { style: 'caption' }, 1.72);
  rule(y + 12);

  y += 78;
  const french = 'VOIX ÉLECTRIQUE : ÇA Y EST, IL DÉPASSE LE N° 27 À 312 KM/H !';
  const english = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789';
  drawText(ctx, french, MARGIN, y, 40, { style: 'caption' });
  drawText(ctx, english, MARGIN, y + 76, 40, { style: 'caption', seed: 3 });
  drawText(ctx, french, MARGIN, y + 150, 36, { style: 'bold', seed: 5 });
  drawText(ctx, english, MARGIN, y + 218, 36, { style: 'bold', seed: 8 });
  drawText(ctx, french, MARGIN, y + 262, 24, { style: 'caption', seed: 11 });
  drawText(ctx, english, MARGIN + 1010, y + 262, 24, { style: 'caption', seed: 12 });
  rule(y + 290);

  // lap times: tabular digits keep the columns aligned
  y += 440;
  drawText(ctx, '1:23.456', MARGIN, y, 120, { style: 'bold' });
  const times = ['1:23.456', '1:11.117', '0:59.870', '2:04.308'];
  times.forEach((time, i) => drawText(ctx, time, 1010, y - 116 + i * 52, 30, { style: 'bold', align: 'right', seed: i }));
  drawText(ctx, '312 KM/H', 1060, y - 54, 54, { style: 'bold', color: PAPER, outline: INK, outlineWidth: 5 });
  drawText(ctx, 'TOUR 7/12 – P3', 1060, y, 30, { style: 'caption', color: RED });

  // caption box ("récitatif")
  const boxX = 1440, boxY = y - 150, boxW = 510, pad = 20, size = 22;
  const story = 'Dernier tour à Virage-sur-Mer ! Léa Duchêne (n° 27) plonge à l\'intérieur... « Ça passe ou ça casse ! » Où est passé le leader ?';
  const box = drawTextBox(null, story, 0, 0, boxW - 2 * pad, size, { style: 'caption' });
  ctx.fillStyle = INK;
  ctx.fillRect(boxX + 5, boxY + 6, boxW, box.height + 2 * pad + 8);
  ctx.fillStyle = CAPTION;
  ctx.fillRect(boxX, boxY, boxW, box.height + 2 * pad + 8);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, box.height + 2 * pad + 8);
  drawTextBox(ctx, story, boxX + pad, boxY + pad + 6, boxW - 2 * pad, size, { style: 'caption' });
  rule(y + 46);

  // onomatopoeia
  y += 250;
  drawText(ctx, 'VROOAAR', MARGIN + 20, y, 130, { style: 'impact', color: RED, bounce: 0.8, seed: 2, shadow: { dx: 8, dy: 8, color: INK } });
  drawText(ctx, 'CRAC !', 1130, y - 20, 110, { style: 'impact', color: YELLOW, bounce: 1, seed: 5, shadow: { dx: 7, dy: 7, color: RED } });
  drawText(ctx, 'VIRAGE GP', 1960, y - 10, 70, { style: 'impact', color: PAPER, align: 'right' });
  y += 235;
  drawText(ctx, 'SCRIIIII', MARGIN + 20, y, 120, { style: 'impact', color: YELLOW, bounce: 0.6, seed: 9, tracking: -0.03, shadow: { dx: 7, dy: 7, color: INK } });
  drawText(ctx, 'BANG !', 1000, y, 140, { style: 'impact', color: ORANGE, bounce: 1, seed: 4, shadow: { dx: 9, dy: 9, color: INK } });
  drawText(ctx, 'ÉDITION BD', 1960, y + 10, 46, { style: 'impact', color: RED, align: 'right' });
}

function charsetSheet() {
  label('CAPTION 160 PX', 34);
  charRows(LETTERING_CHARSET, -150, 160, { style: 'caption' }, 1.49);
}

function stylesSheet() {
  let y = 34;
  label('BOLD 64 PX', y);
  y = charRows(LETTERING_CHARSET, y - 50, 64, { style: 'bold' }, 1.72);
  rule(y + 12);
  label('IMPACT 64 PX', y + 40);
  y = charRows(LETTERING_CHARSET, y - 10, 64, { style: 'impact' }, 1.9);
  rule(y + 20);
  y += 110;
  drawText(ctx, 'DÉPART ! ÇA Y EST, IL DÉPASSE LE N° 27 À 312 KM/H', MARGIN, y, 44, { style: 'impact', color: YELLOW });
  drawText(ctx, 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', MARGIN, y + 96, 44, { style: 'impact', color: RED, seed: 2 });
  drawText(ctx, 'WHEN I SAY GO, I MEAN IT: AVATAR LTD. – "TOYOTA" L\'AVION PAYS', MARGIN, y + 176, 36, { style: 'caption' });
  drawText(ctx, 'NAÏVE NOËL GARÇON MAÎTRE CŒUR ÆQUO SEÑOR MÜNCHEN FAÇADE HÔTEL', MARGIN, y + 250, 36, { style: 'bold' });
}

const SHEETS = { main: mainSheet, charset: charsetSheet, styles: stylesSheet };

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
