import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readBoundedMediaBody } from '../../functions/api/admin-import-media.js';

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
  assert.match(source, /AbortSignal\.timeout\(SOURCE_FETCH_TIMEOUT_MS\)/);
  assert.doesNotMatch(source, /response\.arrayBuffer\(\)/);
});

test('media corta la lectura al superar el máximo y cancela la descarga', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(3));
      controller.enqueue(new Uint8Array(3));
      controller.enqueue(new Uint8Array(3));
    },
    cancel() { cancelled = true; },
  }));

  await assert.rejects(readBoundedMediaBody(response, 5), error => error.code === 'MEDIA_TOO_LARGE');
  assert.equal(cancelled, true);
});

test('media conserva bytes válidos y rechaza content-length excesivo antes de leer', async () => {
  const valid = new Response(new Uint8Array([1, 2, 3]));
  assert.deepEqual([...new Uint8Array(await readBoundedMediaBody(valid, 3))], [1, 2, 3]);

  let read = false;
  const oversized = new Response(new ReadableStream({
    pull(controller) { read = true; controller.enqueue(new Uint8Array([1])); },
  }), { headers: { 'content-length': '6' } });
  await assert.rejects(readBoundedMediaBody(oversized, 5), error => error.code === 'MEDIA_TOO_LARGE');
  assert.equal(read, false);
});
