const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {removeFixtureScripts}=require('../../scripts/lib/html-layout-fixture.js');
const html=fs.readFileSync('checkout.html','utf8');
const start=html.indexOf('function applySavedCheckoutIdentity(');
const helper=html.slice(start,html.indexOf('// ---- STEP 3: DATOS ----',start));
const fixture=removeFixtureScripts(html).replace('</body>',`<script type="module">
const namesPath='/js/pages/profile/configuracion-inicial-perfil.mjs';
const phonePath='/js/components/forms/utilidades-telefono.js';
const {readProfileName,isValidFullName}=await import(namesPath);
const {normalizePhone,DEFAULT_COUNTRY,isNationalMobileInput}=await import(phonePath);
${helper}
window.applyIdentity=applySavedCheckoutIdentity;
document.getElementById('panel-2').style.display='block';
document.documentElement.classList.remove('tt-store-gate-pending');
</script></body>`);
for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900]]) {
  test(`checkout reutiliza identidad y limpia los datos al cambiar de cuenta en ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.route('**/__saved-identity',route=>route.fulfill({contentType:'text/html',body:fixture}));
    await page.goto('/__saved-identity');await page.waitForFunction(()=>window.applyIdentity);
    await page.evaluate(()=>window.applyIdentity({firstName:'Pedro',lastName:'González',phone:'+595981123456'},{uid:'saved',email:'saved@example.com'}));
    await expect(page.locator('#ck-name-field')).toBeHidden();await expect(page.locator('#ck-phone-field')).toBeHidden();
    await expect(page.locator('#ck-saved-identity')).toContainText('Pedro González');
    expect(await page.locator('#ck-name').inputValue()).toBe('Pedro González');
    expect(await page.locator('#ck-phone-number').inputValue()).toBe('981123456');
    await page.evaluate(()=>window.applyIdentity(null,null));
    await expect(page.locator('#ck-name-field')).toBeVisible();await expect(page.locator('#ck-phone-field')).toBeVisible();
    await expect(page.locator('#ck-saved-identity')).toBeHidden();
    expect(await page.locator('#ck-name').inputValue()).toBe('');expect(await page.locator('#ck-phone-number').inputValue()).toBe('');
    await page.evaluate(()=>window.applyIdentity({name:'Ana Díaz'}, {uid:'partial'}));
    await expect(page.locator('#ck-name-field')).toBeHidden();await expect(page.locator('#ck-phone-field')).toBeVisible();
  });
}
