import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4176;
const baseURL = `http://${host}:${port}`;
const artifactDir = path.join(root, 'artifacts', 'global-responsive');
fs.rmSync(artifactDir, { recursive: true, force: true });
fs.mkdirSync(artifactDir, { recursive: true });

const routes = [
  ['inicio', '/index.html'], ['catalogo', '/catalogo.html'], ['colecciones', '/collections.html'],
  ['producto', '/product.html?id=__geometry__'], ['nosotros', '/about.html'], ['contacto', '/contact.html'],
  ['terminos', '/terminos.html'], ['privacidad', '/privacidad.html'], ['envios', '/envios.html'],
  ['cambios', '/cambios-devoluciones.html'], ['faq', '/preguntas-frecuentes.html'], ['404', '/404.html'],
];

const officialViewports = [
  [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 900], [1440, 1000],
];
const boundaryViewports = [
  [320, 720], [480, 900], [481, 900], [767, 1024], [769, 1024], [820, 1180],
  [900, 1180], [1023, 800], [1025, 800], [1920, 1080],
];
const viewports = [...officialViewports, ...boundaryViewports];

const mime = {
  '.css':'text/css; charset=utf-8','.gif':'image/gif','.html':'text/html; charset=utf-8','.ico':'image/x-icon',
  '.jpeg':'image/jpeg','.jpg':'image/jpeg','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp',
  '.webmanifest':'application/manifest+json; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8',
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
  await page.waitForSelector('body', { state:'attached', timeout:5_000 });
  await page.waitForFunction(() => (
    document.body?.classList.contains('tt-public-shell-mounted') ||
    document.getElementById('tt-tabbar') ||
    document.getElementById('tt-header-desktop-tablet')
  ), null, { timeout:4_000 }).catch(() => {});

  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const root = document.documentElement, body = document.body;
    ['tt-initializing','tt-store-gate-pending','tt-store-gate-blocked','tt-scroll-locked'].forEach(name => root.classList.remove(name));
    root.style.removeProperty('overflow');
    root.style.removeProperty('overscroll-behavior');
    root.style.removeProperty('touch-action');
    if (body) {
      body.classList.remove('tt-scroll-locked');
      ['position','top','left','right','width','overflow','visibility','touch-action'].forEach(name => body.style.removeProperty(name));
    }
    document.getElementById('tt-loader')?.remove();
    const closed = document.getElementById('tt-store-closed-overlay');
    if (closed) {
      closed.hidden = true;
      closed.setAttribute('aria-hidden', 'true');
      closed.style.display = 'none';
    }
    window.scrollTo(0,0);
  });
  await page.waitForTimeout(180);
}

async function inspectBase(page, width) {
  return page.evaluate(width => {
    const issues = [];
    const visible = (node, requireViewport = false) => {
      if (!node) return false;
      const style = getComputedStyle(node), r = node.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) <= .01 || r.width <= 0 || r.height <= 0) return false;
      return !requireViewport || (r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
    };
    const rect = node => { const r = node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
    const overlaps = (a,b,tolerance=1) => a.left < b.right - tolerance && a.right > b.left + tolerance && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
    const mobile = width <= 768;
    const header = document.getElementById('tt-header-desktop-tablet');
    const tabbar = document.getElementById('tt-tabbar');
    const footer = document.querySelector('.tt-footer');
    const privacy = document.querySelector('.tt-privacy-consent');
    const whatsapp = document.querySelector('.tt-wa-float');
    const firstHeading = [...document.querySelectorAll('h1')].find(node => visible(node) && !node.closest('header,[role="dialog"]'));

    const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    if (rootWidth > width + 1) issues.push(`overflow horizontal raíz ${rootWidth}px`);

    [...document.querySelectorAll('.container')].filter(node => visible(node)).forEach((node,index) => {
      const r = rect(node);
      if (r.left < -1 || r.right > width + 1) issues.push(`container ${index + 1} fuera (${Math.round(r.left)}..${Math.round(r.right)})`);
    });
    const breadcrumb = document.querySelector('.tt-breadcrumb,[class*="breadcrumb"]');
    if (visible(breadcrumb) && breadcrumb.scrollWidth > breadcrumb.clientWidth + 1) issues.push('breadcrumb desborda');

    if (mobile) {
      if (visible(header)) issues.push('header desktop visible en mobile');
      if (!visible(tabbar)) {
        issues.push('tabbar mobile ausente');
      } else {
        const t = rect(tabbar), bottomGap = innerHeight - t.bottom;
        if (t.left < -1 || t.right > width + 1) issues.push('tabbar sale horizontalmente');
        if (bottomGap < 8 || bottomGap > 32) issues.push(`tabbar con separación inferior inválida ${Math.round(bottomGap)}px`);
        const actions = [...tabbar.querySelectorAll('a,button')].filter(node => visible(node)).map(rect);
        actions.forEach((action,index) => {
          if (action.left < -1 || action.right > width + 1) issues.push(`acción mobile ${index + 1} fuera`);
          actions.slice(index + 1).forEach((other,offset) => {
            if (overlaps(action,other)) issues.push(`acciones mobile ${index + 1}/${index + offset + 2} se pisan`);
          });
        });
        for (const [label,node] of [['privacidad',privacy],['WhatsApp',whatsapp]]) {
          if (!visible(node,true)) continue;
          const r = rect(node), gap = t.top - r.bottom;
          if (r.left < -1 || r.right > width + 1 || r.top < -1) issues.push(`${label} sale del viewport`);
          if (gap < 12) issues.push(`${label} queda pegado o pisa la tabbar: ${Math.round(gap)}px`);
        }
      }

      if (visible(whatsapp,true)) {
        const wa = rect(whatsapp);
        const collided = [...document.querySelectorAll('a,button')].find(node =>
          visible(node,true) &&
          !node.closest('.tt-wa-float,.tt-tabbar,.tt-privacy-consent,.tt-search-panel,.tt-cart-drawer,.tt-collections-sheet,.tt-header') &&
          overlaps(wa,rect(node),2)
        );
        if (collided) issues.push(`WhatsApp pisa ${collided.id ? '#' + collided.id : collided.className || collided.tagName}`);
      }
    } else {
      if (visible(tabbar)) issues.push('tabbar visible en desktop/tablet');
      if (!visible(header)) {
        issues.push('header desktop/tablet ausente');
      } else {
        const h = rect(header);
        if (h.left < -1 || h.right > width + 1 || Math.abs(h.top) > 1) issues.push('header fuera de pantalla');
        const zones = [
          ['logo',document.querySelector('#tt-header-desktop-tablet .tt-logo-link')],
          ['nav',document.getElementById('tt-nav-desktop-tablet')],
          ['acciones',document.querySelector('#tt-header-desktop-tablet .tt-header-actions')],
        ].filter(([,node]) => visible(node)).map(([name,node]) => [name,rect(node)]);
        zones.forEach(([name,box],index) => {
          if (box.left < -1 || box.right > width + 1) issues.push(`${name} sale del header`);
          zones.slice(index + 1).forEach(([otherName,otherBox]) => {
            if (overlaps(box,otherBox)) issues.push(`${name}/${otherName} se pisan`);
          });
        });
        if (firstHeading && rect(firstHeading).top < h.bottom + 8) issues.push('primer H1 queda debajo del header');
      }
    }

    if (visible(footer)) {
      const f = rect(footer);
      if (f.left < -1 || f.right > width + 1) issues.push('footer sale horizontalmente');
    }
    return issues;
  }, width);
}

async function inspectMobileBottom(page) {
  await page.evaluate(() => window.scrollTo(0,document.documentElement.scrollHeight));
  await page.waitForTimeout(140);
  return page.evaluate(() => {
    const issues = [];
    const tabbar = document.getElementById('tt-tabbar');
    const footer = document.querySelector('.tt-footer');
    const whatsapp = document.querySelector('.tt-wa-float');
    const visible = node => {
      if (!node) return false;
      const style = getComputedStyle(node), r = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    };
    const overlaps = (a,b,t=1) => a.left < b.right - t && a.right > b.left + t && a.top < b.bottom - t && a.bottom > b.top + t;
    if (visible(tabbar) && footer) {
      const tabTop = tabbar.getBoundingClientRect().top;
      const candidates = [...footer.querySelectorAll('a,button,p,span,strong,small')].filter(node => visible(node) && (node.textContent || '').trim());
      const lastBottom = candidates.reduce((max,node) => Math.max(max,node.getBoundingClientRect().bottom),-Infinity);
      if (Number.isFinite(lastBottom) && lastBottom > tabTop - 16) issues.push(`contenido final del footer demasiado cerca de tabbar (${Math.round(lastBottom)} > ${Math.round(tabTop - 16)})`);
    }
    if (visible(whatsapp)) {
      const wa = whatsapp.getBoundingClientRect();
      const control = [...document.querySelectorAll('a,button')].find(node =>
        visible(node) && !node.closest('.tt-wa-float,.tt-tabbar,.tt-privacy-consent,.tt-header') && overlaps(wa,node.getBoundingClientRect(),2)
      );
      if (control) issues.push(`WhatsApp pisa ${control.id ? '#' + control.id : control.className || control.tagName} al final`);
    }
    return issues;
  });
}

async function resetSurfaces(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    ['tt-tienda-dropdown-panel','search-panel','account-panel','cart-drawer','collections-sheet','tt-mobile-menu'].forEach(id => document.getElementById(id)?.classList.remove('open'));
    document.querySelectorAll('.tt-nav-dropdown.open').forEach(node => node.classList.remove('open'));
    document.querySelectorAll('[aria-expanded="true"]').forEach(node => node.setAttribute('aria-expanded','false'));
  });
  await page.waitForTimeout(50);
}

async function checkSurface(page,trigger,surface,label) {
  const button = page.locator(trigger).first();
  if (!(await button.count()) || !(await button.isVisible().catch(() => false))) return [];
  await page.evaluate(() => { const consent = document.querySelector('.tt-privacy-consent'); if (consent) consent.hidden = true; });
  await button.click({ force:true }).catch(() => {});
  await page.waitForTimeout(140);
  const issues = await page.evaluate(({surface,label}) => {
    const node = document.querySelector(surface);
    if (!node) return [`${label}: falta ${surface}`];
    const style = getComputedStyle(node), r = node.getBoundingClientRect();
    const visible = element => {
      if (!element) return false;
      const s = getComputedStyle(element), box = element.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > .01 && box.width > 0 && box.height > 0;
    };
    if (!visible(node)) return [`${label}: no abrió`];
    const result = [];
    if (r.left < -1 || r.right > innerWidth + 1) result.push(`${label}: desborde horizontal`);
    if (r.top < -1 || r.bottom > innerHeight + 1) result.push(`${label}: desborde vertical`);
    const leakingChild = [...node.querySelectorAll('a,button,input,img,p,span,strong,small,div')].filter(visible).find(child => {
      if (getComputedStyle(child).position === 'fixed') return false;
      const box = child.getBoundingClientRect();
      return box.left < -2 || box.right > innerWidth + 2;
    });
    if (leakingChild) result.push(`${label}: un elemento visible sale horizontalmente`);
    return result;
  }, {surface,label});
  await resetSurfaces(page);
  return issues;
}

async function inspectSharedSurfaces(page,width) {
  if (width <= 768) return [
    ...await checkSurface(page,'#tabbar-tienda','#collections-sheet','Tienda mobile'),
    ...await checkSurface(page,'#tabbar-search','#search-panel','Buscar mobile'),
    ...await checkSurface(page,'#tabbar-cart','#cart-drawer','Carrito mobile'),
  ];

  const issues = [];
  if (width <= 1024) issues.push(...await checkSurface(page,'.tt-menu-toggle','.tt-mobile-menu','Menú tablet'));
  else issues.push(...await checkSurface(page,'#btn-tienda','#tt-tienda-dropdown-panel','Tienda desktop'));
  issues.push(...await checkSurface(page,'#btn-search','#search-panel','Buscar desktop/tablet'));
  issues.push(...await checkSurface(page,'#btn-cuenta','#account-panel','Cuenta desktop/tablet'));
  issues.push(...await checkSurface(page,'#btn-cart','#cart-drawer','Carrito desktop/tablet'));
  return issues;
}

async function inspectPrivacy(page) {
  await page.evaluate(() => { try { localStorage.removeItem('tt_privacy_consent_v1'); } catch {} });
  await page.reload({ waitUntil:'domcontentloaded', timeout:15_000 });
  await prepare(page);
  await page.waitForTimeout(260);
  const issues = await page.evaluate(() => {
    const consent = document.querySelector('.tt-privacy-consent'), tabbar = document.getElementById('tt-tabbar');
    if (!consent || !tabbar) return [];
    const cs = getComputedStyle(consent), ts = getComputedStyle(tabbar);
    if (cs.display === 'none' || cs.visibility === 'hidden' || ts.display === 'none' || ts.visibility === 'hidden') return [];
    const c = consent.getBoundingClientRect(), t = tabbar.getBoundingClientRect();
    const result = [];
    if (c.left < -1 || c.right > innerWidth + 1 || c.top < -1) result.push('aviso de privacidad sale del viewport');
    if (c.bottom > t.top - 12) result.push('aviso de privacidad demasiado cerca de tabbar');
    return result;
  });
  await page.evaluate(() => {
    try { localStorage.setItem('tt_privacy_consent_v1','accepted'); } catch {}
    const consent = document.querySelector('.tt-privacy-consent'); if (consent) consent.hidden = true;
  });
  return issues;
}

await listen();
const browser = await chromium.launch({ headless:true });
const report = [], failures = [];
try {
  for (const [width,height] of viewports) {
    const context = await browser.newContext({ viewport:{width,height}, ignoreHTTPSErrors:true, serviceWorkers:'block', reducedMotion:'reduce' });
    await context.addInitScript(() => {
      window.TT_DISABLE_STORE_GATE = true;
      window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false;
      try { localStorage.setItem('tt_privacy_consent_v1','accepted'); } catch {}
    });
    for (const [name,url] of routes) {
      const page = await context.newPage();
      const entry = { name,url,width,height,official:officialViewports.some(([w,h]) => w === width && h === height),issues:[] };
      try {
        await page.goto(`${baseURL}${url}`, { waitUntil:'domcontentloaded', timeout:15_000 });
        await prepare(page);
        entry.issues.push(...await inspectBase(page,width));
        if (name === 'inicio') entry.issues.push(...await inspectSharedSurfaces(page,width));
        if (width <= 768) entry.issues.push(...await inspectMobileBottom(page));
        if (name === 'inicio' && width <= 768) entry.issues.push(...await inspectPrivacy(page));
        if (entry.issues.length) {
          failures.push(`${name} ${width}px: ${entry.issues.join(' | ')}`);
          await page.screenshot({ path:path.join(artifactDir,`${name}-${width}-bottom.png`) }).catch(() => {});
          await page.evaluate(() => window.scrollTo(0,0));
          await page.waitForTimeout(60);
          await page.screenshot({ path:path.join(artifactDir,`${name}-${width}-top.png`) }).catch(() => {});
        }
        console.log(`${entry.issues.length ? 'ERROR' : 'OK'} — ${name} ${width}×${height}${entry.issues.length ? ' — ' + entry.issues.join(' | ') : ''}`);
      } catch (error) {
        entry.issues.push(error.message || String(error));
        failures.push(`${name} ${width}px: ${error.message || String(error)}`);
      } finally {
        report.push(entry);
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await closeServer();
}

fs.writeFileSync(path.join(artifactDir,'report.json'),JSON.stringify({failures,report},null,2));
fs.writeFileSync(path.join(artifactDir,'report.txt'),failures.length ? failures.join('\n') : 'Todas las geometrías globales pasaron.\n');
console.log(`\nResultado: ${report.length - failures.length}/${report.length} combinaciones correctas.`);
if (failures.length) process.exit(1);
