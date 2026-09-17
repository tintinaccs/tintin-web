import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS, EDGES, NODES } from '../../js/admin/flujo-conexiones/datos-flujo-conexiones.js';
import { EVIDENCIA, baselineState, classifyProbe, resolveState } from '../../js/admin/flujo-conexiones/estado-flujo.js';

test('el diagnóstico no muestra verde histórico sin evidencia runtime', () => {
  assert.equal(baselineState(ESTADOS.PROD, ESTADOS), ESTADOS.NO_VERIFICADO);
  assert.equal(NODES.some(item => item.state === ESTADOS.PROD), false);
  assert.equal(EDGES.some(item => item.state === ESTADOS.PROD), false);
});

test('200 con evidencia live promovible es verde', () => {
  assert.equal(classifyProbe({ ok: true, status: 200 }, ESTADOS), ESTADOS.PROD);
  assert.equal(resolveState({ state: ESTADOS.NO_VERIFICADO }, {
    ok: true, status: 200, promote: true, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION,
  }, ESTADOS), ESTADOS.PROD);
});

test('500 es rojo, timeout queda pendiente y falta de implementación es gris', () => {
  assert.equal(classifyProbe({ ok: false, status: 500 }, ESTADOS), ESTADOS.ERROR);
  assert.equal(classifyProbe({ ok: false, timeout: true }, ESTADOS), ESTADOS.NO_VERIFICADO);
  assert.equal(classifyProbe({ ok: false, implemented: false }, ESTADOS), ESTADOS.DESCONECTADO);
});

test('evidencia parcial permanece naranja y lectura no promueve una mutación', () => {
  assert.equal(classifyProbe({ ok: true, partial: true }, ESTADOS), ESTADOS.PARCIAL);
  assert.equal(resolveState({ state: ESTADOS.PARCIAL }, {
    ok: true, status: 200, promote: false, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION_READ_ONLY,
  }, ESTADOS), ESTADOS.PARCIAL);
});

test('401/403 es falta de evidencia autenticada, no un fallo de producción', () => {
  assert.equal(resolveState({ state: ESTADOS.NO_VERIFICADO }, {
    ok: false, status: 401, authRequired: true,
  }, ESTADOS), ESTADOS.NO_VERIFICADO);
});

