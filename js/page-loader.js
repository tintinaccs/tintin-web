/* =============================================================
   TINTIN — Page Loader (marca, no genérico)
   =============================================================
   Loader global para páginas internas. Mientras está activo bloquea el scroll
   real de html/body, incluido el rebote de iOS Safari, y lo restaura al salir.
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinLoader) return;

  var LOGO_SRC = 'assets-tintin/images/general/logo-splash.webp';
  var MIN_SHOW_MS = 700;
  var SAFETY_MS = 6000;
  var START = Date.now();
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;
  var scrollLockCount = 0;
  var savedScrollY = 0;
  var previousBodyStyle = null;
  var previousHtmlStyle = null;

  var CSS = [
    'html.tt-scroll-locked,html.tt-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
    'body.tt-scroll-locked{position:fixed!important;left:0!important;right:0!important;width:100%!important;overflow:hidden!important;overscroll-behavior:none!important}',
    '#tt-loader{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:16px;background:#ffb6c8;',
      'transition:opacity .45s ease,visibility .45s ease;overflow:hidden;overscroll-behavior:none;touch-action:none}',
    '#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}',
    '#tt-loader-logo{width:clamp(96px,18vw,180px);max-width:80vw;height:auto;object-fit:contain;',
      'display:block;opacity:0;transform:scale(.8) translateY(10px);',
      'filter:drop-shadow(0 4px 14px rgba(139,38,66,.28));user-select:none;pointer-events:none}',
    '#tt-loader-logo.tt-ready{animation:tt-pl-enter .5s cubic-bezier(.34,1.56,.64,1) both,tt-pl-breathe 1.9s ease-in-out .5s infinite}',
    '#tt-loader-fallback{font-family:inherit;font-size:clamp(22px,5vw,32px);font-weight:900;letter-spacing:.2em;color:#8b2642;opacity:0;transform:scale(.9);text-align:center}',
    '#tt-loader-fallback.tt-ready{animation:tt-pl-enter .5s cubic-bezier(.34,1.56,.64,1) both}',
    '@keyframes tt-pl-enter{from{opacity:0;transform:scale(.8) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}',
    '@keyframes tt-pl-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}',
    '#tt-loader-line{width:clamp(90px,20vw,160px);height:2px;border-radius:999px;background:rgba(139,38,66,.16);position:relative;overflow:hidden}',
    '#tt-loader-line::after{content:"";position:absolute;top:0;left:-65%;width:65%;height:100%;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(139,38,66,.65),transparent);animation:tt-pl-sweep 1.3s ease-in-out infinite}',
    '@keyframes tt-pl-sweep{0%{left:-65%}100%{left:110%}}',
    '#tt-loader-text{font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8b2642;opacity:0;transition:opacity .4s ease .15s}',
    '#tt-loader-text.tt-ready{opacity:.85}',
    '@media (max-width:600px){#tt-loader-logo{width:clamp(84px,32vw,140px)}#tt-loader-line{width:clamp(80px,34vw,130px)}}',
    '@media (prefers-reduced-motion:reduce){#tt-loader{transition:opacity .01s linear}#tt-loader-logo.tt-ready,#tt-loader-fallback.tt-ready{animation:none;opacity:1;transform:none}#tt-loader-line::after{animation:none;left:0;width:100%}}'
  ].join('');

  if (!document.getElementById('tt-loader-style')) {
    var st = document.createElement('style');
    st.id = 'tt-loader-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function lockScroll() {
    scrollLockCount += 1;
    if (scrollLockCount > 1) return;
    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    previousBodyStyle = {
      position: document.body ? document.body.style.position : '',
      top: document.body ? document.body.style.top : '',
      left: document.body ? document.body.style.left : '',
      right: document.body ? document.body.style.right : '',
      width: document.body ? document.body.style.width : '',
      overflow: document.body ? document.body.style.overflow : '',
      touchAction: document.body ? document.body.style.touchAction : ''
    };
    previousHtmlStyle = {
      overflow: document.documentElement.style.overflow,
      overscrollBehavior: document.documentElement.style.overscrollBehavior
    };
    document.documentElement.classList.add('tt-scroll-locked');
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    if (document.body) {
      document.body.classList.add('tt-scroll-locked');
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + savedScrollY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
  }

  function unlockScroll() {
    if (scrollLockCount > 0) scrollLockCount -= 1;
    if (scrollLockCount > 0) return;
    document.documentElement.classList.remove('tt-scroll-locked');
    document.documentElement.style.overflow = previousHtmlStyle ? previousHtmlStyle.overflow : '';
    document.documentElement.style.overscrollBehavior = previousHtmlStyle ? previousHtmlStyle.overscrollBehavior : '';
    if (document.body) {
      document.body.classList.remove('tt-scroll-locked');
      if (previousBodyStyle) {
        document.body.style.position = previousBodyStyle.position;
        document.body.style.top = previousBodyStyle.top;
        document.body.style.left = previousBodyStyle.left;
        document.body.style.right = previousBodyStyle.right;
        document.body.style.width = previousBodyStyle.width;
        document.body.style.overflow = previousBodyStyle.overflow;
        document.body.style.touchAction = previousBodyStyle.touchAction;
      } else {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      }
    }
    window.scrollTo(0, savedScrollY || 0);
  }

  window.TintinScrollLock = { lock: lockScroll, unlock: unlockScroll };

  var el = document.createElement('div');
  el.id = 'tt-loader';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('role', 'presentation');
  el.dataset.state = 'show';
  el.innerHTML = '<img id="tt-loader-logo" src="' + LOGO_SRC + '" alt="" draggable="false" fetchpriority="high" width="200" height="200"><div id="tt-loader-line" aria-hidden="true"></div><span id="tt-loader-text">Cargando…</span>';

  var logo = el.querySelector('#tt-loader-logo');
  var textEl = el.querySelector('#tt-loader-text');

  logo.addEventListener('error', function () {
    var span = document.createElement('span');
    span.id = 'tt-loader-fallback';
    span.textContent = 'TINTIN';
    logo.replaceWith(span);
    requestAnimationFrame(function () { requestAnimationFrame(function () { span.classList.add('tt-ready'); }); });
  }, { once: true });

  function insert() {
    if (!document.getElementById('tt-loader') && document.body) {
      lockScroll();
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

  function hideNow() {
    if (hidden) return;
    hidden = true;
    el.dataset.state = 'out';
    el.classList.add('tt-out');
    setTimeout(unlockScroll, 460);
  }

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

  function show(text) {
    hidden = false;
    contentReady = false;
    lockScroll();
    el.dataset.state = 'show';
    el.classList.remove('tt-out');
    if (text) setText(text);
  }

  function setText(text) {
    if (textEl) textEl.textContent = text;
  }

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

  if (!window.TT_PAGE_LOADER_WAIT) {
    window.addEventListener('load', ready);
  }

  setTimeout(function () { ready(); hideNow(); }, SAFETY_MS);

  window.TintinLoader = { ready: ready, hide: hideNow, show: show, setText: setText, lockScroll: lockScroll, unlockScroll: unlockScroll };
  window.ttPageReady = ready;
})();
