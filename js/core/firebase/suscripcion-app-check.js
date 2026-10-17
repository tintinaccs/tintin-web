import { appCheckReady } from './firebase.js?v=tintin-20261017-domain-cutover-1';
import { onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// App Check puede resolver después del límite de espera de la interfaz.
// Firestore termina un listener rechazado: recibir un token más tarde no lo
// revive. Esperar la confirmación antes de abrirlo, incluso si llega tarde;
// los rechazos reales de Rules siguen visibles y nunca disparan un bucle.
export function onAppCheckSnapshot(reference, optionsOrNext, nextOrFail, maybeFail) {
  const options = typeof optionsOrNext === 'function' ? null : optionsOrNext;
  const next = options ? nextOrFail : optionsOrNext;
  const fail = options ? maybeFail : nextOrFail;
  let stopped = false;
  let unsubscribe = null;
  let started = false;
  const start = () => {
    if (stopped) return;
    unsubscribe?.();
    started = true;
    unsubscribe = onSnapshot(reference, ...(options ? [options] : []), snapshot => {
      if (!stopped) next(snapshot);
    }, error => {
      if (stopped) return;
      fail?.(error);
    });
  };
  const recover = event => {
    if (event.detail?.ready !== true) return;
    if (!started) start();
  };
  window.addEventListener('tintin:app-check-ready', recover);
  appCheckReady.then(ready => {
    if (stopped || started) return;
    if (ready === true || window.TintinAppCheckStatus === 'enabled') start();
    else fail?.(Object.assign(new Error('La conexión segura todavía no está disponible.'), { code: 'app-check-unavailable' }));
  });
  return () => {
    stopped = true;
    unsubscribe?.();
    window.removeEventListener('tintin:app-check-ready', recover);
  };
}
