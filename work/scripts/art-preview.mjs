// Render a development art sheet: node work/scripts/art-preview.mjs <entry.js> <out.png> [width] [height] [json args]
// The entry module must define window.renderPreview(canvas, args) (may be async).
import { openStandalone, root } from './lib-browser.mjs';
const [entry, out = 'work/renders/preview.png', width = '1600', height = '1000', args = '{}'] = process.argv.slice(2);
const { page, logs, close } = await openStandalone({ entry, width: +width, height: +height });
const t0 = Date.now();
const result = await page.evaluate(async ([w, h, args]) => {
  const canvas = document.getElementById('c');
  canvas.width = w; canvas.height = h;
  canvas.style.cssText = `display:block;width:${w}px;height:${h}px`;
  try { return (await window.renderPreview(canvas, args)) || 'ok'; } catch (e) { return `error: ${e.message}\n${e.stack}`; }
}, [+width, +height, JSON.parse(args)]);
await page.screenshot({ path: `${root}/${out}`, clip: { x: 0, y: 0, width: +width, height: +height } });
console.log(typeof result === 'string' ? result : JSON.stringify(result), `(${Date.now() - t0} ms)`);
const errors = logs.filter((l) => !l.includes('[log]'));
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await close();
