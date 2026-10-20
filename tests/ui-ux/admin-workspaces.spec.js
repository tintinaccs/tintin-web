const { test, expect } = require('@playwright/test');
const runtimePath = '/js/admin/maestro/espacio-modulos-admin.js';
const { mockRuntime } = require('./helpers/admin-commerce-fixture.cjs');

const { load } = require('./helpers/admin-panel-fixture.cjs');

for (const width of [320, 390, 768, 1440]) {
  test(`todos los módulos: navegación interna y controles adaptables a ${width}px`, async ({ page }, testInfo) => {
    await load(page, width);
    const ids = await page.locator('.adm-content > .adm-section').evaluateAll(nodes => nodes.map(node => node.id));
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      await page.evaluate(id => {
        document.querySelectorAll('.adm-section').forEach(section => section.classList.toggle('active', section.id === id));
      }, id);
      const section = page.locator(`#${id}`);
      await expect(section).toBeVisible();
      await expect(section.locator(':scope > .tt-admin-workspace-bar')).toBeAttached();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const boxes = await section.locator('.tt-admin-workspace-bar select:visible,.tt-admin-workspace-bar button:visible').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, width: box.width }; }));
      for (const box of boxes) {
        expect(box.x, id).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, id).toBeLessThanOrEqual(width + 1);
      }
      if (id === 'section-configuracion') await page.screenshot({ path: testInfo.outputPath(`configuracion-${width}.png`), fullPage: true });
    }
  });
}

test('recorrer Configuración conserva el borrador y los encabezados ocultos quedan fuera', async ({ page }) => {
  await load(page, 390);
  await page.evaluate(() => {
    document.querySelector('.adm-section.active').classList.remove('active');
    document.getElementById('section-configuracion').classList.add('active');
  });
  const section = page.locator('#section-configuracion');
  const select = section.locator('.tt-admin-workspace-jump select');
  await expect(select).toBeVisible();
  const input = section.locator('input[type="text"]:visible').first();
  await input.fill('Borrador sin guardar');
  const options = await select.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(3);
  await select.selectOption('1');
  await expect(section.locator('.adm-card-title').nth(1)).toBeFocused();
  await expect(input).toHaveValue('Borrador sin guardar');
  const columns = await section.locator('.tt-admin-field-grid:visible').evaluateAll(grids => grids.map(grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length));
  expect(columns.length).toBeGreaterThan(0);
  expect(columns.every(count => count === 1)).toBe(true);
  const help = page.locator('.tt-admin-info-actions > div');
  expect((await help.boundingBox()).height).toBeLessThan(400);
  expect((await help.boundingBox()).width).toBeGreaterThan(200);
});

test('búsqueda existente, etiquetas de campos y tablas accesibles sin cambiar registros', async ({ page }) => {
  await load(page, 320);
  await page.evaluate(() => {
    document.querySelector('.adm-section.active').classList.remove('active');
    document.getElementById('section-usuarios').classList.add('active');
  });
  await page.getByRole('button', { name: 'Buscar registros' }).click();
  await expect(page.locator('#user-search')).toBeFocused();
  const table = page.locator('#section-usuarios .adm-table-wrap');
  await expect(table).toHaveAttribute('tabindex', '0');
  await expect(table).toHaveAttribute('role', 'region');
  await expect(table).toHaveAccessibleName('Tabla de Usuarios');
  await expect(page.locator('#section-usuarios .tt-admin-table-hint')).toBeVisible();
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => table.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  // Los datos de la tabla real permanecen en su estado inicial, sin inventar éxitos.
  await expect(page.locator('#users-tbody')).toContainText('Cargando');
});

test('módulos tardíos se mejoran una sola vez y reflejan cambios de contenido', async ({ page }) => {
  await load(page, 768);
  await page.evaluate(() => {
    const section = document.createElement('section');
    section.className = 'adm-section active'; section.id = 'section-welcome';
    section.innerHTML = '<div class="adm-card"><div class="adm-card-title">Mensaje</div><div class="adm-field"><label>Título</label><input id="welcome-title"></div></div><div class="adm-card"><div class="adm-card-title">Vista previa</div></div>';
    document.querySelector('.adm-content').append(section);
  });
  const section = page.locator('#section-welcome');
  await expect(section.locator('.tt-admin-workspace-bar')).toHaveCount(1);
  await expect(section.getByLabel('Título', { exact: true })).toHaveAttribute('id', 'welcome-title');
  const select = section.locator('.tt-admin-workspace-jump select');
  await expect(select).toBeVisible();
  await section.locator('.adm-card').last().evaluate(node => { node.hidden = true; });
  await expect(select).toBeHidden();
  await section.locator('.adm-card').last().evaluate(node => { node.hidden = false; });
  await expect(select).toBeVisible();
  await expect(section.locator('.tt-admin-workspace-bar')).toHaveCount(1);
  // Bienvenida y otros controladores reconstruyen el contenido tras guardar.
  await section.evaluate(node => { node.innerHTML = '<div class="adm-card"><div class="adm-card-title">Contenido actualizado</div></div>'; });
  await expect(section.locator('.tt-admin-workspace-bar')).toHaveCount(1);
});

test('biblioteca de imágenes comparte navegación interna y conserva sus controles', async ({ page }) => {
  await load(page, 390, 'admin-images.html');
  await page.evaluate(() => {
    document.getElementById('adm-cards-grid').innerHTML = '<div class="adm-img-card"><div class="adm-card-label">Foto principal</div></div><div class="adm-img-card"><div class="adm-card-label">Foto móvil</div></div>';
  });
  const select = page.getByLabel('Ir a una sección');
  await expect(select).toBeVisible();
  await select.selectOption('1');
  await expect(page.locator('.adm-card-label').last()).toBeFocused();
  expect(await select.evaluate(node => node.getBoundingClientRect().right)).toBeLessThanOrEqual(390);
});

test('convive con el controlador real de comercio sin perder filtros ni acciones', async ({ page }) => {
  await mockRuntime(page);
  await page.goto('https://tintin.test/admin-commerce-fixture');
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
  await page.evaluate(async runtimeUrl => {
    const content = document.createElement('div'); content.className = 'adm-content';
    document.body.append(content);
    document.querySelectorAll('.adm-section').forEach(section => content.append(section));
    await import(runtimeUrl);
  }, runtimePath);
  await page.locator('#section-productos').getByRole('button', { name: 'Buscar registros' }).click();
  const search = page.locator('[data-filter="product-search"]');
  await expect(search).toBeFocused();
  await search.fill('pulsera');
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(1);
  await page.locator('[data-action="product-new"]').click();
  expect(await page.evaluate(() => window.__calls)).toContainEqual(['prodNuevo']);
  await expect(page.locator('#prod-form-card')).toBeVisible();
});

for (const width of [390,768,1440]) test(`todos los módulos aceptados empiezan arriba y las mutaciones no arrastran el scroll ${width}`,async({page})=>{
 await load(page,width);

 await page.evaluate(()=>{const reset=window.TintinPageScroll.reset;window.__entryResets=0;window.TintinPageScroll.reset=(...args)=>{window.__entryResets++;return reset(...args);};});
 const ids=await page.locator('.adm-content > .adm-section').evaluateAll(nodes=>nodes.map(node=>node.id));
 for(const id of ids){
  await page.evaluate(id=>{
   document.querySelectorAll('.adm-section').forEach(el=>el.classList.remove('active'));document.getElementById(id).classList.add('active');
   const section=document.getElementById(id);section.style.minHeight='300vh';scrollTo({top:500,behavior:'instant'});
  },id);
  await expect.poll(()=>page.evaluate(()=>scrollY),id).toBe(0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>scrollTo({top:200,behavior:'instant'}));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const before=await page.evaluate(()=>({y:scrollY,resets:window.__entryResets}));
  expect(before.y,id).toBeGreaterThan(0);
  await page.evaluate(()=>{const item=document.createElement('span');item.textContent='Actualización de datos';document.querySelector('.adm-section.active').append(item);});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  // El navegador puede ajustar el anclaje al cambiar el layout; una actualización no debe activar navegación.
  expect(await page.evaluate(()=>window.__entryResets),id).toBe(before.resets);
  expect(await page.evaluate(()=>scrollY),id).toBeGreaterThan(0);
 }
});

for(const width of [390,1440])test(`subapartados de correos, envíos y apariencia empiezan arriba ${width}`,async({page})=>{
 await load(page,width);
 const panels=await page.locator('.correos-panel[id],.ship-tab-panel[id]').evaluateAll(nodes=>nodes.filter(node=>node.closest('.adm-section')).map(node=>({id:node.id,root:node.closest('.adm-section').id})));
 expect(panels.length).toBeGreaterThan(6);
 for(const panel of panels){
  await page.evaluate(({id,root})=>{
   document.querySelectorAll('.adm-section').forEach(el=>el.classList.toggle('active',el.id===root));
   const section=document.getElementById(root);section.style.minHeight='300vh';
   section.querySelectorAll('.correos-panel,.ship-tab-panel').forEach(el=>el.classList.remove('active'));
   document.getElementById(id).classList.add('active');scrollTo({top:500,behavior:'instant'});
  },panel);
  await expect.poll(()=>page.evaluate(()=>scrollY),panel.id).toBe(0);
 }
});
