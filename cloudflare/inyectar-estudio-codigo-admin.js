/**
 * Inyecta el Estudio de Código únicamente en la superficie Admin servida por
 * Cloudflare. No modifica admin.html ni comparte el runtime con páginas públicas.
 */
const RESTORE_RUNTIME = '/js/admin/estudio-codigo/restaurar-estudio-codigo-admin.js?v=tintin-20260820-code-studio-1';

export async function injectCodeStudioRuntime(response, requestMethod = 'GET', runtimeUrl = '', stylesheetUrl = '') {
  if (!response || requestMethod === 'HEAD' || !response.ok) return response;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const script = String(runtimeUrl || '').trim();
  const stylesheet = String(stylesheetUrl || '').trim();
  if (!/^\/js\/admin\/estudio-codigo\/estudio-codigo-admin\.js\?v=[A-Za-z0-9._-]+$/.test(script)) {
    console.error('[code-studio] URL de runtime inválida.');
    return response;
  }
  if (!/^\/css\/admin\/estudio-codigo\.css\?v=[A-Za-z0-9._-]+$/.test(stylesheet)) {
    console.error('[code-studio] URL de estilos inválida.');
    return response;
  }

  const html = await response.text();
  const styleTag = `<link rel="stylesheet" href="${stylesheet}">`;
  const scriptTag = `<script type="module" src="${script}"></script>`;
  const restoreTag = `<script type="module" src="${RESTORE_RUNTIME}"></script>`;
  let output = html;
  if (!output.includes('/css/admin/estudio-codigo.css')) {
    output = output.includes('</head>') ? output.replace('</head>', `  ${styleTag}\n</head>`) : `${styleTag}\n${output}`;
  }
  if (!output.includes('/js/admin/estudio-codigo/estudio-codigo-admin.js')) {
    output = output.includes('</body>') ? output.replace('</body>', `  ${scriptTag}\n</body>`) : `${output}\n${scriptTag}\n`;
  }
  if (!output.includes('/js/admin/estudio-codigo/restaurar-estudio-codigo-admin.js')) {
    output = output.includes('</body>') ? output.replace('</body>', `  ${restoreTag}\n</body>`) : `${output}\n${restoreTag}\n`;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('x-tintin-code-studio', 'edge-runtime');
  return new Response(output, { status: response.status, statusText: response.statusText, headers });
}
