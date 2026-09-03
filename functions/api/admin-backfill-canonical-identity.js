import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  encodeFirestoreFields,
  getGoogleAccessToken,
  parseServiceAccount,
} from '../../cloudflare/firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from '../../cloudflare/firestore-admin-batch.js';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const PAGE_SIZE = 200;
const MAX_DOCUMENTS_PER_COLLECTION = 5000;
const BATCH_SIZE = 80;
const SAFE_ID = /^[A-Za-z0-9_-]{1,220}$/;

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

function documentId(document) {
  const name = clean(document?.name, 1200);
  return name.split('/').pop() || '';
}

function precondition(document) {
  return document?.updateTime ? { updateTime: document.updateTime } : { exists: true };
}

async function listCollection(env, collectionId) {
  if (!SAFE_ID.test(collectionId)) throw new Error('Colección inválida.');
  const sa = parseServiceAccount(env);
  const token = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${collectionId}`;
  const documents = [];
  let pageToken = '';

  do {
    const url = new URL(base);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    url.searchParams.set('orderBy', '__name__');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`No se pudo listar ${collectionId}: ${data?.error?.message || response.status}`);
    }
    documents.push(...(Array.isArray(data.documents) ? data.documents : []));
    if (documents.length > MAX_DOCUMENTS_PER_COLLECTION) {
      throw new Error(`La colección ${collectionId} supera el límite seguro de la migración.`);
    }
    pageToken = clean(data.nextPageToken, 2000);
  } while (pageToken);

  return documents;
}

function analyzeUsers(documents) {
  const candidates = [];
  const conflicts = [];
  let alreadyCanonical = 0;

  for (const document of documents) {
    const uid = documentId(document);
    if (!SAFE_ID.test(uid)) continue;
    const data = decodeFields(document.fields || {});
    const expected = `CUS_${uid}`;
    const existing = clean(data.customerId, 180);

    if (existing === expected) {
      alreadyCanonical += 1;
      continue;
    }
    if (existing) {
      conflicts.push({ type: 'user', id: uid, existing, expected });
      continue;
    }
    candidates.push({
      type: 'user',
      id: uid,
      expected,
      write: {
        path: `users/${uid}`,
        fields: encodeFirestoreFields({ customerId: expected }),
        mergeFields: ['customerId'],
        currentDocument: precondition(document),
      },
    });
  }

  return { candidates, conflicts, alreadyCanonical };
}

function analyzeOrders(documents) {
  const candidates = [];
  const conflicts = [];
  let alreadyCanonical = 0;
  let withoutUserId = 0;

  for (const document of documents) {
    const orderId = documentId(document);
    if (!SAFE_ID.test(orderId)) continue;
    const data = decodeFields(document.fields || {});
    const uid = clean(data.userId, 128);
    if (!uid) {
      withoutUserId += 1;
      continue;
    }
    if (!SAFE_ID.test(uid)) {
      conflicts.push({ type: 'order', id: orderId, existing: clean(data.customerId, 180), expected: 'invalid_user_id' });
      continue;
    }

    const expected = `CUS_${uid}`;
    const existing = clean(data.customerId, 180);
    if (existing === expected) {
      alreadyCanonical += 1;
      continue;
    }
    if (existing) {
      conflicts.push({ type: 'order', id: orderId, existing, expected });
      continue;
    }
    candidates.push({
      type: 'order',
      id: orderId,
      expected,
      write: {
        path: `orders/${orderId}`,
        fields: encodeFirestoreFields({ customerId: expected }),
        mergeFields: ['customerId'],
        currentDocument: precondition(document),
      },
    });
  }

  return { candidates, conflicts, alreadyCanonical, withoutUserId };
}

async function commitInChunks(env, candidates) {
  let applied = 0;
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const chunk = candidates.slice(offset, offset + BATCH_SIZE);
    await firestoreAdminBatchCommit(env, chunk.map(candidate => candidate.write));
    applied += chunk.length;
  }
  return applied;
}

async function appendAudit(env, actor, summary) {
  const eventId = `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
  const now = new Date();
  await firestoreAdminBatchCommit(env, [{
    path: `auditLog/${eventId}`,
    fields: encodeFirestoreFields({
      eventId,
      timestamp: now,
      createdAt: now,
      actorId: clean(actor?.uid, 128),
      actorEmail: clean(actor?.email, 254).toLowerCase(),
      actorRole: 'superadmin',
      action: 'backfill_identidad_canonica',
      entityType: 'system',
      entityId: 'canonical-identity',
      origin: 'superadmin',
      result: 'success',
      after: summary,
    }),
    currentDocument: { exists: false },
  }]);
  return eventId;
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestUrl = request.url;
  const origin = request.headers.get('origin') || '';

  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);

  try {
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (raw && new TextEncoder().encode(raw).byteLength > 8 * 1024) throw new Error('Solicitud inválida.');
    const body = raw ? JSON.parse(raw) : {};
    const apply = body?.apply === true;

    const [userDocuments, orderDocuments] = await Promise.all([
      listCollection(env, 'users'),
      listCollection(env, 'orders'),
    ]);
    const users = analyzeUsers(userDocuments);
    const orders = analyzeOrders(orderDocuments);
    const conflicts = [...users.conflicts, ...orders.conflicts];
    const candidates = [...users.candidates, ...orders.candidates];

    const summary = {
      mode: apply ? 'apply' : 'dry-run',
      usersScanned: userDocuments.length,
      ordersScanned: orderDocuments.length,
      usersAlreadyCanonical: users.alreadyCanonical,
      ordersAlreadyCanonical: orders.alreadyCanonical,
      usersToRepair: users.candidates.length,
      ordersToRepair: orders.candidates.length,
      ordersWithoutUserId: orders.withoutUserId,
      conflicts: conflicts.length,
    };

    if (!apply) {
      return jsonResponse({
        ok: true,
        applied: false,
        summary,
        conflicts: conflicts.slice(0, 50),
        sample: candidates.slice(0, 50).map(({ type, id, expected }) => ({ type, id, expected })),
      }, 200, origin, requestUrl);
    }

    if (conflicts.length) {
      return jsonResponse({
        ok: false,
        error: 'identity_conflicts',
        summary,
        conflicts: conflicts.slice(0, 50),
      }, 409, origin, requestUrl);
    }

    const applied = await commitInChunks(env, candidates);
    const auditEventId = await appendAudit(env, actor, { ...summary, applied });
    return jsonResponse({
      ok: true,
      applied: true,
      appliedCount: applied,
      auditEventId,
      summary: { ...summary, applied },
    }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[admin-backfill-canonical-identity]', error?.code || '', error?.message || error);
    const status = statusFromError(error, 400);
    return jsonResponse({
      ok: false,
      error: clean(error?.message, 300) || 'No se pudo ejecutar la migración de identidad.',
    }, status, origin, requestUrl);
  }
}
