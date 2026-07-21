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
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, {
    'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4179, '127.0.0.1', resolve));

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

function staticHtml(fileName) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="http://127.0.0.1:4179/">');
}

async function loadStatic(page, fileName) {
  await page.setContent(staticHtml(fileName), { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#tt-intro{display:none!important}
    .tt-auto-reveal,.reveal,.sr{opacity:1!important;transform:none!important;filter:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  ` });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(80);
}

function fail(pageName, viewport, state, message, data = null) {
  failures.push({ page: pageName, viewport: viewport.name, state, message, data });
}

async function geometry(page, selector) {
  return page.evaluate(sel => {
    const root = document.querySelector(sel);
    const viewport = { width: innerWidth, height: innerHeight };
    const rect = root?.getBoundingClientRect();
    const visibleOutside = [];
    const inScroller = element => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 2) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      if (r.width < 2 || r.height < 2 || inScroller(el)) continue;
      if (r.left < -3 || r.right > innerWidth + 3) {
        visibleOutside.push({ id: el.id, cls: String(el.className || '').slice(0, 100), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
        if (visibleOutside.length >= 10) break;
      }
    }
    const controls = root ? Array.from(root.querySelectorAll('a,button,input,select,textarea,[role="button"]'))
      .filter(el => {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1;
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id, cls: String(el.className || '').slice(0, 100), tag: el.tagName, width: Math.round(r.width), height: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) };
      }) : [];
    return {
      viewport,
      root: rect ? { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height), scrollHeight: root.scrollHeight, clientHeight: root.clientHeight, overflowY: getComputedStyle(root).overflowY } : null,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      visibleOutside,
      controls
    };
  }, selector);
}

function enforce(pageName, vp, state, metrics, { minControl = 44, allowSmall = [] } = {}) {
  if (!metrics.root) fail(pageName, vp, state, 'No se encontró el estado visual principal.');
  if (metrics.documentScrollWidth > vp.width + 3 || metrics.visibleOutside.length) {
    fail(pageName, vp, state, 'Hay contenido visible fuera del ancho disponible.', metrics);
  }
  if (metrics.root && (metrics.root.left < -2 || metrics.root.right > vp.width + 2)) {
    fail(pageName, vp, state, 'El estado principal sale del viewport.', metrics.root);
  }
  const outside = metrics.controls.filter(item => item.left < -2 || item.right > vp.width + 2);
  if (outside.length) fail(pageName, vp, state, 'Hay controles fuera del viewport.', outside);
  const short = metrics.controls.filter(item => item.height < minControl && !allowSmall.some(token => item.id === token || item.cls.includes(token)));
  if (short.length) fail(pageName, vp, state, 'Hay controles táctiles demasiado bajos.', short);
}

async function mountPrivacy(page, customize) {
  await page.evaluate(isCustom => {
    document.getElementById('tt-privacy-consent')?.remove();
    const banner = document.createElement('section');
    banner.id = 'tt-privacy-consent';
    banner.className = `tt-privacy-consent${isCustom ? ' is-customizing' : ''}`;
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookies y preferencias de privacidad');
    banner.innerHTML = `
      <div class="tt-privacy-heading"><span class="tt-privacy-icon" aria-hidden="true">🍪</span><div><div class="tt-privacy-eyebrow">Cookies y privacidad</div><h2>Tu elección, sin interrumpirte</h2></div></div>
      <p class="tt-privacy-summary">Usamos una cookie para recordar tu elección y almacenamiento esencial para la sesión y el carrito. Con tu permiso también medimos visitas y ciudad o país aproximados, sin guardar IP, GPS ni ubicación exacta.</p>
      <div class="tt-privacy-actions">
        <button type="button" class="tt-privacy-btn tt-privacy-btn-primary">Aceptar opcionales</button>
        <button type="button" class="tt-privacy-btn tt-privacy-btn-secondary">Solo necesarias</button>
        <button type="button" class="tt-privacy-link-btn" aria-expanded="${isCustom}">Personalizar</button>
      </div>
      <div class="tt-privacy-details" ${isCustom ? '' : 'hidden'}>
        <div class="tt-privacy-option"><div><strong>Esenciales</strong><span>Inicio de sesión, seguridad, carrito y tu elección.</span></div><span class="tt-privacy-required">Siempre activas</span></div>
        <label class="tt-privacy-option" for="tt-privacy-statistics"><div><strong>Estadísticas opcionales</strong><span>Sesiones, páginas vistas y ubicación aproximada.</span></div><input type="checkbox" id="tt-privacy-statistics"></label>
        <div class="tt-privacy-details-actions"><a href="privacidad.html">Política de privacidad</a><button type="button" class="tt-privacy-btn tt-privacy-btn-primary">Guardar elección</button></div>
      </div>`;
    document.body.appendChild(banner);
  }, customize);
  await page.waitForTimeout(40);
}

async function mountBlocked(page) {
  await page.evaluate(() => {
    const ov = document.createElement('div');
    ov.id = 'tt-blocked-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(30,10,18,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    ov.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:420px;width:100%;padding:32px 26px;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,.25);box-sizing:border-box">
      <div style="font-size:38px;margin-bottom:12px">🚫</div>
      <div style="font-weight:800;font-size:17px;color:#8b2642;margin-bottom:10px">No podés ingresar</div>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 22px">Lo siento, ahora no puedes ingresar. Puedes comunicarte con nuestro soporte <a href="#" style="color:#b84c72;font-weight:700;text-decoration:underline">aquí</a>.</p>
      <a href="index.html" style="display:inline-block;background:#b84c72;color:#fff!important;padding:11px 26px;border-radius:50px;font-weight:700;font-size:13px;text-decoration:none">Volver al inicio</a>
    </div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
  });
  await page.waitForTimeout(30);
}

async function mountStoreGate(page, kind) {
  await page.addStyleTag({ content: `
    #tt-store-closed-overlay{position:fixed!important;inset:0!important;z-index:2147482990!important;display:grid!important;place-items:center!important;width:100%!important;min-height:100dvh!important;padding:clamp(16px,3vw,32px)!important;box-sizing:border-box!important;overflow:auto!important;background:rgba(30,10,18,.62)!important;backdrop-filter:blur(7px)!important}
    #tt-store-closed-overlay *{box-sizing:border-box!important}
    #tt-store-closed-overlay .tt-store-gate-dialog{width:min(100%,460px)!important;max-height:calc(100dvh - clamp(32px,6vw,64px))!important;margin:auto!important;padding:clamp(28px,5vw,40px) clamp(22px,5vw,34px)!important;overflow:auto!important;border:1px solid rgba(212,106,138,.14)!important;border-radius:20px!important;background:#fff!important;color:#2f2529!important;text-align:center!important;box-shadow:0 18px 60px rgba(35,12,22,.28)!important}
    .tt-store-gate-icon{display:block;margin:0 0 16px;font-size:clamp(34px,7vw,42px);line-height:1}
    .tt-store-gate-title{margin:0 0 12px;color:#8b2642;font:800 clamp(19px,3.2vw,22px)/1.25 Montserrat;overflow-wrap:anywhere}
    .tt-store-gate-message{max-width:360px;margin:0 auto 26px;color:#555;font:400 clamp(13px,2.4vw,14px)/1.65 Montserrat}
    .tt-store-gate-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;width:100%}
    .tt-store-gate-action{display:inline-flex;align-items:center;justify-content:center;min-width:146px;min-height:46px;padding:11px 24px;border-radius:999px;font:700 13px/1.2 Montserrat;text-align:center;text-decoration:none;cursor:pointer}
    #tt-store-gate-login{border:1.5px solid #d9a9b8;background:#fff;color:#8b2642}
    #tt-store-gate-retry{border:0;background:#8b2642;color:#fff}
    @media(max-width:600px){#tt-store-closed-overlay{padding:max(16px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))!important}.tt-store-gate-dialog{width:100%!important;max-width:390px!important;max-height:calc(100dvh - 32px)!important;padding:28px 20px 24px!important;border-radius:18px!important}.tt-store-gate-actions{flex-direction:column!important}.tt-store-gate-action{width:min(100%,260px)!important;min-width:0!important}}
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
      <div class="tt-store-gate-actions">${unavailable ? '<button type="button" id="tt-store-gate-retry" class="tt-store-gate-action">Reintentar</button>' : ''}<a id="tt-store-gate-login" class="tt-store-gate-action" href="login.html">Iniciar sesión</a></div>
    </section>`;
    document.body.appendChild(overlay);
  }, kind);
  await page.waitForTimeout(30);
}

async function mountLoader(page, withDots) {
  await page.addStyleTag({ content: `
    #tt-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#FFF6FA;overflow:hidden;touch-action:none}
    #tt-loader-spin-wrap{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center}
    #tt-loader-logo{width:clamp(180px,15vw,230px);max-width:72vw;height:auto;object-fit:contain;display:block;filter:drop-shadow(0 8px 22px rgba(212,106,138,.18))}
    .tt-loader-dots{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:20px}.tt-loader-dots span{width:9px;height:9px;border-radius:50%;background:#AD3F67;opacity:.75}
    @media(max-width:600px){#tt-loader-logo{width:clamp(110px,30vw,150px)}}@media(min-width:601px) and (max-width:1120px){#tt-loader-logo{width:clamp(145px,20vw,190px)}}
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
  await page.waitForTimeout(40);
}

async function mountCatalogState(page, state) {
  await page.addStyleTag({ url: 'http://127.0.0.1:4179/css/catalog-maintenance.css?v=20260718-1' });
  await page.evaluate(current => {
    document.body.classList.add('tt-catalog-maintenance');
    const grid = document.getElementById('cat-grid');
    const top = document.querySelector('.cat-top');
    let sync = document.getElementById('tt-catalog-sync-state');
    if (!sync) { sync = document.createElement('div'); sync.id = 'tt-catalog-sync-state'; top?.insertAdjacentElement('afterend', sync); }
    const labels = { loading: 'Actualizando catálogo…', offline: 'Sin conexión · mostrando datos guardados', error: 'No se pudo actualizar · reintentaremos automáticamente' };
    sync.dataset.state = current; sync.textContent = labels[current];
    const data = {
      loading: ['Preparando catálogo', 'Estamos organizando los productos y filtros.'],
      offline: ['Sin conexión', 'No pudimos descargar productos nuevos. Revisá tu conexión y volvé a intentar.'],
      error: ['El catálogo tardó demasiado', 'Podés reintentar sin perder los filtros elegidos.']
    }[current];
    grid.innerHTML = `<div class="tt-catalog-runtime-state" data-state="${current}"><div><strong>${data[0]}</strong><span>${data[1]}</span>${current === 'error' ? '<button type="button" id="tt-catalog-retry">Reintentar</button>' : ''}</div></div>`;
  }, state);
  await page.waitForTimeout(40);
}

async function auditViewport(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });
  const page = await context.newPage();

  await loadStatic(page, '404.html');
  let metrics = await geometry(page, '.tt-404-wrap');
  enforce('404', vp, 'not-found', metrics, { allowSmall: ['tt-404-hint'] });
  report.push({ page: '404', viewport: vp.name, state: 'not-found', metrics });
  if (['mini280','mini320','mobile390','mobile-landscape','desktop1440'].includes(vp.name)) await page.screenshot({ path: path.join(outDir, `${vp.name}-404.png`), fullPage: true });

  await loadStatic(page, 'index.html');
  await mountPrivacy(page, false);
  metrics = await geometry(page, '#tt-privacy-consent');
  enforce('global', vp, 'privacy-initial', metrics, { allowSmall: ['tt-privacy-link-btn'] });
  report.push({ page: 'global', viewport: vp.name, state: 'privacy-initial', metrics });

  await mountPrivacy(page, true);
  metrics = await geometry(page, '#tt-privacy-consent');
  enforce('global', vp, 'privacy-customized', metrics, { allowSmall: ['tt-privacy-link-btn', 'tt-privacy-statistics'] });
  report.push({ page: 'global', viewport: vp.name, state: 'privacy-customized', metrics });
  if (['mini280','mini320','mobile-landscape','desktop1440'].includes(vp.name)) await page.screenshot({ path: path.join(outDir, `${vp.name}-privacy.png`), fullPage: true });

  await loadStatic(page, 'login.html');
  await mountBlocked(page);
  metrics = await geometry(page, '#tt-blocked-overlay');
  enforce('login', vp, 'blocked-account', metrics, { allowSmall: [''] });
  report.push({ page: 'login', viewport: vp.name, state: 'blocked-account', metrics });
  if (['mini280','mini320','mobile-landscape','desktop1440'].includes(vp.name)) await page.screenshot({ path: path.join(outDir, `${vp.name}-blocked.png`), fullPage: true });

  await loadStatic(page, 'index.html');
  for (const state of ['closed', 'unavailable']) {
    await mountStoreGate(page, state);
    metrics = await geometry(page, '#tt-store-closed-overlay');
    enforce('global', vp, `store-${state}`, metrics);
    report.push({ page: 'global', viewport: vp.name, state: `store-${state}`, metrics });
    if (['mini280','mini320','mobile-landscape','desktop1440'].includes(vp.name)) await page.screenshot({ path: path.join(outDir, `${vp.name}-store-${state}.png`), fullPage: true });
  }

  await loadStatic(page, 'index.html');
  await mountLoader(page, false);
  metrics = await geometry(page, '#tt-loader');
  if (!metrics.root || metrics.root.width < vp.width - 2 || metrics.root.height < vp.height - 2) fail('global', vp, 'loader-home', 'El loader no cubre el viewport completo.', metrics.root);
  if (metrics.documentScrollWidth > vp.width + 3 || metrics.visibleOutside.length) fail('global', vp, 'loader-home', 'El loader genera desborde.', metrics);
  report.push({ page: 'global', viewport: vp.name, state: 'loader-home', metrics });

  await mountLoader(page, true);
  metrics = await geometry(page, '#tt-loader');
  if (!metrics.root || metrics.root.width < vp.width - 2 || metrics.root.height < vp.height - 2) fail('global', vp, 'loader-inner', 'El loader interno no cubre el viewport completo.', metrics.root);
  report.push({ page: 'global', viewport: vp.name, state: 'loader-inner', metrics });

  await loadStatic(page, 'catalogo.html');
  for (const state of ['loading', 'offline', 'error']) {
    await mountCatalogState(page, state);
    metrics = await geometry(page, '#cat-grid');
    enforce('catalogo', vp, state, metrics, { allowSmall: state === 'error' ? [] : ['tt-catalog-sync-state'] });
    report.push({ page: 'catalogo', viewport: vp.name, state, metrics });
    if (['mini280','mini320','mobile-landscape','desktop1440'].includes(vp.name)) await page.screenshot({ path: path.join(outDir, `${vp.name}-catalog-${state}.png`), fullPage: true });
  }

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
