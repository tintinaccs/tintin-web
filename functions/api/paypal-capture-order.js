import { rateLimitErrorResponse, jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser, statusFromError } from '../../cloudflare/seguridad-cloudinary.js';
import { capturePaypalOrder } from '../../cloudflare/paypal-seguro.js';

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ success: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url);
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Método no permitido' }, 405, origin, request.url);
  try {
    const user = await requireFirebaseUser(request, env);
    const raw = await request.text();
    if (raw.length > 3000) throw new Error('Solicitud demasiado grande');
    const result = await capturePaypalOrder(env, { providerOrderId: JSON.parse(raw || '{}').providerOrderId, uid: user.uid });
    return jsonResponse({ success: true, ...result }, 200, origin, request.url);
  } catch (error) {
    const limited = rateLimitErrorResponse(error, origin, request.url);
    if (limited) return limited;
    return jsonResponse({ success: false, error: String(error?.message || 'No se pudo confirmar PayPal').slice(0, 240) }, statusFromError(error, 400), origin, request.url);
  }
}
