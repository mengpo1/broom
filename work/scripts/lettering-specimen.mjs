// Renders the lettering specimen (work/dev/lettering-specimen.js) to work/renders/.
//   node work/scripts/lettering-specimen.mjs
//     -> lettering-specimen.png (main sheet), lettering-specimen-charset-a.png and -charset-b.png
//        (full charset at 160 px cap height), lettering-specimen-styles.png (bold and impact)
//   node work/scripts/lettering-specimen.mjs <sheet> <out.png> [x,y,w,h]
//     -> one sheet (main | charset-a | charset-b | styles), optionally cropped to inspect details
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { openStandalone, root } from './lib-browser.mjs';

const WIDTH = 2000, HEIGHT = 1500;
const [sheet, out, clip] = process.argv.slice(2);
const jobs = sheet
  ? [{ sheet, out: out || `work/renders/lettering-specimen-${sheet}.png`, clip }]
  : [
    { sheet: 'main', out: 'work/renders/lettering-specimen.png' },
    { sheet: 'charset-a', out: 'work/renders/lettering-specimen-charset-a.png' },
    { sheet: 'charset-b', out: 'work/renders/lettering-specimen-charset-b.png' },
    { sheet: 'styles', out: 'work/renders/lettering-specimen-styles.png' },
  ];

const { page, logs, close, file } = await openStandalone({ entry: 'work/dev/lettering-specimen.js', width: WIDTH, height: HEIGHT });
try {
  await page.waitForFunction(() => window.letteringSpecimen, null, { timeout: 15000 });
  for (const job of jobs) {
    await page.evaluate((name) => window.letteringSpecimen.draw(name), job.sheet);
    const options = { path: resolve(root, job.out) };
    if (job.clip) {
      const [x, y, width, height] = job.clip.split(',').map(Number);
      options.clip = { x, y, width, height };
    }
    await page.screenshot(options);
    console.log(`${job.sheet} -> ${job.out}`);
  }
} finally {
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  await close();
  rmSync(file, { force: true });
}
