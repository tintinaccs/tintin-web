import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const publicSite = JSON.parse(fs.readFileSync(path.resolve('config/public-site.json'), 'utf8'));
const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || publicSite.origin || '').replace(/\/$/, '');
const catalogUrl = `${origin}/catalogo`;
const attempts = 3;
const timeoutMs = Number(process.env.TINTIN_CATALOG_BROWSER_TIMEOUT_MS || 20000);
const results = [];

function relevantBrowserProblem(message) {
  return /(?:firestore|firebase|catalog(?:_| )unavailable|permission|expected first argument to collection)/i.test(message);
}

async function inspectCatalog(browser, attempt) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const browserProblems = [];
  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error' && relevantBrowserProblem(text)) browserProblems.push(text);
  });
  page.on('pageerror', error => {
    const text = String(error?.message || error);
    if (relevantBrowserProblem(text)) browserProblems.push(text);
  });

  const started = Date.now();
  try {
    await page.goto(catalogUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForFunction(() => {
      const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
      const cards = document.querySelectorAll('#cat-grid .tt-card[data-product-id]').length;
      return products.length > 0 && cards > 0;
    }, { timeout: timeoutMs });

    const snapshot = await page.evaluate(() => ({
      products: Array.isArray(window.PRODUCTS) ? window.PRODUCTS.length : 0,
      cards: document.querySelectorAll('#cat-grid .tt-card[data-product-id]').length,
      state: document.querySelector('#tt-catalog-sync-state')?.dataset?.state || '',
      visibleError: document.querySelector('#cat-grid .tt-catalog-runtime-state[data-state="error"]')?.textContent?.trim() || ''
    }));
    return { attempt, ok: true, ms: Date.now() - started, ...snapshot, browserProblems };
  } catch (error) {
    const snapshot = await page.evaluate(() => ({
      products: Array.isArray(window.PRODUCTS) ? window.PRODUCTS.length : 0,
      cards: document.querySelectorAll('#cat-grid .tt-card[data-product-id]').length,
      state: document.querySelector('#tt-catalog-sync-state')?.dataset?.state || '',
      visibleError: document.querySelector('#cat-grid .tt-catalog-runtime-state')?.textContent?.trim() || ''
    })).catch(() => ({}));
    return {
      attempt,
      ok: false,
      ms: Date.now() - started,
      error: String(error?.message || error),
      ...snapshot,
      browserProblems
    };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await inspectCatalog(browser, attempt);
    results.push(result);
    if (result.ok) break;
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
  }
} finally {
  await browser.close();
}

const successful = results.find(result => result.ok);
const report = { checkedAt: new Date().toISOString(), origin, catalogUrl, ok: Boolean(successful), results };
fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/catalog-browser-smoke.json'), JSON.stringify(report, null, 2));

if (!successful) {
  const last = results.at(-1) || {};
  console.error(`El navegador no pudo pintar el catálogo en ${catalogUrl}. Productos: ${last.products || 0}; tarjetas: ${last.cards || 0}; estado: ${last.state || 'sin estado'}.`);
  if (last.visibleError) console.error(`Estado visible: ${last.visibleError}`);
  if (last.browserProblems?.length) console.error(`Errores relevantes: ${last.browserProblems.join(' | ')}`);
  process.exit(1);
}

console.log(`Catálogo visible en navegador: ${successful.cards} tarjetas y ${successful.products} productos (${successful.ms} ms).`);
