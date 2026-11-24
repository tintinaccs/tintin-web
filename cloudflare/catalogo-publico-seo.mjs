import {interfaceLabel} from '../js/core/store/texto-interfaz.mjs';
import {
  catalogUrl, categoryCopy, catalogMetadata, catalogTitle, catalogPaginationUrl,
  CATALOG_PAGE_SIZE, CATALOG_ROBOTS_INDEXABLE
} from '../js/core/store/seo-catalogo.mjs';
export {CATALOG_PAGE_SIZE};
import {productSearchScore} from '../js/core/store/busqueda-productos.mjs';
import { onRequest as publicCatalog } from '../functions/api/public-catalog.js';
import { hasPublicProductFields } from '../js/core/store/publicacion-producto.mjs';
import { normalizeCollectionSlug, categoryMatches } from '../js/core/store/colecciones-publicas.mjs';
import { hasProductStock, productDefaultPrice } from '../js/core/store/inventario-variantes.mjs';

export const PUBLIC_ORIGIN = 'https://tintinaccs.com';
export const htmlText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Mismo allowlist, publicación, unificación y caché edge que el cliente.
// Ningún renderer vuelve a leer o serializar campos administrativos.
export async function publicResource(context, resource) {
  const url = new URL('/api/public-catalog', context.request.url);
  url.searchParams.set('resource', resource);
  const response = await publicCatalog({ ...context, request: new Request(url, {headers: context.request.headers}) });
  if (!response.ok) throw new Error('public_catalog_unavailable');
  const payload = await response.json();
  if (!payload.ok || !Array.isArray(payload.items)) throw new Error('public_catalog_invalid');
  return payload.items;
}

export function visibleCatalog(productRows, collectionRows) {
  const collections = collectionRows.map(row => ({slug: normalizeCollectionSlug(row.id), ...row.data})).filter(row => row.visible !== false);
  const allowed = new Set(collections.map(row => row.slug));
  const products = productRows.map(row => ({...row.data, id:row.id,
    name: row.data.name || row.data.title || row.data.Title,
    category: normalizeCollectionSlug(row.data.category || row.data.cat || row.data.collectionSlug || row.data.collection || row.data.type),
    price: row.data.price ?? row.data['Variant Price'],
  })).filter(product => /^[A-Za-z0-9_-]{1,180}$/.test(product.id) && hasPublicProductFields(product) && allowed.has(product.category));
  return {products, collections};
}

export async function loadPublicCatalog(context) {
  const [products, collections] = await Promise.all([publicResource(context, 'products'), publicResource(context, 'collections')]);
  return visibleCatalog(products, collections);
}

export function replaceCatalogHead(html, {title, description, canonical, noindex}) {
  let output = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${htmlText(title)}</title>`)
    .replace(/<link\s+rel="canonical"[^>]*>/i, () => `<link rel="canonical" href="${htmlText(canonical)}">`);
  for (const [attribute, name, value] of [['name','description',description], ['name','robots',noindex ? 'noindex, follow' : CATALOG_ROBOTS_INDEXABLE],
    ['property','og:title',title], ['property','og:description',description], ['property','og:url',canonical],
    ['name','twitter:title',title], ['name','twitter:description',description]]) {
    const regex = new RegExp(`<meta\\s+${attribute}="${name}"[^>]*>`, 'i');
    const tag = `<meta ${attribute}="${name}" content="${htmlText(value)}">`;
    output = regex.test(output) ? output.replace(regex, () => tag) : output.replace('</head>', () => tag + '</head>');
  }
  return output;
}

export function renderCatalogHtml(source, url, catalog) {
  const meta = catalogMetadata(url);
  const collection = catalog.collections.find(row => row.slug === meta.slug);
  const query = url.searchParams.get('q') || '';
  const all = catalog.products.filter(product => categoryMatches(product, meta.slug)
      && (!query || productSearchScore(product, query) > 0)
      && (url.searchParams.get('stock') !== '1' || hasProductStock(product)))
    .sort((a,b) => Number(hasProductStock(b)) - Number(hasProductStock(a)) || String(a.name).localeCompare(String(b.name), 'es') || a.id.localeCompare(b.id));
  const unknown = meta.slug && meta.slug !== 'accesorios' && !collection;
  const invalid = unknown || meta.page < 1 || meta.page > Math.max(1, Math.ceil(all.length / CATALOG_PAGE_SIZE));
  const [heading, description] = categoryCopy(meta.slug, interfaceLabel(collection?.name || collection?.title));
  const noindex = invalid || !all.length || meta.filtered;
  let html = replaceCatalogHead(source, {title:catalogTitle(heading, meta.page), description, canonical:meta.canonical, noindex});
  html = html.replace(/(<h1[^>]*id="cat-titulo"[^>]*>)[\s\S]*?<\/h1>/,
    (_, open) => `${open}${htmlText(invalid ? 'Categoría o página no encontrada' : heading)}</h1>`);
  const products = invalid ? [] : all.slice((meta.page - 1) * CATALOG_PAGE_SIZE, meta.page * CATALOG_PAGE_SIZE);
  const cards = products.map(product => {
    const link = `/product?id=${encodeURIComponent(product.id)}`;
    const image = product.imageUrl || product.image || '';
    const safeImage = /^https:\/\//i.test(image) ? image : '';
    const state = !hasProductStock(product) ? 'Agotado' : /bajo pedido/i.test(product.description || product.desc || '') ? 'Bajo pedido · sujeto a confirmación' : 'Disponible';
    return `<article class="tt-card" data-product-id="${htmlText(product.id)}"><a class="tt-card-link" href="${link}">${safeImage ? `<img src="${htmlText(safeImage)}" alt="${htmlText(product.name)}" width="480" height="480" loading="lazy" decoding="async">` : ''}<div class="tt-card-info"><h2>${htmlText(product.name)}</h2><p>Gs. ${Number(productDefaultPrice(product).price).toLocaleString('es-PY')}</p><p>${state}</p></div></a></article>`;
  }).join('') || '<p class="cat-empty">No hay productos para esta selección. <a href="/catalogo">Ver todo el catálogo</a></p>';
  html = html.replace(/(<div class="cat-grid" id="cat-grid"[^>]*>)[\s\S]*?(<!-- cat-grid-end -->)/,
    (_, open, end) => open.replace('aria-busy="true"', 'aria-busy="false"') + cards + '</div>' + end);
  const links = catalog.collections.filter(row => catalog.products.some(product => categoryMatches(product, row.slug)))
    .map(row => `<a href="${htmlText(catalogUrl(row.slug))}">${htmlText(interfaceLabel(row.name || row.title || row.slug))}</a>`).join(' · ');
  const nav = `<nav aria-label="Categorías">${links} · <a href="/catalogo?cat=accesorios">Accesorios</a></nav>`;
  const pages = `<nav aria-label="Páginas del catálogo">${Array.from({length:Math.ceil(all.length / CATALOG_PAGE_SIZE)}, (_,i) => `<a href="${htmlText(catalogPaginationUrl(url,meta.slug,i+1))}"${i+1 === meta.page ? ' aria-current="page"' : ''}>${i+1}</a>`).join(' · ')}</nav>`;
  html = html.replace('<!-- cat-grid-end -->', () => `<!-- cat-grid-end -->${nav}${pages}`);
  const graph = [
    {'@type':'CollectionPage','@id':meta.canonical,name:heading,url:meta.canonical,description},
    {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Inicio',item:PUBLIC_ORIGIN+'/'},{'@type':'ListItem',position:2,name:heading,item:meta.canonical}]},
    {'@type':'ItemList',itemListElement:products.map((product,i) => ({'@type':'ListItem',position:(meta.page-1)*CATALOG_PAGE_SIZE+i+1,name:product.name,url:PUBLIC_ORIGIN+`/product?id=${encodeURIComponent(product.id)}`}))},
  ];
  html = html.replace('</head>', () => `<script type="application/ld+json" id="tt-catalog-jsonld">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script></head>`);
  return {html, status:invalid ? 404 : 200, noindex};
}
