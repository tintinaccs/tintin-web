import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

if (!window.TintinAdminEmailGateSyncBooted) {
  window.TintinAdminEmailGateSyncBooted = true;

  const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';
  const PRIVATE_REF = doc(db, 'emailSettings', 'main');
  const PUBLIC_REF = doc(db, 'settings', 'emailGate');

  let privateState = { exists: false, data: {} };
  let publicState = { exists: false, data: {} };
  let unsubPrivate = null;
  let unsubPublic = null;
  let syncing = false;
  let queued = false;

  function normalized(data) {
    return {
      orderEmailsEnabled: data?.orderEmailsEnabled !== false,
      internalEmailEnabled: data?.internalEmailEnabled !== false,
      customerEmailEnabled: data?.customerEmailEnabled !== false
    };
  }

  function desired() {
    return normalized(privateState.exists ? privateState.data : {});
  }

  function matches() {
    return publicState.exists &&
      JSON.stringify(normalized(publicState.data)) === JSON.stringify(desired());
  }

  async function sync() {
    if (syncing || matches()) {
      if (syncing) queued = true;
      return;
    }

    syncing = true;
    queued = false;
    try {
      await setDoc(PUBLIC_REF, {
        ...desired(),
        updatedAt: serverTimestamp()
      });
      window.dispatchEvent(new CustomEvent('tintin:email-gate-synced'));
    } catch (error) {
      console.error('[admin-email-gate-sync] No se pudo sincronizar emailGate:', error);
    } finally {
      syncing = false;
      if (queued) sync();
    }
  }

  function stop() {
    unsubPrivate?.();
    unsubPublic?.();
    unsubPrivate = null;
    unsubPublic = null;
  }

  function start() {
    if (unsubPrivate || unsubPublic) return;

    unsubPrivate = onSnapshot(
      PRIVATE_REF,
      snapshot => {
        privateState = {
          exists: snapshot.exists(),
          data: snapshot.exists() ? snapshot.data() || {} : {}
        };
        sync();
      },
      error => console.error('[admin-email-gate-sync] No se pudo leer emailSettings/main:', error)
    );

    unsubPublic = onSnapshot(
      PUBLIC_REF,
      snapshot => {
        publicState = {
          exists: snapshot.exists(),
          data: snapshot.exists() ? snapshot.data() || {} : {}
        };
        sync();
      },
      error => console.error('[admin-email-gate-sync] No se pudo leer settings/emailGate:', error)
    );
  }

  onAuthStateChanged(auth, user => {
    if ((user?.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL) start();
    else stop();
  });
}
