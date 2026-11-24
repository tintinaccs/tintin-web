function safeHandle(value) {
  const handle = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,179}$/.test(handle) ? handle : '';
}

function redirect(request, path) {
  return new Response(null, {
    status: 301,
    headers: {
      location: new URL(path, request.url).toString(),
      'cache-control': 'public, max-age=300',
      'x-tintin-legacy-route': 'shopify-collection'
    }
  });
}

function notFound(request) {
  return new Response(request.method === 'HEAD' ? null : 'Colección no encontrada', {
    status: 404,
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, follow' }
  });
}

export async function onRequest(context) {
  const { request, params } = context;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  const handle = safeHandle(params?.handle);
  if (!handle) return notFound(request);
  if (handle === 'all' || handle === 'todos') return redirect(request, '/catalogo');

  const slug = normalizeCollectionSlug(handle);
  if (slug !== 'accesorios') {
    try {
      const collections = await publicResource(context, 'collections');
      if (!collections.some(row => normalizeCollectionSlug(row.id) === slug)) return notFound(request);
    } catch {
      return new Response(request.method === 'HEAD' ? null : 'Catálogo temporalmente no disponible', {
        status: 503,
        headers: { 'cache-control': 'no-store', 'retry-after': '60' }
      });
    }
  }
  return redirect(request, `/catalogo?cat=${encodeURIComponent(slug)}`);
}
import { publicResource } from '../../cloudflare/catalogo-publico-seo.mjs';
import { normalizeCollectionSlug } from '../../js/core/store/colecciones-publicas.mjs';
