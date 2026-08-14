import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'config/origenes-tintin.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const write = process.argv.includes('--write');

function cleanOrigin(value, name) {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(raw)) throw new Error(`${name} inválido: ${value}`);
  return raw;
}

function walkJs(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJs(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const publicOrigin = cleanOrigin(config.publicOrigin, 'publicOrigin');
const functionsOrigin = cleanOrigin(config.functionsFallbackOrigin, 'functionsFallbackOrigin');
const futureOrigin = cleanOrigin(config.futurePublicOrigin, 'futurePublicOrigin');
const authDomain = String(config.authDomain || '').trim().toLowerCase();
if (!/^[a-z0-9.-]+$/.test(authDomain)) throw new Error('authDomain inválido.');

const knownOrigins = new Set([
  publicOrigin,
  futureOrigin,
  'https://tintinaccesorios.pages.dev',
  'https://tintinaccs.com',
  'https://tintinaccs.github.io/tintin-web'
]);
const originPattern = new RegExp([...knownOrigins]
  .sort((a, b) => b.length - a.length)
  .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|'), 'g');

const generatedBrowserConfig = `// Generado a partir de config/origenes-tintin.json.\n// Mantener este módulo sincronizado mediante scripts/sincronizar-origen-publico.mjs.\nexport const TINTIN_PUBLIC_ORIGIN = '${publicOrigin}';\nexport const TINTIN_FUNCTIONS_FALLBACK_ORIGIN = '${functionsOrigin}';\nexport const TINTIN_AUTH_DOMAIN = '${authDomain}';\nexport const TINTIN_FUTURE_PUBLIC_ORIGIN = '${futureOrigin}';\n`;

const targets = new Map();
targets.set('js/core/config/origenes-publicos.js', generatedBrowserConfig);

for (const name of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
  const file = path.join(root, name);
  targets.set(name, fs.readFileSync(file, 'utf8').replace(originPattern, publicOrigin));
}

for (const file of [path.join(root, 'tienda.js'), ...walkJs(path.join(root, 'js'))]) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (relative === 'js/core/config/origenes-publicos.js') continue;
  targets.set(relative, fs.readFileSync(file, 'utf8').replace(originPattern, publicOrigin));
}

{
  const file = path.join(root, 'robots.txt');
  let text = fs.readFileSync(file, 'utf8').replace(originPattern, publicOrigin);
  text = text.replace(/^Sitemap:.*$/gm, '').replace(/\n{3,}/g, '\n\n').trimEnd();
  text += `\n\nSitemap: ${publicOrigin}/sitemap.xml\nSitemap: ${publicOrigin}/sitemap-products.xml\n`;
  targets.set('robots.txt', text);
}

{
  const file = path.join(root, 'sitemap.xml');
  targets.set('sitemap.xml', fs.readFileSync(file, 'utf8').replace(originPattern, publicOrigin));
}

const drift = [];
for (const [relative, expected] of targets) {
  const file = path.join(root, relative);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current === expected) continue;
  if (write) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, expected, 'utf8');
  } else {
    drift.push(relative);
  }
}

if (drift.length) {
  console.error(`Origen público desincronizado en: ${drift.join(', ')}`);
  console.error('Ejecutá: node scripts/sincronizar-origen-publico.mjs --write');
  process.exit(1);
}

console.log(`${write ? 'Sincronizado' : 'OK'} — origen público ${publicOrigin}; auth ${authDomain}; futuro ${futureOrigin}.`);
