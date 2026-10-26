'use strict';
const fs=require('node:fs');
const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
for(const width of [320,390,600,768,1024,1440])test(`espacio de edición visual ${width}`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const presentationSource=process.env.EDITOR_REDESIGN_BASELINE ? require('node:child_process').execFileSync('git',['show','ed574b1c5:js/admin/products/interfaz-productos-adaptable.js'],{encoding:'utf8'}) : null;
 await openProductSaveFixture(page,width,900,{fullShell:true,photos:true,workflow:true,presentationSource});
 await page.evaluate(()=>window.qaProductController.workspace.ready);
 if(process.env.EDITOR_REDESIGN_BASELINE)await page.locator('#prod-editor-section').evaluate(select=>select.value='all');
 await page.route('**/assets-tintin/images/home/editorial-relojes/editorial-relojes-desktop.webp',route=>route.fulfill({contentType:'image/webp',body:fs.readFileSync('assets-tintin/images/home/editorial-relojes/editorial-relojes-desktop.webp')}));
 await page.locator('#prod-name').fill('Reloj Aurora');
 await page.evaluate(()=>{document.getElementById('prod-price').value='180000';document.getElementById('prod-stock').value='5';document.getElementById('prod-category').value='qa-tablet';});
 await page.locator('#prod-description').fill('Diseño delicado, acabado dorado y detalles que acompañan todos los días.');
 await page.evaluate(()=>{const input=document.getElementById('prod-imageUrl');input.value='https://tintin.test/assets-tintin/images/home/editorial-relojes/editorial-relojes-desktop.webp';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#prod-form-title')).toHaveText('Reloj Aurora');
 await page.evaluate(()=>document.activeElement?.blur());await page.locator('#prod-form-card .adm-card-body').evaluate(el=>el.scrollTop=0);
 await expect(page.locator('#prod-live-preview .tt-editor-cover img')).toHaveJSProperty('complete',true);
 await page.screenshot({path:`/tmp/tintin-studio/${process.env.EDITOR_REDESIGN_BASELINE?'antes':'despues'}-${width}.png`,animations:'disabled'});
 if(process.env.EDITOR_REDESIGN_BASELINE)return;
 await expect(page.locator('.tt-editor-studio')).toBeVisible();
 await expect(page.locator('#prod-editor-section')).toHaveValue('general');
 if(width>=1024)await page.locator('[data-editor-section-link=visibility]').click();else await page.locator('#prod-editor-section').selectOption('visibility');
 await expect(page.locator('#prod-publicationStatus')).toBeVisible();await expect(page.locator('#prod-active')).toBeHidden();
 const nav=page.locator('.tt-editor-section-links');
 if(width>=1024){await expect(nav).toBeVisible();await nav.locator('[data-editor-section-link="prices"]').click();}
 else {await expect(nav).toBeHidden();await page.locator('#prod-editor-section').selectOption('prices');}
 await expect(page.locator('#prod-price')).toBeVisible();await page.locator('#prod-price').fill('180000');
 if(width>=1024)await nav.locator('[data-editor-section-link="general"]').click();else await page.locator('#prod-editor-section').selectOption('general');
 await expect(page.locator('#prod-name')).toHaveValue('Reloj Aurora');
 await expect(page.locator('#prod-save-btn')).toBeInViewport();
 expect(await page.locator('#prod-form-card').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 if(width===390){await page.setViewportSize({width:1440,height:900});await expect(page.locator('.tt-editor-preview-shell')).toHaveJSProperty('open',true);await expect(page.locator('#prod-live-preview')).toBeVisible();}
 expect(errors).toEqual([]);
});
