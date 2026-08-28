import {
  decodeFirestoreFields,
  firestoreAdminGet
} from '../cloudflare/firebase-admin-ligero.js';

const PUBLIC_ORIGIN = 'https://tintinaccesorios.pages.dev';
const CLOUDINARY_HOST = 'res.cloudinary.com';
const CLOUDINARY_UPLOAD = '/upload/';
const PRODUCT_METADATA_CEILING_MS = 1400;
const CLOUDINARY_TINTIN_TRANSFORM = /^f_auto,q_auto,c_limit,w_\d+,dpr_auto\//;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstValue(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function firstImage(data) {
  const direct = firstValue(data, ['imageUrl', 'image', 'img', 'photo', 'imageSrc', 'image_src', 'Variant Image', 'Image Src']);
  if (direct) return String(direct);
  for (const key of ['images', 'imagesExtra']) {
    const list = data?.[key];
    if (Array.isArray(list)) {
      const candidate = list.find(item => typeof item === 'string' ? item.trim() : item?.url || item?.src);
      if (candidate) return typeof candidate === 'string' ? candidate : String(candidate.url || candidate.src || '');
    }
  }
  return `${PUBLIC_ORIGIN}/assets/og-cover.jpg`;
}

function absoluteUrl(value) {
  try {
    return new URL(String(value || ''), PUBLIC_ORIGIN).toString();
  } catch {
    return `${PUBLIC_ORIGIN}/assets/og-cover.jpg`;
  }
}

function productImageUrl(value, width = 900) {
  const href = absoluteUrl(value);
  try {
    const url = new URL(href);
    if (url.hostname !== CLOUDINARY_HOST) return href;
    const index = url.pathname.indexOf(CLOUDINARY_UPLOAD);
    if (index === -1) return href;
    const insertAt = index + CLOUDINARY_UPLOAD.length;
    const before = url.pathname.slice(0, insertAt);
    const after = url.pathname.slice(insertAt).replace(CLOUDINARY_TINTIN_TRANSFORM, '');
    url.pathname = `${before}f_auto,q_auto,c_limit,w_${width},dpr_auto/${after}`;
    return url.href;
  } catch {
    return href;
  }
}

function replaceMeta(html, selectorName, value, attribute = 'name') {
  const safe = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${selectorName}["'][^>]*>`, 'i');
  const tag = `<meta ${attribute}="${selectorName}" content="${safe}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function replaceCanonical(html, value) {
  const tag = `<link rel="canonical" href="${escapeHtml(value)}">`;
  const pattern = /<link\s+rel=["']canonical["'][^>]*>/i;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function replaceTitle(html, value) {
  const tag = `<title>${escapeHtml(value)}</title>`;
  return /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, tag)
    : html.replace('</head>', `  ${tag}\n</head>`);
}

function productJsonLd({ id, name, description, image, canonical, price, active, stock, sku }) {
  const numericPrice = Number(price);
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonical}#product`,
    name,
    description,
    image: [image],
    url: canonical,
    sku: String(sku || id),
    brand: { '@type': 'Brand', name: 'Tintin Accesorios & Relojes' }
  };
  if (Number.isFinite(numericPrice) && numericPrice >= 0) {
    payload.offers = {
      '@type': 'Offer',
      priceCurrency: 'PYG',
      price: String(Math.trunc(numericPrice)),
      url: canonical,
      availability: active !== false && Number(stock ?? 1) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock'
    };
  }
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

/**
 * Render puro compartido por Cloudflare y por el servidor determinista de CI.
 * Mantener la transformación en una sola función impide que la prueba valide
 * una copia distinta del comportamiento que realmente recibe Google/WhatsApp.
 */
export function renderProductMetadataHtml(sourceHtml, id, data) {
  const safeId = String(id || '').trim();
  if (!safeId || !/^[A-Za-z0-9_-]{1,180}$/.test(safeId)) {
    throw new Error('product_id_invalid');
  }

  const name = stripHtml(firstValue(data, ['name', 'title', 'Title'])) || 'Producto Tintin';
  const rawDescription = firstValue(data, ['description', 'desc', 'Body (HTML)']);
  const description = (stripHtml(rawDescription) || `${name} disponible en Tintin Accesorios & Relojes.`).slice(0, 220);
  const image = absoluteUrl(firstImage(data));
  const mainImage = productImageUrl(image, 900);
  const canonical = `${PUBLIC_ORIGIN}/product?id=${encodeURIComponent(safeId)}`;
  const price = firstValue(data, ['price', 'Variant Price']);
  const title = `${name} | Tintin Accesorios & Relojes`;

  let html = String(sourceHtml || '');
  html = replaceTitle(html, title);
  html = replaceCanonical(html, canonical);
  html = replaceMeta(html, 'description', description);
  html = replaceMeta(html, 'og:title', title, 'property');
  html = replaceMeta(html, 'og:description', description, 'property');
  html = replaceMeta(html, 'og:image', image, 'property');
  html = replaceMeta(html, 'og:url', canonical, 'property');
  html = replaceMeta(html, 'og:type', 'product', 'property');
  html = replaceMeta(html, 'twitter:title', title);
  html = replaceMeta(html, 'twitter:description', description);
  html = replaceMeta(html, 'twitter:image', image);
  html = replaceMeta(html, 'twitter:card', 'summary_large_image');

  const ld = productJsonLd({
    id: safeId,
    name,
    description,
    image,
    canonical,
    price,
    active: data?.active,
    stock: firstValue(data, ['stock', 'Variant Inventory Qty']),
    sku: firstValue(data, ['handle', 'Handle'])
  });
  const performanceHints = `<link rel="preload" as="image" href="${escapeHtml(mainImage)}" fetchpriority="high" id="tt-product-image-preload">`;
  html = html.replace('</head>', `  ${performanceHints}\n  <script type="application/ld+json" id="tt-product-jsonld-server">${ld}</script>\n</head>`);

  return { html, canonical, image, mainImage };
}

/**
 * La metadata server-side mejora SEO y previews, pero no puede bloquear la ficha.
 * Si OAuth/Firestore tarda demasiado se entrega el HTML base y el runtime cliente
 * continúa cargando el producto normalmente.
 */
export function resolveProductMetadataWithin(promise, ceilingMs = PRODUCT_METADATA_CEILING_MS) {
  const limit = Math.max(100, Number(ceilingMs) || PRODUCT_METADATA_CEILING_MS);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('product_metadata_timeout'));
    }, limit);
    Promise.resolve(promise).then(
      value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  // El binding ASSETS ya resuelve la ruta limpia /product al documento estático.
  // Pedir /product.html explícitamente provoca que Pages lo canonice de vuelta a
  // /product con 308; por eso conservamos exactamente la URL pública al leer el asset.
  const asset = await env.ASSETS.fetch(request);
  if (request.method === 'HEAD') return asset;
  if (!asset.ok || !(asset.headers.get('content-type') || '').includes('text/html')) return asset;

  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') || '').trim();
  if (!id || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) return asset;

  try {
    const document = await resolveProductMetadataWithin(
      firestoreAdminGet(env, `products/${id}`)
    );
    if (!document?.fields) return asset;
    const data = decodeFirestoreFields(document.fields);
    if (data.active === false) return asset;

    const rendered = renderProductMetadataHtml(await asset.text(), id, data);
    const headers = new Headers(asset.headers);
    headers.set('cache-control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300');
    headers.set('x-tintin-product-meta', 'server');
    headers.set('x-tintin-product-image-preload', 'server');
    headers.delete('content-length');
    return new Response(rendered.html, { status: asset.status, statusText: asset.statusText, headers });
  } catch (error) {
    const reason = error?.message || error;
    if (reason === 'product_metadata_timeout') {
      console.warn('[product-meta] metadata omitida por tiempo máximo; se entrega la ficha base.');
    } else {
      console.error('[product-meta] no se pudo renderizar metadata:', reason);
    }
    return asset;
  }
}
