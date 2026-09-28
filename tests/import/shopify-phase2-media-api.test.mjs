import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mediaCopyBatchLimit, mediaCopyPreflight, readBoundedMediaBody, readBoundedRequestText } from '../../functions/api/admin-import-media.js';

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
  assert.match(source, /MAX_BODY_BYTES = 96 \* 1024/);
  assert.match(source, /redirect: 'manual'/);
  assert.match(source, /validateMediaSourceUrl/);
  assert.match(source, /MEDIA_TOO_LARGE/);
  assert.match(source, /AbortSignal\.timeout\(SOURCE_FETCH_TIMEOUT_MS\)/);
  assert.doesNotMatch(source, /response\.arrayBuffer\(\)/);
  assert.match(source, /items\.length > MAX_COPY_ITEMS/);
});

test('media copy batch stays below the free Worker external subrequest cap', () => {
  assert.equal(mediaCopyBatchLimit(), 20);
  assert.equal(mediaCopyBatchLimit({ limit: 50, reserve: 40, requestsPerItem: 2 }), 5);
  assert.equal(mediaCopyBatchLimit({ limit: 50, reserve: 60, requestsPerItem: 2 }), 0);
  assert.equal(mediaCopyBatchLimit({ limit: 50, reserve: 10, requestsPerItem: 0 }), 0);
});

test('preflight de medios no expone credenciales y exige guardia más Cloudinary', () => {
  assert.deepEqual(mediaCopyPreflight({}), {
    ready: false,
    mediaWriteEnabled: false,
    cloudinaryConfigured: false,
    reasons: ['MEDIA_COPY_DISABLED', 'CLOUDINARY_NOT_CONFIGURED'],
  });
  assert.deepEqual(mediaCopyPreflight({
    SHOPIFY_PHASE2_MEDIA_WRITE: '1',
    CLOUDINARY_CLOUD_NAME: 'cloud',
    CLOUDINARY_API_KEY: 'public-key',
    CLOUDINARY_API_SECRET: 'private-secret',
  }), {
    ready: true,
    mediaWriteEnabled: true,
    cloudinaryConfigured: true,
    reasons: [],
  });
  assert.doesNotMatch(JSON.stringify(mediaCopyPreflight({
    SHOPIFY_PHASE2_MEDIA_WRITE: '1',
    CLOUDINARY_CLOUD_NAME: 'cloud',
    CLOUDINARY_API_KEY: 'public-key',
    CLOUDINARY_API_SECRET: 'private-secret',
  })), /private-secret|public-key|"cloud"/);
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

test('media limita el body JSON por streaming y cancela al superar el máximo', async () => {
  let cancelled = false;
  const request = new Request('https://example.test/', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"media":['));
        controller.enqueue(new Uint8Array(12));
      },
      cancel() { cancelled = true; },
    }),
    duplex: 'half',
  });
  await assert.rejects(readBoundedRequestText(request, 10), error => error.status === 413);
  assert.equal(cancelled, true);
});
