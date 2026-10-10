import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/core/store/estado-productos.js', import.meta.url), 'utf8');
const loads = source.slice(source.indexOf('export async function loadHomeProducts'), source.indexOf('async function fetchSingleProduct(')).replaceAll('export ', '');

for (const [target, key] of [['loadHomeProducts', 'products:cards'], ['loadAllProducts', 'products:home-featured']]) {
  test(`${target}: datos disponibles en otra página aparecen sin esperar la red`, async () => {
    const products = [{ id: 'p1', name: 'Reloj', price: 120000 }];
    let published;
    const context = vm.createContext({
      HOME_CACHE_KEY: 'products:home-featured', ALL_CACHE_KEY: 'products:cards', HOME_CACHE_TTL: 60000, ALL_CACHE_TTL: 60000,
      readCached: cacheKey => cacheKey === key ? products : null,
      readStaleCached: () => null,
      publish: list => { published = list; return list; },
      runSingleFlight: () => { throw new Error('No debe consultar la red antes de mostrar datos disponibles'); },
    });
    vm.runInContext(loads, context);
    assert.equal(await context[target](), products);
    assert.equal(published, products);
  });
  test(`${target}: caché vencida se muestra mientras una actualización sigue pendiente`, async () => {
    const products = [{ id: 'p1', name: 'Reloj' }];
    let published;
    const context = vm.createContext({
      HOME_CACHE_KEY: 'products:home-featured', ALL_CACHE_KEY: 'products:cards', HOME_CACHE_TTL: 60000, ALL_CACHE_TTL: 60000,
      readCached: () => null, readStaleCached: cacheKey => cacheKey === key ? products : null,
      publish: list => { published = list; return list; },
      runSingleFlight: () => new Promise(() => {}), fetchHomeProducts() {}, fetchAllProducts() {},
    });
    vm.runInContext(loads, context);
    void context[target]();
    assert.equal(published, products);
  });
}

test('consumidores simultáneos comparten request y una falla permite volver a solicitar', async () => {
  const cache = fs.readFileSync(new URL('../../js/core/firebase/cache-lecturas-firestore.js', import.meta.url), 'utf8').replace(/^export /gm, '');
  const api = fs.readFileSync(new URL('../../js/core/firebase/catalogo-publico-api.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  let calls = 0, respond;
  const context = vm.createContext({ AbortController, window: { setTimeout, clearTimeout },
    fetch: () => { calls++; return new Promise(resolve => { respond = resolve; }); },
  });
  vm.runInContext(cache + '\n' + api, context);
  const first = context.fetchPublicCatalogResource('products');
  const second = context.fetchPublicCatalogResource('products');
  await Promise.resolve();
  assert.equal(calls, 1);
  respond({ ok: false, status: 503 });
  const failure = await Promise.allSettled([first, second]);
  assert.ok(failure.every(result => result.status === 'rejected'));
  const retry = context.fetchPublicCatalogResource('products');
  await Promise.resolve();
  assert.equal(calls, 2);
  respond({ ok: true, json: async () => ({ ok: true, resource: 'products', items: [] }) });
  assert.deepEqual(Array.from(await retry), []);
});
