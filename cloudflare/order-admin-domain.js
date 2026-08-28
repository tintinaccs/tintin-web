import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminGet,
} from './firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from './firestore-admin-batch.js';
import {
  computeInventoryDeltas,
  inventoryStateForStatus,
  statusReservesInventory,
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
const MAX_CREATE_ATTEMPTS = 3;

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

function createPrecondition(document) {
  return document ? precondition(document) : { exists: false };
}

function sanitizeItems(items, { canonicalPrices = false } = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('El pedido debe tener al menos un producto.');
  if (items.length > 250) throw new Error('El pedido tiene demasiadas líneas.');
  return items.map(raw => {
    const id = clean(raw?.id, 180);
    const qty = Number(raw?.qty ?? raw?.quantity ?? 0);
    const price = canonicalPrices ? 0 : Number(raw?.price);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99 || (!canonicalPrices && (!Number.isFinite(price) || price < 0))) {
      throw new Error('El pedido contiene una línea inválida.');
    }
    return {
      id,
      name: clean(raw?.name, 180) || 'Producto',
      cat: clean(raw?.cat, 120),
      price: canonicalPrices ? 0 : Math.round(price),
      qty,
      variant: clean(raw?.variant, 120),
      imageUrl: clean(raw?.imageUrl, 900),
    };
  });
}

function normalizedStatus(value, fallback = 'pendiente') {
  const status = clean(value || fallback, 40).toLowerCase();
  if (!STATUS_SET.has(status)) throw new Error('Estado de pedido no permitido.');
  return status;
}

function normalizedPaymentStatus(value, fallback = 'pendiente') {
  const status = clean(value || fallback, 40).toLowerCase();
  if (!PAYMENT_STATUS_SET.has(status)) throw new Error('Estado de pago no permitido.');
  return status;
}

function normalizedPaymentMethod(value, fallback = 'efectivo') {
  const method = clean(value || fallback, 40).toLowerCase();
  if (!PAYMENT_METHOD_SET.has(method)) throw new Error('Método de pago no permitido.');
  return method;
}

function normalizedShippingMethod(value, fallback = 'delivery') {
  const method = clean(value || fallback, 40).toLowerCase();
  if (!SHIPPING_METHOD_SET.has(method)) throw new Error('Método de entrega no permitido.');
  return method;
}

function buildPatch(input, beforeOrder) {
  const patch = {};
  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  if (has('status')) patch.status = normalizedStatus(input.status);

  const currentPayment = beforeOrder?.payment && typeof beforeOrder.payment === 'object' ? beforeOrder.payment : {};
  if (has('paymentStatus') || has('paymentMethod')) {
    const paymentStatus = has('paymentStatus')
      ? normalizedPaymentStatus(input.paymentStatus)
      : normalizedPaymentStatus(currentPayment.status || beforeOrder?.paymentStatus || 'pendiente');
    const paymentMethod = has('paymentMethod')
      ? normalizedPaymentMethod(input.paymentMethod)
      : normalizedPaymentMethod(currentPayment.method || beforeOrder?.paymentMethod || 'efectivo');
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
      ? normalizedShippingMethod(input.shippingMethod)
      : normalizedShippingMethod(currentShipping.method || beforeOrder?.shippingMethod || 'delivery');
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

function actorContext(input, actor) {
  const origin = clean(actor.origin || input.source || 'admin', 120);
  const email = clean(actor.email || 'system', 254).toLowerCase();
  return {
    origin,
    email,
    id: clean(actor.uid || actor.id || email || 'system', 128),
    role: clean(actor.role || 'system', 60),
  };
}

function formatOrderNumber(number) {
  const n = Math.max(1, Math.floor(Number(number) || 1));
  return `TINPED${String(n).padStart(2, '0')}`;
}

async function resolveCanonicalCreationItems(env, rawItems, get) {
  const lines = sanitizeItems(rawItems, { canonicalPrices: true });
  const byProduct = new Map();
  for (const line of lines) byProduct.set(line.id, (byProduct.get(line.id) || 0) + line.qty);
  if (byProduct.size > MAX_ADMIN_DISTINCT_PRODUCTS) throw new Error('El pedido tiene demasiados productos distintos.');

  const documents = new Map();
  for (const productId of byProduct.keys()) {
    const document = await get(env, `products/${encodeURIComponent(productId)}`);
    if (!document) throw new Error(`El producto ${productId} ya no existe.`);
    documents.set(productId, document);
  }

  const items = lines.map(line => {
    const product = decodeFirestoreFields(documents.get(line.id)?.fields || {});
    if (product.active === false) throw new Error(`El producto ${line.id} no está activo.`);
    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) throw new Error(`Precio inválido para ${line.id}.`);
    return {
      id: line.id,
      name: clean(product.name || product.title || line.id, 180),
      cat: clean(product.category || product.collectionSlug || product.collection || product.cat || '', 120),
      price: Math.round(price),
      qty: line.qty,
      variant: line.variant,
      imageUrl: clean(product.imageUrl || product.image || '', 900),
    };
  });

  return { items, byProduct, documents };
}

async function createOrderAttempt(env, input, actor, { get, commit }) {
  const context = actorContext(input, actor);
  const status = normalizedStatus(input.status || 'pendiente');
  const paymentStatus = normalizedPaymentStatus(input.paymentStatus || input.payment?.status || 'pendiente');
  const paymentMethod = normalizedPaymentMethod(input.paymentMethod || input.payment?.method || 'efectivo');
  const shippingMethod = normalizedShippingMethod(input.shippingMethod || input.shipping?.method || 'delivery');
  const userName = clean(input.userName, 120);
  if (userName.length < 2) throw new Error('Ingresá el nombre del cliente.');
  const contactEmail = clean(input.contactEmail || input.userEmail, 254).toLowerCase();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error('Correo de contacto inválido.');

  const { items, byProduct, documents } = await resolveCanonicalCreationItems(env, input.items, get);
  const sequenceDocument = await get(env, 'settings/orderSequence');
  const sequence = sequenceDocument ? decodeFirestoreFields(sequenceDocument.fields || {}) : {};
  const sequenceNumber = Math.max(0, Math.floor(Number(sequence.lastNumber || 0))) + 1;
  const orderNumber = formatOrderNumber(sequenceNumber);
  const orderId = `manual_${crypto.randomUUID().replaceAll('-', '')}`;
  const now = new Date();
  const changeId = clean(input.changeId, 120) || makeChangeId(context.origin.includes('sheets') ? 'sheet_create' : 'admin_create');
  const shippingCost = money(input.shippingCost ?? 0, 'Costo de envío');
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal + shippingCost;
  const reserves = statusReservesInventory(status);

  const shipping = {
    ...(input.shipping && typeof input.shipping === 'object' ? input.shipping : {}),
    method: shippingMethod,
    city: clean(input.shippingCity || input.shipping?.city, 120),
    departamento: clean(input.departamento || input.shipping?.departamento, 120),
    address: clean(input.address || input.shipping?.address, 300),
    referencia: clean(input.reference || input.shipping?.referencia || input.shipping?.reference, 300),
  };

  const order = {
    requestId: orderId,
    source: context.origin.includes('sheets') ? 'google-sheets-manual-v1' : 'superadmin-manual-v2',
    shortId: orderNumber,
    orderNumber,
    orderSequenceNumber: sequenceNumber,
    customerId: clean(input.customerId, 180),
    userId: clean(input.userId, 180),
    userEmail: contactEmail,
    contactEmail,
    userName,
    userPhone: clean(input.userPhone, 40),
    ci: clean(input.ci, 30),
    items,
    subtotal,
    shippingCost,
    shippingPending: false,
    total,
    shipping,
    shippingMethod,
    shippingCity: shipping.city,
    departamento: shipping.departamento,
    address: shipping.address,
    payment: { method: paymentMethod, status: paymentStatus },
    paymentMethod,
    paymentStatus,
    status,
    notes: clean(input.notes, 1000),
    invoice: input.invoice && typeof input.invoice === 'object' ? input.invoice : { wanted: false, razonSocial: '', ruc: '' },
    notificationStatus: 'pending',
    inventoryState: inventoryStateForStatus(status),
    inventoryRevision: 1,
    inventoryUpdatedAt: now,
    inventoryUpdatedBy: context.email,
    createdAt: now,
    updatedAt: now,
    createdBy: context.email,
    lastChangeId: changeId,
    syncOrigin: context.origin,
  };

  const writes = [];
  if (reserves) {
    for (const [productId, requestedQty] of byProduct) {
      const document = documents.get(productId);
      const product = decodeFirestoreFields(document.fields || {});
      const stock = product.stock === null || product.stock === undefined || product.stock === '' ? null : Number(product.stock);
      if (stock === null) continue;
      if (!Number.isFinite(stock) || stock < 0) throw new Error(`Stock inválido para ${productId}.`);
      const nextStock = Math.floor(stock) - requestedQty;
      if (nextStock < 0) throw new Error(`Stock insuficiente para ${productId}. Disponible: ${Math.floor(stock)}.`);
      const productPatch = {
        stock: nextStock,
        lastInventoryOrderId: orderId,
        lastInventoryAction: 'reserve',
        updatedAt: now,
      };
      writes.push({
        path: `products/${productId}`,
        fields: encodeFirestoreFields(productPatch),
        mergeFields: Object.keys(productPatch),
        currentDocument: precondition(document),
      });
    }
  }

  writes.push({
    path: `orders/${orderId}`,
    fields: encodeFirestoreFields(order),
    currentDocument: { exists: false },
  });

  const sequencePatch = {
    lastNumber: sequenceNumber,
    lastCode: orderNumber,
    updatedAt: now,
    updatedBy: context.email,
  };
  writes.push({
    path: 'settings/orderSequence',
    fields: encodeFirestoreFields(sequencePatch),
    ...(sequenceDocument ? { mergeFields: Object.keys(sequencePatch) } : {}),
    currentDocument: createPrecondition(sequenceDocument),
  });

  const eventId = `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
  writes.push({
    path: `auditLog/${eventId}`,
    fields: encodeFirestoreFields({
      eventId,
      timestamp: now,
      createdAt: now,
      customerId: order.customerId || '',
      actorId: context.id,
      actorEmail: context.email,
      actorRole: context.role,
      action: 'crear_pedido_manual',
      entityType: 'pedido',
      entityId: orderId,
      before: {},
      after: auditSummary(order),
      origin: context.origin,
      result: 'success',
      changeId,
    }),
    currentDocument: { exists: false },
  });

  await commit(env, writes);
  return {
    orderId,
    orderNumber,
    shortId: orderNumber,
    changeId,
    changedProducts: reserves ? byProduct.size : 0,
    auditEventId: eventId,
    order,
    ...auditSummary(order),
  };
}

export async function createOrderAdmin(
  env,
  input = {},
  actor = {},
  { get = firestoreAdminGet, commit = firestoreAdminBatchCommit } = {},
) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await createOrderAttempt(env, input, actor, { get, commit });
    } catch (error) {
      lastError = error;
      if (Number(error?.status) !== 409 || attempt === MAX_CREATE_ATTEMPTS) throw error;
    }
  }
  throw lastError || new Error('No se pudo crear el pedido.');
}

export async function applyOrderAdminMutation(
  env,
  input = {},
  actor = {},
  { get = firestoreAdminGet, commit = firestoreAdminBatchCommit } = {},
) {
  const orderId = clean(input.orderId, 220);
  if (!ORDER_ID_PATTERN.test(orderId)) throw new Error('Pedido inválido.');
  const context = actorContext(input, actor);
  const requestedChangeId = clean(input.changeId, 120);
  const nextChangeId = requestedChangeId || makeChangeId(context.origin.includes('sheets') ? 'sheet' : 'admin');
  const baseChangeId = clean(input.baseChangeId, 120);

  const orderDocument = await get(env, `orders/${encodeURIComponent(orderId)}`);
  if (!orderDocument) throw new Error('El pedido ya no existe.');
  const beforeOrder = decodeFirestoreFields(orderDocument.fields || {});
  const currentChangeId = clean(beforeOrder.lastChangeId, 120);

  if (requestedChangeId && currentChangeId === requestedChangeId) {
    return { orderId, changeId: currentChangeId, duplicate: true, order: beforeOrder, ...auditSummary(beforeOrder) };
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
    const document = await get(env, `products/${encodeURIComponent(productId)}`);
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
    inventoryUpdatedBy: context.email,
    updatedAt: now,
    lastChangeId: nextChangeId,
    syncOrigin: context.origin,
  };
  const orderPatch = {
    ...patch,
    status: nextOrder.status,
    inventoryState: nextOrder.inventoryState,
    inventoryRevision: nextOrder.inventoryRevision,
    inventoryUpdatedAt: now,
    inventoryUpdatedBy: context.email,
    updatedAt: now,
    lastChangeId: nextChangeId,
    syncOrigin: context.origin,
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
      actorId: context.id,
      actorEmail: context.email,
      actorRole: context.role,
      action: 'actualizar_pedido',
      entityType: 'pedido',
      entityId: orderId,
      before: auditSummary(beforeOrder),
      after: auditSummary(nextOrder),
      origin: context.origin,
      result: 'success',
      changeId: nextChangeId,
    }),
    currentDocument: { exists: false },
  });

  await commit(env, writes);
  return {
    orderId,
    changeId: nextChangeId,
    duplicate: false,
    changedProducts: inventory.deltas.size,
    auditEventId: eventId,
    order: nextOrder,
    ...auditSummary(nextOrder),
  };
}
