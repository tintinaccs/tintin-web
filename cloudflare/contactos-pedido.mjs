import { orderStatusLabel } from '../js/orders/ciclo-pedido.mjs';
const FITO_WHATSAPP = '595982518206';
const clean = value => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim();
export function orderContactLinks(order, orderId) {
  const shipping = order.shipping || {};
  const point = shipping.mapLocation;
  const lat = point?.lat, lng = point?.lng;
  const address = clean(shipping.address || order.address), city = clean(shipping.city || order.shippingCity || order.city);
  const map = lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${Number(lat)},${Number(lng)}`)}`
    : !point && address.length >= 3 && city ? `https://www.google.com/maps?q=${encodeURIComponent(`${address}, ${city}`)}` : '';
  let phone = clean(order.userPhone).replace(/\D/g, '');
  if (/^09\d{8}$/.test(phone)) phone = `595${phone.slice(1)}`;
  const shortId = clean(order.shortId || order.orderNumber || orderId);
  const orderUrl = `https://tintinaccs.com/perfil#pedido-${encodeURIComponent(orderId)}`;
  const customerMessage = `Hola, recibimos tu pedido #${shortId}. Podés ver tu ticket y el seguimiento acá: ${orderUrl}. Vamos a coordinar la entrega con vos.`;
  const customer = /^\d{8,20}$/.test(phone) ? `https://wa.me/${phone}?text=${encodeURIComponent(customerMessage)}` : '';
  const method = clean(order.shippingMethod || shipping.method);
  const paid = ['pagado','paid','approved','completed'].includes(clean(order.paymentStatus || order.payment?.status).toLowerCase());
  const partial = ['parcial','señado'].includes(clean(order.paymentStatus || order.payment?.status).toLowerCase());
  const cash = clean(order.paymentMethod || order.payment?.method) === 'efectivo';
  const amount = cash && !paid && order.total !== undefined && order.total !== null && order.total !== '' && Number.isFinite(Number(order.total)) ? Math.max(0,Math.round(Number(order.total))) : null;
  const transfer = clean(order.paymentMethod || order.payment?.method) === 'transferencia';
  const observation = partial ? 'Pago parcial registrado. Confirmar saldo pendiente y acreditación antes de despachar. Confirmar ubicación.' : cash && !paid ? 'Paga al recibir, consultar si tiene para vuelto y ubicación para confirmar.' : paid ? 'Pedido pagado. Confirmar ubicación antes de entregar.' : transfer ? 'Pago por transferencia: confirmar acreditación antes de despachar. Confirmar ubicación.' : 'Pago pendiente: verificar el método y la acreditación antes de despachar. Confirmar ubicación.';
  const money = value => Number.isFinite(Number(value)) && value !== undefined && value !== null && value !== ''
    ? `${Number(value).toLocaleString('es-PY')} Gs` : 'No registrado';
  const paymentState = clean(order.paymentStatus || order.payment?.status).toLowerCase();
  const paymentLabels = {pendiente:'Pendiente',pending:'Pendiente',pagado:'Pago verificado',paid:'Pago verificado',approved:'Pago verificado',completed:'Pago verificado',parcial:'Pago parcial',señado:'Pago parcial',rechazado:'Rechazado',cancelado:'Cancelado',refunded:'Reembolsado',reembolsado:'Reembolsado'};

  const items = (Array.isArray(order.items) ? order.items : []).map(item => {
    const qty = Number(item.qty);
    const name = clean(item.name) || 'Producto sin nombre registrado';
    const variant = clean(item.variant);
    return `${Number.isInteger(qty) && qty > 0 ? qty : '?'} × ${name}${variant ? ` (${variant})` : ''} · Precio unitario: ${money(item.price)}`;
  });
  const dispatchMessage = [
    `Pedido: ${shortId}`,
    `Estado del pedido: ${order.status ? orderStatusLabel(order) : 'No registrado'}`,
    `Entrega: ${{delivery:'Delivery',encomienda:'Encomienda',retiro:'Retiro coordinado'}[method] || 'No registrada'}`,
    `Cliente: ${clean(order.userName)}`,
    `Teléfono: +${phone}`,
    `Ubicación (link): ${map || 'Ubicación pendiente de confirmar'}`,
    `Ciudad: ${clean(shipping.city || order.shippingCity)}`,
    `Dirección: ${clean(shipping.address || order.address)}`,
    `Productos:\n${items.length ? items.join('\n') : 'Sin detalle registrado'}`,
    `Subtotal: ${money(order.subtotal)}`,
    `Costo de envío: ${money(order.shippingCost ?? shipping.cost)}`,
    `Total: ${money(order.total)}`,
    `Método de pago: ${cash ? 'Efectivo contra entrega' : clean(order.paymentMethod || order.payment?.method) === 'transferencia' ? 'Transferencia bancaria' : clean(order.paymentMethod || order.payment?.method) || 'No registrado'}`,
    `Estado del pago: ${paymentLabels[paymentState] || paymentState || 'No registrado'}`,
    ...(cash && !paid ? [`Monto a cobrar: ${partial ? 'A confirmar (pago parcial)' : money(amount)}`] : []),
    `Observación: ${observation}${shipping.referencia ? ` Referencia: ${clean(shipping.referencia)}.` : ''}${order.notes ? ` ${clean(order.notes)}` : ''}`,
  ].join('\n');
  return {map,customer,dispatch: method === 'delivery' ? `https://wa.me/${FITO_WHATSAPP}?text=${encodeURIComponent(dispatchMessage)}` : '',dispatchMessage};
}
