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
  { name: 'm360', width: 360, height: 800 },
  { name: 'm390', width: 390, height: 844 },
  { name: 'm430', width: 430, height: 932 },
  { name: 't768', width: 768, height: 1024 },
  { name: 't1024', width: 1024, height: 768 },
  { name: 'd1280', width: 1280, height: 900 },
  { name: 'd1440', width: 1440, height: 960 },
];
const boundaries = [320, 480, 481, 767, 769, 1023, 1025, 1920].map(width => ({
  name: `b${width}`,
  width,
  height: width === 320 ? 568 : width <= 480 ? 820 : width <= 768 ? 1024 : 900,
}));
const viewports = [...official, ...boundaries];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, {
    'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4176, '127.0.0.1', resolve));

function staticHtml(fileName) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="http://127.0.0.1:4176/">');
}

const failures = [];
const report = [];
const browser = await chromium.launch({ headless: true });

function fail(pageName, viewportName, state, message, data = null) {
  failures.push({ page: pageName, viewport: viewportName, state, message, data });
}

async function loadPage(page, descriptor) {
  await page.setContent(staticHtml(descriptor.file), { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#tt-privacy-consent,.tt-store-closed-overlay,.tt-mobile-nav,.tt-header{display:none!important}
    .tt-auto-reveal,.reveal,.sr,[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  ` });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(120);
}

async function mountState(page, descriptor, state) {
  await page.evaluate(({ kind, state }) => {
    if (kind === 'shipping') {
      const longRows = `
        <li><span>Presidente Franco / Ciudad del Este y zonas aledañas</span><span class="tt-city-price-val">Consultar precio con un vendedor</span></li>
        <li><span>Fernando de la Mora — Zona Norte</span><span class="tt-city-price-val">Gs. 25.000</span></li>
        <li><span>San Lorenzo</span><span class="tt-city-price-val">Gs. 20.000</span></li>`;
      document.getElementById('envios-delivery-cities').innerHTML = longRows;
      document.getElementById('envios-encomienda-cities').innerHTML = longRows;
    }

    if (kind === 'contact') {
      const success = document.getElementById('form-success');
      const fallback = document.getElementById('form-wa-fallback');
      if (state === 'success') {
        success.style.display = 'block';
        fallback.style.display = 'inline-flex';
      } else {
        success.style.display = 'none';
        fallback.style.display = 'none';
      }
      const name = document.getElementById('f-nombre');
      const email = document.getElementById('f-email');
      const tel = document.getElementById('f-tel');
      const msg = document.getElementById('f-msg');
      if (name) name.value = 'María Fernanda González';
      if (email) email.value = 'maria.fernanda.gonzalez@example.com';
      if (tel) tel.value = '+595 981 123 456';
      if (msg) msg.value = 'Quisiera consultar disponibilidad, opciones de entrega y presentación para regalo.';
    }

    if (kind === 'legal') {
      const lastBlock = [...document.querySelectorAll('.tt-info-block')].at(-1);
      if (lastBlock && !lastBlock.querySelector('.part2e-long-link')) {
        const p = document.createElement('p');
        p.className = 'part2e-long-link';
        p.innerHTML = 'Canal de contacto alternativo: <a href="mailto:consultas.privacidad.y.proteccion.de.datos@tintinaccs.com">consultas.privacidad.y.proteccion.de.datos@tintinaccs.com</a>';
        lastBlock.appendChild(p);
      }
    }
  }, { kind: descriptor.kind, state });
  await page.waitForTimeout(60);
}

async function geometry(page) {
  return page.evaluate(() => {
    const viewport = innerWidth;
    const bad = [];
    const isScrollerChild = element => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 2) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.left < -3 || rect.right > viewport + 3) {
        if (isScrollerChild(element)) continue;
        if (style.position === 'fixed' && rect.left >= -20 && rect.right <= viewport + 20) continue;
        bad.push({
          tag: element.tagName,
          id: element.id,
          cls: String(element.className || '').slice(0, 110),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          text: String(element.textContent || '').trim().slice(0, 90),
        });
        if (bad.length >= 15) break;
      }
    }
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      bad,
    };
  });
}

async function visibleMetrics(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes
    .filter(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1;
    })
    .map(node => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName,
        id: node.id || '',
        cls: String(node.className || '').slice(0, 100),
        text: String(node.textContent || node.value || '').trim().slice(0, 100),
        left: Math.round(rect.left), right: Math.round(rect.right),
        top: Math.round(rect.top), bottom: Math.round(rect.bottom),
        width: Math.round(rect.width), height: Math.round(rect.height),
        scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
        scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
      };
    }));
}

async function auditCommon(page, descriptor, viewport, state) {
  const geo = await geometry(page);
  if (geo.scrollWidth > viewport.width + 3 || geo.bad.length) {
    fail(descriptor.name, viewport.name, state, 'Hay desborde horizontal visible.', geo);
  }

  const hero = await visibleMetrics(page, '.tt-page-hero,.tt-page-hero-title,.tt-page-hero-sub');
  if (hero.length < 3) fail(descriptor.name, viewport.name, state, 'El hero no está completamente visible.', hero);
  const clippedHero = hero.filter(item => item.scrollWidth > item.clientWidth + 2 || item.left < -2 || item.right > viewport.width + 2);
  if (clippedHero.length) fail(descriptor.name, viewport.name, state, 'El texto del hero queda recortado.', clippedHero);

  const contentBlocks = await visibleMetrics(page, '.tt-info-block,.tt-about-grid,.tt-contact-grid,.tt-trust-grid');
  const outsideBlocks = contentBlocks.filter(item => item.left < -2 || item.right > viewport.width + 2);
  if (outsideBlocks.length) fail(descriptor.name, viewport.name, state, 'Un bloque principal sale del viewport.', outsideBlocks);

  const headings = await visibleMetrics(page, 'h1,h2,h3,.tt-faq-q');
  const clippedHeadings = headings.filter(item => item.scrollWidth > item.clientWidth + 3);
  if (clippedHeadings.length) fail(descriptor.name, viewport.name, state, 'Un título o pregunta queda cortado.', clippedHeadings);

  const controls = await visibleMetrics(page, 'input,textarea,button,.tt-btn,.tt-contact-wa-link,.tt-footer-wa');
  const outsideControls = controls.filter(item => item.left < -2 || item.right > viewport.width + 2);
  if (outsideControls.length) fail(descriptor.name, viewport.name, state, 'Un control sale del viewport.', outsideControls);
  const shortControls = controls.filter(item => item.height < 40 && !item.cls.includes('tt-footer-wa'));
  if (shortControls.length) fail(descriptor.name, viewport.name, state, 'Hay controles principales demasiado bajos.', shortControls);

  const footer = await visibleMetrics(page, '.tt-footer,.tt-footer-bottom');
  if (footer.length < 2) fail(descriptor.name, viewport.name, state, 'El footer no está visible.', footer);

  const links = await visibleMetrics(page, 'main a,.section a,.tt-info-block a,.tt-contact-info-item a,.part2e-long-link a');
  const clippedLinks = links.filter(item => item.scrollWidth > item.clientWidth + 3 || item.left < -2 || item.right > viewport.width + 2);
  if (clippedLinks.length) fail(descriptor.name, viewport.name, state, 'Un enlace largo no se adapta.', clippedLinks);

  return { geo, hero, contentBlocks, controls, headings };
}

async function auditSpecial(page, descriptor, viewport, state) {
  if (descriptor.kind === 'shipping') {
    const rows = await visibleMetrics(page, '.tt-city-price-list li');
    if (rows.length < 6) fail(descriptor.name, viewport.name, state, 'Las listas de ciudades no muestran filas de prueba.', rows);
    const rowData = await page.locator('.tt-city-price-list li').evaluateAll(nodes => nodes.map(node => {
      const row = node.getBoundingClientRect();
      const parts = [...node.children].map(child => {
        const rect = child.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, text: child.textContent.trim() };
      });
      return { row: { left: row.left, right: row.right, width: row.width, height: row.height }, parts };
    }));
    const overlap = rowData.filter(({ row, parts }) => {
      if (parts.length < 2) return true;
      const [name, price] = parts;
      const horizontalOverlap = name.right > price.left + 1 && Math.abs(name.top - price.top) < Math.min(name.bottom - name.top, price.bottom - price.top);
      return row.left < -2 || row.right > innerWidth + 2 || horizontalOverlap;
    });
    if (overlap.length) fail(descriptor.name, viewport.name, state, 'Nombre y precio de una ciudad se superponen o salen del bloque.', overlap);
  }

  if (descriptor.kind === 'about') {
    const image = await visibleMetrics(page, '.tt-about-img,.tt-about-img img');
    if (image.length < 2 || image.some(item => item.width < 120 || item.height < 160)) {
      fail(descriptor.name, viewport.name, state, 'La imagen principal de Nosotros no mantiene un tamaño útil.', image);
    }
    const buttons = await visibleMetrics(page, '.tt-about-content .tt-btn');
    if (buttons.length !== 2) fail(descriptor.name, viewport.name, state, 'Faltan acciones de Nosotros.', buttons);
  }

  if (descriptor.kind === 'contact') {
    const fields = await visibleMetrics(page, '.tt-form-input,.tt-form-textarea');
    if (fields.length !== 4) fail(descriptor.name, viewport.name, state, 'Faltan campos visibles del formulario.', fields);
    const columns = await visibleMetrics(page, '.tt-contact-grid > div');
    if (columns.length !== 2) fail(descriptor.name, viewport.name, state, 'La grilla de Contacto no conserva sus dos bloques.', columns);
    if (viewport.width <= 767 && columns.length === 2 && Math.abs(columns[0].top - columns[1].top) < 20) {
      fail(descriptor.name, viewport.name, state, 'Las columnas de Contacto no se apilan en mobile.', columns);
    }
  }

  if (descriptor.kind === 'faq') {
    const questions = await visibleMetrics(page, '.tt-faq-q');
    const answers = await visibleMetrics(page, '.tt-faq-a');
    if (questions.length < 8 || answers.length !== questions.length) {
      fail(descriptor.name, viewport.name, state, 'Preguntas y respuestas no se renderizan completas.', { questions, answers });
    }
  }

  if (descriptor.kind === 'legal') {
    const blocks = await visibleMetrics(page, '.tt-info-block');
    if (blocks.length < 6) fail(descriptor.name, viewport.name, state, 'El documento legal quedó incompleto.', blocks);
    const longLink = await visibleMetrics(page, '.part2e-long-link a');
    if (longLink.some(item => item.right > viewport.width + 2 || item.scrollWidth > item.clientWidth + 3)) {
      fail(descriptor.name, viewport.name, state, 'El correo largo de prueba no se quiebra correctamente.', longLink);
    }
  }
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', error => fail('runtime', viewport.name, 'browser', `Error JS: ${error.message}`));

    for (const descriptor of pages) {
      const states = descriptor.kind === 'contact' ? ['default', 'success'] : ['default'];
      for (const state of states) {
        await loadPage(page, descriptor);
        await mountState(page, descriptor, state);
        const common = await auditCommon(page, descriptor, viewport, state);
        await auditSpecial(page, descriptor, viewport, state);
        report.push({ page: descriptor.name, viewport, state, common });

        const shouldCapture = ['b320', 'm390', 't768', 'd1280'].includes(viewport.name)
          && (state === 'default' || (descriptor.name === 'contact' && viewport.name === 'm390'));
        if (shouldCapture) {
          await page.screenshot({
            path: path.join(outDir, `${viewport.name}-${descriptor.name}-${state}.png`),
            fullPage: true,
          });
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ report, failures }, null, 2));
if (failures.length) {
  console.error(`PARTE 2E: ${failures.length} problema(s) visual(es) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}/${item.state}] ${item.message}`));
  process.exit(1);
}
console.log(`PARTE 2E: CORRECTA · ${pages.length} páginas · ${viewports.length} viewports · institucionales, ayuda y legales sin desbordes ni contenido recortado.`);
