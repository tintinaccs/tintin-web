const PAGE_REDIRECTS = Object.freeze({
  contact: '/contact',
  contacto: '/contact',
  about: '/about',
  nosotros: '/about',
  'quienes-somos': '/about',
  envios: '/envios',
  shipping: '/envios',
  'shipping-policy': '/envios',
  faq: '/preguntas-frecuentes',
  'preguntas-frecuentes': '/preguntas-frecuentes',
  'cambios-devoluciones': '/cambios-devoluciones',
  devoluciones: '/cambios-devoluciones',
  cambios: '/cambios-devoluciones',
  privacy: '/privacidad',
  privacidad: '/privacidad',
  terms: '/terminos',
  terminos: '/terminos'
});

function safeSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,179}$/.test(slug) ? slug : '';
}

export function onRequest({ request, params }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  const slug = safeSlug(params?.slug);
  const target = PAGE_REDIRECTS[slug];
  if (!target) {
    return new Response('Página no encontrada', {
      status: 404,
      headers: { 'cache-control': 'public, max-age=300', 'x-tintin-legacy-route': 'shopify-page-miss' }
    });
  }
  return new Response(null, {
    status: 301,
    headers: {
      location: new URL(target, request.url).toString(),
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      'x-tintin-legacy-route': 'shopify-page'
    }
  });
}
