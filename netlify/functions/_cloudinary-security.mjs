import { createHash, createVerify } from 'node:crypto';

const FIREBASE_PROJECT_ID = 'tintin-accesorios';
const SUPERADMIN_EMAIL = 'tintinaccs@gmail.com';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const TRUSTED_ORIGINS = new Set([
  'https://tintinaccs.github.io',
  'https://tintinaccesorios.netlify.app'
]);

let certificateCache = {
  expiresAt: 0,
  values: null
};

export function originIsAllowed(origin) {
  if (!origin) return true;
  if (TRUSTED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/deploy-preview-\d+--tintinaccesorios\.netlify\.app$/i.test(origin)) return true;
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin);
}

export function corsHeaders(origin) {
  const headers = {
    'cache-control': 'private, no-store, max-age=0',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'vary': 'Origin'
  };
  if (origin && originIsAllowed(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

export function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin)
  });
}

export function preflightResponse(origin) {
  const headers = corsHeaders(origin);
  headers['access-control-allow-methods'] = 'POST, OPTIONS';
  headers['access-control-allow-headers'] = 'Authorization, Content-Type';
  headers['access-control-max-age'] = '600';
  return new Response(null, { status: 204, headers });
}

function decodeJsonPart(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Token de autenticación inválido');
  }
}

function cacheMaxAge(headers) {
  const value = headers.get('cache-control') || '';
  const match = value.match(/max-age=(\d+)/i);
  return match ? Number(match[1]) : 300;
}

async function getFirebaseCertificates() {
  if (certificateCache.values && Date.now() < certificateCache.expiresAt) {
    return certificateCache.values;
  }

  const response = await fetch(GOOGLE_CERTS_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudieron validar las credenciales');
  const values = await response.json();
  certificateCache = {
    values,
    expiresAt: Date.now() + Math.max(60, cacheMaxAge(response.headers)) * 1000
  };
  return values;
}

function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Falta la autenticación de Super Admin');
  return match[1].trim();
}

export async function requireSuperAdmin(request) {
  const token = getBearerToken(request);
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token de autenticación inválido');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader);
  const payload = decodeJsonPart(encodedPayload);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Token de autenticación inválido');
  }

  const certificates = await getFirebaseCertificates();
  const certificate = certificates[header.kid];
  if (!certificate) throw new Error('La credencial ya no es válida');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const signatureValid = verifier.verify(certificate, Buffer.from(encodedSignature, 'base64url'));
  if (!signatureValid) throw new Error('La firma de autenticación no es válida');

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== FIREBASE_ISSUER) {
    throw new Error('La credencial pertenece a otro proyecto');
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('La identidad de la credencial no es válida');
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= now) {
    throw new Error('La sesión venció; volvé a iniciar sesión');
  }
  if (!Number.isFinite(payload.iat) || payload.iat > now + 60) {
    throw new Error('La fecha de la credencial no es válida');
  }
  if (!Number.isFinite(payload.auth_time) || payload.auth_time > now + 60) {
    throw new Error('La fecha de autenticación no es válida');
  }

  const email = String(payload.email || '').trim().toLowerCase();
  if (email !== SUPERADMIN_EMAIL || payload.email_verified === false) {
    throw new Error('Solo el Super Admin puede administrar imágenes');
  }

  return {
    uid: payload.sub,
    email
  };
}

export function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary todavía no está configurado en Netlify');
  }
  return { cloudName, apiKey, apiSecret };
}

export function cloudinarySignature(parameters, apiSecret) {
  const serialized = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
    .join('&');
  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
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
  if (!/^tintin\/media\/[A-Za-z0-9_-]{8,80}\/(?:full|thumb)$/.test(publicId)) {
    throw new Error('El archivo solicitado no pertenece a la biblioteca de Tintin');
  }
  return publicId;
}
