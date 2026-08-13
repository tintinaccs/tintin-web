import {
  jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  addCustomerReply, createReview, editOwnReview, getOwnReview, toggleFavorite,
} from '../../cloudflare/participacion-clientes.js';
import { syncEngagementToSheets } from '../../cloudflare/sincronizacion-participacion-sheets.js';

const MAX_BODY_BYTES = 8 * 1024;

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'GET, POST, OPTIONS');
  try {
    const user = await requireFirebaseUser(request);
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.searchParams.get('action') !== 'ownReview') throw new Error('Acción no permitida');
      return jsonResponse({ ok: true, review: await getOwnReview(env, user, url.searchParams.get('productId')) }, 200, origin, request.url);
    }
    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud vacía o demasiado grande');
    const input = JSON.parse(raw);
    let result;
    if (input.action === 'createReview') result = { review: await createReview(env, user, input) };
    else if (input.action === 'editReview') result = { review: await editOwnReview(env, user, input) };
    else if (input.action === 'replyReview') result = { review: await addCustomerReply(env, user, input) };
    else if (input.action === 'toggleFavorite') result = await toggleFavorite(env, user, input);
    else throw new Error('Acción no permitida');
    const syncEvent = input.action === 'toggleFavorite'
      ? { type: 'like', operation: result.selected ? 'upsert' : 'delete', record: result.record }
      : { type: 'review', operation: 'upsert', record: result.review };
    context.waitUntil?.(syncEngagementToSheets(env, user.idToken, syncEvent));
    return jsonResponse({ ok: true, ...result }, 200, origin, request.url);
  } catch (error) {
    const conflict = error?.code === 'version_conflict';
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo completar la acción').slice(0, 300) }, conflict ? 409 : 400, origin, request.url);
  }
}
