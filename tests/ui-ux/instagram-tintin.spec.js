const {test,expect}=require('@playwright/test');
const fs=require('node:fs');const path=require('node:path');
const {removeFixtureScripts}=require('../../scripts/lib/html-layout-fixture.js');
const root=path.resolve(__dirname,'../..');
for(const [width,height] of [[320,740],[390,844],[768,1024],[820,1180],[1024,768],[1180,820],[1366,768],[1920,1080]]){
 test(`Instagram y la historia caben y cierran su reproductor a ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  const html=removeFixtureScripts(fs.readFileSync(path.join(root,'about.html'),'utf8'),{removeModulePreloads:true});
  await page.route('**/__instagram-story',route=>route.fulfill({contentType:'text/html',body:html}));
  let embeds=0;await page.route('https://www.instagram.com/**',route=>{embeds++;return route.fulfill({contentType:'text/html',body:'<main>Reproductor externo simulado</main>'});});
  await page.goto('/__instagram-story');
  await page.evaluate(()=>document.documentElement.classList.add('tt-about-maintained'));
  await page.addScriptTag({type:'module',url:'/js/components/social/instagram-tintin.js'});
  const trigger=page.getByRole('link',{name:'Mirá la historia de Tintin'});
  await expect(page.locator('#origen')).toContainText('Porque antes de ser una marca, Tintin ya era parte de mi historia.');
  const childhood=page.locator('#origen .tt-about-childhood img');
  await childhood.scrollIntoViewIfNeeded();await expect.poll(()=>childhood.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  const photo=await childhood.boundingBox();expect(photo.x).toBeGreaterThanOrEqual(0);expect(photo.x+photo.width).toBeLessThanOrEqual(width+1);
  expect(embeds).toBe(0);await trigger.click();
  const player=page.getByRole('dialog',{name:'Video de Tintin en Instagram'});
  await expect(player).toBeVisible();await expect(player.locator('iframe')).toHaveAttribute('src','https://www.instagram.com/reel/DekE_RMBPjv/embed/?autoplay=1');
  await expect(player.getByRole('link',{name:'Ir a Instagram'})).toHaveAttribute('href','https://www.instagram.com/reel/DekE_RMBPjv/');
  if(width===390)await page.screenshot({path:test.info().outputPath('instagram-player.png')});
  const box=await player.boundingBox();expect(Math.abs(box.x+box.width/2-width/2)).toBeLessThanOrEqual(2);expect(Math.abs(box.y+box.height/2-height/2)).toBeLessThanOrEqual(2);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.width+box.x).toBeLessThanOrEqual(width);expect(box.y+box.height).toBeLessThanOrEqual(height+1);
  await page.keyboard.press('Escape');await expect(player).not.toBeVisible();await expect(page.locator('.tt-instagram-player iframe')).not.toHaveAttribute('src',/instagram/);await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
}
test('Inicio actualiza los videos desde la API al volver a la página sin congelar una copia',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const html=removeFixtureScripts(fs.readFileSync(path.join(root,'index.html'),'utf8'),{removeModulePreloads:true});
 await page.route('**/__instagram-home',route=>route.fulfill({contentType:'text/html',body:html}));
 let video='first';await page.route('**/api/instagram-feed',route=>route.fulfill({json:{available:true,videos:[{url:`https://www.instagram.com/reel/${video}/`,caption:'Video '+video}]}}));
 await page.goto('/__instagram-home');
 await page.addScriptTag({type:'module',url:'/js/components/social/instagram-tintin.js'});
 await page.locator('#instagram').scrollIntoViewIfNeeded();
 await expect(page.locator('[data-instagram-feed] button')).toHaveText('Video first');
 await page.clock.install();video='newest';await page.clock.fastForward(61000);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await expect(page.locator('[data-instagram-feed] button')).toHaveText('Video newest');
 const order=await page.evaluate(()=>{const section=document.querySelector('#instagram'),reviews=document.querySelector('#tt-reviews-title'),footer=document.querySelector('footer');return !!(reviews.compareDocumentPosition(section)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(section.compareDocumentPosition(footer)&Node.DOCUMENT_POSITION_FOLLOWING);});expect(order).toBe(true);
});
