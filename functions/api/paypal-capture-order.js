import { jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser } from '../../cloudflare/seguridad-cloudinary.js';
import { capturePaypalOrder } from '../../cloudflare/paypal-seguro.js';

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ success: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url);
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Método no permitido' }, 405, origin, request.url);
  try {
    const user = await requireFirebaseUser(request);
    const raw = await request.text();
    if (raw.length > 3000) throw new Error('Solicitud demasiado grande');
    const result = await capturePaypalOrder(env, { providerOrderId: JSON.parse(raw || '{}').providerOrderId, uid: user.uid });
    return jsonResponse({ success: true, ...result }, 200, origin, request.url);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error?.message || 'No se pudo confirmar PayPal').slice(0, 240) }, 400, origin, request.url);
  }
}
