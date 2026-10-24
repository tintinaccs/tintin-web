import fs from 'node:fs';
import path from 'node:path';
import { parseJavaScript } from './verificar-sintaxis-lote.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = process.cwd();
const start = performance.now();
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const sources = [...new Set(files)].filter(file => /\.(?:[cm]?js)$/.test(file) && !/^(?:assets|assets-tintin|maintenance)\//.test(file));
const modules = new Map();
const errors = [];
for (const file of sources) {
  try {
    const source = fs.readFileSync(file, 'utf8');
    // Parse both classic scripts and ES modules, without executing browser code.
    const module = parseJavaScript(source, file);
    if (module) modules.set(file, module);
  } catch (error) { errors.push(`${file}: ${error.message}`); }
}
for (const [file, module] of modules) {
  const require = createRequire(path.resolve(file));
  for (const specifier of module.dependencySpecifiers) {
    try {
      if (/^https?:/.test(specifier) || specifier.startsWith('node:')) continue;
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier.split(/[?#]/)[0]);
        if (!target.startsWith(root + path.sep) || !fs.statSync(target).isFile()) throw new Error('archivo local ausente');
      } else if (!specifier.startsWith('/')) require.resolve(specifier);
    } catch (error) { errors.push(`${file}: import ${JSON.stringify(specifier)} — ${error.message}`); }
  }
}
// Server imports must also load under Node/Playwright: query versions are for
// browser URLs. Traverse their full static graph, including shared modules.
const seen = new Set();
function serverGraph(file) {
  if (seen.has(file)) return;
  seen.add(file);
  for (const specifier of modules.get(file)?.dependencySpecifiers || []) {
    if (!specifier.startsWith('.')) continue;
    if (/^(functions|cloudflare)\//.test(file) && /[?#]/.test(specifier)) errors.push(`${file}: import de servidor con versión URL: ${specifier}`);
    const target = path.relative(root, path.resolve(path.dirname(file), specifier.split(/[?#]/)[0]));
    serverGraph(target);
  }
}
for (const file of sources.filter(file => /^(functions|cloudflare)\//.test(file))) serverGraph(file);
if (errors.length) {
  for (const error of errors) console.error(`::error::${error.replaceAll('\n', ' ')}\n${error}`);
  console.error('Reproducir: npm run test:fast');
  process.exit(1);
}
// Import entrypoints in a separate process: unresolved exports, dependencies and
// top-level ReferenceErrors fail before any browser installation or full audit.
const entries = sources.filter(file => file.startsWith('functions/'));
// Keep executable source constant. Repository paths are JSON data in argv,
// never fragments interpolated into JavaScript source.
const code = "globalThis.fetch = () => { throw new Error('Red prohibida durante import smoke'); }; for (const file of JSON.parse(process.argv[1])) { try { await import(new URL(file, process.argv[2])); } catch (error) { console.error(file, error); process.exit(1); } }";
const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(entries), pathToFileURL(root + '/').href], { encoding: 'utf8', timeout: 30000 });
if (loaded.status !== 0) {
  console.error(loaded.stderr || loaded.error || 'El smoke de servidor no terminó correctamente');
  process.exit(1);
}
const dependencies = spawnSync('npm', ['ls', '--depth=0'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (dependencies.status !== 0) process.exit(1);
console.log(`Preflight: ${sources.length} archivos parseados, ${entries.length} funciones importadas; ${((performance.now() - start) / 1000).toFixed(2)}s. Sin peticiones ni escrituras de datos.`);
