(function () {
  'use strict';
  if (window.__TINTIN_OBSERVABILITY__) return;
  window.__TINTIN_OBSERVABILITY__ = true;

  const endpoint = '/api/telemetry';
  const queue = [];
  const requestStats = { count: 0, totalMs: 0, maxMs: 0 };
  const originalFetch = window.fetch;
  let latestLcp = null;
  let cumulativeCls = 0;
  let timer = null;

  function route() { return location.pathname || '/'; }

  function scheduleFlush(delayMs) {
    clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }

  function push(event) {
    queue.push({ ...event, route: route(), online: navigator.onLine });
    if (queue.length >= 20) return flush();
    scheduleFlush(2500);
  }

  function markPerformancePending() {
    // Las métricas de rendimiento se agregan en el navegador y se envían como
    // máximo una vez por ventana. Evita convertir la observabilidad en tráfico
    // adicional por cada request de la tienda.
    scheduleFlush(20000);
  }

  function takePerformanceSummary() {
    const events = [];
    if (requestStats.count > 0) {
      events.push({
        kind: 'performance',
        metric: 'request_ms_avg',
        value: requestStats.totalMs / requestStats.count,
        count: requestStats.count,
        code: 'fetch_summary',
        route: route(),
        online: navigator.onLine,
      });
      events.push({
        kind: 'performance',
        metric: 'request_ms_max',
        value: requestStats.maxMs,
        count: requestStats.count,
        code: 'fetch_summary',
        route: route(),
        online: navigator.onLine,
      });
      requestStats.count = 0;
      requestStats.totalMs = 0;
      requestStats.maxMs = 0;
    }
    if (latestLcp != null) {
      events.push({ kind: 'performance', metric: 'LCP', value: latestLcp, code: 'web_vital', route: route(), online: navigator.onLine });
      latestLcp = null;
    }
    if (cumulativeCls > 0) {
      events.push({ kind: 'performance', metric: 'CLS', value: cumulativeCls, code: 'web_vital', route: route(), online: navigator.onLine });
      cumulativeCls = 0;
    }
    return events;
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!navigator.onLine) return;

    const events = queue.splice(0, 20);
    events.push(...takePerformanceSummary());
    if (!events.length) return;

    const body = JSON.stringify({ events });
    if (navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))) return;
      } catch {}
    }

    // Usar la referencia original impide que el envío de telemetría sea
    // observado por su propio wrapper y genere un bucle de auto-reporte.
    if (typeof originalFetch === 'function') {
      originalFetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => {});
    }
  }

  window.addEventListener('error', function (event) {
    if (event.target && event.target !== window) {
      const target = event.target;
      push({ kind: 'resource_error', code: String(target.tagName || '').toLowerCase(), message: 'resource_load_failed' });
      return;
    }
    push({ kind: 'js_error', code: event.error?.name || 'Error', message: event.message || 'javascript_error' });
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    push({ kind: 'promise_error', code: reason?.name || 'PromiseRejection', message: reason?.message || String(reason || 'unhandled_rejection') });
  });

  window.addEventListener('offline', function () { push({ kind: 'offline', code: 'network', message: 'offline' }); });
  window.addEventListener('online', function () { push({ kind: 'recovered', code: 'network', message: 'online' }); flush(); });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  if (typeof originalFetch === 'function') {
    window.fetch = async function () {
      const started = performance.now();
      const input = arguments[0];
      const rawUrl = typeof input === 'string' ? input : input?.url;
      let parsedUrl = null;
      try { if (rawUrl) parsedUrl = new URL(rawUrl, location.href); } catch {}
      const isTelemetry = parsedUrl?.origin === location.origin && parsedUrl.pathname === endpoint;

      try {
        const response = await originalFetch.apply(this, arguments);
        if (!isTelemetry) {
          const elapsed = performance.now() - started;
          requestStats.count += 1;
          requestStats.totalMs += elapsed;
          requestStats.maxMs = Math.max(requestStats.maxMs, elapsed);
          markPerformancePending();
          if (parsedUrl?.origin === location.origin && !response.ok && response.status >= 400) {
            push({ kind: 'api_error', code: 'http_' + response.status, message: parsedUrl.pathname });
          }
        }
        return response;
      } catch (error) {
        if (!isTelemetry) {
          const elapsed = performance.now() - started;
          requestStats.count += 1;
          requestStats.totalMs += elapsed;
          requestStats.maxMs = Math.max(requestStats.maxMs, elapsed);
          markPerformancePending();
          push({ kind: 'api_error', code: error?.name || 'fetch_error', message: 'request_failed' });
        }
        throw error;
      }
    };
  }

  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          latestLcp = last.startTime;
          markPerformancePending();
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver(list => {
        list.getEntries().forEach(entry => { if (!entry.hadRecentInput) cumulativeCls += entry.value; });
        markPerformancePending();
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  }
})();
