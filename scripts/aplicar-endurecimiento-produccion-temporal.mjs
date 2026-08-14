import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content.replace(/\r\n?/g, '\n'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const replaceRequired = (file, from, to) => {
  const current = read(file);
  assert(current.includes(from), `${file}: no se encontró el bloque esperado.`);
  write(file, current.replace(from, to));
};

const origin = 'https://tintinaccesorios.pages.dev';
const indexable = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html', 'about.html',
  'contact.html', 'envios.html', 'cambios-devoluciones.html',
  'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html'
];
const routeFor = file => file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`;

// 1) SEO: la URL canónica debe ser la URL final que Cloudflare sirve tras quitar .html.
for (const file of indexable) {
  const oldUrl = `${origin}/${file}`;
  const canonical = `${origin}${routeFor(file)}`;
  let html = read(file);
  html = html.split(oldUrl).join(canonical);
  write(file, html);
}

let sitemap = read('sitemap.xml');
for (const file of indexable.filter(file => file !== 'product.html')) {
  sitemap = sitemap.split(`${origin}/${file}`).join(`${origin}${routeFor(file)}`);
}
write('sitemap.xml', sitemap);

const manifest = JSON.parse(read('manifest.json'));
manifest.start_url = '/';
write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

let tienda = read('tienda.js');
tienda = tienda.replace(
  "new URL('/product.html', 'https://tintinaccesorios.pages.dev')",
  "new URL('/product', 'https://tintinaccesorios.pages.dev')"
);
tienda = tienda.replace(
  "new URL('product.html', window.location.href)",
  "new URL('/product', window.location.origin)"
);
assert(tienda.includes("new URL('/product', 'https://tintinaccesorios.pages.dev')"), 'tienda.js: no se actualizó JSON-LD de producto.');
assert(tienda.includes("new URL('/product', window.location.origin)"), 'tienda.js: no se actualizó canonical dinámico de producto.');
write('tienda.js', tienda);

// 2) API pública cacheada en edge para evitar que cada visitante descargue ~todo Firestore.
const adminFirebase = read('cloudflare/firebase-admin-ligero.js');
if (!adminFirebase.includes('export async function firestoreAdminListAll')) {
  const marker = '\nfunction encodeFirestoreValue(value) {';
  assert(adminFirebase.includes(marker), 'firebase-admin-ligero.js: marcador de inserción no encontrado.');
  const helper = `

/** Lista una colección completa de forma paginada, con un techo explícito. */
export async function firestoreAdminListAll(env, path, maxDocuments = 1000) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const limit = Math.max(1, Math.min(5000, Number(maxDocuments) || 1000));
  const documents = [];
  let pageToken = '';

  do {
    const remaining = limit - documents.length;
    const params = new URLSearchParams({ pageSize: String(Math.min(300, remaining)) });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetch(\`${'${firestoreDocUrl(sa, path)}'}?${'${params.toString()}'}\`, {
      headers: { authorization: \`Bearer ${'${accessToken}'}\` }
    });
    if (response.status === 404) return documents;
    if (!response.ok) throw new Error(\`Firestore LIST ALL falló (${'${response.status}'})\`);
    const data = await response.json().catch(() => ({}));
    const page = Array.isArray(data.documents) ? data.documents : [];
    documents.push(...page.slice(0, remaining));
    pageToken = data.nextPageToken || '';
  } while (pageToken && documents.length < limit);

  return documents;
}
`;
  write('cloudflare/firebase-admin-ligero.js', adminFirebase.replace(marker, helper + marker));
}

write('functions/api/public-catalog.js', `import {
  decodeFirestoreFields,
  firestoreAdminListAll
} from '../../cloudflare/firebase-admin-ligero.js';

const PRODUCT_FIELDS = new Set([
  'name', 'title', 'handle', 'category', 'collectionSlug', 'collection', 'cat', 'type',
  'price', 'priceBefore', 'badge', 'description', 'desc', 'material', 'measurements',
  'colorFinish', 'care', 'waterResistance', 'warranty', 'sizeFit', 'packageContents',
  'imageUrl', 'image', 'img', 'photo', 'imageSrc', 'image_src', 'imagesExtra', 'images',
  'stock', 'active', 'oferta', 'destacado', 'tags', 'variants', 'collectionOrder',
  'createdAt', 'created_at', 'importedAt', 'updatedAt', 'updated_at', 'modifiedAt',
  'restockedAt', 'catalogActivityAt', 'Image Src', 'Variant Image', 'Variant Price',
  'Variant Inventory Qty', 'Product Category', 'Category', 'Title', 'Handle', 'Body (HTML)'
]);
const COLLECTION_FIELDS = new Set(['name', 'title', 'description', 'image', 'imageUrl', 'order', 'visible']);

function pickKnownFields(data, allowed) {
  return Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.has(key)));
}

function normalizeResource(value) {
  return value === 'collections' ? 'collections' : value === 'products' ? 'products' : '';
}

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

async function buildPayload(env, resource) {
  const docs = await firestoreAdminListAll(env, resource, resource === 'products' ? 1000 : 300);
  const allowed = resource === 'products' ? PRODUCT_FIELDS : COLLECTION_FIELDS;
  const items = docs.map(document => ({
    id: documentId(document),
    data: pickKnownFields(decodeFirestoreFields(document?.fields || {}), allowed)
  })).filter(item => {
    if (!item.id) return false;
    if (resource === 'products') return item.data.active !== false;
    return item.data.visible !== false;
  });
  return { ok: true, resource, items, count: items.length };
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { allow: 'GET' } });
  }

  const url = new URL(request.url);
  const resource = normalizeResource(url.searchParams.get('resource'));
  if (!resource) {
    return Response.json({ ok: false, error: 'resource_invalid' }, {
      status: 400,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  }

  const cacheUrl = new URL(request.url);
  cacheUrl.search = '?resource=' + resource;
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-tintin-cache', 'hit');
    return new Response(cached.body, { status: cached.status, headers });
  }

  try {
    const payload = await buildPayload(env, resource);
    const response = Response.json(payload, {
      headers: {
        'cache-control': 'public, max-age=30, s-maxage=60',
        'x-content-type-options': 'nosniff',
        'x-tintin-cache': 'miss'
      }
    });
    const task = cache.put(cacheKey, response.clone());
    if (typeof waitUntil === 'function') waitUntil(task);
    else await task;
    return response;
  } catch (error) {
    console.error(JSON.stringify({ message: 'public-catalog failed', resource, error: error?.message || String(error) }));
    return Response.json({ ok: false, error: 'catalog_unavailable' }, {
      status: 502,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  }
}
`);

fs.mkdirSync(path.join(root, 'js/core/firebase'), { recursive: true });
write('js/core/firebase/catalogo-publico-api.js', `const ENDPOINT = '/api/public-catalog';
const TIMEOUT_MS = 8000;

export async function fetchPublicCatalogResource(resource) {
  const normalized = resource === 'collections' ? 'collections' : resource === 'products' ? 'products' : '';
  if (!normalized) throw new Error('Recurso público de catálogo inválido');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT + '?resource=' + encodeURIComponent(normalized), {
      method: 'GET',
      credentials: 'omit',
      cache: 'default',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('API pública de catálogo respondió ' + response.status);
    const payload = await response.json();
    if (!payload?.ok || payload.resource !== normalized || !Array.isArray(payload.items)) {
      throw new Error('Respuesta pública de catálogo inválida');
    }
    return payload.items;
  } finally {
    window.clearTimeout(timer);
  }
}
`);

// Integrar primero el edge cache; Firestore directo queda solo como fallback resiliente.
let productsStore = read('js/core/store/estado-productos.js');
const productsImportMarker = "import { listPublicCollectionRest } from '../firebase/respaldo-rest-firestore.js?v=tintin-20260726-browser-fallback-1';";
assert(productsStore.includes(productsImportMarker), 'estado-productos.js: import REST esperado no encontrado.');
productsStore = productsStore.replace(productsImportMarker, productsImportMarker + "\nimport { fetchPublicCatalogResource } from '../firebase/catalogo-publico-api.js?v=tintin-20260814-edge-catalog-1';");
const oldFetchAll = `async function fetchAllProducts() {
  let products;
  try {
    products = await fetchAllProductsFromRest();
  } catch (restError) {
    if (!await appCheckReady) throw restError;
    products = await fetchAllProductsFromSdk();
  }
  products = normalizeList(products);
  const cards = products.map(compactProduct);
  // Un catálogo vacío no es una caché útil. Una lectura transitoria bloqueada
  // por App Check, red o un despliegue nunca debe dejar al navegador mostrando
  // "0 productos" durante todo el TTL después de que Firestore se recupere.
  // El resultado vacío sí se publica para esta carga, pero la próxima visita
  // vuelve a consultar el servidor en lugar de confiar en ese vacío.
  if (cards.length) writeCached(ALL_CACHE_KEY, cards);
  return publish(products, 'server-or-rest-fallback');
}`;
const newFetchAll = `async function fetchAllProducts() {
  let products;
  try {
    const items = await fetchPublicCatalogResource('products');
    products = items.map(item => mapProduct(item.id, item.data));
  } catch (edgeError) {
    try {
      products = await fetchAllProductsFromRest();
    } catch (restError) {
      if (!await appCheckReady) throw restError;
      products = await fetchAllProductsFromSdk();
    }
  }
  products = normalizeList(products);
  const cards = products.map(compactProduct);
  // Un catálogo vacío no es una caché útil. Una lectura transitoria bloqueada
  // por red o un despliegue nunca debe dejar al navegador mostrando "0 productos".
  if (cards.length) writeCached(ALL_CACHE_KEY, cards);
  return publish(products, 'edge-or-firestore-fallback');
}`;
assert(productsStore.includes(oldFetchAll), 'estado-productos.js: fetchAllProducts esperado no encontrado.');
productsStore = productsStore.replace(oldFetchAll, newFetchAll);
productsStore = productsStore.replace(
  "if (/(^|\\/)(?:catalogo|collections)(?:\\.html)?$/.test(path)) {\n    return startPublicProductsRealtime();\n  }",
  "if (/(^|\\/)(?:catalogo|collections)(?:\\.html)?$/.test(path)) {\n    return loadAllProducts();\n  }"
);
assert(productsStore.includes('return loadAllProducts();'), 'estado-productos.js: el catálogo público todavía depende del listener completo.');
write('js/core/store/estado-productos.js', productsStore);

let collectionsStore = read('js/pages/collections/estado-colecciones.js');
const collectionsImportMarker = "import { listPublicCollectionRest } from '../../core/firebase/respaldo-rest-firestore.js?v=tintin-20260726-browser-fallback-1';";
assert(collectionsStore.includes(collectionsImportMarker), 'estado-colecciones.js: import REST esperado no encontrado.');
collectionsStore = collectionsStore.replace(collectionsImportMarker, collectionsImportMarker + "\nimport { fetchPublicCatalogResource } from '../../core/firebase/catalogo-publico-api.js?v=tintin-20260814-edge-catalog-1';");
const oldCollectionsFetch = `async function fetchPublicCollections() {
  let list;
  try {
    const documents = await listPublicCollectionRest('collections', 200);
    recordFirestoreRead('collections:public-rest-fallback', documents.length);
    list = documents.map(item => normalizeCollectionDoc(item.id, item.data));
  } catch (restError) {
    if (!await appCheckReady) throw restError;
    const snapshot = await getDocs(query(collection(db, 'collections'), limit(200)));
    recordFirestoreRead('collections:public', snapshot.size);
    list = snapshot.docs.map(item => normalizeCollectionDoc(item.id, item.data()));
  }
  writeCached(CACHE_KEY, list);
  return publishPublic(list, 'server-or-rest-fallback');
}`;
const newCollectionsFetch = `async function fetchPublicCollections() {
  let list;
  try {
    const documents = await fetchPublicCatalogResource('collections');
    list = documents.map(item => normalizeCollectionDoc(item.id, item.data));
  } catch (edgeError) {
    try {
      const documents = await listPublicCollectionRest('collections', 200);
      recordFirestoreRead('collections:public-rest-fallback', documents.length);
      list = documents.map(item => normalizeCollectionDoc(item.id, item.data));
    } catch (restError) {
      if (!await appCheckReady) throw restError;
      const snapshot = await getDocs(query(collection(db, 'collections'), limit(200)));
      recordFirestoreRead('collections:public', snapshot.size);
      list = snapshot.docs.map(item => normalizeCollectionDoc(item.id, item.data()));
    }
  }
  writeCached(CACHE_KEY, list);
  return publishPublic(list, 'edge-or-firestore-fallback');
}`;
assert(collectionsStore.includes(oldCollectionsFetch), 'estado-colecciones.js: fetch público esperado no encontrado.');
write('js/pages/collections/estado-colecciones.js', collectionsStore.replace(oldCollectionsFetch, newCollectionsFetch));

const routes = JSON.parse(read('_routes.json'));
if (!routes.include.includes('/api/public-catalog')) {
  const pivot = routes.include.indexOf('/api/notifications');
  routes.include.splice(pivot >= 0 ? pivot + 1 : routes.include.length, 0, '/api/public-catalog');
}
write('_routes.json', JSON.stringify(routes, null, 2) + '\n');

// 3) Auditor de presupuesto: ahora debe impedir que vuelva el listener completo por visitante.
let readBudget = read('scripts/auditar-firestore-lecturas-presupuesto.js');
readBudget = readBudget.replace(
  "const readCache = read('js/core/firebase/cache-lecturas-firestore.js');",
  "const readCache = read('js/core/firebase/cache-lecturas-firestore.js');\nconst publicCatalogApi = read('functions/api/public-catalog.js');\nconst publicCatalogClient = read('js/core/firebase/catalogo-publico-api.js');\nconst routesConfig = read('_routes.json');"
);
const oldListenerCheck = `check(
  'Productos abre un solo listener acotado en páginas comerciales',
  products.includes('onSnapshot') &&
    products.includes('startPublicProductsRealtime') &&
    /query\\(collection\\(db,\\s*['\"]products['\"]\\),\\s*limit\\(1000\\)\\)/.test(products) &&
    products.includes("window.addEventListener('pagehide'") &&
    /(?:index\\|catalogo\\|collections)/.test(products),
  'El canal en vivo debe estar acotado, limitado a páginas comerciales y cerrarse al salir.'
);`;
const newListenerCheck = `check(
  'Catálogo público evita un listener completo por visitante',
  products.includes('startPublicProductsRealtime') &&
    products.includes('return loadAllProducts();') &&
    !/catalogo\\|collections[\\s\\S]{0,160}return startPublicProductsRealtime\\(\\)/.test(products),
  'Catálogo y colecciones deben usar carga cacheada; el listener completo no puede abrirse automáticamente.'
);
check(
  'Catálogo público usa caché edge con fallback seguro',
  publicCatalogApi.includes('caches.default') &&
    publicCatalogApi.includes("s-maxage=60") &&
    publicCatalogApi.includes('PRODUCT_FIELDS') &&
    publicCatalogClient.includes("/api/public-catalog") &&
    products.includes("fetchPublicCatalogResource('products')") &&
    collections.includes("fetchPublicCatalogResource('collections')") &&
    routesConfig.includes('"/api/public-catalog"'),
  'La lectura masiva debe concentrarse en Cloudflare y publicar únicamente campos permitidos.'
);`;
assert(readBudget.includes(oldListenerCheck), 'auditar-firestore-lecturas-presupuesto.js: check viejo no encontrado.');
readBudget = readBudget.replace(oldListenerCheck, newListenerCheck);
readBudget = readBudget.replace(
  "check('Colecciones públicas usan getDocs y caché', collections.includes('getDocs') && collections.includes('loadCollections') && collections.includes('CACHE_TTL'), 'El menú público no debe mantener un listener.');",
  "check('Colecciones públicas usan edge y conservan fallback acotado', collections.includes(\"fetchPublicCatalogResource('collections')\") && collections.includes('getDocs') && collections.includes('loadCollections') && collections.includes('CACHE_TTL'), 'El menú público debe preferir edge y conservar Firestore solo como respaldo.');"
);
write('scripts/auditar-firestore-lecturas-presupuesto.js', readBudget);

// 4) SEO estático y pruebas adaptados a rutas limpias.
write('scripts/auditar-fase-11-seo.js', `'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const origin = 'https://tintinaccesorios.pages.dev';
const indexed = ["index.html","catalogo.html","collections.html","product.html","about.html","contact.html","envios.html","cambios-devoluciones.html","preguntas-frecuentes.html","terminos.html","privacidad.html"];
const noindex = ["404.html","admin.html","admin-images.html","checkout.html","login.html","perfil.html","nosotros.html"];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const routeFor = file => file === 'index.html' ? '/' : '/' + file.replace(/\\.html$/, '');
const checks = [];
const check = (name, ok, problem) => checks.push({ name, ok: Boolean(ok), problem });
const count = (text, regex) => (text.match(regex) || []).length;

for (const file of indexed) {
  const html = read(file);
  const expected = origin + routeFor(file);
  check(file + ': título único', count(html, /<title>/gi) === 1 && /<title>[^<]{8,}<\\/title>/i.test(html), 'Cada página indexable necesita un título descriptivo.');
  check(file + ': descripción única', count(html, /<meta\\b[^>]*name=["']description["']/gi) === 1, 'Debe existir una sola descripción.');
  check(file + ': canonical único', count(html, /<link\\b[^>]*rel=["']canonical["']/gi) === 1 && html.includes('href="' + expected), 'El canonical debe usar la URL limpia que Cloudflare sirve finalmente.');
  check(file + ': Open Graph completo', /property="og:title"/.test(html) && /property="og:description"/.test(html) && /property="og:image"/.test(html) && html.includes('property="og:url" content="' + expected), 'Faltan etiquetas sociales absolutas o usan una URL redirigida.');
  check(file + ': Twitter completo', /name="twitter:card" content="summary_large_image"/.test(html) && /name="twitter:title"/.test(html) && /name="twitter:description"/.test(html) && /name="twitter:image"/.test(html), 'Faltan etiquetas para compartir.');
  check(file + ': PWA e iconos', /rel="manifest" href="manifest.json"/.test(html) && /apple-touch-icon/.test(html) && /favicon-32x32/.test(html), 'La publicación debe conservar manifest e iconos.');
  check(file + ': indexable', /name="robots" content="index, follow, max-image-preview:large"/.test(html), 'La página pública debe declarar indexación coherente.');
}
for (const file of noindex) {
  const html = read(file);
  check(file + ': noindex', /<meta\\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*\\bnoindex\\b)[^>]*>/i.test(html), 'Las superficies privadas, auxiliares o duplicadas no deben indexarse.');
}

const activeFiles = [
  ...fs.readdirSync(root).filter(file => file !== 'diagnostic-manifest.json' && /\\.(?:html|js|json|xml|txt)$/.test(file)),
  ...fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js')).map(file => 'js/' + file),
  ...fs.readdirSync(path.join(root, 'functions/api')).filter(file => file.endsWith('.js')).map(file => 'functions/api/' + file)
];
const oldRefs = activeFiles.filter(file => read(file).includes('tintinaccs.github.io/tintin-web'));
check('No quedan URLs activas de GitHub Pages', oldRefs.length === 0, 'Referencias antiguas: ' + oldRefs.join(', '));

const script = read('tienda.js');
check('Producto genera canonical absoluto y estable', script.includes("new URL('/product', '" + origin + "')") && script.includes("canonicalProductUrl.searchParams.set('id', String(product.id))"), 'El producto no debe canonicalizar una URL .html que Cloudflare redirige.');
check('Producto publica JSON-LD vigente', /'@type': 'Product'/.test(script) && /priceCurrency: 'PYG'/.test(script) && /schema.org\\/InStock/.test(script) && /schema.org\\/OutOfStock/.test(script) && /canonicalProductUrl.href/.test(script), 'Los datos estructurados deben reflejar precio, moneda, URL y stock.');

const sitemapText = read('sitemap.xml');
const locations = [...sitemapText.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(match => match[1]);
const expectedLocations = indexed.filter(file => file !== 'product.html').map(file => origin + routeFor(file));
check('Sitemap contiene solo URLs finales indexables', JSON.stringify(locations) === JSON.stringify(expectedLocations), 'El sitemap debe coincidir exactamente con las URLs limpias públicas.');
check('Sitemap no publica URLs .html', !locations.some(url => /\\.html(?:$|[?#])/.test(url)), 'Cloudflare redirige .html; el sitemap no debe publicar destinos intermedios.');
check('robots enlaza el sitemap vigente', read('robots.txt').includes('Sitemap: ' + origin + '/sitemap.xml'), 'robots.txt debe enlazar el sitemap de producción.');

const manifestData = JSON.parse(read('manifest.json'));
check('Manifest tiene identidad, scope e iconos válidos', manifestData.id === '/' && manifestData.start_url === '/' && manifestData.scope === '/' && manifestData.icons?.some(icon => icon.sizes === '192x192') && manifestData.icons?.some(icon => icon.sizes === '512x512'), 'La PWA debe instalarse desde la URL raíz final.');
check('Inicio publica Store JSON-LD', /id="tt-store-jsonld"/.test(read('index.html')) && /"@type":"Store"/.test(read('index.html')) && read('index.html').includes('"url":"' + origin + '/"'), 'La organización debe usar la URL raíz canónica.');

for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  const html = read(file);
  for (const match of html.matchAll(/(?:^|\\s)(?:href|src)=["']([^"']+)["']/g)) {
    const raw = match[1];
    if (!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|#|\\/\\/)/i.test(raw) || raw.includes('${')) continue;
    const clean = raw.split(/[?#]/)[0].replace(/^\\//, '');
    if (!clean) continue;
    const resolved = path.normalize(path.join(path.dirname(file), clean));
    check(file + ': recurso local ' + raw, fs.existsSync(path.join(root, resolved)), 'Enlace o recurso local roto.');
  }
}

const pkg = JSON.parse(read('package.json'));
check('Fase 11 forma parte del cierre', pkg.scripts['audit:phase11'] === 'node scripts/auditar-fase-11-seo.js' && pkg.scripts['test:phase11-seo'] === 'playwright test tests/seo/phase11-seo.spec.js --project=chromium' && pkg.scripts['audit:final'].includes('audit:phase11'), 'Las verificaciones SEO deben quedar permanentes.');
check('Existe monitor de producción', fs.existsSync(path.join(root, 'scripts/auditar-produccion-salud.mjs')) && fs.existsSync(path.join(root, '.github/workflows/seo-produccion-fase-11.yml')), 'La disponibilidad pública debe revisarse de forma recurrente.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => { console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.name); if (!item.ok) console.log('  ' + item.problem); });
if (failed.length) { console.error('\\nAuditoría Fase 11 fallida: ' + failed.length + ' problema(s).'); process.exit(1); }
console.log('\\nAuditoría Fase 11: SEO y publicación correctos (' + checks.length + ' comprobaciones).');
`);

let seoTest = read('tests/seo/phase11-seo.spec.js');
seoTest = seoTest.split('https://tintinaccesorios.pages.dev/index.html').join('https://tintinaccesorios.pages.dev/');
seoTest = seoTest.replace("new URL('/product.html?id=seo-prueba', location.origin).href", "new URL('/product?id=seo-prueba', location.origin).href");
seoTest = seoTest.replace("new URL('/product.html?id=seo-prueba', 'https://tintinaccesorios.pages.dev').href", "new URL('/product?id=seo-prueba', 'https://tintinaccesorios.pages.dev').href");
write('tests/seo/phase11-seo.spec.js', seoTest);

// 5) Monitores de producción: validan URL final y CSP fuerte, no solo que el header exista.
write('scripts/auditar-produccion-salud.mjs', `import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\\/$/, '');
const timeoutMs = Number(process.env.TINTIN_HEALTH_TIMEOUT_MS || 15000);
const attempts = 3;
const results = [];
const corePages = ['/', '/catalogo', '/collections', '/product'];

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: options.redirect || 'follow',
        headers: { 'user-agent': 'TintinProductionHealth/2.0 (+https://tintinaccesorios.pages.dev/)' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status >= 500) throw new Error('HTTP ' + response.status);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

function assertStrongCsp(value, route) {
  const csp = String(value || '');
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'frame-ancestors', 'upgrade-insecure-requests']) {
    if (!csp.includes(directive)) throw new Error(route + ': CSP débil o incompleta; falta ' + directive + '.');
  }
}

async function inspect(relative, expectedType) {
  const requestedUrl = origin + relative;
  const started = Date.now();
  try {
    const response = await fetchWithRetry(requestedUrl);
    const body = await response.text();
    const type = response.headers.get('content-type') || '';
    const headers = Object.fromEntries(['content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','cache-control'].map(name => [name, response.headers.get(name) || '']));
    const ok = response.ok && (!expectedType || type.includes(expectedType));
    results.push({ requestedUrl, finalUrl: response.url, redirected: response.redirected, status: response.status, ms: Date.now() - started, type, ok, bytes: body.length, headers });
    if (!ok) throw new Error('Respuesta inesperada: ' + response.status + ' ' + type);
    return { body, response, headers };
  } catch (error) {
    results.push({ requestedUrl, status: 0, ms: Date.now() - started, type: '', ok: false, error: String(error?.message || error) });
    throw error;
  }
}

let failure = null;
try {
  for (const route of corePages) {
    const result = await inspect(route, 'text/html');
    if (result.response.url !== origin + route) throw new Error(route + ': la URL final no coincide con la canónica limpia.');
    assertStrongCsp(result.headers['content-security-policy'], route);
  }
  const home = results.find(item => item.requestedUrl === origin + '/');
  if (!home?.headers?.['strict-transport-security'] || !home?.headers?.['x-content-type-options'] || !home?.headers?.['x-frame-options'] || !home?.headers?.['referrer-policy']) {
    throw new Error('Inicio no entrega todos los headers de seguridad obligatorios.');
  }
  const homeBody = (await fetchWithRetry(origin + '/')).text();
  const resolvedHomeBody = await homeBody;
  if (!resolvedHomeBody.includes('<link rel="canonical" href="' + origin + '/">')) throw new Error('Canonical de inicio ausente o incorrecto.');
  if (resolvedHomeBody.includes('tintinaccs.github.io/tintin-web')) throw new Error('Producción todavía expone una URL antigua de GitHub Pages.');

  const robots = await inspect('/robots.txt', 'text/plain');
  if (!robots.body.includes('Sitemap: ' + origin + '/sitemap.xml')) throw new Error('robots.txt no apunta al sitemap vigente.');
  const sitemap = await inspect('/sitemap.xml', 'xml');
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(match => match[1]);
  if (!urls.length || urls.some(url => !url.startsWith(origin + '/')) || urls.some(url => /\\.html(?:$|[?#])/.test(url))) throw new Error('Sitemap vacío, con otro origen o con URLs .html redirigidas.');
  await inspect('/manifest.json', 'json');
} catch (error) {
  failure = error;
}

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/phase11-production-health.json'), JSON.stringify({ checkedAt: new Date().toISOString(), origin, ok: !failure, results, error: failure ? String(failure.message || failure) : '' }, null, 2));
results.forEach(item => console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.requestedUrl + ' → ' + (item.finalUrl || 'n/d') + ' — ' + (item.status || item.error) + ' — ' + item.ms + ' ms'));
if (failure) { console.error('\\nMonitoreo de producción fallido:', failure); process.exit(1); }
console.log('\\nProducción disponible, URLs finales y headers fuertes verificados.');
`);

write('scripts/produccion-smoke-fase-12.mjs', `import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\\/$/, '');
const publicOrigin = new URL(origin).origin;
const timeoutMs = Number(process.env.TINTIN_PHASE12_TIMEOUT_MS || 20000);
const attempts = 3;
const results = [];
const indexablePages = ['/', '/catalogo', '/collections', '/about', '/contact', '/envios', '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(relative) {
  const url = origin + relative;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'TintinPhase12Smoke/2.0 (+https://tintinaccesorios.pages.dev/)' }, signal: AbortSignal.timeout(timeoutMs) });
      const body = await response.text();
      const result = { relative, requestedUrl: url, url: response.url, redirected: response.redirected, status: response.status, ok: response.ok, ms: Date.now() - started, type: response.headers.get('content-type') || '', bytes: body.length, headers: Object.fromEntries(['content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','cache-control'].map(name => [name, response.headers.get(name) || ''])) };
      if (response.status >= 500) throw new Error('HTTP ' + response.status);
      results.push(result);
      return { response, body, result };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1200);
    }
  }
  results.push({ relative, url, status: 0, ok: false, ms: timeoutMs * attempts, error: String(lastError?.message || lastError) });
  throw lastError;
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function assertStrongCsp(value, page) {
  const csp = String(value || '');
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'frame-ancestors', 'upgrade-insecure-requests']) assert(csp.includes(directive), page + ': CSP incompleta; falta ' + directive + '.');
}
function assertManifestUrlIsLocal(value, fieldName) {
  const raw = String(value || '').trim(); assert(raw, 'El ' + fieldName + ' del manifest está vacío.');
  let resolved; try { resolved = new URL(raw, origin + '/'); } catch { throw new Error('El ' + fieldName + ' del manifest no es una URL válida.'); }
  assert(resolved.origin === publicOrigin, 'El ' + fieldName + ' del manifest apunta a otro origen.'); return resolved;
}

let failure = null;
try {
  for (const page of indexablePages) {
    const { response, body, result } = await request(page);
    assert(response.ok, page + ' respondió ' + response.status);
    assert(result.url === origin + page, page + ' no terminó en su URL canónica limpia.');
    assert((response.headers.get('content-type') || '').includes('text/html'), page + ' no devolvió HTML.');
    assert(/<title>[^<]{3,}<\\/title>/i.test(body), page + ' no tiene título útil.');
    assert(body.includes('<link rel="canonical" href="' + origin + page + '">'), page + ' tiene canonical incorrecto.');
    assert(!body.includes('tintinaccs.github.io/tintin-web'), page + ' expone el origen antiguo.');
    assertStrongCsp(result.headers['content-security-policy'], page);
    for (const header of ['strict-transport-security','x-content-type-options','x-frame-options','referrer-policy']) assert(Boolean(result.headers[header]), page + ' no entrega ' + header + '.');
  }
  const notFound = await request('/404');
  assert(/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(notFound.body), '404 no declara noindex.');
  const robots = await request('/robots.txt');
  assert(robots.response.ok && robots.result.type.includes('text/plain'), 'robots.txt no está disponible como texto.');
  assert(robots.body.includes('Sitemap: ' + origin + '/sitemap.xml'), 'robots.txt no apunta al sitemap de producción.');
  const sitemap = await request('/sitemap.xml');
  assert(sitemap.response.ok && /xml/.test(sitemap.result.type), 'sitemap.xml no está disponible como XML.');
  const sitemapUrls = [...sitemap.body.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(match => match[1]);
  for (const page of indexablePages) assert(sitemapUrls.includes(origin + page), 'El sitemap no incluye ' + page);
  assert(!sitemapUrls.some(url => /\\.html(?:$|[?#])/.test(url)), 'El sitemap publica URLs .html que Cloudflare redirige.');
  assert(!sitemapUrls.some(url => /\\/(admin|login|checkout|perfil|404)(?:\\.html)?$/.test(url)), 'El sitemap expone una superficie privada.');
  const manifestResponse = await request('/manifest.json');
  assert(manifestResponse.response.ok && manifestResponse.result.type.includes('json'), 'manifest.json no está disponible como JSON.');
  const manifestData = JSON.parse(manifestResponse.body);
  assert(manifestData.name && manifestData.short_name, 'El manifest no identifica la aplicación.');
  assert(Array.isArray(manifestData.icons) && manifestData.icons.length >= 2, 'El manifest no contiene iconos suficientes.');
  assert(assertManifestUrlIsLocal(manifestData.start_url, 'start_url').pathname === '/', 'start_url debe ser la raíz limpia.');
  if (manifestData.scope) assertManifestUrlIsLocal(manifestData.scope, 'scope');
  const homeResult = results.find(item => item.relative === '/');
  assert(/no-cache|no-store/.test(homeResult?.headers?.['cache-control'] || ''), 'El HTML inicial no evita una caché obsoleta.');
} catch (error) { failure = error; }

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/phase12-production-smoke.json'), JSON.stringify({ checkedAt: new Date().toISOString(), origin, ok: !failure, routes: results, error: failure ? String(failure.message || failure) : '' }, null, 2));
for (const item of results) console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.relative + ' — ' + (item.status || item.error) + ' — ' + item.ms + ' ms');
if (failure) { console.error('\\nSmoke de producción fallido:', failure.message || failure); process.exit(1); }
console.log('\\nProducción verificada con URLs limpias y CSP fuerte: ' + results.length + ' respuestas correctas.');
`);

// 6) Acciones oficiales actuales y gate de dependencias de producción más estricto.
const workflowsDir = path.join(root, '.github/workflows');
for (const name of fs.readdirSync(workflowsDir).filter(name => /\.ya?ml$/i.test(name))) {
  const file = `.github/workflows/${name}`;
  let content = read(file);
  content = content
    .replace(/actions\/checkout@v[45]/g, 'actions/checkout@v6')
    .replace(/actions\/setup-node@v[45]/g, 'actions/setup-node@v6')
    .replace(/actions\/setup-java@v4/g, 'actions/setup-java@v5')
    .replace(/actions\/upload-artifact@v[45]/g, 'actions/upload-artifact@v6')
    .replace(/actions\/download-artifact@v[45]/g, 'actions/download-artifact@v6');
  write(file, content);
}
let phase12 = read('.github/workflows/entrega-final-fase-12.yml');
phase12 = phase12.replace('npm audit --omit=dev --audit-level=critical', 'npm audit --omit=dev --audit-level=moderate');
write('.github/workflows/entrega-final-fase-12.yml', phase12);

// 7) Corregir documentación de backup: el respaldo completo sí existe; lo excluido es solo el JSON local del panel.
let recovery = read('docs/recuperacion-firestore.md');
recovery = recovery.replace('## Lo que no existe: pedidos, usuarios y registros', '## Lo que no entra en la copia operativa local: pedidos, usuarios y registros');
write('docs/recuperacion-firestore.md', recovery);

write('docs/cierre-produccion-manual.md', `# Cierre manual de producción\n\nEste checklist contiene únicamente controles que no se pueden certificar desde el repositorio. No reemplaza las auditorías automáticas.\n\n## 1. Recuperación fuera de la misma cuenta\n\n- Mantener PITR, copia diaria, copia semanal y delete protection de Firestore activos.\n- Después de una exportación administrada completa, conservar una copia cifrada fuera de la misma cuenta principal de Google (cuenta separada o almacenamiento offline controlado).\n- No exportar pedidos/usuarios a JSON desde el navegador: contienen datos personales.\n- Registrar fecha, tamaño/conteo y ubicación de la copia externa en el inventario de recuperación.\n\n## 2. Acceso a infraestructura\n\nVerificar 2FA/passkey y códigos de recuperación para Google/Firebase, GitHub y Cloudflare. Guardar los códigos fuera de la misma sesión/dispositivo que protege la cuenta. Revisar sesiones activas y eliminar las que no se reconozcan.\n\n## 3. Compra transaccional controlada\n\nHacer una compra real de importe mínimo con un producto de prueba o de stock conocido. Confirmar, en este orden: creación del pedido, descuento exacto de stock, correo recibido, pedido visible para operación, transición de estado y datos de entrega/facturación. Luego revertir o cerrar el pedido de prueba siguiendo el flujo normal, sin editar Firestore a mano.\n\n## 4. Evidencia\n\nGuardar fecha, ID del pedido de prueba, resultado del correo, stock antes/después y cualquier incidencia. Si un paso falla, no repetir compras en bucle: corregir primero la causa.\n`);

// 8) Contrato estructural del nuevo edge cache.
fs.mkdirSync(path.join(root, 'tests/catalog'), { recursive: true });
write('tests/catalog/public-catalog-cache.test.mjs', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst api = fs.readFileSync('functions/api/public-catalog.js', 'utf8');\nconst products = fs.readFileSync('js/core/store/estado-productos.js', 'utf8');\nconst collections = fs.readFileSync('js/pages/collections/estado-colecciones.js', 'utf8');\nconst routes = fs.readFileSync('_routes.json', 'utf8');\n\ntest('catálogo público pasa por caché edge y usa lista blanca', () => {\n  assert.match(api, /caches\\.default/);\n  assert.match(api, /s-maxage=60/);\n  assert.match(api, /PRODUCT_FIELDS/);\n  assert.match(api, /COLLECTION_FIELDS/);\n  assert.match(api, /pickKnownFields/);\n  assert.match(routes, /\\/api\\/public-catalog/);\n});\n\ntest('clientes prefieren edge y conservan fallback Firestore', () => {\n  assert.match(products, /fetchPublicCatalogResource\\('products'\\)/);\n  assert.match(products, /fetchAllProductsFromRest\\(\\)/);\n  assert.match(products, /fetchAllProductsFromSdk\\(\\)/);\n  assert.match(collections, /fetchPublicCatalogResource\\('collections'\\)/);\n  assert.match(collections, /listPublicCollectionRest\\('collections'/);\n});\n\ntest('catálogo comercial no abre automáticamente el listener completo', () => {\n  assert.doesNotMatch(products, /catalogo\\|collections[\\s\\S]{0,160}return startPublicProductsRealtime\\(\\)/);\n});\n`);

// El script y el workflow son temporales: borrarlos antes de regenerar manifiestos.
for (const relative of [
  'scripts/aplicar-endurecimiento-produccion-temporal.mjs',
  '.github/workflows/aplicar-endurecimiento-produccion-temporal.yml'
]) {
  const absolute = path.join(root, relative);
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
}

console.log('Endurecimiento quirúrgico aplicado al árbol de trabajo.');
