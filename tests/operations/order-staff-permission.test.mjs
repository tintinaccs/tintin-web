import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { assertOrderStaffPermission, orderStaffPermissionAllows } from '../../cloudflare/seguridad-cloudinary.js';
import { encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const savedDoc = data => async () => ({ fields: encodeFirestoreFields(data) });

test('cambiarPago: sin valor guardado rige el predeterminado de admin y agent', () => {
  assert.equal(orderStaffPermissionAllows('admin', {}, 'pedidos', 'cambiarPago'), true);
  assert.equal(orderStaffPermissionAllows('agent', undefined, 'pedidos', 'cambiarPago'), true);
});

test('reenviarCorreo: conserva el permiso predeterminado de gestión de pedidos para admin y agent', () => {
  assert.equal(orderStaffPermissionAllows('admin', {}, 'pedidos', 'reenviarCorreo'), true);
  assert.equal(orderStaffPermissionAllows('agent', undefined, 'pedidos', 'reenviarCorreo'), true);
  assert.equal(orderStaffPermissionAllows('agent', { agent: { pedidos: { reenviarCorreo: false } } }, 'pedidos', 'reenviarCorreo'), false);
});

test('cambiarPago: el switch apagado por el Super Admin bloquea al rol', () => {
  const saved = { agent: { pedidos: { cambiarPago: false } }, admin: { pedidos: { cambiarPago: true } } };
  assert.equal(orderStaffPermissionAllows('agent', saved, 'pedidos', 'cambiarPago'), false);
  assert.equal(orderStaffPermissionAllows('admin', saved, 'pedidos', 'cambiarPago'), true);
});

test('roles sin gestión de pedidos nunca pasan y el Super Admin siempre pasa', () => {
  const saved = { viewer: { pedidos: { cambiarPago: true } }, client: { pedidos: { cambiarPago: true } } };
  assert.equal(orderStaffPermissionAllows('viewer', saved, 'pedidos', 'cambiarPago'), false);
  assert.equal(orderStaffPermissionAllows('client', saved, 'pedidos', 'cambiarPago'), false);
  assert.equal(orderStaffPermissionAllows('superadmin', { superadmin: { pedidos: { cambiarPago: false } } }, 'pedidos', 'cambiarPago'), true);
});

test('una acción sin predeterminado conocido queda cerrada', () => {
  assert.equal(orderStaffPermissionAllows('admin', {}, 'pedidos', 'eliminar'), false);
});

test('assertOrderStaffPermission responde 403 cuando el rol tiene el switch apagado', async () => {
  const get = savedDoc({ agent: { pedidos: { cambiarPago: false } } });
  await assert.rejects(
    assertOrderStaffPermission({}, { role: 'agent' }, 'pedidos', 'cambiarPago', get),
    error => error.status === 403 && error.code === 'auth/role-permission-denied',
  );
  const actor = { role: 'admin', uid: 'u1' };
  assert.equal(await assertOrderStaffPermission({}, actor, 'pedidos', 'cambiarPago', get), actor);
});

test('assertOrderStaffPermission sin documento de permisos usa el predeterminado', async () => {
  const actor = { role: 'agent' };
  assert.equal(await assertOrderStaffPermission({}, actor, 'pedidos', 'cambiarPago', async () => null), actor);
});

test('assertOrderStaffPermission no deja pasar si Firestore no responde', async () => {
  const get = async () => { throw new Error('down'); };
  await assert.rejects(
    assertOrderStaffPermission({}, { role: 'admin' }, 'pedidos', 'cambiarPago', get),
    error => error.status === 503 && error.code === 'auth/role-permissions-unavailable',
  );
  const superadmin = { role: 'superadmin' };
  assert.equal(await assertOrderStaffPermission({}, superadmin, 'pedidos', 'cambiarPago', get), superadmin);
});

test('/api/admin-order-mutation verifica cambiarPago antes de tocar el pedido', () => {
  const source = readFileSync(new URL('../../functions/api/admin-order-mutation.js', import.meta.url), 'utf8');
  const branch = source.slice(source.indexOf("if (body.action === 'updatePayment') {"));
  const check = branch.indexOf("assertOrderStaffPermission(env, actor, 'pedidos', 'cambiarPago')");
  const mutation = branch.indexOf('applyOrderAdminMutation(');
  assert.ok(check > 0 && mutation > check, 'el permiso debe verificarse antes de aplicar la mutación');
});

test('/api/admin-order-mutation verifica reenviarCorreo antes de registrar el reenvío', () => {
  const source = readFileSync(new URL('../../functions/api/admin-order-mutation.js', import.meta.url), 'utf8');
  const branch = source.slice(source.indexOf("if (body.action === 'recordEmailResend') {"));
  const check = branch.indexOf("assertOrderStaffPermission(env, actor, 'pedidos', 'reenviarCorreo')");
  const mutation = branch.indexOf('recordOrderEmailResend(');
  assert.ok(check >= 0 && mutation > check, 'el permiso debe verificarse antes de aplicar la mutación');
});
