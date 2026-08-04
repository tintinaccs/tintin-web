/* Compatibility shim. Source of truth: components/navigation/desktop/controller.js */
(() => {
  const url = new URL('./components/navigation/desktop/controller.js', import.meta.url);
  url.searchParams.set('v', 'tintin-20260804-modular-shell-1');
  import(url.href).catch(error => console.error('[NavigationDesktop] No se pudo cargar el módulo.', error));
})();
