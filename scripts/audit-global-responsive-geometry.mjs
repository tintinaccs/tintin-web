import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4174;
const baseURL = `http://${host}:${port}`;
const artifactDir = path.join(root, 'artifacts', 'global-responsive');
fs.rmSync(artifactDir, { recursive: true, force: true });
fs.mkdirSync(artifactDir, { recursive: true });

const routes = [
  ['inicio', '/index.html'],
  ['catalogo', '/catalogo.html'],
  ['colecciones', '/collections.html'],
  ['producto', '/product.html?id=__tintin_geometry_missing__'],
  ['nosotros', '/about.html'],
  ['contacto', '/contact.html'],
  ['terminos', '/terminos.html'],
  ['privacidad', '/privacidad.html'],
  ['envios', '/envios.html'],
  ['cambios', '/cambios-devoluciones.html'],
  ['faq', '/preguntas-frecuentes.html'],
  ['404', '/404.html'],
];

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
];

const mimeTypes = {
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
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function localPath(requestURL) {
  const pathname = decodeURIComponent(new URL(requestURL, baseURL).pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const absolute = path.resolve(root, `.${requested}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
  return absolute;
}

const server = http.createServer((request, response) => {
  const absolute = localPath(request.url || '/');
  if (!absolute) return response.writeHead(403).end('Forbidden');
  fs.stat(absolute, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end('Not found');
    const extension = path.extname(absolute).toLowerCase();
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': mimeTypes[extension] || 'application/octet-stream',
    });
    fs.createReadStream(absolute).pipe(response);
  });
});

const listen = () => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, resolve);
});
const closeServer = () => new Promise(resolve => server.close(resolve));

function overlaps(a, b, tolerance = 1) {
  return a.left < b.right - tolerance && a.right > b.left + tolerance &&
    a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
}

async function waitForStablePage(page) {
  await page.waitForFunction(() => {
    const visible = node => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' &&
        style.opacity !== '0' && rect.width > 0 && rect.height > 0;
    };
    const closed = document.getElementById('tt-store-closed-overlay');
    if (visible(closed)) return true;
    return !visible(document.getElementById('tt-loader'));
  }, null, { timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(450);
}

async function inspectBaseGeometry(page, width) {
  return page.evaluate(({ width }) => {
    const visible = node => {
      if (!node || node.hidden || node.closest('[hidden]')) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    const rect = node => {
      const value = node?.getBoundingClientRect();
      return value ? {
        left: value.left, right: value.right, top: value.top, bottom: value.bottom,
        width: value.width, height: value.height,
      } : null;
    };
    const issues = [];
    const root = document.documentElement;
    const body = document.body;
    const header = document.getElementById('tt-header-desktop-tablet');
    const tabbar = document.getElementById('tt-tabbar');
    const footer = document.querySelector('.tt-footer');
    const h1 = [...document.querySelectorAll('h1')].find(node => visible(node) && !node.closest('header, nav, [role="dialog"]'));
    const isMobile = width <= 768;

    if (root.scrollWidth > width + 1 || body.scrollWidth > width + 1) {
      issues.push(`desborde horizontal raíz: html=${root.scrollWidth}px body=${body.scrollWidth}px viewport=${width}px`);
    }

    const containers = [...document.querySelectorAll('.container')].filter(visible);
    containers.forEach((node, index) => {
      const r = rect(node);
      if (r.left < -1 || r.right > width + 1 || r.width > width + 1) {
        issues.push(`container ${index + 1} fuera del viewport: ${JSON.stringify(r)}`);
      }
    });

    const breadcrumb = document.querySelector('.tt-breadcrumb, [class*="breadcrumb"]');
    if (visible(breadcrumb) && breadcrumb.scrollWidth > breadcrumb.clientWidth + 1) {
      issues.push(`breadcrumb con overflow: ${breadcrumb.scrollWidth}px > ${breadcrumb.clientWidth}px`);
    }

    if (isMobile) {
      if (visible(header)) issues.push('header desktop/tablet visible en mobile');
      if (!visible(tabbar)) {
        issues.push('tabbar mobile ausente u oculta');
      } else {
        const t = rect(tabbar);
        if (Math.abs(t.left) > 1 || Math.abs(t.right - width) > 1 || Math.abs(t.bottom - innerHeight) > 1) {
          issues.push(`tabbar fuera de bordes: ${JSON.stringify(t)}`);
        }
        const items = [...tabbar.querySelectorAll('a, button')].filter(visible).map(rect);
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].left < -1 || items[i].right > width + 1) issues.push(`acción mobile ${i + 1} fuera del viewport`);
          for (let j = i + 1; j < items.length; j += 1) {
            const a = items[i]; const b = items[j];
            const collision = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
            if (collision) issues.push(`acciones mobile ${i + 1} y ${j + 1} se pisan`);
          }
        }
      }
    } else {
      if (visible(tabbar)) issues.push('tabbar mobile visible en desktop/tablet');
      if (!visible(header)) {
        issues.push('header desktop/tablet ausente u oculto');
      } else {
        const h = rect(header);
        if (Math.abs(h.left) > 1 || Math.abs(h.right - width) > 1 || Math.abs(h.top) > 1) {
          issues.push(`header fuera de bordes: ${JSON.stringify(h)}`);
        }
        const logo = document.querySelector('#tt-header-desktop-tablet .tt-logo-link');
        const nav = document.getElementById('tt-nav-desktop-tablet');
        const actions = document.querySelector('#tt-header-desktop-tablet .tt-header-actions');
        const groups = [logo, nav, actions].filter(visible).map(node => ({ name: node === logo ? 'logo' : node === nav ? 'nav' : 'acciones', rect: rect(node) }));
        for (let i = 0; i < groups.length; i += 1) {
          const g = groups[i];
          if (g.rect.left < -1 || g.rect.right > width + 1) issues.push(`${g.name} sale del header`);
          for (let j = i + 1; j < groups.length; j += 1) {
            const other = groups[j];
            const collision = g.rect.left < other.rect.right - 1 && g.rect.right > other.rect.left + 1 &&
              g.rect.top < other.rect.bottom - 1 && g.rect.bottom > other.rect.top + 1;
            if (collision) issues.push(`${g.name} y ${other.name} se pisan`);
          }
        }
        if (h1 && rect(h1).top < h.bottom + 8) {
          issues.push(`primer H1 queda bajo el header: h1.top=${Math.round(rect(h1).top)} header.bottom=${Math.round(h.bottom)}`);
        }
      }
    }

    if (visible(footer)) {
      const f = rect(footer);
      if (f.left < -1 || f.right > width + 1 || f.width > width + 1) {
        issues.push(`footer fuera del viewport: ${JSON.stringify(f)}`);
      }
    }

    const fixedVisible = [...document.querySelectorAll('body *')].filter(node => {
      if (!visible(node) || node.closest('[aria-hidden="true"]')) return false;
      const style = getComputedStyle(node);
      return style.position === 'fixed' && !node.closest('#tt-loader, #tt-store-closed-overlay');
    });

    return {
      issues,
      pathname: location.pathname,
      header: visible(header) ? rect(header) : null,
      tabbar: visible(tabbar) ? rect(tabbar) : null,
      footer: visible(footer) ? rect(footer) : null,
      h1: h1 ? rect(h1) : null,
      fixedIds: fixedVisible.map(node => node.id || node.className || node.tagName).slice(0, 30),
    };
  }, { width });
}

async function inspectOpenSurface(page, trigger, surface, label) {
  const triggerNode = page.locator(trigger).first();
  if (!(await triggerNode.count())) return [];
  if (!(await triggerNode.isVisible().catch(() => false))) return [];
  await triggerNode.click({ force: true }).catch(() => {});
  await page.waitForTimeout(180);
  const result = await page.evaluate(({ surface, label }) => {
    const node = document.querySelector(surface);
    if (!node) return [`${label}: superficie ${surface} ausente`];
    const style = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && r.width > 0 && r.height > 0;
    if (!visible) return [`${label}: superficie no se abrió`];
    const issues = [];
    if (r.left < -1 || r.right > innerWidth + 1) issues.push(`${label}: sale horizontalmente (${Math.round(r.left)}..${Math.round(r.right)} / ${innerWidth})`);
    if (r.top < -1 || r.bottom > innerHeight + 1) issues.push(`${label}: sale verticalmente (${Math.round(r.top)}..${Math.round(r.bottom)} / ${innerHeight})`);
    if (node.scrollWidth > node.clientWidth + 1) issues.push(`${label}: contenido interno desborda horizontalmente`);
    return issues;
  }, { surface, label });
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(80);
  return result;
}

async function inspectSurfaces(page, width) {
  const issues = [];
  if (width <= 768) {
    issues.push(...await inspectOpenSurface(page, '#tabbar-tienda', '#collections-sheet', 'Tienda mobile'));
    issues.push(...await inspectOpenSurface(page, '#tabbar-search', '#search-panel', 'Búsqueda mobile'));
    issues.push(...await inspectOpenSurface(page, '#tabbar-cart', '#cart-drawer', 'Carrito mobile'));
  } else {
    issues.push(...await inspectOpenSurface(page, '#btn-tienda', '#tt-tienda-dropdown-panel', 'Tienda desktop/tablet'));
    issues.push(...await inspectOpenSurface(page, '#btn-search', '#search-panel', 'Búsqueda desktop/tablet'));
    issues.push(...await inspectOpenSurface(page, '#btn-cuenta', '#account-panel', 'Cuenta desktop/tablet'));
    issues.push(...await inspectOpenSurface(page, '#btn-cart', '#cart-drawer', 'Carrito desktop/tablet'));
  }
  return issues;
}

async function inspectFooterAtBottom(page, width) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(180);
  return page.evaluate(({ width }) => {
    if (width > 768) return [];
    const footer = document.querySelector('.tt-footer');
    const tabbar = document.getElementById('tt-tabbar');
    if (!footer || !tabbar) return [];
    const visible = node => {
      const style = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && r.width > 0 && r.height > 0;
    };
    if (!visible(footer) || !visible(tabbar)) return [];
    const f = footer.getBoundingClientRect();
    const t = tabbar.getBoundingClientRect();
    const issues = [];
    if (f.bottom > t.top + 1) issues.push(`footer queda debajo de la tabbar: footer.bottom=${Math.round(f.bottom)} tabbar.top=${Math.round(t.top)}`);
    const lastFocusable = [...footer.querySelectorAll('a, button, input, select, textarea')].filter(visible).at(-1);
    if (lastFocusable && lastFocusable.getBoundingClientRect().bottom > t.top - 8) {
      issues.push('último control del footer queda tapado o demasiado pegado a la tabbar');
    }
    return issues;
  }, { width });
}

await listen();
const browser = await chromium.launch({ headless: true });
const report = [];
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      ignoreHTTPSErrors: true,
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      window.TT_DISABLE_STORE_GATE = true;
      window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false;
      try { localStorage.setItem('tt_privacy_consent_v1', 'accepted'); } catch {}
    });

    for (const [name, url] of routes) {
      const page = await context.newPage();
      const entry = { name, url, viewport, issues: [] };
      try {
        await page.goto(`${baseURL}${url}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await waitForStablePage(page);
        const base = await inspectBaseGeometry(page, viewport.width);
        entry.pathname = base.pathname;
        entry.metrics = base;
        entry.issues.push(...base.issues);
        entry.issues.push(...await inspectSurfaces(page, viewport.width));
        const footerIssues = await inspectFooterAtBottom(page, viewport.width);
        entry.issues.push(...footerIssues);

        if (entry.issues.length) {
          const stem = `${name}-${viewport.width}`;
          await page.screenshot({ path: path.join(artifactDir, `${stem}-bottom.png`), fullPage: false });
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(80);
          await page.screenshot({ path: path.join(artifactDir, `${stem}-top.png`), fullPage: false });
          failures.push(`${name} ${viewport.width}px: ${entry.issues.join(' | ')}`);
        }
        console.log(`${entry.issues.length ? 'ERROR' : 'OK'} — ${name} · ${viewport.width}×${viewport.height}${entry.issues.length ? ` · ${entry.issues.join(' | ')}` : ''}`);
      } catch (error) {
        entry.issues.push(error.message || String(error));
        failures.push(`${name} ${viewport.width}px: ${error.message || String(error)}`);
        await page.screenshot({ path: path.join(artifactDir, `${name}-${viewport.width}-exception.png`), fullPage: false }).catch(() => {});
        console.error(`ERROR — ${name} · ${viewport.width}px · ${error.message || String(error)}`);
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

fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify({ failures, report }, null, 2));
fs.writeFileSync(path.join(artifactDir, 'report.txt'), failures.length ? failures.join('\n') : 'Todas las geometrías globales pasaron.\n');
console.log(`\nResultado: ${report.length - failures.length}/${report.length} combinaciones sin problemas.`);
if (failures.length) {
  console.error(`\nFALLAS (${failures.length}):`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
