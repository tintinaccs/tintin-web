/* Compatibility shim. Source of truth: components/navigation/desktop/controller.js */
(() => {
  const scriptUrl = document.currentScript?.src || new URL('js/components/navigation/legacy/navigation-desktop.js', location.href).href;
  const url = new URL('./components/navigation/desktop/controller.js', scriptUrl);
  url.searchParams.set('v', 'tintin-20260804-modular-shell-1');
  import(url.href).catch(error => console.error('[NavigationDesktop] No se pudo cargar el módulo.', error));
})();
