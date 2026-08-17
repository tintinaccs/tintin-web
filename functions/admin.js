import { serveAdminWithCsp } from '../cloudflare/servir-admin-con-csp.js';
import { injectMasterDiagnosticsRuntime } from '../cloudflare/inyectar-diagnostico-maestro-admin.js';

export async function onRequest(context) {
  const response = await serveAdminWithCsp(context, 'admin');
  return injectMasterDiagnosticsRuntime(response, context.request.method);
}
