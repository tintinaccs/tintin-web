// Technical flat-color export of the approved mark; no regenerated artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { deflateSync } from 'node:zlib';

// A single-color mark needs only its256 alpha levels. Indexed PNG keeps every
// alpha value at native resolution while avoiding four bytes per pixel.
function chunk(type, data) {
  const name = Buffer.from(type), payload = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc>>>1) ^ ((crc&1)?0xedb88320:0);
  }
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([length, payload, checksum]);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'assets-tintin/images/home/hero-editorial');
const source = await fs.readFile(path.join(directory, 'tintin-white.webp'));
const browser = await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try {
  const page = await browser.newPage();
  const mark = await page.evaluate(async source => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0,0,canvas.width,canvas.height).data;
    const alpha = Array.from({length:canvas.width*canvas.height},(_,index)=>rgba[index*4+3]);
    return {width:canvas.width,height:canvas.height,alpha};
  }, 'data:image/webp;base64,' + source.toString('base64'));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(mark.width,0); header.writeUInt32BE(mark.height,4);
  header[8]=8; header[9]=3;
  const palette=Buffer.alloc(256*3), transparency=Buffer.alloc(256);
  for(let index=0;index<256;index++){
    palette[index*3]=0x91; palette[index*3+1]=0x3a; palette[index*3+2]=0x5d;
    transparency[index]=index;
  }
  const rows=Buffer.alloc((mark.width+1)*mark.height);
  for(let y=0;y<mark.height;y++) rows.set(mark.alpha.slice(y*mark.width,(y+1)*mark.width),y*(mark.width+1)+1);
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('PLTE',palette),chunk('tRNS',transparency),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
  await fs.writeFile(path.join(directory, 'tintin-contrast.png'), png);
  console.log('Marca plana exportada desde el alfa original, sin redibujar.');
} finally {
  await browser.close();
}
