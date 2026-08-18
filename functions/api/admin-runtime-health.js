import { compactAdminRuntimeChecks, runAdminRuntimeChecks } from '../../cloudflare/admin-runtime-health.js';
import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin } from '../../cloudflare/seguridad-cloudinary.js';

function requestId() {
  return `admin-health-${crypto.randomUUID().slice(0, 10)}`;
}

function classifyAuthError(error) {
  const message = String(error?.message || error || '');
  if (/Falta la autenticación|sesi[oó]n venc/i.test(message)) {
    return { status: 401, code: 'authentication_required', error: 'La sesión de Super Admin no está disponible o venció.' };
  }
  if (/Super Admin|correo verificado|cuenta debe/i.test(message)) {
    return { status: 403, code: 'forbidden', error: 'La cuenta actual no tiene acceso de Super Admin.' };
  }
  return { status: 500, code: 'admin_health_internal', error: 'No se pudo comprobar el estado del Admin.' };
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  const ref = requestId();

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, code: 'origin_forbidden', error: 'Origen no permitido.', requestId: ref }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, OPTIONS');
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, code: 'method_not_allowed', error: 'Método no permitido.', requestId: ref }, 405, origin, requestUrl);
  }

  try {
    const user = await requireSuperAdmin(request);
    const report = await runAdminRuntimeChecks(env);
    const payload = {
      ok: report.ok,
      service: 'tintin-admin-runtime',
      actor: user.email,
      checks: compactAdminRuntimeChecks(report),
      failed: report.failed,
      timings: Object.fromEntries(Object.entries(report.checks).map(([id, item]) => [id, item.ms])),
      checkedAt: new Date().toISOString(),
      requestId: ref,
    };
    return jsonResponse(payload, report.ok ? 200 : 503, origin, requestUrl);
  } catch (error) {
    const classified = classifyAuthError(error);
    console.error(JSON.stringify({
      message: 'admin runtime health request failed',
      code: classified.code,
      detail: error?.message || String(error),
      requestId: ref,
    }));
    return jsonResponse({
      ok: false,
      code: classified.code,
      error: classified.error,
      requestId: ref,
    }, classified.status, origin, requestUrl);
  }
}
