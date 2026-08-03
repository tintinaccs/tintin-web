import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1', port = 4221, baseURL = `http://${host}:${port}`;
const label = process.argv[2] || 'antes';
const compare = process.argv[3] || '';
const outDir = path.join(root, 'artifacts', 'perf');
fs.mkdirSync(outDir, { recursive: true });
const LAT = 60;
const MIRROR = path.join(root, 'artifacts', 'fbmirror');

const mime = {'.css':'text/css','.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.jpg':'image/jpeg','.gif':'image/gif'};
const server = http.createServer((rq, rs) => {
  const p = decodeURIComponent(new URL(rq.url || '/', baseURL).pathname);
  const abs = path.resolve(root, `.${p === '/' ? '/index.html' : p}`);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) return rs.writeHead(403).end();
  fs.stat(abs, (e, st) => {
    if (e || !st.isFile()) return rs.writeHead(404).end();
    setTimeout(() => { rs.writeHead(200, {'cache-control':'no-store','content-type':mime[path.extname(abs).toLowerCase()]||'application/octet-stream'}); fs.createReadStream(abs).pipe(rs); }, LAT);
  });
});
await new Promise(r => server.listen(port, host, r));

const screens = [
  ['mobile', 390, 844], ['mobile-chico', 320, 568],
  ['tablet', 768, 1024], ['tablet-h', 1024, 768],
  ['desktop', 1440, 900], ['desktop-xl', 1920, 1080],
];

// Acciones reales de la interfaz. Cada una: selector a tocar y qué esperar.
const actions = [
  ['abrir carrito', '#btn-cart, #tabbar-cart', '.tt-cart-drawer.open'],
  ['abrir buscador', '#btn-search, #tabbar-search', '.tt-search-panel.open'],
  ['abrir cuenta', '#btn-cuenta, #tabbar-cuenta', '.tt-account-panel.open, #account-dropdown.open'],
  ['abrir tienda', '#btn-tienda, #tabbar-tienda', '.tt-collections-sheet.open, .tt-dropdown.open'],
];

async function run(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  await page.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith(baseURL)) return r.continue();
    const m = u.match(/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/);
    if (m && fs.existsSync(path.join(MIRROR, m[1])))
      return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(MIRROR, m[1])) });
    return r.abort();
  });
  await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3500);
  // El loader tapa la interfaz hasta que llegan los datos; se retira para
  // medir la respuesta de los controles reales.
  await page.evaluate(() => {
    try { window.TintinLoader?.hide?.(); } catch {}
    document.getElementById('tt-loader')?.remove();
    document.getElementById('tt-intro')?.remove();
    document.documentElement.classList.remove('tt-initializing');
  }).catch(() => {});
  await page.waitForTimeout(400);

  const out = {};
  for (const [name, sel, expect] of actions) {
    let ms = null;
    try {
      const el = await page.$(sel);
      if (el && await el.isVisible()) {
        const t0 = Date.now();
        await el.click({ timeout: 3000, force: true });
        await page.waitForSelector(expect, { state: 'visible', timeout: 3000 });
        ms = Date.now() - t0;
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(250);
      }
    } catch { ms = null; }
    out[name] = ms;
  }
  // Fluidez del scroll: tareas largas mientras se recorre la página.
  const scroll = await page.evaluate(async () => {
    const tasks = [];
    let obs;
    try { obs = new PerformanceObserver(l => { for (const e of l.getEntries()) tasks.push(e.duration); }); obs.observe({ type: 'longtask' }); } catch {}
    const step = Math.max(200, Math.round(innerHeight * 0.8));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));
    try { obs && obs.disconnect(); } catch {}
    return { tareas: tasks.length, bloqueoMs: Math.round(tasks.reduce((s, d) => s + Math.max(0, d - 50), 0)) };
  });
  out['scroll: tareas largas'] = scroll.tareas;
  out['scroll: bloqueo (ms)'] = scroll.bloqueoMs;
  await ctx.close();
  return out;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const result = {};
for (const [nombre, w, h] of screens) {
  result[`${nombre} ${w}x${h}`] = await run(browser, w, h);
  const r = result[`${nombre} ${w}x${h}`];
  process.stderr.write(`${nombre.padEnd(13)} ${Object.entries(r).map(([k, v]) => `${k}=${v === null ? 'NO ABRE' : v}`).join('  ')}\n`);
}
await browser.close(); server.close();
fs.writeFileSync(path.join(outDir, `int-${label}.json`), JSON.stringify(result, null, 2));

if (compare) {
  const base = JSON.parse(fs.readFileSync(path.join(outDir, `int-${compare}.json`), 'utf8'));
  for (const k of Object.keys(result)) {
    if (!base[k]) continue;
    console.log(`\n${k}`);
    for (const a of Object.keys(result[k])) {
      const x = base[k][a], y = result[k][a];
      const d = (x == null || y == null) ? '' : (y - x > 0 ? `+${y - x}` : `${y - x}`);
      console.log('  ' + a.padEnd(24) + String(x ?? 'NO ABRE').padStart(9) + ' -> ' + String(y ?? 'NO ABRE').padStart(9) + '  ' + d);
    }
  }
}
