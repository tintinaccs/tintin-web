import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const runtime = JSON.parse(read('config/csp-runtime.json'));

function routeCsp(route) {
  const policy = runtime?.routes?.[route];
  assert.ok(policy, `no existe CSP runtime para ${route}`);
  return policy;
}

test('Cloudinary upload solo queda permitido en superficies Admin', () => {
  const signer = read('functions/api/cloudinary-sign-upload.js');
  const uploadUrlMatch = signer.match(/uploadUrl:\s*`(https:\/\/[^/`$]+)/);
  assert.ok(uploadUrlMatch, 'no se encontró el origen de uploadUrl en cloudinary-sign-upload.js');
  const uploadOrigin = uploadUrlMatch[1];

  for (const route of ['/admin', '/admin-images']) {
    assert.ok(routeCsp(route).includes(uploadOrigin), `${route} necesita ${uploadOrigin} para la biblioteca multimedia`);
  }

  for (const route of ['/', '/catalogo', '/collections', '/product', '/about', '/contact', '/checkout', '/login', '/perfil']) {
    assert.ok(!routeCsp(route).includes(uploadOrigin), `${route} no debe autorizar el endpoint de upload de Cloudinary`);
  }
});

test('CSP no vuelve a abrir handlers inline de forma global', () => {
  const policies = Object.values(runtime?.routes || {});
  assert.ok(policies.length > 0, 'faltan CSP runtime específicas por página');
  for (const policy of policies) {
    assert.ok(!policy.includes("script-src-attr 'unsafe-inline'"), 'script-src-attr no debe volver a unsafe-inline');
    assert.ok(policy.includes("script-src-attr 'unsafe-hashes'") || policy.includes("script-src-attr 'none'"));
  }
});

test('_headers conserva solo una CSP fallback corta y middleware aplica la completa', () => {
  const headers = read('_headers');
  const middleware = read('functions/_middleware.js');
  const cspLines = headers.split(/\r?\n/).filter(line => line.includes('Content-Security-Policy:'));
  assert.equal(cspLines.length, 1, '_headers debe tener una sola CSP fallback estática');
  assert.ok(cspLines[0].length <= 2000, 'la CSP fallback debe respetar el límite por línea de Pages');
  assert.ok(cspLines[0].includes("script-src-attr 'none'"));
  assert.ok(!cspLines[0].includes('https://api.cloudinary.com'));
  assert.ok(!cspLines[0].includes("script-src 'self' 'unsafe-inline'"));
  assert.ok(headers.split(/\r?\n/).every(line => line.length <= 2000), '_headers debe respetar el límite por línea de Pages');
  assert.ok(middleware.includes("headers.set('Content-Security-Policy', policy)"));
  assert.ok(middleware.includes("'X-Tintin-CSP', 'edge-runtime'"));
});

test('Pages Functions consume el módulo JS generado y no imports JSON con attributes', () => {
  const middleware = read('functions/_middleware.js');
  const adminCsp = read('cloudflare/servir-admin-con-csp.js');
  const generator = read('scripts/generar-csp-cloudflare.js');
  assert.ok(middleware.includes("../config/csp-runtime.js"));
  assert.ok(adminCsp.includes("../config/csp-runtime.js"));
  assert.ok(!middleware.includes('csp-runtime.json'));
  assert.ok(!adminCsp.includes('csp-runtime.json'));
  assert.ok(generator.includes('config/csp-runtime.js'));
});

test('Firebase Auth conserva su proxy transparente fuera de la CSP de la tienda', () => {
  const middleware = read('functions/_middleware.js');
  const authProxy = read('functions/__/auth/[[path]].js');
  assert.ok(middleware.includes("pathname.startsWith('/__/auth/')"));
  assert.ok(middleware.includes("return context.next()"));
  assert.ok(authProxy.includes("responseHeaders.delete('content-security-policy')"));
  assert.ok(authProxy.includes("responseHeaders.delete('x-frame-options')"));
});
