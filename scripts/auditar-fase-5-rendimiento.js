'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function check(name, condition, detail) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} — ${name}`);
  if (!condition) {
    failures.push(name);
    console.log(`       ${detail}`);
  }
}

const shellRuntime = read('js/components/navigation/compartido/carga-navegacion.js');
const routeState = read('js/components/navigation/compartido/estado-ruta.js');
const products = read('js/core/store/estado-productos.js');
const publicShellGenerator = read('scripts/sincronizar-inicio-navegacion-publica.js');
const publicRuntimeVersion = publicShellGenerator.match(/const PUBLIC_SHELL_VERSION = '([^']+)'\s*;/)?.[1] || '';
const tiendaRuntimeVersion = publicShellGenerator.match(/const TIENDA_VERSION = '([^']+)'\s*;/)?.[1] || '';
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const html = htmlFiles.map(file => [file, read(file)]);

check(
  'La portada usa una consulta acotada sin listener masivo',
  products.includes("fetchPublicCatalogResource('products')") &&
    products.includes("runSingleFlight('products:home', fetchHomeProducts)") &&
    !/onSnapshot\(\s*(?:query\()?collection\(db,\s*['"]products['"]\)/.test(products) &&
    products.includes("return loadHomeProducts(") &&
    /catalogo\|collections/.test(products),
  'Inicio debe leer por la API edge (un solo vuelo, sin listener masivo); catálogo y colecciones usan la misma API.'
);
check(
  'Páginas informativas no importan products-store al iniciar',
  shellRuntime.includes("if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime())") &&
    shellRuntime.includes('attachProductsDemand()'),
  'Products-store debe cargarse por demanda al abrir Buscar fuera de inicio/tienda.'
);
check(
  'Checkout reliability se limita a Checkout',
  /if \(page === 'cart'\) critical\.push\(import\('[^']*pages\/checkout\/checkout-confiabilidad\.js\?v=[^']+'\)\)/.test(shellRuntime) &&
    (shellRuntime.match(/checkout-confiabilidad\.js/g) || []).length === 1,
  'El módulo de mapa y recuperación del checkout no debe descargarse en todas las páginas.'
);
check(
  'El shell reconoce URLs limpias de Cloudflare',
  routeState.includes("replace(/\\.html$/, '')") &&
    routeState.includes("['catalogo', 'collections', 'product'].includes(file)"),
  'La carga condicional no puede depender de que la URL termine en .html.'
);

const shellConsumers = html.filter(([, source]) => /(?:^|["'/])js\/inicio-navegacion-publica\.js\?v=/.test(source));
const staleShell = shellConsumers.filter(([, source]) => !source.includes(`js/inicio-navegacion-publica.js?v=${publicRuntimeVersion}`));
const tiendaConsumers = html.filter(([, source]) => /(?:^|["'/])tienda\.js\?v=/.test(source));
const staleTiendaConsumers = tiendaConsumers.filter(([, source]) => !source.includes(`tienda.js?v=${tiendaRuntimeVersion}`));
const italicPreloads = html.filter(([, source]) => source.includes('montserrat-latin-wght-italic.woff2" as="font"'));
check('Public shell usa la versión canónica en todos los HTML', Boolean(publicRuntimeVersion) && shellConsumers.length > 0 && staleShell.length === 0, staleShell.map(([file]) => file).join(', '));
check(
  'tienda.js usa la revisión canónica del generador público',
  Boolean(tiendaRuntimeVersion) && tiendaConsumers.length > 0 && staleTiendaConsumers.length === 0,
  !tiendaRuntimeVersion
    ? 'No se pudo leer TIENDA_VERSION desde scripts/sincronizar-inicio-navegacion-publica.js.'
    : staleTiendaConsumers.map(([file]) => file).join(', ')
);
check('Montserrat italic conserva el preload contractual', italicPreloads.length === html.filter(([, source]) => source.includes('montserrat-latin-wght-normal.woff2\" as=\"font\"')).length, html.filter(([file, source]) => source.includes('montserrat-latin-wght-normal.woff2\" as=\"font\"') && !source.includes('montserrat-latin-wght-italic.woff2\" as=\"font\"')).map(([file]) => file).join(', '));

const perfHelpers = read('tests/performance/_helpers.js');
function measurementOrigin(overrides = {}) {
  const environment = { ...process.env };
  delete environment.PERF_BASE_URL;
  delete environment.PLAYWRIGHT_BASE_URL;
  return execFileSync(process.execPath, ['-e', "process.stdout.write(require('./tests/performance/_helpers.js').BASE_URL)"], {
    cwd: root, env: { ...environment, ...overrides }, encoding: 'utf8',
  });
}
const canonicalOrigin = require('../config/public-site.json').origin.replace(/\/+$/, '');
check(
  'La medición usa el origen canónico sin overrides',
  measurementOrigin() === canonicalOrigin,
  'El valor por defecto debe coincidir con config/public-site.json, sin redirección a GitHub Pages.'
);
check(
  'La medición respeta el mismo origen explícito que Playwright',
  measurementOrigin({ PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4173///' }) === 'http://127.0.0.1:4173',
  'Un test local no puede usar silenciosamente producción; normalizar barras finales.'
);
check(
  'El override específico de rendimiento conserva prioridad',
  measurementOrigin({ PERF_BASE_URL: 'http://127.0.0.1:4174/', PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4173/' }) === 'http://127.0.0.1:4174',
  'PERF_BASE_URL debe tener prioridad sobre PLAYWRIGHT_BASE_URL.'
);
check(
  'Web Vitals incluye DCL, INP, transferencias, duplicados y lecturas',
  ['dcl', 'inp', 'transferKB', 'duplicateRequests', 'firestoreReads'].every(token => perfHelpers.includes(token)),
  'La Fase 5 debe producir todas las métricas solicitadas.'
);

if (failures.length) {
  console.error(`\nFase 5: ${failures.length} fallo(s).`);
  process.exit(1);
}
console.log('\nFase 5: invariantes de rendimiento protegidas.');
