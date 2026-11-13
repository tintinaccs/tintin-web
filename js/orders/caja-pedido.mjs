// Seña, saldo y fecha prevista de un pedido. Fuente única para validar (servidor)
// y para mostrar (panel y perfil). La seña se calcula sólo sobre productos:
// el envío nunca forma parte de ella ni se fracciona (DECISIONES_COMERCIALES_20261102).
import { orderAmounts } from './importes-pedido.mjs?v=tintin-20261112-delivery-separate-1';

const wholeAmount = value => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};

// Vacío borra la seña; cualquier valor no entero o negativo es un error explícito.
export function parseDepositAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  const amount = wholeAmount(value);
  if (amount === null) throw new Error('La seña debe ser un monto entero mayor o igual a cero.');
  return amount;
}

// Fecha de calendario AAAA-MM-DD real; vacío la borra.
export function parseEstimatedDelivery(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
  if (!date || date.getUTCFullYear() !== +match[1] || date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) {
    throw new Error('La fecha prevista debe ser una fecha válida (AAAA-MM-DD).');
  }
  return text;
}

export function assertDepositWithinProducts(depositAmount, productsAmount) {
  if (depositAmount > 0 && productsAmount !== null && depositAmount > productsAmount) {
    throw new Error('La seña no puede superar el total de productos; el envío no forma parte de la seña.');
  }
}

// Saldo a cobrar. Sin importes confiables devuelve null: nunca inventa un saldo.
export function orderCashSummary(order = {}) {
  const money = orderAmounts(order);
  const deposit = wholeAmount(order?.payment?.depositAmount) ?? 0;
  const status = String(order?.paymentStatus || order?.payment?.status || 'pendiente').toLowerCase();
  const settled = status === 'pagado';
  const refunded = status === 'reembolsado' || status === 'cancelado';
  const total = money.total;
  const balance = settled || refunded ? 0 : total === null ? null : Math.max(0, total - deposit);
  const productsBalance = settled || refunded || money.products === null ? (settled || refunded ? 0 : null) : Math.max(0, money.products - deposit);
  return { deposit, balance, productsBalance, deliveryAtReceipt: money.delivery, total, settled, estimatedDeliveryAt: String(order?.estimatedDeliveryAt || '') };
}
