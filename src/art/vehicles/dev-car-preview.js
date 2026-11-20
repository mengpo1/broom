// Development sheet for the car illustrator (not part of the game bundle).
import { buildCarModel } from './car-model.js';
import { drawCar, drawCarFitted } from './car-illustrator.js';

window.renderPreview = (canvas, args) => {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8fa6b8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const livery = { colors: args.colors || ['#d5302a', '#f1efe6', '#f0c330'] };
  const t0 = performance.now();
  const model = buildCarModel({ detail: args.detail ?? 0 });
  const t1 = performance.now();
  let faces = 0;
  for (const p of model.parts) faces += p.faces.length;
  if (args.hero) {
    const meta = drawCarFitted(ctx, null, model, canvas.width, canvas.height, { yaw: args.yaw ?? 2.5, pitch: args.pitch ?? 0.16, distance: args.distance ?? 7 }, { livery, inkWorld: 0.008 });
    return { build: t1 - t0, draw: performance.now() - t1, faces, meta };
  }
  const cols = 4, rows = 3, cw = canvas.width / cols, ch = canvas.height / rows;
  const yaws = args.yaws || [0, 0.2, 0.5, 0.9, 1.3, 1.5708, 2.0, 2.4, 2.8, 3.1416, -0.35, -1.1];
  yaws.forEach((yaw, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.clip();
    drawCarFitted(ctx, null, model, cw, ch, { yaw, pitch: args.pitch ?? 0.1, distance: 14 }, { livery });
    ctx.restore();
  });
  return { build: t1 - t0, draw: performance.now() - t1, faces };
};
