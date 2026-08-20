import { buildFileEvidenceGraph, isTextFile, normalizeBranchName, normalizeCodePath } from '../../../cloudflare/estudio-codigo-core.js';
import { getFile } from '../../../cloudflare/estudio-codigo-github.js';
import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin } from '../../../cloudflare/seguridad-cloudinary.js';

function resolveBranch(value) {
  const branch = String(value || '').trim();
  return !branch || branch === 'main' ? 'main' : normalizeBranchName(branch);
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);

  try {
    if (!origin || !originIsAllowed(origin, request.url)) throw Object.assign(new Error('Origen no autorizado'), { status: 403 });
    await requireSuperAdmin(request);
    const body = await request.json().catch(() => { throw new Error('JSON inválido'); });
    const branch = resolveBranch(body?.branch);
    const paths = [...new Set((Array.isArray(body?.paths) ? body.paths : []).map(normalizeCodePath))].slice(0, 25);
    const files = [];
    for (const path of paths) {
      if (!isTextFile(path)) continue;
      const file = await getFile(env, { path, ref: branch });
      files.push({ path, content: file.content.slice(0, 120000) });
    }
    return jsonResponse({ ok: true, graph: buildFileEvidenceGraph(files), analyzed: files.map(file => file.path) }, 200, origin, request.url);
  } catch (error) {
    const status = Number(error?.status) || (/sesión|Super Admin|autorizado/i.test(error?.message || '') ? 403 : 400);
    return jsonResponse({ ok: false, error: String(error?.message || 'Error interno').slice(0, 700) }, status, origin, request.url);
  }
}
