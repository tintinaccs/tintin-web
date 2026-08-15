import {
  decodeFirestoreFields,
  firestoreAdminListAll
} from '../cloudflare/firebase-admin-ligero.js';

const PUBLIC_ORIGIN = 'https://tintinaccesorios.pages.dev';

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

function isoDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  try {
    const documents = await firestoreAdminListAll(env, 'products', 1000);
    const rows = documents.flatMap(document => {
      const id = documentId(document);
      if (!id) return [];
      const data = decodeFirestoreFields(document?.fields || {});
      if (data.active === false) return [];
      const loc = `${PUBLIC_ORIGIN}/product?id=${encodeURIComponent(id)}`;
      const lastmod = isoDate(
        data.updatedAt || data.updated_at || data.modifiedAt || data.catalogActivityAt || document.updateTime
      );
      return [`  <url>\n    <loc>${xml(loc)}</loc>${lastmod ? `\n    <lastmod>${xml(lastmod)}</lastmod>` : ''}\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`];
    });

    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
    const headers = {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      'x-content-type-options': 'nosniff'
    };
    return request.method === 'HEAD'
      ? new Response(null, { status: 200, headers })
      : new Response(body, { status: 200, headers });
  } catch (error) {
    console.error('[sitemap-products] error:', error?.message || error);
    return new Response('Sitemap temporalmente no disponible', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
