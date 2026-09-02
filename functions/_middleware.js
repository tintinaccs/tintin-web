import cspRuntime from '../config/csp-runtime.js';
import { jsonResponse, rateLimit } from './lib/operational-guard.js';

const GENERATED_BY = 'scripts/generar-csp-cloudflare.js';
const SECURITY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'X-Permitted-Cross-Domain-Policies': 'none'
});
const MUTATION_LIMITS = Object.freeze([
  [/^\/api\/email-otp-(send|verify)$/, 10, 60_000, 'auth'],
  [/^\/api\/engagement$/, 45, 60_000, 'engagement'],
  [/^\/api\/(order-email|apps-script-bridge|paypal-create-order|paypal-capture-order)$/, 12, 60_000, 'checkout'],
  [/^\/api\/push-(subscription|order-event|test|admin)$/, 20, 60_000, 'push'],
  [/^\/api\/(profile-avatar-upload|cloudinary-sign-upload|cloudinary-sign-audio-upload)$/, 20, 60_000, 'upload'],
  [/^\/api\/admin-/, 60, 60_000, 'admin']
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

function enforceMutationLimit(request, pathname) {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) return null;
  const config = MUTATION_LIMITS.find(([pattern]) => pattern.test(pathname));
  if (!config) return null;
  const [, limit, windowMs, id] = config;
  const result = rateLimit(request, { id, limit, windowMs });
  if (result.allowed) return null;
  return jsonResponse({ ok: false, code: 'rate_limited' }, 429, {
    ...result.headers,
    'retry-after': String(result.retryAfter)
  });
}

function withRuntimeScripts(response) {
  if (typeof HTMLRewriter !== 'function') return response;
  return new HTMLRewriter()
    .on('head', {
      element(element) {
        // Debe cargarse antes que los módulos de negocio: intercepta únicamente
        // el deployment histórico de Apps Script y lo fuerza a pasar por el
        // gateway /api/apps-script-bridge de Cloudflare.
        element.append('<script src="/js/quality/integration-router.js" data-tintin-integration-router="1"></script>', { html: true });
        element.append('<script src="/js/quality/observability.js" defer data-tintin-observability="1"></script>', { html: true });
      }
    })
    .transform(response);
}

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (pathname.startsWith('/__/auth/')) return context.next();

  const blocked = enforceMutationLimit(context.request, pathname);
  if (blocked) return blocked;

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

  const secured = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  return withRuntimeScripts(secured);
}
