import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4176;
const baseURL = `http://${host}:${port}`;
const artifactDir = path.join(root, 'artifacts', 'global-responsive-v2');
fs.rmSync(artifactDir, { recursive: true, force: true });
fs.mkdirSync(artifactDir, { recursive: true });

const routes = [
  ['inicio', '/index.html'], ['catalogo', '/catalogo.html'], ['colecciones', '/collections.html'],
  ['producto', '/product.html?id=__geometry__'], ['nosotros', '/about.html'], ['contacto', '/contact.html'],
  ['terminos', '/terminos.html'], ['privacidad', '/privacidad.html'], ['envios', '/envios.html'],
  ['cambios', '/cambios-devoluciones.html'], ['faq', '/preguntas-frecuentes.html'], ['404', '/404.html'],
];

const primaryViewports = [
  [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 900], [1440, 1000],
];
const boundaryViewports = [
  [320, 720], [480, 900], [481, 900], [767, 1024], [769, 1024], [820, 1180], [900, 1180], [1023, 800], [1920, 1080],
];
const viewports = [...primaryViewports, ...boundaryViewports];

const mime = {
  '.css':'text/css; charset=utf-8','.gif':'image/gif','.html':'text/html; charset=utf-8','.ico':'image/x-icon',
  '.jpeg':'image/jpeg','.jpg':'image/jpeg','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8',
  '.woff':'font/woff','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end('Forbidden');
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end('Not found');
    response.writeHead(200, {'cache-control':'no-store','content-type':mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream'});
    fs.createReadStream(absolute).pipe(response);
  });
});
const listen = () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
const closeServer = () => new Promise(resolve => server.close(resolve));

async function prepare(page) {
  await page.waitForTimeout(650);
  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const loader = document.getElementById('tt-loader');
    if (loader) { loader.classList.add('tt-out'); loader.setAttribute('aria-hidden', 'true'); }
    document.documentElement.classList.remove('tt-initializing');
    document.body?.style.removeProperty('visibility');
  });
  await page.waitForTimeout(100);
}

async function inspectPage(page, width) {
  return page.evaluate(width => {
    const isVisible = node => {
      if (!node || node.hidden || node.closest('[hidden],[aria-hidden="true"]')) return false;
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && rect.width > 0 && rect.height > 0;
    };
    const box = node => { const r = node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
    const collision = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const issues = [];
    const mobile = width <= 768;
    const header = document.getElementById('tt-header-desktop-tablet');
    const tabbar = document.getElementById('tt-tabbar');
    const footer = document.querySelector('.tt-footer');
    const consent = document.getElementById('tt-privacy-consent');
    const whatsapp = document.querySelector('.tt-wa-float');
    const h1 = [...document.querySelectorAll('h1')].find(n => isVisible(n) && !n.closest('header,[role="dialog"]'));

    if (document.documentElement.scrollWidth > width + 1 || document.body.scrollWidth > width + 1) {
      issues.push(`overflow raíz html=${document.documentElement.scrollWidth} body=${document.body.scrollWidth}`);
    }
    [...document.querySelectorAll('.container')].filter(isVisible).forEach((node, index) => {
      const r = box(node); if (r.left < -1 || r.right > width + 1) issues.push(`container ${index + 1} fuera (${Math.round(r.left)}..${Math.round(r.right)})`);
    });
    const breadcrumb = document.querySelector('.tt-breadcrumb,[class*="breadcrumb"]');
    if (isVisible(breadcrumb) && breadcrumb.scrollWidth > breadcrumb.clientWidth + 1) issues.push('breadcrumb desborda');

    if (mobile) {
      if (isVisible(header)) issues.push('header desktop visible en mobile');
      if (!isVisible(tabbar)) issues.push('tabbar mobile ausente');
      else {
        const t = box(tabbar), bottomGap = innerHeight - t.bottom;
        if (t.left < -1 || t.right > width + 1 || t.bottom > innerHeight + 1 || bottomGap < 8 || bottomGap > 32) {
          issues.push(`tabbar mal posicionada ${JSON.stringify(t)} gap=${Math.round(bottomGap)}`);
        }
        const actions = [...tabbar.querySelectorAll('a,button')].filter(isVisible).map(box);
        actions.forEach((a, index) => {
          if (a.left < -1 || a.right > width + 1) issues.push(`acción mobile ${index + 1} fuera`);
          actions.slice(index + 1).forEach((b, offset) => { if (collision(a,b)) issues.push(`acciones mobile ${index + 1}/${index + offset + 2} se pisan`); });
        });
        for (const [label, node] of [['privacidad', consent], ['WhatsApp', whatsapp]]) {
          if (!isVisible(node)) continue;
          const r = box(node), gap = t.top - r.bottom;
          if (r.left < -1 || r.right > width + 1 || r.top < -1) issues.push(`${label} sale del viewport`);
          if (gap < 12) issues.push(`${label} queda pegado o pisa la tabbar: ${Math.round(gap)}px`);
        }
      }
    } else {
      if (isVisible(tabbar)) issues.push('tabbar visible en desktop/tablet');
      if (!isVisible(header)) issues.push('header desktop/tablet ausente');
      else {
        const h = box(header);
        if (h.left < -1 || h.right > width + 1 || Math.abs(h.top) > 1) issues.push(`header fuera ${JSON.stringify(h)}`);
        const groups = [
          ['logo', document.querySelector('#tt-header-desktop-tablet .tt-logo-link')],
          ['nav', document.getElementById('tt-nav-desktop-tablet')],
          ['acciones', document.querySelector('#tt-header-desktop-tablet .tt-header-actions')],
        ].filter(([,node]) => isVisible(node)).map(([name,node]) => [name,box(node)]);
        groups.forEach(([name,a], index) => {
          if (a.left < -1 || a.right > width + 1) issues.push(`${name} sale del header`);
          groups.slice(index + 1).forEach(([other,b]) => { if (collision(a,b)) issues.push(`${name}/${other} se pisan`); });
        });
        if (h1 && box(h1).top < h.bottom + 8) issues.push(`H1 bajo header (${Math.round(box(h1).top)} < ${Math.round(h.bottom + 8)})`);
      }
    }
    if (isVisible(footer)) { const f = box(footer); if (f.left < -1 || f.right > width + 1) issues.push('footer sale horizontalmente'); }
    return { issues, pathname: location.pathname };
  }, width);
}

async function inspectFooterBottom(page, width) {
  if (width > 768) return [];
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const footer = document.querySelector('.tt-footer'), tabbar = document.getElementById('tt-tabbar');
    if (!footer || !tabbar) return [];
    const visible = node => { const s = getComputedStyle(node), r = node.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    if (!visible(footer) || !visible(tabbar)) return [];
    const tabTop = tabbar.getBoundingClientRect().top;
    let maxContentBottom = -Infinity;
    [...footer.querySelectorAll('a,button,p,span,strong,small')].filter(visible).forEach(node => { maxContentBottom = Math.max(maxContentBottom, node.getBoundingClientRect().bottom); });
    const bottom = footer.querySelector('.tt-footer-bottom');
    if (bottom) {
      const range = document.createRange(); range.selectNodeContents(bottom);
      [...range.getClientRects()].forEach(rect => { maxContentBottom = Math.max(maxContentBottom, rect.bottom); });
    }
    return Number.isFinite(maxContentBottom) && maxContentBottom > tabTop - 16
      ? [`contenido final del footer demasiado cerca de la tabbar: ${Math.round(maxContentBottom)} > ${Math.round(tabTop - 16)}`]
      : [];
  });
}

async function checkPanel(page, trigger, surface, label) {
  const button = page.locator(trigger).first();
  if (!(await button.count()) || !(await button.isVisible().catch(() => false))) return [];
  await page.evaluate(() => { const consent = document.getElementById('tt-privacy-consent'); if (consent) consent.hidden = true; });
  await button.click({ force: true }).catch(() => {});
  await page.waitForTimeout(120);
  const issues = await page.evaluate(({surface,label}) => {
    const node = document.querySelector(surface); if (!node) return [`${label}: falta ${surface}`];
    const style = getComputedStyle(node), r = node.getBoundingClientRect();
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && r.width > 0 && r.height > 0;
    if (!visible) return [`${label}: no abrió`];
    const out = [];
    if (r.left < -1 || r.right > innerWidth + 1) out.push(`${label}: desborde horizontal`);
    if (r.top < -1 || r.bottom > innerHeight + 1) out.push(`${label}: desborde vertical`);
    if (node.scrollWidth > node.clientWidth + 1) out.push(`${label}: contenido interno desborda`);
    return out;
  }, {surface,label});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(50);
  return issues;
}

async function inspectPanels(page, width) {
  if (width <= 768) return [
    ...await checkPanel(page,'#tabbar-tienda','#collections-sheet','Tienda mobile'),
    ...await checkPanel(page,'#tabbar-search','#search-panel','Buscar mobile'),
    ...await checkPanel(page,'#tabbar-cart','#cart-drawer','Carrito mobile'),
  ];
  return [
    ...await checkPanel(page,'#btn-tienda','#tt-tienda-dropdown-panel','Tienda desktop'),
    ...await checkPanel(page,'#btn-search','#search-panel','Buscar desktop'),
    ...await checkPanel(page,'#btn-cuenta','#account-panel','Cuenta desktop'),
    ...await checkPanel(page,'#btn-cart','#cart-drawer','Carrito desktop'),
  ];
}

await listen();
const browser = await chromium.launch({ headless: true });
const report = [], failures = [];
try {
  for (const [width,height] of viewports) {
    const context = await browser.newContext({ viewport:{width,height}, ignoreHTTPSErrors:true, serviceWorkers:'block', reducedMotion:'reduce' });
    await context.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false; });
    for (const [name,url] of routes) {
      const page = await context.newPage();
      const entry = { name, url, width, height, primary: primaryViewports.some(([w,h]) => w === width && h === height), issues: [] };
      try {
        await page.goto(`${baseURL}${url}`, { waitUntil:'domcontentloaded', timeout:15_000 });
        await prepare(page);
        const base = await inspectPage(page,width); entry.pathname = base.pathname; entry.issues.push(...base.issues);
        if (name === 'inicio') entry.issues.push(...await inspectPanels(page,width));
        entry.issues.push(...await inspectFooterBottom(page,width));
        if (entry.issues.length) {
          failures.push(`${name} ${width}px: ${entry.issues.join(' | ')}`);
          await page.screenshot({ path:path.join(artifactDir,`${name}-${width}-bottom.png`) }).catch(() => {});
          await page.evaluate(() => window.scrollTo(0,0)); await page.waitForTimeout(50);
          await page.screenshot({ path:path.join(artifactDir,`${name}-${width}-top.png`) }).catch(() => {});
        }
        console.log(`${entry.issues.length ? 'ERROR' : 'OK'} — ${name} ${width}×${height}${entry.issues.length ? ` — ${entry.issues.join(' | ')}` : ''}`);
      } catch (error) {
        entry.issues.push(error.message || String(error)); failures.push(`${name} ${width}px: ${error.message || String(error)}`);
      } finally { report.push(entry); await page.close(); }
    }
    await context.close();
  }
} finally { await browser.close(); await closeServer(); }

fs.writeFileSync(path.join(artifactDir,'report.json'),JSON.stringify({failures,report},null,2));
fs.writeFileSync(path.join(artifactDir,'report.txt'),failures.length ? failures.join('\n') : 'Todas las geometrías globales pasaron.\n');
console.log(`\nResultado: ${report.length - failures.length}/${report.length} combinaciones correctas.`);
if (failures.length) process.exit(1);
