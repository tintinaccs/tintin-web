import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const notes = [];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const assert = (condition, message) => { if (!condition) failures.push(message); };

const firebaserc = json('.firebaserc');
const firebase = json('firebase.json');
const publicSite = json('config/public-site.json');
const routes = json('_routes.json');
const sheetsConfig = read('cloudflare/sheets-sync-config.js');
const functionOrigin = read('js/core/firebase/origen-funciones.js');
const envExample = read('.env.example');

assert(firebaserc?.projects?.default === 'tintin-accesorios', 'Firebase: el proyecto default debe ser tintin-accesorios.');
assert(firebase?.firestore?.rules === 'firestore.rules', 'Firebase: firestore.rules debe ser la autoridad de reglas.');
assert(!firebase.hosting, 'Firebase Hosting no debe activarse: Cloudflare Pages es la entrega web canónica.');
assert(!firebase.functions, 'Firebase Functions no debe activarse: /api/* vive en Cloudflare Pages Functions.');

const primaryOrigin = new URL(publicSite.origin);
assert(primaryOrigin.protocol === 'https:', 'Sitio público: origin debe usar HTTPS.');
assert(publicSite.firebaseAuthDomain === primaryOrigin.hostname, 'Sitio público: firebaseAuthDomain debe coincidir con el host de origin.');
if (publicSite.cutover) {
  const cutover = new URL(publicSite.cutover.origin);
  assert(publicSite.cutover.firebaseAuthDomain === cutover.hostname, 'Cutover: firebaseAuthDomain debe coincidir con el host objetivo.');
  assert(String(publicSite.cutover.oauthRedirectUri || '').startsWith(`${publicSite.cutover.origin}/__/auth/`), 'Cutover: oauthRedirectUri debe pertenecer al origin objetivo.');
}

const appsScriptMatch = sheetsConfig.match(/APPS_SCRIPT_SYNC_URL\s*=\s*['\"]([^'\"]+)['\"]/);
assert(appsScriptMatch, 'Sheets: falta APPS_SCRIPT_SYNC_URL canónico.');
if (appsScriptMatch) {
  const url = new URL(appsScriptMatch[1]);
  assert(url.protocol === 'https:' && url.hostname === 'script.google.com' && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname), 'Sheets: APPS_SCRIPT_SYNC_URL debe ser un deployment /macros/s/.../exec HTTPS.');
}

const include = new Set(routes.include || []);
const apiDir = path.join(root, 'functions/api');
for (const entry of fs.readdirSync(apiDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const route = `/api/${entry.name.slice(0, -3)}`;
  assert(include.has(route), `Cloudflare: ${route} existe en functions/api pero falta en _routes.json.`);
}
for (const route of ['/api/telemetry','/api/system-health','/api/sheets-product-sync','/api/sheets-products-webhook','/api/sheets-sync-snapshot','/api/sheets-admin-webhook','/api/sheets-engagement-webhook']) {
  assert(include.has(route), `Cloudflare/Sheets: falta ruta canónica ${route}.`);
}
assert(functionOrigin.includes(primaryOrigin.origin), 'Frontend: el fallback de funciones debe coincidir con config/public-site.json.');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
const publicFiles = [
  ...walk(path.join(root, 'js')),
  ...fs.readdirSync(root).filter(name => name.endsWith('.html') || name === 'tienda.js' || name === 'firebase-messaging-sw.js').map(name => path.join(root, name)),
];
for (const file of publicFiles) {
  const text = fs.readFileSync(file, 'utf8');
  assert(!text.includes('script.google.com/macros/s/'), `Sheets: URL de Apps Script expuesta al navegador en ${path.relative(root, file)}.`);
}

const secretKeys = [
  'EMAIL_PROVIDER_API_KEY','ORDER_WEBHOOK_SHARED_SECRET','PAYMENT_PRIVATE_KEY','PAYMENT_WEBHOOK_SECRET',
  'PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID','GITHUB_TOKEN','FIREBASE_SERVICE_ACCOUNT_JSON',
  'TINTIN_PUSH_WEBHOOK_SECRET','CODE_STUDIO_GITHUB_APP_PRIVATE_KEY','CODE_STUDIO_GITHUB_WEBHOOK_SECRET','CODE_STUDIO_AI_TOKEN'
];
for (const key of secretKeys) {
  const line = envExample.split(/\r?\n/).find(row => row.startsWith(`${key}=`));
  if (line) assert(line === `${key}=`, `.env.example: ${key} debe permanecer vacío.`);
}

const workflowDir = path.join(root, '.github/workflows');
const workflows = fs.readdirSync(workflowDir).filter(name => /\.ya?ml$/.test(name));
const prWorkflows = workflows.filter(name => /(^|\n)\s*pull_request\s*:/.test(read(`.github/workflows/${name}`)));
assert(workflows.length <= 12, `GitHub Actions: hay ${workflows.length} workflows; el presupuesto de desfragmentación es 12.`);
assert(prWorkflows.length === 1 && prWorkflows[0] === 'auditar-tintin.yml', `GitHub Actions: solo auditar-tintin.yml debe dispararse en PR; encontrados: ${prWorkflows.join(', ') || 'ninguno'}.`);

const workflowText = workflows.map(name => read(`.github/workflows/${name}`)).join('\n');
assert(!/firebase\s+deploy[^\n]*--only\s+functions/i.test(workflowText), 'Arquitectura: no debe existir deploy activo de Firebase Functions.');
assert(fs.existsSync(path.join(root, 'firebase-cloud-functions-inactive')), 'Archivo histórico: falta firebase-cloud-functions-inactive; no debe confundirse con runtime activo.');

notes.push(`Firebase=${firebaserc.projects.default}`);
notes.push(`Web=${primaryOrigin.origin}`);
notes.push(`API=Cloudflare Pages Functions`);
notes.push(`Workflows=${workflows.length}; PR=${prWorkflows.length}`);
notes.push(`Routes=${include.size}`);

if (failures.length) {
  console.error('INTEGRATION_CONTRACT_FAIL');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log('INTEGRATION_CONTRACT_OK');
notes.forEach(item => console.log(`- ${item}`));
