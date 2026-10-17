import { db } from '../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { onAppCheckSnapshot } from '../core/firebase/suscripcion-app-check.js?v=tintin-20261017-domain-cutover-1';
import { doc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { createSiteRevisionObserver } from './vigilancia-version.js?v=tintin-20261016-admin-live-1';

if (!window.TintinSiteChangesBooted) {
  window.TintinSiteChangesBooted = true;
  const receive = createSiteRevisionObserver(() => {
    window.dispatchEvent(new CustomEvent('tintin:site-content-updated'));
    import('./vigilancia-version.js?v=tintin-20261016-admin-live-1')
      .then(module => module.notifySiteContentChange())
      .catch(error => console.warn('[site-change] No se pudo mostrar el aviso:', error?.message));
  });
  let stop = null, retryTimer = 0, attempt = 0, generation = 0, disposed = false;
  const delays = [1400, 4000, 12000, 30000];
  function start() {
    if (disposed) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = 0;
    stop?.();
    const token = ++generation;
    stop = onAppCheckSnapshot(doc(db, 'settings', 'siteRevision'), { includeMetadataChanges: true }, snapshot => {
      if (disposed || token !== generation) return;
      attempt = 0;
      if (!snapshot.metadata?.hasPendingWrites) receive(snapshot.exists() ? snapshot.data() : null);
    }, error => {
      if (disposed || token !== generation) return;
      // El wrapper conserva la espera del token y se activa cuando llega.
      // Reiniciarlo aquí sólo repite la misma promesa vencida, consume los
      // reintentos y convierte una espera recuperable en errores de consola.
      // Los rechazos reales de Firestore siguen el camino de error inferior.
      if (error?.code === 'app-check-unavailable') return;
      console.warn('[site-change] No se pudo escuchar la revisión:', error?.code || 'unavailable');
      if (attempt < delays.length && !retryTimer) retryTimer = setTimeout(start, delays[attempt++]);
    });
  }
  const recover = () => {
    if (attempt && !retryTimer && !document.hidden) { attempt = 0; start(); }
  };
  window.addEventListener('online', recover);
  document.addEventListener('visibilitychange', recover);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true; generation++;
    if (retryTimer) clearTimeout(retryTimer);
    stop?.();
    window.removeEventListener('online', recover);
    document.removeEventListener('visibilitychange', recover);
  });
  start();
}
