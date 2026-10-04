const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const shell=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const runtime=fs.readFileSync(path.join(root,'js/admin/sidebar-expandible-admin.js'),'utf8');
async function load(page,width) {
  await page.setViewportSize({width,height:1000});
  // Real markup/cascade and sidebar runtime; all business scripts/connections
  // are blocked. This fixture cannot authenticate or write business data.
  await page.route('**/*.js*',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().includes('/sidebar-expandible-admin.js')?runtime:''}));
  await page.route('**/admin-sidebar-fixture',route=>route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self'; connect-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; frame-src 'none'"},body:shell}));
  await page.goto('/admin-sidebar-fixture',{waitUntil:'load'});
  await page.evaluate(()=>document.documentElement.classList.add('adm-auth-ready'));
}
for(const width of [541,600,768,900,1024,1440]) {
  test(`rail, hover y fijar sin saltos ni etiquetas rotas a ${width}px`,async({page})=>{
    await load(page,width);
    const sidebar=page.locator('#adm-sidebar'), toggle=page.locator('#adm-sidebar-toggle');
    await expect.poll(async()=>Math.round((await sidebar.boundingBox()).width)).toBe(74);
    const left=await page.locator('.adm-main').evaluate(e=>e.getBoundingClientRect().left);
    await sidebar.hover();
    await expect.poll(async()=>Math.round((await sidebar.boundingBox()).width)).toBe(260);
    expect(await page.locator('.adm-main').evaluate(e=>e.getBoundingClientRect().left)).toBe(left);
    expect(await page.locator('#adm-nav .adm-nav-item').first().evaluate(e=>getComputedStyle(e).whiteSpace)).toBe('nowrap');
    await page.mouse.move(width-10,300);
    await expect.poll(async()=>Math.round((await sidebar.boundingBox()).width)).toBe(74);
    await sidebar.hover();await toggle.click();await page.mouse.move(width-10,300);
    await expect(toggle).toHaveAttribute('aria-pressed','true');
    await expect.poll(async()=>Math.round((await sidebar.boundingBox()).width)).toBe(260);
    await expect.poll(async()=>Math.round(await page.locator('.adm-main').evaluate(e=>e.getBoundingClientRect().left))).toBe(260);
    await toggle.click();await page.mouse.move(width-10,300);
    await expect.poll(async()=>Math.round((await sidebar.boundingBox()).width)).toBe(74);
    expect(await page.locator('#adm-nav .adm-nav-item').first().evaluate(e=>getComputedStyle(e).fontSize)).toBe('0px');
    expect(await page.locator('#adm-nav .adm-nav-icon svg').first().evaluate(e=>getComputedStyle(e).color)).toBe('rgb(255, 255, 255)');
    expect(await page.locator('#adm-nav .adm-nav-icon svg rect').first().evaluate(e=>getComputedStyle(e).stroke)).toBe('rgb(255, 255, 255)');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width===768||width===1440) await page.screenshot({path:path.resolve(root,'../../outputs',`panel-lateral-${width}.png`)});
  });
}
for(const width of [320,390,540]) {
  test(`menú táctil, foco y escape a ${width}px`,async({page})=>{
    await load(page,width);
    const hamburger=page.locator('#adm-hamburger'),sidebar=page.locator('#adm-sidebar');
    await expect(hamburger).toBeVisible();await hamburger.click();
    await expect(hamburger).toHaveAttribute('aria-expanded','true');
    await expect(sidebar).toBeVisible();
    expect(await page.locator('.adm-main').evaluate(e=>e.inert)).toBe(true);
    await expect(page.locator('#adm-sidebar-toggle')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await page.locator('#adm-sidebar').evaluate(e=>e.contains(document.activeElement))).toBe(true);
    if(width===390)await page.screenshot({path:path.resolve(root,'../../outputs','panel-lateral-390.png')});
    await page.keyboard.press('Escape');await expect(hamburger).toHaveAttribute('aria-expanded','false');await expect(hamburger).toBeFocused();
    expect(await page.locator('.adm-main').evaluate(e=>e.inert)).toBe(false);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
