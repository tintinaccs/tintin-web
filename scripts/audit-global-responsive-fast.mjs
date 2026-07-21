import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4175;
const baseURL = `http://${host}:${port}`;
const artifacts = path.join(root, 'artifacts', 'global-responsive');
fs.rmSync(artifacts, { recursive: true, force: true });
fs.mkdirSync(artifacts, { recursive: true });

const routes = [
  ['inicio', '/index.html'], ['catalogo', '/catalogo.html'], ['colecciones', '/collections.html'],
  ['producto', '/product.html?id=__geometry__'], ['nosotros', '/about.html'], ['contacto', '/contact.html'],
  ['terminos', '/terminos.html'], ['privacidad', '/privacidad.html'], ['envios', '/envios.html'],
  ['cambios', '/cambios-devoluciones.html'], ['faq', '/preguntas-frecuentes.html'], ['404', '/404.html'],
];
const viewports = [
  [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 900], [1440, 1000],
];
const mime = {
  '.css':'text/css; charset=utf-8','.gif':'image/gif','.html':'text/html; charset=utf-8','.ico':'image/x-icon',
  '.jpeg':'image/jpeg','.jpg':'image/jpeg','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8',
  '.woff':'font/woff','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return res.writeHead(403).end('Forbidden');
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return res.writeHead(404).end('Not found');
    res.writeHead(200, {'cache-control':'no-store','content-type':mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream'});
    fs.createReadStream(absolute).pipe(res);
  });
});
const listen = () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
const closeServer = () => new Promise(resolve => server.close(resolve));

async function prepare(page) {
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const loader = document.getElementById('tt-loader');
    if (loader) { loader.classList.add('tt-out'); loader.setAttribute('aria-hidden', 'true'); }
    document.documentElement.classList.remove('tt-initializing');
    if (document.body) { document.body.style.removeProperty('visibility'); document.body.style.removeProperty('overflow'); }
  });
  await page.waitForTimeout(120);
}

async function geometry(page, width) {
  return page.evaluate(width => {
    const visible = node => {
      if (!node || node.hidden || node.closest('[hidden],[aria-hidden="true"]')) return false;
      const s = getComputedStyle(node), r = node.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > .01 && r.width > 0 && r.height > 0;
    };
    const box = node => { const r = node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
    const issues = [];
    const mobile = width <= 768;
    const header = document.getElementById('tt-header-desktop-tablet');
    const tabbar = document.getElementById('tt-tabbar');
    const footer = document.querySelector('.tt-footer');
    const h1 = [...document.querySelectorAll('h1')].find(n => visible(n) && !n.closest('header,[role="dialog"]'));

    if (document.documentElement.scrollWidth > width + 1 || document.body.scrollWidth > width + 1) {
      issues.push(`overflow raíz html=${document.documentElement.scrollWidth} body=${document.body.scrollWidth}`);
    }
    [...document.querySelectorAll('.container')].filter(visible).forEach((node, i) => {
      const r = box(node); if (r.left < -1 || r.right > width + 1) issues.push(`container ${i + 1} fuera (${Math.round(r.left)}..${Math.round(r.right)})`);
    });
    const breadcrumb = document.querySelector('.tt-breadcrumb,[class*="breadcrumb"]');
    if (visible(breadcrumb) && breadcrumb.scrollWidth > breadcrumb.clientWidth + 1) issues.push('breadcrumb desborda');

    if (mobile) {
      if (visible(header)) issues.push('header desktop visible en mobile');
      if (!visible(tabbar)) issues.push('tabbar mobile ausente');
      else {
        const t = box(tabbar);
        if (t.left < -1 || t.right > width + 1 || Math.abs(t.bottom - innerHeight) > 1) issues.push(`tabbar fuera ${JSON.stringify(t)}`);
        const items = [...tabbar.querySelectorAll('a,button')].filter(visible).map(box);
        items.forEach((a, i) => {
          if (a.left < -1 || a.right > width + 1) issues.push(`acción mobile ${i + 1} fuera`);
          items.slice(i + 1).forEach((b, j) => {
            if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) issues.push(`acciones mobile ${i + 1}/${i + j + 2} se pisan`);
          });
        });
      }
    } else {
      if (visible(tabbar)) issues.push('tabbar visible en desktop/tablet');
      if (!visible(header)) issues.push('header desktop/tablet ausente');
      else {
        const h = box(header);
        if (h.left < -1 || h.right > width + 1 || Math.abs(h.top) > 1) issues.push(`header fuera ${JSON.stringify(h)}`);
        const nodes = [
          ['logo', document.querySelector('#tt-header-desktop-tablet .tt-logo-link')],
          ['nav', document.getElementById('tt-nav-desktop-tablet')],
          ['acciones', document.querySelector('#tt-header-desktop-tablet .tt-header-actions')],
        ].filter(([,n]) => visible(n)).map(([name,n]) => [name,box(n)]);
        nodes.forEach(([name,a], i) => {
          if (a.left < -1 || a.right > width + 1) issues.push(`${name} sale del header`);
          nodes.slice(i + 1).forEach(([other,b]) => {
            if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) issues.push(`${name}/${other} se pisan`);
          });
        });
        if (h1 && box(h1).top < h.bottom + 8) issues.push(`H1 bajo header (${Math.round(box(h1).top)} < ${Math.round(h.bottom + 8)})`);
      }
    }
    if (visible(footer)) { const f = box(footer); if (f.left < -1 || f.right > width + 1) issues.push('footer sale horizontalmente'); }
    return {issues, pathname:location.pathname};
  }, width);
}

async function panelCheck(page, trigger, surface, label) {
  const button = page.locator(trigger).first();
  if (!(await button.count()) || !(await button.isVisible().catch(() => false))) return [];
  await button.click({force:true}).catch(() => {}); await page.waitForTimeout(120);
  const issues = await page.evaluate(({surface,label}) => {
    const node = document.querySelector(surface); if (!node) return [`${label}: falta ${surface}`];
    const s = getComputedStyle(node), r = node.getBoundingClientRect();
    const visible = s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > .01 && r.width > 0 && r.height > 0;
    if (!visible) return [`${label}: no abrió`];
    const out = []; if (r.left < -1 || r.right > innerWidth + 1) out.push(`${label}: desborde horizontal`);
    if (r.top < -1 || r.bottom > innerHeight + 1) out.push(`${label}: desborde vertical`);
    if (node.scrollWidth > node.clientWidth + 1) out.push(`${label}: contenido interno desborda`); return out;
  }, {surface,label});
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(50); return issues;
}

async function sharedPanels(page, width) {
  if (width <= 768) return [
    ...await panelCheck(page,'#tabbar-tienda','#collections-sheet','Tienda mobile'),
    ...await panelCheck(page,'#tabbar-search','#search-panel','Buscar mobile'),
    ...await panelCheck(page,'#tabbar-cart','#cart-drawer','Carrito mobile'),
  ];
  return [
    ...await panelCheck(page,'#btn-tienda','#tt-tienda-dropdown-panel','Tienda desktop'),
    ...await panelCheck(page,'#btn-search','#search-panel','Buscar desktop'),
    ...await panelCheck(page,'#btn-cuenta','#account-panel','Cuenta desktop'),
    ...await panelCheck(page,'#btn-cart','#cart-drawer','Carrito desktop'),
  ];
}

async function footerBottom(page, width) {
  if (width > 768) return [];
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(100);
  return page.evaluate(() => {
    const f = document.querySelector('.tt-footer'), t = document.getElementById('tt-tabbar'); if (!f || !t) return [];
    const fs = getComputedStyle(f), ts = getComputedStyle(t); if (fs.display === 'none' || ts.display === 'none') return [];
    const fr = f.getBoundingClientRect(), tr = t.getBoundingClientRect();
    return fr.bottom > tr.top + 1 ? [`footer tapado por tabbar (${Math.round(fr.bottom)} > ${Math.round(tr.top)})`] : [];
  });
}

await listen();
const browser = await chromium.launch({headless:true});
const report = [], failures = [];
try {
  for (const [width,height] of viewports) {
    const context = await browser.newContext({viewport:{width,height},ignoreHTTPSErrors:true,serviceWorkers:'block',reducedMotion:'reduce'});
    await context.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false; try { localStorage.setItem('tt_privacy_consent_v1','accepted'); } catch {} });
    for (const [name,url] of routes) {
      const page = await context.newPage(); const entry = {name,url,width,height,issues:[]};
      try {
        await page.goto(`${baseURL}${url}`, {waitUntil:'domcontentloaded',timeout:15_000}); await prepare(page);
        const base = await geometry(page,width); entry.pathname = base.pathname; entry.issues.push(...base.issues);
        if (name === 'inicio') entry.issues.push(...await sharedPanels(page,width));
        entry.issues.push(...await footerBottom(page,width));
        if (entry.issues.length) {
          failures.push(`${name} ${width}px: ${entry.issues.join(' | ')}`);
          await page.screenshot({path:path.join(artifacts,`${name}-${width}-bottom.png`)}).catch(() => {});
          await page.evaluate(() => window.scrollTo(0,0)); await page.waitForTimeout(50);
          await page.screenshot({path:path.join(artifacts,`${name}-${width}-top.png`)}).catch(() => {});
        }
        console.log(`${entry.issues.length ? 'ERROR' : 'OK'} — ${name} ${width}×${height}${entry.issues.length ? ` — ${entry.issues.join(' | ')}` : ''}`);
      } catch (error) {
        entry.issues.push(error.message || String(error)); failures.push(`${name} ${width}px: ${error.message || String(error)}`);
      } finally { report.push(entry); await page.close(); }
    }
    await context.close();
  }
} finally { await browser.close(); await closeServer(); }
fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify({failures,report},null,2));
fs.writeFileSync(path.join(artifacts,'report.txt'),failures.length ? failures.join('\n') : 'Todas las geometrías globales pasaron.\n');
console.log(`\nResultado: ${report.length - failures.length}/${report.length} combinaciones correctas.`);
if (failures.length) process.exit(1);
