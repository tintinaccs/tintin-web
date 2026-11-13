import {orderAmountSummary,formatOrderMoney} from '../../orders/importes-pedido.mjs?v=tintin-20261112-delivery-separate-1';
// Los avisos nuevos conservan su desglose del momento del evento. Los antiguos
// se presentan desde el pedido autorizado, sin reescribir ni reenviar el historial.
export function notificationMoneyBody(notification, order) {
  if (!notification.orderId) return notification.body || '';
  if (notification.amountBreakdown) {
    if(String(notification.body||'').includes('Productos:')&&String(notification.body||'').includes('Delivery:'))return notification.body;
    const value=notification.amountBreakdown,show=number=>Number.isFinite(number)&&number>=0?formatOrderMoney(number):'No registrado';
    return `Productos: ${show(value.products)} · Delivery: ${value.externalDelivery?'A la transportadora al recibir':show(value.delivery)} · Total del pedido: ${show(value.total)}`;
  }
  return order ? orderAmountSummary(order) : 'Productos y delivery se muestran por separado en el detalle del pedido.';
}
export function createNotificationMoneyReader({readOrder,onChange}) {
  let generation=0,running=0;const cache=new Map(),pending=new Set(),queue=[];
  function pump(){
    while(running<4&&queue.length){const {id,token}=queue.shift();if(token!==generation)continue;running++;
      Promise.resolve().then(()=>token===generation?readOrder(id):null).then(order=>{if(token===generation)cache.set(id,order||null);},()=>{if(token===generation)cache.set(id,null);}).finally(()=>{running--;if(token===generation){pending.delete(id);onChange();}pump();});
    }
  }
  return {
    body(notification,{load=true}={}){const id=String(notification.orderId||'');if(!id||notification.amountBreakdown)return notificationMoneyBody(notification);
      if(load&&/^[A-Za-z0-9_-]{1,220}$/.test(id)&&!cache.has(id)&&!pending.has(id)){pending.add(id);queue.push({id,token:generation});pump();}
      return notificationMoneyBody(notification,cache.get(id));
    },
    reset(){generation++;cache.clear();pending.clear();queue.length=0;},
  };
}
