import {
  deleteFirebaseUser,
  encodeFirestoreFields,
  firestoreAdminCommit,
  setFirebaseUserDisabled,
} from '../../cloudflare/firebase-admin-ligero.js';
import { jsonResponse } from '../../cloudflare/seguridad-cloudinary.js';

const MAX_BODY_BYTES = 8 * 1024;
const ROLES = new Set(['client', 'viewer', 'agent', 'admin']);
const ORDER_STATUS = new Set(['pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado']);
const PAYMENT_STATUS = new Set(['pendiente', 'señado', 'pagado', 'rechazado', 'reembolsado']);

function sameSecret(provided, expected) {
  const left = new TextEncoder().encode(String(provided || ''));
  const right = new TextEncoder().encode(String(expected || ''));
  if (!right.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

function id(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(normalized)) throw new Error(`${label} inválido`);
  return normalized;
}

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

async function updateUser(env, input) {
  const uid = id(input.uid, 'UID');
  const action = String(input.action || 'updateUser');
  if (action === 'deleteUser') {
    await deleteFirebaseUser(env, uid);
    await firestoreAdminCommit(env, [{ path: `users/${uid}`, delete: true }]);
    return { uid, deleted: true };
  }
  const role = text(input.role, 20).toLowerCase();
  if (!ROLES.has(role)) throw new Error('Rol no permitido');
  const blocked = input.blocked === true;
  await setFirebaseUserDisabled(env, uid, blocked);
  await firestoreAdminCommit(env, [{
    path: `users/${uid}`,
    fields: encodeFirestoreFields({ role, blocked, internalNotes: text(input.internalNotes, 1000), updatedAt: new Date(), lastChangeId: text(input.changeId, 120) }),
    mergeFields: ['role', 'blocked', 'internalNotes', 'updatedAt', 'lastChangeId'],
  }]);
  return { uid, role, blocked };
}

async function updateOrder(env, input) {
  const orderId = id(input.orderId, 'Pedido');
  const status = text(input.status, 40).toLowerCase();
  const paymentStatus = text(input.paymentStatus, 40).toLowerCase();
  if (!ORDER_STATUS.has(status) || !PAYMENT_STATUS.has(paymentStatus)) throw new Error('Estado de pedido o pago no permitido');
  await firestoreAdminCommit(env, [{
    path: `orders/${orderId}`,
    fields: encodeFirestoreFields({ status, paymentStatus, payment: { status: paymentStatus }, updatedAt: new Date(), lastChangeId: text(input.changeId, 120) }),
    mergeFields: ['status', 'paymentStatus', 'payment', 'updatedAt', 'lastChangeId'],
  }]);
  return { orderId, status, paymentStatus };
}

export async function onRequestPost({ request, env }) {
  if (!sameSecret(request.headers.get('X-Tintin-Sheets-Secret'), env.SHEETS_ENGAGEMENT_SECRET)) {
    return jsonResponse({ ok: false, error: 'No autorizado' }, 401, '', request.url);
  }
  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud inválida');
    const input = JSON.parse(raw);
    const result = input.entity === 'user' ? await updateUser(env, input) : input.entity === 'order' ? await updateOrder(env, input) : null;
    if (!result) throw new Error('Entidad no permitida');
    return jsonResponse({ ok: true, result }, 200, '', request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo sincronizar').slice(0, 300) }, 400, '', request.url);
  }
}
