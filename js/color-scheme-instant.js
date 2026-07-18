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

  function applyMap(map) {
    if (!map || typeof map !== 'object') return;
    var key;
    for (key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key)) {
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

  root.classList.add('tt-first-paint-bg', 'tt-color-scheme-pending');

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
