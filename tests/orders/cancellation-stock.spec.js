const {test,expect}=require('@playwright/test');
async function open(page, status='cancelado') {
 await page.addInitScript(value => { window.fixtureStatus = value; }, status);
 await page.route('**/__cancel-stock',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><button id="open">Cambiar pedido</button><script type="module">import {chooseCancellationStock} from '../../js/admin/orders/seleccion-stock-cancelacion.mjs';window.choose=()=>chooseCancellationStock({id:'fixture_order',orderNumber:'TINPED99'},window.fixtureStatus);document.getElementById('open').onclick=()=>{window.result='waiting';window.choose().then(value=>window.result=value)};</script></html>`}));
 await page.goto('/__cancel-stock');await page.locator('#open').click();await expect(page.getByRole('dialog')).toBeVisible();
}
for(const width of [320,768,1440]) for(const decision of ['release','keep']) test(`confirmar stock ${decision} en ${width}px exige selección explícita`,async({page})=>{
 await page.setViewportSize({width,height:900});await open(page);
 await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.evaluate(()=>window.result)).toBe('waiting');
 const buttons=page.getByRole('dialog').getByRole('button');
 for(const button of await buttons.all()) {const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);}
 await page.locator(`[data-stock-decision="${decision}"]`).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.result)).toBe(decision);await expect(page.locator('#open')).toBeFocused();
});
test('Escape y Volver cierran sin una decisión de stock',async({page})=>{
 await open(page);await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.result)).toBe(null);await expect(page.locator('#open')).toBeFocused();
 await page.locator('#open').click();await page.locator('[data-stock-decision="back"]').click();expect(await page.evaluate(()=>window.result)).toBe(null);
});
test('rechazar también pide decisión y una segunda operación no apila selectores',async({page})=>{
 await open(page,'rechazado');await expect(page.getByRole('heading')).toHaveText('Rechazar pedido: elegí el stock');expect(await page.evaluate(()=>window.choose())).toBe(null);await expect(page.getByRole('dialog')).toHaveCount(1);await page.keyboard.press('Escape');
});
test('el selector usa los tokens del modo oscuro móvil del panel',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await page.addStyleTag({path:'css/admin/admin-color-tokens.css'});await page.addStyleTag({path:'css/admin/app-movil-admin.css'});
 await page.evaluate(()=>document.documentElement.classList.add('adm-app','adm-dark'));
 await expect(page.getByRole('dialog')).toHaveCSS('background-color','rgb(31, 25, 30)');
 await expect(page.getByRole('dialog')).toHaveCSS('color','rgb(243, 233, 238)');await page.keyboard.press('Escape');
});
