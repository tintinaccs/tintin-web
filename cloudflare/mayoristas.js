// =============================================================
// TINTIN — Pedidos mayoristas (cotizaciones)
// =============================================================
// Una clienta registrada (por ejemplo, una emprendedora que revende) pide una
// COTIZACIÓN: productos y cantidades, sin pagar. Tintin (Super Admin) pone el
// precio de cada línea y la aprueba o la rechaza. Al aprobarla, la cuenta
// queda como mayorista aprobada y se le avisa por notificación y por correo;
// el pago y la entrega se coordinan por WhatsApp.
//
// Todo lo comercial lo decide el servidor: la clienta solo propone productos
// y cantidades; nombres, imágenes y precios de referencia se leen del catálogo
// y el precio mayorista lo fija exclusivamente el Super Admin. Las reglas de
// Firestore no permiten escribir wholesaleQuotes ni los campos wholesale* del
// perfil desde el navegador.

import { decodeFirestoreFields, encodeFirestoreFields, firestoreAdminGet } from './firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from './firestore-admin-batch.js';

export const WHOLESALE_COLLECTION = 'wholesaleQuotes';
export const WHOLESALE_SEQUENCE_PATH = 'settings/wholesaleSequence';
export const WHOLESALE_STATUSES = Object.freeze(['pendiente', 'aprobada', 'rechazada', 'cancelada']);
export const WHOLESALE_ACCOUNT_STATUSES = Object.freeze(['solicitado', 'aprobado']);

const MAX_LINES = 60;
const MAX_QTY = 9999;
const MAX_UNIT_PRICE = 100_000_000;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{12,80}$/;
const QUOTE_ID_RE = /^WQ_[A-Za-z0-9_-]{12,220}$/;
const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{1,180}$/;
const MAX_CREATE_ATTEMPTS = 4;

export function wholesaleError(code, status = 400, details = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

export function cleanText(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max = 1000) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function formatQuoteNumber(sequence) {
  return `MAY-${String(Math.max(1, Math.floor(Number(sequence) || 1))).padStart(6, '0')}`;
}

/**
 * Valida el borrador que manda la clienta. Solo se aceptan ids de producto,
 * variante y cantidad por línea; las líneas repetidas se suman.
 */
export function normalizeQuoteRequest(payload = {}) {
  const requestId = cleanText(payload.requestId, 80);
  if (!REQUEST_ID_RE.test(requestId)) throw wholesaleError('invalid_request_id');
  const rawLines = payload.items;
  if (!Array.isArray(rawLines) || !rawLines.length) throw wholesaleError('empty_quote');
  if (rawLines.length > MAX_LINES) throw wholesaleError('too_many_lines');
  const byLine = new Map();
  for (const raw of rawLines) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw wholesaleError('invalid_line');
    if (Object.keys(raw).some(key => !['id', 'qty', 'variant'].includes(key))) throw wholesaleError('invalid_line');
    const id = cleanText(raw.id, 180);
    const qty = Number(raw.qty);
    if (!PRODUCT_ID_RE.test(id) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw wholesaleError('invalid_line');
    if (raw.variant != null && typeof raw.variant !== 'string') throw wholesaleError('invalid_line');
    const variant = cleanText(raw.variant, 120);
    const key = JSON.stringify([id, variant]);
    const line = byLine.get(key) || { id, variant, qty: 0 };
    line.qty += qty;
    if (line.qty > MAX_QTY) throw wholesaleError('invalid_line');
    byLine.set(key, line);
  }
  const businessName = cleanText(payload.businessName, 120);
  if (businessName.length < 2) throw wholesaleError('business_name_required');
  const whatsapp = cleanText(payload.whatsapp, 30).replace(/[^\d]/g, '');
  if (!/^\d{8,15}$/.test(whatsapp)) throw wholesaleError('whatsapp_invalid');
  return {
    requestId,
    lines: [...byLine.values()],
    businessName,
    whatsapp,
    city: cleanText(payload.city, 120),
    notes: cleanMultiline(payload.notes, 1000),
  };
}

/** Construye las líneas de la cotización a partir del catálogo vigente. */
export function buildQuoteLines(lines, productsById) {
  return lines.map(line => {
    const product = productsById.get(line.id);
    if (!product) throw wholesaleError('product_not_found', 422, { productId: line.id });
    if (product.active === false || product.deleted === true) throw wholesaleError('product_inactive', 422, { productId: line.id });
    const retail = Math.round(Number(product.price));
    return {
      productId: line.id,
      name: cleanText(product.name, 180) || line.id,
      variant: line.variant,
      imageUrl: cleanText(product.imageUrl, 1200),
      qty: line.qty,
      retailUnitPrice: Number.isSafeInteger(retail) && retail >= 0 ? retail : 0,
      unitPrice: null,
      lineTotal: null,
    };
  });
}

/**
 * Aplica los precios que fija el Super Admin. `prices` es una lista con el
 * precio unitario de cada línea (en guaraníes) o null si todavía no se fijó.
 */
export function applyQuotePrices(items, prices, { requireAll = false } = {}) {
  if (!Array.isArray(prices) || prices.length !== items.length) throw wholesaleError('prices_mismatch');
  let total = 0;
  let priced = 0;
  const next = items.map((item, index) => {
    const raw = prices[index];
    if (raw === null || raw === undefined || raw === '') {
      if (requireAll) throw wholesaleError('price_required', 422, { line: index });
      return { ...item, unitPrice: null, lineTotal: null };
    }
    const unitPrice = Number(raw);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > MAX_UNIT_PRICE) {
      throw wholesaleError('price_invalid', 422, { line: index });
    }
    const lineTotal = unitPrice * Number(item.qty);
    if (!Number.isSafeInteger(lineTotal)) throw wholesaleError('price_invalid', 422, { line: index });
    total += lineTotal;
    priced += 1;
    return { ...item, unitPrice, lineTotal };
  });
  return { items: next, total: priced ? total : null, fullyPriced: priced === items.length };
}

function precondition(document) {
  return document?.updateTime ? { updateTime: document.updateTime } : { exists: true };
}

function createPrecondition(document) {
  return document ? precondition(document) : { exists: false };
}

async function readDecoded(get, env, path) {
  const document = await get(env, path);
  return { document, data: document ? decodeFirestoreFields(document.fields || {}) : null };
}

/**
 * Crea la cotización. Idempotente por (uid, requestId): un reintento devuelve
 * la cotización ya creada en lugar de duplicarla.
 */
export async function createWholesaleQuote(env, payload, user, {
  get = firestoreAdminGet,
  commit = firestoreAdminBatchCommit,
} = {}) {
  const uid = cleanText(user?.uid, 128);
  const email = cleanText(user?.email, 254).toLowerCase();
  if (!uid || !email) throw wholesaleError('invalid_id_token', 401);
  const request = normalizeQuoteRequest(payload);
  const quoteId = `WQ_${uid}_${request.requestId}`;
  if (!QUOTE_ID_RE.test(quoteId)) throw wholesaleError('invalid_request_id');

  const existing = await readDecoded(get, env, `${WHOLESALE_COLLECTION}/${quoteId}`);
  if (existing.data) return { quoteId, duplicate: true, quote: existing.data };

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await createAttempt(env, request, { uid, email, quoteId }, { get, commit });
    } catch (error) {
      lastError = error;
      if (Number(error?.status) !== 409 || attempt === MAX_CREATE_ATTEMPTS) throw error;
    }
  }
  throw lastError || wholesaleError('quote_failed', 500);
}

async function createAttempt(env, request, { uid, email, quoteId }, { get, commit }) {
  const profile = await readDecoded(get, env, `users/${uid}`);
  if (!profile.data) throw wholesaleError('profile_required', 409);
  if (profile.data.blocked === true || cleanText(profile.data.profileStatus, 40) === 'deleted') {
    throw wholesaleError('account_blocked', 403);
  }

  const productsById = new Map();
  for (const id of new Set(request.lines.map(line => line.id))) {
    const product = await readDecoded(get, env, `products/${id}`);
    if (product.data) productsById.set(id, product.data);
  }
  const items = buildQuoteLines(request.lines, productsById);

  const sequence = await readDecoded(get, env, WHOLESALE_SEQUENCE_PATH);
  const sequenceNumber = Math.max(0, Math.floor(Number(sequence.data?.lastNumber) || 0)) + 1;
  const quoteNumber = formatQuoteNumber(sequenceNumber);
  const now = new Date();
  const customerName = cleanText(profile.data.name, 120) || email;

  const quote = {
    quoteId,
    quoteNumber,
    requestId: request.requestId,
    status: 'pendiente',
    userId: uid,
    userEmail: email,
    customerId: cleanText(profile.data.customerId, 180) || `CUS_${uid}`,
    customerName,
    businessName: request.businessName,
    whatsapp: request.whatsapp,
    city: request.city,
    notes: request.notes,
    items,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    retailReferenceTotal: items.reduce((sum, item) => sum + item.retailUnitPrice * item.qty, 0),
    total: null,
    adminNote: '',
    createdAt: now,
    updatedAt: now,
    respondedAt: null,
    respondedBy: '',
    revision: 1,
  };

  const accountPatch = {
    wholesaleInterest: true,
    wholesaleStatus: cleanText(profile.data.wholesaleStatus, 20) === 'aprobado' ? 'aprobado' : 'solicitado',
    wholesaleBusinessName: request.businessName,
    wholesaleRequestedAt: now,
    wholesaleQuoteCount: Math.max(0, Math.floor(Number(profile.data.wholesaleQuoteCount) || 0)) + 1,
    updatedAt: now,
  };
  const sequencePatch = { lastNumber: sequenceNumber, lastCode: quoteNumber, updatedAt: now };
  const eventId = `EVT_${crypto.randomUUID().replaceAll('-', '')}`;

  await commit(env, [
    { path: `${WHOLESALE_COLLECTION}/${quoteId}`, fields: encodeFirestoreFields(quote), currentDocument: { exists: false } },
    {
      path: `users/${uid}`,
      fields: encodeFirestoreFields(accountPatch),
      mergeFields: Object.keys(accountPatch),
      currentDocument: precondition(profile.document),
    },
    {
      path: WHOLESALE_SEQUENCE_PATH,
      fields: encodeFirestoreFields(sequencePatch),
      ...(sequence.document ? { mergeFields: Object.keys(sequencePatch) } : {}),
      currentDocument: createPrecondition(sequence.document),
    },
    {
      path: `auditLog/${eventId}`,
      fields: encodeFirestoreFields({
        eventId, timestamp: now, createdAt: now, customerId: quote.customerId,
        actorId: uid, actorEmail: email, actorRole: 'client',
        action: 'crear_cotizacion_mayorista', entityType: 'cotizacion_mayorista', entityId: quoteId,
        before: {}, after: { status: 'pendiente', quoteNumber, itemCount: quote.itemCount },
        origin: 'wholesale-quote', result: 'success',
      }),
      currentDocument: { exists: false },
    },
  ]);
  return { quoteId, quoteNumber, duplicate: false, quote };
}

const DECISIONS = new Set(['guardar', 'aprobar', 'rechazar']);

/**
 * Respuesta del Super Admin: guardar precios, aprobar o rechazar.
 * `expectedRevision` evita pisar una edición hecha desde otra pestaña.
 */
export async function respondWholesaleQuote(env, input = {}, actor = {}, {
  get = firestoreAdminGet,
  commit = firestoreAdminBatchCommit,
} = {}) {
  const quoteId = cleanText(input.quoteId, 260);
  if (!QUOTE_ID_RE.test(quoteId)) throw wholesaleError('invalid_quote');
  const decision = cleanText(input.decision, 20);
  if (!DECISIONS.has(decision)) throw wholesaleError('invalid_decision');
  const actorEmail = cleanText(actor.email, 254).toLowerCase();

  const current = await readDecoded(get, env, `${WHOLESALE_COLLECTION}/${quoteId}`);
  if (!current.data) throw wholesaleError('quote_not_found', 404);
  const before = current.data;
  if (before.status !== 'pendiente') throw wholesaleError('quote_closed', 409, { status: before.status });
  const expectedRevision = Number(input.expectedRevision);
  if (Number.isInteger(expectedRevision) && expectedRevision !== Number(before.revision || 1)) {
    throw wholesaleError('stale_quote', 409);
  }

  const items = Array.isArray(before.items) ? before.items : [];
  const priced = decision === 'rechazar'
    ? { items, total: before.total ?? null }
    : applyQuotePrices(items, input.prices, { requireAll: decision === 'aprobar' });
  const now = new Date();
  const status = decision === 'aprobar' ? 'aprobada' : decision === 'rechazar' ? 'rechazada' : 'pendiente';
  const patch = {
    items: priced.items,
    total: priced.total,
    adminNote: cleanMultiline(input.adminNote ?? before.adminNote, 1000),
    status,
    updatedAt: now,
    revision: Number(before.revision || 1) + 1,
    ...(decision === 'guardar' ? {} : { respondedAt: now, respondedBy: actorEmail }),
  };

  const writes = [{
    path: `${WHOLESALE_COLLECTION}/${quoteId}`,
    fields: encodeFirestoreFields(patch),
    mergeFields: Object.keys(patch),
    currentDocument: precondition(current.document),
  }];

  if (decision === 'aprobar') {
    const accountPatch = { wholesaleStatus: 'aprobado', wholesaleApprovedAt: now, wholesaleApprovedBy: actorEmail, updatedAt: now };
    writes.push({
      path: `users/${cleanText(before.userId, 128)}`,
      fields: encodeFirestoreFields(accountPatch),
      mergeFields: Object.keys(accountPatch),
      currentDocument: { exists: true },
    });
  }

  const eventId = `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
  writes.push({
    path: `auditLog/${eventId}`,
    fields: encodeFirestoreFields({
      eventId, timestamp: now, createdAt: now, customerId: cleanText(before.customerId, 180),
      actorId: cleanText(actor.uid, 128), actorEmail, actorRole: 'superadmin',
      action: decision === 'aprobar' ? 'aprobar_cotizacion_mayorista'
        : decision === 'rechazar' ? 'rechazar_cotizacion_mayorista' : 'cotizar_mayorista',
      entityType: 'cotizacion_mayorista', entityId: quoteId,
      before: { status: before.status, total: before.total ?? null },
      after: { status, total: priced.total ?? null },
      origin: 'admin-wholesale', result: 'success',
    }),
    currentDocument: { exists: false },
  });

  await commit(env, writes);
  return { quoteId, decision, quote: { ...before, ...patch } };
}
