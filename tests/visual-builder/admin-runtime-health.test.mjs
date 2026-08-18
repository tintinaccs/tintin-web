import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_RUNTIME_CHECK_IDS,
  classifyAdminRuntimeError,
  compactAdminRuntimeChecks,
  runAdminRuntimeChecks,
} from '../../cloudflare/admin-runtime-health.js';
import { onRequest as adminRuntimeHealthRequest } from '../../functions/api/admin-runtime-health.js';

test('admin runtime health recorre todas las superficies sin devolver datos', async () => {
  const calls = [];
  const access = {
    async get(_env, path) {
      calls.push(['get', path]);
      return null;
    },
    async list(_env, path, pageSize) {
      calls.push(['list', path, pageSize]);
      return [];
    },
  };

  const report = await runAdminRuntimeChecks({}, { access });
  assert.equal(report.ok, true);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(Object.keys(report.checks), ADMIN_RUNTIME_CHECK_IDS);
  assert.deepEqual(compactAdminRuntimeChecks(report), Object.fromEntries(ADMIN_RUNTIME_CHECK_IDS.map(id => [id, true])));
  assert.ok(calls.some(([, path]) => path === 'visualBuilderPages/index'));
  assert.ok(calls.some(([, path]) => path === 'visualBuilderDrafts/index'));
  assert.ok(calls.some(([, path]) => path === 'visualBuilderHistory'));
  assert.ok(calls.some(([, path]) => path === 'reviewRecords'));
  assert.ok(calls.some(([, path]) => path === 'likeRecords'));
});

test('un fallo de un módulo queda aislado y los demás probes siguen corriendo', async () => {
  const visited = [];
  const access = {
    async get(_env, path) {
      visited.push(path);
      return null;
    },
    async list(_env, path) {
      visited.push(path);
      if (path === 'orders') throw new Error('Firestore LIST falló (503)');
      return [];
    },
  };

  const report = await runAdminRuntimeChecks({}, { access });
  assert.equal(report.ok, false);
  assert.deepEqual(report.failed, ['orders']);
  assert.equal(report.checks.orders.ok, false);
  assert.equal(report.checks.orders.code, 'firestore_unavailable');
  assert.equal(report.checks.visualBuilder.ok, true);
  assert.ok(visited.includes('emailLogs'));
  assert.ok(visited.includes('visualBuilderHistory'));
});

test('clasificación de fallos no expone detalles internos como contrato público', () => {
  assert.equal(classifyAdminRuntimeError(new Error('FIREBASE_SERVICE_ACCOUNT_KEY no está configurada')), 'service_account_config');
  assert.equal(classifyAdminRuntimeError(new Error('No se pudo autenticar la cuenta de servicio de Firebase')), 'service_account_auth');
  assert.equal(classifyAdminRuntimeError(new Error('Firestore GET falló (500)')), 'firestore_unavailable');
  assert.equal(classifyAdminRuntimeError(new Error('fetch failed')), 'network_unavailable');
  assert.equal(classifyAdminRuntimeError(new Error('otra cosa')), 'runtime_check_failed');
});

test('el health privado exige una sesión real de Super Admin', async () => {
  const request = new Request('https://tintinaccesorios.pages.dev/api/admin-runtime-health', {
    method: 'GET',
    headers: { origin: 'https://tintinaccesorios.pages.dev' },
  });
  const response = await adminRuntimeHealthRequest({ request, env: {} });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'authentication_required');
  assert.match(payload.requestId, /^admin-health-/);
});
