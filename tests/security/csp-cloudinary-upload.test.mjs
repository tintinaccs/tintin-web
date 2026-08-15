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

test('_headers no transporta CSP sobredimensionada y middleware la aplica', () => {
  const headers = read('_headers');
  const middleware = read('functions/_middleware.js');
  assert.ok(!headers.includes('Content-Security-Policy:'), 'CSP de HTML no debe volver a _headers');
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
