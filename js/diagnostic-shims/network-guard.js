// =============================================================
// TINTIN — Diagnóstico integral: guardia de red anti-escritura
// =============================================================
// Script clásico (no módulo) inyectado como el primer <script> del documento
// dentro del iframe aislado del Diagnóstico de Super Admin, para que corra
// antes que cualquier otro script de la página real (los scripts clásicos se
// ejecutan durante el parseo, antes de que los módulos —siempre diferidos—
// empiecen). Es una segunda capa de seguridad, independiente de los shims de
// firestore-shim.js/auth-shim.js/storage-shim.js: si por algún motivo un
// script llegara a golpear la red real de escritura sin pasar por esos
// shims, esta guardia bloquea igual la llamada por la forma de la URL,
// nunca por el host, así que no depende de mantener actualizada una lista de
// dominios de Firebase.
//
// Nunca se carga en una página real servida a personas visitantes.
(function () {
  'use strict';

  var WRITE_PATTERN = /(:commit\b|:batchWrite\b|\/Write\/channel|\/google\.firestore\.v1\.Firestore\/Write\b|\/google\.firestore\.v1\.Firestore\/Commit\b)/i;

  function reportBlocked(name, detail) {
    try {
      window.parent && window.parent.postMessage({
        source: 'tt-diagnostic-shim',
        blockedCall: name,
        detail: detail || null,
        at: Date.now()
      }, window.location.origin);
    } catch (_) {}
    try { console.warn('[Diagnóstico] Solicitud de red de escritura bloqueada: ' + name); } catch (_) {}
  }

  function urlOf(input) {
    try {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url;
    } catch (_) {}
    return '';
  }

  var nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input, init) {
      var url = urlOf(input);
      if (WRITE_PATTERN.test(url)) {
        reportBlocked('fetch:write-rpc', url);
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return nativeFetch.apply(this, arguments);
    };
  }

  var nativeOpen = XMLHttpRequest.prototype.open;
  var nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ttDiagnosticUrl = String(url || '');
    return nativeOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (WRITE_PATTERN.test(this.__ttDiagnosticUrl || '')) {
      reportBlocked('xhr:write-rpc', this.__ttDiagnosticUrl);
      var self = this;
      setTimeout(function () {
        Object.defineProperty(self, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(self, 'status', { value: 200, configurable: true });
        Object.defineProperty(self, 'responseText', { value: '{}', configurable: true });
        Object.defineProperty(self, 'response', { value: '{}', configurable: true });
        if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
        if (typeof self.onload === 'function') self.onload();
      }, 0);
      return undefined;
    }
    return nativeSend.apply(this, arguments);
  };

  if (navigator.sendBeacon) {
    navigator.sendBeacon = function () {
      reportBlocked('sendBeacon', urlOf(arguments[0]));
      return true;
    };
  }
})();
