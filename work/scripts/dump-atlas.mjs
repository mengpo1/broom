// Save the atlas layers as PNG files for inspection: node work/scripts/dump-atlas.mjs [circuit]
import { writeFileSync, mkdirSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';
const circuit = process.argv[2] || 'hazelbrook';
const { page, logs, close } = await openGame({ width: 640, height: 360, hash: 'quality=low' });
const layers = await page.evaluate(async (circuit) => {
  const { app, quickRace } = window.virage;
  quickRace({ circuit });
  const out = [];
  const dump = async (name, canvases) => {
    for (let i = 0; i < canvases.length; i++) {
      const blob = await canvases[i].convertToBlob({ type: 'image/png' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let j = 0; j < bytes.length; j += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000));
      out.push({ name: `${name}-${i}`, data: btoa(bin) });
    }
  };
  await dump('static', app.art.staticAtlas.canvases);
  await dump('theme', app.art.themeAtlas.canvases);
  return { out, timings: app.art.timings, sprites: app.art.staticAtlas.sprites.size + app.art.themeAtlas.sprites.size };
}, circuit);
mkdirSync(`${root}/work/renders/atlas`, { recursive: true });
for (const l of layers.out) writeFileSync(`${root}/work/renders/atlas/${l.name}.png`, Buffer.from(l.data, 'base64'));
console.log(layers.out.map((l) => l.name).join(' '), JSON.stringify(layers.timings), layers.sprites, 'sprites');
if (logs.some((l) => !l.includes('[log]'))) console.log(logs.filter((l) => !l.includes('[log]')).slice(0, 10).join('\n'));
await close();
