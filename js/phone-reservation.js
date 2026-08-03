// =============================================================
// TINTIN ACCESORIOS — Un teléfono, una cuenta
// =============================================================
// La unicidad la garantiza Firestore, no este archivo: el id del documento
// en `phoneReservations` es el número normalizado, y las reglas sólo
// permiten `create` (nunca `update`). Crear un documento que ya existe es un
// update, y las reglas lo rechazan. Por eso dos personas registrando el
// mismo número al mismo tiempo no pueden pasar las dos: la segunda escritura
// falla del lado del servidor, no por una comprobación de acá que se pueda
// saltear.
//
// Este módulo no lee la reserva antes de escribirla, a propósito: leerla
// permitiría averiguar si un número tiene cuenta, y las reglas tampoco lo
// permiten. Se intenta crear y se interpreta el fallo.
//
// Ojo con el alcance: esto evita cuentas duplicadas y ordena los datos, pero
// NO frena bots — quien automatiza inventa un número distinto cada vez. Eso
// se corta con App Check y con el límite de altas por IP, no acá.

import { doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { phoneKey } from "./phone-utils.js?v=tintin-20260716-cloudinary-fix-1";

export class PhoneAlreadyRegisteredError extends Error {
  constructor() {
    super('phone_already_registered');
    this.code = 'phone_already_registered';
  }
}

/**
 * Reserva el número para esta cuenta.
 *
 * @throws {PhoneAlreadyRegisteredError} si el número ya está en otra cuenta.
 * @returns {Promise<string>} la clave reservada, para poder liberarla después.
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
    // `permission-denied` acá significa, en la práctica, que el documento ya
    // existe: el payload lo arma este módulo y cumple las reglas, así que la
    // única condición que puede fallar es la de que el número esté libre.
    if (error?.code === 'permission-denied') throw new PhoneAlreadyRegisteredError();
    throw error;
  }
}

/**
 * Libera un número. Se usa al cambiar de teléfono: el viejo queda disponible
 * para quien lo herede, que es lo que pasa en la vida real con los números.
 *
 * No lanza si falla: quedarse con una reserva huérfana es molesto pero no
 * rompe nada, y no vale la pena frenar por eso un cambio de datos.
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
