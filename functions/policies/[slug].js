const POLICY_REDIRECTS = Object.freeze({
  'privacy-policy': '/privacidad',
  'terms-of-service': '/terminos',
  'refund-policy': '/cambios-devoluciones',
  'return-policy': '/cambios-devoluciones',
  'shipping-policy': '/envios'
});

function safeSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,179}$/.test(slug) ? slug : '';
}

export function onRequest({ request, params }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  const target = POLICY_REDIRECTS[safeSlug(params?.slug)];
  if (!target) return new Response('Política no encontrada', { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
  return new Response(null, {
    status: 301,
    headers: {
      location: new URL(target, request.url).toString(),
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      'x-tintin-legacy-route': 'shopify-policy'
    }
  });
}
