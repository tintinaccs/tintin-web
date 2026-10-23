import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

export function parseJavaScript(source, file) {
  if (file.endsWith('.mjs')) return new vm.SourceTextModule(source, { identifier: file });
  try {
    // Node wraps CommonJS files in a function (top-level return is valid).
    vm.compileFunction(source.replace(/^#![^\n]*/, ''), ['exports', 'require', 'module', '__filename', '__dirname'], { filename: file });
    return null;
  } catch (scriptError) {
    if (file.endsWith('.cjs')) throw scriptError;
    return new vm.SourceTextModule(source, { identifier: file });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = {};
  for (const file of JSON.parse(fs.readFileSync(0, 'utf8'))) {
    try { parseJavaScript(fs.readFileSync(file, 'utf8'), file); results[file] = { ok: true, error: '' }; }
    catch (error) { results[file] = { ok: false, error: `${file}: ${error.message}`.slice(0, 1200) }; }
  }
  process.stdout.write(JSON.stringify(results));
}
