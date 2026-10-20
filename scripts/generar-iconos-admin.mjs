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
 // Las rutas canónicas también las usan instalaciones antiguas y fallbacks de Apple.
 for(const [sourceName,filename] of [['push-icon-192.png','favicon-192x192.png'],['app-icon-512.png','favicon-512x512.png'],['apple-touch-icon.png','apple-touch-icon.png']]) {
  await fs.copyFile(path.join(target,sourceName),path.join(root,filename));
 }
 const pngs=[];
 for(const size of [16,32]) {
  const png=await page.evaluate(async({source,size})=>{
   const image=new Image();image.src=source;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
   const context=canvas.getContext('2d');context.fillStyle='#F8AACA';context.fillRect(0,0,size,size);
   // Refuerza el mismo trazo blanco al reducirlo a favicons de 16/32px.
   for(let pass=0;pass<(size===16?6:2);pass++)context.drawImage(image,0,0,size,size);
   return {png:canvas.toDataURL('image/png').split(',')[1],pixels:Array.from(context.getImageData(0,0,size,size).data)};
  },{source:'data:image/png;base64,'+(await fs.readFile(path.join(target,'push-badge-96.png'))).toString('base64'),size});
  const bytes=Buffer.from(png.png,'base64');
  await fs.writeFile(path.join(root,`favicon-${size}x${size}.png`),bytes);
  // DIB BGRA y máscara AND: compatible también con lectores ICO antiguos.
  const bitmap=Buffer.alloc(40+size*size*4+Math.ceil(size/32)*4*size);
  bitmap.writeUInt32LE(40,0);bitmap.writeInt32LE(size,4);bitmap.writeInt32LE(size*2,8);
  bitmap.writeUInt16LE(1,12);bitmap.writeUInt16LE(32,14);bitmap.writeUInt32LE(size*size*4,20);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const from=(y*size+x)*4,to=40+((size-1-y)*size+x)*4;
   bitmap[to]=png.pixels[from+2];bitmap[to+1]=png.pixels[from+1];bitmap[to+2]=png.pixels[from];bitmap[to+3]=png.pixels[from+3];
  }
  pngs.push({size,bytes:bitmap});
 }
 const header=Buffer.alloc(6+16*pngs.length);header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);
 let offset=header.length;
 pngs.forEach(({size,bytes},i)=>{const at=6+16*i;header[at]=header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(bytes.length,at+8);header.writeUInt32LE(offset,at+12);offset+=bytes.length;});
 await fs.writeFile(path.join(root,'favicon.ico'),Buffer.concat([header,...pngs.map(icon=>icon.bytes)]));
} finally {await browser.close();}
