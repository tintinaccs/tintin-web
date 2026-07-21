import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4176;
const baseURL = `http://${host}:${port}`;
const artifacts = path.join(root, 'artifacts', 'global-responsive-final');
fs.rmSync(artifacts, { recursive: true, force: true });
fs.mkdirSync(artifacts, { recursive: true });

const routes = [
  ['inicio', '/index.html'],
  ['catalogo', '/catalogo.html'],
  ['colecciones', '/collections.html'],
  ['producto', '/product.html?id=__geometry__'],
  ['nosotros', '/about.html'],
  ['contacto', '/contact.html'],
  ['terminos', '/terminos.html'],
  ['privacidad', '/privacidad.html'],
  ['envios', '/envios.html'],
  ['cambios', '/cambios-devoluciones.html'],
  ['faq', '/preguntas-frecuentes.html'],
  ['404', '/404.html'],
];

const officialViewports = [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 900],
  [1440, 1000],
];

const boundaryViewports = [
  [480, 900],
  [481, 900],
  [767, 1000],
  [769, 1000],
  [1023, 800],
  [1025, 800],
];

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
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', baseURL).pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const absolute = path.resolve(root, `.${requested}`);
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
      'content-type': mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
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
  await page.waitForTimeout(420);
  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const loader = document.getElementById('tt-loader');
    if (loader) {
      loader.classList.add('tt-out');
      loader.setAttribute('aria-hidden', 'true');
    }
    document.documentElement.classList.remove('tt-initializing', 'tt-store-gate-pending');
    document.body?.style.removeProperty('visibility');
    document.body?.style.removeProperty('overflow');
  });
  await page.waitForTimeout(80);
}

async function inspectPage(page, width) {
  return page.evaluate(width => {
    const issues = [];
    const visible = node => {
      if (!node || node.hidden || node.closest('[hidden],[aria-hidden="true"]')) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    const rect = node => {
      const value = node.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    const overlaps = (a, b, tolerance = 1) =>
      a.left < b.right - tolerance && a.right > b.left + tolerance && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;

    const mobile = width <= 768;
    const header = document.getElementById('tt-header-desktop-tablet');
    const tabbar = document.getElementById('tt-tabbar');
    const footer = document.querySelector('.tt-footer');
    const firstHeading = [...document.querySelectorAll('h1')].find(node => visible(node) && !node.closest('header,[role="dialog"]'));

    const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    if (rootWidth > width + 1) issues.push(`overflow horizontal raíz ${rootWidth}px`);

    [...document.querySelectorAll('.container')].filter(visible).forEach((node, index) => {
      const box = rect(node);
      if (box.left < -1 || box.right > width + 1) issues.push(`container ${index + 1} fuera (${Math.round(box.left)}..${Math.round(box.right)})`);
    });

    const breadcrumb = document.querySelector('.tt-breadcrumb,[class*="breadcrumb"]');
    if (visible(breadcrumb) && breadcrumb.scrollWidth > breadcrumb.clientWidth + 1) issues.push('breadcrumb desborda');

    if (mobile) {
      if (visible(header)) issues.push('header desktop visible en mobile');
      if (!visible(tabbar)) {
        issues.push('tabbar mobile ausente');
      } else {
        const box = rect(tabbar);
        const bottomGap = innerHeight - box.bottom;
        if (box.left < -1 || box.right > width + 1) issues.push('tabbar sale horizontalmente');
        if (bottomGap < -1 || bottomGap > 40) issues.push(`tabbar con separación inferior inválida ${Math.round(bottomGap)}px`);
        const actions = [...tabbar.querySelectorAll('a,button')].filter(visible).map(rect);
        actions.forEach((action, index) => {
          if (action.left < -1 || action.right > width + 1) issues.push(`acción mobile ${index + 1} fuera`);
          actions.slice(index + 1).forEach((other, offset) => {
            if (overlaps(action, other)) issues.push(`acciones mobile ${index + 1}/${index + offset + 2} se pisan`);
          });
        });
      }
    } else {
      if (visible(tabbar)) issues.push('tabbar visible en desktop/tablet');
      if (!visible(header)) {
        issues.push('header desktop/tablet ausente');
      } else {
        const headerBox = rect(header);
        if (headerBox.left < -1 || headerBox.right > width + 1 || Math.abs(headerBox.top) > 1) issues.push('header fuera de pantalla');
        const zones = [
          ['logo', document.querySelector('#tt-header-desktop-tablet .tt-logo-link')],
          ['nav', document.getElementById('tt-nav-desktop-tablet')],
          ['acciones', document.querySelector('#tt-header-desktop-tablet .tt-header-actions')],
        ].filter(([, node]) => visible(node)).map(([name, node]) => [name, rect(node)]);
        zones.forEach(([name, box], index) => {
          if (box.left < -1 || box.right > width + 1) issues.push(`${name} sale del header`);
          zones.slice(index + 1).forEach(([otherName, otherBox]) => {
            if (overlaps(box, otherBox)) issues.push(`${name}/${otherName} se pisan`);
          });
        });
        if (firstHeading && rect(firstHeading).top < headerBox.bottom + 8) issues.push('primer H1 queda debajo del header');
      }
    }

    if (visible(footer)) {
      const box = rect(footer);
      if (box.left < -1 || box.right > width + 1) issues.push('footer sale horizontalmente');
    }

    return issues;
  }, width);
}

async function checkSurface(page, trigger, surface, label) {
  const button = page.locator(trigger).first();
  if (!(await button.count()) || !(await button.isVisible().catch(() => false))) return [];
  await button.click({ force: true }).catch(() => {});
  await page.waitForTimeout(100);
  const issues = await page.evaluate(({ surface, label }) => {
    const node = document.querySelector(surface);
    if (!node) return [`${label}: falta ${surface}`];
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && box.width > 0 && box.height > 0;
    if (!visible) return [`${label}: no abrió`];
    const result = [];
    if (box.left < -1 || box.right > innerWidth + 1) result.push(`${label}: desborde horizontal`);
    if (box.top < -1 || box.bottom > innerHeight + 1) result.push(`${label}: desborde vertical`);
    if (node.scrollWidth > node.clientWidth + 1) result.push(`${label}: contenido interno desborda`);
    return result;
  }, { surface, label });
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(40);
  return issues;
}

async function inspectSharedSurfaces(page, width) {
  if (width <= 768) {
    return [
      ...await checkSurface(page, '#tabbar-tienda', '#collections-sheet', 'Tienda mobile'),
      ...await checkSurface(page, '#tabbar-search', '#search-panel', 'Buscar mobile'),
      ...await checkSurface(page, '#tabbar-cart', '#cart-drawer', 'Carrito mobile'),
    ];
  }
  return [
    ...await checkSurface(page, '#btn-tienda', '#tt-tienda-dropdown-panel', 'Tienda desktop'),
    ...await checkSurface(page, '#btn-search', '#search-panel', 'Buscar desktop'),
    ...await checkSurface(page, '#btn-cuenta', '#account-panel', 'Cuenta desktop'),
    ...await checkSurface(page, '#btn-cart', '#cart-drawer', 'Carrito desktop'),
  ];
}

async function inspectMobileBottom(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(80);
  return page.evaluate(() => {
    const tabbar = document.getElementById('tt-tabbar');
    const footer = document.querySelector('.tt-footer');
    if (!tabbar || !footer) return [];
    const tabStyle = getComputedStyle(tabbar);
    if (tabStyle.display === 'none' || tabStyle.visibility === 'hidden') return [];
    const tabTop = tabbar.getBoundingClientRect().top;
    const candidates = [...footer.querySelectorAll('a,button,p,span,strong,small')].filter(node => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0 && (node.textContent || '').trim();
    });
    const lastContentBottom = candidates.reduce((maximum, node) => Math.max(maximum, node.getBoundingClientRect().bottom), -Infinity);
    return Number.isFinite(lastContentBottom) && lastContentBottom > tabTop - 12
      ? [`contenido final del footer demasiado cerca de tabbar (${Math.round(lastContentBottom)} > ${Math.round(tabTop - 12)})`]
      : [];
  });
}

async function inspectPrivacy(page) {
  await page.evaluate(() => {
    try { localStorage.removeItem('tt_privacy_consent_v1'); } catch {}
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await prepare(page);
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const consent = document.querySelector('.tt-privacy-consent');
    const tabbar = document.getElementById('tt-tabbar');
    if (!consent || !tabbar || consent.hidden) return [];
    const consentBox = consent.getBoundingClientRect();
    const tabBox = tabbar.getBoundingClientRect();
    return consentBox.bottom > tabBox.top - 12 ? ['aviso de privacidad demasiado cerca de tabbar'] : [];
  });
}

async function runCase(browser, width, height, routeSet, includeShared = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    window.TT_DISABLE_STORE_GATE = true;
    window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false;
    try { localStorage.setItem('tt_privacy_consent_v1', 'accepted'); } catch {}
  });

  const results = [];
  for (const [name, url] of routeSet) {
    const page = await context.newPage();
    const entry = { name, url, width, height, issues: [] };
    try {
      await page.goto(`${baseURL}${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await prepare(page);
      entry.issues.push(...await inspectPage(page, width));
      if (includeShared && name === 'inicio') entry.issues.push(...await inspectSharedSurfaces(page, width));
      if (width <= 768) entry.issues.push(...await inspectMobileBottom(page));
      if (includeShared && name === 'inicio' && width <= 768) entry.issues.push(...await inspectPrivacy(page));
      if (entry.issues.length) {
        await page.screenshot({ path: path.join(artifacts, `${name}-${width}.png`), fullPage: true }).catch(() => {});
      }
    } catch (error) {
      entry.issues.push(error.message || String(error));
    } finally {
      results.push(entry);
      await page.close();
    }
  }
  await context.close();
  return results;
}

await listen();
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const [width, height] of officialViewports) {
    report.push(...await runCase(browser, width, height, routes, true));
  }
  for (const [width, height] of boundaryViewports) {
    report.push(...await runCase(browser, width, height, [['inicio', '/index.html']], true));
  }
} finally {
  await browser.close();
  await closeServer();
}

const failures = report.filter(entry => entry.issues.length);
fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify({ failures, report }, null, 2));
fs.writeFileSync(path.join(artifacts, 'report.txt'), failures.length
  ? failures.map(entry => `${entry.name} ${entry.width}px: ${entry.issues.join(' | ')}`).join('\n')
  : 'Todas las geometrías globales pasaron.\n');

report.forEach(entry => {
  console.log(`${entry.issues.length ? 'ERROR' : 'OK'} — ${entry.name} ${entry.width}×${entry.height}${entry.issues.length ? ` — ${entry.issues.join(' | ')}` : ''}`);
});
console.log(`\nResultado: ${report.length - failures.length}/${report.length} combinaciones correctas.`);
if (failures.length) process.exit(1);
