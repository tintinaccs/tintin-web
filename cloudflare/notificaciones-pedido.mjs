import { customerOrderMessage, lifecycleStatus, shippingMethod } from '../js/orders/ciclo-pedido.mjs';

// Sólo campos que ve la clienta: notas internas, auditoría y reenvíos de
// correo no son cambios del pedido que deban provocar otra alerta.
export function customerOrderChanges(before = {}, after = {}) {
  const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  const groups = {
    productos: ['items'],
    importes: ['subtotal', 'shippingCost', 'total', 'coupon'],
    entrega: ['shipping', 'shippingMethod', 'shippingCity', 'departamento', 'address', 'reference', 'shippingPending'],
    contacto: ['userName', 'userPhone', 'contactEmail'],
    pago: ['paymentMethod'],
  };
  return Object.entries(groups).filter(([, fields]) => fields.some(field => stable(before[field]) !== stable(after[field]))).map(([label]) => label);
}

// La campana conserva cada transición confirmada, con la misma clave en el
// guardado atómico y en cualquier recuperación posterior del aviso.
export function orderCustomerNotice(orderId, order, actor = {}, { created = false, detailChanges = [], paymentChanged = false } = {}) {
  const uid = String(order?.userId || '').trim();
  if (!uid || order?.localEntryId) return null;
  const id = String(orderId);
  const number = String(order.orderNumber || order.shortId || id).trim();
  const status = String(order.status || 'pendiente').trim();
  const payment = String(order.paymentStatus || order.payment?.status || '').trim();
  const revision = Math.max(0, Number(order.inventoryRevision) || 0);
  if (!created && revision <= 1 && ['pendiente', 'inventory_pending'].includes(status) && (!payment || payment === 'pendiente')) return null;
  const paymentConfirmed = ['pagado','paid','approved','completed'].includes(payment);
  const paymentTitle = paymentConfirmed ? `Pago confirmado de tu pedido ${number}` : `Actualizamos el pago de tu pedido ${number}`;
  const stage = lifecycleStatus(order);
  const method = shippingMethod(order);
  const titles = {
    pendiente: `Recibimos tu pedido ${number}`,
    confirmado: `Aceptamos tu pedido ${number}`,
    preparando: `Estamos preparando tu pedido ${number}`,
    listo: `Tu pedido ${number} está listo para ${method === 'retiro' ? 'retirar' : 'despachar'}`,
    listo_retiro: `Tu pedido ${number} está listo para retirar`,
    en_camino: method === 'encomienda' ? `Despachamos tu pedido ${number} por encomienda` : `Tu pedido ${number} está en camino`,
    entregado: `Tu pedido ${number} fue ${method === 'retiro' ? 'retirado' : 'entregado'}`,
    cancelado: `Tu pedido ${number} fue cancelado`,
    rechazado: `No pudimos procesar tu pedido ${number}`,
    devuelto: `Registramos la devolución de tu pedido ${number}`,
    incidencia: `Tu pedido ${number} requiere atención`,
  };
  return {
    uid,
    key: created ? `order_created:${id}` : `order_status:${id}:${revision}:${status}:${payment}`,
    event: {
      kind: created ? 'order_created' : detailChanges.length ? 'order_updated' : 'order_status', actorType: 'store', actorUid: actor.uid || '', actorName: 'Tintin Accesorios',
      title: created ? `Recibimos tu pedido ${number}` : paymentChanged ? paymentTitle : detailChanges.length ? `Actualizamos los detalles de tu pedido ${number}` : titles[stage] || `Tu pedido ${number} fue actualizado`,
      body: created ? 'Tu pedido ya está registrado. Acá vas a recibir cada avance hasta la entrega.' : detailChanges.length ? `Revisá los cambios de ${detailChanges.join(', ')} en el detalle de tu pedido.` : `${customerOrderMessage(order)}${payment ? ` Pago: ${payment.replace(/_/g, ' ')}.` : ''}`,
      iconKey: paymentChanged ? (paymentConfirmed ? 'payment-confirmed' : 'payment-pending') : 'order', targetUrl: `perfil.html#pedido-${encodeURIComponent(id)}`,
      orderId: id, orderNumber: number, status, sourceType: 'order', sourceId: id,
    },
  };
}
