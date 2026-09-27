import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  SUPERADMIN_EMAIL
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  firestoreAdminGet,
  firestoreAdminMerge,
  firestoreAdminReplace,
  firestoreAdminDelete,
  decodeFirestoreFields,
  createFirebaseCustomToken,
  findOrCreateUserByEmail,
  resolveEmailFromUsernameKey,
  fsInteger,
  fsString
} from '../../cloudflare/firebase-admin-ligero.js';
import { usernameKey } from '../../js/components/forms/utilidades-username.js';

const MAX_ATTEMPTS = 5;
const MAX_FAILURES_PER_IP_DAY = 40;
const RESERVE_TRIES = 3;

const defaultDeps = {
  get: firestoreAdminGet,
  merge: firestoreAdminMerge,
  replace: firestoreAdminReplace,
  remove: firestoreAdminDelete,
  resolveEmailFromUsernameKey,
  findOrCreateUserByEmail,
  createFirebaseCustomToken
};

function clean(value, maxLength = 254) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function docPath(email) {
  return `emailOtpCodes/${encodeURIComponent(email)}`;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function todayKey(now) {
  return new Date(now).toISOString().slice(0, 10);
}

function secondsUntilNextUtcDay(now) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now) / 1000));
}

// Mismo esquema que el límite de envío (IP hasheada con OTP_RATE_SALT), pero
// en su propio documento: email-otp-send reemplaza el suyo completo.
async function ipFailurePath(request, env) {
  const ip = clean(request.headers.get('CF-Connecting-IP'), 80);
  if (!ip) throw new Error('rate_identity_missing');
  return `emailOtpVerifyLimits/${await sha256Hex(`${env.OTP_RATE_SALT || 'tintin-otp'}:${ip}`)}`;
}

async function readIpFailures(deps, env, path, now) {
  const doc = await deps.get(env, path);
  const data = doc ? decodeFirestoreFields(doc.fields) : null;
  return data?.dateKey === todayKey(now) ? Number(data.failures || 0) : 0;
}

async function recordIpFailure(deps, env, path, now) {
  // Límite de abuso sostenido desde una misma IP. El tope duro por código es
  // la reserva atómica de intentos; este contador puede quedar corto ante
  // ráfagas simultáneas y por eso un fallo al escribirlo no rompe la respuesta.
  try {
    const failures = await readIpFailures(deps, env, path, now);
    await deps.replace(env, path, { dateKey: fsString(todayKey(now)), failures: fsInteger(failures + 1) });
  } catch (error) {
    console.warn('[email-otp-verify] No se pudo registrar el fallo por IP:', error?.message || error);
  }
}

export async function onRequest(context) {
  return handleEmailOtpVerify(context);
}

export async function handleEmailOtpVerify(context, deps = defaultDeps) {
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

    const now = Date.now();
    const ipPath = await ipFailurePath(request, env);
    const ipFailures = await readIpFailures(deps, env, ipPath, now).catch(error => {
      // Si no se puede leer el contador por IP no se bloquea el login: el tope
      // duro sigue siendo la reserva atómica de intentos del código.
      console.warn('[email-otp-verify] No se pudo leer el límite por IP:', error?.message || error);
      return 0;
    });
    if (ipFailures >= MAX_FAILURES_PER_IP_DAY) {
      return jsonResponse({
        success: false,
        error: 'rate_limit_exceeded',
        retryAfterSeconds: secondsUntilNextUtcDay(now)
      }, 429, origin, requestUrl);
    }

    let email;
    if (rawUsername) {
      // Mismo criterio anti-enumeración que email-otp-send: un username que
      // no resuelve a ninguna cuenta responde exactamente igual que "no hay
      // código pendiente" (código genérico ya existente), nunca un error
      // distinto que delate que el username no existe.
      const key = usernameKey(rawUsername);
      const resolved = key ? await deps.resolveEmailFromUsernameKey(env, key) : null;
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

    // La cuenta Super Admin entra sólo con Google: un código por correo no
    // puede abrir la sesión con más privilegios del sistema.
    if (email === SUPERADMIN_EMAIL) {
      return jsonResponse({ success: false, error: 'email_not_allowed' }, 403, origin, requestUrl);
    }

    const path = docPath(email);
    let data;
    let attempts;
    for (let attempt = 1; ; attempt += 1) {
      let doc;
      try {
        doc = await deps.get(env, path);
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
      data = decodeFirestoreFields(doc.fields);

      if (new Date(data.expiresAt).getTime() < now) {
        await deps.remove(env, path);
        return jsonResponse({ success: false, error: 'code_expired' }, 400, origin, requestUrl);
      }

      attempts = Number(data.attempts || 0);
      if (attempts >= MAX_ATTEMPTS) {
        await deps.remove(env, path);
        return jsonResponse({ success: false, error: 'too_many_attempts' }, 429, origin, requestUrl);
      }

      // El intento se reserva ANTES de comparar y sólo si el documento no
      // cambió desde la lectura: varios pedidos simultáneos no pueden leer el
      // mismo contador y comparar todos a la vez (antes 200 intentos paralelos
      // pasaban con attempts=0 y el quinto límite no se aplicaba).
      try {
        await deps.merge(env, path, { attempts: fsInteger(attempts + 1) }, { updateTime: doc.updateTime });
        break;
      } catch (error) {
        if (error?.code !== 'version_conflict') throw error;
        if (attempt >= RESERVE_TRIES) {
          return jsonResponse({
            success: false,
            error: 'rate_limit_exceeded',
            retryAfterSeconds: 5
          }, 429, origin, requestUrl);
        }
      }
    }

    const submittedHash = await sha256Hex(code);
    if (submittedHash !== data.codeHash) {
      await recordIpFailure(deps, env, ipPath, now);
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
      ({ uid, isNewUser } = await deps.findOrCreateUserByEmail(env, email));
      customToken = await deps.createFirebaseCustomToken(env, uid);
    } catch (error) {
      console.error('[email-otp-verify] Fallo creando la sesion:', error?.message || error);
      return jsonResponse({ success: false, error: 'login_failed' }, 502, origin, requestUrl);
    }

    await deps.remove(env, path);

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
