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

// Resolve midnight in the store's reporting zone, independently of the device zone.
export function statisticsTodayStart(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit',
    timeZoneName: 'longOffset',
  }).formatToParts(now).map(part => [part.type, part.value]));
  const offset = parts.timeZoneName.replace('GMT', '') || '+00:00';
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00${offset}`);
}
