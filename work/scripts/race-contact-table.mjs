// The table of the non-regression report on full computer-driven races: three circuits, arcade and
// competition rules, with the previous contact model (legacy) and the current one. One process per
// race (the legacy switch changes the tuning for the whole process).
// node work/scripts/race-contact-table.mjs [out.json]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { root } from './lib-browser.mjs';

const out = process.argv[2] || 'work/benchmarks/race-contact-stats.json';
const table = {};
for (const rules of ['arcade', 'competition']) {
  for (const circuit of ['hazelbrook', 'porto-sereno', 'meridian-docks']) {
    for (const model of ['legacy', 'new']) {
      const args = ['work/scripts/race-contact-stats.mjs', circuit, '3', ...(model === 'legacy' ? ['--legacy'] : []), ...(rules === 'competition' ? ['--racing'] : [])];
      const row = JSON.parse(execFileSync('node', args, { cwd: root, encoding: 'utf8' }).trim().split('\n').at(-1));
      table[`${circuit}:${rules}:${model}`] = row;
      console.log(`${circuit} ${rules} ${model}: winner ${row.winnerTime} s, best lap ${row.bestLap} s, finishers ${row.finishers}, contacts ${row.contact}, bumps ${row.bump}, wheel ${row.wheel}, launches ${row.launch} (hops ${row.hop}), crashes ${row.crash}, walls ${row.wall}, resets ${row.resets}`);
    }
  }
}
writeFileSync(`${root}/${out}`, JSON.stringify(table, null, 1));
console.log('->', out);
