/* =============================================================
   TINTIN — Home Splash Scroll Lock
   =============================================================
   Refuerzo para el splash especial del home (#tt-intro). El home no usa
   js/page-loader.js, por eso este módulo bloquea el scroll mientras existe
   el logo inicial y lo libera cuando desaparece.
   ============================================================= */

(function () {
  'use strict';
  if (window.TintinHomeSplashScrollLockBooted) return;
  window.TintinHomeSplashScrollLockBooted = true;

  var lockCount = 0;
  var savedY = 0;
  var bodyStyle = null;
  var htmlStyle = null;

  function ensureStyle() {
    if (document.getElementById('tt-splash-scroll-lock-style')) return;
    var st = document.createElement('style');
    st.id = 'tt-splash-scroll-lock-style';
    st.textContent = [
      'html.tt-splash-scroll-locked,html.tt-splash-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
      'body.tt-splash-scroll-locked{position:fixed!important;left:0!important;right:0!important;width:100%!important;overflow:hidden!important;overscroll-behavior:none!important}'
    ].join('');
    document.head.appendChild(st);
  }

  function lock() {
    lockCount += 1;
    if (lockCount > 1) return;
    ensureStyle();
    savedY = window.scrollY || document.documentElement.scrollTop || 0;
    htmlStyle = {
      overflow: document.documentElement.style.overflow,
      overscrollBehavior: document.documentElement.style.overscrollBehavior
    };
    bodyStyle = document.body ? {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction
    } : null;

    document.documentElement.classList.add('tt-splash-scroll-locked');
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    if (document.body) {
      document.body.classList.add('tt-splash-scroll-locked');
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + savedY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
  }

  function unlock() {
    if (lockCount > 0) lockCount -= 1;
    if (lockCount > 0) return;

    document.documentElement.classList.remove('tt-splash-scroll-locked');
    document.documentElement.style.overflow = htmlStyle ? htmlStyle.overflow : '';
    document.documentElement.style.overscrollBehavior = htmlStyle ? htmlStyle.overscrollBehavior : '';

    if (document.body) {
      document.body.classList.remove('tt-splash-scroll-locked');
      if (bodyStyle) {
        document.body.style.position = bodyStyle.position;
        document.body.style.top = bodyStyle.top;
        document.body.style.left = bodyStyle.left;
        document.body.style.right = bodyStyle.right;
        document.body.style.width = bodyStyle.width;
        document.body.style.overflow = bodyStyle.overflow;
        document.body.style.touchAction = bodyStyle.touchAction;
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
    window.scrollTo(0, savedY || 0);
  }

  function watchSplash() {
    var splash = document.getElementById('tt-intro');
    if (!splash) return;
    lock();

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      setTimeout(unlock, 680);
      if (observer) observer.disconnect();
    }

    document.addEventListener('tintin:splash:done', finish, { once: true });

    var observer = new MutationObserver(function () {
      var current = document.getElementById('tt-intro');
      if (!current || current.classList.contains('tt-out')) finish();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    setTimeout(finish, 6200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchSplash, { once: true });
  } else {
    watchSplash();
  }
})();
