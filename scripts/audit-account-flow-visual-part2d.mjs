import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'account-flow-part2d');
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
  res.writeHead(200, {
    'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
const official = [
  { name: 'm360', width: 360, height: 800 }, { name: 'm390', width: 390, height: 844 },
  { name: 'm430', width: 430, height: 932 }, { name: 't768', width: 768, height: 1024 },
  { name: 't1024', width: 1024, height: 768 }, { name: 'd1280', width: 1280, height: 900 },
  { name: 'd1440', width: 1440, height: 960 }
];
const boundaries = [320, 480, 481, 767, 769, 1023, 1025, 1920].map(width => ({
  name: `b${width}`, width, height: width === 320 ? 568 : width <= 480 ? 820 : width <= 768 ? 1024 : 900
}));
const all = [...official, ...boundaries];
const failures = [];
const report = [];

function addFailure(pageName, viewportName, state, message, data = null) {
  failures.push({ page: pageName, viewport: viewportName, state, message, data });
}

function staticHtml(fileName) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');
  const withoutScripts = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '');
  return withoutScripts.replace(/<head>/i, '<head><base href="http://127.0.0.1:4174/">');
}

async function loadStatic(page, fileName) {
  await page.setContent(staticHtml(fileName), { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#tt-privacy-consent,.tt-store-closed-overlay{display:none!important}
    .tt-auto-reveal,.reveal,.sr{opacity:1!important;transform:none!important;filter:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  ` });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(120);
}

async function visibleGeometry(page) {
  return page.evaluate(() => {
    const viewport = innerWidth;
    const bad = [];
    const inHorizontalScroller = element => {
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
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.left < -3 || rect.right > viewport + 3) {
        if (inHorizontalScroller(el)) continue;
        if (style.position === 'fixed' && rect.left >= -20 && rect.right <= viewport + 20) continue;
        bad.push({
          tag: el.tagName, id: el.id, cls: String(el.className || '').slice(0, 110),
          left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width)
        });
        if (bad.length >= 12) break;
      }
    }
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      bad
    };
  });
}

async function controlMetrics(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes
    .filter(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
    })
    .map(node => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.id || '', cls: String(node.className || '').slice(0, 90),
        width: Math.round(rect.width), height: Math.round(rect.height),
        left: Math.round(rect.left), right: Math.round(rect.right),
        scrollWidth: node.scrollWidth, clientWidth: node.clientWidth
      };
    }));
}

async function mountCheckoutState(page, step) {
  await page.evaluate(activeStep => {
    document.querySelectorAll('.ck-panel').forEach((panel, index) => panel.classList.toggle('active', index === activeStep));
    document.querySelectorAll('.ck-step').forEach((item, index) => {
      item.classList.toggle('active', index === activeStep);
      item.classList.toggle('done', index < activeStep);
    });

    document.getElementById('ck-items').innerHTML = `
      <div class="ck-item">
        <div class="ck-item-img-placeholder" aria-hidden="true">⌚</div>
        <div class="ck-item-info">
          <div class="ck-item-name">Reloj vintage delicado con brazalete ajustable</div>
          <div class="ck-item-cat">Relojes · Dorado</div>
          <div class="ck-item-price">Gs. 160.000</div>
        </div>
        <div class="ck-item-controls">
          <button type="button" class="ck-qty-btn" aria-label="Disminuir">−</button>
          <span class="ck-qty-num">1</span>
          <button type="button" class="ck-qty-btn" aria-label="Aumentar">+</button>
          <button type="button" class="ck-remove-btn" aria-label="Eliminar">×</button>
        </div>
      </div>
      <div class="ck-item">
        <div class="ck-item-img-placeholder" aria-hidden="true">✨</div>
        <div class="ck-item-info">
          <div class="ck-item-name">Set de accesorios de edición limitada</div>
          <div class="ck-item-cat">Accesorios</div>
          <div class="ck-item-price">Gs. 80.000</div>
        </div>
        <div class="ck-item-controls">
          <button type="button" class="ck-qty-btn" aria-label="Disminuir">−</button>
          <span class="ck-qty-num">2</span>
          <button type="button" class="ck-qty-btn" aria-label="Aumentar">+</button>
          <button type="button" class="ck-remove-btn" aria-label="Eliminar">×</button>
        </div>
      </div>`;
    document.getElementById('ck-subtotal-val').textContent = 'Gs. 320.000';

    const deliveryGroup = document.getElementById('ck-city-delivery-group');
    if (deliveryGroup && !deliveryGroup.children.length) {
      deliveryGroup.innerHTML = '<option value="San Lorenzo">San Lorenzo</option><option value="Fernando de la Mora">Fernando de la Mora</option>';
    }
    const city = document.getElementById('ck-city');
    if (city) city.value = 'San Lorenzo';
    document.getElementById('ck-ship-info')?.classList.add('show');
    const method = document.getElementById('ck-ship-method');
    const cost = document.getElementById('ck-ship-cost');
    if (method) method.textContent = 'Delivery a domicilio · Zona Central';
    if (cost) cost.textContent = 'Costo de envío: Gs. 25.000';
    document.getElementById('ck-ship-reminder')?.classList.add('show');
    const reminder = document.getElementById('ck-ship-reminder-text');
    if (reminder) reminder.innerHTML = '<strong>Coordinación de entrega</strong>Los pedidos confirmados se coordinan dentro del horario de atención.';
    for (const id of ['ck-address-field', 'ck-referencia-field']) {
      const field = document.getElementById(id); if (field) field.style.display = 'flex';
    }
    document.getElementById('ck-map-wrap')?.classList.add('show');
    const map = document.getElementById('ck-map');
    if (map) {
      map.innerHTML = '<div style="height:100%;display:grid;place-items:center;background:#f7edf1;color:#AD3F67;font-weight:700;text-align:center;padding:20px">Vista previa del mapa de ubicación</div>';
    }
    const coords = document.getElementById('ck-map-coords');
    if (coords) { coords.classList.remove('ck-map-coords-missing'); coords.textContent = 'Ubicación marcada: -25.34, -57.52'; }
    const locationName = document.getElementById('ck-location-name');
    if (locationName) locationName.value = 'Mi casa';

    const country = document.getElementById('ck-phone-country');
    if (country) {
      country.innerHTML = '<option value="PY">🇵🇾 Paraguay +595</option>';
      country.value = 'PY';
    }
    const phone = document.getElementById('ck-phone-number'); if (phone) phone.value = '0981 123 456';
    const name = document.getElementById('ck-name'); if (name) name.value = 'María Fernanda González';
    const email = document.getElementById('ck-email'); if (email) email.value = 'maria.fernanda@example.com';

    const transfer = document.getElementById('pay-transferencia');
    if (transfer) transfer.checked = true;
    document.getElementById('bank-details')?.classList.add('show');
    const bankLines = document.getElementById('bank-details-lines');
    if (bankLines) bankLines.innerHTML = '<div class="ck-bank-line"><strong>Banco:</strong> Cuenta verificada de Tintin</div><div class="ck-bank-line"><strong>Titular:</strong> Tintin Accesorios</div>';

    const summary = document.getElementById('ck-confirm-summary');
    if (summary) summary.innerHTML = `
      <div class="ck-summary-row"><span class="ck-summary-label">Entrega</span><span class="ck-summary-val">Delivery a domicilio</span></div>
      <div class="ck-summary-row"><span class="ck-summary-label">Dirección</span><span class="ck-summary-val">San Lorenzo, Paraguay</span></div>
      <div class="ck-summary-items">
        <div class="ck-summary-item"><span class="ck-summary-item-name">1× Reloj vintage delicado</span><span>Gs. 160.000</span></div>
        <div class="ck-summary-item"><span class="ck-summary-item-name">2× Set de accesorios</span><span>Gs. 160.000</span></div>
      </div>
      <div class="ck-summary-total"><span>Total</span><span class="ck-summary-total-val">Gs. 345.000</span></div>`;
  }, step);
  await page.waitForTimeout(50);
}

async function auditCheckout(page, vp) {
  await loadStatic(page, 'checkout.html');
  const states = ['carrito', 'envio', 'datos', 'pago', 'confirmacion'];
  for (let step = 0; step < states.length; step += 1) {
    await mountCheckoutState(page, step);
    const state = states[step];
    const geo = await visibleGeometry(page);
    if (geo.scrollWidth > vp.width + 3 || geo.bad.length) addFailure('checkout', vp.name, state, 'Hay desborde horizontal visible.', geo);

    const panelBox = await page.locator('.ck-panel.active').boundingBox().catch(() => null);
    if (!panelBox || panelBox.x < -2 || panelBox.x + panelBox.width > vp.width + 2) {
      addFailure('checkout', vp.name, state, 'El panel activo sale del viewport.', panelBox);
    }

    const controls = await controlMetrics(page, '.ck-panel.active button,.ck-panel.active input,.ck-panel.active select,.ck-panel.active textarea,.ck-header-back');
    const tooShort = controls.filter(item => item.height < 40 && !item.cls.includes('ck-remove-btn') && !item.cls.includes('ck-qty-btn'));
    if (tooShort.length) addFailure('checkout', vp.name, state, 'Hay controles principales demasiado bajos.', tooShort);
    const outside = controls.filter(item => item.left < -2 || item.right > vp.width + 2);
    if (outside.length) addFailure('checkout', vp.name, state, 'Un control sale del viewport.', outside);

    const steps = await controlMetrics(page, '.ck-step-label');
    const clippedSteps = steps.filter(item => item.scrollWidth > item.clientWidth + 2);
    if (clippedSteps.length) addFailure('checkout', vp.name, state, 'Una etiqueta del indicador de pasos queda cortada.', clippedSteps);

    if (step === 2) {
      const phoneBoxes = await controlMetrics(page, '#ck-phone-country,#ck-phone-number');
      if (phoneBoxes.some(item => item.left < -2 || item.right > vp.width + 2 || item.width < 88)) {
        addFailure('checkout', vp.name, state, 'La fila de teléfono no se adapta correctamente.', phoneBoxes);
      }
    }

    report.push({ page: 'checkout', viewport: vp, state, geometry: geo, controls: controls.length });
    if (official.some(item => item.name === vp.name) && step === 0) {
      await page.screenshot({ path: path.join(outDir, `${vp.name}-checkout-carrito.png`), fullPage: true });
    }
    if (['m390', 'd1280'].includes(vp.name)) {
      await page.screenshot({ path: path.join(outDir, `${vp.name}-checkout-${state}.png`), fullPage: true });
    }
  }
}

async function auditLogin(page, vp) {
  await loadStatic(page, 'login.html');
  const brandVisible = await page.locator('.login-brand').isVisible().catch(() => false);
  const mobileLogoVisible = await page.locator('.login-mobile-logo').isVisible().catch(() => false);
  if (vp.width <= 768 && brandVisible) addFailure('login', vp.name, 'default', 'La columna de marca desktop aparece en mobile.');
  if (vp.width <= 768 && !mobileLogoVisible) addFailure('login', vp.name, 'default', 'Falta el logo mobile.');
  if (vp.width > 768 && !brandVisible) addFailure('login', vp.name, 'default', 'Falta la columna de marca en tablet/desktop.');

  const formBox = await page.locator('.login-box').boundingBox().catch(() => null);
  if (!formBox || formBox.x < -2 || formBox.x + formBox.width > vp.width + 2) {
    addFailure('login', vp.name, 'default', 'El formulario sale del viewport.', formBox);
  }
  const controls = await controlMetrics(page, '.login-google,.login-email-input,.login-email-btn,.login-email-resend,.login-back a');
  const tooShort = controls.filter(item => item.height < 40 && !item.cls.includes('login-email-resend'));
  if (tooShort.length) addFailure('login', vp.name, 'default', 'Hay controles principales demasiado bajos.', tooShort);
  const geo = await visibleGeometry(page);
  if (geo.scrollWidth > vp.width + 3 || geo.bad.length) addFailure('login', vp.name, 'default', 'Hay desborde horizontal visible.', geo);

  report.push({ page: 'login', viewport: vp, brandVisible, mobileLogoVisible, geometry: geo });
  if (official.some(item => item.name === vp.name)) {
    await page.screenshot({ path: path.join(outDir, `${vp.name}-login.png`), fullPage: true });
  }
}

async function mountProfileState(page) {
  await page.evaluate(() => {
    document.getElementById('perfil-avatar').textContent = 'M';
    document.getElementById('perfil-nombre-display').textContent = 'María Fernanda González';
    document.getElementById('perfil-email-display').textContent = 'maria.fernanda.gonzalez@example.com';
    document.getElementById('perfil-nombre').value = 'María Fernanda González';
    document.getElementById('perfil-tel').value = '0981 123 456';
    document.getElementById('perfil-dir').value = 'Av. España 1234, Barrio San José, San Lorenzo';
    document.getElementById('perfil-location-content').innerHTML = `
      <div class="part2d-location-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="min-width:0;flex:1 1 250px">
          <div style="font-weight:800;font-size:14px;color:var(--text)">📍 Mi casa</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Se usa para completar sola tu ubicación la próxima vez que compres con envío a domicilio.</div>
        </div>
        <div class="part2d-location-actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="#" class="perfil-btn perfil-btn-outline">🗺️ Ver en el mapa</a>
          <button type="button" class="perfil-btn perfil-btn-danger">🗑️ Borrar</button>
        </div>
      </div>`;
    const ordersCard = document.getElementById('perfil-orders-card');
    ordersCard.style.display = 'block';
    document.getElementById('perfil-orders-list').innerHTML = `
      <div class="perfil-order-row">
        <div class="part2d-order-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:11px;color:var(--text-muted);font-weight:700">#A1B2C3 · 21/07/2026</span>
          <span style="display:inline-block;padding:2px 8px;border-radius:50px;font-size:10px;font-weight:700;background:#3b82f620;color:#3b82f6;text-transform:uppercase">Confirmado</span>
        </div>
        <div style="font-size:13px;color:var(--text)">1× Reloj vintage delicado, 2× Set de accesorios edición limitada</div>
        <div style="font-size:14px;font-weight:800;color:var(--pink-dark);margin-top:2px">Total: Gs. 345.000</div>
      </div>`;
    document.getElementById('perfil-purchase-count').textContent = '3';
    document.getElementById('perfil-total-spent').textContent = 'Gs. 615.000';
  });
  await page.waitForTimeout(50);
}

async function auditProfile(page, vp) {
  await loadStatic(page, 'perfil.html');
  await mountProfileState(page);
  const wrap = await page.locator('.perfil-wrap').boundingBox().catch(() => null);
  if (!wrap || wrap.x < -2 || wrap.x + wrap.width > vp.width + 2) {
    addFailure('perfil', vp.name, 'authenticated', 'El contenedor del perfil sale del viewport.', wrap);
  }

  const controls = await controlMetrics(page, '.perfil-btn,.perfil-input,.perfil-back,.perfil-wa-box');
  const tooShort = controls.filter(item => item.height < 40 && !item.cls.includes('perfil-back'));
  if (tooShort.length) addFailure('perfil', vp.name, 'authenticated', 'Hay controles principales demasiado bajos.', tooShort);
  const outside = controls.filter(item => item.left < -2 || item.right > vp.width + 2);
  if (outside.length) addFailure('perfil', vp.name, 'authenticated', 'Un control del perfil sale del viewport.', outside);

  const headerText = await controlMetrics(page, '.perfil-name,.perfil-email');
  const clipped = headerText.filter(item => item.scrollWidth > item.clientWidth + 2);
  if (clipped.length) addFailure('perfil', vp.name, 'authenticated', 'Nombre o correo quedan cortados.', clipped);

  const geo = await visibleGeometry(page);
  if (geo.scrollWidth > vp.width + 3 || geo.bad.length) addFailure('perfil', vp.name, 'authenticated', 'Hay desborde horizontal visible.', geo);
  report.push({ page: 'perfil', viewport: vp, geometry: geo, controls: controls.length });
  if (official.some(item => item.name === vp.name)) {
    await page.screenshot({ path: path.join(outDir, `${vp.name}-perfil.png`), fullPage: true });
  }
}

try {
  for (const vp of all) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    page.on('pageerror', error => addFailure('runtime', vp.name, 'browser', `Error JS: ${error.message}`));
    await auditCheckout(page, vp);
    await auditLogin(page, vp);
    await auditProfile(page, vp);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ report, failures }, null, 2));
if (failures.length) {
  console.error(`PARTE 2D: ${failures.length} problema(s) visual(es) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}/${item.state}] ${item.message}`));
  process.exit(1);
}
console.log(`PARTE 2D: CORRECTA · ${all.length} viewports · Checkout, Login y Perfil sin desbordes ni controles recortados.`);
