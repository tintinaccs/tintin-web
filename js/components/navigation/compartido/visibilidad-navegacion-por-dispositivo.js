/* =============================================================
   TINTIN — Navegación por dispositivo (Super Admin → Configuración)
   =============================================================
   Fuente única: settings/general, dos campos booleanos independientes,
   cada uno acotado a SU PROPIO elemento de navegación y SU PROPIO rango de
   ancho — no hay superposición ni "gana el otro" porque son elementos
   físicamente distintos en el HTML y sus rangos nunca se cruzan:

     headerDesktopTabletEnabled (default true) — controla los headers
       superiores físicamente separados de desktop y tablet, en >=768px.
     headerMobileEnabled (default true) — controla .tt-tabbar, la barra de
       navegación inferior y la cabecera compacta de mobile, en <=767px.
       Se conserva el nombre del campo por compatibilidad con datos guardados.

   En mobile conviven la cabecera blanca y la tabbar inferior por pedido del
   propietario. En tablet y desktop se muestra únicamente la cabecera superior.

   onSnapshot (no getDoc de una sola vez) para que un cambio guardado desde
   el panel se refleje en cualquier pestaña de la tienda ya abierta, sin
   necesitar recargar. Arranca con el default (= look actual del sitio, sin
   flash para el caso común) y corrige en vivo cada vez que el doc cambia.
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinHeaderModeBooted) return;
  window.TintinHeaderModeBooted = true;

  var IS_VISUAL_PREVIEW_FRAME = new URLSearchParams(window.location.search).get('ttVisualPreview') === '1'
    && window.parent !== window;
  var DEFAULT_MODE = { desktopTablet: true, mobile: true };
  window.__ttHeaderMode = DEFAULT_MODE;

  var resolveReady;
  window.__ttHeaderModeReady = new Promise(function (resolve) { resolveReady = resolve; });
  var readyResolved = false;
  function markReady(mode) {
    if (!readyResolved) { readyResolved = true; resolveReady(mode); }
  }

  var listeners = [];
  window.__ttOnHeaderModeChange = function (fn) {
    listeners.push(fn);
    return function unsubscribe() { listeners = listeners.filter(function (f) { return f !== fn; }); };
  };

  function injectStyle() {
    if (document.getElementById('tt-header-mode-style')) return;
    var st = document.createElement('style');
    st.id = 'tt-header-mode-style';
    // #id + clase en <html> le gana en especificidad a las reglas base de
    // styles.css sin importar el orden de inyección de cada hoja.
    // visibility/pointer-events además de display: un elemento apagado no
    // puede ni ocupar espacio ni recibir clics.
    st.textContent =
      '@media (min-width:768px){html.tt-desktop-tablet-header-off #tt-header-desktop-tablet,html.tt-desktop-tablet-header-off #tt-header-tablet{display:none!important;visibility:hidden!important;pointer-events:none!important}}' +
      '@media (max-width:767px){html.tt-mobile-navigation-off .tt-tabbar,html.tt-mobile-navigation-off #tt-header-tablet{display:none!important;visibility:hidden!important;pointer-events:none!important}}';
    document.head.appendChild(st);
  }
  injectStyle();

  function apply(mode) {
    window.__ttHeaderMode = mode;
    document.documentElement.classList.toggle('tt-desktop-tablet-header-off', !mode.desktopTablet);
    document.documentElement.classList.toggle('tt-mobile-navigation-off', !mode.mobile);
    listeners.forEach(function (fn) { try { fn(mode); } catch (e) {} });
  }

  function normalize(data) {
    return {
      desktopTablet: typeof data.headerDesktopTabletEnabled === 'boolean' ? data.headerDesktopTabletEnabled : true,
      mobile: typeof data.headerMobileEnabled === 'boolean' ? data.headerMobileEnabled : true,
    };
  }

  (async function () {
    // La preview del Visual Builder es únicamente visual. No debe abrir un
    // canal Firestore Listen propio: el panel padre ya administra el estado
    // real y esos listeners extra pueden provocar reconexiones/400 WebChannel.
    if (IS_VISUAL_PREVIEW_FRAME) {
      apply(DEFAULT_MODE);
      markReady(DEFAULT_MODE);
      return;
    }
    try {
      var fbMod = await import('../../../core/firebase/firebase.js?v=tintin-20261012-auth-privacy-1-firebase-js-domain-prepared-20261012-6-pedidos-styles-20261013-1-security-ready-20261013-2');
      var fs = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
      fs.onSnapshot(fs.doc(fbMod.db, 'settings', 'general'), function (snap) {
        var mode = normalize(snap.exists() ? snap.data() : {});
        apply(mode);
        markReady(mode);
      }, function () {
        apply(DEFAULT_MODE);
        markReady(DEFAULT_MODE);
      });
    } catch (e) {
      apply(DEFAULT_MODE);
      markReady(DEFAULT_MODE);
    }
  })();
})();
