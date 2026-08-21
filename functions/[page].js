import { injectMasterDiagnosticsRuntime } from '../cloudflare/inyectar-diagnostico-maestro-admin.js';

const LIGHTWEIGHT_PAGES = new Set([
  'about',
  'contact',
  'envios',
  'cambios-devoluciones',
  'preguntas-frecuentes',
  'terminos',
  'privacidad',
  '404'
]);

const ABOUT_CANONICAL_GUARD = '/js/pages/institutional/about-canonical-clean-v1.js';
const CONTACT_MAINTENANCE_RUNTIME = '/js/pages/institutional/mantenimiento-contacto.js?v=tintin-20260820-microcopy-ios-1';
const LEGAL_MAINTENANCE_RUNTIME = '/js/pages/institutional/mantenimiento-legal.js?v=tintin-20260815-legal-clean-1';
const MASTER_DIAGNOSTICS_RUNTIME = '/js/admin/diagnostics/diagnostico-maestro-admin.js?v=tintin-20260817-master-diagnostics-4';
const VISUAL_LAYOUT_GUARD = '<style id="tt-vb-layout-guard">html.tt-vb-layout-pending body>section,html.tt-vb-layout-pending body>main{visibility:hidden;animation:tt-vb-layout-release 0s linear 3.5s forwards}@keyframes tt-vb-layout-release{to{visibility:visible}}</style>';

function pageName(request) {
  const url = new URL(request.url);
  return url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
}

export function lightenHtml(html) {
  return String(html || '')
    .replace(/\s*<script\s+src=["']js\/cargador-pagina\.js[^"']*["'][^>]*><\/script>\s*/i, '\n')
    .replace(/\s*<link\s+rel=["']modulepreload["'][^>]*>\s*/gi, '\n');
}

function injectBeforeHeadClose(html, tag) {
  if (html.includes(tag)) return html;
  return html.includes('</head>') ? html.replace('</head>', `  ${tag}\n</head>`) : `${tag}\n${html}`;
}

function markVisualLayoutPending(html) {
  const source = String(html || '');
  if (/<html[^>]*class=["']/i.test(source)) {
    return source.replace(/(<html[^>]*class=["'])([^"']*)/i, '$1tt-vb-layout-pending $2');
  }
  return source.replace(/<html/i, '<html class="tt-vb-layout-pending"');
}

export function injectLightweightPageGuards(html, page) {
  let output = String(html || '');
  if (output.includes('visual-builder-bootstrap.js') && !output.includes('tt-vb-layout-guard')) {
    output = markVisualLayoutPending(output);
    output = injectBeforeHeadClose(output, VISUAL_LAYOUT_GUARD);
  }
  if (page === 'about' && !output.includes(ABOUT_CANONICAL_GUARD)) {
    output = injectBeforeHeadClose(output, `<script src="${ABOUT_CANONICAL_GUARD}" defer></script>`);
  }
  if (page === 'contact' && !output.includes(CONTACT_MAINTENANCE_RUNTIME)) {
    output = injectBeforeHeadClose(output, `<script type="module" src="${CONTACT_MAINTENANCE_RUNTIME}"></script>`);
  }
  if ((page === 'terminos' || page === 'privacidad') && !output.includes(LEGAL_MAINTENANCE_RUNTIME)) {
    output = injectBeforeHeadClose(output, `<script type="module" src="${LEGAL_MAINTENANCE_RUNTIME}"></script>`);
  }
  return output;
}

export function isLightweightPageName(value) {
  return LIGHTWEIGHT_PAGES.has(String(value || '').trim().toLowerCase());
}

export async function onRequest({ request, env }) {
  const page = pageName(request);
  const asset = await env.ASSETS.fetch(request);

  // /admin tiene una Function dedicada; /admin.html cae en este wildcard.
  // Ambos caminos deben cargar exactamente el mismo módulo del Diagnóstico Maestro.
  if (page === 'admin.html') {
    return injectMasterDiagnosticsRuntime(asset, request.method, MASTER_DIAGNOSTICS_RUNTIME);
  }

  if (!LIGHTWEIGHT_PAGES.has(page)) return asset;
  if (request.method === 'HEAD') return asset;
  if (!asset.ok || !(asset.headers.get('content-type') || '').includes('text/html')) return asset;

  const html = injectLightweightPageGuards(lightenHtml(await asset.text()), page);
  const headers = new Headers(asset.headers);
  headers.delete('content-length');
  headers.set('x-tintin-page-runtime', 'lightweight');
  headers.set('cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=900');
  return new Response(html, {
    status: asset.status,
    statusText: asset.statusText,
    headers
  });
}
