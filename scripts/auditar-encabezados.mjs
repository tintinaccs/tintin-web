import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1', port = 4231, baseURL = `http://${host}:${port}`;
const MIRROR = path.join(root, 'artifacts', 'fbmirror');
const mime = {'.css':'text/css','.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.jpg':'image/jpeg','.gif':'image/gif'};
const server = http.createServer((rq, rs) => {
  const p = decodeURIComponent(new URL(rq.url || '/', baseURL).pathname);
  const abs = path.resolve(root, `.${p === '/' ? '/index.html' : p}`);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) return rs.writeHead(403).end();
  fs.stat(abs, (e, st) => {
    if (e || !st.isFile()) return rs.writeHead(404).end();
    rs.writeHead(200, {'cache-control':'no-store','content-type':mime[path.extname(abs).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(abs).pipe(rs);
  });
});
await new Promise(r => server.listen(port, host, r));

const pantallas = [
  ['mobile-chico', 320, 568], ['mobile-360', 360, 800], ['mobile-375', 375, 812],
  ['mobile', 390, 844], ['mobile-grande', 430, 932], ['mobile-horizontal', 600, 430],
  ['tablet', 768, 1024], ['tablet-grande', 820, 1180], ['tablet-h', 1024, 768],
  ['laptop', 1280, 800], ['desktop', 1366, 768], ['desktop-grande', 1440, 900], ['desktop-xl', 1920, 1080],
];
const browser = await chromium.launch();
const hallazgos = [];

for (const [nombre, w, h] of pantallas) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  await page.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith(baseURL)) return r.continue();
    const m = u.match(/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/);
    if (m && fs.existsSync(path.join(MIRROR, m[1]))) return r.fulfill({ status:200, contentType:'text/javascript', body: fs.readFileSync(path.join(MIRROR, m[1])) });
    return r.abort();
  });
  await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(10000);

  const r = await page.evaluate(({ w }) => {
    const problemas = [];
    const vis = el => { if (!el) return false; const s = getComputedStyle(el), b = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity||1) > .01 && b.width > 0 && b.height > 0; };

    const barras = [
      ['header desktop/tablet', document.getElementById('tt-header-desktop-tablet')],
      ['header tablet', document.getElementById('tt-header-tablet')],
      ['tabbar mobile', document.getElementById('tt-tabbar')],
    ].filter(([, el]) => vis(el));
    if (barras.length === 0) problemas.push('no hay ninguna barra de navegacion visible');
    if (barras.length > 1) problemas.push('hay ' + barras.length + ' barras visibles a la vez: ' + barras.map(b => b[0]).join(' + '));

    // Area tactil: el minimo recomendado es 44x44 para que se pueda tocar bien.
    const controles = [...document.querySelectorAll('#tt-tabbar button, #tt-tabbar a, .tt-header button, .tt-header a, .tt-header-tablet button, .tt-header-tablet a, .tt-nav a, .tt-nav button')].filter(vis);
    const chicos = controles.map(el => { const b = el.getBoundingClientRect();
      return { id: el.id || el.className.toString().split(' ')[0], w: Math.round(b.width), h: Math.round(b.height) };
    }).filter(c => c.w < 44 || c.h < 44);
    if (chicos.length) problemas.push('areas tactiles menores a 44px: ' + chicos.slice(0,5).map(c => `${c.id}(${c.w}x${c.h})`).join(', '));

    // Desborde horizontal de la barra activa.
    for (const [nom, el] of barras) {
      const b = el.getBoundingClientRect();
      if (b.left < -1 || b.right > w + 1) problemas.push(`${nom} se sale del viewport (${Math.round(b.left)}..${Math.round(b.right)})`);
      if (el.scrollWidth > el.clientWidth + 1) problemas.push(`${nom} desborda su contenido`);
    }

    // Solapamiento entre controles de la misma barra.
    for (const [nom, el] of barras) {
      const hijos = [...el.querySelectorAll('button,a')].filter(vis).map(n => n.getBoundingClientRect());
      for (let i = 0; i < hijos.length; i++) for (let j = i+1; j < hijos.length; j++) {
        const a = hijos[i], c = hijos[j];
        if (a.left < c.right - 2 && a.right > c.left + 2 && a.top < c.bottom - 2 && a.bottom > c.top + 2) {
          problemas.push(`${nom}: dos controles se superponen`); i = hijos.length; break;
        }
      }
    }
    return {
      barras: barras.map(b => b[0]),
      controles: controles.length,
      problemas,
    };
  }, { w });

  hallazgos.push([nombre, w, h, r]);
  console.log(`${nombre.padEnd(13)} ${String(w).padStart(4)}px  barra: ${r.barras.join('+')||'NINGUNA'}  controles: ${r.controles}`);
  for (const p of r.problemas) console.log(`   ✗ ${p}`);
  await ctx.close();
}
await browser.close(); server.close();
const totales = hallazgos.reduce((n, [,,,r]) => n + r.problemas.length, 0);
console.log(`\nProblemas encontrados: ${totales}`);
process.exit(totales ? 1 : 0);
