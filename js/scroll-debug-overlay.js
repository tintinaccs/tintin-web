/* =============================================================
   TINTIN — Panel de diagnóstico de scroll (temporal, solo debug)
   =============================================================
   Inerte para toda visita normal. Se activa únicamente con
   ?ttdebug=1 en la URL, para investigar el "scroll trabado al
   principio" reportado en Safari — no afecta el sitio en
   producción ni cambia ningún comportamiento cuando no está
   activo. Pensado para poder sacarse en cualquier momento sin
   tocar nada más.
   ============================================================= */
(function () {
  'use strict';
  if (window.TintinScrollDebugBooted) return;
  window.TintinScrollDebugBooted = true;
  if (!/[?&]ttdebug=1\b/.test(location.search)) return;

  var t0 = performance.now();
  var lines = [];
  var MAX_LINES = 40;

  function fmt(n) { return Math.round(n); }

  function log(msg) {
    lines.push('+' + fmt(performance.now() - t0) + 'ms  ' + msg);
    if (lines.length > MAX_LINES) lines.shift();
    render();
  }

  var panel, body, hidden = false;
  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'tt-scroll-debug';
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:46vh;overflow:auto;' +
      'background:rgba(10,4,8,.92);color:#9fe870;font:10px/1.4 ui-monospace,Menlo,monospace;' +
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
  }

  function render() {
    if (!body) return;
    var vv = window.visualViewport;
    var head = 'UA: ' + navigator.userAgent + '\n' +
      'innerHeight=' + fmt(window.innerHeight) +
      '  visualViewport.height=' + (vv ? fmt(vv.height) : 'n/a') +
      '  scrollY=' + fmt(window.scrollY) +
      '  scrollHeight=' + fmt(document.documentElement.scrollHeight) + '\n' +
      '——————————————\n';
    body.textContent = head + lines.join('\n');
  }

  function boot() {
    buildPanel();

    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var navType = nav ? nav.type : (performance.navigation ? String(performance.navigation.type) : '?');
    log('boot — navigation.type=' + navType + ' readyState=' + document.readyState);

    var loader = document.getElementById('tt-loader');
    if (loader) {
      log('loader encontrado, esperando .tt-out…');
      var mo = new MutationObserver(function () {
        if (loader.classList.contains('tt-out')) {
          log('loader.tt-out AGREGADO (cs pointer-events=' + getComputedStyle(loader).pointerEvents + ' touch-action=' + getComputedStyle(loader).touchAction + ')');
          mo.disconnect();
        }
      });
      mo.observe(loader, { attributes: true, attributeFilter: ['class'] });
    } else {
      log('no se encontró #tt-loader en boot()');
    }

    var scrollCount = 0;
    window.addEventListener('scroll', function () {
      scrollCount++;
      var vv = window.visualViewport;
      log('scroll #' + scrollCount + ' scrollY=' + fmt(window.scrollY) +
        ' innerH=' + fmt(window.innerHeight) + ' vvH=' + (vv ? fmt(vv.height) : 'n/a'));
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
      window.addEventListener(evt, function (e) {
        count++;
        if (count <= 6 || evt === 'touchend') {
          log(evt + ' #' + count + ' defaultPrevented=' + e.defaultPrevented + ' target=' + (e.target && e.target.id ? '#' + e.target.id : (e.target && e.target.className ? '.' + String(e.target.className).split(' ')[0] : e.target && e.target.tagName)));
        }
      }, { passive: true, capture: true });
    });

    window.addEventListener('load', function () {
      log('window.load disparado');
    });

    window.addEventListener('error', function (e) {
      log('ERROR: ' + e.message + ' @ ' + (e.filename || '') + ':' + e.lineno);
    });

    render();
    setInterval(render, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
