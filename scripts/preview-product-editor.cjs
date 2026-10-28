#!/usr/bin/env node
// Vista local de QA: mismo DOM/controladores y escritor de dominio; almacenamiento en memoria.
// Nunca carga credenciales ni permite acceder a servicios externos.
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');const path=require('node:path');
const {indexPreviewAssets,previewAsset}=require('./lib/preview-static-assets.cjs');
const publicAssets=indexPreviewAssets(path.resolve(__dirname,'..'));
const editorModule=fs.readFileSync(path.join(__dirname,'../js/admin/shopify-commerce-admin.js'),'utf8').match(/from ['"]\.\/products\/(interfaz-productos-adaptable\.js\?v=[^'"]+)['"]/)?.[1];
if(!editorModule)throw Error('No se encontró la versión canónica del editor.');
const {openProductSaveFixture}=require('../tests/ui-ux/helpers/product-save-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const page=await browser.newPage(),routes=[],init=[],exposed=new Map();let setup;
 const route=page.route.bind(page),evaluate=page.evaluate.bind(page),addInitScript=page.addInitScript.bind(page),exposeFunction=page.exposeFunction.bind(page);
 page.route=async(pattern,handler)=>{routes.push({pattern,handler});return route(pattern,handler);};
 page.addInitScript=async(fn,arg)=>{init.push(`(${fn.toString()})(${JSON.stringify(arg)})`);return addInitScript(fn,arg);};
 page.exposeFunction=async(name,fn)=>{exposed.set(name,fn);return exposeFunction(name,fn);};
 page.evaluate=async(fn,arg)=>{if(arg?.code)setup=`(${fn.toString()})(${JSON.stringify(arg)})`;return evaluate(fn,arg);};
 await openProductSaveFixture(page,1440,900,{photos:true,workflow:true});await browser.close();
 const uploads=new Map();
 const port=Number(process.env.PRODUCT_EDITOR_PREVIEW_PORT || 4173);
 const bootstrap=`<script>${init.join(';')};window.qaChooseLibraryPhoto=async()=>{const photos=await fetch('/__qa/media-list').then(response=>response.json());return new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Biblioteca local de prueba');const heading=document.createElement('h2');heading.textContent='Fotos de esta vista previa';dialog.append(heading);const finish=value=>{dialog.close();dialog.remove();resolve(value);};for(const [index,url]of photos.entries()){const button=document.createElement('button');button.type='button';button.className='adm-btn adm-btn-outline';const image=document.createElement('img');image.src=url;image.alt='Foto '+(index+1);image.style.cssText='width:100px;height:100px;object-fit:contain';button.append(image,document.createTextNode('Elegir foto '+(index+1)));button.setAttribute('aria-label','Elegir foto '+(index+1));button.onclick=()=>finish(url);dialog.append(button);}const cancel=document.createElement('button');cancel.type='button';cancel.className='adm-btn adm-btn-outline';cancel.textContent='Cerrar biblioteca';cancel.onclick=()=>finish(null);dialog.append(cancel);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});document.body.append(dialog);dialog.showModal();});};window.qaCommercialWrite=async data=>{const response=await fetch('/__qa/write',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return response.json();};</script>`;
 const start=`<script type="module">import {installProductInterface} from '/js/admin/products/${editorModule}';await (${setup});installProductInterface();for(let i=0;i<200 && !document.querySelector('[data-action="product-new"]');i++)await new Promise(resolve=>setTimeout(resolve,20));window.qaProductStore.set('products/preview-example',{name:'Producto de prueba',description:'Ejemplo local editable.',category:'qa-tablet',price:45000,stock:5,active:false,publicationStatus:'draft',variants:{Color:['Dorado','Plateado']}});
const toolbar=document.createElement('div');toolbar.style.cssText='padding:16px;display:flex;gap:12px;flex-wrap:wrap';for(const [label,action] of [['Nuevo producto',()=>window.prodNuevo()],['Editar ejemplo',()=>{window.qaProductController.refresh();window.prodEditar('preview-example');}],['Recuperar último borrador',()=>{const entries=[...window.qaProductStore].filter(([key,value])=>key.startsWith('productEditorWorkspaces/') && !value.closed);const last=entries.at(-1);if(last){window.qaProductController.refresh();window.prodContinuarBorrador(last[0].split('/').at(-1),last[1].productId || null);}}],['Editar último guardado',()=>{window.qaProductController.refresh();const entries=[...window.qaProductStore.keys()].filter(key=>key.startsWith('products/'));window.prodEditar(entries.at(-1).split('/')[1]);}]]){const button=document.createElement('button');button.textContent=label;button.className='adm-btn';button.onclick=action;toolbar.append(button);}document.body.prepend(toolbar);window.prodNuevo();const note=document.createElement('p');note.textContent='Vista local de prueba · datos en memoria · no modifica producción';note.style.cssText='margin:0;padding:8px;font:12px Montserrat;background:#FDECF2;color:#222';document.querySelector('.adm-card-head').append(note);</script>`;
 const matches=(pattern,url)=>new RegExp('^'+pattern.split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(url);
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.url==='/__qa/media-list'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify([...uploads.keys()].map(id=>'/__qa/media/'+id)));return;}
   if(req.url==='/__qa/media' && req.method==='POST'){
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>15000000)throw Error('Archivo demasiado grande');chunks.push(chunk);}const id=require('node:crypto').randomUUID();uploads.set(id,{data:Buffer.concat(chunks),type:/^image\/(webp|png|jpeg)$/.test(req.headers['content-type'])?req.headers['content-type']:'application/octet-stream'});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({url:'/__qa/media/'+id}));return;
   }
   if(req.url.startsWith('/__qa/media/')){const media=uploads.get(req.url.split('/').at(-1));if(!media){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':media.type,'x-content-type-options':'nosniff'});res.end(media.data);return;}
   if(req.url==='/__qa/write' && req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>2000000)throw Error('Solicitud demasiado grande');}const result=await exposed.get('qaCommercialWrite')(JSON.parse(body));res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));return;}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const pathname=req.url==='/'?'/admin-commerce-fixture':req.url;
   const asset=previewAsset(publicAssets,pathname);
   if(asset){
    const mime={'.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.wasm':'application/wasm','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'}[path.extname(asset)] || 'application/octet-stream';res.writeHead(200,{'content-type':mime});fs.createReadStream(asset).pipe(res);return;
   }
   const url=pathname.startsWith('/__external/')?'https://'+pathname.slice('/__external/'.length):'https://tintin.test'+pathname;
   let completed=false;
   for(const item of [...routes].reverse()){
    if(!matches(item.pattern,url))continue;
    await item.handler({request:()=>({url:()=>url}),abort:()=>{completed=true;res.writeHead(404);res.end();},continue:()=>{},fulfill:({status=200,contentType='text/plain',body=''})=>{
     completed=true;
     if(url.includes('/js/components/images/biblioteca-multimedia.js'))body=`export const uploadImageToLibrary=async file=>{const response=await fetch('/__qa/media',{method:'POST',headers:{'content-type':file.type},body:file});if(!response.ok)throw Error('No se pudo cargar la foto local');return response.json();};export const deleteMediaByUrlIfUnused=async()=>{};export const deleteMediaItem=deleteMediaByUrlIfUnused;`;
     if(url.includes('/js/components/images/utilidades-imagenes.js'))body=`export function sanitizeImageUrl(value){if(!String(value || '').trim())return '';try{const url=new URL(value,location.href);return url.origin===location.origin?url.pathname+url.search:url.protocol==='https:'?url.href:'';}catch{return '';}}`;
     if(contentType==='text/html')body=String(body).replace('</head>',bootstrap+'</head>').replace('</body>',start+'</body>');
     if(/javascript|html|css/.test(contentType))body=String(body).replaceAll('https://www.gstatic.com/','/__external/www.gstatic.com/');
     res.writeHead(status,{'content-type':contentType,'cache-control':'no-store','content-security-policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'"});res.end(body);
    }});if(completed)return;
   }
   res.writeHead(404);res.end();
  }catch(error){res.writeHead(500,{'content-type':'text/plain'});res.end(error.message);}
 });
 server.listen(port,'0.0.0.0',()=>process.stdout.write(`Vista previa local: http://localhost:${port}\nDatos de QA en memoria; sin servicios de producción.\n`));
})().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
