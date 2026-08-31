#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1))), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const adminHtml = read('admin.html');
const registrySource = read('js/admin/maestro/registro-maestro.js');
const panelSource = read('js/admin/maestro/panel-maestro.js');
const bootstrapSource = read('js/admin/ajuste-barra-lateral-movil-admin.js');
const ordersSource = read('js/admin/orders/pedidos-superadmin-crud.js');
const collectionsSource = read('js/admin/collections/gestion-colecciones-admin.js');
const usersSource = read('js/admin/users/gestion-usuarios-admin.js') + '\n' + read('js/admin/users/ficha-usuario-admin.js') + '\n' + read('js/admin/users/perfil-usuario-superadmin.js');
const participationSource = read('js/admin/participacion/gestion-participacion-admin-v2.js');

const registry = await import(`data:text/javascript;base64,${Buffer.from(registrySource).toString('base64')}`);
const { BASE_ADMIN_SECTIONS, MAESTRO_MODULES } = registry;

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail });
}
function sliceBetween(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  return a >= 0 && b >= 0 ? source.slice(a, b) : '';
}
function sectionsIn(fragment) {
  return [...new Set([...fragment.matchAll(/data-section="([a-z-]+)"/g)].map(match => match[1]))];
}

const sidebar = sliceBetween(adminHtml, 'id="adm-nav"', 'class="adm-nav-bottom"');
const mobile = sliceBetween(adminHtml, 'id="adm-mobile-tabs"', 'id="adm-mobile-more-backdrop"');
const sidebarSections = sectionsIn(sidebar);
const mobileSections = sectionsIn(mobile);
const registryIds = MAESTRO_MODULES.map(item => item.id);
const registrySet = new Set(registryIds);
const baseSet = new Set(BASE_ADMIN_SECTIONS);
const capabilityKeys = ['create','read','update','archive','delete','search','export','sync','audit','permissions'];
const capabilityValues = new Set(['yes','no','guarded','na']);

check('El inventario base contiene exactamente las secciones reales del sidebar',
  sidebarSections.length === BASE_ADMIN_SECTIONS.length && sidebarSections.every(id => baseSet.has(id)) && BASE_ADMIN_SECTIONS.every(id => sidebarSections.includes(id)),
  `HTML=${sidebarSections.join(', ')} · registro=${BASE_ADMIN_SECTIONS.join(', ')}`);
check('La navegación mobile ofrece las mismas secciones base',
  mobileSections.length === BASE_ADMIN_SECTIONS.length && mobileSections.every(id => baseSet.has(id)) && BASE_ADMIN_SECTIONS.every(id => mobileSections.includes(id)),
  `mobile=${mobileSections.join(', ')}`);
check('No hay ids duplicados en el registro Maestro', registryIds.length === registrySet.size, registryIds.join(', '));
check('Todas las secciones base están clasificadas en Maestro', BASE_ADMIN_SECTIONS.every(id => registrySet.has(id)));
check('Maestro clasifica también Imágenes, Bienvenida y el propio Maestro', ['imagenes','welcome','maestro'].every(id => registrySet.has(id)));
check('Cada módulo declara política y descripción', MAESTRO_MODULES.every(item => item.policy && item.description));
check('Cada módulo declara todas las capacidades con valores válidos', MAESTRO_MODULES.every(item => capabilityKeys.every(key => capabilityValues.has(item.capabilities?.[key]))));
check('Todos los módulos permiten lectura', MAESTRO_MODULES.every(item => item.capabilities.read === 'yes'));

const users = MAESTRO_MODULES.find(item => item.id === 'usuarios');
const orders = MAESTRO_MODULES.find(item => item.id === 'pedidos');
const audit = MAESTRO_MODULES.find(item => item.id === 'auditoria');
const stats = MAESTRO_MODULES.find(item => item.id === 'estadisticas');
const products = MAESTRO_MODULES.find(item => item.id === 'productos');
const collections = MAESTRO_MODULES.find(item => item.id === 'colecciones');
check('Usuarios usa ciclo de vida seguro, no hard-delete ni creación falsa de identidades', users?.capabilities.create === 'no' && users?.capabilities.delete === 'no' && users?.capabilities.archive === 'yes' && users?.capabilities.update === 'yes');
check('Pedidos conserva CRUD completo con borrado protegido', orders?.capabilities.create === 'yes' && orders?.capabilities.update === 'yes' && orders?.capabilities.archive === 'yes' && orders?.capabilities.delete === 'guarded');
check('Productos conserva CRUD completo', products?.capabilities.create === 'yes' && products?.capabilities.update === 'yes' && products?.capabilities.delete === 'guarded');
check('Colecciones conserva CRUD completo', collections?.capabilities.create === 'yes' && collections?.capabilities.update === 'yes' && collections?.capabilities.delete === 'guarded');
check('Auditoría es inmutable', audit?.capabilities.update === 'no' && audit?.capabilities.delete === 'no' && audit?.capabilities.export === 'yes');
check('Estadísticas no inventa operaciones CRUD', stats?.capabilities.create === 'no' && stats?.capabilities.update === 'no' && stats?.capabilities.delete === 'no');

check('El CRUD de Pedidos tiene alta manual, edición, papelera, restauración y borrado final protegido',
  ['openManualOrder','openAdvancedOrderEditor','trashOrder','restoreOrder','deleteTrashPermanently','callCanonicalCreate_'].every(token => ordersSource.includes(token)));
check('Productos expone alta, guardado, activación, borrado y exportación',
  ['id="btn-nuevo-producto"','id="prod-save-btn"','id="bulk-delete-btn"','prod-export-all-btn','bulkActivate('].every(token => adminHtml.includes(token)));
check('Colecciones expone alta, guardado, visibilidad, borrado y exportación',
  ['id="btn-nueva-coleccion"','id="coll-save-btn"','id="coll-bulk-delete-btn"','bulkExportCollections','bulkSetCollVisible'].every(token => adminHtml.includes(token)) && collectionsSource.includes('enforceImmutableSlug'));
check('Usuarios expone roles, bloqueo/restauración y exportación',
  ['users-bulk-block-btn','users-bulk-restore-btn','bulkChangeUserRole','bulkExportUsers'].every(token => adminHtml.includes(token)) && usersSource.length > 1000);
check('Participación social tiene gestor dedicado para reseñas y likes', participationSource.length > 20000 && participationSource.includes('resenas') && participationSource.includes('me-gusta'));
check('Auditoría se puede exportar sin exponer un botón de borrado propio', adminHtml.includes('bulkExportAuditLog') && !/section-auditoria[\s\S]{0,4000}(?:delete|eliminar).*audit/i.test(adminHtml));

check('El panel Maestro es exclusivo del email Super Admin real', panelSource.includes('onAuthStateChanged') && panelSource.includes('SUPER_ADMIN') && panelSource.includes('isSuperAdmin'));
check('El panel Maestro no escribe directamente en Firestore', !/\b(?:setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction)\s*\(/.test(panelSource));
check('El panel Maestro usa la navegación nativa para abrir módulos existentes', panelSource.includes('nativeTrigger') && panelSource.includes('trigger.click()'));
check('El panel Maestro verifica cobertura, paridad, CRUD crítico y guard de cambios', ['runtimeChecks','nav-parity','products','collections','users','orders','AdminUnsaved'].every(token => panelSource.includes(token)));
check('Maestro puede exportar su matriz sin mutar producción', panelSource.includes('exportMatrix') && panelSource.includes('application/json'));
check('Admin carga Maestro directamente con versión explícita', adminHtml.includes('js/admin/maestro/panel-maestro.js?v=tintin-20260831-superadmin-maestro-1'));
check('El bootstrap responsive conserva su responsabilidad original y no carga Maestro', !bootstrapSource.includes('maestro/panel-maestro.js'));

const failed = checks.filter(item => !item.ok);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/superadmin-maestro-audit.json'), JSON.stringify({
  checkedAt: new Date().toISOString(),
  status: failed.length ? 'FAIL' : 'PASS',
  moduleCount: MAESTRO_MODULES.length,
  baseSections: BASE_ADMIN_SECTIONS,
  checks
}, null, 2) + '\n');

for (const item of checks) {
  console.log(`${item.ok ? '✓' : '✗'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}
console.log(`\nSuper Admin Maestro: ${checks.length - failed.length}/${checks.length} checks correctos · ${MAESTRO_MODULES.length} superficies gobernadas.`);
if (failed.length) process.exit(1);
