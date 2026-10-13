import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, request as apiRequest } from 'playwright';
import { classifyRequests } from './lib/clasificar-cargas.mjs';
import { isReadOnlyAuditRequest } from './lib/audit-read-only-policy.mjs';

const root=path.resolve(import.meta.dirname,'..');
const base=process.env.TINTIN_LOADING_BASE_URL || 'http://127.0.0.1:4173';
const publicOrigin='https://tintinaccesorios.pages.dev';
const bridge=process.env.TINTIN_AUDIT_PROXY_BRIDGE==='1';
const baseline=process.env.TINTIN_LOADING_BASELINE_SHA || '';
const widths=(process.env.TINTIN_LOADING_WIDTHS || '320,360,375,390,414,430,768,820,1024,1366,1440').split(',').map(Number);
const names=(await fs.readdir(root)).filter(file=>file.endsWith('.html'));
const selected=process.env.TINTIN_LOADING_PAGES?.split(',') || names;
const catalogApi=await apiRequest.newContext({...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{}),timeout:20000});
const catalog=await (await catalogApi.get(publicOrigin+'/api/public-catalog?resource=products')).json();
const item=catalog.items.find(item=>item.data?.active!==false && Number(item.data?.stock)>0);
const product={id:item.id,...item.data};
const mimetypes={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const modified=new Set(execFileSync('git',['diff','--name-only',baseline||'HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n'));
const sourceCache=new Map();
const routes=new Map(names.map(file=>['/'+file.replace(/\.html$/,''),file]));routes.set('/','index.html');
const browser=await chromium.launch({headless:true});
const output=[];
const jobs=selected.flatMap(file=>widths.map(width=>({file,width})));
let next=0;

async function readLocal(relative) {
  if(!sourceCache.has(relative)) {
    const body=baseline && modified.has(relative)
      ? execFileSync('git',['show',`${baseline}:${relative}`],{cwd:root,maxBuffer:16*1024*1024})
      : await fs.readFile(path.join(root,relative));
    sourceCache.set(relative,body);
  }
  return sourceCache.get(relative);
}

async function audit({file,width}) {
  const context=await browser.newContext({viewport:{width,height:width<768?844:900},serviceWorkers:'block'});
  const page=await context.newPage();const requests=[],errors=[],blocked=[];
  const byRequest=new Map(),frames=new Map();let navigationId=0;
  const local=base.startsWith('http://127.0.0.1') || base.startsWith('http://localhost');
  await page.addInitScript(product=>{
    const item={...product,qty:1};localStorage.setItem('tt_cart',JSON.stringify([item]));localStorage.setItem('tt_cart_guest',JSON.stringify([item]));
    window.__loadingAudit={ready:false,mutations:[],lcp:null,cls:0};
    document.addEventListener('tintin:page-ready',()=>window.__loadingAudit.ready=true,{once:true});
    try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__loadingAudit.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__loadingAudit.cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch{}
    document.addEventListener('DOMContentLoaded',()=>{
      for(const selector of ['.tt-hero','#product-name','#product-price','#gallery-main','#ck-items','#tt-header-desktop-tablet']) {
        const element=document.querySelector(selector);if(!element)continue;
        let last=JSON.stringify({text:element.textContent.trim().slice(0,500),images:[...element.querySelectorAll('img')].map(img=>img.currentSrc||img.src)});
        new MutationObserver(()=>{const state=JSON.stringify({text:element.textContent.trim().slice(0,500),images:[...element.querySelectorAll('img')].map(img=>img.currentSrc||img.src)});if(state!==last){window.__loadingAudit.mutations.push({selector,at:performance.now(),before:last,after:state});last=state;}}).observe(element,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['src','srcset']});
      }
    },{once:true});
  },product);
  page.on('request',request=>{if(request.isNavigationRequest() && request.frame()===page.mainFrame())navigationId++;let frameId=null;try{const frame=request.frame();if(!frames.has(frame))frames.set(frame,frames.size+1);frameId=frames.get(frame);}catch{}const row={url:request.url(),method:request.method(),type:request.resourceType(),redirected:!!request.redirectedFrom(),frameId,navigationId};requests.push(row);byRequest.set(request,row);});
  page.on('response',response=>{const row=byRequest.get(response.request());if(row)row.status=response.status();});
  page.on('requestfailed',request=>{const row=byRequest.get(request);if(row)row.failure=request.failure()?.errorText;});
  page.on('pageerror',error=>errors.push(error.message));
  // El bridge es opcional: mantiene TLS verificado en APIRequestContext y no
  // altera confianza del navegador. La guardia de sólo lectura siempre usa routing y desactiva caché;
  // por eso sus bytes/cold-warm nunca se presentan como métricas de red real.
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    const safeRead=isReadOnlyAuditRequest(req.url(),req.method());
    if(!safeRead){blocked.push({url:req.url(),method:req.method(),reason:'production_write_excluded'});return route.abort();}
    try{
      if(local && url.origin===new URL(base).origin && !url.pathname.startsWith('/api/')){
        const relative=routes.get(url.pathname) || decodeURIComponent(url.pathname).replace(/^\//,'');
        const resolved=path.resolve(root,relative);if(!resolved.startsWith(root+path.sep))throw new Error('invalid local path');
        const body=await readLocal(relative);
        return route.fulfill({status:200,body,contentType:mimetypes[path.extname(relative)]||'application/octet-stream'});
      }
      if(!bridge && url.origin!==new URL(base).origin)return route.continue();
      const target=local && url.origin===new URL(base).origin ? publicOrigin+url.pathname+url.search : req.url();
      const headers=await req.allHeaders();
      for(const name of ['host','content-length','connection'])delete headers[name];
      const response=await catalogApi.fetch(target,{method:req.method(),headers,data:req.postDataBuffer()||undefined,maxRedirects:0});
      return route.fulfill({response});
    }catch(error){errors.push(`${url.origin}${url.pathname}: ${error.message.split('\n')[0]}`);return route.abort();}
  });
  const route=file==='index.html'?'/':file.replace(/\.html$/,'');
  const url=base+'/'+route.replace(/^\//,'')+(file==='product.html'?'?id='+encodeURIComponent(product.id):'');
  let readiness='ready';
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    if(!/^google[a-f0-9]+\.html$/.test(file))await page.waitForFunction(()=>window.__loadingAudit?.ready || document.documentElement.classList.contains('tt-ui-ready') || /login/.test(location.pathname),{},{timeout:12000});
    await page.waitForLoadState('networkidle',{timeout:3000}).catch(()=>{});
  }catch(error){readiness='timeout_or_navigation_error';errors.push(error.message.split('\n')[0]);}
  const dom=await page.evaluate(()=>({url:location.href,...window.__loadingAudit,resources:performance.getEntriesByType('resource').map(e=>({url:e.name,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize,initiatorType:e.initiatorType})),firebase:window.TintinAppCheckStatus,profile:window.TintinCheckoutHardening?.profileState?.reason})).catch(()=>null);
  const row={page:file,width,readiness,transport:bridge?'verified_tls_bridge':'browser',baseline:baseline||null,requests,duplicates:classifyRequests(requests),errors,blocked,dom,transferBytes:null,cacheMeasurement:'not_verified_routing_disables_browser_cache'};
  output.push(row);console.log(`${file} ${width}px ${readiness}: ${requests.length} requests, ${row.duplicates.length} candidates, ${errors.length} errors`);
  await context.close();
}

try{
  await Promise.all(Array.from({length:3},async()=>{while(next<jobs.length)await audit(jobs[next++]);}));
}finally{
  await browser.close();await catalogApi.dispose();
  const destination=process.env.TINTIN_LOADING_OUTPUT || path.join(root,'..','tintin-audit-results','loading-audit.json');
  await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,JSON.stringify({base,baseline,bridge,widths,rows:output},null,2)+'\n');
}
