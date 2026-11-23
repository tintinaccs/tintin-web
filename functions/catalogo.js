import {loadPublicCatalog, renderCatalogHtml} from '../cloudflare/catalogo-publico-seo.mjs';
import {resolveProductMetadataWithin} from './product.js';

// El catálogo completo necesita varias lecturas en frío; una ficha lee un solo producto.
const CATALOG_METADATA_CEILING_MS = 3500;

export async function onRequest(context) {
  const {request, env} = context;
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{allow:'GET, HEAD'}});
  const assetHeaders = new Headers(request.headers);
  assetHeaders.delete('if-none-match');
  assetHeaders.delete('if-modified-since');
  const asset = await env.ASSETS.fetch(new Request(request.url,{method:'GET',headers:assetHeaders}));
  if (!asset.ok || !asset.headers.get('content-type')?.includes('text/html')) return asset;
  try {
    const catalog = await resolveProductMetadataWithin(loadPublicCatalog(context), CATALOG_METADATA_CEILING_MS);
    const result = renderCatalogHtml(await asset.text(), new URL(request.url), catalog);
    const headers = new Headers(asset.headers);
    for (const name of ['content-length','content-encoding','etag','last-modified']) headers.delete(name);
    headers.set('cache-control',result.noindex ? 'no-store' : 'public, max-age=0, s-maxage=10');
    headers.set('x-tintin-catalog-html','server');
    if(result.noindex)headers.set('x-robots-tag','noindex, follow');
    return new Response(request.method === 'HEAD' ? null : result.html,{status:result.status,headers});
  } catch (error) {
    // Un fallo transitorio no se convierte en una categoría vacía indexable.
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '60',
        'x-tintin-catalog-html': error?.message === 'product_metadata_timeout' ? 'timeout' : 'unavailable',
      },
    });
  }
}
