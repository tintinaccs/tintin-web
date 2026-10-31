const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
for(const [width,height] of [[320,568],[360,800],[375,812],[390,844],[430,932],[768,1024],[820,1180],[1024,768],[1180,820],[1280,720],[1366,768],[1440,900],[1920,1080]]) {
 test(`descripción conserva líneas, pasos y scroll ${width}x${height}`,async({page})=>{
  await openProductSaveFixture(page,width,height);
  const field=page.locator('#prod-description');
  await field.fill('Primera línea\nSegunda línea\nÚltima línea');
  expect(await field.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  await field.fill('Descripción mediana\n'.repeat(7));
  expect(await field.evaluate(el=>el.scrollHeight<=el.clientHeight+1 || el.clientHeight>=innerHeight*.5)).toBe(true);
  await field.fill(Array.from({length:100},(_,i)=>`Línea ${i+1}: descripción completa, diseño y cuidados.`).join('\n'));
  const long=await field.inputValue();
  await expect(field).toHaveValue(long);
  expect(await field.evaluate(el=>el.clientHeight<=innerHeight*.65)).toBe(true);
  await page.getByRole('tab',{name:'Fotos y opciones',exact:true}).click();
  await page.getByRole('tab',{name:'Información',exact:true}).click();
  await expect(field).toHaveValue(long);
  await field.evaluate(el=>{el.scrollTop=el.scrollHeight;el.focus({preventScroll:true});});
  await field.press('End');
  await expect(field).toHaveValue(long);
  expect(await page.locator('#prod-form-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  if([390,820,1440].includes(width))await page.screenshot({path:`artifacts/prompt-maestro/editor-${width}.png`});
 });
}
