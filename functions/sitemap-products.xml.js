import {
  decodeFirestoreFields,
  firestoreAdminListAll
} from '../cloudflare/firebase-admin-ligero.js';

const PUBLIC_ORIGIN = 'https://tintinaccesorios.pages.dev';

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const cache = caches.default;
  const cacheKey = new Request(new URL('/sitemap-products.xml', request.url).toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-tintin-cache', 'hit');
    return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers })
      : new Response(cached.body, { status: cached.status, headers });
  }

  try {
    const docs = await firestoreAdminListAll(env, 'products', 5000);
    const products = docs.map(document => ({
      id: documentId(document),
      data: decodeFirestoreFields(document?.fields || {})
    })).filter(item => {
      if (!item.id || item.data.active === false) return false;
      const name = String(item.data.name || item.data.title || item.data.Title || '').trim();
      const price = Number(item.data.price ?? item.data['Variant Price']);
      return Boolean(name) && Number.isFinite(price) && price > 0;
    });

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...products.map(({ id, data }) => {
        const lastmod = normalizeDate(data.updatedAt || data.updated_at || data.modifiedAt || data.restockedAt || data.catalogActivityAt);
        const loc = `${PUBLIC_ORIGIN}/product?id=${encodeURIComponent(id)}`;
        return `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      }),
      '</urlset>',
      ''
    ].join('\n');

    const response = new Response(request.method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=900',
        'x-content-type-options': 'nosniff',
        'x-tintin-cache': 'miss'
      }
    });
    const cacheable = new Response(body, { status: 200, headers: response.headers });
    const task = cache.put(cacheKey, cacheable);
    if (typeof waitUntil === 'function') waitUntil(task);
    else await task;
    return response;
  } catch (error) {
    console.error(JSON.stringify({ message: 'product sitemap failed', error: error?.message || String(error) }));
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      status: 503,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }
}
