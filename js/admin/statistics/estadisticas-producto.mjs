import {ordersForView} from '../../orders/pedidos-prueba.mjs?v=tintin-20261020-orders-clean-2';
// Importes históricos brutos de líneas pagadas; no se atribuyen descuentos de
// pedido/envío ni devoluciones parciales sin un desglose fiable por línea.
export function productStatistics(productId,orders,timeOf) {
  const variants=new Map(),months=new Map();let units=0,revenue=0,count=0,incomplete=0;
  for(const order of ordersForView(orders,false)) {
    if(['cancelado','rechazado','devuelto'].includes(order.status) || ['rechazado','cancelado','reembolsado'].includes(order.paymentStatus || order.payment?.status))continue;
    if((order.paymentStatus || order.payment?.status)!=='pagado')continue;
    const lines=(order.items || []).filter(item=>String(item.id || item.productId)===String(productId));
    if(!lines.length)continue;
    let included=false;
    for(const item of lines) {
      const qty=item.qty??item.quantity,price=item.price;
      if(!Number.isInteger(qty)||qty<1||!Number.isInteger(price)||price<0){incomplete++;continue;}
      included=true;units+=qty;revenue+=qty*price;
      const key=item.variantKey || item.variant || 'Sin variantes';
      const row=variants.get(key)||{key,label:item.variant || key,units:0,revenue:0};row.units+=qty;row.revenue+=qty*price;variants.set(key,row);
      const date=timeOf(order.createdAt);
      if(Number.isFinite(date)&&date>0){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion',year:'numeric',month:'2-digit'}).formatToParts(new Date(date)).map(part=>[part.type,part.value]));const month=`${parts.year}-${parts.month}`;months.set(month,(months.get(month)||0)+qty*price);}
    }
    if(included)count++;
  }
  return {units,revenue,orders:count,incomplete,variants:[...variants.values()].sort((a,b)=>b.units-a.units),months:[...months].sort(([a],[b])=>a.localeCompare(b))};
}
