import { compactAdminRuntimeChecks, runAdminRuntimeChecks } from '../../cloudflare/admin-runtime-health.js';

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
  let runtimeReport = null;

  if (!missingConfig.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
    try {
      runtimeReport = await runAdminRuntimeChecks(env);
    } catch (error) {
      console.error('[health] Admin runtime no disponible:', error?.message || error);
    }
  }

  const adminChecks = compactAdminRuntimeChecks(runtimeReport);
  const firebaseOk = adminChecks.products === true;
  const visualBuilderOk = adminChecks.siteContent === true && adminChecks.visualBuilder === true;
  const adminRuntimeOk = runtimeReport?.ok === true;
  const ok = missingConfig.length === 0 && firebaseOk && visualBuilderOk && adminRuntimeOk;
  const payload = {
    ok,
    service: 'tintin-pages-functions',
    checks: {
      runtime: true,
      configuration: missingConfig.length === 0,
      firebase: firebaseOk,
      adminRuntime: adminRuntimeOk,
      visualBuilder: visualBuilderOk,
    },
    admin: adminChecks,
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
