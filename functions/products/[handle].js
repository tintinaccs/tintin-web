import {
  decodeFirestoreFields,
  firestoreAdminFindFirstByFields,
  firestoreAdminGet,
  firestoreAdminListAll
} from '../../cloudflare/firebase-admin-ligero.js';

let legacyFallbackMapPromise = null;

function safeHandle(value) {
  const handle = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,179}$/.test(handle) ? handle : '';
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

async function legacyFallbackMap(env) {
  if (!legacyFallbackMapPromise) {
    legacyFallbackMapPromise = firestoreAdminListAll(env, 'products', 1000)
      .then(documents => {
        const map = new Map();
        for (const document of documents) {
          const id = documentId(document);
          if (!id) continue;
          const data = decodeFirestoreFields(document?.fields || {});
          const keys = [
            data.handle,
            data.Handle,
            data.slug,
            data.shopifyHandle,
            data.name,
            data.title,
            data.Title
          ].map(slugify).filter(Boolean);
          keys.forEach(key => { if (!map.has(key)) map.set(key, document); });
        }
        return map;
      })
      .catch(error => {
        legacyFallbackMapPromise = null;
        throw error;
      });
  }
  return legacyFallbackMapPromise;
}

function permanentRedirect(request, path) {
  const target = new URL(path, request.url);
  return new Response(null, {
    status: 301,
    headers: {
      location: target.toString(),
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      'x-tintin-legacy-route': 'shopify-product'
    }
  });
}

export async function onRequest({ request, env, params }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const handle = safeHandle(params?.handle);
  if (!handle) return new Response('Producto no encontrado', { status: 404, headers: { 'cache-control': 'no-store' } });

  try {
    let document = await firestoreAdminGet(env, `products/${handle}`);

    if (!document) {
      document = await firestoreAdminFindFirstByFields(
        env,
        'products',
        ['handle', 'Handle', 'slug', 'shopifyHandle'],
        handle
      );
    }

    if (!document) {
      document = (await legacyFallbackMap(env)).get(handle) || null;
    }

    const id = documentId(document);
    if (!id) {
      return new Response('Producto no encontrado', {
        status: 404,
        headers: {
          'cache-control': 'public, max-age=300',
          'x-tintin-legacy-route': 'shopify-product-miss'
        }
      });
    }

    return permanentRedirect(request, `/product?id=${encodeURIComponent(id)}`);
  } catch (error) {
    console.error('[shopify-product-redirect] no se pudo resolver handle:', handle, error?.message || error);
    return new Response('No se pudo resolver temporalmente el producto', {
      status: 503,
      headers: { 'cache-control': 'no-store', 'retry-after': '60' }
    });
  }
}
