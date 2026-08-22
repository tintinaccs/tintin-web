import {
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  firestoreAdminGet,
  firestoreAdminCommit,
  firestoreAdminDelete,
  decodeFirestoreFields,
  createFirebaseCustomToken,
  findOrCreateUserByEmail,
  resolveEmailFromUsernameKey,
  fsInteger,
  fsTimestamp
} from '../../cloudflare/firebase-admin-ligero.js';
import { usernameKey } from '../../js/components/forms/utilidades-username.js';

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

async function atomicMerge(env, path, existingDoc, fields, mergeFields) {
  if (!existingDoc?.updateTime) {
    throw Object.assign(new Error('El código cambió de estado.'), { status: 409, code: 'version_conflict' });
  }
  return firestoreAdminCommit(env, [{
    path,
    fields,
    mergeFields,
    currentDocument: { updateTime: existingDoc.updateTime },
  }]);
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
    const rawUsername = clean(body.username, 20);
    const code = clean(body.code, 12);

    if (!/^\d{6}$/.test(code)) {
      return jsonResponse({ success: false, error: 'invalid_code_format' }, 400, origin, requestUrl);
    }

    let email;
    if (rawUsername) {
      const key = usernameKey(rawUsername);
      const resolved = key ? await resolveEmailFromUsernameKey(env, key) : null;
      if (!resolved) {
        return jsonResponse({ success: false, error: 'code_not_found' }, 400, origin, requestUrl);
      }
      email = resolved;
    } else {
      email = clean(body.email, 254).toLowerCase();
      if (!emailIsValid(email)) {
        return jsonResponse({ success: false, error: 'invalid_email' }, 400, origin, requestUrl);
      }
    }

    const path = docPath(email);
    let doc;
    try {
      doc = await firestoreAdminGet(env, path);
    } catch (error) {
      console.error('[email-otp-verify] No se pudo leer el codigo:', error?.message || error);
      return jsonResponse({ success: false, error: 'storage_unavailable' }, 503, origin, requestUrl);
    }
    if (!doc) {
      return jsonResponse({ success: false, error: 'code_not_found' }, 400, origin, requestUrl);
    }
    const data = decodeFirestoreFields(doc.fields);

    // Un PIN consumido queda marcado antes de crear la sesión. Esto evita que
    // dos requests simultáneas puedan usar el mismo código mientras una de
    // ellas todavía está creando el Custom Token.
    if (data.consumedAt) {
      return jsonResponse({ success: false, error: 'code_not_found' }, 400, origin, requestUrl);
    }

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
      try {
        await atomicMerge(env, path, doc, { attempts: fsInteger(attempts + 1) }, ['attempts']);
      } catch (error) {
        if (error?.status === 409 || error?.code === 'version_conflict') {
          return jsonResponse({ success: false, error: 'code_mismatch' }, 400, origin, requestUrl);
        }
        throw error;
      }
      return jsonResponse({
        success: false,
        error: 'code_mismatch',
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (attempts + 1))
      }, 400, origin, requestUrl);
    }

    // Consumir primero, con precondición updateTime. Sólo una request puede
    // ganar este commit; las demás reciben conflicto y jamás crean sesión.
    try {
      await atomicMerge(env, path, doc, { consumedAt: fsTimestamp(new Date()) }, ['consumedAt']);
    } catch (error) {
      if (error?.status === 409 || error?.code === 'version_conflict') {
        return jsonResponse({ success: false, error: 'code_not_found' }, 400, origin, requestUrl);
      }
      throw error;
    }

    let uid, isNewUser, customToken;
    try {
      ({ uid, isNewUser } = await findOrCreateUserByEmail(env, email));
      customToken = await createFirebaseCustomToken(env, uid);
    } catch (error) {
      // El PIN ya está consumido de forma deliberada: reabrirlo después de una
      // falla parcial volvería a introducir la carrera de doble uso. La clienta
      // puede solicitar uno nuevo cuando el servicio vuelva a estar disponible.
      console.error('[email-otp-verify] Fallo creando la sesion:', error?.message || error);
      return jsonResponse({ success: false, error: 'login_failed' }, 502, origin, requestUrl);
    }

    await firestoreAdminDelete(env, path);

    return jsonResponse({ success: true, customToken, isNewUser }, 200, origin, requestUrl);
  } catch (error) {
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
