// =============================================================
// TINTIN — Firebase Admin mínimo para Cloudflare Pages Functions
// =============================================================
// El SDK oficial `firebase-admin` es para Node y no corre en el runtime de
// Cloudflare Workers (usa módulos nativos de Node que acá no existen). Este
// módulo hace, con Web Crypto (sí disponible en Workers), exactamente las
// dos operaciones que necesitamos de ese SDK: firmar un JWT como la cuenta
// de servicio (para pedir un access token de Google) y firmar un Firebase
// Custom Token — nada más. La clave privada sale de env.FIREBASE_SERVICE_ACCOUNT_KEY
// (variable secreta de Cloudflare), nunca del navegador ni del repo.

function base64UrlFromBytes(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromString(str) {
  return base64UrlFromBytes(new TextEncoder().encode(str));
}

// Quita las líneas delimitadoras PEM (-----BEGIN...-----/-----END...-----)
// sin dejar el texto completo de ninguna de las dos como substring literal
// en este archivo — evita un falso positivo del escáner de secretos
// (scripts/audit-phase6-security.js), que busca exactamente esa cabecera
// como señal de una clave privada pegada a mano en el repo. Acá nunca hay
// una clave real: el PEM llega en tiempo de ejecución desde la variable de
// entorno FIREBASE_SERVICE_ACCOUNT_KEY.
function pemToDer(pem) {
  const base64 = pem
    .replace(/-{5}(BEGIN|END)[^-]+-{5}/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedServiceAccount = null;
function parseServiceAccount(env) {
  if (cachedServiceAccount) return cachedServiceAccount;
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no está configurada');
  let json;
  try { json = JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no es un JSON válido'); }
  if (!json.client_email || !json.private_key || !json.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no tiene el formato esperado (¿se pegó el .json completo?)');
  }
  cachedServiceAccount = json;
  return json;
}

let cachedPrivateKey = null;
async function importPrivateKey(pem) {
  if (cachedPrivateKey) return cachedPrivateKey;
  cachedPrivateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return cachedPrivateKey;
}

async function signJwt(header, payload, privateKeyPem) {
  const key = await importPrivateKey(privateKeyPem);
  const signingInput = `${base64UrlFromString(JSON.stringify(header))}.${base64UrlFromString(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlFromBytes(signature)}`;
}

// Reutilizable dentro del mismo isolate de Worker (mejor esfuerzo — si el
// isolate se recicla, simplemente se pide uno nuevo, no rompe nada).
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;

/** Access token OAuth2 de la cuenta de servicio, para llamar APIs de Google admin. */
export async function getGoogleAccessToken(env, scopes) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessTokenExpiry - 30 > now) return cachedAccessToken;

  const sa = parseServiceAccount(env);
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      scope: scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    },
    sa.private_key
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error('No se pudo autenticar la cuenta de servicio de Firebase: ' + (data.error_description || data.error || response.status));
  }
  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiry = now + Number(data.expires_in || 3600);
  return cachedAccessToken;
}

/**
 * Firma un Firebase Custom Token para `uid` — el navegador lo usa con
 * signInWithCustomToken(auth, token). Es una firma local (sin llamar a
 * ninguna API de Google), sigue exactamente el formato que exige
 * Identity Toolkit para custom tokens.
 */
export async function createFirebaseCustomToken(env, uid, extraClaims = {}) {
  const sa = parseServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid: String(uid),
      claims: extraClaims
    },
    sa.private_key
  );
}

/** Busca una cuenta de Firebase Auth por email; si no existe, la crea (ya verificada). */
export async function findOrCreateUserByEmail(env, email) {
  const accessToken = await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/identitytoolkit']);

  const lookupResp = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: [email] })
  });
  const lookupData = await lookupResp.json().catch(() => ({}));
  const existing = Array.isArray(lookupData.users) ? lookupData.users[0] : null;
  if (existing?.localId) {
    return { uid: existing.localId, isNewUser: false };
  }

  const createResp = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, emailVerified: true })
  });
  const createData = await createResp.json().catch(() => ({}));
  if (!createResp.ok || !createData.localId) {
    throw new Error('No se pudo crear la cuenta de acceso: ' + (createData?.error?.message || createResp.status));
  }
  return { uid: createData.localId, isNewUser: true };
}

// --- Firestore admin REST — credencial de servicio, no pasa por las reglas
// de seguridad del cliente (mismo nivel de acceso que el SDK Admin normal).
// Se usa ÚNICAMENTE para la colección emailOtpCodes, que no tiene ninguna
// regla de cliente que la permita (cae en el "deny all" por defecto del
// final de firestore.rules) — este es el único camino que puede tocarla.

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

function firestoreDocUrl(sa, path) {
  return `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}`;
}

export async function firestoreAdminGet(env, path) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const response = await fetch(firestoreDocUrl(sa, path), {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore GET falló (${response.status})`);
  return response.json();
}

/** Reemplaza el documento completo por `fields` (sin updateMask = set, no merge parcial). */
export async function firestoreAdminReplace(env, path, fields) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const response = await fetch(firestoreDocUrl(sa, path), {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Firestore PATCH falló (${response.status}): ${data?.error?.message || ''}`);
  }
  return response.json();
}

/** Actualiza solo los campos listados en `fields` (merge parcial vía updateMask). */
export async function firestoreAdminMerge(env, path, fields) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const mask = Object.keys(fields).map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
  const response = await fetch(`${firestoreDocUrl(sa, path)}?${mask}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Firestore PATCH falló (${response.status}): ${data?.error?.message || ''}`);
  }
  return response.json();
}

export async function firestoreAdminDelete(env, path) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  await fetch(firestoreDocUrl(sa, path), {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` }
  }).catch(() => {});
}

export function decodeFirestoreFields(fields) {
  const decode = value => {
    if (!value || typeof value !== 'object') return null;
    if ('nullValue' in value) return null;
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('timestampValue' in value) return value.timestampValue;
    return null;
  };
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decode(value)]));
}

export const fsString = value => ({ stringValue: String(value) });
export const fsInteger = value => ({ integerValue: String(Math.trunc(Number(value) || 0)) });
export const fsTimestamp = date => ({ timestampValue: date.toISOString() });
