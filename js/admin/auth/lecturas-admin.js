import { auth } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1-first-render-merge-20261010-1';
import { onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { waitForAdminAppCheck, recoverAdminSecurity } from './app-check-admin.js?v=tintin-20261004-admin-connections-3';

const credentialError = error => /^(?:firestore\/)?(?:permission-denied|unauthenticated)$/.test(String(error?.code || ''));

export async function readAdminFirestore(read) {
  if (!await waitForAdminAppCheck(12000)) throw Object.assign(new Error('Verificación de seguridad pendiente. Podés reintentar.'), { code: 'admin/security-unavailable' });
  const uid = auth.currentUser?.uid;
  try { return await read(); }
  catch (error) {
    if (!credentialError(error) || !await recoverAdminSecurity(uid)) throw error;
    return read();
  }
}

// Cada stream se recupera una sola vez. La renovación es compartida entre
// módulos; una denegación persistente llega al error original, sin bucles.
export function subscribeAdminSnapshot(reference, next, onError = () => {}) {
  let stopped = false, unsubscribe = null, retried = false, uid = auth.currentUser?.uid;
  const stop = () => { stopped = true; unsubscribe?.(); unsubscribe = null; detachSession?.(); };
  const detachSession = subscribeAuthState(user => {
    if (uid && user?.uid !== uid) { unsubscribe?.(); unsubscribe = null; stopped = true; }
  });
  async function start() {
    if (stopped) return;
    if (!await waitForAdminAppCheck(12000)) {
      if (!stopped) onError(Object.assign(new Error('Verificación de seguridad pendiente. Podés reintentar.'), { code: 'admin/security-unavailable' }));
      return;
    }
    uid ||= auth.currentUser?.uid;
    if (stopped || !uid || auth.currentUser?.uid !== uid) return;
    unsubscribe = onSnapshot(reference, snapshot => {
      if (!stopped && auth.currentUser?.uid === uid) next(snapshot);
    }, async error => {
      if (stopped) return;
      unsubscribe?.(); unsubscribe = null;
      if (!retried && credentialError(error)) {
        retried = true;
        if (await recoverAdminSecurity(uid) && !stopped) { await start(); return; }
      }
      if (!stopped) onError(error);
    });
  }
  void start().catch(error => { if (!stopped) onError(error); });
  return stop;
}
