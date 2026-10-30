import {handleProductEditor} from '../../cloudflare/product-editor-handler.mjs';
import {handleAuditRequest} from '../../cloudflare/registro-auditoria.mjs';
import { rateLimitErrorResponse,
  assertOrderStaffPermission,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  requireOrderStaff,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import { applyOrderAdminMutation, createOrderAdmin, recordOrderEmailResend, resetOrderSequenceAdmin } from '../../cloudflare/order-admin-domain.js';
import { syncOrderToSheetsBestEffort } from '../../cloudflare/order-sheets-sync.js';
import { notifyCustomerOrderChange } from '../../cloudflare/correo-estado-pedido.js';
import { syncOrderOwnerStats } from '../../cloudflare/sincronizacion-estadisticas-pedido.js';
import { notifyOrderStatus } from './notifications.js';
import { orderContactLinks } from '../../cloudflare/contactos-pedido.mjs';
import { firestoreAdminGet, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

function deferCustomerNotification(context, env, actor, result) {
  if (result.duplicate || !result.orderId || !result.order) return;
  if (result.status === result.previousStatus && result.paymentStatus === result.previousPaymentStatus) return;
  context.waitUntil?.(notifyOrderStatus(env, actor, result.orderId, result.order).catch(error => {
    console.error('[admin-order-mutation] notification failed', error?.message || error);
  }));
}

function safeText(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || (request.method === 'GET' ? new URL(request.url).origin : '');
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, POST, OPTIONS');
  if (request.method === 'GET') {
    try {
      await requireSuperAdmin(request, env);
      const id = new URL(request.url).searchParams.get('orderId') || '';
      if (!/^[A-Za-z0-9_-]{6,220}$/.test(id)) return jsonResponse({ok:false,error:'Pedido inválido.'},400,origin,requestUrl);
      const document = await firestoreAdminGet(env, `orders/${id}`);
      if (!document) return jsonResponse({ok:false,error:'El pedido ya no existe.'},404,origin,requestUrl);
      return jsonResponse({ok:true,links:orderContactLinks(decodeFirestoreFields(document.fields || {}),id)},200,origin,requestUrl);
    } catch(error) { const limited = rateLimitErrorResponse(error, origin, requestUrl); if (limited) return limited; return jsonResponse({ok:false,error:'No se pudieron consultar los contactos del pedido.'},statusFromError(error,403),origin,requestUrl); }
  }
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);

  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 750000) throw new Error('Solicitud inválida.');
    const body = JSON.parse(raw);
    if (body.action === 'appendAudit') return handleAuditRequest(context, { input: body.entry });
    if(['saveProduct','bulkProducts','readProductWork','saveProductWork','listProductWork','discardProductWork'].includes(body.action))return handleProductEditor(context,body,origin);
    if(new TextEncoder().encode(raw).byteLength > 64 * 1024)throw new Error('Solicitud inválida.');
    const actor = body.action === 'updatePayment' || body.action === 'recordEmailResend'
      ? await requireOrderStaff(request, env)
      : await requireSuperAdmin(request, env);
    if (!['createOrder', 'resetOrderSequence', 'recordEmailResend'].includes(body.action) && typeof body.baseChangeId !== 'string') {
      throw new Error('Solicitud inválida: falta la versión del pedido. Actualizá los datos antes de guardar.');
    }
    if (body.action === 'updatePayment') {
      await assertOrderStaffPermission(env, actor, 'pedidos', 'cambiarPago');
      const result = await applyOrderAdminMutation(env, {
        orderId: body.orderId,
        paymentStatus: body.paymentStatus,
        paymentMethod: body.paymentMethod,
        baseChangeId: body.baseChangeId,
        changeId: body.changeId,
        source: 'admin-payment'
      }, { uid: actor.uid, email: actor.email, role: actor.role, origin: 'admin-payment' });
      context.waitUntil?.(syncOrderToSheetsBestEffort(env, result));
      context.waitUntil?.(notifyCustomerOrderChange(env, result));
      deferCustomerNotification(context, env, actor, result);
      return jsonResponse({ ok: true, result, sheetsSync: { ok: true, deferred: true } }, 200, origin, requestUrl);
    }
    if (body.action === 'recordEmailResend') {
      await assertOrderStaffPermission(env, actor, 'pedidos', 'reenviarCorreo');
      const result = await recordOrderEmailResend(env, body, {
        uid: actor.uid,
        email: actor.email,
        role: actor.role,
        origin: 'admin-email-resend',
      });
      context.waitUntil?.(syncOrderToSheetsBestEffort(env, result));
      return jsonResponse({ ok: true, result, sheetsSync: { ok: true, deferred: true } }, 200, origin, requestUrl);
    }
    const actorContext = {
      uid: actor.uid,
      email: actor.email,
      role: 'superadmin',
      origin: 'superadmin',
    };
    if (body.action === 'resetOrderSequence') {
      const result = await resetOrderSequenceAdmin(env, actorContext);
      return jsonResponse({ ok: true, result, sheetsSync: { ok: true, deferred: true, note: 'El próximo pedido se creará con la secuencia canónica y se sincronizará a Sheets.' } }, 200, origin, requestUrl);
    }
    const result = body.action === 'createOrder'
      ? await createOrderAdmin(env, body, actorContext)
      : await applyOrderAdminMutation(env, body, actorContext);
    context.waitUntil?.(syncOrderOwnerStats(env, result.order).catch(error => {
      console.error('[admin-order-mutation] order stats sync failed', error?.message || error);
    }));

    // Firestore + inventario son la transacción comercial. Sheets se actualiza
    // después y en best-effort: una caída de Google nunca convierte en fallido
    // un pedido que ya fue confirmado por el dominio canónico.
    context.waitUntil?.(syncOrderToSheetsBestEffort(env, result));
    if (body.action !== 'createOrder') {
      context.waitUntil?.(notifyCustomerOrderChange(env, result));
      deferCustomerNotification(context, env, actor, result);
    }
    return jsonResponse({ ok: true, result, sheetsSync: { ok: true, deferred: true } }, 200, origin, requestUrl);
  } catch (error) {
    const limited = rateLimitErrorResponse(error, origin, requestUrl);
    if (limited) return limited;
    console.error('[admin-order-mutation]', error?.code || '', error?.message || error);
    const message = safeText(error?.message, 300);
    const allowed = /^(Solicitud inválida|Pedido inválido|El pedido ya no existe|No hay cambios administrativos permitidos|Estado de pedido no permitido|Estado de pago no permitido|Método de pago no permitido|Método de entrega no permitido|Correo de contacto inválido|Costo de envío inválido|Subtotal inválido|Ingresá el nombre del cliente|El producto .* (ya no existe|no está activo)|Precio inválido|El pedido contiene|El pedido debe|El pedido tiene demasiados|Stock inválido|Stock insuficiente|No se puede reconciliar el stock|El pedido cambió después de la última sincronización|Conflicto de versión|Tu rol no tiene permiso|No se pudieron verificar los permisos|Un pedido de retiro|Listo para retirar corresponde|El cambio de estado no corresponde)/i.test(message);
    const status = statusFromError(error, 400);
    return jsonResponse({ ok: false, error: allowed ? message : 'No se pudo actualizar el pedido.' }, status, origin, requestUrl);
  }
}
