'use strict';

// Único destino editable; sync:public-shell propaga el cambio a los documentos.
const NOVAK_URL = 'https://novak-web.inf-novakpy.workers.dev/#inicio';

function renderNovakCredit() {
  return `<div class="novak-credit-row">
    <a class="novak-credit" href="${NOVAK_URL}" target="_blank" rel="noopener" aria-label="Hecho por NOVAK, visitar su sitio">
      <span>Hecho por</span>
      <img data-novak-src="/assets-tintin/novak-signature/novak-mark.svg" data-dynamic-src="true" alt="NOVAK" width="42" height="40" decoding="async">
      <noscript><img src="/assets-tintin/novak-signature/novak-mark.svg" alt="NOVAK" width="42" height="40" loading="lazy" decoding="async"></noscript>
    </a>
  </div>`;
}

function ensureNovakStyles(html, absolute = false) {
  for (const [id, href, version] of [
    ['novak-credit-css', '/assets-tintin/novak-signature/novak-credit.css', 'tintin-novak-20261102-2'],
    ['novak-credit-site-css', '/css/components/novak-credit-site.css', 'tintin-novak-20261103-1'],
  ]) {
    html = html.replace(new RegExp(`\\s*<link\\b[^>]*id="${id}"[^>]*>`, 'g'), '');
    const resource = absolute ? href : href.replace(/^\//, '');
    html = html.replace('</head>', `<link id="${id}" rel="stylesheet" href="${resource}?v=${version}">\n</head>`);
  }
  html = html.replace(/\s*<script id="novak-credit-loader"[^>]*><\/script>/g, '');
  html = html.replace('</head>', `<script id="novak-credit-loader" src="${absolute ? '/' : ''}js/components/novak-credit.js?v=tintin-novak-20261103-1" defer></script>\n</head>`);
  return html;
}

function ensureStandaloneCredit(html, page) {
  html = html.replace(/\s*<footer data-novak-footer>[\s\S]*?<\/footer>/g, '');
  const footer = `\n<footer data-novak-footer>${renderNovakCredit()}</footer>\n`;
  // El panel desplaza su main; la firma debe formar parte de ese contenido.
  return page.startsWith('admin')
    ? html.replace(/\s*<\/main>/, `${footer}</main>`)
    : html.replace('</body>', `${footer}</body>`);
}

module.exports = { NOVAK_URL, renderNovakCredit, ensureNovakStyles, ensureStandaloneCredit };
