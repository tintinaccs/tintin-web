/**
 * Agrega los runtimes de diagnóstico únicamente a la superficie Admin.
 * La URL del Maestro se recibe versionada desde los handlers de Functions y
 * el estado operativo usa una versión inmutable propia.
 */
const SYSTEM_HEALTH_RUNTIME_URL = '/js/admin/diagnostics/estado-ecosistema-admin.js?v=tintin-20260901-operations-center-1';

export async function injectMasterDiagnosticsRuntime(response, requestMethod = 'GET', runtimeUrl = '') {
  if (!response || requestMethod === 'HEAD' || !response.ok) return response;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const safeRuntimeUrl = String(runtimeUrl || '').trim();
  if (!/^\/js\/admin\/diagnostics\/diagnostico-maestro-admin\.js\?v=[A-Za-z0-9._-]+$/.test(safeRuntimeUrl)) {
    console.error('[master-diagnostics] URL de runtime inválida.');
    return response;
  }

  const html = await response.text();
  const tags = [];
  if (!html.includes(safeRuntimeUrl) && !html.includes('/js/admin/diagnostics/diagnostico-maestro-admin.js')) {
    tags.push(`<script type="module" src="${safeRuntimeUrl}"></script>`);
  }
  if (!html.includes(SYSTEM_HEALTH_RUNTIME_URL) && !html.includes('/js/admin/diagnostics/estado-ecosistema-admin.js')) {
    tags.push(`<script type="module" src="${SYSTEM_HEALTH_RUNTIME_URL}"></script>`);
  }
  if (!tags.length) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  const block = tags.map(tag => `  ${tag}`).join('\n');
  const output = html.includes('</body>')
    ? html.replace('</body>', `${block}\n</body>`)
    : `${html}\n${block}\n`;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('x-tintin-master-diagnostics', 'edge-runtime');
  headers.set('x-tintin-system-health', 'edge-runtime');

  return new Response(output, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
