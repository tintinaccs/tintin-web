import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'system-special-part2g');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2'
};

function staticHtml(fileName) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="/">');
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'no-store');

  if (pathname.startsWith('/__static__/')) {
    const name = pathname.slice('/__static__/'.length);
    const file = path.resolve(root, name);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(staticHtml(name));
    return;
  }

  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4179, '127.0.0.1', resolve));

const baseUrl = 'http://127.0.0.1:4179';
const viewports = [
  { name: 'mini280', width: 280, height: 653 },
  { name: 'mini320', width: 320, height: 568 },
  { name: 'mobile360', width: 360, height: 800 },
  { name: 'mobile390', width: 390, height: 844 },
  { name: 'mobile430', width: 430, height: 932 },
  { name: 'mobile-landscape', width: 844, height: 390 },
  { name: 'tablet768', width: 768, height: 1024 },
  { name: 'tablet1024', width: 1024, height: 768 },
  { name: 'desktop1280', width: 1280, height: 720 },
  { name: 'desktop1440', width: 1440, height: 900 },
  { name: 'desktop1920', width: 1920, height: 1080 },
  { name: 'desktop2560', width: 2560, height: 1440 }
];

const failures = [];
const report = [];
const screenshotViewports = new Set(['mini280', 'mini320', 'mobile390', 'mobile-landscape', 'desktop1440']);

function fail(pageName, vp, state, message, data = null) {
  failures.push({ page: pageName, viewport: vp.name, state, message, data });
}

async function loadStatic(page, fileName) {
  await page.goto(`${baseUrl}/__static__/${fileName}`, { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    .tt-auto-reveal,.reveal,.sr{opacity:1!important;transform:none!important;filter:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  ` });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(80);
}

async function measure(page, selector) {
  return page.evaluate(sel => {
    const root = document.querySelector(sel);
    const rootRect = root?.getBoundingClientRect();
    const visibleOutside = [];

    const hasScroller = (element, axis) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (axis === 'x' && /(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 2) return true;
        if (axis === 'y' && /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 2) return true;
        parent = parent.parentElement;
      }
      return false;
    };

    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      if (rect.width < 2 || rect.height < 2 || hasScroller(element, 'x')) continue;
      if (rect.left < -3 || rect.right > innerWidth + 3) {
        visibleOutside.push({
          id: element.id,
          cls: String(element.className || '').slice(0, 100),
          left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width)
        });
        if (visibleOutside.length >= 12) break;
      }
    }

    const controls = root ? Array.from(root.querySelectorAll('a,button,input,select,textarea,[role="button"]'))
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.id || '', cls: String(element.className || '').slice(0, 100), tag: element.tagName,
          type: element.getAttribute('type') || '', width: Math.round(rect.width), height: Math.round(rect.height),
          left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom),
          verticalScrollable: hasScroller(element, 'y')
        };
      }) : [];

    return {
      viewport: { width: innerWidth, height: innerHeight },
      root: rootRect ? {
        left: Math.round(rootRect.left), right: Math.round(rootRect.right), top: Math.round(rootRect.top),
        bottom: Math.round(rootRect.bottom), width: Math.round(rootRect.width), height: Math.round(rootRect.height),
        scrollHeight: root.scrollHeight, clientHeight: root.clientHeight, overflowY: getComputedStyle(root).overflowY
      } : null,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      visibleOutside,
      controls
    };
  }, selector);
}

function enforce(pageName, vp, state, metrics, { minControl = 44, allowSmall = [] } = {}) {
  if (!metrics.root) {
    fail(pageName, vp, state, 'No se encontró el estado visual principal.');
    return;
  }
  if (metrics.documentScrollWidth > vp.width + 3 || metrics.visibleOutside.length) {
    fail(pageName, vp, state, 'Hay contenido visible fuera del ancho disponible.', metrics);
  }
  if (metrics.root.left < -2 || metrics.root.right > vp.width + 2) {
    fail(pageName, vp, state, 'El estado principal sale del viewport.', metrics.root);
  }
  const horizontal = metrics.controls.filter(item => item.left < -2 || item.right > vp.width + 2);
  if (horizontal.length) fail(pageName, vp, state, 'Hay controles fuera del ancho visible.', horizontal);
  const vertical = metrics.controls.filter(item => (item.top < -2 || item.bottom > vp.height + 2) && !item.verticalScrollable);
  if (vertical.length) fail(pageName, vp, state, 'Hay controles fuera del alto visible y sin scroll accesible.', vertical);
  const short = metrics.controls.filter(item => {
    const allowed = allowSmall.some(token => token && (item.id === token || item.cls.includes(token)));
    return item.height < minControl && !allowed;
  });
  if (short.length) fail(pageName, vp, state, 'Hay controles táctiles demasiado bajos.', short);
}

async function capture(page, vp, name) {
  if (!screenshotViewports.has(vp.name)) return;
  await page.screenshot({ path: path.join(outDir, `${vp.name}-${name}.png`), fullPage: true });
}

async function auditState(page, vp, pageName, state, selector, options = {}) {
  const metrics = await measure(page, selector);
  enforce(pageName, vp, state, metrics, options);
  report.push({ page: pageName, viewport: vp.name, state, metrics });
  await capture(page, vp, `${pageName}-${state}`);
}

async function mountPrivacy(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { localStorage.removeItem('tt_activity_consent_v1'); } catch {}
    document.getElementById('tt-privacy-consent')?.remove();
  });
  await page.evaluate(async url => { await import(url); }, `${baseUrl}/js/privacy-consent.js?audit=${Date.now()}-${Math.random()}`);
  await page.waitForSelector('#tt-privacy-consent', { state: 'visible' });
}

async function mountBlocked(page) {
  await page.evaluate(async url => {
    const module = await import(url);
    module.showBlockedModal();
  }, `${baseUrl}/js/blocked-modal.js?audit=${Date.now()}-${Math.random()}`);
  await page.waitForSelector('#tt-blocked-overlay .tt-blocked-dialog', { state: 'visible' });
}

async function mountStoreGate(page, kind) {
  await page.addStyleTag({ content: `
    #tt-store-closed-overlay{position:fixed!important;inset:0!important;z-index:2147482990!important;display:grid!important;place-items:center!important;width:100%!important;min-height:100dvh!important;padding:clamp(16px,3vw,32px)!important;box-sizing:border-box!important;overflow:auto!important;background:rgba(30,10,18,.62)!important;backdrop-filter:blur(7px)!important}
    #tt-store-closed-overlay,#tt-store-closed-overlay *{box-sizing:border-box!important}
    .tt-store-gate-dialog{width:min(100%,460px)!important;max-height:calc(100dvh - 32px)!important;margin:auto!important;padding:clamp(28px,5vw,40px) clamp(20px,5vw,34px)!important;overflow:auto!important;border:1px solid rgba(212,106,138,.14)!important;border-radius:20px!important;background:#fff!important;text-align:center!important;box-shadow:0 18px 60px rgba(35,12,22,.28)!important}
    .tt-store-gate-icon{display:block;margin:0 0 16px;font-size:clamp(34px,7vw,42px);line-height:1}.tt-store-gate-title{margin:0 0 12px;color:#8b2642;font:800 clamp(19px,3.2vw,22px)/1.25 Montserrat}.tt-store-gate-message{max-width:360px;margin:0 auto 26px;color:#555;font:400 clamp(13px,2.4vw,14px)/1.65 Montserrat}
    .tt-store-gate-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;width:100%}.tt-store-gate-action{display:inline-flex;align-items:center;justify-content:center;min-width:146px;min-height:46px;padding:11px 24px;border-radius:999px;font:700 13px/1.2 Montserrat;text-align:center;text-decoration:none}.tt-store-gate-login{border:1.5px solid #d9a9b8;background:#fff;color:#8b2642}.tt-store-gate-retry{border:0;background:#8b2642;color:#fff}
    @media(max-width:600px){#tt-store-closed-overlay{padding:max(16px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))!important}.tt-store-gate-dialog{width:100%!important;max-width:390px!important;padding:28px 20px 24px!important;border-radius:18px!important}.tt-store-gate-actions{flex-direction:column!important}.tt-store-gate-action{width:min(100%,260px)!important;min-width:0!important}}
  ` });
  await page.evaluate(state => {
    document.getElementById('tt-store-closed-overlay')?.remove();
    const unavailable = state === 'unavailable';
    const overlay = document.createElement('div');
    overlay.id = 'tt-store-closed-overlay';
    overlay.innerHTML = `<section class="tt-store-gate-dialog" role="dialog" aria-modal="true" aria-labelledby="tt-store-gate-title" aria-describedby="tt-store-gate-message">
      <span class="tt-store-gate-icon" aria-hidden="true">${unavailable ? '⚠️' : '🌙'}</span>
      <h1 id="tt-store-gate-title" class="tt-store-gate-title">${unavailable ? 'No pudimos comprobar el estado de la tienda' : 'Tienda temporalmente cerrada'}</h1>
      <p id="tt-store-gate-message" class="tt-store-gate-message">${unavailable ? 'Por seguridad, el sitio permanece bloqueado hasta que podamos confirmar su estado.' : 'En este momento la tienda no está disponible. Solo puede ingresar el equipo autorizado.'}</p>
      <div class="tt-store-gate-actions">${unavailable ? '<button type="button" class="tt-store-gate-action tt-store-gate-retry">Reintentar</button>' : ''}<a class="tt-store-gate-action tt-store-gate-login" href="login.html">Iniciar sesión</a></div>
    </section>`;
    document.body.appendChild(overlay);
  }, kind);
}

async function mountLoader(page, withDots) {
  await page.addStyleTag({ content: `
    #tt-loader{position:fixed!important;inset:0!important;z-index:2147483000!important;display:flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;justify-content:center!important;background:#FFF6FA!important;overflow:hidden!important;touch-action:none!important}
    #tt-loader-spin-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center}#tt-loader-logo{width:clamp(180px,15vw,230px);max-width:72vw;height:auto;object-fit:contain;display:block}.tt-loader-dots{display:flex;gap:9px;margin-top:20px}.tt-loader-dots span{width:9px;height:9px;border-radius:50%;background:#AD3F67;opacity:.75}@media(max-width:600px){#tt-loader-logo{width:clamp(110px,30vw,150px)}}
  ` });
  await page.evaluate(dots => {
    document.getElementById('tt-loader')?.remove();
    const loader = document.createElement('div');
    loader.id = 'tt-loader';
    loader.setAttribute('aria-hidden', 'true');
    loader.setAttribute('role', 'presentation');
    loader.innerHTML = `<div id="tt-loader-spin-wrap"><img id="tt-loader-logo" src="assets-tintin/images/general/logo.png" alt="" width="220" height="220">${dots ? '<div class="tt-loader-dots"><span></span><span></span><span></span></div>' : ''}</div>`;
    document.body.prepend(loader);
  }, withDots);
  await page.waitForTimeout(30);
}

async function mountCatalogState(page, state) {
  await page.addStyleTag({ url: `${baseUrl}/css/catalog-maintenance.css?v=20260718-1` });
  await page.evaluate(current => {
    document.body.classList.add('tt-catalog-maintenance');
    const grid = document.getElementById('cat-grid');
    const top = document.querySelector('.cat-top');
    let sync = document.getElementById('tt-catalog-sync-state');
    if (!sync) { sync = document.createElement('div'); sync.id = 'tt-catalog-sync-state'; top?.insertAdjacentElement('afterend', sync); }
    const syncLabels = { loading: 'Actualizando catálogo…', offline: 'Sin conexión · mostrando datos guardados', error: 'No se pudo actualizar · reintentaremos automáticamente', empty: 'Catálogo actualizado' };
    sync.dataset.state = current; sync.textContent = syncLabels[current];
    if (current === 'empty') {
      grid.innerHTML = '<div class="cat-empty"><div style="font-size:40px" aria-hidden="true">🔎</div><h3>No encontramos productos</h3><p>Probá limpiando los filtros o buscando otra categoría.</p><button type="button" class="tt-btn" id="tt-empty-reset">Limpiar filtros</button></div>';
      return;
    }
    const data = {
      loading: ['Preparando catálogo', 'Estamos organizando los productos y filtros.'],
      offline: ['Sin conexión', 'No pudimos descargar productos nuevos. Revisá tu conexión y volvé a intentar.'],
      error: ['El catálogo tardó demasiado', 'Podés reintentar sin perder los filtros elegidos.']
    }[current];
    grid.innerHTML = `<div class="tt-catalog-runtime-state" data-state="${current}"><div><strong>${data[0]}</strong><span>${data[1]}</span>${current === 'error' ? '<button type="button" id="tt-catalog-retry">Reintentar</button>' : ''}</div></div>`;
  }, state);
  await page.waitForTimeout(30);
}

async function mountAddedToast(page) {
  await page.evaluate(() => {
    document.querySelector('.tt-added-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'tt-added-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<div class="tt-added-toast-msg"><span class="tt-added-toast-icon">✓</span><span>Producto agregado correctamente al carrito</span></div><div class="tt-added-toast-actions"><button type="button" class="tt-added-toast-btn tt-added-toast-continue">Seguir comprando</button><a href="checkout.html" class="tt-added-toast-btn tt-added-toast-checkout">Finalizar compra</a></div>';
    document.body.appendChild(toast);
  });
}

async function mountCartFeedback(page, warning) {
  await page.evaluate(isWarning => {
    document.querySelector('.tt-cart-feedback')?.remove();
    const feedback = document.createElement('div');
    feedback.className = 'tt-cart-feedback is-visible';
    feedback.dataset.state = isWarning ? 'warning' : 'success';
    feedback.setAttribute('role', 'status');
    feedback.textContent = isWarning ? 'No pudimos sincronizar el carrito. Tus cambios siguen guardados en este dispositivo.' : 'Carrito actualizado correctamente.';
    document.body.appendChild(feedback);
  }, warning);
}

async function auditViewport(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });
  const page = await context.newPage();

  await loadStatic(page, '404.html');
  await auditState(page, vp, '404', 'not-found', '.tt-404-wrap');

  await loadStatic(page, 'index.html');
  await mountPrivacy(page);
  await auditState(page, vp, 'global', 'privacy-initial', '#tt-privacy-consent');
  await page.evaluate(() => window.TintinActivityPrivacy.open());
  await page.waitForSelector('#tt-privacy-consent.is-customizing', { state: 'visible' });
  await auditState(page, vp, 'global', 'privacy-customized', '#tt-privacy-consent', { allowSmall: ['tt-privacy-statistics'] });

  await loadStatic(page, 'login.html');
  await mountBlocked(page);
  await auditState(page, vp, 'login', 'blocked-account', '#tt-blocked-overlay');

  await loadStatic(page, 'index.html');
  for (const state of ['closed', 'unavailable']) {
    await mountStoreGate(page, state);
    await auditState(page, vp, 'global', `store-${state}`, '#tt-store-closed-overlay');
  }

  await loadStatic(page, 'index.html');
  for (const state of [{ name: 'loader-home', dots: false }, { name: 'loader-inner', dots: true }]) {
    await mountLoader(page, state.dots);
    const metrics = await measure(page, '#tt-loader');
    if (!metrics.root || metrics.root.width < vp.width - 2 || metrics.root.height < vp.height - 2) {
      fail('global', vp, state.name, 'El loader no cubre el viewport completo.', metrics.root);
    }
    if (metrics.documentScrollWidth > vp.width + 3 || metrics.visibleOutside.length) fail('global', vp, state.name, 'El loader genera desborde.', metrics);
    report.push({ page: 'global', viewport: vp.name, state: state.name, metrics });
    await capture(page, vp, `global-${state.name}`);
  }

  await loadStatic(page, 'catalogo.html');
  for (const state of ['loading', 'offline', 'error', 'empty']) {
    await mountCatalogState(page, state);
    await auditState(page, vp, 'catalogo', state, '#cat-grid');
  }

  await loadStatic(page, 'product.html');
  await mountAddedToast(page);
  await auditState(page, vp, 'producto', 'added-toast', '.tt-added-toast');
  for (const warning of [false, true]) {
    await mountCartFeedback(page, warning);
    await auditState(page, vp, 'global', warning ? 'cart-warning' : 'cart-success', '.tt-cart-feedback', { minControl: 0 });
  }

  await loadStatic(page, 'admin-images.html');
  await page.evaluate(() => { const denied = document.getElementById('auth-denied'); denied.style.display = 'flex'; });
  await auditState(page, vp, 'admin-images', 'permission-denied', '#auth-denied');
  await page.evaluate(() => {
    const denied = document.getElementById('auth-denied'); denied.style.display = 'none';
    const toast = document.createElement('div'); toast.className = 'adm-toast show'; toast.setAttribute('role', 'status');
    toast.textContent = 'La imagen se guardó correctamente y se sincronizó con todas las páginas de Tintin.';
    document.body.appendChild(toast);
  });
  await auditState(page, vp, 'admin-images', 'admin-toast', '.adm-toast', { minControl: 0 });

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const vp of viewports) await auditViewport(browser, vp);
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ report, failures }, null, 2));
if (failures.length) {
  console.error(`PARTE 2G: ${failures.length} problema(s) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}/${item.state}] ${item.message}`));
  process.exit(1);
}
console.log(`PARTE 2G: CORRECTA · ${report.length} estados visuales · sistema y estados especiales sin desbordes ni controles inaccesibles.`);
