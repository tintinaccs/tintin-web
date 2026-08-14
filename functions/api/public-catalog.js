import {
  decodeFirestoreFields,
  firestoreAdminListAll
} from '../../cloudflare/firebase-admin-ligero.js';

const PRODUCT_FIELDS = new Set([
  'name', 'title', 'handle', 'category', 'collectionSlug', 'collection', 'cat', 'type',
  'price', 'priceBefore', 'badge', 'description', 'desc', 'material', 'measurements',
  'colorFinish', 'care', 'waterResistance', 'warranty', 'sizeFit', 'packageContents',
  'imageUrl', 'image', 'img', 'photo', 'imageSrc', 'image_src', 'imagesExtra', 'images',
  'stock', 'active', 'oferta', 'destacado', 'tags', 'variants', 'collectionOrder',
  'createdAt', 'created_at', 'importedAt', 'updatedAt', 'updated_at', 'modifiedAt',
  'restockedAt', 'catalogActivityAt', 'Image Src', 'Variant Image', 'Variant Price',
  'Variant Inventory Qty', 'Product Category', 'Category', 'Title', 'Handle', 'Body (HTML)'
]);
const COLLECTION_FIELDS = new Set(['name', 'title', 'description', 'image', 'imageUrl', 'order', 'visible']);

function pickKnownFields(data, allowed) {
  return Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.has(key)));
}

function normalizeResource(value) {
  return value === 'collections' ? 'collections' : value === 'products' ? 'products' : '';
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

async function buildPayload(env, resource) {
  const docs = await firestoreAdminListAll(env, resource, resource === 'products' ? 1000 : 300);
  const allowed = resource === 'products' ? PRODUCT_FIELDS : COLLECTION_FIELDS;
  const items = docs.map(document => ({
    id: documentId(document),
    data: pickKnownFields(decodeFirestoreFields(document?.fields || {}), allowed)
  })).filter(item => {
    if (!item.id) return false;
    if (resource === 'products') return item.data.active !== false;
    return item.data.visible !== false;
  });
  return { ok: true, resource, items, count: items.length };
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { allow: 'GET' } });
  }

  const url = new URL(request.url);
  const resource = normalizeResource(url.searchParams.get('resource'));
  if (!resource) {
    return Response.json({ ok: false, error: 'resource_invalid' }, {
      status: 400,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  }

  const cacheUrl = new URL(request.url);
  cacheUrl.search = '?resource=' + resource;
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-tintin-cache', 'hit');
    return new Response(cached.body, { status: cached.status, headers });
  }

  try {
    const payload = await buildPayload(env, resource);
    const response = Response.json(payload, {
      headers: {
        'cache-control': 'public, max-age=30, s-maxage=60',
        'x-content-type-options': 'nosniff',
        'x-tintin-cache': 'miss'
      }
    });
    const task = cache.put(cacheKey, response.clone());
    if (typeof waitUntil === 'function') waitUntil(task);
    else await task;
    return response;
  } catch (error) {
    console.error(JSON.stringify({ message: 'public-catalog failed', resource, error: error?.message || String(error) }));
    return Response.json({ ok: false, error: 'catalog_unavailable' }, {
      status: 502,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  }
}
