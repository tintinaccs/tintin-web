import {
  compactAdminRuntimeChecks,
  runAdminRuntimeChecks,
} from './admin-runtime-health.js';
import {
  APPS_SCRIPT_SYNC_URL,
  SHEETS_HEALTH_REVISION,
  SHEETS_HEALTH_TIMEOUT_MS,
} from './sheets-sync-config.js';
import { getCatalogSheetSyncQueueStatus } from './resiliencia-sync-catalogo.js';
import { fetchAppsScript } from './apps-script-fetch.js';

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
  orders: { authority: 'Firestore orders + canonical order domain', mirror: 'Superadmin + Google Sheets Pedidos web', mode: 'admin-parity' },
  audit: { authority: 'Firestore auditLog', mirror: 'Google Sheets Auditoría web', mode: 'read-only-mirror' },
  content: { authority: 'Firestore site_content', mirror: null, mode: 'firestore-only' },
  visualBuilder: { authority: 'Firestore visualBuilderPages', mirror: null, mode: 'firestore-only' },
  settings: { authority: 'Firestore settings', mirror: null, mode: 'firestore-only' },
});

function configured(env, key) {
  return Boolean(String(env?.[key] || '').trim());
}

function emptySyncSummary() {
  return {
    available: false,
    lastStatus: '',
    lastAt: '',
    errors24h: null,
    rejected24h: null,
    syncing24h: null,
  };
}

/**
 * Probe no destructivo del Web App de Apps Script.
 * Envía la ruta canónica syncProducts SIN idToken. Un despliegue correcto debe
 * reconocer esa ruta y rechazarla como "No autorizado" antes de leer/escribir
 * productos. Así comprobamos reachability + contrato sin tocar Sheets.
 */
export async function probeAppsScript({ fetchImpl = fetchAppsScript } = {}) {
  const started = Date.now();
  try {
    const response = await fetchImpl(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SHEETS_HEALTH_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action: 'syncProducts', productIds: [], healthProbe: SHEETS_HEALTH_REVISION }),
    });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    const recognizedGuard = body?.ok === false && /no autorizado/i.test(String(body?.error || ''));
    return {
      reachable: true,
      httpStatus: response.status,
      protocolOk: response.ok && recognizedGuard,
      revision: SHEETS_HEALTH_REVISION,
      service: 'google-apps-script',
      summary: emptySyncSummary(),
      ms: Date.now() - started,
      code: response.ok && recognizedGuard ? '' : 'canonical_guard_not_confirmed',
    };
  } catch (error) {
    const message = String(error?.message || error || '');
    const code = /timeout|timed out/i.test(message) ? 'timeout' : 'unreachable';
    return {
      reachable: false,
      httpStatus: 0,
      protocolOk: false,
      revision: SHEETS_HEALTH_REVISION,
      service: 'google-apps-script',
      summary: emptySyncSummary(),
      ms: Date.now() - started,
      code,
    };
  }
}

export async function runSystemHealth(env, {
  runtimeRunner = runAdminRuntimeChecks,
  sheetsProbe = probeAppsScript,
  catalogSheetQueueStatus = getCatalogSheetSyncQueueStatus,
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
  let catalogSheetQueue = null;
  if (!missingConfig.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
    try {
      catalogSheetQueue = await catalogSheetQueueStatus(env);
    } catch (error) {
      console.error('[system-health] Estado de catalogSheetSyncQueue no disponible:', error?.message || error);
    }
  }

  const sheets = await sheetsProbe().catch(() => ({
    reachable: false,
    httpStatus: 0,
    protocolOk: false,
    revision: SHEETS_HEALTH_REVISION,
    service: 'google-apps-script',
    summary: emptySyncSummary(),
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
    catalogSheetQueue,
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
