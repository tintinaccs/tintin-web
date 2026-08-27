import { runSystemHealth } from '../../cloudflare/system-health.js';

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

  const report = await runSystemHealth(env);
  const firebaseOk = report.integrations.firebase === true;
  const visualBuilderOk = report.admin.siteContent === true && report.admin.visualBuilder === true;
  const payload = {
    ok: report.ok,
    service: 'tintin-pages-functions',
    checks: {
      runtime: true,
      configuration: report.missingConfig.length === 0,
      firebase: firebaseOk,
      adminRuntime: firebaseOk,
      visualBuilder: visualBuilderOk,
      sheets: report.integrations.sheets === true,
      resend: report.integrations.resend === true,
      cloudinary: report.integrations.cloudinary === true,
    },
    admin: report.admin,
    integrations: report.integrations,
    authorities: report.authorities,
    failedRuntimeChecks: report.failedRuntimeChecks,
    checkedAt: report.checkedAt,
  };

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: report.ok ? 200 : 503,
      headers: {
        'cache-control': 'no-store, max-age=0',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer'
      }
    });
  }

  return json(payload, report.ok ? 200 : 503);
}
