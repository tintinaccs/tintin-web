import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper = fs.readFileSync(new URL('../../cloudflare/firebase-admin-ligero.js', import.meta.url), 'utf8');
const send = fs.readFileSync(new URL('../../functions/api/email-otp-send.js', import.meta.url), 'utf8');
const verify = fs.readFileSync(new URL('../../functions/api/email-otp-verify.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../../js/email/correo-autenticacion.js', import.meta.url), 'utf8');

test('OTP identifica cuentas Google sin crear una segunda vía de acceso', () => {
  assert.match(helper, /export async function getAuthProvidersByEmail/);
  assert.match(send, /getAuthProvidersByEmail\(env, email\)/);
  assert.match(send, /authIdentity\.providers\.includes\('google\.com'\)/);
  assert.match(verify, /getAuthProvidersByEmail\(env, email\)/);
  assert.match(verify, /authIdentity\.providers\.includes\('google\.com'\)/);
  assert.match(client, /google_account_required/);
});
