import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  queueCatalogSheetSync,
  syncProductsPayloadWithRetry,
} from '../../cloudflare/resiliencia-sync-catalogo.js';

const MAX_BODY_BYTES = 64 * 1024;

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);
  }

  let actor;
  try {
    actor = await requireSuperAdmin(request);
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || 'Solo el Super Admin puede realizar esta acción.' }, error?.status || 401, origin, requestUrl);
  }

  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'Solicitud vacía o demasiado grande.' }, 400, origin, requestUrl);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido.' }, 400, origin, requestUrl);
  }

  const productIds = Array.isArray(payload.productIds)
    ? [...new Set(payload.productIds.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 100)
    : [];
  if (payload.action !== 'syncProducts' || !productIds.length || !payload.idToken) {
    return jsonResponse({ ok: false, error: 'Solicitud de sincronización incompleta.' }, 400, origin, requestUrl);
  }

  try {
    // El navegador ya autenticó al administrador, pero el camino de
    // sincronización no debe hacer que Apps Script vuelva a leer Firestore
    // producto por producto. Cloudflare lee el catálogo con su credencial de
    // servicio y envía sublotes pequeños mediante el secreto server-to-server.
    // Así el lote queda dentro del presupuesto de Apps Script/Cloudflare y es
    // exactamente el mismo protocolo que usa la cola de recuperación.
    const result = await syncProductsPayloadWithRetry(context.env, productIds, {
      attempts: 2,
      appScriptChunkSize: 5,
    });
    return jsonResponse({ ...result, ok: true, sheetName: 'Productos' }, 200, origin, requestUrl);
  } catch (error) {
    // Never leave Sheets stale without a durable recovery path.
    let queueIds = [];
    try {
      queueIds = await queueCatalogSheetSync(context.env, productIds, error, actor);
    } catch (queueError) {
      console.error('[sheets-product-sync] no se pudo encolar la reconciliación:', queueError);
    }
    return jsonResponse({
      ok: false,
      queued: queueIds.length > 0,
      queueIds,
      error: error instanceof Error ? error.message : 'No se pudo contactar el motor de Sheets.',
    }, queueIds.length > 0 ? 202 : 502, origin, requestUrl);
  }
}
