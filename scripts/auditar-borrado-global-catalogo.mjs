#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const admin = read('admin.html');
const ui = read('js/admin/products/borrado-global-catalogo-admin.js');
const api = read('functions/api/admin-catalog-delete.js');
const domain = read('cloudflare/borrado-global-catalogo.js');
const resilience = read('cloudflare/resiliencia-sync-catalogo.js');
const appsScript = read('apps-script/ProductosUnificados.gs');
const engagement = read('apps-script/Participacion.gs');

expect(admin.includes('js/admin/products/borrado-global-catalogo-admin.js?v=tintin-20260831-catalog-global-delete-1'), 'admin.html no carga el módulo versionado de borrado global.');
expect(api.includes('requireSuperAdmin(request)'), 'La API destructiva no exige Super Admin.');
expect(api.includes("ALL_PRODUCTS_CONFIRM = 'ELIMINAR TODOS LOS PRODUCTOS'"), 'Falta confirmación exacta para borrar todos los productos.');
expect(api.includes("ALL_COLLECTIONS_CONFIRM = 'ELIMINAR TODAS LAS COLECCIONES'"), 'Falta confirmación exacta para borrar todas las colecciones.');
expect(ui.includes("'btn-eliminar-todos-productos'"), 'Falta botón Eliminar TODOS en Productos.');
expect(ui.includes("'btn-eliminar-todas-colecciones'"), 'Falta botón Eliminar TODAS en Colecciones.');
expect(ui.includes('window.prodEliminar = async'), 'El borrado individual de producto no está unificado.');
expect(ui.includes('window.bulkDelete = async'), 'El borrado masivo de productos no está unificado.');
expect(ui.includes('window.bulkDeleteCollections = async'), 'El borrado masivo de colecciones no está unificado.');
expect(ui.includes('window.collEliminar = async'), 'El borrado individual de colección no está unificado.');
expect(domain.includes('productInventory/${id}'), 'La purga global no elimina productInventory.');
expect(domain.includes('productReviewStats/${id}'), 'La purga global no elimina estadísticas de reseñas.');
expect(domain.includes('productEngagementStats/${id}'), 'La purga global no elimina estadísticas de likes.');
expect(domain.includes("runProductIdQuery(env, 'reviewRecords'"), 'La purga no localiza reviewRecords.');
expect(domain.includes("runProductIdQuery(env, 'reviews'"), 'La purga no localiza copias de reseñas.');
expect(domain.includes("runProductIdQuery(env, 'likeRecords'"), 'La purga no localiza likes.');
expect(domain.includes("runProductIdQuery(env, 'reviewLikeProducts'"), 'La purga no limpia mapas de interacción por usuario.');
expect(domain.includes("type: 'review'") && domain.includes("productId: ''") && domain.includes("productName: ''"), 'Las reseñas de Sheets no se anonimizan al purgar producto.');
expect(domain.includes("type: 'like'") && domain.includes("operation: 'delete'"), 'Los likes de Sheets no se eliminan al purgar producto.');
expect(domain.indexOf('await syncSocialPurgeToSheets(env, social);') < domain.indexOf('await commitWrites(env, [...deletePaths]'), 'Sheets social debe confirmarse antes de borrar Firestore.');
expect(domain.includes("action: 'syncProducts'"), 'Falta sincronización canónica hacia la hoja Productos.');
expect(appsScript.includes('if (!productResult.ok)') && appsScript.includes('sheet.deleteRow(rowNumber)'), 'Apps Script Productos no elimina la fila cuando el producto ya no existe.');
expect(engagement.includes("event.operation === 'delete'") && engagement.includes('likes.deleteRow(row)'), 'Apps Script social no soporta borrado de likes.');
expect(domain.includes("preservedHistory: ['orders', 'auditLog']"), 'La política de preservación histórica no está explícita.');
expect(!domain.includes("deletePaths.add(`orders/"), 'La purga no debe borrar pedidos históricos.');
expect(!domain.includes("deletePaths.add(`auditLog/"), 'La purga no debe borrar auditLog histórico.');
expect(domain.includes("['unassign', 'reassign', 'delete'].includes(productMode)") && domain.includes("productMode === 'delete'") && domain.includes("productMode === 'reassign'"), 'Colecciones no cubre eliminar/reasignar/desasignar productos.');
expect(domain.includes("mergeFields: ['category', 'collection', 'updatedAt']"), 'La eliminación de colección no limpia ambas referencias category/collection.');

// Garantías de resiliencia entre sistemas: no hay transacción distribuida real
// entre Firestore y Google Sheets, así que se exige preflight antes del delete,
// reintentos posteriores y una cola persistente para no esconder un fallo.
expect(api.includes('preflightProductsSheet(idToken, affectedProductIds)'), 'La API no hace preflight real de Google Sheets antes del borrado.');
expect(api.indexOf('await preflightProductsSheet(idToken, affectedProductIds);') < api.indexOf('const result = await runCatalogAction(action, env, body, scope, false'), 'El preflight de Sheets debe ocurrir antes de la destrucción real.');
expect(api.includes('finalizeProductsSheet(env, idToken, affectedProductIds'), 'La API no reintenta el cierre de la hoja Productos después de Firestore.');
expect(api.includes('retryPendingCatalogSheets(env, idToken)'), 'La API no reconcilia tareas pendientes de Sheets.');
expect(resilience.includes('const MAX_ATTEMPTS = 4'), 'La resiliencia no conserva cuatro intentos de cierre.');
expect(resilience.includes("const QUEUE_COLLECTION = 'catalogSheetSyncQueue'"), 'Falta cola persistente de reconciliación de catálogo.');
expect(resilience.includes("status: 'pending'"), 'La cola de Sheets no registra estado pendiente explícito.');
expect(resilience.includes('await syncProductsWithRetry(idToken, [ids[0]], { attempts: 2 })'), 'El preflight no prueba el Apps Script real con un producto canónico.');
expect(resilience.includes('await syncProductsWithRetry(idToken, ids, { attempts: MAX_ATTEMPTS })'), 'El cierre no reintenta la sincronización completa.');
expect(resilience.includes('firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING)'), 'Las reconciliaciones pendientes no se vuelven a leer para su cierre.');

if (failures.length) {
  console.error(`Borrado global de catálogo: ${failures.length} fallo(s):`);
  failures.forEach(item => console.error(`  - ${item}`));
  process.exit(1);
}
console.log('Borrado global de catálogo: contrato completo (Super Admin, Firebase, social, Sheets, preflight, reintentos, Productos y Colecciones).');
