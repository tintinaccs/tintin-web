import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';

import { handleProfileAvatarUpload, onRequest } from '../../functions/api/profile-avatar-upload.js';
import { verifyFirebaseIdToken } from '../../cloudflare/firebase-id-token.js';

const ORIGIN = 'https://tintin.test';
const MAX_BYTES = 5 * 1024 * 1024;
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'avatar-test-key', alg: 'RS256', use: 'sig' };
const env = { CLOUDINARY_CLOUD_NAME: 'avatar-test', CLOUDINARY_API_KEY: 'test-public-key', CLOUDINARY_API_SECRET: 'test-only-secret' };

function token(uid = 'avatar-user-1') {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwk.kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ aud: 'tintin-accesorios', iss: 'https://securetoken.google.com/tintin-accesorios', sub: uid,
    exp: now + 3600, iat: now - 10, auth_time: now - 20, email: 'clienta@example.com', email_verified: true })).toString('base64url');
  const input = `${header}.${payload}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

function request(body, contentType = 'image/png', extraHeaders = {}, uid) {
  return new Request(`${ORIGIN}/api/profile-avatar-upload`, {
    method: 'POST', headers: { origin: ORIGIN, authorization: `Bearer ${token(uid)}`, 'content-type': contentType, ...extraHeaders },
    body, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  });
}

async function withProvider(run, provider) {
  const previousFetch = globalThis.fetch;
  const uploads = [];
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com') {
      return Response.json({ keys: [jwk] }, { headers: { 'cache-control': 'public, max-age=3600' } });
    }
    assert.equal(url, 'https://api.cloudinary.com/v1_1/avatar-test/image/upload', 'ninguna prueba hace peticiones reales');
    uploads.push(options);
    if (provider) return provider(options);
    const publicId = options.body.get('public_id');
    return Response.json({ public_id: publicId, resource_type: 'image', format: 'png', secure_url: `https://res.cloudinary.com/avatar-test/image/upload/v1/${publicId}.png` });
  };
  try { await run(uploads); } finally { globalThis.fetch = previousFetch; }
}

// Verificador criptográfico real; la cuota compartida se prueba por separado
// sin credenciales Firestore ni escrituras reales.
function uploadAvatar(request, selectedEnv = env) {
  return handleProfileAvatarUpload({ request, env: selectedEnv }, {
    requireUser: request => verifyFirebaseIdToken(request.headers.get('authorization').replace(/^Bearer /, '')),
  });
}

test('rechaza metadatos de tamaño falsificables sin entregar una firma reutilizable', async () => {
  await withProvider(async uploads => {
    const response = await uploadAvatar(request(JSON.stringify({ contentType: 'image/png', size: 1 }), 'application/json'));
    assert.equal(response.status, 415);
    assert.equal(uploads.length, 0);
    const body = await response.json();
    assert.equal(body.signature, undefined);
    assert.equal(body.apiKey, undefined);
  });
});

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 1]);
const webp = Uint8Array.from([82, 73, 70, 70, 8, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32]);

test('requiere autenticación en producción antes de leer/subir el cuerpo', async () => {
  await withProvider(async uploads => {
    const unauthenticated = request(png);
    unauthenticated.headers.delete('authorization');
    const response = await onRequest({ request: unauthenticated, env });
    assert.equal(response.status, 401);
    assert.equal(uploads.length, 0);
  });
});

test('rechaza origen ajeno y conserva OPTIONS/405 sin subir nada', async () => {
  await withProvider(async uploads => {
    assert.equal((await uploadAvatar(request(png, 'image/png', { origin: 'https://evil.test' }))).status, 403);
    const options = await onRequest({ request: new Request(`${ORIGIN}/api/profile-avatar-upload`, { method: 'OPTIONS', headers: { origin: ORIGIN } }), env });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal((await onRequest({ request: new Request(`${ORIGIN}/api/profile-avatar-upload`, { headers: { origin: ORIGIN } }), env })).status, 405);
    assert.equal(uploads.length, 0);
  });
});

test('conserva 429/503 de la cuota sin leer cuerpo ni llamar Cloudinary', async () => {
  for (const status of [429, 503]) {
    await withProvider(async uploads => {
      const incoming = request(png);
      const response = await handleProfileAvatarUpload({ request: incoming, env }, {
        requireUser: async (_request, receivedEnv) => {
          assert.equal(receivedEnv, env);
          throw Object.assign(new Error('No se pudo autorizar esta solicitud'), { status, code: status === 429 ? 'rate_limited' : 'rate_limit_unavailable', retryAfter: 45 });
        },
      });
      assert.equal(response.status, status);
      if (status === 429) assert.equal(response.headers.get('retry-after'), '45');
      assert.equal(incoming.bodyUsed, false);
      assert.equal(uploads.length, 0);
    });
  }
});

test('configuración ausente responde 503 sin acceder al proveedor', async () => {
  await withProvider(async uploads => {
    const response = await uploadAvatar(request(png), {});
    assert.equal(response.status, 503);
    assert.equal(uploads.length, 0);
  });
});

for (const status of [400, 500]) {
  test(`fallo Cloudinary ${status} no expone su respuesta privada`, async () => {
    await withProvider(async () => {
      const response = await uploadAvatar(request(png));
      assert.equal(response.status, status === 400 ? 400 : 502);
      assert.equal((await response.text()).includes('upstream-internal-details'), false);
    }, async () => Response.json({ error: { message: 'upstream-internal-details' } }, { status }));
  });
}

test('timeout del proveedor informa 504 y permite reintentar', async () => {
  await withProvider(async () => {
    const response = await uploadAvatar(request(png));
    assert.equal(response.status, 504);
  }, async () => { throw new DOMException('upload timeout', 'TimeoutError'); });
});

for (const [label, overrides] of [
  ['otro propietario', { public_id: 'tintin_profile_other' }],
  ['origen URL ajeno', { secure_url: 'https://evil.test/avatar.png' }],
  ['nube ajena', { secure_url: 'https://res.cloudinary.com/other-cloud/image/upload/v1/avatar.png' }],
  ['URL HTTP', { secure_url: 'http://res.cloudinary.com/avatar-test/image/upload/v1/avatar.png' }],
  ['video', { resource_type: 'video' }],
  ['formato ajeno', { format: 'svg' }],
]) {
  test(`rechaza respuesta del proveedor con ${label}`, async () => {
    await withProvider(async () => {
      const response = await uploadAvatar(request(png));
      assert.equal(response.status, 502);
      assert.equal((await response.json()).secure_url, undefined);
    }, async options => {
      const publicId = options.body.get('public_id');
      return Response.json({ public_id: publicId, resource_type: 'image', format: 'png', secure_url: `https://res.cloudinary.com/avatar-test/image/upload/v1/${publicId}.png`, ...overrides });
    });
  });
}

test('sube bytes comprobados desde el servidor y conserva identidad, formato y firma privada', async () => {
  await withProvider(async uploads => {
    const response = await uploadAvatar(request(png));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].method, 'POST');
    assert.ok(uploads[0].signal instanceof AbortSignal);
    const form = uploads[0].body;
    const file = form.get('file');
    assert.equal(file.type, 'image/png');
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), png);
    assert.equal(form.get('public_id'), result.publicId);
    assert.match(result.publicId, /^tintin_profile_[a-f0-9]{24}$/);
    assert.equal(form.get('allowed_formats'), 'jpg,png,webp');
    assert.equal(form.get('overwrite'), 'true');
    assert.match(form.get('signature'), /^[a-f0-9]{40}$/);
    assert.equal(result.signature, undefined);
    assert.equal(result.apiKey, undefined);
    assert.equal(result.uploadUrl, undefined);
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  });
});

for (const [contentType, bytes, format] of [['image/jpeg', jpeg, 'jpg'], ['image/webp', webp, 'webp']]) {
  test(`acepta ${contentType} con cabecera compatible y respuesta de imagen válida`, async () => {
    await withProvider(async uploads => {
      const response = await uploadAvatar(request(bytes, contentType));
      assert.equal(response.status, 200);
      assert.equal(uploads[0].body.get('file').type, contentType);
    }, async options => {
      const publicId = options.body.get('public_id');
      return Response.json({ public_id: publicId, resource_type: 'image', format, secure_url: `https://res.cloudinary.com/avatar-test/image/upload/v1/${publicId}.${format}` });
    });
  });
}

test('la identidad sale de la sesión y dos cuentas no comparten el mismo publicId', async () => {
  await withProvider(async uploads => {
    const one = await uploadAvatar(request(png, 'image/png', { 'x-user-id': 'other-user' }, 'first-user'));
    const repeated = await uploadAvatar(request(png, 'image/png', {}, 'first-user'));
    const two = await uploadAvatar(request(png, 'image/png', {}, 'second-user'));
    assert.equal(one.status, 200);
    assert.equal(repeated.status, 200);
    assert.equal(two.status, 200);
    assert.equal(uploads[0].body.get('public_id'), uploads[1].body.get('public_id'));
    assert.notEqual(uploads[0].body.get('public_id'), uploads[2].body.get('public_id'));
  });
});

test('acepta exactamente 5 MiB reales', async () => {
  await withProvider(async uploads => {
    const bytes = new Uint8Array(MAX_BYTES);
    bytes.set(png);
    const response = await uploadAvatar(request(bytes));
    assert.equal(response.status, 200);
    assert.equal(uploads[0].body.get('file').size, MAX_BYTES);
  });
});

for (const contentLength of [undefined, '1']) {
  test(`rechaza más de 5 MiB reales con Content-Length ${contentLength ?? 'ausente'}`, async () => {
    await withProvider(async uploads => {
      const bytes = new Uint8Array(MAX_BYTES + 1);
      bytes.set(png);
      const response = await uploadAvatar(request(bytes, 'image/png', contentLength ? { 'content-length': contentLength } : {}));
      assert.equal(response.status, 413);
      assert.equal(uploads.length, 0);
    });
  });
}

test('cancela el stream al cruzar 5 MiB sin acumular el resto del cuerpo', async () => {
  await withProvider(async uploads => {
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream({
      pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(1024 * 1024)); },
      cancel() { cancelled = true; },
    });
    const response = await uploadAvatar(request(stream));
    assert.equal(response.status, 413);
    assert.equal(cancelled, true);
    assert.ok(pulls <= 7, `se leyeron demasiados chunks: ${pulls}`);
    assert.equal(uploads.length, 0);
  });
});

test('rechaza Content-Length mayor al límite antes de leer el stream', async () => {
  await withProvider(async uploads => {
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream({ pull(controller) { pulls += 1; controller.enqueue(png); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
    const response = await uploadAvatar(request(stream, 'image/png', { 'content-length': String(MAX_BYTES + 1) }));
    assert.equal(response.status, 413);
    assert.equal(cancelled, true);
    assert.equal(pulls, 0);
    assert.equal(uploads.length, 0);
  });
});

for (const [label, bytes, contentType, status] of [
  ['archivo vacío', new Uint8Array(), 'image/png', 400],
  ['texto presentado como PNG', new TextEncoder().encode('<svg onload="alert(1)"></svg>'), 'image/png', 400],
  ['PNG con MIME JPEG', png, 'image/jpeg', 400],
  ['WEBP sin chunk de imagen', webp.subarray(0, 12), 'image/webp', 400],
  ['SVG', new TextEncoder().encode('<svg/>'), 'image/svg+xml', 415],
]) {
  test(`rechaza ${label} sin llegar al proveedor`, async () => {
    await withProvider(async uploads => {
      const response = await uploadAvatar(request(bytes, contentType));
      assert.equal(response.status, status);
      assert.equal(uploads.length, 0);
    });
  });
}
