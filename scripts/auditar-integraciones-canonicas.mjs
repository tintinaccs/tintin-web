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
for (const route of ['/api/apps-script-bridge','/api/telemetry','/api/system-health','/api/sheets-product-sync','/api/sheets-products-webhook','/api/sheets-sync-snapshot','/api/sheets-admin-webhook','/api/sheets-engagement-webhook']) {
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

// El checkout histórico necesita todavía el proceso privilegiado de Apps Script
// para la transacción de stock/pedido. Ya no se permite que esa dependencia sea
// una salida de red directa del navegador: integration-router.js intercepta el
// único deployment heredado y lo envía a /api/apps-script-bridge. Cualquier URL
// de Apps Script en otro archivo público vuelve a ser un error.
const directAppsScript = publicFiles
  .filter(file => fs.readFileSync(file, 'utf8').includes('script.google.com/macros/s/'))
  .map(file => path.relative(root, file).split(path.sep).join('/'));
const allowedLegacyAppsScript = new Set(['js/email/configuracion-correo.js']);
const unexpectedAppsScript = directAppsScript.filter(file => !allowedLegacyAppsScript.has(file));
assert(unexpectedAppsScript.length === 0, `Apps Script: dependencia directa inesperada en ${unexpectedAppsScript.join(', ') || 'archivo desconocido'}.`);
assert(directAppsScript.length === 1 && directAppsScript[0] === 'js/email/configuracion-correo.js', `Apps Script: la única referencia pública transitoria debe ser js/email/configuracion-correo.js; encontradas: ${directAppsScript.join(', ') || 'ninguna'}.`);

const integrationRouter = read('js/quality/integration-router.js');
const middleware = read('functions/_middleware.js');
const appsScriptBridge = read('functions/api/apps-script-bridge.js');
const createOrderClient = read('js/create-order-client.js');
assert(integrationRouter.includes("appsScriptMode: 'cloudflare-bridge'") && integrationRouter.includes('/api/apps-script-bridge'), 'Apps Script: falta el router cliente que fuerza el gateway Cloudflare.');
assert(middleware.includes('/js/quality/integration-router.js') && middleware.includes('apps-script-bridge'), 'Apps Script: middleware debe cargar el router antes del runtime de negocio y limitar el bridge.');
assert(appsScriptBridge.includes('APPS_SCRIPT_ORDER_WEBHOOK_URL') && appsScriptBridge.includes('ALLOWED_ACTIONS') && appsScriptBridge.includes('originIsAllowed'), 'Apps Script: el bridge debe fijar upstream, lista blanca de acciones y control de origen.');
assert(createOrderClient.includes('EMAIL_WEBHOOK_URL'), 'Checkout: create-order-client debe seguir entrando por la ruta interceptable mientras se conserva el backend transaccional heredado.');

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
const sheetsScheduler = read('.github/workflows/drenar-cola-sync-catalogo.yml');
assert(!fs.existsSync(path.join(root, 'scripts/drenar-cola-sync-catalogo.mjs')), 'Sheets: no debe existir un drenador local alternativo con secretos estáticos.');
assert(/id-token:\s*write/.test(sheetsScheduler) && /catalog-sheet-sync-drain/.test(sheetsScheduler), 'Sheets: el scheduler debe usar OIDC y el endpoint Cloudflare canónico.');
assert(!/FIREBASE_SERVICE_ACCOUNT_(?:JSON|KEY)|SHEETS_ENGAGEMENT_SECRET/.test(sheetsScheduler), 'Sheets: el scheduler no debe transportar secretos estáticos.');
assert(workflows.length <= 12, `GitHub Actions: hay ${workflows.length} workflows; el presupuesto de desfragmentación es 12.`);
assert(prWorkflows.length === 1 && prWorkflows[0] === 'auditar-tintin.yml', `GitHub Actions: solo auditar-tintin.yml debe dispararse en PR; encontrados: ${prWorkflows.join(', ') || 'ninguno'}.`);

const workflowText = workflows.map(name => read(`.github/workflows/${name}`)).join('\n');
assert(!/firebase\s+deploy[^\n]*--only\s+functions/i.test(workflowText), 'Arquitectura: no debe existir deploy activo de Firebase Functions.');
assert(fs.existsSync(path.join(root, 'firebase-cloud-functions-inactive')), 'Archivo histórico: falta firebase-cloud-functions-inactive; no debe confundirse con runtime activo.');

notes.push(`Firebase=${firebaserc.projects.default}`);
notes.push(`Web=${primaryOrigin.origin}`);
notes.push('API=Cloudflare Pages Functions');
notes.push('AppsScript=backend transaccional detras de Cloudflare bridge');
notes.push(`Workflows=${workflows.length}; PR=${prWorkflows.length}`);
notes.push(`Routes=${include.size}`);

if (failures.length) {
  console.error('INTEGRATION_CONTRACT_FAIL');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log('INTEGRATION_CONTRACT_OK');
notes.forEach(item => console.log(`- ${item}`));
