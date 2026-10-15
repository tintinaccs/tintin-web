import cspRuntime from '../config/csp-runtime.js';
import { jsonResponse, rateLimit } from './lib/operational-guard.js';
import { limitByIp } from '../cloudflare/rate-limit-compartido.js';

const GENERATED_BY = 'scripts/generar-csp-cloudflare.js';
const SECURITY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'X-Permitted-Cross-Domain-Policies': 'none'
});
const MUTATION_LIMITS = Object.freeze([
  [/^\/api\/email-otp-(send|verify)$/, 10, 60_000, 'auth'],
  [/^\/api\/(username|phone)-availability$/, 30, 60_000, 'identity-availability'],
  [/^\/api\/telemetry$/, 40, 60_000, 'telemetry-edge'],
  [/^\/api\/site-activity$/, 60, 60_000, 'site-activity-edge'],
  [/^\/api\/engagement$/, 45, 60_000, 'engagement'],
  [/^\/api\/(order-email|apps-script-bridge|paypal-create-order|paypal-capture-order|wholesale-quote)$/, 12, 60_000, 'checkout'],
  [/^\/api\/paypal-rate-refresh$/, 4, 60_000, 'paypal-rate-refresh'],
  [/^\/api\/push-(subscription|order-event|test|admin)$/, 20, 60_000, 'push'],
  [/^\/api\/(profile-avatar-upload|cloudinary-sign-upload|cloudinary-sign-audio-upload)$/, 20, 60_000, 'upload'],
  [/^\/api\/admin-/, 60, 60_000, 'admin']
]);
// Endpoints de lectura que disparan consultas externas o respuestas dinámicas.
// Se limitan en el borde para que un bot no convierta búsquedas de direcciones,
// geolocalización o configuración de pago en consumo innecesario. Los límites
// son deliberadamente amplios para no afectar la navegación normal.
const READ_LIMITS = Object.freeze([
  [/^\/(?:product(?:\.html)?|products\/[^/]+|pages\/[^/]+)\/?$/, 60, 60_000, 'public-render'],
  [/^\/api\/health$/, 12, 60_000, 'health'],
  [/^\/api\/(public-catalog|visual-builder-public|visual-studio-global-public)$/, 60, 10_000, 'public-content'],
  [/^\/api\/(geo-search|location-search)$/, 30, 60_000, 'geo-search'],
  [/^\/api\/visitor-geo$/, 60, 60_000, 'visitor-geo'],
  [/^\/api\/paypal-config$/, 60, 60_000, 'paypal-config']
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

async function enforceMutationLimit(request, pathname, env, sharedLimit) {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) return null;
  const config = MUTATION_LIMITS.find(([pattern]) => pattern.test(pathname));
  if (!config) return null;
  const [, limit, windowMs, id] = config;
  const result = rateLimit(request, { id, limit, windowMs });
  if (result.allowed) return enforceSharedLimit(request, env, { id, limit, windowMs }, sharedLimit);
  return jsonResponse({ ok: false, code: 'rate_limited' }, 429, {
    ...result.headers,
    'retry-after': String(result.retryAfter)
  });
}

async function enforceReadLimit(request, pathname, env, sharedLimit) {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const config = READ_LIMITS.find(([pattern]) => pattern.test(pathname));
  if (!config) return null;
  const [, limit, windowMs, id] = config;
  const result = rateLimit(request, { id, limit, windowMs });
  if (result.allowed) return enforceSharedLimit(request, env, { id, limit, windowMs }, sharedLimit);
  return jsonResponse({ ok: false, code: 'rate_limited' }, 429, {
    ...result.headers,
    'retry-after': String(result.retryAfter)
  });
}

async function enforceSharedLimit(request, env, policy, sharedLimit) {
  try {
    await sharedLimit(request, env, policy);
    return null;
  } catch (error) {
    const limited = error?.code === 'rate_limited';
    return jsonResponse({ ok: false, code: limited ? 'rate_limited' : 'rate_limit_unavailable' }, limited ? 429 : 503, {
      'retry-after': String(limited ? error.retryAfter : 5)
    });
  }
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

function isPagesDevHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'pages.dev' || host.endsWith('.pages.dev');
}

async function applyPagesDevIndexPolicy(request, pathname, response) {
  const hostname = new URL(request.url).hostname;
  if (!isPagesDevHostname(hostname)) return response;

  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex');

  // Pages.dev is the technical/preview host. Keep it crawlable so search
  // engines can observe noindex, but do not advertise its sitemap as the
  // storefront's canonical inventory.
  if (pathname === '/robots.txt' && request.method !== 'HEAD') {
    const body = (await response.text())
      .split(/\r?\n/)
      .filter(line => !/^\s*Sitemap\s*:/i.test(line))
      .join('\n');
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    headers.delete('content-md5');
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context, { sharedLimit = limitByIp } = {}) {
  const pathname = new URL(context.request.url).pathname;
  if (pathname.startsWith('/__/auth/')) return context.next();

  const blocked = await enforceMutationLimit(context.request, pathname, context.env, sharedLimit);
  if (blocked) return applyPagesDevIndexPolicy(context.request, pathname, blocked);
  const readBlocked = await enforceReadLimit(context.request, pathname, context.env, sharedLimit);
  if (readBlocked) return applyPagesDevIndexPolicy(context.request, pathname, readBlocked);

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  // Un 304 no trae Content-Type, pero el navegador adopta sus cabeceras sobre
  // la página cacheada: sin esto, una revalidación de /perfil dejaba la CSP
  // genérica de _headers y bloqueaba la subida de foto a Cloudinary.
  const revalidatedPage = response.status === 304 && Object.hasOwn(cspRuntime?.routes || {}, pathname);
  if (!contentType.toLowerCase().includes('text/html') && !revalidatedPage) {
    return applyPagesDevIndexPolicy(context.request, pathname, response);
  }
  if (!runtimeReady()) return applyPagesDevIndexPolicy(context.request, pathname, failClosed());

  const policy = policyForPath(pathname);
  if (!policy || !policy.includes("default-src 'self'")) {
    return applyPagesDevIndexPolicy(context.request, pathname, failClosed());
  }

  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', policy);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set('X-Frame-Options', policy.includes("frame-ancestors 'self'") ? 'SAMEORIGIN' : 'DENY');
  headers.set('X-Tintin-CSP', 'edge-runtime');
  if (revalidatedPage) {
    return applyPagesDevIndexPolicy(context.request, pathname, new Response(null, { status: 304, statusText: response.statusText, headers }));
  }

  const secured = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  return applyPagesDevIndexPolicy(context.request, pathname, withRuntimeScripts(secured));
}
