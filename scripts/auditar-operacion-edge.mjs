import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function check(label, condition) {
  if (condition) console.log(`OK — ${label}`);
  else { failures += 1; console.error(`FAIL — ${label}`); }
}

const routes = JSON.parse(read('_routes.json'));
for (const route of ['/api/health', '/api/public-catalog', '/sitemap-products.xml', '/product']) {
  check(`Pages Functions incluye ${route}`, routes.include?.includes(route));
}

const health = read('functions/api/health.js');
check('health no devuelve valores de secretos', !/missing\s*:\s*REQUIRED_ENV|Object\.fromEntries\([^)]*REQUIRED_ENV/.test(health));
check('health valida configuración y Firestore', health.includes('FIREBASE_SERVICE_ACCOUNT_KEY') && health.includes('firestoreAdminList'));
check('health responde no-store', health.includes("'cache-control': 'no-store'"));

const sitemap = read('functions/sitemap-products.xml.js');
check('sitemap dinámico usa productos reales', sitemap.includes("firestoreAdminListAll(env, 'products'") && sitemap.includes('/product?id='));
check('sitemap dinámico tiene caché edge', sitemap.includes('caches.default') && sitemap.includes('s-maxage=900'));

const product = read('functions/product.js');
check('producto edge conserva el asset original', product.includes('context.next()'));
check('producto edge genera canonical y JSON-LD', product.includes('tt-product-jsonld') && product.includes('/product?id='));
check('producto edge no falla cerrado ante caída de metadatos', product.includes('return assetResponse'));

const monitor = read('scripts/auditar-produccion-salud.mjs');
for (const target of ['/api/health', '/api/public-catalog?resource=collections', '/sitemap-products.xml', 'x-tintin-product-meta']) {
  check(`monitor de producción cubre ${target}`, monitor.includes(target));
}

const headers = read('_headers');
const globalBlock = headers.split('# CSP_ROUTE_POLICIES_START')[0];
for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'self'", "upgrade-insecure-requests"]) {
  check(`CSP global contiene ${directive}`, globalBlock.includes(directive));
}

if (failures) {
  console.error(`\nOperación edge: ${failures} fallo(s).`);
  process.exit(1);
}
console.log('\nOperación edge protegida por contrato.');
