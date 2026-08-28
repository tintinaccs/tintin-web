import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditComponentRegistrySources,
  auditDomainConsumerSources,
  auditNoDuplicateAuthoritiesSources,
} from '../../scripts/lib/architecture-gates.mjs';

test('un renderer nativo nuevo sin registro rompe el gate', () => {
  const result = auditComponentRegistrySources({
    contractSource: "export const VISUAL_BLOCK_TYPES = Object.freeze(['section']);",
    runtimeSource: "function buildBlock(block){ if (block.type === 'native-new') return document.createElement('div'); }",
  });
  assert.match(result.errors.join('\n'), /native-new.*no está registrado/i);
});

test('un tipo registrado genérico sigue siendo válido', () => {
  const result = auditComponentRegistrySources({
    contractSource: "export const VISUAL_BLOCK_TYPES = Object.freeze(['section']);",
    runtimeSource: 'function buildBlock(block){ return block; }',
  });
  assert.deepEqual(result.errors, []);
});

test('una escritura directa de orders desde Sheets rompe el gate', () => {
  const errors = auditNoDuplicateAuthoritiesSources({
    sheetsAdminWebhook: "firestoreAdminCommit(env, [{ path: `orders/${id}`, fields: patch }]);",
    appsScriptParity: '',
    adminOrderCrud: '',
    inventoryAdmin: "async function updateEditedOrder(){ return fetch('/api/admin-order-mutation'); }",
  });
  assert.match(errors.join('\n'), /escritura directa a orders/i);
});

test('Superadmin y Sheets deben delegar a las autoridades canónicas', () => {
  const errors = auditDomainConsumerSources({
    adminOrderCrud: "fetch('/api/admin-order-mutation'); const action = { action: 'createOrder' };",
    inventoryAdmin: "fetch('/api/admin-order-mutation');",
    sheetsAdminWebhook: 'createOrderAdmin(); applyOrderAdminMutation(); applyUserLifecycle();',
    adminDeleteUser: 'applyUserLifecycle();',
    userLifecycle: 'export async function applyUserLifecycle() {}',
    orderDomain: 'export async function createOrderAdmin() {}\nexport async function applyOrderAdminMutation() {}',
  });
  assert.deepEqual(errors, []);
});

test('si Superadmin vuelve a reconciliar updateEditedOrder localmente CI lo detecta', () => {
  const errors = auditNoDuplicateAuthoritiesSources({
    sheetsAdminWebhook: '',
    appsScriptParity: '',
    adminOrderCrud: '',
    inventoryAdmin: "async function updateEditedOrder(){ return runTransaction(db, async () => {}); }",
  });
  assert.match(errors.join('\n'), /reconciliador paralelo/i);
});

test('el gate reconoce consumidores server-side con CRLF y bloques anidados', () => {
  const errors = auditNoDuplicateAuthoritiesSources({
    sheetsAdminWebhook: '',
    appsScriptParity: '',
    adminOrderCrud: '',
    inventoryAdmin: [
      'async function updateEditedOrder(orderId, patch) {',
      "  const response = await fetch('/api/admin-order-mutation', {",
      "    method: 'POST',",
      '    headers: { authorization: token }',
      '  });',
      '  if (!response.ok) { throw new Error(\'fallo\'); }',
      '  return response.json();',
      '}',
      '',
    ].join('\\r\\n'),
  });
  assert.deepEqual(errors, []);
});
