import test from 'node:test';
import assert from 'node:assert/strict';
import { heartbeatDecision, MIN_HEARTBEAT_INTERVAL_MS } from '../../js/analytics/control-heartbeat.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

test('SiteActivity deduplica un heartbeat concurrente', () => {
  assert.deepEqual(heartbeatDecision({ inFlight: true }), {
    allowed: false,
    reason: 'in-flight'
  });
});

test('SiteActivity respeta el throttling de Rules de presencia', () => {
  const now = 100_000;
  assert.equal(heartbeatDecision({ lastWriteAt: now - 19_999, now }).allowed, false);
  assert.equal(heartbeatDecision({ lastWriteAt: now - MIN_HEARTBEAT_INTERVAL_MS, now }).allowed, true);
});

test('SiteActivity queda aislada de Auth y de redirects', () => {
  const source = fs.readFileSync('js/analytics/actividad-sitio.js', 'utf8');
  assert.doesNotMatch(source, /(?:signOut|onAuthStateChanged|location\.(?:replace|assign)|sessionStorage\.removeItem\([^)]*(?:auth|identity|uid))/i);
});

test('las estadísticas no pueden saltar las cuotas de servidor con el SDK', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  for (const name of ['sitePresence', 'siteTraffic', 'siteAggregate']) {
    const block = rules.slice(rules.indexOf(`match /${name}/`)).split('\n    }')[0];
    assert.match(block, /allow create, update: if false;/);
  }
  const source = fs.readFileSync('js/analytics/actividad-sitio.js', 'utf8');
  assert.match(source, /apiUrl\('site-activity'\)/);
  assert.doesNotMatch(source, /\bsetDoc\(/);
});

function activityBootstrap({ granted = false, preview = false } = {}) {
  const loader = fs.readFileSync('js/cargador-pagina.js', 'utf8');
  const source = loader.slice(loader.indexOf('  function bootSiteActivity() {'), loader.indexOf('\n  // Avisa (sin recargar'));
  const calls = [], window = {};
  let listener;
  const privacy = { hasStatisticsConsent: () => granted, onPrivacyConsentChange: callback => { listener = callback; } };
  const run = new Function('window', 'isVisualPreviewFrame', 'importSibling', `${source}; return bootSiteActivity;`)(window, preview, async file => {
    calls.push(file);
    return file.includes('consentimiento-privacidad') ? privacy : {};
  });
  return { calls, window, run, grant() { granted = true; listener?.(); } };
}
test('el arranque sin permiso no descarga actividad y aceptar activa la misma canalización', async () => {
  const f = activityBootstrap();
  f.run(); await Promise.resolve();
  assert.deepEqual(f.calls, ['analytics/consentimiento-privacidad.js']);
  assert.equal(f.window.TINTIN_ENABLE_PUBLIC_ACTIVITY, undefined);
  f.grant();
  assert.deepEqual(f.calls, ['analytics/consentimiento-privacidad.js', 'analytics/actividad-sitio.js']);
  assert.equal(f.window.TINTIN_ENABLE_PUBLIC_ACTIVITY, true);
});
test('el permiso previamente guardado arranca actividad y repetir bootstrap no duplica listeners', async () => {
  const f = activityBootstrap({ granted: true });
  f.run(); f.run(); await Promise.resolve();
  assert.deepEqual(f.calls, ['analytics/consentimiento-privacidad.js', 'analytics/actividad-sitio.js']);
});
test('la vista previa no carga estadísticas ni preferencias de la cuenta del editor', async () => {
  const f = activityBootstrap({ granted: true, preview: true });
  f.run(); await Promise.resolve();
  assert.deepEqual(f.calls, []);
});

function privacyConsentFixture() {
  const source = fs.readFileSync('js/analytics/consentimiento-privacidad.js', 'utf8')
    .replace(/^import .*\n/, '')
    .replaceAll('export function ', 'function ');
  let now = 0;
  let nextTimer = 0;
  const timers = new Map(), listeners = new Map(), nodes = new Map();
  const document = {
    cookie: '', activeElement: null,
    body: { appendChild(node) { nodes.set(node.id, node); } },
    getElementById(id) { return nodes.get(id) || null; },
    createElement() {
      const controls = new Map();
      return {
        hidden: false,
        setAttribute() {},
        querySelector(selector) {
          if (!controls.has(selector)) controls.set(selector, {
            addEventListener(type, callback) { this[type] = callback; },
            focus() {}
          });
          return controls.get(selector);
        },
        remove() { nodes.delete(this.id); }
      };
    }
  };
  const window = {
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, callback) { listeners.set(type, callback); },
    dispatchEvent() {},
    requestAnimationFrame(callback) { callback(); }
  };
  vm.runInNewContext(source, {
    document, window, URL, CustomEvent: class {}, HTMLElement: class {},
    location: { pathname: '/catalogo', hostname: 'example.test', protocol: 'https:', href: 'https://example.test/catalogo' },
    localStorage: { getItem() { return ''; }, removeItem() {} },
    isAdminPage: () => false
  });
  return {
    document,
    emit(type) { listeners.get(type)?.(); },
    openPreferences() { window.TintinActivityPrivacy.open(); },
    chooseNecessary() { nodes.get('tt-privacy-consent').querySelector('[data-privacy-action="necessary"]').click(); },
    banner() { return nodes.get('tt-privacy-consent'); },
    advanceTo(at) {
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= at).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = at;
    }
  };
}

test('cerrar bienvenida durante la espera de privacidad no repite el banner tras guardar', () => {
  const f = privacyConsentFixture();
  f.advanceTo(200);
  f.emit('tintin:welcome:closed');
  f.advanceTo(1500);
  assert.ok(f.banner(), 'se presenta la elección inicial');
  f.advanceTo(1550);
  f.chooseNecessary();
  assert.equal(f.banner(), undefined);
  assert.match(f.document.cookie, /^tt_privacy_choice=v2\.necessary/);
  f.advanceTo(3000);
  assert.equal(f.banner(), undefined, 'una tarea pendiente no reabre una elección guardada');
});

test('la elección explícita de privacidad cancela el aviso inicial pendiente', () => {
  const f = privacyConsentFixture();
  f.advanceTo(200);
  f.openPreferences();
  f.chooseNecessary();
  f.advanceTo(3000);
  assert.equal(f.banner(), undefined);
});

test('el aviso inicial revalida una elección guardada mientras esperaba', () => {
  const f = privacyConsentFixture();
  f.document.cookie = 'tt_privacy_choice=v2.necessary';
  f.advanceTo(3000);
  assert.equal(f.banner(), undefined);
});
