'use strict';

// Único destino editable; sync:public-shell propaga el cambio a los documentos.
const NOVAK_URL = 'https://novak-web.inf-novakpy.workers.dev/#inicio';

function renderNovakCredit() {
  return `<div class="novak-credit-row">
    <a class="novak-credit" href="${NOVAK_URL}" target="_blank" rel="noopener" aria-label="Hecho por NOVAK, visitar su sitio">
      <span>Hecho por</span>
      <img src="/assets-tintin/novak-signature/novak-mark.svg" alt="NOVAK" width="42" height="40" loading="lazy" decoding="async">
    </a>
  </div>`;
}

function ensureNovakStyles(html) {
  for (const [id, href] of [
    ['novak-credit-css', '/assets-tintin/novak-signature/novak-credit.css'],
    ['novak-credit-site-css', '/css/components/novak-credit-site.css'],
  ]) {
    html = html.replace(new RegExp(`\\s*<link\\b[^>]*id="${id}"[^>]*>`, 'g'), '');
    html = html.replace('</head>', `<link id="${id}" rel="stylesheet" href="${href}?v=tintin-novak-20261102-1">\n</head>`);
  }
  return html;
}

function ensureStandaloneCredit(html, page) {
  html = html.replace(/\s*<footer data-novak-footer>[\s\S]*?<\/footer>/g, '');
  const footer = `\n<footer data-novak-footer>${renderNovakCredit()}</footer>\n`;
  // El panel desplaza su main; la firma debe formar parte de ese contenido.
  return page.startsWith('admin')
    ? html.replace('</main>', `${footer}</main>`)
    : html.replace('</body>', `${footer}</body>`);
}

module.exports = { NOVAK_URL, renderNovakCredit, ensureNovakStyles, ensureStandaloneCredit };
