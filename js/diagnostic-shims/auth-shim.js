// =============================================================
// TINTIN — Diagnóstico integral: shim de solo lectura para Firebase Auth
// =============================================================
// Ver firestore-shim.js para el criterio general: reexporta el SDK real de
// Auth (lecturas de estado, listeners, providers) y solo reemplaza las
// funciones que podrían cambiar la sesión real, enviar correos/SMS reales o
// abrir popups/redirects reales, por versiones inertes que nunca llegan a
// Firebase. `onAuthStateChanged`/`getAuth` no se tocan: el diagnóstico debe
// ver la sesión real de quien lo ejecuta, solo sin poder modificarla.
import { reportBlockedWrite } from './diagnostic-shim-report.js?v=tintin-20260716-cloudinary-fix-1';

export * from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const blockedResolve = name => async (...args) => {
  reportBlockedWrite(name, null);
  return undefined;
};

export const signOut = blockedResolve('signOut');
export const updateProfile = blockedResolve('updateProfile');
export const updateEmail = blockedResolve('updateEmail');
export const updatePassword = blockedResolve('updatePassword');
export const deleteUser = blockedResolve('deleteUser');
export const verifyBeforeUpdateEmail = blockedResolve('verifyBeforeUpdateEmail');
export const updateCurrentUser = blockedResolve('updateCurrentUser');
export const sendSignInLinkToEmail = blockedResolve('sendSignInLinkToEmail');
export const sendPasswordResetEmail = blockedResolve('sendPasswordResetEmail');
export const confirmPasswordReset = blockedResolve('confirmPasswordReset');
export const applyActionCode = blockedResolve('applyActionCode');

function blockedCredentialResult(name) {
  return async (...args) => {
    reportBlockedWrite(name, null);
    return { user: null, __diagnosticBlocked: true };
  };
}

export const signInWithPopup = blockedCredentialResult('signInWithPopup');
export const signInWithRedirect = blockedCredentialResult('signInWithRedirect');
export const signInWithEmailAndPassword = blockedCredentialResult('signInWithEmailAndPassword');
export const createUserWithEmailAndPassword = blockedCredentialResult('createUserWithEmailAndPassword');
export const signInWithEmailLink = blockedCredentialResult('signInWithEmailLink');
export const linkWithPopup = blockedCredentialResult('linkWithPopup');
export const reauthenticateWithPopup = blockedCredentialResult('reauthenticateWithPopup');
