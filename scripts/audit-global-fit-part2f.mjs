import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'global-fit-part2f');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html',
  'checkout.html', 'login.html', 'perfil.html', 'about.html', 'nosotros.html',
  'contact.html', 'envios.html', 'cambios-devoluciones.html',
  'preguntas-frecuentes.html', 'terminos.html', 'privacidad.html', '404.html',
  'admin.html', 'admin-images.html',
];

const viewports = [
  { name: 'tiny-portrait', width: 280, height: 653 },
  { name: 'small-portrait', width: 320, height: 568 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'mobile-wide', width: 480, height: 820 },
  { name: 'phone-landscape', width: 568, height: 320 },
  { name: 'phone-landscape-wide', width: 667, height: 375 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 600 },
  { name: 'desktop-small', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'desktop-wide', width: 1440, height: 900 },
  { name: 'full-hd', width: 1920, height: 1080 },
  { name: 'qhd', width: 2560, height: 1440 },
];

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4179, '127.0.0.1', resolve));

function staticHtml(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8')
    .replace(/<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="http://127.0.0.1:4179/">');
}

async function loadPage(page, fileName) {
  await page.setContent(staticHtml(fileName), { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#tt-intro,#auth-denied,.adm-auth-denied,.tt-privacy-consent{display:none!important}
    .reveal,.sr,.tt-auto-reveal{opacity:1!important;transform:none!important;filter:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
    html.adm-auth-ready #adm-sidebar,html.adm-auth-ready #adm-mobile-tabs,html.adm-auth-ready .adm-main{visibility:visible!important}
    #adm-header{visibility:visible!important}
  ` });

  await page.evaluate(name => {
    document.documentElement.classList.add('adm-auth-ready', 'tt-parity-guard');
    if (name === 'admin-images.html') {
      const header = document.getElementById('adm-header');
      const layout = document.getElementById('adm-layout');
      const sidebar = document.getElementById('adm-sidebar');
      if (header) header.style.setProperty('display', 'flex', 'important');
      if (layout) layout.style.setProperty('display', 'flex', 'important');
      if (sidebar) sidebar.style.setProperty('display', innerWidth <= 480 ? 'none' : 'block', 'important');
    }
    const target = document.querySelector('main,.adm-main,.ck-main,.login-form-side,.perfil-wrap,body');
    if (target && !document.getElementById('tt-global-fit-probe')) {
      const probe = document.createElement('div');
      probe.id = 'tt-global-fit-probe';
      probe.textContent = 'contenido-administrable-extremadamente-largo-sin-espacios-para-validar-adaptacion-global-0123456789@example.com';
      probe.style.cssText = 'position:relative;display:block;width:100%;font-size:12px;padding:2px;';
      target.appendChild(probe);
    }
  }, fileName);

  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(80);
}

async function inspect(page) {
  return page.evaluate(() => {
    const intentionalScroller = element => {
      let node = element.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        const known = node.matches([
          '.adm-table-wrap','.adm-mobile-tabs','.tt-tabs','.tt-tabbar','.tt-chip-row',
          '.tt-category-tabs','.correos-tabs','.ship-tabs','.user-tabs',
          '.tt-search-suggestions','.ck-steps','.adm-sidebar','[class*="table-wrap"]'
        ].join(','));
        if (known && /(auto|scroll)/.test(style.overflowX)) return true;
        node = node.parentElement;
      }
      return false;
    };

    const bad = [];
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const closedOffCanvas = /(?:drawer|sheet|panel|menu)/i.test(String(element.className || '')) && !element.classList.contains('open') && !element.classList.contains('show') && !element.classList.contains('active');
      if (closedOffCanvas) continue;
      if (rect.left < -4 || rect.right > innerWidth + 4) {
        if (intentionalScroller(element)) continue;
        bad.push({ tag: element.tagName, id: element.id, cls: String(element.className || '').slice(0,100), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) });
        if (bad.length >= 15) break;
      }
    }

    const controlsOutside = [...document.querySelectorAll('button,input,select,textarea,a[href]')]
      .filter(element => {
        const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 2 || rect.height < 2) return false;
        return (rect.left < -4 || rect.right > innerWidth + 4) && !intentionalScroller(element);
      })
      .slice(0, 12)
      .map(element => { const rect = element.getBoundingClientRect(); return { id: element.id, cls: String(element.className || '').slice(0,100), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }; });

    const probe = document.getElementById('tt-global-fit-probe');
    const probeRect = probe?.getBoundingClientRect();
    const probeStyle = probe ? getComputedStyle(probe) : null;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      bad,
      controlsOutside,
      probe: probe ? {
        left: Math.round(probeRect.left), right: Math.round(probeRect.right),
        scrollWidth: probe.scrollWidth, clientWidth: probe.clientWidth,
        overflowWrap: probeStyle.overflowWrap,
      } : null,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const failures = [];
const report = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const fileName of pages) {
      await loadPage(page, fileName);
      const result = await inspect(page);
      if (result.documentWidth > viewport.width + 4 || result.bodyWidth > viewport.width + 4 || result.bad.length) {
        failures.push({ page: fileName, viewport: viewport.name, message: 'Contenido visible fuera del viewport.', result });
      }
      if (result.controlsOutside.length) failures.push({ page: fileName, viewport: viewport.name, message: 'Hay controles inaccesibles fuera del viewport.', controls: result.controlsOutside });
      if (!result.probe || result.probe.right > viewport.width + 4 || result.probe.left < -4 || result.probe.scrollWidth > result.probe.clientWidth + 4 || result.probe.overflowWrap !== 'anywhere') {
        failures.push({ page: fileName, viewport: viewport.name, message: 'La capa global no contiene texto extremo.', probe: result.probe });
      }
      report.push({ page: fileName, viewport, result });
      if (['tiny-portrait','mobile-390','phone-landscape','tablet-portrait','desktop','qhd'].includes(viewport.name) && ['index.html','checkout.html','admin.html','admin-images.html'].includes(fileName)) {
        await page.screenshot({ path: path.join(outDir, `${viewport.name}-${fileName.replace('.html','')}.png`), fullPage: true });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ pages, viewports, report, failures }, null, 2));
if (failures.length) {
  console.error(`GLOBAL FIT: ${failures.length} problema(s) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}] ${item.message}`));
  process.exit(1);
}
console.log(`GLOBAL FIT: CORRECTO · ${pages.length} páginas × ${viewports.length} tamaños/orientaciones = ${pages.length * viewports.length} combinaciones.`);
