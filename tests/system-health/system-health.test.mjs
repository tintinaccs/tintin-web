import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SYSTEM_AUTHORITIES,
  probeAppsScript,
  runSystemHealth,
} from '../../cloudflare/system-health.js';
import { ADMIN_RUNTIME_CHECK_IDS } from '../../cloudflare/admin-runtime-health.js';

function runtimeReport(ok = true) {
  return {
    ok,
    checks: Object.fromEntries(ADMIN_RUNTIME_CHECK_IDS.map(id => [id, { id, ok, ms: 1, code: '' }])),
    failed: ok ? [] : [...ADMIN_RUNTIME_CHECK_IDS],
  };
}

const COMPLETE_ENV = {
  FIREBASE_SERVICE_ACCOUNT_KEY: '{}',
  RESEND_API_KEY: 'configured',
  CLOUDINARY_CLOUD_NAME: 'configured',
  CLOUDINARY_API_KEY: 'configured',
  CLOUDINARY_API_SECRET: 'configured',
  SHEETS_ENGAGEMENT_SECRET: 'configured',
  CF_PAGES_COMMIT_SHA: 'abcdef1234567890',
  CF_PAGES_BRANCH: 'main',
  CF_PAGES_URL: 'https://example.pages.dev',
};

test('estado integral pasa solo con runtime y puente Sheets confirmados', async () => {
  const report = await runSystemHealth(COMPLETE_ENV, {
    runtimeRunner: async () => runtimeReport(true),
    sheetsProbe: async () => ({
      reachable: true,
      httpStatus: 200,
      protocolOk: true,
      revision: 'apps-script-products-guard-v1',
      service: 'google-apps-script',
      summary: { lastStatus: '', lastAt: '', errors24h: 0, rejected24h: 0, syncing24h: 0 },
      ms: 20,
      code: '',
    }),
  });

  assert.equal(report.ok, true);
  assert.equal(report.admin.productInventory, true);
  assert.equal(report.admin.auditLog, true);
  assert.equal(report.admin.settings, true);
  assert.equal(report.integrations.sheets, true);
  assert.deepEqual(report.integrations.paypal, {
    configured: false,
    enabled: false,
    environment: 'sandbox',
    missing: ['feature_disabled', 'client_id', 'client_secret', 'webhook_id', 'exchange_rate', 'stale_exchange_rate'],
  });
  assert.equal(report.deployment.commitSha, COMPLETE_ENV.CF_PAGES_COMMIT_SHA);
  assert.equal(SYSTEM_AUTHORITIES.orders.mode, 'admin-parity');
  assert.equal(SYSTEM_AUTHORITIES.products.mode, 'bidirectional');
});

test('configuración faltante o protocolo Sheets no verificado mantiene FAIL', async () => {
  const env = { ...COMPLETE_ENV, SHEETS_ENGAGEMENT_SECRET: '' };
  const report = await runSystemHealth(env, {
    runtimeRunner: async () => runtimeReport(true),
    sheetsProbe: async () => ({
      reachable: true,
      httpStatus: 200,
      protocolOk: false,
      revision: 'apps-script-products-guard-v1',
      service: 'google-apps-script',
      summary: {},
      ms: 15,
      code: 'canonical_guard_not_confirmed',
    }),
  });

  assert.equal(report.ok, false);
  assert.equal(report.integrations.sheets, false);
  assert.ok(report.missingConfig.includes('SHEETS_ENGAGEMENT_SECRET'));
});

test('la cola de participación se informa en integraciones sin alterar ok', async () => {
  const status = {
    pendingCount: 2,
    deadLetterCount: 1,
    oldestPendingAgeMs: 60_000,
    lastRunAt: '',
    lastSuccessAt: '',
    lastError: 'Acción no permitida',
  };
  const report = await runSystemHealth(COMPLETE_ENV, {
    runtimeRunner: async () => runtimeReport(true),
    sheetsProbe: async () => ({
      reachable: true,
      httpStatus: 200,
      protocolOk: true,
      revision: 'apps-script-products-guard-v1',
      service: 'google-apps-script',
      summary: {},
      ms: 10,
      code: '',
    }),
    catalogSheetQueueStatus: async () => null,
    orderEmailQueueStatus: async () => null,
    engagementSheetQueueStatus: async () => status,
  });

  assert.deepEqual(report.integrations.engagementSheetQueue, status);
  assert.equal(report.ok, true);
});

test('probe Apps Script confirma el guard canónico sin token y sin escritura', async () => {
  let request = null;
  const result = await probeAppsScript({
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(result.reachable, true);
  assert.equal(result.protocolOk, true);
  assert.equal(request.action, 'syncProducts');
  assert.equal('idToken' in request, false);
  assert.deepEqual(request.productIds, []);
});
