// =============================================================
// TINTIN ACCESORIOS — Estado del perfil de una sesión (lógica pura)
// =============================================================
// Tener sesión en Firebase Auth NO significa tener cuenta completa: el
// documento `users/{uid}` puede no existir (alta abandonada antes de que se
// creara), existir a medias, estar completo, o no poder leerse por un error.
// Esta es la única definición de esos estados y de qué hacer con cada uno;
// login.html la usa para decidir el destino. No toca Firebase ni el DOM, así
// que se prueba con `node --test`.
//
// Estados de sesión (los de Auth viven en coordinador-sesion.js/estado-sesion.mjs):
//   NOT_REQUESTED -> LOADING -> MISSING | INCOMPLETE | COMPLETE | ERROR
//
// Regla de oro: un error de lectura JAMÁS se convierte en "perfil inexistente"
// ni en un cierre de sesión. MISSING sólo sale de una lectura exitosa que dice
// que el documento no existe.

import { getProfileCompletionPlan } from '../../pages/profile/configuracion-inicial-perfil.mjs?v=tintin-20260929-incomplete-flags-1';

export const PROFILE_STATE = Object.freeze({
  NOT_REQUESTED: 'NOT_REQUESTED',
  LOADING: 'LOADING',
  MISSING: 'MISSING',
  INCOMPLETE: 'INCOMPLETE',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
});

export const PROFILE_ACTION = Object.freeze({
  ENTER: 'ENTER',
  CREATE_THEN_COMPLETE_PROFILE: 'CREATE_THEN_COMPLETE_PROFILE',
  COMPLETE_PROFILE: 'COMPLETE_PROFILE',
  STAY_WITH_RETRY: 'STAY_WITH_RETRY',
});

export const PROFILE_ERROR_KIND = Object.freeze({
  PERMISSION_DENIED: 'permission-denied',
  OFFLINE: 'offline',
  TIMEOUT: 'timeout',
  UNAVAILABLE: 'unavailable',
  UNKNOWN: 'unknown',
});

const KNOWN_ROLES = ['superadmin', 'admin', 'agent', 'viewer', 'client'];

/** Rol ausente, nulo o desconocido => `client` (nunca privilegio por omisión). */
export function normalizeRole(rawRole) {
  const role = String(rawRole || '').trim().toLowerCase();
  return KNOWN_ROLES.includes(role) ? role : 'client';
}

/** Método de acceso con el que se creó la sesión (el correo entra por custom token). */
export function detectAuthMethod(user) {
  const providers = Array.isArray(user?.providerData) ? user.providerData : [];
  return providers.some(provider => provider?.providerId === 'google.com') ? 'google' : 'emailOtp';
}

export function classifyProfileError(error, { online = true } = {}) {
  if (online === false) return PROFILE_ERROR_KIND.OFFLINE;
  const code = String(error?.code || '').replace(/^firestore\//, '');
  if (code === 'permission-denied') return PROFILE_ERROR_KIND.PERMISSION_DENIED;
  if (code === 'deadline-exceeded' || code === 'profile/deadline') return PROFILE_ERROR_KIND.TIMEOUT;
  if (code === 'unavailable') return PROFILE_ERROR_KIND.UNAVAILABLE;
  return PROFILE_ERROR_KIND.UNKNOWN;
}

/**
 * Sale de un intento de lectura: `{ snapshot }` o `{ error }`. Con error nunca
 * se inventa un perfil vacío.
 */
export function readProfileSnapshot(result, { online = true } = {}) {
  if (result?.error) {
    return { ok: false, exists: false, data: null, errorKind: classifyProfileError(result.error, { online }) };
  }
  const snapshot = result?.snapshot;
  if (!snapshot || typeof snapshot.exists !== 'function') {
    return { ok: false, exists: false, data: null, errorKind: PROFILE_ERROR_KIND.UNKNOWN };
  }
  const exists = snapshot.exists();
  const data = exists ? (snapshot.data() || {}) : null;
  return { ok: true, exists, data, errorKind: null };
}

/**
 * Única definición de "perfil completo": el plan de alta no pide nada.
 * Un perfil inexistente nunca es completo.
 */
export function isProfileComplete(profile, { user = {}, role = '', superAdminEmail = '' } = {}) {
  if (!profile) return false;
  return getProfileCompletionPlan({ profile, user, role, superAdminEmail }).skip === true;
}

/**
 * Estado del perfil a partir de una lectura ya clasificada.
 * @returns {{ state: string, plan: object|null, role: string, errorKind: string|null, reason: string }}
 */
export function resolveProfileState({ read, user = {}, role = '', superAdminEmail = '', clientOnly = false } = {}) {
  const email = String(user?.email || '').trim().toLowerCase();
  const isSuperAdmin = Boolean(superAdminEmail) && email === String(superAdminEmail).trim().toLowerCase();
  if (isSuperAdmin) {
    // El Super Admin jamás depende de un documento comercial ni de Firestore.
    return { state: PROFILE_STATE.COMPLETE, plan: null, role: 'superadmin', errorKind: null, reason: 'super-admin' };
  }
  if (!read) {
    return { state: PROFILE_STATE.NOT_REQUESTED, plan: null, role: normalizeRole(role), errorKind: null, reason: 'not-requested' };
  }
  if (!read.ok) {
    return { state: PROFILE_STATE.ERROR, plan: null, role: normalizeRole(role), errorKind: read.errorKind, reason: 'read-failed' };
  }
  const resolvedRole = normalizeRole(read.exists ? read.data?.role : role);
  if (!read.exists) {
    const plan = getProfileCompletionPlan({ profile: {}, user, role: resolvedRole, superAdminEmail });
    return { state: PROFILE_STATE.MISSING, plan, role: resolvedRole, errorKind: null, reason: 'document-missing' };
  }
  if (clientOnly && resolvedRole !== 'client') {
    return { state: PROFILE_STATE.COMPLETE, plan: null, role: resolvedRole, errorKind: null, reason: 'staff-exempt' };
  }
  const plan = getProfileCompletionPlan({ profile: read.data, user, role: resolvedRole, superAdminEmail });
  return plan.skip
    ? { state: PROFILE_STATE.COMPLETE, plan, role: resolvedRole, errorKind: null, reason: 'plan-satisfied' }
    : { state: PROFILE_STATE.INCOMPLETE, plan, role: resolvedRole, errorKind: null, reason: 'plan-pending' };
}

/** Qué hacer con cada estado. Nunca cerrar sesión, nunca navegar con datos sin resolver. */
export function resolveProfileAction(state) {
  switch (state) {
    case PROFILE_STATE.COMPLETE: return PROFILE_ACTION.ENTER;
    case PROFILE_STATE.MISSING: return PROFILE_ACTION.CREATE_THEN_COMPLETE_PROFILE;
    case PROFILE_STATE.INCOMPLETE: return PROFILE_ACTION.COMPLETE_PROFILE;
    default: return PROFILE_ACTION.STAY_WITH_RETRY; // ERROR / NOT_REQUESTED / LOADING
  }
}

/**
 * Límite de seguridad secundario para una lectura que no responde: la rechaza
 * con un código clasificable en vez de dejar un loader colgado. No reemplaza
 * la resolución real; sólo garantiza una salida.
 */
export function withDeadline(promise, ms, scheduler = { set: setTimeout, clear: clearTimeout }) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = scheduler.set(() => {
      const error = new Error('profile/deadline');
      error.code = 'profile/deadline';
      reject(error);
    }, ms);
  });
  return Promise.race([promise, deadline]).finally(() => scheduler.clear(timer));
}
