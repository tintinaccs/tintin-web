import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

function routeCsp(headers, route) {
  const lines = headers.replace(/\r\n?/g, '\n').split('\n');
  const index = lines.findIndex(line => line.trim() === route);
  assert.notEqual(index, -1, `no existe bloque CSP para ${route}`);
  const line = lines[index + 1] || '';
  assert.ok(line.includes('Content-Security-Policy:'), `falta CSP después de ${route}`);
  return line;
}

test('Cloudinary upload solo queda permitido en superficies Admin', () => {
  const headers = read('_headers');
  const signer = read('functions/api/cloudinary-sign-upload.js');
  const uploadUrlMatch = signer.match(/uploadUrl:\s*`(https:\/\/[^/`$]+)/);
  assert.ok(uploadUrlMatch, 'no se encontró el origen de uploadUrl en cloudinary-sign-upload.js');
  const uploadOrigin = uploadUrlMatch[1];

  for (const route of ['/admin', '/admin-images']) {
    assert.ok(
      routeCsp(headers, route).includes(uploadOrigin),
      `${route} necesita ${uploadOrigin} para la biblioteca multimedia`
    );
  }

  for (const route of ['/', '/catalogo', '/collections', '/product', '/about', '/contact', '/checkout', '/login', '/perfil']) {
    assert.ok(
      !routeCsp(headers, route).includes(uploadOrigin),
      `${route} no debe autorizar el endpoint de upload de Cloudinary`
    );
  }
});

test('CSP no vuelve a abrir handlers inline de forma global', () => {
  const headers = read('_headers');
  const cspLines = headers.split('\n').filter(line => line.includes('Content-Security-Policy:'));
  const routed = cspLines.filter(line => line.includes('default-src'));
  assert.ok(routed.length > 0, 'faltan CSP específicas por página');
  for (const line of routed) {
    assert.ok(!line.includes("script-src-attr 'unsafe-inline'"), 'script-src-attr no debe volver a unsafe-inline');
    assert.ok(line.includes("script-src-attr 'unsafe-hashes'") || line.includes("script-src-attr 'none'"));
  }
});
