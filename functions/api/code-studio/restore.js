// =============================================================
// TINTIN — Estudio de Código: restauración como nuevo commit
// Nunca resetea ni reescribe historia; jamás opera sobre main.
// =============================================================

import {
  normalizeBranchName,
  normalizeCodePath,
  normalizeSha,
  requiresRecentAuth,
  sanitizedAuditPayload,
  summarizeRisk
} from '../../../cloudflare/estudio-codigo-core.js';
import {
  commitWorkspaceChanges,
  getBranchHead,
  getFile
} from '../../../cloudflare/estudio-codigo-github.js';
import {
  encodeFirestoreFields,
  firestoreAdminReplace
} from '../../../cloudflare/firebase-admin-ligero.js';
import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../../cloudflare/seguridad-cloudinary.js';

const RECENT_AUTH_SECONDS = 10 * 60;

function decodeJwtPayload(token) {
  const part = String(token || '').split('.')[1] || '';
  if (!part) return {};
  try {
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(atob(normalized));
  } catch {
    return {};
  }
}

function requireRecentAuth(user) {
  const payload = decodeJwtPayload(user?.idToken);
  const authTime = Number(payload.auth_time || 0);
  const age = Math.floor(Date.now() / 1000) - authTime;
  if (!authTime || age < 0 || age > RECENT_AUTH_SECONDS) {
    throw Object.assign(new Error('La restauración de un archivo rojo requiere volver a autenticarte'), {
      status: 403,
      code: 'recent_auth_required'
    });
  }
}

function cleanError(error) {
  return String(error?.message || 'Error interno')
    .replace(/(?:Bearer\s+|token[=: ]+|secret[=: ]+)[A-Za-z0-9._~+\-/=]+/gi, '[redacted]')
    .slice(0, 700);
}

async function writeAudit(env, user, result, files, sourceRef) {
  try {
    const payload = sanitizedAuditPayload({
      actorUid: user.uid,
      actorEmail: user.email,
      action: 'restore_commit',
      branch: result.branch,
      commitSha: result.commitSha,
      files,
      risk: summarizeRisk(files),
      result: 'ok',
      detail: `Restauración creada como nuevo commit desde ${sourceRef.slice(0, 8)}; no se reescribió historia.`
    });
    const id = `${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    await firestoreAdminReplace(env, `codeStudioAudit/${id}`, encodeFirestoreFields(payload));
  } catch (error) {
    console.error(JSON.stringify({ message: 'codeStudio restore audit falló', reason: cleanError(error) }));
  }
}

async function optionalFile(env, path, ref) {
  try {
    return await getFile(env, { path, ref });
  } catch (error) {
    if (error?.status === 404 || /404|Not Found/i.test(String(error?.message || ''))) return null;
    throw error;
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
    const body = await request.json().catch(() => { throw new Error('JSON inválido'); });
    const branch = normalizeBranchName(body?.branch);
    const expectedHeadSha = normalizeSha(body?.expectedHeadSha, 'SHA esperado de rama');
    const sourceRef = normalizeSha(body?.sourceRef, 'Commit histórico');
    const paths = [...new Set((Array.isArray(body?.paths) ? body.paths : []).map(normalizeCodePath))].slice(0, 10);
    if (!paths.length) throw new Error('Elegí al menos un archivo para restaurar');
    if (requiresRecentAuth(paths)) requireRecentAuth(user);

    const currentHead = await getBranchHead(env, branch);
    if (currentHead !== expectedHeadSha) throw Object.assign(new Error('La rama cambió; no se restauró nada'), { status: 409 });

    const changes = [];
    for (const path of paths) {
      const [current, historical] = await Promise.all([
        optionalFile(env, path, branch),
        optionalFile(env, path, sourceRef)
      ]);
      if (!current && !historical) continue;
      if (!historical && current) {
        changes.push({ path, operation: 'delete', baseSha: current.sha });
      } else if (historical && !current) {
        changes.push({ path, operation: 'create', content: historical.content });
      } else if (historical.content !== current.content) {
        changes.push({ path, operation: 'update', content: historical.content, baseSha: current.sha });
      }
    }
    if (!changes.length) throw new Error('Ese commit ya coincide con la rama actual para los archivos elegidos');

    const result = await commitWorkspaceChanges(env, {
      branch,
      expectedHeadSha,
      changes,
      message: `restore(code-studio): restaurar desde ${sourceRef.slice(0, 8)}`
    });
    await writeAudit(env, user, result, paths, sourceRef);
    return jsonResponse({ ok: true, restore: { ...result, sourceRef } }, 200, origin, request.url);
  } catch (error) {
    const status = Number(error?.status) || (/sesión|Super Admin|autentic/i.test(error?.message || '') ? 403 : /cambió|conflicto/i.test(error?.message || '') ? 409 : 400);
    if (status >= 500) console.error(JSON.stringify({ message: 'codeStudio restore falló', reason: cleanError(error) }));
    return jsonResponse({ ok: false, error: cleanError(error), code: error?.code || '' }, status, origin, request.url);
  }
}
