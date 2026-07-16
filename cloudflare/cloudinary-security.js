// =============================================================
// TINTIN — Seguridad compartida para Cloudflare Pages Functions
// =============================================================
// Este módulo corre únicamente en el runtime de Cloudflare. Las credenciales
// de Cloudinary se leen desde context.env y nunca se envían al navegador.

const FIREBASE_WEB_API_KEY = 'AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0';
const SUPERADMIN_EMAIL = 'tintinaccs@gmail.com';

const TRUSTED_CROSS_ORIGINS = new Set([
  'https://tintinaccs.github.io',
  'https://tintinaccesorios.netlify.app'
]);

export function originIsAllowed(origin, requestUrl = '') {
  if (!origin) return true;

  try {
    if (origin === new URL(requestUrl).origin) return true;
  } catch {}

  if (TRUSTED_CROSS_ORIGINS.has(origin)) return true;
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin);
}

export function corsHeaders(origin, requestUrl = '') {
  const headers = {
    'cache-control': 'private, no-store, max-age=0',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'vary': 'Origin'
  };
  if (origin && originIsAllowed(origin, requestUrl)) {
    headers['access-control-allow-origin'] = origin;
  }
  return headers;
}

export function jsonResponse(body, status, origin, requestUrl = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin, requestUrl)
  });
}

export function preflightResponse(origin, requestUrl = '', methods = 'POST, OPTIONS') {
  const headers = corsHeaders(origin, requestUrl);
  headers['access-control-allow-methods'] = methods;
  headers['access-control-allow-headers'] = 'Authorization, Content-Type';
  headers['access-control-max-age'] = '600';
  return new Response(null, { status: 204, headers });
}

function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Falta la autenticación de Super Admin');
  return match[1].trim();
}

/**
 * Firebase valida la firma, proyecto, vencimiento y existencia de la cuenta.
 * La función comprueba después el correo verificado del único Super Admin.
 */
export async function requireSuperAdmin(request) {
  const token = getBearerToken(request);
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = data?.error?.message || 'INVALID_ID_TOKEN';
    if (/INVALID_ID_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND/i.test(reason)) {
      throw new Error('La sesión venció; volvé a iniciar sesión');
    }
    throw new Error('No se pudo validar la sesión de Super Admin');
  }

  const user = Array.isArray(data.users) ? data.users[0] : null;
  const email = String(user?.email || '').trim().toLowerCase();
  if (!user?.localId || email !== SUPERADMIN_EMAIL || user.emailVerified !== true) {
    throw new Error('Solo el Super Admin puede administrar imágenes');
  }

  return { uid: String(user.localId), email };
}

export function getCloudinaryConfig(env = {}) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary todavía no está configurado en Cloudflare');
  }
  return { cloudName, apiKey, apiSecret };
}

export async function cloudinarySignature(parameters, apiSecret) {
  const serialized = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
    .join('&');

  const bytes = new TextEncoder().encode(`${serialized}${apiSecret}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

export function cleanMediaId(value) {
  const mediaId = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(mediaId)) {
    throw new Error('Identificador de imagen inválido');
  }
  return mediaId;
}

export function cleanVariant(value) {
  const variant = String(value || '').trim();
  if (!['full', 'thumb'].includes(variant)) {
    throw new Error('Variante de imagen inválida');
  }
  return variant;
}

export function cleanPublicId(value) {
  const publicId = String(value || '').trim();
  if (!/^tintin\/media\/[A-Za-z0-9_-]{8,80}\/(?:full|thumb)$/.test(publicId)) {
    throw new Error('El archivo solicitado no pertenece a la biblioteca de Tintin');
  }
  return publicId;
}
