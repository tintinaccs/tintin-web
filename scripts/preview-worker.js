// Advanced-mode Pages worker. It has no credentials, service or data bindings.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method) || /^\/(?:api(?:\/|$)|__\/auth(?:\/|$))/.test(url.pathname)) {
      return Response.json({ok: false, error: 'visual_preview_only'}, {status: 403, headers: {'cache-control': 'no-store'}});
    }
    const result = await env.ASSETS.fetch(request);
    const headers = new Headers(result.headers);
    headers.set('cache-control', 'no-store');
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'no-referrer');
    headers.set('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; worker-src 'none'; object-src 'none'");
    return new Response(request.method === 'HEAD' ? null : result.body, {status: result.status, headers});
  }
};
