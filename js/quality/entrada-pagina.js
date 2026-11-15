(function () {
  'use strict';

  if (window.TintinPageEntryBooted) return;
  window.TintinPageEntryBooted = true;

  const path = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
  const page = path.split('/').filter(Boolean).pop()?.replace(/\.html$/, '') || '';
  const isHome = !page || page === 'index';
  const EXCLUDED = /^(?:admin|admin-images|checkout|login|perfil)$/;
  if (EXCLUDED.test(page)) return;

  const motionPref = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (motionPref?.matches === true) return;

  const EASING = 'cubic-bezier(.16,1,.3,1)';
  const active = new Set();

  function track(anim) {
    if (!anim) return;
    active.add(anim);
    anim.finished.then(() => active.delete(anim)).catch(() => active.delete(anim));
  }

  function animate() {
    const main = document.querySelector('main');
    if (!main || typeof main.animate !== 'function') return;

    // Whole-page rise + fade
    track(main.animate(
      [{ opacity: 0, transform: 'translateY(10px) scale(.985)' },
       { opacity: 1, transform: 'translateY(0) scale(1)' }],
      { duration: 440, easing: EASING, fill: 'backwards' }
    ));

    // Stagger the first visible sections inside main
    // Skip home hero (inicio-premium.js owns that entrance)
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    let count = 0;
    for (const el of main.children) {
      if (count >= 4) break;
      if (el.closest('[hidden]') || el.classList.contains('tt-no-reveal') || el.dataset.ttNoReveal) continue;
      if (isHome && (el.classList.contains('tt-hero') || el.hasAttribute('data-tt-banner'))) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= vh || r.height < 4) continue;
      if (typeof el.animate !== 'function') { count++; continue; }
      track(el.animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 480, delay: 30 + count * 65, easing: EASING, fill: 'backwards' }
      ));
      count++;
    }
  }

  let done = false;
  function tryAnimate() {
    if (done) return;
    done = true;
    animate();
  }

  const timer = setTimeout(tryAnimate, 4500);

  import('./espera-cargador.js?v=tintin-20260716-cloudinary-fix-1')
    .then(mod => mod.waitForLoaderHidden())
    .then(() => { clearTimeout(timer); tryAnimate(); })
    .catch(() => { clearTimeout(timer); tryAnimate(); });

  motionPref?.addEventListener('change', e => {
    if (e.matches) active.forEach(a => { try { a.cancel(); } catch {} });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) active.forEach(a => { try { a.cancel(); } catch {} });
  }, { passive: true });
})();
