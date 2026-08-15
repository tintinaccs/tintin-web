'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
const exists = file => fs.existsSync(path.join(root, file));

const rules = read('firestore.rules');
const headers = read('_headers');
const runtime = JSON.parse(read('config/csp-runtime.json'));
const middleware = read('functions/_middleware.js');
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
  'El checkout no crea pedidos desde el SDK; solo Super Admin puede crear manualmente',
  rules.includes('match /orders/{orderId}') &&
    rules.includes('allow create: if isSuperAdmin();') &&
    orderClient.includes("action: 'createOrder'") &&
    !orderClient.includes('setDoc('),
  'Clientes y staff pasan por el endpoint; la excepción de navegador es solo Super Admin.'
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
  'Strict-Transport-Security:',
  'Permissions-Policy:',
  'Referrer-Policy:',
  'X-Content-Type-Options:',
  'X-Frame-Options: SAMEORIGIN',
  'Cross-Origin-Opener-Policy: same-origin-allow-popups'
].forEach(header => check('Encabezado estático presente: ' + header, headers.includes(header)));

check(
  'CSP no se publica desde _headers',
  !headers.includes('Content-Security-Policy:'),
  'Cloudflare Pages limita cada línea de _headers a 2000 caracteres; CSP debe salir del middleware.'
);
const overlongHeaderLines = headers.split('\n').filter(line => line.length > 2000);
check(
  'Cada línea de _headers respeta el límite de Cloudflare Pages',
  overlongHeaderLines.length === 0,
  overlongHeaderLines.map(line => `${line.slice(0, 40)}... (${line.length} caracteres)`).join(', ')
);

check(
  'El middleware entrega CSP y headers de seguridad a documentos HTML',
  middleware.includes("headers.set('Content-Security-Policy', policy)") &&
    middleware.includes("'Strict-Transport-Security'") &&
    middleware.includes("'X-Content-Type-Options'") &&
    middleware.includes("'X-Frame-Options'") &&
    middleware.includes('failClosed()'),
  'Las respuestas de Pages Functions no heredan _headers y deben fijar seguridad explícitamente.'
);
check(
  'Las CSP runtime fueron generadas por la fuente canónica',
  runtime.generatedBy === 'scripts/generar-csp-cloudflare.js' &&
    typeof runtime.public === 'string' &&
    runtime.routes && typeof runtime.routes === 'object',
  'Ejecutá npm run build:csp antes de auditar.'
);
check(
  'La CSP runtime permite Apps Script y su redirección server-side',
  runtime.public.includes('https://*.google.com') && runtime.public.includes('https://*.googleusercontent.com'),
  'Apps Script y su redirección deben estar en connect-src.'
);

const routePolicies = new Map(Object.entries(runtime.routes || {}));
const missingRoutePolicies = [];
const missingRouteHashes = [];
const unsafeInlineRoutes = [];
const unsafeInlineAttrRoutes = [];
const missingStructuralDirectives = [];
const unsafeFrameAncestorsRoutes = [];
const structuralDirectives = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests'
];
const SAFE_FRAME_ANCESTORS = ["frame-ancestors 'none'", "frame-ancestors 'self'"];

for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
  const inlineScriptHashes = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    inlineScriptHashes.add(
      `'sha256-${crypto.createHash('sha256').update(match[2], 'utf8').digest('base64')}'`
    );
  }

  const cleanRoute = file === 'index.html' ? '/' : '/' + path.basename(file, '.html');
  const legacyRoute = '/' + file;
  for (const route of new Set([cleanRoute, legacyRoute])) {
    const policy = routePolicies.get(route) || '';
    if (!policy) missingRoutePolicies.push(route);
    const scriptSrc = policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] || '';
    const missing = [...inlineScriptHashes].filter(hash => !scriptSrc.includes(hash));
    if (missing.length) missingRouteHashes.push(`${route}: ${missing.length}`);
    if (scriptSrc.includes("'unsafe-inline'")) unsafeInlineRoutes.push(route);
    if (policy.includes("script-src-attr 'unsafe-inline'")) unsafeInlineAttrRoutes.push(route);
    const structuralMissing = structuralDirectives.filter(directive => !policy.includes(directive));
    if (structuralMissing.length) missingStructuralDirectives.push(`${route}: ${structuralMissing.join(', ')}`);
    if (!SAFE_FRAME_ANCESTORS.some(directive => policy.includes(directive))) unsafeFrameAncestorsRoutes.push(route);
  }
}

check('Cada página tiene CSP runtime para ruta limpia y alias .html', missingRoutePolicies.length === 0, missingRoutePolicies.join(', '));
check('Cada CSP runtime fija scripts inline por hash', missingRouteHashes.length === 0, missingRouteHashes.join(', '));
check('Ninguna CSP runtime permite script inline arbitrario', unsafeInlineRoutes.length === 0, unsafeInlineRoutes.join(', '));
check('Ninguna CSP runtime reabre handlers con unsafe-inline', unsafeInlineAttrRoutes.length === 0, unsafeInlineAttrRoutes.join(', '));
check('Cada CSP runtime conserva protecciones estructurales', missingStructuralDirectives.length === 0, missingStructuralDirectives.join('; '));
check("Cada CSP runtime bloquea clickjacking con 'none' o 'self'", unsafeFrameAncestorsRoutes.length === 0, unsafeFrameAncestorsRoutes.join(', '));

const cloudinaryOrigin = 'https://api.cloudinary.com';
check(
  'Cloudinary upload existe solo en Admin',
  routePolicies.get('/admin')?.includes(cloudinaryOrigin) &&
    routePolicies.get('/admin-images')?.includes(cloudinaryOrigin) &&
    [...routePolicies.entries()].every(([route, policy]) =>
      route.startsWith('/admin') || !policy.includes(cloudinaryOrigin)
    ),
  'El endpoint de upload no debe aparecer en CSP públicas.'
);
check(
  'La CSP runtime es reproducible',
  exists('scripts/generar-csp-cloudflare.js') && exists('functions/_middleware.js'),
  'Ejecutá npm run build:csp para regenerar las políticas.'
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
const secretScanAllowlist = new Set(['scripts/auditar-nivel-1-fundamentos.js']);
for (const file of sourceFiles) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (secretScanAllowlist.has(relative)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (privateKeyPatterns.some(pattern => pattern.test(content))) secretHits.push(relative);
}
check('No hay claves privadas o service accounts en el repositorio', secretHits.length === 0, secretHits.join(', '));

check(
  'La Fase 6 forma parte de audit:final',
  pkg.includes('"audit:phase6": "node scripts/auditar-fase-6-seguridad.js"') && pkg.includes('npm run audit:phase6')
);

if (failures) {
  console.error('\nAuditoría Fase 6: ' + failures + ' fallo(s).');
  process.exit(1);
}
console.log('\nAuditoría Fase 6: todo correcto.');
