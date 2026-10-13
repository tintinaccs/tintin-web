import {
  cloudinarySignature,
  getCloudinaryConfig,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  rateLimitErrorResponse,
  requireFirebaseUser,
  statusFromError
} from '../../cloudflare/seguridad-cloudinary.js';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 20_000;

function allowedContentType(value) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(String(value || '').toLowerCase());
}

// La firma sólo viaja del servidor a Cloudinary, después de comprobar el cuerpo
// real. El navegador nunca recibe autorización para saltarse este límite.
const AVATAR_ALLOWED_FORMATS = 'jpg,png,webp';

function avatarError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function readAvatarBytes(request) {
  const declaredBytes = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_AVATAR_BYTES) {
    await request.body?.cancel().catch(() => {});
    throw avatarError('La foto debe pesar como máximo 5 MB', 413);
  }
  if (!request.body) throw avatarError('La foto está vacía');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > MAX_AVATAR_BYTES) {
        await reader.cancel().catch(() => {});
        throw avatarError('La foto debe pesar como máximo 5 MB', 413);
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  if (!total) throw avatarError('La foto está vacía');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function imageHeaderMatches(bytes, contentType) {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (contentType === 'image/webp') {
    return bytes.length >= 16 && new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF'
      && new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
      && ['VP8 ', 'VP8L', 'VP8X'].includes(new TextDecoder().decode(bytes.subarray(12, 16)));
  }
  return false;
}

function validUploadedAvatar(body, cloudName, publicId) {
  try {
    const url = new URL(body?.secure_url);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com'
      && url.pathname.startsWith(`/${cloudName}/image/upload/`) && !url.username && !url.password
      && body.public_id === publicId && body.resource_type === 'image'
      && AVATAR_ALLOWED_FORMATS.split(',').includes(body.format);
  } catch { return false; }
}

async function shortHash(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

export async function handleProfileAvatarUpload(context, { requireUser = requireFirebaseUser } = {}) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ error: 'Origen no permitido' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl);
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405, origin, requestUrl);

  try {
    const user = await requireUser(request, env);
    const contentType = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!allowedContentType(contentType)) {
      return jsonResponse({ error: 'Formato de imagen no permitido' }, 415, origin, requestUrl);
    }
    const bytes = await readAvatarBytes(request);
    if (!imageHeaderMatches(bytes, contentType)) {
      return jsonResponse({ error: 'El archivo no coincide con el formato de imagen indicado' }, 400, origin, requestUrl);
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig(env);
    const userKey = await shortHash(user.uid);
    const publicId = `tintin_profile_${userKey}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParameters = {
      allowed_formats: AVATAR_ALLOWED_FORMATS,
      overwrite: 'true',
      public_id: publicId,
      timestamp,
    };
    const signature = await cloudinarySignature(signedParameters, apiSecret);
    const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: contentType }), `${publicId}.${extension}`);
    form.append('api_key', apiKey);
    form.append('signature', signature);
    for (const [key, value] of Object.entries(signedParameters)) form.append(key, String(value));
    const uploaded = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    const body = await uploaded.json().catch(() => ({}));
    if (!uploaded.ok) throw avatarError('No se pudo procesar la foto. Volvé a intentar.', uploaded.status === 400 ? 400 : 502);
    if (!validUploadedAvatar(body, cloudName, publicId)) throw avatarError('No se pudo confirmar la foto subida', 502);
    return jsonResponse({ ok: true, publicId, secure_url: body.secure_url }, 200, origin, requestUrl);
  } catch (error) {
    const limited = rateLimitErrorResponse(error, origin, requestUrl);
    if (limited) return limited;
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    const message = timedOut ? 'La subida tardó demasiado. Volvé a intentar.' : error?.message || 'No se pudo subir la foto de perfil';
    const status = timedOut ? 504 : statusFromError(error, /Cloudinary todavía no está configurado/i.test(message) ? 503 : 502);
    return jsonResponse({ error: message }, status, origin, requestUrl);
  }
}

export function onRequest(context) {
  return handleProfileAvatarUpload(context);
}
