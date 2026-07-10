/* =============================================================
   TINTIN — Header por dispositivo (Super Admin → Configuración)
   =============================================================
   Fuente única: settings/general, dos campos booleanos independientes,
   cada uno acotado a SU PROPIO elemento de header y SU PROPIO rango de
   ancho — no hay superposición ni "gana el otro" porque son headers
   físicamente distintos en el HTML y sus rangos nunca se cruzan:

     headerDesktopTabletEnabled (default true) — controla #tt-header-desktop-tablet
       en su rango nativo, >=769px.
     headerMobileEnabled (default true) — controla #tt-header-mobile,
       el header propio de mobile (el que se achica al scrollear — ver
       header-account-mobile-fix.js), en <=768px.

   Ningún JS "reactiva" ni transforma un header en el otro — son dos
   elementos <header> separados en el DOM, cada uno con su propio id.
   Esto sólo prende/apaga cada uno dentro de su rango.

   onSnapshot (no getDoc de una sola vez) para que un cambio guardado desde
   el panel se refleje en cualquier pestaña de la tienda ya abierta, sin
   necesitar recargar. Arranca con el default (= look actual del sitio, sin
   flash para el caso común) y corrige en vivo cada vez que el doc cambia.
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinHeaderModeBooted) return;
  window.TintinHeaderModeBooted = true;

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
    // visibility/pointer-events además de display: un header apagado no
    // puede ni ocupar espacio ni recibir clics.
    st.textContent =
      '@media (min-width:769px){html.tt-desktop-tablet-header-off #tt-header-desktop-tablet{display:none!important;visibility:hidden!important;pointer-events:none!important}}' +
      '@media (max-width:768px){html.tt-mobile-header-off #tt-header-mobile{display:none!important;visibility:hidden!important;pointer-events:none!important}}';
    document.head.appendChild(st);
  }
  injectStyle();

  function apply(mode) {
    window.__ttHeaderMode = mode;
    document.documentElement.classList.toggle('tt-desktop-tablet-header-off', !mode.desktopTablet);
    document.documentElement.classList.toggle('tt-mobile-header-off', !mode.mobile);
    listeners.forEach(function (fn) { try { fn(mode); } catch (e) {} });
  }

  function normalize(data) {
    return {
      desktopTablet: typeof data.headerDesktopTabletEnabled === 'boolean' ? data.headerDesktopTabletEnabled : true,
      mobile: typeof data.headerMobileEnabled === 'boolean' ? data.headerMobileEnabled : true,
    };
  }

  (async function () {
    try {
      var fbMod = await import('./firebase.js');
      var fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
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
