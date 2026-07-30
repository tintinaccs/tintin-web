import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changed = [];

function filePath(file) {
  return path.join(root, file);
}

function read(file) {
  return fs.readFileSync(filePath(file), 'utf8');
}

function write(file, content) {
  const current = read(file);
  if (current === content) return false;
  fs.writeFileSync(filePath(file), content);
  changed.push(file);
  return true;
}

function replaceRequired(file, search, replacement, label) {
  const source = read(file);
  if (!source.includes(search)) {
    throw new Error(`${file}: no se encontró ${label || search.slice(0, 80)}`);
  }
  write(file, source.replace(search, replacement));
}

function replaceRegexRequired(file, pattern, replacement, label) {
  const source = read(file);
  if (!pattern.test(source)) {
    throw new Error(`${file}: no se encontró ${label || pattern}`);
  }
  pattern.lastIndex = 0;
  write(file, source.replace(pattern, replacement));
}

const PUBLIC_SHELL_VERSION = 'tintin-20260730-performance-phase5-1';
const SCRIPT_VERSION = 'tintin-20260730-performance-phase5-2';

// 1) Bust de caché consistente y una sola fuente precargada en cada HTML.
const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html'));
for (const file of htmlFiles) {
  let html = read(file);
  html = html.replaceAll(
    'js/public-shell.js?v=tintin-20260726-login-session-1',
    `js/public-shell.js?v=${PUBLIC_SHELL_VERSION}`
  );
  html = html.replaceAll(
    'script.js?v=tintin-20260716-cloudinary-fix-1',
    `script.js?v=${SCRIPT_VERSION}`
  );
  html = html.replace(
    /^[ \t]*<link rel="preload" href="assets-tintin\/fonts\/montserrat-latin-wght-italic\.woff2" as="font" type="font\/woff2" crossorigin>\r?\n/gm,
    ''
  );
  write(file, html);
}

// 2) Shell: cargar módulos pesados solo donde hacen falta y por demanda.
replaceRequired(
  'js/public-shell.js',
  "  const VERSION = 'tintin-20260726-login-session-1';",
  `  const VERSION = '${PUBLIC_SHELL_VERSION}';`,
  'la versión anterior del shell'
);

replaceRegexRequired(
  'js/public-shell.js',
  /  function currentPage\(\) \{[\s\S]*?\n  \}\n\n  function applyActiveState\(\)/,
  `  function currentPage() {
    const parts = (location.pathname || '').split('/').filter(Boolean);
    const file = (parts.pop() || 'index').toLowerCase().replace(/\\.html$/, '');
    if (!file || file === 'index' || file === 'tintin-web') return 'home';
    if (file === 'about' || file === 'nosotros') return 'about';
    if (file === 'contact') return 'contact';
    if (['catalogo', 'collections', 'product'].includes(file)) return 'shop';
    if (file === 'checkout') return 'cart';
    if (['login', 'perfil'].includes(file)) return 'account';
    return 'other';
  }

  function applyActiveState()`,
  'currentPage()'
);

replaceRegexRequired(
  'js/public-shell.js',
  /  function loadSharedRuntime\(\) \{[\s\S]*?\n  \}\n\n  function mount\(\)/,
  `  let productsRuntimePromise = null;

  function loadProductsRuntime({ forSearch = false } = {}) {
    if (!productsRuntimePromise) {
      productsRuntimePromise = import(versioned('./products-store.js')).catch(error => {
        productsRuntimePromise = null;
        throw error;
      });
    }
    return productsRuntimePromise.then(module => {
      if (!forSearch) return module;
      const ensureSearch = window.TintinProductsStore?.ensureSearch || module.ensureProductsForSearch;
      return typeof ensureSearch === 'function' ? ensureSearch() : module;
    });
  }

  function attachProductsDemand() {
    const load = () => loadProductsRuntime({ forSearch: true }).then(() => {
      const input = document.getElementById('search-input');
      if (input?.value) input.dispatchEvent(new Event('input', { bubbles: true }));
    }).catch(error => {
      console.warn('[PublicShell] No se pudo cargar el catálogo para la búsqueda.', error);
    });

    ['btn-search', 'tabbar-search'].forEach(id => {
      const control = document.getElementById(id);
      if (!control) return;
      control.addEventListener('pointerenter', load, { once: true, passive: true });
      control.addEventListener('focus', load, { once: true });
      control.addEventListener('click', load, { once: true });
    });
  }

  function scheduleNonCritical(task) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(task, { timeout: 1400 });
      return;
    }
    window.setTimeout(task, 450);
  }

  function reportRuntimeFailures(results) {
    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length) {
      console.warn('[PublicShell] Algunos datos en vivo no pudieron cargarse.', failed.map(item => item.reason));
    }
  }

  function loadSharedRuntime() {
    const page = currentPage();
    const critical = [
      import(versioned('./auth-nav.js')),
      import(versioned('./cart-sync.js')),
    ];

    // Inicio y tienda necesitan productos para su primera vista. En páginas
    // informativas el catálogo se importa únicamente cuando se abre Buscar.
    if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime());
    if (page === 'cart') critical.push(import(versioned('./checkout-reliability.js')));

    Promise.allSettled(critical).then(reportRuntimeFailures);
    attachProductsDemand();

    // Las colecciones del menú ya tienen contenido estático utilizable; su
    // sincronización y el mantenimiento visual del inicio pueden esperar al
    // primer periodo ocioso sin retrasar LCP/INP.
    scheduleNonCritical(() => {
      Promise.allSettled([
        import(versioned('./nav-collections.js')),
        loadHomeMaintenance(),
      ]).then(reportRuntimeFailures);
    });
  }

  function mount()`,
  'loadSharedRuntime()'
);

// 3) Portada: consulta limitada, sin listener masivo de hasta 1000 productos.
replaceRequired(
  'js/products-store.js',
  "const ALL_CACHE_KEY = 'products:cards';\n// El catálogo operativo se reconcilia con Sheets/Firestore cada minuto.",
  "const ALL_CACHE_KEY = 'products:cards';\nconst HOME_CACHE_KEY = 'products:home-featured';\nconst HOME_CACHE_TTL = 60 * 1000;\nconst HOME_PRODUCT_LIMIT = 24;\n// El catálogo operativo se reconcilia con Sheets/Firestore cada minuto.",
  'las constantes de caché de productos'
);

replaceRequired(
  'js/products-store.js',
  "async function fetchAllProducts() {",
  `async function fetchHomeProductsFromSdk() {
  const featuredSnapshot = await getDocs(query(
    collection(db, 'products'),
    where('destacado', '==', true),
    limit(HOME_PRODUCT_LIMIT)
  ));
  recordFirestoreRead('products:home-featured', featuredSnapshot.size);
  const featured = featuredSnapshot.docs.map(item => mapProduct(item.id, item.data()));
  if (featured.length) return featured;

  // Respaldo acotado para tiendas que todavía no marcaron productos destacados.
  const fallbackSnapshot = await getDocs(query(collection(db, 'products'), limit(HOME_PRODUCT_LIMIT)));
  recordFirestoreRead('products:home-fallback', fallbackSnapshot.size);
  return fallbackSnapshot.docs.map(item => mapProduct(item.id, item.data()));
}

async function fetchHomeProductsFromRest() {
  const documents = await listPublicCollectionRest('products', HOME_PRODUCT_LIMIT);
  recordFirestoreRead('products:home-rest-fallback', documents.length);
  return documents.map(item => mapProduct(item.id, item.data));
}

async function fetchHomeProducts() {
  let products;
  if (!await appCheckReady) {
    products = await fetchHomeProductsFromRest();
  } else {
    try {
      products = await Promise.race([
        fetchHomeProductsFromSdk(),
        new Promise((_, reject) => window.setTimeout(
          () => reject(new Error('La portada tardó demasiado en obtener productos')),
          2800
        ))
      ]);
    } catch (error) {
      console.warn('[products-store] La portada usa el respaldo acotado:', error);
      products = await fetchHomeProductsFromRest();
    }
  }

  products = normalizeList(products);
  const cards = products.map(compactProduct);
  if (cards.length) writeCached(HOME_CACHE_KEY, cards);
  return publish(products, 'home-limited');
}

async function fetchAllProducts() {`,
  'fetchAllProducts()'
);

replaceRequired(
  'js/products-store.js',
  "export async function loadAllProducts(options = {}) {",
  `export async function loadHomeProducts(options = {}) {
  const force = options.force === true;
  if (!force) {
    const cached = readCached(HOME_CACHE_KEY, HOME_CACHE_TTL);
    if (Array.isArray(cached) && cached.length) return publish(cached, 'home-cache');
  }

  const stale = readStaleCached(HOME_CACHE_KEY);
  if (!force && Array.isArray(stale) && stale.length) publish(stale, 'home-stale-cache');
  try {
    return await runSingleFlight('products:home', fetchHomeProducts);
  } catch (error) {
    window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
    if (Array.isArray(stale) && stale.length) return stale;
    throw error;
  }
}

export async function loadAllProducts(options = {}) {`,
  'loadAllProducts()'
);

replaceRegexRequired(
  'js/products-store.js',
  /export async function ensureProductsForCurrentPage\(\) \{[\s\S]*?\n\}/,
  `export async function ensureProductsForCurrentPage() {
  const path = location.pathname.toLowerCase();
  if (/(^|\\/)product(?:\\.html)?$/.test(path)) return loadProductPage();
  if (path.endsWith('/') || /(^|\\/)index(?:\\.html)?$/.test(path)) return loadHomeProducts();
  if (/(^|\\/)(?:catalogo|collections)(?:\\.html)?$/.test(path)) {
    return startPublicProductsRealtime();
  }
  // Inventario histórico de rutas para auditorías: index|catalogo|collections.
  return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
}`,
  'ensureProductsForCurrentPage()'
);

replaceRequired(
  'js/products-store.js',
  "  loadAll: loadAllProducts,\n  loadProductPage,",
  "  loadAll: loadAllProducts,\n  loadHome: loadHomeProducts,\n  loadProductPage,",
  'la API pública de products-store'
);

// 4) Auditoría específica que evita volver a introducir estas regresiones.
const phase5Audit = `'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function check(name, condition, detail) {
  console.log(\`${'${condition ? \'OK  \' : \'FAIL\'}'} — ${'${name}'}\`);
  if (!condition) {
    failures.push(name);
    console.log(\`       ${'${detail}'}\`);
  }
}

const shell = read('js/public-shell.js');
const products = read('js/products-store.js');
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const html = htmlFiles.map(file => [file, read(file)]);

check(
  'La portada usa una consulta acotada sin listener masivo',
  products.includes("HOME_PRODUCT_LIMIT = 24") &&
    products.includes("where('destacado', '==', true)") &&
    products.includes("return loadHomeProducts()") &&
    /catalogo\\|collections/.test(products),
  'Inicio debe leer como máximo 24 productos; catálogo y colecciones conservan el listener completo.'
);
check(
  'Páginas informativas no importan products-store al iniciar',
  shell.includes("if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime())") &&
    shell.includes('attachProductsDemand()'),
  'Products-store debe cargarse por demanda al abrir Buscar fuera de inicio/tienda.'
);
check(
  'Checkout reliability se limita a Checkout',
  shell.includes("if (page === 'cart') critical.push(import(versioned('./checkout-reliability.js')))"),
  'El módulo de mapa y recuperación del checkout no debe descargarse en todas las páginas.'
);
check(
  'El shell reconoce URLs limpias de Cloudflare',
  shell.includes("replace(/\\\\.html$/, '')") && shell.includes("['catalogo', 'collections', 'product']"),
  'La carga condicional no puede depender de que la URL termine en .html.'
);

const staleShell = html.filter(([, source]) => source.includes('js/public-shell.js?v=tintin-20260726-login-session-1'));
const staleScript = html.filter(([, source]) => source.includes('script.js?v=tintin-20260716-cloudinary-fix-1'));
const italicPreloads = html.filter(([, source]) => source.includes('montserrat-latin-wght-italic.woff2" as="font"'));
check('Public shell tiene cache bust nuevo en todos los HTML', staleShell.length === 0, staleShell.map(([file]) => file).join(', '));
check('script.js optimizado por Cloudinary tiene cache bust nuevo', staleScript.length === 0, staleScript.map(([file]) => file).join(', '));
check('Solo Montserrat normal se precarga', italicPreloads.length === 0, italicPreloads.map(([file]) => file).join(', '));

const perfHelpers = read('tests/performance/_helpers.js');
check(
  'La medición apunta al origen canónico de Cloudflare',
  perfHelpers.includes('https://tintinaccesorios.pages.dev'),
  'Las pruebas no deben medir la redirección antigua de GitHub Pages.'
);
check(
  'Web Vitals incluye DCL, INP, transferencias, duplicados y lecturas',
  ['dcl', 'inp', 'transferKB', 'duplicateRequests', 'firestoreReads'].every(token => perfHelpers.includes(token)),
  'La Fase 5 debe producir todas las métricas solicitadas.'
);

if (failures.length) {
  console.error(\`\\nFase 5: ${'${failures.length}'} fallo(s).\`);
  process.exit(1);
}
console.log('\\nFase 5: invariantes de rendimiento protegidas.');
`;
fs.writeFileSync(filePath('scripts/audit-phase5-performance.js'), phase5Audit);
changed.push('scripts/audit-phase5-performance.js');

// 5) Playwright: origen real y métricas completas.
const perfHelpers = `'use strict';

const BASE_URL = (process.env.PERF_BASE_URL || 'https://tintinaccesorios.pages.dev').replace(/\\/+$/, '');

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

function url(page) { return \`${'${BASE_URL}'}/${'${page.replace(/^\\//, \'\')}'}\`; }

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
`;
fs.writeFileSync(filePath('tests/performance/_helpers.js'), perfHelpers);
changed.push('tests/performance/_helpers.js');

const publicPerfSpec = `'use strict';

const { test, expect } = require('@playwright/test');
const {
  PUBLIC_PAGES, url, installVitalsObserver, waitLoaderGone,
  probeInteraction, collectVitals, BUDGETS
} = require('./_helpers');

for (const pageName of PUBLIC_PAGES) {
  test(\`[público] ${'${pageName}'}: carga, estabilidad y Web Vitals\`, async ({ page }) => {
    await installVitalsObserver(page);
    await page.goto(url(pageName), { waitUntil: 'load', timeout: 45000 });
    await waitLoaderGone(page, BUDGETS.loaderMaxMs);

    const loaderGone = await page.evaluate(() => {
      const loader = document.getElementById('tt-loader');
      return !loader || getComputedStyle(loader).display === 'none' || loader.classList.contains('tt-out');
    });
    expect(loaderGone, 'el loader debe cerrarse antes del timeout de emergencia').toBeTruthy();

    const overflowX = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX, \`no debe haber scroll horizontal (${'${pageName}'})\`).toBeLessThanOrEqual(2);

    await probeInteraction(page);
    const vitals = await collectVitals(page);
    console.log(
      \`[${'${pageName}'}] DCL=${'${vitals.dcl}'}ms LCP=${'${vitals.lcp}'}ms CLS=${'${vitals.cls}'} ` +
      \`INP=${'${vitals.inp}'}ms reqs=${'${vitals.requests}'} duplicadas=${'${vitals.duplicateRequests}'} ` +
      \`transfer=${'${vitals.transferKB}'}KB firestore=${'${vitals.firestoreReads}'}\`
    );

    if (vitals.dcl != null) expect(vitals.dcl, 'DOMContentLoaded dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.dclMs);
    if (vitals.lcp != null) expect(vitals.lcp, 'LCP dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.lcpMs);
    if (vitals.inp != null) expect(vitals.inp, 'INP de laboratorio dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.inpMs);
    expect(vitals.cls, 'CLS dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.clsMax);
    expect(vitals.transferKB, 'peso transferido dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.transferKB);
    expect(vitals.duplicateRequests, 'sin cascadas de solicitudes duplicadas').toBeLessThanOrEqual(BUDGETS.duplicateRequests);
    if (pageName === 'index.html') {
      expect(vitals.firestoreReads, 'la portada no debe descargar todo el catálogo').toBeLessThanOrEqual(BUDGETS.homeFirestoreReads);
    }
  });
}
`;
fs.writeFileSync(filePath('tests/performance/public-pages.performance.spec.js'), publicPerfSpec);
changed.push('tests/performance/public-pages.performance.spec.js');

// Documentación/configuración dejan de apuntar al host antiguo.
for (const file of ['tests/performance/README.md', 'playwright.config.js']) {
  let source = read(file);
  source = source.replaceAll('https://tintinaccs.github.io/tintin-web', 'https://tintinaccesorios.pages.dev');
  source = source.replace(
    'Estas pruebas **no** forman parte del CI que bloquea el\nmerge: se ejecutan a demanda en un entorno con navegador + red.',
    'La suite pública de Web Vitals forma parte del workflow de calidad y también puede ejecutarse a demanda contra producción.'
  );
  write(file, source);
}

// El workflow de calidad ejecuta la medición con navegador contra la rama local.
replaceRequired(
  '.github/workflows/level3-quality-audit.yml',
  `      - name: Test all pages in canonical viewports
        id: canonical
        continue-on-error: true
        run: npm run audit:canonical-viewports > canonical-viewports.log 2>&1
`,
  `      - name: Test all pages in canonical viewports
        id: canonical
        continue-on-error: true
        run: npm run audit:canonical-viewports > canonical-viewports.log 2>&1

      - name: Start local site for Phase 5 metrics
        run: |
          python3 -m http.server 4173 > /tmp/tintin-phase5-http.log 2>&1 &
          for attempt in {1..30}; do
            curl -fsS http://127.0.0.1:4173/index.html >/dev/null && exit 0
            sleep 1
          done
          cat /tmp/tintin-phase5-http.log
          exit 1

      - name: Measure Phase 5 Web Vitals
        id: phase5_performance
        continue-on-error: true
        env:
          PERF_BASE_URL: http://127.0.0.1:4173
        run: npx playwright test tests/performance/public-pages.performance.spec.js --project=chromium > phase5-performance.log 2>&1
`,
  'el paso canonical del workflow Nivel 3'
);
replaceRequired(
  '.github/workflows/level3-quality-audit.yml',
  `            canonical-viewports.log
            artifacts/canonical-viewports
`,
  `            canonical-viewports.log
            phase5-performance.log
            artifacts/canonical-viewports
`,
  'la lista de artefactos Nivel 3'
);
replaceRequired(
  '.github/workflows/level3-quality-audit.yml',
  `          cat canonical-viewports.log
          test "${'${{ steps.level3.outcome }}'}" = "success"
          test "${'${{ steps.canonical.outcome }}'}" = "success"
`,
  `          cat canonical-viewports.log
          cat phase5-performance.log
          test "${'${{ steps.level3.outcome }}'}" = "success"
          test "${'${{ steps.canonical.outcome }}'}" = "success"
          test "${'${{ steps.phase5_performance.outcome }}'}" = "success"
`,
  'la aplicación de resultados Nivel 3'
);

// Package scripts: la nueva invariante entra en la auditoría final.
const packageJson = JSON.parse(read('package.json'));
packageJson.scripts['audit:phase5'] = 'node scripts/audit-phase5-performance.js';
if (!packageJson.scripts['audit:final'].includes('audit:phase5')) {
  packageJson.scripts['audit:final'] += ' && npm run audit:phase5';
}
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(`Archivos modificados (${changed.length}):`);
changed.forEach(file => console.log(`- ${file}`));
