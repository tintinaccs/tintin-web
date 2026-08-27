import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
} from './firebase-admin-ligero.js';
import {
  computeInventoryDeltas,
  inventoryStateForStatus,
} from '../js/core/store/modelo-inventario.mjs';

export const ORDER_ADMIN_STATUSES = Object.freeze([
  'pendiente', 'confirmado', 'preparando', 'listo_retiro',
  'en_camino', 'entregado', 'cancelado', 'rechazado',
]);
export const ORDER_ADMIN_PAYMENT_STATUSES = Object.freeze([
  'pendiente', 'pagado', 'rechazado', 'cancelado', 'reembolsado',
]);
export const ORDER_ADMIN_PAYMENT_METHODS = Object.freeze(['efectivo', 'transferencia', 'paypal']);
export const ORDER_ADMIN_SHIPPING_METHODS = Object.freeze(['delivery', 'encomienda', 'retiro']);

const STATUS_SET = new Set(ORDER_ADMIN_STATUSES);
const PAYMENT_STATUS_SET = new Set(ORDER_ADMIN_PAYMENT_STATUSES);
const PAYMENT_METHOD_SET = new Set(ORDER_ADMIN_PAYMENT_METHODS);
const SHIPPING_METHOD_SET = new Set(ORDER_ADMIN_SHIPPING_METHODS);
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{6,220}$/;
const MAX_ADMIN_DISTINCT_PRODUCTS = 100;

function clean(value, max = 500) {
  return String(value == null ? '' : value).replace(/[<>]/g, '').trim().slice(0, max);
}

function money(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} inválido.`);
  return Math.round(parsed);
}

function makeChangeId(prefix = 'admin') {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function precondition(document) {
  return document?.updateTime ? { updateTime: document.updateTime } : { exists: true };
}

function sanitizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('El pedido debe tener al menos un producto.');
  if (items.length > 250) throw new Error('El pedido tiene demasiadas líneas.');
  return items.map(raw => {
    const id = clean(raw?.id, 180);
    const qty = Number(raw?.qty ?? raw?.quantity ?? 0);
    const price = Number(raw?.price);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99 || !Number.isFinite(price) || price < 0) {
      throw new Error('El pedido contiene una línea inválida.');
    }
    return {
      id,
      name: clean(raw?.name, 180) || 'Producto',
      cat: clean(raw?.cat, 120),
      price: Math.round(price),
      qty,
      variant: clean(raw?.variant, 120),
      imageUrl: clean(raw?.imageUrl, 900),
    };
  });
}

function buildPatch(input, beforeOrder) {
  const patch = {};
  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  if (has('status')) {
    const status = clean(input.status, 40).toLowerCase();
    if (!STATUS_SET.has(status)) throw new Error('Estado de pedido no permitido.');
    patch.status = status;
  }

  const currentPayment = beforeOrder?.payment && typeof beforeOrder.payment === 'object' ? beforeOrder.payment : {};
  if (has('paymentStatus') || has('paymentMethod')) {
    const paymentStatus = has('paymentStatus')
      ? clean(input.paymentStatus, 40).toLowerCase()
      : clean(currentPayment.status || beforeOrder?.paymentStatus || 'pendiente', 40).toLowerCase();
    const paymentMethod = has('paymentMethod')
      ? clean(input.paymentMethod, 40).toLowerCase()
      : clean(currentPayment.method || beforeOrder?.paymentMethod || 'efectivo', 40).toLowerCase();
    if (!PAYMENT_STATUS_SET.has(paymentStatus)) throw new Error('Estado de pago no permitido.');
    if (!PAYMENT_METHOD_SET.has(paymentMethod)) throw new Error('Método de pago no permitido.');
    patch.payment = { ...currentPayment, status: paymentStatus, method: paymentMethod };
    patch.paymentStatus = paymentStatus;
    patch.paymentMethod = paymentMethod;
  }

  if (has('userName')) patch.userName = clean(input.userName, 120);
  if (has('userPhone')) patch.userPhone = clean(input.userPhone, 40);
  if (has('contactEmail')) {
    const email = clean(input.contactEmail, 254).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo de contacto inválido.');
    patch.contactEmail = email;
  }
  if (has('notes')) patch.notes = clean(input.notes, 1000);
  if (has('ci')) patch.ci = clean(input.ci, 30);

  const shippingKeys = ['shippingMethod', 'shippingCity', 'departamento', 'address', 'reference'];
  if (shippingKeys.some(has)) {
    const currentShipping = beforeOrder?.shipping && typeof beforeOrder.shipping === 'object' ? beforeOrder.shipping : {};
    const method = has('shippingMethod')
      ? clean(input.shippingMethod, 40).toLowerCase()
      : clean(currentShipping.method || beforeOrder?.shippingMethod || 'delivery', 40).toLowerCase();
    if (!SHIPPING_METHOD_SET.has(method)) throw new Error('Método de entrega no permitido.');
    patch.shipping = {
      ...currentShipping,
      method,
      city: has('shippingCity') ? clean(input.shippingCity, 120) : clean(currentShipping.city || beforeOrder?.shippingCity, 120),
      departamento: has('departamento') ? clean(input.departamento, 120) : clean(currentShipping.departamento || beforeOrder?.departamento, 120),
      address: has('address') ? clean(input.address, 300) : clean(currentShipping.address || beforeOrder?.address, 300),
      referencia: has('reference') ? clean(input.reference, 300) : clean(currentShipping.referencia || currentShipping.reference, 300),
    };
    patch.shippingMethod = method;
    patch.shippingCity = patch.shipping.city;
    patch.departamento = patch.shipping.departamento;
    patch.address = patch.shipping.address;
  }

  if (has('items')) {
    patch.items = sanitizeItems(input.items);
    patch.subtotal = patch.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  }
  if (has('shippingCost')) patch.shippingCost = money(input.shippingCost, 'Costo de envío');

  if (has('orderNumber')) {
    const number = clean(input.orderNumber, 80);
    patch.orderNumber = number;
    patch.shortId = number;
  }

  if (has('items') || has('shippingCost')) {
    const subtotal = has('items') ? patch.subtotal : money(beforeOrder?.subtotal ?? 0, 'Subtotal');
    const shippingCost = has('shippingCost') ? patch.shippingCost : money(beforeOrder?.shippingCost ?? 0, 'Costo de envío');
    patch.subtotal = subtotal;
    patch.shippingCost = shippingCost;
    patch.total = subtotal + shippingCost;
  }

  if (!Object.keys(patch).length) throw new Error('No hay cambios administrativos permitidos.');
  return patch;
}

function auditSummary(order) {
  return {
    status: order?.status || 'pendiente',
    paymentStatus: order?.paymentStatus || order?.payment?.status || 'pendiente',
    total: Number(order?.total || 0),
    inventoryState: order?.inventoryState || '',
  };
}

export async function applyOrderAdminMutation(env, input = {}, actor = {}) {
  const orderId = clean(input.orderId, 220);
  if (!ORDER_ID_PATTERN.test(orderId)) throw new Error('Pedido inválido.');
  const origin = clean(actor.origin || input.source || 'admin', 120);
  const actorEmail = clean(actor.email || 'system', 254).toLowerCase();
  const actorId = clean(actor.uid || actor.id || actorEmail || 'system', 128);
  const actorRole = clean(actor.role || 'system', 60);
  const requestedChangeId = clean(input.changeId, 120);
  const nextChangeId = requestedChangeId || makeChangeId(origin.includes('sheets') ? 'sheet' : 'admin');
  const baseChangeId = clean(input.baseChangeId, 120);

  const orderDocument = await firestoreAdminGet(env, `orders/${encodeURIComponent(orderId)}`);
  if (!orderDocument) throw new Error('El pedido ya no existe.');
  const beforeOrder = decodeFirestoreFields(orderDocument.fields || {});
  const currentChangeId = clean(beforeOrder.lastChangeId, 120);

  if (requestedChangeId && currentChangeId === requestedChangeId) {
    return { orderId, changeId: currentChangeId, duplicate: true, ...auditSummary(beforeOrder) };
  }
  if (baseChangeId && currentChangeId && baseChangeId !== currentChangeId) {
    const error = new Error('El pedido cambió después de la última sincronización. Actualizá la hoja antes de volver a editar.');
    error.status = 409;
    error.code = 'stale_order';
    throw error;
  }

  const patch = buildPatch(input, beforeOrder);
  const inventory = computeInventoryDeltas(beforeOrder, patch, MAX_ADMIN_DISTINCT_PRODUCTS);
  const productDocuments = new Map();
  for (const productId of inventory.deltas.keys()) {
    const document = await firestoreAdminGet(env, `products/${encodeURIComponent(productId)}`);
    if (!document) throw new Error(`No se puede reconciliar el stock: el producto ${productId} ya no existe.`);
    productDocuments.set(productId, document);
  }

  const now = new Date();
  const writes = [];
  for (const [productId, reserveDelta] of inventory.deltas) {
    const document = productDocuments.get(productId);
    const product = decodeFirestoreFields(document.fields || {});
    const currentStock = product.stock === null || product.stock === undefined || product.stock === '' ? null : Number(product.stock);
    if (currentStock === null) continue;
    if (!Number.isFinite(currentStock) || currentStock < 0) throw new Error(`Stock inválido para ${productId}.`);
    const nextStock = Math.floor(currentStock) - reserveDelta;
    if (nextStock < 0) throw new Error(`Stock insuficiente para volver a activar o ampliar el pedido (${productId}).`);
    const productPatch = {
      stock: nextStock,
      lastInventoryOrderId: orderId,
      lastInventoryAction: reserveDelta > 0 ? 'reserve' : 'release',
      updatedAt: now,
    };
    writes.push({
      path: `products/${productId}`,
      fields: encodeFirestoreFields(productPatch),
      mergeFields: Object.keys(productPatch),
      currentDocument: precondition(document),
    });
  }

  const nextOrder = {
    ...beforeOrder,
    ...patch,
    status: inventory.afterStatus,
    inventoryState: inventoryStateForStatus(inventory.afterStatus),
    inventoryRevision: Math.max(0, Number(beforeOrder.inventoryRevision || 0)) + 1,
    inventoryUpdatedAt: now,
    inventoryUpdatedBy: actorEmail,
    updatedAt: now,
    lastChangeId: nextChangeId,
    syncOrigin: origin,
  };
  const orderPatch = {
    ...patch,
    status: nextOrder.status,
    inventoryState: nextOrder.inventoryState,
    inventoryRevision: nextOrder.inventoryRevision,
    inventoryUpdatedAt: now,
    inventoryUpdatedBy: actorEmail,
    updatedAt: now,
    lastChangeId: nextChangeId,
    syncOrigin: origin,
  };
  writes.push({
    path: `orders/${orderId}`,
    fields: encodeFirestoreFields(orderPatch),
    mergeFields: Object.keys(orderPatch),
    currentDocument: precondition(orderDocument),
  });

  const eventId = `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
  writes.push({
    path: `auditLog/${eventId}`,
    fields: encodeFirestoreFields({
      eventId,
      timestamp: now,
      createdAt: now,
      customerId: beforeOrder.customerId || '',
      actorId,
      actorEmail,
      actorRole,
      action: 'actualizar_pedido',
      entityType: 'pedido',
      entityId: orderId,
      before: auditSummary(beforeOrder),
      after: auditSummary(nextOrder),
      origin,
      result: 'success',
      changeId: nextChangeId,
    }),
    currentDocument: { exists: false },
  });

  await firestoreAdminCommit(env, writes);
  return {
    orderId,
    changeId: nextChangeId,
    duplicate: false,
    changedProducts: inventory.deltas.size,
    auditEventId: eventId,
    ...auditSummary(nextOrder),
  };
}
