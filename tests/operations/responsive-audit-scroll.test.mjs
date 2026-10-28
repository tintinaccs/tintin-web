import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('scripts/auditar-global-responsive-final.mjs', 'utf8');
const body = source.slice(source.indexOf('async function inspectMobileBottom'), source.indexOf('async function resetSurfaces'));
const inspect = new Function('settleFrames', `${body};return inspectMobileBottom;`)(async () => {});

function fixture({ blocked = false, loadError } = {}) {
  const events = [];
  const context = vm.createContext({
    innerHeight: 1000, scrollY: 0,
    document: { documentElement: { scrollHeight: 2000 }, querySelector: () => null, getElementById: () => null },
    window: { scrollTo: (options, y) => {
      events.push({ kind: 'scroll', options });
      if (!blocked) context.scrollY = Math.min(1000, typeof options === 'object' ? options.top : y);
    } },
  });
  return { events, page: {
    waitForLoadState: async state => { events.push({ kind: 'load', state }); if (loadError) throw loadError; },
    waitForTimeout: async () => {},
    evaluate: async fn => vm.runInContext(`(${fn.toString()})()`, context),
  } };
}

test('la geometría inferior espera load y llega al final sin animar el scroll', async () => {
  const { page, events } = fixture();
  assert.equal((await inspect(page)).length, 0);
  assert.equal(events[0].kind, 'load');
  assert.equal(events[0].state, 'load');
  assert.equal(events[1].options.behavior, 'instant');
});

test('un scroll bloqueado es un error de cobertura, no una medición del footer a mitad de página', async () => {
  await assert.rejects(inspect(fixture({ blocked: true }).page), /No se pudo alcanzar el final/);
});

test('un fallo de carga no se oculta como geometría aprobada', async () => {
  const error = new Error('load timeout');
  await assert.rejects(inspect(fixture({ loadError: error }).page), failure => failure === error);
});
