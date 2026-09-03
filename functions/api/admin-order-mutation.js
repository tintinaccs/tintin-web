import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import { applyOrderAdminMutation, createOrderAdmin } from '../../cloudflare/order-admin-domain.js';
import { syncOrderToSheetsBestEffort } from '../../cloudflare/order-sheets-sync.js';
import { syncAuditToSheetsBestEffort } from '../../cloudflare/admin-mirror-sheets-sync.js';
import { syncProductIdsToSheetsBestEffort } from '../../cloudflare/product-mirror-sheets-sync.js';

function safeText(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function orderProductIds(result) {
  const items = Array.isArray(result?.order?.items) ? result.order.items : [];
  return [...new Set(items.map(item => String(item?.id || '').trim()).filter(Boolean))];
}

async function syncOrderDependencies(env, result, actor) {
  const [order, audit, products] = await Promise.all([
    syncOrderToSheetsBestEffort(env, result),
    result?.auditEventId
      ? syncAuditToSheetsBestEffort(env, result.auditEventId)
      : Promise.resolve({ ok: true, skipped: true }),
    syncProductIdsToSheetsBestEffort(env, orderProductIds(result), {
      email: actor?.email,
      source: 'superadmin-order-mutation',
    }),
  ]);
  return { order, audit, products };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);

  try {
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 64 * 1024) throw new Error('Solicitud inválida.');
    const body = JSON.parse(raw);
    const actorContext = {
      uid: actor.uid,
      email: actor.email,
      role: 'superadmin',
      origin: 'superadmin',
    };
    const result = body.action === 'createOrder'
      ? await createOrderAdmin(env, body, actorContext)
      : await applyOrderAdminMutation(env, body, actorContext);

    // Firestore + inventario son la transacción comercial. Después se empujan
    // en paralelo todos los espejos dependientes: pedido, auditoría y los
    // productos cuyo stock pudo cambiar. Ninguna caída de Google revierte el
    // commit comercial; Productos deja además una cola persistente de rescate.
    const mirrors = await syncOrderDependencies(env, result, actorContext);
    return jsonResponse({ ok: true, result, sheetsSync: mirrors.order, mirrors }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[admin-order-mutation]', error?.code || '', error?.message || error);
    const message = safeText(error?.message, 300);
    const allowed = /^(Solicitud inválida|Pedido inválido|El pedido ya no existe|No hay cambios administrativos permitidos|Estado de pedido no permitido|Estado de pago no permitido|Método de pago no permitido|Método de entrega no permitido|Correo de contacto inválido|Costo de envío inválido|Subtotal inválido|Ingresá el nombre del cliente|El producto .* (ya no existe|no está activo)|Precio inválido|El pedido contiene|El pedido debe|El pedido tiene demasiados|Stock inválido|Stock insuficiente|No se puede reconciliar el stock|El pedido cambió después de la última sincronización|Conflicto de versión)/i.test(message);
    const status = statusFromError(error, 400);
    return jsonResponse({ ok: false, error: allowed ? message : 'No se pudo actualizar el pedido.' }, status, origin, requestUrl);
  }
}
