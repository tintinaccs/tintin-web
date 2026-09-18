import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../functions/api/admin-import-media.js', import.meta.url), 'utf8');

test('media Phase 2 es server-side, Super Admin-only y sin copy por defecto', () => {
  assert.match(source, /requireSuperAdmin\(request\)/);
  assert.match(source, /fetch\(validated\.url/);
  assert.match(source, /image\/upload/);
  assert.match(source, /SHOPIFY_PHASE2_MEDIA_WRITE/);
  assert.match(source, /staging-only/);
  assert.doesNotMatch(source, /window\.|document\./);
});

test('media rechaza origen arbitrario y limita tamaño/volumen', () => {
  assert.match(source, /MAX_ITEMS = 25/);
  assert.match(source, /MAX_BYTES = 15 \* 1024 \* 1024/);
  assert.match(source, /redirect: 'manual'/);
  assert.match(source, /validateMediaSourceUrl/);
  assert.match(source, /MEDIA_TOO_LARGE/);
});
