/* One entrance per document, after the shared loader. HTML is visible by
   default; cancelling or failing motion always restores the final frame. */
(function () {
  'use strict';
  if (window.TintinHomePremiumBooted) return;
  window.TintinHomePremiumBooted = true;
  function boot() {
    const hero = document.querySelector('#hero[data-tt-banner="suitcase-20261104"]');
    if (!hero) return;
    document.body.classList.add('tt-home-premium');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set();
    let entered = false, ready = false, visible = true;
    const finish = () => { animations.forEach(animation => animation.cancel()); animations.clear(); };
    const items = [
      ['.tt-hero-symbol', 650, 0, 12, .97],
      ['.tt-hero-wordmark', 650, 90, 14, 1],
      ['.tt-hero-title', 750, 180, 16, 1],
      ['.tt-hero-subtitle', 600, 270, 12, 1],
      ['.tt-hero-cta', 550, 350, 10, 1],
      ['.tt-hero-link', 550, 420, 10, 1],
      ['.tt-hero-suitcase', 1000, 100, 20, .96],
    ];
    function enter() {
      if (entered || !ready || !visible || document.hidden) return;
      entered = true;
      if (preference.matches) return;
      items.forEach(([selector, duration, delay, offset, scale]) => {
        const element = hero.querySelector(selector);
        if (!element || typeof element.animate !== 'function') return;
        const animation = element.animate([
          { opacity: 0, transform: `translateY(${offset}px) scale(${scale})` },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        animations.add(animation);
        animation.finished.then(() => { animation.cancel(); animations.delete(animation); }).catch(() => animations.delete(animation));
      });
    }
    preference.addEventListener('change', () => { if (preference.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); else enter(); });
    addEventListener('pagehide', finish);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) finish(); else enter();
    }).observe(hero);
    const art = hero.querySelector('.tt-hero-suitcase img');
    const decoded = art?.decode?.().catch(() => {});
    const loader = import('../../quality/espera-cargador.js?v=tintin-20260716-cloudinary-fix-1').then(module => module.waitForLoaderHidden()).catch(() => {});
    Promise.all([loader, Promise.race([decoded, new Promise(resolve => setTimeout(resolve, 1500))])]).then(() => { ready = true; enter(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
