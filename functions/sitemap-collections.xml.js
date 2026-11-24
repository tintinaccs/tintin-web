import {loadPublicCatalog, CATALOG_PAGE_SIZE} from '../cloudflare/catalogo-publico-seo.mjs';
import {catalogUrl} from '../js/core/store/seo-catalogo.mjs';
import {categoryMatches} from '../js/core/store/colecciones-publicas.mjs';

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}



export async function onRequest(context) {
  const {request} = context;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  try {
    const {products, collections} = await loadPublicCatalog(context);
    const slugs = ['', 'accesorios', ...collections.map(row => row.slug)];
    const locations = [...new Set(slugs.flatMap(slug => {
      const count = products.filter(product => categoryMatches(product, slug)).length;
      const firstPage = slug ? 1 : 2; // /catalogo ya se publica en sitemap-pages.xml.
      const pageCount = Math.ceil(count / CATALOG_PAGE_SIZE);
      return Array.from({length:Math.max(0, pageCount - firstPage + 1)}, (_, i) => catalogUrl(slug, i + firstPage));
    }))];
    const rows = locations.map(loc => `  <url>\n    <loc>${xml(loc)}</loc>\n  </url>`);

    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
    const headers = {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=10',
      'x-content-type-options': 'nosniff'
    };
    return request.method === 'HEAD'
      ? new Response(null, { status: 200, headers })
      : new Response(body, { status: 200, headers });
  } catch (error) {
    console.error('[sitemap-collections] error:', error?.message || error);
    return new Response('Sitemap temporalmente no disponible', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
