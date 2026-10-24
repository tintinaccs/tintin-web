import {suggestedCategory} from './vision-productos-core.mjs?v=tintin-20261024-editor-intuitivo-1';

const mounted=new WeakSet();
const setValue=(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};

async function imagePixels(url) {
  const image=new Image();image.crossOrigin='anonymous';
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{image.src='';reject(Error());},15000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(Error());};image.src=url;});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=224;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='#fff';context.fillRect(0,0,224,224);
  const scale=Math.min(224/image.naturalWidth,224/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  context.drawImage(image,(224-width)/2,(224-height)/2,width,height);
  const bytes=context.getImageData(0,0,224,224).data,pixels=new Float32Array(3*224*224);
  const mean=[.48145466,.4578275,.40821073],std=[.26862954,.26130258,.27577711];
  for(let index=0;index<224*224;index++)for(let channel=0;channel<3;channel++)pixels[channel*224*224+index]=(bytes[index*4+channel]/255-mean[channel])/std[channel];
  return pixels;
}

export function mountLocalVision(card) {
  const photos=card?.querySelector('[data-product-section=photos] .tt-editor-section-fields');
  if(!photos || mounted.has(card))return;mounted.add(card);
  const panel=document.createElement('details');panel.className='tt-editor-vision';
  const summary=document.createElement('summary');summary.textContent='Sugerencias desde la foto';
  const hint=document.createElement('p');hint.textContent='Reconocimiento en este dispositivo, sin enviar la foto a una IA externa. La primera vez descarga unos 50 MB. Vos elegís qué aplicar.';
  const analyze=document.createElement('button');analyze.type='button';analyze.className='adm-btn adm-btn-outline';analyze.textContent='Analizar imagen principal';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='adm-btn adm-btn-outline';cancel.textContent='Cancelar análisis';cancel.hidden=true;
  const status=document.createElement('p');status.setAttribute('role','status');status.className='tt-editor-caption';
  const results=document.createElement('div');results.className='tt-editor-choices';
  panel.append(summary,hint,analyze,cancel,status,results);photos.append(panel);
  let worker=null,generation=0,timer;
  const source=()=>card.querySelector('#prod-image-widget .tt-iuw-preview img')?.getAttribute('src') || card.querySelector('#prod-imageUrl')?.value || '';
  const stop=()=>{generation++;clearTimeout(timer);worker?.terminate();worker=null;analyze.disabled=false;cancel.hidden=true;};
  const invalidate=()=>{stop();results.replaceChildren();status.textContent='';};
  cancel.addEventListener('click',()=>{stop();status.textContent='Análisis cancelado. Podés seguir editando.';});
  card.addEventListener('tintin:image-preview',invalidate);
  card.addEventListener('input',event=>{if(event.target.id==='prod-imageUrl' || event.target.id==='prod-id')invalidate();});
  const identity=()=>`${card.querySelector('#prod-id')?.value || ''}|${source()}`;
  let previous=identity();
  new MutationObserver(()=>{
    const next=identity();
    if(next!==previous || (worker && (card.style.display==='none' || card.hidden))){previous=next;invalidate();}
  }).observe(card,{attributes:true,childList:true,subtree:true,attributeFilter:['src','style','hidden']});
  analyze.addEventListener('click',async()=>{
    invalidate();const url=source();
    if(!url){status.textContent='Agregá una imagen principal para analizarla.';return;}
    const attempt=generation,productIdentity=identity();analyze.disabled=true;cancel.hidden=false;status.textContent='Preparando el reconocimiento local…';
    const current=()=>attempt===generation && identity()===productIdentity;
    const action=(text,handler)=>{const button=document.createElement('button');button.type='button';button.className='tt-editor-choice';button.textContent=text;button.addEventListener('click',()=>{if(current())handler();else invalidate();});results.append(button);};
    timer=setTimeout(()=>{if(current()){stop();status.textContent='El análisis tardó demasiado. Podés reintentar o completar los datos manualmente.';}},60000);
    try {
      const pixels=await imagePixels(url);if(!current())return;
      worker=new Worker(new URL('./vision-productos-worker.js?v=tintin-20261024-editor-intuitivo-1',import.meta.url),{type:'module'});
      worker.onerror=()=>{if(!current())return;stop();status.textContent='No se pudo iniciar el reconocimiento local. Podés completar los datos manualmente.';};
      worker.onmessage=event=>{
        if(!current())return;
        clearTimeout(timer);worker?.terminate();worker=null;analyze.disabled=false;cancel.hidden=true;
        if(!event.data?.ok){status.textContent='No se pudo analizar esta foto. Podés reintentar o completar los datos manualmente.';return;}
        const suggestion=event.data.suggestion;
        status.textContent=suggestion?`Podría ser: ${suggestion.label}. Revisá la sugerencia antes de aplicarla. El material se confirma con la ficha del producto.`:'No pude reconocer el tipo de producto con suficiente claridad. Podés completar los datos manualmente.';
        if(suggestion){
          const category=card.querySelector('#prod-category'),value=suggestedCategory(suggestion.key,category?.options);
          if(value && !category.disabled)action(`Usar categoría ${Array.from(category.options).find(option=>option.value===value).textContent}`,()=>{if(category.disabled)return;setValue(category,value);status.textContent='Categoría aplicada al borrador. Confirmá el material en Detalles del producto.';});
        }
      };
      worker.postMessage({pixels},[pixels.buffer]);
    } catch {if(current()){stop();status.textContent='No se pudo leer esta imagen. Probá con una foto subida desde tu dispositivo.';}}
  });
}
