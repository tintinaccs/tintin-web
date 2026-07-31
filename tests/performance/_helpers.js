'use strict';

const BASE_URL = (process.env.PERF_BASE_URL || 'https://tintinaccesorios.pages.dev').replace(/\/+$/, '');

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

async function installVitalsObserver(page) {
  await page.addInitScript(() => {
    window.__ttVitals = { lcp: null, cls: 0, inp: null };
    try {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        if (entries.length) window.__ttVitals.lcp = Math.round(entries.at(-1).startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__ttVitals.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.interactionId) continue;
          const duration = Math.round(entry.duration || 0);
          window.__ttVitals.inp = Math.max(window.__ttVitals.inp || 0, duration);
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    } catch {}
  });
}

async function waitLoaderGone(page, timeout = 12000) {
  await page.waitForFunction(() => {
    const loader = document.getElementById('tt-loader');
    return !loader || getComputedStyle(loader).display === 'none' || loader.classList.contains('tt-out');
  }, { timeout }).catch(() => {});
}

async function probeInteraction(page) {
  await page.evaluate(() => {
    const probe = document.createElement('button');
    probe.id = 'tt-inp-probe';
    probe.type = 'button';
    probe.setAttribute('aria-label', 'Sonda de interacción');
    probe.style.cssText = 'position:fixed;left:1px;bottom:1px;width:4px;height:4px;opacity:.01;z-index:2147483647';
    document.body.appendChild(probe);
  });
  await page.locator('#tt-inp-probe').click({ force: true }).catch(() => {});
  await page.waitForTimeout(180);
  await page.evaluate(() => document.getElementById('tt-inp-probe')?.remove());
}

async function collectVitals(page) {
  return page.evaluate(() => new Promise(resolve => {
    const out = {
      fcp: null, lcp: window.__ttVitals?.lcp ?? null, cls: window.__ttVitals?.cls || 0,
      inp: window.__ttVitals?.inp ?? null, ttfb: null, dcl: null, load: null,
      requests: 0, transferKB: 0, duplicateRequests: 0, duplicateUrls: [], firestoreReads: 0,
      firestoreSources: {}
    };
    try {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      out.ttfb = nav.responseStart ? Math.round(nav.responseStart) : null;
      out.dcl = nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null;
      out.load = nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcp) out.fcp = Math.round(fcp.startTime);
      const resources = performance.getEntriesByType('resource');
      out.requests = resources.length;
      out.transferKB = Math.round(resources.reduce((sum, item) => sum + (item.transferSize || 0), 0) / 1024);
      const counts = new Map();
      resources.forEach(item => counts.set(item.name, (counts.get(item.name) || 0) + 1));
      out.duplicateUrls = [...counts.entries()].filter(([, count]) => count > 1).map(([name, count]) => ({ name, count }));
      out.duplicateRequests = out.duplicateUrls.reduce((sum, item) => sum + item.count - 1, 0);
      const budget = window.TintinReadBudget || {};
      out.firestoreReads = Number(budget.estimatedDocuments) || 0;
      out.firestoreSources = budget.sources || {};
    } catch {}
    window.setTimeout(() => {
      out.lcp = window.__ttVitals?.lcp ?? out.lcp;
      out.cls = Math.round((window.__ttVitals?.cls || out.cls) * 1000) / 1000;
      out.inp = window.__ttVitals?.inp ?? out.inp;
      resolve(out);
    }, 350);
  }));
}

const BUDGETS = {
  dclMs: 6000,
  lcpMs: 5000,
  clsMax: 0.1,
  inpMs: 500,
  transferKB: 6500,
  duplicateRequests: 5,
  homeFirestoreReads: 30,
  loaderMaxMs: 11000
};

module.exports = {
  BASE_URL, VIEWPORTS, PUBLIC_PAGES, url, installVitalsObserver,
  waitLoaderGone, probeInteraction, collectVitals, BUDGETS
};
