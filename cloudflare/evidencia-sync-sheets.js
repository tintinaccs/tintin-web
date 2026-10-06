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
// - mirror: Apps Script confirmó ok:true al recibir un pedido, una reseña o un
//   "me gusta" reales (Firestore → Apps Script → hoja).
//
// No genera tráfico de prueba ni escribe en la hoja: sólo anota lo que ya
// pasó. Es best-effort y nunca lanza: un fallo al guardar el acuse deja el
// indicador sin confirmar, jamás rompe la venta ni la sincronización.
import {
  decodeFirestoreFields,
  firestoreAdminGet,
  firestoreAdminMerge,
  fsString,
  fsTimestamp,
} from './firebase-admin-ligero.js';

export const SHEETS_EVIDENCE_PATH = 'syncMeta/sheetsFlowEvidence';
export const SHEETS_EVIDENCE_CHANNELS = Object.freeze(['inbound', 'mirror']);

const REAL_DEPS = { firestoreAdminGet, firestoreAdminMerge };

const clean = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Anota el resultado de una sincronización real. `ok:true` guarda la fecha,
 * el tipo de operación y la revisión que la atendió; `ok:false` guarda la
 * fecha y el motivo del fallo sin borrar el último éxito.
 * @returns {Promise<boolean>} true si el acuse quedó guardado.
 */
export async function recordSheetsEvidence(env, channel, { ok = false, kind = '', revision = '', error = '' } = {}, deps = REAL_DEPS) {
  if (!SHEETS_EVIDENCE_CHANNELS.includes(channel)) return false;
  const now = new Date();
  const fields = ok === true
    ? {
        [`${channel}LastSuccessAt`]: fsTimestamp(now),
        [`${channel}LastSuccessKind`]: fsString(clean(kind, 60)),
        [`${channel}Revision`]: fsString(clean(revision, 80)),
      }
    : {
        [`${channel}LastErrorAt`]: fsTimestamp(now),
        [`${channel}LastErrorKind`]: fsString(clean(kind, 60)),
        [`${channel}LastError`]: fsString(clean(error?.message || error || 'Error desconocido', 200)),
      };
  try {
    await deps.firestoreAdminMerge(env, SHEETS_EVIDENCE_PATH, fields);
    return true;
  } catch (failure) {
    console.warn('[sheets-evidence] No se pudo guardar el acuse de sincronización:', failure?.message || failure);
    return false;
  }
}

function channelView(data, channel) {
  return {
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
      inbound: channelView(data, 'inbound'),
      mirror: channelView(data, 'mirror'),
    };
  } catch (failure) {
    console.error('[sheets-evidence] No se pudo leer el acuse de sincronización:', failure?.message || failure);
    return { available: false, inbound: channelView({}, 'inbound'), mirror: channelView({}, 'mirror') };
  }
}
