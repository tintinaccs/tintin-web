/* =============================================================
   TINTIN — Elección de header en mobile (Super Admin)
   =============================================================
   settings/general expone dos flags, leídos una sola vez por carga de
   página (mismo criterio que otros flags no críticos del sitio, ej.
   getStoreAccessConfig en store-gate-core.js):
     mobileShowDesktopHeader (bool, default false) — fuerza el header real
       de desktop/tablet también en mobile (<=768px), en TODAS las páginas
       públicas (excepto checkout, que tiene su propio header dedicado).
     mobileShowMobileHeader  (bool, default true)  — permite el header
       compacto propio de mobile (el que se achica al scrollear, hoy solo
       en home — ver header-account-mobile-fix.js).
   Si ambos están en true, gana el de desktop/tablet: nunca se muestran los
   dos al mismo tiempo. Si ambos están en false, no queda header arriba en
   mobile — la tabbar de abajo no depende de esta config y sigue intacta.
   Arranca asumiendo el default (= comportamiento de siempre, sin flash
   para el caso común) y corrige apenas resuelve la config real si difiere.
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinHeaderModeBooted) return;
  window.TintinHeaderModeBooted = true;

  var DEFAULT_MODE = { mobile: true, desktop: false };
  window.__ttHeaderMode = DEFAULT_MODE;

  function isCheckoutPage() {
    var p = (location.pathname || '').toLowerCase();
    return p.indexOf('checkout') > -1;
  }

  function injectStyle() {
    if (document.getElementById('tt-header-mode-style')) return;
    var st = document.createElement('style');
    st.id = 'tt-header-mode-style';
    // Especificidad reforzada (html + clase + body + #id) a propósito, para
    // ganarle sin ambigüedad tanto a ".tt-header{display:none!important}"
    // (styles.css) como a "body.tt-mobile-home-header #tt-header{...}"
    // (header-account-mobile-fix.js), sin depender del orden de inyección.
    st.textContent = '@media (max-width:768px){html.tt-force-desktop-header body #tt-header{display:block!important;position:fixed!important;top:0!important;left:0!important;right:0!important;transform:none!important}}';
    document.head.appendChild(st);
  }
  injectStyle();

  function applyDesktopForce(desktop) {
    var on = !!desktop && !isCheckoutPage();
    document.documentElement.classList.toggle('tt-force-desktop-header', on);
  }

  window.__ttHeaderModeReady = (async function () {
    try {
      var fbMod = await import('./firebase.js');
      var fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      var snap = await fs.getDoc(fs.doc(fbMod.db, 'settings', 'general'));
      var d = snap.exists() ? snap.data() : {};
      var mode = {
        mobile: d.mobileShowMobileHeader !== false,
        desktop: d.mobileShowDesktopHeader === true
      };
      window.__ttHeaderMode = mode;
      applyDesktopForce(mode.desktop);
      return mode;
    } catch (e) {
      window.__ttHeaderMode = DEFAULT_MODE;
      return DEFAULT_MODE;
    }
  })();
})();
