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

function pageName(request) {
  const url = new URL(request.url);
  return url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
}

export function lightenHtml(html) {
  return String(html || '')
    // El cargador completo inicia Store Gate + Firebase + carrito + favoritos +
    // colecciones. Las páginas informativas deben seguir disponibles aunque
    // el estado comercial no pueda comprobarse; la navegación modular carga
    // cuenta/carrito bajo demanda cuando la persona intenta usarlos.
    .replace(/\s*<script\s+src=["']js\/cargador-pagina\.js[^"']*["'][^>]*><\/script>\s*/i, '\n')
    // Los modulepreload estaban descargando Firebase/Auth/App Check incluso
    // cuando ningún runtime informativo los usaba. Los imports reales siguen
    // resolviéndose normalmente si una interacción posterior los necesita.
    .replace(/\s*<link\s+rel=["']modulepreload["'][^>]*>\s*/gi, '\n');
}

export function injectLightweightPageGuards(html, page) {
  let output = String(html || '');
  if (page !== 'about' || output.includes(ABOUT_CANONICAL_GUARD)) return output;
  const tag = `<script src="${ABOUT_CANONICAL_GUARD}" defer></script>`;
  return output.includes('</head>')
    ? output.replace('</head>', `  ${tag}\n</head>`)
    : `${tag}\n${output}`;
}

export function isLightweightPageName(value) {
  return LIGHTWEIGHT_PAGES.has(String(value || '').trim().toLowerCase());
}

export async function onRequest({ request, env }) {
  const page = pageName(request);
  const asset = await env.ASSETS.fetch(request);
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
