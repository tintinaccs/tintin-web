const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const loader=fs.readFileSync(path.join(root,'js/cargador-pagina.js'),'utf8');
for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]]) for(const shell of ['admin','checkout','login']) {
  test(`cargador rosa y blanco en ${shell} a ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    const html=fs.readFileSync(path.join(root,`${shell}.html`),'utf8');
    await page.route('**/*.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
    await page.route(`**/${shell}-palette`,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));
    await page.goto(`/${shell}-palette`);
    await page.addStyleTag({content:fs.readFileSync(path.join(root,'css/components/navigation/movil/encabezado-movil.css'),'utf8')});
    await page.evaluate(()=>{const nav=document.createElement('nav');nav.id='tt-tabbar';nav.style.cssText='position:fixed;bottom:0;left:0;right:0;height:80px;background:white;z-index:1100';document.body.append(nav);});
    await page.evaluate(()=>{const dialog=document.createElement('dialog');dialog.textContent='Diálogo abierto';document.body.append(dialog);dialog.showModal();});
    await page.addScriptTag({content:loader});
    await page.evaluate(()=>{window.TintinLoader.beginWait();window.TintinLoader.show();window.TintinLoader.setText('Restaurando tu sesión…','El panel se abrirá cuando termine la restauración.');});
    const actual=await page.locator('#tt-loader').evaluate(element=>({background:getComputedStyle(element).backgroundColor,colors:[...element.querySelectorAll('#tt-loader-wordmark,#tt-loader-wordmark span,#tt-loader-brand-subtitle,#tt-loader-title,#tt-loader-subtitle')].map(e=>getComputedStyle(e).color)}));
    const topLayer=await page.locator('#tt-loader').evaluate(el=>({open:el.matches(':popover-open'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
    expect(topLayer.open).toBe(true);expect(topLayer.width).toBeGreaterThanOrEqual(width-1);expect(topLayer.height).toBeGreaterThanOrEqual(height);
    await page.evaluate(()=>document.querySelector('dialog[open]').close());
    // El gutter estable pertenece al scrollport nativo: elementFromPoint
    // devuelve null allí incluso con un popover que cubre todo el viewport.
    // Su cobertura completa se comprueba arriba; acá se prueban las esquinas
    // del contenido y la navegación donde el navegador sí hace hit-testing.
    const front=await page.evaluate(()=>{
      const right=Math.min(innerWidth,document.documentElement.getBoundingClientRect().right);
      return [[8,8],[right-8,8],[8,innerHeight-8],[right-8,innerHeight-8],[right/2,innerHeight-40]]
        .every(([x,y])=>Boolean(document.elementFromPoint(x,y)?.closest('#tt-loader')));
    });
    expect(front).toBe(true);
    expect(actual.background).toBe('rgb(248, 170, 202)');
    expect(actual.colors.length).toBeGreaterThanOrEqual(4);
    expect(actual.colors.every(color=>color==='rgb(255, 255, 255)')).toBe(true);
    if(shell==='admin'&&width===768) { await page.waitForTimeout(1000); await page.screenshot({path:testInfo.outputPath('loader-blanco-corregido.png')}); }
  });
}
