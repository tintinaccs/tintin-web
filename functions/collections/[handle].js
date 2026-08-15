function safeHandle(value) {
  const handle = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,179}$/.test(handle) ? handle : '';
}

function redirect(request, path) {
  return new Response(null, {
    status: 301,
    headers: {
      location: new URL(path, request.url).toString(),
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      'x-tintin-legacy-route': 'shopify-collection'
    }
  });
}

export function onRequest({ request, params }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  const handle = safeHandle(params?.handle);
  if (!handle) return new Response('Colección no encontrada', { status: 404 });
  if (handle === 'all') return redirect(request, '/catalogo');
  return redirect(request, `/catalogo?cat=${encodeURIComponent(handle)}`);
}
