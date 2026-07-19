/**
 * TINTIN — Primera pintura estable del esquema global.
 *
 * Este script clásico se ejecuta de forma síncrona antes de las hojas CSS y
 * del loader. Aplica la última caché conocida, pero mantiene el contenido
 * cubierto por el loader hasta que js/color-scheme.js confirma el esquema
 * publicado en Firestore. Así nunca queda visible el salto entre un fondo
 * anterior/cacheado y el fondo definitivo de la página.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var CACHE_KEY = 'tt_color_scheme_global';
  var FALLBACK_PAGE_BG = '#FFF6FA';
  var RELEASE_TIMEOUT_MS = 6500;
  var released = false;
  var scriptUrl = document.currentScript && document.currentScript.src;

  // Mismo enforcement que js/color-scheme.js: en la primera pintura solo se
  // aplican valores que sean un color estricto (HEX / rgb(a) / hsl(a)). Así una
  // caché manipulada o vieja nunca inyecta un url(...) ni CSS arbitrario.
  function isSafeColorValue(value) {
    if (typeof value !== 'string') return false;
    var v = value.trim();
    if (!v || v.length > 64) return false;
    return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ||
      /^rgba?\(\s*[0-9.\s,%/]+\)$/i.test(v) ||
      /^hsla?\(\s*[0-9.\s,%/deg]+\)$/i.test(v);
  }

  function applyMap(map) {
    if (!map || typeof map !== 'object') return;
    var key;
    for (key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key) && isSafeColorValue(map[key])) {
        root.style.setProperty(key, map[key]);
      }
    }
  }

  function currentBreakpoint() {
    var width = window.innerWidth;
    return width >= 1440
      ? 'desktopLg'
      : width >= 1200
        ? 'desktop'
        : width >= 992
          ? 'laptop'
          : width >= 768
            ? 'tablet'
            : width >= 480
              ? 'mobile'
              : 'miniMobile';
  }

  function release(source) {
    if (released) return;
    released = true;
    root.classList.remove('tt-color-scheme-pending');
    root.classList.add('tt-color-scheme-ready');
    try {
      window.dispatchEvent(new CustomEvent('tintin:color-scheme-ready', {
        detail: { source: source || 'unknown' }
      }));
    } catch (error) {
      /* CustomEvent no disponible: la clase CSS ya liberó la página. */
    }
  }

  function installCheckoutNameGuard() {
    var path = String(window.location.pathname || '').toLowerCase();
    var isCheckout = path.endsWith('/checkout.html') || path.endsWith('/checkout');
    if (!isCheckout || window.TintinCheckoutNameGuard) return;

    var preferredName = '';

    function normalizeName(value) {
      return String(value == null ? '' : value)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    }

    function isCompleteName(value) {
      var normalized = normalizeName(value);
      var letters = normalized.replace(/[^A-Za-zÀ-ÖØ-öø-ÿÑñ]/g, '');
      return normalized.length >= 2 && letters.length >= 2;
    }

    function nameInput() {
      return document.getElementById('ck-name');
    }

    function updateSummary(value) {
      var rows = document.querySelectorAll('.ck-summary-row');
      var index;
      for (index = 0; index < rows.length; index += 1) {
        var label = rows[index].querySelector('.ck-summary-label');
        if (label && String(label.textContent || '').indexOf('Cliente') !== -1) {
          var target = rows[index].querySelector('.ck-summary-val');
          if (target) target.textContent = value;
          break;
        }
      }
    }

    function clearError() {
      var error = document.getElementById('error-2');
      if (error) {
        error.classList.remove('show');
        error.textContent = '';
      }
      var input = nameInput();
      if (input) {
        input.removeAttribute('aria-invalid');
        input.style.borderColor = '';
      }
    }

    function showError() {
      var input = nameInput();
      var error = document.getElementById('error-2');
      if (error) {
        error.textContent = 'Ingresá tu nombre completo, no solamente una inicial.';
        error.classList.add('show');
      }
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.style.borderColor = '#b8341f';
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function activateDataStep() {
      var panels = document.querySelectorAll('.ck-panel');
      var steps = document.querySelectorAll('.ck-step');
      var index;
      for (index = 0; index < panels.length; index += 1) {
        panels[index].classList.toggle('active', index === 2);
      }
      for (index = 0; index < steps.length; index += 1) {
        steps[index].classList.remove('active', 'done');
        if (index < 2) steps[index].classList.add('done');
        if (index === 2) steps[index].classList.add('active');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function applyPreferredName(value) {
      var normalized = normalizeName(value);
      if (isCompleteName(normalized)) preferredName = normalized;

      var input = nameInput();
      if (!input) return normalized;
      input.setAttribute('autocomplete', 'name');

      var current = normalizeName(input.value);
      if (!isCompleteName(current) && isCompleteName(preferredName)) {
        input.value = preferredName;
        try {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (error) {}
        updateSummary(preferredName);
        clearError();
        return preferredName;
      }
      return current;
    }

    function currentValidName() {
      return applyPreferredName(preferredName);
    }

    function interceptIncompleteName(event) {
      var button = event.target && event.target.closest
        ? event.target.closest('#btn-step3-next,#ck-confirm-btn')
        : null;
      if (!button) return;

      var value = currentValidName();
      if (isCompleteName(value)) {
        clearError();
        updateSummary(value);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (button.id === 'ck-confirm-btn') activateDataStep();
      showError();
    }

    window.TintinCheckoutNameGuard = {
      normalizeName: normalizeName,
      isCompleteName: isCompleteName,
      applyPreferredName: applyPreferredName,
      currentValidName: currentValidName
    };

    window.addEventListener('click', interceptIncompleteName, true);

    if (!document.getElementById('tt-checkout-name-auth-sync')) {
      var helper = document.createElement('script');
      helper.id = 'tt-checkout-name-auth-sync';
      helper.type = 'module';
      helper.src = new URL(
        'checkout-name-auth-sync.js?v=tintin-20260718-checkout-name-1',
        scriptUrl || window.location.href
      ).href;
      document.head.appendChild(helper);
    }
  }

  root.classList.add('tt-first-paint-bg', 'tt-color-scheme-pending');
  installCheckoutNameGuard();

  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      var data = JSON.parse(raw);
      if (data && typeof data.tokens === 'object') {
        applyMap(data.tokens);
        if (data.deviceOverrideEnabled && data.deviceOverrides) {
          applyMap(data.deviceOverrides[currentBreakpoint()]);
        }
      }
    }
  } catch (error) {
    /* localStorage bloqueado o dato corrupto: se usa el respaldo estable. */
  }

  var cachedPageBackground = root.style
    .getPropertyValue('--color-background-page')
    .trim();
  if (!cachedPageBackground) cachedPageBackground = FALLBACK_PAGE_BG;
  root.style.setProperty('--tt-first-paint-bg', cachedPageBackground);
  root.style.backgroundColor = FALLBACK_PAGE_BG;

  if (!document.getElementById('tt-first-paint-style')) {
    var style = document.createElement('style');
    style.id = 'tt-first-paint-style';
    style.textContent = [
      'html.tt-first-paint-bg,html.tt-first-paint-bg body{background:var(--color-background-page,var(--tt-first-paint-bg,#FFF6FA))!important;background-color:var(--color-background-page,var(--tt-first-paint-bg,#FFF6FA))!important}',
      'html.tt-first-paint-bg,html.tt-first-paint-bg body{transition:none!important}',
      'html.tt-color-scheme-pending,html.tt-color-scheme-pending body,html.tt-color-scheme-pending.tt-store-gate-pending,html.tt-color-scheme-pending.tt-store-gate-blocked{background:#FFF6FA!important;background-color:#FFF6FA!important}',
      'html.tt-color-scheme-pending body>*:not(#tt-loader):not(#tt-store-closed-overlay){visibility:hidden!important}',
      'html.tt-color-scheme-pending #tt-loader,html.tt-color-scheme-pending #tt-loader.tt-out{display:flex!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;background:#FFF6FA!important;background-color:#FFF6FA!important}'
    ].join('');
    document.head.appendChild(style);
  }

  window.TintinColorSchemeFirstPaint = {
    release: release,
    fallbackBackground: FALLBACK_PAGE_BG
  };

  window.setTimeout(function () {
    release('safety-timeout');
  }, RELEASE_TIMEOUT_MS);
})();
