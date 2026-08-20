import {
  requireRecentAuthToken,
  sanitizedAuditPayload,
  summarizeRisk
} from '../../../cloudflare/estudio-codigo-core.js';
import {
  compareBranch,
  getPullRequest,
  mergePullRequestWithHumanApproval
} from '../../../cloudflare/estudio-codigo-github.js';
import { encodeFirestoreFields, firestoreAdminReplace } from '../../../cloudflare/firebase-admin-ligero.js';
import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin } from '../../../cloudflare/seguridad-cloudinary.js';

const MAX_BODY_BYTES = 16 * 1024;

function cleanError(error) {
  return String(error?.message || 'No se pudo completar el merge').replace(/(?:Bearer\s+|token[=: ]+|secret[=: ]+)[A-Za-z0-9._~+\-/=]+/gi, '[redacted]').slice(0, 700);
}

async function readBody(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw Object.assign(new Error('Solicitud demasiado grande'), { status: 413 });
  try { return JSON.parse(text || '{}'); } catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}

async function recordAudit(env, user, detail) {
  try {
    const payload = sanitizedAuditPayload({
      actorUid: user.uid,
      actorEmail: user.email,
      action: 'merge',
      branch: detail.branch,
      commitSha: detail.commitSha,
      files: detail.files,
      risk: summarizeRisk(detail.files),
      result: 'ok',
      detail: `PR #${detail.number} fusionado por confirmación humana dentro de Tintin.`
    });
    const id = `${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    await firestoreAdminReplace(env, `codeStudioAudit/${id}`, encodeFirestoreFields(payload));
  } catch (error) {
    console.error(JSON.stringify({ message: 'codeStudio merge audit falló', reason: cleanError(error) }));
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);

  try {
    if (!origin || !originIsAllowed(origin, request.url)) throw Object.assign(new Error('Origen no autorizado'), { status: 403 });
    const user = await requireSuperAdmin(request);
    requireRecentAuthToken(user.idToken, 10 * 60);
    const body = await readBody(request);
    const pr = await getPullRequest(env, body.number);
    const compare = await compareBranch(env, { branch: pr.headRef });
    const result = await mergePullRequestWithHumanApproval(env, {
      number: body.number,
      expectedHeadSha: body.expectedHeadSha,
      confirmation: body.confirmation,
      requirePreview: true
    });
    const files = compare.files.map(file => file.filename);
    await recordAudit(env, user, { number: pr.number, branch: pr.headRef, commitSha: result.sha, files });
    return jsonResponse({ ok: true, merge: result }, 200, origin, request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: cleanError(error), code: error?.code || '' }, Number(error?.status) || 500, origin, request.url);
  }
}
