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

async function prepare(page) {
  await page.waitForSelector('body', { state: 'attached', timeout: 5000 });

  // Los módulos del shell son asíncronos. Esperamos su montaje o, como máximo,
  // una ventana breve antes de retirar únicamente las capas de carga de prueba.
  await Promise.race([
    page.waitForFunction(() => (
      document.body?.classList.contains('tt-public-shell-mounted') ||
      document.getElementById('tt-tabbar') ||
      document.getElementById('tt-header-desktop-tablet') ||
      document.querySelector('main,form,[role="main"],.admin-login,.login-page')
    ), null, { timeout: 2200 }).catch(() => {}),
    page.waitForTimeout(900)
  ]);

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const root = document.documentElement;
    const body = document.body;
    ['tt-initializing', 'tt-store-gate-pending', 'tt-store-gate-blocked', 'tt-scroll-locked']
      .forEach(name => root.classList.remove(name));
    root.style.removeProperty('overflow');
    root.style.removeProperty('visibility');
    if (body) {
      ['tt-initializing', 'tt-store-gate-pending', 'tt-store-gate-blocked', 'tt-scroll-locked']
        .forEach(name => body.classList.remove(name));
      ['position', 'top', 'left', 'right', 'width', 'overflow', 'visibility']
        .forEach(name => body.style.removeProperty(name));
      body.style.setProperty('visibility', 'visible', 'important');
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
  await page.waitForTimeout(260);
}

async function inspect(page, width, pageInfo) {
  return page.evaluate(({ width, pageInfo }) => {
    const issues = [];
    const visible = node => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && box.width > 0 && box.height > 0;
    };

    const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    if (rootWidth > width + 1) issues.push(`overflow horizontal raíz ${rootWidth}px`);

    const visibleBodyChildren = [...document.body.children].filter(visible);
    if (!pageInfo.requiresAuth && !pageInfo.redirectsTo && !visibleBodyChildren.length) {
      issues.push('la página quedó visualmente vacía');
    }

    const shellMounted = document.body?.classList.contains('tt-public-shell-mounted');
    const shellHeader = document.getElementById('tt-header-desktop-tablet');
    const shellTabbar = document.getElementById('tt-tabbar');
    if (shellMounted) {
      if (width <= 768) {
        if (visible(shellHeader)) issues.push('header desktop visible en mobile');
        if (!visible(shellTabbar)) issues.push('tabbar mobile oculta');
      } else {
        if (visible(shellTabbar)) issues.push('tabbar mobile visible en desktop/tablet');
        if (!visible(shellHeader)) issues.push('header desktop/tablet oculto');
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
  }, { width, pageInfo });
}

async function navigateWithRetry(page, url) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await prepare(page);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await page.waitForTimeout(500);
    }
  }
  throw lastError;
}

await listen();
const browser = await chromium.launch({ headless: true });
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
      const page = await context.newPage();
      const entry = { page: pageInfo.path, viewport: viewport.id, width: viewport.width, height: viewport.height, issues: [] };
      try {
        await navigateWithRetry(page, `${baseURL}/${pageInfo.path}`);
        entry.issues.push(...await inspect(page, viewport.width, pageInfo));
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
  await browser.close();
  await closeServer();
}

fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify({ failures, report }, null, 2));
fs.writeFileSync(path.join(artifactDir, 'report.txt'), failures.length ? failures.join('\n') : 'Todas las páginas pasaron en los siete viewports canónicos.\n');

console.log(`\nResultado canónico: ${report.length - failures.length}/${report.length} combinaciones correctas.`);
if (failures.length) process.exit(1);
