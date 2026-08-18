/**
 * TINTIN — cliente de creación segura de pedidos.
 *
 * La creación vive en /api/create-order (Cloudflare Pages Functions) y usa
 * la cuenta de servicio de Firebase del servidor. Así el checkout no depende
 * de que una versión manual de Google Apps Script tenga exactamente los
 * mismos archivos auxiliares desplegados.
 */
import { auth } from './core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { apiUrl } from './core/firebase/origen-funciones.js?v=tintin-20260716-cloudinary-fix-1';

function digits(value, max = 40) {
  return String(value == null ? '' : value).replace(/\D/g, '').slice(0, max);
}

function phoneForOrderServer(value) {
  // La UI conserva +595... como formato canónico de contacto; el contrato de
  // transporte manda solo dígitos para que servidor, Sheets y WhatsApp usen
  // una representación única.
  return digits(value, 20);
}

function documentForOrderServer() {
  const exposed = window.TintinCheckoutInputEnhancements?.documentNumberDigits?.();
  if (exposed != null) return digits(exposed, 8);
  return digits(document.getElementById('ck-document-number')?.value, 8);
}

export async function createOrderViaServer(draft) {
  const user = auth.currentUser;
  const idToken = await user?.getIdToken(true);
  if (!idToken) return { ok: false, error: 'missing_id_token' };

  const serverDraft = {
    ...draft,
    phone: phoneForOrderServer(draft?.phone),
    documentNumber: documentForOrderServer(),
  };

  let response;
  try {
    response = await fetch(apiUrl('create-order'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serverDraft),
    });
  } catch (error) {
    console.error('[create-order-client] No se pudo conectar con el endpoint de pedidos.', error);
    return { ok: false, error: 'server_error' };
  }

  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    console.error('[create-order-client] El endpoint devolvió una respuesta no válida. HTTP', response.status);
    return { ok: false, error: 'invalid_response', status: response.status };
  }

  if (!response.ok && data?.ok !== false) {
    return { ok: false, error: data?.error || 'server_error', status: response.status };
  }
  return data;
}
