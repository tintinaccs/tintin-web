import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const self = fileURLToPath(import.meta.url);
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const write = (relative, content) => fs.writeFileSync(path.join(root, relative), String(content).replace(/\r\n?/g, '\n'), 'utf8');
const origin = 'https://tintinaccesorios.pages.dev';

let admin = read('js/admin-app.js');
admin = admin
  .replaceAll('https://tintinaccs.github.io/tintin-web/admin.html', `${origin}/admin.html`)
  .replaceAll('https://tintinaccs.github.io/tintin-web/', `${origin}/`)
  .replaceAll('https://tintinaccs.github.io/tintin-web', origin);
write('js/admin-app.js', admin);

let home = read('js/home-maintenance.js');
home = home
  .replaceAll('tintinaccs.github.io/tintin-web', 'tintinaccesorios.pages.dev');
write('js/home-maintenance.js', home);

let audit = read('scripts/audit-phase11-seo.js');
audit = audit.replace(
  `/name="robots" content="noindex, nofollow, noarchive"/.test(html)`,
  `/<meta\\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*\\bnoindex\\b)[^>]*>/i.test(html)`
);
audit = audit.replace(
  `html.matchAll(/(?:href|src)=["']([^"']+)["']/g)`,
  `html.matchAll(/(?:^|\\s)(?:href|src)=["']([^"']+)["']/g)`
);
if (audit.includes(`name="robots" content="noindex, nofollow, noarchive"/.test(html)`)) {
  throw new Error('No se pudo actualizar el contrato flexible de noindex.');
}
if (audit.includes(`html.matchAll(/(?:href|src)=["']([^"']+)["']/g)`)) {
  throw new Error('No se pudo actualizar el extractor de recursos HTML.');
}
write('scripts/audit-phase11-seo.js', audit);

fs.unlinkSync(self);
console.log('Contratos SEO finales corregidos: alias noindex, origen público y referencias HTML reales.');
