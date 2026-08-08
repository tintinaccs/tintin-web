import { jsonResponse, originIsAllowed, preflightResponse, requireVerifiedFirebaseUser } from '../../cloudflare/seguridad-cloudinary.js';
import { decodeFirestoreFields, firestoreAdminGet, firestoreAdminList, firestoreAdminMerge, firestoreAdminReplace, fsInteger, fsString, fsTimestamp } from '../../cloudflare/firebase-admin-ligero.js';
import { AI_JOB_PROGRESS, cleanFinding, cleanJobId, cleanPrompt, featureIsEnabled, publicJob, transitionJob } from '../../cloudflare/desarrollador-ia-core.js';

const now = () => new Date();
const newId = () => `ai_${crypto.randomUUID().replace(/-/g, '')}`;
const configured = env => featureIsEnabled(env) && Boolean(env.AI_DEVELOPER_ALLOWED_UID && env.AI_DEVELOPER_ALLOWED_EMAIL && env.AI_DEVELOPER_GITHUB_TOKEN && env.AI_DEVELOPER_GITHUB_REPO && env.AI_DEVELOPER_CALLBACK_SECRET);

async function authorize(request, env) {
  if (!configured(env)) throw new Error('Desarrollador IA no está configurado.');
  const identity = await requireVerifiedFirebaseUser(request);
  if (identity.uid !== String(env.AI_DEVELOPER_ALLOWED_UID).trim() || identity.email !== String(env.AI_DEVELOPER_ALLOWED_EMAIL).trim().toLowerCase()) throw new Error('Acceso denegado.');
  const document = await firestoreAdminGet(env, `users/${encodeURIComponent(identity.uid)}`);
  const profile = document ? decodeFirestoreFields(document.fields) : {};
  if (String(profile.role || '').toLowerCase() !== 'superadmin' || profile.aiDeveloperEnabled !== true) throw new Error('Falta rol o permiso para Desarrollador IA.');
  return identity;
}

async function dispatch(env, job) {
  const [owner, repo] = String(env.AI_DEVELOPER_GITHUB_REPO || '').split('/');
  if (!owner || !repo) throw new Error('Repositorio del ejecutor inválido.');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/ai-developer-runner.yml/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.AI_DEVELOPER_GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'Tintin-AI-Developer' },
    body: JSON.stringify({ ref: 'main', inputs: { job_id: job.id, task: job.prompt } })
  });
  if (response.status !== 204) throw new Error(`GitHub no aceptó el trabajo (${response.status}).`);
}

async function createJob(request, env, actor) {
  const raw = await request.text();
  if (!raw || raw.length > 9000) throw new Error('Solicitud inválida.');
  const body = JSON.parse(raw);
  const finding = cleanFinding(body.finding);
  const prompt = cleanPrompt(body.prompt || [finding.title, finding.evidence, finding.file, finding.suggestion].filter(Boolean).join('\n'));
  const id = newId();
  const stamp = now();
  const title = String(body.title || finding.title || prompt.slice(0, 100)).trim().slice(0, 180);
  const fields = { id: fsString(id), title: fsString(title), prompt: fsString(prompt), findingJson: fsString(JSON.stringify(finding)), status: fsString('queued'), progress: fsInteger(AI_JOB_PROGRESS.queued), createdAt: fsTimestamp(stamp), updatedAt: fsTimestamp(stamp), actorUid: fsString(actor.uid), actorEmail: fsString(actor.email), prUrl: fsString(''), error: fsString('') };
  await firestoreAdminReplace(env, `aiDeveloperJobs/${id}`, fields);
  try { await dispatch(env, { id, prompt }); }
  catch (error) {
    await firestoreAdminMerge(env, `aiDeveloperJobs/${id}`, { status: fsString('failed'), progress: fsInteger(100), error: fsString(String(error.message || error).slice(0, 500)), updatedAt: fsTimestamp(now()) });
    throw error;
  }
  return publicJob(decodeFirestoreFields(fields));
}

async function listJobs(env) {
  const docs = await firestoreAdminList(env, 'aiDeveloperJobs', 50);
  return docs.map(doc => publicJob(decodeFirestoreFields(doc.fields))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function secureEqual(left, right) {
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || ''))));
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) mismatch |= (a[i] || 0) ^ (b[i] || 0);
  return mismatch === 0;
}

async function callback(request, env) {
  if (!env.AI_DEVELOPER_CALLBACK_SECRET || !(await secureEqual(request.headers.get('x-ai-runner-secret'), env.AI_DEVELOPER_CALLBACK_SECRET))) throw new Error('Callback no autorizado.');
  const body = JSON.parse(await request.text());
  const id = cleanJobId(body.jobId);
  const doc = await firestoreAdminGet(env, `aiDeveloperJobs/${id}`);
  if (!doc) throw new Error('Trabajo no encontrado.');
  const next = transitionJob(String(decodeFirestoreFields(doc.fields).status), String(body.status));
  await firestoreAdminMerge(env, `aiDeveloperJobs/${id}`, { status: fsString(next.status), progress: fsInteger(next.progress), prUrl: fsString(String(body.prUrl || '').slice(0, 300)), error: fsString(String(body.error || '').slice(0, 500)), updatedAt: fsTimestamp(now()) });
  return { ok: true };
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!originIsAllowed(origin, requestUrl)) return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, POST, OPTIONS');
  try {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.searchParams.get('action') === 'callback') return jsonResponse(await callback(request, env), 200, origin, requestUrl);
    const actor = await authorize(request, env);
    if (request.method === 'GET') return jsonResponse({ ok: true, enabled: true, jobs: await listJobs(env) }, 200, origin, requestUrl);
    if (request.method === 'POST') return jsonResponse({ ok: true, job: await createJob(request, env, actor) }, 202, origin, requestUrl);
    return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);
  } catch (error) {
    console.error('[ai-developer]', error?.message || error);
    const message = String(error?.message || 'No se pudo procesar el trabajo.');
    const status = /Acceso denegado|rol o permiso|autorizado/.test(message) ? 403 : /configurado/.test(message) ? 503 : 400;
    return jsonResponse({ ok: false, error: message.slice(0, 500) }, status, origin, requestUrl);
  }
}
