// =============================================================
// TINTIN — CRUD de cupones/descuentos (Super Admin → Cupones)
// =============================================================
// coupons/{CODE} no tiene lectura pública (ver firestore.rules), así que
// todo el mantenimiento pasa por acá con la cuenta de servicio, igual que
// el resto de los módulos de configuración (media, apariencia, settings).
import {
  decodeFirestoreFields, encodeFirestoreFields, firestoreAdminDelete,
  firestoreAdminGet, firestoreAdminList, firestoreAdminMerge, firestoreAdminReplace,
} from '../../cloudflare/firebase-admin-ligero.js';
import {
  jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin,
} from '../../cloudflare/seguridad-cloudinary.js';

const CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

function normalizeCode(value) {
  return String(value == null ? '' : value).trim().toUpperCase().slice(0, 40);
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

function validateCouponInput(input) {
  const code = normalizeCode(input.code);
  if (!CODE_PATTERN.test(code)) throw new Error('Código inválido: usá 3 a 40 letras, números, "-" o "_".');

  const type = input.type === 'percent' ? 'percent' : input.type === 'fixed' ? 'fixed' : null;
  if (!type) throw new Error('Elegí un tipo de descuento: porcentaje o monto fijo.');

  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) throw new Error('El valor del descuento debe ser mayor a cero.');
  if (type === 'percent' && value > 100) throw new Error('El descuento porcentual no puede superar 100%.');
  if (type === 'fixed' && value > 1000000000) throw new Error('El monto fijo es demasiado alto.');

  const minPurchase = input.minPurchase == null || input.minPurchase === '' ? 0 : Number(input.minPurchase);
  if (!Number.isFinite(minPurchase) || minPurchase < 0) throw new Error('La compra mínima no puede ser negativa.');

  let maxUses = null;
  if (input.maxUses !== null && input.maxUses !== undefined && input.maxUses !== '') {
    maxUses = Math.floor(Number(input.maxUses));
    if (!Number.isFinite(maxUses) || maxUses < 1) throw new Error('El límite de usos debe ser un entero mayor a cero.');
  }

  let expiresAt = null;
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) throw new Error('La fecha de vencimiento no es válida.');
    expiresAt = parsed.toISOString();
  }

  const active = input.active !== false;
  return { code, type, value, minPurchase, maxUses, expiresAt, active };
}

async function listCoupons(env) {
  const documents = await firestoreAdminList(env, 'coupons', 300);
  const items = documents.map(document => ({
    code: documentId(document),
    ...decodeFirestoreFields(document.fields || {}),
  })).filter(item => item.code).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return { ok: true, items };
}

async function createCoupon(env, input, actor) {
  const data = validateCouponInput(input);
  const existing = await firestoreAdminGet(env, `coupons/${encodeURIComponent(data.code)}`);
  if (existing) throw new Error('Ya existe un cupón con ese código.');

  const nowIso = new Date().toISOString();
  const fields = {
    code: data.code, type: data.type, value: data.value, active: data.active,
    minPurchase: data.minPurchase, maxUses: data.maxUses, expiresAt: data.expiresAt,
    usedCount: 0, createdAt: nowIso, updatedAt: nowIso, createdBy: actor.email,
  };
  await firestoreAdminReplace(env, `coupons/${encodeURIComponent(data.code)}`, encodeFirestoreFields(fields));
  return { ok: true, coupon: fields };
}

async function updateCoupon(env, input, actor) {
  const data = validateCouponInput(input);
  const existing = await firestoreAdminGet(env, `coupons/${encodeURIComponent(data.code)}`);
  if (!existing) throw new Error('El cupón ya no existe.');

  const fields = {
    type: data.type, value: data.value, active: data.active, minPurchase: data.minPurchase,
    maxUses: data.maxUses, expiresAt: data.expiresAt, updatedAt: new Date().toISOString(), updatedBy: actor.email,
  };
  await firestoreAdminMerge(env, `coupons/${encodeURIComponent(data.code)}`, encodeFirestoreFields(fields));
  return { ok: true, code: data.code };
}

async function deleteCoupon(env, input) {
  const code = normalizeCode(input.code);
  if (!CODE_PATTERN.test(code)) throw new Error('Código inválido.');
  await firestoreAdminDelete(env, `coupons/${encodeURIComponent(code)}`);
  return { ok: true, code };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, request.url);

  try {
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 8 * 1024) throw new Error('Solicitud inválida.');
    const input = JSON.parse(raw);

    let result;
    switch (input.action) {
      case 'list': result = await listCoupons(env); break;
      case 'create': result = await createCoupon(env, input, actor); break;
      case 'update': result = await updateCoupon(env, input, actor); break;
      case 'delete': result = await deleteCoupon(env, input); break;
      default: throw new Error('Acción no reconocida.');
    }
    return jsonResponse(result, 200, origin, request.url);
  } catch (error) {
    console.error('[admin-coupons]', error?.message || error);
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo completar la acción.').slice(0, 300) }, 400, origin, request.url);
  }
}
