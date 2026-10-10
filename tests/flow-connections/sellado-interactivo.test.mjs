import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const browserPackage = 'playwright';
const { chromium } = await import(browserPackage);
import { ESTADOS } from '../../js/admin/flujo-conexiones/datos-flujo-conexiones.js';
import { EVIDENCIA, resolveAutomaticState, createAutomaticMonitor } from '../../js/admin/flujo-conexiones/estado-flujo.js';

// Regresión del antiguo sellado manual: el estado actual depende exclusivamente
// de pruebas recientes. Se conservan los documentos históricos sin escribirlos.
const now = Date.parse('2026-10-10T14:00:00Z');
const record = { state: ESTADOS.PROD };
const green = { ok: true, promote: true, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION, checkedAt: new Date(now).toISOString() };

test('prueba actual correcta pasa a verde sin sello ni confirmación', () => {
  assert.equal(resolveAutomaticState(record, green, ESTADOS, { now }), ESTADOS.PROD);
  assert.equal(resolveAutomaticState({ ...record, seal: { intact: false } }, green, ESTADOS, { now }), ESTADOS.PROD);
});
test('un sello histórico no tapa un fallo actual ni convierte una lectura parcial en verde', () => {
  const sealed = { ...record, seal: { intact: true } };
  assert.equal(resolveAutomaticState(sealed, { ...green, ok: false, status: 503 }, ESTADOS, { now }), ESTADOS.ERROR);
  assert.equal(resolveAutomaticState(sealed, { ...green, partial: true }, ESTADOS, { now }), ESTADOS.PARCIAL);
});
test('sin red, sin fecha o con evidencia vencida no conserva un verde', () => {
  for (const [live, options] of [[green, { available: false }], [{ ...green, checkedAt: null }, {}], [green, { now: now + 90_000 }], [{ ...green, checkedAt: new Date(now + 1).toISOString() }, {}]]) {
    assert.equal(resolveAutomaticState(record, live, ESTADOS, { now, ...options }), ESTADOS.NO_VERIFICADO);
  }
});
test('CI en curso o sesión sin confirmar quedan pendientes; recuperación vuelve a verde', () => {
  for (const fields of [{ pending: true }, { status: 401 }, { authRequired: true }]) {
    assert.equal(resolveAutomaticState(record, { ...green, ...fields }, ESTADOS, { now }), ESTADOS.NO_VERIFICADO);
  }
  assert.equal(resolveAutomaticState(record, { ...green, evidenceLevel: EVIDENCIA.CI_VERIFIED }, ESTADOS, { now }), ESTADOS.PROD);
});

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(check = async () => {}) {
  let active = true;
  let time = 0;
  let nextId = 0;
  const scheduled = new Map();
  const statuses = [];
  const errors = [];
  const runs = [];
  const timers = {
    setTimeout(callback, delay) { const id = ++nextId; scheduled.set(id, { at: time + delay, callback }); return id; },
    clearTimeout(id) { scheduled.delete(id); },
  };
  const monitor = createAutomaticMonitor({
    check: signal => { runs.push(signal); return check(signal); },
    isActive: () => active, onStatus: state => statuses.push(state), onError: error => errors.push(error), timers,
  });
  return { monitor, runs, errors, statuses, scheduled, setActive: value => { active = value; },
    async advance(ms) {
      time += ms;
      for (const [id, task] of [...scheduled]) if (task.at <= time) { scheduled.delete(id); task.callback(); }
      await tick();
    },
  };
}
test('arranca sin clic y se repite automáticamente después de terminar', async () => {
  const f = fixture(); f.monitor.refresh(); await tick();
  assert.equal(f.runs.length, 1);
  await f.advance(29_999); assert.equal(f.runs.length, 1);
  await f.advance(1); assert.equal(f.runs.length, 2);
  f.monitor.dispose(); assert.equal(f.scheduled.size, 0);
});
test('eventos repetidos no solapan comprobaciones ni adelantan el intervalo', async () => {
  const wait = deferred(); const f = fixture(() => wait.promise);
  f.monitor.refresh(); f.monitor.refresh(); f.monitor.refresh();
  assert.equal(f.runs.length, 1);
  wait.resolve(); await tick(); f.monitor.refresh(); assert.equal(f.runs.length, 1);
  f.monitor.dispose();
});
test('ocultar o perder red cancela; volver retoma sin clic y descarta el resultado anterior', async () => {
  const wait = deferred(); let accepted = 0;
  const f = fixture(async signal => { await wait.promise; if (!signal.aborted) accepted++; });
  f.monitor.refresh(); f.setActive(false); f.monitor.refresh(); await tick();
  assert.equal(f.runs[0].aborted, true); assert.equal(f.scheduled.size, 0);
  f.setActive(true); f.monitor.refresh(); assert.equal(f.runs.length, 2);
  wait.resolve(); await tick(); assert.equal(accepted, 1); assert.equal(f.errors.length, 0);
  f.monitor.dispose();
});
test('plazo agotado no deja el monitor trabado y se reintenta automáticamente', async () => {
  const wait = deferred(); const f = fixture(() => wait.promise);
  f.monitor.refresh(); await f.advance(45_000);
  assert.equal(f.runs[0].aborted, true); assert.match(f.errors[0].message, /plazo/);
  await f.advance(30_000); assert.equal(f.runs.length, 2);
  f.monitor.dispose(); wait.resolve(); await tick(); assert.equal(f.scheduled.size, 0);
});
test('fallo recuperable se vuelve a comprobar y no exige botón de reintento', async () => {
  let fail = true; const f = fixture(async () => { if (fail) throw new Error('unavailable'); });
  f.monitor.refresh(); await tick(); assert.equal(f.errors.length, 1);
  fail = false; await f.advance(30_000);
  assert.equal(f.runs.length, 2); assert.equal(f.statuses.at(-1), 'waiting'); f.monitor.dispose();
});
test('dispose libera temporizadores y evita actividad futura', async () => {
  const wait = deferred(); const f = fixture(() => wait.promise);
  f.monitor.refresh(); f.monitor.dispose(); f.monitor.refresh(); f.monitor.restart();
  wait.resolve(); await tick(); await f.advance(120_000);
  assert.equal(f.runs.length, 1); assert.equal(f.runs[0].aborted, true); assert.equal(f.scheduled.size, 0);
});
test('cambio de sesión cancela la comprobación previa; navegación con bfcache puede reanudar', async () => {
  const wait = deferred(); const f = fixture(() => wait.promise);
  f.monitor.refresh(); f.monitor.restart(); assert.equal(f.runs[0].aborted, true);
  f.monitor.pause(); await tick(); assert.equal(f.runs[1].aborted, true);
  f.monitor.refresh(); assert.equal(f.runs.length, 3);
  wait.resolve(); await tick(); f.monitor.dispose();
});

test('panel real sin botones: verde, fallo, recuperación y pausa automática en móvil, tablet y desktop', { timeout: 60_000 }, async () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const css = fs.readFileSync(path.join(repo, 'css/admin/flujo-conexiones.css'), 'utf8');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      const requests = [];
      let audit = 'PASS';
      let healthReads = 0;
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date(now) });
      await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname });
        const js = body => route.fulfill({ contentType: 'text/javascript', body });
        if (url.pathname.endsWith('/core/firebase/firebase.js')) return js(`
          export const auth = { currentUser: { uid: 'fixture', email: 'fixture@example.invalid',
            getIdToken: async () => 'fixture', getIdTokenResult: async () => ({ claims: { email: 'fixture@example.invalid', aud: 'tintin-accesorios' } }) } };
          window.__fixtureAuth = auth;
          export const db = {};
        `);
        if (url.pathname.endsWith('/auth/lecturas-admin.js')) return js('export const readAdminFirestore = read => read();');
        if (url.pathname.endsWith('/auth/app-check-admin.js')) return js('export const waitForAdminAppCheck = async () => true;');
        if (url.pathname.endsWith('/auth/coordinador-sesion.js')) return js(`
          export function subscribeAuthState(callback) { queueMicrotask(() => callback(window.__fixtureAuth.currentUser)); return () => {}; }
        `);
        if (url.pathname.endsWith('/firebase-firestore.js')) return js(`
          export const collection = (...args) => args, doc = (...args) => args, query = (...args) => args, limit = n => n, orderBy = (...args) => args;
          export const getDocFromServer = async () => ({ exists: () => true, data: () => ({ role: 'superadmin' }) });
          export const getDocsFromServer = async () => ({ empty: false, size: 1, docs: [{ id: 'fixture-product', data: () => ({ createdAt: '${new Date(now).toISOString()}' }) }] });
        `);
        if (url.pathname.startsWith('/js/')) {
          const file = path.resolve(repo, `.${url.pathname}`);
          assert.ok(file.startsWith(`${repo}/js/`));
          return js(fs.readFileSync(file, 'utf8'));
        }
        if (url.pathname.startsWith('/api/')) {
          if (url.pathname === '/api/health') healthReads++;
          const currentEvidence = { commit: 'fixture-current', checks: { repositoryAudit: { state: audit }, cloudflarePages: { state: 'PASS' } } };
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, currentEvidence,
            productId: 'fixture-product', likeCount: 1, stats: {}, checks: { firebase: true },
            report: { integrations: { resend: true, cloudinary: true, paypal: 'sandbox' } },
          }) });
        }
        const fixture = url.pathname === '/fixture';
        return route.fulfill({ contentType: 'text/html', headers: { 'content-security-policy': "default-src * 'unsafe-inline'" }, body: fixture ? `
          <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
          <style>*{box-sizing:border-box}body{margin:0;font-family:Montserrat}.adm-section:not(.active){display:none}
          .adm-card{margin:12px}.adm-card-head{display:flex}.adm-card-body{padding:12px}.adm-select{min-height:40px;padding:8px}
          :root{--admin-color-brand:#ad3f67;--admin-color-border:#ddd;--admin-color-text-secondary:#555;--admin-color-background-surface:#fff}${css}</style>
          <main><section id="section-flujo-conexiones" class="adm-section active"></section></main>
          <script type="module">const modulePath = '/js/admin/flujo-conexiones/flujo-conexiones-admin.js'; const { initConnectionsFlow } = await import(modulePath); initConnectionsFlow({role:'superadmin'});</script>
        ` : '<!doctype html><div id="cart-drawer"></div>' });
      });
      await page.goto('http://flow.test/fixture');
      const node = '[data-node-id="google-btn"]';
      await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains('tfc-state-funcionando-en-produccion'), node);
      assert.equal(await page.locator('#section-flujo-conexiones button').count(), 0);
      assert.equal(requests.some(request => request.method !== 'GET'), false);
      assert.equal(requests.some(request => request.path.includes('flowSeals')), false);
      await page.locator(node).focus();
      audit = 'FAIL';
      await page.clock.runFor(30_001);
      await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains('tfc-state-con-error'), node);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.nodeId), 'google-btn');
      audit = 'PASS';
      await page.clock.runFor(30_001);
      await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains('tfc-state-funcionando-en-produccion'), node);
      await page.evaluate(() => document.getElementById('section-flujo-conexiones').classList.remove('active'));
      await page.waitForFunction(() => document.getElementById('tfc-monitor-status').textContent.includes('pausado'));
      const readsWhileHidden = healthReads;
      await page.clock.runFor(120_001);
      assert.equal(healthReads, readsWhileHidden);
      await page.evaluate(() => document.getElementById('section-flujo-conexiones').classList.add('active'));
      await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains('tfc-state-funcionando-en-produccion'), node);
      await page.context().setOffline(true);
      await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
      await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains('tfc-state-implementado-pero-no-verificado'), node);
      await page.context().setOffline(false);
      await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); });
      await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains('tfc-state-funcionando-en-produccion'), node);
      await page.locator(node).click();
      assert.equal(await page.locator('#tfc-detail button').count(), 0);
      const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(geometry.scroll <= geometry.width + 2, `overflow ${width}: ${JSON.stringify(geometry)}`);
      assert.deepEqual(errors, []);
      assert.equal(requests.some(request => request.method !== 'GET'), false);
      await page.close();
    }
  } finally { await browser.close(); }
});
