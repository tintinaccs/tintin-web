import { jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser } from '../../cloudflare/seguridad-cloudinary.js';
import { createPaypalOrder } from '../../cloudflare/paypal-seguro.js';

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ success: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url);
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Método no permitido' }, 405, origin, request.url);
  try {
    const user = await requireFirebaseUser(request);
    const raw = await request.text();
    if (raw.length > 3000) throw new Error('Solicitud demasiado grande');
    const result = await createPaypalOrder(env, { orderId: JSON.parse(raw || '{}').orderId, uid: user.uid });
    return jsonResponse({ success: true, ...result }, 200, origin, request.url);
  } catch (error) {
    return jsonResponse({ success: false, error: cleanError(error) }, 400, origin, request.url);
  }
}

const cleanError = error => String(error?.message || 'No se pudo iniciar PayPal').slice(0, 240);
