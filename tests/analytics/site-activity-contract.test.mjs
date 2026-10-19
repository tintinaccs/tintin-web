import test from 'node:test';
import assert from 'node:assert/strict';
import { heartbeatDecision, MIN_HEARTBEAT_INTERVAL_MS } from '../../js/analytics/control-heartbeat.mjs';
import fs from 'node:fs';

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
