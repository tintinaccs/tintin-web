import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin } from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields, encodeFirestoreFields, firestoreAdminCommit, firestoreAdminDelete,
  firestoreAdminGet, firestoreAdminList, firestoreAdminReplace, fsInteger, fsString, fsTimestamp,
} from '../../cloudflare/firebase-admin-ligero.js';
import {
  GLOBAL_STUDIO_LIMITS, isRestorableGlobalHistory, sanitizeGlobalStudioConfig,
} from '../../cloudflare/visual-studio-global-core.js';

const STATE_PATH = 'visualStudioGlobal/state';
const DRAFT_PATH = 'visualStudioGlobalDraft/state';
const HISTORY_COLLECTION = 'visualStudioGlobalHistory';
const jsonField = value => fsString(JSON.stringify(value));
const safeJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const eventId = () => `global-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 10)}`;
const sameConfig = (a, b) => JSON.stringify(sanitizeGlobalStudioConfig(a)) === JSON.stringify(sanitizeGlobalStudioConfig(b));

function decodeState(doc) {
  const data = decodeFirestoreFields(doc?.fields || {});
  return {
    version: Number(data.version || 0),
    config: sanitizeGlobalStudioConfig(safeJson(data.configJson, {})),
    updatedAt: data.updatedAt || '', updatedBy: data.updatedBy || '',
    precondition: doc?.updateTime ? { updateTime: doc.updateTime } : { exists: false },
  };
}
function decodeDraft(doc) {
  if (!doc) return null;
  const data = decodeFirestoreFields(doc.fields || {});
  return {
    basedOnVersion: Number(data.basedOnVersion || 0),
    config: sanitizeGlobalStudioConfig(safeJson(data.configJson, {})),
    updatedAt: data.updatedAt || '', updatedBy: data.updatedBy || '',
  };
}
function decodeHistory(doc) {
  const data = decodeFirestoreFields(doc?.fields || {});
  return { ...data, version:Number(data.version || 0), snapshot:safeJson(data.snapshotJson, null), snapshotJson:undefined };
}
async function parseBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > GLOBAL_STUDIO_LIMITS.bodyBytes) throw Object.assign(new Error('Solicitud demasiado grande.'), { status:413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > GLOBAL_STUDIO_LIMITS.bodyBytes) throw Object.assign(new Error('Solicitud demasiado grande.'), { status:413 });
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Solicitud inválida.'); }
}
function historyFields(id, user, action, version, snapshot, result) {
  return { id:fsString(id), action:fsString(action), version:fsInteger(version), actorUid:fsString(user.uid), actorEmail:fsString(user.email), createdAt:fsTimestamp(new Date()), result:fsString(result), snapshotJson:jsonField(snapshot) };
}
async function loadAll(env) {
  const [stateDoc, draftDoc, historyDocs] = await Promise.all([
    firestoreAdminGet(env, STATE_PATH), firestoreAdminGet(env, DRAFT_PATH), firestoreAdminList(env, HISTORY_COLLECTION, GLOBAL_STUDIO_LIMITS.maxHistory),
  ]);
  const state = decodeState(stateDoc); delete state.precondition;
  const history = historyDocs.map(decodeHistory).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, GLOBAL_STUDIO_LIMITS.maxHistory);
  return { state, draft:decodeDraft(draftDoc), history };
}
function conflict(origin, requestUrl) {
  return jsonResponse({ ok:false, code:'version_conflict', error:'La configuración global cambió en otra sesión. Recargá antes de publicar.' }, 409, origin, requestUrl);
}

export async function onRequest(context) {
  const { request, env } = context; const origin=request.headers.get('origin') || ''; const requestUrl=request.url;
  if (!originIsAllowed(origin, requestUrl)) return jsonResponse({ok:false,error:'Origen no permitido.'},403,origin,requestUrl);
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, POST, OPTIONS');
  try {
    const user = await requireSuperAdmin(request);
    if (request.method === 'GET') return jsonResponse({ok:true,...(await loadAll(env))},200,origin,requestUrl);
    if (request.method !== 'POST') return jsonResponse({ok:false,error:'Método no permitido.'},405,origin,requestUrl);
    const body=await parseBody(request); const action=String(body.action || 'save');
    if (action === 'save') {
      const config=sanitizeGlobalStudioConfig(body.config); const stateDoc=await firestoreAdminGet(env,STATE_PATH); const current=decodeState(stateDoc);
      await firestoreAdminReplace(env,DRAFT_PATH,{ basedOnVersion:fsInteger(current.version), configJson:jsonField(config), updatedAt:fsTimestamp(new Date()), updatedBy:fsString(user.email) });
      return jsonResponse({ok:true,draft:{basedOnVersion:current.version,config}},200,origin,requestUrl);
    }
    if (action === 'save-layout') {
      const [stateDoc,draftDoc]=await Promise.all([firestoreAdminGet(env,STATE_PATH),firestoreAdminGet(env,DRAFT_PATH)]);
      const current=decodeState(stateDoc); const draft=decodeDraft(draftDoc); const base=draft?.config || current.config;
      const config=sanitizeGlobalStudioConfig({...base,layout:body.layout});
      await firestoreAdminReplace(env,DRAFT_PATH,{ basedOnVersion:fsInteger(current.version), configJson:jsonField(config), updatedAt:fsTimestamp(new Date()), updatedBy:fsString(user.email) });
      return jsonResponse({ok:true,draft:{basedOnVersion:current.version,config},layout:config.layout},200,origin,requestUrl);
    }
    if (action === 'discard-layout') {
      const [stateDoc,draftDoc]=await Promise.all([firestoreAdminGet(env,STATE_PATH),firestoreAdminGet(env,DRAFT_PATH)]);
      const current=decodeState(stateDoc); const draft=decodeDraft(draftDoc);
      if (!draft) return jsonResponse({ok:true,draft:null,layout:current.config.layout},200,origin,requestUrl);
      const config=sanitizeGlobalStudioConfig({...draft.config,layout:current.config.layout});
      if (sameConfig(config,current.config)) {
        await firestoreAdminDelete(env,DRAFT_PATH);
        return jsonResponse({ok:true,draft:null,layout:current.config.layout},200,origin,requestUrl);
      }
      await firestoreAdminReplace(env,DRAFT_PATH,{ basedOnVersion:fsInteger(current.version), configJson:jsonField(config), updatedAt:fsTimestamp(new Date()), updatedBy:fsString(user.email) });
      return jsonResponse({ok:true,draft:{basedOnVersion:current.version,config},layout:current.config.layout},200,origin,requestUrl);
    }
    if (action === 'cancel') {
      await firestoreAdminDelete(env,DRAFT_PATH); return jsonResponse({ok:true,...(await loadAll(env))},200,origin,requestUrl);
    }
    if (action === 'publish-layout') {
      const [stateDoc,draftDoc]=await Promise.all([firestoreAdminGet(env,STATE_PATH),firestoreAdminGet(env,DRAFT_PATH)]);
      const current=decodeState(stateDoc); const draft=decodeDraft(draftDoc);
      if (Number(body.expectedVersion) !== current.version) return conflict(origin,requestUrl);
      const config=sanitizeGlobalStudioConfig({...current.config,layout:body.layout});
      const version=current.version+1; const id=eventId(); const snapshot={config};
      const writes=[
        { path:STATE_PATH,currentDocument:current.precondition,fields:{version:fsInteger(version),configJson:jsonField(config),updatedAt:fsTimestamp(new Date()),updatedBy:fsString(user.email)} },
        { path:`${HISTORY_COLLECTION}/${id}`,currentDocument:{exists:false},fields:historyFields(id,user,'publish',version,snapshot,'Diseño global publicado') },
      ];
      if (draft) {
        const rebased=sanitizeGlobalStudioConfig({...draft.config,layout:config.layout});
        writes.push({path:DRAFT_PATH,fields:{basedOnVersion:fsInteger(version),configJson:jsonField(rebased),updatedAt:fsTimestamp(new Date()),updatedBy:fsString(user.email)}});
      }
      await firestoreAdminCommit(env,writes);
      return jsonResponse({ok:true,version,config,layout:config.layout,draftPreserved:Boolean(draft)},200,origin,requestUrl);
    }
    if (action === 'publish') {
      const config=sanitizeGlobalStudioConfig(body.config); const stateDoc=await firestoreAdminGet(env,STATE_PATH); const current=decodeState(stateDoc);
      if (Number(body.expectedVersion) !== current.version) return conflict(origin,requestUrl);
      const version=current.version+1; const id=eventId(); const snapshot={config};
      await firestoreAdminCommit(env,[
        { path:STATE_PATH,currentDocument:current.precondition,fields:{version:fsInteger(version),configJson:jsonField(config),updatedAt:fsTimestamp(new Date()),updatedBy:fsString(user.email)} },
        { path:`${HISTORY_COLLECTION}/${id}`,currentDocument:{exists:false},fields:historyFields(id,user,'publish',version,snapshot,'Publicado') },
        { path:DRAFT_PATH,delete:true },
      ]);
      return jsonResponse({ok:true,version,config},200,origin,requestUrl);
    }
    if (action === 'restore') {
      const id=String(body.historyId || '').trim(); if (!/^global-[a-z0-9-]{12,80}$/i.test(id)) throw new Error('La versión no existe.');
      const previousDoc=await firestoreAdminGet(env,`${HISTORY_COLLECTION}/${id}`); const previous=previousDoc ? decodeHistory(previousDoc) : null;
      if (!isRestorableGlobalHistory(previous)) throw new Error('La versión no existe.');
      const config=sanitizeGlobalStudioConfig(previous.snapshot.config); const stateDoc=await firestoreAdminGet(env,STATE_PATH); const current=decodeState(stateDoc);
      if (Number(body.expectedVersion) !== current.version) return conflict(origin,requestUrl);
      const version=current.version+1; const restoredId=eventId(); const snapshot={config};
      await firestoreAdminCommit(env,[
        { path:STATE_PATH,currentDocument:current.precondition,fields:{version:fsInteger(version),configJson:jsonField(config),updatedAt:fsTimestamp(new Date()),updatedBy:fsString(user.email),restoredFrom:fsString(id)} },
        { path:`${HISTORY_COLLECTION}/${restoredId}`,currentDocument:{exists:false},fields:historyFields(restoredId,user,'restore',version,snapshot,`Restaurada desde v${previous.version}`) },
        { path:DRAFT_PATH,delete:true },
      ]);
      return jsonResponse({ok:true,version,config},200,origin,requestUrl);
    }
    throw new Error('Acción no permitida.');
  } catch (error) {
    console.error(JSON.stringify({message:'visual-studio-global request failed',error:error?.message || String(error),path:new URL(request.url).pathname}));
    const status=Number(error?.status) || (/Super Admin|sesi[oó]n|autenticaci/i.test(String(error?.message)) ? 403 : 400);
    const allowed=/^(La versión|Solicitud|Acción)/.test(String(error?.message || ''));
    return jsonResponse({ok:false,error:allowed ? error.message : 'No se pudo completar la operación.'},status,origin,requestUrl);
  }
}
