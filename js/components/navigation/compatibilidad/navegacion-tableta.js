/* Adaptador de compatibilidad. Fuente principal: components/navigation/tableta/control-menu-tableta.js */
(() => {
  const scriptUrl = document.currentScript?.src || new URL('js/components/navigation/compatibilidad/navegacion-tableta.js', location.href).href;
  const url = new URL('../tableta/control-menu-tableta.js', scriptUrl);
  url.searchParams.set('v', 'tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2');
  import(url.href).catch(error => console.error('[NavigationTablet] No se pudo cargar el módulo.', error));
})();
