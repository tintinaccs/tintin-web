const { test, expect } = require('@playwright/test');
const { openProductSaveFixture } = require('./helpers/product-save-fixture.cjs');
for (const [width, height] of [[320,568],[390,844],[430,932],[844,390],[768,1024],[820,1180],[1024,768],[1180,820],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440]]) {
 test.describe(`${width}x${height}`, () => {
  const touch = width < 1200;
  test.use({ hasTouch: touch, isMobile: width < 700 || (width === 844 && height === 390), deviceScaleFactor: touch ? 2 : 1 });
  const press = locator => touch ? locator.tap() : locator.click();
  test(`nuevo producto real: opciones y guardado ${width}x${height}`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await openProductSaveFixture(page, width, height);
    const save = page.locator('#prod-save-btn'); await expect(save).toBeInViewport();
    const box = await save.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('#prod-form-card').evaluate(card => card.scrollWidth <= card.clientWidth + 1)).toBe(true);
    await page.locator('#prod-editor-section').selectOption('general');
    await page.locator('#prod-name').fill('Producto ficticio QA tablet');
    await page.locator('#prod-description').fill('Descripción del producto de prueba.');
    await page.locator('#prod-imageUrl').evaluate(input => { input.value='/assets-tintin/logo.png'; });
    await page.locator('#prod-editor-section').selectOption('prices');
    await page.locator('#prod-price').fill('45000');
    await page.locator('#prod-editor-section').selectOption('visibility');
    await page.locator('#prod-category').selectOption('qa-tablet');
    await page.locator('#prod-editor-section').selectOption('inventory');
    await press(page.getByRole('button', { name: 'Agregar color Dorado', exact: true }));
    await expect(page.locator('#prod-variants-text')).toHaveValue('Color: Dorado');
    await expect(page.locator('#prod-form-error')).toBeHidden();
    const quantity = page.locator('#prod-variant-stock input[type="number"]');
    await press(page.getByRole('button', { name: 'Asignar stock por color u opción', exact: true }));
    await quantity.fill('2');
    await expect(page.locator('#prod-stock')).toHaveValue('2');
    if ([390,768,1024,1366,1920].includes(width)) {
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await page.screenshot({ path: `artifacts/qa-productos/editor-${width}x${height}.png`, animations: 'disabled' });
    }
    await press(page.locator('#prod-save-btn'));
    await expect(page.locator('#prod-form-card')).toBeHidden();
    const saved = await page.evaluate(() => window.qaProductStore.get('products/qa-product-1'));
    expect(saved.name).toBe('Producto ficticio QA tablet'); expect(saved.price).toBe(45000); expect(saved.stock).toBe(2);
    expect(saved.variants).toEqual({ Color: ['Dorado'] }); expect(saved.variantInventory).toEqual([{ variant: 'Dorado', stock: 2 }]);
    expect(await page.evaluate(() => window.qaProductOperations)).toEqual(['green']); expect(errors).toEqual([]);
  });
  async function fillValid(page) {
    await page.locator('#prod-editor-section').selectOption('general');
    await page.locator('#prod-name').fill('Producto ficticio QA');
    await page.locator('#prod-description').fill('Descripción del producto de prueba.');
    await page.locator('#prod-imageUrl').evaluate(input => { input.value='/assets-tintin/logo.png'; });
    await page.locator('#prod-editor-section').selectOption('prices');
    await page.locator('#prod-price').fill('45000');
    await page.locator('#prod-editor-section').selectOption('visibility');
    await page.locator('#prod-category').selectOption('qa-tablet');
  }
  test('activar precios por combinación conserva las cantidades recién editadas', async ({ page }) => {
    await openProductSaveFixture(page, width, height); await fillValid(page);
    await page.locator('#prod-editor-section').selectOption('inventory');
    await press(page.getByRole('button', { name: 'Agregar color Dorado', exact: true }));
    await press(page.getByRole('button', { name: 'Asignar stock por color u opción', exact: true }));
    await page.locator('#prod-variant-stock input[type="number"]').fill('2');
    page.once('dialog', dialog => dialog.accept());
    await press(page.getByRole('button', { name: 'Usar precios y disponibilidad por combinación', exact: true }));
    await expect(page.locator('#prod-variant-stock .tt-commercial-row')).toHaveCount(1);
    await expect(page.locator('#prod-variant-stock').getByRole('spinbutton', { name: 'Stock: Dorado', exact: true })).toHaveValue('2');
    await expect(page.locator('#prod-stock')).toHaveValue('2');
    await expect(page.locator('#prod-form-error')).toBeHidden();
    await page.locator('#prod-variant-stock').getByRole('spinbutton', { name: 'Precio: Dorado', exact: true }).fill('55000');
    await press(page.locator('#prod-save-btn')); await expect(page.locator('#prod-form-card')).toBeHidden();
    const saved = await page.evaluate(() => window.qaProductStore.get('products/qa-product-1'));
    expect(saved.variantCommerceVersion).toBe(2); expect(saved.stock).toBe(2); expect(saved.variantInventory[0].stock).toBe(2); expect(saved.variantInventory[0].price).toBe(55000);
  });
  test('color opcional sin reparto de stock y básicos de publicación', async ({page}) => {
    await openProductSaveFixture(page, width, height); await fillValid(page);
    await page.locator('#prod-publicationStatus').selectOption('active');
    await page.locator('#prod-description').evaluate(input => { input.value=''; });
    await press(page.locator('#prod-save-btn'));
    await expect(page.locator('#prod-form-error')).toContainText('descripción');
    await page.locator('#prod-description').evaluate(input => { input.value='Descripción válida'; });
    await page.locator('#prod-imageUrl').evaluate(input => { input.value=''; });
    await press(page.locator('#prod-save-btn'));
    await expect(page.locator('#prod-form-error')).toContainText('foto principal');
    await page.locator('#prod-imageUrl').evaluate(input => { input.value='/assets-tintin/logo.png'; });
    await page.locator('#prod-editor-section').selectOption('inventory');
    await press(page.getByRole('button', {name:'Agregar color Dorado',exact:true}));
    await expect(page.locator('#prod-stock')).toBeEditable();
    await expect(page.locator('#prod-variant-stock input[type="number"]')).toHaveCount(0);
    await press(page.locator('#prod-save-btn'));
    await expect(page.locator('#prod-form-card')).toBeHidden();
    const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));
    expect(saved.variants).toEqual({Color:['Dorado']});
    expect(saved.variantInventory).toBeUndefined();
  });
  test('doble toque o doble clic mientras guarda crea un solo producto', async ({ page }) => {
    await openProductSaveFixture(page, width, height); await fillValid(page);
    await page.evaluate(() => window.qaHoldSave = true);
    const save = page.locator('#prod-save-btn'), box = await save.boundingBox();
    await press(save); await expect(save).toBeDisabled(); await expect(save).toHaveText('Guardando…');
    if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => typeof window.qaReleaseSave === 'function');
    expect(await page.evaluate(() => window.qaProductWrites)).toEqual([]);
    await page.evaluate(() => window.qaReleaseSave());
    await expect(page.locator('#prod-form-card')).toBeHidden();
    expect(await page.evaluate(() => [...window.qaProductStore.keys()].filter(key => key.startsWith('products/')))).toHaveLength(1);
    expect(await page.evaluate(() => window.qaProductOperations)).toEqual(['green']);
  });
  test('un fallo al guardar conserva el formulario y permite reintentar sin duplicados', async ({ page }) => {
    await openProductSaveFixture(page, width, height); await fillValid(page);
    await page.evaluate(() => window.qaRejectSave = true);
    await press(page.locator('#prod-save-btn'));
    await expect(page.locator('#prod-form-error')).toBeVisible(); await expect(page.locator('#prod-save-btn')).toBeEnabled();
    await expect(page.locator('#prod-name')).toHaveValue('Producto ficticio QA');
    expect(await page.evaluate(() => window.qaProductWrites)).toEqual([]);
    await page.evaluate(() => { window.qaRejectSave = false; window.qaFailSync = true; });
    await press(page.locator('#prod-save-btn'));
    await expect(page.locator('#prod-form-card')).toBeHidden();
    expect(await page.evaluate(() => [...window.qaProductStore.keys()].filter(key => key.startsWith('products/')))).toHaveLength(1);
  });
  test('reabrir lo guardado y editar usa el mismo producto', async ({ page }) => {
    await openProductSaveFixture(page, width, height); await fillValid(page);
    await press(page.locator('#prod-save-btn')); await expect(page.locator('#prod-form-card')).toBeHidden();
    await page.evaluate(() => window.prodEditar('qa-product-1'));
    await expect(page.locator('#prod-form-card')).toBeVisible();
    await expect(page.locator('#prod-name')).toHaveValue('Producto ficticio QA');
    await page.locator('#prod-editor-section').selectOption('general');
    await page.locator('#prod-name').fill('Producto ficticio editado');
    await press(page.locator('#prod-save-btn')); await expect(page.locator('#prod-form-card')).toBeHidden();
    expect(await page.evaluate(() => [...window.qaProductStore.keys()].filter(key => key.startsWith('products/')))).toHaveLength(1);
    expect(await page.evaluate(() => window.qaProductStore.get('products/qa-product-1').name)).toBe('Producto ficticio editado');
  });
  test('una opción nueva sin stock se puede quitar y conserva el stock simple anterior', async ({ page }) => {
    await openProductSaveFixture(page, width, height);
    await page.locator('#prod-editor-section').selectOption('inventory');
    await page.locator('#prod-stock').fill('7');
    await press(page.getByRole('button', { name: 'Agregar color Dorado', exact: true }));
    await expect(page.locator('#prod-variants-text')).toHaveValue('Color: Dorado');
    await press(page.getByRole('button', { name: 'Quitar Color: Dorado', exact: true }));
    await expect(page.locator('#prod-variants-text')).toHaveValue('');
    await expect(page.locator('#prod-stock')).toHaveValue('7');
    await expect(page.locator('#prod-stock')).toBeEditable();
    await expect(page.locator('#prod-form-error')).toBeHidden();
  });
  test('quitar una opción con stock conserva datos y explica cómo corregirla', async ({ page }) => {
    await openProductSaveFixture(page, width, height);
    await page.locator('#prod-editor-section').selectOption('inventory');
    await press(page.getByRole('button', { name: 'Agregar color Dorado', exact: true }));
    await press(page.getByRole('button', { name: 'Asignar stock por color u opción', exact: true }));
    await page.locator('#prod-variant-stock input[type="number"]').fill('2');
    await press(page.getByRole('button', { name: 'Quitar Color: Dorado', exact: true }));
    await expect(page.locator('#prod-variants-text')).toHaveValue('Color: Dorado');
    await expect(page.locator('#prod-stock')).toHaveValue('2');
    await expect(page.locator('#prod-form-error')).toContainText('0');
  });
  test('cada intento inválido muestra el error aunque se haya desplazado el formulario', async ({ page }) => {
    await openProductSaveFixture(page, width, height);
    const save = page.locator('#prod-save-btn'), error = page.locator('#prod-form-error');
    await press(save);
    await expect(error).toBeInViewport(); await expect(save).toBeEnabled();
    await page.locator('#prod-form-card .adm-card-body').evaluate(body => body.scrollTop = body.scrollHeight);
    await press(save);
    await expect(error).toBeInViewport();
    expect(await page.evaluate(() => window.qaProductWrites)).toEqual([]);
  });
 });
}


for(const [width,height] of [[320,568],[390,844],[430,932],[540,900],[600,960],[768,1024],[820,1180],[844,390],[1024,768],[1180,820],[1366,768],[1920,1080],[3840,2160]])test('Nuevo y Editar conservan formulario visible con cabecera real '+width+'x'+height,async({page})=>{
  await openProductSaveFixture(page,width,height,{fullShell:true});
  await page.locator('#prod-editor-section').selectOption('general');
  await page.locator('#prod-name').fill('Producto ficticio con cabecera');
  await page.locator('#prod-description').fill('Descripción de prueba, sin productos reales.');
  await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('45000');
  await page.locator('#prod-editor-section').selectOption('visibility');await page.locator('#prod-category').selectOption('qa-tablet');
  await page.locator('#prod-imageUrl').evaluate(n=>{n.value='https://img.test/principal.png';});
  await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
  await page.evaluate(()=>window.prodEditar('qa-product-1'));
  await expect(page.locator('#prod-name')).toHaveValue('Producto ficticio con cabecera');
  const frame=await page.locator('#prod-form-card').boundingBox();expect(frame.height).toBeGreaterThan(200);expect(frame.y).toBeGreaterThanOrEqual(0);expect(frame.y+frame.height).toBeLessThanOrEqual(height+1);
  await expect(page.locator('#prod-save-btn')).toBeInViewport();
  await page.locator('#prod-editor-section').selectOption('inventory');
  const controls=await page.locator('.tt-editor-variant-add').evaluate(row=>({row:row.getBoundingClientRect().toJSON(),children:[...row.children].map(n=>({tag:n.tagName,rect:n.getBoundingClientRect().toJSON()}))}));
  for(const control of controls.children){expect(control.rect.left).toBeGreaterThanOrEqual(controls.row.left-1);expect(control.rect.right).toBeLessThanOrEqual(controls.row.right+1);if(['INPUT','SELECT'].includes(control.tag))expect(control.rect.width).toBeGreaterThanOrEqual(Math.min(180,controls.row.width)-1);}
});

test('viewport reducido y restauración no dejan el editor vacío ni pierden el borrador',async({page})=>{
  await openProductSaveFixture(page,390,844,{fullShell:true});await page.locator('#prod-editor-section').selectOption('general');await page.locator('#prod-name').fill('Borrador conservado');
  await page.evaluate(()=>{window.qaVisualHeight=document.querySelector('.adm-topbar').getBoundingClientRect().bottom;Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>window.qaVisualHeight});dispatchEvent(new Event('resize'));});
  expect((await page.locator('#prod-form-card').boundingBox()).height).toBeGreaterThan(0);
  await page.evaluate(()=>{delete visualViewport.height;dispatchEvent(new Event('pageshow'));});
  await expect.poll(()=>page.locator('#prod-form-card').evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThan(500);await expect(page.locator('#prod-name')).toHaveValue('Borrador conservado');
});
