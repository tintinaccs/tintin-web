import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4177;
const baseURL = `http://${host}:${port}`;
const outDir = path.join(root, 'artifacts', 'global-responsive-final-v2');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const routes = [
  ['inicio', '/index.html'], ['catalogo', '/catalogo.html'], ['colecciones', '/collections.html'],
  ['producto', '/product.html?id=__geometry__'], ['nosotros', '/about.html'], ['contacto', '/contact.html'],
  ['terminos', '/terminos.html'], ['privacidad', '/privacidad.html'], ['envios', '/envios.html'],
  ['cambios', '/cambios-devoluciones.html'], ['faq', '/preguntas-frecuentes.html'], ['404', '/404.html'],
];
const official = [[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,900],[1440,1000]];
const boundaries = [[480,900],[481,900],[767,1000],[769,1000],[1023,800],[1025,800]];
const mime = {
  '.css':'text/css; charset=utf-8','.gif':'image/gif','.html':'text/html; charset=utf-8','.ico':'image/x-icon',
  '.jpeg':'image/jpeg','.jpg':'image/jpeg','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8',
  '.woff':'font/woff','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', baseURL).pathname);
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return res.writeHead(403).end('Forbidden');
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return res.writeHead(404).end('Not found');
    res.writeHead(200, {'cache-control':'no-store','content-type':mime[path.extname(file).toLowerCase()] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
});
const listen = () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
const closeServer = () => new Promise(resolve => server.close(resolve));

async function ready(page, width) {
  const expected = width <= 768 ? '#tt-tabbar' : '#tt-header-desktop-tablet';
  await page.waitForSelector(expected, { state: 'attached', timeout: 5000 }).catch(() => {});
  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const loader = document.getElementById('tt-loader');
    if (loader) { loader.classList.add('tt-out'); loader.setAttribute('aria-hidden', 'true'); }
    document.documentElement.classList.remove('tt-initializing', 'tt-store-gate-pending');
    document.body?.style.removeProperty('visibility');
    document.body?.style.removeProperty('overflow');
  });
  await page.waitForTimeout(140);
}

async function measure(page, width) {
  return page.evaluate(width => {
    const issues = [];
    const visible = node => {
      if (!node || node.hidden || node.closest('[hidden],[aria-hidden="true"]')) return false;
      const s = getComputedStyle(node), r = node.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > .01 && r.width > 0 && r.height > 0;
    };
    const box = node => { const r = node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
    const overlap = (a,b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const mobile = width <= 768;
    const header = document.getElementById('tt-header-desktop-tablet');
    const tabbar = document.getElementById('tt-tabbar');
    const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    if (rootWidth > width + 1) issues.push(`overflow raíz ${rootWidth}px`);

    [...document.querySelectorAll('.container')].filter(visible).forEach((node, i) => {
      const r = box(node); if (r.left < -1 || r.right > width + 1) issues.push(`container ${i + 1} fuera`);
    });
    const crumb = document.querySelector('.tt-breadcrumb,[class*="breadcrumb"]');
    if (visible(crumb) && crumb.scrollWidth > crumb.clientWidth + 1) issues.push('breadcrumb desborda');

    if (mobile) {
      if (visible(header)) issues.push('header desktop visible en mobile');
      if (!visible(tabbar)) issues.push('tabbar mobile ausente');
      else {
        const t = box(tabbar), gap = innerHeight - t.bottom;
        if (t.left < -1 || t.right > width + 1) issues.push('tabbar sale horizontalmente');
        if (gap < -1 || gap > 40) issues.push(`separación inferior de tabbar ${Math.round(gap)}px`);
        const actions = [...tabbar.querySelectorAll('a,button')].filter(visible).map(box);
        actions.forEach((a, i) => actions.slice(i + 1).forEach((b, j) => { if (overlap(a,b)) issues.push(`acciones ${i+1}/${i+j+2} se pisan`); }));
      }
    } else {
      if (visible(tabbar)) issues.push('tabbar visible fuera de mobile');
      if (!visible(header)) issues.push('header desktop/tablet ausente');
      else {
        const h = box(header);
        const zones = [
          ['logo', document.querySelector('#tt-header-desktop-tablet .tt-logo-link')],
          ['nav', document.getElementById('tt-nav-desktop-tablet')],
          ['acciones', document.querySelector('#tt-header-desktop-tablet .tt-header-actions')],
        ].filter(([,n]) => visible(n)).map(([name,n]) => [name,box(n)]);
        zones.forEach(([name,a], i) => {
          if (a.left < -1 || a.right > width + 1) issues.push(`${name} sale del header`);
          zones.slice(i + 1).forEach(([other,b]) => { if (overlap(a,b)) issues.push(`${name}/${other} se pisan`); });
        });
        const h1 = [...document.querySelectorAll('h1')].find(n => visible(n) && !n.closest('header,[role="dialog"]'));
        if (h1 && box(h1).top < h.bottom + 8) issues.push('H1 debajo del header');
      }
    }
    const footer = document.querySelector('.tt-footer');
    if (visible(footer)) { const f = box(footer); if (f.left < -1 || f.right > width + 1) issues.push('footer sale horizontalmente'); }
    return issues;
  }, width);
}

async function panel(page, trigger, surface, label) {
  const button = page.locator(trigger).first();
  if (!(await button.count()) || !(await button.isVisible().catch(() => false))) return [];
  await button.click({force:true}).catch(() => {});
  await page.waitForTimeout(100);
  const result = await page.evaluate(({surface,label}) => {
    const node = document.querySelector(surface); if (!node) return [`${label}: falta superficie`];
    const s = getComputedStyle(node), r = node.getBoundingClientRect();
    const shown = s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > .01 && r.width > 0 && r.height > 0;
    if (!shown) return [`${label}: no abrió`];
    const out = [];
    if (r.left < -1 || r.right > innerWidth + 1) out.push(`${label}: desborde horizontal`);
    if (r.top < -1 || r.bottom > innerHeight + 1) out.push(`${label}: desborde vertical`);
    if (node.scrollWidth > node.clientWidth + 1) out.push(`${label}: contenido interno desborda`);
    return out;
  }, {surface,label});
  await page.keyboard.press('Escape').catch(() => {});
  return result;
}

async function shared(page, width) {
  if (width <= 768) return [
    ...await panel(page,'#tabbar-tienda','#collections-sheet','Tienda mobile'),
    ...await panel(page,'#tabbar-search','#search-panel','Buscar mobile'),
    ...await panel(page,'#tabbar-cart','#cart-drawer','Carrito mobile'),
  ];
  return [
    ...await panel(page,'#btn-tienda','#tt-tienda-dropdown-panel','Tienda desktop'),
    ...await panel(page,'#btn-search','#search-panel','Buscar desktop'),
    ...await panel(page,'#btn-cuenta','#account-panel','Cuenta desktop'),
    ...await panel(page,'#btn-cart','#cart-drawer','Carrito desktop'),
  ];
}

async function bottomClearance(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  return page.evaluate(() => {
    const tab = document.getElementById('tt-tabbar'), footer = document.querySelector('.tt-footer');
    if (!tab || !footer || getComputedStyle(tab).display === 'none') return [];
    const top = tab.getBoundingClientRect().top;
    const content = [...footer.querySelectorAll('a,button,p,span,strong,small')].filter(node => {
      const s = getComputedStyle(node), r = node.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && (node.textContent || '').trim();
    });
    const last = content.reduce((max,node) => Math.max(max,node.getBoundingClientRect().bottom), -Infinity);
    return Number.isFinite(last) && last > top - 12 ? ['contenido final del footer demasiado cerca de tabbar'] : [];
  });
}

async function run(browser, width, height, pageRoutes, inspectShared) {
  const context = await browser.newContext({viewport:{width,height},ignoreHTTPSErrors:true,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addInitScript(() => {
    window.TT_DISABLE_STORE_GATE = true;
    window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false;
    try { localStorage.setItem('tt_privacy_consent_v1','accepted'); } catch {}
  });
  const entries = [];
  for (const [name,url] of pageRoutes) {
    const page = await context.newPage(), entry = {name,url,width,height,issues:[]};
    try {
      await page.goto(`${baseURL}${url}`, {waitUntil:'domcontentloaded',timeout:15000});
      await ready(page,width);
      entry.issues.push(...await measure(page,width));
      if (inspectShared && name === 'inicio') entry.issues.push(...await shared(page,width));
      if (width <= 768) entry.issues.push(...await bottomClearance(page));
      if (entry.issues.length) await page.screenshot({path:path.join(outDir,`${name}-${width}.png`),fullPage:true}).catch(() => {});
    } catch (error) { entry.issues.push(error.message || String(error)); }
    entries.push(entry); await page.close();
  }
  await context.close();
  return entries;
}

await listen();
const browser = await chromium.launch({headless:true});
const report = [];
try {
  for (const [width,height] of official) report.push(...await run(browser,width,height,routes,true));
  for (const [width,height] of boundaries) report.push(...await run(browser,width,height,[['inicio','/index.html']],true));
} finally { await browser.close(); await closeServer(); }

const failures = report.filter(entry => entry.issues.length);
fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify({failures,report},null,2));
fs.writeFileSync(path.join(outDir,'report.txt'),failures.length ? failures.map(e => `${e.name} ${e.width}px: ${e.issues.join(' | ')}`).join('\n') : 'Todas las geometrías globales pasaron.\n');
report.forEach(e => console.log(`${e.issues.length ? 'ERROR' : 'OK'} — ${e.name} ${e.width}×${e.height}${e.issues.length ? ` — ${e.issues.join(' | ')}` : ''}`));
console.log(`\nResultado: ${report.length - failures.length}/${report.length} combinaciones correctas.`);
if (failures.length) process.exit(1);
