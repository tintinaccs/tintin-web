'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');

const rules = read('firestore.rules');
const headers = read('_headers');
const server = read('apps-script/CrearPedido.gs');
const phase3 = read('apps-script/Seguridad.gs');
const orderClient = read('js/create-order-client.js');
const pkg = read('package.json');

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) console.log('OK — ' + label);
  else {
    failures += 1;
    console.error('FAIL — ' + label + (detail ? ': ' + detail : ''));
  }
}

check(
  'Los pedidos no se crean desde el SDK del navegador',
  rules.includes('match /orders/{orderId}') && rules.includes('allow create: if false;'),
  'La creación vigente es server-side'
);
check(
  'El cliente no reserva stock por reglas heredadas',
  !rules.includes('allow update: if sparkStockUpdateValid(productId);') &&
    !rules.includes('allow update: if sparkInventoryReserveValid(orderId) ||'),
  'No debe quedar una ruta browser que altere dinero o inventario'
);
check(
  'Solo Super Admin elimina pedidos',
  rules.includes('allow delete: if isSuperAdmin();') &&
    !rules.includes('allow delete: if isSuperAdmin() || sparkPendingOrderDeleteValid();'),
  'El cliente no puede borrar evidencia ni saltar cooldowns'
);
check(
  'Viewer no puede crear productos',
  !rules.includes("(isAdmin() || isAgent() || isViewer()) &&\n          currentRolePermAllows('productos', 'crear')"),
  'Se aplica mínimo privilegio'
);
check(
  'El rol superadmin no es asignable a otra cuenta',
  rules.includes("request.resource.data.role in ['client', 'admin', 'agent', 'viewer']") &&
    rules.includes('!isSuperAdminAccount(resource.data)'),
  'La identidad privilegiada depende del correo oficial verificado'
);

[
  "'action', 'idToken', 'requestId', 'cartLines'",
  "phase4HasOnlyKeys_(rawLine, ['id', 'qty', 'variants', 'variant'])",
  "phase4HasOnlyKeys_(payload.mapLocation, ['lat', 'lng', 'name', 'address'])",
  'phase4EmailValid_(contactEmail)',
  'phase4ExpectedMoneyValid_(payload.expectedTotal)'
].forEach(token => check('El endpoint valida ' + token, server.includes(token)));

check(
  'El endpoint no devuelve cuerpos internos de Firestore',
  !server.includes('detail: response.getContentText()') &&
    !server.includes('detail: String(error)') &&
    !phase3.includes('detail: String(error)'),
  'Los detalles quedan solo en logs del servidor'
);
check(
  'El cliente no propaga respuestas crudas del endpoint',
  !orderClient.includes('raw: body.slice') &&
    orderClient.includes("error: 'invalid_response', status: response.status"),
  'La UI solo recibe un código estable y el estado HTTP'
);

[
  'Content-Security-Policy:',
  'Strict-Transport-Security:',
  'Permissions-Policy:',
  'Referrer-Policy:',
  'X-Content-Type-Options:',
  'X-Frame-Options: DENY',
  "frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy: same-origin-allow-popups'
].forEach(header => check('Encabezado presente: ' + header, headers.includes(header)));
check(
  'La CSP permite el endpoint server-side de pedidos',
  headers.includes('https://script.google.com') &&
    headers.includes('https://script.googleusercontent.com'),
  'Apps Script y su redirección deben estar en connect-src'
);

check(
  'HTML no se almacena como versión inmutable',
  headers.includes('/*.html\n  Cache-Control: no-cache, no-store, must-revalidate')
);
check(
  'CSS y JavaScript versionados conservan caché inmutable',
  headers.includes('/*.css\n  Cache-Control: public, max-age=31536000, immutable') &&
    headers.includes('/*.js\n  Cache-Control: public, max-age=31536000, immutable')
);

const privateKeyPatterns = [
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
  /"private_key"\s*:/,
  /"client_email"\s*:\s*"[^"]+\.iam\.gserviceaccount\.com"/
];
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|mjs|cjs|gs|json|html|txt|md|yml|yaml|rules)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(root);
const secretHits = [];
const secretScanAllowlist = new Set([
  'scripts/auditar-nivel-1-fundamentos.js'
]);
for (const file of sourceFiles) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (secretScanAllowlist.has(relative)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (privateKeyPatterns.some(pattern => pattern.test(content))) {
    secretHits.push(relative);
  }
}
check('No hay claves privadas o service accounts en el repositorio', secretHits.length === 0, secretHits.join(', '));

check(
  'La Fase 6 forma parte de audit:final',
  pkg.includes('"audit:phase6": "node scripts/auditar-fase-6-seguridad.js"') &&
    pkg.includes('npm run audit:phase6')
);

if (failures) {
  console.error('\nAuditoría Fase 6: ' + failures + ' fallo(s).');
  process.exit(1);
}
console.log('\nAuditoría Fase 6: todo correcto.');
