'use strict';

const fs = require('fs');
const path = require('path');
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
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const html = htmlFiles.map(file => [file, read(file)]);

check(
  'La portada usa una consulta acotada sin listener masivo',
  products.includes("HOME_PRODUCT_LIMIT = 18") &&
    products.includes("where('destacado', '==', true)") &&
    products.includes("return loadHomeProducts()") &&
    /catalogo\|collections/.test(products),
  'Inicio debe leer como máximo 24 productos; catálogo y colecciones conservan el listener completo.'
);
check(
  'Páginas informativas no importan products-store al iniciar',
  shellRuntime.includes("if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime())") &&
    shellRuntime.includes('attachProductsDemand()'),
  'Products-store debe cargarse por demanda al abrir Buscar fuera de inicio/tienda.'
);

const checkoutBlockMatch = shellRuntime.match(/if \(page === 'cart'\) \{([\s\S]*?)\n  \}/);
const checkoutBlock = checkoutBlockMatch?.[1] || '';
check(
  'Checkout reliability se limita a Checkout',
  Boolean(checkoutBlockMatch) &&
    checkoutBlock.includes("pages/checkout/checkout-confiabilidad.js") &&
    checkoutBlock.includes('loadCheckoutMapRuntime()') &&
    checkoutBlock.includes('loadCheckoutIdentityRuntime()') &&
    checkoutBlock.includes('loadCheckoutOrderRuntime()') &&
    !shellRuntime.replace(checkoutBlockMatch?.[0] || '', '').includes("pages/checkout/checkout-confiabilidad.js") &&
    !shellRuntime.replace(checkoutBlockMatch?.[0] || '', '').includes('loadCheckoutMapRuntime()') &&
    !shellRuntime.replace(checkoutBlockMatch?.[0] || '', '').includes('loadCheckoutIdentityRuntime()') &&
    !shellRuntime.replace(checkoutBlockMatch?.[0] || '', '').includes('loadCheckoutOrderRuntime()'),
  'Confiabilidad, mapa, identidad y creación de pedido V2 deben iniciarse únicamente dentro del bloque page === cart.'
);
check(
  'El shell reconoce URLs limpias de Cloudflare',
  routeState.includes("replace(/\\.html$/, '')") &&
    routeState.includes("['catalogo', 'collections', 'product'].includes(file)"),
  'La carga condicional no puede depender de que la URL termine en .html.'
);

const staleShell = html.filter(([, source]) => source.includes('js/inicio-navegacion-publica.js?v=tintin-20260726-login-session-1'));
const staleScript = html.filter(([, source]) => source.includes('tienda.js?v=tintin-20260716-cloudinary-fix-1'));
const italicPreloads = html.filter(([, source]) => source.includes('montserrat-latin-wght-italic.woff2" as="font"'));
check('Public shell tiene cache bust nuevo en todos los HTML', staleShell.length === 0, staleShell.map(([file]) => file).join(', '));
check('tienda.js optimizado por Cloudinary tiene cache bust nuevo', staleScript.length === 0, staleScript.map(([file]) => file).join(', '));
check('Montserrat italic conserva el preload contractual', italicPreloads.length === html.filter(([, source]) => source.includes('montserrat-latin-wght-normal.woff2\" as=\"font\"')).length, html.filter(([file, source]) => source.includes('montserrat-latin-wght-normal.woff2\" as=\"font\"') && !source.includes('montserrat-latin-wght-italic.woff2\" as=\"font\"')).map(([file]) => file).join(', '));

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
  console.error(`\nFase 5: ${failures.length} fallo(s).`);
  process.exit(1);
}
console.log('\nFase 5: invariantes de rendimiento protegidas.');