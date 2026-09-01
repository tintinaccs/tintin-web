import { jsonResponse, originIsAllowed } from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  firestoreAdminListAll,
} from '../../cloudflare/firebase-admin-ligero.js';

const MAX_RECORDS = 5000;
const CACHE_TTL_MS = 10_000;
let cachedStats = null;
let cachedAt = 0;

function documentId(document) {
  return String(document?.name || '').split('/').pop();
}

function decode(document) {
  return document ? { id: documentId(document), ...decodeFirestoreFields(document.fields || {}) } : null;
}

function safeProductId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{1,180}$/.test(id) ? id : '';
}

function normalizeReviewStats(raw = {}) {
  const count = Math.max(0, Number(raw.count) || 0);
  const average = count ? Math.max(0, Math.min(5, Number(raw.average) || 0)) : 0;
  return { reviewCount: count, average };
}

export function buildPublicProductEngagementStats(likeDocuments = [], reviewStatDocuments = []) {
  const byProduct = new Map();

  for (const document of reviewStatDocuments) {
    const data = decode(document);
    const productId = safeProductId(data?.productId || data?.id);
    if (!productId) continue;
    byProduct.set(productId, {
      productId,
      likeCount: 0,
      ...normalizeReviewStats(data),
    });
  }

  for (const document of likeDocuments) {
    const data = decode(document);
    const productId = safeProductId(data?.productId);
    if (!productId) continue;
    const current = byProduct.get(productId) || {
      productId,
      likeCount: 0,
      reviewCount: 0,
      average: 0,
    };
    current.likeCount += 1;
    byProduct.set(productId, current);
  }

  return [...byProduct.values()]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map(item => ({
      productId: item.productId,
      likeCount: Math.max(0, Number(item.likeCount) || 0),
      reviewCount: Math.max(0, Number(item.reviewCount) || 0),
      average: Math.max(0, Math.min(5, Number(item.average) || 0)),
    }));
}

async function readStats(env, fresh) {
  const now = Date.now();
  if (!fresh && Array.isArray(cachedStats) && now - cachedAt < CACHE_TTL_MS) return cachedStats;
  const [likeDocuments, reviewStatDocuments] = await Promise.all([
    firestoreAdminListAll(env, 'likeRecords', MAX_RECORDS),
    firestoreAdminListAll(env, 'productReviewStats', MAX_RECORDS),
  ]);
  cachedStats = buildPublicProductEngagementStats(likeDocuments, reviewStatDocuments);
  cachedAt = now;
  return cachedStats;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';

  if (!originIsAllowed(origin, request.url)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);
  }

  try {
    const url = new URL(request.url);
    const stats = await readStats(env, url.searchParams.get('fresh') === '1');
    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers: { 'cache-control': 'private, no-store, max-age=0' } });
    }
    return jsonResponse({ ok: true, stats }, 200, origin, request.url);
  } catch (error) {
    console.error('[product-engagement-stats] no se pudieron calcular los contadores:', error?.message || error);
    return jsonResponse({ ok: false, error: 'No se pudieron cargar los contadores' }, 500, origin, request.url);
  }
}
