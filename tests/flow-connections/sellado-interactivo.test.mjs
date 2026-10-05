import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/admin/flujo-conexiones/flujo-conexiones-admin.js', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const sealConfirmation ='), source.indexOf('  // Huella actual de cada archivo'));

function fixture(write = async () => {}) {
  const controls = {};
  const control = id => controls[id] ||= {
    hidden: id === '#tfc-seal-confirmation', disabled: false, textContent: '',
    addEventListener(type, callback) { this[type] = callback; }, focus() {},
  };
  const greens = new Set(['verified']);
  const writes = [];
  const state = { loaded: true, entries: {}, shaByPath: { 'sample.js': 'hash' } };
  const env = {
    root: { querySelector: control }, sealBtn: control('request'), revalidateBtn: control('revalidate'),
    liveState: { checkedAt: '2026-10-05T00:00:00Z' }, sealState: state,
    auth: { currentUser: { email: 'test@example.invalid' } }, db: {}, SEALS_DOC: ['settings', 'flowSeals'],
    NODES: [{ id: 'verified' }, { id: 'unverified' }], EDGES: [], NODES_BY_ID: {}, ESTADOS: { PROD: 'green' },
    liveOnlyState: record => greens.has(record.id) ? 'green' : 'pending',
    recordFiles: () => ['sample.js'], buildSeal: (files, hashes, meta) => ({ files, hashes, ...meta }),
    waitForAdminAppCheck: async () => true, doc: (...args) => args,
    setDoc: async (...args) => { writes.push(args); await write(); }, renderAll() {},
    window: { alert() { throw new Error('Native dialog'); }, confirm() { throw new Error('Native dialog'); } },
  };
  vm.runInNewContext(handler, env);
  return { env, controls, writes, greens, state, click: id => control(id).click() };
}

test('confirmación visible y cancelación no escriben ni usan diálogos nativos', async () => {
  const f = fixture();
  await f.click('request');
  assert.equal(f.controls['#tfc-seal-confirmation'].hidden, false);
  assert.match(f.controls['#tfc-seal-confirmation-text'].textContent, /1 nodos/);
  await f.click('#tfc-seal-cancel');
  await f.click('#tfc-seal-save');
  assert.equal(f.writes.length, 0);
});

test('confirmar vuelve a leer la evidencia y el doble clic produce una sola escritura', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture(() => pending);
  await f.click('request');
  f.greens.delete('verified'); f.greens.add('unverified');
  const first = f.click('#tfc-seal-save');
  await Promise.resolve();
  await f.click('#tfc-seal-save');
  assert.equal(f.writes.length, 1);
  assert.deepEqual(Object.keys(f.writes[0][1].entries), ['unverified']);
  assert.equal(f.env.revalidateBtn.disabled, true);
  finish(); await first;
  assert.equal(f.controls['#tfc-seal-confirmation'].hidden, true);
  assert.match(f.controls['#tfc-seal-feedback'].textContent, /Se guardaron 1/);
});

test('fallo de escritura queda visible, conserva los sellos y permite reintentar', async () => {
  let fail = true;
  const f = fixture(async () => { if (fail) throw new Error('permission-denied'); });
  await f.click('request'); await f.click('#tfc-seal-save');
  assert.match(f.controls['#tfc-seal-feedback'].textContent, /permission-denied/);
  assert.equal(Object.keys(f.state.entries).length, 0);
  assert.equal(f.controls['#tfc-seal-save'].disabled, false);
  fail = false; await f.click('#tfc-seal-save');
  assert.equal(f.writes.length, 2);
  assert.equal(Object.keys(f.state.entries).length, 1);
});

test('App Check pendiente impide escribir; una revalidación activa permanece bloqueada', async () => {
  const f = fixture();
  await f.click('request');
  f.env.waitForAdminAppCheck = async () => false;
  await f.click('#tfc-seal-save');
  assert.equal(f.writes.length, 0);
  assert.match(f.controls['#tfc-seal-feedback'].textContent, /seguridad/);
  f.env.revalidateBtn.disabled = true;
  await f.click('#tfc-seal-save');
  assert.equal(f.env.revalidateBtn.disabled, true);
  assert.equal(f.writes.length, 0);
});
