#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
  });
}

const registrySource = read('js/admin/maestro/registro-maestro.js');
const registry = await import(`data:text/javascript;base64,${Buffer.from(registrySource).toString('base64')}`);
const { MAESTRO_MODULES, BASE_ADMIN_SECTIONS } = registry;

const adminHtml = read('admin.html');
const adminApp = read('js/admin/admin-app.js');
const adminNotifications = read('js/admin/notifications/notificaciones-admin.js');
const clientNotifications = read('js/components/notifications/notificaciones-clientes.js');
const notificationApi = read('functions/api/notifications.js');
const surfaceController = read('js/components/navigation/compartido/control-paneles.js');
const routes = JSON.parse(read('_routes.json'));
const firestoreRules = read('firestore.rules');
const catalogDeleteApi = exists('functions/api/admin-catalog-delete.js') ? read('functions/api/admin-catalog-delete.js') : '';
const catalogDeleteCore = exists('cloudflare/borrado-global-catalogo.js') ? read('cloudflare/borrado-global-catalogo.js') : '';
const catalogResilience = exists('cloudflare/resiliencia-sync-catalogo.js') ? read('cloudflare/resiliencia-sync-catalogo.js') : '';

const adminFiles = walk(path.join(root, 'js', 'admin'))
  .filter(file => /\.(?:js|mjs)$/i.test(file));
const adminSources = adminFiles.map(file => fs.readFileSync(file, 'utf8'));
const fullAdminSource = [adminHtml, ...adminSources].join('\n');
const publicSources = [
  read('catalogo.html'), read('product.html'), read('checkout.html'), read('perfil.html'),
  ...walk(path.join(root, 'js', 'components')).filter(file => file.endsWith('.js')).map(file => fs.readFileSync(file, 'utf8')),
  ...walk(path.join(root, 'js', 'pages')).filter(file => file.endsWith('.js')).map(file => fs.readFileSync(file, 'utf8')),
].join('\n');

const checks = [];
function check(id, label, ok, evidence = '') {
  checks.push({ id, label, ok: Boolean(ok), evidence });
}
function hasAll(source, tokens) { return tokens.every(token => source.includes(token)); }
function hasAny(source, tokens) { return tokens.some(token => source.includes(token)); }

// 1. Cobertura top-left → bottom-right: navegación, paneles y registro Maestro.
const htmlSections = [...new Set([...adminHtml.matchAll(/id="section-([a-z-]+)"/g)].map(match => match[1]))];
check('sections-base', 'Todas las secciones base declaradas por Maestro existen en el HTML',
  BASE_ADMIN_SECTIONS.every(id => htmlSections.includes(id)), BASE_ADMIN_SECTIONS.join(', '));
check('sections-no-orphans', 'No hay secciones base visibles fuera del gobierno Maestro',
  htmlSections.filter(id => BASE_ADMIN_SECTIONS.includes(id)).every(id => MAESTRO_MODULES.some(module => module.id === id)));
check('module-count', 'El cierre gobierna todas las superficies Maestro actuales', MAESTRO_MODULES.length >= 21, `${MAESTRO_MODULES.length} módulos`);

// 2. Toda evidencia declarada en el registro debe seguir existiendo en código/HTML.
for (const module of MAESTRO_MODULES) {
  const evidence = module.evidence || [];
  check(`evidence-${module.id}`, `${module.label}: la evidencia declarada sigue conectada`,
    evidence.length > 0 && evidence.every(token => fullAdminSource.includes(token) || publicSources.includes(token) || exists(token.replace(/^\//, ''))),
    evidence.join(', '));
}

// 3. Contrato global por cada módulo capaz de sincronizar.
const connectionContracts = {
  usuarios: () => hasAll(fullAdminSource, ['bulkBlockUsers', 'bulkRestoreUsers', 'bulkChangeUserRole'])
    && hasAny(fullAdminSource, ['/api/admin-delete-user', '/api/sheets-admin-webhook', 'sheets'])
    && /rolePermissions|users/.test(firestoreRules),
  pedidos: () => hasAll(fullAdminSource, ['/api/admin-order-mutation', 'TintinInventoryIntegrity', 'trashOrder', 'restoreOrder'])
    && hasAny(fullAdminSource, ['syncOrder', 'Sheets', 'sheets']),
  productos: () => hasAll(fullAdminSource, ['prodGuardar', 'prod-stock', 'prod-price'])
    && hasAll(catalogDeleteApi + catalogDeleteCore + catalogResilience, ['products', 'productInventory'])
    && hasAny(catalogDeleteApi + catalogDeleteCore + catalogResilience, ['syncProducts', 'catalogSheetSyncQueue']),
  resenas: () => hasAll(fullAdminSource, ['/api/admin-engagement', 'resenas']) && notificationApi.includes('reviewRecords'),
  'me-gusta': () => hasAll(fullAdminSource, ['/api/admin-engagement', 'me-gusta']) && notificationApi.includes('likeRecords'),
  colecciones: () => hasAll(fullAdminSource, ['gestion-colecciones-admin.js', 'coll-save-btn'])
    && catalogDeleteCore.includes('collections') && publicSources.includes('collections'),
  paginas: () => hasAll(fullAdminSource, ['tt-pages-admin-root', 'paginas-admin.js'])
    && hasAny(fullAdminSource + publicSources, ['site_content', 'siteContent', 'site-content']),
  importar: () => hasAll(fullAdminSource, ['importacion-admin.js', 'Exportar']) && hasAny(fullAdminSource, ['products', 'audit']),
  imagenes: () => hasAny(fullAdminSource, ['/api/cloudinary-sign-upload', 'Cloudinary'])
    && hasAny(fullAdminSource, ['huérfan', 'orphan', '/api/cloudinary-delete']),
  mensajes: () => hasAny(fullAdminSource + publicSources, ['whatsappNumber', 'WhatsApp', 'wa.me']),
  'notificaciones-push': () => hasAny(fullAdminSource, ['/api/push-admin', '/api/push-test', 'pushSubscriptions'])
    && hasAny(firestoreRules, ['pushSubscriptions', 'push']),
  correos: () => hasAll(fullAdminSource, ['correos-panel-pedidos', 'correos-panel-plantillas', 'correos-panel-historial'])
    && hasAny(fullAdminSource, ['/api/order-email', '/api/test-email']) && firestoreRules.includes('emailLogs'),
  configuracion: () => hasAny(fullAdminSource, ['settings/general', 'storeGate', 'shippingRates', 'paymentMethods'])
    && hasAny(publicSources, ['settings/general', 'storeGate', 'shippingRates', 'paymentMethods']),
  permisos: () => hasAll(adminApp, ['SECTION_PERMISSION', 'SUPER_ADMIN']) && /rolePermissions/.test(firestoreRules),
  apariencia: () => hasAny(fullAdminSource, ['settings/appearance', 'colorSchemes'])
    && hasAny(publicSources, ['settings/appearance', 'colorSchemes']),
  welcome: () => hasAll(fullAdminSource, ['section-welcome', 'control-bienvenida-admin.js'])
    && hasAny(fullAdminSource + publicSources, ['welcome', 'bienvenida']),
};

const syncModules = MAESTRO_MODULES.filter(module => ['yes', 'guarded'].includes(module.capabilities?.sync));
for (const module of syncModules) {
  const contract = connectionContracts[module.id];
  check(`global-${module.id}`, `${module.label}: sus cambios tienen contrato global, no solo visual`,
    typeof contract === 'function' && contract(), typeof contract === 'function' ? 'contrato evaluado' : 'falta contrato explícito');
}
check('sync-contract-coverage', 'Todo módulo sincronizable tiene una comprobación global explícita',
  syncModules.every(module => typeof connectionContracts[module.id] === 'function'), syncModules.map(module => module.id).join(', '));

// 4. Notificaciones: abrir significa leer, incluso si Firestore responde después del clic.
check('admin-notifications-auto-read', 'Super Admin marca automáticamente al abrir',
  hasAll(adminNotifications, ['markVisibleNotificationsRead', "apiWithRetry('adminNotificationsSeenAll')", 'if (opening)', 'panelIsOpen()']));
check('admin-notifications-snapshot-race', 'Super Admin resuelve la carrera abrir-antes-del-snapshot',
  /onSnapshot[\s\S]*panelIsOpen\(\)[\s\S]*markVisibleNotificationsRead/.test(adminNotifications));
check('admin-notifications-no-manual-dependency', 'Super Admin ya no depende de Marcar todo leído',
  !adminNotifications.includes('adm-notifications-mark-all') && !adminNotifications.includes('Marcar todo leído'));
check('client-notifications-controller-event', 'Cliente usa el evento canónico del controlador para autolectura',
  hasAll(clientNotifications, ["'tintin:surface-change'", "surface === 'notifications'", 'markVisibleNotificationsRead']));
check('client-notifications-snapshot-race', 'Cliente resuelve la carrera abrir-antes-del-snapshot',
  /onSnapshot[\s\S]*notificationsSurfaceIsOpen\(\)[\s\S]*markVisibleNotificationsRead/.test(clientNotifications));
check('notifications-server-persistence', 'API persiste autolectura para cliente y Super Admin',
  hasAll(notificationApi, ["action === 'notificationsSeenAll'", "action === 'adminNotificationsSeenAll'", 'markAllNotificationsRead']));
check('notifications-source-seen', 'Autolectura administrativa limpia también unread de reseñas y likes',
  hasAll(notificationApi, ['markSourceSeen', 'reviewRecords', 'likeRecords']));
check('surface-controller-contract', 'El controlador publica estado oficial de apertura/cierre',
  hasAll(surfaceController, ["'tintin:surface-change'", "setAttribute('aria-hidden', 'false')", "setAttribute('aria-hidden', 'true')"]));

// 5. Todas las APIs que el panel referencia deben estar registradas en Cloudflare Pages.
const apiRefs = new Set();
for (const source of [fullAdminSource, notificationApi]) {
  for (const match of source.matchAll(/['"`](\/api\/[a-zA-Z0-9_./*-]+)['"`]/g)) apiRefs.add(match[1]);
}
function routeCovered(apiPath) {
  return routes.include.some(route => route === apiPath || (route.endsWith('*') && apiPath.startsWith(route.slice(0, -1))));
}
for (const apiPath of [...apiRefs].sort()) {
  check(`route-${apiPath}`, `Cloudflare enruta ${apiPath}`, routeCovered(apiPath));
}
check('routes-notifications', 'Cloudflare enruta la API canónica de notificaciones', routeCovered('/api/notifications'));
check('routes-catalog-delete', 'Cloudflare enruta el borrado global del catálogo', routeCovered('/api/admin-catalog-delete'));

// 6. Versiones: cada script local del Admin debe cargarse una sola vez y con ?v=.
const localScripts = [...adminHtml.matchAll(/<script\b[^>]*src="(js\/[^"]+\.js)(?:\?v=([^"]+))?"[^>]*><\/script>/g)]
  .map(match => ({ path: match[1], version: match[2] || '' }));
const scriptPaths = localScripts.map(item => item.path);
check('admin-script-versioned', 'Todos los scripts locales del Admin tienen versión de caché', localScripts.every(item => item.version));
check('admin-script-unique', 'Admin no carga dos versiones del mismo módulo', new Set(scriptPaths).size === scriptPaths.length);
check('admin-script-exists', 'Todos los scripts locales referenciados existen', scriptPaths.every(file => exists(file)));
check('admin-notifications-versioned', 'La autolectura Admin está servida con versión propia actual',
  localScripts.some(item => item.path === 'js/admin/notifications/notificaciones-admin.js' && /notifications-auto-read/.test(item.version)));

// 7. Mutaciones sensibles deben conservar gobierno y trazabilidad.
check('superadmin-auth', 'El panel conserva guard de autenticación y Super Admin real',
  hasAll(adminApp, ['onAuthStateChanged', 'SUPER_ADMIN', 'adm-auth-ready']));
check('permissions-map', 'Las secciones sensibles pasan por el mapa central de permisos', hasAll(adminApp, ['SECTION_PERMISSION', 'requiredPerm']));
check('audit-immutable', 'Audit log sigue sin update/delete desde reglas',
  /auditLog/.test(firestoreRules) && /allow\s+(?:update|delete)\s*:\s*if\s*false/.test(firestoreRules));
check('catalog-delete-global', 'Borrado de catálogo cubre datos canónicos y reconciliación',
  hasAll(catalogDeleteCore + catalogResilience, ['products', 'productInventory', 'catalogSheetSyncQueue']));

const failed = checks.filter(item => !item.ok);
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  status: failed.length ? 'FAIL' : 'PASS',
  modules: MAESTRO_MODULES.map(module => ({ id: module.id, label: module.label, policy: module.policy, capabilities: module.capabilities })),
  summary: { modules: MAESTRO_MODULES.length, checks: checks.length, passed: checks.length - failed.length, failed: failed.length },
  checks,
};
fs.writeFileSync(path.join(artifactDir, 'superadmin-cierre-total.json'), JSON.stringify(report, null, 2) + '\n');

for (const item of checks) console.log(`${item.ok ? 'OK' : 'FAIL'} — ${item.label}${item.evidence ? ` · ${item.evidence}` : ''}`);
console.log(`\nCierre total Super Admin: ${checks.length - failed.length}/${checks.length} checks · ${MAESTRO_MODULES.length} módulos.`);
if (failed.length) process.exit(1);
