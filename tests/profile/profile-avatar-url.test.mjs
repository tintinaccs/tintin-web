import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfileAvatarUrl, verifyProfileAvatarAsset } from '../../cloudflare/profile-avatar-url.js';

const cloud = 'tintin-test';
const id = 'tintin_profile_0123456789abcdef01234567';
const root = `https://res.cloudinary.com/${cloud}/image/upload`;
const valid = `${root}/v1788600000/${id}.png`;

test('acepta las URLs originales de los formatos autorizados', () => {
  for (const extension of ['jpg', 'jpeg', 'png', 'webp']) {
    const url = `${root}/v1788600000/${id}.${extension}`;
    assert.equal(validateProfileAvatarUrl(url, cloud, id), url);
  }
});

for (const [name, url] of [
  ['otra cuenta con la ruta permitida dentro de una carpeta', `https://res.cloudinary.com/attacker/image/upload/v1/${cloud}/image/upload/${id}.png`],
  ['identificador con sufijo', `${root}/v1/${id}_other.png`],
  ['identificador usado como carpeta', `${root}/v1/${id}/other.png`],
  ['dominio distinto', valid.replace('res.cloudinary.com', 'res.cloudinary.com.evil.test')],
  ['http', valid.replace('https:', 'http:')],
  ['credenciales', valid.replace('https://', 'https://user:secret@')],
  ['puerto diferente', valid.replace('.com/', '.com:8443/')],
  ['query', `${valid}?file=other`],
  ['fragmento', `${valid}#other`],
  ['extensión no admitida', valid.replace('.png', '.svg')],
  ['segmentos codificados', valid.replace(id, `%74${id.slice(1)}`)],
  ['traversal normalizado', valid.replace('/v1788600000/', '/unused/../v1788600000/')],
  ['transformación arbitraria', valid.replace('/v1788600000/', '/l_other/v1788600000/')],
  ['sin versión de subida', `${root}/${id}.png`],
  ['ruta extra', `${valid}/other`],
]) {
  test(`rechaza ${name}`, () => {
    assert.throws(() => validateProfileAvatarUrl(url, cloud, id), /archivo autorizado/);
  });
}

test('rechaza configuración ausente o identidad inválida', () => {
  assert.throws(() => validateProfileAvatarUrl(valid, '', id));
  assert.throws(() => validateProfileAvatarUrl(valid, cloud, `${id}/other`));
});

test('reproduce la aceptación incorrecta del control previo', () => {
  const forged = `https://res.cloudinary.com/attacker/image/upload/v1/${cloud}/image/upload/${id}.png`;
  const parsed = new URL(forged);
  assert.ok(parsed.pathname.includes(`${cloud}/image/upload/`) && parsed.pathname.includes(`/${id}`));
  assert.throws(() => validateProfileAvatarUrl(forged, cloud, id));
});

const config = { cloudName: cloud, apiKey: 'test-key', apiSecret: 'test-secret' };
const metadata = { public_id: id, resource_type: 'image', type: 'upload', secure_url: valid, bytes: 1024, format: 'png' };

test('consulta solo el proveedor autorizado y verifica los bytes reales', async () => {
  const asset = await verifyProfileAvatarAsset(valid, id, config, async (url, options) => {
    assert.equal(url, `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload/${id}`);
    assert.equal(options.headers.Authorization, `Basic ${btoa('test-key:test-secret')}`);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(metadata);
  });
  assert.equal(asset.bytes, 1024);
});

for (const [name, patch] of [
  ['archivo excesivo', { bytes: 5 * 1024 * 1024 + 1 }],
  ['archivo vacío', { bytes: 0 }],
  ['bytes ausentes', { bytes: null }],
  ['bytes no numéricos', { bytes: '1024' }],
  ['identificador ajeno', { public_id: `${id}_other` }],
  ['versión sustituida', { secure_url: valid.replace('1788600000', '1788600001') }],
  ['formato no permitido', { format: 'svg' }],
  ['recurso no imagen', { resource_type: 'raw' }],
  ['archivo privado', { type: 'private' }],
]) {
  test(`no consolida ${name}`, async () => {
    await assert.rejects(verifyProfileAvatarAsset(valid, id, config,
      async () => Response.json({ ...metadata, ...patch })), error => error.status === 400);
  });
}

for (const upstreamStatus of [401, 403, 404, 429, 500]) {
  test(`un HTTP ${upstreamStatus} del proveedor no se considera una subida válida`, async () => {
    await assert.rejects(verifyProfileAvatarAsset(valid, id, config,
      async () => new Response('provider detail must not leak', { status: upstreamStatus })), error => {
      assert.equal(error.status, upstreamStatus === 404 ? 400 : 503);
      assert.doesNotMatch(error.message, /provider detail/);
      return true;
    });
  });
}

test('un fallo de red no filtra detalles ni permite consolidar', async () => {
  await assert.rejects(verifyProfileAvatarAsset(valid, id, config, async () => {
    throw new Error('sensitive provider details');
  }), error => error.status === 503 && !error.message.includes('sensitive'));
});

test('una URL ajena se rechaza antes de consultar al proveedor', async () => {
  let called = false;
  await assert.rejects(verifyProfileAvatarAsset('https://attacker.test/photo.png', id, config, async () => { called = true; }));
  assert.equal(called, false);
});
