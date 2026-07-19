'use strict';

/**
 * Utilidades compartidas para las pruebas de rendimiento con Playwright.
 *
 * BASE_URL configurable por entorno (PERF_BASE_URL). Por defecto apunta al
 * despliegue real de GitHub Pages, que es donde estas métricas tienen sentido
 * (no en un servidor local sin Firebase real).
 */
const BASE_URL = (process.env.PERF_BASE_URL || 'https://tintinaccs.github.io/tintin-web').replace(/\/+$/, '');

// Las siete resoluciones obligatorias del encargo.
const VIEWPORTS = [
  { name: '1920 Desktop grande', width: 1920, height: 1080 },
  { name: '1440 Desktop', width: 1440, height: 900 },
  { name: '1280 Laptop', width: 1280, height: 800 },
  { name: '1024 Tablet horizontal', width: 1024, height: 768 },
  { name: '768 Tablet vertical', width: 768, height: 1024 },
  { name: '390 Mobile', width: 390, height: 844 },
  { name: '320 Mini mobile', width: 320, height: 568 }
];

const PUBLIC_PAGES = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html', 'contact.html',
  'about.html', 'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html',
  'terminos.html', 'privacidad.html'
];

function url(page) { return `${BASE_URL}/${page.replace(/^\//, '')}`; }

// Espera a que el loader global se retire (o al timeout de emergencia del sitio).
async function waitLoaderGone(page, timeout = 12000) {
  await page.waitForFunction(() => {
    const l = document.getElementById('tt-loader');
    return !l || getComputedStyle(l).display === 'none' || l.classList.contains('tt-out');
  }, { timeout }).catch(() => {});
}

// Recolecta métricas reales de Web Vitals desde el navegador.
async function collectVitals(page) {
  return page.evaluate(() => new Promise(resolve => {
    const out = { fcp: null, lcp: null, cls: 0, ttfb: null, dcl: null, load: null,
      requests: 0, transferKB: 0 };
    try {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      out.ttfb = nav.responseStart ? Math.round(nav.responseStart) : null;
      out.dcl = nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null;
      out.load = nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcp) out.fcp = Math.round(fcp.startTime);
      const res = performance.getEntriesByType('resource');
      out.requests = res.length;
      out.transferKB = Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024);
    } catch {}
    try {
      new PerformanceObserver(list => {
        const e = list.getEntries();
        if (e.length) out.lcp = Math.round(e[e.length - 1].startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) out.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
    setTimeout(() => { out.cls = Math.round(out.cls * 1000) / 1000; resolve(out); }, 1200);
  }));
}

// Presupuestos con tolerancia (advertencias vs fallos): se validan como "no peor
// que" umbrales generosos, para no romper por diferencias mínimas o inestables.
const BUDGETS = {
  lcpMs: 4000,      // LCP razonable en la mediana de dispositivos
  clsMax: 0.1,      // CLS bueno
  loaderMaxMs: 11000 // el loader debe cerrarse antes del timeout de emergencia
};

module.exports = { BASE_URL, VIEWPORTS, PUBLIC_PAGES, url, waitLoaderGone, collectVitals, BUDGETS };
