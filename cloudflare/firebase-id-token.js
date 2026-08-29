const FIREBASE_PROJECT_ID = 'tintin-accesorios';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CLOCK_SKEW_SECONDS = 300;
const DEFAULT_KEYS_TTL_MS = 60 * 60 * 1000;

let cachedJwks = null;
let cachedJwksExpiresAt = 0;

function authError(message, status = 401, code = 'auth/invalid-token') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    throw authError('La sesión no es válida; volvé a iniciar sesión.');
  }
}

function decodeJsonSegment(value) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch (error) {
    if (error?.status) throw error;
    throw authError('La sesión no es válida; volvé a iniciar sesión.');
  }
}

function cacheTtlFromHeaders(headers) {
  const cacheControl = String(headers?.get?.('cache-control') || '');
  const match = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_KEYS_TTL_MS;
  return Math.max(60_000, Math.min(seconds * 1000, 24 * 60 * 60 * 1000));
}

async function fetchJwks(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedJwks && now < cachedJwksExpiresAt) return cachedJwks;

  let response;
  try {
    response = await fetch(FIREBASE_JWKS_URL, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
  } catch (cause) {
    const error = authError('No se pudo validar la sesión en este momento. Reintentá.', 503, 'auth/key-service-unavailable');
    error.cause = cause;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data?.keys) || data.keys.length === 0) {
    throw authError('No se pudo validar la sesión en este momento. Reintentá.', 503, 'auth/key-service-unavailable');
  }

  cachedJwks = data.keys;
  cachedJwksExpiresAt = now + cacheTtlFromHeaders(response.headers);
  return cachedJwks;
}

async function findSigningKey(kid) {
  let keys = await fetchJwks(false);
  let jwk = keys.find(key => key?.kid === kid && key?.kty === 'RSA' && key?.alg === 'RS256');
  if (jwk) return jwk;

  keys = await fetchJwks(true);
  jwk = keys.find(key => key?.kid === kid && key?.kty === 'RSA' && key?.alg === 'RS256');
  if (!jwk) throw authError('La sesión no es válida; volvé a iniciar sesión.', 401, 'auth/unknown-signing-key');
  return jwk;
}

function assertClaims(payload) {
  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload?.exp);
  const iat = Number(payload?.iat);
  const authTime = Number(payload?.auth_time);
  const subject = String(payload?.sub || '');

  if (payload?.aud !== FIREBASE_PROJECT_ID || payload?.iss !== FIREBASE_ISSUER) {
    throw authError('La sesión no pertenece a este sitio; volvé a iniciar sesión.', 401, 'auth/wrong-project');
  }
  if (!Number.isFinite(exp) || exp <= now - CLOCK_SKEW_SECONDS) {
    throw authError('La sesión venció; volvé a iniciar sesión.', 401, 'auth/token-expired');
  }
  if (!Number.isFinite(iat) || iat > now + CLOCK_SKEW_SECONDS) {
    throw authError('La sesión no es válida; volvé a iniciar sesión.', 401, 'auth/invalid-issued-at');
  }
  if (!Number.isFinite(authTime) || authTime > now + CLOCK_SKEW_SECONDS) {
    throw authError('La sesión no es válida; volvé a iniciar sesión.', 401, 'auth/invalid-auth-time');
  }
  if (!subject || subject.length > 128) {
    throw authError('La sesión no es válida; volvé a iniciar sesión.', 401, 'auth/invalid-subject');
  }
}

export async function verifyFirebaseIdToken(idToken, options = {}) {
  const token = String(idToken || '').trim();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) {
    throw authError('La sesión no es válida; volvé a iniciar sesión.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonSegment(encodedHeader);
  const payload = decodeJsonSegment(encodedPayload);

  if (header?.alg !== 'RS256' || !header?.kid) {
    throw authError('La sesión no es válida; volvé a iniciar sesión.', 401, 'auth/invalid-header');
  }

  const jwk = await findSigningKey(String(header.kid));
  let publicKey;
  try {
    publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch (cause) {
    const error = authError('No se pudo validar la sesión en este momento. Reintentá.', 503, 'auth/key-import-failed');
    error.cause = cause;
    throw error;
  }

  const signedBytes = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    publicKey,
    signature,
    signedBytes,
  ).catch(() => false);

  if (!valid) throw authError('La sesión no es válida; volvé a iniciar sesión.', 401, 'auth/invalid-signature');

  assertClaims(payload);

  const email = String(payload?.email || '').trim().toLowerCase();
  if (options.requireVerifiedEmail !== false && (!email || payload?.email_verified !== true)) {
    throw authError('La cuenta debe tener un correo verificado.', 403, 'auth/email-not-verified');
  }

  return {
    uid: String(payload.sub),
    email,
    idToken: token,
    claims: payload,
  };
}

export const FIREBASE_AUTH_PROJECT_ID = FIREBASE_PROJECT_ID;
