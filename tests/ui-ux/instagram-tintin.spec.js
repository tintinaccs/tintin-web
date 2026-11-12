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
 let video='first';await page.route('**/api/instagram-feed',route=>route.fulfill({json:{available:true,posts:[{type:'video',url:`https://www.instagram.com/reel/${video}/`,caption:'Video '+video}]}}));
 await page.goto('/__instagram-home');
 await page.addScriptTag({type:'module',url:'/js/components/social/instagram-tintin.js'});
 await page.locator('#instagram').scrollIntoViewIfNeeded();
 await expect(page.locator('[data-instagram-feed] button')).toHaveText('Video first');
 await page.clock.install();video='newest';await page.clock.fastForward(61000);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await expect(page.locator('[data-instagram-feed] button')).toHaveText('Video newest');
 const order=await page.evaluate(()=>{const section=document.querySelector('#instagram'),reviews=document.querySelector('#tt-reviews-title'),footer=document.querySelector('footer');return !!(reviews.compareDocumentPosition(section)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(section.compareDocumentPosition(footer)&Node.DOCUMENT_POSITION_FOLLOWING);});expect(order).toBe(true);
});

test('Instagram precarga una vez fuera de pantalla, no actualiza fuera de pantalla y conserva tarjetas si nada cambió',async({page})=>{
 await page.clock.install();
 await page.route('**/__instagram-efficiency',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div style="height:3000px"></div><section id="instagram"><div data-instagram-feed style="height:200px"></div></section>'}));
 let requests=0;
 await page.route('**/api/instagram-feed',route=>{requests++;return route.fulfill({json:{available:true,posts:[{type:'video',url:'https://www.instagram.com/reel/stable/',caption:'Video estable'}]}});});
 await page.goto('/__instagram-efficiency');
 await page.addScriptTag({type:'module',url:'/js/components/social/instagram-tintin.js'});
 // Precarga única en segundo plano: las tarjetas ya existen antes de llegar a la sección.
 await page.clock.runFor(2000);
 await expect.poll(()=>requests).toBe(1);
 await expect(page.locator('[data-instagram-feed] button')).toHaveText('Video estable');
 await page.clock.runFor(20000);
 expect(requests).toBe(1);
 // Al llegar con datos recientes (menos de 60 s) no se repite la consulta.
 await page.locator('#instagram').scrollIntoViewIfNeeded();
 await page.clock.runFor(100);
 expect(requests).toBe(1);
 const card=await page.locator('[data-instagram-feed] button').elementHandle();
 await page.clock.fastForward(61000);
 await expect.poll(()=>requests).toBe(2);
 expect(await card.evaluate(node=>node.isConnected)).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));
 await expect.poll(()=>page.locator('#instagram').evaluate(node=>node.getBoundingClientRect().top>innerHeight+200)).toBe(true);
 await page.clock.fastForward(61000);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.clock.runFor(100);
 expect(requests).toBe(2);
 await page.locator('#instagram').scrollIntoViewIfNeeded();
 await expect.poll(()=>requests).toBe(3);
});


test('Instagram pausa al ocultar o salir y reanuda sin consultas simultáneas',async({page})=>{
 await page.clock.install();
 await page.route('**/__instagram-lifecycle',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><section><div data-instagram-feed style="height:200px"></div></section>'}));
 let requests=0;
 await page.route('**/api/instagram-feed',route=>{requests++;return route.fulfill({json:{available:true,posts:[{type:'video',url:'https://www.instagram.com/reel/lifecycle/',caption:'Video'}]}});});
 await page.goto('/__instagram-lifecycle');
 await page.addScriptTag({type:'module',url:'/js/components/social/instagram-tintin.js'});
 await expect.poll(()=>requests).toBe(1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.fastForward(121000);expect(requests).toBe(1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});for(let i=0;i<20;i++)document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>requests).toBe(2);
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await page.clock.fastForward(121000);expect(requests).toBe(2);
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await expect.poll(()=>requests).toBe(3);
});

// ---- Feed con fotos, carruseles y videos. /api/instagram-feed y el CDN de Instagram se simulan: no hay llamadas reales ni credenciales. ----
const cdn='https://scontent-gru1-1.cdninstagram.com/v/t51.2885-15/';
// Fuente 4:3 (no cuadrada) para comprobar que las tarjetas recortan con object-fit: cover.
const sourceImage='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fce5ee"/><stop offset="1" stop-color="#b35478"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="400" cy="300" r="150" fill="#fff" fill-opacity=".5"/></svg>';
const feedPosts=[
 {id:'1',type:'image',url:'https://www.instagram.com/p/photo1/',thumbnail:cdn+'photo1.jpg',caption:'Nueva colección de pulseras'},
 {id:'2',type:'carousel',url:'https://www.instagram.com/p/carousel1/',thumbnail:cdn+'carousel1.jpg',caption:'Combinaciones para todos los días'},
 {id:'3',type:'video',url:'https://www.instagram.com/reel/video1/',thumbnail:cdn+'video1.jpg',caption:'Así armamos el look de la semana'},
 {id:'4',type:'image',url:'https://www.instagram.com/p/photo2/',thumbnail:cdn+'photo2.jpg',caption:'Una descripción larguísima para comprobar que el texto se recorta sin desbordar la tarjeta. '.repeat(4)},
 {id:'5',type:'video',url:'https://www.instagram.com/reel/video2/',thumbnail:'',caption:'Video sin miniatura disponible'},
 {id:'6',type:'carousel',url:'https://www.instagram.com/p/carousel2/',thumbnail:cdn+'carousel2.jpg',caption:'Relojes y accesorios'},
 {id:'7',type:'image',url:'https://www.instagram.com/p/photo3/',thumbnail:cdn+'photo3.jpg',caption:''},
 {id:'8',type:'video',url:'https://www.instagram.com/reel/video3/',thumbnail:cdn+'video3.jpg',caption:'Detrás de escena'}
];
const feedResponse=posts=>route=>route.fulfill({json:{available:true,posts}});
async function openHome(page,{width,height,respond}){
 await page.setViewportSize({width,height});
 const html=removeFixtureScripts(fs.readFileSync(path.join(root,'index.html'),'utf8'),{removeModulePreloads:true});
 await page.route('**/__instagram-posts',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.route('**/api/instagram-feed',respond);
 await page.goto('/__instagram-posts');
 await page.addScriptTag({type:'module',url:'/js/components/social/instagram-tintin.js'});
 await page.locator('#instagram').scrollIntoViewIfNeeded();
}
for(const [width,height,columns] of [[390,844,2],[820,1180,3],[1366,768,4]]){
 test(`Inicio muestra fotos, carruseles y videos en ${columns} columnas cuadradas, sin saltos ni scroll horizontal a ${width}x${height}`,async({page})=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route(/cdninstagram\.com/,async route=>{await gate;await route.fulfill({contentType:'image/svg+xml',body:sourceImage});});
  await openHome(page,{width,height,respond:feedResponse(feedPosts)});
  const cards=page.locator('[data-instagram-feed] .tt-instagram-post');
  await expect(cards).toHaveCount(8);
  const measure=()=>page.evaluate(()=>{
   const feed=document.querySelector('[data-instagram-feed]');
   const box=node=>{const rect=node.getBoundingClientRect();return {x:rect.x,y:rect.y+scrollY,width:rect.width,height:rect.height};};
   return {columns:getComputedStyle(feed).gridTemplateColumns.split(' ').length,feed:box(feed),cards:[...feed.children].map(box),pageOverflow:document.documentElement.scrollWidth-innerWidth,feedOverflow:feed.scrollWidth-feed.clientWidth};
  });
  // Las imágenes siguen pendientes: el espacio reservado ya debe ser el definitivo.
  const before=await measure();
  expect(before.columns).toBe(columns);
  expect(before.cards.filter(card=>Math.abs(card.y-before.cards[0].y)<1)).toHaveLength(columns);
  for(const card of before.cards){
   expect(Math.abs(card.width-card.height)).toBeLessThanOrEqual(1);
   expect(Math.abs(card.width-before.cards[0].width)).toBeLessThanOrEqual(1);
   expect(card.x).toBeGreaterThanOrEqual(0);expect(card.x+card.width).toBeLessThanOrEqual(width+0.5);
  }
  expect(before.pageOverflow).toBeLessThanOrEqual(0);expect(before.feedOverflow).toBeLessThanOrEqual(0);
  release();
  // Cada tarjeta entra en pantalla para que todas las imágenes diferidas se pidan; luego se espera a que carguen.
  for(let index=0;index<8;index++)await cards.nth(index).scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('[data-instagram-feed] img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
  const after=await measure();
  expect(after.cards).toHaveLength(8);
  after.cards.forEach((card,index)=>{for(const key of ['x','y','width','height'])expect(Math.abs(card[key]-before.cards[index][key])).toBeLessThanOrEqual(0.5);});
  expect(after.pageOverflow).toBeLessThanOrEqual(0);
  const images=await page.locator('[data-instagram-feed] img').evaluateAll(nodes=>nodes.map(image=>{const rect=image.getBoundingClientRect();return {width:image.getAttribute('width'),height:image.getAttribute('height'),loading:image.loading,alt:image.alt,fit:getComputedStyle(image).objectFit,natural:[image.naturalWidth,image.naturalHeight],box:[rect.width,rect.height]};}));
  expect(images).toHaveLength(7);// el video sin miniatura conserva el fondo de marca
  for(const image of images){expect(image).toMatchObject({width:'640',height:'640',loading:'lazy',alt:'',fit:'cover'});expect(image.natural).toEqual([800,600]);expect(Math.abs(image.box[0]-image.box[1])).toBeLessThanOrEqual(1);}
  // Tipos: fotos y carruseles son enlaces a una pestaña nueva; los videos siguen siendo botones del reproductor.
  expect(await page.locator('[data-instagram-feed] a.tt-instagram-post').count()).toBe(5);
  expect(await page.locator('[data-instagram-feed] button.tt-instagram-post').count()).toBe(3);
  const photo=page.getByRole('link',{name:'Ver foto en Instagram: Nueva colección de pulseras (se abre en una pestaña nueva)'});
  await expect(photo).toHaveAttribute('href','https://www.instagram.com/p/photo1/');await expect(photo).toHaveAttribute('target','_blank');await expect(photo).toHaveAttribute('rel','noopener noreferrer');
  const carousel=page.getByRole('link',{name:'Ver carrusel en Instagram: Combinaciones para todos los días (se abre en una pestaña nueva)'});
  await expect(carousel).toHaveAttribute('href','https://www.instagram.com/p/carousel1/');await expect(carousel.locator('.tt-instagram-stack')).toHaveCount(1);
  const video=page.getByRole('button',{name:'Reproducir: Así armamos el look de la semana'});
  await expect(video).toHaveAttribute('data-instagram-video','https://www.instagram.com/reel/video1/');await expect(video.locator('.tt-instagram-play')).toHaveCount(1);
  await expect(page.getByRole('link',{name:'Ver foto en Instagram: Foto de @tintinaccs (se abre en una pestaña nueva)'})).toHaveCount(1);
  // El texto queda dentro de la tarjeta y el botón de reproducir no lo pisa, ni con la descripción más larga.
  const text=await page.evaluate(()=>[...document.querySelectorAll('[data-instagram-feed] .tt-instagram-post')].map(card=>{
   const outer=card.getBoundingClientRect(),caption=card.querySelector('.tt-instagram-caption').getBoundingClientRect(),play=card.querySelector('.tt-instagram-play')?.getBoundingClientRect();
   return {inside:caption.left>=outer.left-0.5&&caption.right<=outer.right+0.5&&caption.top>=outer.top-0.5&&caption.bottom<=outer.bottom+0.5,clearOfPlay:play?play.bottom<=caption.top+1:true};
  }));
  for(const item of text){expect(item.inside).toBe(true);expect(item.clearOfPlay).toBe(true);}
  // Texto claro sobre el degradado oscuro (el enlace de la tarjeta no tiene texto propio: todo el texto visible vive en los <span> comprobados aquí). El tema fuerza colores con !important y llegó a pintarlo #222 (ilegible), y su regla [class*="-badge"] pintaba de rosa el indicador.
  const colors=await page.evaluate(()=>[...document.querySelectorAll('[data-instagram-feed] .tt-instagram-post')].map(card=>{
   const colorOf=selector=>{const node=card.querySelector(selector);return node?getComputedStyle(node).color:'rgb(255, 255, 255)';};
   const stack=card.querySelector('.tt-instagram-stack');
   return {looseText:[...card.childNodes].filter(node=>node.nodeType===3&&node.textContent.trim()).length,caption:colorOf('.tt-instagram-caption'),play:colorOf('.tt-instagram-play'),stack:stack?getComputedStyle(stack).backgroundColor:'rgba(0, 0, 0, 0.36)'};
  }));
  for(const item of colors)expect(item).toEqual({looseText:0,caption:'rgb(255, 255, 255)',play:'rgb(255, 255, 255)',stack:'rgba(0, 0, 0, 0.36)'});
  await page.locator('#instagram').screenshot({path:test.info().outputPath(`instagram-feed-${width}.png`)});
 });
}
for(const [name,respond] of [
 ['sin credenciales (available:false)',route=>route.fulfill({json:{available:false,posts:[]}})],
 ['con error del servidor (503)',route=>route.fulfill({status:503,json:{available:false,posts:[]}})],
 ['sin conexión',route=>route.abort()],
 ['con publicaciones inválidas',route=>route.fulfill({json:{available:true,posts:[{type:'story',url:'https://evil.example/p/x/'},{type:'image',url:'https://evil.example/p/x/'}]}})]
]){
 for(const [width,height] of [[390,844],[1366,768]]){
  test(`Inicio muestra un estado vacío con el botón Ir a Instagram ${name} a ${width}x${height}`,async({page})=>{
   let release;const gate=new Promise(resolve=>{release=resolve;});
   await openHome(page,{width,height,respond:async route=>{await gate;await respond(route);}});
   const section=page.locator('#instagram'),empty=section.locator('.tt-instagram-empty'),button=section.getByRole('link',{name:'Ir a Instagram'});
   // Mientras la consulta está pendiente no parpadea ningún mensaje: sólo está el botón permanente.
   await expect(empty).toBeHidden();await expect(button).toBeVisible();
   release();
   await expect(empty).toBeVisible();await expect(empty).toContainText('Estamos preparando nuestras publicaciones');
   await expect(page.locator('[data-instagram-feed]')).toBeHidden();
   await expect(button).toHaveAttribute('href','https://www.instagram.com/tintinaccs/');await expect(button).toHaveAttribute('target','_blank');await expect(button).toHaveAttribute('rel','noopener noreferrer');
   const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
   const message=await empty.boundingBox();expect(message.x).toBeGreaterThanOrEqual(0);expect(message.x+message.width).toBeLessThanOrEqual(width);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await section.screenshot({path:test.info().outputPath(`instagram-empty-${width}.png`)});
  });
 }
}
test('Instagram conserva las publicaciones mostradas si un refresco posterior falla',async({page})=>{
 await page.clock.install();
 let fail=false,requests=0;
 await openHome(page,{width:390,height:844,respond:route=>{requests++;return fail?route.fulfill({status:503,json:{available:false,posts:[]}}):route.fulfill({json:{available:true,posts:feedPosts.slice(0,3)}});}});
 const cards=page.locator('[data-instagram-feed] .tt-instagram-post');
 await expect(cards).toHaveCount(3);
 fail=true;await page.clock.fastForward(61000);
 await expect.poll(()=>requests).toBe(2);await page.clock.runFor(100);
 await expect(cards).toHaveCount(3);await expect(page.locator('#instagram .tt-instagram-empty')).toBeHidden();
 await expect(page.locator('[data-instagram-feed]')).toHaveAttribute('data-state','ready');
});
test('Las fotos y los carruseles abren Instagram en una pestaña nueva y los videos conservan el reproductor',async({page,context})=>{
 await context.route('https://www.instagram.com/**',route=>route.fulfill({contentType:'text/html',body:'<main>Instagram simulado</main>'}));
 await openHome(page,{width:390,height:844,respond:feedResponse(feedPosts)});
 const cards=page.locator('[data-instagram-feed] .tt-instagram-post');
 await expect(cards).toHaveCount(8);
 // Teclado: el foco llega a cada tarjeta, en orden, con el anillo visible.
 await cards.first().focus();await page.keyboard.press('Tab');
 await expect(cards.nth(1)).toBeFocused();
 expect(await cards.nth(1).evaluate(node=>{const style=getComputedStyle(node);return [style.outlineStyle,style.outlineWidth];})).toEqual(['solid','3px']);
 for(const [name,href] of [['Ver foto en Instagram: Nueva colección de pulseras','https://www.instagram.com/p/photo1/'],['Ver carrusel en Instagram: Combinaciones para todos los días','https://www.instagram.com/p/carousel1/']]){
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name}).click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(href);expect(await popup.evaluate(()=>window.opener)).toBeNull();
  await popup.close();
  await expect(page.getByRole('dialog')).toHaveCount(0);
 }
 const video=page.getByRole('button',{name:'Reproducir: Así armamos el look de la semana'});
 await video.click();
 const player=page.getByRole('dialog',{name:'Video de Tintin en Instagram'});
 await expect(player).toBeVisible();await expect(player.locator('iframe')).toHaveAttribute('src','https://www.instagram.com/reel/video1/embed/?autoplay=1');
 await expect(player.getByRole('link',{name:'Ir a Instagram'})).toHaveAttribute('href','https://www.instagram.com/reel/video1/');
 await page.keyboard.press('Escape');await expect(player).not.toBeVisible();await expect(video).toBeFocused();
});
test('Instagram no reemplaza la tarjeta enfocada durante el refresco en segundo plano',async({page})=>{
 await page.clock.install();
 let version=1,requests=0;
 await openHome(page,{width:390,height:844,respond:route=>{requests++;return route.fulfill({json:{available:true,posts:version===1?feedPosts.slice(0,3):feedPosts.slice(3,6)}});}});
 const cards=page.locator('[data-instagram-feed] .tt-instagram-post');
 await expect(cards).toHaveCount(3);
 const focused=await cards.first().elementHandle();await cards.first().focus();
 version=2;await page.clock.fastForward(61000);await expect.poll(()=>requests).toBe(2);await page.clock.runFor(100);
 expect(await focused.evaluate(node=>node.isConnected&&document.activeElement===node)).toBe(true);
 await expect(cards.first()).toHaveAccessibleName(/Nueva colección de pulseras/);
 // Cuando el foco sale del feed, el siguiente refresco muestra las publicaciones nuevas.
 await page.evaluate(()=>document.activeElement.blur());
 await page.clock.fastForward(61000);await expect.poll(()=>requests).toBe(3);
 await expect(cards.first()).toHaveAccessibleName(/Una descripción larguísima/);
});
