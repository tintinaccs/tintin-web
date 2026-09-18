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

test('la causa de throttling de sitePresence queda documentada en Rules', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /presenceUpdateNotTooFrequent\(\)/);
  assert.match(rules, /request\.time\s*>\s*resource\.data\.lastSeen\s*\+\s*duration\.value\(20,\s*'s'\)/);
  assert.match(rules, /match \/sitePresence\/\{visitorId\}/);
});
