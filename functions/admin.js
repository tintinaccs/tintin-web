import { serveAdminWithCsp } from '../cloudflare/servir-admin-con-csp.js';
import { injectMasterDiagnosticsRuntime } from '../cloudflare/inyectar-diagnostico-maestro-admin.js';
import { injectCodeStudioRuntime } from '../cloudflare/inyectar-estudio-codigo-admin.js';

const MASTER_DIAGNOSTICS_RUNTIME = '/js/admin/diagnostics/diagnostico-maestro-admin.js?v=tintin-20260817-master-diagnostics-4';
const CODE_STUDIO_RUNTIME = '/js/admin/estudio-codigo/estudio-codigo-admin.js?v=tintin-20260820-code-studio-1';
const CODE_STUDIO_STYLES = '/css/admin/estudio-codigo.css?v=tintin-20260820-code-studio-1';
const CODE_STUDIO_RESTORE_RUNTIME = '/js/admin/estudio-codigo/restaurar-estudio-codigo-admin.js?v=tintin-20260820-code-studio-1';

export async function onRequest(context) {
  const response = await serveAdminWithCsp(context, 'admin');
  const withDiagnostics = await injectMasterDiagnosticsRuntime(response, context.request.method, MASTER_DIAGNOSTICS_RUNTIME);
  return injectCodeStudioRuntime(
    withDiagnostics,
    context.request.method,
    CODE_STUDIO_RUNTIME,
    CODE_STUDIO_STYLES,
    CODE_STUDIO_RESTORE_RUNTIME
  );
}
