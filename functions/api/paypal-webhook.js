import { jsonResponse } from '../../cloudflare/seguridad-cloudinary.js';
import { processPaypalWebhook } from '../../cloudflare/paypal-seguro.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405, '', request.url);
  try {
    const raw = await request.text();
    if (raw.length > 100000) throw new Error('Evento demasiado grande');
    return jsonResponse(await processPaypalWebhook(env, request, raw), 200, '', request.url);
  } catch {
    return jsonResponse({ accepted: false }, 400, '', request.url);
  }
}
