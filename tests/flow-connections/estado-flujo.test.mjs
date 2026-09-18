import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS, EDGES, NODES } from '../../js/admin/flujo-conexiones/datos-flujo-conexiones.js';
import { EVIDENCIA, baselineState, classifyProbe, resolveState } from '../../js/admin/flujo-conexiones/estado-flujo.js';
import { buildLiveChecks, buildLiveEdges } from '../../js/admin/flujo-conexiones/live-checks.js';

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

// Regresión: PR #833 introdujo `promote` en buildLiveChecks pero nunca
// asignó evidenceLevel: LIVE_PRODUCTION, así que resolveState siempre caía
// en la rama LIVE_PRODUCTION_READ_ONLY y devolvía el estado base — ningún
// nodo podía promoverse a verde aunque el probe respondiera 200 con `ok`.
// Esto degradó "prácticamente todo" el panel a IMPLEMENTADO PERO NO
// VERIFICADO incluso después de pulsar "Revalidar en vivo".
test('un probe público 200 exitoso promueve los nodos de infraestructura a producción', () => {
  const publicHealth = {
    status: 200,
    body: {
      ok: true,
      checks: { firebase: true },
      admin: { users: true, products: false },
    },
  };
  const checkedAt = '2026-09-18T00:00:00.000Z';
  const live = buildLiveChecks({ publicHealth, systemHealth: null, adminHealth: null, headers: null }, checkedAt);

  for (const id of ['cf-pages', 'cf-functions', 'apis-internas', 'firestore', 'users-uid']) {
    assert.equal(live[id].evidenceLevel, EVIDENCIA.LIVE_PRODUCTION, `${id} debe usar evidencia LIVE_PRODUCTION`);
    assert.equal(live[id].promote, true, `${id} debe quedar marcado como promovible`);
    const node = NODES.find(n => n.id === id);
    assert.equal(resolveState(node, live[id], ESTADOS), ESTADOS.PROD, `${id} debe resolver a FUNCIONANDO EN PRODUCCIÓN`);
  }
});

test('la salud operativa explícita promueve disponibilidad, pero una lectura genérica no promueve CRUD', () => {
  const publicHealth = { status: 200, body: { ok: true, checks: { firebase: true }, admin: { products: true } } };
  const live = buildLiveChecks({ publicHealth, systemHealth: null, adminHealth: null, headers: null }, '2026-09-18T00:00:00.000Z');
  assert.equal(live.productos.evidenceLevel, EVIDENCIA.LIVE_PRODUCTION);
  const productos = NODES.find(n => n.id === 'productos');
  assert.equal(resolveState(productos, live.productos, ESTADOS), ESTADOS.PROD);
  const genericRead = { ok: true, status: 200, promote: false, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION_READ_ONLY };
  assert.notEqual(resolveState(productos, genericRead, ESTADOS), ESTADOS.PROD);
});

test('una ruta pública comprobada en producción promueve su nodo de destino', () => {
  const live = buildLiveChecks({
    publicHealth: { status: 200, body: { ok: true } },
    routeProbes: { login: { path: '/login', status: 200, ok: true } },
  }, '2026-09-18T00:00:00.000Z');
  const login = NODES.find(node => node.id === 'entrada-login');
  assert.equal(resolveState(login, live['entrada-login'], ESTADOS), ESTADOS.PROD);
});

test('buildLiveEdges promueve la cadena de infraestructura cuando /api/health responde 200', () => {
  const publicHealth = { status: 200, body: { ok: true, checks: { firebase: true }, admin: { users: true } } };
  const live = buildLiveEdges({ publicHealth, systemHealth: null, headers: null }, '2026-09-18T00:00:00.000Z');
  const edge = EDGES.find(e => e.from === 'cf-pages' && e.to === 'cf-functions');
  assert.equal(resolveState(edge, live[edge.id], ESTADOS), ESTADOS.PROD);
});

