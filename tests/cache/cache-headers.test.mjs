import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const headers = fs.readFileSync(new URL('../../_headers', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const immutable = 'Cache-Control: public, max-age=31536000, immutable';

function expectImmutable(route) {
  assert.ok(headers.includes(`${route}\n  ${immutable}`), `${route} debe conservar caché inmutable`);
}

test('HTML conserva no-cache para permitir publicaciones inmediatas', () => {
  assert.ok(
    headers.includes('/*.html\n  Cache-Control: no-cache, must-revalidate'),
    'HTML no debe quedar cacheado como asset inmutable'
  );
  const globalBlock = headers.split(/\r?\n\s*\r?\n/)[1] || '';
  assert.doesNotMatch(globalBlock, /Cache-Control:.*no-store/i, 'El bloque global no debe desactivar el caché de assets');
});

test('assets versionables conservan caché inmutable', () => {
  for (const route of [
    '/*.css',
    '/*.js',
    '/*.mjs',
    '/assets-tintin/fonts/*',
    '/assets-tintin/images/*',
    '/assets/*',
    '/*.png',
    '/*.ico'
  ]) expectImmutable(route);
});
