const APPS_SCRIPT_SYNC_URL =
  'https://script.google.com/macros/s/AKfycbwiBvdkkEeWMHLnj57st2nBKwx9Xci88J0hAMlkkJ1j7vkpzn0A0f4DhPDqh8KkL947/exec';
const SYNC_TIMEOUT_MS = 12_000;
import { fetchAppsScript } from './apps-script-fetch.js';

// Compatibilidad temporal: acepta la firma vieja (env, idToken, event) y la
// nueva (env, event). El ID token ya fue validado por Cloudflare y no debe
// volver a verificarse en Apps Script; la frontera servidor-a-servidor es el
// secreto SHEETS_ENGAGEMENT_SECRET.
export async function syncEngagementToSheets(env, idTokenOrEvent, maybeEvent) {
  const event = maybeEvent || idTokenOrEvent;
  const syncSecret = String(env?.SHEETS_ENGAGEMENT_SECRET || '');
  if (!syncSecret || !event?.type) return false;
  try {
    const response = await fetchAppsScript(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action: 'syncEngagement', syncSecret, event }),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.ok === true;
  } catch (error) {
    console.warn('[engagement-sheets] Sincronización pendiente:', error?.message || error);
    return false;
  }
}

// Las purgas de catálogo pueden afectar muchas reseñas e interacciones. Un
// POST por registro agota el límite de subrequests del Worker antes de que la
// operación canónica termine. Apps Script recibe el conjunto bajo el mismo
// secreto y lo procesa bajo un único lock de hoja.
export async function syncEngagementBatchToSheets(env, events) {
  const syncSecret = String(env?.SHEETS_ENGAGEMENT_SECRET || '');
  const batch = Array.isArray(events) ? events.filter(event => event?.type && event?.record) : [];
  if (!batch.length) return true;
  if (!syncSecret) return false;
  try {
    const response = await fetchAppsScript(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action: 'syncEngagementBatch', syncSecret, events: batch }),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.ok === true;
  } catch (error) {
    console.warn('[engagement-sheets] Sincronización agrupada pendiente:', error?.message || error);
    return false;
  }
}
