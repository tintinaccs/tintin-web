import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const target = path.join(ROOT, 'nosotros.html');
let html = fs.readFileSync(target, 'utf8');
html = html.replace(/\s*<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi, '\n');
html = html.replace(
  /(<title>[\s\S]*?<\/title>)/i,
  '$1\n  <link rel="canonical" href="https://tintinaccesorios.pages.dev/about.html">'
);
fs.writeFileSync(target, html.replace(/\r\n?/g, '\n'), 'utf8');
fs.unlinkSync(SELF);
console.log('Alias nosotros canonicalizado hacia la página pública about.html.');
