// Derivados técnicos del alfa del logo original: conserva su silueta, sin redibujarla.
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
 const render=async(size,kind)=>page.evaluate(async({source,size,kind})=>{
  const image=new Image();image.src=source;await image.decode();
  const original=document.createElement('canvas');original.width=image.width;original.height=image.height;
  const ctx=original.getContext('2d');ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,image.width,image.height).data;
  let left=image.width,top=image.height,right=0,bottom=0;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
  ctx.globalCompositeOperation='source-in';ctx.fillStyle=kind==='badge'?'#fff':'#CF367B';ctx.fillRect(0,0,image.width,image.height);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const out=canvas.getContext('2d');out.imageSmoothingQuality='high';
  if(kind==='circle'){out.fillStyle='#FFF1F7';out.beginPath();out.arc(size/2,size/2,size/2,0,Math.PI*2);out.fill();}
  // Apple aplica su propia máscara; un lienzo opaco evita esquinas negras.
  // El icono maskable mantiene toda la marca dentro del círculo seguro del 80%.
  if(kind==='apple'||kind==='maskable'){out.fillStyle='#FFF1F7';out.fillRect(0,0,size,size);}
  const fraction=kind==='favicon'?.94:kind==='maskable'?.66:kind==='badge'?.66:.78;
  const scale=size*fraction/Math.max(right-left,bottom-top),width=(right-left)*scale,height=(bottom-top)*scale;
  const passes=kind==='favicon'?(size===16?3:size<=32?2:1):1;
  for(let pass=0;pass<passes;pass++)out.drawImage(original,left,top,right-left,bottom-top,(size-width)/2,(size-height)/2,width,height);
  return {png:canvas.toDataURL('image/png').split(',')[1],pixels:Array.from(out.getImageData(0,0,size,size).data)};
 },{source:'data:image/png;base64,'+source.toString('base64'),size,kind});
 for(const [size,name,kind] of [[192,'push-icon-192.png','circle'],[512,'app-icon-512.png','circle'],[512,'app-icon-maskable-512.png','maskable'],[180,'apple-touch-icon.png','apple'],[96,'push-badge-96.png','badge']]) {
  const data=await render(size,kind);
  await fs.writeFile(path.join(target,name),Buffer.from(data.png,'base64'));
  console.log('Icono original exportado:',name);
 }
 for(const [sourceName,filename] of [['push-icon-192.png','favicon-192x192.png'],['app-icon-512.png','favicon-512x512.png'],['apple-touch-icon.png','apple-touch-icon.png']]) await fs.copyFile(path.join(target,sourceName),path.join(root,filename));
 const icons=[];
 for(const size of [16,24,32,48,64]) {
  const data=await render(size,'favicon');
  if(size===16||size===32)await fs.writeFile(path.join(root,`favicon-${size}x${size}.png`),Buffer.from(data.png,'base64'));
  // DIB BGRA y máscara AND real para lectores ICO antiguos sin soporte alfa.
  const stride=Math.ceil(size/32)*4;
  const bitmap=Buffer.alloc(40+size*size*4+stride*size);
  bitmap.writeUInt32LE(40,0);bitmap.writeInt32LE(size,4);bitmap.writeInt32LE(size*2,8);
  bitmap.writeUInt16LE(1,12);bitmap.writeUInt16LE(32,14);bitmap.writeUInt32LE(size*size*4,20);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const from=(y*size+x)*4,to=40+((size-1-y)*size+x)*4;
   bitmap[to]=data.pixels[from+2];bitmap[to+1]=data.pixels[from+1];bitmap[to+2]=data.pixels[from];bitmap[to+3]=data.pixels[from+3];
   if(data.pixels[from+3]<128)bitmap[40+size*size*4+(size-1-y)*stride+(x>>3)]|=0x80>>(x%8);
  }
  icons.push({size,bytes:bitmap});
 }
 const header=Buffer.alloc(6+16*icons.length);header.writeUInt16LE(1,2);header.writeUInt16LE(icons.length,4);
 let offset=header.length;
 icons.forEach(({size,bytes},i)=>{const at=6+16*i;header[at]=header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(bytes.length,at+8);header.writeUInt32LE(offset,at+12);offset+=bytes.length;});
 await fs.writeFile(path.join(root,'favicon.ico'),Buffer.concat([header,...icons.map(icon=>icon.bytes)]));
} finally {await browser.close();}
