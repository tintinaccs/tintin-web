/* Adaptador de compatibilidad. Source of truth: components/navigation/compartido/enrutador.js */
(() => {
  const scriptUrl = document.currentScript?.src || new URL('js/components/navigation/compatibilidad/navegacion-compartida.js', location.href).href;
  const url = new URL('../compartido/enrutador.js', scriptUrl);
  url.searchParams.set('v', 'tintin-20260804-modular-shell-1');
  import(url.href).catch(error => console.error('[NavigationShared] No se pudo cargar el módulo.', error));
})();
