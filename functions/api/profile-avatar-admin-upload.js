import {
  getCloudinaryConfig, cloudinarySignature, jsonResponse, originIsAllowed,
  preflightResponse, requireStaffPermission,
} from '../../cloudflare/seguridad-cloudinary.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function profilePublicId(uid) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(uid)));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
  return `tintin_profile_${hash}`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url);
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);
  try {
    const actor = await requireStaffPermission(request, env, 'usuarios', 'gestionarFotos');
    const body = await request.json().catch(() => ({}));
    const uid = String(body?.uid || '').trim();
    const contentType = String(body?.contentType || '').toLowerCase();
    const size = Number(body?.size || 0);
    if (!UID_PATTERN.test(uid) || !ALLOWED_TYPES.has(contentType) || !Number.isFinite(size) || size <= 0 || size > 5 * 1024 * 1024) {
      return jsonResponse({ ok: false, error: 'Archivo de foto inválido' }, 400, origin, request.url);
    }
    if (uid === actor.uid && actor.isSuperAdmin === false) {
      // El flujo de perfil propio conserva su endpoint específico; esto evita
      // que la vía de moderación se convierta en una segunda identidad de autor.
      return jsonResponse({ ok: false, error: 'Usá el cambio de foto de tu perfil' }, 400, origin, request.url);
    }
    const publicId = await profilePublicId(uid);
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig(env);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await cloudinarySignature({ overwrite: 'true', public_id: publicId, timestamp }, apiSecret);
    return jsonResponse({ ok: true, cloudName, apiKey, publicId, timestamp, signature, overwrite: true,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload` }, 200, origin, request.url);
  } catch (error) {
    const status = Number(error?.status) || 400;
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo autorizar la foto').slice(0, 300) }, status, origin, request.url);
  }
}
