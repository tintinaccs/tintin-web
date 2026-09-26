// Cola persistente de reintentos para reseñas y "me gusta" que no llegaron a
// Google Sheets. Sigue el contrato de catalogSheetSyncQueue (reclamo
// optimista, backoff, dead_letter con aviso al admin) con dos diferencias:
//
// - El ID del documento sale del registro (reviewId/likeId). Un segundo fallo
//   del mismo registro reemplaza la instantánea anterior, así Sheets termina
//   con el último estado y no con uno intermedio.
// - dead_letter no es terminal. Apps Script no ofrece otra vía para reenviar
//   participación desde Firestore, así que una tarea bloqueada se sigue
//   reintentando con un intervalo largo y se resuelve sola cuando Sheets
//   vuelve a responder.
//
// La colección guarda datos personales de la reseña (correo, nombre): solo se
// accede con la cuenta de servicio. firestore.rules la cubre con la regla
// general que niega todo acceso de cliente.
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminListAll,
  firestoreAdminMerge,
  fsInteger,
  fsString,
  fsTimestamp,
} from './firebase-admin-ligero.js';
import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS } from './sheets-sync-config.js';
import { notifyAdminIfAbsent } from './notificaciones-sociales.js';
import { fetchAppsScript } from './apps-script-fetch.js';

const QUEUE_COLLECTION = 'engagementSheetSyncQueue';
const QUEUE_META_PATH = 'syncMeta/engagementSheetSyncQueue';
const MAX_PENDING = 200;
// La reconciliación con una purga revisa toda la cola (listAll pagina de a 300).
const MAX_SUPERSEDE_SCAN = 1000;
const COMMIT_CHUNK = 20;
const MAX_QUEUE_ATTEMPTS = 8;
const QUEUE_BACKOFF_MS = 5 * 60 * 1000;
const DEAD_LETTER_RETRY_MS = 6 * 60 * 60 * 1000;
const CLAIM_STALE_MS = 10 * 60 * 1000;
// Firestore admite documentos de hasta 1 MiB; el resto de los campos es chico.
const MAX_EVENT_JSON_BYTES = 900_000;
const ENGAGEMENT_TYPES = new Set(['review', 'like']);

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const docId = document => String(document?.name || '').split('/').pop();
const isStale = claimedAt => {
  const at = Date.parse(claimedAt || '');
  return !Number.isFinite(at) || (Date.now() - at) > CLAIM_STALE_MS;
};
const isEngagementEvent = event => ENGAGEMENT_TYPES.has(event?.type) && Boolean(event?.record);

function decoded(document) {
  return document ? { id: docId(document), ...decodeFirestoreFields(document.fields || {}) } : null;
}

// Mismo esquema de inyección que REAL_QUEUE_DEPS del catálogo: las pruebas
// reemplazan Firestore y Apps Script por dobles en memoria.
const REAL_DEPS = {
  firestoreAdminGet,
  firestoreAdminCommit,
  firestoreAdminListAll,
  firestoreAdminMerge,
  notifyAdminIfAbsent,
  fetchImpl: fetchAppsScript,
};

function recordKey(event) {
  const record = event?.record || {};
  return clean(event?.type === 'review' ? record.reviewId : record.likeId, 300);
}

// Hash del tipo + ID del registro: garantiza una ruta válida para commit
// (solo [A-Za-z0-9_-]) sin depender del formato del ID original.
async function queueDocId(event) {
  const key = recordKey(event);
  if (!key) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${event.type}:${key}`));
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${event.type}_${hex.slice(0, 40)}`;
}

async function commitIfUnchanged(env, id, updateTime, write, deps) {
  try {
    await deps.firestoreAdminCommit(env, [{
      path: `${QUEUE_COLLECTION}/${id}`,
      ...write,
      currentDocument: { updateTime },
    }]);
    return true;
  } catch (error) {
    if (error?.code === 'version_conflict') return false;
    throw error;
  }
}

/** Envía un evento a Apps Script. Lanza si Sheets no confirma ok:true. */
export async function postEngagementEvent(env, event, fetchImpl = fetchAppsScript) {
  const syncSecret = String(env?.SHEETS_ENGAGEMENT_SECRET || '');
  if (!syncSecret) throw new Error('SHEETS_ENGAGEMENT_SECRET no está configurado.');
  const response = await fetchImpl(APPS_SCRIPT_SYNC_URL, {
    method: 'POST',
    redirect: 'follow',
    signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ action: 'syncEngagement', syncSecret, event }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    throw new Error(clean(result.error || `Sheets Participación respondió ${response.status}`));
  }
  return true;
}

// Documento completo de una tarea nueva. Reemplaza cualquier instantánea
// anterior del mismo registro, incluso una bloqueada en dead_letter.
function pendingFields(event, eventJson, error) {
  const now = new Date();
  return encodeFirestoreFields({
    schemaVersion: 1,
    status: 'pending',
    type: event.type,
    operation: clean(event.operation, 40),
    eventJson,
    lastError: clean(error?.message || error),
    attempts: 0,
    nextAttemptAt: now,
    claimedAt: null,
    claimedBy: '',
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Guarda la última instantánea del registro para reintentarla. Nunca guarda
 * el secreto: el drenaje lo toma de env al reenviar.
 */
export async function queueEngagementSheetSync(env, event, error, deps = REAL_DEPS) {
  if (!isEngagementEvent(event)) return '';
  const id = await queueDocId(event);
  if (!id) {
    console.error('[engagement-sheets] Evento sin reviewId/likeId: no se puede encolar.');
    return '';
  }
  const eventJson = JSON.stringify(event);
  if (new TextEncoder().encode(eventJson).length > MAX_EVENT_JSON_BYTES) {
    console.error('[engagement-sheets] Evento demasiado grande para la cola de reintentos.');
    return '';
  }
  await deps.firestoreAdminCommit(env, [{ path: `${QUEUE_COLLECTION}/${id}`, fields: pendingFields(event, eventJson, error) }]);
  return id;
}

/**
 * Las purgas de catálogo mandan sus tombstones en un lote aparte. Una
 * instantánea encolada antes de la purga ya no representa el registro: si el
 * drenaje la reenviara, Sheets recuperaría una reseña o un "me gusta" borrado,
 * con sus datos personales. Si Sheets confirmó el lote se descarta; si no, se
 * reemplaza por el tombstone para que el reintento borre en lugar de
 * restaurar. Solo toca registros que ya estaban en la cola: con la cola vacía
 * cuesta una lectura.
 */
export async function supersedeQueuedEngagementEvents(env, events, { delivered = false } = {}, deps = REAL_DEPS) {
  const candidates = (Array.isArray(events) ? events : []).filter(isEngagementEvent);
  if (!candidates.length) return 0;
  const documents = await deps.firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_SUPERSEDE_SCAN);
  const queued = new Set(documents.map(docId));
  if (!queued.size) return 0;
  const writes = [];
  for (const event of candidates) {
    const id = await queueDocId(event);
    if (!id || !queued.has(id)) continue;
    queued.delete(id);
    const path = `${QUEUE_COLLECTION}/${id}`;
    writes.push(delivered
      ? { path, delete: true }
      : { path, fields: pendingFields(event, JSON.stringify(event), 'La purga del catálogo no pudo sincronizar Participación.') });
  }
  for (let index = 0; index < writes.length; index += COMMIT_CHUNK) {
    await deps.firestoreAdminCommit(env, writes.slice(index, index + COMMIT_CHUNK));
  }
  return writes.length;
}

// Un envío exitoso deja obsoleta cualquier instantánea del mismo registro
// encolada antes de que empezara: si el drenaje la reenviara después,
// Sheets retrocedería (por ejemplo, reaparecería un "me gusta" ya quitado).
// Una instantánea encolada durante este envío es más nueva y se conserva.
async function discardOlderQueuedSnapshot(env, event, startedAt, deps) {
  const id = await queueDocId(event);
  if (!id) return false;
  const document = await deps.firestoreAdminGet(env, `${QUEUE_COLLECTION}/${id}`);
  if (!document) return false;
  const queuedAt = Date.parse(decoded(document).createdAt || '');
  if (Number.isFinite(queuedAt) && queuedAt >= startedAt) return false;
  return commitIfUnchanged(env, id, document.updateTime, { delete: true }, deps);
}

/**
 * Camino en vivo de reseñas y "me gusta". Si Sheets falla, el evento queda
 * en la cola en vez de perderse; el resultado sigue siendo informativo para
 * el llamador, que corre en waitUntil y no depende de él.
 */
export async function syncEngagementEventOrQueue(env, event, deps = REAL_DEPS) {
  if (!isEngagementEvent(event)) return false;
  const startedAt = Date.now();
  try {
    await postEngagementEvent(env, event, deps.fetchImpl);
  } catch (error) {
    console.warn('[engagement-sheets] Sincronización pendiente:', error?.message || error);
    try {
      await queueEngagementSheetSync(env, event, error, deps);
    } catch (queueError) {
      console.error('[engagement-sheets] No se pudo encolar el reintento:', queueError?.message || queueError);
    }
    return false;
  }
  try {
    await discardOlderQueuedSnapshot(env, event, startedAt, deps);
  } catch (error) {
    console.warn('[engagement-sheets] No se pudo revisar la cola de reintentos:', error?.message || error);
  }
  return true;
}

async function claimQueueItem(env, document, item, deps) {
  const claimId = crypto.randomUUID();
  const now = new Date();
  try {
    const result = await deps.firestoreAdminCommit(env, [{
      path: `${QUEUE_COLLECTION}/${item.id}`,
      fields: encodeFirestoreFields({ claimedAt: now, claimedBy: claimId, updatedAt: now }),
      mergeFields: ['claimedAt', 'claimedBy', 'updatedAt'],
      currentDocument: { updateTime: document.updateTime },
    }]);
    const updateTime = result?.writeResults?.[0]?.updateTime;
    // Sin la versión del reclamo no se puede proteger la escritura final; el
    // reclamo vence solo en CLAIM_STALE_MS y otra corrida lo retoma.
    if (!updateTime) return null;
    return { ...item, claimedBy: claimId, updateTime };
  } catch (error) {
    if (error?.code === 'version_conflict') return null;
    throw error;
  }
}

function isEligible(item, now) {
  if (!item || (item.status !== 'pending' && item.status !== 'dead_letter') || !item.eventJson) return false;
  if (item.claimedAt && !isStale(item.claimedAt)) return false;
  const nextAt = Date.parse(item.nextAttemptAt || '');
  return !(Number.isFinite(nextAt) && nextAt > now);
}

async function notifyDeadLetter(env, item, error, deps) {
  // Un fallo de Apps Script afecta a todos los registros a la vez: un aviso
  // por día alcanza para que el admin lo vea sin inundar el panel.
  const day = new Date().toISOString().slice(0, 10);
  try {
    await deps.notifyAdminIfAbsent(env, {
      kind: 'engagement_sheet_sync_dead_letter',
      actorType: 'system',
      title: 'Reseñas y "me gusta" no llegan a Google Sheets',
      body: `Un registro de participación (${item.type}) no se pudo copiar a Sheets tras ${item.attempts} intentos: ${clean(error?.message || error, 200)}. Firestore conserva el dato y la cola lo sigue reintentando cada 6 horas.`,
      targetUrl: '/admin.html#section-diagnostico',
      sourceType: 'engagementSheetSyncQueue',
      sourceId: item.id,
    }, `engagement-sheet-sync-dead-letter:${day}`);
  } catch (notifyError) {
    console.error('[engagement-sheets] No se pudo crear el aviso de cola bloqueada:', notifyError?.message || notifyError);
  }
}

/**
 * Drenaje programado (mismo endpoint OIDC que el catálogo). Procesa las
 * tareas más antiguas primero y corta la corrida en el primer fallo: si
 * Apps Script no responde, el resto fallaría igual y solo gastaría tiempo y
 * subsolicitudes del Worker.
 */
export async function drainEngagementSheetSyncQueueScheduled(env, { limit = 3, deps = REAL_DEPS } = {}) {
  const now = Date.now();
  const documents = await deps.firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING);
  const eligible = documents
    .map(document => ({ document, item: decoded(document) }))
    .filter(({ item }) => isEligible(item, now))
    .sort((a, b) => (Date.parse(a.item.createdAt || '') || 0) - (Date.parse(b.item.createdAt || '') || 0))
    .slice(0, Math.max(1, Math.min(10, Number(limit) || 3)));

  let checked = 0;
  let drained = 0;
  let deadLettered = 0;
  let lastError = '';
  for (const { document, item } of eligible) {
    const claimed = await claimQueueItem(env, document, item, deps);
    if (!claimed) continue;
    checked += 1;
    let event = null;
    try {
      event = JSON.parse(claimed.eventJson);
    } catch {
      event = null;
    }
    try {
      if (!isEngagementEvent(event)) throw new Error('Evento guardado ilegible.');
      await postEngagementEvent(env, event, deps.fetchImpl);
      // Si mientras tanto entró una instantánea más nueva, el documento cambió
      // y la precondición falla: la nueva queda para la próxima corrida.
      if (await commitIfUnchanged(env, claimed.id, claimed.updateTime, { delete: true }, deps)) drained += 1;
    } catch (error) {
      lastError = clean(error?.message || error);
      const attempts = Number(claimed.attempts || 0) + 1;
      const toDeadLetter = attempts >= MAX_QUEUE_ATTEMPTS;
      const fields = {
        status: toDeadLetter ? 'dead_letter' : 'pending',
        attempts,
        lastError,
        nextAttemptAt: new Date(Date.now() + (toDeadLetter ? DEAD_LETTER_RETRY_MS : QUEUE_BACKOFF_MS * Math.min(attempts, 6))),
        claimedAt: null,
        claimedBy: '',
        updatedAt: new Date(),
      };
      const updated = await commitIfUnchanged(env, claimed.id, claimed.updateTime, {
        fields: encodeFirestoreFields(fields),
        mergeFields: Object.keys(fields),
      }, deps);
      if (updated && toDeadLetter && claimed.status !== 'dead_letter') {
        deadLettered += 1;
        await notifyDeadLetter(env, { ...claimed, attempts }, error, deps);
      }
      break;
    }
  }

  const finishedAt = new Date();
  const metaFields = {
    lastRunAt: fsTimestamp(finishedAt),
    lastDrained: fsInteger(drained),
    lastDeadLettered: fsInteger(deadLettered),
  };
  if (drained > 0) metaFields.lastSuccessAt = fsTimestamp(finishedAt);
  if (lastError) metaFields.lastError = fsString(lastError);
  try {
    await deps.firestoreAdminMerge(env, QUEUE_META_PATH, metaFields);
  } catch (error) {
    console.error('[engagement-sheets] No se pudo actualizar syncMeta:', error?.message || error);
  }

  return { checked, drained, deadLettered, remaining: Math.max(0, eligible.length - drained) };
}

/** Métrica de solo lectura para el panel de Diagnóstico (Estado del ecosistema). */
export async function getEngagementSheetSyncQueueStatus(env, deps = REAL_DEPS) {
  const documents = await deps.firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING);
  const items = documents.map(decoded).filter(Boolean);
  const pending = items.filter(item => item.status === 'pending');
  const deadLetter = items.filter(item => item.status === 'dead_letter');
  const oldestAt = [...pending, ...deadLetter].reduce((oldest, item) => {
    const at = Date.parse(item.createdAt || '');
    if (!Number.isFinite(at)) return oldest;
    return oldest === null ? at : Math.min(oldest, at);
  }, null);
  const metaDoc = await deps.firestoreAdminGet(env, QUEUE_META_PATH).catch(() => null);
  const meta = metaDoc ? decodeFirestoreFields(metaDoc.fields || {}) : {};
  return {
    pendingCount: pending.length,
    deadLetterCount: deadLetter.length,
    oldestPendingAgeMs: oldestAt === null ? null : Math.max(0, Date.now() - oldestAt),
    lastRunAt: meta.lastRunAt || '',
    lastSuccessAt: meta.lastSuccessAt || '',
    lastError: meta.lastError || '',
  };
}
