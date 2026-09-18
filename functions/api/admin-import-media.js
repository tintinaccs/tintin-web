import {
  cloudinarySignature,
  getCloudinaryConfig,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  classifyMediaResponse,
  validateMediaSourceUrl,
} from '../../js/core/store/shopify-phase2-pipeline.mjs';

const MAX_ITEMS = 25;
const MAX_BYTES = 15 * 1024 * 1024;

function clean(value, max = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function mediaId(value) {
  const result = clean(value, 160).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!result) throw new Error('Media identity inválida.');
  return result;
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function fetchSource(sourceUrl) {
  const validated = validateMediaSourceUrl(sourceUrl);
  if (!validated.ok) return { state: 'FAILED', errorCode: validated.code, sourceUrl };
  const response = await fetch(validated.url, {
    method: 'GET', redirect: 'manual', headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
  });
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) return { state: 'FAILED', errorCode: 'MEDIA_TOO_LARGE', sourceUrl: validated.url };
  const bytes = await response.arrayBuffer();
  const classification = classifyMediaResponse({
    status: response.status,
    contentType: response.headers.get('content-type'),
    contentLength,
    bytes: bytes.byteLength,
  });
  if (!classification.ok) return { ...classification, sourceUrl: validated.url };
  return { ...classification, sourceUrl: validated.url, bytes, hash: await sha256(bytes), contentType: response.headers.get('content-type') };
}

async function uploadToCloudinary(item, env) {
  const config = getCloudinaryConfig(env);
  const publicId = `tintin_shopify_phase2_${mediaId(item.mediaId)}_${item.hash.slice(0, 16)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await cloudinarySignature({ overwrite: 'true', public_id: publicId, timestamp }, config.apiSecret);
  const form = new FormData();
  form.append('file', new Blob([item.bytes], { type: item.contentType }), `${publicId}.image`);
  form.append('api_key', config.apiKey);
  form.append('public_id', publicId);
  form.append('overwrite', 'true');
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.secure_url) throw new Error(body?.error?.message || `Cloudinary respondió HTTP ${response.status}`);
  return { canonicalUrl: body.secure_url, publicId, hash: item.hash, state: 'COPIED' };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!origin || !originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, request.url);
  try {
    const actor = await requireSuperAdmin(request);
    const body = await request.json();
    const action = clean(body?.action, 20).toLowerCase();
    const items = Array.isArray(body?.media) ? body.media.slice(0, MAX_ITEMS) : [];
    if (!items.length) throw new Error('Se requiere al menos un media source.');
    const validated = [];
    for (const item of items) {
      const result = await fetchSource(item?.sourceUrl);
      validated.push({ mediaId: mediaId(item?.mediaId || item?.sourceUrl), position: Number(item?.position) || 0, featured: item?.featured === true, ...result, bytes: undefined });
    }
    if (action === 'validate' || action === 'dry-run') {
      return jsonResponse({ ok: true, action: 'validate', actorUid: actor.uid, media: validated, migration: 'not-executed' }, 200, origin, request.url);
    }
    if (action !== 'copy') throw new Error('Acción media inválida. Usá validate, dry-run o copy.');
    if (env.SHOPIFY_PHASE2_MEDIA_WRITE !== '1') throw Object.assign(new Error('Media copy bloqueado: requiere guard explícito de staging.'), { status: 409 });
    const copied = [];
    for (const item of items) {
      const fetched = await fetchSource(item?.sourceUrl);
      if (!fetched.ok) { copied.push({ mediaId: mediaId(item?.mediaId || item?.sourceUrl), state: 'FAILED', errorCode: fetched.errorCode }); continue; }
      copied.push({ mediaId: mediaId(item?.mediaId || item?.sourceUrl), ...(await uploadToCloudinary({ ...fetched, mediaId: item?.mediaId || item?.sourceUrl }, env)) });
    }
    return jsonResponse({ ok: true, action: 'copy', actorUid: actor.uid, media: copied, migration: 'staging-only' }, 200, origin, request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: clean(error?.message || 'Media migration failed.') }, Number(error?.status) || 400, origin, request.url);
  }
}
