// Component tests use explicit controlled persistence, not production App Check
// evidence. The complete-page suite independently checks real SDK/services.
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const source=fs.readFileSync('js/components/welcome/tutorial-bienvenida.js','utf8').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm,'');
const configSource=fs.readFileSync('js/components/welcome/configuracion-bienvenida.js','utf8').replace(/^import .*;\n/,'').replace(/^export /gm,'');
async function mount(page,profile,{ready=true,failWrite=false,preview=false,settings={},path="/index.html",completed=false,cartOpen=false}={}){
  await page.route('https://welcome.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><header class="tt-header">Tintin</header><main>Inicio</main><nav id="tt-tabbar">Menú</nav></body></html>'}));
  await page.goto('https://welcome.test'+path+'?welcome=1'+(preview?'&welcomePreview=1':''));
  await page.evaluate(({profile,ready,failWrite,preview,settings,completed})=>{
    window.fixture={profile,writes:0,settings};
    window.TintinCheckoutOrderCompleted=completed;
    window.auth={};window.db={};window.appCheckReady=Promise.resolve(ready);
    window.doc=(_db,...parts)=>parts.join('/');
    window.getDoc=async ref=>({exists:()=>true,data:()=>ref==='settings/welcomeTutorial'?{enabled:true,previewEnabled:true,...window.fixture.settings}:window.fixture.profile});
    window.runTransaction=async (_db,fn)=>{
      if(failWrite)throw Error('permission-denied');
      return fn({get:async()=>({exists:()=>true,data:()=>window.fixture.profile}),update:(_ref,patch)=>{window.fixture.profile={...window.fixture.profile,...patch};window.fixture.writes++;}});
    };
    window.serverTimestamp=()=> 'confirmed-test-timestamp';
    window.SUPER_ADMIN='owner@example.test';window.getUserRole=async()=>profile.role||'client';
    window.subscribeAuthState=callback=>{window.authCallback=callback;callback({uid:'customer',email:preview?window.SUPER_ADMIN:'customer@example.test'});};
  },{profile,ready,failWrite,preview,settings,completed});
  if(cartOpen){
    await page.addScriptTag({content:fs.readFileSync('js/components/navigation/compartido/control-paneles.js','utf8')});
    await page.evaluate(async()=>{
      window.fixtureCart=[{id:'local-product',qty:2}];
      const cart=document.createElement('aside');cart.id='fixture-cart';cart.innerHTML='<button>Revisar carrito</button>';document.body.append(cart);
      const controller=window.TintinSurfaceController;
      controller.register('cart',{element:cart,modal:true});
      await controller.open('cart');
    });
  }
  await page.addScriptTag({content:"const sanitizeImageUrl=value=>String(value||'');\n"+configSource});
  await page.addScriptTag({content:source});
}
const fresh={role:'client',profileStatus:'active',welcomeTutorialPending:true,onboardingCompleted:false};

test('el formulario administrativo conserva comillas como texto sin crear atributos', async ({page}) => {
  const admin = fs.readFileSync('js/admin/content/control-bienvenida-admin.js', 'utf8');
  const helper = admin.match(/  function escapeHtml\(value\) \{[\s\S]*?\n  \}/)[0];
  const payload = 'Título" data-injected="yes\'><img src=x onerror=alert(1)>';
  await page.setContent('<main></main>');
  await page.evaluate(({helper, payload}) => {
    const escapeHtml = new Function(helper + ';return escapeHtml;')();
    document.querySelector('main').innerHTML = `<input value="${escapeHtml(payload)}"><textarea>${escapeHtml(payload)}</textarea>`;
  }, {helper, payload});
  await expect(page.locator('input')).toHaveValue(payload);
  await expect(page.locator('textarea')).toHaveValue(payload);
  await expect(page.locator('[data-injected],img')).toHaveCount(0);
});
test('primera guía confirmada: visible, centrada y cierre independiente de red en cuatro tamaños',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const size of [{width:320,height:568},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
    await page.setViewportSize(size);await mount(page,{...fresh});
    const dialog=page.locator('#tt-welcome-tutorial');await expect(dialog).toBeVisible();
    await expect(page.locator('.tt-welcome-card')).toHaveCSS('touch-action','pan-y');
    const box=await page.locator('.tt-welcome-card').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(size.width+1);expect(box.y+box.height).toBeLessThanOrEqual(size.height+1);
    expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.tt-header')).visibility)).toBe('visible');
    const persisted=await page.evaluate(()=>window.fixture.profile);expect(persisted.welcomeTutorialSeen).toBe(true);
    // The close cannot depend on any subsequent App Check or DB response.
    await page.evaluate(()=>{window.appCheckReady=new Promise(()=>{});window.runTransaction=()=>new Promise(()=>{});});
    await page.locator('#tt-welcome-close').click();await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(()=>document.body.style.position)).toBe('');
    await mount(page,persisted);await expect(dialog).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test('URL de bienvenida no habilita cuentas existentes, incompletas, bloqueadas ni admin',async({page})=>{
  for(const profile of [{role:'client',profileStatus:'active',createdAt:new Date().toISOString()}, {...fresh,welcomeTutorialSeen:true},{...fresh,welcomeTutorialFirstShownAt:'previous-confirmed-appearance'},{...fresh,profileStatus:'incomplete'},{...fresh,blocked:true},{...fresh,role:'admin'}]){
    await mount(page,profile);await page.waitForTimeout(300);
    await expect(page.locator('#tt-welcome-tutorial')).toHaveCount(0);
    await expect(page.locator('.tt-header')).toBeVisible();expect(await page.evaluate(()=>window.fixture.writes)).toBe(0);
  }
});
test('App Check no disponible o escritura rechazada conserva inicio y bienvenida pendiente',async({page})=>{
  for(const options of [{ready:false},{failWrite:true}]){
    await mount(page,{...fresh},options);await page.waitForTimeout(400);
    await expect(page.locator('#tt-welcome-tutorial')).toHaveCount(0);
    await expect(page.locator('main')).toBeVisible();await expect(page.locator('#tt-tabbar')).toBeVisible();
    expect(await page.evaluate(()=>window.fixture.profile.welcomeTutorialPending)).toBe(true);
  }
});
test('cambio de cuenta cierra la guía y restaura el scroll',async({page})=>{
  await mount(page,{...fresh});await expect(page.locator('#tt-welcome-tutorial')).toBeVisible();
  await page.evaluate(()=>window.authCallback(null));await expect(page.locator('#tt-welcome-tutorial')).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.style.position)).toBe('');
});

test('preview explícito de Super Admin no altera el onboarding de clientes',async({page})=>{
  await mount(page,{role:'superadmin',profileStatus:'active'},{preview:true});
  await expect(page.locator('#tt-welcome-tutorial')).toBeVisible();
  await page.locator('#tt-welcome-close').click();await expect(page.locator('#tt-welcome-tutorial')).toHaveCount(0);
  expect(await page.evaluate(()=>window.fixture.writes)).toBe(0);
});


for (const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]) {
  test(`cuatro pasos con título propio, iconos consistentes y navegación en ${width}px`,async({page})=>{
    await page.setViewportSize({width,height});
    await mount(page,{...fresh});
    const titles=['Bienvenida a Tintin','Explorá el catálogo','Revisá tu carrito','Completá tu pedido'];
    for(let i=0;i<titles.length;i++) {
      await expect(page.getByRole('dialog')).toHaveAccessibleName(titles[i]);
      await expect(page.locator('.tt-welcome-title')).toHaveText(titles[i]);
      await expect(page.locator('.tt-welcome-count')).toHaveText(`Paso ${i+1} de 4`);
      await expect(page.locator('.tt-welcome-icon svg')).toHaveCount(1);
      await expect(page.locator('.tt-welcome-step-title')).toHaveCount(0);
      await expect(page.locator('#tt-welcome-next')).toBeInViewport();
      const box=await page.locator('.tt-welcome-card').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(height);
      if(i===2) {
        await page.locator('#tt-welcome-prev').click();
        await expect(page.locator('.tt-welcome-title')).toHaveText(titles[1]);
        await page.locator('#tt-welcome-next').click();
      }
      await page.locator('#tt-welcome-next').click();
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(()=>window.fixture.writes)).toBe(1);
  });
}

test('configuración anterior recibe el nuevo texto sin reactivar cuentas y los mensajes propios se conservan',async({page})=>{
  await mount(page,{...fresh},{settings:{title:'Mensaje de bienvenida',subtitle:'Tu primera guía Tintin',steps:[{id:'custom-id',icon:'🌸',title:'Bienvenida a Tintin',text:'Te cuento rapidito cómo comprar y encontrar tus accesorios favoritos sin perderte.',cta:'Empezar'}]}});
  await expect(page.locator('.tt-welcome-sub')).toHaveText('Tintin · Cómo comprar');
  await expect(page.locator('.tt-welcome-text')).toContainText('Conocé el catálogo');
  await expect(page.locator('#tt-welcome-next')).toHaveText('Comenzar');
  await expect(page.locator('.tt-welcome-icon svg')).toHaveCount(1);
  await mount(page,{...fresh},{settings:{title:'Mi marca',subtitle:'Mi guía',steps:[{id:'custom',icon:'♥',title:'Un mensaje propio',text:'Texto configurado por la tienda.',cta:'Mi botón'}]}});
  await expect(page.locator('.tt-welcome-title')).toHaveText('Un mensaje propio');
  await expect(page.locator('.tt-welcome-sub')).toHaveText('Mi marca · Mi guía');
  await expect(page.locator('.tt-welcome-icon')).toHaveText('♥');
  await expect(page.locator('#tt-welcome-next')).toHaveText('Mi botón');
});

test('imagen inaccesible recupera el icono vectorial del paso',async({page})=>{
  await page.route('https://media.test/missing.png',route=>route.abort());
  await mount(page,{...fresh},{settings:{steps:[{title:'Con imagen',text:'Descripción',icon:'catalogo',image:'https://media.test/missing.png'}]}});
  await expect(page.locator('.tt-welcome-icon svg')).toHaveCount(1);
  await expect(page.locator('.tt-welcome-icon')).not.toHaveClass(/has-image/);
});

test('la vista previa de Super Admin comparte título, texto, icono y botón del último paso',async({page})=>{
  await page.setContent('<main></main>');
  const admin=fs.readFileSync('js/admin/content/control-bienvenida-admin.js','utf8');
  const start=admin.indexOf('  function renderMiniPreview()');
  const end=admin.indexOf('\n  function updateLivePreview()',start);
  const escapeHelper=admin.match(/  function escapeHtml\(value\) \{[\s\S]*?\n  \}/)[0];
  await page.addScriptTag({content:"const sanitizeImageUrl=value=>String(value||'');\n"+configSource});
  await page.evaluate(({render,escapeHelper})=>{
    const draw=new Function('state','welcomeIconSvg',`${escapeHelper};const escapeAttr=escapeHtml;let previewIndex=3;${render};return renderMiniPreview();`);
    document.querySelector('main').innerHTML=draw(normalizeWelcomeConfig(),welcomeIconSvg);
  },{render:admin.slice(start,end),escapeHelper});
  await expect(page.locator('.tt-welcome-mini-title')).toHaveText('Completá tu pedido');
  await expect(page.locator('.tt-welcome-mini-text')).toContainText('Revisá el total antes de confirmar');
  await expect(page.locator('.tt-welcome-mini-icon svg')).toHaveCount(1);
  await expect(page.locator('.tt-welcome-mini-count')).toHaveText('Paso 4 de 4');
  await expect(page.locator('[data-preview-nav="next"]')).toHaveText('Entendido');
});


test('superficies reales conservan lectura y acciones en móvil pequeño y horizontal con texto largo',async({page})=>{
  const css=['styles.min.css','css/core/tokens-color.css','css/core/tokens-tintin.css','css/core/tema-unificado-tintin.css','css/theme/superficies-solidas-interfaz.css'].map(path=>fs.readFileSync(path,'utf8')).join('\n');
  for(const [width,height] of [[320,568],[844,390]]) {
    await page.setViewportSize({width,height});
    await mount(page,{...fresh},{settings:{steps:[{title:'Un título personalizado para una guía de compra',text:'Información para elegir productos, revisar sus opciones y completar el pedido. '.repeat(6),icon:'pedido',cta:'Entendido'}]}});
    await page.addStyleTag({content:css});
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#tt-welcome-next').scrollIntoViewIfNeeded();
    await expect(page.locator('#tt-welcome-next')).toBeInViewport();
    const action=await page.locator('#tt-welcome-next').boundingBox();
    expect(action.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.locator('#tt-welcome-next').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

for(const path of ['/catalogo','/product','/perfil','/carrito']) test(`primera bienvenida pendiente en ${path}`,async({page})=>{
  await mount(page,{...fresh},{path});
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(()=>fixture.writes)).toBe(1);
});
test('checkout directo y pedido confirmado conservan pendiente la bienvenida sin mostrarla',async({page})=>{
  await mount(page,{...fresh},{path:'/checkout'});
  await page.waitForTimeout(250);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>fixture.writes)).toBe(0);
  await page.evaluate(()=>{window.TintinCheckoutOrderCompleted=true;window.dispatchEvent(new CustomEvent('tintin:checkout:completed'));});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>fixture.profile.welcomeTutorialPending)).toBe(true);
});
test('ticket restaurado y módulo tardío tampoco muestran la guía dentro del checkout',async({page})=>{
  await mount(page,{...fresh},{path:'/checkout.html',completed:true});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>fixture.writes)).toBe(0);
  const profile=await page.evaluate(()=>fixture.profile);
  await mount(page,profile,{path:'/perfil'});
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('checkout no toca la cuenta ni cierra el carrito modal',async({page})=>{
  await mount(page,{...fresh},{path:'/checkout',completed:true,cartOpen:true});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>fixture.writes)).toBe(0);
  expect(await page.evaluate(()=>TintinSurfaceController.surface)).toBe('cart');
});
test('salir del checkout sin comprar mantiene la bienvenida para la siguiente página',async({page})=>{
  await mount(page,{...fresh},{path:'/checkout'});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const profile=await page.evaluate(()=>fixture.profile);
  await mount(page,profile,{path:'/catalogo'});
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('carrito modal abierto libera su foco antes de la bienvenida sin vaciar productos',async({page})=>{
  await mount(page,{...fresh},{cartOpen:true});
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(()=>window.TintinSurfaceController.surface)).toBe('none');
  expect(await page.evaluate(()=>window.fixtureCart)).toEqual([{id:'local-product',qty:2}]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.style.position)).toBe('');
});
