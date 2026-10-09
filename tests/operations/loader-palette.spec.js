const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const loader=fs.readFileSync(path.join(root,'js/cargador-pagina.js'),'utf8');
for(const width of [390,768,1440]) for(const shell of ['admin','checkout','login']) {
  test(`cargador rosa y blanco en ${shell} a ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:800});
    const html=fs.readFileSync(path.join(root,`${shell}.html`),'utf8');
    await page.route('**/*.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
    await page.route(`**/${shell}-palette`,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));
    await page.goto(`/${shell}-palette`);
    await page.addScriptTag({content:loader});
    await page.evaluate(()=>{window.TintinLoader.beginWait();window.TintinLoader.show();window.TintinLoader.setText('Restaurando tu sesión…','El panel se abrirá cuando termine la restauración.');});
    const actual=await page.locator('#tt-loader').evaluate(element=>({background:getComputedStyle(element).backgroundColor,colors:[...element.querySelectorAll('#tt-loader-wordmark,#tt-loader-wordmark span,#tt-loader-brand-subtitle,#tt-loader-title,#tt-loader-subtitle')].map(e=>getComputedStyle(e).color)}));
    expect(actual.background).toBe('rgb(248, 170, 202)');
    expect(actual.colors.length).toBeGreaterThanOrEqual(4);
    expect(actual.colors.every(color=>color==='rgb(255, 255, 255)')).toBe(true);
    if(shell==='admin'&&width===768) { await page.waitForTimeout(1000); await page.screenshot({path:testInfo.outputPath('loader-blanco-corregido.png')}); }
  });
}
