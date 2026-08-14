import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config/origenes-tintin.json'), 'utf8'));
const publicOrigin = String(config.publicOrigin || '').replace(/\/$/, '');
const futureOrigin = String(config.futurePublicOrigin || '').replace(/\/$/, '');
const authDomain = String(config.authDomain || '').trim().toLowerCase();
const futureHost = new URL(futureOrigin).hostname;
const failures = [];

function check(label, condition) {
  if (condition) console.log(`OK — ${label}`);
  else { failures.push(label); console.error(`FAIL — ${label}`); }
}

check('publicOrigin usa HTTPS', publicOrigin.startsWith('https://'));
check('futurePublicOrigin usa HTTPS', futureOrigin.startsWith('https://'));
check('dominio futuro es tintinaccs.com', futureHost === 'tintinaccs.com');
check('config browser generada existe', fs.existsSync(path.join(root, 'js/core/config/origenes-publicos.js')));
check('documento de cutover existe', fs.existsSync(path.join(root, 'docs/cutover-tintinaccs-com.md')));

const launched = publicOrigin === futureOrigin;
if (!launched) {
  check('staging sigue en pages.dev mientras Shopify conserva tintinaccs.com', new URL(publicOrigin).hostname === 'tintinaccesorios.pages.dev');
  check('authDomain sigue en pages.dev antes del cutover', authDomain === 'tintinaccesorios.pages.dev');
  console.log('INFO — modo pre-cutover: tintinaccs.com continúa separado hasta completar la lista operativa.');
} else {
  check('authDomain migrado junto al dominio público', authDomain === futureHost);
  const files = [
    ...fs.readdirSync(root).filter(name => name.endsWith('.html')),
    'robots.txt',
    'sitemap.xml'
  ];
  for (const relative of files) {
    const text = fs.readFileSync(path.join(root, relative), 'utf8');
    check(`${relative} no publica pages.dev como canonical/origen`, !text.includes('https://tintinaccesorios.pages.dev'));
  }
  console.log('INFO — modo post-cutover: completar además DNS, OAuth, App Check, Search Console y prueba comercial real.');
}

if (failures.length) {
  console.error(`\nCutover: ${failures.length} condición(es) incumplida(s).`);
  process.exit(1);
}
console.log('\nGate de dominio consistente.');
