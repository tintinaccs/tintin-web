/**
 * TINTIN — Cliente del endpoint server-side de pedidos (Fase 4).
 *
 * Llama a la acción `createOrder` del mismo Apps Script que ya manda los
 * correos (ver js/email/notificaciones-correo.js), autenticado con el idToken real de
 * quien compra. El Apps Script corre con la identidad de su dueño
 * (ScriptApp.getOAuthToken()) y por eso no pasa por el límite de 1000
 * expresiones de firestore.rules ni por ningún tope de productos —
 * ver apps-script/CrearPedido.gs para la validación completa.
 */
import { EMAIL_WEBHOOK_URL } from './email/configuracion-correo.js?v=tintin-20260716-cloudinary-fix-1';
import { auth } from './core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';

export async function createOrderViaServer(draft) {
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) return { ok: false, error: 'missing_id_token' };

  const response = await fetch(EMAIL_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'createOrder', idToken, ...draft })
  });

  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    console.error('[create-order-client] El endpoint devolvió una respuesta no válida. HTTP', response.status);
    return { ok: false, error: 'invalid_response', status: response.status };
  }
}
