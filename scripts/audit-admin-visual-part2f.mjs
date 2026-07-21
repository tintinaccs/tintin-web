import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'admin-part2f');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = requestPath === '/' ? 'admin.html' : requestPath.replace(/^\/+/, '');
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
await new Promise(resolve => server.listen(4178, '127.0.0.1', resolve));

const official = [
  { name: 'm360', width: 360, height: 800 }, { name: 'm390', width: 390, height: 844 },
  { name: 'm430', width: 430, height: 932 }, { name: 't768', width: 768, height: 1024 },
  { name: 't1024', width: 1024, height: 768 }, { name: 'd1280', width: 1280, height: 900 },
  { name: 'd1440', width: 1440, height: 960 },
];
const boundaries = [320, 480, 481, 640, 641, 760, 761, 900, 901, 1180, 1181, 1920].map(width => ({
  name: `b${width}`, width, height: width === 320 ? 568 : width <= 480 ? 820 : width <= 768 ? 1024 : 900,
}));
const viewports = [...official, ...boundaries];
const failures = [];
const report = [];

function fail(pageName, viewport, state, message, data = null) {
  failures.push({ page: pageName, viewport, state, message, data });
}

function staticHtml(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="http://127.0.0.1:4178/">');
}

async function loadStatic(page, fileName, extraCss = '') {
  await page.setContent(staticHtml(fileName), { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#auth-denied,.adm-auth-denied,.tt-privacy-consent{display:none!important}
    .reveal,.sr,.tt-auto-reveal{opacity:1!important;transform:none!important;filter:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
    ${extraCss}
  ` });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(80);
}

async function geometry(page) {
  return page.evaluate(() => {
    const viewport = innerWidth;
    const intentionalScroller = el => {
      let node = el.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        const known = node.matches('.adm-table-wrap,.adm-mobile-tabs,.correos-tabs,.adm-diagnostic-view-tabs,.cont-page-tabs,.ship-tabs,.user-tabs,.adm-sidebar,.adm-device-tabs,.adm-filter-scroll');
        if (known && /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2) return true;
        node = node.parentElement;
      }
      return false;
    };
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.left < -4 || rect.right > viewport + 4) {
        if (intentionalScroller(el)) continue;
        if (style.position === 'fixed' && rect.left >= -24 && rect.right <= viewport + 24) continue;
        bad.push({
          tag: el.tagName, id: el.id, cls: String(el.className || '').slice(0, 110),
          left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width),
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

async function controlMetrics(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
  }).map(node => {
    const rect = node.getBoundingClientRect();
    return {
      id: node.id || '', cls: String(node.className || '').slice(0, 100), type: node.type || '',
      width: Math.round(rect.width), height: Math.round(rect.height),
      left: Math.round(rect.left), right: Math.round(rect.right),
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
    };
  }));
}

async function prepareAdmin(page) {
  await loadStatic(page, 'admin.html', `
    #adm-sidebar,#adm-mobile-tabs,.adm-main{visibility:visible!important}
    .adm-section{display:none!important}
    .adm-section.active{display:block!important}
    .adm-overlay{display:none!important}
  `);
  return page.evaluate(() => {
    document.documentElement.classList.add('adm-auth-ready');
    const name = document.getElementById('adm-user-name'); if (name) name.textContent = 'Administradora María Fernanda González';
    const badge = document.getElementById('adm-role-badge'); if (badge) { badge.textContent = 'Super Administradora'; badge.className = 'adm-user-role-badge role-superadmin'; }
    const clock = document.getElementById('adm-live-clock'); if (clock) clock.textContent = '21/07/2026 · 19:30:45';

    document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),textarea').forEach((input, index) => {
      if (input.type === 'file' || input.disabled || input.readOnly) return;
      input.value = index % 2
        ? 'administracion.tienda.tintin.accs+verificacion@example.com'
        : 'Texto administrable especialmente largo para comprobar el comportamiento responsive sin recortes';
    });

    document.querySelectorAll('.adm-table').forEach((table, tableIndex) => {
      const tbody = table.tBodies?.[0];
      if (!tbody) return;
      const headers = [...table.querySelectorAll('thead th')];
      if (!headers.length || tbody.querySelector('[data-part2f-stress]')) return;
      const row = document.createElement('tr');
      row.dataset.part2fStress = '1';
      headers.forEach((header, index) => {
        const cell = document.createElement('td');
        const label = header.textContent.trim() || `Campo ${index + 1}`;
        cell.dataset.label = label;
        if (/acci|opci|gesti/i.test(label)) {
          cell.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="adm-btn adm-btn-sm adm-btn-outline" type="button">Editar información</button><button class="adm-btn adm-btn-sm adm-btn-danger" type="button">Desactivar</button></div>';
        } else if (/estado|rol|pago/i.test(label)) {
          cell.innerHTML = '<span class="adm-badge badge-confirmado">Confirmación pendiente extensa</span>';
        } else {
          cell.textContent = `${label}: contenido administrable largo de prueba ${tableIndex + 1}.${index + 1} — administracion.tienda.tintin@example.com`;
        }
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });

    document.querySelectorAll('.adm-bulk-toolbar').forEach(toolbar => toolbar.classList.add('show'));
    document.querySelectorAll('.adm-card-title,.adm-section-header p,.adm-card-subtitle').forEach((el, index) => {
      if (!el.textContent.trim() || index % 4 === 0) el.textContent = 'Configuración administrable con una descripción extensa que debe adaptarse correctamente';
    });
    return [...document.querySelectorAll('.adm-section[id^="section-"]')].map(section => section.id.replace('section-', ''));
  });
}

async function activateAdminSection(page, sectionName) {
  await page.evaluate(name => {
    document.querySelectorAll('.adm-section').forEach(section => section.classList.toggle('active', section.id === `section-${name}`));
    document.querySelectorAll('.adm-nav-item[data-section],.adm-mobile-tab[data-section]').forEach(button => {
      const active = button.dataset.section === name;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    const title = document.getElementById('adm-topbar-title');
    if (title) title.textContent = `Panel de ${name}: configuración y administración integral`;
    scrollTo(0, 0);
  }, sectionName);
  await page.waitForTimeout(40);
}

async function auditAdminSection(page, viewport, sectionName) {
  await activateAdminSection(page, sectionName);
  const geo = await geometry(page);
  if (geo.scrollWidth > viewport.width + 4 || geo.bad.length) {
    fail('admin', viewport.name, sectionName, 'Hay desborde horizontal visible.', geo);
  }

  const sectionBox = await page.locator(`#section-${sectionName}`).boundingBox().catch(() => null);
  if (!sectionBox || sectionBox.x < -3 || sectionBox.x + sectionBox.width > viewport.width + 3) {
    fail('admin', viewport.name, sectionName, 'La sección activa sale del viewport.', sectionBox);
  }

  const controls = await controlMetrics(page, `#section-${sectionName} .adm-btn:not(.adm-btn-sm),#section-${sectionName} .adm-input,#section-${sectionName} .adm-select,#section-${sectionName} .adm-textarea,#section-${sectionName} .ship-tab-btn,#section-${sectionName} .user-tab-btn,#section-${sectionName} .correos-tab-btn,.adm-topbar-btn,.adm-hamburger`);
  const outside = controls.filter(item => item.left < -3 || item.right > viewport.width + 3);
  if (outside.length) fail('admin', viewport.name, sectionName, 'Un control principal sale del viewport.', outside);
  const tooShort = controls.filter(item => item.height < 38 && !item.cls.includes('adm-topbar-btn'));
  if (tooShort.length) fail('admin', viewport.name, sectionName, 'Hay controles principales demasiado bajos.', tooShort);

  const nav = await page.evaluate(() => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
    };
    return {
      sidebar: visible(document.getElementById('adm-sidebar')),
      mobileTabs: visible(document.getElementById('adm-mobile-tabs')),
      mainLeft: Math.round(document.querySelector('.adm-main')?.getBoundingClientRect().left || 0),
    };
  });
  if (viewport.width <= 900 && nav.sidebar && nav.mainLeft >= 200) {
    fail('admin', viewport.name, sectionName, 'Sidebar y contenido desktop permanecen activos en mobile.', nav);
  }
  if (viewport.width > 900 && !nav.sidebar) fail('admin', viewport.name, sectionName, 'Falta el sidebar en escritorio.', nav);

  report.push({ page: 'admin', viewport, section: sectionName, geometry: geo, controls: controls.length, nav });
}

async function auditAdminModals(page, viewport) {
  if (![320, 390, 768, 1280].includes(viewport.width)) return;
  const modalIds = await page.locator('[role="dialog"]').evaluateAll(nodes => nodes.map((node, index) => node.id || `dialog-${index}`));
  for (let index = 0; index < modalIds.length; index += 1) {
    const id = modalIds[index];
    await page.evaluate(({ dialogId, dialogIndex }) => {
      document.querySelectorAll('[role="dialog"]').forEach(dialog => {
        dialog.style.setProperty('display', 'none', 'important');
        dialog.classList.remove('open', 'show', 'active');
      });
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      const dialog = dialogId.startsWith('dialog-') ? dialogs[dialogIndex] : document.getElementById(dialogId);
      if (!dialog) return;
      dialog.hidden = false;
      dialog.removeAttribute('aria-hidden');
      dialog.style.setProperty('display', 'flex', 'important');
      dialog.style.setProperty('visibility', 'visible', 'important');
      dialog.style.setProperty('opacity', '1', 'important');
      dialog.classList.add('open', 'show', 'active');
    }, { dialogId: id, dialogIndex: index });
    await page.waitForTimeout(30);
    const data = await page.locator('[role="dialog"]:visible').first().evaluate(dialog => {
      const candidates = [...dialog.children].filter(child => {
        const rect = child.getBoundingClientRect(); return rect.width > 10 && rect.height > 10;
      });
      const panel = candidates.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] || dialog;
      const r = panel.getBoundingClientRect();
      return {
        left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
        width: Math.round(r.width), height: Math.round(r.height), viewportWidth: innerWidth, viewportHeight: innerHeight,
        scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth,
      };
    }).catch(() => null);
    if (!data || data.left < -3 || data.right > viewport.width + 3 || data.width > viewport.width + 3 || data.scrollWidth > data.clientWidth + 4) {
      fail('admin', viewport.name, `modal:${id}`, 'Un modal no se adapta correctamente.', data);
    }
  }
  await page.evaluate(() => document.querySelectorAll('[role="dialog"]').forEach(dialog => dialog.style.setProperty('display', 'none', 'important')));
}

async function prepareImages(page) {
  await loadStatic(page, 'admin-images.html', `
    #auth-denied{display:none!important}
    .adm-layout,.adm-header,.adm-main{visibility:visible!important;opacity:1!important}
  `);
  await page.evaluate(() => {
    const email = document.querySelector('.adm-user-email'); if (email) email.textContent = 'administracion.tienda.tintin.accs@example.com';
    const grid = document.querySelector('.adm-cards-grid');
    if (grid && !grid.children.length) {
      grid.innerHTML = Array.from({ length: 4 }, (_, index) => `
        <article class="adm-img-card">
          <input class="adm-card-select" type="checkbox" aria-label="Seleccionar imagen ${index + 1}">
          <div class="adm-card-top"><div><div class="adm-card-label">Imagen administrable con un nombre especialmente largo ${index + 1}</div><div class="adm-card-desc">Página de inicio · versión para escritorio, tablet y teléfono</div></div><span class="adm-section-badge badge-productos">Productos destacados</span></div>
          <div class="adm-preview"><div class="adm-preview-empty"><span class="emoji">🖼️</span><span class="label">Vista previa pendiente</span></div></div>
          <label class="adm-autoreuse-toggle"><input type="checkbox">Usar automáticamente esta misma imagen en todos los dispositivos cuando no exista una versión específica.</label>
          <input class="adm-url-input" type="url" value="https://cdn.example.com/ruta/muy/larga/imagen-de-producto-tintin-${index + 1}.webp">
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="adm-save-btn" type="button">Guardar imagen</button><button class="adm-remove-btn" type="button">Quitar</button></div>
        </article>`).join('');
    }
    document.querySelectorAll('.adm-bulk-toolbar').forEach(toolbar => toolbar.classList.add('show'));
  });
}

async function auditImages(page, viewport) {
  const geo = await geometry(page);
  if (geo.scrollWidth > viewport.width + 4 || geo.bad.length) fail('admin-images', viewport.name, 'gallery', 'Hay desborde horizontal visible.', geo);
  const main = await page.locator('.adm-main').boundingBox().catch(() => null);
  if (!main || main.x < -3 || main.x + main.width > viewport.width + 3) fail('admin-images', viewport.name, 'gallery', 'El contenido principal sale del viewport.', main);
  const controls = await controlMetrics(page, '.adm-save-btn,.adm-remove-btn,.adm-bulk-btn,.adm-url-input,.adm-back-btn,.adm-hamburger,.adm-nav-btn');
  const outside = controls.filter(item => item.left < -3 || item.right > viewport.width + 3);
  if (outside.length) fail('admin-images', viewport.name, 'gallery', 'Un control sale del viewport.', outside);
  report.push({ page: 'admin-images', viewport, geometry: geo, controls: controls.length });
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

    const sections = await prepareAdmin(page);
    if (sections.length < 12) fail('admin', viewport.name, 'inventory', 'Se inventariaron menos secciones de las esperadas.', { sections });
    for (const section of sections) {
      await auditAdminSection(page, viewport, section);
      if (['b320', 'm390', 't768', 'd1280'].includes(viewport.name) && ['dashboard', 'pedidos', 'productos', 'configuracion', 'permisos', 'apariencia'].includes(section)) {
        await page.screenshot({ path: path.join(outDir, `${viewport.name}-admin-${section}.png`), fullPage: true });
      }
    }
    await auditAdminModals(page, viewport);

    await prepareImages(page);
    await auditImages(page, viewport);
    if (['b320', 'm390', 't768', 'd1280'].includes(viewport.name)) {
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-admin-images.png`), fullPage: true });
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ report, failures }, null, 2));
if (failures.length) {
  console.error(`PARTE 2F: ${failures.length} problema(s) visual(es) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}/${item.state}] ${item.message}`));
  process.exit(1);
}
console.log(`PARTE 2F: CORRECTA · ${viewports.length} viewports · ${report.filter(item => item.page === 'admin').length} estados de secciones + biblioteca de imágenes y modales.`);
