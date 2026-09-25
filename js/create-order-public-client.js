/**
 * TINTIN — Cliente público canónico para crear pedidos.
 *
 * El navegador habla únicamente con Cloudflare Pages. Cloudflare valida la
 * sesión antes de reenviar la transacción heredada a Apps Script, de modo que
 * la URL privilegiada de Apps Script no forme parte del contrato público del
 * checkout.
 */
import { apiUrl } from './core/firebase/origen-funciones.js?v=tintin-20260716-cloudinary-fix-1';
import { currentAuthenticatedUser, authenticatedFetch } from './core/auth/cliente-api-autenticado.js?v=tintin-20260918-global-session-restore-2-auth-persistence-20260919-1-app-check-retry-cascade-1-auth-popup-resolver-1';

const CREATE_ORDER_TIMEOUT_MS = 35000;
const CREATE_ORDER_ENDPOINT = apiUrl('apps-script-bridge');

function phoneForOrderServer(value) {
  // El Apps Script valida 8–20 dígitos; la UI puede conservar el +595.
  return String(value == null ? '' : value).replace(/\D/g, '');
}

export async function createOrderViaServer(draft) {
  let user;
  try { user = await currentAuthenticatedUser(); }
  catch (error) { return { ok: false, error: error.code === 'auth/session-unknown' ? 'session_unknown' : 'missing_id_token' }; }
  if (!user) return { ok: false, error: 'missing_id_token' };
  const idToken = await user.getIdToken();
  if (!idToken) return { ok: false, error: 'missing_id_token' };

  const serverDraft = {
    ...draft,
    phone: phoneForOrderServer(draft?.phone)
  };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CREATE_ORDER_TIMEOUT_MS);

  const request = async token => {
    const response = await authenticatedFetch(CREATE_ORDER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'createOrder', idToken: token, ...serverDraft }),
      signal: controller.signal
    }, {
      retryInit: refreshedToken => ({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'createOrder', idToken: refreshedToken, ...serverDraft }),
        signal: controller.signal
      })
    });

    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      console.error('[create-order-public-client] El endpoint devolvió una respuesta no válida. HTTP', response.status);
      return { ok: false, error: 'invalid_response', status: response.status };
    }
  };

  try {
    const result = await request(idToken);
    // El bridge puede propagar la respuesta JSON de Apps Script con HTTP 200.
    // En ese caso authenticatedFetch no ve el 401 y no llega a renovar el
    // token. Reintentamos una sola vez con un token fresco; requestId mantiene
    // la operación idempotente si el primer intento alcanzó a crear el pedido.
    if (result?.ok === false && result.error === 'invalid_id_token') {
      const refreshedToken = await user.getIdToken(true);
      if (!refreshedToken) return { ok: false, error: 'missing_id_token' };
      return await request(refreshedToken);
    }
    return result;
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
