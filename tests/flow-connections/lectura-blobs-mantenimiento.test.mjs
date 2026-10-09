import test from 'node:test';
import assert from 'node:assert/strict';
import { readTrustedOrRemote } from '../../scripts/leer-blobs-mantenimiento.mjs';
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
