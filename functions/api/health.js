import { firestoreAdminList } from '../../cloudflare/firebase-admin-ligero.js';

const REQUIRED_ENV = [
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'RESEND_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer'
    }
  });
}

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const missing = REQUIRED_ENV.filter(name => !String(env?.[name] || '').trim());
  const checks = {
    runtime: true,
    configuration: missing.length === 0,
    firestore: false
  };

  if (!missing.length) {
    try {
      await withTimeout(firestoreAdminList(env, 'settings', 1), 5000);
      checks.firestore = true;
    } catch (error) {
      console.error(JSON.stringify({ message: 'health firestore failed', error: error?.message || String(error) }));
    }
  }

  const ok = Object.values(checks).every(Boolean);
  const payload = {
    ok,
    service: 'tintin-pages-functions',
    checks,
    missingConfiguration: missing.length,
    checkedAt: new Date().toISOString()
  };

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: ok ? 204 : 503,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }
  return json(payload, ok ? 200 : 503);
}
