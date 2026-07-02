/* ============================================================
   TINTIN — Scroll Reveal (standalone, all pages)
   Suave, liviano, sin dependencias.
   ============================================================ */

(function () {
  if (!('IntersectionObserver' in window)) return;

  // Inject CSS only once
  if (!document.getElementById('tt-sr-style')) {
    const s = document.createElement('style');
    s.id = 'tt-sr-style';
    s.textContent = [
      '.sr{opacity:0;transform:translateY(22px);transition:opacity .55s ease,transform .55s ease}',
      '.sr.sr-in{opacity:1;transform:none}',
      '.sr-delay-1{transition-delay:.08s}',
      '.sr-delay-2{transition-delay:.16s}',
      '.sr-delay-3{transition-delay:.24s}',
      '.sr-delay-4{transition-delay:.32s}',
      '.sr-delay-5{transition-delay:.40s}',
    ].join('');
    document.head.appendChild(s);
  }

  const SELECTORS = [
    // Informational pages
    '.tt-info-block',
    '.tt-faq-item',
    '.tt-about-img',
    '.tt-about-content',
    '.tt-about-text',
    '.tt-contact-grid',
    // Section headings (all pages)
    '.tt-section-title',
    '.tt-section-sub',
    '.tt-page-hero-title',
    '.tt-page-hero-sub',
    // Editorial / hero sections
    '.tt-editorial-item',
    '.tt-editorial-card',
    // Checkout
    '.ck-panel-head',
    '.tt-checkout-suggested-grid',
    // Nosotros
    '.tt-about-section',
    // Trust bar heading (about)
    '.tt-trust-bar .tt-section-title',
    // Perfil (cuenta de usuario)
    '.perfil-card',
  ].join(',');

  function observe() {
    const els = document.querySelectorAll(SELECTORS);
    if (!els.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('sr-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    els.forEach((el, i) => {
      if (el.classList.contains('sr-in')) return; // already visible
      el.classList.add('sr');
      // Stagger siblings: assign delay classes to children of same parent
      const siblings = Array.from(el.parentElement.children).filter(c => c.classList.contains(el.classList[0]));
      const idx = siblings.indexOf(el);
      if (idx > 0 && idx <= 5) el.classList.add(`sr-delay-${idx}`);
      io.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }
})();
