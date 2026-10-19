import { firestoreAdminGet, decodeFirestoreFields, encodeFirestoreFields } from './firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from './firestore-admin-batch.js';
import { RESETTABLE_STATISTICS, statisticsTodayStart } from '../js/admin/statistics/modelo-reinicios.mjs';

export async function resetStatistics(env, input, actor, { get = firestoreAdminGet, commit = firestoreAdminBatchCommit, now = () => new Date() } = {}) {
  if (actor?.role !== 'superadmin') throw Object.assign(new Error('Acción exclusiva de Super Admin.'), { status: 403 });
  if (!Array.isArray(input.metrics) || !input.metrics.length || input.metrics.length > Object.keys(RESETTABLE_STATISTICS).length ||
      new Set(input.metrics).size !== input.metrics.length || input.metrics.some(key => !Object.hasOwn(RESETTABLE_STATISTICS, key)) ||
      !/^[A-Za-z0-9_-]{6,120}$/.test(input.changeId || '') || !['reset', 'today', 'history'].includes(input.mode || 'reset')) throw new Error('Selección de estadísticas inválida.');
  const path = 'settings/statisticsResets';
  const document = await get(env, path);
  const previous = document ? decodeFirestoreFields(document.fields || {}) : {};
  if (previous.lastChangeId === input.changeId) return previous;
  if (typeof input.baseChangeId !== 'string' || input.baseChangeId !== (previous.lastChangeId || '')) {
    throw Object.assign(new Error('Las estadísticas cambiaron en otra sesión. Actualizá antes de reiniciar.'), { status: 409 });
  }
  const timestamp = now();
  // statisticsSince uses an exclusive cutoff: include an order at exactly midnight.
  const cutoff = input.mode === 'today' ? new Date(statisticsTodayStart(timestamp).getTime() - 1) : timestamp;
  const resets = { ...(previous.resets || {}) };
  for (const metric of input.metrics) {
    if (input.mode === 'history') delete resets[metric];
    else resets[metric] = cutoff;
  }
  const result = { resets, updatedAt: timestamp, updatedBy: actor.email, lastChangeId: input.changeId };
  await commit(env, [
    { path, fields: encodeFirestoreFields(result), currentDocument: document?.updateTime ? { updateTime: document.updateTime } : { exists: Boolean(document) } },
    { path: `auditLog/${input.changeId}`, fields: encodeFirestoreFields({ action: 'reiniciar_estadisticas', actorEmail: actor.email,
      actorId: actor.uid, actorRole: 'superadmin', metrics: input.metrics, mode: input.mode || 'reset', before: previous.resets || {}, timestamp, createdAt: timestamp,
      result: 'success' }), currentDocument: { exists: false } },
    { path: 'settings/siteRevision', fields: encodeFirestoreFields({ revision: input.changeId, updatedAt: timestamp }), mergeFields: ['revision', 'updatedAt'] },
  ]);
  return result;
}
