import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin } from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminDelete,
  firestoreAdminGet,
  firestoreAdminList,
  firestoreAdminReplace,
  fsInteger,
  fsString,
  fsTimestamp,
} from '../../cloudflare/firebase-admin-ligero.js';
import {
  isRestorableVisualHistory,
  requireVisualPageId,
  sanitizeVisualConfig,
  sanitizeVisualContent,
  sanitizeVisualDraft,
  VISUAL_BUILDER_LIMITS,
} from '../../cloudflare/visual-builder-core.js';

const jsonField = value => fsString(JSON.stringify(value));
const safeJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const eventId = () => `visual-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 10)}`;

function decodeState(doc, pageId) {
  const data = decodeFirestoreFields(doc?.fields || {});
  return {
    pageId,
    version: Number(data.version || 0),
    config: sanitizeVisualConfig(pageId, safeJson(data.configJson, {})),
    updatedAt: data.updatedAt || '',
    updatedBy: data.updatedBy || '',
    precondition: doc?.updateTime ? { updateTime: doc.updateTime } : { exists: false },
  };
}

function decodeDraft(doc, pageId) {
  if (!doc) return null;
  const data = decodeFirestoreFields(doc.fields || {});
  return {
    pageId,
    basedOnVersion: Number(data.basedOnVersion || 0),
    basedOnContentRevision: String(data.basedOnContentRevision || ''),
    config: sanitizeVisualConfig(pageId, safeJson(data.configJson, {})),
    content: sanitizeVisualContent(pageId, safeJson(data.contentJson, {})),
    updatedAt: data.updatedAt || '',
    updatedBy: data.updatedBy || '',
  };
}

function decodeHistory(doc) {
  const data = decodeFirestoreFields(doc?.fields || {});
  return { ...data, version: Number(data.version || 0), snapshot: safeJson(data.snapshotJson, null), snapshotJson: undefined };
}

async function parseBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > VISUAL_BUILDER_LIMITS.bodyBytes) throw Object.assign(new Error('Solicitud demasiado grande.'), { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > VISUAL_BUILDER_LIMITS.bodyBytes) throw Object.assign(new Error('Solicitud demasiado grande.'), { status: 413 });
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Solicitud inválida.'); }
}

async function loadPage(env, pageId) {
  const [stateDoc, draftDoc, contentDoc, historyDocs] = await Promise.all([
    firestoreAdminGet(env, `visualBuilderPages/${pageId}`),
    firestoreAdminGet(env, `visualBuilderDrafts/${pageId}`),
    firestoreAdminGet(env, `site_content/${pageId}`),
    firestoreAdminList(env, 'visualBuilderHistory', VISUAL_BUILDER_LIMITS.maxHistory),
  ]);
  const state = decodeState(stateDoc, pageId);
  const content = sanitizeVisualContent(pageId, contentDoc ? decodeFirestoreFields(contentDoc.fields) : {});
  const history = historyDocs.map(decodeHistory)
    .filter(item => item.pageId === pageId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, VISUAL_BUILDER_LIMITS.maxHistory);
  delete state.precondition;
  return { state, draft: decodeDraft(draftDoc, pageId), content, contentRevision: String(contentDoc?.updateTime || ''), history };
}

function documentPrecondition(doc) {
  return doc?.updateTime ? { updateTime: doc.updateTime } : { exists: false };
}

function versionConflict(origin, requestUrl) {
  return jsonResponse({ ok: false, code: 'version_conflict', error: 'La página cambió en otra sesión. Recargá antes de publicar.' }, 409, origin, requestUrl);
}

function publishedContentFields(contentDoc, content, version, user) {
  const current = decodeFirestoreFields(contentDoc?.fields || {});
  return encodeFirestoreFields({
    ...content,
    _meta: {
      revision: Math.max(0, Number(current?._meta?.revision || 0)) + 1,
      updatedAt: new Date(),
      updatedBy: user.email,
      lastSection: 'visual-builder',
    },
    _version: version,
  });
}

function historyFields(id, user, pageId, action, version, snapshot, result) {
  return {
    id: fsString(id), pageId: fsString(pageId), action: fsString(action), version: fsInteger(version),
    actorUid: fsString(user.uid), actorEmail: fsString(user.email), createdAt: fsTimestamp(new Date()),
    result: fsString(result), snapshotJson: jsonField(snapshot),
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!originIsAllowed(origin, requestUrl)) return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, POST, OPTIONS');

  try {
    const user = await requireSuperAdmin(request);
    if (request.method === 'GET') {
      const pageId = requireVisualPageId(new URL(request.url).searchParams.get('page'));
      return jsonResponse({ ok: true, ...(await loadPage(env, pageId)) }, 200, origin, requestUrl);
    }
    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);

    const body = await parseBody(request);
    const action = String(body.action || 'save');
    const pageId = requireVisualPageId(body.pageId);

    if (action === 'save') {
      const draft = sanitizeVisualDraft(pageId, body.config, body.content);
      const [stateDoc, contentDoc] = await Promise.all([
        firestoreAdminGet(env, `visualBuilderPages/${pageId}`),
        firestoreAdminGet(env, `site_content/${pageId}`),
      ]);
      const current = decodeState(stateDoc, pageId);
      await firestoreAdminReplace(env, `visualBuilderDrafts/${pageId}`, {
        pageId: fsString(pageId), basedOnVersion: fsInteger(current.version),
        basedOnContentRevision: fsString(String(contentDoc?.updateTime || '')),
        configJson: jsonField(draft.config), contentJson: jsonField(draft.content),
        updatedAt: fsTimestamp(new Date()), updatedBy: fsString(user.email),
      });
      return jsonResponse({ ok: true, draft: { ...draft, basedOnVersion: current.version, basedOnContentRevision: String(contentDoc?.updateTime || '') } }, 200, origin, requestUrl);
    }

    if (action === 'cancel') {
      await firestoreAdminDelete(env, `visualBuilderDrafts/${pageId}`);
      return jsonResponse({ ok: true, ...(await loadPage(env, pageId)) }, 200, origin, requestUrl);
    }

    if (action === 'publish') {
      const draft = sanitizeVisualDraft(pageId, body.config, body.content);
      const [stateDoc, contentDoc] = await Promise.all([
        firestoreAdminGet(env, `visualBuilderPages/${pageId}`),
        firestoreAdminGet(env, `site_content/${pageId}`),
      ]);
      const current = decodeState(stateDoc, pageId);
      if (Number(body.expectedVersion) !== current.version || String(body.expectedContentRevision || '') !== String(contentDoc?.updateTime || '')) return versionConflict(origin, requestUrl);
      const version = current.version + 1;
      const snapshot = { config: draft.config, content: draft.content };
      const id = eventId();
      await firestoreAdminCommit(env, [
        { path: `visualBuilderPages/${pageId}`, currentDocument: current.precondition, fields: {
          pageId: fsString(pageId), version: fsInteger(version), configJson: jsonField(draft.config),
          updatedAt: fsTimestamp(new Date()), updatedBy: fsString(user.email),
        } },
        { path: `site_content/${pageId}`, currentDocument: documentPrecondition(contentDoc), fields: publishedContentFields(contentDoc, draft.content, version, user) },
        { path: `visualBuilderHistory/${id}`, currentDocument: { exists: false }, fields: historyFields(id, user, pageId, 'publish', version, snapshot, 'Publicado') },
        { path: `visualBuilderDrafts/${pageId}`, delete: true },
      ]);
      return jsonResponse({ ok: true, version, config: draft.config, content: draft.content }, 200, origin, requestUrl);
    }

    if (action === 'restore') {
      const id = String(body.historyId || '').trim();
      if (!/^visual-[a-z0-9-]{12,80}$/i.test(id)) throw new Error('La versión no existe.');
      const previousDoc = await firestoreAdminGet(env, `visualBuilderHistory/${id}`);
      const previous = previousDoc ? decodeHistory(previousDoc) : null;
      if (!isRestorableVisualHistory(previous, pageId)) throw new Error('La versión no existe.');
      const clean = sanitizeVisualDraft(pageId, previous.snapshot.config, previous.snapshot.content);
      const [stateDoc, contentDoc] = await Promise.all([
        firestoreAdminGet(env, `visualBuilderPages/${pageId}`),
        firestoreAdminGet(env, `site_content/${pageId}`),
      ]);
      const current = decodeState(stateDoc, pageId);
      if (Number(body.expectedVersion) !== current.version || String(body.expectedContentRevision || '') !== String(contentDoc?.updateTime || '')) return versionConflict(origin, requestUrl);
      const version = current.version + 1;
      const restoredId = eventId();
      const snapshot = { config: clean.config, content: clean.content };
      await firestoreAdminCommit(env, [
        { path: `visualBuilderPages/${pageId}`, currentDocument: current.precondition, fields: {
          pageId: fsString(pageId), version: fsInteger(version), configJson: jsonField(clean.config),
          updatedAt: fsTimestamp(new Date()), updatedBy: fsString(user.email), restoredFrom: fsString(id),
        } },
        { path: `site_content/${pageId}`, currentDocument: documentPrecondition(contentDoc), fields: publishedContentFields(contentDoc, clean.content, version, user) },
        { path: `visualBuilderHistory/${restoredId}`, currentDocument: { exists: false }, fields: historyFields(restoredId, user, pageId, 'restore', version, snapshot, `Restaurada desde v${previous.version}`) },
        { path: `visualBuilderDrafts/${pageId}`, delete: true },
      ]);
      return jsonResponse({ ok: true, version, config: clean.config, content: clean.content }, 200, origin, requestUrl);
    }

    throw new Error('Acción no permitida.');
  } catch (error) {
    console.error(JSON.stringify({ message: 'visual-builder request failed', error: error?.message || String(error), path: new URL(request.url).pathname }));
    if (error?.code === 'version_conflict') return versionConflict(origin, requestUrl);
    const status = Number(error?.status) || (/Super Admin|sesi[oó]n|autenticaci/i.test(String(error?.message)) ? 403 : 400);
    const allowed = /^(La página|La versión|Solicitud|Acción)/.test(String(error?.message || ''));
    return jsonResponse({ ok: false, error: allowed ? error.message : 'No se pudo completar la operación.' }, status, origin, requestUrl);
  }
}
