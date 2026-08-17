/**
 * Agrega el runtime del Diagnóstico Maestro únicamente a la superficie Admin.
 * La URL versionada se declara en los handlers de Functions para que la
 * auditoría de caché pueda verificar sus bytes y su tag inmutable.
 */
export async function injectMasterDiagnosticsRuntime(response, requestMethod = 'GET', runtimeUrl = '') {
  if (!response || requestMethod === 'HEAD' || !response.ok) return response;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const safeRuntimeUrl = String(runtimeUrl || '').trim();
  if (!/^\/js\/admin\/diagnostics\/diagnostico-maestro-admin\.js\?v=[A-Za-z0-9._-]+$/.test(safeRuntimeUrl)) {
    console.error('[master-diagnostics] URL de runtime inválida.');
    return response;
  }

  const html = await response.text();
  if (html.includes(safeRuntimeUrl) || html.includes('/js/admin/diagnostics/diagnostico-maestro-admin.js')) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  const tag = `<script type="module" src="${safeRuntimeUrl}"></script>`;
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
