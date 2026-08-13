import {
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';

const APPS_SCRIPT_SYNC_URL =
  'https://script.google.com/macros/s/AKfycbyh9I5aPp9d3lMSnYRNfrHcSCCobCoDOif9CqtXmMe4FgwSjzlKf4kjQZqvKDRmEY6S/exec';
const MAX_BODY_BYTES = 64 * 1024;
const SHEETS_TIMEOUT_MS = 12_000;

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);
  }

  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'Solicitud vacía o demasiado grande.' }, 400, origin, requestUrl);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido.' }, 400, origin, requestUrl);
  }

  const productIds = Array.isArray(payload.productIds)
    ? [...new Set(payload.productIds.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 100)
    : [];
  if (payload.action !== 'syncProducts' || !productIds.length || !payload.idToken) {
    return jsonResponse({ ok: false, error: 'Solicitud de sincronización incompleta.' }, 400, origin, requestUrl);
  }

  try {
    const response = await fetch(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        action: 'syncProducts',
        sheetName: 'Productos',
        schemaVersion: 2,
        productIds,
        idToken: String(payload.idToken),
      }),
    });
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`El motor de Sheets devolvió una respuesta inválida (${response.status}).`);
    }
    if (!response.ok || result.ok !== true) {
      throw new Error(result.error || `El motor de Sheets respondió ${response.status}.`);
    }
    return jsonResponse(result, 200, origin, requestUrl);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo contactar el motor de Sheets.',
    }, 502, origin, requestUrl);
  }
}
