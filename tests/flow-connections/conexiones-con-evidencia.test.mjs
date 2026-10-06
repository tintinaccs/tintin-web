// Conexiones del Flujo que antes no tenían ninguna comprobación conectada.
// Cada una queda verde únicamente con evidencia real: el Repository audit del
// commit (que ejecuta su código), una lectura real de producción, o ambas
// cuando la conexión incluye una escritura. Las que dependen de un sistema
// externo (Sheets) o de la actividad de las clientas (likes, reseñas) exigen
// además la constancia de una operación real. Ninguna se pinta a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ESTADOS, EDGES, NODES } from '../../js/admin/flujo-conexiones/datos-flujo-conexiones.js';
import { EVIDENCIA, resolveState } from '../../js/admin/flujo-conexiones/estado-flujo.js';
import {
  ACCESS_DECISION_EDGES,
  PRODUCTS_WEBHOOK_EXPECTED_REVISION,
  WRITE_CONTRACT_SUITES,
  buildLiveChecks,
  buildLiveEdges,
  classifyOrderEmailDelivery,
  classifySheetsChannel,
} from '../../js/admin/flujo-conexiones/live-checks.js';

const AT = '2026-10-06T00:00:00.000Z';
const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
const edgeOf = (from, to) => {
  const edge = EDGES.find(item => item.from === from && item.to === to);
  assert.ok(edge, `${from} → ${to} debe existir en el flujo`);
  return edge;
};
const edgeState = (from, to, input) => {
  const edge = edgeOf(from, to);
  return resolveState(edge, buildLiveEdges(input, AT)[edge.id], ESTADOS);
};
const ci = state => ({
  commit: 'dd2d9e5e2df22333b9c323c04b7449caf03ed9d8',
  checks: { repositoryAudit: { state }, cloudflarePages: { state: 'PASS' } },
});
const SURFACES = Object.fromEntries(['products', 'productInventory', 'collections', 'orders', 'users', 'reviews', 'likes', 'emailLogs', 'auditLog', 'settings', 'siteContent', 'visualBuilder'].map(id => [id, true]));
const health = (admin = SURFACES) => {
  const ok = Object.values(admin).every(Boolean);
  return { status: ok ? 200 : 503, body: { ok, checks: { firebase: admin.products === true }, admin } };
};
const emailReport = ({ resend = true, paidOrders = 4, paidWithoutEmail = 0, deadLetterCount = 0, pendingCount = 0, available = true, queue = true } = {}) => ({
  integrations: { resend, orderEmailQueue: queue ? { pendingCount, deadLetterCount } : null },
  checkout: { available, paidOrders, paidWithoutEmail },
});

test('bloqueo y destino por rol sólo quedan verdes con el Repository audit del commit en PASS', () => {
  for (const [from, to, suite] of ACCESS_DECISION_EDGES) {
    const edge = edgeOf(from, to);
    assert.equal(buildLiveEdges({}, AT)[edge.id], undefined, `${from} → ${to}: sin evidencia no hay marca`);
    assert.notEqual(edgeState(from, to, {}), ESTADOS.PROD);

    const passed = buildLiveEdges({ currentEvidence: ci('PASS') }, AT)[edge.id];
    assert.equal(passed.evidenceLevel, EVIDENCIA.CI_VERIFIED);
    assert.ok(passed.note.includes(suite), 'el detalle nombra la prueba que lo sostiene');
    assert.equal(resolveState(edge, passed, ESTADOS), ESTADOS.PROD);

    assert.equal(edgeState(from, to, { currentEvidence: ci('FAIL') }), ESTADOS.ERROR, 'una prueba fallida se ve en rojo');
    for (const pending of ['RUNNING', 'QUEUED', 'NOT_VERIFIED']) {
      const state = edgeState(from, to, { currentEvidence: ci(pending) });
      assert.notEqual(state, ESTADOS.PROD, `${pending} no es verde`);
      assert.notEqual(state, ESTADOS.ERROR, `${pending} no es un fallo`);
    }
  }
});

test('las pruebas que sostienen esos verdes existen, ejecutan código real y corren en el Repository audit', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  const workflow = read('.github/workflows/auditar-tintin.yml');
  const auditFinal = scripts['audit:final'];
  const runners = {
    'tests/accounts/': ['test:accounts', () => /npm run test:accounts/.test(workflow)],
    'tests/login/': ['audit:login-profile', () => auditFinal.includes('npm run audit:login-profile') && /npm run audit:final/.test(workflow)],
    'tests/auth/': ['audit:login-isolation', () => auditFinal.includes('npm run audit:login-isolation') && /npm run audit:final/.test(workflow)],
  };
  for (const [from, to, file] of ACCESS_DECISION_EDGES) {
    const source = read(file);
    assert.match(source, /new Function\(/, `${file} debe ejecutar el código real, no sólo leer su texto`);
    const folder = Object.keys(runners).find(prefix => file.startsWith(prefix));
    assert.ok(folder, `${file} está fuera de las carpetas que el audit ejecuta`);
    const [script, inWorkflow] = runners[folder];
    assert.ok(scripts[script].includes(`${folder}*.test.mjs`), `${script} debe ejecutar ${folder}*.test.mjs`);
    assert.ok(inWorkflow(), `${script} debe correr en el Repository audit`);
    assert.ok(edgeOf(from, to).evidence.some(item => item.file === file), `${from} → ${to} debe citar ${file} como evidencia`);
  }
  for (const file of ['tests/orders/order-admin-domain.test.mjs', 'tests/orders/variant-inventory.test.mjs']) {
    assert.ok(fs.existsSync(new URL(`../../${file}`, import.meta.url)));
    assert.ok(workflow.includes(file), `${file} debe correr en el Repository audit`);
    assert.ok(`${WRITE_CONTRACT_SUITES.orders} ${WRITE_CONTRACT_SUITES.stock}`.includes(file));
  }
  assert.match(workflow, /npm run test:rules-critical/);
  assert.match(WRITE_CONTRACT_SUITES.panel, /test:rules-critical/);
});

test('pedidos e inventario exigen lectura real de producción y audit del commit a la vez', () => {
  const cases = [
    ['apis-internas', 'pedidos', { ...SURFACES, orders: false }],
    ['pedidos', 'inventario', { ...SURFACES, productInventory: false }],
  ];
  for (const [from, to, broken] of cases) {
    assert.equal(edgeState(from, to, { publicHealth: health(), currentEvidence: ci('PASS') }), ESTADOS.PROD);
    assert.equal(edgeState(from, to, { publicHealth: health() }), ESTADOS.PARCIAL, 'lectura sola: evidencia parcial, no verde');
    assert.notEqual(edgeState(from, to, { currentEvidence: ci('PASS') }), ESTADOS.PROD, 'un test solo no prueba producción');
    assert.equal(buildLiveEdges({ currentEvidence: ci('PASS') }, AT)[edgeOf(from, to).id], undefined);
    assert.equal(edgeState(from, to, { publicHealth: health(), currentEvidence: ci('FAIL') }), ESTADOS.ERROR);
    const running = edgeState(from, to, { publicHealth: health(), currentEvidence: ci('RUNNING') });
    assert.notEqual(running, ESTADOS.PROD);
    assert.notEqual(running, ESTADOS.ERROR);
    assert.equal(edgeState(from, to, { publicHealth: health(broken), currentEvidence: ci('PASS') }), ESTADOS.ERROR, 'una superficie caída en producción no se tapa con CI verde');
  }
  // El stock necesita las dos superficies: pedidos sola no alcanza.
  assert.equal(edgeState('pedidos', 'inventario', { publicHealth: health({ ...SURFACES, orders: false }), currentEvidence: ci('PASS') }), ESTADOS.ERROR);
});

test('panel → productos y panel → pedidos exigen la lectura con la sesión real y el audit del commit', () => {
  const rules = (products, orders) => ({ firestoreRules: { products, orders } });
  const ok = { ok: true, status: 200 };
  const denied = { ok: false, status: 403, authRequired: true };
  for (const [to, other] of [['productos', 'pedidos'], ['pedidos', 'productos']]) {
    const both = { protectedProbes: rules(ok, ok), currentEvidence: ci('PASS') };
    assert.equal(edgeState('super-panel', to, both), ESTADOS.PROD);
    const live = buildLiveEdges(both, AT)[edgeOf('super-panel', to).id];
    assert.equal(live.evidenceLevel, EVIDENCIA.LIVE_PRODUCTION);
    assert.match(live.note, /SDK Firestore con la sesión del panel/);
    assert.equal(edgeState('super-panel', to, { protectedProbes: rules(ok, ok) }), ESTADOS.PARCIAL);
    assert.notEqual(edgeState('super-panel', to, { currentEvidence: ci('PASS') }), ESTADOS.PROD);
    assert.equal(edgeState('super-panel', to, { protectedProbes: rules(ok, ok), currentEvidence: ci('FAIL') }), ESTADOS.ERROR);

    const onlyOther = to === 'productos' ? rules(denied, ok) : rules(ok, denied);
    const state = edgeState('super-panel', to, { protectedProbes: onlyOther, currentEvidence: ci('PASS') });
    assert.notEqual(state, ESTADOS.PROD, `leer ${other} no certifica ${to}`);
    assert.equal(edgeState('super-panel', other, { protectedProbes: onlyOther, currentEvidence: ci('PASS') }), ESTADOS.PROD);
  }
  // Sin sesión o sin App Check la sonda no responde: no es verde ni error.
  const unavailable = { ok: false, status: 0, authRequired: true };
  const state = edgeState('super-panel', 'productos', { protectedProbes: rules(unavailable, unavailable), currentEvidence: ci('PASS') });
  assert.equal(state, ESTADOS.NO_VERIFICADO);
});

test('el panel pide esas dos lecturas con el SDK y no escribe nada', () => {
  const source = read('js/admin/flujo-conexiones/flujo-conexiones-admin.js');
  const body = source.slice(source.indexOf('async function probeClientFirestoreRules'), source.indexOf('async function probeEngagementStats'));
  assert.match(body, /probeClientFirestoreRead\('Productos', \(\) => getDocs\(query\(\s*collection\(db, 'products'\), limit\(1\),/);
  assert.match(body, /probeClientFirestoreRead\('Pedidos', \(\) => getDocs\(query\(\s*collection\(db, 'orders'\), limit\(1\),/);
  assert.match(body, /return \{ favorites, notifications, cart, products, orders \};/);
  assert.doesNotMatch(body, /setDoc|addDoc|updateDoc|deleteDoc|writeBatch/);
});

test('correos queda verde sólo con entrega confirmada de pedidos pagados reales', () => {
  assert.equal(classifyOrderEmailDelivery(null), null);
  assert.equal(classifyOrderEmailDelivery({ integrations: {} }), null, 'sin dato de Resend no hay evidencia');
  assert.deepEqual(
    [classifyOrderEmailDelivery(emailReport()).ok, classifyOrderEmailDelivery(emailReport()).delivered],
    [true, true],
  );
  const state = report => edgeState('apis-internas', 'correos', { systemHealth: { status: 200, body: { report } } });
  assert.equal(state(emailReport()), ESTADOS.PROD);
  assert.equal(state(emailReport({ pendingCount: 2 })), ESTADOS.PROD, 'un reintento en curso no es una entrega perdida');
  assert.equal(state(emailReport({ paidWithoutEmail: 2 })), ESTADOS.PARCIAL, 'pedidos pagados sin correo confirmado');
  assert.equal(state(emailReport({ deadLetterCount: 1 })), ESTADOS.PARCIAL, 'correo abandonado en la cola');
  assert.equal(state(emailReport({ paidOrders: 0 })), ESTADOS.PARCIAL, 'sin pedidos pagados no hay entrega que confirmar');
  assert.equal(state(emailReport({ available: false })), ESTADOS.PARCIAL);
  assert.equal(state(emailReport({ queue: false })), ESTADOS.PARCIAL);
  assert.equal(state(emailReport({ resend: false })), ESTADOS.ERROR, 'Resend sin configurar es un fallo real');
  assert.notEqual(edgeState('apis-internas', 'correos', {}), ESTADOS.PROD);

  const edge = edgeOf('apis-internas', 'correos');
  const live = buildLiveEdges({ systemHealth: { status: 200, body: { report: emailReport({ paidWithoutEmail: 2 }) } } }, AT)[edge.id];
  assert.match(live.note, /2 pedido\(s\) pagado\(s\) sin correo confirmado/);
  assert.match(live.note, /confirmado: 2\/4/);
});

// Evidencia completa de solo lectura, tal como la reúne el panel con la
// sesión del Super Admin. `extra` agrega lo que sólo existe después de una
// operación real: registros de participación y acuses de Sheets.
const READ_OK = { ok: true, status: 200 };
const LIVE_PAYPAL = { configured: true, enabled: true, environment: 'live', productionReady: true };
const SANDBOX_PAYPAL = { configured: true, enabled: true, environment: 'sandbox', productionReady: false };
const REAL_RECORD = { ok: true, status: 200, exists: true, lastAt: '2026-10-05T14:30:00.000Z' };
const NO_RECORD = { ok: true, status: 200, exists: false, lastAt: '' };
const channel = (overrides = {}) => ({ deploymentRevision: 'test-current', currentDeploymentRevision: 'test-current', lastSuccessAt: '', lastSuccessKind: '', revision: '', lastErrorAt: '', lastErrorKind: '', lastError: '', ...overrides });
const INBOUND_OK = channel({ lastSuccessAt: '2026-10-06T10:00:00.000Z', lastSuccessKind: 'saveProduct', revision: PRODUCTS_WEBHOOK_EXPECTED_REVISION });
const MIRROR_OK = channel({ lastSuccessAt: '2026-10-06T11:00:00.000Z', lastSuccessKind: 'order' });
const fullInput = ({ paypal = LIVE_PAYPAL, engagementRecords, sheetsEvidence, audit = 'PASS', sheets = true, webhook } = {}) => ({
  publicHealth: health(),
  systemHealth: { status: 200, body: { report: {
    ...emailReport(),
    integrations: {
      ...emailReport().integrations,
      firebase: true, resend: true, cloudinary: true, sheets,
      appsScript: { reachable: true, protocolOk: true, httpStatus: 200 },
      paypal,
      ...(sheetsEvidence === undefined ? {} : { sheetsEvidence }),
    },
    deployment: { commitSha: 'dd2d9e5e2df22333b9c323c04b7449caf03ed9d8', branch: 'main' },
  } } },
  headers: { status: 200, csp: true },
  routeProbes: {
    home: { path: '/', ...READ_OK }, login: { path: '/login', ...READ_OK }, profile: { path: '/perfil', ...READ_OK },
    admin: { path: '/admin', ...READ_OK }, cart: { path: '/', ...READ_OK, hasCartDrawer: true },
  },
  protectedProbes: {
    favoriteApi: READ_OK, notificationApi: READ_OK,
    firestoreRules: { favorites: READ_OK, notifications: READ_OK, cart: READ_OK, products: READ_OK, orders: READ_OK },
    engagementStats: { likes: READ_OK, reviews: READ_OK },
    ...(engagementRecords ? { engagementRecords } : {}),
    sheetsWebhook: webhook || { status: 200, revision: 'products-canonical-v3', authState: 'configured' },
  },
  sessionProbe: { authenticated: true, token: true, role: true, profile: true, status: 200 },
  currentEvidence: audit ? ci(audit) : undefined,
});
const pendingOf = probes => {
  const nodes = buildLiveChecks(probes, AT);
  const edges = buildLiveEdges(probes, AT);
  return [
    ...NODES.filter(node => resolveState(node, nodes[node.id], ESTADOS) !== ESTADOS.PROD).map(node => node.id),
    ...EDGES.filter(edge => resolveState(edge, edges[edge.id], ESTADOS) !== ESTADOS.PROD).map(edge => `${edge.from} → ${edge.to}`),
  ].sort();
};
const nodeState = (id, probes) => resolveState(NODES.find(node => node.id === id), buildLiveChecks(probes, AT)[id], ESTADOS);
const SHEETS_RECORDS = [
  'apps-script → google-sheets', 'apps-script → sheets-products-webhook', 'firestore → apps-script',
  'google-sheets', 'google-sheets → apps-script', 'sheets-products-webhook', 'sheets-products-webhook → firestore',
];
const ENGAGEMENT_RECORDS = ['apis-internas → comentarios', 'apis-internas → likes', 'comentarios', 'likes'];
const PAYPAL_RECORDS = ['apis-internas → servicios-externos', 'servicios-externos'];

test('sin ninguna operación real registrada, sólo quedan pendientes Sheets, likes y reseñas', () => {
  // Ninguna lectura demuestra esas escrituras: siguen fuera del verde a
  // propósito hasta que producción registre una operación real.
  assert.deepEqual(pendingOf(fullInput()), [...SHEETS_RECORDS, ...ENGAGEMENT_RECORDS].sort());
  assert.deepEqual(
    pendingOf(fullInput({ engagementRecords: { likes: NO_RECORD, reviews: NO_RECORD }, sheetsEvidence: { inbound: channel(), mirror: channel() } })),
    [...SHEETS_RECORDS, ...ENGAGEMENT_RECORDS].sort(),
  );
  // PayPal en Sandbox es un estado real de configuración: no se disimula.
  assert.deepEqual(pendingOf(fullInput({ paypal: SANDBOX_PAYPAL })), [...SHEETS_RECORDS, ...ENGAGEMENT_RECORDS, ...PAYPAL_RECORDS].sort());
});

test('con operaciones reales registradas y el audit en PASS no queda nada pendiente salvo PayPal en Sandbox', () => {
  const real = { engagementRecords: { likes: REAL_RECORD, reviews: REAL_RECORD }, sheetsEvidence: { inbound: INBOUND_OK, mirror: MIRROR_OK } };
  assert.deepEqual(pendingOf(fullInput(real)), []);
  assert.deepEqual(pendingOf(fullInput({ ...real, paypal: SANDBOX_PAYPAL })), PAYPAL_RECORDS);
  // Cada evidencia real mueve sólo lo suyo.
  assert.deepEqual(pendingOf(fullInput({ engagementRecords: real.engagementRecords })), SHEETS_RECORDS);
  assert.deepEqual(pendingOf(fullInput({ sheetsEvidence: real.sheetsEvidence })), ENGAGEMENT_RECORDS);
  // Un registro real sin el audit del commit no alcanza, y con el audit en FAIL es un error visible.
  assert.ok(ENGAGEMENT_RECORDS.every(id => pendingOf(fullInput({ ...real, audit: null })).includes(id)));
  for (const id of ['likes', 'comentarios']) assert.equal(nodeState(id, fullInput({ ...real, audit: 'FAIL' })), ESTADOS.ERROR);
});

test('firestore → carrito exige la lectura real del carrito y las Rules del carrito ejecutadas en el audit', () => {
  const cart = probe => ({ protectedProbes: { firestoreRules: { cart: probe } } });
  assert.equal(edgeState('firestore', 'carrito', { ...cart(READ_OK), currentEvidence: ci('PASS') }), ESTADOS.PROD);
  const live = buildLiveEdges({ ...cart(READ_OK), currentEvidence: ci('PASS') }, AT)[edgeOf('firestore', 'carrito').id];
  assert.match(live.note, /lectura del carrito propio permitida/);
  assert.ok(live.note.includes(WRITE_CONTRACT_SUITES.cart));
  assert.equal(edgeState('firestore', 'carrito', cart(READ_OK)), ESTADOS.PARCIAL, 'lectura sola: parcial');
  assert.notEqual(edgeState('firestore', 'carrito', { currentEvidence: ci('PASS') }), ESTADOS.PROD, 'un test solo no prueba producción');
  assert.equal(edgeState('firestore', 'carrito', { ...cart(READ_OK), currentEvidence: ci('FAIL') }), ESTADOS.ERROR);
  const running = edgeState('firestore', 'carrito', { ...cart(READ_OK), currentEvidence: ci('RUNNING') });
  assert.notEqual(running, ESTADOS.PROD);
  assert.notEqual(running, ESTADOS.ERROR);
  const denied = edgeState('firestore', 'carrito', { ...cart({ ok: false, status: 403, authRequired: true }), currentEvidence: ci('PASS') });
  assert.equal(denied, ESTADOS.NO_VERIFICADO, 'sin lectura real no hay verde aunque el audit pase');

  // La prueba que sostiene ese verde existe, cubre altas, ediciones, bajas y rechazos, y corre en el audit.
  const rulesTest = read('scripts/probar-firestore-critico.mjs');
  const cartBlock = rulesTest.slice(rulesTest.indexOf("const ownCartLine"), rulesTest.indexOf("// Me gusta y reseñas"));
  assert.match(cartBlock, /succeeds\(setDoc\(ownCartLine, cartLine\(\)\)\)/);
  assert.match(cartBlock, /succeeds\(setDoc\(ownCartLine, cartLine\(\{ qty: 3 \}\)\)\)/);
  assert.match(cartBlock, /succeeds\(deleteDoc\(ownCartLine\)\)/);
  assert.ok((cartBlock.match(/await fails\(/g) || []).length >= 10, 'los rechazos del carrito también se ejecutan');
  assert.match(JSON.parse(read('package.json')).scripts['test:rules-critical'], /^firebase emulators:exec .*node scripts\/probar-firestore-critico\.mjs/);
  assert.match(read('.github/workflows/auditar-tintin.yml'), /npm run test:rules-critical/);
  assert.ok(edgeOf('firestore', 'carrito').evidence.some(item => item.file === 'scripts/probar-firestore-critico.mjs'));
});

test('likes y reseñas exigen estadísticas reales, un registro real de la API y el audit del commit', () => {
  const input = ({ stats = READ_OK, record = REAL_RECORD, audit = 'PASS' } = {}) => ({
    protectedProbes: { engagementStats: { likes: stats, reviews: stats }, engagementRecords: record ? { likes: record, reviews: record } : undefined },
    currentEvidence: audit ? ci(audit) : undefined,
  });
  for (const [id, label] of [['likes', 'likes'], ['comentarios', 'reseñas']]) {
    const state = probes => [nodeState(id, probes), edgeState('apis-internas', id, probes)];
    assert.deepEqual(state(input()), [ESTADOS.PROD, ESTADOS.PROD]);
    const live = buildLiveChecks(input(), AT)[id];
    assert.equal(live.evidenceLevel, EVIDENCIA.LIVE_PRODUCTION);
    assert.ok(live.note.includes('último: 2026-10-05T14:30:00.000Z'), 'el detalle muestra la fecha del registro real');
    assert.ok(live.note.includes(WRITE_CONTRACT_SUITES.engagement));
    assert.ok(live.note.includes(label));

    assert.deepEqual(state(input({ record: NO_RECORD })), [ESTADOS.PARCIAL, ESTADOS.PARCIAL], 'sin registro real sigue parcial');
    assert.match(buildLiveChecks(input({ record: NO_RECORD }), AT)[id].note, /todavía no hay ningún registro real/);
    assert.deepEqual(state(input({ record: null })), [ESTADOS.PARCIAL, ESTADOS.PARCIAL], 'sin la lectura del registro sigue parcial');
    assert.deepEqual(state(input({ record: { ok: false, status: 403, authRequired: true, exists: false } })), [ESTADOS.PARCIAL, ESTADOS.PARCIAL]);
    assert.deepEqual(state(input({ audit: null })), [ESTADOS.PARCIAL, ESTADOS.PARCIAL], 'sin CI del commit sigue parcial');
    assert.deepEqual(state(input({ audit: 'FAIL' })), [ESTADOS.ERROR, ESTADOS.ERROR], 'la prueba de escritura fallida se ve en rojo');
    for (const running of ['RUNNING', 'QUEUED', 'NOT_VERIFIED']) {
      for (const value of state(input({ audit: running }))) {
        assert.notEqual(value, ESTADOS.PROD);
        assert.notEqual(value, ESTADOS.ERROR);
      }
    }
    // Un registro real no tapa una lectura caída de las estadísticas.
    for (const value of state(input({ stats: { ok: false, status: 500 } }))) assert.equal(value, ESTADOS.ERROR);
  }
});

test('la prueba de escritura de participación ejecuta el código real y corre en el Repository audit', () => {
  const file = 'tests/engagement/escritura-participacion.test.mjs';
  const source = read(file);
  assert.match(source, /import \{[^}]*createReview[^}]*toggleFavorite[^}]*\} from /s);
  assert.ok(source.includes('cloudflare/participacion-clientes.js'), 'importa el módulo real de participación');
  assert.match(source, /await toggleFavorite\(ENV, CLIENTA/);
  assert.match(source, /await createReview\(ENV, CLIENTA/);
  assert.match(source, /documents:commit/, 'pasa por el commit real de firebase-admin-ligero');
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.ok(scripts['test:engagement'].includes('tests/engagement/*.test.mjs'));
  assert.match(read('.github/workflows/auditar-tintin.yml'), /npm run test:engagement/);
  assert.ok(WRITE_CONTRACT_SUITES.engagement.includes(file));
  for (const record of [NODES.find(node => node.id === 'likes'), NODES.find(node => node.id === 'comentarios'), edgeOf('apis-internas', 'likes'), edgeOf('apis-internas', 'comentarios')]) {
    assert.ok(record.evidence.some(item => item.file === file), `${record.id} debe citar ${file}`);
  }
  // Sólo la API escribe esos registros: por eso su existencia prueba una escritura real.
  const rules = read('firestore.rules');
  for (const collection of ['reviewRecords', 'likeRecords']) {
    assert.match(rules, new RegExp(`match /${collection}/\\{[a-zA-Z]+\\} \\{\\s+allow read: if isSuperAdmin\\(\\);\\s+allow create, update, delete: if false;`));
  }
  assert.match(read('scripts/probar-firestore-critico.mjs'), /for \(const collectionId of \['likeRecords', 'reviewRecords'\]\)/);
});

test('el panel lee el último registro real de participación sin escribir nada', () => {
  const source = read('js/admin/flujo-conexiones/flujo-conexiones-admin.js');
  const body = source.slice(source.indexOf('async function probeEngagementRecords'), source.indexOf('async function probeSheetsWebhook'));
  assert.match(body, /getDocs\(query\(collection\(db, collectionId\), orderBy\('createdAt', 'desc'\), limit\(1\)\)\)/);
  assert.match(body, /latest\('likeRecords'\), latest\('reviewRecords'\)/);
  assert.match(body, /exists: !snapshot\.empty/);
  assert.doesNotMatch(body, /setDoc|addDoc|updateDoc|deleteDoc|writeBatch|fetch\(/);
  assert.match(source, /probeEngagementRecords\(user\),/);
  assert.equal((source.match(/engagementStats, engagementRecords, sheetsWebhook \}/g) || []).length, 2, 'nodos y conexiones reciben la misma evidencia');
});

test('el acuse de Sheets se clasifica por el resultado de la última operación real', () => {
  assert.equal(classifySheetsChannel(undefined).state, 'none');
  assert.equal(classifySheetsChannel(channel()).state, 'none');
  assert.equal(classifySheetsChannel(MIRROR_OK).state, 'confirmed');
  assert.match(classifySheetsChannel(MIRROR_OK).note, /2026-10-06T11:00:00\.000Z \(order\)/);
  assert.equal(classifySheetsChannel(INBOUND_OK, { expectedRevision: PRODUCTS_WEBHOOK_EXPECTED_REVISION }).state, 'confirmed');
  assert.equal(classifySheetsChannel({ ...INBOUND_OK, revision: 'products-canonical-v2' }, { expectedRevision: PRODUCTS_WEBHOOK_EXPECTED_REVISION }).state, 'stale');
  const failedAfter = channel({ ...MIRROR_OK, lastErrorAt: '2026-10-06T12:00:00.000Z', lastErrorKind: 'order', lastError: 'No autorizado' });
  assert.equal(classifySheetsChannel(failedAfter).state, 'failed');
  assert.match(classifySheetsChannel(failedAfter).note, /falló el 2026-10-06T12:00:00\.000Z \(order\): No autorizado/);
  const recovered = channel({ ...failedAfter, lastSuccessAt: '2026-10-06T13:00:00.000Z' });
  assert.equal(classifySheetsChannel(recovered).state, 'confirmed', 'un éxito posterior al fallo vuelve a confirmar');
  assert.equal(classifySheetsChannel(channel({ lastErrorAt: '2026-10-06T12:00:00.000Z', lastError: 'x' })).state, 'failed', 'un fallo sin éxitos previos es un fallo');
});

test('cada conexión con Sheets queda verde sólo con el acuse de su sentido', () => {
  const INBOUND = ['google-sheets → apps-script', 'apps-script → sheets-products-webhook', 'sheets-products-webhook → firestore', 'sheets-products-webhook'];
  const MIRROR = ['firestore → apps-script', 'apps-script → google-sheets'];
  const pendingSheets = options => pendingOf(fullInput({ engagementRecords: { likes: REAL_RECORD, reviews: REAL_RECORD }, ...options }));
  // Una edición real de la hoja confirma el camino hoja → Firestore, no el espejo.
  assert.deepEqual(pendingSheets({ sheetsEvidence: { inbound: INBOUND_OK, mirror: channel() } }), [...MIRROR, 'google-sheets'].sort());
  // Un pedido aceptado por Apps Script confirma el espejo, no el camino hoja → Firestore.
  assert.deepEqual(pendingSheets({ sheetsEvidence: { inbound: channel(), mirror: MIRROR_OK } }), [...INBOUND, 'google-sheets'].sort());
  // La hoja necesita los dos sentidos.
  assert.deepEqual(pendingSheets({ sheetsEvidence: { inbound: INBOUND_OK, mirror: MIRROR_OK } }), []);

  // Sin acuse: lo que sólo depende del acuse conserva su estado base y lo que
  // además tiene una sonda de lectura queda parcial. Nada se pinta de verde.
  const none = fullInput({ sheetsEvidence: { inbound: channel(), mirror: channel() } });
  assert.equal(edgeState('google-sheets', 'apps-script', none), ESTADOS.DOCUMENTADO);
  assert.equal(edgeState('sheets-products-webhook', 'firestore', none), ESTADOS.DOCUMENTADO);
  assert.equal(edgeState('firestore', 'apps-script', none), ESTADOS.DOCUMENTADO);
  assert.equal(edgeState('apps-script', 'sheets-products-webhook', none), ESTADOS.PARCIAL);
  assert.equal(edgeState('apps-script', 'google-sheets', none), ESTADOS.PARCIAL);
  assert.equal(nodeState('sheets-products-webhook', none), ESTADOS.PARCIAL);
  assert.equal(nodeState('google-sheets', none), ESTADOS.PARCIAL);
  assert.match(buildLiveEdges(none, AT)[edgeOf('google-sheets', 'apps-script').id].note, /todavía no se registró ninguna sincronización real/);

  // La última operación real falló: rojo, con el motivo, en todo ese sentido.
  const inboundFailed = channel({ ...INBOUND_OK, lastErrorAt: '2026-10-06T12:00:00.000Z', lastErrorKind: 'saveProduct', lastError: 'Firestore COMMIT falló (500).' });
  const failed = fullInput({ sheetsEvidence: { inbound: inboundFailed, mirror: MIRROR_OK } });
  for (const [from, to] of [['google-sheets', 'apps-script'], ['apps-script', 'sheets-products-webhook'], ['sheets-products-webhook', 'firestore']]) {
    assert.equal(edgeState(from, to, failed), ESTADOS.ERROR, `${from} → ${to}`);
  }
  assert.equal(nodeState('sheets-products-webhook', failed), ESTADOS.ERROR);
  assert.equal(nodeState('google-sheets', failed), ESTADOS.ERROR);
  assert.equal(edgeState('firestore', 'apps-script', failed), ESTADOS.PROD, 'el otro sentido no se contamina');
  assert.match(buildLiveEdges(failed, AT)[edgeOf('sheets-products-webhook', 'firestore').id].note, /Firestore COMMIT falló \(500\)/);

  // Un acuse de una revisión anterior del webhook no certifica la actual.
  const stale = fullInput({ sheetsEvidence: { inbound: { ...INBOUND_OK, revision: 'products-canonical-v2' }, mirror: MIRROR_OK } });
  assert.notEqual(edgeState('sheets-products-webhook', 'firestore', stale), ESTADOS.PROD);
  assert.notEqual(nodeState('sheets-products-webhook', stale), ESTADOS.PROD);
  // El acuse no tapa un guard caído ni un webhook con otra revisión desplegada.
  const real = { inbound: INBOUND_OK, mirror: MIRROR_OK };
  assert.notEqual(edgeState('apps-script', 'google-sheets', fullInput({ sheetsEvidence: real, sheets: false })), ESTADOS.PROD);
  assert.notEqual(nodeState('google-sheets', fullInput({ sheetsEvidence: real, sheets: false })), ESTADOS.PROD);
  const wrongWebhook = fullInput({ sheetsEvidence: real, webhook: { status: 200, revision: 'products-canonical-v2', authState: 'configured' } });
  assert.notEqual(edgeState('apps-script', 'sheets-products-webhook', wrongWebhook), ESTADOS.PROD);
  assert.notEqual(nodeState('sheets-products-webhook', wrongWebhook), ESTADOS.PROD);
  // Sin /api/system-health (sin sesión) no hay acuse y nada relacionado con Sheets queda verde.
  const noHealth = { ...fullInput({ sheetsEvidence: real }), systemHealth: { status: 401, ok: false, body: { code: 'authentication_required' } } };
  assert.ok(SHEETS_RECORDS.every(id => pendingOf(noHealth).includes(id)));
});

test('los acuses de Sheets los escribe sólo el servidor después de una operación real', () => {
  const webhook = read('functions/api/sheets-products-webhook.js');
  assert.match(webhook, /await firestoreAdminCommit\(env, writes\);\s+committing = '';\s+await acknowledge\(\{ \.\.\.operation, ok: true, kind: 'saveProduct', revision: PRODUCTS_WEBHOOK_REVISION \}\);/);
  assert.match(webhook, /if \(committing\) await acknowledge\(\{ \.\.\.operation, ok: false, kind: committing, error \}\);/);
  assert.match(read('cloudflare/order-sheets-sync.js'), /await acknowledge\(env, recordEvidence, \{ \.\.\.operation, ok: true, kind: 'order' \}\);/);
  assert.match(read('cloudflare/system-health.js'), /engagementSheetQueue,\s+sheetsEvidence,\s+\};/);
  // El navegador nunca escribe el acuse: la colección queda bajo la negación general de las Rules.
  assert.doesNotMatch(read('firestore.rules'), /match \/syncMeta\//);
  for (const file of ['js/admin/flujo-conexiones/flujo-conexiones-admin.js', 'js/admin/flujo-conexiones/live-checks.js']) {
    assert.doesNotMatch(read(file), /sheetsFlowEvidence|recordSheetsEvidence/);
  }
  const edgeFiles = (from, to) => edgeOf(from, to).evidence.map(item => item.file);
  for (const [from, to] of [['firestore', 'apps-script'], ['apps-script', 'google-sheets'], ['google-sheets', 'apps-script'], ['apps-script', 'sheets-products-webhook'], ['sheets-products-webhook', 'firestore']]) {
    assert.ok(edgeFiles(from, to).includes('cloudflare/evidencia-sync-sheets.js'), `${from} → ${to} debe citar el acuse como evidencia`);
  }
});

// La evidencia de CI llega por /api/master-diagnostics. Si esa fuente falla,
// las conexiones que dependen del audit no pueden confirmarse: el panel debe
// decirlo, y el endpoint debe distinguir "falta sesión" de "falló el servidor".
test('master-diagnostics sin token responde 401 como los demás health protegidos, no 500', async () => {
  const { onRequest } = await import('../../functions/api/master-diagnostics.js');
  for (const method of ['GET', 'POST']) {
    const request = new Request('https://tintinaccesorios.pages.dev/api/master-diagnostics', {
      method,
      headers: { origin: 'https://tintinaccesorios.pages.dev' },
    });
    const response = await onRequest({ request, env: {} });
    const payload = await response.json();
    assert.equal(response.status, 401, `${method} sin sesión`);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /sesión/i);
  }
});

test('sin evidencia de CI del commit actual el panel recibe un aviso explícito', async () => {
  const { ciEvidenceProblem } = await import('../../js/admin/flujo-conexiones/live-checks.js');
  assert.equal(ciEvidenceProblem({ status: 200, body: { currentEvidence: ci('PASS') } }), '');
  for (const [response, status] of [
    [{ status: 502, body: { ok: false } }, '502'],
    [{ status: 401, body: { ok: false } }, '401'],
    [{ status: 200, body: { ok: true, currentEvidence: null } }, '200'],
    [{ status: 0, body: null }, 'sin respuesta'],
    [undefined, 'sin respuesta'],
  ]) {
    const problem = ciEvidenceProblem(response);
    assert.ok(problem.includes(`respondió ${status} sin evidencia de CI`), problem);
    assert.match(problem, /Repository audit queda sin confirmar/);
  }
  // Sin esa evidencia ninguna conexión sostenida por CI se pinta de verde.
  for (const [from, to] of ACCESS_DECISION_EDGES) {
    assert.notEqual(edgeState(from, to, { publicHealth: health() }), ESTADOS.PROD);
  }
});


test('evidencia de Sheets de otro despliegue queda parcial y un fallo explícito prevalece', () => {
  const evidence = { lastSuccessAt: '2026-01-01T00:00:00Z', deploymentRevision: 'old', currentDeploymentRevision: 'new', result: 'success' };
  assert.equal(classifySheetsChannel(evidence).state, 'stale');
  assert.equal(classifySheetsChannel({ ...evidence, currentDeploymentRevision: '' }).state, 'stale', 'sin revisión del runtime no se inventa vigencia');
  assert.equal(classifySheetsChannel({ ...evidence, result: 'failed', lastErrorAt: evidence.lastSuccessAt }).state, 'failed');
});
