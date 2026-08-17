const MASTER_DIAGNOSTICS_RUNTIME = '/js/admin/diagnostics/diagnostico-maestro-admin.js?v=tintin-20260817-master-diagnostics-1';

/**
 * Agrega el runtime del Diagnóstico Maestro únicamente a la superficie Admin.
 * Se hace en edge para no acoplar el módulo nuevo al gran bundle admin-app.js
 * ni duplicar lógica dentro del HTML fuente.
 */
export async function injectMasterDiagnosticsRuntime(response, requestMethod = 'GET') {
  if (!response || requestMethod === 'HEAD' || !response.ok) return response;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const html = await response.text();
  if (html.includes(MASTER_DIAGNOSTICS_RUNTIME) || html.includes('/js/admin/diagnostics/diagnostico-maestro-admin.js')) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  const tag = `<script type="module" src="${MASTER_DIAGNOSTICS_RUNTIME}"></script>`;
  const output = html.includes('</body>')
    ? html.replace('</body>', `  ${tag}\n</body>`)
    : `${html}\n${tag}\n`;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('x-tintin-master-diagnostics', 'edge-runtime');

  return new Response(output, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
