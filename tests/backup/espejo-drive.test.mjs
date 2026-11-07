import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { changedPaths, createClient, getAccessToken, ROOT_NAME, STATE_NAME, syncMirror } from '../../scripts/espejo-drive.mjs';

// Drive en memoria con la misma interfaz que createClient.
function fakeDrive() {
  let n = 0; const nodes = new Map(); const puts = [];
  const add = (name, parent, extra = {}) => { const id = `id${++n}`; nodes.set(id, { id, name, parent, ...extra }); return id; };
  return {
    nodes, puts,
    async ensureFolder(name, parent) { const f = [...nodes.values()].find(x => x.name === name && x.parent === (parent || null) && x.folder); return f ? f.id : add(name, parent || null, { folder: true, mimeType: 'application/vnd.google-apps.folder' }); },
    async listChildren(parent) { return new Map([...nodes.values()].filter(x => x.parent === parent).map(x => [x.name, { id: x.id, name: x.name, mimeType: x.mimeType }])); },
    async readJson(id) { return JSON.parse(nodes.get(id).body.toString()); },
    async putFile({ name, parentId, existingId, body }) { puts.push(name); if (existingId) { nodes.get(existingId).body = body; return existingId; } return add(name, parentId, { body }); },
  };
}
const run = (drive, tree, files) => syncMirror({ client: drive, tree, readBody: p => Buffer.from(files[p]), log: () => {} });

test('primera ejecución copia todo con estructura de carpetas; la segunda no sube nada', async () => {
  const drive = fakeDrive();
  const files = { 'a.txt': 'A', 'js/x.js': 'X', 'js/sub/y.js': 'Y' };
  const tree = { 'a.txt': 's1', 'js/x.js': 's2', 'js/sub/y.js': 's3' };
  assert.equal((await run(drive, tree, files)).uploaded, 3);
  const folder = name => [...drive.nodes.values()].find(x => x.name === name && x.folder);
  assert.equal(folder('sub').parent, folder('js').id);
  assert.equal(folder('js').parent, folder(ROOT_NAME).id);
  drive.puts.length = 0;
  assert.equal((await run(drive, tree, files)).uploaded, 0);
  assert.deepEqual(drive.puts, []);
});

test('si cambia un solo archivo solo se sube ese, en su lugar (sin duplicar)', async () => {
  const drive = fakeDrive();
  const files = { 'a.txt': 'A', 'js/x.js': 'X' };
  await run(drive, { 'a.txt': 's1', 'js/x.js': 's2' }, files);
  drive.puts.length = 0;
  files['js/x.js'] = 'X2';
  assert.equal((await run(drive, { 'a.txt': 's1', 'js/x.js': 's3' }, files)).uploaded, 1);
  assert.deepEqual(drive.puts, ['x.js', STATE_NAME]);
  assert.equal([...drive.nodes.values()].filter(x => x.name === 'x.js').length, 1);
});

test('un archivo eliminado en GitHub se conserva en el espejo', async () => {
  const drive = fakeDrive();
  await run(drive, { 'a.txt': 's1', 'b.txt': 's2' }, { 'a.txt': 'A', 'b.txt': 'B' });
  await run(drive, { 'a.txt': 's1' }, { 'a.txt': 'A' });
  assert.ok([...drive.nodes.values()].some(x => x.name === 'b.txt'));
});

test('si una subida falla no se marca como copiada y se reintenta después', async () => {
  const drive = fakeDrive();
  const original = drive.putFile;
  drive.putFile = async args => { if (args.name === 'b.txt') throw new Error('boom'); return original(args); };
  await assert.rejects(() => run(drive, { 'a.txt': 's1', 'b.txt': 's2' }, { 'a.txt': 'A', 'b.txt': 'B' }), /boom/);
  const state = [...drive.nodes.values()].find(x => x.name === STATE_NAME);
  assert.deepEqual(Object.keys(JSON.parse(state.body.toString())), ['a.txt']);
  await run(drive, { 'a.txt': 's1', 'b.txt': 's2' }, { 'a.txt': 'A', 'b.txt': 'B' }).catch(() => {});
  drive.putFile = original;
  drive.puts.length = 0;
  assert.equal((await run(drive, { 'a.txt': 's1', 'b.txt': 's2' }, { 'a.txt': 'A', 'b.txt': 'B' })).uploaded, 1);
  assert.deepEqual(drive.puts.filter(name => name !== STATE_NAME), ['b.txt']);
});

test('changedPaths compara por SHA', () => {
  assert.deepEqual(changedPaths({ a: '1', b: '2' }, { a: '1', b: 'x' }), ['b']);
});

test('sin credenciales falla antes de llamar a Google', async () => {
  await assert.rejects(() => getAccessToken({}, () => assert.fail('no debe llamar')), /DRIVE_CLIENT_ID/);
});

test('el cliente real verifica MD5/tamaño y reintenta errores transitorios', async () => {
  const body = Buffer.from('datos');
  const md5 = createHash('md5').update(body).digest('hex');
  let hits = 0;
  const reply = done => async (url, init) => {
    if (init?.method === 'POST' || init?.method === 'PATCH') { if (hits++ === 0) return new Response('', { status: 503 }); return new Response('', { status: 200, headers: { location: 'https://up/1' } }); }
    return new Response(JSON.stringify(done), { status: 200 });
  };
  const ok = createClient('t', reply({ id: 'X', size: '5', md5Checksum: md5 }), async () => {});
  assert.equal(await ok.putFile({ name: 'a', parentId: 'P', body }), 'X');
  hits = 1;
  const bad = createClient('t', reply({ id: 'X', size: '5', md5Checksum: 'otro' }), async () => {});
  await assert.rejects(() => bad.putFile({ name: 'a', parentId: 'P', body }), /Verificación/);
});
