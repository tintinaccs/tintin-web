import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS } from './sheets-sync-config.js';
import { fetchAppsScript } from './apps-script-fetch.js';

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function errorMessage(error) {
  return clean(error?.message || error || 'Error desconocido', 800);
}

/**
 * Replica best-effort un pedido YA CONFIRMADO por el dominio canónico hacia
 * `Pedidos web`. Sheets nunca participa del commit comercial: una caída de
 * Google no puede deshacer ni convertir en fallida una venta confirmada.
 *
 * El reconciliador periódico de Apps Script es la red de seguridad si este
 * push inmediato falla.
 */
export async function syncOrderToSheetsBestEffort(env, result, fetchImpl = fetchAppsScript) {
  const orderId = clean(result?.orderId, 220);
  const order = result?.order && typeof result.order === 'object' ? result.order : null;
  if (!orderId || !order) {
    return { ok: false, deferred: true, reason: 'missing_order_result' };
  }

  const secret = clean(env?.SHEETS_ENGAGEMENT_SECRET, 500);
  if (!secret) {
    return { ok: false, deferred: true, reason: 'missing_sheets_secret' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHEETS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        action: 'syncOrder',
        secret,
        orderId,
        order,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) {
      throw new Error(body?.error || `Apps Script respondió ${response.status}.`);
    }
    return { ok: true, deferred: false, row: Number(body.row || 0) || null };
  } catch (error) {
    console.warn('[Tintin Orders] Push inmediato a Sheets diferido; el reconciliador lo recuperará.', error);
    return { ok: false, deferred: true, error: errorMessage(error) };
  } finally {
    clearTimeout(timeout);
  }
}
