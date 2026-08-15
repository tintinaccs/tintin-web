import {
  firestoreAdminFindFirstByFields,
  firestoreAdminGet
} from '../../cloudflare/firebase-admin-ligero.js';

function safeHandle(value) {
  const handle = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,179}$/.test(handle) ? handle : '';
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
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
    // Algunos catálogos importados usan el handle como ID. Esa ruta evita una
    // consulta adicional; si no coincide, se buscan los nombres históricos
    // de campo usados por exportaciones Shopify y normalizaciones anteriores.
    let document = await firestoreAdminGet(env, `products/${handle}`);
    if (!document) {
      document = await firestoreAdminFindFirstByFields(
        env,
        'products',
        ['handle', 'Handle', 'slug', 'shopifyHandle'],
        handle
      );
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
