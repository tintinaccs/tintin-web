import {
  cloudinarySignature,
  getCloudinaryConfig,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser
} from '../../cloudflare/seguridad-cloudinary.js';

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function allowedContentType(value) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(String(value || '').toLowerCase());
}

async function shortHash(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ error: 'Origen no permitido' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl);
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405, origin, requestUrl);

  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const contentType = String(body?.contentType || '').toLowerCase();
    const size = safeNumber(body?.size);
    if (!allowedContentType(contentType)) {
      return jsonResponse({ error: 'Formato de imagen no permitido' }, 400, origin, requestUrl);
    }
    if (size <= 0 || size > 5 * 1024 * 1024) {
      return jsonResponse({ error: 'La foto debe pesar como máximo 5 MB' }, 400, origin, requestUrl);
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig(env);
    const userKey = await shortHash(user.uid);
    const publicId = `tintin_profile_${userKey}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParameters = {
      overwrite: 'true',
      public_id: publicId,
      timestamp,
    };
    const signature = await cloudinarySignature(signedParameters, apiSecret);

    return jsonResponse({
      ok: true,
      cloudName,
      apiKey,
      publicId,
      timestamp,
      signature,
      overwrite: true,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    }, 200, origin, requestUrl);
  } catch (error) {
    const message = error?.message || 'No se pudo autorizar la foto de perfil';
    const status = Number(error?.status) || (/Cloudinary todavía no está configurado/i.test(message) ? 503 : 401);
    return jsonResponse({ error: message }, status, origin, requestUrl);
  }
}
