import {orderAmounts,deliveryAmountText,formatOrderMoney} from './importes-pedido.mjs?v=tintin-20261112-delivery-separate-1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function orderMoneyMarkup(order,format=formatOrderMoney){
 const money=orderAmounts(order),show=value=>value===null?'No registrado':format(value);
 return `<span class="tt-order-money-products">Productos: ${esc(show(money.products))}</span><br><small>Delivery: ${esc(deliveryAmountText(order,format))}</small><br><small>Total del pedido: ${esc(show(money.total))}</small>`;
}
