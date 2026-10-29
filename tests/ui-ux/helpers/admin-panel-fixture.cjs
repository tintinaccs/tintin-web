const { expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const runtimePath = '/js/admin/maestro/espacio-modulos-admin.js';
const loader = fs.readFileSync(path.join(root, 'js/cargador-pagina.js'), 'utf8');
const entryScroll = loader.slice(loader.indexOf("  try { history.scrollRestoration"), loader.indexOf('  // El sitio oficial'));


async function load(page, width, file = 'admin.html', options = {}) {
  await page.setViewportSize({ width, height: 800 });
  // Markup y estilos reales; ningún controlador de negocio, sesión o red real.
  const scripts = [runtimePath, ...(options.mobile ? ['/js/admin/maestro/navegacion-movil-admin.js'] : []), '/js/admin/maestro/buscador-modulos-admin.js', ...(options.sidebar ? ['/js/admin/sidebar-expandible-admin.js'] : []), ...(options.guard ? ['/js/admin/proteccion-cambios-pendientes-admin.js'] : [])];
  const shell = fs.readFileSync(path.join(root, file), 'utf8')
    .replace('</head>', `<script nonce="dGludGluLWZpeHR1cmU=">${entryScroll}</script></head>`)
    .replace('</body>', scripts.map(src => `<script nonce="dGludGluLWZpeHR1cmU=" type="module" src="${src}"></script>`).join('') + '</body>' );
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'tintin.test') return route.abort();
    if (url.pathname === '/fixture') return route.fulfill({
      contentType: 'text/html', body: shell,
      headers: { 'Content-Security-Policy': "default-src 'none'; script-src 'nonce-dGludGluLWZpeHR1cmU=' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none';" },
    });
    const allowed = /\.(css|woff2|png|svg|ico)$/.test(url.pathname) || scripts.includes(url.pathname) || ['/js/admin/maestro/registro-maestro.js','/js/admin/datos/busqueda-admin.mjs'].includes(url.pathname);
    const filePath = path.resolve(root, `.${url.pathname}`);
    if (!allowed || !filePath.startsWith(root + path.sep) || !fs.existsSync(filePath)) return route.abort();
    return route.fulfill({ path: filePath, contentType: /\.m?js$/.test(filePath) ? 'text/javascript' : undefined });
  });
  await page.goto('https://tintin.test/fixture');
  await page.evaluate(() => {
    document.documentElement.classList.add('adm-auth-ready');
    // El tablero real revela Pedidos al terminar su montaje autenticado.
    document.getElementById('section-pedidos')?.classList.add('tt-commerce-mounted');
    const layout = document.getElementById('adm-layout');
    if (layout) layout.style.display = 'flex';
  });
  await expect(page.locator('.tt-admin-workspace-bar').first()).toBeAttached();
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

module.exports = { load };
