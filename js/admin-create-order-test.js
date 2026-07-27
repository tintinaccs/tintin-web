/**
 * TINTIN — Prueba manual del endpoint server-side de pedidos (Fase 4).
 *
 * Solo la usa el botón "🧪 Probar pedido servidor" del panel Super Admin
 * (Productos). Llama a la acción `createOrder` del mismo Apps Script que ya
 * manda los correos (ver js/email-notify.js), que corre con
 * ScriptApp.getOAuthToken() y por eso no pasa por el límite de 1000
 * expresiones de firestore.rules ni por el tope de 4 productos distintos.
 * No toca checkout.html ni js/secure-checkout-order.js — es un endpoint
 * nuevo y separado hasta confirmar que funciona.
 */
import { EMAIL_WEBHOOK_URL } from './email-config.js?v=tintin-20260716-cloudinary-fix-1';
import { auth } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';

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
    return { ok: false, error: 'invalid_response', status: response.status, raw: body.slice(0, 500) };
  }
}
