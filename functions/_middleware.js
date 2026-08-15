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

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return response;
  if (!runtimeReady()) return failClosed();

  const pathname = new URL(context.request.url).pathname;
  const policy = policyForPath(pathname);
  if (!policy || !policy.includes("default-src 'self'")) return failClosed();

  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', policy);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set('X-Frame-Options', policy.includes("frame-ancestors 'self'") ? 'SAMEORIGIN' : 'DENY');
  headers.set('X-Tintin-CSP', 'edge-runtime');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
