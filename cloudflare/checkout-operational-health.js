import {
  decodeFirestoreFields,
  firestoreAdminListAll,
} from './firebase-admin-ligero.js';

const MAX_SAMPLE = 200;
const PAID_STATES = new Set(['pagado', 'paid', 'approved', 'completed', 'captured']);
const EMAIL_OK_STATES = new Set(['sent']);
const SHEETS_BAD_STATES = new Set(['failed', 'error', 'deferred', 'pending']);

function text(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

export function paymentState(order = {}) {
  return text(order.paymentStatus || order.payment?.status || '');
}

export function isPaidOrder(order = {}) {
  return PAID_STATES.has(paymentState(order));
}

export function classifyCheckoutOperationalOrder(order = {}, {
  orderId = '',
  sheetsAvailable = true,
} = {}) {
  if (!isPaidOrder(order)) return null;

  // Local historical sales are a ledger mirror, not a checkout/email transaction.
  // Explicit delivery failures remain alerts, even on a historical record.
  const historicalLocal = order.source === 'google-sheets-local'
    && order.historical === true && order.inventoryState === 'historical_unmanaged'
    && Boolean(order.localEntryId);
  const notificationStatus = text(order.notificationStatus)
    || (historicalLocal ? 'not_applicable' : 'pending');
  const mirrorStatus = text(order.sheetsMirrorStatus || order.sheetsSyncStatus || '');
  const emailIssue = !EMAIL_OK_STATES.has(notificationStatus) && !(historicalLocal && notificationStatus === 'not_applicable');
  const sheetsIssue = SHEETS_BAD_STATES.has(mirrorStatus) || sheetsAvailable === false;

  return {
    orderId: String(orderId || order.orderId || '').slice(0, 220),
    orderNumber: String(order.orderNumber || order.shortId || '').slice(0, 80),
    paymentStatus: paymentState(order),
    notificationStatus,
    sheetsMirrorStatus: mirrorStatus || 'not_persisted',
    emailIssue,
    sheetsIssue,
  };
}

/**
 * Revisión operativa no destructiva de una muestra acotada de pedidos.
 * Nunca devuelve nombre, email, teléfono, dirección ni detalle de compra.
 *
 * `sheetsIssue` es exacto cuando el pedido persiste sheetsMirrorStatus; para
 * pedidos históricos sin ese ack, el bridge global de Sheets determina si el
 * pago queda "en riesgo" y el runbook indica cómo conciliarlo por TINPED.
 */
export async function inspectCheckoutOperationalHealth(env, {
  listDocuments = firestoreAdminListAll,
  sheetsAvailable = true,
} = {}) {
  const documents = await listDocuments(env, 'orders', MAX_SAMPLE);
  const alerts = [];
  let paid = 0;
  let historicalWithoutEmailRequired = 0;

  for (const document of documents) {
    const order = decodeFirestoreFields(document?.fields || {});
    if (!isPaidOrder(order)) continue;
    paid += 1;
    const classified = classifyCheckoutOperationalOrder(order, {
      orderId: documentId(document),
      sheetsAvailable,
    });
    if (classified?.notificationStatus === 'not_applicable' && classified.emailIssue === false) historicalWithoutEmailRequired += 1;
    if (classified?.emailIssue || classified?.sheetsIssue) alerts.push(classified);
  }

  const paidWithoutEmail = alerts.filter(item => item.emailIssue).length;
  const paidAtRiskSheets = alerts.filter(item => item.sheetsIssue).length;
  return {
    ok: paidWithoutEmail === 0 && paidAtRiskSheets === 0,
    sampledOrders: documents.length,
    paidOrders: paid,
    historicalWithoutEmailRequired,
    paidWithoutEmail,
    paidAtRiskSheets,
    alerts: alerts.slice(0, 20),
    truncated: documents.length >= MAX_SAMPLE,
  };
}
