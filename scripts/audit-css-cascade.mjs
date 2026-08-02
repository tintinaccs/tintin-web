// TINTIN — Arnés de regresión de cascada CSS
//
// Ninguna auditoría estática de este repo ve el resultado RENDERIZADO, así que
// consolidar o reordenar hojas de estilo se hacía a ciegas. Esta herramienta
// captura los estilos computados de cada elemento de cada página en tres
// viewports y compara dos capturas.
//
//   node scripts/audit-css-cascade.mjs antes     # con el código actual
//   ... aplicás el cambio de CSS ...
//   node scripts/audit-css-cascade.mjs despues antes   # compara y reporta
//
// Cada elemento se identifica por tag + id + clases, NO por su posición entre
// hermanos: los nodos que inyecta JavaScript llegan en momentos variables y
// una clave posicional corre todos los índices, llenando el informe de
// diferencias que no son de cascada.
//
// Piso de ruido esperado: unas pocas diferencias de `visibility` en botones
// que JavaScript alterna. Diferencias de color, tipografía o geometría en
// elementos de contenido SÍ son regresiones reales.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1', port = 4195;
const baseURL = `http://${host}:${port}`;
const label = process.argv[2] || 'antes';
const compareWith = process.argv[3] || '';
const outDir = path.join(root, 'artifacts', 'css-cascade');
fs.mkdirSync(outDir, { recursive: true });

const routes = [
  ['inicio', '/index.html'], ['catalogo', '/catalogo.html'], ['colecciones', '/collections.html'],
  ['producto', '/product.html?id=__v__'], ['checkout', '/checkout.html'], ['login', '/login.html'],
  ['404', '/404.html'], ['admin', '/admin.html'], ['adminimg', '/admin-images.html'],
];
const viewports = [[390, 844], [768, 1024], [1440, 1000]];
const PROPS = ['display','position','visibility','opacity','z-index','width','height',
  'margin-top','margin-bottom','padding-top','padding-bottom','padding-left','padding-right',
  'top','right','bottom','left','color','background-color','border-top-width','border-radius',
  'font-family','font-size','font-weight','line-height','letter-spacing','text-align',
  'text-transform','flex-direction','justify-content','align-items','grid-template-columns',
  'gap','transform','box-shadow','overflow-x','overflow-y'];

const mime = { '.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.jpg':'image/jpeg','.gif':'image/gif' };
const server = http.createServer((rq, rs) => {
  const p = decodeURIComponent(new URL(rq.url || '/', baseURL).pathname);
  const abs = path.resolve(root, `.${p === '/' ? '/index.html' : p}`);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) return rs.writeHead(403).end();
  fs.stat(abs, (e, st) => { if (e || !st.isFile()) return rs.writeHead(404).end();
    rs.writeHead(200, { 'cache-control':'no-store','content-type': mime[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(abs).pipe(rs); });
});
await new Promise(r => server.listen(port, host, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const result = {};
for (const [name, route] of routes) {
  for (const [w, h] of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('pageerror', () => {});
    page.on('dialog', d => d.dismiss().catch(() => {}));
    const key = `${name}@${w}x${h}`;
    try {
      await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3500);
      await page.evaluate(() => {
        try { window.TintinLoader?.hide?.(); } catch {}
        document.getElementById('tt-loader')?.remove();
        document.getElementById('tt-intro')?.remove();
        document.querySelectorAll('.tt-wa-float,.tt-back-to-top,.tt-privacy-consent,.tt-added-toast,.tt-cart-feedback').forEach(n => n.remove());
        const s = document.createElement('style');
        s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
        document.head.appendChild(s);
      });
      await page.waitForTimeout(400);
      result[key] = await page.evaluate((PROPS) => {
        const out = {}; const dup = {};
        for (const el of document.querySelectorAll('*')) {
          const t = el.tagName;
          if (['SCRIPT','STYLE','LINK','META','HEAD','TITLE'].includes(t)) continue;
          // Clave estable: no depende de la posición entre hermanos.
          let k = t.toLowerCase() + (el.id ? `#${el.id}` : '') +
            (el.classList.length ? `.${[...el.classList].sort().join('.')}` : '');
          dup[k] = (dup[k] || 0) + 1;
          k += `~${dup[k]}`;
          const cs = getComputedStyle(el); const rec = {};
          for (const p of PROPS) rec[p] = cs.getPropertyValue(p);
          out[k] = rec;
        }
        return out;
      }, PROPS);
    } catch (e) { result[key] = { __error: String(e).slice(0, 140) }; }
    await ctx.close();
    process.stderr.write(`${key} ${result[key].__error ? 'ERROR' : Object.keys(result[key]).length + ' el'}\n`);
  }
}
await browser.close(); server.close();
fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(result));
console.log(`Capturadas ${Object.keys(result).length} combinaciones página×viewport → artifacts/css-cascade/${label}.json`);

if (compareWith) {
  const baseFile = path.join(outDir, `${compareWith}.json`);
  if (!fs.existsSync(baseFile)) {
    console.error(`No existe la captura de referencia "${compareWith}".`);
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  let diffs = 0, checked = 0, unpaired = 0;
  const byProp = {}; const rows = [];
  for (const key of Object.keys(base)) {
    const a = base[key], b = result[key];
    if (!b) { rows.push(`FALTA la combinación ${key}`); diffs++; continue; }
    if (a.__error || b.__error) { rows.push(`ERROR al capturar ${key}`); continue; }
    for (const el of Object.keys(a)) {
      const x = a[el], y = b[el];
      if (!y) { unpaired++; if (rows.length < 60) rows.push(`${key} :: sin par → ${el}`); continue; }
      for (const prop of Object.keys(x)) {
        checked++;
        if (x[prop] !== y[prop]) {
          diffs++; byProp[prop] = (byProp[prop] || 0) + 1;
          if (rows.length < 60) rows.push(`${key} :: ${el} :: ${prop}: "${x[prop]}" → "${y[prop]}"`);
        }
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'diferencias.txt'), rows.join('\n'));
  console.log(`\nComparando "${compareWith}" → "${label}"`);
  console.log(`  propiedades comparadas: ${checked}`);
  console.log(`  elementos sin par: ${unpaired}`);
  console.log(`  diferencias: ${diffs}`);
  if (diffs) {
    console.log(`  por propiedad: ${JSON.stringify(byProp)}`);
    console.log(`\n${rows.slice(0, 25).join('\n')}`);
    console.log(`\nDetalle completo en artifacts/css-cascade/diferencias.txt`);
    console.log('Recordá el piso de ruido: unas pocas diferencias de "visibility" en');
    console.log('botones son estado de JavaScript, no cascada. El resto sí hay que mirarlo.');
  } else {
    console.log('\nSin diferencias: la cascada se conservó exactamente.');
  }
}
