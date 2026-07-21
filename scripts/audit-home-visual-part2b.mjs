import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 4182;
const baseURL = `http://${host}:${port}`;
const output = path.join(root, 'artifacts', 'home-part2b');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const viewports = [
  { name: 'm360', width: 360, height: 800 },
  { name: 'm390', width: 390, height: 844 },
  { name: 'm430', width: 430, height: 932 },
  { name: 't768', width: 768, height: 1024 },
  { name: 't1024', width: 1024, height: 768 },
  { name: 'd1280', width: 1280, height: 900 },
  { name: 'd1440', width: 1440, height: 1000 },
  { name: 'b480', width: 480, height: 900 },
  { name: 'b481', width: 481, height: 900 },
  { name: 'b767', width: 767, height: 1000 },
  { name: 'b769', width: 769, height: 1000 },
  { name: 'b1023', width: 1023, height: 800 },
  { name: 'b1025', width: 1025, height: 800 },
];

const sections = [
  ['hero', '#hero'],
  ['trust', '.tt-trust-bar'],
  ['editorial-bolsos', '[data-tt-section="editorial_bag"]'],
  ['colecciones', '.tt-collections-section'],
  ['look', '#look-section'],
  ['editorial-relojes', '[data-tt-section="editorial_relojes"]'],
  ['productos', '.tt-products-section'],
  ['resenas', '.tt-reviews-section'],
  ['footer', '.tt-footer'],
];

const mime = {
  '.css': 'text/css; charset=utf-8', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json; charset=utf-8', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', baseURL).pathname);
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return res.writeHead(403).end('Forbidden');
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'cache-control': 'no-store', 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
});

const listen = () => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, resolve);
});
const closeServer = () => new Promise(resolve => server.close(resolve));

async function prepare(page, width) {
  await page.waitForSelector(width <= 768 ? '#tt-tabbar' : '#tt-header-desktop-tablet', { state: 'attached', timeout: 7000 }).catch(() => {});
  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    const loader = document.getElementById('tt-loader');
    if (loader) {
      loader.classList.add('tt-out');
      loader.setAttribute('aria-hidden', 'true');
      loader.style.setProperty('display', 'none', 'important');
    }
    const overlay = document.getElementById('tt-store-closed-overlay');
    if (overlay) overlay.style.setProperty('display', 'none', 'important');
    document.documentElement.classList.remove('tt-initializing', 'tt-store-gate-pending', 'tt-store-gate-blocked', 'tt-scroll-locked');
    document.documentElement.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overscroll-behavior');
    if (document.body) {
      document.body.classList.remove('tt-scroll-locked');
      ['visibility','overflow','position','top','left','right','width','touch-action'].forEach(prop => document.body.style.removeProperty(prop));
    }
  });
  await page.waitForTimeout(1200);
}

async function audit(page, width, height) {
  return page.evaluate(({ width, height, sections }) => {
    const issues = [];
    const details = [];
    const visible = node => {
      if (!node || node.hidden || node.closest('[hidden],[aria-hidden="true"]')) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && rect.width > 0 && rect.height > 0;
    };
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    if (rootWidth > width + 1) issues.push(`overflow horizontal raíz: ${rootWidth}px`);

    const found = [];
    for (const [name, selector] of sections) {
      const node = document.querySelector(selector);
      if (!visible(node)) {
        issues.push(`${name}: sección ausente u oculta`);
        continue;
      }
      const box = rect(node);
      found.push({ name, box });
      if (box.left < -1 || box.right > width + 1) issues.push(`${name}: sale horizontalmente`);
      if (box.height < 40) issues.push(`${name}: altura insuficiente (${Math.round(box.height)}px)`);
      const title = node.querySelector('h1,h2');
      if (visible(title)) {
        const titleBox = rect(title);
        if (titleBox.left < -1 || titleBox.right > width + 1 || title.scrollWidth > title.clientWidth + 1) {
          issues.push(`${name}: título desborda`);
        }
      }
      details.push({ name, top: Math.round(box.top + scrollY), height: Math.round(box.height) });
    }

    for (let i = 0; i < found.length - 1; i += 1) {
      const current = found[i];
      const next = found[i + 1];
      const gap = next.box.top - current.box.bottom;
      if (gap > 180) issues.push(`${current.name}/${next.name}: hueco excesivo de ${Math.round(gap)}px`);
      if (gap < -4) issues.push(`${current.name}/${next.name}: secciones superpuestas ${Math.round(Math.abs(gap))}px`);
    }

    const hero = document.querySelector('#hero');
    const heroContent = hero?.querySelector('.tt-hero-content');
    if (visible(hero) && visible(heroContent)) {
      const h = rect(hero), c = rect(heroContent);
      if (c.left < h.left - 1 || c.right > h.right + 1 || c.top < h.top - 1 || c.bottom > h.bottom + 1) issues.push('hero: contenido fuera del banner');
      const buttons = [...heroContent.querySelectorAll('a,button')].filter(visible);
      buttons.forEach((button, index) => {
        const b = rect(button);
        if (b.width < 44 || b.height < 44) issues.push(`hero: CTA ${index + 1} menor a 44px`);
      });
    }

    const trustItems = [...document.querySelectorAll('.tt-trust-item')].filter(visible);
    if (trustItems.length !== 4) issues.push(`trust: se esperaban 4 tarjetas y hay ${trustItems.length}`);
    if (trustItems.length) {
      const heights = trustItems.map(node => Math.round(rect(node).height));
      if (Math.max(...heights) - Math.min(...heights) > 28) issues.push(`trust: alturas desparejas ${heights.join('/')}`);
    }

    const collectionCards = [...document.querySelectorAll('.tt-collections-grid .tt-coll-card')].filter(visible);
    if (collectionCards.length < 8) issues.push(`colecciones: solo ${collectionCards.length} tarjetas visibles`);
    collectionCards.forEach((card, index) => {
      const b = rect(card);
      if (b.width < 80 || b.height < 80) issues.push(`colecciones: tarjeta ${index + 1} demasiado pequeña`);
    });

    for (const [label, selector] of [['look', '#look-grid'], ['productos', '#products-grid']]) {
      const grid = document.querySelector(selector);
      if (!visible(grid)) issues.push(`${label}: grilla ausente`);
      else if (grid.scrollWidth > grid.clientWidth + 1) issues.push(`${label}: grilla desborda`);
    }

    const reviewCards = [...document.querySelectorAll('.tt-review-card')].filter(visible);
    if (reviewCards.length !== 3) issues.push(`reseñas: se esperaban 3 tarjetas y hay ${reviewCards.length}`);

    const images = [...document.querySelectorAll('#hero img, [data-tt-section="editorial_bag"] img, .tt-collections-section img, [data-tt-section="editorial_relojes"] img')].filter(visible);
    const broken = images.filter(image => image.complete && image.naturalWidth === 0);
    if (broken.length) issues.push(`imágenes rotas visibles: ${broken.length}`);

    if (width <= 768) {
      const tabbar = document.getElementById('tt-tabbar');
      const heroActions = document.querySelector('.tt-hero-actions');
      const wa = document.querySelector('.tt-wa-float');
      if (visible(tabbar) && visible(heroActions)) {
        const t = rect(tabbar), a = rect(heroActions);
        if (a.bottom > t.top - 12 && a.top < t.bottom) issues.push('hero: CTA demasiado cerca de tabbar');
      }
      if (visible(wa) && visible(heroActions)) {
        const w = rect(wa), a = rect(heroActions);
        const overlap = a.left < w.right && a.right > w.left && a.top < w.bottom && a.bottom > w.top;
        if (overlap) issues.push('hero: CTA se pisa con WhatsApp');
      }
    }

    const tapTargets = [...document.querySelectorAll('main a, main button, #hero a, #hero button')].filter(visible);
    tapTargets.forEach((node, index) => {
      const b = rect(node);
      if ((b.width < 40 || b.height < 40) && !node.closest('.tt-coll-card')) issues.push(`control ${index + 1} menor a 40px`);
    });

    return { issues: [...new Set(issues)], details, pageHeight: document.documentElement.scrollHeight, viewport: { width, height } };
  }, { width, height, sections });
}

await listen();
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      ignoreHTTPSErrors: true,
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      window.TT_DISABLE_STORE_GATE = true;
      window.TINTIN_ENABLE_PUBLIC_ACTIVITY = false;
      try { localStorage.setItem('tt_privacy_consent_v1', 'accepted'); } catch {}
    });
    const page = await context.newPage();
    const entry = { ...viewport, issues: [], details: [] };
    try {
      await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await prepare(page, viewport.width);
      const result = await audit(page, viewport.width, viewport.height);
      entry.issues = result.issues;
      entry.details = result.details;
      entry.pageHeight = result.pageHeight;
      await page.screenshot({ path: path.join(output, `${viewport.name}-full.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `${viewport.name}-top.png`) });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(output, `${viewport.name}-bottom.png`) });
    } catch (error) {
      entry.issues.push(error.message || String(error));
    }
    report.push(entry);
    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
  await closeServer();
}

const failures = report.filter(entry => entry.issues.length);
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ failures, report }, null, 2));
fs.writeFileSync(path.join(output, 'report.txt'), failures.length
  ? failures.map(entry => `${entry.name} ${entry.width}x${entry.height}: ${entry.issues.join(' | ')}`).join('\n')
  : 'Todas las comprobaciones visuales del Inicio pasaron.\n');
report.forEach(entry => console.log(`${entry.issues.length ? 'ERROR' : 'OK'} — ${entry.name} ${entry.width}x${entry.height}${entry.issues.length ? ` — ${entry.issues.join(' | ')}` : ''}`));
console.log(`\nResultado: ${report.length - failures.length}/${report.length} pantallas correctas.`);
if (failures.length) process.exit(1);
