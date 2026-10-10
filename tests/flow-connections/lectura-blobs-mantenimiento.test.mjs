import test from 'node:test';
import assert from 'node:assert/strict';
import { readTrustedOrRemote, githubFailure } from '../../scripts/leer-blobs-mantenimiento.mjs';
const original = { sha: 'a'.repeat(40), mode: '100644' };
test('543 objetos idénticos se verifican sin consumir peticiones GitHub', async () => {
  let remote = 0;
  for (let i = 0; i < 543; i++) {
    assert.equal(await readTrustedOrRemote(original, original, () => 'bytes main', () => { remote++; }), 'bytes main');
  }
  assert.equal(remote, 0);
});
test('Objetos nuevos, modificados o con otro modo requieren bytes remotos', async () => {
  for (const [entry, base] of [[{ ...original, sha: 'b'.repeat(40) }, original], [original, undefined], [{ ...original, mode: '100755' }, original]]) {
    let remote = 0;
    assert.equal(await readTrustedOrRemote(entry, base, () => { throw Error('No usar main'); }, () => { remote++; return 'candidato'; }), 'candidato');
    assert.equal(remote, 1);
  }
});
test('Ausencias, enlaces simbólicos y errores de descarga no se aceptan', async () => {
  const forbidden = () => { throw Error('No leer'); };
  for (const entry of [undefined, { ...original, mode: '120000' }, { ...original, sha: 'inventado' }]) {
    await assert.rejects(readTrustedOrRemote(entry, original, forbidden, forbidden), /ausente o no regular/);
  }
  await assert.rejects(readTrustedOrRemote({ ...original, sha: 'b'.repeat(40) }, original, forbidden, () => { throw Error('HTTP 403'); }), /HTTP 403/);
});

test('La falta de bytes confiables no permite omitir la verificación', async () => {
  await assert.rejects(readTrustedOrRemote(original, original, () => { throw Error('Checkout ilegible'); }, () => 'remoto'), /Checkout ilegible/);
});

test('Un 403 informa ruta y presupuesto agotado sin exponer credenciales', () => {
  const response = new Response(null, { status: 403, headers: {
    'x-ratelimit-resource': 'core', 'x-ratelimit-limit': '1000', 'x-ratelimit-remaining': '0',
    'x-ratelimit-reset': '1791626400', 'retry-after': '60', authorization: 'credencial-no-publicable',
  } });
  const message = githubFailure('git/blobs/' + original.sha, response);
  assert.match(message, /git\/blobs\/[a-f0-9]{40}/);
  assert.match(message, /HTTP 403/);
  for (const name of ['x-ratelimit-resource', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after']) {
    assert.ok(message.includes(`${name}=${response.headers.get(name)}`));
  }
  assert.ok(!message.includes('credencial-no-publicable'));
});

test('Un 403 sin cabeceras no se confunde con presupuesto agotado', () => {
  const message = githubFailure('pulls/1083', new Response(null, { status: 403 }));
  assert.match(message, /x-ratelimit-remaining=desconocido/);
  assert.match(message, /pulls\/1083/);
});
