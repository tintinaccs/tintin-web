// Cliente autenticado único para APIs de la tienda.
// Nunca cierra la sesión ante errores HTTP, red, rate limiting o permisos.
import { auth } from '../firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';

const authReady = typeof auth.authStateReady === 'function'
  ? auth.authStateReady().catch(() => {})
  : Promise.resolve();

export async function currentAuthenticatedUser() {
  await authReady;
  return auth.currentUser || null;
}

export async function currentAuthToken(forceRefresh = false) {
  const user = await currentAuthenticatedUser();
  if (!user) return '';
  return user.getIdToken(forceRefresh);
}

export async function authenticatedFetch(input, init = {}, options = {}) {
  const user = await currentAuthenticatedUser();
  if (!user) {
    const error = new Error('La sesión ya no está disponible.');
    error.code = 'auth/missing-user';
    throw error;
  }

  const forceRefreshOnRetry = options.forceRefreshOnRetry !== false;
  const baseHeaders = new Headers(init.headers || {});
  let token = await user.getIdToken(false);
  baseHeaders.set('authorization', `Bearer ${token}`);

  let response = await fetch(input, { ...init, headers: baseHeaders });
  if (response.status !== 401 || !forceRefreshOnRetry) return response;

  token = await user.getIdToken(true);
  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set('authorization', `Bearer ${token}`);
  const retryInit = typeof options.retryInit === 'function'
    ? await options.retryInit(token, init)
    : { ...init, headers: retryHeaders };
  if (!retryInit.headers) retryInit.headers = retryHeaders;
  else {
    const mergedRetryHeaders = new Headers(retryInit.headers);
    mergedRetryHeaders.set('authorization', `Bearer ${token}`);
    retryInit.headers = mergedRetryHeaders;
  }
  return fetch(input, retryInit);
}

export function apiFailureMessage(response, fallback = 'No se pudo completar la operación.') {
  if (response?.status === 401) return 'La sesión necesita renovarse. Reintentá la operación.';
  if (response?.status === 403) return 'No tenés permisos para realizar esta operación.';
  if (response?.status === 429) return 'Hay demasiadas solicitudes. Esperá un momento y probá de nuevo.';
  if (response?.status >= 500) return 'El servicio está temporalmente ocupado. Probá de nuevo en unos segundos.';
  return fallback;
}
