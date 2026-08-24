import cspRuntime from '../config/csp-runtime.js';

const GENERATED_BY = 'scripts/generar-csp-cloudflare.js';
const SECURITY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'X-Permitted-Cross-Domain-Policies': 'none'
});

const CARD_SOCIAL_SRC = '/js/components/reviews/participacion-tarjetas.js?v=tintin-20260824-card-social-1';
const CARD_SOCIAL_PATHS = new Set([
  '/', '/index', '/index.html',
  '/catalogo', '/catalogo.html',
  '/collections', '/collections.html',
  '/product', '/product.html'
]);

function policyForPath(pathname) {
  const routes = cspRuntime?.routes || {};
  return routes[pathname] || cspRuntime?.public || '';
}

function runtimeReady() {
  return cspRuntime?.generatedBy === GENERATED_BY &&
    typeof cspRuntime?.public === 'string' &&
    cspRuntime.public.includes("default-src 'self'") &&
    cspRuntime.public.includes("script-src 'self'") &&
    cspRuntime.public.includes("object-src 'none'");
}

function failClosed() {
  return new Response('Service temporarily unavailable', {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  });
}

async function cardSocialBody(response, pathname, method, headers) {
  if (method !== 'GET' || !CARD_SOCIAL_PATHS.has(pathname) || !response.ok) return response.body;
  const html = await response.text();
  if (html.includes(CARD_SOCIAL_SRC) || !html.includes('</body>')) return html;
  headers.delete('content-length');
  headers.set('X-Tintin-Card-Social', '1');
  const script = `<script type="module" src="${CARD_SOCIAL_SRC}"></script>`;
  return html.replace('</body>', `${script}\n</body>`);
}

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;

  // /__/auth/* es un proxy transparente hacia Firebase Authentication. Sus
  // páginas auxiliares e iframes tienen su propio runtime y el proxy elimina
  // CSP/X-Frame-Options del upstream deliberadamente para conservar el flujo
  // same-origin. No se debe superponer la CSP de las páginas de la tienda.
  if (pathname.startsWith('/__/auth/')) return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return response;
  if (!runtimeReady()) return failClosed();

  const policy = policyForPath(pathname);
  if (!policy || !policy.includes("default-src 'self'")) return failClosed();

  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', policy);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set('X-Frame-Options', policy.includes("frame-ancestors 'self'") ? 'SAMEORIGIN' : 'DENY');
  headers.set('X-Tintin-CSP', 'edge-runtime');

  const body = await cardSocialBody(response, pathname, context.request.method, headers);
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
