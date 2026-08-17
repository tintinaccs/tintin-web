import { serveAdminWithCsp } from '../cloudflare/servir-admin-con-csp.js';
import { injectMasterDiagnosticsRuntime } from '../cloudflare/inyectar-diagnostico-maestro-admin.js';

const MASTER_DIAGNOSTICS_RUNTIME = '/js/admin/diagnostics/diagnostico-maestro-admin.js?v=tintin-20260817-master-diagnostics-3';

export async function onRequest(context) {
  const response = await serveAdminWithCsp(context, 'admin');
  return injectMasterDiagnosticsRuntime(response, context.request.method, MASTER_DIAGNOSTICS_RUNTIME);
}
