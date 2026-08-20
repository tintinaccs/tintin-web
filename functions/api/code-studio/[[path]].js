// =============================================================
// TINTIN — Estudio de Código: API privada Super Admin
// =============================================================

import {
  buildFileEvidenceGraph,
  classifyCodeRisk,
  inferLanguage,
  isTextFile,
  makeWorkspaceBranch,
  normalizeBranchName,
  normalizeCodePath,
  normalizeSha,
  requiresRecentAuth,
  sanitizeCommitMessage,
  sanitizeSearchQuery,
  sanitizedAuditPayload,
  summarizeRisk,
  validateChanges
} from '../../../cloudflare/estudio-codigo-core.js';
import {
  compareBranch,
  commitWorkspaceChanges,
  createWorkspaceBranch,
  getBranchHead,
  getChecks,
  getDeploymentState,
  getFile,
  getPullRequest,
  getRepositoryState,
  getTree,
  listHistory,
  mergePullRequestWithHumanApproval,
  openPullRequest,
  searchCode
} from '../../../cloudflare/estudio-codigo-github.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminGet,
  firestoreAdminList,
  firestoreAdminReplace
} from '../../../cloudflare/firebase-admin-ligero.js';
import {
  corsHeaders,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../../cloudflare/seguridad-cloudinary.js';

const JSON_LIMIT = 900 * 1024;
const RECENT_AUTH_SECONDS = 10 * 60;
const rateBuckets = new Map();

function routeName(request) {
  const pathname = new URL(request.url).pathname.replace(/^\/api\/code-studio\/?/, '');
  return pathname.replace(/^\/+|\/+$/g, '') || 'bootstrap';
}

function errorStatus(error) {
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) return error.status;
  const message = String(error?.message || '');
  if (/sesión|autentic|Super Admin|correo verificado/i.test(message)) return 403;
  if (/inválid|bloquead|demasiad|falta|permitid|requiere/i.test(message)) return 400;
  if (/conflicto|cambió|sobrescrib/i.test(message)) return 409;
  if (/configurad|GitHub App|Firestore/i.test(message)) return 503;
  return 500;
}

function cleanError(error) {
  return String(error?.message || 'Error interno').replace(/(?:Bearer\s+|token[=: ]+|secret[=: ]+)[A-Za-z0-9._~+\-/=]+/gi, '[redacted]').slice(0, 700);
}

async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > JSON_LIMIT) throw Object.assign(new Error('Solicitud demasiado grande'), { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > JSON_LIMIT) throw Object.assign(new Error('Solicitud demasiado grande'), { status: 413 });
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new Error('JSON inválido'); }
}

function enforceSameOrigin(request) {
  const origin = request.headers.get('origin') || '';
  if (!origin || !originIsAllowed(origin, request.url)) throw Object.assign(new Error('Origen no autorizado'), { status: 403 });
}

function rateLimit(key, limit = 90, windowMs = 60_000) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) throw Object.assign(new Error('Demasiadas solicitudes; intentá de nuevo en un momento'), { status: 429 });
  if (rateBuckets.size > 1000) {
    for (const [bucketKey, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(bucketKey);
  }
}

function decodeJwtPayload(token) {
  const part = String(token || '').split('.')[1] || '';
  if (!part) return {};
  try {
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(atob(normalized));
  } catch { return {}; }
}

function requireRecentAuth(user) {
  const payload = decodeJwtPayload(user?.idToken);
  const authTime = Number(payload.auth_time || 0);
  const age = Math.floor(Date.now() / 1000) - authTime;
  if (!authTime || age < 0 || age > RECENT_AUTH_SECONDS) {
    throw Object.assign(new Error('Este cambio toca archivos rojos y requiere volver a autenticarte antes de continuar'), { status: 403, code: 'recent_auth_required' });
  }
}

async function audit(env, user, action, detail = {}) {
  try {
    const payload = sanitizedAuditPayload({
      actorUid: user?.uid,
      actorEmail: user?.email,
      action,
      branch: detail.branch,
      commitSha: detail.commitSha,
      files: detail.files,
      risk: detail.risk,
      result: detail.result || 'ok',
      detail: detail.detail || ''
    });
    const id = `${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    await firestoreAdminReplace(env, `codeStudioAudit/${id}`, encodeFirestoreFields(payload));
  } catch (error) {
    console.error(JSON.stringify({ message: 'codeStudio audit falló', reason: cleanError(error), action }));
  }
}

async function getRecentEvents(env, limit = 30) {
  const docs = await firestoreAdminList(env, 'codeStudioEvents', Math.max(1, Math.min(100, Number(limit) || 30)));
  return docs.map(doc => ({ id: String(doc.name || '').split('/').pop(), ...decodeFirestoreFields(doc.fields || {}) }))
    .sort((a, b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')));
}

async function verifyWebhook(request, env, rawBody) {
  const secret = String(env.CODE_STUDIO_GITHUB_WEBHOOK_SECRET || '').trim();
  if (!secret) throw Object.assign(new Error('Webhook GitHub no configurado'), { status: 503 });
  const signature = String(request.headers.get('x-hub-signature-256') || '').trim();
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) throw Object.assign(new Error('Firma webhook ausente'), { status: 401 });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = `sha256=${[...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')}`;
  const encoder = new TextEncoder();
  const left = encoder.encode(signature.toLowerCase());
  const right = encoder.encode(expected.toLowerCase());
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) mismatch |= (left[index] || 0) ^ (right[index] || 0);
  if (mismatch !== 0) throw Object.assign(new Error('Firma webhook inválida'), { status: 401 });
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > JSON_LIMIT) throw Object.assign(new Error('Webhook demasiado grande'), { status: 413 });
  await verifyWebhook(request, env, rawBody);
  const deliveryId = String(request.headers.get('x-github-delivery') || '').trim();
  const event = String(request.headers.get('x-github-event') || '').trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(deliveryId) || !/^[A-Za-z0-9_-]{1,80}$/.test(event)) throw new Error('Cabeceras webhook inválidas');
  const existing = await firestoreAdminGet(env, `codeStudioEvents/${deliveryId}`);
  if (existing) return jsonResponse({ ok: true, duplicate: true }, 200, '', request.url);
  let payload = {};
  try { payload = JSON.parse(rawBody); } catch { throw new Error('Payload webhook inválido'); }
  const record = {
    deliveryId,
    event,
    action: String(payload?.action || '').slice(0, 80),
    repository: String(payload?.repository?.full_name || '').slice(0, 220),
    ref: String(payload?.ref || payload?.pull_request?.head?.ref || '').slice(0, 220),
    sha: String(payload?.after || payload?.check_suite?.head_sha || payload?.workflow_run?.head_sha || payload?.deployment?.sha || payload?.pull_request?.head?.sha || '').slice(0, 80),
    number: Number(payload?.number || payload?.pull_request?.number || 0),
    receivedAt: new Date().toISOString()
  };
  await firestoreAdminReplace(env, `codeStudioEvents/${deliveryId}`, encodeFirestoreFields(record));
  return jsonResponse({ ok: true, duplicate: false }, 202, '', request.url);
}

async function handleAi(env, body, user) {
  const endpointRaw = String(env.CODE_STUDIO_AI_ENDPOINT || '').trim();
  const token = String(env.CODE_STUDIO_AI_TOKEN || '').trim();
  const model = String(env.CODE_STUDIO_AI_MODEL || '').trim();
  const allowedHosts = String(env.CODE_STUDIO_AI_ALLOWED_HOSTS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!endpointRaw || !token || !model) throw Object.assign(new Error('Asistente IA todavía no está configurado'), { status: 503 });
  let endpoint;
  try { endpoint = new URL(endpointRaw); } catch { throw new Error('Endpoint IA inválido'); }
  if (endpoint.protocol !== 'https:' || !allowedHosts.includes(endpoint.hostname.toLowerCase())) throw new Error('Proveedor IA fuera de la allowlist');

  const question = String(body?.question || '').trim();
  if (question.length < 4 || question.length > 6000) throw new Error('Consulta IA inválida');
  const branch = body?.branch ? normalizeBranchName(body.branch) : 'main';
  const paths = [...new Set((Array.isArray(body?.paths) ? body.paths : []).map(normalizeCodePath))].slice(0, 12);
  const files = [];
  for (const path of paths) {
    if (!isTextFile(path)) continue;
    const file = await getFile(env, { path, ref: branch });
    files.push({ path, sha: file.sha, content: file.content.slice(0, 50000) });
  }
  const context = files.map(file => `FILE ${file.path} SHA ${file.sha}\n${file.content}`).join('\n\n---\n\n');
  const system = [
    'Sos el asistente diagnóstico del Estudio de Código Tintin.',
    'Analizá únicamente la evidencia suministrada. No inventes archivos, pruebas ni resultados.',
    'No reveles secretos, no propongas saltar permisos, no publiques, no fusiones y no ejecutes acciones.',
    'Respondé con: diagnóstico, propuesta, impacto, pruebas recomendadas y rollback.',
    'Cuando falte evidencia, decilo explícitamente.'
  ].join(' ');
  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `${question}\n\nCONTEXTO GITHUB VERIFICADO:\n${context || '(sin archivos seleccionados)'}` }
      ],
      temperature: 0.1
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`Proveedor IA respondió ${response.status}`), { status: 502 });
  const text = String(data?.output_text || data?.choices?.[0]?.message?.content || data?.text || '').trim();
  if (!text) throw Object.assign(new Error('El proveedor IA no devolvió una propuesta utilizable'), { status: 502 });
  await audit(env, user, 'ai_analyze', { branch, files: paths, risk: summarizeRisk(paths), detail: 'Análisis IA solicitado; sin publicación automática.' });
  return { text: text.slice(0, 40000), files: files.map(file => ({ path: file.path, sha: file.sha })) };
}

async function handleAuthenticated(request, env, route, user) {
  const url = new URL(request.url);
  rateLimit(`${user.uid}:${route}`, route === 'file' || route === 'tree' ? 180 : 90);

  if (request.method === 'GET' && route === 'bootstrap') {
    let github;
    try { github = await getRepositoryState(env); }
    catch (error) { github = { appConfigured: false, error: cleanError(error) }; }
    return { ok: true, github, capabilities: { edit: github.appConfigured === true, mergeRequiresHumanApproval: true, ai: Boolean(env.CODE_STUDIO_AI_ENDPOINT && env.CODE_STUDIO_AI_TOKEN && env.CODE_STUDIO_AI_MODEL), realtime: Boolean(env.CODE_STUDIO_GITHUB_WEBHOOK_SECRET) }, policy: { directMainWrite: false, recentAuthSeconds: RECENT_AUTH_SECONDS } };
  }

  if (request.method === 'GET' && route === 'tree') {
    const ref = url.searchParams.get('ref') || 'main';
    const path = url.searchParams.get('path') || '';
    return { ok: true, ref, path, entries: await getTree(env, { ref, path }) };
  }

  if (request.method === 'GET' && route === 'file') {
    const path = normalizeCodePath(url.searchParams.get('path'));
    if (!isTextFile(path)) throw new Error('El editor solo abre archivos de texto soportados');
    const ref = url.searchParams.get('ref') || 'main';
    const file = await getFile(env, { path, ref });
    return { ok: true, ...file, language: inferLanguage(path), risk: classifyCodeRisk(path) };
  }

  if (request.method === 'GET' && route === 'search') {
    const query = sanitizeSearchQuery(url.searchParams.get('q'));
    return { ok: true, query, results: await searchCode(env, { query }) };
  }

  if (request.method === 'GET' && route === 'compare') {
    return { ok: true, compare: await compareBranch(env, { branch: normalizeBranchName(url.searchParams.get('branch')) }) };
  }

  if (request.method === 'GET' && route === 'pr') {
    return { ok: true, pullRequest: await getPullRequest(env, url.searchParams.get('number')) };
  }

  if (request.method === 'GET' && route === 'checks') {
    return { ok: true, checks: await getChecks(env, normalizeSha(url.searchParams.get('sha'))) };
  }

  if (request.method === 'GET' && route === 'history') {
    return { ok: true, history: await listHistory(env, { branch: url.searchParams.get('branch') || 'main', path: url.searchParams.get('path') || '' }) };
  }

  if (request.method === 'GET' && route === 'deployments') {
    return { ok: true, deployments: await getDeploymentState(env, normalizeSha(url.searchParams.get('sha'))) };
  }

  if (request.method === 'GET' && route === 'events') {
    const events = await getRecentEvents(env, 30);
    const headers = corsHeaders(request.headers.get('origin') || '', request.url);
    headers['content-type'] = 'text/event-stream; charset=utf-8';
    headers['cache-control'] = 'no-cache, no-store';
    const payload = `event: snapshot\ndata: ${JSON.stringify({ events })}\n\nevent: reconcile\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`;
    return new Response(payload, { status: 200, headers });
  }

  enforceSameOrigin(request);
  const body = await readJson(request);

  if (request.method === 'POST' && route === 'branch') {
    const branch = body.branch ? normalizeBranchName(body.branch) : makeWorkspaceBranch(body.label || 'cambio');
    const result = await createWorkspaceBranch(env, { branch, expectedMainSha: body.expectedMainSha });
    await audit(env, user, 'branch_create', { branch: result.branch, commitSha: result.sha, detail: 'Rama aislada creada desde main verificado.' });
    return { ok: true, ...result };
  }

  if (request.method === 'POST' && route === 'commit') {
    const changes = validateChanges(body.changes);
    if (requiresRecentAuth(changes.map(change => change.path))) requireRecentAuth(user);
    const branch = normalizeBranchName(body.branch);
    const result = await commitWorkspaceChanges(env, {
      branch,
      expectedHeadSha: body.expectedHeadSha,
      changes,
      message: sanitizeCommitMessage(body.message)
    });
    await audit(env, user, 'commit_create', { branch, commitSha: result.commitSha, files: result.files, risk: summarizeRisk(result.files), detail: 'Commit atómico creado con SHA esperado y actualización no forzada.' });
    return { ok: true, ...result };
  }

  if (request.method === 'POST' && route === 'pr') {
    const branch = normalizeBranchName(body.branch);
    const compare = await compareBranch(env, { branch });
    if (!compare.aheadBy) throw new Error('No hay cambios para abrir un PR');
    const pr = await openPullRequest(env, { branch, title: body.title, body: body.body || '' });
    await audit(env, user, 'pr_open', { branch, commitSha: pr.headSha, files: compare.files.map(file => file.filename), risk: summarizeRisk(compare.files.map(file => file.filename)), detail: `PR #${pr.number} abierto para revisión humana.` });
    return { ok: true, pullRequest: pr };
  }

  if (request.method === 'POST' && route === 'graph') {
    const branch = body.branch ? normalizeBranchName(body.branch) : 'main';
    const paths = [...new Set((Array.isArray(body.paths) ? body.paths : []).map(normalizeCodePath))].slice(0, 25);
    const files = [];
    for (const path of paths) {
      if (!isTextFile(path)) continue;
      const file = await getFile(env, { path, ref: branch });
      files.push({ path, content: file.content.slice(0, 120000) });
    }
    return { ok: true, graph: buildFileEvidenceGraph(files), analyzed: files.map(file => file.path) };
  }

  if (request.method === 'POST' && route === 'ai/analyze') {
    return { ok: true, proposal: await handleAi(env, body, user) };
  }

  if (request.method === 'POST' && route === 'merge') {
    requireRecentAuth(user);
    const pr = await getPullRequest(env, body.number);
    const files = (await compareBranch(env, { branch: pr.headRef })).files.map(file => file.filename);
    const result = await mergePullRequestWithHumanApproval(env, { number: body.number, expectedHeadSha: body.expectedHeadSha, approvalToken: body.approvalToken });
    await audit(env, user, 'merge', { branch: pr.headRef, commitSha: result.sha, files, risk: summarizeRisk(files), detail: 'Merge ejecutado solo después de aprobación humana externa y checks verdes.' });
    return { ok: true, merge: result };
  }

  throw Object.assign(new Error('Ruta del Estudio de Código no encontrada'), { status: 404 });
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const route = routeName(request);

  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'GET, POST, OPTIONS');
  if (route === 'webhook/github' && request.method === 'POST') {
    try { return await handleWebhook(request, env); }
    catch (error) {
      console.error(JSON.stringify({ message: 'codeStudio webhook rechazado', reason: cleanError(error) }));
      return jsonResponse({ ok: false, error: cleanError(error) }, errorStatus(error), '', request.url);
    }
  }

  try {
    const user = await requireSuperAdmin(request);
    const response = await handleAuthenticated(request, env, route, user);
    if (response instanceof Response) return response;
    return jsonResponse(response, 200, origin, request.url);
  } catch (error) {
    const status = errorStatus(error);
    if (status >= 500) console.error(JSON.stringify({ message: 'codeStudio request falló', route, reason: cleanError(error) }));
    return jsonResponse({ ok: false, error: cleanError(error), code: error?.code || '' }, status, origin, request.url);
  }
}
