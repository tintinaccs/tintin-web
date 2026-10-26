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
    await page.locator(".tt-editor-option-assistance").evaluate(node=>node.open=true);
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
    await page.locator(".tt-editor-option-assistance").evaluate(node=>node.open=true);
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
    await page.locator(".tt-editor-option-assistance").evaluate(node=>node.open=true);
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
    await page.locator(".tt-editor-option-assistance").evaluate(node=>node.open=true);
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
    await page.locator(".tt-editor-option-assistance").evaluate(node=>node.open=true);
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
  const controls=await page.locator('.tt-editor-variant-add').evaluate(row=>({row:row.getBoundingClientRect().toJSON(),children:[...row.children].filter(node=>node.getClientRects().length).map(n=>({tag:n.tagName,rect:n.getBoundingClientRect().toJSON()}))}));
  for(const control of controls.children){expect(control.rect.left).toBeGreaterThanOrEqual(controls.row.left-1);expect(control.rect.right).toBeLessThanOrEqual(controls.row.right+1);if(['INPUT','SELECT'].includes(control.tag))expect(control.rect.width).toBeGreaterThanOrEqual(Math.min(180,controls.row.width)-1);}
});

test('viewport reducido y restauración no dejan el editor vacío ni pierden el borrador',async({page})=>{
  await openProductSaveFixture(page,390,844,{fullShell:true});await page.locator('#prod-editor-section').selectOption('general');await page.locator('#prod-name').fill('Borrador conservado');
  await page.evaluate(()=>{window.qaVisualHeight=document.querySelector('.adm-topbar').getBoundingClientRect().bottom;Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>window.qaVisualHeight});dispatchEvent(new Event('resize'));});
  expect((await page.locator('#prod-form-card').boundingBox()).height).toBeGreaterThan(0);
  await page.evaluate(()=>{delete visualViewport.height;dispatchEvent(new Event('pageshow'));});
  await expect.poll(()=>page.locator('#prod-form-card').evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThan(500);await expect(page.locator('#prod-name')).toHaveValue('Borrador conservado');
});

// Galería unificada: integración con controlador y escritor originales.
{
const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');

test('carga unificada conserva pendientes ante fallo, reintenta y permite cancelar',async({page})=>{
 await openProductSaveFixture(page,390,844,{photos:true});await page.locator('#prod-editor-section').selectOption('photos');
 const gallery=page.locator('.tt-unified-photos');
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;return canvas.toDataURL('image/png').split(',')[1];});
 const file=n=>({name:`device${n}.png`,mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await gallery.locator('input[multiple]').setInputFiles([1,2,3,4,5].map(file));
 await expect(gallery.locator('.tt-editor-upload-item')).toHaveCount(5);
 await page.evaluate(()=>window.qaUploadFailure=true);await gallery.getByRole('button',{name:'Confirmar y subir fotos',exact:true}).click();
 await expect(gallery.locator('.tt-iuw-multiple .tt-iuw-status')).toContainText('Carga fallida');await expect(gallery.locator('.tt-editor-upload-item')).toHaveCount(5);
 await page.evaluate(()=>window.qaUploadFailure=false);await gallery.getByRole('button',{name:'Confirmar y subir fotos',exact:true}).click();
 await expect(gallery.locator('.tt-unified-photo')).toHaveCount(5);await expect(gallery.locator('.tt-editor-upload-item')).toHaveCount(0);
 await gallery.locator('input[multiple]').setInputFiles(file(6));await gallery.getByRole('button',{name:'Quitar pendiente device6.png',exact:true}).click();await expect(gallery.locator('.tt-editor-upload-item')).toHaveCount(0);
 await gallery.getByRole('button',{name:'Reemplazar foto 1',exact:true}).click();await gallery.getByRole('button',{name:'Cancelar reemplazo',exact:true}).click();await expect(gallery.locator('.tt-unified-photo')).toHaveCount(5);
});

for(const count of [1,2,3,4,5,10,13])test(`galería única con ${count} imágenes conserva orden y portada`,async({page})=>{
 await openProductSaveFixture(page,1366,768,{photos:true});await page.locator('#prod-editor-section').selectOption('photos');const gallery=page.locator('.tt-unified-photos');
 for(let i=1;i<=count;i++){await page.evaluate(i=>window.qaLibraryPhoto=`https://img.test/count${i}.webp`,i);await gallery.locator('.tt-iuw-multiple').getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();}
 await expect(gallery.locator('.tt-unified-photo')).toHaveCount(count);const index=Math.min(4,count);await gallery.getByRole('button',{name:`Portada: foto ${index}`,exact:true}).click();await expect(page.locator('#prod-imageUrl')).toHaveValue(`https://img.test/count${index}.webp`);
});

for(const [width,height] of [[390,844],[844,390],[768,1024],[1024,768],[1366,768],[1920,1080]])test(`galería única guarda, reabre y conserva asociaciones ${width}x${height}`,async({page})=>{
 await openProductSaveFixture(page,width,height,{photos:true});
 await page.locator('#prod-editor-section').selectOption('photos');
 const gallery=page.locator('.tt-unified-photos');await expect(gallery).toBeVisible();
 await expect(gallery.locator('input[multiple]')).toHaveCount(1);
 await page.locator('#prod-variants-text').evaluate(input=>{input.value='Color: Dorado, Plateado\nForma: Redondo, Ovalado';input.dispatchEvent(new Event('input',{bubbles:true}));});
 for(let i=1;i<=5;i++){
  await page.evaluate(i=>{window.qaLibraryPhoto=`https://img.test/photo${i}.webp`;},i);
  await gallery.getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();
 }
 await expect(gallery.locator('.tt-unified-photo')).toHaveCount(5);
 await gallery.getByRole('button',{name:'Portada: foto 4',exact:true}).click();
 await expect(page.locator('#prod-imageUrl')).toHaveValue('https://img.test/photo4.webp');
 await gallery.getByRole('button',{name:'Asociar foto 1',exact:true}).click();
 await gallery.getByLabel('Asociación: Color',{exact:true}).selectOption('Dorado');await gallery.getByLabel('Asociación: Forma',{exact:true}).selectOption('Redondo');await gallery.getByRole('button',{name:'Asociar fotografía',exact:true}).click();
 await gallery.getByRole('button',{name:'Asociar foto 3',exact:true}).click();await gallery.getByLabel('Asociación: Color',{exact:true}).selectOption('Plateado');await gallery.getByRole('button',{name:'Asociar fotografía',exact:true}).click();
 await page.locator('#prod-editor-section').selectOption('general');await page.locator('#prod-name').fill('Galería sintética');await page.locator('#prod-description').fill('Descripción sintética');
 await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('45000');
 await page.locator('#prod-editor-section').selectOption('visibility');await page.locator('#prod-category').selectOption('qa-tablet');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));
 expect(saved.imageUrl).toBe('https://img.test/photo4.webp');expect(saved.imagesExtra).toHaveLength(4);
 expect(saved.variantMedia.find(row=>row.Forma==='Redondo').imageUrls).toEqual(['https://img.test/photo4.webp']);
 const publicImages=await page.evaluate(async data=>{const path='/js/components/images/foto-variante.mjs';const {productVariantImage}=await import(path);return [productVariantImage(data,''),productVariantImage(data,'Dorado / Redondo'),productVariantImage(data,'Plateado / Redondo')];},saved);
 expect(publicImages).toEqual(['https://img.test/photo4.webp','https://img.test/photo4.webp','https://img.test/photo2.webp']);
 await page.evaluate(()=>window.prodEditar('qa-product-1'));
 await page.locator('#prod-editor-section').selectOption('photos');await expect(gallery.locator('.tt-unified-photo')).toHaveCount(5);
 await expect(page.locator('#prod-imageUrl')).toHaveValue(saved.imageUrl);
 await page.evaluate(()=>window.qaLibraryPhoto='https://img.test/photo6.webp');await gallery.getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();
 await expect(gallery.locator('.tt-unified-photo')).toHaveCount(6);
 await gallery.getByRole('button',{name:'Siguiente: foto 2',exact:true}).focus();await page.keyboard.press('Enter');
 await gallery.getByRole('button',{name:'Reemplazar foto 2',exact:true}).click();
 await page.evaluate(()=>window.qaLibraryPhoto='https://img.test/replacement.webp');await gallery.locator('.tt-iuw:not(.tt-iuw-multiple)').getByRole('button',{name:'Elegir de la biblioteca',exact:true}).click();
 await expect(gallery.locator('.tt-unified-photo img[src$="replacement.webp"]')).toHaveCount(1);
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const replaced=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));
 expect(replaced.variantMedia.find(row=>row.Color==='Plateado').imageUrls).toEqual(['https://img.test/replacement.webp']);
 expect(replaced.variantMedia.find(row=>row.Forma==='Redondo').imageUrls).toEqual(['https://img.test/photo4.webp']);
 await page.evaluate(()=>window.prodEditar('qa-product-1'));await page.locator('#prod-editor-section').selectOption('photos');
 await gallery.getByRole('button',{name:'Quitar foto 3',exact:true}).click();await expect(gallery.locator('.tt-unified-photo')).toHaveCount(5);
 await gallery.getByRole('button',{name:'Quitar foto 1',exact:true}).click();await expect(gallery.locator('.tt-unified-photo')).toHaveCount(4);
 await expect(page.locator('#prod-imageUrl')).not.toHaveValue('');
 expect(await gallery.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.locator('#prod-form-card .adm-card-body').evaluate(node=>node.scrollTop=0);
 await page.screenshot({path:`artifacts/unified-gallery/${width}x${height}.png`});
});

}

// Fase 3: grupos e inventario usan el mismo controlador y escritor.
for(const [width,height] of [[390,844],[844,390],[768,1024],[1024,768],[1366,768],[1920,1080]]) {
 test('opciones agrupadas, inventario y referencias seguras '+width+'x'+height,async({page})=>{
  await openProductSaveFixture(page,width,height,{photos:true});
  await page.locator('#prod-editor-section').selectOption('general');
  await page.locator('#prod-name').fill('Opciones sintéticas');
  await page.locator('#prod-description').fill('Descripción de prueba');
  await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('45000');
  await page.locator('#prod-editor-section').selectOption('visibility');await page.locator('#prod-category').selectOption('qa-tablet');await page.locator('#prod-publicationStatus').selectOption('draft');
  await page.locator('#prod-editor-section').selectOption('inventory');
  const add=async(group,name)=>{await page.getByLabel('Característica de variante',{exact:true}).selectOption(group);await page.getByLabel('Nueva opción de variante',{exact:true}).fill(name);await page.getByRole('button',{name:'Agregar opción',exact:true}).click();};
  for(const color of ['Verde','Verde Oliva','Bordó','Plateado','Blanco'])await add('Color',color);
  await expect(page.locator('.tt-option-group')).toHaveCount(1);
  await expect(page.locator('.tt-option-row')).toHaveCount(5);
  await page.evaluate(()=>{window.qaOptionScrollResets=0;window.TintinPageScroll={reset:()=>window.qaOptionScrollResets++};const body=document.querySelector('#prod-form-card .adm-card-body');body.scrollTop=250;const value=document.querySelector('[aria-label="Nueva opción de variante"]');value.value='Temporal';value.focus({preventScroll:true});document.querySelector('.tt-editor-variant-add button').click();});
  expect(await page.evaluate(()=>window.qaOptionScrollResets)).toBe(0);
  await expect(page.getByLabel('Nueva opción de variante',{exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Quitar Color: Temporal',exact:true}).click();
  await add('Color','Verde');await expect(page.locator('.tt-editor-control-error')).toContainText('ya está');
  await page.getByLabel('Nueva opción de variante',{exact:true}).fill('');
  const first=page.locator('.tt-option-row').filter({has:page.locator('strong',{hasText:/^Verde$/})});
  await first.locator('summary').click();await page.getByLabel('Nombre comercial de Color: Verde',{exact:true}).fill('Verde Claro');
  await page.getByRole('button',{name:'Aplicar nombre de Color: Verde',exact:true}).click();
  await expect(page.locator('#prod-variants-text')).toHaveValue(/Verde Claro/);
  await page.getByRole('button',{name:'Siguiente opción Color: Bordó',exact:true}).click();
  await expect(page.locator('#prod-variants-text')).toHaveValue(/Plateado, Bordó/);
  await page.getByLabel('Círculo de Verde Oliva',{exact:true}).fill('#667744');
  await page.getByRole('button',{name:'Disponibilidad de Color: Bordó',exact:true}).click();
  await expect(page.locator('[data-product-section=availability]')).toBeVisible();
  await expect(page.locator('#prod-stock')).toBeVisible();
  await page.locator('#prod-stock').fill('0');
  await page.evaluate(()=>window.confirm=()=>true);
  await page.getByRole('button',{name:'Usar precios y disponibilidad por combinación',exact:true}).click();
  await expect(page.locator('#prod-stock')).toBeHidden();
  await page.getByLabel('Stock: Verde Claro',{exact:true}).fill('4');
  await page.getByLabel('Stock: Verde Oliva',{exact:true}).fill('2');
  await page.getByLabel('Precio: Verde Oliva',{exact:true}).fill('55000');
  await page.locator('#prod-editor-section').selectOption('inventory');
  const oliveRow=page.locator('.tt-option-row').filter({has:page.locator('strong',{hasText:/^Verde Oliva$/})});await oliveRow.locator('summary').click();
  await page.getByLabel('Nombre comercial de Color: Verde Oliva',{exact:true}).fill('Oliva nueva');await page.getByRole('button',{name:'Aplicar nombre de Color: Verde Oliva',exact:true}).click();
  await expect(page.locator('.tt-editor-control-error')).toContainText('cantidades o precios');await expect(page.locator('#prod-variants-text')).toHaveValue(/Verde Oliva/);
  await page.getByLabel('Disponible: Bordó',{exact:true}).uncheck();
  await expect(page.locator('#prod-publicationStatus')).toHaveValue('draft');
  await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
  const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));
  expect(saved.stock).toBe(6);expect(saved.publicationStatus).toBe('draft');
  expect(saved.variantMedia.find(row=>row.Color==='Verde Oliva').colorHex).toBe('#667744');
  const olive=saved.variantInventory.find(row=>row.attributes.Color==='Verde Oliva');expect(olive.stock).toBe(2);expect(olive.price).toBe(55000);
  const burgundy=saved.variantInventory.find(row=>row.attributes.Color==='Bordó');expect(burgundy.stock).toBe(0);expect(burgundy.active).toBe(false);
  await page.evaluate(()=>window.prodEditar('qa-product-1'));await page.locator('#prod-editor-section').selectOption('inventory');
  await page.getByRole('button',{name:'Quitar Color: Verde Oliva',exact:true}).click();
  await expect(page.getByRole('button',{name:'Restaurar Color: Verde Oliva',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restaurar Color: Verde Oliva',exact:true}).click();
  await expect(page.getByLabel('Círculo de Verde Oliva',{exact:true})).toHaveValue('#667744');
  await page.getByRole('button',{name:'Anterior opción Color: Verde Oliva',exact:true}).click();
  await page.getByLabel('Stock: Verde Oliva',{exact:true}).fill('');
  await expect(page.locator('#prod-variant-stock > [role=alert]')).toContainText('control de stock');
  await page.getByLabel('Stock: Verde Oliva',{exact:true}).fill('1');
  await expect(page.locator('#prod-publicationStatus')).toHaveValue('draft');
  await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
  const changed=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));
  expect(changed.stock).toBe(5);const newOlive=changed.variantInventory.find(row=>row.attributes.Color==='Verde Oliva');
  expect(newOlive.variant).toBe(olive.variant);expect(newOlive.stock).toBe(1);expect(newOlive.price).toBe(55000);
  await page.evaluate(()=>window.prodEditar('qa-product-1'));await page.locator('#prod-editor-section').selectOption('inventory');
  await page.getByRole('button',{name:'Disponibilidad de Color: Verde Oliva',exact:true}).click();await expect(page.getByLabel('Seleccionar Verde Oliva',{exact:true})).toBeFocused();
  await page.locator('#prod-editor-section').selectOption('inventory');
  expect(await page.locator('#prod-form-card').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await page.locator('#prod-form-card .adm-card-body').evaluate(node=>node.scrollTop=0);
  await page.screenshot({path:'artifacts/options-phase3/'+width+'x'+height+'.png',animations:'disabled'});
  await page.locator('#prod-editor-section').selectOption('availability');await page.locator('#prod-form-card .adm-card-body').evaluate(node=>node.scrollTop=0);
  await page.screenshot({path:'artifacts/options-phase3/inventory-'+width+'x'+height+'.png',animations:'disabled'});
 });
}
test('la sugerencia es contextual y jamás crea una opción sin confirmación',async({page})=>{
 await openProductSaveFixture(page,390,844,{photos:true});await page.locator('#prod-editor-section').selectOption('inventory');
 await page.evaluate(()=>{document.querySelector('#prod-imageUrl').value='https://img.test/green.webp';window.TintinProductColors={...window.TintinProductColors,suggestImageColor:async()=>({name:'Dorado'})};});
 const assistance=page.locator('.tt-editor-option-assistance');await assistance.locator('summary').click();
 await assistance.getByRole('button',{name:'Sugerir desde la portada',exact:true}).click();
 await expect(page.locator('#prod-variants-text')).toHaveValue('');
 await assistance.getByRole('button',{name:'Usar sugerencia Dorado',exact:true}).click();
 await expect(page.locator('#prod-variants-text')).toHaveValue('');
 await page.getByLabel('Nueva opción de variante',{exact:true}).fill('Bordó');
 await page.getByRole('button',{name:'Agregar opción',exact:true}).click();await expect(page.locator('#prod-variants-text')).toHaveValue('Color: Bordó');
});

for(const kind of ['simple','sin-control','color-talle'])test('inventario pertinente y persistente: '+kind,async({page})=>{
 await openProductSaveFixture(page,768,1024,{photos:true});
 await page.locator('#prod-editor-section').selectOption('general');await page.locator('#prod-name').fill('Producto '+kind);await page.locator('#prod-description').fill('Descripción ficticia');
 await page.locator('#prod-editor-section').selectOption('prices');await page.locator('#prod-price').fill('45000');
 await page.locator('#prod-editor-section').selectOption('visibility');await page.locator('#prod-category').selectOption('qa-tablet');await page.locator('#prod-publicationStatus').selectOption('draft');
 await page.locator('#prod-editor-section').selectOption('inventory');
 if(kind==='simple'){
  await expect(page.locator('#prod-variant-stock')).toBeHidden();await expect(page.locator('#prod-stock')).toBeVisible();await page.locator('#prod-stock').fill('0');
 }else{
  const add=async(key,name)=>{await page.getByLabel('Característica de variante',{exact:true}).selectOption(key);await page.getByLabel('Nueva opción de variante',{exact:true}).fill(name);await page.getByRole('button',{name:'Agregar opción',exact:true}).click();};
  await add('Color','Verde');
  if(kind==='color-talle'){await add('Color','Plateado');await add('Talle','M');await add('Talle','L');}
  await page.locator('#prod-stock').fill('0');await page.evaluate(()=>window.confirm=()=>true);await page.getByRole('button',{name:'Usar precios y disponibilidad por combinación',exact:true}).click();
  if(kind==='sin-control')await page.getByLabel('Stock: Verde',{exact:true}).fill('');
  else {await page.getByLabel('Stock: Verde / M',{exact:true}).fill('2');await page.getByLabel('Precio: Verde / L',{exact:true}).fill('65000');}
 }
 await expect(page.locator('#prod-publicationStatus')).toHaveValue('draft');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const saved=await page.evaluate(()=>window.qaProductStore.get('products/qa-product-1'));
 expect(saved.publicationStatus).toBe('draft');
 if(kind==='simple')expect(saved.stock).toBe(0);
 else if(kind==='sin-control'){expect(saved.stock).toBeNull();expect(saved.variantInventory[0].stock).toBeNull();}
 else {
  expect(saved.variantInventory).toHaveLength(4);
  const quoted=await page.evaluate(async saved=>{const path='/js/core/store/inventario-variantes.mjs';const core=await import(path);return [core.productVariantPrice(saved,'Verde / L').price,core.productVariantPrice(saved,'Verde / M').price,core.variantStockLimit(saved,'Verde / M')];},saved);
  expect(quoted).toEqual([65000,45000,2]);
 }
 await page.evaluate(()=>window.prodEditar('qa-product-1'));await page.locator('#prod-editor-section').selectOption('inventory');
 if(kind==='simple')await expect(page.locator('#prod-stock')).toHaveValue('0');
 else if(kind==='sin-control')await expect(page.getByLabel('Stock: Verde',{exact:true})).toHaveValue('');
 else await expect(page.getByLabel('Precio: Verde / L',{exact:true})).toHaveValue('65000');
});
