import {
  compactAdminRuntimeChecks,
  runAdminRuntimeChecks,
} from './admin-runtime-health.js';
import {
  APPS_SCRIPT_SYNC_URL,
  SHEETS_HEALTH_REVISION,
  SHEETS_HEALTH_TIMEOUT_MS,
} from './sheets-sync-config.js';

const REQUIRED_CONFIG = Object.freeze([
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'RESEND_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SHEETS_ENGAGEMENT_SECRET',
]);

export const SYSTEM_AUTHORITIES = Object.freeze({
  products: { authority: 'Firestore products', mirror: 'Google Sheets Productos', mode: 'bidirectional' },
  inventory: { authority: 'Firestore productInventory', mirror: 'Google Sheets Productos', mode: 'bidirectional' },
  collections: { authority: 'Firestore collections', mirror: null, mode: 'firestore-only' },
  users: { authority: 'Firebase Auth + Firestore users', mirror: 'Google Sheets Usuarios web', mode: 'admin-mirror' },
  orders: { authority: 'Firestore orders + Superadmin', mirror: 'Google Sheets Pedidos web', mode: 'read-only-mirror' },
  audit: { authority: 'Firestore auditLog', mirror: 'Google Sheets Auditoría web', mode: 'read-only-mirror' },
  content: { authority: 'Firestore site_content', mirror: null, mode: 'firestore-only' },
  visualBuilder: { authority: 'Firestore visualBuilderPages', mirror: null, mode: 'firestore-only' },
  settings: { authority: 'Firestore settings', mirror: null, mode: 'firestore-only' },
});

function configured(env, key) {
  return Boolean(String(env?.[key] || '').trim());
}

function safeSyncSummary(value) {
  const input = value && typeof value === 'object' ? value : {};
  const lastStatus = String(input.lastStatus || '').slice(0, 40);
  const lastAt = String(input.lastAt || '').slice(0, 80);
  const nonNegativeInt = key => Math.max(0, Math.min(10000, Number.parseInt(input[key], 10) || 0));
  return {
    lastStatus,
    lastAt,
    errors24h: nonNegativeInt('errors24h'),
    rejected24h: nonNegativeInt('rejected24h'),
    syncing24h: nonNegativeInt('syncing24h'),
  };
}

export async function probeAppsScript({ fetchImpl = fetch } = {}) {
  const started = Date.now();
  try {
    const response = await fetchImpl(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SHEETS_HEALTH_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action: 'health', revision: SHEETS_HEALTH_REVISION }),
    });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    const protocolOk = response.ok && body?.ok === true && body?.revision === SHEETS_HEALTH_REVISION;
    return {
      reachable: true,
      httpStatus: response.status,
      protocolOk,
      revision: String(body?.revision || ''),
      service: String(body?.service || 'google-apps-script').slice(0, 80),
      summary: safeSyncSummary(body?.summary),
      ms: Date.now() - started,
      code: protocolOk ? '' : 'revision_mismatch',
    };
  } catch (error) {
    const message = String(error?.message || error || '');
    const code = /timeout|timed out/i.test(message) ? 'timeout' : 'unreachable';
    return {
      reachable: false,
      httpStatus: 0,
      protocolOk: false,
      revision: '',
      service: 'google-apps-script',
      summary: safeSyncSummary(null),
      ms: Date.now() - started,
      code,
    };
  }
}

export async function runSystemHealth(env, {
  runtimeRunner = runAdminRuntimeChecks,
  sheetsProbe = probeAppsScript,
} = {}) {
  const missingConfig = REQUIRED_CONFIG.filter(key => !configured(env, key));
  let runtimeReport = null;
  if (!missingConfig.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
    try {
      runtimeReport = await runtimeRunner(env);
    } catch (error) {
      console.error('[system-health] Admin runtime no disponible:', error?.message || error);
    }
  }

  const sheets = await sheetsProbe().catch(() => ({
    reachable: false,
    httpStatus: 0,
    protocolOk: false,
    revision: '',
    service: 'google-apps-script',
    summary: safeSyncSummary(null),
    ms: 0,
    code: 'probe_failed',
  }));
  const admin = compactAdminRuntimeChecks(runtimeReport);
  const integrations = {
    firebase: runtimeReport?.ok === true,
    resend: configured(env, 'RESEND_API_KEY'),
    cloudinary: configured(env, 'CLOUDINARY_CLOUD_NAME') && configured(env, 'CLOUDINARY_API_KEY') && configured(env, 'CLOUDINARY_API_SECRET'),
    sheets: configured(env, 'SHEETS_ENGAGEMENT_SECRET') && sheets.protocolOk === true,
    appsScript: sheets,
  };
  const ok = missingConfig.length === 0 && runtimeReport?.ok === true && integrations.sheets === true;

  return {
    ok,
    missingConfig,
    admin,
    integrations,
    authorities: SYSTEM_AUTHORITIES,
    deployment: {
      commitSha: String(env?.CF_PAGES_COMMIT_SHA || '').slice(0, 64),
      branch: String(env?.CF_PAGES_BRANCH || '').slice(0, 120),
      url: String(env?.CF_PAGES_URL || '').slice(0, 300),
    },
    failedRuntimeChecks: Array.isArray(runtimeReport?.failed) ? runtimeReport.failed : [],
    checkedAt: new Date().toISOString(),
  };
}
