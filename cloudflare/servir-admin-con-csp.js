import policies from '../config/csp-runtime.js';

const POLICY_BY_SURFACE = Object.freeze({
  admin: policies.admin,
  'admin-images': policies.adminImages,
});

/**
 * Sirve una superficie Admin desde ASSETS y reemplaza explícitamente la CSP.
 *
 * Cloudflare puede resolver una URL limpia usando solo el wildcard de
 * `_headers`. Eso es correcto para el público, donde el wildcard es estricto,
 * pero Admin necesita además `https://api.cloudinary.com` para uploads.
 * Esta Function hace que esa excepción exista únicamente en las dos
 * superficies que realmente la consumen.
 */
export async function serveAdminWithCsp(context, surface) {
  const { request, env } = context;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const policy = POLICY_BY_SURFACE[surface];
  if (!policy || !policy.includes('https://api.cloudinary.com')) {
    console.error(`[admin-csp] Política inválida o sin Cloudinary para ${surface}.`);
    return new Response('Admin security policy unavailable', {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  const asset = await env.ASSETS.fetch(request);
  if (!asset.ok) return asset;

  const headers = new Headers(asset.headers);
  headers.set('content-security-policy', policy);
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('x-tintin-admin-csp', 'edge');
  headers.delete('content-length');

  return new Response(request.method === 'HEAD' ? null : asset.body, {
    status: asset.status,
    statusText: asset.statusText,
    headers,
  });
}
