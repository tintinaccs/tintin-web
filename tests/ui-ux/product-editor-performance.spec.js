const {test,expect}=require('@playwright/test');
const {openProductSaveFixture}=require('./helpers/product-save-fixture.cjs');
test('mil combinaciones conservan datos completos con galería paginada y escritura sin refrescar fotos',async({page})=>{
 const colors=Array.from({length:25},(_,i)=>'Color '+i),sizes=Array.from({length:40},(_,i)=>'Talle '+i);
 const inventory=colors.flatMap((color,i)=>sizes.map((size,j)=>({variant:'qa-'+i+'-'+j,attributes:{Color:color,Talle:size},stock:1})));
 const product={name:'Carga QA',category:'qa-tablet',price:35000,stock:1000,active:true,publicationStatus:'active',variantCommerceVersion:2,variants:{Color:colors,Talle:sizes},variantInventory:inventory};
 await openProductSaveFixture(page,1440,900,{photos:true,workflow:true,initialRecords:[['products/load',product]]});
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('load');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.getByRole('tab',{name:'Variantes',exact:true}).click();await expect(page.locator('.tt-variant-media-card')).toHaveCount(25);
 await page.getByRole('button',{name:'Siguientes fotos de variantes',exact:true}).click();await expect(page.locator('.tt-variant-media-list')).toContainText('página 2 de 43');
 await expect(page.getByRole('button',{name:'Siguientes fotos de variantes',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>{const detail={};document.getElementById('prod-form-card').dispatchEvent(new CustomEvent('tintin:commercial-options-read',{detail}));return {count:detail.product.variantInventory.length,total:detail.product.variantInventory.reduce((n,row)=>n+row.stock,0)};})).toEqual({count:1000,total:1000});
 await page.getByRole('tab',{name:'Información',exact:true}).click();await page.waitForTimeout(150);
 await page.evaluate(()=>{window.mediaReads=0;document.getElementById('prod-form-card').addEventListener('tintin:option-media-read',()=>window.mediaReads++);});
 await page.locator('#prod-name').pressSequentially('abc',{delay:40});await page.waitForTimeout(150);expect(await page.evaluate(()=>window.mediaReads)).toBe(0);
});

test('salir del buscador aplica el filtro y no reemplaza la cantidad mientras se edita',async({page})=>{
 const product={name:'Filtro QA',category:'qa-tablet',price:35000,stock:2,active:true,publicationStatus:'draft',variantCommerceVersion:2,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'gold',attributes:{Color:'Dorado'},stock:1},{variant:'silver',attributes:{Color:'Plateado'},stock:1}]};
 await openProductSaveFixture(page,390,844,{photos:true,workflow:true,initialRecords:[['products/filter',product]]});
 await page.evaluate(()=>{window.qaProductController.refresh();window.prodEditar('filter');});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.getByRole('tab',{name:'Precio y stock',exact:true}).click();
 await page.clock.install();
 const search=page.getByRole('searchbox',{name:'Buscar combinación',exact:true});
 await search.fill('Dorado');await search.press('Tab');
 await expect(page.locator('#prod-variant-stock .tt-commercial-row')).toHaveCount(1);
 const stock=page.getByLabel('Stock: Dorado',{exact:true});
 await stock.fill('7');await expect(stock).toBeFocused();
 await page.evaluate(()=>window.qaFocusedStock=document.activeElement);
 await page.clock.runFor(500);
 expect(await stock.evaluate(node=>node===window.qaFocusedStock)).toBe(true);
 await expect(stock).toBeFocused();await expect(stock).toHaveValue('7');
 expect(await page.evaluate(()=>{const detail={};document.getElementById('prod-form-card').dispatchEvent(new CustomEvent('tintin:commercial-options-read',{detail}));return detail.product.variantInventory.map(row=>row.stock);})).toEqual([7,1]);
});
