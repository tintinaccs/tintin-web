import {
  decodeFirestoreFields,
  firestoreAdminGet
} from '../cloudflare/firebase-admin-ligero.js';

const PUBLIC_ORIGIN = 'https://tintinaccesorios.pages.dev';

function plain(value, max = 220) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function escapeAttr(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function safeImage(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 2048) return `${PUBLIC_ORIGIN}/assets/og-cover.jpg`;
  try {
    const url = new URL(raw, PUBLIC_ORIGIN);
    return url.protocol === 'https:' ? url.href : `${PUBLIC_ORIGIN}/assets/og-cover.jpg`;
  } catch {
    return `${PUBLIC_ORIGIN}/assets/og-cover.jpg`;
  }
}

function replaceTag(html, id, attribute, value) {
  const escaped = escapeAttr(value);
  const pattern = new RegExp(`(<(?:meta|link)\\b[^>]*\\bid=["']${id}["'][^>]*\\b${attribute}=["'])[^"']*(["'][^>]*>)`, 'i');
  return html.replace(pattern, `$1${escaped}$2`);
}

function productJsonLd(product, id, canonical, image) {
  const price = Number(product.price ?? product['Variant Price']);
  const stock = product.stock ?? product['Variant Inventory Qty'];
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonical}#product`,
    name: plain(product.name || product.title || product.Title, 180),
    description: plain(product.description || product.desc || product['Body (HTML)'], 500),
    image: [image],
    sku: String(id),
    brand: { '@type': 'Brand', name: 'Tintin Accesorios & Relojes' },
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'PYG',
      price: Number.isFinite(price) ? price : 0,
      availability: Number(stock) <= 0
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition'
    }
  };
}

function injectMetadata(html, product, id) {
  const name = plain(product.name || product.title || product.Title, 180) || 'Producto Tintin';
  const description = plain(product.description || product.desc || product['Body (HTML)'], 220)
    || `${name} — Tintin Accesorios & Relojes, Paraguay.`;
  const canonical = `${PUBLIC_ORIGIN}/product?id=${encodeURIComponent(id)}`;
  const image = safeImage(
    product.imageUrl || product.image || product.img || product.photo || product.imageSrc
    || product.image_src || product['Image Src'] || product['Variant Image']
  );
  const title = `${name} | TINTIN Accesorios & Relojes`;

  let output = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);
  output = replaceTag(output, 'meta-description', 'content', description);
  output = replaceTag(output, 'meta-og-title', 'content', title);
  output = replaceTag(output, 'meta-og-description', 'content', description);
  output = replaceTag(output, 'meta-og-image', 'content', image);
  output = replaceTag(output, 'meta-og-url', 'content', canonical);
  output = replaceTag(output, 'meta-twitter-title', 'content', title);
  output = replaceTag(output, 'meta-twitter-description', 'content', description);
  output = replaceTag(output, 'meta-twitter-image', 'content', image);
  output = replaceTag(output, 'link-canonical', 'href', canonical);

  const json = JSON.stringify(productJsonLd(product, id, canonical, image)).replace(/</g, '\\u003c');
  const script = `<script type="application/ld+json" id="tt-product-jsonld">${json}</script>`;
  if (/<script\b[^>]*id=["']tt-product-jsonld["']/i.test(output)) {
    output = output.replace(/<script\b[^>]*id=["']tt-product-jsonld["'][^>]*>[\s\S]*?<\/script>/i, script);
  } else {
    output = output.replace(/<\/head>/i, `${script}\n</head>`);
  }
  return output;
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();

  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') || '').trim();
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) return context.next();

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-tintin-product-meta', 'edge-cache');
    return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers })
      : new Response(cached.body, { status: cached.status, headers });
  }

  const assetResponse = await context.next();
  if (!assetResponse.ok || !(assetResponse.headers.get('content-type') || '').includes('text/html')) {
    return assetResponse;
  }

  try {
    const document = await firestoreAdminGet(env, `products/${id}`);
    const product = document ? decodeFirestoreFields(document.fields || {}) : null;
    if (!product || product.active === false) return assetResponse;

    const name = plain(product.name || product.title || product.Title, 180);
    const price = Number(product.price ?? product['Variant Price']);
    if (!name || !Number.isFinite(price) || price <= 0) return assetResponse;

    const sourceHtml = await assetResponse.text();
    const html = injectMetadata(sourceHtml, product, id);
    const headers = new Headers(assetResponse.headers);
    headers.set('cache-control', 'public, max-age=30, s-maxage=60');
    headers.set('x-tintin-product-meta', 'edge');
    headers.set('x-content-type-options', 'nosniff');
    const response = new Response(request.method === 'HEAD' ? null : html, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers
    });
    const cacheable = new Response(html, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    const task = cache.put(cacheKey, cacheable);
    if (typeof waitUntil === 'function') waitUntil(task);
    else await task;
    return response;
  } catch (error) {
    console.error(JSON.stringify({ message: 'product edge metadata failed', id, error: error?.message || String(error) }));
    return assetResponse;
  }
}
