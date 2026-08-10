/* =============================================================
   TINTIN — Bootstrap de navegación pública modular
   =============================================================
   Este archivo conserva compatibilidad con todas las páginas públicas.
   La estructura real vive en js/components/navigation/ y se carga como
   módulo ES para que escritorio, tableta, movil y superficies compartidas
   puedan mantenerse por separado.

   Contrato de accesibilidad conservado por los componentes:
   id="search-panel" role="dialog" · id="cart-drawer" role="dialog"
   id="collections-sheet" role="dialog" · id="tt-tablet-menu" role="dialog"
   ============================================================= */
(function () {
  'use strict';

  if (window.TintinPublicShellBootstrapStarted) return;
  window.TintinPublicShellBootstrapStarted = true;

  const MODULE_VERSION = 'tintin-20260810-global-studio-3';
  const scriptUrl = document.currentScript?.src || new URL('js/inicio-navegacion-publica.js', window.location.href).href;
  const entryUrl = new URL('./components/navigation/entrada-navegacion-publica.js', scriptUrl);
  entryUrl.searchParams.set('v', MODULE_VERSION);

  import(entryUrl.href).catch(error => {
    window.TintinPublicShellBootstrapStarted = false;
    console.error('[PublicShell] No se pudo iniciar la navegación modular.', error);
    document.dispatchEvent(new CustomEvent('tintin:public-shell-error', {
      detail: { error },
    }));
  });
})();
