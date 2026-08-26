import {
  cloudinarySignature,
  getCloudinaryConfig,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../cloudflare/seguridad-cloudinary.js';

// Autoriza la subida de un tono corto desde el Centro maestro. El archivo no
// se guarda en el navegador ni en Firestore: Cloudinary entrega una URL HTTPS
// que luego se persiste en la configuración push.
export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!origin || !originIsAllowed(origin, request.url)) return jsonResponse({ error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url);
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405, origin, request.url);
  try {
    await requireSuperAdmin(request);
    const body = await request.json().catch(() => ({}));
    const slot = String(body?.slot || 'global').trim().toLowerCase();
    if (!['global', 'order', 'review', 'like'].includes(slot)) throw new Error('Tono inválido.');
    const config = getCloudinaryConfig(env);
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `tintin_push_tone_${slot}`;
    const params = { overwrite: 'true', public_id: publicId, timestamp, type: 'upload' };
    const signature = await cloudinarySignature(params, config.apiSecret);
    return jsonResponse({
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      publicId,
      timestamp,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/raw/upload`
    }, 200, origin, request.url);
  } catch (error) {
    const message = error?.message || 'No se pudo autorizar el tono';
    return jsonResponse({ error: message }, /Cloudinary todavía no está configurado/i.test(message) ? 503 : 400, origin, request.url);
  }
}
