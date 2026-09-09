import { serveAdminWithCsp } from '../cloudflare/servir-admin-con-csp.js';
import { injectMasterDiagnosticsRuntime } from '../cloudflare/inyectar-diagnostico-maestro-admin.js';

const MASTER_DIAGNOSTICS_RUNTIME = '/js/admin/diagnostics/diagnostico-maestro-admin.js?v=tintin-20260821-accounts-phase-a-3';

// Auth del panel vive en js/admin/admin-app.js. Esta función solo compone el
// HTML/CSP y los runtimes auxiliares; no reescribe ni duplica el auth guard.
export async function onRequest(context) {
  const response = await serveAdminWithCsp(context, 'admin');
  return injectMasterDiagnosticsRuntime(response, context.request.method, MASTER_DIAGNOSTICS_RUNTIME);
}
