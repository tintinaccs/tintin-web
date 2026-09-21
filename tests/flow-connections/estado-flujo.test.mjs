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

test('evidencia CI del commit actual también puede promover un estado verificado', () => {
  assert.equal(resolveState({ state: ESTADOS.NO_VERIFICADO }, {
    ok: true, status: 200, promote: true, evidenceLevel: EVIDENCIA.CI_VERIFIED,
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

test('la sesión autenticada actual promueve solo Firebase, sesión, rol y perfil comprobados', () => {
  const sessionProbe = { authenticated: true, token: true, role: true, profile: true, status: 200 };
  const live = buildLiveChecks({ sessionProbe }, '2026-09-21T00:00:00.000Z');
  for (const id of ['firebase-auth', 'sesion-estado', 'roles', 'perfil']) {
    const node = NODES.find(item => item.id === id);
    assert.equal(resolveState(node, live[id], ESTADOS), ESTADOS.PROD, `${id} debe promoverse con la sesión actual comprobada`);
  }
  const edges = buildLiveEdges({ sessionProbe }, '2026-09-21T00:00:00.000Z');
  for (const edge of [
    ['sesion-estado', 'firestore'], ['users-uid', 'roles'], ['roles', 'perfil'], ['roles', 'super-panel'],
  ]) {
    const record = EDGES.find(item => item.from === edge[0] && item.to === edge[1]);
    assert.equal(resolveState(record, edges[record.id], ESTADOS), ESTADOS.PROD, `${edge.join(' → ')} debe promoverse con evidencia de sesión`);
  }
});

test('el carrito exige que el panel ya se haya renderizado, no solo un HTTP 200', () => {
  const withoutDrawer = buildLiveChecks({
    publicHealth: { status: 200, body: { ok: true } },
    routeProbes: { cart: { path: '/', status: 200, ok: true, hasCartDrawer: false } },
  }, '2026-09-20T00:00:00.000Z');
  const withDrawer = buildLiveChecks({
    publicHealth: { status: 200, body: { ok: true } },
    routeProbes: { cart: { path: '/', status: 200, ok: true, hasCartDrawer: true } },
  }, '2026-09-20T00:00:00.000Z');
  const cart = NODES.find(node => node.id === 'carrito');
  assert.equal(resolveState(cart, withoutDrawer.carrito, ESTADOS), ESTADOS.ERROR);
  assert.equal(resolveState(cart, withDrawer.carrito, ESTADOS), ESTADOS.PROD);
});

test('CI y Cloudflare del commit actual promueven las evidencias de integración', () => {
  const currentEvidence = {
    commit: '1212c8a8d7d98dd8db30356c97539a4a8d857971',
    checks: {
      repositoryAudit: { state: 'PASS' },
      cloudflarePages: { state: 'PASS' },
    },
  };
  const live = buildLiveChecks({ publicHealth: { status: 200, body: { ok: true } }, currentEvidence }, '2026-09-20T00:00:00.000Z');
  for (const id of ['github-actions', 'pruebas-automatizadas', 'deployments']) {
    const node = NODES.find(item => item.id === id);
    assert.equal(live[id].evidenceLevel, EVIDENCIA.CI_VERIFIED);
    assert.equal(resolveState(node, live[id], ESTADOS), ESTADOS.PROD);
  }
  const edges = buildLiveEdges({ publicHealth: { status: 200, body: { ok: true } }, currentEvidence }, '2026-09-20T00:00:00.000Z');
  for (const edge of EDGES.filter(item => item.from === 'github-actions')) {
    assert.equal(edges[edge.id].evidenceLevel, EVIDENCIA.CI_VERIFIED);
    assert.equal(resolveState(edge, edges[edge.id], ESTADOS), ESTADOS.PROD);
  }
});

test('lecturas autenticadas verifican favoritos, notificaciones y Rules sin mutarlas', () => {
  const protectedProbes = {
    favoriteApi: { ok: true, status: 200 },
    notificationApi: { ok: true, status: 200 },
    firestoreRules: {
      favorites: { ok: true, status: 200 },
      notifications: { ok: true, status: 200 },
    },
  };
  const checkedAt = '2026-09-20T00:00:00.000Z';
  const live = buildLiveChecks({ protectedProbes }, checkedAt);
  for (const id of ['favoritos', 'notificaciones', 'reglas-firestore']) {
    const node = NODES.find(item => item.id === id);
    assert.equal(live[id].evidenceLevel, EVIDENCIA.LIVE_PRODUCTION);
    assert.equal(resolveState(node, live[id], ESTADOS), ESTADOS.PROD);
  }
  const edges = buildLiveEdges({ protectedProbes }, checkedAt);
  for (const edge of EDGES.filter(item => (
    (item.from === 'apis-internas' && ['favoritos', 'notificaciones'].includes(item.to))
    || (item.from === 'cf-functions' && item.to === 'reglas-firestore')
  ))) {
    assert.equal(resolveState(edge, edges[edge.id], ESTADOS), ESTADOS.PROD);
  }
});

test('buildLiveEdges promueve la cadena de infraestructura cuando /api/health responde 200', () => {
  const publicHealth = { status: 200, body: { ok: true, checks: { firebase: true }, admin: { users: true } } };
  const live = buildLiveEdges({ publicHealth, systemHealth: null, headers: null }, '2026-09-18T00:00:00.000Z');
  const edge = EDGES.find(e => e.from === 'cf-pages' && e.to === 'cf-functions');
  assert.equal(resolveState(edge, live[edge.id], ESTADOS), ESTADOS.PROD);
});


// Regresión: un check de CI en curso (RUNNING/QUEUED) o aún sin reportar se
// mostraba como "CON ERROR" porque ok=false + status 200 caía en la rama de
// error. Solo un FAIL real debe ser rojo.
test('CI en curso o sin reportar no es error; solo un FAIL real lo es', () => {
  const at = '2026-09-20T00:00:00.000Z';
  const base = { publicHealth: { status: 200, body: { ok: true } } };
  const ids = ['github-actions', 'pruebas-automatizadas', 'deployments'];
  const cases = {
    RUNNING: false,
    QUEUED: false,
    SKIPPED: false,
    NOT_VERIFIED: false,
    FAIL: true,
  };
  for (const [state, isError] of Object.entries(cases)) {
    const currentEvidence = {
      commit: 'abcdef1234567890',
      checks: { repositoryAudit: { state }, cloudflarePages: { state } },
    };
    const live = buildLiveChecks({ ...base, currentEvidence }, at);
    const edges = buildLiveEdges({ ...base, currentEvidence }, at);
    for (const id of ids) {
      const node = NODES.find(item => item.id === id);
      const resolved = resolveState(node, live[id], ESTADOS);
      assert.notEqual(resolved, ESTADOS.PROD, `${id}/${state} no puede ser verde`);
      assert.equal(resolved === ESTADOS.ERROR, isError, `${id}/${state} → ${resolved}`);
    }
    for (const edge of EDGES.filter(item => item.from === 'github-actions')) {
      const resolved = resolveState(edge, edges[edge.id], ESTADOS);
      assert.equal(resolved === ESTADOS.ERROR, isError, `${edge.id}/${state} → ${resolved}`);
    }
  }
});

test('un deploy de CI pendiente no pisa la evidencia runtime del commit desplegado', () => {
  const live = buildLiveChecks({
    publicHealth: { status: 200, body: { ok: true } },
    systemHealth: { status: 200, body: { report: { integrations: {}, deployment: { commitSha: 'abcdef1234567890', branch: 'main' } } } },
    currentEvidence: { commit: 'abcdef1234567890', checks: { repositoryAudit: { state: 'RUNNING' }, cloudflarePages: { state: 'RUNNING' } } },
  }, '2026-09-20T00:00:00.000Z');
  const deployments = NODES.find(item => item.id === 'deployments');
  assert.equal(live.deployments.ok, true);
  assert.equal(resolveState(deployments, live.deployments, ESTADOS), ESTADOS.PROD);
});

// Regresión: probeClientFirestoreRules devolvía promesas sin esperar, así que
// `.ok` era undefined y las Rules se reportaban siempre como "no confirmadas".
test('probeClientFirestoreRules espera ambas lecturas antes de devolver', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../../js/admin/flujo-conexiones/flujo-conexiones-admin.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('async function probeClientFirestoreRules'), src.indexOf('export function initConnectionsFlow'));
  assert.match(body, /await Promise\.all\(\[/, 'debe esperar ambas lecturas con Promise.all');
  assert.doesNotMatch(body, /return \{\s*favorites: probeClientFirestoreRead/, 'no debe devolver promesas sin resolver');
});
