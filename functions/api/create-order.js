import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser,
  SUPERADMIN_EMAIL,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  getGoogleAccessToken,
} from '../../cloudflare/firebase-admin-ligero.js';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const MAX_ITEMS = 60;
const GUARD_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_STORE_WHATSAPP = '595981299331';
const ALLOWED_KEYS = new Set([
  'requestId', 'cartLines', 'name', 'phone', 'contactEmail', 'notes',
  'selectedCity', 'departamento', 'address', 'referencia', 'mapLocation',
  'shippingMethod', 'encomiendaMode', 'documentNumber', 'paymentMethod',
  'expectedSubtotal', 'expectedShippingCost', 'expectedShippingPending',
  'expectedTotal',
]);

function clean(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function digits(value, max = 40) {
  return String(value == null ? '' : value).replace(/\D/g, '').slice(0, max);
}

function formatDocument(value) {
  const raw = digits(value, 8);
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function emailValid(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function moneyValid(value) {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 1_000_000_000;
}

function parseMoney(value) {
  if (typeof value === 'number') return Math.round(value);
  const parsed = Number(String(value == null ? '' : value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

function parseStock(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function hasOnlyKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).every(key => allowed.has(key));
}

function normalizeCartLines(cartLines) {
  if (!Array.isArray(cartLines) || !cartLines.length) return { ok: false, error: 'empty_cart' };
  if (cartLines.length > MAX_ITEMS) return { ok: false, error: 'too_many_products' };
  const byId = new Map();
  for (const rawLine of cartLines) {
    if (!hasOnlyKeys(rawLine, new Set(['id', 'qty', 'variants', 'variant']))) return { ok: false, error: 'invalid_cart' };
    const id = clean(rawLine.id, 180);
    const qty = Number(rawLine.qty);
    const rawVariants = Array.isArray(rawLine.variants) ? rawLine.variants : (rawLine.variant ? [rawLine.variant] : []);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99 || rawVariants.length > 10) return { ok: false, error: 'invalid_cart' };
    const variants = rawVariants.map(value => clean(value, 120));
    if (variants.some((value, index) => !value || value !== rawVariants[index] || String(rawVariants[index]).length > 120)) return { ok: false, error: 'invalid_cart' };
    const existing = byId.get(id) || { id, qty: 0, variants: [] };
    existing.qty += qty;
    if (existing.qty > 99) return { ok: false, error: 'invalid_cart' };
    variants.forEach(variant => { if (!existing.variants.includes(variant)) existing.variants.push(variant); });
    if (existing.variants.length > 10) return { ok: false, error: 'invalid_cart' };
    byId.set(id, existing);
  }
  return { ok: true, lines: [...byId.values()] };
}

function variantGroups(value) {
  const groups = [];
  const positions = new Map();
  const add = (keyRaw, valueRaw) => {
    const key = clean(keyRaw, 60);
    if (!key) return;
    const values = (Array.isArray(valueRaw) ? valueRaw : String(valueRaw == null ? '' : valueRaw).split(','))
      .map(item => clean(item, 120)).filter(Boolean);
    if (!values.length) return;
    if (!positions.has(key)) {
      positions.set(key, groups.length);
      groups.push([]);
    }
    const target = groups[positions.get(key)];
    values.forEach(option => { if (!target.includes(option)) target.push(option); });
  };
  if (Array.isArray(value)) {
    value.slice(0, 100).forEach(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      Object.keys(item).forEach(key => {
        if (!['price', 'sku', 'imageUrl', 'stock', 'active'].includes(key)) add(key, item[key]);
      });
    });
  } else if (value && typeof value === 'object') {
    Object.keys(value).slice(0, 20).forEach(key => add(key, value[key]));
  }
  return groups;
}

function variantIsValid(product, selectedVariant) {
  const groups = variantGroups(product?.variants);
  const selected = clean(selectedVariant, 120);
  if (!groups.length) return !selected;
  if (!selected) return false;
  const parts = selected.split('/').map(part => clean(part, 120)).filter(Boolean);
  return parts.length === groups.length && parts.every((part, index) => groups[index].includes(part));
}

function normalizeCities(list, fallbackCost) {
  return (Array.isArray(list) ? list : []).map((item, index) => {
    if (typeof item === 'string') return { name: clean(item, 120), price: parseMoney(fallbackCost), sourceIndex: index };
    if (!item?.name) return null;
    const parsed = item.price === null ? null : parseMoney(item.price === undefined ? fallbackCost : item.price);
    return { name: clean(item.name, 120), price: Number.isFinite(parsed) ? parsed : null, sourceIndex: index };
  }).filter(Boolean);
}

function resolveShipping(rates, selectedCity) {
  if (selectedCity === '__retiro__') return { ok: true, method: 'retiro', city: 'Retiro coordinado', cost: 0, pending: false, rateIndex: -1 };
  const wanted = clean(selectedCity, 120).toLocaleLowerCase('es');
  const delivery = normalizeCities(rates.deliveryCities, rates.deliveryCost).find(city => city.name.toLocaleLowerCase('es') === wanted);
  if (delivery) return { ok: true, method: 'delivery', city: delivery.name, cost: delivery.price, pending: delivery.price === null, rateIndex: delivery.sourceIndex };
  const encomienda = normalizeCities(rates.encomiendaCities, rates.encomiendaCost).find(city => city.name.toLocaleLowerCase('es') === wanted);
  if (encomienda) return { ok: true, method: 'encomienda', city: encomienda.name, cost: 0, pending: false, rateIndex: encomienda.sourceIndex };
  return { ok: false, error: 'shipping_invalid' };
}

function projectId(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no está configurada');
  const parsed = JSON.parse(raw);
  if (!parsed.project_id) throw new Error('La cuenta de servicio no tiene project_id');
  return parsed.project_id;
}

function databaseBase(project) {
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`;
}

function documentName(project, path) {
  return `projects/${project}/databases/(default)/documents/${path}`;
}

async function beginTransaction(env) {
  const project = projectId(env);
  const token = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const response = await fetch(`${databaseBase(project)}/documents:beginTransaction`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ options: { readWrite: {} } }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.transaction) throw Object.assign(new Error('No se pudo iniciar la transacción.'), { code: 'transaction_begin_failed' });
  return { project, token, transaction: data.transaction };
}

async function rollback(tx) {
  try {
    await fetch(`${databaseBase(tx.project)}/documents:rollback`, {
      method: 'POST', headers: { authorization: `Bearer ${tx.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ transaction: tx.transaction }),
    });
  } catch {}
}

async function batchGet(tx, paths) {
  const response = await fetch(`${databaseBase(tx.project)}/documents:batchGet`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tx.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ documents: paths.map(path => documentName(tx.project, path)), transaction: tx.transaction }),
  });
  if (!response.ok) throw Object.assign(new Error('No se pudieron leer los datos del pedido.'), { code: 'batch_get_failed' });
  const rows = await response.json().catch(() => []);
  const documents = Object.create(null);
  (Array.isArray(rows) ? rows : []).forEach(row => {
    if (row.found) {
      const path = String(row.found.name || '').split('/documents/')[1];
      if (path) documents[path] = { data: decodeFirestoreFields(row.found.fields || {}), updateTime: row.found.updateTime || '' };
    } else if (row.missing) {
      const path = String(row.missing || '').split('/documents/')[1];
      if (path) documents[path] = null;
    }
  });
  return documents;
}

function createWrite(project, path, object) {
  return { update: { name: documentName(project, path), fields: encodeFirestoreFields(object) }, currentDocument: { exists: false } };
}

function updateWrite(project, path, object, fields, updateTime = '') {
  return {
    update: { name: documentName(project, path), fields: encodeFirestoreFields(object) },
    updateMask: { fieldPaths: fields },
    ...(updateTime ? { currentDocument: { updateTime } } : { currentDocument: { exists: true } }),
  };
}

async function commit(tx, writes) {
  const response = await fetch(`${databaseBase(tx.project)}/documents:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tx.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ writes, transaction: tx.transaction }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const conflict = response.status === 409 || data?.error?.status === 'ABORTED' || data?.error?.status === 'FAILED_PRECONDITION';
    throw Object.assign(new Error(conflict ? 'El stock cambió mientras confirmabas.' : 'No se pudo guardar el pedido.'), { code: conflict ? 'quote_changed' : 'commit_failed' });
  }
  return data;
}

function validateMap(raw) {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (!hasOnlyKeys(raw, new Set(['lat', 'lng', 'name', 'address']))) return { ok: false, error: 'map_invalid' };
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: 'map_invalid' };
  return { ok: true, value: { lat, lng, name: clean(raw.name, 120), address: clean(raw.address, 240) } };
}

async function createOrder(env, auth, payload) {
  if (!hasOnlyKeys(payload, ALLOWED_KEYS)) return { ok: false, error: 'invalid_payload' };
  const requestId = clean(payload.requestId, 100);
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId)) return { ok: false, error: 'invalid_request_id' };
  const normalizedCart = normalizeCartLines(payload.cartLines);
  if (!normalizedCart.ok) return normalizedCart;
  const cartLines = normalizedCart.lines;
  const name = clean(payload.name, 120);
  if (name.length < 2) return { ok: false, error: 'name_required' };
  const phone = digits(payload.phone, 20);
  if (!/^\d{8,20}$/.test(phone)) return { ok: false, error: 'phone_invalid' };
  const contactEmail = (clean(payload.contactEmail, 254).toLowerCase() || auth.email);
  if (!emailValid(contactEmail)) return { ok: false, error: 'email_invalid' };
  const paymentMethod = clean(payload.paymentMethod, 30);
  if (!['efectivo', 'transferencia'].includes(paymentMethod)) return { ok: false, error: 'payment_required' };
  const selectedCity = clean(payload.selectedCity, 120);
  if (!selectedCity) return { ok: false, error: 'shipping_invalid' };
  if (!moneyValid(payload.expectedSubtotal) || !moneyValid(payload.expectedShippingCost) || typeof payload.expectedShippingPending !== 'boolean' || !moneyValid(payload.expectedTotal)) return { ok: false, error: 'invalid_quote' };
  const map = validateMap(payload.mapLocation);
  if (!map.ok) return map;

  const uid = auth.uid;
  const orderId = `${uid}_${requestId}`;
  const isSuperAdmin = auth.email === SUPERADMIN_EMAIL;
  const tx = await beginTransaction(env);
  try {
    const fixedPaths = [`orders/${orderId}`, 'settings/general', 'settings/shippingRates', 'settings/orderSequence', `users/${uid}`, `checkoutGuards/${uid}`];
    const productPaths = cartLines.map(line => `products/${clean(line.id, 180)}`);
    const docs = await batchGet(tx, [...fixedPaths, ...productPaths]);
    const existing = docs[`orders/${orderId}`]?.data;
    if (existing) {
      await rollback(tx);
      return ['pending', 'reserved'].includes(existing.inventoryState)
        ? { ok: true, orderId, order: existing, created: false }
        : { ok: false, error: 'order_state_invalid' };
    }

    const settings = docs['settings/general']?.data || {};
    const ratesDoc = docs['settings/shippingRates']?.data || {};
    const userData = docs[`users/${uid}`]?.data;
    const guardData = docs[`checkoutGuards/${uid}`]?.data;
    if (!userData) { await rollback(tx); return { ok: false, error: 'profile_missing' }; }
    if (!isSuperAdmin) {
      if (settings.storeOpen !== true) { await rollback(tx); return { ok: false, error: 'store_closed' }; }
      if (userData.blocked === true) { await rollback(tx); return { ok: false, error: 'blocked_account' }; }
      if (!guardData || clean(guardData.lastCheckoutOrderId, 220) !== orderId) { await rollback(tx); return { ok: false, error: 'checkout_guard_missing' }; }
      const guardMs = Date.parse(guardData.lastCheckoutAt || '');
      if (!guardMs || Date.now() - guardMs > GUARD_WINDOW_MS) { await rollback(tx); return { ok: false, error: 'checkout_guard_expired' }; }
    }
    if ((settings.paymentMethods || {})[paymentMethod] === false) { await rollback(tx); return { ok: false, error: 'payment_unavailable' }; }

    const rates = {
      deliveryCities: Array.isArray(ratesDoc.deliveryCities) ? ratesDoc.deliveryCities : settings.deliveryCities,
      encomiendaCities: Array.isArray(ratesDoc.encomiendaCities) ? ratesDoc.encomiendaCities : settings.encomiendaCities,
      deliveryCost: ratesDoc.deliveryCost != null ? ratesDoc.deliveryCost : settings.deliveryCost,
      encomiendaCost: ratesDoc.encomiendaCost != null ? ratesDoc.encomiendaCost : settings.encomiendaCost,
    };
    const shipping = resolveShipping(rates, selectedCity);
    if (!shipping.ok) { await rollback(tx); return shipping; }
    const requestedMethod = clean(payload.shippingMethod, 20);
    if (requestedMethod !== shipping.method) { await rollback(tx); return { ok: false, error: 'shipping_changed' }; }
    const encomiendaMode = clean(payload.encomiendaMode, 20);
    if (shipping.method !== 'encomienda' && encomiendaMode) { await rollback(tx); return { ok: false, error: 'shipping_invalid' }; }
    if (shipping.method === 'encomienda' && !['agencia', 'puerta'].includes(encomiendaMode)) { await rollback(tx); return { ok: false, error: 'shipping_invalid' }; }

    const rawDocument = digits(payload.documentNumber, 8);
    if (shipping.method === 'encomienda' && !/^\d{6,8}$/.test(rawDocument)) { await rollback(tx); return { ok: false, error: 'document_invalid' }; }
    const documentNumber = shipping.method === 'encomienda' ? formatDocument(rawDocument) : '';
    const address = clean(payload.address, 300);
    const referencia = clean(payload.referencia, 300);
    if (shipping.method === 'delivery' && (!map.value || !map.value.name)) { await rollback(tx); return { ok: false, error: 'map_required' }; }
    if (shipping.method === 'encomienda' && encomiendaMode === 'puerta') {
      if (address.length < 5) { await rollback(tx); return { ok: false, error: 'address_required' }; }
      if (!map.value || !map.value.name) { await rollback(tx); return { ok: false, error: 'map_required' }; }
    }

    const resolvedItems = [];
    let subtotal = 0;
    for (const line of cartLines) {
      const productId = clean(line.id, 180);
      const product = docs[`products/${productId}`]?.data;
      if (!product) { await rollback(tx); return { ok: false, error: 'product_not_found', productId }; }
      if (product.active === false) { await rollback(tx); return { ok: false, error: 'product_inactive', productId }; }
      const price = parseMoney(product.price);
      if (!Number.isFinite(price) || price < 0) { await rollback(tx); return { ok: false, error: 'invalid_price', productId }; }
      const stock = parseStock(product.stock);
      if (stock !== null && line.qty > stock) { await rollback(tx); return { ok: false, error: 'insufficient_stock', productId, available: stock, requested: line.qty }; }
      const variants = Array.isArray(line.variants) ? line.variants : [];
      if (!variants.length && !variantIsValid(product, '')) { await rollback(tx); return { ok: false, error: 'variant_required', productId }; }
      if (variants.some(variant => !variantIsValid(product, variant))) { await rollback(tx); return { ok: false, error: 'invalid_variant', productId }; }
      resolvedItems.push({ id: productId, name: clean(product.name || product.title || 'Producto', 180), cat: clean(product.category || product.collectionSlug || product.collection || product.cat || '', 120), price, qty: line.qty, variant: clean(variants.join(' / '), 120), imageUrl: clean(product.imageUrl || product.image || '', 900) });
      subtotal += price * line.qty;
    }

    const shippingCost = shipping.cost === null ? 0 : shipping.cost;
    const total = subtotal + shippingCost;
    if (Number(payload.expectedSubtotal) !== subtotal || Number(payload.expectedShippingCost) !== shippingCost || Boolean(payload.expectedShippingPending) !== shipping.pending || Number(payload.expectedTotal) !== total) {
      await rollback(tx);
      return { ok: false, error: 'quote_changed', quote: { items: resolvedItems, subtotal, shippingCost, shippingPending: shipping.pending, total } };
    }

    const sequenceData = docs['settings/orderSequence']?.data || {};
    const nextSequence = Math.max(0, Math.floor(Number(sequenceData.lastNumber || 0))) + 1;
    const publicOrderNumber = `TINPED${String(nextSequence).padStart(2, '0')}`;
    const nowIso = new Date().toISOString();
    const keepsAddress = shipping.method === 'delivery' || (shipping.method === 'encomienda' && encomiendaMode === 'puerta');
    const order = {
      requestId,
      source: 'spark-checkout-v2-cloudflare',
      shortId: publicOrderNumber,
      orderNumber: publicOrderNumber,
      orderSequenceNumber: nextSequence,
      userId: uid,
      userEmail: auth.email,
      contactEmail,
      userName: name,
      userPhone: phone,
      documentNumber,
      items: resolvedItems,
      subtotal,
      shippingCost,
      shippingPending: shipping.pending,
      total,
      storeWhatsapp: digits(settings.whatsappNumber || settings.whatsapp || DEFAULT_STORE_WHATSAPP, 20),
      storeInstagram: clean(settings.instagram, 120),
      shipping: {
        method: shipping.method,
        encomiendaMode: shipping.method === 'encomienda' ? encomiendaMode : '',
        city: shipping.city,
        departamento: clean(payload.departamento, 80),
        rateIndex: shipping.rateIndex,
        documentNumber,
        address: keepsAddress ? address : '',
        referencia: keepsAddress ? referencia : '',
        zone: shipping.method === 'encomienda' ? 'interior' : 'central',
        mapLocation: shipping.method === 'delivery' || (shipping.method === 'encomienda' && encomiendaMode === 'puerta') ? map.value : null,
      },
      payment: { method: paymentMethod, status: 'pendiente' },
      paymentStatus: 'pendiente',
      status: 'pendiente',
      notes: clean(payload.notes, 1000),
      notificationStatus: 'pending',
      inventoryState: 'reserved',
      inventoryRevision: 1,
      inventoryUpdatedAt: nowIso,
      inventoryUpdatedBy: auth.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const writes = [createWrite(tx.project, `orders/${orderId}`, order)];
    const seqPatch = { lastNumber: nextSequence, lastCode: publicOrderNumber, updatedAt: nowIso, updatedBy: auth.email };
    const seqDoc = docs['settings/orderSequence'];
    writes.push(seqDoc ? updateWrite(tx.project, 'settings/orderSequence', seqPatch, Object.keys(seqPatch), seqDoc.updateTime) : createWrite(tx.project, 'settings/orderSequence', seqPatch));
    resolvedItems.forEach(item => {
      const docInfo = docs[`products/${item.id}`];
      const stock = parseStock(docInfo?.data?.stock);
      if (stock !== null) {
        const patch = { stock: stock - item.qty, lastStockOrderId: orderId, updatedAt: nowIso };
        writes.push(updateWrite(tx.project, `products/${item.id}`, patch, Object.keys(patch), docInfo.updateTime));
      }
    });
    await commit(tx, writes);
    return { ok: true, orderId, order, created: true };
  } catch (error) {
    await rollback(tx);
    throw error;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'origin_forbidden' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin, request.url);
  try {
    const auth = await requireFirebaseUser(request);
    const raw = await request.text();
    if (!raw || raw.length > 80_000) return jsonResponse({ ok: false, error: 'invalid_payload' }, 400, origin, request.url);
    const payload = JSON.parse(raw);
    const result = await createOrder(env, auth, payload);
    return jsonResponse(result, result.ok ? 200 : 400, origin, request.url);
  } catch (error) {
    console.error('[create-order]', error?.code || error?.message || error);
    return jsonResponse({ ok: false, error: error?.code || 'create_order_failed' }, error?.status || 500, origin, request.url);
  }
}
