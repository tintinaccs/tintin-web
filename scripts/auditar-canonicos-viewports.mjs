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
  if (manifestViewports.get(key) !== viewport.id) {
    throw new Error(`El manifiesto no contiene el viewport canónico ${key} (${viewport.id}).`);
  }
}

const pages = (manifest.pages || [])
  .map(page => ({
    path: page.path,
    id: page.id,
    requiresAuth: page.requiresAuth === true,
    redirectsTo: page.metadata?.redirectsTo || ''
  }))
  .filter(page => page.path && fs.existsSync(path.join(root, page.path)));

const authShellPages = new Set(['admin.html', 'admin-images.html', 'login.html', 'perfil.html']);
const expectsPublicShell = pageInfo => !authShellPages.has(pageInfo.path) && !pageInfo.redirectsTo;

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  const absolute = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream'
    });
    fs.createReadStream(absolute).pipe(response);
  });
});

const listen = () => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, resolve);
});
const closeServer = () => new Promise(resolve => server.close(resolve));

let currentStep = 'inicio';
const WATCHDOG_MS = 480000;
const watchdogTimer = setTimeout(() => {
  console.error(`\nAUDIT COLGADO: sin progreso tras ${WATCHDOG_MS}ms. Ultimo paso: ${currentStep}`);
  process.exit(1);
}, WATCHDOG_MS);

// page.evaluate() no respeta page.setDefaultTimeout() (a diferencia de
// waitForFunction/waitForSelector, que ya tienen timeout explícito abajo): si
// el JS de la página queda bloqueado — p. ej. product.html sin ?id= disparando
// su propio fallback interno de "related products", que reintenta contra
// peticiones que este servidor local no puede responder (no expone /api/*) —
// esta llamada cuelga para siempre sin este límite, tal como ya se documentó
// y corrigió para auditar-todas-navegacion-superficies.mjs en este mismo PR.
function safeEvaluate(page, fn, arg, timeoutMs = 12000) {
  const evaluation = arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg);
  return withTimeout(evaluation, timeoutMs, 'page.evaluate');
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms esperando ${label}`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

async function waitForVisibleBodyContent(page) {
  await page.waitForFunction(() => {
    const visible = node => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && box.width > 0 && box.height > 0;
    };
    return [...(document.body?.children || [])].some(visible);
  }, null, { timeout: 3000 }).catch(() => {});
}

async function prepare(page, width, pageInfo) {
  await page.waitForSelector('body', { state: 'attached', timeout: 5000 });

  if (expectsPublicShell(pageInfo)) {
    await page.waitForFunction(() => (
      document.body?.classList.contains('tt-public-shell-mounted') ||
      document.getElementById('tt-tabbar') ||
      document.getElementById('tt-header-desktop-tablet')
    ), null, { timeout: 4000 }).catch(() => {});
  }

  await safeEvaluate(page, () => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const root = document.documentElement;
    const body = document.body;
    ['tt-initializing', 'tt-store-gate-pending', 'tt-store-gate-blocked', 'tt-scroll-locked', 'tt-color-scheme-pending']
      .forEach(name => root.classList.remove(name));
    root.style.removeProperty('overflow');
    root.style.removeProperty('overscroll-behavior');
    root.style.removeProperty('touch-action');
    if (body) {
      body.classList.remove('tt-scroll-locked');
      ['position', 'top', 'left', 'right', 'width', 'overflow', 'visibility', 'touch-action']
        .forEach(name => body.style.removeProperty(name));
    }
    document.getElementById('tt-loader')?.remove();
    const closed = document.getElementById('tt-store-closed-overlay');
    if (closed) {
      closed.hidden = true;
      closed.setAttribute('aria-hidden', 'true');
      closed.style.display = 'none';
    }
    window.scrollTo(0, 0);
  });

  if (expectsPublicShell(pageInfo)) {
    const expected = width < 768 ? '#tt-tabbar' : width <= 1024 ? '#tt-header-tablet' : '#tt-header-desktop-tablet';
    await page.waitForFunction(selector => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && box.width > 0 && box.height > 0;
    }, expected, { timeout: 4000 }).catch(() => {});
  } else {
    await waitForVisibleBodyContent(page);
  }
  await page.waitForTimeout(180);
}

async function inspect(page, width, pageInfo) {
  return safeEvaluate(page, ({ width, pageInfo, shellExpected }) => {
    const issues = [];
    const visible = node => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && box.width > 0 && box.height > 0;
    };

    const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    // Las páginas de redirección (meta refresh 0s, ej. nosotros.html → about.html)
    // pueden navegar a mitad de esta medición: no tiene sentido exigirles el
    // mismo ancho exacto que a una página real que sí se queda a la vista.
    if (!pageInfo.redirectsTo && rootWidth > width + 1) issues.push(`overflow horizontal raíz ${rootWidth}px`);

    const visibleBodyChildren = [...(document.body?.children || [])].filter(visible);
    if (!pageInfo.requiresAuth && !pageInfo.redirectsTo && !visibleBodyChildren.length) {
      issues.push('la página quedó visualmente vacía');
    }

    if (shellExpected) {
      const shellHeader = document.getElementById('tt-header-desktop-tablet');
      const shellTablet = document.getElementById('tt-header-tablet');
      const shellTabbar = document.getElementById('tt-tabbar');
      if (width < 768) {
        if (visible(shellHeader)) issues.push('header desktop visible en mobile');
        if (visible(shellTablet)) issues.push('header tablet visible en mobile');
        if (!visible(shellTabbar)) issues.push('tabbar mobile oculta');
      } else if (width <= 1024) {
        if (visible(shellHeader) || visible(shellTabbar)) issues.push('navegación ajena visible en tablet');
        if (!visible(shellTablet)) issues.push('header tablet oculto');
      } else {
        if (visible(shellTablet) || visible(shellTabbar)) issues.push('navegación ajena visible en desktop');
        if (!visible(shellHeader)) issues.push('header desktop oculto');
      }
    }

    const fixedOrSticky = [...document.querySelectorAll('body *')].filter(node => {
      if (!visible(node)) return false;
      const position = getComputedStyle(node).position;
      return position === 'fixed' || position === 'sticky';
    });

    for (const node of fixedOrSticky) {
      const box = node.getBoundingClientRect();
      if (box.left < -2 || box.right > innerWidth + 2) {
        const name = node.id ? `#${node.id}` : String(node.className || node.tagName).slice(0, 80);
        issues.push(`elemento fijo fuera horizontalmente: ${name}`);
        break;
      }
    }

    const dialogs = [...document.querySelectorAll('[role="dialog"],dialog')].filter(visible);
    for (const dialog of dialogs) {
      const box = dialog.getBoundingClientRect();
      if (box.left < -2 || box.right > innerWidth + 2 || box.top < -2 || box.bottom > innerHeight + 2) {
        issues.push(`diálogo visible fuera del viewport: ${dialog.id ? `#${dialog.id}` : dialog.tagName}`);
      }
    }

    return issues;
  }, { width, pageInfo, shellExpected: expectsPublicShell(pageInfo) });
}

function isTransientNavigationError(error) {
  return /Execution context was destroyed|Cannot find context with specified id|Target page, context or browser has been closed/i.test(error?.message || String(error));
}

// admin.html, admin-images.html y perfil.html exigen sesión: sin usuario
// autenticado (el caso siempre en este audit), Firebase Auth resuelve
// onAuthStateChanged de forma asíncrona y recién ahí redirige a login.html.
// Si esa redirección cae justo en medio de un page.evaluate(), Playwright
// pierde el contexto ("Execution context was destroyed"). page.waitForURL
// escucha eventos de navegación en vez de evaluar repetidamente, así que
// sobrevive a la navegación y nos deja esperar a que se asiente antes de
// tocar la página con prepare()/inspect().
async function settleAuthRedirect(page, pageInfo, startUrl) {
  if (!pageInfo.requiresAuth) return;
  try {
    await page.waitForURL(url => url.toString() !== startUrl, { timeout: 4000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  } catch {
    // No hubo redirección dentro de la ventana de espera: seguimos con la
    // página tal cual quedó (comportamiento previo).
  }
}

async function navigateWithRetry(page, url, width, pageInfo) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await settleAuthRedirect(page, pageInfo, page.url());
      await prepare(page, width, pageInfo);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(500);
    }
  }
  throw lastError;
}

async function inspectWithRetry(page, width, pageInfo) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const issues = await inspect(page, width, pageInfo);
      const onlyTransientBlank = issues.length === 1 && issues[0] === 'la página quedó visualmente vacía';
      if (!onlyTransientBlank || attempt >= 3) return issues;
      await page.waitForTimeout(500);
      await prepare(page, width, pageInfo);
    } catch (error) {
      lastError = error;
      if (!isTransientNavigationError(error) || attempt >= 3) break;
      await settleAuthRedirect(page, pageInfo, page.url());
      await page.waitForTimeout(400);
      await prepare(page, width, pageInfo);
    }
  }
  throw lastError;
}

await listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {})
});
const failures = [];
const report = [];

try {
  for (const viewport of canonicalViewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      ignoreHTTPSErrors: true,
      serviceWorkers: 'block',
      reducedMotion: 'reduce'
    });
    await context.addInitScript(() => {
      window.TT_DISABLE_STORE_GATE = true;
      window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false;
      try { localStorage.setItem('tt_privacy_consent_v1', 'accepted'); } catch {}
    });

    for (const pageInfo of pages) {
      currentStep = `${pageInfo.path} ${viewport.width}×${viewport.height}`;
      const page = await context.newPage();
      const entry = { page: pageInfo.path, viewport: viewport.id, width: viewport.width, height: viewport.height, issues: [] };
      try {
        await navigateWithRetry(page, `${baseURL}/${pageInfo.path}`, viewport.width, pageInfo);
        entry.issues.push(...await inspectWithRetry(page, viewport.width, pageInfo));
      } catch (error) {
        entry.issues.push(error?.message || String(error));
      }

      if (entry.issues.length) {
        failures.push(`${pageInfo.path} ${viewport.width}×${viewport.height}: ${entry.issues.join(' | ')}`);
        await page.screenshot({
          path: path.join(artifactDir, `${pageInfo.id || pageInfo.path}-${viewport.width}x${viewport.height}.png`),
          fullPage: false
        }).catch(() => {});
      }

      console.log(`${entry.issues.length ? 'ERROR' : 'OK'} — ${pageInfo.path} ${viewport.width}×${viewport.height}${entry.issues.length ? ` — ${entry.issues.join(' | ')}` : ''}`);
      report.push(entry);
      await page.close();
    }
    await context.close();
  }
} finally {
  clearTimeout(watchdogTimer);
  await browser.close();
  await closeServer();
}

fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify({ failures, report }, null, 2));
fs.writeFileSync(path.join(artifactDir, 'report.txt'), failures.length ? failures.join('\n') : 'Todas las páginas pasaron en los siete viewports canónicos.\n');

console.log(`\nResultado canónico: ${report.length - failures.length}/${report.length} combinaciones correctas.`);
if (failures.length) process.exit(1);
