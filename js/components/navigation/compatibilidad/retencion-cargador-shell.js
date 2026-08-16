/* TINTIN — retención síncrona del loader hasta que el shell público quede listo. */
(function () {
  'use strict';

  const loader = window.TintinLoader;
  if (!loader?.beginWait) return;

  // Ningún consumidor externo puede forzar el cierre visual del loader
  // mientras existan barreras de arranque pendientes. Históricamente el
  // script de primer color llamaba TintinLoader.hide() a los ~180–220 ms y
  // ese método apuntaba a hideNow(), saltándose pendingWaits y provocando el
  // flash de página sin header. Desde este punto, hide() pasa a ser una
  // solicitud de cierre segura: marca contenido listo y deja que el propio
  // loader respete sus waits, el mínimo visual y el store gate.
  if (!window.__TintinLoaderSafeHideInstalled && typeof loader.ready === 'function') {
    window.__TintinLoaderSafeHideInstalled = true;
    loader.hide = function safeHideRequest() {
      loader.ready();
    };
  }

  if (window.__TintinPublicShellStartupWaitHeld) return;

  loader.beginWait();
  window.__TintinPublicShellStartupWaitHeld = true;
})();
