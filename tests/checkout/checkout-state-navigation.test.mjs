import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const stateSource = fs.readFileSync(new URL('../../js/pages/checkout/estado-navegacion-checkout.js', import.meta.url), 'utf8');
const loaderSource = fs.readFileSync(new URL('../../js/cargador-mantenimiento-pagina.js', import.meta.url), 'utf8');

test('checkout carga el controlador de estado sólo desde su runtime de mantenimiento', () => {
  assert.match(loaderSource, /pages\/checkout\/estado-navegacion-checkout\.js/);
  assert.match(loaderSource, /tintin-20260912-checkout-state-navigation-1/);
});

test('los pasos 1-5 son interactivos pero el avance reutiliza validadores nativos', () => {
  assert.match(stateSource, /\.ck-step\[data-step\]/);
  assert.match(stateSource, /setAttribute\('role', 'button'\)/);
  assert.match(stateSource, /btn-step1-next/);
  assert.match(stateSource, /btn-step2-next/);
  assert.match(stateSource, /btn-step3-next/);
  assert.match(stateSource, /btn-step4-next/);
  assert.match(stateSource, /if \(target > maxNavigableStep\) return/);
});

test('el borrador persiste datos de envío, contacto, factura y pago en sessionStorage', () => {
  for (const id of [
    'ck-departamento', 'ck-city', 'ck-address', 'ck-location-name',
    'ck-name', 'ck-phone-number', 'ck-email', 'ck-ci',
    'ck-wants-invoice', 'ck-razon-social', 'ck-ruc',
    'pay-efectivo', 'pay-transferencia'
  ]) {
    assert.ok(stateSource.includes(`'${id}'`), `falta persistir ${id}`);
  }
  assert.match(stateSource, /tt_checkout_draft_v1/);
  assert.match(stateSource, /sessionStorage/);
});

test('la reanudación usa el backup existente y nunca persiste Confirmación como salto directo', () => {
  assert.match(stateSource, /tt_checkout_resume_step_backup_v2/);
  assert.match(stateSource, /Math\.min\(maxNavigableStep, 3\)/);
  assert.match(stateSource, /scheduleResumeTarget/);
});

test('al confirmarse el pedido se elimina borrador y estado navegable', () => {
  assert.match(stateSource, /ck-post-confirm/);
  assert.match(stateSource, /clearCheckoutState/);
  assert.match(stateSource, /removeItem\(DRAFT_KEY\)/);
  assert.match(stateSource, /removeItem\(MAX_STEP_KEY\)/);
});
