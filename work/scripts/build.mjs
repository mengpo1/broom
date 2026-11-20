// Bundles src/ (ES modules) and the stylesheet into a single self-contained index.html.
// No third-party tooling: a small module concatenator that understands the import/export
// forms used in this code base (named imports/exports, `import * as`, no default exports).
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const IMPORT = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm;
const BARE_IMPORT = /^import\s+['"]([^'"]+)['"];?[ \t]*$/gm;
const EXPORT_DECL = /^export\s+(async\s+function\*?|function\*?|class|const|let|var)\s+([A-Za-z0-9_$]+)/gm;
const EXPORT_LIST = /^export\s*\{([^}]*)\};?[ \t]*$/gm;

/** Bundle an ES module entry file into one classic script (string). */
export function bundleModules(entry) {
  const modules = new Map();
  const order = [];
  const visiting = new Set();
  function load(file) {
    if (modules.has(file)) return;
    if (visiting.has(file)) throw new Error(`Circular import involving ${relative(root, file)}`);
    visiting.add(file);
    let code = readFileSync(file, 'utf8');
    const id = relative(root, file);
    const exports = [];
    const deps = [];
    code = code.replace(IMPORT, (match, clause, spec) => {
      const dep = resolve(dirname(file), spec);
      deps.push(dep);
      const depId = JSON.stringify(relative(root, dep));
      clause = clause.trim();
      if (clause.startsWith('* as ')) return `const ${clause.slice(5).trim()} = __modules[${depId}];`;
      if (!clause.startsWith('{')) throw new Error(`Unsupported import in ${id}: ${match}`);
      const names = clause.slice(1, clause.lastIndexOf('}')).split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => s.replace(/\s+as\s+/, ': '));
      return `const { ${names.join(', ')} } = __modules[${depId}];`;
    });
    code = code.replace(BARE_IMPORT, (match, spec) => { deps.push(resolve(dirname(file), spec)); return ''; });
    code = code.replace(EXPORT_DECL, (match, kind, name) => { exports.push(name); return `${kind} ${name}`; });
    code = code.replace(EXPORT_LIST, (match, list) => {
      for (const part of list.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (part.includes(' as ')) throw new Error(`Unsupported export alias in ${id}`);
        exports.push(part);
      }
      return '';
    });
    if (/^export\s/m.test(code)) throw new Error(`Unsupported export form in ${id}`);
    for (const dep of deps) load(dep);
    visiting.delete(file);
    modules.set(file, { id, code, exports });
    order.push(file);
  }
  load(resolve(entry));
  let bundle = '(function () {\n"use strict";\nconst __modules = {};\n';
  for (const file of order) {
    const m = modules.get(file);
    bundle += `// ---- ${m.id}\n(function () {\n${m.code}\n__modules[${JSON.stringify(m.id)}] = { ${m.exports.join(', ')} };\n})();\n`;
  }
  bundle += '})();\n';
  if (bundle.includes('</script')) throw new Error('Bundle contains a closing script tag');
  return { bundle, count: order.length };
}

/** Wrap a bundle in a minimal standalone HTML page (used by development harnesses). */
export function standalonePage(entry, bodyHtml = '<canvas id="c"></canvas>') {
  const { bundle } = bundleModules(entry);
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#888}</style></head><body>${bodyHtml}<script>\n${bundle}</script></body></html>`;
}

function buildGame() {
  const { bundle, count } = bundleModules(resolve(root, 'src/main.js'));
  const css = readFileSync(resolve(root, 'src/ui/app.css'), 'utf8');
  const template = readFileSync(resolve(root, 'src/ui/index.template.html'), 'utf8');
  const html = template.replace('/*__STYLE__*/', () => css).replace('/*__SCRIPT__*/', () => bundle);
  const out = resolve(root, 'index.html');
  writeFileSync(out, html);
  console.log(`index.html: ${statSync(out).size} bytes, ${count} modules`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildGame();
