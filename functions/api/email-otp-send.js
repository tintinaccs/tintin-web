import {
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/cloudinary-security.js';
import {
  firestoreAdminGet,
  firestoreAdminReplace,
  decodeFirestoreFields,
  fsString,
  fsInteger,
  fsTimestamp
} from '../../cloudflare/firebase-admin-lite.js';

const FROM_EMAIL = 'Tintin Accesorios <noreply@tintinaccs.com>';
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutos, a pedido: "código de bonificación" con vencimiento corto
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_CODES_PER_DAY = 8;

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

function generateCode() {
  // Rechaza el sesgo del módulo relanzando si cae fuera del rango exacto de
  // 6 dígitos parejos (0..999999 son 1.000.000 valores, ya exacto para
  // Uint32 % 1e6 sin sesgo real — se mantiene simple).
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(value).padStart(6, '0');
}

async function sendCodeEmail(apiKey, email, code) {
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#fff6fa;font-family:Montserrat;color:#2b2b2b">
  <div style="max-width:480px;margin:0 auto;padding:28px 16px">
    <div style="background:#ffffff;border:1px solid #f1e4e7;border-radius:18px;padding:32px;text-align:center">
      <div style="font-size:15px;color:#7b6f72;margin-bottom:18px">Tu código de acceso a Tintin Accesorios</div>
      <div style="font-size:38px;font-weight:800;letter-spacing:.15em;color:#ad3f67;margin:10px 0 18px">${code}</div>
      <div style="font-size:13px;color:#7b6f72;line-height:1.6">
        Vence en 5 minutos. Si no pediste este código, ignorá este correo — nadie puede entrar a tu cuenta sin él.
      </div>
    </div>
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

  if (!originIsAllowed(origin, requestUrl)) {
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
    const email = clean(body.email, 254).toLowerCase();
    if (!emailIsValid(email)) {
      return jsonResponse({ success: false, error: 'invalid_email' }, 400, origin, requestUrl);
    }

    const path = docPath(email);
    const existingDoc = await firestoreAdminGet(env, path);
    const existing = existingDoc ? decodeFirestoreFields(existingDoc.fields) : null;
    const now = Date.now();

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
    return jsonResponse({ success: false, error: clean(error?.message || error, 300) }, 400, origin, requestUrl);
  }
}
