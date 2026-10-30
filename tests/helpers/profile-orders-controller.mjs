import fs from 'node:fs';
import vm from 'node:vm';
import {ordersForView} from '../../js/orders/pedidos-prueba.mjs';
import {ORDER_LIFECYCLE_LABELS,orderStatusLabel,orderTimeline,customerOrderMessage} from '../../js/orders/ciclo-pedido.mjs';
export function profileOrdersFactory() {
  const stats=fs.readFileSync('js/core/store/estadisticas-pedidos.js','utf8');
  const helpers=stats.slice(stats.indexOf('function normEmail'),stats.indexOf('async function getOrdersByField'));
  const calculate=stats.slice(stats.indexOf('export function calculateOrderStats'),stats.indexOf('export function buildUserStatsPayload')).replace('export ','');
  const context={console,AbortController,ordersForView,ORDER_LIFECYCLE_LABELS,orderStatusLabel,orderTimeline,customerOrderMessage};
  vm.createContext(context);
  vm.runInContext(helpers+calculate,context);
  const source=fs.readFileSync('js/pages/profile/pedidos-perfil.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
  vm.runInContext(source.slice(0,source.indexOf('export function startProfileOrders')).replaceAll('export function','function'),context);
  return context.createProfileOrdersController;
}
