import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'commerce-part2c');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
const official = [
  { name: 'm360', width: 360, height: 800 }, { name: 'm390', width: 390, height: 844 },
  { name: 'm430', width: 430, height: 932 }, { name: 't768', width: 768, height: 1024 },
  { name: 't1024', width: 1024, height: 768 }, { name: 'd1280', width: 1280, height: 900 },
  { name: 'd1440', width: 1440, height: 960 }
];
const boundaries = [320, 480, 481, 767, 769, 1023, 1025, 1920].map(width => ({
  name: `b${width}`, width, height: width <= 480 ? 820 : width <= 768 ? 1024 : 900
}));
const all = [...official, ...boundaries];
const failures = [];
const report = [];
let productHref = '';

function addFailure(pageName, viewportName, message, data = null) {
  failures.push({ page: pageName, viewport: viewportName, message, data });
}

async function prepare(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.documentElement.classList.remove('tt-initializing');
    document.body.hidden = false;
    document.body.style.visibility = 'visible';
    document.getElementById('tt-loader')?.classList.add('tt-out');
    document.getElementById('tt-privacy-consent')?.setAttribute('hidden', '');
  });
}

async function activateDynamicContent(page, waitMs) {
  await page.waitForTimeout(waitMs);
  await page.addStyleTag({ content: `
    .tt-card,.tt-coll-page-card,.tt-product-card,.tt-related-card{content-visibility:visible!important;contain-intrinsic-size:auto!important}
    .tt-home-motion{opacity:1!important;transform:none!important;filter:none!important}
  ` });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 520) {
    await page.evaluate(value => window.scrollTo(0, value), y);
    await page.waitForTimeout(28);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(160);
}

async function visibleGeometry(page) {
  return page.evaluate(() => {
    const viewport = window.innerWidth;
    const bad = [];
    const isInsideHorizontalScroller = element => {
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
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right > viewport + 3 || r.left < -3) {
        if (isInsideHorizontalScroller(el)) continue;
        if (style.position === 'fixed' && r.right <= viewport + 20 && r.left >= -20) continue;
        bad.push({ tag: el.tagName, id: el.id, cls: String(el.className || '').slice(0, 100), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
        if (bad.length >= 12) break;
      }
    }
    return { viewport, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, bad };
  });
}

async function columnsFor(page, selector) {
  return page.locator(selector).evaluateAll(nodes => {
    const items = nodes.filter(node => getComputedStyle(node).display !== 'none');
    if (!items.length) return 0;
    const firstY = Math.round(items[0].getBoundingClientRect().top);
    return items.slice(0, 8).filter(node => Math.abs(Math.round(node.getBoundingClientRect().top) - firstY) <= 2).length;
  }).catch(() => 0);
}

async function auditCatalog(page, vp) {
  await page.goto('http://127.0.0.1:4173/catalogo.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await prepare(page);
  await activateDynamicContent(page, 2100);

  if (!productHref) productHref = await page.locator('a[href*="product.html?id="]').first().getAttribute('href').catch(() => '') || '';

  if (vp.width <= 768) {
    const toggle = page.locator('#filter-toggle');
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await page.waitForTimeout(180);
      if (!await page.locator('#cat-sidebar').isVisible().catch(() => false)) addFailure('catalogo', vp.name, 'El panel de filtros mobile no queda visible al abrirse.');
      const box = await page.locator('#cat-sidebar').boundingBox().catch(() => null);
      if (box && (box.x < -2 || box.x + box.width > vp.width + 2)) addFailure('catalogo', vp.name, 'El panel de filtros sale del viewport.', box);
      await toggle.click().catch(() => {});
    }
  }

  const cards = page.locator('#cat-grid .tt-card:not([aria-hidden="true"])');
  const count = await cards.count();
  if (count) {
    const buttonBoxes = await cards.first().locator('.tt-card-btn').evaluateAll(nodes => nodes.map(node => ({ height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width })));
    if (buttonBoxes.some(box => box.height < 39)) addFailure('catalogo', vp.name, 'Botón de tarjeta demasiado bajo.', buttonBoxes);
    const names = await page.locator('#cat-grid .tt-card-name').evaluateAll(nodes => nodes.slice(0, 12).map(node => ({ scroll: node.scrollWidth, client: node.clientWidth })));
    if (names.some(item => item.scroll > item.client + 2)) addFailure('catalogo', vp.name, 'Un nombre de producto desborda su tarjeta.', names);
  }

  const cols = await columnsFor(page, '#cat-grid .tt-card:not([aria-hidden="true"])');
  const expected = vp.width > 1024 ? 3 : 2;
  if (cols && cols !== Math.min(expected, count)) addFailure('catalogo', vp.name, `La grilla usa ${cols} columnas; se esperaban ${Math.min(expected, count)}.`);

  const geo = await visibleGeometry(page);
  if (geo.scrollWidth > vp.width + 3 || geo.bad.length) addFailure('catalogo', vp.name, 'Hay desborde horizontal visible.', geo);
  if (official.some(item => item.name === vp.name)) await page.screenshot({ path: path.join(outDir, `${vp.name}-catalogo-full.png`), fullPage: true });
  report.push({ page: 'catalogo', viewport: vp, cards: count, columns: cols, geometry: geo });
}

async function auditCollections(page, vp) {
  await page.goto('http://127.0.0.1:4173/collections.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await prepare(page);
  await activateDynamicContent(page, 1900);
  const cards = page.locator('#colls-page-grid .tt-coll-page-card:not([aria-hidden="true"])');
  const count = await cards.count();
  const cols = await columnsFor(page, '#colls-page-grid .tt-coll-page-card:not([aria-hidden="true"])');
  const expected = vp.width <= 480 ? 1 : vp.width <= 1024 ? 2 : 3;
  if (cols && cols !== Math.min(expected, count)) addFailure('collections', vp.name, `La grilla usa ${cols} columnas; se esperaban ${Math.min(expected, count)}.`);
  const actionWidths = await page.locator('.tt-collections-actions a').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, viewport: innerWidth })));
  if (actionWidths.some(item => item.width > item.viewport - 16)) addFailure('collections', vp.name, 'Una acción excede el ancho disponible.', actionWidths);
  const geo = await visibleGeometry(page);
  if (geo.scrollWidth > vp.width + 3 || geo.bad.length) addFailure('collections', vp.name, 'Hay desborde horizontal visible.', geo);
  if (official.some(item => item.name === vp.name)) await page.screenshot({ path: path.join(outDir, `${vp.name}-collections-full.png`), fullPage: true });
  report.push({ page: 'collections', viewport: vp, cards: count, columns: cols, geometry: geo });
}

async function auditProduct(page, vp) {
  const target = productHref ? new URL(productHref, 'http://127.0.0.1:4173/').href : 'http://127.0.0.1:4173/product.html?id=1';
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await prepare(page);
  await activateDynamicContent(page, 2500);

  const loaded = await page.locator('#product-grid').isVisible().catch(() => false);
  if (loaded) {
    const gallery = await page.locator('.tt-product-gallery').boundingBox();
    const info = await page.locator('.tt-product-info-panel').boundingBox();
    if (gallery && info) {
      const sideBySide = Math.abs(gallery.y - info.y) < 12;
      if (vp.width > 768 && !sideBySide) addFailure('product', vp.name, 'Galería e información no quedan en dos columnas.', { gallery, info });
      if (vp.width <= 768 && sideBySide) addFailure('product', vp.name, 'Galería e información no se apilan en mobile.', { gallery, info });
      if (gallery.x < -2 || info.x < -2 || gallery.x + gallery.width > vp.width + 2 || info.x + info.width > vp.width + 2) addFailure('product', vp.name, 'La ficha del producto sale del viewport.', { gallery, info });
    }
    const mainBox = await page.locator('#gallery-main').boundingBox().catch(() => null);
    if (mainBox && vp.width >= 390 && (mainBox.width < 220 || mainBox.height < 220)) addFailure('product', vp.name, 'La galería principal queda demasiado pequeña.', mainBox);
    const actions = await page.locator('.tt-product-actions-panel .tt-btn').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, viewport: innerWidth })));
    if (actions.some(item => item.height < 44 || item.width > item.viewport - 12)) addFailure('product', vp.name, 'Una acción principal tiene tamaño incorrecto.', actions);
  }

  const relatedCount = await page.locator('.tt-related-grid .tt-related-card').count();
  const relatedCols = await columnsFor(page, '.tt-related-grid .tt-related-card');
  if (relatedCount >= 2) {
    const targetCols = vp.width <= 768 ? 2 : vp.width <= 1024 ? 3 : 4;
    const expected = Math.min(targetCols, relatedCount);
    if (relatedCols !== expected) addFailure('product', vp.name, `Productos relacionados usa ${relatedCols} columnas; se esperaban ${expected}.`);
  }

  const geo = await visibleGeometry(page);
  if (geo.scrollWidth > vp.width + 3 || geo.bad.length) addFailure('product', vp.name, 'Hay desborde horizontal visible.', geo);
  if (official.some(item => item.name === vp.name)) await page.screenshot({ path: path.join(outDir, `${vp.name}-product-full.png`), fullPage: true });
  report.push({ page: 'product', viewport: vp, loaded, productHref: target, relatedCount, relatedColumns: relatedCols, geometry: geo });
}

try {
  for (const vp of all) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => addFailure('runtime', vp.name, `Error JS: ${error.message}`));
    await auditCatalog(page, vp);
    await auditCollections(page, vp);
    await auditProduct(page, vp);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ productHref, report, failures }, null, 2));
if (failures.length) {
  console.error(`PARTE 2C: ${failures.length} problema(s) visual(es) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}] ${item.message}`));
  process.exit(1);
}
console.log(`PARTE 2C: CORRECTA · ${all.length} viewports · Catálogo, Colecciones y Producto sin desbordes ni solapamientos.`);
