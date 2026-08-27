import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let failures = 0;

function check(label, condition) {
  if (condition) console.log(`OK — ${label}`);
  else {
    failures += 1;
    console.error(`FAIL — ${label}`);
  }
}

const core = read('cloudflare/system-health.js');
const adminRuntime = read('cloudflare/admin-runtime-health.js');
const publicHealth = read('functions/api/health.js');
const protectedHealth = read('functions/api/system-health.js');
const ui = read('js/admin/diagnostics/estado-ecosistema-admin.js');
const injector = read('cloudflare/inyectar-diagnostico-maestro-admin.js');
const sheetsSync = read('functions/api/sheets-product-sync.js');
const sheetsConfig = read('cloudflare/sheets-sync-config.js');
const pkg = JSON.parse(read('package.json'));

check(
  'El health público permanece liviano y no depende de Google Sheets/Apps Script',
  !publicHealth.includes("system-health.js") &&
    !publicHealth.includes('APPS_SCRIPT_SYNC_URL') &&
    publicHealth.includes('runAdminRuntimeChecks')
);
check(
  'El estado integral está protegido por la sesión de Super Admin',
  protectedHealth.includes('requireSuperAdmin') &&
    protectedHealth.includes('await requireSuperAdmin(request)') &&
    protectedHealth.includes("runSystemHealth(env)")
);
check(
  'El contrato declara autoridades canónicas y pedidos/auditoría como espejos de solo lectura',
  core.includes("products: { authority: 'Firestore products'") &&
    core.includes("inventory: { authority: 'Firestore productInventory'") &&
    core.includes("orders: { authority: 'Firestore orders + Superadmin'") &&
    core.includes("orders: { authority: 'Firestore orders + Superadmin', mirror: 'Google Sheets Pedidos web', mode: 'read-only-mirror' }") &&
    core.includes("audit: { authority: 'Firestore auditLog', mirror: 'Google Sheets Auditoría web', mode: 'read-only-mirror' }")
);
check(
  'El runtime administrativo comprueba inventario, auditoría, settings, contenido y Visual Builder',
  ['productInventory', 'auditLog', 'settings', 'siteContent', 'visualBuilder']
    .every(id => adminRuntime.includes(`'${id}'`))
);
check(
  'El probe a Apps Script es no destructivo y confirma la barrera canónica sin idToken',
  core.includes("action: 'syncProducts'") &&
    core.includes('productIds: []') &&
    !core.includes('idToken:') &&
    core.includes('/no autorizado/i')
);
check(
  'La integración Sheets exige protocolo confirmado, no solo reachability',
  core.includes("sheets.protocolOk === true") &&
    core.includes("SHEETS_ENGAGEMENT_SECRET")
);
check(
  'La configuración del endpoint Apps Script es compartida por sync y health',
  sheetsSync.includes("sheets-sync-config.js") &&
    sheetsSync.includes('APPS_SCRIPT_SYNC_URL') &&
    sheetsConfig.includes('SHEETS_HEALTH_REVISION')
);
check(
  'La UI consulta el endpoint protegido con Bearer de Firebase y no el health público',
  ui.includes("const HEALTH_URL = '/api/system-health'") &&
    ui.includes('getIdToken') &&
    ui.includes('authorization: `Bearer ${idToken}`') &&
    !ui.includes("const HEALTH_URL = '/api/health'")
);
check(
  'El panel muestra todas las autoridades operativas relevantes y el commit desplegado',
  ['Productos', 'Inventario', 'Colecciones', 'Pedidos', 'Usuarios', 'Auditoría', 'Configuración global', 'Contenido del sitio', 'Visual Builder', 'Resend', 'Cloudinary', 'Google Sheets', 'Apps Script']
    .every(label => ui.includes(label)) &&
    ui.includes('Commit desplegado') &&
    core.includes('CF_PAGES_COMMIT_SHA')
);
check(
  'El runtime de estado se inyecta solo junto a la superficie administrativa de diagnóstico',
  injector.includes('/js/admin/diagnostics/estado-ecosistema-admin.js?v=') &&
    injector.includes('x-tintin-system-health')
);
check(
  'Existe auditoría dedicada y está integrada al gate final',
  pkg.scripts?.['audit:system-health'] === 'node scripts/auditar-system-health.mjs && node --test tests/system-health/*.test.mjs' &&
    pkg.scripts?.['audit:final']?.includes('audit:system-health')
);

if (failures) {
  console.error(`\nAuditoría System Health: ${failures} fallo(s).`);
  process.exit(1);
}
console.log('\nAuditoría System Health: autoridad operativa integrada y protegida.');
