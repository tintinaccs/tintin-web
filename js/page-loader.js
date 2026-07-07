/* =============================================================
   TINTIN — Page Loader (marca, no genérico)
   =============================================================
   Un solo sistema para TODAS las páginas menos index.html (que tiene
   su propio splash de marca más elaborado, inline en el HTML).
   Carga como script bloqueante (no defer) en <head>, así el overlay
   pinta antes que cualquier otro contenido — evita parpadeos.

   Estados: show -> ready -> out (el nodo queda oculto con
   visibility:hidden + pointer-events:none, nunca bloquea clicks;
   no se elimina del DOM para poder reusarlo con show()/setText()
   en páginas que lo necesitan, como login.html durante el popup
   de Google).

   Cómo espera "contenido real":
   - Por defecto, si la página no avisa nada, se oculta en window.load
     (alcanza para páginas simples/informativas sin datos de Firestore).
   - Si la página pone `window.TT_PAGE_LOADER_WAIT = true` ANTES de este
     script, se ignora window.load y se espera exclusivamente a que la
     página dispare la señal de "listo" — así nunca desaparece antes de
     tiempo en catálogo/producto/checkout/login/perfil/admin.
   - Señal de "listo": disparar el evento
     `document.dispatchEvent(new CustomEvent('tintin:page-ready'))`
     o, más simple, llamar a `window.TintinLoader.ready()`.
   - Tope de seguridad (SAFETY_MS): pase lo que pase, se oculta solo,
     nunca queda infinito.
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinLoader) return; // ya inicializado (doble include, etc.)

  var LOGO_SRC   = 'assets-tintin/images/general/logo-splash.webp';
  var MIN_SHOW_MS = 700;   // duración mínima elegante — más larga que la animación de
                           // entrada (.5s) para que el logo llegue a asentarse antes de
                           // empezar a desvanecerse; evita el parpadeo de un loader de 20ms
  var SAFETY_MS   = 6000;  // tope máximo — nunca queda cargando infinito
  var START = Date.now();
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;

  var CSS = [
    '#tt-loader{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:16px;background:#ffb6c8;',
      'transition:opacity .45s ease,visibility .45s ease;overflow:hidden}',
    '#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}',
    '#tt-loader-logo{width:clamp(96px,18vw,180px);max-width:80vw;height:auto;object-fit:contain;',
      'display:block;opacity:0;transform:scale(.8) translateY(10px);',
      'filter:drop-shadow(0 4px 14px rgba(139,38,66,.28));user-select:none;pointer-events:none}',
    '#tt-loader-logo.tt-ready{animation:tt-pl-enter .5s cubic-bezier(.34,1.56,.64,1) both,',
      'tt-pl-breathe 1.9s ease-in-out .5s infinite}',
    '#tt-loader-fallback{font-family:inherit;font-size:clamp(22px,5vw,32px);font-weight:900;',
      'letter-spacing:.2em;color:#8b2642;opacity:0;transform:scale(.9);text-align:center}',
    '#tt-loader-fallback.tt-ready{animation:tt-pl-enter .5s cubic-bezier(.34,1.56,.64,1) both}',
    '@keyframes tt-pl-enter{from{opacity:0;transform:scale(.8) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}',
    '@keyframes tt-pl-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}',
    '#tt-loader-line{width:clamp(90px,20vw,160px);height:2px;border-radius:999px;',
      'background:rgba(139,38,66,.16);position:relative;overflow:hidden}',
    '#tt-loader-line::after{content:"";position:absolute;top:0;left:-65%;width:65%;height:100%;',
      'border-radius:999px;background:linear-gradient(90deg,transparent,rgba(139,38,66,.65),transparent);',
      'animation:tt-pl-sweep 1.3s ease-in-out infinite}',
    '@keyframes tt-pl-sweep{0%{left:-65%}100%{left:110%}}',
    '#tt-loader-text{font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.14em;',
      'text-transform:uppercase;color:#8b2642;opacity:0;transition:opacity .4s ease .15s}',
    '#tt-loader-text.tt-ready{opacity:.85}',
    '@media (max-width:600px){#tt-loader-logo{width:clamp(84px,32vw,140px)}',
      '#tt-loader-line{width:clamp(80px,34vw,130px)}}',
    '@media (prefers-reduced-motion:reduce){',
      '#tt-loader{transition:opacity .01s linear}',
      '#tt-loader-logo.tt-ready,#tt-loader-fallback.tt-ready{animation:none;opacity:1;transform:none}',
      '#tt-loader-line::after{animation:none;left:0;width:100%}}'
  ].join('');

  if (!document.getElementById('tt-loader-style')) {
    var st = document.createElement('style');
    st.id = 'tt-loader-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var el = document.createElement('div');
  el.id = 'tt-loader';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('role', 'presentation');
  el.dataset.state = 'show';
  el.innerHTML =
    '<img id="tt-loader-logo" src="' + LOGO_SRC + '" alt="" draggable="false" fetchpriority="high" width="200" height="200">' +
    '<div id="tt-loader-line" aria-hidden="true"></div>' +
    '<span id="tt-loader-text">Cargando…</span>';

  var logo = el.querySelector('#tt-loader-logo');
  var textEl = el.querySelector('#tt-loader-text');

  // Nunca imagen rota: si el logo no carga, texto de marca en su lugar.
  logo.addEventListener('error', function () {
    var span = document.createElement('span');
    span.id = 'tt-loader-fallback';
    span.textContent = 'TINTIN';
    logo.replaceWith(span);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { span.classList.add('tt-ready'); });
    });
  }, { once: true });

  function insert() {
    if (!document.getElementById('tt-loader') && document.body) {
      document.body.insertBefore(el, document.body.firstChild);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var img = document.getElementById('tt-loader-logo');
          if (img) img.classList.add('tt-ready');
          if (textEl) textEl.classList.add('tt-ready');
        });
      });
    }
  }
  if (document.body) insert();
  else document.addEventListener('DOMContentLoaded', insert);

  var hidden = false;
  var contentReady = false;

  // Salida inmediata (sin esperar el mínimo elegante) — para usos
  // interactivos como cerrar el loader tras un error/cancelación.
  function hideNow() {
    if (hidden) return;
    hidden = true;
    el.dataset.state = 'out';
    el.classList.add('tt-out');
  }

  // Salida "de página lista" — respeta la duración mínima elegante para
  // que un loader de 20ms no parpadee, pero nunca la alarga de más.
  function tryHideElegant() {
    if (hidden) return;
    el.dataset.state = 'ready';
    var wait = Math.max(0, MIN_SHOW_MS - (Date.now() - START));
    setTimeout(hideNow, wait);
  }

  function ready() {
    if (contentReady) return;
    contentReady = true;
    tryHideElegant();
  }

  // Reaparecer (login.html reusa el mismo loader durante el popup de
  // Google) — vuelve a mostrarlo sin duplicar ni recrear nada.
  function show(text) {
    hidden = false;
    contentReady = false;
    el.dataset.state = 'show';
    el.classList.remove('tt-out');
    if (text) setText(text);
  }

  function setText(text) {
    if (textEl) textEl.textContent = text;
  }

  // Gate global de tienda cerrada. Corre aparte del loader: si falla por red o
  // Firebase, no bloquea la navegación; si settings/general.storeOpen === false,
  // js/store-gate.js tapa la web pública completa para visitantes/no Super Admin.
  function bootStoreGate() {
    if (window.TT_DISABLE_STORE_GATE || window.TintinStoreGateBooted) return;
    window.TintinStoreGateBooted = true;
    var gateUrl = 'js/store-gate.js';
    try {
      if (SCRIPT_SRC) gateUrl = new URL('store-gate.js', SCRIPT_SRC).href;
    } catch (e) {}
    import(gateUrl).catch(function (e) {
      console.warn('[PageLoader] No se pudo cargar Store Gate:', e);
    });
  }
  bootStoreGate();

  document.addEventListener('tintin:page-ready', ready);

  // Páginas simples (sin datos de Firestore que esperar) se ocultan solas
  // en window.load. Páginas con datos reales ponen
  // `window.TT_PAGE_LOADER_WAIT = true` antes de este script y llaman a
  // ready()/dispatch del evento cuando su contenido real está listo.
  if (!window.TT_PAGE_LOADER_WAIT) {
    window.addEventListener('load', ready);
  }

  // Tope de seguridad absoluto: pase lo que pase, nunca queda infinito.
  setTimeout(function () { ready(); hideNow(); }, SAFETY_MS);

  window.TintinLoader = { ready: ready, hide: hideNow, show: show, setText: setText };
  // Atajo global, tal como lo puede usar cualquier script de página:
  // window.ttPageReady()
  window.ttPageReady = ready;
})();
