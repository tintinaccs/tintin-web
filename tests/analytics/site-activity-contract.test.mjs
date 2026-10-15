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
