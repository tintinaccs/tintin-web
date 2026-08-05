/* Adaptador de compatibilidad. Fuente principal: components/navigation/tableta/control-menu-tableta.js */
(() => {
  const scriptUrl = document.currentScript?.src || new URL('js/components/navigation/legacy/navigation-tablet.js', location.href).href;
  const url = new URL('../tableta/control-menu-tableta.js', scriptUrl);
  url.searchParams.set('v', 'tintin-20260804-modular-shell-1');
  import(url.href).catch(error => console.error('[NavigationTablet] No se pudo cargar el módulo.', error));
})();
