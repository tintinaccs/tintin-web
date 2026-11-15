/* One entrance per document. The head bootstrap protects the first paint;
   the deferred controller reveals the photograph only after download/decode. */
(function () {
  'use strict';
  if (window.TintinHomePremiumBooted) return;
  window.TintinHomePremiumBooted = true;
  const root = document.documentElement;
  const pending = ['tt-home-reveal-pending', 'tt-home-art-pending'];
  const prepared = root.hasAttribute('data-tt-home-reveal');
  if (!prepared) root.classList.add(...pending);

  function waitForArt(image) {
    return new Promise(resolve => {
      if (!image) { resolve(false); return; }
      let settled = false, attempt = 0;
      const finish = success => {
        if (settled) return;
        settled = true;
        image.removeEventListener('load', check);
        image.removeEventListener('error', failed);
        resolve(success);
      };
      async function check() {
        const currentAttempt = ++attempt;
        if (settled || !image.complete) return;
        if (!image.naturalWidth) { finish(false); return; }
        const source = image.currentSrc || image.src;
        try { if (typeof image.decode === 'function') await image.decode(); }
        catch {
          if (currentAttempt !== attempt || settled) return;
          if (source !== (image.currentSrc || image.src) || !image.complete) { check(); return; }
          finish(false);
          return;
        }
        if (currentAttempt !== attempt || settled) return;
        if (source !== (image.currentSrc || image.src) || !image.complete) { check(); return; }
        finish(image.naturalWidth > 0);
      }
      function failed() {
        if (image.complete && !image.naturalWidth) finish(false);
        else check();
      }
      image.addEventListener('load', check);
      image.addEventListener('error', failed);
      check();
    });
  }

  function boot() {
    const hero = document.querySelector('#hero[data-tt-banner="suitcase-20261104"]');
    if (!hero) { root.classList.remove(...pending); return; }
    document.body.classList.add('tt-home-premium');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set();
    let entered = prepared && !root.classList.contains('tt-home-reveal-pending');
    let artEntered = false, ready = false, artReady = false, visible = true;
    const finish = () => { animations.forEach(animation => animation.cancel()); animations.clear(); };
    const items = [
      ['.tt-hero-symbol', 650, 0, 12, .97],
      ['.tt-hero-wordmark', 650, 90, 14, 1],
      ['.tt-hero-title', 750, 180, 16, 1],
      ['.tt-hero-subtitle', 600, 270, 12, 1],
      ['.tt-hero-cta', 550, 350, 10, 1],
      ['.tt-hero-link', 550, 420, 10, 1],
    ];
    function animate([selector, duration, delay, offset, scale]) {
      const element = hero.querySelector(selector);
      if (!element || preference.matches || typeof element.animate !== 'function') return;
      try {
        const animation = element.animate([
          { opacity: 0, transform: `translateY(${offset}px) scale(${scale})` },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        animations.add(animation);
        animation.finished.then(() => { animation.cancel(); animations.delete(animation); }).catch(() => animations.delete(animation));
      } catch { /* Unsupported motion leaves the final, readable frame. */ }
    }
    function enter() {
      if (!ready || !visible || document.hidden) return;
      if (!entered) {
        entered = true;
        items.forEach(animate);
        root.classList.remove('tt-home-reveal-pending');
      }
      if (artReady && !artEntered) {
        artEntered = true;
        animate(['.tt-hero-suitcase', 1000, 100, 20, .96]);
        root.classList.remove('tt-home-art-pending');
      }
    }
    preference.addEventListener('change', () => { if (preference.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); else enter(); });
    addEventListener('pagehide', finish);
    addEventListener('pageshow', enter);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) finish(); else enter();
    }).observe(hero);
    const art = hero.querySelector('.tt-hero-suitcase');
    const artwork = waitForArt(art?.querySelector('img')).then(success => {
      artReady = success;
      if (!success) {
        art?.setAttribute('data-tt-image-error', '');
        art?.setAttribute('aria-hidden', 'true');
        root.classList.remove('tt-home-art-pending');
      }
      enter();
    });
    const loader = import('../../quality/espera-cargador.js?v=tintin-20260716-cloudinary-fix-1').then(module => module.waitForLoaderHidden()).catch(() => {});
    // Keep navigation and copy usable on a slow/broken image request. This
    // deadline releases only the copy; the photograph always waits for decode.
    let timer;
    const copyDeadline = new Promise(resolve => { timer = setTimeout(resolve, 1500); });
    artwork.then(() => clearTimeout(timer));
    Promise.all([loader, Promise.race([artwork, copyDeadline])]).then(() => { ready = true; enter(); });
  }
  function start() {
    try { boot(); }
    catch { root.classList.remove(...pending); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
