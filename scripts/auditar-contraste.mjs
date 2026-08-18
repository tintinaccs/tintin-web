import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1', port = 4235, baseURL = `http://${host}:${port}`;
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

const paginas = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const pantallas = [['mobile',390,844],['desktop',1440,900]];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fallos = [];

for (const pag of paginas) {
  for (const [nom, w, h] of pantallas) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('pageerror', () => {});
    await page.route('**/*', async r => {
      const u = r.request().url();
      if (u.startsWith(baseURL)) return r.continue();
      const m = u.match(/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/);
      if (m && fs.existsSync(path.join(MIRROR, m[1]))) return r.fulfill({ status:200, contentType:'text/javascript', body: fs.readFileSync(path.join(MIRROR, m[1])) });
      return r.abort();
    });
    try {
      await page.goto(`${baseURL}/${pag}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(10000);
      const r = await page.evaluate(() => {
        const lum = c => { const s = c.map(v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }); return .2126*s[0]+.7152*s[1]+.0722*s[2]; };
        const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };
        const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null;
          const p = m[1].split(',').map(x => parseFloat(x)); return { c: p.slice(0,3), a: p.length > 3 ? p[3] : 1 }; };
        // Un background-image con gradiente (shorthand `background: linear-gradient(...)`)
        // deja backgroundColor en transparente aunque pinte una superficie opaca real;
        // se promedian sus stops de color para no dar falsos positivos de contraste.
        const gradiente = img => { if (!img || img === 'none') return null;
          const stops = [...img.matchAll(/rgba?\(([^)]+)\)/g)].map(m => m[1].split(',').map(Number));
          if (!stops.length) return null;
          return [0, 1, 2].map(i => stops.reduce((s, c) => s + c[i], 0) / stops.length); };
        // Fondo real: sube por los ancestros hasta encontrar uno opaco.
        // Con background-clip:text el gradiente no es un fondo real: se recorta
        // a la forma del texto (p.ej. el ícono "G" de Google), asi que se ignora
        // y se sigue subiendo por los ancestros.
        const fondo = el => { let n = el;
          while (n) { const cs = getComputedStyle(n);
            const recortadoATexto = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
            const g = recortadoATexto ? null : gradiente(cs.backgroundImage); if (g) return g;
            const b = parse(cs.backgroundColor); if (b && b.a > .95) return b.c;
            n = n.parentElement; }
          return [255,255,255]; };
        const malos = [];
        for (const el of document.querySelectorAll('button,a,input,label,p,span,h1,h2,h3,h4,li,td,th,small,strong')) {
          const s = getComputedStyle(el), b = el.getBoundingClientRect();
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity||1) < .1) continue;
          if (b.width < 4 || b.height < 4) continue;
          const txt = (el.textContent || '').trim();
          if (!txt || el.children.length > 0 && !Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          const fg = parse(s.color); if (!fg || fg.a < .5) continue;
          const size = parseFloat(s.fontSize) || 16;
          const peso = parseInt(s.fontWeight) || 400;
          const grande = size >= 24 || (size >= 18.66 && peso >= 700);
          const min = grande ? 3 : 4.5;
          const rr = ratio(fg.c, fondo(el));
          if (rr < min) malos.push({ sel: el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+el.className.trim().split(/\s+/).slice(0,2).join('.') : ''), r: rr.toFixed(2), min, txt: txt.slice(0,28) });
        }
        const vistos = new Set();
        return malos.filter(m => { const k = m.sel + m.r; if (vistos.has(k)) return false; vistos.add(k); return true; });
      });
      if (r.length) { fallos.push({ pag, nom, r }); }
    } catch {}
    await ctx.close();
  }
}
await browser.close(); server.close();

const total = fallos.reduce((n, f) => n + f.r.length, 0);
if (!total) console.log('Contraste correcto en todas las paginas y resoluciones.');
const agrupado = {};
for (const f of fallos) for (const x of f.r) {
  const k = `${f.pag} :: ${x.sel}`;
  (agrupado[k] ||= { r: x.r, min: x.min, txt: x.txt, pantallas: [] }).pantallas.push(f.nom);
}
for (const [k, v] of Object.entries(agrupado)) console.log(`FALLA ${k}\n   ${v.r}:1 (minimo ${v.min}) "${v.txt}"  en: ${[...new Set(v.pantallas)].join(', ')}`);
console.log(`\nElementos con contraste insuficiente: ${Object.keys(agrupado).length}`);
process.exit(Object.keys(agrupado).length ? 1 : 0);
