import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  SUPERADMIN_EMAIL
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  firestoreAdminGet,
  firestoreAdminReplace,
  firestoreAdminCommit,
  decodeFirestoreFields,
  fsString,
  fsInteger,
  fsTimestamp
} from '../../cloudflare/firebase-admin-ligero.js';

const FROM_EMAIL = 'No Reply · Tintin <noreply@tintinaccs.com>';
const EMAIL_MARK = 'https://tintinaccesorios.pages.dev/assets-tintin/images/general/logo.png';
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_CODES_PER_DAY = 8;
const MAX_CODES_PER_IP_DAY = 30;
const IP_COOLDOWN_MS = 10 * 1000;
const RATE_RESERVE_TRIES = 5;
const DELIVERY_PROBE_DELAY_MS = 450;
const TERMINAL_DELIVERY_FAILURES = new Set(['bounced', 'failed', 'suppressed', 'canceled']);

function clean(value, maxLength = 254) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function docPath(email) {
  return `emailOtpCodes/${encodeURIComponent(email)}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function hashCode(code) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashRateKey(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function reserveOtpSendLimit(env, { path, now, cooldownMs, dailyMaximum, legacyDocument = null }, deps = { get: firestoreAdminGet, commit: firestoreAdminCommit }) {
  const dateKey = new Date(now).toISOString().slice(0, 10);
  const legacy = legacyDocument ? decodeFirestoreFields(legacyDocument.fields) : null;
  for (let attempt = 0; attempt < RATE_RESERVE_TRIES; attempt += 1) {
    const existingDoc = await deps.get(env, path);
    const existing = existingDoc ? decodeFirestoreFields(existingDoc.fields) : null;
    if (existingDoc && !existingDoc.updateTime) throw new Error('rate_version_missing');
    const count = Math.max(
      existing?.dateKey === dateKey ? Number(existing.sendCountToday || 0) : 0,
      legacy?.dateKey === dateKey ? Number(legacy.sendCountToday || 0) : 0
    );
    const lastSentAt = Math.max(
      existing?.lastSentAt ? new Date(existing.lastSentAt).getTime() : -Infinity,
      legacy?.lastSentAt ? new Date(legacy.lastSentAt).getTime() : -Infinity
    );
    const elapsed = now - lastSentAt;
    if (elapsed < cooldownMs || count >= dailyMaximum) {
      throw Object.assign(new Error('otp_send_limit'), {
        code: elapsed < cooldownMs ? 'cooldown_active' : 'daily_limit_exceeded',
        retryAfterSeconds: elapsed < cooldownMs ? Math.ceil((cooldownMs - elapsed) / 1000) : 86400,
      });
    }
    try {
      await deps.commit(env, [{
        path,
        fields: { lastSentAt: fsTimestamp(new Date(now)), dateKey: fsString(dateKey), sendCountToday: fsInteger(count + 1) },
        currentDocument: existingDoc ? { updateTime: existingDoc.updateTime } : { exists: false },
      }]);
      return { dateKey, sendCountToday: count + 1 };
    } catch (error) {
      if (error?.code !== 'version_conflict' && error?.status !== 409) throw error;
    }
  }
  throw Object.assign(new Error('otp_send_limit'), { code: 'cooldown_active', retryAfterSeconds: Math.ceil(cooldownMs / 1000) });
}

export async function enforceIpRateLimit(request, env, now, deps) {
  const ip = clean(request.headers.get('CF-Connecting-IP'), 80);
  if (!ip) throw new Error('rate_identity_missing');
  const key = await hashRateKey(`${env.OTP_RATE_SALT || 'tintin-otp'}:${ip}`);
  const path = `emailOtpRateLimits/${key}`;
  try {
    await reserveOtpSendLimit(env, { path, now, cooldownMs: IP_COOLDOWN_MS, dailyMaximum: MAX_CODES_PER_IP_DAY }, deps);
  } catch (error) {
    if (error?.message !== 'otp_send_limit') throw error;
    throw Object.assign(new Error('ip_rate_limit'), { retryAfterSeconds: error.retryAfterSeconds });
  }
}

function generateCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(value).padStart(6, '0');
}

async function getResendEmailStatus(apiKey, emailId) {
  const safeId = clean(emailId, 120);
  if (!safeId) return '';
  const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(safeId)}`, {
    headers: { authorization: `Bearer ${apiKey}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(clean(data?.message || data?.error || `Resend status HTTP ${response.status}`, 300));
  }
  return clean(data?.last_event, 40).toLowerCase();
}

async function sendCodeEmail(apiKey, email, code, requestId) {
  const digitCells = code
    .split('')
    .map(digit => `<td style="width:40px;height:52px;border:1px solid #efc7d8;border-radius:10px;background:#ffffff;font-size:25px;font-weight:800;color:#a00055;text-align:center;vertical-align:middle">${digit}</td>`)
    .join('<td style="width:8px"></td>');

  const html = `<!doctype html>
<html lang="es"><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;background:#fffafb;background-image:linear-gradient(#fffafb,#fffafb);font-family:Montserrat,Helvetica,Arial,sans-serif;color:#2b2226">
  <div style="max-width:460px;margin:0 auto;padding:40px 16px">
    <div style="background:#ffffff;border:1px solid #f1dce5;border-radius:16px;overflow:hidden">
      <div style="padding:22px 24px;text-align:center;background:#ffd4e2;background-image:linear-gradient(#ffd4e2,#ffd4e2)">
        <img src="${EMAIL_MARK}" width="64" height="64" alt="Tintin" style="display:block;width:64px;height:64px;margin:0 auto;border:0;outline:none;filter:grayscale(1) brightness(0) invert(1)">
      </div>
      <div style="padding:30px 28px;text-align:center">
        <p style="margin:0 0 8px;font-size:16px;font-weight:750;color:#2b2226">Tu código de acceso</p>
        <p style="margin:0 0 22px;font-size:13px;color:#765d67;line-height:1.6">Usalo para ingresar de forma segura a tu cuenta.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px">
          <tr>${digitCells}</tr>
        </table>
        <p style="margin:0 0 18px;font-size:12px;color:#765d67;line-height:1.55">Volvé a Tintin y tocá «Pegar código» para completarlo sin escribir los números.</p>
        <p style="margin:0;font-size:12px;color:#8a7d81;line-height:1.65">
          Vence en 5 minutos. Si no pediste este código, podés ignorar este correo — nadie puede entrar a tu cuenta sin él.
        </p>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#b6a7ac">Tintin Accesorios &amp; Relojes</p>
  </div>
</body>
</html>`;
  const text = `Tu código de acceso a Tintin Accesorios: ${code}\n\nVolvé a Tintin y tocá «Pegar código» para completarlo sin escribir los números.\n\nVence en 5 minutos. Si no pediste este código, ignorá este correo.`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': `tintin-otp-${requestId}`
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      reply_to: SUPERADMIN_EMAIL,
      subject: `${code} es tu código de acceso a Tintin`,
      html,
      text,
      tags: [{ name: 'category', value: 'auth_otp' }]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(clean(data?.message || data?.error || `Resend HTTP ${response.status}`, 300));
  }
  const emailId = clean(data?.id, 120);
  if (!emailId) throw new Error('Resend aceptó la solicitud sin devolver email id');
  return emailId;
}

export async function handleEmailOtpSend(context, overrides = {}) {
  const { request, env } = context;
  const deps = { get: firestoreAdminGet, replace: firestoreAdminReplace, commit: firestoreAdminCommit, send: sendCodeEmail, status: getResendEmailStatus, pause: sleep, ...overrides };
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
    const rawEmail = clean(body.email, 254).toLowerCase();

    const now = Date.now();
    try {
      await enforceIpRateLimit(request, env, now, deps);
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

    // Sólo correo: el ingreso con @usuario se retiró.
    const email = rawEmail;
    if (!emailIsValid(email)) {
      return jsonResponse({ success: false, error: 'invalid_email' }, 400, origin, requestUrl);
    }

    // La cuenta Super Admin entra sólo con Google (email-otp-verify también
    // la rechaza): no se le envían códigos de acceso por correo.
    if (email === SUPERADMIN_EMAIL) {
      return jsonResponse({ success: false, error: 'email_not_allowed' }, 403, origin, requestUrl);
    }

    const path = docPath(email);
    const existingDoc = await deps.get(env, path);
    let sendLimit;
    try {
      // La cuota vive separada del código de un uso: verificar y consumir un
      // OTP no reinicia el límite. La reserva ocurre antes de llamar a Resend.
      sendLimit = await reserveOtpSendLimit(env, {
        path: `emailOtpRateLimits/email_${await hashRateKey(`${env.OTP_RATE_SALT || 'tintin-otp'}:${email}`)}`,
        now, cooldownMs: RESEND_COOLDOWN_MS, dailyMaximum: MAX_CODES_PER_DAY, legacyDocument: existingDoc,
      }, deps);
    } catch (error) {
      if (error?.message !== 'otp_send_limit') throw error;
      return jsonResponse({ success: false, error: error.code, retryAfterSeconds: error.retryAfterSeconds }, 429, origin, requestUrl);
    }

    const code = generateCode();
    const codeHash = await hashCode(code);
    const requestId = crypto.randomUUID();
    let providerEmailId = '';
    let providerLastEvent = 'accepted';

    try {
      providerEmailId = await deps.send(apiKey, email, code, requestId);

      await deps.pause(DELIVERY_PROBE_DELAY_MS);
      try {
        providerLastEvent = await deps.status(apiKey, providerEmailId) || providerLastEvent;
      } catch (statusError) {
        console.warn('[email-otp-send] Resend aceptó el correo pero no se pudo consultar su estado inicial:', statusError?.message || statusError);
      }

      if (TERMINAL_DELIVERY_FAILURES.has(providerLastEvent)) {
        console.error('[email-otp-send] Entrega OTP rechazada tras aceptación:', {
          providerEmailId,
          providerLastEvent
        });
        return jsonResponse({ success: false, error: 'send_failed' }, 502, origin, requestUrl);
      }
    } catch (sendError) {
      console.error('[email-otp-send] Resend rechazó el correo:', sendError?.message || sendError);
      return jsonResponse({ success: false, error: 'send_failed' }, 502, origin, requestUrl);
    }

    await deps.replace(env, path, {
      codeHash: fsString(codeHash),
      expiresAt: fsTimestamp(new Date(now + CODE_TTL_MS)),
      attempts: fsInteger(0),
      lastSentAt: fsTimestamp(new Date(now)),
      dateKey: fsString(sendLimit.dateKey),
      sendCountToday: fsInteger(sendLimit.sendCountToday),
      provider: fsString('resend'),
      providerEmailId: fsString(providerEmailId),
      providerLastEvent: fsString(providerLastEvent),
      providerAcceptedAt: fsTimestamp(new Date()),
      providerStatusCheckedAt: fsTimestamp(new Date())
    });

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

export async function onRequest(context) {
  return handleEmailOtpSend(context);
}
