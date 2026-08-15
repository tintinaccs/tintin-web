'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');
const configPath = path.join(root, 'config/public-site.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || config.origin || '').replace(/\/$/, '');
const hostname = new URL(origin).hostname;
const authDomain = String(process.env.TINTIN_FIREBASE_AUTH_DOMAIN || config.firebaseAuthDomain || hostname).trim();

if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) {
  throw new Error('config/public-site.json debe declarar un origin HTTPS sin path.');
}
if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(authDomain)) {
  throw new Error('firebaseAuthDomain inválido en config/public-site.json.');
}

const knownOrigins = [
  'https://tintinaccesorios.pages.dev',
  'https://tintinaccs.com'
];

function walk(dir, accept) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules', 'artifacts', 'maintenance'].includes(entry.name)) return [];
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute, accept);
    return accept(absolute) ? [absolute] : [];
  });
}

const rootFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && /\.(?:html|js|json|xml|txt)$/i.test(entry.name))
  .map(entry => path.join(root, entry.name));
const runtimeFiles = [
  ...rootFiles,
  ...walk(path.join(root, 'js'), file => file.endsWith('.js')),
  ...walk(path.join(root, 'functions'), file => file.endsWith('.js')),
  ...walk(path.join(root, 'cloudflare'), file => file.endsWith('.js')),
  ...walk(path.join(root, 'scripts'), file => /\.(?:js|mjs)$/i.test(file))
];
const explicitFiles = ['_headers', 'robots.txt'].map(file => path.join(root, file)).filter(fs.existsSync);
const files = [...new Set([...runtimeFiles, ...explicitFiles])]
  .filter(file => path.resolve(file) !== path.resolve(configPath));

function syncText(file, text) {
  let output = text;
  for (const known of knownOrigins) {
    if (known !== origin) output = output.split(known).join(origin);
  }

  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (relative === 'js/core/firebase/firebase.js') {
    output = output.replace(/authDomain\s*:\s*(['"])[^'"]+\1/, `authDomain: "${authDomain}"`);
  }
  return output;
}

const changed = [];
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const after = syncText(file, before);
  if (after === before) continue;
  changed.push(path.relative(root, file).replace(/\\/g, '/'));
  if (!checkOnly) fs.writeFileSync(file, after, 'utf8');
}

if (checkOnly && changed.length) {
  console.error(`ERROR — ${changed.length} archivo(s) no coinciden con el origen central ${origin}:`);
  changed.forEach(file => console.error('- ' + file));
  process.exit(1);
}

if (checkOnly) {
  console.log(`OK — origen público centralizado en ${origin}; Firebase Auth usa ${authDomain}.`);
} else {
  console.log(`Origen público sincronizado: ${origin} (${changed.length} archivo(s) actualizados).`);
}
