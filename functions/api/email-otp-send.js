import {
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  firestoreAdminGet,
  firestoreAdminCommit,
  decodeFirestoreFields,
  encodeFirestoreFields,
  resolveEmailFromUsernameKey,
  fsString,
  fsInteger,
  fsTimestamp
} from '../../cloudflare/firebase-admin-ligero.js';
import { usernameKey } from '../../js/components/forms/utilidades-username.js';

const FROM_EMAIL = 'Tintin Accesorios <noreply@tintinaccs.com>';
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_CODES_PER_DAY = 8;
const MAX_CODES_PER_IP_DAY = 30;
const IP_COOLDOWN_MS = 10 * 1000;
const UINT32_RANGE = 0x100000000;
const OTP_SPACE = 1_000_000;
const OTP_UNBIASED_LIMIT = Math.floor(UINT32_RANGE / OTP_SPACE) * OTP_SPACE;

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

async function atomicReplace(env, path, fields, existingDoc) {
  return firestoreAdminCommit(env, [{
    path,
    fields,
    currentDocument: existingDoc
      ? { updateTime: existingDoc.updateTime }
      : { exists: false },
  }]);
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

  try {
    await atomicReplace(env, path, {
      lastSentAt: fsTimestamp(new Date(now)),
      dateKey: fsString(dateKey),
      sendCountToday: fsInteger(count + 1)
    }, existingDoc);
  } catch (error) {
    if (error?.status === 409 || error?.code === 'version_conflict') {
      const rateError = new Error('ip_rate_limit');
      rateError.retryAfterSeconds = Math.ceil(IP_COOLDOWN_MS / 1000);
      throw rateError;
    }
    throw error;
  }
}

function generateCode() {
  // Rejection sampling: 2^32 no es múltiplo exacto de 1.000.000. Rechazamos
  // la cola sobrante antes de aplicar módulo para que cada PIN de 000000 a
  // 999999 tenga exactamente la misma probabilidad.
  const buffer = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= OTP_UNBIASED_LIMIT);
  return String(value % OTP_SPACE).padStart(6, '0');
}

async function sendCodeEmail(apiKey, email, code) {
  const digitCells = code
    .split('')
    .map(digit => `<td style="width:40px;height:52px;border:1.5px solid #f1c4d4;border-radius:10px;background:#fff6fa;font-size:26px;font-weight:800;color:#ad3f67;text-align:center;vertical-align:middle">${digit}</td>`)
    .join('<td style="width:8px"></td>');

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#fdf1f5;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#2b2226">
  <div style="max-width:460px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border:1px solid #f1e4e7;border-radius:20px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#c6557d,#8e274d);padding:20px 24px;text-align:center">
        <div style="font-size:20px;font-weight:800;letter-spacing:.16em;color:#ffffff">TINTIN</div>
        <div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.78);margin-top:4px">Accesorios &amp; Relojes</div>
      </div>
      <div style="padding:32px 28px;text-align:center">
        <p style="margin:0 0 22px;font-size:14px;color:#5e5357;line-height:1.6">Usá este código para entrar a tu cuenta:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px">
          <tr>${digitCells}</tr>
        </table>
        <p style="margin:0;font-size:12.5px;color:#8a7d81;line-height:1.65">
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
    const otpFields = {
      codeHash: fsString(codeHash),
      expiresAt: fsTimestamp(new Date(now + CODE_TTL_MS)),
      attempts: fsInteger(0),
      lastSentAt: fsTimestamp(new Date(now)),
      dateKey: fsString(dateKey),
      sendCountToday: fsInteger(sendCountToday + 1)
    };

    try {
      await atomicReplace(env, path, otpFields, existingDoc);
    } catch (error) {
      if (error?.status === 409 || error?.code === 'version_conflict') {
        return jsonResponse({
          success: false,
          error: 'cooldown_active',
          retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000)
        }, 429, origin, requestUrl);
      }
      throw error;
    }

    await sendCodeEmail(apiKey, email, code);

    return jsonResponse({ success: true }, 200, origin, requestUrl);
  } catch (error) {
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
