/* =============================================================
   TINTIN — Panel de diagnóstico de scroll (temporal, solo debug)
   =============================================================
   Inerte para toda visita normal. Se activa únicamente con
   ?ttdebug=1 en la URL, para investigar el "scroll trabado al
   principio" reportado en Mobile/Safari — no afecta el sitio en
   producción ni cambia ningún comportamiento cuando no está
   activo. Pensado para poder sacarse en cualquier momento sin
   tocar nada más.

   Se carga muy temprano en <head>, justo después de page-loader.js
   (que ya definió window.ttPageReady de forma síncrona en ese punto).
   Todo lo que necesita capturar el instante real de ttPageReady()/.tt-out
   corre en el nivel superior del IIFE, SIN esperar a DOMContentLoaded —
   ese trigger vive en el <head> y puede dispararse en el primer par de
   frames, mucho antes de que el <body> termine de parsearse.
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinScrollDebugBooted) return;
  window.TintinScrollDebugBooted = true;
  if (!/[?&]ttdebug=1\b/.test(location.search)) return;

  var t0 = performance.now();
  var lines = [];
  var MAX_LINES = 120;

  function fmt(n) { return Math.round(n); }

  function log(msg) {
    lines.push('+' + fmt(performance.now() - t0) + 'ms  ' + msg);
    if (lines.length > MAX_LINES) lines.shift();
    render();
  }

  var panel, body, hidden = false;
  function buildPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'tt-scroll-debug';
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:50vh;overflow:auto;' +
      'background:rgba(10,4,8,.94);color:#9fe870;font:10px/1.4 ui-monospace,Menlo,monospace;' +
      'z-index:2147483647;padding:8px 10px;white-space:pre-wrap;word-break:break-word;' +
      'border-top:2px solid #D46A8A;-webkit-user-select:text;user-select:text';
    var head = document.createElement('div');
    head.textContent = 'TT SCROLL DEBUG — tocá para ocultar/mostrar';
    head.style.cssText = 'color:#F6B7C8;font-weight:700;margin-bottom:4px;font-size:10px';
    head.addEventListener('click', function () {
      hidden = !hidden;
      body.style.display = hidden ? 'none' : 'block';
    });
    body = document.createElement('div');
    panel.appendChild(head);
    panel.appendChild(body);
    (document.body || document.documentElement).appendChild(panel);
    render();
  }

  function snapshot() {
    var vv = window.visualViewport;
    var html = document.documentElement;
    var b = document.body;
    var csHtml = getComputedStyle(html);
    var csBody = b ? getComputedStyle(b) : null;
    var homeFit = document.getElementById('tt-home-fit-css');
    var loader = document.getElementById('tt-loader');
    return {
      readyState: document.readyState,
      scrollY: fmt(window.scrollY),
      innerHeight: fmt(window.innerHeight),
      vvHeight: vv ? fmt(vv.height) : 'n/a',
      vvOffsetTop: vv ? fmt(vv.offsetTop) : 'n/a',
      docScrollHeight: fmt(html.scrollHeight),
      bodyScrollHeight: b ? fmt(b.scrollHeight) : 'n/a',
      sections: document.querySelectorAll('section').length,
      hero: !!document.getElementById('hero'),
      quickCats: !!document.querySelector('.tt-quick-cats'),
      trustBar: !!document.querySelector('.tt-trust-bar'),
      collectionsSection: !!document.querySelector('.tt-collections-section'),
      productsSection: !!document.querySelector('.tt-products-section'),
      reviewsSection: !!document.querySelector('.tt-reviews-section'),
      footer: !!document.querySelector('.tt-footer'),
      homeFitCss: !!homeFit,
      homeFitCssHref: homeFit ? homeFit.href : null,
      loaderExists: !!loader,
      loaderTtOut: loader ? loader.classList.contains('tt-out') : null,
      loaderDisplay: loader ? getComputedStyle(loader).display : null,
      htmlClasses: html.className,
      bodyClasses: b ? b.className : '',
      htmlOverflow: csHtml.overflow,
      htmlOverflowY: csHtml.overflowY,
      htmlTouchAction: csHtml.touchAction,
      htmlOverscrollBehavior: csHtml.overscrollBehavior,
      htmlPosition: csHtml.position,
      htmlHeight: csHtml.height,
      htmlMinHeight: csHtml.minHeight,
      bodyOverflow: csBody ? csBody.overflow : 'n/a',
      bodyOverflowY: csBody ? csBody.overflowY : 'n/a',
      bodyTouchAction: csBody ? csBody.touchAction : 'n/a',
      bodyPosition: csBody ? csBody.position : 'n/a',
      bodyTop: csBody ? csBody.top : 'n/a',
      bodyHeight: csBody ? csBody.height : 'n/a',
      bodyMinHeight: csBody ? csBody.minHeight : 'n/a',
    };
  }

  function logSnapshot(label) {
    var s = snapshot();
    log(label + ' | readyState=' + s.readyState +
      ' scrollY=' + s.scrollY + ' innerH=' + s.innerHeight + ' vvH=' + s.vvHeight + ' vvTop=' + s.vvOffsetTop +
      ' docScrollHeight=' + s.docScrollHeight + ' bodyScrollHeight=' + s.bodyScrollHeight);
    log('  secciones=' + s.sections +
      ' hero=' + s.hero + ' quickCats=' + s.quickCats + ' trustBar=' + s.trustBar +
      ' collections=' + s.collectionsSection + ' products=' + s.productsSection +
      ' reviews=' + s.reviewsSection + ' footer=' + s.footer);
    log('  homeFitCss=' + s.homeFitCss + (s.homeFitCssHref ? ' (' + s.homeFitCssHref + ')' : '') +
      ' loader=' + s.loaderExists + ' loader.tt-out=' + s.loaderTtOut + ' loader.display=' + s.loaderDisplay);
    log('  html: overflow=' + s.htmlOverflow + ' overflowY=' + s.htmlOverflowY + ' touchAction=' + s.htmlTouchAction +
      ' overscrollBehavior=' + s.htmlOverscrollBehavior + ' position=' + s.htmlPosition +
      ' height=' + s.htmlHeight + ' minHeight=' + s.htmlMinHeight);
    log('  body: overflow=' + s.bodyOverflow + ' overflowY=' + s.bodyOverflowY + ' touchAction=' + s.bodyTouchAction +
      ' position=' + s.bodyPosition + ' top=' + s.bodyTop + ' height=' + s.bodyHeight + ' minHeight=' + s.bodyMinHeight);
    log('  html.class="' + s.htmlClasses + '" body.class="' + s.bodyClasses + '"');
    return s;
  }

  function render() {
    if (!body) return;
    var head = 'UA: ' + navigator.userAgent + '\n——————————————\n';
    body.textContent = head + lines.join('\n');
  }

  log('=== SCRIPT PARSEADO === readyState=' + document.readyState);

  // ── 1) Envolver window.ttPageReady EN EL NIVEL SUPERIOR, sin esperar a
  // DOMContentLoaded — page-loader.js (que corre justo antes, script clásico
  // en <head>) ya lo definió sincrónicamente en este punto. El trigger de
  // dos requestAnimationFrame del <head> puede dispararlo en los primeros
  // frames, mucho antes de DOMContentLoaded, así que envolverlo tarde
  // (dentro de un boot() gateado por DOMContentLoaded) pierde la llamada
  // real por completo — ese fue el primer bug que este mismo diagnóstico
  // reveló al medir.
  var ttPageReadyCalls = 0;
  if (typeof window.ttPageReady === 'function') {
    var origTtPageReady = window.ttPageReady;
    window.ttPageReady = function () {
      ttPageReadyCalls++;
      log('=== ttPageReady() LLAMADO (#' + ttPageReadyCalls + ') ===');
      logSnapshot('ttPageReady call #' + ttPageReadyCalls);
      return origTtPageReady.apply(this, arguments);
    };
    log('window.ttPageReady envuelto correctamente (nivel superior, síncrono)');
  } else {
    log('window.ttPageReady NO es función todavía en el nivel superior — page-loader.js no corrió antes, revisar orden de <script>');
  }

  // ── 2) Loader: esperar a que exista (page-loader.js lo inserta recién
  // cuando document.body existe, vía requestAnimationFrame) y observar
  // desde ahí .tt-out y display:none, sin esperar tampoco a DOMContentLoaded.
  (function waitForLoader(attempts) {
    var loader = document.getElementById('tt-loader');
    if (!loader) {
      if (attempts > 600) { log('#tt-loader nunca apareció (600 frames)'); return; }
      requestAnimationFrame(function () { waitForLoader(attempts + 1); });
      return;
    }
    log('#tt-loader encontrado (intento ' + attempts + ')');
    var sawOut = false, sawDisplayNone = false;
    var mo = new MutationObserver(function () {
      if (!sawOut && loader.classList.contains('tt-out')) {
        sawOut = true;
        log('=== #tt-loader.tt-out AGREGADO === cs.pointerEvents=' + getComputedStyle(loader).pointerEvents +
          ' cs.touchAction=' + getComputedStyle(loader).touchAction +
          ' inline.pointerEvents=' + loader.style.pointerEvents + ' inline.touchAction=' + loader.style.touchAction);
        logSnapshot('.tt-out');
      }
      if (!sawDisplayNone && getComputedStyle(loader).display === 'none') {
        sawDisplayNone = true;
        log('=== #tt-loader display:none (loader totalmente fuera del arbol) ===');
        mo.disconnect();
      }
    });
    mo.observe(loader, { attributes: true, attributeFilter: ['class', 'style'] });
  })(0);

  // ── 3) home-fit.css: momento en que aparece el <link> y momento en que
  // termina de cargar. Tampoco espera a DOMContentLoaded.
  (function waitForHomeFit(attempts) {
    var link = document.getElementById('tt-home-fit-css');
    if (!link) {
      if (attempts > 600) return;
      requestAnimationFrame(function () { waitForHomeFit(attempts + 1); });
      return;
    }
    log('=== tt-home-fit-css AGREGADO AL DOM === href=' + link.href);
    logSnapshot('home-fit.css link agregado');
    link.addEventListener('load', function () {
      log('=== tt-home-fit-css TERMINÓ DE CARGAR (evento load) ===');
      logSnapshot('home-fit.css load');
    }, { once: true });
  })(0);

  // ── 4) Tamaño del documento: registrar cada cambio significativo de
  // scrollHeight (>=24px) para ver si crece de golpe por CSS/contenido tardío.
  var lastScrollHeight = document.documentElement.scrollHeight;
  var scrollHeightPoll = setInterval(function () {
    var h = document.documentElement.scrollHeight;
    if (Math.abs(h - lastScrollHeight) >= 24) {
      log('scrollHeight CAMBIÓ: ' + fmt(lastScrollHeight) + ' → ' + fmt(h) + ' (Δ' + fmt(h - lastScrollHeight) + 'px)');
      lastScrollHeight = h;
    }
  }, 100);
  setTimeout(function () { clearInterval(scrollHeightPoll); }, 15000);

  // ── 5) Primer gesto táctil / scroll real + eventos de ciclo de vida.
  var scrollCount = 0;
  window.addEventListener('scroll', function () {
    scrollCount++;
    if (scrollCount <= 8) {
      log('scroll #' + scrollCount + ' scrollY=' + fmt(window.scrollY) +
        ' innerH=' + fmt(window.innerHeight) + ' vvH=' + (window.visualViewport ? fmt(window.visualViewport.height) : 'n/a'));
    }
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      log('visualViewport resize → height=' + fmt(window.visualViewport.height) + ' scrollY=' + fmt(window.scrollY));
    });
    window.visualViewport.addEventListener('scroll', function () {
      log('visualViewport scroll → offsetTop=' + fmt(window.visualViewport.offsetTop) + ' scrollY=' + fmt(window.scrollY));
    });
  }

  ['touchstart', 'touchmove', 'touchend'].forEach(function (evt) {
    var count = 0;
    var seenFirst = false;
    window.addEventListener(evt, function (e) {
      count++;
      if (!seenFirst) {
        seenFirst = true;
        log('=== PRIMER ' + evt.toUpperCase() + ' === defaultPrevented=' + e.defaultPrevented +
          ' target=' + (e.target && e.target.id ? '#' + e.target.id : (e.target && e.target.className ? '.' + String(e.target.className).split(' ')[0] : e.target && e.target.tagName)));
      } else if (count <= 6 || evt === 'touchend') {
        log(evt + ' #' + count + ' defaultPrevented=' + e.defaultPrevented);
      }
    }, { passive: true, capture: true });
  });

  document.addEventListener('DOMContentLoaded', function () {
    log('=== DOMContentLoaded ===');
    logSnapshot('DOMContentLoaded');
  });

  window.addEventListener('load', function () {
    log('=== window.load ===');
    logSnapshot('window.load');
  });

  window.addEventListener('error', function (e) {
    log('ERROR: ' + e.message + ' @ ' + (e.filename || '') + ':' + e.lineno);
  });

  // El panel en sí necesita document.body (o al menos documentElement) para
  // insertarse — documentElement ya existe en el nivel superior, así que se
  // puede construir de una, sin esperar a nada.
  buildPanel();
  setInterval(render, 400);
})();
