import { findOrCreateUserByEmail, createFirebaseCustomToken } from '../../cloudflare/firebase-admin-lite.js';

export async function onRequest(context) {
  const { env } = context;
  const steps = {};
  try {
    const result = await findOrCreateUserByEmail(env, 'tintin-diag-temp-probe@example.com');
    steps.findOrCreateUserByEmail = result;
    const token = await createFirebaseCustomToken(env, result.uid);
    steps.createFirebaseCustomToken = { tokenLength: token.length, tokenPreview: token.slice(0, 40) };
  } catch (error) {
    steps.error = String(error?.stack || error?.message || error);
  }
  return new Response(JSON.stringify(steps, null, 2), { headers: { 'content-type': 'application/json' } });
}
