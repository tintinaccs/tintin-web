/* TINTIN — adaptador de arranque de la navegación pública modular. */
/* Contrato: id="search-panel" role="dialog" · id="cart-drawer" role="dialog" · id="collections-sheet" role="dialog" · id="tt-tablet-menu" role="dialog". */
(function () {
  'use strict';

  if (window.TintinPublicShellBootstrapStarted) return;
  window.TintinPublicShellBootstrapStarted = true;

  const ENTRY_VERSION = 'tintin-20261013-connectivity-hit-target-1-pedidos-styles-20261013-1-security-ready-20261013-2-palette-20261014-1-stock-flow-20261014-1-connections-20261014-1-main-sync-20261014-1-profile-pulseras-20261014-1-pulseras-lifecycle-20261014-1';
  const BARRIER_VERSION = 'tintin-20260915-session-shell-2';
  const scriptUrl = document.currentScript?.src
    || new URL('js/inicio-navegacion-publica.js', window.location.href).href;
  const entryUrl = new URL('./components/navigation/entrada-navegacion-publica.js', scriptUrl);
  const barrierUrl = new URL('./components/navigation/compartido/barrera-arranque-shell.js', scriptUrl);
  entryUrl.searchParams.set('v', ENTRY_VERSION);
  barrierUrl.searchParams.set('v', BARRIER_VERSION);

  let waitHeld = false;
  let barrierArmed = false;
  if (window.TintinLoader?.beginWait) {
    window.TintinLoader.beginWait();
    waitHeld = true;
  }

  const release = () => {
    if (window.__TintinPublicShellStartupWaitHeld) {
      window.__TintinPublicShellStartupWaitHeld = false;
      window.TintinLoader?.endWait?.();
    }
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
