import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  SUPERADMIN_EMAIL
} from '../../cloudflare/cloudinary-security.js';
import {
  firestoreAdminGet,
  firestoreAdminReplace,
  decodeFirestoreFields,
  lookupUserProvidersByEmail,
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
  // Tabla en vez de flex/grid para las 6 cifras: Outlook de escritorio
  // renderiza con el motor de Word y no soporta flexbox/grid de forma
  // confiable — una tabla con <td> es lo único que se ve igual en todos
  // los clientes de correo. La fuente declara Montserrat primero (se ve
  // así en los pocos clientes que sí la cargan) con una pila web-safe de
  // respaldo (Helvetica/Arial) para el resto, en vez de forzar Montserrat
  // sola y dejar que el cliente caiga en su serif genérica.
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

    // El correo normal no es un segundo camino hacia una cuenta que ya usa
    // Google — evita confusión ("¿por qué mi cuenta cambió?") y el riesgo
    // de que alguien intente entrar así a una cuenta ajena si adivina el
    // código. Excepción: el Super Admin siempre puede usar cualquiera de
    // los dos métodos, a pedido explícito.
    if (email !== SUPERADMIN_EMAIL.toLowerCase()) {
      const { exists, providers } = await lookupUserProvidersByEmail(env, email);
      if (exists && providers.includes('google.com')) {
        return jsonResponse({ success: false, error: 'google_account_exists' }, 409, origin, requestUrl);
      }
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
