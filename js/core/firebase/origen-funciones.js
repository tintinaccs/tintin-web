// =============================================================
// TINTIN — Origen compartido para las funciones /api/* de Cloudflare Pages
//
// El sitio se publica en GitHub Pages (ver robots.txt, sitemap.xml y los
// canonical de cada página), pero las funciones /api/* (Cloudinary, geo,
// email) corren en Cloudflare Pages. Un fetch a una ruta relativa como
// "/api/order-email" funciona en Cloudflare (mismo origen) pero da 404 en
// github.io o netlify.app. Este módulo centraliza esa detección para que
// cada llamador no tenga que reinventarla (y olvidarla, como pasaba antes).
// =============================================================

const CLOUDFLARE_FALLBACK_ORIGIN = 'https://tintinaccesorios.pages.dev';

export function functionOrigin() {
  // Fuera del navegador —los tests— no hay `window`, y leerlo directamente
  // lanzaba ReferenceError: cualquier módulo que use apiUrl() se volvía
  // imposible de probar sin un DOM. Se devuelve la ruta relativa, que es lo
  // que esperan los stubs de fetch.
  if (typeof window === 'undefined') return '';

  const configured = String(window.TINTIN_FUNCTION_ORIGIN || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  const hostname = String(window.location.hostname || '').toLowerCase();
  if (hostname.endsWith('github.io') || hostname.endsWith('netlify.app')) {
    return CLOUDFLARE_FALLBACK_ORIGIN;
  }

  // En Cloudflare Pages, un dominio propio o desarrollo local, las
  // funciones viven bajo el mismo origen que el sitio.
  return '';
}

export function apiUrl(name) {
  return `${functionOrigin()}/api/${name}`;
}