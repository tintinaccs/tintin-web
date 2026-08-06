import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'admin-part2f');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  [280,653],[320,568],[360,800],[390,844],[430,932],[480,820],[568,320],
  [640,900],[768,1024],[900,600],[1024,768],[1280,800],[1440,900],[1920,1080],[2560,1440],
].map(([width,height]) => ({ name:`${width}x${height}`, width, height }));

const mime = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.woff2':'font/woff2','.ico':'image/x-icon',
};

const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const rel = pathname === '/' ? 'admin.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, {'content-type':mime[path.extname(file).toLowerCase()] || 'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4180,'127.0.0.1',resolve));

function staticHtml(fileName) {
  return fs.readFileSync(path.join(root,fileName),'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<script\b[^>]*\/\s*>/gi,'')
    .replace(/<head>/i,'<head><base href="http://127.0.0.1:4180/">');
}

async function loadStatic(page,fileName,css='') {
  await page.setContent(staticHtml(fileName),{waitUntil:'load'});
  await page.addStyleTag({content:`
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#auth-denied,.adm-auth-denied,.tt-privacy-consent{display:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
    ${css}
  `});
  await page.evaluate(async()=>{try{await document.fonts.ready}catch{}});
  await page.waitForTimeout(60);
}

async function geometry(page) {
  return page.evaluate(() => {
    const intentional = element => {
      let node = element.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (node.matches('.adm-table-wrap,.adm-sidebar,.adm-mobile-tabs,.correos-tabs,.ship-tabs,.user-tabs,.cont-page-tabs,.adm-diagnostic-view-tabs,[class*="table-wrap"]') && /(auto|scroll)/.test(style.overflowX)) return true;
        node = node.parentElement;
      }
      return false;
    };
    const bad=[];
    for (const element of document.querySelectorAll('body *')) {
      const style=getComputedStyle(element); const rect=element.getBoundingClientRect();
      if (style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||rect.width<2||rect.height<2) continue;
      if (rect.left < -4 || rect.right > innerWidth + 4) {
        if (intentional(element)) continue;
        bad.push({tag:element.tagName,id:element.id,cls:String(element.className||'').slice(0,100),left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width)});
        if (bad.length>=15) break;
      }
    }
    const controls=[...document.querySelectorAll('button,input,select,textarea,a[href]')]
      .filter(element=>{const style=getComputedStyle(element);const rect=element.getBoundingClientRect();if(style.display==='none'||style.visibility==='hidden'||rect.width<2||rect.height<2)return false;return(rect.left < -4 || rect.right > innerWidth + 4)&&!intentional(element)})
      .slice(0,12)
      .map(element=>{const rect=element.getBoundingClientRect();return{id:element.id,cls:String(element.className||'').slice(0,100),left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width)}});
    return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,bad,controls};
  });
}

async function prepareAdmin(page) {
  await loadStatic(page,'admin.html',`
    #adm-sidebar,#adm-mobile-tabs,.adm-main{visibility:visible!important}
    .adm-section{display:none!important}.adm-section.active{display:block!important}
    .adm-overlay{display:none!important}
  `);
  return page.evaluate(() => {
    document.documentElement.classList.add('adm-auth-ready');
    const name=document.getElementById('adm-user-name');if(name)name.textContent='Administradora María Fernanda González';
    const badge=document.getElementById('adm-role-badge');if(badge){badge.textContent='Super Administradora';badge.className='adm-user-role-badge role-superadmin'}
    const clock=document.getElementById('adm-live-clock');if(clock)clock.textContent='21/07/2026 · 19:45:00';

    document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),textarea').forEach((input,index)=>{
      if(input.type==='file'||input.disabled||input.readOnly)return;
      input.value=index%2?'administracion.tienda.tintin.accs+verificacion@example.com':'Contenido administrable especialmente largo para comprobar la adaptación fluida';
    });

    document.querySelectorAll('.adm-table').forEach((table,tableIndex)=>{
      const body=table.tBodies?.[0];const headers=[...table.querySelectorAll('thead th')];
      if(!body||!headers.length||body.querySelector('[data-part2f]'))return;
      const row=document.createElement('tr');row.dataset.part2f='1';
      headers.forEach((header,index)=>{
        const label=header.textContent.trim()||`Campo ${index+1}`;
        const cell=document.createElement('td');cell.dataset.label=label;
        if(/acci|opci|gesti|editar|eliminar/i.test(label))cell.innerHTML='<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="adm-btn adm-btn-sm adm-btn-outline" type="button">Editar información</button><button class="adm-btn adm-btn-sm adm-btn-danger" type="button">Desactivar</button></div>';
        else if(/estado|rol|pago/i.test(label))cell.innerHTML='<span class="adm-badge badge-confirmado">Confirmación pendiente extensa</span>';
        else cell.textContent=`${label}: dato administrable largo ${tableIndex+1}.${index+1} — administracion.tienda.tintin@example.com`;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    document.querySelectorAll('.adm-bulk-toolbar').forEach(el=>el.classList.add('show'));
    return [...document.querySelectorAll('.adm-section[id^="section-"]')].map(el=>el.id.slice(8));
  });
}

async function activate(page,section) {
  await page.evaluate(name=>{
    document.querySelectorAll('.adm-section').forEach(el=>el.classList.toggle('active',el.id===`section-${name}`));
    document.querySelectorAll('.adm-nav-item[data-section],.adm-mobile-tab[data-section]').forEach(el=>el.classList.toggle('active',el.dataset.section===name));
    const title=document.getElementById('adm-topbar-title');if(title)title.textContent=`Panel de ${name}: administración y configuración integral`;
    scrollTo(0,0);
  },section);
  await page.waitForTimeout(30);
}

async function auditAdmin(page,viewport) {
  const sections=await prepareAdmin(page);
  if(sections.length<12) failures.push({page:'admin',viewport:viewport.name,state:'inventory',message:'Faltan secciones en el inventario.',data:sections});
  for(const section of sections) {
    await activate(page,section);
    const result=await geometry(page);
    if(result.documentWidth>viewport.width+4||result.bodyWidth>viewport.width+4||result.bad.length)failures.push({page:'admin',viewport:viewport.name,state:section,message:'Contenido fuera del viewport.',result});
    if(result.controls.length)failures.push({page:'admin',viewport:viewport.name,state:section,message:'Controles inaccesibles fuera del viewport.',controls:result.controls});
    const box=await page.locator(`#section-${section}`).boundingBox().catch(()=>null);
    if(!box||box.x < -4||box.x+box.width>viewport.width+4)failures.push({page:'admin',viewport:viewport.name,state:section,message:'La sección activa no cabe en el viewport.',box});
    report.push({page:'admin',viewport,section,result});
    if([280,390,768,1280].includes(viewport.width)&&['dashboard','pedidos','productos','colecciones','configuracion','permisos','apariencia'].includes(section))await page.screenshot({path:path.join(outDir,`${viewport.width}-admin-${section}.png`),fullPage:true});
  }

  if([280,390,768,1280].includes(viewport.width)) {
    const count=await page.locator('[role="dialog"]').count();
    for(let index=0;index<count;index+=1) {
      await page.evaluate(i=>{
        const all=[...document.querySelectorAll('[role="dialog"]')];
        all.forEach(el=>{el.hidden=false;el.style.setProperty('display','none','important');el.classList.remove('open','show','active')});
        const dialog=all[i];if(!dialog)return;
        dialog.style.setProperty('display','flex','important');dialog.style.setProperty('visibility','visible','important');dialog.style.setProperty('opacity','1','important');dialog.classList.add('open','show','active');
      },index);
      await page.waitForTimeout(20);
      const data=await page.locator('[role="dialog"]:visible').first().evaluate(dialog=>{
        const candidates=[...dialog.children].filter(child=>{const r=child.getBoundingClientRect();return r.width>20&&r.height>20});
        const panel=candidates.sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0]||dialog;
        const r=panel.getBoundingClientRect();return{left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height),scrollWidth:panel.scrollWidth,clientWidth:panel.clientWidth};
      }).catch(()=>null);
      if(!data||data.left < -4||data.right>viewport.width+4||data.scrollWidth>data.clientWidth+4)failures.push({page:'admin',viewport:viewport.name,state:`dialog-${index+1}`,message:'Diálogo fuera del viewport.',data});
    }
  }
}

async function auditImages(page,viewport) {
  await loadStatic(page,'admin-images.html',`
    #auth-denied{display:none!important}
    #adm-header{display:flex!important;visibility:visible!important;opacity:1!important}
    #adm-layout{display:flex!important;visibility:visible!important;opacity:1!important}
    @media(min-width:481px){#adm-sidebar{display:block!important;visibility:visible!important}}
    @media(max-width:480px){#adm-sidebar{display:none!important}}
  `);
  await page.evaluate(()=>{
    const email=document.querySelector('.adm-user-email');if(email)email.textContent='administracion.tienda.tintin.accs@example.com';
    const grid=document.getElementById('adm-cards-grid');
    if(grid&&!grid.children.length)grid.innerHTML=Array.from({length:5},(_,i)=>`<article class="adm-img-card"><input class="adm-card-select" type="checkbox"><div class="adm-card-top"><div><div class="adm-card-label">Imagen administrable con nombre especialmente largo ${i+1}</div><div class="adm-card-desc">Inicio · escritorio, tablet y teléfono</div></div><span class="adm-section-badge badge-productos">Productos destacados</span></div><div class="adm-preview"><div class="adm-preview-empty"><span class="emoji">🖼️</span><span class="label">Vista previa</span></div></div><label class="adm-autoreuse-toggle"><input type="checkbox">Usar automáticamente esta misma imagen en todos los dispositivos cuando no exista una versión específica.</label><input class="adm-url-input" value="https://cdn.example.com/ruta/muy/larga/imagen-tintin-${i+1}.webp"><div class="adm-card-btns"><button class="adm-btn-save">Guardar imagen</button><button class="adm-btn-clear">Quitar</button></div></article>`).join('');
    const toolbar=document.getElementById('img-bulk-toolbar');if(toolbar)toolbar.classList.add('show');
  });
  const result=await geometry(page);
  if(result.documentWidth>viewport.width+4||result.bodyWidth>viewport.width+4||result.bad.length)failures.push({page:'admin-images',viewport:viewport.name,state:'gallery',message:'Contenido fuera del viewport.',result});
  if(result.controls.length)failures.push({page:'admin-images',viewport:viewport.name,state:'gallery',message:'Controles inaccesibles fuera del viewport.',controls:result.controls});
  report.push({page:'admin-images',viewport,result});
  if([280,390,768,1280].includes(viewport.width))await page.screenshot({path:path.join(outDir,`${viewport.width}-admin-images.png`),fullPage:true});
}

const browser=await chromium.launch({headless:true});
const failures=[];const report=[];
try {
  for(const viewport of viewports) {
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',error=>failures.push({page:'runtime',viewport:viewport.name,state:'browser',message:error.message}));
    await auditAdmin(page,viewport);
    await auditImages(page,viewport);
    await context.close();
  }
} finally {
  await browser.close();server.close();
}

fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify({viewports,report,failures},null,2));
if(failures.length){console.error(`PARTE 2F: ${failures.length} problema(s) detectado(s).`);failures.forEach(item=>console.error(`- [${item.page}/${item.viewport}/${item.state}] ${item.message}`));process.exit(1)}
console.log(`PARTE 2F: CORRECTA · ${report.filter(x=>x.page==='admin').length} estados administrativos + ${viewports.length} estados de Imágenes.`);
