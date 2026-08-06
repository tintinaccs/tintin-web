// TINTIN — Medición de rendimiento real (no estimaciones)
//
//   node scripts/auditar-perf-metrics.mjs antes
//   node scripts/auditar-perf-metrics.mjs despues antes
//
// Sirve el sitio localmente con latencia simulada por request, porque en
// localhost (0 ms de ida y vuelta) los problemas de encadenamiento de red
// desaparecen y todo parece rápido.
//
// Mide lo que la clienta percibe:
//   FCP  — cuándo aparece el primer contenido
//   LCP  — cuándo aparece el contenido principal (lo que más pesa en la
//          sensación de "ya cargó")
//   TBT  — cuánto tiempo el hilo principal estuvo bloqueado y la página no
//          respondía a toques ni clics
//   INP  — cuánto tarda en responder a una interacción real
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1', port = 4199;
const baseURL = `http://${host}:${port}`;
const label = process.argv[2] || 'antes';
const compareWith = process.argv[3] || '';
const outDir = path.join(root, 'artifacts', 'perf');
fs.mkdirSync(outDir, { recursive: true });

// Latencia por request. Un móvil en 4G real ronda 50-150 ms; 60 ms es
// conservador y deja ver el costo de encadenar descargas.
const LATENCY_MS = 60;
const RUNS = 3; // se reporta la mediana, para que un pico no ensucie el número
// Espejo local del SDK de Firebase (ver mirror-firebase-sdk.sh). Si no existe,
// los pedidos a gstatic se cortan y la medición excluye el camino de Firebase.
const MIRROR_DIR = path.join(root, 'artifacts', 'fbmirror');
const MIRROR = fs.existsSync(MIRROR_DIR) ? MIRROR_DIR : '';
// Latencia aparte para el SDK de Firebase: permite simular una conexión mala
// hacia el tercero sin tocar la del sitio propio, que es el escenario donde
// la tienda se degradaba (FB_LATENCY=2000 node scripts/auditar-perf-metrics.mjs ...).
const FB_LATENCY = Number(process.env.FB_LATENCY || LATENCY_MS);

const routes = [
  ['inicio', '/index.html'],
  ['catalogo', '/catalogo.html'],
  ['producto', '/product.html?id=__perf__'],
  ['checkout', '/checkout.html'],
  ['colecciones', '/collections.html'],
];
const viewport = { width: 390, height: 844 }; // móvil: el caso más exigente

const mime = { '.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.xml':'application/xml' };

const server = http.createServer((rq, rs) => {
  const p = decodeURIComponent(new URL(rq.url || '/', baseURL).pathname);
  const abs = path.resolve(root, `.${p === '/' ? '/index.html' : p}`);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) return rs.writeHead(403).end();
  fs.stat(abs, (e, st) => {
    if (e || !st.isFile()) return rs.writeHead(404).end();
    setTimeout(() => {
      rs.writeHead(200, { 'cache-control':'no-store', 'content-type': mime[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(abs).pipe(rs);
    }, LATENCY_MS);
  });
});
await new Promise(r => server.listen(port, host, r));

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function measure(browser, route) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  page.on('dialog', d => d.dismiss().catch(() => {}));

  // El SDK de Firebase se sirve desde un espejo local (artifacts/fbmirror,
  // poblado con scripts/mirror-firebase-sdk.sh) con la MISMA latencia
  // simulada que el resto. Sin esto no se puede medir el costo real de tener
  // Firebase en el camino crítico, que es justamente lo que se quiere
  // optimizar. El resto de los terceros se corta al instante: su latencia no
  // se puede reproducir de forma estable y solo agregaría ruido ajeno.
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(baseURL) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    const sdk = url.match(/gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/);
    if (sdk && MIRROR) {
      const file = path.join(MIRROR, sdk[1]);
      if (fs.existsSync(file)) {
        await new Promise(r => setTimeout(r, FB_LATENCY));
        return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: fs.readFileSync(file) });
      }
    }
    return route.abort();
  });

  // Registra métricas desde antes de que empiece a pintar.
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, fcp: 0, longTasks: [], cls: 0 };
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) window.__perf.lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime;
      }).observe({ type: 'paint', buffered: true });
    } catch {}
    try {
      // Tarea larga = más de 50 ms sin soltar el hilo principal. Mientras
      // dura, la página no responde a ningún toque.
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) window.__perf.longTasks.push({ start: e.startTime, dur: e.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });

  const t0 = Date.now();
  await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000); // deja que termine la carga diferida

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource');
    const p = window.__perf;
    // Tiempo total de bloqueo: lo que excede 50 ms en cada tarea larga.
    const tbt = p.longTasks.reduce((sum, t) => sum + Math.max(0, t.dur - 50), 0);
    const css = res.filter(r => r.name.includes('.css'));
    const js = res.filter(r => /\.m?js(\?|$)/.test(r.name));
    return {
      fcp: Math.round(p.fcp),
      lcp: Math.round(p.lcp),
      tbt: Math.round(tbt),
      longTaskCount: p.longTasks.length,
      longestTask: Math.round(Math.max(0, ...p.longTasks.map(t => t.dur))),
      cls: Number(p.cls.toFixed(4)),
      dcl: Math.round(nav.domContentLoadedEventEnd || 0),
      domInteractive: Math.round(nav.domInteractive || 0),
      cssCount: css.length,
      jsCount: js.length,
      cssBytes: css.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0),
      jsBytes: js.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0),
      // Última descarga de CSS: mide si algo sigue encadenado en serie.
      lastCssStart: Math.round(Math.max(0, ...css.map(r => r.startTime))),
      resourceCount: res.length,
    };
  });

  // Capacidad de reacción real: tocar el menú y medir cuánto tarda en abrir.
  let interaction = null;
  try {
    const target = await page.$('#tabbar-tienda, .tt-tabbar-btn, #tt-nav-desktop-tablet a');
    if (target) {
      const started = Date.now();
      await target.click({ timeout: 3000 });
      await page.waitForTimeout(50);
      interaction = Date.now() - started;
    }
  } catch { interaction = null; }
  m.interactionMs = interaction;
  m.wallMs = Date.now() - t0;

  await ctx.close();
  return m;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const out = {};
for (const [name, route] of routes) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, route));
  const keys = Object.keys(runs[0]).filter(k => typeof runs[0][k] === 'number');
  const agg = {};
  for (const k of keys) agg[k] = median(runs.map(r => r[k] ?? 0));
  out[name] = agg;
  process.stderr.write(`${name}: FCP ${agg.fcp}ms · LCP ${agg.lcp}ms · TBT ${agg.tbt}ms · CSS ${agg.cssCount} · JS ${agg.jsCount}\n`);
}
await browser.close(); server.close();

fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(out, null, 2));
console.log(`\nGuardado en artifacts/perf/${label}.json`);

const FIELDS = [
  ['fcp', 'Primer contenido visible (FCP)', 'ms'],
  ['lcp', 'Contenido principal visible (LCP)', 'ms'],
  ['tbt', 'Tiempo sin responder a toques (TBT)', 'ms'],
  ['longestTask', 'Tarea más larga que congela la página', 'ms'],
  ['longTaskCount', 'Cantidad de tareas que congelan', ''],
  ['cls', 'Saltos de layout (CLS)', ''],
  ['domInteractive', 'DOM interactivo', 'ms'],
  ['lastCssStart', 'Arranque de la última hoja CSS', 'ms'],
  ['cssCount', 'Hojas CSS descargadas', ''],
  ['jsCount', 'Archivos JS descargados', ''],
  ['jsBytes', 'Peso de JS', 'B'],
  ['interactionMs', 'Respuesta al tocar el menú', 'ms'],
];

if (compareWith) {
  const baseFile = path.join(outDir, `${compareWith}.json`);
  if (!fs.existsSync(baseFile)) { console.error(`No existe ${compareWith}.json`); process.exit(1); }
  const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  for (const page of Object.keys(out)) {
    if (!base[page]) continue;
    console.log(`\n═══ ${page.toUpperCase()} ═══`);
    console.log('Métrica'.padEnd(42) + 'antes'.padStart(10) + 'después'.padStart(11) + 'cambio'.padStart(12));
    for (const [key, name, unit] of FIELDS) {
      const a = base[page][key], b = out[page][key];
      if (a == null || b == null) continue;
      const delta = b - a;
      const pct = a ? Math.round((delta / a) * 100) : 0;
      const sign = delta > 0 ? '+' : '';
      const mark = delta < 0 ? ' ✓' : (delta > 0 ? ' ✗' : '  ');
      console.log(name.padEnd(42) + String(a).padStart(10) + String(b).padStart(11) +
        `${sign}${pct}%`.padStart(10) + mark);
    }
  }
}
