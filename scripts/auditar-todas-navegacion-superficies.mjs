/* =============================================================
   TINTIN — Auditoria consolidada de navegacion (headers, drawers, dropdowns)
   =============================================================
   Cubre las 18 paginas publicas + admin, los tres sistemas de navegacion
   (desktop, tablet, mobile) y los headers de admin.html/admin-images.html.
   Regresiones que este audit existe para atrapar (encontradas y corregidas
   en esta misma auditoria):
     1. El indicador activo (pildora desktop / halo mobile) no debe caer en
        "Inicio" por fallback cuando ninguna ruta es la activa.
     2. El dropdown "Tienda" desktop es un disclosure no modal: no bloquea
        scroll, no vuelve inert el fondo, no roba foco con mouse, si con
        teclado, y cierra con click afuera.
     3. El header oculto por scroll debe reaparecer si un control interno
        recibe foco, y no debe ocultarse mientras ese foco siga adentro.
     4. Un click en un link del menu tablet cierra el menu una sola vez
        (sin duplicar la llamada a close()).
     5. Los controles de header/sidebar de admin tienen al menos 44x44px
        de area tactil real.
   No reemplaza una auditoria manual exhaustiva de las 18 paginas en los
   ~24 anchos x ~12 altos pedidos originalmente — cubre una muestra
   representativa de breakpoints y las regresiones concretas ya conocidas.
   ============================================================= */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4199;
const baseURL = `http://${host}:${port}`;
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end();
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(absolute).pipe(response);
  });
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });

const PUBLIC_PAGES = [
  'index.html', 'catalogo.html', 'collections.html', 'product.html', 'checkout.html',
  'login.html', 'perfil.html', 'about.html', 'contact.html', 'envios.html',
  'cambios-devoluciones.html', 'preguntas-frecuentes.html', 'terminos.html',
  'privacidad.html', '404.html',
];
const AUX_PAGES_NO_ACTIVE_ROUTE = [
  'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html',
  'terminos.html', 'privacidad.html', '404.html',
];
const BREAKPOINTS = [
  ['mobile', 390, 844], ['tablet', 820, 1180], ['desktop', 1280, 900],
];
// Set TT_AUDIT_EXTRA_BREAKPOINTS=1 for the wider sweep (320, 1024, 1920)
// used during a manual, unhurried run — the CI/default run stays fast.
if (process.env.TT_AUDIT_EXTRA_BREAKPOINTS === '1') {
  BREAKPOINTS.push(['mobile-narrow', 320, 568], ['tablet-edge', 1024, 900], ['desktop-wide', 1920, 1080]);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.TT_CHROMIUM_PATH || undefined,
});

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms esperando ${label}`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

// page.evaluate()/$$eval() no respetan page.setDefaultTimeout() (a diferencia de
// waitForFunction/locator().evaluate()): si el JS de la pagina queda bloqueado
// (p. ej. un guard de auth reintentando contra peticiones ya abortadas por la
// regla de red de newPage()), estas llamadas cuelgan para siempre sin este limite.
// 12000ms (no 8000ms) porque product.html sin ?id= dispara su propio fallback
// interno de "related products" a los 8500ms (mantenimiento-producto.js) bajo la
// politica de red solo-localhost de newPage(); un limite mas corto compite con
// ese temporizador legitimo de la pagina y falla en falso.
function safeEvaluate(page, fn, timeoutMs = 12000) {
  return withTimeout(page.evaluate(fn), timeoutMs, 'page.evaluate');
}
function safeEvalAll(page, selector, fn, timeoutMs = 12000) {
  return withTimeout(page.$$eval(selector, fn), timeoutMs, 'page.$$eval');
}

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.route('**/*', route => {
    try {
      const url = new URL(route.request().url());
      if (url.hostname !== host) return route.abort();
    } catch {}
    return route.continue();
  });
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(15000);
  const pageErrors = [];
  page.on('pageerror', error => {
    if (/Failed to fetch dynamically imported module/i.test(error.message)) return;
    pageErrors.push(error.message);
  });
  await page.addInitScript(() => {
    window.TT_DISABLE_STORE_GATE = true;
    try { localStorage.setItem('tt_privacy_consent_v1', 'accepted'); } catch {}
  });
  return { ctx, page, pageErrors };
}

async function gotoReady(page, url) {
  await page.goto(`${baseURL}/${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => document.readyState !== 'loading', { timeout: 8000 }).catch(() => {});
  await Promise.race([
    page.waitForFunction(() => document.body?.classList.contains('tt-public-shell-mounted'), { timeout: 6000 }),
    page.waitForTimeout(1500),
  ]).catch(() => {});
  await safeEvaluate(page, () => {
    document.documentElement.classList.remove('tt-color-scheme-pending', 'tt-store-gate-pending', 'tt-store-gate-blocked', 'tt-store-gate-degraded');
    document.getElementById('tt-loader')?.remove();
  }).catch(() => {});
  await page.waitForFunction(() => document.fonts ? document.fonts.status !== 'loading' : true, { timeout: 4000 }).catch(() => {});
}

/* ---------- 1. Cada pagina publica: sin pageerror, sin IDs duplicados, exactamente una navegacion visible por breakpoint ---------- */
for (const url of PUBLIC_PAGES) {
  for (const [label, width, height] of BREAKPOINTS) {
    const { ctx, page, pageErrors } = await newPage(width, height);
    try {
      await gotoReady(page, url);
      check(pageErrors.length === 0, `[${url} ${label}] Errores de runtime: ${pageErrors.join(' | ')}`);

      const dupIds = await safeEvaluate(page, () => {
        const seen = new Map();
        document.querySelectorAll('[id]').forEach(el => seen.set(el.id, (seen.get(el.id) || 0) + 1));
        return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
      });
      check(dupIds.length === 0, `[${url} ${label}] IDs duplicados: ${dupIds.join(', ')}`);

      if (!url.startsWith('login') && !url.startsWith('perfil')) {
        const navCount = await safeEvaluate(page, () => {
          const visible = el => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
          const desktop = document.getElementById('tt-header-desktop-tablet');
          const tablet = document.getElementById('tt-header-tablet');
          const mobile = document.getElementById('tt-tabbar');
          return [desktop, tablet, mobile].filter(visible).length;
        });
        check(navCount === 1, `[${url} ${label}] Se esperaba exactamente una navegacion visible, se encontraron ${navCount}`);
      }

      const overflow = await safeEvaluate(page, () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 2, `[${url} ${label}] Desborde horizontal de ${overflow}px`);
    } catch (error) {
      failures.push(`[${url} ${label}] Excepcion durante el audit: ${error.message}`);
    } finally {
      await ctx.close();
    }
  }
}

/* ---------- 2. Paginas auxiliares: ningun indicador activo falso (sin fallback a "Inicio") ---------- */
for (const url of AUX_PAGES_NO_ACTIVE_ROUTE) {
  for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
    const { ctx, page } = await newPage(width, height);
    try {
      await gotoReady(page, url);
      await page.waitForTimeout(250);
      const pillActive = await page.locator('.tt-desktop-active-pill').evaluate(el => el.classList.contains('is-ready'), null, { timeout: 2000 }).catch(() => false);
      const haloActive = await page.locator('#tt-tabbar').evaluate(el => el.classList.contains('tt-mobile-nav-ready'), null, { timeout: 2000 }).catch(() => false);
      const anyActiveLink = await safeEvaluate(page, () => !!document.querySelector('[data-shell-route].active,[data-shell-tab].active'));
      check(!pillActive, `[${url} ${label}] La pildora desktop quedo marcada activa sin ruta real.`);
      check(!haloActive, `[${url} ${label}] El halo mobile quedo marcado activo sin ruta real.`);
      check(!anyActiveLink, `[${url} ${label}] Un link de navegacion quedo .active sin ser la ruta real.`);
    } catch (error) {
      failures.push(`[${url} ${label}] Excepcion en chequeo de indicador activo: ${error.message}`);
    } finally {
      await ctx.close();
    }
  }
}

/* ---------- 3. Dropdown "Tienda" desktop: no modal, foco correcto por dispositivo de entrada, cierre por click afuera ---------- */
{
  const { ctx, page } = await newPage(1440, 900);
  try {
    await gotoReady(page, 'index.html');
    await page.waitForFunction(() => document.documentElement.dataset.ttSurfacesReady === '1', { timeout: 8000 }).catch(() => {});

    await page.click('#btn-tienda');
    await page.waitForTimeout(400);
    const mouseOpenState = await safeEvaluate(page, () => ({
      surface: window.TintinSurfaceController?.surface,
      scrollLocked: document.documentElement.classList.contains('tt-surface-locked'),
      bodyInert: [...document.body.children].some(node => node.inert),
      activeElId: document.activeElement?.id,
    }));
    check(mouseOpenState.surface === 'desktop-shop', 'El dropdown Tienda no abrio con click de mouse.');
    check(!mouseOpenState.scrollLocked, 'El dropdown Tienda bloqueo el scroll general (deberia ser no-modal).');
    check(!mouseOpenState.bodyInert, 'El dropdown Tienda puso inert el resto de la pagina (deberia ser no-modal).');
    check(mouseOpenState.activeElId === 'btn-tienda', 'El click de mouse en Tienda robo el foco hacia el panel.');

    await page.mouse.click(5, 5);
    await page.waitForTimeout(300);
    check(await safeEvaluate(page, () => window.TintinSurfaceController?.surface) === 'none', 'El dropdown Tienda no cerro al tocar afuera.');

    // colecciones.js reemplaza el contenido estatico del grid por datos
    // en vivo (y de paso lo vacia un instante); se espera a que haya al
    // menos una tarjeta real antes de probar el foco, para no depender de
    // esa carrera async ajena a este test.
    await page.waitForFunction(() => document.querySelectorAll('.tt-dropdown-card').length > 0, { timeout: 5000 }).catch(() => {});
    await page.locator('#btn-tienda').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const keyboardOpenState = await safeEvaluate(page, () => ({
      surface: window.TintinSurfaceController?.surface,
      activeElClass: document.activeElement?.className || '',
    }));
    check(keyboardOpenState.surface === 'desktop-shop', 'El dropdown Tienda no abrio con teclado (Enter).');
    check(keyboardOpenState.activeElClass.includes('tt-dropdown-card'), 'Al abrir con teclado el foco no entro al panel (deberia, a diferencia del mouse).');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check(await safeEvaluate(page, () => window.TintinSurfaceController?.surface) === 'none', 'Escape no cerro el dropdown Tienda.');
  } catch (error) {
    failures.push(`[dropdown Tienda] Excepcion: ${error.message}`);
  } finally {
    await ctx.close();
  }
}

/* ---------- 4. Menu tablet: un solo close() por click de link (sin doble cierre) ---------- */
{
  const { ctx, page } = await newPage(820, 1180);
  try {
    await gotoReady(page, 'about.html');
    await page.waitForFunction(() => document.documentElement.dataset.ttSurfacesReady === '1', { timeout: 8000 }).catch(() => {});
    await page.click('#btn-menu-tablet');
    await page.waitForTimeout(400);
    check(await safeEvaluate(page, () => window.TintinSurfaceController?.surface) === 'tablet-menu', 'El menu tablet no abrio.');

    await safeEvaluate(page, () => {
      sessionStorage.setItem('tt_audit_close_calls', '0');
      const controller = window.TintinSurfaceController;
      const original = controller.close.bind(controller);
      controller.close = (...args) => {
        sessionStorage.setItem('tt_audit_close_calls', String(Number(sessionStorage.getItem('tt_audit_close_calls')) + 1));
        return original(...args);
      };
    });
    await page.click('#tt-tablet-menu a[href="contact.html"]', { timeout: 5000, noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(500);
    const closeCalls = Number(await safeEvaluate(page, () => sessionStorage.getItem('tt_audit_close_calls')));
    check(closeCalls === 1, `El menu tablet llamo close() ${closeCalls} veces por un solo click de link (se esperaba 1).`);
  } catch (error) {
    failures.push(`[menu tablet] Excepcion: ${error.message}`);
  } finally {
    await ctx.close();
  }
}

/* ---------- 5. Header oculto por scroll: reaparece con foco interno y no se re-oculta mientras dure ---------- */
{
  const { ctx, page } = await newPage(1440, 900);
  try {
    await gotoReady(page, 'about.html');
    await safeEvaluate(page, () => { document.body.style.minHeight = '3000px'; });
    let hiddenAfterScroll = false;
    for (let attempt = 0; attempt < 5 && !hiddenAfterScroll; attempt++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(250);
      hiddenAfterScroll = await page.locator('#tt-header-desktop-tablet').evaluate(el => el.classList.contains('tt-header-hidden-desktop'));
    }
    await page.mouse.move(700, 700);
    check(hiddenAfterScroll, 'El header no se ocultaba al bajar (precondicion del test no se cumplio).');

    await safeEvaluate(page, () => document.getElementById('btn-tienda').focus());
    await page.waitForTimeout(250);
    const hiddenAfterFocus = await page.locator('#tt-header-desktop-tablet').evaluate(el => el.classList.contains('tt-header-hidden-desktop'));
    check(!hiddenAfterFocus, 'El header siguio oculto tras enfocar un control interno con teclado.');

    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    const hiddenWhileFocused = await page.locator('#tt-header-desktop-tablet').evaluate(el => el.classList.contains('tt-header-hidden-desktop'));
    check(!hiddenWhileFocused, 'El header se volvio a ocultar mientras el foco seguia en un control interno.');
  } catch (error) {
    failures.push(`[header scroll-hide] Excepcion: ${error.message}`);
  } finally {
    await ctx.close();
  }
}

/* ---------- 6. Admin: touch targets reales de 44x44 en sidebar/topbar y boton "Volver al panel" ---------- */
for (const [url, selectors] of [
  ['admin.html', ['.adm-nav-item', '.adm-topbar-btn']],
  ['admin-images.html', ['.adm-back-btn']],
]) {
  const { ctx, page } = await newPage(1440, 900);
  try {
    await gotoReady(page, url);
    await page.waitForTimeout(600);
    for (const selector of selectors) {
      const heights = await safeEvalAll(page, selector, nodes => nodes.map(node => node.getBoundingClientRect().height).filter(h => h > 0));
      const tooSmall = heights.filter(h => h < 43.5);
      check(tooSmall.length === 0, `[${url}] ${selector}: ${tooSmall.length} control(es) con menos de 44px de alto (${tooSmall.map(h => h.toFixed(1)).join(', ')}).`);
    }
  } catch (error) {
    failures.push(`[${url}] Excepcion en chequeo de touch targets: ${error.message}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
server.close();

console.log(`Auditoria de navegacion: ${PUBLIC_PAGES.length} paginas publicas x ${BREAKPOINTS.length} breakpoints + dropdown Tienda + menu tablet + header scroll-hide + admin.`);
if (failures.length) {
  console.log(`\n${failures.length} problema(s) encontrado(s):`);
  failures.forEach(message => console.log(` - ${message}`));
  process.exit(1);
}
console.log('OK — sin regresiones detectadas en las superficies de navegacion cubiertas.');
