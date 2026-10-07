import test from 'node:test';
import assert from 'node:assert/strict';
import { isReadOnlyAuditRequest as safe } from '../../scripts/lib/audit-read-only-policy.mjs';

test('la inspección permite lecturas y bootstrap de seguridad necesario', () => {
  assert.ok(safe('https://example.test/api/public-catalog', 'GET'));
  for (const url of [
    'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
    'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents:batchGet',
    'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents:runQuery',
    'https://firebaseappcheck.googleapis.com/v1/projects/demo/apps/app:exchangeRecaptchaEnterpriseToken',
    'https://www.google.com/recaptcha/enterprise/clr',
    'https://www.recaptcha.net/recaptcha/api2/reload',
    'https://securetoken.googleapis.com/v1/token'
  ]) assert.ok(safe(url, 'POST'), url);
});

test('la inspección impide escrituras comerciales, cuentas y hosts que imitan seguridad', () => {
  for (const url of [
    'https://example.test/api/create-order',
    'https://example.test/api/paypal-capture',
    'https://example.test/recaptcha/enterprise/clr',
    'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents:commit',
    'https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel',
    'https://identitytoolkit.googleapis.com/v1/accounts:signUp',
    'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode'
  ]) assert.equal(safe(url, 'POST'), false, url);
  assert.equal(safe('https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents:batchGet', 'DELETE'), false);
});
