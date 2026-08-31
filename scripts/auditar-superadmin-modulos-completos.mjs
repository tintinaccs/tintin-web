#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const safeRead = file => fs.existsSync(path.join(root, file)) ? read(file) : '';
const walk = dir => {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(rel) : [rel.replaceAll('\\', '/')];
  });
};
const join = files => files.map(safeRead).join('\n');
const hasAll = (source, tokens) => tokens.every(token => source.includes(token));
const hasAny = (source, tokens) => tokens.some(token => source.includes(token));

const registrySource = read('js/admin/maestro/registro-maestro.js');
const { MAESTRO_MODULES } = await import(`data:text/javascript;base64,${Buffer.from(registrySource).toString('base64')}`);
const adminHtml = read('admin.html');
const adminApp = read('js/admin/admin-app.js');
const firestoreRules = read('firestore.rules');
const routes = JSON.parse(read('_routes.json'));
const adminFiles = walk('js/admin').filter(file => /\.js$/i.test(file));
const serverFiles = [...walk('functions/api'), ...walk('cloudflare')].filter(file => /\.js$/i.test(file));
const publicFiles = [
  ...walk('js/pages'), ...walk('js/components'),
  'catalogo.html', 'collections.html', 'product.html', 'checkout.html', 'perfil.html', 'index.html'
].filter(file => fs.existsSync(path.join(root, file)) && /\.(?:js|html)$/i.test(file));
const allAdmin = [adminHtml, ...adminFiles.map(read)].join('\n');
const allServer = serverFiles.map(read).join('\n');
const allPublic = publicFiles.map(read).join('\n');
const allSystem = [allAdmin, allServer, allPublic, firestoreRules, JSON.stringify(routes)].join('\n');

const sources = {
  maestro: join(['js/admin/maestro/panel-maestro.js', 'js/admin/maestro/registro-maestro.js']),
  dashboard: adminHtml + '\n' + adminApp,
  estadisticas: adminHtml + '\n' + adminApp,
  usuarios: adminHtml + '\n' + adminApp + '\n' + join(['js/admin/users/gestion-usuarios-admin.js','js/admin/users/ficha-usuario-admin.js','js/admin/users/perfil-usuario-superadmin.js']) + '\n' + allServer,
  pedidos: adminHtml + '\n' + adminApp + '\n' + join(['js/admin/orders/pedidos-superadmin-crud.js','js/admin/orders/eliminacion-pedidos-admin.js']) + '\n' + allServer,
  productos: adminHtml + '\n' + adminApp + '\n' + join(walk('js/admin/products')) + '\n' + safeRead('functions/api/admin-catalog-delete.js') + '\n' + safeRead('cloudflare/borrado-global-catalogo.js') + '\n' + safeRead('cloudflare/resiliencia-sync-catalogo.js') + '\n' + allPublic,
  resenas: join(['js/admin/participacion/gestion-participacion-admin-v2.js','functions/api/admin-engagement.js','functions/api/notifications.js']) + '\n' + allPublic,
  'me-gusta': join(['js/admin/participacion/gestion-participacion-admin-v2.js','functions/api/admin-engagement.js','functions/api/notifications.js']) + '\n' + allPublic,
  colecciones: adminHtml + '\n' + adminApp + '\n' + join(walk('js/admin/collections')) + '\n' + safeRead('cloudflare/borrado-global-catalogo.js') + '\n' + allPublic,
  paginas: adminHtml + '\n' + join(walk('js/admin/pages')) + '\n' + allPublic + '\n' + allServer,
  importar: adminHtml + '\n' + safeRead('js/admin/importacion-admin.js') + '\n' + allServer,
  imagenes: safeRead('admin-images.html') + '\n' + join(['js/admin/products/biblioteca-multimedia-admin.js','js/admin/products/gestion-imagenes-admin.js','js/components/images/biblioteca-multimedia.js','functions/api/cloudinary-sign-upload.js','functions/api/cloudinary-delete.js']),
  mensajes: adminHtml + '\n' + adminApp + '\n' + allPublic,
  'notificaciones-push': adminHtml + '\n' + join(walk('js/admin/notifications')) + '\n' + join(['functions/api/push-config.js','functions/api/push-admin.js','functions/api/push-subscription.js','functions/api/push-test.js','functions/api/push-order-event.js','cloudflare/nucleo-push.js','cloudflare/servicio-push.js']),
  auditoria: adminHtml + '\n' + adminApp + '\n' + allServer,
  diagnostico: adminHtml + '\n' + join(walk('js/admin/diagnostics')),
  'estudio-codigo': join(walk('js/admin/estudio-codigo')) + '\n' + join(walk('functions/api/code-studio')) + '\n' + join(['cloudflare/estudio-codigo-core.js','cloudflare/estudio-codigo-github.js']),
  correos: adminHtml + '\n' + adminApp + '\n' + join(['js/admin/settings/sincronizacion-correo-admin.js','js/email/notificacion-pedido-resend.js','functions/api/order-email.js','functions/api/test-email.js']) + '\n' + allServer,
  configuracion: adminHtml + '\n' + adminApp + '\n' + allPublic + '\n' + allServer,
  permisos: adminHtml + '\n' + adminApp + '\n' + firestoreRules,
  apariencia: adminHtml + '\n' + join(walk('js/admin/appearance')) + '\n' + join(walk('js/admin/content')) + '\n' + allPublic,
  welcome: join(['js/admin/content/control-bienvenida-admin.js']) + '\n' + allPublic,
};

function routeCovered(apiPath) {
  return routes.include.some(route => {
    if (route === apiPath) return true;
    if (!route.endsWith('*')) return false;
    const prefix = route.slice(0, -1);
    const parent = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    return apiPath === parent || apiPath.startsWith(prefix);
  });
}

const moduleSpecs = {
  maestro: [
    ['gobierno sin duplicar escrituras', s => hasAll(s, ['runtimeChecks','exportMatrix','nativeTrigger']) && !/\b(?:setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction)\s*\(/.test(s)],
  ],
  dashboard: [
    ['resumen operativo real', s => hasAll(s, ['section-dashboard','dash-recent-orders'])],
    ['solo lectura', s => !/section-dashboard[\s\S]{0,1800}(?:deleteDoc|addDoc|updateDoc)/.test(s)],
  ],
  estadisticas: [
    ['rango y métricas', s => hasAll(s, ['section-estadisticas','statistics-range'])],
    ['no inventa CRUD', s => !/section-estadisticas[\s\S]{0,1800}(?:Eliminar|Guardar cambios|Nuevo registro)/i.test(s)],
  ],
  usuarios: [
    ['búsqueda y ficha', s => hasAny(s, ['users-search','searchUsers']) && hasAny(s, ['ficha-usuario','openUser','perfil-usuario'])],
    ['roles', s => hasAny(s, ['bulkChangeUserRole','rolePermissions'])],
    ['bloqueo y restauración', s => hasAll(s, ['users-bulk-block-btn','users-bulk-restore-btn'])],
    ['exportación', s => s.includes('bulkExportUsers')],
    ['identidad protegida', s => hasAny(s, ['/api/admin-delete-user','tombstone','deletedAt']) && /users|rolePermissions/.test(firestoreRules)],
  ],
  pedidos: [
    ['alta manual', s => hasAll(s, ['openManualOrder','callCanonicalCreate_'])],
    ['edición avanzada', s => s.includes('openAdvancedOrderEditor')],
    ['papelera y restauración', s => hasAll(s, ['trashOrder','restoreOrder'])],
    ['borrado final protegido', s => hasAny(s, ['deleteTrashPermanently','deleteOrderPermanently'])],
    ['inventario conectado', s => hasAny(s, ['TintinInventoryIntegrity','productInventory','inventory'])],
    ['API canónica', s => s.includes('/api/admin-order-mutation') && routeCovered('/api/admin-order-mutation')],
  ],
  productos: [
    ['alta y edición', s => hasAll(s, ['btn-nuevo-producto','prod-save-btn'])],
    ['precio y stock', s => hasAll(s, ['prod-price','prod-stock'])],
    ['visibilidad/estado', s => hasAny(s, ['bulkActivate','visible','active'])],
    ['exportación', s => s.includes('prod-export-all-btn')],
    ['multimedia', s => hasAny(s, ['biblioteca-multimedia','gestion-imagenes'])],
    ['integridad inventario', s => hasAny(s, ['productInventory','TintinInventoryIntegrity'])],
    ['purga global', s => hasAll(s, ['admin-catalog-delete','productInventory','catalogSheetSyncQueue']) && routeCovered('/api/admin-catalog-delete')],
    ['reflejo público', s => hasAll(s, ['catalogo','product']) && hasAny(s, ['public-catalog','products'])],
  ],
  resenas: [
    ['búsqueda y filtros', s => hasAll(s, ['reviews-search','reviews-filter','reviews-rating'])],
    ['moderación masiva', s => hasAll(s, ['data-eg-review-bulk="publish"','data-eg-review-bulk="hide"','data-eg-review-bulk="archive"','data-eg-review-bulk="delete"'])],
    ['respuesta/conversación', s => hasAny(s, ['quickReplies','authorType','reply'])],
    ['exportación', s => s.includes('data-eg-export="reviews"')],
    ['API protegida', s => s.includes('/api/admin-engagement') && routeCovered('/api/admin-engagement')],
  ],
  'me-gusta': [
    ['búsqueda y filtros', s => hasAll(s, ['likes-search','likes-filter','likes-period'])],
    ['archivo/administración', s => hasAny(s, ['data-eg-like-bulk','archived'])],
    ['analítica por producto/clienta', s => hasAll(s, ['data-eg-like-view="products"','data-eg-like-view="clients"','data-eg-like-view="analytics"'])],
    ['exportación', s => s.includes('data-eg-export="likes"')],
    ['API protegida', s => s.includes('/api/admin-engagement') && routeCovered('/api/admin-engagement')],
  ],
  colecciones: [
    ['alta y edición', s => hasAll(s, ['btn-nueva-coleccion','coll-save-btn'])],
    ['slug estable', s => s.includes('enforceImmutableSlug')],
    ['visibilidad', s => hasAny(s, ['bulkSetCollVisible','visible'])],
    ['asignación de productos', s => hasAny(s, ['productIds','products','assign'])],
    ['exportación', s => s.includes('bulkExportCollections')],
    ['borrado masivo/global', s => hasAll(s, ['coll-bulk-delete-btn','collections']) && s.includes('admin-catalog-delete')],
    ['reflejo público', s => hasAny(s, ['collections.html','/collections','collections'])],
  ],
  paginas: [
    ['editor real', s => hasAll(s, ['tt-pages-admin-root','paginas-admin'])],
    ['crear/editar/publicar', s => hasAny(s, ['createPage','newPage','Nueva página','guardar']) && hasAny(s, ['publish','publicar','visible'])],
    ['estado/archivo/borrado protegido', s => hasAny(s, ['archive','archivar','delete','eliminar'])],
    ['contenido sincronizado', s => hasAny(s, ['site_content','siteContent','site-content'])],
  ],
  importar: [
    ['importación', s => hasAny(s, ['Importar','importProducts','import'])],
    ['exportación', s => hasAny(s, ['Exportar','export'])],
    ['validación previa', s => hasAny(s, ['validate','validar','preview','dry'])],
    ['productos/datos reales', s => hasAny(s, ['products','collections','users','orders'])],
  ],
  imagenes: [
    ['subida firmada', s => hasAll(s, ["callSecureFunction('cloudinary-sign-upload'", 'cloudinary-sign-upload']) && routeCovered('/api/cloudinary-sign-upload')],
    ['biblioteca/búsqueda', s => hasAny(s, ['biblioteca','search','buscar'])],
    ['eliminación segura', s => hasAll(s, ['deleteMediaByUrlIfUnused','cloudinary-delete']) && routeCovered('/api/cloudinary-delete')],
    ['rollback/timeout', s => hasAny(s, ['rollback','withTimeout'])],
  ],
  mensajes: [
    ['canal WhatsApp real', s => hasAny(s, ['wa.me','WhatsApp','whatsappNumber'])],
    ['datos de contacto configurables', s => hasAny(s, ['whatsappNumber','contact','Contacto'])],
  ],
  'notificaciones-push': [
    ['configuración', s => s.includes('push-config') && routeCovered('/api/push-config')],
    ['suscripciones/dispositivos', s => hasAll(s, ['push-subscription','adminPushDevices']) && routeCovered('/api/push-subscription')],
    ['prueba manual', s => s.includes('push-test') && routeCovered('/api/push-test')],
    ['eventos de pedidos', s => s.includes('push-order-event') && routeCovered('/api/push-order-event')],
    ['admin protegido', s => s.includes('push-admin') && routeCovered('/api/push-admin')],
  ],
  auditoria: [
    ['lectura/búsqueda', s => hasAny(s, ['section-auditoria','audit-search','auditLog'])],
    ['exportación', s => s.includes('bulkExportAuditLog')],
    ['inmutable', s => !/section-auditoria[\s\S]{0,5000}(?:deleteDoc|updateDoc).*audit/i.test(s)],
  ],
  diagnostico: [
    ['diagnóstico del sitio', s => hasAll(s, ['diagnostico-sitio','btn-run-site-diagnostics'])],
    ['estado ecosistema', s => hasAny(s, ['estado-ecosistema','ecosistema'])],
    ['modo lectura', s => hasAny(s, ['solo lectura','read-only','readonly'])],
    ['exportación evidencia', s => hasAny(s, ['export','descargar','download'])],
  ],
  'estudio-codigo': [
    ['solo Super Admin', s => hasAll(s, ['SUPER_ADMIN','requireSuperAdmin'])],
    ['editar con validación', s => hasAll(s, ['validateChanges','commitWorkspaceChanges'])],
    ['PR protegido', s => hasAll(s, ['openPullRequest','mergePullRequestWithHumanApproval','directMainWrite: false'])],
    ['ruta Cloudflare', s => routeCovered('/api/code-studio')],
  ],
  correos: [
    ['plantillas/promociones/historial', s => hasAll(s, ['correos-panel-plantillas','correos-panel-historial'])],
    ['canal Resend', s => hasAll(s, ['RESEND_API_KEY','order-email']) && routeCovered('/api/order-email')],
    ['prueba de correo', s => s.includes('test-email') && routeCovered('/api/test-email')],
    ['logs', s => hasAny(s, ['emailLogs','historial'])],
  ],
  configuracion: [
    ['tienda', s => hasAny(s, ['cfg-store-open','settings/general','storeGate'])],
    ['envíos', s => hasAny(s, ['shippingRates','envíos','envios'])],
    ['pagos', s => hasAny(s, ['paymentMethods','métodos de pago','metodos de pago'])],
    ['reflejo público', s => hasAny(s, ['settings/general','storeGate']) && hasAny(allPublic, ['settings/general','storeGate'])],
  ],
  permisos: [
    ['mapa de permisos', s => hasAll(s, ['SECTION_PERMISSION','SUPER_ADMIN'])],
    ['roles persistidos', s => s.includes('rolePermissions') && firestoreRules.includes('rolePermissions')],
    ['sin hard-delete inseguro', s => !/section-permisos[\s\S]{0,4000}deleteDoc\(/.test(s)],
  ],
  apariencia: [
    ['editor visual', s => hasAny(s, ['editor-visual','visual-studio-global'])],
    ['layout responsive', s => hasAny(s, ['visual-studio-layout','preview-dynamic-targets'])],
    ['contenido real', s => hasAny(s, ['gestion-contenido-admin','settings/appearance','colorSchemes'])],
    ['reflejo público', s => hasAny(allPublic, ['settings/appearance','colorSchemes','appearance'])],
  ],
  welcome: [
    ['gestor dedicado', s => hasAll(s, ['section-welcome','nav-welcome']) || s.includes('control-bienvenida-admin')],
    ['pasos configurables', s => hasAny(s, ['steps','pasos','welcome'])],
    ['alta/edición/borrado', s => hasAny(s, ['add','agregar']) && hasAny(s, ['save','guardar']) && hasAny(s, ['delete','eliminar'])],
  ],
};

const reports = [];
for (const module of MAESTRO_MODULES) {
  const spec = moduleSpecs[module.id];
  const source = sources[module.id] || allSystem;
  const checks = [];
  if (!spec) {
    checks.push({ label: 'contrato de dominio explícito', ok: false, detail: 'No existe moduleSpecs para este módulo' });
  } else {
    for (const [label, predicate] of spec) {
      let ok = false;
      try { ok = Boolean(predicate(source)); } catch { ok = false; }
      checks.push({ label, ok });
    }
  }
  const requiredCaps = Object.entries(module.capabilities || {}).filter(([, value]) => value === 'yes' || value === 'guarded').map(([key]) => key);
  checks.push({ label: 'capacidades declaradas explícitamente', ok: requiredCaps.length > 0, detail: requiredCaps.join(', ') });
  checks.push({ label: 'evidencia física declarada', ok: Array.isArray(module.evidence) && module.evidence.length > 0, detail: (module.evidence || []).join(', ') });
  const failed = checks.filter(check => !check.ok);
  reports.push({ id: module.id, label: module.label, policy: module.policy, status: failed.length ? 'FAIL' : 'PASS', checks, failed: failed.map(item => item.label) });
}

const missingRegistry = Object.keys(moduleSpecs).filter(id => !MAESTRO_MODULES.some(module => module.id === id));
const uncontracted = MAESTRO_MODULES.filter(module => !moduleSpecs[module.id]).map(module => module.id);
const failedModules = reports.filter(report => report.status === 'FAIL');
const totalChecks = reports.reduce((sum, report) => sum + report.checks.length, 0);
const passedChecks = reports.reduce((sum, report) => sum + report.checks.filter(check => check.ok).length, 0);

fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/superadmin-modulos-completos.json'), JSON.stringify({
  checkedAt: new Date().toISOString(),
  status: failedModules.length || missingRegistry.length || uncontracted.length ? 'FAIL' : 'PASS',
  moduleCount: reports.length,
  passedChecks,
  totalChecks,
  missingRegistry,
  uncontracted,
  modules: reports
}, null, 2) + '\n');

for (const report of reports) {
  console.log(`\n${report.status === 'PASS' ? '✓' : '✗'} ${report.label} [${report.id}]`);
  for (const check of report.checks) console.log(`  ${check.ok ? '✓' : '✗'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}
console.log(`\nSuper Admin por dominio: ${passedChecks}/${totalChecks} checks · ${reports.length - failedModules.length}/${reports.length} módulos completos.`);
if (missingRegistry.length) console.error(`Specs sin registro: ${missingRegistry.join(', ')}`);
if (uncontracted.length) console.error(`Módulos sin contrato: ${uncontracted.join(', ')}`);
if (failedModules.length) {
  for (const report of failedModules) console.error(`FALTA ${report.label}: ${report.failed.join('; ')}`);
  process.exit(1);
}
