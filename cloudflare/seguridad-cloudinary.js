// =============================================================
// TINTIN — Seguridad compartida para Cloudflare Pages Functions
// =============================================================
// Este módulo corre únicamente en el runtime de Cloudflare. Las credenciales
// de Cloudinary se leen desde context.env y nunca se envían al navegador.

import { SUPER_ADMIN_EMAIL } from './contrato-cuentas-generado.js';
import { verifyFirebaseIdToken } from './firebase-id-token.js';

export const SUPERADMIN_EMAIL = SUPER_ADMIN_EMAIL;

// Las funciones privadas solo aceptan el mismo origen que las sirve. Un futuro
// dominio propio funcionará sin otra lista porque requestUrl y Origin coincidirán.
const TRUSTED_CROSS_ORIGINS = new Set();

export function originIsAllowed(origin, requestUrl = '') {
  if (!origin) return true;

  try {
    if (origin === new URL(requestUrl).origin) return true;
  } catch {}

  if (TRUSTED_CROSS_ORIGINS.has(origin)) return true;
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin);
}

export function corsHeaders(origin, requestUrl = '') {
  const headers = {
    'cache-control': 'private, no-store, max-age=0',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'vary': 'Origin'
  };
  if (origin && originIsAllowed(origin, requestUrl)) {
    headers['access-control-allow-origin'] = origin;
  }
  return headers;
}

export function jsonResponse(body, status, origin, requestUrl = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin, requestUrl)
  });
}

export function preflightResponse(origin, requestUrl = '', methods = 'POST, OPTIONS') {
  const headers = corsHeaders(origin, requestUrl);
  headers['access-control-allow-methods'] = methods;
  headers['access-control-allow-headers'] = 'Authorization, Content-Type';
  headers['access-control-max-age'] = '600';
  return new Response(null, { status: 204, headers });
}

function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Falta la autenticación');
    error.status = 401;
    error.code = 'auth/missing-token';
    throw error;
  }
  return match[1].trim();
}

/**
 * Verifica el Firebase ID token directamente en el backend contra las claves
 * públicas de Firebase Secure Token. No usa accounts:lookup: esa API pertenece
 * al flujo cliente de Firebase Auth y, con App Check Enforcement activo, puede
 * rechazar llamadas servidor-a-servidor aunque el ID token sea válido.
 */
export async function requireFirebaseUser(request) {
  const token = getBearerToken(request);
  return verifyFirebaseIdToken(token);
}

/**
 * Usa exactamente la misma validación criptográfica que las rutas de clientas
 * y, después, restringe la operación al único correo de Super Admin.
 */
export async function requireSuperAdmin(request) {
  const token = getBearerToken(request);
  const user = await verifyFirebaseIdToken(token);
  if (user.email !== SUPERADMIN_EMAIL) {
    const error = new Error('Solo el Super Admin puede realizar esta acción');
    error.status = 403;
    error.code = 'auth/superadmin-required';
    throw error;
  }
  return user;
}

/** Conserva códigos HTTP ya clasificados por autenticación o dominio. */
export function statusFromError(error, fallback = 500) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : fallback;
}

export function getCloudinaryConfig(env = {}) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary todavía no está configurado en Cloudflare');
  }
  return { cloudName, apiKey, apiSecret };
}

export async function cloudinarySignature(parameters, apiSecret) {
  const serialized = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
    .join('&');

  const bytes = new TextEncoder().encode(`${serialized}${apiSecret}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

export function cleanMediaId(value) {
  const mediaId = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(mediaId)) {
    throw new Error('Identificador de imagen inválido');
  }
  return mediaId;
}

export function cleanVariant(value) {
  const variant = String(value || '').trim();
  if (!['full', 'thumb'].includes(variant)) {
    throw new Error('Variante de imagen inválida');
  }
  return variant;
}

export function cleanPublicId(value) {
  const publicId = String(value || '').trim();
  if (!/^tintin_media_[A-Za-z0-9_-]{8,80}_(?:full|thumb)$/.test(publicId)) {
    throw new Error('El archivo solicitado no pertenece a la biblioteca de Tintin');
  }
  return publicId;
}
