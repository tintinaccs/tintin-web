// =============================================================
// TINTIN — Ficha del cliente: acciones exclusivas de la Super Admin
// =============================================================
// 1) Vincular una compra a un cliente: arma el pedido desde el perfil leído
//    en el servidor (nunca desde lo que mande el navegador) para que quede
//    atado a su uid, Customer ID y correo como una compra real.
// 2) Editar los datos del cliente (nombre, apellido, teléfono, correo y
//    dirección). Ningún dato obligatorio puede quedar vacío. Cambiar el
//    correo cambia también el correo de acceso: el anterior deja de servir.

import { isValidNamePart } from '../js/pages/profile/configuracion-inicial-perfil.mjs';
import { DEFAULT_COUNTRY, isRealisticPhone, normalizePhone, phoneKey } from '../js/components/forms/utilidades-telefono.js';
import { SUPER_ADMIN_EMAIL } from './contrato-cuentas-generado.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  updateFirebaseUserEmail,
} from './firebase-admin-ligero.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHANGE_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;

const defaultDeps = {
  get: firestoreAdminGet,
  commit: firestoreAdminCommit,
  updateAuthEmail: updateFirebaseUserEmail,
  now: () => new Date(),
  randomId: () => crypto.randomUUID().replace(/-/g, ''),
};

function text(value, max = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function failure(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function readClientProfile(env, uid, deps) {
  if (!UID_PATTERN.test(uid)) throw failure('Cliente inválido.');
  const document = await deps.get(env, `users/${uid}`);
  if (!document) throw failure('El cliente ya no existe.', 404);
  const profile = decodeFirestoreFields(document.fields || {});
  if (profile.deleted === true || profile.profileStatus === 'deleted') throw failure('El cliente está eliminado.', 409);
  return { document, profile };
}

function profileName(profile) {
  const first = text(profile.firstName, 60);
  const last = text(profile.lastName, 60);
  return text(first || last ? `${first} ${last}` : profile.name, 120);
}

/**
 * Entrada de createOrderAdmin para una compra vinculada. Los artículos,
 * estado, pago, entrega y notas los elige la Super Admin; la identidad del
 * comprador sale siempre del perfil guardado.
 */
export async function prepareLinkedPurchaseInput(env, body = {}, deps = {}) {
  const store = { ...defaultDeps, ...deps };
  const uid = text(body.linkUid, 128);
  const { profile } = await readClientProfile(env, uid, store);
  if (profile.blocked === true) throw failure('El cliente está bloqueado: desbloquealo antes de vincularle una compra.', 409);
  const email = text(profile.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw failure('El cliente no tiene un correo válido: completalo en su ficha.', 409);
  if (email === SUPER_ADMIN_EMAIL) throw failure('No se puede vincular una compra a la cuenta Super Admin.', 409);
  const userName = profileName(profile) || text(body.userName, 120);
  const userPhone = text(profile.phone, 40) || text(body.userPhone, 40);
  const requestId = text(body.orderId, 220);
  return {
    ...(requestId && /^linked_[A-Za-z0-9_-]{6,200}$/.test(requestId) ? { orderId: requestId } : {}),
    items: Array.isArray(body.items) ? body.items : [],
    status: body.status,
    payment: body.payment,
    paymentStatus: body.paymentStatus,
    shipping: body.shipping,
    shippingCost: body.shippingCost,
    notes: body.notes,
    userName,
    userPhone,
    userId: uid,
    customerId: text(profile.customerId, 120) || `CUS_${uid}`,
    accountEmail: email,
    contactEmail: email,
    changeId: body.changeId,
    source: 'superadmin-linked-purchase',
  };
}

/** Valida y normaliza lo que la Super Admin quiere guardar. Lanza con un mensaje claro. */
export function validateCustomerProfileInput(input = {}, current = {}) {
  const firstName = text(input.firstName, 60);
  const lastName = text(input.lastName, 60);
  if (!firstName) throw failure('El nombre no puede quedar vacío.');
  if (!lastName) throw failure('El apellido no puede quedar vacío.');
  if (!isValidNamePart(firstName)) throw failure('Nombre inválido: usá al menos dos letras, sin números.');
  if (!isValidNamePart(lastName)) throw failure('Apellido inválido: usá al menos dos letras, sin números.');

  const rawPhone = text(input.phone, 40);
  if (!rawPhone) throw failure('El teléfono no puede quedar vacío.');
  if (!isRealisticPhone(rawPhone, DEFAULT_COUNTRY)) throw failure('Teléfono inválido: usá un celular real, por ejemplo 0981 123 456.');
  const phone = normalizePhone(rawPhone, DEFAULT_COUNTRY).value;

  const email = text(input.email, 254).toLowerCase();
  if (!email) throw failure('El correo no puede quedar vacío.');
  if (!EMAIL_PATTERN.test(email)) throw failure('Correo inválido.');
  if (email === SUPER_ADMIN_EMAIL) throw failure('Ese correo es de la cuenta Super Admin.');

  const address = text(input.address, 240);
  if (!address && text(current.address, 240)) throw failure('La dirección no puede quedar vacía.');

  return { firstName, lastName, phone, email, address };
}

/**
 * Guarda los datos del cliente. Orden: (1) validar todo, (2) cambiar el
 * correo de acceso si hace falta, (3) confirmar perfil + reserva de teléfono
 * + auditoría en un único commit. Si el paso 3 falla se devuelve el correo
 * de acceso al anterior para no dejar dos fuentes distintas.
 */
export async function updateCustomerProfileAdmin(env, input = {}, actor = {}, deps = {}) {
  const store = { ...defaultDeps, ...deps };
  const uid = text(input.uid, 128);
  const { document, profile: current } = await readClientProfile(env, uid, store);
  const currentEmail = text(current.email, 254).toLowerCase();
  if (currentEmail === SUPER_ADMIN_EMAIL || current.role === 'superadmin') throw failure('La cuenta Super Admin está protegida.', 403);

  const changeId = text(input.changeId, 120);
  if (!CHANGE_ID_PATTERN.test(changeId)) throw failure('Solicitud inválida: falta el identificador del cambio.');
  const currentChangeId = text(current.lastChangeId, 120);
  if (currentChangeId && currentChangeId === changeId) return { uid, duplicate: true, changeId };
  const baseChangeId = text(input.baseChangeId, 120);
  if (baseChangeId && currentChangeId && baseChangeId !== currentChangeId) {
    throw failure('La ficha cambió mientras la editabas. Volvé a abrirla antes de guardar.', 409);
  }

  const next = validateCustomerProfileInput(input, current);
  const before = {
    firstName: text(current.firstName, 60),
    lastName: text(current.lastName, 60),
    name: text(current.name, 120),
    phone: text(current.phone, 40),
    email: currentEmail,
    address: text(current.address, 240),
  };
  const name = `${next.firstName} ${next.lastName}`;
  const after = { firstName: next.firstName, lastName: next.lastName, name, phone: next.phone, email: next.email, address: next.address };
  const changed = Object.keys(after).filter(key => after[key] !== before[key]);
  if (!changed.length) return { uid, duplicate: false, unchanged: true, changeId: currentChangeId };

  const writes = [];
  const newKey = phoneKey(next.phone, DEFAULT_COUNTRY);
  const oldKey = before.phone ? phoneKey(before.phone, DEFAULT_COUNTRY) : '';
  if (newKey !== oldKey) {
    const reservation = await store.get(env, `phoneReservations/${newKey}`);
    const owner = reservation ? text(decodeFirestoreFields(reservation.fields || {}).uid, 128) : '';
    if (owner && owner !== uid) throw failure('Ese teléfono ya está registrado en otra cuenta.', 409);
    const now = store.now();
    if (!owner) writes.push({ path: `phoneReservations/${newKey}`, fields: encodeFirestoreFields({ uid, createdAt: now }), currentDocument: { exists: false } });
    if (oldKey) {
      const previous = await store.get(env, `phoneReservations/${oldKey}`);
      const previousOwner = previous ? text(decodeFirestoreFields(previous.fields || {}).uid, 128) : '';
      if (previousOwner === uid) writes.push({ path: `phoneReservations/${oldKey}`, delete: true });
    }
  }

  const emailChanged = next.email !== currentEmail;
  let authResult = null;
  if (emailChanged) authResult = await store.updateAuthEmail(env, uid, next.email);

  const now = store.now();
  const eventId = `cliente_${store.randomId()}`;
  writes.unshift({
    path: `users/${uid}`,
    fields: encodeFirestoreFields({ ...after, updatedAt: now, lastChangeId: changeId, profileEditedBy: 'superadmin', profileEditedAt: now }),
    mergeFields: ['firstName', 'lastName', 'name', 'phone', 'email', 'address', 'updatedAt', 'lastChangeId', 'profileEditedBy', 'profileEditedAt'],
    ...(document.updateTime ? { currentDocument: { updateTime: document.updateTime } } : {}),
  });
  writes.push({
    path: `auditLog/${eventId}`,
    fields: encodeFirestoreFields({
      eventId,
      timestamp: now,
      createdAt: now,
      customerId: text(current.customerId, 120) || `CUS_${uid}`,
      actorId: text(actor.uid, 128),
      actorEmail: text(actor.email, 254),
      actorRole: 'superadmin',
      action: emailChanged ? 'cambiar_correo_cliente' : 'editar_cliente',
      entityType: 'usuario',
      entityId: uid,
      targetId: uid,
      changedFields: changed,
      details: emailChanged ? `Correo de acceso cambiado a ${next.email}` : `Datos editados: ${changed.join(', ')}`,
      before,
      after,
      origin: 'superadmin-ficha-cliente',
      result: 'success',
      changeId,
      ...(emailChanged ? { accessReset: true, removedProviders: authResult?.removedProviders || [] } : {}),
    }),
    currentDocument: { exists: false },
  });

  try {
    await store.commit(env, writes);
  } catch (error) {
    if (emailChanged && authResult?.changed && currentEmail) {
      try { await store.updateAuthEmail(env, uid, currentEmail); }
      catch (rollbackError) { console.error('[perfil-cliente-admin] no se pudo devolver el correo de acceso', rollbackError?.message || rollbackError); }
    }
    if (Number(error?.status) === 409) throw failure('La ficha cambió mientras la editabas. Volvé a abrirla antes de guardar.', 409);
    throw error;
  }
  return { uid, duplicate: false, changeId, emailChanged, changedFields: changed, profile: after };
}
