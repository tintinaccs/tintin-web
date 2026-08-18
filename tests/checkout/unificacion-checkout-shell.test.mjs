import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const checkout = read('checkout.html');
const checkoutNavigation = read('js/components/cart/navegacion-checkout-unificada.js');
const sharedRuntime = read('js/components/navigation/compartido/carga-navegacion.js');
const shellEntry = read('js/components/navigation/entrada-navegacion-publica.js');
const desktopHeader = read('js/components/navigation/escritorio/encabezado-escritorio.js');
const tabletHeader = read('js/components/navigation/tableta/encabezado-tableta.js');

test('existe un único checkout oficial de cinco pasos', () => {
  assert.match(checkout, /id="ck-steps"/);
  for (const label of ['Carrito', 'Envío', 'Datos', 'Pago', 'Confirmación']) {
    assert.match(checkout, new RegExp(`ck-step-label[^>]*>${label}<`));
  }
  for (let step = 0; step <= 4; step += 1) {
    assert.match(checkout, new RegExp(`id="panel-${step}"`));
  }
});

test('todas las entradas públicas convergen al checkout oficial versionado', () => {
  assert.match(checkoutNavigation, /const CHECKOUT_PATH = '\/checkout'/);
  assert.match(checkoutNavigation, /CHECKOUT_FLOW = 'tintin-unified-20260818-1'/);
  assert.match(checkoutNavigation, /#btn-product-buy-now/);
  assert.match(checkoutNavigation, /#tinsel-checkout-btn/);
  assert.match(checkoutNavigation, /a\[href\]/);
  assert.match(checkoutNavigation, /MutationObserver/);
  assert.match(checkoutNavigation, /stopImmediatePropagation\(\)/);
  assert.match(sharedRuntime, /loadCheckoutNavigationRuntime\(\)/);

  const installAt = sharedRuntime.indexOf('void loadCheckoutNavigationRuntime()');
  const pageSplitAt = sharedRuntime.indexOf('if (!FULL_COMMERCE_PAGES.has(page))');
  assert.ok(installAt > -1 && pageSplitAt > installAt, 'la unificación debe instalarse antes de dividir por tipo de página');
});

test('desktop y tablet no pintan un logo provisional antes del configurado', () => {
  for (const source of [desktopHeader, tabletHeader]) {
    assert.doesNotMatch(source, /EMPTY_IMAGE/);
    assert.doesNotMatch(source, /data-tt-shared-logo/);
    assert.match(source, /data-tt-shell-logo-pending/);
    assert.match(source, /data-tt-fallback-logo/);
    assert.match(source, /visibility:hidden/);
  }

  assert.doesNotMatch(shellEntry, /hydrateSharedLogos/);
  const applyAt = shellEntry.indexOf('applyGlobalLayout(globalConfig.layout)');
  const revealAt = shellEntry.indexOf('await finalizeShellBrandImages()');
  assert.ok(applyAt > -1 && revealAt > applyAt, 'el logo solo puede revelarse después de aplicar la configuración final');
  assert.match(shellEntry, /brandPaint: 'configured-logo-first'/);
});
