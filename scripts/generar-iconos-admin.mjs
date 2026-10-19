// Derivados técnicos del logo original: conserva su canal alfa, sin redibujarlo.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await fs.readFile(path.join(root,'assets-tintin/images/general/logo.png'));
const target=path.join(root,'assets-tintin/images/admin');
await fs.mkdir(target,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try {
 const page=await browser.newPage();
 for(const [size,name,badge] of [[192,'push-icon-192.png',false],[512,'app-icon-512.png',false],[180,'apple-touch-icon.png',false],[96,'push-badge-96.png',true]]) {
  const data=await page.evaluate(async({source,size,badge})=>{
   const image=new Image();image.src=source;await image.decode();
   const original=document.createElement('canvas');original.width=image.width;original.height=image.height;
   const ctx=original.getContext('2d');ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,image.width,image.height).data;
   let left=image.width,top=image.height,right=0,bottom=0;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
   ctx.globalCompositeOperation='source-in';ctx.fillStyle='#fff';ctx.fillRect(0,0,image.width,image.height);
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
   const out=canvas.getContext('2d');
   if(!badge){out.fillStyle='#F8AACA';out.fillRect(0,0,size,size);}
   const scale=size*.66/Math.max(right-left,bottom-top),width=(right-left)*scale,height=(bottom-top)*scale;
   out.drawImage(original,left,top,right-left,bottom-top,(size-width)/2,(size-height)/2,width,height);
   return canvas.toDataURL('image/png').split(',')[1];
  },{source:'data:image/png;base64,'+source.toString('base64'),size,badge});
  await fs.writeFile(path.join(target,name),Buffer.from(data,'base64'));
  console.log('Icono original exportado:',name);
 }
} finally {await browser.close();}
