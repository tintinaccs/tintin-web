import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const VERSION = 'tintin-20260731-phase10-a11y-1';

for (const name of fs.readdirSync(ROOT)) {
  if (!name.endsWith('.html')) continue;
  const target = path.join(ROOT, name);
  const current = fs.readFileSync(target, 'utf8');
  const next = current.replace(/js\/page-loader\.js\?v=[^"'\s>]+/g, `js/page-loader.js?v=${VERSION}`);
  if (next !== current) fs.writeFileSync(target, next.replace(/\r\n?/g, '\n'), 'utf8');
}

fs.unlinkSync(SELF);
console.log('Cache bust de Fase 10 unificado en todas las páginas HTML.');
