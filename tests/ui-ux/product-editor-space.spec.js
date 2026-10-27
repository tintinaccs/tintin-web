const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
for(const [width,height] of [[320,568],[360,800],[375,812],[390,844],[430,932],[600,960],[568,320],[640,360],[667,375],[736,414],[852,393],[719,960],[720,960],[744,1133],[768,1024],[810,1080],[820,1180],[834,1194],[1024,1366],[1024,768],[1080,810],[1133,744],[1180,820],[1194,834],[1366,1024],[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080],[2560,1440],[3440,1440],[3840,2160]])test(`edición amplia y vista previa al final ${width}x${height}`,async({page},info)=>{
 await openProductSaveFixture(page,width,height,{fullShell:true,photos:true,workflow:true});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.locator('#prod-name').fill('Producto con espacio para editar');
 const body=page.locator('#prod-form-card .adm-card-body'),preview=page.locator('.tt-editor-preview-shell');
 await expect(preview).not.toHaveAttribute('open','');
 await expect(page.locator('.tt-product-section-nav .tt-editor-preview-jump')).toHaveCount(0);
 expect(await body.evaluate(node=>node.lastElementChild.classList.contains('tt-editor-preview-shell'))).toBe(true);
 expect(await page.locator('.tt-product-section-nav').evaluate(node=>getComputedStyle(node).position)).toBe('static');
 const gallery=await page.locator('.tt-unified-photos').evaluate(node=>({position:getComputedStyle(node).position,maxHeight:getComputedStyle(node).maxHeight,overflow:getComputedStyle(node).overflowY}));
 expect(gallery.position).not.toBe('sticky');expect(gallery.maxHeight).toBe('none');expect(['auto','scroll']).not.toContain(gallery.overflow);
 expect(await page.locator('#prod-name').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
 if(width>=720){const controls=await page.locator('.tt-photo-product-controls').boundingBox(),photo=await page.locator('.tt-unified-photos').boundingBox();expect(controls.width).toBeGreaterThan(photo.width);expect(photo.x+photo.width).toBeLessThanOrEqual(controls.x+1);expect(Math.abs(controls.y-photo.y)).toBeLessThanOrEqual(2);}
 expect(await page.locator('#prod-form-card').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await body.evaluate(node=>node.scrollTop=0);if(width<=1440)await page.screenshot({path:info.outputPath(`editor-${width}.png`)});
 await preview.locator('summary').click();await expect(page.locator('#prod-live-preview')).toBeVisible();
 expect(await page.locator('#prod-live-preview').evaluate(node=>getComputedStyle(node).position)).toBe('static');
 await page.evaluate(()=>window.qaProductController.workspace.save());await expect(page.locator('#prod-name')).toHaveValue('Producto con espacio para editar');
 expect(await body.evaluate(node=>node.lastElementChild.classList.contains('tt-editor-preview-shell'))).toBe(true);
});
test('rotar y reducir el área visible conserva campos, foco y un único aviso',async({page})=>{
 await openProductSaveFixture(page,820,1180,{fullShell:true,photos:true,workflow:true});
 await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.locator('#prod-name').fill('Producto durante rotación');
 await page.evaluate(()=>window.qaHtmlResponse=true);
 await page.locator('#prod-save-btn').click();
 const message='El servidor no confirmó el guardado. Conservá el editor abierto y reintentá.';
 for(const [width,height] of [[1180,820],[820,640],[640,410],[320,568],[820,1180]]){
  await page.setViewportSize({width,height});
  await expect(page.getByText(message,{exact:true})).toHaveCount(1);
  await expect(page.locator('#prod-name')).toHaveValue('Producto durante rotación');
  expect(await page.locator('#prod-form-card').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await page.locator('#prod-name').click();
  await expect(page.locator('#prod-name')).toBeFocused();
  await expect(page.locator('#prod-name')).toBeInViewport();
  await expect(page.getByRole('button',{name:'Reintentar',exact:true})).toBeInViewport();
 }
 const retry=page.getByRole('button',{name:'Reintentar',exact:true});
 await retry.evaluate(button=>button.addEventListener('click',()=>{window.qaHtmlResponse=false;},{capture:true,once:true}));
 await retry.click();
 await expect(page.locator('.tt-work-status')).toHaveAttribute('data-state','saved');
 await expect(page.getByText(message,{exact:true})).toHaveCount(0);
});
