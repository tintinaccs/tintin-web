const FITO_WHATSAPP = '595982518206';
const clean = value => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim();
export function orderContactLinks(order, orderId) {
  const shipping = order.shipping || {};
  const point = shipping.mapLocation;
  const lat = point?.lat, lng = point?.lng;
  const map = lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${Number(lat)},${Number(lng)}`)}` : '';
  let phone = clean(order.userPhone).replace(/\D/g, '');
  if (/^09\d{8}$/.test(phone)) phone = `595${phone.slice(1)}`;
  const shortId = clean(order.shortId || order.orderNumber || orderId);
  const orderUrl = `https://tintinaccesorios.pages.dev/perfil#pedido-${encodeURIComponent(orderId)}`;
  const customerMessage = `Hola, recibimos tu pedido #${shortId}. Podés ver tu ticket y el seguimiento acá: ${orderUrl}. Vamos a coordinar la entrega con vos.`;
  const customer = /^\d{8,20}$/.test(phone) ? `https://wa.me/${phone}?text=${encodeURIComponent(customerMessage)}` : '';
  const method = clean(order.shippingMethod || shipping.method);
  const paid = ['pagado','paid','approved','completed'].includes(clean(order.paymentStatus || order.payment?.status).toLowerCase());
  const cash = clean(order.paymentMethod || order.payment?.method) === 'efectivo';
  const amount = cash && !paid ? Math.max(0,Math.round(Number(order.total)||0)) : 0;
  const observation = cash && !paid ? 'Paga al recibir, consultar si tiene para vuelto y ubicación para confirmar.' : paid ? 'Pedido pagado. Confirmar ubicación antes de entregar.' : 'Pago por transferencia: confirmar acreditación antes de despachar. Confirmar ubicación.';
  const dispatchMessage = [
    `Cliente: ${clean(order.userName)}`,
    `Teléfono: +${phone}`,
    `Ubicación (link): ${map || 'Ubicación pendiente de confirmar'}`,
    `Ciudad: ${clean(shipping.city || order.shippingCity)}`,
    `Dirección: ${clean(shipping.address || order.address)}`,
    'Descripción del producto: Empaque Verde de cartón',
    `Monto a cobrar: ${amount.toLocaleString('es-PY')} Gs`,
    `Observación: ${observation}${shipping.referencia ? ` Referencia: ${clean(shipping.referencia)}.` : ''}${order.notes ? ` ${clean(order.notes)}` : ''}`,
  ].join('\n');
  return {map,customer,dispatch: method === 'delivery' ? `https://wa.me/${FITO_WHATSAPP}?text=${encodeURIComponent(dispatchMessage)}` : '',dispatchMessage};
}
