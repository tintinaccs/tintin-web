import { db } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { AUTH_STATES, subscribeSession } from '../../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1-first-render-merge-20261010-1';

const PROFILE_READ_TIMEOUT_MS = 5000;
let sessionUid = null;
let profileRead = null;

// Ambos consumidores de checkout comparten la misma hidratación. El resultado
// sólo vive durante esta sesión/página; nunca se guarda en storage ni autoriza
// pedidos en lugar de la validación del servidor.
subscribeSession(snapshot => {
  if (snapshot.status === AUTH_STATES.RESTORING) return;
  const uid = snapshot.status === AUTH_STATES.AUTHENTICATED ? snapshot.user?.uid : null;
  if (!uid || uid !== sessionUid) {
    sessionUid = uid || null;
    profileRead = null;
  }
});

export function readCheckoutProfile(user) {
  if (!user || user.isAnonymous) return Promise.resolve(null);
  if (sessionUid !== user.uid) {
    sessionUid = user.uid;
    profileRead = null;
  }
  if (profileRead) return profileRead;
  let timer;
  const request = Promise.race([
    getDoc(doc(db, 'users', user.uid)).then(snap => snap.exists() ? snap.data() : null),
    new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('profile_read_timeout')), PROFILE_READ_TIMEOUT_MS);
    })
  ]).finally(() => window.clearTimeout(timer));
  profileRead = request;
  // Permitir un reintento explícito tras error, sin borrar una sesión nueva.
  request.catch(() => { if (profileRead === request) profileRead = null; });
  return request;
}
