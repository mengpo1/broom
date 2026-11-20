// Builds every circuit, prints metrics and renders a contact sheet (work/renders/track-maps.png).
import { CIRCUITS } from '../../src/tracks/track-catalog.js';
import { buildTrack } from '../../src/tracks/track-builder.js';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const cells = [];
let failed = false;
for (const def of CIRCUITS) {
  const t0 = performance.now();
  const t = buildTrack(def);
  let maxK = 0, maxGrade = 0, minBar = 1e9, maxLine = 0;
  for (let i = 0; i < t.n; i++) {
    maxK = Math.max(maxK, Math.abs(t.kappa[i]));
    maxGrade = Math.max(maxGrade, Math.abs(t.grade[i]));
    minBar = Math.min(minBar, t.barrierL[i] - t.halfWidth, t.barrierR[i] - t.halfWidth);
    maxLine = Math.max(maxLine, Math.abs(t.line[i]));
  }
  console.log(`${def.id.padEnd(16)} L=${t.length.toFixed(0).padStart(5)} m  n=${t.n}  minR=${(1 / maxK).toFixed(0).padStart(3)} m  grade=${(maxGrade * 100).toFixed(1)}%  minVerge=${minBar.toFixed(1)}  clear=${t.minClearance.toFixed(0)}  build=${(performance.now() - t0).toFixed(0)}ms  ${t.warnings.join('; ')}`);
  if (t.warnings.length) failed = true;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < t.n; i++) { minX = Math.min(minX, t.x[i]); maxX = Math.max(maxX, t.x[i]); minZ = Math.min(minZ, t.z[i]); maxZ = Math.max(maxZ, t.z[i]); }
  const pad = 60, w = maxX - minX + 2 * pad, h = maxZ - minZ + 2 * pad;
  const pt = (i, d) => `${(t.x[i] + t.nx[i] * d - minX + pad).toFixed(1)},${(t.z[i] + t.nz[i] * d - minZ + pad).toFixed(1)}`;
  const path = (fn) => { let s = ''; for (let i = 0; i <= t.n; i++) s += (i ? 'L' : 'M') + pt(i % t.n, fn(i % t.n)); return s; };
  const kerbs = [];
  for (let i = 0; i < t.n; i++) {
    if (t.kerbR[i] > 0.5) kerbs.push(`<circle cx="${pt(i, t.halfWidth + 1).split(',')[0]}" cy="${pt(i, t.halfWidth + 1).split(',')[1]}" r="2" fill="#e33"/>`);
    if (t.kerbL[i] > 0.5) kerbs.push(`<circle cx="${pt(i, -t.halfWidth - 1).split(',')[0]}" cy="${pt(i, -t.halfWidth - 1).split(',')[1]}" r="2" fill="#e33"/>`);
  }
  cells.push(`<svg viewBox="0 0 ${w} ${h}" width="400" height="300" style="background:#1d2a1d">
    <path d="${path((i) => t.barrierR[i])}" fill="none" stroke="#9a8" stroke-width="2"/>
    <path d="${path((i) => -t.barrierL[i])}" fill="none" stroke="#9a8" stroke-width="2"/>
    <path d="${path(() => 0)}" fill="none" stroke="#555" stroke-width="${t.halfWidth * 2}"/>
    ${kerbs.join('')}
    <path d="${path((i) => t.line[i])}" fill="none" stroke="#fc3" stroke-width="1.5"/>
    <circle cx="${pt(0, 0).split(',')[0]}" cy="${pt(0, 0).split(',')[1]}" r="12" fill="#fff"/>
    <text x="20" y="${h - 20}" fill="#fff" font-size="${Math.max(w, h) / 22}">${def.name} — ${(t.length / 1000).toFixed(2)} km</text></svg>`);
}
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(6,400px);gap:4px">${cells.join('')}</body>`;
writeFileSync(new URL('../renders/track-maps.html', import.meta.url), html);
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2424, height: 912 } });
await p.goto(new URL('../renders/track-maps.html', import.meta.url).href);
await p.screenshot({ path: new URL('../renders/track-maps.png', import.meta.url).pathname });
await b.close();
process.exit(failed ? 1 : 0);
