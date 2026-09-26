// Reseñas y "me gusta" viajan al mismo Web App que productos y pedidos: es el
// único despliegue cuyo doPost enruta syncEngagement/syncEngagementBatch. Un
// deployment propio quedaba desactualizado y respondía "Acción no permitida".
import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS as SYNC_TIMEOUT_MS } from './sheets-sync-config.js';
import { fetchAppsScript } from './apps-script-fetch.js';
import { supersedeQueuedEngagementEvents, syncEngagementEventOrQueue } from './resiliencia-sync-participacion.js';

// Compatibilidad temporal: acepta la firma vieja (env, idToken, event) y la
// nueva (env, event). El ID token ya fue validado por Cloudflare y no debe
// volver a verificarse en Apps Script; la frontera servidor-a-servidor es el
// secreto SHEETS_ENGAGEMENT_SECRET. Si Sheets falla, el evento queda en
// engagementSheetSyncQueue y el drenaje programado lo reintenta.
export async function syncEngagementToSheets(env, idTokenOrEvent, maybeEvent) {
  const event = maybeEvent || idTokenOrEvent;
  return syncEngagementEventOrQueue(env, event);
}

// Las purgas de catálogo pueden afectar muchas reseñas e interacciones. Un
// POST por registro agota el límite de subrequests del Worker antes de que la
// operación canónica termine. Apps Script recibe el conjunto bajo el mismo
// secreto y lo procesa bajo un único lock de hoja.
export async function syncEngagementBatchToSheets(env, events) {
  const batch = Array.isArray(events) ? events.filter(event => event?.type && event?.record) : [];
  if (!batch.length) return true;
  const ok = await postEngagementBatch(env, batch);
  // La cola de reintentos no debe reenviar después una versión anterior de
  // estos registros. Un fallo acá no bloquea la purga que llama.
  try {
    await supersedeQueuedEngagementEvents(env, batch, { delivered: ok });
  } catch (error) {
    console.warn('[engagement-sheets] No se pudo reconciliar la cola de reintentos con el lote:', error?.message || error);
  }
  return ok;
}

async function postEngagementBatch(env, batch) {
  const syncSecret = String(env?.SHEETS_ENGAGEMENT_SECRET || '');
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
