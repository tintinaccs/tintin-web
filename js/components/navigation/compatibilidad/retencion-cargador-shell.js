/* TINTIN — retención síncrona del loader hasta que el shell público quede listo. */
(function () {
  'use strict';

  if (window.__TintinPublicShellStartupWaitHeld) return;
  if (!window.TintinLoader?.beginWait) return;

  window.TintinLoader.beginWait();
  window.__TintinPublicShellStartupWaitHeld = true;
})();
