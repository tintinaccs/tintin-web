/* Compatibility shim. Source of truth: components/navigation/mobile/controller.js */
(() => {
  const scriptUrl = document.currentScript?.src || new URL('js/components/navigation/legacy/navigation-mobile.js', location.href).href;
  const url = new URL('./components/navigation/mobile/controller.js', scriptUrl);
  url.searchParams.set('v', 'tintin-20260804-modular-shell-1');
  import(url.href).catch(error => console.error('[NavigationMobile] No se pudo cargar el módulo.', error));
})();
