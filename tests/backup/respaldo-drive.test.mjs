import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ensureFolder, getAccessToken, MIN_KEEP, pruneOld, uploadFile } from '../../scripts/subir-respaldo-drive.mjs';

const json = (data, init = {}) => new Response(JSON.stringify(data), { status: 200, ...init });

test('sin credenciales falla antes de llamar a Google', async () => {
  await assert.rejects(() => getAccessToken({}, () => assert.fail('no debe llamar')), /DRIVE_CLIENT_ID/);
});

test('reutiliza la carpeta existente y la crea solo si falta', async () => {
  const calls = [];
  const existing = await ensureFolder('t', async url => { calls.push(url); return json({ files: [{ id: 'F1' }] }); });
  assert.equal(existing, 'F1');
  assert.equal(calls.length, 1);
  const created = await ensureFolder('t', async (url, init) => (init?.method === 'POST' ? json({ id: 'F2' }) : json({ files: [] })));
  assert.equal(created, 'F2');
});

test('la subida se verifica por tamaño y MD5 y falla si no coinciden', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'drv-')), 'a.bundle');
  writeFileSync(file, 'datos');
  const md5 = createHash('md5').update('datos').digest('hex');
  const make = reply => async (url, init) => (init?.method === 'POST'
    ? new Response('', { status: 200, headers: { location: 'https://up/1' } })
    : json(reply));
  const ok = await uploadFile('t', 'F', file, make({ id: 'X', size: '5', md5Checksum: md5 }));
  assert.equal(ok.id, 'X');
  await assert.rejects(() => uploadFile('t', 'F', file, make({ id: 'X', size: '5', md5Checksum: 'otro' })), /Verificación/);
});

test('la retención conserva lo reciente y solo manda a la papelera lo viejo', async () => {
  const now = Date.parse('2026-11-07T00:00:00Z');
  const files = Array.from({ length: MIN_KEEP + 3 }, (_, i) => ({
    id: `f${i}`, createdTime: new Date(now - (i < MIN_KEEP ? 1 : 100) * 86_400_000).toISOString(),
  }));
  const trashed = [];
  const removed = await pruneOld('t', 'F', now, async (url, init) => {
    if (init?.method === 'PATCH') { trashed.push(url); assert.equal(JSON.parse(init.body).trashed, true); return json({ id: 'x' }); }
    return json({ files });
  });
  assert.equal(removed, 3);
  assert.equal(trashed.length, 3);
});
