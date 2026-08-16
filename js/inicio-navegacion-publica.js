/* TINTIN — adaptador de arranque de la navegación pública modular. */
(function () {
  'use strict';

  if (window.TintinPublicShellBootstrapStarted) return;
  window.TintinPublicShellBootstrapStarted = true;

  const VERSION = 'tintin-20260816-loader-shell-atomic-1';
  const scriptUrl = document.currentScript?.src
    || new URL('js/inicio-navegacion-publica.js', window.location.href).href;
  const entryUrl = new URL('./components/navigation/entrada-navegacion-publica.js', scriptUrl);
  const barrierUrl = new URL('./components/navigation/compartido/barrera-arranque-shell.js', scriptUrl);
  entryUrl.searchParams.set('v', VERSION);
  barrierUrl.searchParams.set('v', VERSION);

  let waitHeld = false;
  let barrierArmed = false;
  if (window.TintinLoader?.beginWait) {
    window.TintinLoader.beginWait();
    waitHeld = true;
  }

  const release = () => {
    if (!waitHeld) return;
    waitHeld = false;
    window.TintinLoader?.endWait?.();
  };

  import(barrierUrl.href)
    .then(({ armPublicShellStartupBarrier }) => {
      barrierArmed = true;
      armPublicShellStartupBarrier({ release });
      return import(entryUrl.href);
    })
    .catch(error => {
      window.TintinPublicShellBootstrapStarted = false;
      console.error('[PublicShell] No se pudo iniciar la navegación modular.', error);
      document.dispatchEvent(new CustomEvent('tintin:public-shell-error', { detail: { error } }));
      if (!barrierArmed) release();
    });
})();
