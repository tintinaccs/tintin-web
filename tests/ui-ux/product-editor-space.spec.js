const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
for(const [width,height] of [[320,568],[390,844],[600,960],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]])test(`edición amplia y vista previa al final ${width}x${height}`,async({page},info)=>{
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
 if(width>=1100){const controls=await page.locator('.tt-photo-product-controls').boundingBox(),photo=await page.locator('.tt-unified-photos').boundingBox();expect(controls.width).toBeGreaterThan(photo.width);}
 expect(await page.locator('#prod-form-card').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await body.evaluate(node=>node.scrollTop=0);await page.screenshot({path:info.outputPath(`editor-${width}.png`)});
 await preview.locator('summary').click();await expect(page.locator('#prod-live-preview')).toBeVisible();
 expect(await page.locator('#prod-live-preview').evaluate(node=>getComputedStyle(node).position)).toBe('static');
 await page.evaluate(()=>window.qaProductController.workspace.save());await expect(page.locator('#prod-name')).toHaveValue('Producto con espacio para editar');
 expect(await body.evaluate(node=>node.lastElementChild.classList.contains('tt-editor-preview-shell'))).toBe(true);
});
