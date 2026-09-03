/**
 * TINTIN — Cliente público canónico para crear pedidos.
 *
 * El navegador habla únicamente con Cloudflare Pages. Cloudflare valida la
 * sesión antes de reenviar la transacción heredada a Apps Script, de modo que
 * la URL privilegiada de Apps Script no forme parte del contrato público del
 * checkout.
 */
import { auth } from './core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-2';
import { apiUrl } from './core/firebase/origen-funciones.js?v=tintin-20260716-cloudinary-fix-1';

const CREATE_ORDER_TIMEOUT_MS = 35000;
const CREATE_ORDER_ENDPOINT = apiUrl('apps-script-bridge');

function phoneForOrderServer(value) {
  // El Apps Script valida 8–20 dígitos; la UI puede conservar el +595.
  return String(value == null ? '' : value).replace(/\D/g, '');
}

export async function createOrderViaServer(draft) {
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) return { ok: false, error: 'missing_id_token' };

  const serverDraft = {
    ...draft,
    phone: phoneForOrderServer(draft?.phone)
  };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CREATE_ORDER_TIMEOUT_MS);

  try {
    const response = await fetch(CREATE_ORDER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'createOrder', idToken, ...serverDraft }),
      signal: controller.signal
    });

    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      console.error('[create-order-public-client] El endpoint devolvió una respuesta no válida. HTTP', response.status);
      return { ok: false, error: 'invalid_response', status: response.status };
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, error: 'server_timeout' };
    }
    console.error('[create-order-public-client] No se pudo conectar con el servidor de pedidos:', error);
    return { ok: false, error: 'network_error' };
  } finally {
    window.clearTimeout(timeout);
  }
}
