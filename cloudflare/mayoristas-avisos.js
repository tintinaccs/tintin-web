// Efectos posteriores de las cotizaciones mayoristas: notificaciones (panel,
// push y campanita de la clienta), correo y espejo en Google Sheets.
// Se ejecutan DESPUÉS del commit: un fallo acá nunca deshace la cotización.
import { notifyAdminIfAbsent, notifyUserIfAbsent } from './notificaciones-sociales.js';
import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS } from './sheets-sync-config.js';
import { fetchAppsScript } from './apps-script-fetch.js';
import {
  EMAIL_MARK,
  FROM_EMAIL,
  REPLY_TO,
  clean,
  emailIsValid,
  escapeHtml,
  fmtPrice,
  sendResendEmail,
} from '../functions/api/order-email.js';

const ADMIN_TARGET = 'admin.html#mayoristas';
const CUSTOMER_TARGET = 'perfil.html#mayorista';

function lineCount(quote) {
  return Array.isArray(quote?.items) ? quote.items.length : 0;
}

async function settle(label, task) {
  try {
    return await task();
  } catch (error) {
    console.warn(`[mayoristas] ${label} falló:`, error?.message || error);
    return { ok: false, error: String(error?.message || error).slice(0, 300) };
  }
}

/** Correo que confirma la cotización aprobada. */
export function buildWholesaleApprovedEmail(quote) {
  const name = clean(quote.customerName || quote.businessName || 'Hola', 120);
  const number = clean(quote.quoteNumber, 30);
  const rows = (Array.isArray(quote.items) ? quote.items : []).map(item => `
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#2b2226">${escapeHtml(clean(item.name, 180))}${item.variant ? ` <span style="color:#8a7d81">(${escapeHtml(clean(item.variant, 120))})</span>` : ''}</td>
            <td style="padding:8px 0;font-size:13px;color:#5e5357;text-align:center">${Number(item.qty) || 0}</td>
            <td style="padding:8px 0;font-size:13px;color:#2b2226;text-align:right">${escapeHtml(fmtPrice(item.lineTotal))}</td>
          </tr>`).join('');
  const intro = 'Tu cotización mayorista fue aceptada. En unos instantes una de nuestras agentes se va a comunicar con vos por WhatsApp para enviarte los detalles y coordinar el pago y la entrega.';
  const html = `<!doctype html>
<html lang="es"><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;background:#fffafb;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#2b2226">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px">
    <div style="background:#ffffff;border:1px solid #f1dce5;border-radius:16px;overflow:hidden">
      <div style="padding:22px 24px;text-align:center;background:#ffd4e2">
        <img src="${EMAIL_MARK}" width="64" height="64" alt="Tintin" style="display:block;width:64px;height:64px;margin:0 auto 14px;border:0;filter:grayscale(1) brightness(0) invert(1)">
        <div style="font-size:20px;font-weight:760;color:#2b2226">¡Tu cotización fue aceptada!</div>
        <div style="margin-top:7px;font-size:11px;font-weight:750;letter-spacing:.1em;color:#a00055">COTIZACIÓN ${escapeHtml(number)}</div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 16px;font-size:14.5px">Hola <strong>${escapeHtml(name)}</strong>,</p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#5e5357">${escapeHtml(intro)}</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #f1dce5">
          <tr>
            <th style="padding:8px 0;font-size:11px;color:#8a7d81;text-align:left">Producto</th>
            <th style="padding:8px 0;font-size:11px;color:#8a7d81;text-align:center">Cant.</th>
            <th style="padding:8px 0;font-size:11px;color:#8a7d81;text-align:right">Subtotal</th>
          </tr>${rows}
        </table>
        <p style="margin:14px 0 0;font-size:14px;text-align:right">Total mayorista: <strong style="color:#ad3f67">${escapeHtml(fmtPrice(quote.total))}</strong></p>
        ${quote.adminNote ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#5e5357"><strong>Nota de Tintin:</strong> ${escapeHtml(clean(quote.adminNote, 1000))}</p>` : ''}
        <p style="margin:22px 0 0;font-size:12.5px;line-height:1.65;color:#8a7d81">Te vamos a escribir al WhatsApp que dejaste en la cotización. También podés responder este correo.</p>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#b6a7ac">Tintin Accesorios &amp; Relojes</p>
  </div>
</body>
</html>`;
  const textLines = (Array.isArray(quote.items) ? quote.items : [])
    .map(item => `- ${clean(item.name, 180)}${item.variant ? ` (${clean(item.variant, 120)})` : ''} x${Number(item.qty) || 0}: ${fmtPrice(item.lineTotal)}`);
  const text = `¡Tu cotización ${number} fue aceptada!\n\nHola ${name}:\n\n${intro}\n\n${textLines.join('\n')}\n\nTotal mayorista: ${fmtPrice(quote.total)}${quote.adminNote ? `\n\nNota de Tintin: ${clean(quote.adminNote, 1000)}` : ''}\n\nTe vamos a escribir al WhatsApp que dejaste en la cotización.`;
  return { subject: `Tu cotización mayorista ${number} fue aceptada — Tintin`, html, text };
}

export async function sendWholesaleApprovedEmail(env, quote, send = sendResendEmail) {
  const apiKey = clean(env?.RESEND_API_KEY, 300);
  if (!apiKey) return { sent: false, reason: 'missing_resend_key' };
  const recipient = clean(quote?.userEmail, 254).toLowerCase();
  if (!emailIsValid(recipient)) return { sent: false, reason: 'invalid_email' };
  const content = buildWholesaleApprovedEmail(quote);
  await send(apiKey, {
    from: FROM_EMAIL, to: [recipient], reply_to: REPLY_TO,
    subject: content.subject, html: content.html, text: content.text,
  }, `wholesale-${clean(quote.quoteId, 200)}-approved`);
  return { sent: true };
}

/** Espejo best-effort en la pestaña "Mayoristas" de la planilla canónica. */
export async function syncWholesaleQuoteToSheets(env, quote, fetchImpl = fetchAppsScript) {
  const secret = clean(env?.SHEETS_ENGAGEMENT_SECRET, 500);
  if (!secret) return { ok: false, deferred: true, reason: 'missing_sheets_secret' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHEETS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(APPS_SCRIPT_SYNC_URL, {
      method: 'POST', redirect: 'follow', signal: controller.signal,
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action: 'syncWholesaleQuote', secret, quoteId: quote.quoteId, quote }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) throw new Error(body?.error || `Apps Script respondió ${response.status}.`);
    return { ok: true, row: Number(body.row || 0) || null };
  } catch (error) {
    return { ok: false, deferred: true, error: String(error?.message || error).slice(0, 300) };
  } finally {
    clearTimeout(timeout);
  }
}

/** Avisos al crear una cotización. */
export async function afterWholesaleQuoteCreated(env, result, deps = {}) {
  const quote = result?.quote;
  if (!quote || result.duplicate) return { skipped: true };
  const notifyAdmin = deps.notifyAdmin || notifyAdminIfAbsent;
  const notifyUser = deps.notifyUser || notifyUserIfAbsent;
  const sync = deps.sync || syncWholesaleQuoteToSheets;
  const [admin, customer, sheets] = await Promise.all([
    settle('aviso al panel', () => notifyAdmin(env, {
      kind: 'wholesale_quote_created', actorType: 'customer', actorUid: quote.userId,
      actorName: quote.businessName || quote.customerName,
      title: `Nueva cotización mayorista ${quote.quoteNumber}`,
      body: `${quote.businessName} pidió ${quote.itemCount} unidades en ${lineCount(quote)} producto${lineCount(quote) === 1 ? '' : 's'}.`,
      iconKey: 'order', targetUrl: ADMIN_TARGET, status: 'pendiente',
      orderId: quote.quoteId, orderNumber: quote.quoteNumber,
      sourceType: 'wholesale_quote', sourceId: quote.quoteId,
    }, `wholesale_created:${quote.quoteId}`)),
    settle('aviso a la clienta', () => notifyUser(env, quote.userId, {
      kind: 'wholesale_quote_received', actorType: 'store', actorName: 'Tintin',
      title: `Recibimos tu cotización ${quote.quoteNumber}`,
      body: 'La estamos revisando. Te avisamos apenas tengamos los precios.',
      iconKey: 'order', targetUrl: CUSTOMER_TARGET, status: 'pendiente',
      orderId: quote.quoteId, orderNumber: quote.quoteNumber,
      sourceType: 'wholesale_quote', sourceId: quote.quoteId,
    }, `wholesale_received:${quote.quoteId}`)),
    settle('espejo en Sheets', () => sync(env, quote)),
  ]);
  return { admin, customer, sheets };
}

/** Avisos al aprobar o rechazar (guardar precios no avisa a la clienta). */
export async function afterWholesaleQuoteResponded(env, result, deps = {}) {
  if (result?.decision === 'ver') return { skipped: true };
  const quote = result?.quote;
  if (!quote) return { skipped: true };
  const notifyUser = deps.notifyUser || notifyUserIfAbsent;
  const sendEmail = deps.sendEmail || sendWholesaleApprovedEmail;
  const sync = deps.sync || syncWholesaleQuoteToSheets;
  const tasks = [settle('espejo en Sheets', () => sync(env, quote))];
  if (result.decision === 'aprobar') {
    tasks.push(settle('aviso de aprobación', () => notifyUser(env, quote.userId, {
      kind: 'wholesale_quote_approved', actorType: 'store', actorName: 'Tintin',
      title: `Cotización confirmada ${quote.quoteNumber}`,
      body: 'Aceptamos tu cotización. En instantes una agente te escribe por WhatsApp con los detalles.',
      iconKey: 'order', targetUrl: CUSTOMER_TARGET, status: 'aprobada',
      orderId: quote.quoteId, orderNumber: quote.quoteNumber,
      sourceType: 'wholesale_quote', sourceId: quote.quoteId,
    }, `wholesale_approved:${quote.quoteId}`)));
    tasks.push(settle('correo de aprobación', () => sendEmail(env, quote)));
  } else if (result.decision === 'rechazar') {
    tasks.push(settle('aviso de rechazo', () => notifyUser(env, quote.userId, {
      kind: 'wholesale_quote_rejected', actorType: 'store', actorName: 'Tintin',
      title: `No pudimos aceptar la cotización ${quote.quoteNumber}`,
      body: quote.adminNote || 'Escribinos por WhatsApp y lo revisamos juntas.',
      iconKey: 'order', targetUrl: CUSTOMER_TARGET, status: 'rechazada',
      orderId: quote.quoteId, orderNumber: quote.quoteNumber,
      sourceType: 'wholesale_quote', sourceId: quote.quoteId,
    }, `wholesale_rejected:${quote.quoteId}`)));
  }
  return Promise.all(tasks);
}
