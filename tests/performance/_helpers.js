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

const LIGHTWEIGHT_PAGES = new Set([
  'contact.html', 'about.html', 'envios.html', 'cambios-devoluciones.html',
  'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html'
]);

function url(page) { return `${BASE_URL}/${page.replace(/^\//, '')}`; }

async function installVitalsObserver(page) {
  await page.addInitScript(() => {
    window.__ttVitals = { lcp: null, cls: 0, inp: null, shifts: [] };
    const describeNode = node => {
      if (!(node instanceof Element)) return String(node?.nodeName || 'unknown');
      const id = node.id ? `#${node.id}` : '';
      const classes = [...node.classList].slice(0, 3).map(name => `.${name}`).join('');
      return `${node.tagName.toLowerCase()}${id}${classes}`;
    };
    try {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        if (entries.length) window.__ttVitals.lcp = Math.round(entries.at(-1).startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__ttVitals.cls += entry.value;
          const sources = (entry.sources || []).map(source => ({
            node: describeNode(source.node),
            previous: source.previousRect ? {
              x: Math.round(source.previousRect.x),
              y: Math.round(source.previousRect.y),
              width: Math.round(source.previousRect.width),
              height: Math.round(source.previousRect.height),
            } : null,
            current: source.currentRect ? {
              x: Math.round(source.currentRect.x),
              y: Math.round(source.currentRect.y),
              width: Math.round(source.currentRect.width),
              height: Math.round(source.currentRect.height),
            } : null,
          }));
          window.__ttVitals.shifts.push({
            value: Math.round(entry.value * 100000) / 100000,
            startTime: Math.round(entry.startTime),
            sources,
          });
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
      fcp: null, lcp: window.__ttVitals?.lcp ?? null, cls: 0,
      inp: window.__ttVitals?.inp ?? null, ttfb: null, dcl: null, load: null,
      requests: 0, transferKB: 0, duplicateRequests: 0, duplicateUrls: [],
      thirdPartyDuplicateUrls: [], firestoreReads: 0,
      firestoreSources: {}, shifts: window.__ttVitals?.shifts || []
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

      // El presupuesto de duplicados debe medir solicitudes que Tintin puede
      // controlar. SDKs externos (por ejemplo reCAPTCHA Enterprise) pueden
      // repetir internamente endpoints propios sin que exista una segunda
      // petición disparada por nuestro código. Esas repeticiones se conservan
      // como diagnóstico, pero no pueden falsear el tripwire first-party.
      const appCounts = new Map();
      const thirdPartyCounts = new Map();
      for (const item of resources) {
        let sameOrigin = false;
        try { sameOrigin = new URL(item.name, location.href).origin === location.origin; } catch {}
        const target = sameOrigin ? appCounts : thirdPartyCounts;
        target.set(item.name, (target.get(item.name) || 0) + 1);
      }
      out.duplicateUrls = [...appCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([name, count]) => ({ name, count }));
      out.thirdPartyDuplicateUrls = [...thirdPartyCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([name, count]) => ({ name, count }));
      out.duplicateRequests = out.duplicateUrls.reduce((sum, item) => sum + item.count - 1, 0);

      const budget = window.TintinReadBudget || {};
      out.firestoreReads = Number(budget.estimatedDocuments) || 0;
      out.firestoreSources = budget.sources || {};
    } catch {}
    window.setTimeout(() => {
      out.lcp = window.__ttVitals?.lcp ?? out.lcp;
      out.cls = Math.round((window.__ttVitals?.cls || out.cls) * 1000) / 1000;
      out.inp = window.__ttVitals?.inp ?? out.inp;
      out.shifts = window.__ttVitals?.shifts || out.shifts;
      resolve(out);
    }, 350);
  }));
}

const BUDGETS = {
  dclMs: 6000,
  lcpMs: 5000,
  productLcpMs: 2500,
  clsMax: 0.1,
  inpMs: 500,
  transferKB: 6500,
  duplicateRequests: 0,
  homeRequests: 155,
  lightweightRequests: 120,
  lightweightTransferKB: 1500,
  homeFirestoreReads: 30,
  loaderMaxMs: 11000
};

module.exports = {
  BASE_URL, VIEWPORTS, PUBLIC_PAGES, LIGHTWEIGHT_PAGES, url, installVitalsObserver,
  waitLoaderGone, probeInteraction, collectVitals, BUDGETS
};
