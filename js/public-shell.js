/* =============================================================
   TINTIN — Bootstrap de navegación pública modular
   =============================================================
   Este archivo conserva compatibilidad con todas las páginas públicas.
   La estructura real vive en js/components/navigation/ y se carga como
   módulo ES para que desktop, tablet, mobile y superficies compartidas
   puedan mantenerse por separado.
   ============================================================= */
(function () {
  'use strict';

  if (window.TintinPublicShellBootstrapStarted) return;
  window.TintinPublicShellBootstrapStarted = true;

  const MODULE_VERSION = 'tintin-20260804-modular-shell-1';
  const scriptUrl = document.currentScript?.src || new URL('js/public-shell.js', window.location.href).href;
  const entryUrl = new URL('./components/navigation/public-shell-entry.js', scriptUrl);
  entryUrl.searchParams.set('v', MODULE_VERSION);

  import(entryUrl.href).catch(error => {
    window.TintinPublicShellBootstrapStarted = false;
    console.error('[PublicShell] No se pudo iniciar la navegación modular.', error);
    document.dispatchEvent(new CustomEvent('tintin:public-shell-error', {
      detail: { error },
    }));
  });
})();
