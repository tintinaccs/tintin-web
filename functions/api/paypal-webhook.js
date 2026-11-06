import { readLimitedText } from '../lib/operational-guard.js';
import { jsonResponse } from '../../cloudflare/seguridad-cloudinary.js';
import { processPaypalWebhook } from '../../cloudflare/paypal-seguro.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405, '', request.url);
  try {
    const raw = await readLimitedText(request, 100000);
    if (raw.length > 100000) throw new Error('Evento demasiado grande');
    return jsonResponse(await processPaypalWebhook(env, request, raw), 200, '', request.url);
  } catch (error) {
    return jsonResponse({ accepted: false }, error?.status === 413 ? 413 : 400, '', request.url);
  }
}
