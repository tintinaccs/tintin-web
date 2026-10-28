'use strict';
const {test,expect}=require('@playwright/test');
const {openProductSaveFixture,openOptionAvailability}=require('./helpers/product-save-fixture.cjs');
async function open(page,width=1440,height=900){await openProductSaveFixture(page,width,height,{fullShell:true,photos:true,workflow:true});await page.evaluate(()=>window.qaProductController.workspace.ready);}

test('galería: eventos sin cambios conservan nodos y foco',async({page,browser},info)=>{
 const baselineRef=process.env.EDITOR_MEASURE_BASELINE_REF;
 if(baselineRef || process.env.EDITOR_MEASURE_BASELINE){const gallerySource=require('node:child_process').execFileSync('git',['show',`${baselineRef || '5dc6f781'}:js/admin/products/galeria-unificada.js`],{encoding:'utf8'});await openProductSaveFixture(page,1440,900,{fullShell:true,photos:true,workflow:true,gallerySource});await page.evaluate(()=>window.qaProductController.workspace.ready);}
 else await open(page);
 const result=await page.evaluate(async()=>{
  const input=document.getElementById('prod-images-extra');input.value=Array.from({length:5},(_,i)=>`https://img.test/${i}.webp`).join('\n');input.dispatchEvent(new Event('input',{bubbles:true}));
  const grid=document.querySelector('.tt-unified-photo-grid'),before=[...grid.children];let removed=0;
  const observer=new MutationObserver(records=>{for(const record of records)removed+=record.removedNodes.length;});observer.observe(grid,{childList:true});
  const times=[];
  for(let sample=0;sample<5;sample++){const start=performance.now();for(let i=0;i<20;i++)input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(requestAnimationFrame);times.push(performance.now()-start);}
  observer.disconnect();return {removed,sameNodes:before.every((node,index)=>node===grid.children[index]),times,browser:navigator.userAgent};
 });
 await info.attach('gallery-events.json',{body:JSON.stringify({...result,baselineRef:baselineRef || null,browserVersion:browser.version(),playwright:require('@playwright/test/package.json').version}),contentType:'application/json'});
 if(process.env.EDITOR_MEASURE_BASELINE && !baselineRef){expect(result.removed).toBe(500);expect(result.sameNodes).toBe(false);}
 else{expect(result.removed).toBe(0);expect(result.sameNodes).toBe(true);}
});

for(const width of [320,390,600,768,1024,1440])test(`ciclo editorial y diálogo sin pérdida ${width}`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await open(page,width,900);
 await expect(page.getByRole('button',{name:'Guardar progreso',exact:true})).toHaveCount(0);
 await page.locator('.tt-work-back').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 await page.evaluate(()=>window.prodNuevo());await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.locator('#prod-name').fill('Borrador incompleto');
 await page.evaluate(()=>window.qaProductController.workspace.save());
 await page.locator('.tt-work-back').click();const dialog=page.locator('.tt-work-exit-dialog');await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Seguir editando',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(page.locator('#prod-name')).toHaveValue('Borrador incompleto');
 await page.locator('.tt-work-back').click();
 for(const button of await dialog.locator('button').all()){
  await expect(button).toBeInViewport();const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await button.evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 }
 expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath(`cancel-${width}.png`),animations:'disabled'});
 await dialog.getByRole('button',{name:'Guardar borrador y salir',exact:true}).click();await expect(page.locator('#prod-form-card')).toBeHidden();
 const key=await page.evaluate(()=>[...window.qaProductStore].find(([path])=>path.startsWith('productEditorWorkspaces/'))[1].key);
 await page.evaluate(key=>window.prodContinuarBorrador(key),key);await page.evaluate(()=>window.qaProductController.workspace.ready);
 await expect(page.locator('#prod-name')).toHaveValue('Borrador incompleto');
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(()=>[...window.qaProductStore.keys()].filter(key=>key.startsWith('products/')))).toEqual([]);
 expect(errors).toEqual([]);
});

test('descartar es explícito y un error de escritura conserva el borrador',async({page})=>{
 await open(page);await page.locator('#prod-name').fill('Conservar ante fallo');await page.evaluate(()=>window.qaProductController.workspace.save());
 await page.locator('.tt-work-back').click();await page.evaluate(()=>window.qaRejectSave=true);
 await page.getByRole('button',{name:'Descartar cambios y salir',exact:true}).click();
 await expect(page.locator('.tt-work-exit-dialog [role=alert]')).toContainText('No se pudo descartar');await expect(page.locator('#prod-form-card')).toBeVisible();
 await page.evaluate(()=>window.qaRejectSave=false);await page.getByRole('button',{name:'Descartar cambios y salir',exact:true}).click();await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(()=>[...window.qaProductStore].filter(([path,row])=>path.startsWith('productEditorWorkspaces/') && !row.closed))).toEqual([]);
 expect(await page.evaluate(()=>[...window.qaProductStore.keys()].filter(path=>path.startsWith('products/')))).toEqual([]);
});

test('retiro y restauración de opción guardada preserva el producto público hasta guardar',async({page})=>{
 await open(page);await page.locator('.tt-work-back').click();
 await page.evaluate(()=>{
  window.qaProductStore.set('products/existing',{name:'Anillo',category:'qa-tablet',description:'Completa',imageUrl:'https://img.test/gold.webp',price:30000,priceBefore:40000,active:true,publicationStatus:'active',oferta:false,destacado:false,variantCommerceVersion:2,variants:{Color:['Oro','Plata'],Talle:['M']},variantInventory:[{variant:'gold',attributes:{Color:'Oro',Talle:'M'},stock:3,price:45000},{variant:'silver',attributes:{Color:'Plata',Talle:'M'},stock:2}],stock:5,variantMedia:[{Color:'Oro',imageUrl:'https://img.test/gold.webp'}]});
  window.qaProductController.refresh();window.prodEditar('existing');
 });
 await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('#prod-editor-section').selectOption('inventory');
 await page.getByRole('button',{name:'Quitar Color: Oro',exact:true}).click();
 await expect(page.getByRole('button',{name:'Restaurar Color: Oro',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.qaProductStore.get('products/existing').variantInventory[0].active)).not.toBe(false);
 await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 let product=await page.evaluate(()=>window.qaProductStore.get('products/existing'));expect(product.variantInventory[0]).toMatchObject({variant:'gold',stock:3,price:45000,active:false});expect(product.stock).toBe(5);expect(product.variantMedia.find(row=>row.Color==='Oro').imageUrls).toEqual(['https://img.test/gold.webp']);
 await page.evaluate(()=>window.prodEditar('existing'));await page.evaluate(()=>window.qaProductController.workspace.ready);await page.locator('#prod-editor-section').selectOption('inventory');
 await page.getByRole('button',{name:'Restaurar Color: Oro',exact:true}).click();await page.locator('#prod-save-btn').click();await expect(page.locator('#prod-form-card')).toBeHidden();
 product=await page.evaluate(()=>window.qaProductStore.get('products/existing'));expect(product.variantInventory[0]).toMatchObject({variant:'gold',stock:3,price:45000,active:true});
});

test('reabrir administrador recupera servidor y respaldo de sesión sin publicar',async({page})=>{
 await open(page);await page.locator('#prod-name').fill('Versión remota');await page.evaluate(()=>window.qaProductController.workspace.save());
 const saved=await page.evaluate(()=>({key:window.qaProductController.workspace.key,records:[...window.qaProductStore]}));
 await page.evaluate(()=>window.qaRejectSave=true);await page.locator('#prod-name').fill('Más reciente en esta sesión');
 await openProductSaveFixture(page,390,844,{fullShell:true,photos:true,workflow:true,initialRecords:saved.records});await page.evaluate(()=>window.qaProductController.workspace.ready);
 await page.locator('.tt-work-back').click();await page.evaluate(key=>window.prodContinuarBorrador(key),saved.key);await page.evaluate(()=>window.qaProductController.workspace.ready);
 await expect(page.locator('#prod-name')).toHaveValue('Más reciente en esta sesión');
 expect(await page.evaluate(()=>[...window.qaProductStore.keys()].filter(path=>path.startsWith('products/')))).toEqual([]);
});

test('reabrir cinco veces no multiplica escrituras del borrador',async({page})=>{
 await open(page);
 for(let i=0;i<5;i++){
  await page.locator('.tt-work-back').click();await expect(page.locator('#prod-form-card')).toBeHidden();
  await page.evaluate(()=>window.prodNuevo());await page.evaluate(()=>window.qaProductController.workspace.ready);
 }
 await page.locator('#prod-name').fill('Una edición');await page.evaluate(()=>window.qaProductController.workspace.save());
 await page.evaluate(async()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('online'));await window.qaProductController.workspace.save();});
 expect(await page.evaluate(()=>window.qaProductController.workspace.revision)).toBe(1);
 expect(await page.evaluate(()=>window.qaProductWrites.filter(path=>path.startsWith('auditLog/work_')).length)).toBe(1);
});

test('reflujo equivalente a zoom 200%, orientación y táctil conservan acciones',async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:720,height:450},deviceScaleFactor:2,hasTouch:true});
 const page=await context.newPage();
 try{
  await open(page,720,450);await page.locator('#prod-name').fill('Conservar al rotar');
  await page.locator('.tt-work-back').tap();const dialog=page.locator('.tt-work-exit-dialog');await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Seguir editando',exact:true}).tap();await expect(page.locator('#prod-name')).toHaveValue('Conservar al rotar');
  for(const viewport of [{width:450,height:720},{width:720,height:300},{width:720,height:450}]){
   await page.setViewportSize(viewport);await expect(page.locator('#prod-save-btn')).toBeInViewport();await expect(page.locator('.tt-work-back')).toBeInViewport();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.screenshot({path:info.outputPath('zoom-equivalent-200.png'),animations:'disabled'});
 }finally{await context.close();}
});

test('salida con escritura en vuelo bloquea decisiones contradictorias',async({page})=>{
 await open(page);await page.evaluate(()=>window.qaHoldWork=true);await page.locator('#prod-name').fill('Borrador en vuelo');
 await page.locator('.tt-work-back').click();await page.getByRole('button',{name:'Guardar borrador y salir',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof window.qaReleaseWork)).toBe('function');
 await expect(page.getByRole('button',{name:'Seguir editando',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(page.locator('.tt-work-exit-dialog')).toBeVisible();
 await page.evaluate(()=>{window.qaHoldWork=false;window.qaReleaseWork();});await expect(page.locator('#prod-form-card')).toBeHidden();
 expect(await page.evaluate(()=>[...window.qaProductStore.values()].find(row=>row.snapshot)?.snapshot.name)).toBe('Borrador en vuelo');
});

test('quitar una opción nueva no pierde cantidades de una matriz histórica de stock',async({page})=>{
 await openProductSaveFixture(page,390,844);
 await page.locator('#prod-editor-section').selectOption('inventory');await page.locator('#prod-stock').fill('0');
 for(const color of ['Oro','Plata']){await page.getByLabel('Nueva opción de variante',{exact:true}).fill(color);await page.getByRole('button',{name:'Agregar opción',exact:true}).click();}
 await openOptionAvailability(page,'Oro');await page.getByRole('button',{name:'Asignar stock por color u opción',exact:true}).click();
 await page.getByLabel('Stock de Oro',{exact:true}).fill('2');await openOptionAvailability(page,'Plata');await page.getByLabel('Stock de Plata',{exact:true}).fill('0');
 await page.getByRole('button',{name:'Quitar Color: Oro',exact:true}).click();
 await expect(page.locator('#prod-variants-text')).toHaveValue(/Oro/);await expect(page.getByLabel('Stock de Oro',{exact:true})).toHaveValue('2');
 await expect(page.locator('#prod-stock')).toHaveValue('2');
 await page.getByRole('button',{name:'Quitar Color: Plata',exact:true}).click();
 await expect(page.locator('#prod-variants-text')).not.toHaveValue(/Plata/);await expect(page.getByLabel('Stock de Oro',{exact:true})).toHaveValue('2');
});
