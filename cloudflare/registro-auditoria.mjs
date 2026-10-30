import { firestoreAdminGet, firestoreAdminCommit, encodeFirestoreFields, decodeFirestoreFields } from './firebase-admin-ligero.js';
import { requireOrderStaff, originIsAllowed, jsonResponse, preflightResponse, statusFromError, rateLimitErrorResponse } from './seguridad-cloudinary.js';
import { readLimitedJson } from '../functions/lib/operational-guard.js';

const MAX_COUNT = 1000000;
const invalid = () => Object.assign(new Error('Registro de auditoría inválido.'), { status: 422 });
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw invalid();
  return value;
}
function historyEntry(value) {
  const keys = ['productId', 'priceBefore', 'priceAfter', 'stockBefore', 'stockAfter'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw invalid();
  const result = { productId: text(value.productId, 220, true) };
  for (const key of keys.slice(1)) {
    if (!Object.hasOwn(value, key)) continue;
    const amount = value[key];
    // Conserva números legacy de Firestore guardados como texto; nunca HTML ni objetos.
    if (amount !== null && !(typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) &&
        !(typeof amount === 'string' && amount.length <= 40 && /^\d+(?:\.\d+)?$/.test(amount))) throw invalid();
    result[key] = amount;
  }
  return result;
}

// Único reemplazo de los dos escritores SDK. Las escrituras transaccionales
// comerciales del servidor conservan su historial y sus precondiciones.
export async function appendAuditEntry(env, input, actor, { get = firestoreAdminGet, commit = firestoreAdminCommit, now = () => new Date() } = {}) {
  if (!actor?.uid || !actor.email || !['superadmin', 'admin', 'agent'].includes(actor.role)) {
    throw Object.assign(new Error('Acceso denegado.'), { status: 403 });
  }
  const keys = ['action', 'targetType', 'targetId', 'targetLabel', 'details', 'bulk', 'bulkCount', 'productHistory'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) throw invalid();
  const entry = {
    action: text(input.action, 100, true), targetType: text(input.targetType, 100, true),
    targetId: text(input.targetId ?? '', 220), targetLabel: text(input.targetLabel ?? '', 2000),
    details: text(input.details ?? '', 16000), bulk: input.bulk ?? false, bulkCount: input.bulkCount ?? 0,
    actorId: actor.uid, actorEmail: actor.email, actorRole: actor.role, createdAt: now(),
  };
  if (typeof entry.bulk !== 'boolean' || !Number.isSafeInteger(entry.bulkCount) || entry.bulkCount < 0 || entry.bulkCount > MAX_COUNT || (!entry.bulk && entry.bulkCount !== 0)) throw invalid();
  if (input.productHistory !== undefined) {
    if (Array.isArray(input.productHistory)) {
      if (input.productHistory.length > 500) throw invalid();
      entry.productHistory = input.productHistory.map(historyEntry);
    } else entry.productHistory = historyEntry(input.productHistory);
  }
  if (actor.role !== 'superadmin') {
    const document = await get(env, 'settings/storeGate');
    const gate = document ? decodeFirestoreFields(document.fields || {}) : null;
    if (gate && gate.storeOpen !== true && gate.maintenanceAccess?.[actor.role] !== true) {
      throw Object.assign(new Error('La tienda está cerrada para este rol.'), { status: 403 });
    }
  }
  const id = `client_${crypto.randomUUID().replaceAll('-', '')}`;
  await commit(env, [{ path: `auditLog/${id}`, fields: encodeFirestoreFields(entry), currentDocument: { exists: false } }]);
  return { id };
}

export async function handleAuditRequest(context, { authenticate = requireOrderStaff, append = appendAuditEntry, input: providedInput } = {}) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!origin || !originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url);
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, request.url);
  try {
    const actor = await authenticate(request, env);
    let input = providedInput;
    try {
      if (input === undefined) input = await readLimitedJson(request, 256 * 1024);
      else if (new TextEncoder().encode(JSON.stringify(input)).length > 256 * 1024) throw Object.assign(invalid(), { status: 413 });
    } catch (error) {
      if (error.status === 413) throw error;
      throw invalid();
    }
    const result = await append(env, input, actor);
    return jsonResponse({ ok: true, result }, 200, origin, request.url);
  } catch (error) {
    return rateLimitErrorResponse(error, origin, request.url) || jsonResponse({ ok: false, error: 'No se pudo registrar la auditoría.' }, statusFromError(error, 500), origin, request.url);
  }
}
