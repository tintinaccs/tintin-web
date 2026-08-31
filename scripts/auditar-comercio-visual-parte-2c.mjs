import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'commerce-part2c');
const PAGE_DEADLINE_MS = 18000;
fs.rmSync(outDir, { recursive:true, force:true });
fs.mkdirSync(outDir, { recursive:true });

const mime = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'
};
const ciProducts = [
  { id:'ci-reloj', data:{ name:'Reloj CI', category:'relojes', price:100000, stock:5, active:true, destacado:true, imageUrl:'', desc:'Producto de auditoría.' } },
  { id:'ci-collar', data:{ name:'Collar CI', category:'collares', price:70000, stock:8, active:true, destacado:true, imageUrl:'', desc:'Producto de auditoría.' } },
  { id:'ci-aro', data:{ name:'Aro CI', category:'aros', price:50000, stock:6, active:true, destacado:true, imageUrl:'', desc:'Producto de auditoría.' } }
];
const ciCollections = [
  { id:'relojes', data:{ name:'Relojes', title:'Relojes', slug:'relojes', active:true, order:1 } },
  { id:'collares', data:{ name:'Collares', title:'Collares', slug:'collares', active:true, order:2 } },
  { id:'aros', data:{ name:'Aros', title:'Aros', slug:'aros', active:true, order:3 } }
];

function sendJson(res, payload) {
  res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req,res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1:4173');
  const requestPath = decodeURIComponent(url.pathname);
  if (requestPath === '/api/public-catalog') {
    const resource = url.searchParams.get('resource');
    const id = url.searchParams.get('id');
    const source = resource === 'collections' ? ciCollections : ciProducts;
    if (!['products','collections'].includes(resource || '')) return sendJson(res, { ok:false, resource, items:[] });
    if (id) return sendJson(res, { ok:true, resource, item:source.find(item => item.id === id) || null });
    return sendJson(res, { ok:true, resource, items:source });
  }
  if (requestPath.startsWith('/api/')) {
    res.writeHead(404, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
    res.end('{"ok":false}');
    return;
  }
  const rel = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('Not found');
  res.writeHead(200, { 'content-type':mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control':'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless:true });
const official = [
  { name:'m360',width:360,height:800 },{ name:'m390',width:390,height:844 },{ name:'m430',width:430,height:932 },
  { name:'t768',width:768,height:1024 },{ name:'t1024',width:1024,height:768 },{ name:'d1280',width:1280,height:900 },{ name:'d1440',width:1440,height:960 }
];
const boundaries = [320,480,481,767,769,1023,1025,1920].map(width => ({ name:`b${width}`, width, height:width <= 480 ? 820 : width <= 768 ? 1024 : 900 }));
const all = [...official,...boundaries];
const failures = [];
const report = [];
const productHref = '/product.html?id=ci-reloj';

function addFailure(pageName, viewportName, message, data=null) { failures.push({ page:pageName, viewport:viewportName, message, data }); }

async function withDeadline(page, label, operation) {
  let timer = 0;
  const deadline = new Promise((_,reject) => {
    timer = setTimeout(() => {
      page.close({ runBeforeUnload:false }).catch(() => {});
      reject(new Error(`${label} excedió ${PAGE_DEADLINE_MS} ms`));
    }, PAGE_DEADLINE_MS);
  });
  try { return await Promise.race([operation(), deadline]); }
  finally { clearTimeout(timer); }
}

async function prepare(page) {
  await page.waitForLoadState('domcontentloaded', { timeout:8000 });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    document.documentElement.classList.remove('tt-initializing','tt-store-gate-pending','tt-color-scheme-pending');
    document.body.hidden = false;
    document.body.style.visibility = 'visible';
    try { window.TintinLoader?.hide?.(); } catch {}
    document.getElementById('tt-loader')?.remove();
    document.getElementById('tt-privacy-consent')?.setAttribute('hidden','');
  });
}

async function activateDynamicContent(page, waitMs=500) {
  await page.waitForTimeout(waitMs);
  await page.addStyleTag({ content:`
    .tt-card,.tt-coll-page-card,.tt-product-card,.tt-related-card{content-visibility:visible!important;contain-intrinsic-size:auto!important}
    .tt-products-section,.tt-colls-page-section,.tt-product-page,.tinben,.tinsel,.tt-related-section{content-visibility:visible!important;contain:none!important}
    .tt-home-motion,.tt-auto-reveal{opacity:1!important;transform:none!important;filter:none!important}
  ` });
  await page.evaluate(() => window.scrollTo(0,0));
  await page.waitForTimeout(100);
}

async function visibleGeometry(page) {
  return page.evaluate(() => {
    const viewport = innerWidth; const bad = [];
    const insideScroller = element => { let parent=element.parentElement; while (parent && parent !== document.body) { const style=getComputedStyle(parent); if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 2) return true; parent=parent.parentElement; } return false; };
    for (const el of document.querySelectorAll('body *')) {
      const style=getComputedStyle(el); if (style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0) continue;
      const r=el.getBoundingClientRect(); if (r.width<2||r.height<2) continue;
      if (r.right > viewport+3 || r.left < -3) {
        if (insideScroller(el)) continue;
        if (style.position==='fixed' && r.right<=viewport+20 && r.left>=-20) continue;
        bad.push({ tag:el.tagName,id:el.id,cls:String(el.className||'').slice(0,100),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width) });
        if (bad.length>=12) break;
      }
    }
    return { viewport, scrollWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth, bad };
  });
}

async function columnsFor(page, selector) {
  return page.locator(selector).evaluateAll(nodes => {
    const items=nodes.filter(node => getComputedStyle(node).display!=='none'); if (!items.length) return 0;
    const firstY=Math.round(items[0].getBoundingClientRect().top);
    return items.slice(0,8).filter(node => Math.abs(Math.round(node.getBoundingClientRect().top)-firstY)<=2).length;
  }).catch(() => 0);
}

async function auditCatalog(page,vp) {
  await page.goto('http://127.0.0.1:4173/catalogo.html', { waitUntil:'domcontentloaded', timeout:8000 });
  await prepare(page); await activateDynamicContent(page,650);
  if (vp.width<=768) {
    const toggle=page.locator('#filter-toggle');
    if (await toggle.isVisible().catch(()=>false)) {
      await toggle.click({ timeout:3000 }); await page.waitForTimeout(100);
      if (!await page.locator('#cat-sidebar').isVisible().catch(()=>false)) addFailure('catalogo',vp.name,'El panel de filtros mobile no queda visible al abrirse.');
      const box=await page.locator('#cat-sidebar').boundingBox().catch(()=>null);
      if (box && (box.x<-2||box.x+box.width>vp.width+2)) addFailure('catalogo',vp.name,'El panel de filtros sale del viewport.',box);
      await toggle.click({ timeout:3000 }).catch(()=>{});
    }
  }
  const cards=page.locator('#cat-grid .tt-card:not([aria-hidden="true"])');
  const count=await cards.count();
  const cols=await columnsFor(page,'#cat-grid .tt-card:not([aria-hidden="true"])');
  const expected=vp.width>1024?3:2;
  if (cols && cols!==Math.min(expected,count)) addFailure('catalogo',vp.name,`La grilla usa ${cols} columnas; se esperaban ${Math.min(expected,count)}.`);
  const geo=await visibleGeometry(page);
  if (geo.scrollWidth>vp.width+3||geo.bad.length) addFailure('catalogo',vp.name,'Hay desborde horizontal visible.',geo);
  if (official.some(item=>item.name===vp.name)) await page.screenshot({ path:path.join(outDir,`${vp.name}-catalogo-full.png`),fullPage:true,timeout:5000 }).catch(()=>{});
  report.push({ page:'catalogo',viewport:vp,cards:count,columns:cols,geometry:geo });
}

async function auditCollections(page,vp) {
  await page.goto('http://127.0.0.1:4173/collections.html', { waitUntil:'domcontentloaded', timeout:8000 });
  await prepare(page); await activateDynamicContent(page,700);
  const cards=page.locator('#colls-page-grid .tt-coll-page-card:not([aria-hidden="true"])');
  const count=await cards.count();
  const cols=await columnsFor(page,'#colls-page-grid .tt-coll-page-card:not([aria-hidden="true"])');
  const expected=vp.width<=480?1:2;
  if (cols&&cols!==Math.min(expected,count)) addFailure('collections',vp.name,`La grilla usa ${cols} columnas; se esperaban ${Math.min(expected,count)}.`);
  const featured=await page.evaluate(() => {
    const section=document.querySelector('.tt-products-section'); const grid=document.getElementById('collections-featured-grid');
    if (!section||!grid) return { missing:true };
    const style=getComputedStyle(section); const rect=section.getBoundingClientRect();
    return { missing:false,display:style.display,visibility:style.visibility,opacity:Number(style.opacity),width:Math.round(rect.width),height:Math.round(rect.height),cards:grid.querySelectorAll('.tt-product-card:not(.tt-skeleton-card)').length,states:grid.querySelectorAll('.tt-collections-state,.tt-collections-runtime-state').length,busy:grid.getAttribute('aria-busy') };
  });
  if (featured.missing) addFailure('collections',vp.name,'Falta la sección de productos destacados.');
  else {
    if (featured.display==='none'||featured.visibility==='hidden'||featured.opacity<.95) addFailure('collections',vp.name,'La sección de productos destacados no es visible.',featured);
    if (!featured.cards&&!featured.states) addFailure('collections',vp.name,'Productos destacados no muestra tarjetas ni un estado comprensible.',featured);
    if (featured.height<180) addFailure('collections',vp.name,'La sección de productos destacados queda colapsada.',featured);
  }
  const geo=await visibleGeometry(page);
  if (geo.scrollWidth>vp.width+3||geo.bad.length) addFailure('collections',vp.name,'Hay desborde horizontal visible.',geo);
  if (official.some(item=>item.name===vp.name)) await page.screenshot({ path:path.join(outDir,`${vp.name}-collections-full.png`),fullPage:true,timeout:5000 }).catch(()=>{});
  report.push({ page:'collections',viewport:vp,cards:count,columns:cols,featured,geometry:geo });
}

async function auditProduct(page,vp) {
  const target=new URL(productHref,'http://127.0.0.1:4173/').href;
  await page.goto(target,{ waitUntil:'domcontentloaded',timeout:8000 });
  await prepare(page);
  await page.waitForFunction(() => {
    const grid=document.getElementById('product-grid'); const nf=document.getElementById('product-not-found'); const err=document.getElementById('product-load-error');
    return getComputedStyle(grid).display!=='none' || getComputedStyle(nf).display!=='none' || !err.hidden;
  },null,{ timeout:9000 });
  await activateDynamicContent(page,200);
  const loaded=await page.locator('#product-grid').isVisible().catch(()=>false);
  if (!loaded) addFailure('product',vp.name,'La ficha CI no llegó al estado renderizado.');
  if (loaded) {
    const gallery=await page.locator('.tt-product-gallery').boundingBox(); const info=await page.locator('.tt-product-info-panel').boundingBox();
    if (gallery&&info) {
      const sideBySide=Math.abs(gallery.y-info.y)<12;
      if (vp.width>768&&!sideBySide) addFailure('product',vp.name,'Galería e información no quedan en dos columnas.',{gallery,info});
      if (vp.width<=768&&sideBySide) addFailure('product',vp.name,'Galería e información no se apilan en mobile.',{gallery,info});
      if (gallery.x<-2||info.x<-2||gallery.x+gallery.width>vp.width+2||info.x+info.width>vp.width+2) addFailure('product',vp.name,'La ficha del producto sale del viewport.',{gallery,info});
    }
  }
  const geo=await visibleGeometry(page);
  if (geo.scrollWidth>vp.width+3||geo.bad.length) addFailure('product',vp.name,'Hay desborde horizontal visible.',geo);
  if (official.some(item=>item.name===vp.name)) await page.screenshot({ path:path.join(outDir,`${vp.name}-product-full.png`),fullPage:true,timeout:5000 }).catch(()=>{});
  report.push({ page:'product',viewport:vp,loaded,productHref:target,geometry:geo });
}

async function runPageAudit(context,vp,name,audit) {
  const page=await context.newPage();
  console.log(`START — ${name} ${vp.width}×${vp.height}`);
  try {
    await withDeadline(page,`${name} ${vp.width}×${vp.height}`,()=>audit(page,vp));
    console.log(`DONE — ${name} ${vp.width}×${vp.height}`);
  } catch (error) {
    addFailure(name,vp.name,error?.message||String(error));
    console.error(`TIMEOUT/ERROR — ${name} ${vp.width}×${vp.height} — ${error?.message||error}`);
  } finally {
    if (!page.isClosed()) await page.close({ runBeforeUnload:false }).catch(()=>{});
  }
}

try {
  for (const vp of all) {
    const context=await browser.newContext({ viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block' });
    await context.addInitScript(() => {
      window.TT_DISABLE_STORE_GATE=true;
      window.TINTIN_ENABLE_PUBLIC_ACTIVITY=false;
      try { localStorage.setItem('tt_privacy_consent_v1','accepted'); } catch {}
    });
    await runPageAudit(context,vp,'catalogo',auditCatalog);
    await runPageAudit(context,vp,'collections',auditCollections);
    await runPageAudit(context,vp,'product',auditProduct);
    await context.close().catch(()=>{});
  }
} finally {
  await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}

fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify({productHref,report,failures},null,2));
if (failures.length) {
  console.error(`PARTE 2C: ${failures.length} problema(s) visual(es) detectado(s).`);
  failures.forEach(item=>console.error(`- [${item.page}/${item.viewport}] ${item.message}`));
  process.exit(1);
}
console.log(`PARTE 2C: CORRECTA · ${all.length} viewports · Catálogo, Colecciones y Producto sin desbordes ni solapamientos.`);
