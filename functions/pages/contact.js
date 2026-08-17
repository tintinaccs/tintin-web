export function onRequest({ request }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  return new Response(null, {
    status: 301,
    headers: {
      location: new URL('/contact', request.url).toString(),
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      'x-tintin-legacy-route': 'shopify-page-contact'
    }
  });
}
