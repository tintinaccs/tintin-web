// =============================================================
// TINTIN — origen compartido para las funciones /api/* de Cloudflare Pages.
//
// Cloudflare Pages es el host web/backend canónico. GitHub Pages y Netlify
// solo se consideran superficies de fallback o preview: si el frontend llega
// a ejecutarse allí, sus llamadas /api/* deben volver al origen Cloudflare.
// =============================================================

const CLOUDFLARE_FALLBACK_ORIGIN = 'https://tintinaccesorios.pages.dev';

export function functionOrigin() {
  if (typeof window === 'undefined') return '';

  const configured = String(window.TINTIN_FUNCTION_ORIGIN || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  const hostname = String(window.location.hostname || '').toLowerCase();
  if (hostname.endsWith('github.io') || hostname.endsWith('netlify.app')) {
    return CLOUDFLARE_FALLBACK_ORIGIN;
  }

  return '';
}

export function apiUrl(name) {
  return `${functionOrigin()}/api/${name}`;
}
