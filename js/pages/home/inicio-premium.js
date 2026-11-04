(function () {
  'use strict';
  if (window.TintinHomePremiumBooted) return;
  window.TintinHomePremiumBooted = true;
  function boot() {
    const hero = document.querySelector('#hero[data-tt-banner="editorial-20261104"]');
    if (!hero) return;
    document.body.classList.add('tt-home-premium');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const pieces = [...hero.querySelectorAll('.tt-hero-piece')];
    const pause = hero.querySelector('.tt-hero-pause');
    const angles = [-15, 9, 10, -9];
    let paused = false, visible = true, frame = 0, entered = false, assetsReady = false;
    const animations = new Set();
    const stopped = () => paused || preference.matches;
    function update() {
      frame = 0;
      hero.dataset.heroMoving = String(visible && !document.hidden && !stopped());
      hero.dataset.heroPaused = String(stopped());
      if (!visible || document.hidden) return;
      // One layout read, then transform writes only. No permanent scroll loop.
      const box = hero.getBoundingClientRect();
      const progress = stopped() ? 0 : Math.max(0, Math.min(1, -box.top / box.height));
      const distance = innerWidth < 768 ? 8 : 24;
      pieces.forEach((piece, index) => {
        piece.style.transform = `translateY(${-progress * distance * (index % 2 ? .65 : 1)}px) rotate(${angles[index] + progress * (index % 2 ? 1 : -1)}deg)`;
      });
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    function finishMotion() { animations.forEach(animation => animation.cancel()); animations.clear(); }
    function enter() {
      if (!assetsReady || entered || stopped() || document.hidden || !visible) return;
      entered = true;
      const curve = getComputedStyle(hero).getPropertyValue('--mo-enter').trim() || 'cubic-bezier(.23,1,.32,1)';
      [...pieces.map(piece => piece.querySelector('img')), hero.querySelector('.tt-hero-brand')].filter(Boolean).forEach((element, index) => {
        if (typeof element.animate !== 'function') return;
        const animation = element.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: index * 45, easing: curve, fill: 'backwards' });
        animations.add(animation);
        animation.finished.then(() => { animation.cancel(); animations.delete(animation); }).catch(() => {});
      });
    }
    pause.hidden = preference.matches;
    pause.addEventListener('click', () => {
      paused = !paused;
      pause.setAttribute('aria-pressed', String(paused));
      pause.setAttribute('aria-label', paused ? 'Reanudar movimiento del banner' : 'Pausar movimiento del banner');
      pause.querySelector('span').textContent = paused ? 'Reanudar' : 'Pausar';
      finishMotion(); schedule();
    });
    preference.addEventListener('change', () => { pause.hidden = preference.matches; finishMotion(); schedule(); });
    addEventListener('scroll', () => { if (visible && !document.hidden) schedule(); }, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finishMotion(); schedule(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) finishMotion();
      else enter();
      schedule();
    }).observe(hero);
    // The HTML remains fully visible if a cutout fails or JavaScript is absent.
    const images = [...hero.querySelectorAll('.tt-hero-piece img,.tt-hero-brand')];
    const ready = Promise.all(images.map(image => typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve()));
    const loaderReady = import('../../quality/espera-cargador.js?v=tintin-20260716-cloudinary-fix-1').then(module => module.waitForLoaderHidden()).catch(() => {});
    Promise.all([loaderReady, Promise.race([ready, new Promise(resolve => setTimeout(resolve, 1500))])]).then(() => { assetsReady = true; enter(); });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
