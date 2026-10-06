// =============================================================
// TINTIN — Acuse de las sincronizaciones reales con Google Sheets
// =============================================================
// El panel Flujo/Conexiones no podía confirmar ninguna conexión con Sheets:
// las sondas de salud sólo comprueban el guard (rechazan una petición sin
// secreto) y ninguna operación real dejaba constancia de su resultado. Este
// módulo guarda el resultado de la ÚLTIMA sincronización real de cada canal:
//
// - inbound: una edición de la hoja Productos llegó autenticada al webhook y
//   su commit en Firestore terminó (Sheets → Apps Script → webhook → Firestore).
// - mirror: Apps Script confirmó ok:true al recibir un producto, un pedido, una reseña o un
//   "me gusta" reales (Firestore → Apps Script → hoja).
//
// No genera tráfico de prueba ni escribe en la hoja: sólo anota lo que ya
// pasó. Es best-effort y nunca lanza: un fallo al guardar el acuse deja el
// indicador sin confirmar, jamás rompe la venta ni la sincronización.
import {
  decodeFirestoreFields,
  firestoreAdminGet,
  firestoreAdminCommit,
  fsString,
  fsTimestamp,
} from './firebase-admin-ligero.js';

export const SHEETS_EVIDENCE_PATH = 'syncMeta/sheetsFlowEvidence';
export const SHEETS_EVIDENCE_CHANNELS = Object.freeze(['inbound', 'mirror']);

const REAL_DEPS = { firestoreAdminGet, firestoreAdminCommit };

const clean = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Anota el resultado de una sincronización real. `ok:true` guarda la fecha,
 * el tipo de operación y la revisión que la atendió; `ok:false` guarda la
 * fecha y el motivo del fallo sin borrar el último éxito.
 * @returns {Promise<boolean>} true si el acuse quedó guardado.
 */
let lastStartedAt = 0;
export function beginSheetsOperation() {
  lastStartedAt = Math.max(Date.now(), lastStartedAt + 1);
  return { startedAt: new Date(lastStartedAt).toISOString(), operationId: crypto.randomUUID() };
}

// Nunca persistir mensajes arbitrarios de proveedores: pueden contener tokens,
// URLs firmadas o datos personales. Código/HTTP bastan para localizar el fallo.
export function sheetsFailureCause(error) {
  const status = Number(error?.status);
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'timeout';
  if (Number.isInteger(status) && status >= 400 && status <= 599) return `upstream_http_${status}`;
  const message = String(error?.message || error || '');
  const http = message.match(/(?:respondió|falló)\s*\(?([45]\d\d)/);
  if (http) return `upstream_http_${http[1]}`;
  return 'sync_failed';
}

export async function recordSheetsEvidence(env, channel, outcome = {}, deps = REAL_DEPS) {
  if (!SHEETS_EVIDENCE_CHANNELS.includes(channel)) return false;
  const { ok = false, kind = '', revision = '', error = '' } = outcome;
  const startedAt = outcome.startedAt || beginSheetsOperation().startedAt;
  if (!Number.isFinite(Date.parse(startedAt))) return false;
  const operationId = clean(outcome.operationId || crypto.randomUUID(), 80);
  const now = new Date();
  const fields = {
    [`${channel}StartedAt`]: fsTimestamp(new Date(startedAt)),
    [`${channel}CompletedAt`]: fsTimestamp(now),
    [`${channel}OperationId`]: fsString(operationId),
    [`${channel}Result`]: fsString(ok === true ? 'success' : 'failed'),
    [`${channel}DeploymentRevision`]: fsString(clean(env?.CF_PAGES_COMMIT_SHA, 80)),
    ...(ok === true ? {
      [`${channel}LastSuccessAt`]: fsTimestamp(now),
      [`${channel}LastSuccessKind`]: fsString(clean(kind, 60)),
      [`${channel}Revision`]: fsString(clean(revision, 80)),
    } : {
      [`${channel}LastErrorAt`]: fsTimestamp(now),
      [`${channel}LastErrorKind`]: fsString(clean(kind, 60)),
      [`${channel}LastError`]: fsString(sheetsFailureCause(error)),
    }),
  };
  try {
    // CAS también al crear el documento: dos primeras operaciones no pueden
    // sobrescribirse sin volver a comparar su orden de inicio.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const document = await deps.firestoreAdminGet(env, SHEETS_EVIDENCE_PATH);
      const data = document ? decodeFirestoreFields(document.fields || {}) : {};
      const previous = Date.parse(data[`${channel}StartedAt`] || '');
      const current = Date.parse(startedAt);
      if (previous > current || (previous === current && String(data[`${channel}OperationId`] || '') >= operationId)) return false;
      try {
        await deps.firestoreAdminCommit(env, [{
          path: SHEETS_EVIDENCE_PATH, fields, mergeFields: Object.keys(fields),
          currentDocument: document ? { updateTime: document.updateTime } : { exists: false },
        }]);
        return true;
      } catch (failure) {
        if (failure?.code !== 'version_conflict') throw failure;
      }
    }
  } catch {
    console.warn('[sheets-evidence] No se pudo guardar el acuse.');
  }
  return false;
}

function channelView(data, channel) {
  return {
    startedAt: clean(data[`${channel}StartedAt`], 40),
    completedAt: clean(data[`${channel}CompletedAt`], 40),
    operationId: clean(data[`${channel}OperationId`], 80),
    result: clean(data[`${channel}Result`], 20),
    deploymentRevision: clean(data[`${channel}DeploymentRevision`], 80),
    lastSuccessAt: clean(data[`${channel}LastSuccessAt`], 40),
    lastSuccessKind: clean(data[`${channel}LastSuccessKind`], 60),
    revision: clean(data[`${channel}Revision`], 80),
    lastErrorAt: clean(data[`${channel}LastErrorAt`], 40),
    lastErrorKind: clean(data[`${channel}LastErrorKind`], 60),
    lastError: clean(data[`${channel}LastError`], 200),
  };
}

/** Lectura de solo lectura para /api/system-health. Nunca lanza. */
export async function getSheetsFlowEvidence(env, deps = REAL_DEPS) {
  try {
    const document = await deps.firestoreAdminGet(env, SHEETS_EVIDENCE_PATH);
    const data = document ? decodeFirestoreFields(document.fields || {}) : {};
    return {
      available: true,
      inbound: { ...channelView(data, 'inbound'), currentDeploymentRevision: clean(env?.CF_PAGES_COMMIT_SHA, 80) },
      mirror: { ...channelView(data, 'mirror'), currentDeploymentRevision: clean(env?.CF_PAGES_COMMIT_SHA, 80) },
    };
  } catch (failure) {
    console.error('[sheets-evidence] No se pudo leer el acuse.');
    return { available: false, inbound: channelView({}, 'inbound'), mirror: channelView({}, 'mirror') };
  }
}
