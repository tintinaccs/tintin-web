import { firestoreAdminList } from '../../cloudflare/firebase-admin-ligero.js';

const REQUIRED_CONFIG = [
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'RESEND_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const missingConfig = REQUIRED_CONFIG.filter(name => !String(env?.[name] || '').trim());
  let firebaseOk = false;

  if (!missingConfig.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
    try {
      // Lectura mínima y no destructiva. Valida runtime, credencial de servicio,
      // OAuth de Google y acceso a Firestore sin devolver datos del catálogo.
      await firestoreAdminList(env, 'products', 1);
      firebaseOk = true;
    } catch (error) {
      console.error('[health] Firebase/Firestore no disponible:', error?.message || error);
    }
  }

  const ok = missingConfig.length === 0 && firebaseOk;
  const payload = {
    ok,
    service: 'tintin-pages-functions',
    checks: {
      runtime: true,
      configuration: missingConfig.length === 0,
      firebase: firebaseOk
    },
    checkedAt: new Date().toISOString()
  };

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: ok ? 200 : 503,
      headers: {
        'cache-control': 'no-store, max-age=0',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer'
      }
    });
  }

  return json(payload, ok ? 200 : 503);
}
