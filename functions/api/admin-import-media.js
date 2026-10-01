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
const MAX_BODY_BYTES = 96 * 1024;
const SOURCE_FETCH_TIMEOUT_MS = 20_000;
const MEDIA_COPY_EXTERNAL_SUBREQUESTS = 2;
const EXTERNAL_SUBREQUEST_RESERVE = 10;
const WORKER_FREE_SUBREQUEST_LIMIT = 50;

export function mediaCopyBatchLimit({
  limit = WORKER_FREE_SUBREQUEST_LIMIT,
  reserve = EXTERNAL_SUBREQUEST_RESERVE,
  requestsPerItem = MEDIA_COPY_EXTERNAL_SUBREQUESTS,
} = {}) {
  const safeLimit = Number(limit);
  const safeReserve = Number(reserve);
  const safeRequestsPerItem = Number(requestsPerItem);
  if (!Number.isInteger(safeLimit) || !Number.isInteger(safeReserve) || !Number.isInteger(safeRequestsPerItem)
    || safeLimit < 0 || safeReserve < 0 || safeRequestsPerItem < 1) return 0;
  return Math.max(0, Math.floor((safeLimit - safeReserve) / safeRequestsPerItem));
}

const MAX_COPY_ITEMS = mediaCopyBatchLimit();

export function mediaCopyPreflight(env = {}) {
  const reasons = [];
  const mediaWriteEnabled = env.SHOPIFY_PHASE2_MEDIA_WRITE === '1';
  if (!mediaWriteEnabled) reasons.push('MEDIA_COPY_DISABLED');
  let cloudinaryConfigured = true;
  try { getCloudinaryConfig(env); } catch { cloudinaryConfigured = false; }
  if (!cloudinaryConfigured) reasons.push('CLOUDINARY_NOT_CONFIGURED');
  return { ready: reasons.length === 0, mediaWriteEnabled, cloudinaryConfigured, reasons };
}

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

function mediaError(code, message) {
  return Object.assign(new Error(message), { code });
}

export async function readBoundedMediaBody(response, maxBytes = MAX_BYTES) {
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw mediaError('MEDIA_TOO_LARGE', 'La imagen supera el límite permitido.');
  }

  if (!response.body) return new ArrayBuffer(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw mediaError('MEDIA_TOO_LARGE', 'La imagen supera el límite permitido.');
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

export async function readBoundedRequestText(request, maxBytes = MAX_BODY_BYTES) {
  const declaredBytes = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    await request.body?.cancel().catch(() => {});
    throw Object.assign(new Error('Solicitud de medios demasiado grande.'), { status: 413 });
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw Object.assign(new Error('Solicitud de medios demasiado grande.'), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function fetchSource(sourceUrl) {
  const validated = validateMediaSourceUrl(sourceUrl);
  if (!validated.ok) return { state: 'FAILED', errorCode: validated.code, sourceUrl };
  let response;
  try {
    response = await fetch(validated.url, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
      headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return { state: 'FAILED', errorCode: timedOut ? 'MEDIA_TIMEOUT' : 'MEDIA_NETWORK_ERROR', sourceUrl: validated.url };
  }
  const contentLength = Number(response.headers.get('content-length'));
  let bytes;
  try {
    bytes = await readBoundedMediaBody(response, MAX_BYTES);
  } catch (error) {
    return { state: 'FAILED', errorCode: error?.code || 'MEDIA_READ_FAILED', sourceUrl: validated.url };
  }
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
    const raw = await readBoundedRequestText(request);
    if (!raw) throw new Error('La solicitud está vacía.');
    const body = JSON.parse(raw);
    const action = clean(body?.action, 20).toLowerCase();
    if (action === 'preflight') {
      return jsonResponse({
        ok: true,
        action,
        ...mediaCopyPreflight(env),
        maxCopyItems: MAX_COPY_ITEMS,
        migration: 'not-executed',
      }, 200, origin, request.url);
    }
    const items = Array.isArray(body?.media) ? body.media.slice(0, MAX_ITEMS) : [];
    if (!items.length) throw new Error('Se requiere al menos un media source.');
    if (action === 'validate' || action === 'dry-run') {
      const validated = [];
      for (const item of items) {
        const result = await fetchSource(item?.sourceUrl);
        validated.push({ mediaId: mediaId(item?.mediaId || item?.sourceUrl), position: Number(item?.position) || 0, featured: item?.featured === true, ...result, bytes: undefined });
      }
      return jsonResponse({ ok: true, action: 'validate', actorUid: actor.uid, media: validated, migration: 'not-executed' }, 200, origin, request.url);
    }
    if (action !== 'copy') throw new Error('Acción media inválida. Usá validate, dry-run o copy.');
    const readiness = mediaCopyPreflight(env);
    if (!readiness.ready) {
      const messages = [];
      if (readiness.reasons.includes('MEDIA_COPY_DISABLED')) messages.push('La copia de imágenes está desactivada en Cloudflare. Habilitá SHOPIFY_PHASE2_MEDIA_WRITE=1 durante la sesión de importación.');
      if (readiness.reasons.includes('CLOUDINARY_NOT_CONFIGURED')) messages.push('Cloudinary no está configurado en Cloudflare para copiar las imágenes.');
      throw Object.assign(new Error(messages.join(' ')), { status: 409 });
    }
    if (items.length > MAX_COPY_ITEMS) {
      throw Object.assign(new Error(`La copia admite hasta ${MAX_COPY_ITEMS} imágenes por lote.`), { status: 400 });
    }
    const copied = [];
    for (const item of items) {
      const fetched = await fetchSource(item?.sourceUrl);
      const identity = mediaId(item?.mediaId || item?.sourceUrl);
      if (!fetched.ok) { copied.push({ mediaId: identity, state: 'FAILED', errorCode: fetched.errorCode }); continue; }
      try {
        copied.push({ mediaId: identity, ...(await uploadToCloudinary({ ...fetched, mediaId: identity }, env)) });
      } catch {
        copied.push({ mediaId: identity, state: 'FAILED', errorCode: 'CLOUDINARY_UPLOAD_FAILED' });
      }
    }
    return jsonResponse({ ok: copied.every(item => item.state === 'COPIED'), action: 'copy', actorUid: actor.uid, media: copied, migration: 'staging-only' }, 200, origin, request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: clean(error?.message || 'Media migration failed.') }, Number(error?.status) || 400, origin, request.url);
  }
}
