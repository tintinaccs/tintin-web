import { auth } from '../firebase/firebase.js?v=tintin-20261012-auth-privacy-1-firebase-js-domain-prepared-20261012-6-pedidos-styles-20261013-1-security-ready-20261013-2';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { markExplicitLogout, clearAuthHandoff } from './coordinador-sesion.js?v=tintin-20261012-auth-privacy-1-coordinador-sesion-js-domain-prepared-20261012-6-pedidos-styles-20261013-2-security-ready-20261013-2-ui-fixes-20261014-1-admin-live-20261016-1';
import { withDeadline } from './estado-perfil-sesion.mjs?v=tintin-20261015-images-1';

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
