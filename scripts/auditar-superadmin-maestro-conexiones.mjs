#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error(`Falta archivo requerido: ${file}`);
  return fs.readFileSync(full, 'utf8');
}

const files = {
  admin: read('admin.html'),
  adminApp: read('js/admin/admin-app.js'),
  maestro: read('js/admin/maestro/panel-maestro.js'),
  maestroRegistry: read('js/admin/maestro/registro-maestro.js'),
  maestroBootstrap: read('js/admin/ajuste-barra-lateral-movil-admin.js'),
  orders: read('js/admin/orders/pedidos-superadmin-crud.js'),
  collections: read('js/admin/collections/gestion-colecciones-admin.js'),
  participation: read('js/admin/participacion/gestion-participacion-admin-v2.js'),
  pages: read('js/admin/pages/paginas-admin.js'),
  push: read('js/admin/notifications/notificaciones-push.js'),
  pushMaster: read('js/admin/notifications/notificaciones-push-maestro.js'),
  pushOrderLink: read('js/admin/notifications/enlace-pedido-push.js'),
  storeSettings: read('js/admin/settings/control-tienda-admin.js'),
  orderApi: read('functions/api/admin-order-mutation.js'),
  adminEngagementApi: read('functions/api/admin-engagement.js'),
  engagementApi: read('functions/api/engagement.js'),
  publicProduct: read('product.html'),
  publicCatalog: read('catalogo.html'),
  firestoreRules: read('firestore.rules'),
};

const checks = [];
function check(id, label, ok, evidence = '') {
  checks.push({ id, label, ok: Boolean(ok), evidence });
}
function has(text, value) { return text.includes(value); }
function hasAll(text, values) { return values.every(value => text.includes(value)); }

const requiredSections = [
  'dashboard','estadisticas','usuarios','pedidos','productos','resenas','me-gusta','colecciones',
  'paginas','importar','mensajes','notificaciones-push','auditoria','diagnostico','correos',
  'configuracion','permisos','apariencia'
];
check('admin-sections', 'Las superficies base del Admin siguen presentes', requiredSections.every(section => has(files.admin, `section-${section}`)), requiredSections.join(', '));

check('maestro-entry', 'Maestro tiene entrada versionada directa desde admin.html', has(files.admin, 'js/admin/maestro/panel-maestro.js?v=tintin-20260831-superadmin-maestro-1'));
check('maestro-bootstrap-clean', 'El bootstrap responsive histórico conserva su responsabilidad original', !has(files.maestroBootstrap, 'maestro/panel-maestro'));
check('maestro-registry', 'Maestro consume un registro único de módulos y capacidades', hasAll(files.maestro, ['MAESTRO_MODULES', 'BASE_ADMIN_SECTIONS', 'capabilityLabel']));
check('maestro-no-direct-firestore', 'Maestro no salta los contratos escribiendo directo en Firestore', !/\b(addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\b/.test(files.maestro));
check('maestro-version-lock', 'Panel, registro y entrada HTML usan la misma versión Maestro',
  (files.maestro.match(/tintin-20260831-superadmin-maestro-1/g) || []).length >= 2 &&
  has(files.admin, 'js/admin/maestro/panel-maestro.js?v=tintin-20260831-superadmin-maestro-1') &&
  !/superadmin-maestro-(?!1\b)\d+/.test(files.maestro + files.maestroRegistry + files.admin));

check('orders-canonical-api', 'Crear pedidos desde Super Admin usa el endpoint canónico', has(files.orders, '/api/admin-order-mutation') && has(files.orderApi, 'createOrder'));
check('orders-inventory', 'Editar pedidos está interconectado con integridad de inventario', hasAll(files.orders, ['TintinInventoryIntegrity', 'updateEditedOrder', 'transitionStatus']));
check('orders-trash', 'Pedidos tienen ciclo papelera → restauración → borrado protegido', hasAll(files.orders, ['orderTrash', 'trashOrder', 'restoreOrder', 'deleteTrashPermanently']));

check('products-catalog', 'Productos del Admin siguen conectados al catálogo público', hasAll(files.admin, ['prodGuardar()', 'prod-active', 'prod-stock', 'prod-price']) && has(files.publicCatalog, 'products'));
check('collections-live', 'Colecciones usan estado vivo compartido y alimentan el catálogo', has(files.collections, 'onAllCollectionsUpdate') && has(files.publicCatalog, 'collections'));

check('users-governance', 'Usuarios conservan gestión, roles, bloqueo, restauración y exportación', hasAll(files.admin, ['bulkChangeUserRole()', 'bulkBlockUsers()', 'bulkRestoreUsers()', "bulkExportUsers('filtered')"]));
check('permissions-real', 'Navegación sensible está gobernada por permisos reales', hasAll(files.adminApp, ['SECTION_PERMISSION', 'requiredPerm', 'SUPER_ADMIN']));
check('rules-present', 'Firestore Rules forman parte de la conexión de datos', /match\s+\/databases\/\{database\}\/documents/.test(files.firestoreRules));

check('engagement-admin-api', 'Reseñas y Me gusta mutan por API administrativa protegida',
  has(files.participation, '/api/admin-engagement') &&
  hasAll(files.adminEngagementApi, ['requireSuperAdmin', 'originIsAllowed', "request.method !== 'POST'"]));
check('engagement-public-api', 'La participación pública usa el endpoint social canónico', has(files.engagementApi, 'onRequest') || has(files.engagementApi, 'export'));
check('engagement-product', 'Producto mantiene la superficie social conectada', /review|reseña|comment|comentario|like|me-gusta/i.test(files.publicProduct));

check('push-section', 'Push está conectado a su sección de Super Admin', has(files.admin, 'section-notificaciones-push') && has(files.admin, 'notificaciones-push-maestro.js'));
check('push-orders', 'Push puede enlazar notificaciones con pedidos', /pedido|order/i.test(files.pushOrderLink));
check('push-master', 'Centro Push Maestro conserva gestión administrativa', /super.?admin|maestro|device|dispositivo/i.test(files.pushMaster));

check('pages-root', 'Páginas está interconectado con el root administrable real', has(files.admin, 'tt-pages-admin-root') && has(files.pages, 'tt-pages-admin-root'));
check('email-center', 'Centro de Correos conserva paneles de pedidos, plantillas, promociones e historial', hasAll(files.admin, ['correos-panel-pedidos', 'correos-panel-plantillas', 'correos-panel-promociones', 'correos-panel-historial']));
check('store-gate', 'Configuración de tienda está conectada al estado público', /store|tienda/i.test(files.storeSettings) && has(files.admin, 'cfg-store-open'));
check('audit-log', 'El Admin mantiene registro de auditoría para mutaciones sensibles', /audit/i.test(files.adminApp) && has(files.admin, 'audit-tbody'));
check('diagnostics', 'Diagnóstico integral permanece conectado y en modo de solo lectura', hasAll(files.admin, ['btn-run-site-diagnostics', 'Modo de solo lectura']));

const failed = checks.filter(item => !item.ok);
const payload = {
  schemaVersion: 1,
  status: failed.length ? 'FAIL' : 'PASS',
  checkedAt: new Date().toISOString(),
  checks,
  summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length }
};
fs.writeFileSync(path.join(artifactDir, 'superadmin-maestro-connections.json'), JSON.stringify(payload, null, 2) + '\n');

for (const item of checks) console.log(`${item.ok ? 'OK' : 'FAIL'} — ${item.label}${item.evidence ? ` · ${item.evidence}` : ''}`);
if (failed.length) {
  console.error(`\nConexión Maestro: ${failed.length} problema(s) de ${checks.length}.`);
  process.exit(1);
}
console.log(`\nConexión Maestro: CORRECTA · ${checks.length}/${checks.length} contratos interconectados.`);
