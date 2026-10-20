// Clasificación explícita del lote de pruebas confirmado por el titular.
// No modifica documentos, IDs técnicos, reservas, pagos ni el contador correlativo.
export function testOrderNumber(order) {
  const code = String(order?.orderNumber || order?.shortId || order?.orderCode || order?.id || '').trim();
  const match = /^TINPED(?:PRUEBA)?(0?[1-9]|1\d|2[0-5])$/.exec(code);
  return match ? Number(match[1]) : null;
}
export function orderDisplayCode(order) {
  const number = testOrderNumber(order);
  return number === null ? String(order?.orderNumber || order?.shortId || order?.orderCode || order?.id || '—') : `TINPEDPRUEBA${String(number).padStart(2, '0')}`;
}
export function ordersForView(orders, includeTests = false) {
  return orders.filter(order => includeTests || testOrderNumber(order) === null).map(order => testOrderNumber(order) === null ? order : { ...order, orderNumber: orderDisplayCode(order) });
}
