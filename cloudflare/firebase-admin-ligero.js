// =============================================================
// TINTIN — Firebase Admin mínimo para Cloudflare Pages Functions
// =============================================================
// El SDK oficial `firebase-admin` es para Node y no corre en el runtime de
// Cloudflare Workers (usa módulos nativos de Node que acá no existen). Este
// módulo hace, con Web Crypto (sí disponible en Workers), exactamente las
// operaciones admin que necesita la tienda sin exponer credenciales al
// navegador. La clave privada sale de env.FIREBASE_SERVICE_ACCOUNT_KEY
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
// Se acepta cualquiera de los dos nombres de variable: FIREBASE_SERVICE_ACCOUNT_KEY
// es el que ya usaba el login por código, FIREBASE_SERVICE_ACCOUNT_JSON el que
// documenta docs/FIREBASE_WEB_PUSH_SETUP.md. Con una sola alcanza; si están las
// dos, tienen que ser la misma cuenta de servicio.
export function parseServiceAccount(env) {
  if (cachedServiceAccount) return cachedServiceAccount;
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no está configurada');
  let json;
  try { json = JSON.parse(raw); } catch { throw new Error('La cuenta de servicio de Firebase no es un JSON válido'); }
  if (!json.client_email || !json.private_key || !json.project_id) {
    throw new Error('La cuenta de servicio de Firebase no tiene el formato esperado (¿se pegó el .json completo?)');
  }
  // Al pegar el JSON en un panel web los saltos de línea suelen quedar como la
  // secuencia literal \n; sin normalizarlos, importKey() falla siempre.
  cachedServiceAccount = {
    ...json,
    private_key: String(json.private_key).replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
  };
  return cachedServiceAccount;
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

const accessTokenCache = new Map();

/** Access token OAuth2 de la cuenta de servicio, para llamar APIs de Google admin. */
export async function getGoogleAccessToken(env, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const scopeKey = [...scopes].sort().join(' ');
  const cached = accessTokenCache.get(scopeKey);
  if (cached && cached.expiry - 30 > now) return cached.token;

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
  accessTokenCache.set(scopeKey, {
    token: data.access_token,
    expiry: now + Number(data.expires_in || 3600)
  });
  return data.access_token;
}

/**
 * Firma un Firebase Custom Token para `uid` — el navegador lo usa con
 * signInWithCustomToken(auth, token).
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

/** Busca proveedores vinculados a una cuenta por email, sin crear nada. */
export async function lookupUserProvidersByEmail(env, email) {
  const accessToken = await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/identitytoolkit']);
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: [email] })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('No se pudo verificar el metodo de la cuenta: ' + (data?.error?.message || response.status));
  }
  const user = Array.isArray(data.users) ? data.users[0] : null;
  if (!user) return { exists: false, providers: [] };
  const providers = (user.providerUserInfo || []).map(p => p.providerId).filter(Boolean);
  return { exists: true, providers };
}

async function lookupUserByEmail(accessToken, email) {
  const lookupResp = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: [email] })
  });
  const lookupData = await lookupResp.json().catch(() => ({}));
  if (!lookupResp.ok) {
    throw new Error('No se pudo buscar la cuenta de acceso: ' + (lookupData?.error?.message || lookupResp.status));
  }
  return Array.isArray(lookupData.users) ? lookupData.users[0] : null;
}

/** Busca una cuenta de Firebase Auth por email; si no existe, la crea (ya verificada). */
export async function findOrCreateUserByEmail(env, email) {
  const accessToken = await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/identitytoolkit']);
  const existing = await lookupUserByEmail(accessToken, email);
  if (existing?.localId) return { uid: existing.localId, isNewUser: false };

  const createResp = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, emailVerified: true })
  });
  const createData = await createResp.json().catch(() => ({}));
  if (createResp.ok && createData.localId) return { uid: createData.localId, isNewUser: true };

  if (createData?.error?.message === 'EMAIL_EXISTS') {
    const raceExisting = await lookupUserByEmail(accessToken, email);
    if (raceExisting?.localId) return { uid: raceExisting.localId, isNewUser: false };
  }
  throw new Error('No se pudo crear la cuenta de acceso: ' + (createData?.error?.message || createResp.status));
}

/** Elimina una cuenta real de Firebase Authentication por UID. */
export async function deleteFirebaseUser(env, uid) {
  const safeUid = String(uid || '').trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(safeUid)) throw new Error('UID inválido');
  const accessToken = await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/identitytoolkit']);
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ localId: safeUid })
  });
  if (response.status !== 404 && !response.ok) {
    const data = await response.json().catch(() => ({}));
    if (data?.error?.message === 'USER_NOT_FOUND') return;
    throw new Error('No se pudo eliminar la cuenta de acceso: ' + (data?.error?.message || response.status));
  }
}

/** Habilita/deshabilita una cuenta sin destruir su UID ni su email histórico. */
export async function setFirebaseUserDisabled(env, uid, disabled) {
  const safeUid = String(uid || '').trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(safeUid)) throw new Error('UID inválido');
  const accessToken = await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/identitytoolkit']);
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ localId: safeUid, disableUser: disabled === true })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error('No se pudo actualizar el acceso de la cuenta: ' + (data?.error?.message || response.status));
  }
}

// --- Firestore admin REST ---
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

function firestoreDocUrl(sa, path) {
  return `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}`;
}

function firestoreDatabaseUrl(sa) {
  return `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)`;
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

/**
 * Busca el primer documento cuyo campo coincida exactamente con `value`.
 * Hace una consulta index-free de igualdad por cada nombre de campo legado
 * indicado. Se usa en el cutover de Shopify para resolver handles antiguos
 * sin descargar los ~400 productos en cada isolate de Cloudflare.
 */
export async function firestoreAdminFindFirstByFields(env, collectionId, fieldPaths, value) {
  const safeCollection = String(collectionId || '').trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(safeCollection)) throw new Error('Colección inválida para query Firestore');
  const fields = [...new Set((Array.isArray(fieldPaths) ? fieldPaths : [fieldPaths])
    .map(field => String(field || '').trim())
    .filter(field => /^[A-Za-z0-9_. -]{1,120}$/.test(field)))];
  if (!fields.length) throw new Error('Campo inválido para query Firestore');

  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const endpoint = `${firestoreDatabaseUrl(sa)}/documents:runQuery`;

  for (const fieldPath of fields) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: safeCollection }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: 'EQUAL',
              value: { stringValue: String(value ?? '') }
            }
          },
          limit: 1
        }
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(`Firestore RUN QUERY falló (${response.status}): ${data?.error?.message || ''}`);
    }
    const rows = await response.json().catch(() => []);
    const document = Array.isArray(rows) ? rows.find(row => row?.document)?.document : null;
    if (document) return document;
  }
  return null;
}

/**
 * Resuelve el email de la cuenta dueña de un username, a partir de la
 * reserva en `usernameReservations/{key}` (ver js/components/forms/reserva-username.js).
 * Devuelve null si el username no existe o no tiene cuenta asociada —
 * indistinguible para el llamador de "no se pudo resolver", a propósito:
 * firestore.rules ya bloquea la lectura pública de esa colección para que
 * nadie pueda usarla para saber si un username tiene cuenta (ver
 * scripts/probar-firestore-username-unico.mjs), y esta ruta admin no puede
 * reabrir ese mismo agujero devolviendo una señal distinta según el caso.
 * `get` es inyectable (por defecto firestoreAdminGet) para poder testear
 * sin credenciales reales, mismo patrón que cloudflare/admin-runtime-health.js.
 */
export async function resolveEmailFromUsernameKey(env, usernameKey, { get = firestoreAdminGet } = {}) {
  const key = String(usernameKey || '').trim();
  if (!key) return null;
  const reservation = await get(env, `usernameReservations/${encodeURIComponent(key)}`);
  if (!reservation) return null;
  const { uid } = decodeFirestoreFields(reservation.fields) || {};
  if (!uid) return null;
  const userDoc = await get(env, `users/${encodeURIComponent(String(uid))}`);
  if (!userDoc) return null;
  const { email } = decodeFirestoreFields(userDoc.fields) || {};
  return typeof email === 'string' && email ? email.toLowerCase() : null;
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
  const response = await fetch(firestoreDocUrl(sa, path), {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (response.status !== 404 && !response.ok) throw new Error(`Firestore DELETE falló (${response.status})`);
}

export async function firestoreAdminList(env, path, pageSize = 300) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const url = `${firestoreDocUrl(sa, path)}?pageSize=${Math.max(1, Math.min(300, Number(pageSize) || 300))}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Firestore LIST falló (${response.status})`);
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.documents) ? data.documents : [];
}

/** Lista una colección completa de forma paginada, con un techo explícito. */
export async function firestoreAdminListAll(env, path, maxDocuments = 1000) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const limit = Math.max(1, Math.min(5000, Number(maxDocuments) || 1000));
  const documents = [];
  let pageToken = '';

  do {
    const remaining = limit - documents.length;
    const params = new URLSearchParams({ pageSize: String(Math.min(300, remaining)) });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetch(`${firestoreDocUrl(sa, path)}?${params.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (response.status === 404) return documents;
    if (!response.ok) throw new Error(`Firestore LIST ALL falló (${response.status})`);
    const data = await response.json().catch(() => ({}));
    const page = Array.isArray(data.documents) ? data.documents : [];
    documents.push(...page.slice(0, remaining));
    pageToken = data.nextPageToken || '';
  } while (pageToken && documents.length < limit);

  return documents;
}

function encodeFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number' && Number.isFinite(value)) return { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFirestoreFields(value) } };
  return { stringValue: String(value) };
}

export function encodeFirestoreFields(object) {
  return Object.fromEntries(Object.entries(object || {}).map(([key, value]) => [key, encodeFirestoreValue(value)]));
}

/** Commit atómico de documentos completos. Cada write es {path, fields} o {path, delete:true}. */
export async function firestoreAdminCommit(env, writes) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const prefix = `projects/${sa.project_id}/databases/(default)/documents/`;
  const body = {
    writes: (Array.isArray(writes) ? writes : []).map(write => {
      const path = String(write?.path || '');
      if (!/^(?:[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)(?:\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)*$/.test(path)) {
        throw new Error('Ruta de documento inválida para commit');
      }
      const currentDocument = write.currentDocument && typeof write.currentDocument === 'object'
        ? { currentDocument: write.currentDocument }
        : {};
      if (write.delete) return { delete: prefix + path, ...currentDocument };
      const updateMask = Array.isArray(write.mergeFields) && write.mergeFields.length
        ? { updateMask: { fieldPaths: write.mergeFields.map(field => String(field)) } }
        : {};
      return { update: { name: prefix + path, fields: write.fields || {} }, ...updateMask, ...currentDocument };
    })
  };
  if (!body.writes.length || body.writes.length > 20) throw new Error('Cantidad de escrituras inválida');
  const response = await fetch(`${firestoreDatabaseUrl(sa)}/documents:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const conflict = data?.error?.status === 'FAILED_PRECONDITION' || response.status === 409;
    throw Object.assign(new Error(conflict ? 'Conflicto de versión en Firestore.' : `Firestore COMMIT falló (${response.status}).`), {
      status: conflict ? 409 : 502,
      code: conflict ? 'version_conflict' : 'firestore_commit_failed',
    });
  }
  return response.json();
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
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
    if ('mapValue' in value) return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, nested]) => [key, decode(nested)])
    );
    return null;
  };
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decode(value)]));
}

export const fsString = value => ({ stringValue: String(value) });
export const fsInteger = value => ({ integerValue: String(Math.trunc(Number(value) || 0)) });
export const fsTimestamp = date => ({ timestampValue: date.toISOString() });
export const fsBoolean = value => ({ booleanValue: value === true });
