'use strict';

const { origin: PUBLIC_ORIGIN } = require('../../config/public-site.json');

const BASE_URL = (process.env.PERF_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || PUBLIC_ORIGIN).replace(/\/+$/, '');

const VIEWPORTS = [
  { name: '1920 Desktop grande', width: 1920, height: 1080 },
  { name: '1440 Desktop', width: 1440, height: 900 },
  { name: '1280 Laptop', width: 1280, height: 800 },
  { name: '1024 Tablet horizontal', width: 1024, height: 768 },
  { name: '768 Tablet vertical', width: 768, height: 1024 },
  { name: '390 Mobile', width: 390, height: 844 },
  { name: '360 Mobile pequeño', width: 360, height: 640 },
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
    window.__ttVitals = { lcp: null, cls: 0, eventTimingMaxMs: null, shifts: [] };
    let windowStart=0,lastShift=0,windowValue=0;
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
          if(!windowValue || entry.startTime-lastShift>1000 || entry.startTime-windowStart>5000){windowStart=entry.startTime;windowValue=0;}
          lastShift=entry.startTime;windowValue+=entry.value;
          window.__ttVitals.cls=Math.max(window.__ttVitals.cls,windowValue);
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
          window.__ttVitals.eventTimingMaxMs = Math.max(window.__ttVitals.eventTimingMaxMs || 0, duration);
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    } catch {}
  });
}

async function waitLoaderGone(page, timeout = 12000) {
  await page.waitForFunction(() => {
    const loader = document.getElementById('tt-loader');
    return !loader || getComputedStyle(loader).display === 'none' || loader.classList.contains('tt-out');
  }, null, { timeout });
}

async function probeInteraction(page) {
  const trigger=page.locator('[data-nav-action="cart"]:visible,#tabbar-cart:visible,[data-shell-route="cart"]:visible').first();
  await trigger.waitFor({state:'visible'});
  await page.evaluate(()=>{window.__ttInteractionStarted=performance.now();});
  await trigger.click();
  await page.waitForFunction(()=>document.getElementById('cart-drawer')?.getAttribute('aria-hidden')==='false');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    window.__ttVitals.interactionMs=performance.now()-window.__ttInteractionStarted;resolve();
  }))));
  await page.locator('#btn-cart-close').click();
  await page.waitForFunction(()=>document.getElementById('cart-drawer')?.getAttribute('aria-hidden')==='true');
}

async function collectVitals(page) {
  return page.evaluate(() => new Promise(resolve => {
    const out = {
      fcp: null, lcp: window.__ttVitals?.lcp ?? null, cls: 0,
      interactionMs: window.__ttVitals?.interactionMs ?? null,
      eventTimingMaxMs: window.__ttVitals?.eventTimingMaxMs ?? null, ttfb: null, dcl: null, load: null,
      requests: 0, firstPartyRequests: 0, thirdPartyRequests: 0, transferKB: 0, firstPartyTransferKB: 0, duplicateRequests: 0, duplicateUrls: [],
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
      out.firstPartyRequests = resources.filter(item => {
        try { return new URL(item.name, location.href).origin === location.origin; } catch { return false; }
      }).length;
      out.thirdPartyRequests = out.requests - out.firstPartyRequests;
      out.transferKB = Math.round(resources.reduce((sum, item) => sum + (item.transferSize || 0), 0) / 1024);
      out.firstPartyTransferKB = Math.round(resources.reduce((sum, item) => {
        try {
          return new URL(item.name, location.href).origin === location.origin
            ? sum + (item.transferSize || 0)
            : sum;
        } catch {
          return sum;
        }
      }, 0) / 1024);

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
      out.eventTimingMaxMs = window.__ttVitals?.eventTimingMaxMs ?? out.eventTimingMaxMs;
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
  // Inicio carga productos destacados desde Firestore: el conteo real crece
  // con el catálogo (más productos publicados = más imágenes), no con
  // regresiones de código. 155 fue la medición exacta post-optimización de
  // #441; CI ya observó 161 sin cambios de código. El shell actual puede
  // sumar hasta 177 solicitudes efectivas por recursos externos variables;
  // se mantiene el tripwire muy por debajo de un crecimiento de bloat real.
  homeRequests: 177,
  // Nosotros conserva una composición editorial propia con más recursos de
  // imagen. La base 4b29564b completa 129 recursos propios; las dos fotos
  // suman uno y la bienvenida exclusiva de Inicio elimina tres: límite127.
  // Se aplica a requests first-party para que
  // reCAPTCHA/otros terceros variables no conviertan el gate en flaky; las
  // demás páginas informativas mantienen el límite first-party de 120; el
  // peso total sigue contando también los recursos externos.
  lightweightRequests: 120,
  // Incluye el único marcador JSON de versión al abrir una pestaña. Sustituye
  // la descarga periódica del HTML completo; los demás límites se conservan.
  aboutRequests: 128,
  // Las páginas informativas comparten el shell público (CSS, navegación,
  // fuentes y runtime de tienda) y también leen 'site_content' vía onSnapshot
  // en contenido-sitio.js, gateado por appCheckReady. Desde #725, firebase.js
  // espera (await) el intercambio de token de App Check/reCAPTCHA Enterprise
  // antes de resolver appCheckReady en TODAS las páginas -incluidas las
  // informativas-, precisamente para evitar el permission-denied que #725
  // corrigió en los listeners de Firestore que arrancan justo después de Auth.
  // Eso adelanta la carga del script de reCAPTCHA Enterprise (~480 KB) a la
  // ventana de medición del test, subiendo el piso estable de ~1.66 MB a
  // ~1.77-1.83 MB (medido en CI: 1815 KB en contact/envios/cambios-devoluciones/
  // preguntas-frecuentes, 1877 KB en about.html). Este presupuesto refleja ese
  // piso legítimo con margen, sin relajar el presupuesto general de 6.5 MB.
  lightweightTransferKB: 2000,
  homeFirestoreReads: 30,
  loaderMaxMs: 11000
};

module.exports = {
  BASE_URL, VIEWPORTS, PUBLIC_PAGES, LIGHTWEIGHT_PAGES, url, installVitalsObserver,
  waitLoaderGone, probeInteraction, collectVitals, BUDGETS
};
