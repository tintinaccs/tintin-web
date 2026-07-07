/* =============================================================
   TINTIN — Page Loader (marca, no genérico)
   =============================================================
   Loader global para páginas internas. Mientras está activo bloquea el scroll
   real de html/body, incluido el rebote de iOS Safari, y lo restaura al salir.
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinLoader) return;

  var MIN_SHOW_MS = 700;
  var SAFETY_MS = 6000;
  var START = Date.now();
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;
  var scrollLockCount = 0;
  var savedScrollY = 0;
  var previousBodyStyle = null;
  var previousHtmlStyle = null;

  function resolveAsset(path) {
    try {
      if (SCRIPT_SRC) return new URL('../' + path, SCRIPT_SRC).href;
    } catch (e) {}
    return path;
  }

  function injectPaletteCss() {
    if (document.getElementById('tt-tintin-palette-css')) return;
    var link = document.createElement('link');
    link.id = 'tt-tintin-palette-css';
    link.rel = 'stylesheet';
    link.href = resolveAsset('css/tintin-palette.css');
    link.setAttribute('data-tt-palette', 'global');
    (document.head || document.documentElement).appendChild(link);
  }

  injectPaletteCss();

  // Logo real existente en el repo. No usamos images/logo.png porque no existe.
  var LOGO_SRC = resolveAsset('assets-tintin/images/general/logo-splash.webp');

  var CSS = [
    'html.tt-scroll-locked,html.tt-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
    'body.tt-scroll-locked{position:fixed!important;left:0!important;right:0!important;width:100%!important;overflow:hidden!important;overscroll-behavior:none!important}',
    '#tt-loader{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:18px;background:#FFF6FA;',
      'transition:opacity .45s ease,visibility .45s ease;overflow:hidden;overscroll-behavior:none;touch-action:none}',
    '#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}',
    '#tt-loader-logo-wrap{display:flex;align-items:center;justify-content:center;min-height:112px;width:min(76vw,240px)}',
    '#tt-loader-logo{width:clamp(112px,18vw,192px);max-width:76vw;height:auto;object-fit:contain;',
      'display:block;opacity:0;transform:translateY(10px) scale(.96);',
      'filter:drop-shadow(0 8px 22px rgba(212,106,138,.20));user-select:none;pointer-events:none}',
    '#tt-loader-logo.tt-ready{animation:tt-pl-logo-in .55s cubic-bezier(.34,1.56,.64,1) both,tt-pl-logo-float 2.25s ease-in-out .55s infinite}',
    '#tt-loader-line{width:clamp(90px,18vw,150px);height:3px;border-radius:999px;background:rgba(246,183,200,.34);position:relative;overflow:hidden}',
    '#tt-loader-line::after{content:"";position:absolute;top:0;left:-55%;width:55%;height:100%;border-radius:999px;background:linear-gradient(90deg,transparent,#F6B7C8,transparent);animation:tt-pl-sweep 1.25s ease-in-out infinite}',
    '#tt-loader-text{font-family:inherit;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#D46A8A;opacity:0;transform:translateY(6px);transition:opacity .35s ease .15s,transform .35s ease .15s}',
    '#tt-loader-text.tt-ready{opacity:.9;transform:none}',
    '#tt-loader-dots{display:inline-flex;gap:5px;align-items:center;justify-content:center;margin-left:6px;vertical-align:middle}',
    '#tt-loader-dots span{width:6px;height:6px;border-radius:50%;background:#D46A8A;opacity:.28;animation:tt-pl-dots 1s infinite ease-in-out}',
    '#tt-loader-dots span:nth-child(2){animation-delay:.15s}',
    '#tt-loader-dots span:nth-child(3){animation-delay:.3s}',
    '@keyframes tt-pl-logo-in{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes tt-pl-logo-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-7px) scale(1.015)}}',
    '@keyframes tt-pl-sweep{0%{left:-55%}100%{left:110%}}',
    '@keyframes tt-pl-dots{0%,80%,100%{transform:translateY(0);opacity:.28}40%{transform:translateY(-4px);opacity:1}}',
    '@media (max-width:600px){#tt-loader{gap:15px}#tt-loader-logo-wrap{min-height:96px;width:min(82vw,190px)}#tt-loader-logo{width:clamp(102px,34vw,152px)}#tt-loader-line{width:clamp(78px,28vw,120px)}#tt-loader-text{font-size:11px}}',
    '@media (min-width:601px) and (max-width:1120px){#tt-loader-logo{width:clamp(118px,22vw,176px)}}',
    '@media (prefers-reduced-motion:reduce){#tt-loader{transition:opacity .01s linear}#tt-loader-logo.tt-ready{animation:none;opacity:1;transform:none}#tt-loader-line::after{animation:none;left:0;width:100%}#tt-loader-dots span{animation:none;opacity:.8}}'
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
  el.innerHTML =
    '<div id="tt-loader-logo-wrap">' +
      '<img id="tt-loader-logo" src="' + LOGO_SRC + '" alt="Tintin" draggable="false" fetchpriority="high" width="220" height="220">' +
    '</div>' +
    '<div id="tt-loader-line" aria-hidden="true"></div>' +
    '<div id="tt-loader-text">Cargando<span id="tt-loader-dots" aria-hidden="true"><span></span><span></span><span></span></span></div>';

  var logo = el.querySelector('#tt-loader-logo');
  var textEl = el.querySelector('#tt-loader-text');

  logo.addEventListener('error', function () {
    console.warn('[PageLoader] No se pudo cargar el logo del loader:', LOGO_SRC);
    logo.style.display = 'none';
  }, { once: true });

  function insert() {
    if (!document.getElementById('tt-loader') && document.body) {
      lockScroll();
      document.body.insertBefore(el, document.body.firstChild);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var img = document.getElementById('tt-loader-logo');
          if (img && img.style.display !== 'none') img.classList.add('tt-ready');
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

  function importSibling(fileName, label) {
    var url = 'js/' + fileName;
    try {
      if (SCRIPT_SRC) url = new URL(fileName, SCRIPT_SRC).href;
    } catch (e) {}
    return import(url).catch(function (e) {
      console.warn('[PageLoader] No se pudo cargar ' + label + ':', e);
    });
  }

  function bootStoreGate() {
    if (window.TT_DISABLE_STORE_GATE || window.TintinStoreGateBooted) return;
    window.TintinStoreGateBooted = true;
    importSibling('store-gate.js', 'Store Gate');
  }

  function bootHeaderDropdownFix() {
    if (window.TintinHeaderDropdownFixBooted) return;
    importSibling('header-dropdown-fix.js', 'Header Dropdown Fix');
  }

  function bootHeaderScrollHide() {
    if (window.TintinHeaderScrollHideBooted) return;
    importSibling('header-scroll-hide.js', 'Header Scroll Hide');
  }

  function bootAdminAndProfileFixes() {
    var path = (location.pathname || '').toLowerCase();
    if (path.endsWith('/admin.html') || path.endsWith('/admin')) {
      importSibling('admin-order-delete-fix.js', 'Admin Order Delete Fix');
      importSibling('admin-welcome-control.js', 'Admin Welcome Control');
    }
    if (path.endsWith('/perfil.html') || path.endsWith('/perfil')) {
      importSibling('profile-order-stats-fix.js', 'Profile Order Stats Fix');
    }
  }

  function bootScrollReveal() {
    if (window.TintinGlobalScrollRevealBooted) return;
    importSibling('scroll-reveal-global.js', 'Global Scroll Reveal');
  }

  bootStoreGate();
  bootHeaderDropdownFix();
  bootHeaderScrollHide();
  bootAdminAndProfileFixes();
  bootScrollReveal();

  document.addEventListener('tintin:page-ready', ready);

  if (!window.TT_PAGE_LOADER_WAIT) {
    window.addEventListener('load', ready);
  }

  setTimeout(function () { ready(); hideNow(); }, SAFETY_MS);

  window.TintinLoader = { ready: ready, hide: hideNow, show: show, setText: setText, lockScroll: lockScroll, unlockScroll: unlockScroll };
  window.ttPageReady = ready;
})();
