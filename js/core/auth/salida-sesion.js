import { auth } from '../firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { markExplicitLogout, clearAuthHandoff } from './coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1';
import { withDeadline } from './estado-perfil-sesion.mjs?v=tintin-20261010-whatsapp-release-4';

let pendingLogout = null;
// Un único cierre real para tienda, perfil y panel. Un timeout devuelve control
// a la interfaz; jamás se interpreta como sesión cerrada ni borra persistencia.
export function logoutSession() {
  if (pendingLogout) return pendingLogout;
  markExplicitLogout();
  pendingLogout = withDeadline(Promise.resolve().then(() => signOut(auth)), 8000)
    .then(() => { clearAuthHandoff(); })
    .catch(error => {
      if (error?.code === 'profile/deadline') error.code = 'auth/logout-timeout';
      throw error;
    })
    .finally(() => { pendingLogout = null; });
  return pendingLogout;
}
