import { sanitizedAuditPayload } from '../../../../cloudflare/estudio-codigo-core.js';
import { analyzeWithCodeStudioAi } from '../../../../cloudflare/estudio-codigo-ia.js';
import { encodeFirestoreFields, firestoreAdminReplace } from '../../../../cloudflare/firebase-admin-ligero.js';
import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin } from '../../../../cloudflare/seguridad-cloudinary.js';

async function audit(env, user, proposal) {
  try {
    const payload = sanitizedAuditPayload({
      actorUid: user.uid,
      actorEmail: user.email,
      action: 'ai_analyze',
      branch: proposal.branch,
      files: proposal.files.map(file => file.path),
      risk: proposal.risk,
      result: 'ok',
      detail: 'Análisis IA solicitado. El asistente no recibió capacidad de commit, merge ni deploy.'
    });
    const id = `${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    await firestoreAdminReplace(env, `codeStudioAudit/${id}`, encodeFirestoreFields(payload));
  } catch (error) {
    console.error(JSON.stringify({ message: 'codeStudio AI audit falló', reason: String(error?.message || '').slice(0, 300) }));
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
    const proposal = await analyzeWithCodeStudioAi(env, body);
    await audit(env, user, proposal);
    return jsonResponse({ ok: true, proposal }, 200, origin, request.url);
  } catch (error) {
    const status = Number(error?.status) || (/sesión|Super Admin|autorizado/i.test(error?.message || '') ? 403 : 400);
    return jsonResponse({ ok: false, error: String(error?.message || 'Error interno').slice(0, 700) }, status, origin, request.url);
  }
}
