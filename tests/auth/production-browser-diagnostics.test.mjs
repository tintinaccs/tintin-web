import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAuthBrowserDiagnostic as classify } from '../../scripts/lib/auth-browser-diagnostics.mjs';

const report = `Framing 'https://www.google.com/' violates the following report-only Content Security Policy directive: "frame-ancestors 'self'". The violation has been logged, but no further action has been taken.`;
test('observed Google frame report-only remains a visible diagnostic', () => {
  assert.equal(classify({ source: 'console', text: report }), 'google-frame-report-only');
});
test('effective CSP, other host/directive and added error text remain blocking', () => {
  for (const text of [report.replace('report-only ', ''), report.replace('www.google.com', 'evil.example'),
    report.replace('frame-ancestors', 'script-src'), report + ' App Check failed', 'Refused to execute script due to Content Security Policy']) {
    assert.equal(classify({ source: 'console', text }), 'blocking', text);
  }
});
test('JavaScript exceptions remain blocking even if their text resembles a diagnostic', () => {
  for (const text of [report, 'Firebase AppCheck: Requests throttled (appCheck/throttled)', 'Cannot read properties of undefined']) {
    assert.equal(classify({ source: 'pageerror', text }), 'blocking');
  }
});
test('only reCAPTCHA/App Check rate limits receive the explicit unverified warning', () => {
  assert.equal(classify({ source: 'console', text: 'Firebase AppCheck: Requests throttled (appCheck/throttled)' }), 'recaptcha-throttled');
  for (const text of ['AppCheck: invalid token', 'Requests throttled', 'AppCheck throttled; Content Security Policy blocked script']) {
    assert.equal(classify({ source: 'console', text }), 'blocking');
  }
});
