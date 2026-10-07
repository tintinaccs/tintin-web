// Una repetición es candidata, no un defecto por definición. Conservar método,
// resultado y navegación permite separar reintentos, redirects y preflight.
export function classifyRequests(requests) {
  const groups = new Map();
  for (const request of requests) {
    if (!['GET', 'HEAD'].includes(request.method)) continue;
    const url = new URL(request.url);
    if (!/\.(?:css|js|mjs|woff2?|png|jpe?g|webp|svg)$/.test(url.pathname) && !url.pathname.startsWith('/api/')) continue;
    const logical = new URL(url);
    logical.searchParams.delete('v');
    const key = `${request.navigationId ?? 0} ${request.method} ${logical.href}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(request);
  }
  return [...groups.entries()].filter(([, items]) => items.length > 1).map(([resource, items]) => {
    const urls = [...new Set(items.map(item => item.url))];
    const classification = items.some(item => item.failure || item.status >= 400) ? 'retry_or_error'
      : items.some(item => item.redirected || (item.status >= 300 && item.status < 400)) ? 'redirect'
      : urls.length > 1 ? 'conflicting_versions'
      : items.every(item => item.frameId != null) && new Set(items.map(item => item.frameId)).size > 1 ? 'isolated_frames'
      : 'repeated_success';
    return { resource, classification, urls, requests: items };
  });
}
