import { jsonResponse, originIsAllowed } from '../../cloudflare/seguridad-cloudinary.js';
import { publicPaypalConfig } from '../../cloudflare/paypal-seguro.js';

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ enabled: false }, 403, origin, request.url);
  if (request.method !== 'GET') return jsonResponse({ error: 'Método no permitido' }, 405, origin, request.url);
  return jsonResponse(publicPaypalConfig(env), 200, origin, request.url);
}
