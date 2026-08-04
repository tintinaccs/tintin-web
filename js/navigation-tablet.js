/* Compatibility shim. Source of truth: components/navigation/tablet/controller.js */
(() => {
  const scriptUrl = document.currentScript?.src || new URL('js/navigation-tablet.js', location.href).href;
  const url = new URL('./components/navigation/tablet/controller.js', scriptUrl);
  url.searchParams.set('v', 'tintin-20260804-modular-shell-1');
  import(url.href).catch(error => console.error('[NavigationTablet] No se pudo cargar el módulo.', error));
})();
