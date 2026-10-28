/* Compatibility bootstrap for the modular navigation surface controller.
   Accessibility contract implemented by the shared module:
   config.element.setAttribute('aria-hidden', 'false')
   config.element.setAttribute('aria-hidden', 'true')
*/
(() => {
  'use strict';

  if (window.TintinSurfaceController) {
    window.TintinSurfaceControllerReady = Promise.resolve(window.TintinSurfaceController);
    return;
  }
  if (window.TintinSurfaceControllerReady) return;

  const MODULE_VERSION = 'tintin-20261024-foco-paneles-1-nav-20261028-2';
  const scriptUrl = document.currentScript?.src || new URL('js/components/navigation/compatibilidad/inicio-control-paneles.js', window.location.href).href;
  const controllerUrl = new URL('../compartido/control-paneles.js', scriptUrl);
  controllerUrl.searchParams.set('v', MODULE_VERSION);

  window.TintinSurfaceControllerReady = import(controllerUrl.href)
    .then(() => window.TintinSurfaceController)
    .catch(error => {
      window.TintinSurfaceControllerReady = null;
      console.error('[SurfaceController] No se pudo iniciar el controlador modular.', error);
      document.dispatchEvent(new CustomEvent('tintin:surface-controller-error', {
        detail: { error },
      }));
      throw error;
    });
  // This bootstrap starts before consumers exist. The failure is already logged
  // and dispatched above; keep the original rejected promise for consumers,
  // while observing it here so leaving the document cannot leak a rejection.
  window.TintinSurfaceControllerReady.catch(() => {});
})();
