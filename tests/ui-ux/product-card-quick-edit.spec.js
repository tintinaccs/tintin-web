const {test,expect}=require('@playwright/test');
const {mockRuntime}=require('./helpers/admin-commerce-fixture.cjs');
async function loadCards(page,width,height=844){
 await page.setViewportSize({width,height});await mockRuntime(page);await page.goto('https://tintin.test/admin-commerce-fixture');
 await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
 await page.evaluate(async()=>{
  const product=window.__productRows[0].data;
  Object.assign(product,{variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:0},{variant:'Plateado',stock:3}],stock:3,variantMedia:[{Color:'Dorado',imageUrl:'https://img.test/dorado.webp'},{Color:'Plateado',imageUrl:'https://img.test/plateado.webp'}]});
  window.__cardCalls=[];
  const {productCardPatch,productFingerprint}=await import('../../js/admin/products/maestro-productos-core.mjs');
  window.TintinProductAdmin={async updateCard(request){
   const item=window.__productRows.find(row=>row.id===request.id);window.__cardCalls.push(request);
   if(productFingerprint(item.data)!==request.expected)throw Error('El producto cambió en otra sesión.');
   Object.assign(item.data,productCardPatch(item.data,request));window.__publishProducts();return{status:'green',value:{confirmed:true,fingerprint:productFingerprint(item.data)}};
  }};
  window.__publishProducts();
 });
}
for(const [width,height] of [[320,740],[390,844],[600,960],[768,1024],[1024,768],[820,1180],[1180,820],[1366,768],[1440,900],[1920,1080]]){
 test(`tarjeta ordenada y stock por color en ${width}x${height}`,async({page})=>{
  await loadCards(page,width,height);
  const card=page.locator('#tt-commerce-products tbody tr[data-id="p-reloj"]');
  await expect(card.getByRole('button',{name:'Plateado',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('.tt-commerce-thumb img')).toHaveAttribute('src',/plateado/);
  await card.getByRole('button',{name:'Dorado · agotado',exact:true}).click();
  await expect(card.locator('[data-card-stock]')).toHaveValue('0');
  await expect(card.locator('.tt-commerce-thumb img')).toHaveAttribute('src',/dorado/);
  await card.locator('[data-card-stock]').fill('500');
  await card.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(card.locator('[data-card-stock]')).toHaveValue('500');
  expect(await page.evaluate(()=>window.__productRows[0].data.stock)).toBe(503);
  await card.getByRole('button',{name:'Plateado',exact:true}).click();
  await expect(card.locator('[data-card-stock]')).toHaveValue('3');
  if(width===390)await expect(card.getByRole('button',{name:'Plateado',exact:true})).toBeFocused();
  await card.locator('[data-card-active]').selectOption('false');
  await expect(card.locator('.tt-commerce-badge').filter({hasText:'Inactivo'})).toHaveCount(1);
  expect(await page.evaluate(()=>window.__productRows[0].data.active)).toBe(false);
  if(width===390||width===1440)await page.screenshot({path:test.info().outputPath('product-card.png'),fullPage:true});
  const geometry=await card.evaluate(node=>({width:node.clientWidth,scroll:node.scrollWidth,controls:[...node.querySelectorAll('input,select,button')].filter(el=>el.getClientRects().length).map(el=>{const b=el.getBoundingClientRect();return{x:b.x,right:b.right,width:b.width};}),box:node.getBoundingClientRect().toJSON(),page:document.documentElement.scrollWidth,viewport:innerWidth}));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);expect(geometry.page).toBeLessThanOrEqual(geometry.viewport+1);
  for(const control of geometry.controls){expect(control.x).toBeGreaterThanOrEqual(geometry.box.x-1);expect(control.right).toBeLessThanOrEqual(geometry.box.right+1);}
 });
}
test('una actualización remota conserva el borrador y detecta el conflicto al guardar',async({page})=>{
 await loadCards(page,390);
 const card=page.locator('tr[data-id="p-reloj"]');
 await card.locator('[data-card-stock]').fill('20');
 await page.evaluate(()=>{window.__productRows[0].data.variantInventory[0].stock=1;window.__productRows[0].data.variantInventory[1].stock=2;window.__productRows[0].data.stock=3;window.__publishProducts();});
 await expect(card.locator('[data-card-stock]')).toHaveValue('20');
 await expect(card.locator('[data-card-stock]')).toBeFocused();
 await card.getByRole('button',{name:'Guardar',exact:true}).click();
 expect(await page.evaluate(()=>window.__productRows[0].data.stock)).toBe(3);
 await card.getByRole('button',{name:'Descartar borrador'}).click();
 await expect(card.locator('[data-card-stock]')).toHaveValue('2');
 await card.locator('[data-card-stock]').fill('20');
 await card.getByRole('button',{name:'Guardar',exact:true}).click();
 expect(await page.evaluate(()=>window.__productRows[0].data.stock)).toBe(21);
});
test('cambiar de cuenta descarta la cantidad pendiente y el color de la sesión anterior',async({page})=>{
 await loadCards(page,390);
 const card=page.locator('tr[data-id="p-reloj"]');
 await card.getByRole('button',{name:'Dorado · agotado',exact:true}).click();
 await card.locator('[data-card-stock]').fill('25');
 await page.evaluate(async()=>{
  const {auth}=await import('../../js/core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1');
  const user={uid:'another-admin',email:'tintinaccs@gmail.com',isAnonymous:false};auth.currentUser=user;window.__authCallback(user);
 });
 await expect(card.getByRole('button',{name:'Plateado',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(card.locator('[data-card-stock]')).toHaveValue('3');
 await card.getByRole('button',{name:'Dorado · agotado',exact:true}).click();
 await expect(card.locator('[data-card-stock]')).toHaveValue('0');
 expect(await page.evaluate(()=>window.__cardCalls.length)).toBe(0);
});

for(const [id,index] of [['p-reloj',0],['p-pulsera',1]])test(`guardar un estado propio conserva la cantidad pendiente de ${id}`,async({page})=>{
 await loadCards(page,390);
 const card=page.locator(`tr[data-id="${id}"]`);
 await card.locator('[data-card-stock]').fill('20');
 await card.locator('[data-card-active]').selectOption('false');
 await expect(card.locator('[data-card-stock]')).toHaveValue('20');
 await card.getByRole('button',{name:'Guardar',exact:true}).click();
 expect(await page.evaluate(index=>window.__productRows[index].data.stock,index)).toBe(20);
 expect(await page.evaluate(index=>window.__productRows[index].data.active,index)).toBe(false);
});
