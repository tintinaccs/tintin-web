'use strict';
const {test,expect}=require('@playwright/test');
const {mockRuntime}=require('./helpers/admin-commerce-fixture.cjs');

test.beforeEach(async ({ page }) => {
  await mockRuntime(page);
  await page.goto('https://tintin.test/admin-commerce-fixture');
  await expect(page.locator('#tt-commerce-products .tt-commerce-title')).toContainText('Productos');
  await expect(page.locator('#tt-commerce-collections .tt-commerce-title')).toContainText('Colecciones');
  await expect(page.locator('#tt-commerce-orders .tt-commerce-title')).toContainText('Gestión de pedidos');
});

test('renderiza los tres módulos con datos, filtros y colores Tintin', async ({ page }) => {
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
  await expect(page.locator('#tt-commerce-collections tbody tr')).toHaveCount(3);
  await expect(page.locator('#tt-commerce-orders .tt-order-card')).toHaveCount(2);

  await page.locator('[data-filter="product-search"]').fill('pulsera');
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(1);
  await expect(page.locator('#tt-commerce-products tbody')).toContainText('Pulsera Cuero Café');

  const primary = page.locator('#tt-commerce-products .tt-commerce-btn.primary').first();
  await expect(primary).toHaveCSS('background-color', 'rgb(173, 63, 103)');
  await expect(page.locator('#prod-list-card')).toBeHidden();
  await expect(page.locator('#coll-list-card')).toBeHidden();
  await expect(page.locator('#orders-legacy')).toBeHidden();
});

test('abre ficha rápida y reutiliza la edición real de producto', async ({ page }) => {
  await page.getByRole('button', { name: 'Reloj Clásico Negro', exact: true }).click();
  await expect(page.locator('#tt-commerce-drawer')).toHaveClass(/open/);
  await expect(page.locator('#tt-commerce-drawer')).toContainText('Reloj Clásico Negro');
  await page.locator('[data-action="drawer-product-edit"]').click();
  expect(await page.evaluate(() => window.__calls)).toContainEqual(['prodEditar', 'p-reloj']);
});

test('oculta el listado avanzado mientras se abre el formulario existente', async ({ page }) => {
  await page.locator('[data-action="product-new"]').click();
  await expect(page.locator('#prod-form-card')).toBeVisible();
  await expect(page.locator('#tt-commerce-products')).toBeHidden();
  expect(await page.evaluate(() => window.__calls)).toContainEqual(['prodNuevo']);
});

test('colecciones navegan a sus productos sin inventar colecciones inteligentes', async ({ page }) => {
  await page.locator('tr[data-open="collection"][data-id="relojes"]').click();
  await expect(page.locator('#tt-commerce-drawer')).toContainText('Relojes');
  await page.locator('[data-action="drawer-collection-products"]').click();
  await expect(page.locator('[data-filter="product-category"]')).toHaveValue('relojes');
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(1);
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveAttribute('data-id','p-reloj');
  await expect(page.locator('#tt-commerce-collections')).not.toContainText('Automatizada');
});

test('pedido separa entrega/pago y ejecuta los contratos existentes', async ({ page }) => {
  await page.locator('[data-action="drawer-order"][data-id="1024"]').click();
  const drawer = page.locator('#tt-commerce-drawer');
  await expect(drawer).toContainText('María González');
  await expect(drawer).toContainText('135.000 Gs');

  await drawer.locator('[data-drawer-order-status="1024"]').selectOption('preparando');
  await drawer.locator('[data-drawer-order-pay="1024"]').selectOption('reembolsado');
  await drawer.locator('[data-action="drawer-order-save"]').click();
  const calls = await page.evaluate(() => window.__calls);
  expect(calls.filter(c=>c[0]==='updateOrderStatus')).toHaveLength(1);
  expect(calls.find(c=>c[0]==='updateOrderStatus')).toEqual(['updateOrderStatus','1024','preparando',expect.objectContaining({paymentStatus:'reembolsado'})]);
  expect(calls.filter(c=>c[0]==='updatePayStatus')).toHaveLength(0);
});

test('la interfaz sigue utilizable en móvil sin desbordar el documento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#tt-commerce-products')).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 2);
  await page.getByRole('button', { name: 'Reloj Clásico Negro', exact: true }).click();
  await expect(page.locator('#tt-commerce-drawer')).toBeVisible();
  await expect(page.locator('#tt-commerce-drawer')).toHaveClass(/open/);
  const box = await page.locator('#tt-commerce-drawer').boundingBox();
  expect(box?.width || 9999).toBeLessThanOrEqual(390.5);
});


test('un fallo de montaje conserva el listado de Productos en todos los tamaños',async({page})=>{
  await page.addInitScript(()=>{
    const native=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    Object.defineProperty(Element.prototype,'innerHTML',{...native,set(value){
      if(this.id==='tt-commerce-products'&&!window.qaMountFailed){window.qaMountFailed=true;throw Error('Fallo de montaje controlado');}
      return native.set.call(this,value);
    }});
  });
  await page.goto('https://tintin.test/admin-commerce-fixture');
  await expect.poll(()=>page.evaluate(()=>window.qaMountFailed)).toBe(true);
  for(const [width,height] of [[320,568],[390,844],[540,900],[600,960],[768,1024],[820,1180],[844,390],[1024,768],[1180,820],[1366,768],[1920,1080],[2560,1440],[3840,2160]]){
    await page.setViewportSize({width,height});
    await expect(page.locator('#prod-list-card')).toBeVisible();
    await expect(page.locator('#tt-commerce-products')).toBeEmpty();
    await expect(page.locator('#section-productos')).not.toHaveClass(/tt-commerce-mounted/);
  }
});
