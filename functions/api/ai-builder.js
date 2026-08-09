import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin } from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields, firestoreAdminGet, firestoreAdminList, firestoreAdminMerge,
  firestoreAdminReplace, fsInteger, fsString, fsTimestamp
} from '../../cloudflare/firebase-admin-ligero.js';
import { assessRequest, BUILDER_LIMITS, isRateAllowed, isRestorableHistoryEntry, validateProposal } from '../../cloudflare/ai-builder-core.js';
import { createAiProvider } from '../../cloudflare/ai-provider.js';
import { createComplexChangePr } from '../../cloudflare/github-ai-proposal.js';

const jsonField = value => fsString(JSON.stringify(value));
const safeJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const id = prefix => `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

function proposalFromDoc(doc) {
  const data = decodeFirestoreFields(doc?.fields || {});
  return { ...data, result: safeJson(data.resultJson, {}), resultJson: undefined };
}

function historyFromDoc(doc) {
  const data = decodeFirestoreFields(doc?.fields || {});
  return { ...data, snapshot: safeJson(data.snapshotJson, []), snapshotJson: undefined };
}

async function writeHistory(env, user, event) {
  const eventId = id('v');
  await firestoreAdminReplace(env, `aiBuilderHistory/${eventId}`, {
    id: fsString(eventId), actorUid: fsString(user.uid), actorEmail: fsString(user.email),
    createdAt: fsTimestamp(new Date()), action: fsString(event.action), request: fsString(event.request || ''),
    result: fsString(event.result || ''), version: fsInteger(event.version || 0),
    snapshotJson: jsonField(event.snapshot || []), proposalId: fsString(event.proposalId || '')
  });
  return eventId;
}

async function listHistory(env) {
  const docs = await firestoreAdminList(env, 'aiBuilderHistory', BUILDER_LIMITS.maxHistory);
  return docs.map(historyFromDoc).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, BUILDER_LIMITS.maxHistory);
}

async function currentState(env) {
  const doc = await firestoreAdminGet(env, 'aiBuilder/state');
  if (!doc) return { version: 0, blocks: [] };
  const data = decodeFirestoreFields(doc.fields);
  return { version: Number(data.version || 0), blocks: safeJson(data.configJson, []) };
}

async function enforceRateLimit(env, user) {
  const path = `aiBuilderUsage/${encodeURIComponent(user.uid)}`;
  const doc = await firestoreAdminGet(env, path);
  const data = doc ? decodeFirestoreFields(doc.fields) : {};
  const rate = isRateAllowed({ timestamps: safeJson(data.timestampsJson, []) });
  if (!rate.ok) {
    const error = new Error(`Esperá ${rate.retryAfter} segundos antes de volver a solicitar.`);
    error.status = 429;
    throw error;
  }
  await firestoreAdminReplace(env, path, { timestampsJson: jsonField(rate.timestamps), updatedAt: fsTimestamp(new Date()) });
}

async function parseBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > BUILDER_LIMITS.bodyBytes) throw new Error('Solicitud demasiado grande.');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > BUILDER_LIMITS.bodyBytes) throw new Error('Solicitud demasiado grande.');
  return JSON.parse(raw || '{}');
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
      const [state, history, proposalDocs] = await Promise.all([
        currentState(env), listHistory(env), firestoreAdminList(env, 'aiBuilderProposals', 30)
      ]);
      return jsonResponse({ ok: true, state, history, proposals: proposalDocs.map(proposalFromDoc).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) }, 200, origin, requestUrl);
    }
    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);
    const body = await parseBody(request);
    const action = String(body.action || 'propose');

    if (['propose', 'modify'].includes(action)) {
      await enforceRateLimit(env, user);
      const assessed = assessRequest(body.request);
      if (!assessed.ok) return jsonResponse({ ok: false, code: assessed.code, error: assessed.message }, 400, origin, requestUrl);
      const provider = createAiProvider(env);
      let result;
      try { result = validateProposal(await provider.propose(assessed.request), assessed.request); }
      catch (error) {
        console.error('[ai-builder:provider]', error?.message || error);
        return jsonResponse({ ok: false, error: 'El proveedor de IA no pudo preparar la propuesta. Reintentá más tarde.' }, 502, origin, requestUrl);
      }
      const proposalId = id('proposal');
      const proposal = {
        id: proposalId, actorUid: user.uid, actorEmail: user.email, createdAt: new Date().toISOString(),
        request: assessed.request, status: 'pending_approval', provider: provider.name, parentId: String(body.proposalId || ''), result
      };
      await firestoreAdminReplace(env, `aiBuilderProposals/${proposalId}`, {
        id: fsString(proposalId), actorUid: fsString(user.uid), actorEmail: fsString(user.email),
        createdAt: fsTimestamp(new Date()), request: fsString(assessed.request), status: fsString(proposal.status),
        provider: fsString(provider.name), parentId: fsString(proposal.parentId), resultJson: jsonField(result)
      });
      await writeHistory(env, user, { action, request: assessed.request, result: result.summary, proposalId });
      return jsonResponse({ ok: true, proposal, providerConfigured: provider.configured }, 201, origin, requestUrl);
    }

    if (action === 'restore') {
      const historyId = String(body.historyId || '').trim();
      if (!/^[a-z0-9-]{12,80}$/i.test(historyId)) throw new Error('La versión no existe.');
      const historyDoc = await firestoreAdminGet(env, `aiBuilderHistory/${encodeURIComponent(historyId)}`);
      if (!historyDoc) throw new Error('La versión no existe.');
      const previous = historyFromDoc(historyDoc);
      if (!isRestorableHistoryEntry(previous)) throw new Error('La versión no existe.');
      const state = await currentState(env);
      const version = state.version + 1;
      await firestoreAdminReplace(env, 'aiBuilder/state', {
        version: fsInteger(version), configJson: jsonField(previous.snapshot), proposalId: fsString(previous.proposalId || ''),
        updatedAt: fsTimestamp(new Date()), updatedBy: fsString(user.email), restoredFrom: fsString(historyId)
      });
      await writeHistory(env, user, { action: 'restore', request: previous.request, result: `Restaurada desde versión ${previous.version}`, version, snapshot: previous.snapshot, proposalId: previous.proposalId });
      return jsonResponse({ ok: true, version, blocks: previous.snapshot }, 200, origin, requestUrl);
    }

    const proposalId = String(body.proposalId || '').trim();
    if (!/^[a-z0-9-]{12,80}$/i.test(proposalId)) throw new Error('Propuesta inválida.');
    const proposalDoc = await firestoreAdminGet(env, `aiBuilderProposals/${encodeURIComponent(proposalId)}`);
    if (!proposalDoc) throw new Error('La propuesta no existe.');
    const proposal = proposalFromDoc(proposalDoc);
    if (action === 'cancel') {
      await firestoreAdminMerge(env, `aiBuilderProposals/${proposalId}`, { status: fsString('cancelled'), updatedAt: fsTimestamp(new Date()) });
      await writeHistory(env, user, { action, request: proposal.request, result: 'Propuesta cancelada', proposalId });
      return jsonResponse({ ok: true }, 200, origin, requestUrl);
    }
    if (action === 'publish') {
      if (proposal.status !== 'pending_approval') throw new Error('La propuesta ya fue procesada.');
      if (proposal.result.type === 'complex') {
        const github = await createComplexChangePr(env, proposal);
        await firestoreAdminMerge(env, `aiBuilderProposals/${proposalId}`, {
          status: fsString('technical_pr_created'), githubJson: jsonField(github), updatedAt: fsTimestamp(new Date())
        });
        await writeHistory(env, user, { action: 'technical_pr', request: proposal.request, result: github.prUrl, proposalId });
        return jsonResponse({ ok: true, complex: true, github }, 200, origin, requestUrl);
      }
      const state = await currentState(env);
      const version = state.version + 1;
      const blocks = proposal.result.blocks;
      await firestoreAdminReplace(env, 'aiBuilder/state', {
        version: fsInteger(version), configJson: jsonField(blocks), proposalId: fsString(proposalId),
        updatedAt: fsTimestamp(new Date()), updatedBy: fsString(user.email)
      });
      await firestoreAdminMerge(env, `aiBuilderProposals/${proposalId}`, { status: fsString('published'), version: fsInteger(version), updatedAt: fsTimestamp(new Date()) });
      await writeHistory(env, user, { action: 'publish', request: proposal.request, result: 'Publicado', version, snapshot: blocks, proposalId });
      return jsonResponse({ ok: true, version, blocks }, 200, origin, requestUrl);
    }
    throw new Error('Acción no permitida.');
  } catch (error) {
    console.error('[ai-builder]', error?.message || error);
    const status = Number(error?.status) || (/Solo el Super Admin|sesi[oó]n|autenticaci/i.test(String(error?.message)) ? 403 : 400);
    const safe = /^(Esperá|Solicitud|Propuesta|La propuesta|La versión|Acción|GITHUB_TOKEN)/.test(String(error?.message || '')) ? error.message : 'No se pudo completar la operación.';
    return jsonResponse({ ok: false, error: safe }, status, origin, requestUrl);
  }
}
