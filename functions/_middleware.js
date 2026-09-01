import cspRuntime from '../config/csp-runtime.js';

const GENERATED_BY = 'scripts/generar-csp-cloudflare.js';
const PRODUCT_PRIME_SRC = '/js/pages/product/carga-producto-publico.js?v=tintin-20260830-product-edge-prime-1';
const SECURITY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'X-Permitted-Cross-Domain-Policies': 'none'
});

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

function isProductRoute(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '').toLowerCase();
  return normalized === '/product' || normalized === '/product.html';
}

function injectProductPrime(response) {
  return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(
          `<script src="${PRODUCT_PRIME_SRC}" defer></script>`,
          { html: true }
        );
      }
    })
    .transform(response);
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

  const securedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });

  // La ficha pública no debe esperar App Check/reCAPTCHA para mostrar datos
  // que ya son públicos. En /product se adelanta una lectura server-side por
  // ID desde la API edge; el runtime normal de Firestore permanece activo en
  // segundo plano para stock/actualizaciones y como fallback si el edge falla.
  if (isProductRoute(pathname)) return injectProductPrime(securedResponse);

  return securedResponse;
}
