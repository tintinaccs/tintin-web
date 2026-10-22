// Contrato compartido por el generador y el navegador. Una propagación de ?v=
// no es un cambio de interfaz; los bytes del recurso se comparan por separado.
export function visualSource(source) {
  return String(source).replace(/\r\n?/g, '\n')
    .replace(/<meta\b[^>]*name=["']tintin-page-revision["'][^>]*>\s*\n?/gi, '')
    .replace(/(["'`])([^"'`\s<>]+\.(?:css|m?js)\?[^"'`\s<>]*)\1/g, (match, quote, url) =>
      /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url) ? match : quote + url.replace(/([?&](?:amp;)?v=)[A-Za-z0-9._-]+/g, '$1__version__') + quote)
    .replace(/(["'])tintin-20\d{6}-[A-Za-z0-9._-]+\1/g, '$1__version__$1');
}

export function clientResourcePath(raw, baseHref) {
  try {
    const base = new URL(baseHref), url = new URL(raw, base);
    if (url.origin !== base.origin || !url.searchParams.get('v')) return '';
    const path = url.pathname.replace(/^\//, '');
    return /\.(?:css|m?js)$/.test(path) && !/^(?:functions|cloudflare|scripts|tests|apps-script)\//.test(path) ? path : '';
  } catch { return ''; }
}
