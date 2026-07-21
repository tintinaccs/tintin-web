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
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = pathname === '/' ? 'admin.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4178, '127.0.0.1', resolve));

const viewports = [
  [320,568],[360,800],[390,844],[430,932],[480,820],[481,900],[640,900],[641,900],
  [760,1024],[761,1024],[768,1024],[900,900],[901,900],[1024,768],[1180,900],
  [1181,900],[1280,900],[1440,960],[1920,1080],
].map(([width, height]) => ({ name: `${width}x${height}`, width, height }));

const browser = await chromium.launch({ headless: true });
const failures = [];
const report = [];
const fail = (page, viewport, state, message, data = null) => failures.push({ page, viewport, state, message, data });

function staticHtml(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="http://127.0.0.1:4178/">');
}

async function loadStatic(page, fileName, css = '') {
  await page.setContent(staticHtml(fileName), { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#auth-denied,.adm-auth-denied,.tt-privacy-consent{display:none!important}
    .reveal,.sr,.tt-auto-reveal{opacity:1!important;transform:none!important;filter:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
    ${css}
  ` });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(80);
}

async function geometry(page) {
  return page.evaluate(() => {
    const intentional = element => {
      let node = element.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (node.matches('.adm-table-wrap,.adm-mobile-tabs,.correos-tabs,.adm-diagnostic-view-tabs,.cont-page-tabs,.ship-tabs,.user-tabs,.adm-sidebar') && /(auto|scroll)/.test(style.overflowX)) return true;
        node = node.parentElement;
      }
      return false;
    };
    const bad = [];
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.left < -4 || rect.right > innerWidth + 4) {
        if (intentional(element)) continue;
        if (style.position === 'fixed' && rect.left >= -24 && rect.right <= innerWidth + 24) continue;
        bad.push({ tag: element.tagName, id: element.id, cls: String(element.className || '').slice(0,100), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) });
        if (bad.length >= 12) break;
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, viewport: innerWidth, bad };
  });
}

async function prepareAdmin(page) {
  await loadStatic(page, 'admin.html', `
    #adm-sidebar,#adm-mobile-tabs,.adm-main{visibility:visible!important}
    .adm-section{display:none!important}.adm-section.active{display:block!important}
    .adm-overlay{display:none!important}
  `);
  return page.evaluate(() => {
    document.documentElement.classList.add('adm-auth-ready');
    const name = document.getElementById('adm-user-name'); if (name) name.textContent = 'Administradora María Fernanda González';
    const badge = document.getElementById('adm-role-badge'); if (badge) { badge.textContent = 'Super Administradora'; badge.className = 'adm-user-role-badge role-superadmin'; }
    document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),textarea').forEach((input, index) => {
      if (input.type === 'file' || input.disabled || input.readOnly) return;
      input.value = index % 2 ? 'administracion.tienda.tintin.accs+verificacion@example.com' : 'Contenido administrable especialmente largo para comprobar el diseño responsive';
    });
    document.querySelectorAll('.adm-table').forEach((table, tableIndex) => {
      const body = table.tBodies?.[0]; const headers = [...table.querySelectorAll('thead th')];
      if (!body || !headers.length || body.querySelector('[data-part2f]')) return;
      const row = document.createElement('tr'); row.dataset.part2f = '1';
      headers.forEach((header, index) => {
        const label = header.textContent.trim() || `Campo ${index + 1}`;
        const cell = document.createElement('td'); cell.dataset.label = label;
        if (/acci|opci|gesti/i.test(label)) cell.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="adm-btn adm-btn-sm adm-btn-outline" type="button">Editar información</button><button class="adm-btn adm-btn-sm adm-btn-danger" type="button">Desactivar</button></div>';
        else cell.textContent = `${label}: dato largo de prueba ${tableIndex + 1}.${index + 1} — administracion.tienda.tintin@example.com`;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    document.querySelectorAll('.adm-bulk-toolbar').forEach(el => el.classList.add('show'));
    return [...document.querySelectorAll('.adm-section[id^="section-"]')].map(el => el.id.slice(8));
  });
}

async function activate(page, section) {
  await page.evaluate(name => {
    document.querySelectorAll('.adm-section').forEach(el => el.classList.toggle('active', el.id === `section-${name}`));
    document.querySelectorAll('.adm-nav-item[data-section],.adm-mobile-tab[data-section]').forEach(el => el.classList.toggle('active', el.dataset.section === name));
    const title = document.getElementById('adm-topbar-title'); if (title) title.textContent = `Panel de ${name}: administración integral`;
    scrollTo(0,0);
  }, section);
  await page.waitForTimeout(30);
}

async function auditAdmin(page, viewport) {
  const sections = await prepareAdmin(page);
  if (sections.length < 12) fail('admin', viewport.name, 'inventory', 'Se inventariaron menos secciones de las esperadas.', sections);
  for (const section of sections) {
    await activate(page, section);
    const geo = await geometry(page);
    if (geo.scrollWidth > viewport.width + 4 || geo.bad.length) fail('admin', viewport.name, section, 'Hay desborde horizontal visible.', geo);
    const box = await page.locator(`#section-${section}`).boundingBox().catch(() => null);
    if (!box || box.x < -3 || box.x + box.width > viewport.width + 3) fail('admin', viewport.name, section, 'La sección activa sale del viewport.', box);
    const nav = await page.evaluate(() => {
      const visible = el => { if (!el) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
      return { sidebar: visible(document.getElementById('adm-sidebar')), mobileTabs: visible(document.getElementById('adm-mobile-tabs')), mainLeft: Math.round(document.querySelector('.adm-main')?.getBoundingClientRect().left || 0) };
    });
    if (viewport.width <= 900 && nav.sidebar && nav.mainLeft >= 200) fail('admin', viewport.name, section, 'Sidebar desktop permanece ocupando espacio en mobile.', nav);
    if (viewport.width > 900 && !nav.sidebar) fail('admin', viewport.name, section, 'Falta el sidebar en escritorio.', nav);
    report.push({ page: 'admin', viewport, section, geo, nav });
    if ([320,390,768,1280].includes(viewport.width) && ['dashboard','pedidos','productos','configuracion','permisos','apariencia'].includes(section)) await page.screenshot({ path: path.join(outDir, `${viewport.width}-admin-${section}.png`), fullPage: true });
  }

  if ([320,390,768,1280].includes(viewport.width)) {
    const dialogs = await page.locator('[role="dialog"]').count();
    for (let index = 0; index < dialogs; index += 1) {
      await page.evaluate(i => {
        const all = [...document.querySelectorAll('[role="dialog"]')];
        all.forEach(el => { el.style.setProperty('display','none','important'); el.classList.remove('open','show','active'); });
        const dialog = all[i]; if (!dialog) return;
        dialog.hidden = false; dialog.style.setProperty('display','flex','important'); dialog.style.setProperty('visibility','visible','important'); dialog.style.setProperty('opacity','1','important'); dialog.classList.add('open','show','active');
      }, index);
      await page.waitForTimeout(20);
      const box = await page.locator('[role="dialog"]:visible').first().boundingBox().catch(() => null);
      if (!box || box.x < -3 || box.x + box.width > viewport.width + 3) fail('admin', viewport.name, `dialog-${index + 1}`, 'El diálogo sale del viewport.', box);
    }
  }
}

async function auditImages(page, viewport) {
  await loadStatic(page, 'admin-images.html', '#auth-denied{display:none!important}.adm-layout,.adm-header,.adm-main{visibility:visible!important;opacity:1!important}');
  await page.evaluate(() => {
    const email = document.querySelector('.adm-user-email'); if (email) email.textContent = 'administracion.tienda.tintin.accs@example.com';
    const grid = document.querySelector('.adm-cards-grid');
    if (grid && !grid.children.length) grid.innerHTML = Array.from({length:4},(_,i)=>`<article class="adm-img-card"><input class="adm-card-select" type="checkbox"><div class="adm-card-top"><div><div class="adm-card-label">Imagen administrable con nombre especialmente largo ${i+1}</div><div class="adm-card-desc">Inicio · escritorio, tablet y teléfono</div></div><span class="adm-section-badge badge-productos">Productos destacados</span></div><div class="adm-preview"><div class="adm-preview-empty"><span class="emoji">🖼️</span><span class="label">Vista previa</span></div></div><label class="adm-autoreuse-toggle"><input type="checkbox">Usar automáticamente esta misma imagen en todos los dispositivos cuando no exista una versión específica.</label><input class="adm-url-input" value="https://cdn.example.com/ruta/muy/larga/imagen-tintin-${i+1}.webp"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="adm-save-btn">Guardar imagen</button><button class="adm-remove-btn">Quitar</button></div></article>`).join('');
    document.querySelectorAll('.adm-bulk-toolbar').forEach(el => el.classList.add('show'));
  });
  const geo = await geometry(page);
  if (geo.scrollWidth > viewport.width + 4 || geo.bad.length) fail('admin-images', viewport.name, 'gallery', 'Hay desborde horizontal visible.', geo);
  const main = await page.locator('.adm-main').boundingBox().catch(() => null);
  if (!main || main.x < -3 || main.x + main.width > viewport.width + 3) fail('admin-images', viewport.name, 'gallery', 'El contenido principal sale del viewport.', main);
  report.push({ page: 'admin-images', viewport, geo });
  if ([320,390,768,1280].includes(viewport.width)) await page.screenshot({ path: path.join(outDir, `${viewport.width}-admin-images.png`), fullPage: true });
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => fail('runtime', viewport.name, 'browser', error.message));
    await auditAdmin(page, viewport);
    await auditImages(page, viewport);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ report, failures }, null, 2));
if (failures.length) {
  console.error(`PARTE 2F: ${failures.length} problema(s) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}/${item.state}] ${item.message}`));
  process.exit(1);
}
console.log(`PARTE 2F: CORRECTA · ${viewports.length} viewports · ${report.filter(x => x.page === 'admin').length} estados de secciones y biblioteca de imágenes.`);
