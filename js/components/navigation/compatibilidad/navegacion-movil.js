/* Adaptador de compatibilidad. Fuente principal: components/navigation/movil/indicador-navegacion-movil.js */
(() => {
  const scriptUrl = document.currentScript?.src || new URL('js/components/navigation/compatibilidad/navegacion-movil.js', location.href).href;
  const url = new URL('../movil/indicador-navegacion-movil.js', scriptUrl);
  url.searchParams.set('v', 'tintin-20260804-modular-shell-1');
  import(url.href).catch(error => console.error('[NavigationMobile] No se pudo cargar el módulo.', error));
})();
