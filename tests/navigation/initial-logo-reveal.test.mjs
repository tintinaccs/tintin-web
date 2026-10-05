import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/cargador-pagina.js', import.meta.url), 'utf8');
const hide = source.slice(source.indexOf('  function tryHideElegant()'), source.indexOf('  function ready()'));
for (const state of [
  { name: 'logo pendiente en primer arranque', first: true, logo: false, waits: 0, expected: 0 },
  { name: 'logo resuelto en primer arranque', first: true, logo: true, waits: 0, expected: 1 },
  { name: 'ciclo posterior con imagen pendiente', first: false, logo: false, waits: 0, expected: 1 },
  { name: 'ciclo posterior con espera interactiva', first: false, logo: true, waits: 1, expected: 0 },
]) test(`reveal respeta ${state.name}`, () => {
  let hides = 0;
  const context = vm.createContext({
    hidden: false, initialRevealDone: !state.first, logoReady: state.logo,
    storeGateRequired: false, gateResolved: true, isCheckoutPage: false, pendingWaits: state.waits,
    MIN_SHOW_MS: 120, shownAt: 0, Date, loader: { dataset: {} },
    hideNow() { hides++; }, window: { setTimeout() { throw new Error('No se debe agregar una espera artificial'); } },
  });
  vm.runInContext(hide, context); context.tryHideElegant(); assert.equal(hides, state.expected);
});
