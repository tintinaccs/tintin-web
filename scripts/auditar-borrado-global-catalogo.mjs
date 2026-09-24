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

expect(/js\/admin\/products\/borrado-global-catalogo-admin\.js\?v=tintin-\d{8}/.test(admin), 'admin.html no carga el módulo versionado de borrado global.');
expect(api.includes('requireSuperAdmin(request)'), 'La API destructiva no exige Super Admin.');
expect(api.includes("CATALOG_DELETE_PASSWORD"), 'Falta la contraseña secreta server-side para borrar productos.');
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
expect(domain.includes('syncEngagementBatchToSheets(env, events)'), 'Las filas sociales deben sincronizarse en un único lote para no agotar subrequests.');
expect(domain.includes('syncDeletedProductsPayloadWithRetry(env, ids, { attempts: 2 })'), 'Falta sincronización por tombstones server-side hacia la hoja Productos después del borrado.');
expect(appsScript.includes('if (!productResult.ok)') && appsScript.includes('sheet.deleteRow(rowNumber)'), 'Apps Script Productos no elimina la fila cuando el producto ya no existe.');
expect(engagement.includes("event.operation === 'delete'") && engagement.includes('likes.deleteRow(row)'), 'Apps Script social no soporta borrado de likes.');
expect(domain.includes("preservedHistory: ['orders', 'auditLog']"), 'La política de preservación histórica no está explícita.');
expect(!domain.includes("deletePaths.add(`orders/"), 'La purga no debe borrar pedidos históricos.');
expect(!domain.includes("deletePaths.add(`auditLog/"), 'La purga no debe borrar auditLog histórico.');
expect(domain.includes("['unassign', 'reassign', 'delete'].includes(productMode)") && domain.includes("productMode === 'delete'") && domain.includes("productMode === 'reassign'"), 'Colecciones no cubre eliminar/reasignar/desasignar productos.');
expect(domain.includes("mergeFields: ['category', 'collection', 'updatedAt']"), 'La eliminación de colección no limpia ambas referencias category/collection.');

// Firestore es canónico; una falla de preflight no cancela el borrado,
// pero debe registrarse y poder recuperarse por el cierre/reintento persistente.
expect(api.includes('preflightProductsSheet(env, affectedProductIds)'), 'La API debe sondear Sheets antes de una purga autorizada.');
expect(api.includes('applyCatalogPreflightOutcome(result, preflightError)'), 'El resultado final debe resolver un preflight transitorio de Sheets.');
expect(api.includes('retryPendingCatalogSheets(env, idToken)'), 'La API no reconcilia tareas pendientes de Sheets.');
expect(resilience.includes('syncProductsPayloadWithRetry(env, [ids[0]]'), 'La utilidad conserva el payload autenticado server-side de Google Sheets.');
expect(resilience.includes('const MAX_ATTEMPTS = 4'), 'La resiliencia no conserva cuatro intentos de cierre.');
expect(resilience.includes("const QUEUE_COLLECTION = 'catalogSheetSyncQueue'"), 'Falta cola persistente de reconciliación de catálogo.');
expect(resilience.includes("status: 'pending'"), 'La cola de Sheets no registra estado pendiente explícito.');
expect(resilience.includes('export async function queueCatalogSheetSync'), 'La ruta de borrado no puede guardar fallos en la cola persistente.');
expect(resilience.includes('export async function syncDeletedProductsPayloadWithRetry'), 'La purga no transmite tombstones sin releer productos borrados.');
expect(resilience.includes('syncProductsWithRetry(idToken, ids, { attempts: MAX_ATTEMPTS })'), 'El cierre no reintenta la sincronización completa.');
expect(resilience.includes('firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING)'), 'Las reconciliaciones pendientes no se vuelven a leer para su cierre.');
expect(resilience.includes('const PRODUCT_SYNC_CHUNK = 20'), 'La cola no limita cada trabajo a un lote apto para Workers Free.');
expect(engagement.includes('function tintinHandleEngagementBatch_') && appsScript.includes("body.action === 'syncEngagementBatch'"), 'Apps Script no acepta la sincronización social agrupada.');

if (failures.length) {
  console.error(`Borrado global de catálogo: ${failures.length} fallo(s):`);
  failures.forEach(item => console.error(`  - ${item}`));
  process.exit(1);
}
console.log('Borrado global de catálogo: contrato completo (Super Admin, Firebase, social, Sheets, preflight, reintentos, Productos y Colecciones).');
