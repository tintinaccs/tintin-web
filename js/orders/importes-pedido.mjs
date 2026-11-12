// Desglose de lectura del snapshot histórico. Nunca cambia el total a cobrar.
const amount = value => value === null || value === undefined || value === '' || typeof value === 'boolean' || typeof value === 'string' && !/^\d+$/.test(value.trim()) ? null : Number.isSafeInteger(Math.round(Number(value))) && Number(value) >= 0 ? Math.round(Number(value)) : null;
const first = (...values) => values.map(amount).find(value => value !== null) ?? null;
export const formatOrderMoney = value => value == null ? 'No registrado' : `Gs. ${Math.round(value).toLocaleString('es-PY')}`;
export function orderAmounts(order = {}) {
  const method = String(order.shippingMethod || order.shipping?.method || order.deliveryMethod || '').toLowerCase();
  const local = order.localSale;
  let delivery = local && Object.hasOwn(local, 'shippingCost') ? amount(local.shippingCost) : first(order.shippingCost, order.shipping?.cost, order.deliveryCost);
  if (method === 'retiro') delivery = 0;
  const externalDelivery = method === 'encomienda' && (order.shippingPending === true || delivery === null || delivery === 0);
  if (order.shippingPending === true || externalDelivery) delivery = null;
  const total = amount(order.total);
  let products = first(local?.total, order.subtotal);
  if (total !== null && delivery !== null) products = total >= delivery ? total - delivery : null;
  // Las líneas son precios históricos del pedido, nunca precios del catálogo actual.
  if (products === null && !(total !== null && delivery !== null && total < delivery) && Array.isArray(order.items) && order.items.length) {
    const lines = order.items.map(item => {
      const price = amount(item.price ?? item.unitPrice), quantity = Number(item.qty ?? item.quantity);
      return price !== null && Number.isInteger(quantity) && quantity > 0 ? price * quantity : null;
    });
    if (lines.every(value => value !== null)) products = lines.reduce((sum, value) => sum + value, 0);
  }
  // Un total sin desglose no acredita ventas: podría contener un envío desconocido.
  return { products, delivery, total, externalDelivery, deliveryPending: delivery === null, incomplete: products === null || delivery === null };
}
export function deliveryAmountText(order, format = formatOrderMoney) {
  const money = orderAmounts(order);
  return money.externalDelivery ? 'A la transportadora al recibir' : money.delivery === null ? 'A confirmar / no registrado' : format(money.delivery);
}
export function orderAmountSummary(order, format = formatOrderMoney) {
  const money = orderAmounts(order);
  return `Productos: ${money.products === null ? 'No registrado' : format(money.products)} · Delivery: ${deliveryAmountText(order, format)} · Total del pedido: ${money.total === null ? 'No registrado' : format(money.total)}`;
}
export function sumOrderAmounts(orders = []) {
  return orders.reduce((sum, order) => {
    const money = orderAmounts(order);
    sum.products += money.products ?? 0; sum.delivery += money.delivery ?? 0;
    sum.unknownProducts += Number(money.products === null); sum.unknownDelivery += Number(money.delivery === null);
    return sum;
  }, { products: 0, delivery: 0, unknownProducts: 0, unknownDelivery: 0 });
}
