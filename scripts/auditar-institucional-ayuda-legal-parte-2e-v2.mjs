import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'institutional-help-legal-part2e');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  { name: 'about', file: 'about.html', kind: 'about' },
  { name: 'contact', file: 'contact.html', kind: 'contact' },
  { name: 'envios', file: 'envios.html', kind: 'shipping' },
  { name: 'cambios', file: 'cambios-devoluciones.html', kind: 'info' },
  { name: 'faq', file: 'preguntas-frecuentes.html', kind: 'faq' },
  { name: 'terminos', file: 'terminos.html', kind: 'legal' },
  { name: 'privacidad', file: 'privacidad.html', kind: 'legal' },
];
const official = [
  { name: 'm360', width: 360, height: 800 }, { name: 'm390', width: 390, height: 844 },
  { name: 'm430', width: 430, height: 932 }, { name: 't768', width: 768, height: 1024 },
  { name: 't1024', width: 1024, height: 768 }, { name: 'd1280', width: 1280, height: 900 },
  { name: 'd1440', width: 1440, height: 960 },
];
const boundaries = [320, 480, 481, 767, 769, 1023, 1025, 1920].map(width => ({
  name: `b${width}`, width, height: width === 320 ? 568 : width <= 480 ? 820 : width <= 768 ? 1024 : 900,
}));
const viewports = [...official, ...boundaries];

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
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
await new Promise(resolve => server.listen(4176, '127.0.0.1', resolve));

function staticHtml(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="http://127.0.0.1:4176/">');
}

const failures = [];
const report = [];
const browser = await chromium.launch({ headless: true });
const fail = (page, viewport, state, message, data = null) => failures.push({ page, viewport, state, message, data });

async function load(page, descriptor) {
  await page.setContent(staticHtml(descriptor.file), { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#tt-privacy-consent,.tt-store-closed-overlay,.tt-mobile-nav,.tt-header{display:none!important}
    .tt-auto-reveal,.reveal,.sr,[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  ` });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(100);
}

async function mount(page, descriptor, state) {
  await page.evaluate(({ kind, state }) => {
    if (kind === 'shipping') {
      const rows = `
        <li><span>Presidente Franco / Ciudad del Este y zonas aledañas</span><span class="tt-city-price-val">Consultar precio con un vendedor</span></li>
        <li><span>Fernando de la Mora — Zona Norte</span><span class="tt-city-price-val">Gs. 25.000</span></li>
        <li><span>San Lorenzo</span><span class="tt-city-price-val">Gs. 20.000</span></li>`;
      document.getElementById('envios-delivery-cities').innerHTML = rows;
      document.getElementById('envios-encomienda-cities').innerHTML = rows;
    }
    if (kind === 'contact') {
      const success = document.getElementById('form-success');
      const fallback = document.getElementById('form-wa-fallback');
      success.style.display = state === 'success' ? 'block' : 'none';
      fallback.style.display = state === 'success' ? 'inline-flex' : 'none';
      document.getElementById('f-nombre').value = 'María Fernanda González';
      document.getElementById('f-email').value = 'maria.fernanda.gonzalez@example.com';
      document.getElementById('f-tel').value = '+595 981 123 456';
      document.getElementById('f-msg').value = 'Quisiera consultar disponibilidad, opciones de entrega y presentación para regalo.';
    }
    if (kind === 'legal') {
      const last = [...document.querySelectorAll('.tt-info-block')].at(-1);
      if (last && !last.querySelector('.part2e-long-link')) {
        const p = document.createElement('p');
        p.className = 'part2e-long-link';
        p.innerHTML = 'Canal alternativo: <a href="mailto:consultas.privacidad.y.proteccion.de.datos@tintinaccs.com">consultas.privacidad.y.proteccion.de.datos@tintinaccs.com</a>';
        last.appendChild(p);
      }
    }
  }, { kind: descriptor.kind, state });
  await page.waitForTimeout(50);
}

async function metrics(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
    const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1;
  }).map(node => {
    const rect = node.getBoundingClientRect();
    return {
      tag: node.tagName, id: node.id || '', cls: String(node.className || '').slice(0, 100),
      text: String(node.textContent || node.value || '').trim().slice(0, 100),
      left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom),
      width: Math.round(rect.width), height: Math.round(rect.height),
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
    };
  }));
}

async function geometry(page) {
  return page.evaluate(() => {
    const bad = []; const viewport = innerWidth;
    const inScroller = element => {
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 2) return true;
      }
      return false;
    };
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || rect.width < 2 || rect.height < 2) continue;
      if (rect.left < -3 || rect.right > viewport + 3) {
        if (inScroller(element)) continue;
        if (style.position === 'fixed' && rect.left >= -20 && rect.right <= viewport + 20) continue;
        bad.push({ tag: element.tagName, id: element.id, cls: String(element.className || '').slice(0, 110), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), text: String(element.textContent || '').trim().slice(0, 90) });
        if (bad.length >= 15) break;
      }
    }
    return { viewport, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, bad };
  });
}

async function audit(page, descriptor, viewport, state) {
  const geo = await geometry(page);
  if (geo.scrollWidth > viewport.width + 3 || geo.bad.length) fail(descriptor.name, viewport.name, state, 'Hay desborde horizontal visible.', geo);

  const hero = await metrics(page, '.tt-page-hero,.tt-page-hero-title,.tt-page-hero-sub');
  if (hero.length < 3 || hero.some(item => item.scrollWidth > item.clientWidth + 2 || item.left < -2 || item.right > viewport.width + 2)) fail(descriptor.name, viewport.name, state, 'El hero no está completo o queda recortado.', hero);

  const blocks = await metrics(page, '.tt-info-block,.tt-about-grid,.tt-contact-grid,.tt-trust-grid');
  const outsideBlocks = blocks.filter(item => item.left < -2 || item.right > viewport.width + 2);
  if (outsideBlocks.length) fail(descriptor.name, viewport.name, state, 'Un bloque principal sale del viewport.', outsideBlocks);

  const headings = await metrics(page, 'h1,h2,h3,.tt-faq-q');
  const clippedHeadings = headings.filter(item => item.scrollWidth > item.clientWidth + 3);
  if (clippedHeadings.length) fail(descriptor.name, viewport.name, state, 'Un título o pregunta queda cortado.', clippedHeadings);

  const controls = await metrics(page, 'input,textarea,button,.tt-btn,.tt-contact-wa-link');
  const badControls = controls.filter(item => item.left < -2 || item.right > viewport.width + 2 || item.height < 40);
  if (badControls.length) fail(descriptor.name, viewport.name, state, 'Un control queda fuera o demasiado bajo.', badControls);

  const links = await metrics(page, '.section a,.tt-info-block a,.tt-contact-info-item a,.part2e-long-link a');
  const badLinks = links.filter(item => item.left < -2 || item.right > viewport.width + 2 || item.scrollWidth > item.clientWidth + 3);
  if (badLinks.length) fail(descriptor.name, viewport.name, state, 'Un enlace largo no se adapta.', badLinks);

  if ((await metrics(page, '.tt-footer,.tt-footer-bottom')).length < 2) fail(descriptor.name, viewport.name, state, 'El footer no está visible.');

  if (descriptor.kind === 'shipping') {
    const rowData = await page.locator('.tt-city-price-list li').evaluateAll(nodes => nodes.map(node => {
      const row = node.getBoundingClientRect();
      const parts = [...node.children].map(child => { const r = child.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, text:child.textContent.trim() }; });
      return { row:{ left:row.left, right:row.right, width:row.width, height:row.height }, parts };
    }));
    if (rowData.length < 6) fail(descriptor.name, viewport.name, state, 'Las listas de ciudades no muestran filas de prueba.', rowData);
    const overlap = rowData.filter(({ row, parts }) => {
      if (parts.length < 2) return true;
      const [name, price] = parts;
      const sameLine = Math.abs(name.top - price.top) < Math.min(name.bottom - name.top, price.bottom - price.top);
      return row.left < -2 || row.right > viewport.width + 2 || (sameLine && name.right > price.left + 1);
    });
    if (overlap.length) fail(descriptor.name, viewport.name, state, 'Nombre y precio de ciudad se superponen o salen del bloque.', overlap);
  }

  if (descriptor.kind === 'about') {
    const image = await metrics(page, '.tt-about-img,.tt-about-img img');
    if (image.length < 2 || image.some(item => item.width < 120 || item.height < 160)) fail(descriptor.name, viewport.name, state, 'La imagen principal no mantiene tamaño útil.', image);
    if ((await metrics(page, '.tt-about-content .tt-btn')).length !== 2) fail(descriptor.name, viewport.name, state, 'Faltan acciones de Nosotros.');
  }

  if (descriptor.kind === 'contact') {
    const fields = await metrics(page, '.tt-form-input,.tt-form-textarea');
    if (fields.length !== 4) fail(descriptor.name, viewport.name, state, 'Faltan campos visibles del formulario.', fields);
    const columns = await metrics(page, '.tt-contact-grid > div');
    if (columns.length !== 2) fail(descriptor.name, viewport.name, state, 'La grilla de Contacto no conserva sus dos bloques.', columns);
    if (viewport.width <= 767 && columns.length === 2 && Math.abs(columns[0].top - columns[1].top) < 20) fail(descriptor.name, viewport.name, state, 'Contacto no se apila en mobile.', columns);
  }

  if (descriptor.kind === 'faq') {
    const q = await metrics(page, '.tt-faq-q'); const a = await metrics(page, '.tt-faq-a');
    if (q.length < 8 || a.length !== q.length) fail(descriptor.name, viewport.name, state, 'Preguntas y respuestas no se renderizan completas.', { q, a });
  }

  if (descriptor.kind === 'legal') {
    const legalBlocks = await metrics(page, '.tt-info-block');
    if (legalBlocks.length < 6) fail(descriptor.name, viewport.name, state, 'El documento legal quedó incompleto.', legalBlocks);
    const longLink = await metrics(page, '.part2e-long-link a');
    if (longLink.some(item => item.right > viewport.width + 2 || item.scrollWidth > item.clientWidth + 3)) fail(descriptor.name, viewport.name, state, 'El correo largo no se quiebra correctamente.', longLink);
  }

  return { geo, hero, blocks, headings, controls };
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => fail('runtime', viewport.name, 'browser', `Error JS: ${error.message}`));
    for (const descriptor of pages) {
      const states = descriptor.kind === 'contact' ? ['default', 'success'] : ['default'];
      for (const state of states) {
        await load(page, descriptor); await mount(page, descriptor, state);
        const result = await audit(page, descriptor, viewport, state);
        report.push({ page: descriptor.name, viewport, state, result });
        if (['b320','m390','t768','d1280'].includes(viewport.name) && (state === 'default' || (descriptor.name === 'contact' && viewport.name === 'm390'))) {
          await page.screenshot({ path: path.join(outDir, `${viewport.name}-${descriptor.name}-${state}.png`), fullPage: true });
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close(); server.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ report, failures }, null, 2));
if (failures.length) {
  console.error(`PARTE 2E: ${failures.length} problema(s) visual(es) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}/${item.state}] ${item.message}`));
  process.exit(1);
}
console.log(`PARTE 2E: CORRECTA · ${pages.length} páginas · ${viewports.length} viewports · institucionales, ayuda y legales sin desbordes ni contenido recortado.`);
