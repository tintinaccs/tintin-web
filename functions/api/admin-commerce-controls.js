import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin, rateLimitErrorResponse, statusFromError } from '../../cloudflare/seguridad-cloudinary.js';
import { firestoreAdminGet, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { moveOrderTrash } from '../../cloudflare/order-trash-controls.js';
import { resetStatistics } from '../../cloudflare/statistics-controls.js';
import { syncOrderOwnerStats } from '../../cloudflare/sincronizacion-estadisticas-pedido.js';

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || (request.method === 'GET' ? new URL(request.url).origin : '');
  if (!origin || !originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'GET, POST, OPTIONS');
  if (!['GET', 'POST'].includes(request.method)) return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, request.url);
  try {
    const actor = await requireSuperAdmin(request, env);
    if (request.method === 'GET') {
      const document = await firestoreAdminGet(env, 'settings/statisticsResets');
      return jsonResponse({ ok: true, result: document ? decodeFirestoreFields(document.fields || {}) : { resets: {}, lastChangeId: '' } }, 200, origin, request.url);
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16 * 1024) throw new Error('Solicitud demasiado grande.');
    const input = JSON.parse(raw);
    const result = input.action === 'resetStatistics'
      ? await resetStatistics(env, input, { ...actor, role: 'superadmin' })
      : await moveOrderTrash(env, input, { ...actor, role: 'superadmin' });
    if (input.action !== 'resetStatistics' && result.order) {
      context.waitUntil?.(syncOrderOwnerStats(env, { ...result.order, id: result.orderId }).catch(error => console.error('[commerce-controls] stats sync', error?.code || 'unavailable')));
    }
    return jsonResponse({ ok: true, result }, 200, origin, request.url);
  } catch (error) {
    const limited = rateLimitErrorResponse(error, origin, request.url);
    if (limited) return limited;
    const status = statusFromError(error, 400);
    return jsonResponse({ ok: false, error: status < 500 ? String(error.message || 'No se pudo completar la operación.').slice(0, 300) : 'El servicio no está disponible. Reintentá sin duplicar la operación.' }, status, origin, request.url);
  }
}
