import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFirestoreBatchGetResponseText } from '../../cloudflare/firebase-admin-ligero.js';

const found = id => ({
  found: {
    name: `projects/demo/databases/(default)/documents/products/${id}`,
    fields: {
      name: { stringValue: `Producto ${id}` },
      variants: { arrayValue: { values: [{ mapValue: { fields: { label: { stringValue: 'Único' } } } }] } },
    },
  },
  readTime: '2026-09-24T18:00:00Z',
});

test('batchGet acepta el array JSON multilinea que devuelve el adaptador REST', () => {
  const body = JSON.stringify([
    found('p1'),
    { missing: 'projects/demo/databases/(default)/documents/products/missing', readTime: '2026-09-24T18:00:00Z' },
    found('p2'),
  ], null, 2);

  const docs = parseFirestoreBatchGetResponseText(body);
  assert.equal(docs.length, 2);
  assert.match(docs[0].name, /products\/p1$/);
  assert.match(docs[1].name, /products\/p2$/);
});

test('batchGet acepta objetos JSON streamed/NDJSON aunque cada objeto sea multilinea', () => {
  const body = [
    JSON.stringify(found('p1'), null, 2),
    JSON.stringify({ missing: 'projects/demo/databases/(default)/documents/products/missing' }, null, 2),
    JSON.stringify(found('p2'), null, 2),
  ].join('\n');

  const docs = parseFirestoreBatchGetResponseText(body);
  assert.deepEqual(docs.map(doc => doc.name.split('/').pop()), ['p1', 'p2']);
});

test('batchGet tolera prefijo anti-XSSI y conserva objetos anidados', () => {
  const body = ")]}'\n" + JSON.stringify([found('nested')], null, 2);
  const [doc] = parseFirestoreBatchGetResponseText(body);

  assert.equal(doc.fields.name.stringValue, 'Producto nested');
  assert.equal(doc.fields.variants.arrayValue.values[0].mapValue.fields.label.stringValue, 'Único');
});

test('batchGet rechaza una respuesta realmente truncada', () => {
  assert.throws(
    () => parseFirestoreBatchGetResponseText('{"found":{"name":"incompleto"'),
    /respuesta inválida/
  );
});
