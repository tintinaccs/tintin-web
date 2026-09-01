import {
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  firestoreAdminGet,
  firestoreAdminReplace,
  decodeFirestoreFields,
  resolveEmailFromUsernameKey,
  fsString,
  fsInteger,
  fsTimestamp
} from '../../cloudflare/firebase-admin-ligero.js';
import { usernameKey } from '../../js/components/forms/utilidades-username.js';

const FROM_EMAIL = 'No Reply · Tintin <noreply@tintinaccs.com>';
const EMAIL_MARK = 'https://tintinaccesorios.pages.dev/assets-tintin/images/general/email-avatar-tintin.png';
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutos, a pedido: "código de bonificación" con vencimiento corto
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_CODES_PER_DAY = 8;
const MAX_CODES_PER_IP_DAY = 30;
const IP_COOLDOWN_MS = 10 * 1000;

function clean(value, maxLength = 254) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function docPath(email) {
  return `emailOtpCodes/${encodeURIComponent(email)}`;
}

async function hashCode(code) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashRateKey(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function enforceIpRateLimit(request, env, now) {
  const ip = clean(request.headers.get('CF-Connecting-IP'), 80);
  if (!ip) throw new Error('rate_identity_missing');
  const key = await hashRateKey(`${env.OTP_RATE_SALT || 'tintin-otp'}:${ip}`);
  const path = `emailOtpRateLimits/${key}`;
  const existingDoc = await firestoreAdminGet(env, path);
  const existing = existingDoc ? decodeFirestoreFields(existingDoc.fields) : null;
  const dateKey = todayKey();
  const sameDay = existing?.dateKey === dateKey;
  const count = sameDay ? Number(existing?.sendCountToday || 0) : 0;
  const elapsed = existing?.lastSentAt ? now - new Date(existing.lastSentAt).getTime() : Infinity;
  if (elapsed < IP_COOLDOWN_MS || count >= MAX_CODES_PER_IP_DAY) {
    const error = new Error('ip_rate_limit');
    error.retryAfterSeconds = elapsed < IP_COOLDOWN_MS
      ? Math.ceil((IP_COOLDOWN_MS - elapsed) / 1000)
      : 86400;
    throw error;
  }
  await firestoreAdminReplace(env, path, {
    lastSentAt: fsTimestamp(new Date(now)),
    dateKey: fsString(dateKey),
    sendCountToday: fsInteger(count + 1)
  });
}

function generateCode() {
  // Rechaza el sesgo del módulo relanzando si cae fuera del rango exacto de
  // 6 dígitos parejos (0..999999 son 1.000.000 valores, ya exacto para
  // Uint32 % 1e6 sin sesgo real — se mantiene simple).
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(value).padStart(6, '0');
}

async function sendCodeEmail(apiKey, email, code) {
  // Tabla en vez de flex/grid para las 6 cifras: Outlook de escritorio
  // renderiza con el motor de Word y no soporta flexbox/grid de forma
  // confiable — una tabla con <td> es lo único que se ve igual en todos
  // los clientes de correo. La fuente declara Montserrat primero (se ve
  // así en los pocos clientes que sí la cargan) con una pila web-safe de
  // respaldo (Helvetica/Arial) para el resto, en vez de forzar Montserrat
  // sola y dejar que el cliente caiga en su serif genérica.
  const digitCells = code
    .split('')
    .map(digit => `<td style="width:40px;height:52px;border:1px solid #efc7d8;border-radius:10px;background:#ffffff;font-size:25px;font-weight:800;color:#a00055;text-align:center;vertical-align:middle">${digit}</td>`)
    .join('<td style="width:8px"></td>');

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#fffafb;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#2b2226">
  <div style="max-width:460px;margin:0 auto;padding:40px 16px">
    <div style="background:#ffffff;border:1px solid #f1dce5;border-radius:16px;overflow:hidden">
      <div style="padding:22px 24px;text-align:center;background:#ffd4e2">
        <img src="${EMAIL_MARK}" width="64" height="64" alt="Tintin" style="display:block;width:64px;height:64px;margin:0 auto;border:0;outline:none">
      </div>
      <div style="padding:30px 28px;text-align:center">
        <p style="margin:0 0 8px;font-size:16px;font-weight:750;color:#2b2226">Tu código de acceso</p>
        <p style="margin:0 0 22px;font-size:13px;color:#765d67;line-height:1.6">Usalo para ingresar de forma segura a tu cuenta.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px">
          <tr>${digitCells}</tr>
        </table>
        <p style="margin:0;font-size:12px;color:#8a7d81;line-height:1.65">
          Vence en 5 minutos. Si no pediste este código, podés ignorar este correo — nadie puede entrar a tu cuenta sin él.
        </p>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#b6a7ac">Tintin Accesorios &amp; Relojes</p>
  </div>
</body>
</html>`;
  const text = `Tu código de acceso a Tintin Accesorios: ${code}\n\nVence en 5 minutos. Si no pediste este código, ignorá este correo.`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: `${code} es tu código de acceso a Tintin`,
      html,
      text
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(clean(data?.message || data?.error || `Resend HTTP ${response.status}`, 300));
  }
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

  const apiKey = clean(env.RESEND_API_KEY, 500);
  if (!apiKey) {
    return jsonResponse({ success: false, error: 'resend_not_configured' }, 500, origin, requestUrl);
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 2000) throw new Error('request_too_large');
    const body = JSON.parse(rawBody || '{}');
    const rawUsername = clean(body.username, 20);
    const rawEmail = clean(body.email, 254).toLowerCase();

    const now = Date.now();
    try {
      await enforceIpRateLimit(request, env, now);
    } catch (rateError) {
      if (rateError?.message === 'ip_rate_limit') {
        return jsonResponse({
          success: false,
          error: 'rate_limit_exceeded',
          retryAfterSeconds: rateError.retryAfterSeconds
        }, 429, origin, requestUrl);
      }
      throw rateError;
    }

    let email;
    if (rawUsername) {
      // Login por username: se resuelve al email real de la cuenta ANTES de
      // rate-limitear/enviar. Si el username no existe, la respuesta tiene
      // que ser indistinguible de un envío real (mismo success:true, sin
      // tocar emailOtpCodes ni llamar a Resend) — igual que ya exige
      // firestore.rules para que usernameReservations no sea un oráculo de
      // qué usernames tienen cuenta (ver scripts/probar-firestore-username-unico.mjs).
      const key = usernameKey(rawUsername);
      const resolved = key ? await resolveEmailFromUsernameKey(env, key) : null;
      if (!resolved) {
        return jsonResponse({ success: true }, 200, origin, requestUrl);
      }
      email = resolved;
    } else {
      email = rawEmail;
      if (!emailIsValid(email)) {
        return jsonResponse({ success: false, error: 'invalid_email' }, 400, origin, requestUrl);
      }
    }

    // El PIN es un segundo método de acceso a la MISMA cuenta, también si la
    // identidad se creó con Google. findOrCreateUserByEmail() reutiliza el UID
    // existente de Firebase Auth y solo crea uno cuando el email verificado no
    // existe, por lo que habilitar este camino no duplica perfiles.

    const path = docPath(email);
    const existingDoc = await firestoreAdminGet(env, path);
    const existing = existingDoc ? decodeFirestoreFields(existingDoc.fields) : null;
    if (existing?.lastSentAt) {
      const elapsed = now - new Date(existing.lastSentAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        return jsonResponse({
          success: false,
          error: 'cooldown_active',
          retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        }, 429, origin, requestUrl);
      }
    }

    const dateKey = todayKey();
    const sameDay = existing?.dateKey === dateKey;
    const sendCountToday = sameDay ? Number(existing?.sendCountToday || 0) : 0;
    if (sendCountToday >= MAX_CODES_PER_DAY) {
      return jsonResponse({ success: false, error: 'daily_limit_exceeded' }, 429, origin, requestUrl);
    }

    const code = generateCode();
    const codeHash = await hashCode(code);

    await firestoreAdminReplace(env, path, {
      codeHash: fsString(codeHash),
      expiresAt: fsTimestamp(new Date(now + CODE_TTL_MS)),
      attempts: fsInteger(0),
      lastSentAt: fsTimestamp(new Date(now)),
      dateKey: fsString(dateKey),
      sendCountToday: fsInteger(sendCountToday + 1)
    });

    await sendCodeEmail(apiKey, email, code);

    return jsonResponse({ success: true }, 200, origin, requestUrl);
  } catch (error) {
    // Mismo criterio que email-otp-verify: el detalle interno va a los logs,
    // nunca al cliente como código de error (no lo sabe traducir y expone
    // información del servidor).
    console.error('[email-otp-send] Error inesperado:', error?.message || error);
    const badRequest = error?.message === 'request_too_large' || error instanceof SyntaxError;
    return jsonResponse(
      { success: false, error: badRequest ? 'invalid_request' : 'server_error' },
      badRequest ? 400 : 500,
      origin,
      requestUrl
    );
  }
}
