(function () {
  'use strict';

  if (window.TintinHomePremiumBooted) return;
  window.TintinHomePremiumBooted = true;

  var path = (location.pathname || '').toLowerCase();
  if (!(path.endsWith('/') || path.endsWith('/index.html') || path === '')) return;

  var FINAL_HERO_CSS_ID = 'tt-home-hero-final-css';
  var FINAL_HERO_CSS = 'css/pages/home/hero-final-tintin.css';

  function ensureFinalHeroStyles() {
    if (document.getElementById(FINAL_HERO_CSS_ID)) return;
    var link = document.createElement('link');
    link.id = FINAL_HERO_CSS_ID;
    link.rel = 'stylesheet';
    link.href = FINAL_HERO_CSS;
    document.head.appendChild(link);
  }

  function addDoodles(hero) {
    var doodles = [
      ['obsessed', 'obsesionada ↘'],
      ['happy', 'un relojito y soy feliz'],
      ['heart-one', '♡'],
      ['heart-two', '♡'],
      ['heart-three', '♡']
    ];

    doodles.forEach(function (item) {
      var name = item[0];
      var text = item[1];
      if (hero.querySelector('.tt-hero-doodle--' + name)) return;
      var el = document.createElement('span');
      el.className = 'tt-hero-doodle tt-hero-doodle--' + name;
      el.setAttribute('aria-hidden', 'true');
      el.textContent = text;
      hero.appendChild(el);
    });
  }

  function setupOneShotReveal(hero) {
    var reducedMotion = false;
    try {
      reducedMotion = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}

    if (reducedMotion || !('IntersectionObserver' in window)) {
      hero.classList.add('tt-hero-revealed');
      return;
    }

    // La clase html.js solo se añade cuando ya sabemos que el mecanismo de
    // reveal puede ejecutarse. Si JS falla antes, el hero permanece visible.
    document.documentElement.classList.add('js');
    hero.classList.add('tt-hero-reveal-ready');

    var observer = new IntersectionObserver(function (entries) {
      var entry = entries && entries[0];
      if (!entry || !entry.isIntersecting) return;
      hero.classList.add('tt-hero-revealed');
      observer.disconnect();
    }, {
      root: null,
      threshold: 0.08,
      rootMargin: '0px 0px -2% 0px'
    });

    observer.observe(hero);

    // Respaldo contra transiciones de documento, bfcache o un observer que no
    // entregue el primer callback. Es irreversible: nunca se quita la clase.
    window.setTimeout(function () {
      if (hero.classList.contains('tt-hero-revealed')) return;
      hero.classList.add('tt-hero-revealed');
      observer.disconnect();
    }, 1800);
  }

  function mountFinalHero() {
    var hero = document.getElementById('hero');
    if (!hero || hero.dataset.ttFinalHeroMounted === 'true') return;

    hero.dataset.ttFinalHeroMounted = 'true';
    hero.classList.add('tt-hero-final');

    var title = hero.querySelector('.tt-hero-title');
    var subtitle = hero.querySelector('.tt-hero-subtitle');
    var cta = hero.querySelector('.tt-hero-cta');
    var about = hero.querySelector('.tt-hero-link');

    if (title) {
      title.setAttribute('aria-label', 'Bienvenida tintina');
      title.innerHTML =
        '<span class="tt-hero-welcome">Bienvenida</span>' +
        '<span class="tt-hero-tintina">tintina</span>';
    }

    if (subtitle) subtitle.textContent = 'Joyitas únicas, como vos.';

    if (cta) {
      cta.href = '/catalogo';
      cta.setAttribute('aria-label', 'Comprar ahora');
      cta.innerHTML = 'COMPRAR AHORA <span class="tt-hero-cta-arrow" aria-hidden="true">→</span>';
    }

    if (about) {
      about.href = '/about';
      about.textContent = '¿Quiénes somos?';
      about.setAttribute('aria-label', 'Conocé quiénes somos');
    }

    addDoodles(hero);
    setupOneShotReveal(hero);
  }

  function boot() {
    document.body.classList.add('tt-home-premium');
    ensureFinalHeroStyles();
    mountFinalHero();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
