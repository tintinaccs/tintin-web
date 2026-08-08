import {
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  firestoreAdminGet,
  firestoreAdminMerge,
  firestoreAdminDelete,
  decodeFirestoreFields,
  createFirebaseCustomToken,
  findOrCreateUserByEmail,
  fsInteger
} from '../../cloudflare/firebase-admin-ligero.js';

const MAX_ATTEMPTS = 5;

function clean(value, maxLength = 254) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function docPath(email) {
  return `emailOtpCodes/${encodeURIComponent(email)}`;
}

async function hashCode(code) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ success: false, error: 'origin_not_allowed' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  }
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'method_not_allowed' }, 405, origin, requestUrl);
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 2000) throw new Error('request_too_large');
    const body = JSON.parse(rawBody || '{}');
    const email = clean(body.email, 254).toLowerCase();
    const code = clean(body.code, 12);

    if (!emailIsValid(email)) {
      return jsonResponse({ success: false, error: 'invalid_email' }, 400, origin, requestUrl);
    }
    if (!/^\d{6}$/.test(code)) {
      return jsonResponse({ success: false, error: 'invalid_code_format' }, 400, origin, requestUrl);
    }

    const path = docPath(email);
    let doc;
    try {
      doc = await firestoreAdminGet(env, path);
    } catch (error) {
      // Firestore caído o credencial mal configurada no es "código inválido":
      // el código puede estar perfecto. Se distingue para no mandar a la
      // clienta a pedir otro código que tampoco va a poder verificarse.
      console.error('[email-otp-verify] No se pudo leer el codigo:', error?.message || error);
      return jsonResponse({ success: false, error: 'storage_unavailable' }, 503, origin, requestUrl);
    }
    if (!doc) {
      return jsonResponse({ success: false, error: 'code_not_found' }, 400, origin, requestUrl);
    }
    const data = decodeFirestoreFields(doc.fields);

    if (new Date(data.expiresAt).getTime() < Date.now()) {
      await firestoreAdminDelete(env, path);
      return jsonResponse({ success: false, error: 'code_expired' }, 400, origin, requestUrl);
    }

    const attempts = Number(data.attempts || 0);
    if (attempts >= MAX_ATTEMPTS) {
      await firestoreAdminDelete(env, path);
      return jsonResponse({ success: false, error: 'too_many_attempts' }, 429, origin, requestUrl);
    }

    const submittedHash = await hashCode(code);
    if (submittedHash !== data.codeHash) {
      await firestoreAdminMerge(env, path, { attempts: fsInteger(attempts + 1) });
      return jsonResponse({
        success: false,
        error: 'code_mismatch',
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (attempts + 1))
      }, 400, origin, requestUrl);
    }

    // El código es correcto y de un solo uso, pero recién se borra después de
    // completar el login (cuenta + token): si Identity Toolkit falla de forma
    // transitoria acá, la clienta puede reintentar con el mismo código en vez
    // de perderlo y tener que pedir uno nuevo.
    let uid, isNewUser, customToken;
    try {
      ({ uid, isNewUser } = await findOrCreateUserByEmail(env, email));
      customToken = await createFirebaseCustomToken(env, uid);
    } catch (error) {
      console.error('[email-otp-verify] Fallo creando la sesion:', error?.message || error);
      return jsonResponse({ success: false, error: 'login_failed' }, 502, origin, requestUrl);
    }

    await firestoreAdminDelete(env, path);

    return jsonResponse({ success: true, customToken, isNewUser }, 200, origin, requestUrl);
  } catch (error) {
    // El mensaje interno no se devuelve como código de error: producía códigos
    // que el cliente no sabe traducir (y terminaban en el mensaje genérico),
    // además de exponer detalle del servidor. El detalle queda en los logs.
    console.error('[email-otp-verify] Error inesperado:', error?.message || error);
    const badRequest = error?.message === 'request_too_large' || error instanceof SyntaxError;
    return jsonResponse(
      { success: false, error: badRequest ? 'invalid_request' : 'server_error' },
      badRequest ? 400 : 500,
      origin,
      requestUrl
    );
  }
}
