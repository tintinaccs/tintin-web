import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProgressiveAdminPagedSource } from '../../js/admin/datos/fuente-paginada-progresiva.mjs';

const PAGE = 250, PAGES = 12, LATENCY_MS = 40; // 3000 pedidos, latencia simulada por página

function fakeServer() {
  const docs = Array.from({ length: PAGE * PAGES - 17 }, (_, i) => ({ id: `o${String(i).padStart(5, '0')}` }));
  return (cursor, next) => {
    const from = cursor ? cursor.index + 1 : 0;
    const timer = setTimeout(() => {
      const slice = docs.slice(from, from + PAGE);
      next({ records: slice, cursor: { index: from + slice.length - 1 }, cursorKey: slice.at(-1)?.id || '',
        hasMore: slice.length === PAGE, authoritative: true });
    }, LATENCY_MS);
    return () => clearTimeout(timer);
  };
}

async function measure(withPartial) {
  const t0 = performance.now(); const t = { first: 0, full: 0, partialCalls: 0, firstCount: 0 };
  await new Promise(resolve => {
    const source = createProgressiveAdminPagedSource({
      complete: true, subscribePage: fakeServer(),
      onPartial: withPartial ? records => { t.partialCalls++; if (!t.first) { t.first = performance.now() - t0; t.firstCount = records.length; } } : undefined,
      onData: records => { t.full = performance.now() - t0; if (!t.first) { t.first = t.full; t.firstCount = records.length; } t.total = records.length; source.stop(); resolve(); },
      onError: error => { throw error; },
    });
  });
  return t;
}

test('Pedidos muestra contenido con la primera página y confirma el conjunto completo después', async () => {
  const before = await measure(false), after = await measure(true);
  console.log(`[medición simulada ${PAGES} páginas x ${LATENCY_MS} ms] antes: primer contenido ${before.first.toFixed(0)} ms (${before.firstCount} pedidos) | después: ${after.first.toFixed(0)} ms (${after.firstCount} pedidos), completo ${after.full.toFixed(0)} ms`);
  assert.equal(after.total, PAGE * PAGES - 17, 'el conjunto completo sigue siendo exacto');
  assert.equal(after.firstCount, PAGE, 'el primer contenido es la primera página');
  assert.ok(after.first < before.first / 4, 'el primer contenido no espera a todas las páginas');
  assert.ok(after.partialCalls >= 1);
});

test('una página no autoritativa (caché) nunca se entrega como parcial', () => {
  const calls = [];
  let push;
  createProgressiveAdminPagedSource({ complete: true, subscribePage: (_c, next) => { push = next; return () => {}; },
    onPartial: r => calls.push(r), onData() {}, onError() {} });
  push({ records: [{ id: 'a' }], cursor: {}, cursorKey: 'a', hasMore: true, authoritative: false });
  assert.equal(calls.length, 0);
});

test('admin-app: onPartial no marca pedidos como listos ni reemplaza datos ya confirmados', () => {
  const src = readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('onPartial(orders)'), src.indexOf('onData(orders)'));
  assert.match(block, /if \(adminOrdersConfirmed\) return;/);
  assert.doesNotMatch(block, /adminRealtimeReady\.orders = true/);
});
