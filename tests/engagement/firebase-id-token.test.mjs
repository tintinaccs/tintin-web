import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

const PROJECT_ID = 'tintin-accesorios';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function makeToken(privateKey, kid, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const payload = {
    aud: PROJECT_ID,
    iss: ISSUER,
    sub: 'firebase-user-123',
    exp: now + 3600,
    iat: now - 10,
    auth_time: now - 20,
    email: 'clienta@example.com',
    email_verified: true,
    ...overrides,
  };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  return `${input}.${signature}`;
}

async function verifierWithKey(publicKey, kid) {
  const jwk = publicKey.export({ format: 'jwk' });
  Object.assign(jwk, { kid, alg: 'RS256', use: 'sig' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
  const module = await import(`../../cloudflare/firebase-id-token.js?test=${Date.now()}-${Math.random()}`);
  return {
    verify: module.verifyFirebaseIdToken,
    restore() { globalThis.fetch = originalFetch; },
  };
}

test('verifica un Firebase ID token firmado sin llamar accounts:lookup', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key-1';
  const harness = await verifierWithKey(publicKey, kid);
  try {
    const result = await harness.verify(makeToken(privateKey, kid));
    assert.equal(result.uid, 'firebase-user-123');
    assert.equal(result.email, 'clienta@example.com');
  } finally {
    harness.restore();
  }
});

test('rechaza tokens de otro proyecto aunque la firma RSA sea válida', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key-2';
  const harness = await verifierWithKey(publicKey, kid);
  try {
    await assert.rejects(
      () => harness.verify(makeToken(privateKey, kid, { aud: 'otro-proyecto' })),
      error => error?.status === 401 && error?.code === 'auth/wrong-project',
    );
  } finally {
    harness.restore();
  }
});

test('rechaza correo no verificado con 403', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key-3';
  const harness = await verifierWithKey(publicKey, kid);
  try {
    await assert.rejects(
      () => harness.verify(makeToken(privateKey, kid, { email_verified: false })),
      error => error?.status === 403 && error?.code === 'auth/email-not-verified',
    );
  } finally {
    harness.restore();
  }
});
