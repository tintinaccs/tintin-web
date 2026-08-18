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
const requestId = () => `vb-${crypto.randomUUID().slice(0, 10)}`;
const DEFAULT_ACCESS = Object.freeze({ get: firestoreAdminGet, list: firestoreAdminList });

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

/**
 * Carga el estado crítico del editor y trata el historial como un complemento.
 * Si solamente falla visualBuilderHistory, la página sigue siendo editable y
 * el cliente recibe una advertencia; un fallo del historial nunca debe tumbar
 * Contenido/Diseño completo.
 *
 * `access` se inyecta únicamente en tests para ejecutar este contrato sin una
 * cuenta de servicio real.
 */
export async function loadPage(env, pageId, { access = DEFAULT_ACCESS, requestId: ref = '' } = {}) {
  const [stateDoc, draftDoc, contentDoc] = await Promise.all([
    access.get(env, `visualBuilderPages/${pageId}`),
    access.get(env, `visualBuilderDrafts/${pageId}`),
    access.get(env, `site_content/${pageId}`),
  ]);

  const warnings = [];
  let historyDocs = [];
  try {
    historyDocs = await access.list(env, 'visualBuilderHistory', VISUAL_BUILDER_LIMITS.maxHistory);
  } catch (error) {
    warnings.push({ code: 'history_unavailable', message: 'El historial no está disponible temporalmente.' });
    console.warn(JSON.stringify({
      message: 'visual-builder history unavailable; editor continues without history',
      detail: error?.message || String(error),
      pageId,
      requestId: ref || undefined,
    }));
  }

  const state = decodeState(stateDoc, pageId);
  const content = sanitizeVisualContent(pageId, contentDoc ? decodeFirestoreFields(contentDoc.fields) : {});
  const history = historyDocs.map(decodeHistory)
    .filter(item => item.pageId === pageId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, VISUAL_BUILDER_LIMITS.maxHistory);
  delete state.precondition;
  return {
    state,
    draft: decodeDraft(draftDoc, pageId),
    content,
    contentRevision: String(contentDoc?.updateTime || ''),
    history,
    warnings,
  };
}

function documentPrecondition(doc) {
  return doc?.updateTime ? { updateTime: doc.updateTime } : { exists: false };
}

function versionConflict(origin, requestUrl, ref = '') {
  return jsonResponse({
    ok: false,
    code: 'version_conflict',
    error: 'La página cambió en otra sesión. Recargá antes de publicar.',
    requestId: ref || undefined,
  }, 409, origin, requestUrl);
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

export function classifyVisualBuilderError(error) {
  const message = String(error?.message || error || '');
  const explicitStatus = Number(error?.status) || 0;

  if (error?.code === 'version_conflict' || explicitStatus === 409) {
    return { status: 409, code: 'version_conflict', message: 'La página cambió en otra sesión. Recargá antes de publicar.' };
  }
  if (explicitStatus === 413 || /Solicitud demasiado grande/i.test(message)) {
    return { status: 413, code: 'request_too_large', message: 'La solicitud del editor es demasiado grande.' };
  }
  if (/Falta la autenticación|sesi[oó]n venc/i.test(message)) {
    return { status: 401, code: 'authentication_required', message: 'Tu sesión venció o no está disponible. Volvé a iniciar sesión.' };
  }
  if (/Super Admin|correo verificado|cuenta debe tener/i.test(message)) {
    return { status: 403, code: 'forbidden', message: 'La cuenta actual no tiene acceso de Super Admin.' };
  }
  if (
    /FIREBASE_SERVICE_ACCOUNT_KEY|autenticar la cuenta de servicio|Firestore\s+(?:GET|LIST|PATCH|DELETE|COMMIT|RUN QUERY)|fetch failed|network|timeout|ECONN|ENOTFOUND|EAI_AGAIN/i.test(message)
    || /^firestore_/i.test(String(error?.code || ''))
    || explicitStatus >= 500
  ) {
    return {
      status: explicitStatus >= 500 ? explicitStatus : 503,
      code: error?.code && /^firestore_/i.test(String(error.code)) ? String(error.code) : 'backend_unavailable',
      message: 'El backend del editor no está disponible. Revisá el estado del Admin y volvé a intentar.',
    };
  }
  if (/^(La página|La versión|Solicitud|Acción)/.test(message)) {
    return { status: explicitStatus || 400, code: 'invalid_request', message };
  }
  return { status: explicitStatus >= 400 ? explicitStatus : 500, code: 'visual_builder_internal', message: 'El editor encontró un error interno.' };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  const ref = requestId();

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, code: 'origin_forbidden', error: 'Origen no permitido.', requestId: ref }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, POST, OPTIONS');

  try {
    const user = await requireSuperAdmin(request);
    if (request.method === 'GET') {
      const pageId = requireVisualPageId(new URL(request.url).searchParams.get('page'));
      return jsonResponse({ ok: true, ...(await loadPage(env, pageId, { requestId: ref })), requestId: ref }, 200, origin, requestUrl);
    }
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, code: 'method_not_allowed', error: 'Método no permitido.', requestId: ref }, 405, origin, requestUrl);
    }

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
      return jsonResponse({
        ok: true,
        draft: { ...draft, basedOnVersion: current.version, basedOnContentRevision: String(contentDoc?.updateTime || '') },
        requestId: ref,
      }, 200, origin, requestUrl);
    }

    if (action === 'cancel') {
      await firestoreAdminDelete(env, `visualBuilderDrafts/${pageId}`);
      return jsonResponse({ ok: true, ...(await loadPage(env, pageId, { requestId: ref })), requestId: ref }, 200, origin, requestUrl);
    }

    if (action === 'publish') {
      const draft = sanitizeVisualDraft(pageId, body.config, body.content);
      const [stateDoc, contentDoc] = await Promise.all([
        firestoreAdminGet(env, `visualBuilderPages/${pageId}`),
        firestoreAdminGet(env, `site_content/${pageId}`),
      ]);
      const current = decodeState(stateDoc, pageId);
      if (Number(body.expectedVersion) !== current.version || String(body.expectedContentRevision || '') !== String(contentDoc?.updateTime || '')) {
        return versionConflict(origin, requestUrl, ref);
      }
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
      return jsonResponse({ ok: true, version, config: draft.config, content: draft.content, requestId: ref }, 200, origin, requestUrl);
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
      if (Number(body.expectedVersion) !== current.version || String(body.expectedContentRevision || '') !== String(contentDoc?.updateTime || '')) {
        return versionConflict(origin, requestUrl, ref);
      }
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
      return jsonResponse({ ok: true, version, config: clean.config, content: clean.content, requestId: ref }, 200, origin, requestUrl);
    }

    throw new Error('Acción no permitida.');
  } catch (error) {
    const classified = classifyVisualBuilderError(error);
    console.error(JSON.stringify({
      message: 'visual-builder request failed',
      code: classified.code,
      detail: error?.message || String(error),
      path: new URL(request.url).pathname,
      requestId: ref,
    }));
    if (classified.code === 'version_conflict') return versionConflict(origin, requestUrl, ref);
    return jsonResponse({
      ok: false,
      code: classified.code,
      error: `${classified.message} Ref. ${ref}`,
      requestId: ref,
    }, classified.status, origin, requestUrl);
  }
}
