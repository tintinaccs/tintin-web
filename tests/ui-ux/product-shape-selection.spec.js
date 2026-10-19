const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('tienda.js', 'utf8');
const html = fs.readFileSync('product.html', 'utf8');
const sectionStart = html.indexOf('<section class="tt-product-page"');
const section = html.slice(sectionStart, html.indexOf('</section>', sectionStart) + 10);
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(match => match[0]).join('');
const functions = source.slice(source.indexOf('function formatPrice'), source.indexOf('function normalizeClassicCart')) +
  source.slice(source.indexOf('function isInStock('), source.indexOf('function hasValidName(')) +
  source.slice(source.indexOf('function _pdUpdateQtyUI()'), source.indexOf('function _showProductNotFound')) +
  source.slice(source.indexOf('function productSpecDisplayValue'), source.indexOf('async function _copyProductLink')) +
  source.slice(source.indexOf('function _pdSelectedValues'), source.indexOf('function _galleryThumbClick')) +
  source.slice(source.indexOf('function _galleryThumbClick'), source.indexOf('async function _addToCartWithQty')) +
  source.slice(source.indexOf('function selectVariant'), source.indexOf('/*', source.indexOf('function selectVariant')));
const inventoryRuntime = '/' + 'js/core/store/inventario-variantes.mjs';
const shapes = ['lágrima', 'ovalado', 'redondo'];
const product = {id:'shapes', name:'Anillo de acero con piedra', category:'anillos', price:85000, stock:2,
  desc:'Un detalle delicado para acompañarte todos los días.', material:'Acero inoxidable', sizeFit:'Ajustable',
  imageUrl:'/shape-0.svg', imagesExtra:shapes.map((_, i) => `/shape-${i}.svg`),
  variants:{'Forma de la piedra':shapes},
  variantInventory:shapes.map((variant,i) => ({variant,stock:i===1?2:0})),
  variantMedia:shapes.map((shape,i) => ({'Forma de la piedra':shape,imageUrls:[`/shape-${i}.svg`]}))};
async function openFixture(page, item=product) {
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.route('**/shape-fixture', route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body class="tt-product-maintenance tt-product-runtime-ready">${section}<script src="/js/components/images/galeria-producto.js"></script><script type="module" src="/shape-fixture.js"></script></body></html>`}));
  await page.route('**/shape-fixture.js', route=>route.fulfill({contentType:'text/javascript', body:`import {variantStockLimit,hasProductStock} from '${inventoryRuntime}';
    window.TintinCatalogPolicy={variantStockLimit};window.TintinCatalogMerchandising={isProductInStock:hasProductStock};
    let _pdProduct=null,_pdRenderedSignature='',_pdGalleryImages=[],_pdGalleryIndex=0,_pdQty=1,_pdMaxQty=99,_pdLoadTimer=null;
    function getProductImage(){return ''}function _injectProductJsonLd(){}function _updateProductMeta(){}function _openLightbox(){}
    ${functions}
    window.renderShapeProduct=_renderProductDetail;window.shapeSelection=_pdGetSelectedVariant;
    window.selectShape=selectVariant;_renderProductDetail(${JSON.stringify(item)});window.shapeReady=true;`}));
  await page.route(/\/shape-\d\.svg$/, route=>route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect x="210" y="160" width="180" height="240" rx="80" fill="none" stroke="#D4AF37" stroke-width="30"/><circle cx="300" cy="160" r="60" fill="${['#dfc5db','#f3d8b4','#cfdef2'][Number(route.request().url().match(/shape-(\d)/)[1])]}"/></svg>`}));
  await page.goto('/shape-fixture'); await page.waitForFunction(()=>window.shapeReady);
  return errors;
}
for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[667,375],[768,1024],[820,1180],[1024,768],[1180,820],[1280,720],[1366,768],[1440,900],[1920,1080]]) {
  test(`forma, foto y compra coherentes en ${width}x${height}`, async({page})=>{
    await page.setViewportSize({width,height}); const errors=await openFixture(page);
    // La foto de portada agotada no debe reemplazar la selección inicial disponible.
    await expect(page.locator('[data-variant-value="ovalado"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-1.svg$/);
    for (const index of [2,0,1]) {
      await page.locator(`[data-variant-value="${shapes[index]}"]`).click();
      await expect(page.locator('#gallery-main img')).toHaveAttribute('src',new RegExp(`shape-${index}.svg$`));
      await expect(page.locator('#gallery-thumbs .active')).toHaveAttribute('data-src',new RegExp(`shape-${index}.svg$`));
      await expect(page.locator('#product-variants .active')).toHaveAttribute('data-variant-value',shapes[index]);
      await expect(page.locator('.tt-variant-current')).toHaveText(shapes[index]);
      await expect(page.locator('#btn-product-add-cart')).toBeEnabled({enabled:index===1});
      await expect(page.locator('#btn-product-buy-now')).toBeEnabled({enabled:index===1});
      expect(await page.evaluate(()=>window.shapeSelection())).toBe(shapes[index]);
    }
    // La navegación inversa selecciona la forma asociada, incluso si está agotada.
    await page.locator('#gallery-thumbs [data-gallery-index="2"]').click();
    await expect(page.locator('[data-variant-value="redondo"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#btn-product-add-cart')).toBeDisabled();
    await page.evaluate(p=>window.renderShapeProduct({...p,price:90000}),product);
    await expect(page.locator('[data-variant-value="redondo"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-2.svg$/);
    await page.locator('[data-variant-value="ovalado"]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('[data-variant-value="ovalado"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#gallery-thumbs [data-gallery-index="1"] .tt-stock-label')).toHaveCount(0);
    const geometry=await page.evaluate(()=>{
      const rect=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,height:r.height};};
      return{overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#product-variants button,#gallery-thumbs button,.tt-product-actions-panel .tt-btn,.tt-qty-btn,#btn-product-wa')].map(rect),panel:rect(document.querySelector('.tt-product-info-panel'))};
    });
    expect(geometry.overflow).toBe(false);
    for(const button of geometry.buttons){expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44);expect(button.left).toBeGreaterThanOrEqual(15);expect(button.right).toBeLessThanOrEqual(width-15);}
    expect(errors).toEqual([]);
    if([390,768,1024,1366].includes(width)) await page.locator('#product-grid').screenshot({path:`/tmp/product-boutique-${width}.png`});
  });
}
test('combinaciones: la foto exacta prevalece sobre el color genérico y las fotos compartidas conservan la elección',async({page})=>{
  const item={...product,stock:6,variantInventory:undefined,variants:{Color:['Dorado','Plateado'],'Forma de la piedra':['ovalado','redondo']},
    variantMedia:[{Color:'Dorado',imageUrl:'/shape-0.svg'},{Color:'Dorado','Forma de la piedra':'ovalado',imageUrl:'/shape-1.svg'},{Color:'Dorado','Forma de la piedra':'redondo',imageUrl:'/shape-2.svg'}]};
  await openFixture(page,item);
  await page.locator('[data-variant-value="redondo"]').click();
  await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-2.svg$/);
  await page.locator('#gallery-thumbs [data-src$="shape-0.svg"]').click();
  await expect(page.locator('[data-variant-value="redondo"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-variant-value="ovalado"]').click();
  await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-1.svg$/);
});
test('variantes en filas y stock global vacío conservan fotos y estados correctos',async({page})=>{
  const item={...product,stock:'',variants:product.variantMedia,variantMedia:undefined};
  await openFixture(page,item);
  await page.locator('[data-variant-value="ovalado"]').click();
  await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-1.svg$/);
  await expect(page.locator('#btn-product-add-cart')).toBeEnabled();
  await expect(page.locator('[data-variant-value="ovalado"]')).not.toHaveClass(/tt-stock-unavailable/);
  await expect(page.locator('#gallery-thumbs [data-src$="shape-1.svg"] .tt-stock-label')).toHaveCount(0);
});
test('un cambio de stock reordena miniaturas y conserva la foto elegida por identidad',async({page})=>{
  const item={...product,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:0},{variant:'Plateado',stock:2}],variantMedia:[{Color:'Dorado',imageUrl:'/shape-0.svg'},{Color:'Plateado',imageUrl:'/shape-1.svg'}],imagesExtra:[]};
  await openFixture(page,item);
  await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-1.svg$/);
  await page.evaluate(item=>window.renderShapeProduct({...item,variantInventory:[{variant:'Dorado',stock:2},{variant:'Plateado',stock:0}]}),item);
  await expect(page.locator('[data-variant-value="Plateado"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-1.svg$/);
  await expect(page.locator('#gallery-thumbs .active')).toHaveAttribute('data-src',/shape-1.svg$/);
  await expect(page.locator('#btn-product-add-cart')).toBeDisabled();
});
test('opciones largas y ausencia de fotos o atributos no desbordan ni bloquean la ficha',async({page})=>{
  await page.setViewportSize({width:320,height:568});
  const item={...product,stock:4,variantInventory:undefined,variantMedia:[],variants:{Acabado:['Dorado con cristales transparentes y ajuste de tamaño personalizable','Plateado']}};
  await openFixture(page,item);
  const option=page.locator('[data-variant-value^="Dorado"]');await option.click();
  await expect(option).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(item=>window.renderShapeProduct({...item,variants:{},imageUrl:'',imagesExtra:[]}),item);
  await expect(page.locator('#gallery-main')).toBeDisabled();
  await expect(page.locator('#product-variants')).toBeHidden();
  await expect(page.locator('#btn-product-add-cart')).toBeEnabled();
});

test('una forma sin foto asignada no muestra otra forma del mismo color',async({page})=>{
  const item={...product,variants:{Color:['Dorado'],Forma:['ovalado','redondo']},variantInventory:undefined,variantMedia:[{Color:'Dorado',Forma:'ovalado',imageUrl:'/shape-0.svg'}],imagesExtra:[]};
  await openFixture(page,item);
  await page.locator('[data-variant-value="redondo"]').click();
  await expect(page.locator('[data-variant-value="redondo"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#gallery-main img')).toHaveCount(0);
  await expect(page.locator('#gallery-main')).toBeDisabled();
  await page.locator('[data-variant-value="ovalado"]').click();
  await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-0.svg$/);
});
test('cantidad respeta el stock de la forma y no duplica eventos al actualizar',async({page})=>{
  await openFixture(page);
  const plus=page.locator('#btn-qty-plus'),minus=page.locator('#btn-qty-minus');
  await plus.click(); await expect(page.locator('#qty-val')).toHaveText('2');await expect(plus).toBeDisabled();
  await page.locator('[data-variant-value="redondo"]').click();
  await expect(page.locator('#qty-val')).toHaveText('1');await expect(plus).toBeDisabled();await expect(minus).toBeDisabled();
  await page.locator('[data-variant-value="ovalado"]').click();
  await page.evaluate(p=>window.renderShapeProduct({...p,stock:5,variantInventory:p.variantInventory.map(row=>({...row,stock:row.variant==='ovalado'?5:0}))}),product);
  await plus.click();await expect(page.locator('#qty-val')).toHaveText('2');
  await minus.click();await expect(page.locator('#qty-val')).toHaveText('1');
});
for(const [width,height] of [[320,568],[390,844],[667,375],[768,1024],[820,1180],[1024,768],[1180,820],[1366,768],[1440,900],[1920,1080]]) test(`ANILLO CRISTAL importado: forma y foto en orden sin metadata en ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  const item={...product,name:'ANILLO CRISTAL',stock:1,variantMedia:undefined,variants:{'Forma de la piedra':['lagrima','ovalado','redondo']},variantInventory:[{variant:'lagrima',stock:0},{variant:'ovalado',stock:1},{variant:'redondo',stock:0}]};
  await openFixture(page,item);
  await expect(page.locator('[data-variant-value="ovalado"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#gallery-main img')).toHaveAttribute('src',/shape-1.svg$/);
  for(const [index,value] of ['lagrima','ovalado','redondo'].entries()){
    await page.locator(`[data-variant-value="${value}"]`).click();
    await expect(page.locator('#gallery-main img')).toHaveAttribute('src',new RegExp(`shape-${index}.svg$`));
    await expect(page.locator('#gallery-thumbs .active')).toHaveAttribute('data-src',new RegExp(`shape-${index}.svg$`));
    await expect(page.locator('#btn-product-add-cart')).toBeEnabled({enabled:index===1});
  }
  await page.locator('#gallery-thumbs [data-gallery-index="1"]').click();
  await expect(page.locator('[data-variant-value="ovalado"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#btn-product-add-cart')).toBeEnabled();
});
