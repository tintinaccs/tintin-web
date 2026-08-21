// =============================================================
// TINTIN ACCESORIOS — Un username, una cuenta
// =============================================================
// Mismo mecanismo que la reserva de teléfono (ver reserva-telefono.js): la
// unicidad la garantiza Firestore, no el código del navegador. El perfil sólo
// puede guardar un username cuando existe una reserva con esa misma clave y
// pertenece a la misma cuenta.
//
// Importante: Firestore devuelve `permission-denied` tanto cuando el username
// ya está tomado por otra cuenta como cuando la reserva ya existe para la
// MISMA cuenta (reintento tras un guardado de perfil que no llegó a
// completarse). Por eso este módulo no convierte automáticamente cualquier
// `permission-denied` en "username ocupado"; la escritura posterior del
// perfil vuelve a validar el dueño de la reserva.

import { doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { usernameKey } from "./utilidades-username.js?v=tintin-20260821-username-unique-1";

export class UsernameAlreadyTakenError extends Error {
  constructor() {
    super('username_already_taken');
    this.code = 'username_already_taken';
  }
}

/**
 * Reserva el username para esta cuenta.
 * @returns {Promise<string>} la clave de la reserva.
 */
export async function reserveUsername(db, uid, rawUsername) {
  const key = usernameKey(rawUsername);
  if (!key) throw new Error('username_invalid');

  try {
    await setDoc(doc(db, 'usernameReservations', key), {
      uid,
      createdAt: serverTimestamp(),
    });
    return key;
  } catch (error) {
    if (error?.code === 'permission-denied') {
      console.info('[username-reservation] La reserva ya existía o Firestore la rechazó; se validará al guardar el perfil.');
      return key;
    }
    throw error;
  }
}

/**
 * Libera un username. Se usa al cambiarlo: el viejo queda disponible para
 * quien lo quiera después.
 */
export async function releaseUsername(db, key) {
  if (!key) return;
  try {
    await deleteDoc(doc(db, 'usernameReservations', key));
  } catch (error) {
    console.warn('[username-reservation] No se pudo liberar el username:', error);
  }
}

/** Cambia el username reservado: primero toma el nuevo, después suelta el viejo. */
export async function changeReservedUsername(db, uid, previousKey, rawUsername) {
  const key = await reserveUsername(db, uid, rawUsername);
  if (previousKey && previousKey !== key) await releaseUsername(db, previousKey);
  return key;
}
