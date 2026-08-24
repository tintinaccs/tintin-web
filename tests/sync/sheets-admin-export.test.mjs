import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  classifySheetsAdminExportAuth,
  projectAuditForSheets,
  projectOrderForSheets,
  projectUserForSheets,
  SHEETS_ADMIN_EXPORT_REVISION,
} from '../../functions/api/sheets-admin-export.js';

test('export de Sheets exige el mismo secreto configurado', () => {
  assert.equal(classifySheetsAdminExportAuth('', 'secret'), 'missing-header');
  assert.equal(classifySheetsAdminExportAuth('secret', ''), 'server-secret-missing');
  assert.equal(classifySheetsAdminExportAuth('otro', 'secret'), 'secret-mismatch');
  assert.equal(classifySheetsAdminExportAuth('secret', 'secret'), 'authenticated');
  assert.equal(SHEETS_ADMIN_EXPORT_REVISION, 'sheets-admin-export-v1');
});

test('Usuarios web proyecta identidad, alias y métricas desde Firestore', () => {
  const user = {
    id: 'uid123456', name: 'Clienta Tintin', email: 'cliente@example.com', role: 'client',
    username: 'barbi', customerId: 'CUS_123', phone: '595981000000',
    checkoutDefaults: { ci: '1234567' }, profileStatus: 'active', createdAt: '2026-08-01T12:00:00Z',
  };
  const orders = [
    { id: 'o1', userId: 'uid123456', total: 100000, status: 'entregado', createdAt: '2026-08-20T12:00:00Z' },
    { id: 'o2', userId: 'uid123456', total: 50000, status: 'cancelado', createdAt: '2026-08-21T12:00:00Z' },
  ];
  const row = projectUserForSheets(user, orders);
  assert.equal(row.username, 'barbi');
  assert.equal(row.customerId, 'CUS_123');
  assert.equal(row.ci, '1234567');
  assert.equal(row.orderCount, 2);
  assert.equal(row.totalSpent, 100000);
});

test('Pedidos web aplana envío, pago, factura e items sin perder departamento', () => {
  const row = projectOrderForSheets({
    id: 'order_1', shortId: 'TINPED99', userId: 'uid1', userEmail: 'a@b.com',
    ci: '1234567', subtotal: 100000, shippingCost: 25000, total: 125000,
    shipping: { method: 'encomienda', city: 'Santiago', departamento: 'Misiones', address: 'Agencia' },
    payment: { method: 'transferencia', status: 'pendiente' },
    wantsInvoice: true, razonSocial: 'Tintin Test', ruc: '1234567-8',
    items: [{ id: 'p1', name: 'Anillo', qty: 1, price: 100000 }],
  });
  assert.equal(row.shippingMethod, 'encomienda');
  assert.equal(row.shippingCity, 'Santiago');
  assert.equal(row.departamento, 'Misiones');
  assert.equal(row.paymentMethod, 'transferencia');
  assert.equal(row.invoiceWanted, true);
  assert.equal(row.itemsSnapshot.length, 1);
});

test('Auditoría web conserva before/after y entidad canónica', () => {
  const row = projectAuditForSheets({
    id: 'audit1', eventId: 'EVT_1', actorEmail: 'admin@example.com', action: 'editar_producto',
    entityType: 'producto', entityId: 'p1', before: { name: 'A' }, after: { name: 'AA' }, origin: 'superadmin',
  });
  assert.equal(row.eventId, 'EVT_1');
  assert.equal(row.entityType, 'producto');
  assert.deepEqual(row.before, { name: 'A' });
  assert.deepEqual(row.after, { name: 'AA' });
});

test('Apps Script instala un único onEdit canónico y mirrors de usuarios/pedidos/auditoría', async () => {
  const source = await readFile(new URL('../../apps-script/SheetsUnificado.gs', import.meta.url), 'utf8');
  assert.match(source, /function tintinRepararSistemaSheets\(\)/);
  assert.match(source, /tintinEliminarActivadoresDuplicados_/);
  assert.match(source, /TINTIN_CANONICAL_EDIT_HANDLER = 'tintinDespacharEdicionConTrazabilidad'/);
  assert.match(source, /everyMinutes\(10\)/);
  assert.match(source, /tintinSincronizarUsuariosWeb_/);
  assert.match(source, /tintinSincronizarPedidosWeb_/);
  assert.match(source, /tintinSincronizarAuditoriaWeb_/);
  assert.match(source, /LockService\.getScriptLock\(\)/);
  assert.match(source, /tintinEnriquecerUltimoHistorial_/);
});
