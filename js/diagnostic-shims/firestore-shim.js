// =============================================================
// TINTIN — Diagnóstico integral: shim de solo lectura para Firestore
// =============================================================
// Este módulo SOLO se carga dentro del iframe aislado del Diagnóstico de
// Super Admin, mediante un importmap que redirige aquí la URL real del SDK
// de Firestore. Nunca se referencia desde ninguna página real: las páginas
// publicadas siguen importando el SDK real de gstatic sin pasar por acá.
//
// Reexporta el SDK real de Firestore sin tocarlo (lecturas, listeners,
// helpers de consulta) para que el diagnóstico mida el resultado real de
// ejecutar el sitio. Las únicas funciones que pueden escribir datos se
// reemplazan por versiones seguras que nunca llegan a la red: registran el
// intento (para que el propio diagnóstico lo documente como evidencia) y
// devuelven una respuesta inerte con la forma que el código que llama
// espera, sin tocar Firestore.
import { reportBlockedWrite } from './diagnostic-shim-report.js?v=tintin-20260716-cloudinary-fix-1';

export * from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function addDoc(reference) {
  reportBlockedWrite('addDoc', reference?.path || null);
  return { id: '__diagnostic_blocked__', path: '__diagnostic_blocked__' };
}

export async function setDoc(reference) {
  reportBlockedWrite('setDoc', reference?.path || null);
  return undefined;
}

export async function updateDoc(reference) {
  reportBlockedWrite('updateDoc', reference?.path || null);
  return undefined;
}

export async function deleteDoc(reference) {
  reportBlockedWrite('deleteDoc', reference?.path || null);
  return undefined;
}

export function writeBatch() {
  reportBlockedWrite('writeBatch', null);
  const batch = {
    set: () => batch,
    update: () => batch,
    delete: () => batch,
    commit: async () => {
      reportBlockedWrite('writeBatch.commit', null);
      return undefined;
    }
  };
  return batch;
}

export async function runTransaction(_firestore, updateFunction) {
  reportBlockedWrite('runTransaction', null);
  const transactionStub = {
    get: reference => getDoc(reference),
    set: () => transactionStub,
    update: () => transactionStub,
    delete: () => transactionStub
  };
  return updateFunction(transactionStub);
}
