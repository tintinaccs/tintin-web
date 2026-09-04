import { serveAdminWithCsp } from '../cloudflare/servir-admin-con-csp.js';
import { injectMasterDiagnosticsRuntime } from '../cloudflare/inyectar-diagnostico-maestro-admin.js';
import { injectCodeStudioRuntime } from '../cloudflare/inyectar-estudio-codigo-admin.js';

const MASTER_DIAGNOSTICS_RUNTIME = '/js/admin/diagnostics/diagnostico-maestro-admin.js?v=tintin-20260821-accounts-phase-a-2';
const CODE_STUDIO_RUNTIME = '/js/admin/estudio-codigo/estudio-codigo-admin.js?v=tintin-20260821-code-problems-2';
const CODE_STUDIO_STYLES = '/css/admin/estudio-codigo.css?v=tintin-20260821-code-problems-1';
const CODE_STUDIO_RESTORE_RUNTIME = '/js/admin/estudio-codigo/restaurar-estudio-codigo-admin.js?v=tintin-20260821-code-editor-fit-5';
const ADMIN_APP_RUNTIME = '/js/admin/admin-app-runtime?v=tintin-20260904-admin-auth-guard-1';

async function injectAdminAuthRuntime(response, requestMethod = 'GET') {
  if (!response || requestMethod === 'HEAD' || !response.ok) return response;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const html = await response.text();
  const scriptPattern = /(<script\b[^>]*\bsrc=["'])\/?js\/admin\/admin-app\.js\?v=[^"']+(["'][^>]*><\/script>)/i;
  if (!scriptPattern.test(html)) {
    console.error('[admin-auth-guard] No se encontró el <script> de admin-app.js en admin.html.');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  const output = html.replace(scriptPattern, `$1${ADMIN_APP_RUNTIME}$2`);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('x-tintin-admin-auth-bootstrap', 'edge-patched-v1');

  return new Response(output, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequest(context) {
  const response = await serveAdminWithCsp(context, 'admin');
  const withDiagnostics = await injectMasterDiagnosticsRuntime(response, context.request.method, MASTER_DIAGNOSTICS_RUNTIME);
  const withCodeStudio = await injectCodeStudioRuntime(
    withDiagnostics,
    context.request.method,
    CODE_STUDIO_RUNTIME,
    CODE_STUDIO_STYLES,
    CODE_STUDIO_RESTORE_RUNTIME
  );
  return injectAdminAuthRuntime(withCodeStudio, context.request.method);
}
