import { auth, db } from '../firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { isSuperAdmin } from '../auth/identidad-super-admin.js?v=tintin-20260916-superadmin-identity-2';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { createConfirmedChangeWriter } from './cambio-confirmado.mjs?v=tintin-20261016-admin-live-1';

export const withAdminSiteChange = createConfirmedChangeWriter({
  enabled: () => isSuperAdmin(auth.currentUser),
  publish: () => setDoc(doc(db, 'settings', 'siteRevision'), {
    revision: crypto.randomUUID(), updatedAt: serverTimestamp(),
  }),
  onError: error => {
    console.warn('[admin-site-change] Cambio guardado; aviso de actualización pendiente:', error?.code || 'unavailable');
    window.TintinAdminOps?.notify?.('El cambio se guardó. No se pudo publicar el aviso de actualización; comprobá la conexión.', { type: 'warning' });
  },
});
