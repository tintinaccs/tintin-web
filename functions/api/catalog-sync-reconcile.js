import { retryPendingCatalogSheets } from '../../cloudflare/resiliencia-sync-catalogo.js';
import { createSuperAdminServiceIdToken } from '../../cloudflare/sesion-servicio-superadmin.js';

const MAX_BODY_BYTES = 8 * 1024;

function sameSecret(provided, expected) {
  const left = new TextEncoder().encode(String(provided || ''));
  const right = new TextEncoder().encode(String(expected || ''));
  if (!right.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!sameSecret(request.headers.get('X-Tintin-Sheets-Secret'), env.SHEETS_ENGAGEMENT_SECRET)) {
    return response({ ok: false, error: 'No autorizado.' }, 401);
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return response({ ok: false, error: 'Solicitud demasiado grande.' }, 413);
    }
    const input = raw ? JSON.parse(raw) : {};
    if (input.action !== 'reconcileCatalogSheetQueue') {
      return response({ ok: false, error: 'Acción no permitida.' }, 400);
    }

    const idToken = await createSuperAdminServiceIdToken(env);
    const result = await retryPendingCatalogSheets(env, idToken, { force: false });
    return response({ ok: true, result });
  } catch (error) {
    console.error('[catalog-sync-reconcile]', error?.message || error);
    return response({ ok: false, error: 'No se pudo reconciliar la cola de catálogo.' }, 500);
  }
}
