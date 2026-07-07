(function () {
  'use strict';
  if (window.TintinLoader) return;

  var MIN_SHOW_MS = 520;
  var SAFETY_MS = 4200;
  var START = Date.now();
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;
  var scrollLockCount = 0;
  var savedScrollY = 0;
  var previousBodyStyle = null;
  var previousHtmlStyle = null;

  function resolveAsset(path) {
    try { if (SCRIPT_SRC) return new URL('../' + path, SCRIPT_SRC).href; } catch (e) {}
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

  var LOGO_SRC = resolveAsset('assets-tintin/images/general/logo.png');
  var LOGO_FALLBACK_SRC = resolveAsset('assets-tintin/images/general/logo-tintin.webp');

  var CSS = [
    'html.tt-scroll-locked,html.tt-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
    'body.tt-scroll-locked{position:fixed!important;left:0!important;right:0!important;width:100%!important;overflow:hidden!important;overscroll-behavior:none!important}',
    '#tt-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#FFF6FA;transition:opacity .38s ease,visibility .38s ease;overflow:hidden;overscroll-behavior:none;touch-action:none}',
    '#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}',
    '#tt-loader-logo{width:clamp(126px,18vw,210px);max-width:72vw;height:auto;object-fit:contain;display:block;opacity:0;transform:translateY(8px) scale(.96);filter:drop-shadow(0 8px 22px rgba(212,106,138,.18));user-select:none;pointer-events:none}',
    '#tt-loader-logo.tt-ready{animation:tt-logo-only-in .48s cubic-bezier(.22,.61,.36,1) both}',
    '@keyframes tt-logo-only-in{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@media (max-width:600px){#tt-loader-logo{width:clamp(112px,34vw,160px)}}',
    '@media (min-width:601px) and (max-width:1120px){#tt-loader-logo{width:clamp(122px,22vw,180px)}}',
    '@media (prefers-reduced-motion:reduce){#tt-loader{transition:opacity .01s linear}#tt-loader-logo.tt-ready{animation:none;opacity:1;transform:none}}'
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
    previousBodyStyle = document.body ? {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction
    } : null;
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
  el.innerHTML = '<img id="tt-loader-logo" src="' + LOGO_SRC + '" alt="" draggable="false" fetchpriority="high" width="220" height="220">';

  var logo = el.querySelector('#tt-loader-logo');
  logo.addEventListener('error', function () {
    if (logo.dataset.fallbackDone) { logo.style.display = 'none'; return; }
    logo.dataset.fallbackDone = '1';
    logo.src = LOGO_FALLBACK_SRC;
  });

  function insert() {
    if (!document.getElementById('tt-loader') && document.body) {
      lockScroll();
      document.body.insertBefore(el, document.body.firstChild);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var img = document.getElementById('tt-loader-logo');
          if (img && img.style.display !== 'none') img.classList.add('tt-ready');
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
    setTimeout(unlockScroll, 400);
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

  function show() {
    hidden = false;
    contentReady = false;
    lockScroll();
    el.dataset.state = 'show';
    el.classList.remove('tt-out');
  }

  function setText() {}

  function importSibling(fileName, label) {
    var url = 'js/' + fileName;
    try { if (SCRIPT_SRC) url = new URL(fileName, SCRIPT_SRC).href; } catch (e) {}
    return import(url).catch(function (e) { console.warn('[PageLoader] No se pudo cargar ' + label + ':', e); });
  }

  function bootGlobalQuality() { if (!window.TintinUIQualityBooted) importSibling('ui-quality.js', 'UI Quality'); }
  function bootStoreGate() { if (!window.TT_DISABLE_STORE_GATE && !window.TintinStoreGateBooted) { window.TintinStoreGateBooted = true; importSibling('store-gate.js', 'Store Gate'); } }
  function bootHeaderDropdownFix() { if (!window.TintinHeaderDropdownFixBooted) importSibling('header-dropdown-fix.js', 'Header Dropdown Fix'); }
  function bootHeaderScrollHide() { if (!window.TintinHeaderScrollHideBooted) importSibling('header-scroll-hide.js', 'Header Scroll Hide'); }
  function bootAdminAndProfileFixes() {
    var path = (location.pathname || '').toLowerCase();
    if (path.endsWith('/admin.html') || path.endsWith('/admin')) {
      importSibling('admin-order-delete-fix.js', 'Admin Order Delete Fix');
      importSibling('admin-welcome-control.js', 'Admin Welcome Control');
    }
    if (path.endsWith('/perfil.html') || path.endsWith('/perfil')) importSibling('profile-order-stats-fix.js', 'Profile Order Stats Fix');
  }
  function bootScrollReveal() { if (!window.TintinGlobalScrollRevealBooted) importSibling('scroll-reveal-global.js', 'Global Scroll Reveal'); }

  bootGlobalQuality();
  bootStoreGate();
  bootHeaderDropdownFix();
  bootHeaderScrollHide();
  bootAdminAndProfileFixes();
  bootScrollReveal();

  document.addEventListener('tintin:page-ready', ready);
  if (!window.TT_PAGE_LOADER_WAIT) window.addEventListener('load', ready);
  setTimeout(function () { ready(); hideNow(); }, SAFETY_MS);

  window.TintinLoader = { ready: ready, hide: hideNow, show: show, setText: setText, lockScroll: lockScroll, unlockScroll: unlockScroll };
  window.ttPageReady = ready;
})();
