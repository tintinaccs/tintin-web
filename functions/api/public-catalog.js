import { homeProductIndex } from '../../cloudflare/indice-inicio.mjs';
import {productIsPublished} from '../../js/core/store/estado-editorial-producto.mjs';
import { wristCategory, unifyWristCollections } from '../../js/core/store/categorias-pulseras.mjs';
import {
  decodeFirestoreFields,
  firestoreAdminGet,
  firestoreAdminListAll
} from '../../cloudflare/firebase-admin-ligero.js';
import { rateLimit } from '../lib/operational-guard.js';

const PRODUCT_FIELDS = new Set([
  'sku', 'name', 'title', 'handle', 'category', 'collectionSlug', 'collection', 'cat', 'type',
  'price', 'priceBefore', 'badge', 'description', 'desc', 'material', 'measurements',
  'colorFinish', 'care', 'waterResistance', 'warranty', 'sizeFit', 'packageContents',
  'imageUrl', 'image', 'img', 'photo', 'imageSrc', 'image_src', 'imagesExtra', 'images',
  'publicationStatus','productTemplate','seoTitle','seoDescription', 'variantCommerceVersion', 'stock', 'active', 'oferta', 'destacado', 'tags', 'variants', 'variantMedia', 'variantInventory', 'collectionOrder',
  'createdAt', 'created_at', 'importedAt', 'updatedAt', 'updated_at', 'modifiedAt',
  'restockedAt', 'catalogActivityAt', 'merchandisingUpdatedAt', 'Image Src', 'Variant Image', 'Variant Price',
  'Variant Inventory Qty', 'Product Category', 'Category', 'Title', 'Handle', 'Body (HTML)'
]);
const COLLECTION_FIELDS = new Set(['name', 'title', 'description', 'image', 'imageUrl', 'order', 'visible']);
function allowRequest(request) {
  return rateLimit(request, { id: 'public-catalog', limit: 60, windowMs: 10_000 });
}

function pickKnownFields(data, allowed) {
  return Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.has(key)));
}

function normalizeResource(value) {
  return value === 'collections'
    ? 'collections'
    : value === 'products'
      ? 'products'
      : value === 'storeGate'
        ? 'storeGate'
        : '';
}

function normalizeProductId(value) {
  const id = String(value || '').trim();
  if (!id || id.length > 256 || /[\/?#\u0000-\u001f\u007f]/.test(id)) return '';
  return id;
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

async function buildPayload(env, resource, productId = '', productIds = []) {
  if (productIds.length) {
    const results = await Promise.all(productIds.map(id => buildPayload(env, 'products', id)));
    const items = results.map(result => result.item).filter(Boolean);
    return { ok: true, resource, items, count: items.length };
  }
  if (resource === 'storeGate') {
    const document = await firestoreAdminGet(env, 'settings/storeGate');
    // Documento inexistente no es "tienda cerrada confirmada" — firestore.rules
    // falla abierto en ese caso (isStoreOpenOrAllowed). Se distingue con
    // `exists` para que el cliente lo trate como no confirmado, no como cierre.
    if (!document) {
      return { ok: true, resource, exists: false, data: { storeOpen: false, maintenanceAccess: {} } };
    }
    const data = decodeFirestoreFields(document.fields || {});
    return {
      ok: true,
      resource,
      exists: true,
      data: {
        storeOpen: data.storeOpen === true,
        maintenanceAccess: data.maintenanceAccess && typeof data.maintenanceAccess === 'object'
          ? data.maintenanceAccess
          : {}
      }
    };
  }

  if (resource === 'products' && productId) {
    const document = await firestoreAdminGet(env, `products/${productId}`);
    if (!document) return { ok: true, resource, item: null };
    const data = pickKnownFields(decodeFirestoreFields(document?.fields || {}), PRODUCT_FIELDS);
    if (!productIsPublished(data)) return { ok: true, resource, item: null };
    return {
      ok: true,
      resource,
      item: {
        id: documentId(document) || productId,
        data
      }
    };
  }

  const docs = await firestoreAdminListAll(env, resource, resource === 'products' ? 5000 : 300, {failOnTruncation:true});
  const allowed = resource === 'products' ? PRODUCT_FIELDS : COLLECTION_FIELDS;
  let items = docs.map(document => ({
    id: documentId(document),
    data: pickKnownFields(decodeFirestoreFields(document?.fields || {}), allowed)
  })).filter(item => item.id);
  // Agrupar antes de filtrar: Pulseras oculta también su documento anterior.
  if (resource === 'collections') {
    items = unifyWristCollections(items.map(item => ({ slug: item.id, ...item.data, image: item.data.image || item.data.imageUrl || '' })))
      .map(item => ({ id: item.slug, data: pickKnownFields(item, COLLECTION_FIELDS) }));
  } else {
    items = items.map(item => {
      const category = wristCategory(item.data.category || item.data.cat || item.data.collectionSlug || item.data.collection || item.data.type || '');
      return category === 'pulseras' ? { ...item, data: { ...item.data, category } } : item;
    });
  }
  items = items.filter(item => {
    if (resource === 'products') return productIsPublished(item.data);
    return item.data.visible !== false;
  });
  return { ok: true, resource, items, count: items.length };
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { allow: 'GET' } });
  }

  const limiter = allowRequest(request);
  if (!limiter.allowed) {
    return Response.json({ ok: false, error: 'rate_limited' }, {
      status: 429,
      headers: {
        'cache-control': 'no-store',
        'retry-after': String(limiter.retryAfter),
        ...limiter.headers,
        'x-content-type-options': 'nosniff'
      }
    });
  }

  const url = new URL(request.url);
  const resource = normalizeResource(url.searchParams.get('resource'));
  if (!resource) {
    return Response.json({ ok: false, error: 'resource_invalid' }, {
      status: 400,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  }

  const requestedProductId = url.searchParams.get('id');
  const productId = requestedProductId == null ? '' : normalizeProductId(requestedProductId);
  if (requestedProductId != null && (resource !== 'products' || !productId)) {
    return Response.json({ ok: false, error: 'product_id_invalid' }, {
      status: 400,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  }

  let productIds = [];
  if (url.searchParams.has('ids')) {
    try {
      const requested = JSON.parse(url.searchParams.get('ids'));
      if (resource !== 'products' || requestedProductId != null || !Array.isArray(requested) || !requested.length || requested.length>30 || requested.some(id=>typeof id!=='string' || !normalizeProductId(id))) throw Error('invalid');
      productIds=[...new Set(requested.map(normalizeProductId))].sort();
    } catch {
      return Response.json({ok:false,error:'product_ids_invalid'},{status:400,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
    }
  }

  const homeIndex = url.searchParams.get('view') === 'home-index';
  if (url.searchParams.has('view') && (!homeIndex || resource !== 'products' || productId || productIds.length)) {
    return Response.json({ok:false,error:'catalog_view_invalid'},{status:400,headers:{'cache-control':'no-store'}});
  }
  const cacheUrl = new URL(request.url);
  cacheUrl.search = '?resource=' + resource + (productId ? '&id=' + encodeURIComponent(productId) : '');
  if (productIds.length) cacheUrl.searchParams.set('ids',JSON.stringify(productIds));
  if (homeIndex) cacheUrl.searchParams.set('view','home-index');
  if (resource === 'collections') cacheUrl.searchParams.set('schema', 'unified-v2');
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-tintin-cache', 'hit');
    return new Response(cached.body, { status: cached.status, headers });
  }

  try {
    // Índice y catálogo completo comparten el snapshot edge: abrir Buscar
    // después de Inicio no vuelve a recorrer Firestore.
    const fullUrl = new URL(cacheUrl);
    fullUrl.searchParams.delete('view');
    const fullKey = new Request(fullUrl.toString(), {method:'GET'});
    const base = homeIndex ? await cache.match(fullKey) : null;
    const payload = base ? await base.json() : await buildPayload(env, resource, productId, productIds);
    if (homeIndex && !base) {
      const task = cache.put(fullKey, Response.json(payload,{headers:{'cache-control':'public, max-age=5, s-maxage=10','x-content-type-options':'nosniff'}}));
      if(typeof waitUntil==='function')waitUntil(task);else await task;
    }
    if (homeIndex) {
      payload.items = homeProductIndex(payload.items);
      payload.count = payload.items.length;
    }
    const response = Response.json(payload, {
      headers: {
        'cache-control': 'public, max-age=5, s-maxage=10',
        'x-content-type-options': 'nosniff',
        'x-tintin-cache': 'miss'
      }
    });
    const task = cache.put(cacheKey, response.clone());
    if (typeof waitUntil === 'function') waitUntil(task);
    else await task;
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      message: 'public-catalog failed',
      resource,
      productId: productId || undefined,
      error: error?.message || String(error)
    }));
    return Response.json({ ok: false, error: 'catalog_unavailable' }, {
      status: 502,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  }
}
