// =============================================================
// TINTIN ACCESORIOS — Un teléfono, una cuenta
// =============================================================
// La unicidad la garantiza Firestore: el perfil sólo puede guardar un número
// cuando existe una reserva con esa misma clave y pertenece a la misma cuenta.
//
// Importante: Firestore devuelve `permission-denied` tanto cuando el número ya
// está reservado por otra cuenta como cuando la reserva ya existe para la MISMA
// cuenta (por ejemplo, después de un intento anterior que alcanzó a reservar el
// número pero no terminó de guardar el perfil). Por eso este módulo no debe
// convertir automáticamente cualquier `permission-denied` en “número ocupado”.
// La escritura posterior del perfil vuelve a validar el dueño de la reserva y
// mantiene la unicidad del lado del servidor.

import { doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { phoneKey } from "./utilidades-telefono.js?v=tintin-20260803-phone-unique-1";

export class PhoneAlreadyRegisteredError extends Error {
  constructor() {
    super('phone_already_registered');
    this.code = 'phone_already_registered';
  }
}

/**
 * Reserva el número para esta cuenta.
 *
 * Si Firestore rechaza el create con `permission-denied`, se devuelve la clave
 * y se deja que la escritura del perfil compruebe si la reserva ya era de esta
 * misma cuenta. Así un reintento válido no queda bloqueado falsamente.
 *
 * @returns {Promise<string>} la clave de la reserva.
 */
export async function reservePhone(db, uid, rawPhone, country) {
  const key = phoneKey(rawPhone, country);
  if (!key) throw new Error('phone_invalid');

  try {
    await setDoc(doc(db, 'phoneReservations', key), {
      uid,
      createdAt: serverTimestamp(),
    });
    return key;
  } catch (error) {
    if (error?.code === 'permission-denied') {
      // Puede ser una reserva propia dejada por un intento anterior. No se
      // anuncia como duplicado todavía: las reglas de `users/{uid}` validan
      // después que la reserva pertenezca realmente a esta misma cuenta.
      console.info('[phone-reservation] La reserva ya existía o Firestore la rechazó; se validará al guardar el perfil.');
      return key;
    }
    throw error;
  }
}

/**
 * Libera un número. Se usa al cambiar de teléfono: el viejo queda disponible
 * para quien lo herede.
 */
export async function releasePhone(db, key) {
  if (!key) return;
  try {
    await deleteDoc(doc(db, 'phoneReservations', key));
  } catch (error) {
    console.warn('[phone-reservation] No se pudo liberar el número:', error);
  }
}

/** Cambia el número reservado: primero toma el nuevo, después suelta el viejo. */
export async function changeReservedPhone(db, uid, previousKey, rawPhone, country) {
  const key = await reservePhone(db, uid, rawPhone, country);
  if (previousKey && previousKey !== key) await releasePhone(db, previousKey);
  return key;
}
