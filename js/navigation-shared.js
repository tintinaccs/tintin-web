/* Compatibility shim. Source of truth: components/navigation/shared/router.js */
(() => {
  const scriptUrl = document.currentScript?.src || new URL('js/navigation-shared.js', location.href).href;
  const url = new URL('./components/navigation/shared/router.js', scriptUrl);
  url.searchParams.set('v', 'tintin-20260804-modular-shell-1');
  import(url.href).catch(error => console.error('[NavigationShared] No se pudo cargar el módulo.', error));
})();
