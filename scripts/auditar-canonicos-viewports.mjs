import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'diagnostic-manifest.json'), 'utf8'));
const host = '127.0.0.1';
const port = 4179;
const baseURL = `http://${host}:${port}`;
const artifactDir = path.join(root, 'artifacts', 'canonical-viewports');
const PAGE_DEADLINE_MS = 12000;

fs.rmSync(artifactDir, { recursive: true, force: true });
fs.mkdirSync(artifactDir, { recursive: true });

const canonicalViewports = [
  { width: 1920, height: 1080, id: 'desktop-large' },
  { width: 1440, height: 900, id: 'desktop' },
  { width: 1280, height: 720, id: 'laptop' },
  { width: 1024, height: 768, id: 'tablet-landscape' },
  { width: 768, height: 1024, id: 'tablet-portrait' },
  { width: 390, height: 844, id: 'mobile' },
  { width: 320, height: 568, id: 'mini-mobile' }
];

const manifestViewports = new Map((manifest.viewports || []).map(item => [`${item.width}x${item.height}`, item.id]));
for (const viewport of canonicalViewports) {
  const key = `${viewport.width}x${viewport.height}`;
  if (manifestViewports.get(key) !== viewport.id) throw new Error(`El manifiesto no contiene el viewport canónico ${key} (${viewport.id}).`);
}

const pages = (manifest.pages || [])
  .map(page => ({ path: page.path, id: page.id, requiresAuth: page.requiresAuth === true, redirectsTo: page.metadata?.redirectsTo || '' }))
  .filter(page => page.path && fs.existsSync(path.join(root, page.path)));
const authShellPages = new Set(['admin.html', 'admin-images.html', 'login.html', 'perfil.html']);
const expectsPublicShell = pageInfo => !authShellPages.has(pageInfo.path) && !pageInfo.redirectsTo;

const ciProducts = [
  { id:'ci-reloj', data:{ name:'Reloj CI', category:'relojes', price:100000, stock:5, active:true, destacado:true, imageUrl:'', desc:'Producto de auditoría.' } },
  { id:'ci-collar', data:{ name:'Collar CI', category:'collares', price:70000, stock:8, active:true, destacado:true, imageUrl:'', desc:'Producto de auditoría.' } },
  { id:'ci-aro', data:{ name:'Aro CI', category:'aros', price:50000, stock:6, active:true, destacado:true, imageUrl:'', desc:'Producto de auditoría.' } }
];
const ciCollections = [
  { id:'relojes', data:{ name:'Relojes', title:'Relojes', slug:'relojes', active:true, order:1 } },
  { id:'collares', data:{ name:'Collares', title:'Collares', slug:'collares', active:true, order:2 } },
  { id:'aros', data:{ name:'Aros', title:'Aros', slug:'aros', active:true, order:3 } }
];
const mime = {
  '.css':'text/css; charset=utf-8','.gif':'image/gif','.html':'text/html; charset=utf-8','.ico':'image/x-icon',
  '.jpeg':'image/jpeg','.jpg':'image/jpeg','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp',
  '.webmanifest':'application/manifest+json; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8'
};

function sendJson(response, payload) {
  response.writeHead(200, { 'cache-control':'no-store', 'content-type':'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', baseURL);
  const pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === '/api/public-catalog') {
    const resource = requestUrl.searchParams.get('resource');
    const id = requestUrl.searchParams.get('id');
    const source = resource === 'collections' ? ciCollections : ciProducts;
    if (!['products','collections'].includes(resource || '')) return sendJson(response, { ok:false, resource, items:[] });
    if (id) return sendJson(response, { ok:true, resource, item:source.find(item => item.id === id) || null });
    return sendJson(response, { ok:true, resource, items:source });
  }
  if (pathname.startsWith('/api/')) {
    response.writeHead(404, { 'cache-control':'no-store', 'content-type':'application/json; charset=utf-8' });
    response.end('{"ok":false}');
    return;
  }
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end('Forbidden');
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end('Not found');
    response.writeHead(200, { 'cache-control':'no-store', 'content-type':mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(absolute).pipe(response);
  });
});

const listen = () => new Promise((resolve,reject) => { server.once('error',reject); server.listen(port,host,resolve); });
const closeServer = () => new Promise(resolve => server.close(resolve));

async function waitForVisibleBodyContent(page) {
  await page.waitForFunction(() => [...(document.body?.children || [])].some(node => {
    const style = getComputedStyle(node); const box = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && box.width > 0 && box.height > 0;
  }), null, { timeout:2500 }).catch(() => {});
}

async function prepare(page, width, pageInfo) {
  await page.waitForSelector('body', { state:'attached', timeout:4000 });
  if (expectsPublicShell(pageInfo)) {
    await page.waitForFunction(() => document.getElementById('tt-tabbar') || document.getElementById('tt-header-desktop-tablet'), null, { timeout:3500 }).catch(() => {});
  }
  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const root = document.documentElement; const body = document.body;
    ['tt-initializing','tt-store-gate-pending','tt-store-gate-blocked','tt-scroll-locked','tt-color-scheme-pending'].forEach(name => root.classList.remove(name));
    ['overflow','overscroll-behavior','touch-action'].forEach(name => root.style.removeProperty(name));
    if (body) {
      body.classList.remove('tt-scroll-locked');
      ['position','top','left','right','width','overflow','visibility','touch-action'].forEach(name => body.style.removeProperty(name));
    }
    document.getElementById('tt-loader')?.remove();
    const closed = document.getElementById('tt-store-closed-overlay');
    if (closed) { closed.hidden = true; closed.setAttribute('aria-hidden','true'); closed.style.display = 'none'; }
    window.scrollTo(0,0);
  });
  if (expectsPublicShell(pageInfo)) {
    const expected = width < 768 ? '#tt-tabbar' : width <= 1024 ? '#tt-header-tablet' : '#tt-header-desktop-tablet';
    await page.waitForFunction(selector => {
      const node = document.querySelector(selector); if (!node) return false;
      const style = getComputedStyle(node); const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && box.width > 0 && box.height > 0;
    }, expected, { timeout:3500 }).catch(() => {});
  } else await waitForVisibleBodyContent(page);
  await page.waitForTimeout(120);
}

async function inspect(page, width, pageInfo) {
  return page.evaluate(({ width, pageInfo, shellExpected }) => {
    const issues = [];
    const visible = node => {
      if (!node) return false; const style = getComputedStyle(node); const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && box.width > 0 && box.height > 0;
    };
    const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    if (!pageInfo.redirectsTo && rootWidth > width + 1) issues.push(`overflow horizontal raíz ${rootWidth}px`);
    const visibleBodyChildren = [...(document.body?.children || [])].filter(visible);
    if (!pageInfo.requiresAuth && !pageInfo.redirectsTo && !visibleBodyChildren.length) issues.push('la página quedó visualmente vacía');
    if (shellExpected) {
      const desktop = document.getElementById('tt-header-desktop-tablet');
      const tablet = document.getElementById('tt-header-tablet');
      const mobile = document.getElementById('tt-tabbar');
      if (width < 768) { if (visible(desktop)) issues.push('header desktop visible en mobile'); if (visible(tablet)) issues.push('header tablet visible en mobile'); if (!visible(mobile)) issues.push('tabbar mobile oculta'); }
      else if (width <= 1024) { if (visible(desktop) || visible(mobile)) issues.push('navegación ajena visible en tablet'); if (!visible(tablet)) issues.push('header tablet oculto'); }
      else { if (visible(tablet) || visible(mobile)) issues.push('navegación ajena visible en desktop'); if (!visible(desktop)) issues.push('header desktop oculto'); }
    }
    const fixedOrSticky = [...document.querySelectorAll('body *')].filter(node => visible(node) && ['fixed','sticky'].includes(getComputedStyle(node).position));
    for (const node of fixedOrSticky) {
      const box = node.getBoundingClientRect();
      if (box.left < -2 || box.right > innerWidth + 2) { issues.push(`elemento fijo fuera horizontalmente: ${node.id ? `#${node.id}` : String(node.className || node.tagName).slice(0,80)}`); break; }
    }
    for (const dialog of [...document.querySelectorAll('[role="dialog"],dialog')].filter(visible)) {
      const box = dialog.getBoundingClientRect();
      if (box.left < -2 || box.right > innerWidth + 2 || box.top < -2 || box.bottom > innerHeight + 2) issues.push(`diálogo visible fuera del viewport: ${dialog.id ? `#${dialog.id}` : dialog.tagName}`);
    }
    return issues;
  }, { width, pageInfo, shellExpected:expectsPublicShell(pageInfo) });
}

async function settleAuthRedirect(page, pageInfo, startUrl) {
  if (!pageInfo.requiresAuth) return;
  try { await page.waitForURL(url => url.toString() !== startUrl, { timeout:2200 }); await page.waitForLoadState('domcontentloaded', { timeout:3000 }).catch(() => {}); } catch {}
}

async function navigateWithRetry(page, url, width, pageInfo) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil:'domcontentloaded', timeout:8000 });
      await settleAuthRedirect(page, pageInfo, page.url());
      await prepare(page, width, pageInfo);
      return;
    } catch (error) { lastError = error; if (attempt < 2) await page.waitForTimeout(250); }
  }
  throw lastError;
}

async function inspectWithRetry(page, width, pageInfo) {
  try { return await inspect(page, width, pageInfo); }
  catch { await page.waitForTimeout(180); return inspect(page, width, pageInfo); }
}

async function withPageDeadline(page, label, operation) {
  let timer = 0;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      page.close({ runBeforeUnload:false }).catch(() => {});
      reject(new Error(`${label} excedió el límite duro de ${PAGE_DEADLINE_MS} ms`));
    }, PAGE_DEADLINE_MS);
  });
  try { return await Promise.race([operation(), deadline]); }
  finally { clearTimeout(timer); }
}

await listen();
const browser = await chromium.launch({ headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
const failures = [];
const report = [];

try {
  for (const viewport of canonicalViewports) {
    const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, ignoreHTTPSErrors:true, serviceWorkers:'block', reducedMotion:'reduce' });
    await context.addInitScript(() => {
      window.TT_DISABLE_STORE_GATE = true;
      window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false;
      try { localStorage.setItem('tt_privacy_consent_v1','accepted'); } catch {}
    });
    for (const pageInfo of pages) {
      const page = await context.newPage();
      const label = `${pageInfo.path} ${viewport.width}×${viewport.height}`;
      const entry = { page:pageInfo.path, viewport:viewport.id, width:viewport.width, height:viewport.height, issues:[] };
      console.log(`START — ${label}`);
      try {
        await withPageDeadline(page, label, async () => {
          await navigateWithRetry(page, `${baseURL}/${pageInfo.path}`, viewport.width, pageInfo);
          entry.issues.push(...await inspectWithRetry(page, viewport.width, pageInfo));
        });
      } catch (error) { entry.issues.push(error?.message || String(error)); }
      if (entry.issues.length) {
        failures.push(`${label}: ${entry.issues.join(' | ')}`);
        if (!page.isClosed()) await page.screenshot({ path:path.join(artifactDir, `${pageInfo.id || pageInfo.path}-${viewport.width}x${viewport.height}.png`), fullPage:false, timeout:3000 }).catch(() => {});
      }
      console.log(`${entry.issues.length ? 'ERROR' : 'OK'} — ${label}${entry.issues.length ? ` — ${entry.issues.join(' | ')}` : ''}`);
      report.push(entry);
      if (!page.isClosed()) await page.close({ runBeforeUnload:false }).catch(() => {});
    }
    await context.close().catch(() => {});
  }
} finally {
  await browser.close().catch(() => {});
  await closeServer();
}

fs.writeFileSync(path.join(artifactDir,'report.json'), JSON.stringify({ failures,report }, null,2));
fs.writeFileSync(path.join(artifactDir,'report.txt'), failures.length ? failures.join('\n') : 'Todas las páginas pasaron en los siete viewports canónicos.\n');
console.log(`\nResultado canónico: ${report.length - failures.length}/${report.length} combinaciones correctas.`);
if (failures.length) process.exit(1);
