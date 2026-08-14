// =============================================================
// TINTIN — Origen compartido para las funciones /api/* de Cloudflare Pages
// =============================================================

import { TINTIN_FUNCTIONS_FALLBACK_ORIGIN } from '../config/origenes-publicos.js';

export function functionOrigin() {
  if (typeof window === 'undefined') return '';

  const configured = String(window.TINTIN_FUNCTION_ORIGIN || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  const hostname = String(window.location.hostname || '').toLowerCase();
  if (hostname.endsWith('github.io') || hostname.endsWith('netlify.app')) {
    return TINTIN_FUNCTIONS_FALLBACK_ORIGIN;
  }

  return '';
}

export function apiUrl(name) {
  return `${functionOrigin()}/api/${name}`;
}
