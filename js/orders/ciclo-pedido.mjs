// Contrato compartido por el servidor, la gestión y el seguimiento del cliente.
export const ORDER_STAGES = Object.freeze([
  { key: 'new', label: 'Nuevos' }, { key: 'preparing', label: 'En preparación' },
  { key: 'ready', label: 'Listos' }, { key: 'sent', label: 'Enviados / en camino' },
  { key: 'done', label: 'Entregados / finalizados' },
]);
export const ORDER_LIFECYCLE_STATUSES = Object.freeze(['pendiente','confirmado','preparando','listo','listo_retiro','en_camino','entregado','cancelado','rechazado','devuelto','incidencia']);
export const ORDER_LIFECYCLE_LABELS = Object.freeze({ pendiente:'Nuevo', confirmado:'Aceptado', preparando:'En preparación', listo:'Listo', listo_retiro:'Listo para retirar', en_camino:'En camino', entregado:'Entregado', cancelado:'Cancelado', rechazado:'Rechazado', devuelto:'Devuelto', incidencia:'Con incidencia', enviado:'En camino', historico:'Venta histórica' });
export function shippingMethod(order) { return String(order?.shippingMethod || order?.shipping?.method || order?.deliveryMethod || 'delivery').toLowerCase(); }
export function lifecycleStatus(order) { const status=String(order?.status || 'pendiente').toLowerCase(); return status === 'enviado' ? 'en_camino' : status; }
export function orderStage(order) {
  if (order?.localEntryId) return 'history';
  return ({ pendiente:'new', confirmado:'preparing', preparando:'preparing', listo:'ready', listo_retiro:'ready', en_camino:'sent', entregado:'done' })[lifecycleStatus(order)] || 'attention';
}
export function orderStatusLabel(order) {
  const status=lifecycleStatus(order), method=shippingMethod(order);
  if (status === 'entregado' && method === 'retiro') return 'Retirado';
  if (status === 'en_camino' && method === 'encomienda') return 'Despachado por encomienda';
  if (status === 'listo' || status === 'listo_retiro') return method === 'retiro' ? 'Listo para retirar' : 'Listo para despachar';
  return ORDER_LIFECYCLE_LABELS[status] || 'Estado pendiente de revisión';
}
export function nextOrderStatus(order) {
  const status=lifecycleStatus(order), method=shippingMethod(order);
  if (status === 'pendiente' || status === 'confirmado') return 'preparando';
  if (status === 'preparando') return method === 'retiro' ? 'listo_retiro' : 'listo';
  if (status === 'listo' || status === 'listo_retiro') return method === 'retiro' ? 'entregado' : 'en_camino';
  if (status === 'en_camino' && method !== 'retiro') return 'entregado';
  return '';
}
export function allowedOrderStatuses(order) {
  if (order?.localEntryId) return [];
  const status=lifecycleStatus(order), next=nextOrderStatus(order);
  const options=new Set([status]);
  if (next) options.add(next);
  if (status === 'pendiente') options.add('confirmado');
  if (['pendiente','confirmado','preparando','listo','listo_retiro'].includes(status) || (status === 'incidencia' && ['pendiente','confirmado','preparando','listo','listo_retiro'].includes(order.previousFulfillmentStatus))) { options.add('cancelado'); options.add('rechazado'); }
  if (['confirmado','preparando','listo','listo_retiro','en_camino'].includes(status)) options.add('incidencia');
  if (['en_camino','entregado'].includes(status)) options.add('devuelto');
  // La reapertura conserva el mismo pedido y vuelve a validar/reservar stock.
  if (['cancelado','rechazado'].includes(status)) { options.add('pendiente'); options.add('confirmado'); }
  if (status === 'incidencia' && ORDER_LIFECYCLE_STATUSES.includes(order.previousFulfillmentStatus)) options.add(order.previousFulfillmentStatus);
  return [...options];
}
export function assertOrderTransition(order, requested) {
  if (requested === 'en_camino' && shippingMethod(order) === 'retiro') throw Object.assign(new Error('Un pedido de retiro no puede marcarse como enviado.'), {status:422,code:'invalid_order_transition'});
  if (requested === 'listo_retiro' && shippingMethod(order) !== 'retiro') throw Object.assign(new Error('Listo para retirar corresponde únicamente a retiro coordinado.'), {status:422,code:'invalid_order_transition'});
  if (!allowedOrderStatuses(order).includes(requested)) throw Object.assign(new Error('El cambio de estado no corresponde a la etapa actual del pedido.'), {status:422,code:'invalid_order_transition'});
}
export function orderNeedsAttention(order) {
  return orderStage(order) === 'attention' || ['rechazado','error'].includes(String(order.paymentStatus || order.payment?.status)) || ['failed','error'].includes(order.notificationStatus) || Boolean(order.shippingPending);
}
export function customerOrderMessage(order) {
  const status=lifecycleStatus(order), method=shippingMethod(order);
  const message={pendiente:'Recibimos tu pedido.',confirmado:'Aceptamos tu pedido. Pronto comenzaremos a prepararlo.',preparando:'Estamos preparando tu pedido.',cancelado:'Tu pedido fue cancelado.',rechazado:'No pudimos procesar tu pedido.',devuelto:'Se registró la devolución de tu pedido.',incidencia:'Tu pedido requiere atención. Contactá a Tintin para coordinar.'}[status];
  if (message) return message;
  if (['listo','listo_retiro'].includes(status)) return method === 'retiro' ? 'Tu pedido está listo para retirar. Coordiná el retiro con Tintin.' : 'Tu pedido está listo para despachar.';
  if (status === 'en_camino') return method === 'retiro' ? 'Revisá el estado de retiro con Tintin.' : method === 'encomienda' ? 'Tu pedido fue despachado por encomienda.' : 'Tu pedido está en camino.';
  if (status === 'entregado') return method === 'retiro' ? 'Tu pedido fue retirado.' : 'Tu pedido fue entregado.';
  return 'Consultá el estado de tu pedido con Tintin.';
}
export function orderTimeline(order) {
  const pickup=shippingMethod(order) === 'retiro';
  const keys=pickup ? ['new','preparing','ready','done'] : ORDER_STAGES.map(s=>s.key);
  const current=keys.indexOf(orderStage(order));
  return keys.map(key=>({ key, label:key === 'ready' && pickup ? 'Listo para retirar' : key === 'done' && pickup ? 'Retirado' : ORDER_STAGES.find(s=>s.key===key).label, done:current >= keys.indexOf(key) }));
}
