export const RESETTABLE_STATISTICS = Object.freeze({
  revenue: 'Facturación', paid: 'Importe pagado', orders: 'Cantidad de pedidos', average: 'Ticket promedio',
  users: 'Usuarios nuevos', visitors: 'Visitantes y sesiones', conversion: 'Conversión', trend: 'Evolución',
  orderStatus: 'Estados de pedido', paymentStatus: 'Estados de pago', products: 'Productos vendidos',
  orderLocations: 'Ubicaciones de pedidos', visitLocations: 'Ubicaciones de visitas', entryPages: 'Páginas de entrada',
});
export function statisticsSince(rows, metric, resets, timeOf) {
  const date = resets?.[metric];
  const since = typeof date?.toMillis === 'function' ? date.toMillis() : new Date(date || 0).getTime();
  return Number.isFinite(since) && since > 0 ? rows.filter(row => timeOf(row) > since) : rows;
}
