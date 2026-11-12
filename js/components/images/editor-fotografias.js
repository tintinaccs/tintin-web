import {attachPhotoCrop,photoCropBox,resetPhotoCrop,photoCropStyles} from './recorte-fotografias.mjs?v=tintin-20261112-free-crop-1';
/* Editor local: nunca sube, borra ni sobrescribe archivos. El consumidor confirma la copia. */
const defaults = () => ({width:0,height:0,zoom:1,x:0,y:0,rotation:0,flipX:1,flipY:1,brightness:100,contrast:100,saturation:100,background:'transparent',cropLeft:0,cropTop:0,cropRight:1,cropBottom:1});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
let sequence=0;
function styles(){
 if(document.getElementById('tt-photo-edit-style'))return;
 const style=document.createElement('style');style.id='tt-photo-edit-style';style.textContent=`
 .tt-photo-edit{position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(1120px,calc(100% - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));max-width:none;height:min(900px,calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--color-border,#e4d9df);border-radius:16px;background:var(--color-background-surface,#fff);color:var(--color-text,#222);font:400 14px Montserrat,sans-serif;overflow:auto}
 .tt-photo-edit[open]{display:flex;flex-direction:column}.tt-photo-edit::backdrop{background:rgb(25 15 21 / .65)}
 .tt-photo-edit *{box-sizing:border-box}.tt-photo-edit header,.tt-photo-edit footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px;border-bottom:1px solid var(--color-border,#e4d9df)}
 .tt-photo-edit header,.tt-photo-edit footer{flex-shrink:0}.tt-photo-edit h2{font-size:19px;margin:0}.tt-photo-edit p{margin:6px 0;line-height:1.5}.tt-photo-edit-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,320px);gap:20px;padding:16px;min-height:0;flex:1;overflow:hidden}
 .tt-photo-edit-workspace{min-width:0;min-height:0;align-self:stretch;display:grid;grid-template-rows:minmax(0,1fr) auto;position:static}.tt-photo-edit-preview{min-width:0;min-height:0;position:relative;width:100%;display:grid;place-items:center}.tt-photo-edit canvas{position:absolute;display:block;width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 50% / 16px 16px;border:1px solid var(--color-border,#e4d9df);border-radius:8px;touch-action:none;cursor:grab}
 .tt-photo-edit canvas:focus-visible{outline:3px solid var(--color-primary,#F8AACA);outline-offset:3px}.tt-photo-edit-workspace p{flex-shrink:0}.tt-photo-edit-controls{min-width:0;min-height:0;overflow:auto;display:grid;align-content:start;gap:14px;padding:3px}.tt-photo-edit fieldset{min-width:0;border:1px solid var(--color-border,#e4d9df);border-radius:10px;padding:12px;margin:0}.tt-photo-edit legend{font-weight:700;padding:0 5px}
 .tt-photo-edit label{display:grid;gap:6px;margin:8px 0}.tt-photo-edit input:not([type=range]),.tt-photo-edit select{width:100%;min-height:44px;border:1px solid var(--color-border,#e4d9df);border-radius:8px;padding:8px;color:inherit;background:var(--color-background-surface,#fff);font:inherit;font-size:16px}
 .tt-photo-edit input[type=range]{width:100%;min-height:44px;accent-color:var(--color-primary,#F8AACA);margin:0}.tt-photo-edit button{min-height:44px;min-width:44px;border:1px solid var(--color-border,#e4d9df);border-radius:8px;background:var(--color-background-surface,#fff);color:inherit;font:600 13px Montserrat,sans-serif;padding:10px 12px;cursor:pointer}.tt-photo-edit button:focus-visible{outline:3px solid var(--color-primary,#F8AACA);outline-offset:2px}.tt-photo-edit button:disabled{opacity:.45;cursor:default}
 .tt-photo-edit .primary{background:var(--color-primary,#F8AACA);color:var(--color-text,#222)}.tt-photo-edit-row{display:flex;gap:8px;flex-wrap:wrap}.tt-photo-edit-row>label{flex:1 1 90px;min-width:0}.tt-photo-edit-status{min-height:22px;margin:0 16px!important}.tt-photo-edit footer{border-top:1px solid var(--color-border,#e4d9df);border-bottom:0;position:sticky;bottom:0;background:var(--color-background-surface,#fff);z-index:1;padding-bottom:max(16px,env(safe-area-inset-bottom))}
 @media(max-width:760px){.tt-photo-edit{width:calc(100% - 12px - env(safe-area-inset-left) - env(safe-area-inset-right));max-height:calc(100dvh - 12px)}.tt-photo-edit-layout{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);padding:8px 12px;gap:8px}.tt-photo-edit-workspace{position:static}.tt-photo-edit-preview{height:24dvh}.tt-photo-edit header,.tt-photo-edit footer{padding:12px}.tt-photo-edit-workspace p{font-size:12px}.tt-photo-edit button{font-size:13px}.tt-photo-edit footer{gap:8px;padding-bottom:max(12px,env(safe-area-inset-bottom))}.tt-photo-edit footer .tt-photo-edit-row{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.tt-photo-edit footer .tt-photo-edit-row button{padding:8px 4px}.tt-photo-edit footer .primary{flex:1}}
 @media(max-height:500px) and (min-width:600px){.tt-photo-edit-layout{grid-template-columns:minmax(0,1fr) minmax(250px,300px);grid-template-rows:minmax(0,1fr)}.tt-photo-edit-preview{height:100%}.tt-photo-edit footer .tt-photo-edit-row{width:auto;display:flex;flex-wrap:nowrap}.tt-photo-edit footer .primary{flex:0 1 auto}}
 `+photoCropStyles;document.head.append(style);
}
/** source is a File or an approved image URL. Reopening uses original + state, avoiding compounded compression. */
export async function openPhotoEditor(source,{state:initialState=null,signal}={}){
 if(signal?.aborted)return null;
 styles();
 let image;
 if(typeof source==='string'){
  const url=new URL(source,location.href);
  if(!['https:','http:','blob:'].includes(url.protocol))throw Error('La imagen no tiene una dirección válida.');
  // Read through img-src, already permitted for product photos, without widening connect-src.
  const photo=new Image();photo.crossOrigin='anonymous';
  await new Promise((resolve,reject)=>{
   let timer;
   const done=error=>{clearTimeout(timer);photo.onload=photo.onerror=null;signal?.removeEventListener('abort',cancel);if(error){photo.src='';reject(error);}else resolve();};
   const cancel=()=>done(Error('Edición cancelada.'));
   photo.onload=()=>done();photo.onerror=()=>done(Error('No pudimos abrir la foto. Podés cargar el archivo desde tu dispositivo.'));
   signal?.addEventListener('abort',cancel,{once:true});timer=setTimeout(()=>done(Error('La foto tardó demasiado. Intentá de nuevo.')),20000);photo.src=url.href;
  });
  if(signal?.aborted)return null;
  image=await createImageBitmap(photo);photo.src='';
 }else image=await createImageBitmap(source);
 if(signal?.aborted){image.close();return null;}
 // Preview and export share precisely the same renderer; full resolution is used only on Apply.
 let state={...defaults(),width:image.width,height:image.height,...initialState};
 const fitSize=()=>{const ratio=Math.min(1,4096/state.width,4096/state.height);state.width=Math.max(1,Math.round(state.width*ratio));state.height=Math.max(1,Math.round(state.height*ratio));};fitSize();
 let history=[structuredClone(state)],index=0,working=false,settled=false,drag=null;
 const opener=document.activeElement,dialog=document.createElement('dialog');dialog.className='tt-photo-edit';const titleId='tt-photo-edit-'+(++sequence);dialog.setAttribute('aria-labelledby',titleId);
 const header=document.createElement('header'),title=document.createElement('h2');title.id=titleId;title.textContent='Editar fotografía';header.append(title);
 const button=(text,action,host)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);host.append(b);return b;};
 const layout=document.createElement('div');layout.className='tt-photo-edit-layout';
 const workspace=document.createElement('div');workspace.className='tt-photo-edit-workspace';
 const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Vista previa de la fotografía. Arrastrá para encuadrar; usá las flechas para moverla.');
 const help=document.createElement('p');help.textContent='Arrastrá la foto para encuadrarla. En pantalla táctil podés usar dos dedos para acercar. La edición crea una copia; tu archivo no cambia.';const preview=document.createElement('div');preview.className='tt-photo-edit-preview';preview.append(canvas);workspace.append(preview,help);
 const controls=document.createElement('div');controls.className='tt-photo-edit-controls';layout.append(workspace,controls);
 const status=document.createElement('p');status.className='tt-photo-edit-status';status.setAttribute('role','status');
 const footer=document.createElement('footer'),historyControls=document.createElement('div');historyControls.className='tt-photo-edit-row';footer.append(historyControls);
 dialog.append(header,layout,status,footer);document.body.append(dialog);
 const abort=new AbortController();let cropController=null;
 function sourceSize(){const angle=state.rotation*Math.PI/180,cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle));return{width:image.width*cos+image.height*sin,height:image.width*sin+image.height*cos,cos,sin};}
 function render(target=canvas,full=false){
  const box=photoCropBox(state),ratio=full?1:Math.min(1,1000/state.width,800/state.height);target.width=full?box.width:Math.max(1,Math.round(state.width*ratio));target.height=full?box.height:Math.max(1,Math.round(state.height*ratio));const ctx=target.getContext('2d');
  ctx.scale(ratio,ratio);ctx.translate(state.width/2+state.x*state.width-(full?box.left:0),state.height/2+state.y*state.height-(full?box.top:0));ctx.rotate(state.rotation*Math.PI/180);ctx.scale(state.flipX,state.flipY);
  const {width:extentW,height:extentH}=sourceSize();
  const scale=Math.min(state.width/extentW,state.height/extentH)*state.zoom;
  ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);
  // Pixel adjustment also works on Safari versions without CanvasRenderingContext2D.filter.
  if(state.brightness!==100 || state.contrast!==100 || state.saturation!==100){
   const pixels=ctx.getImageData(0,0,target.width,target.height),data=pixels.data,b=state.brightness/100,c=state.contrast/100,s=state.saturation/100;
   for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const r=(data[i]*b-127.5)*c+127.5,g=(data[i+1]*b-127.5)*c+127.5,blue=(data[i+2]*b-127.5)*c+127.5,gray=.213*r+.715*g+.072*blue;data[i]=gray+(r-gray)*s;data[i+1]=gray+(g-gray)*s;data[i+2]=gray+(blue-gray)*s;}
   ctx.putImageData(pixels,0,0);
  }
  if(state.background!=='transparent'){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='destination-over';ctx.fillStyle=state.background;ctx.fillRect(0,0,target.width,target.height);ctx.restore();}
  if(!full)cropController?.sync();
 }
 const bindings=[];
 function refresh(){for(const {input,key,output} of bindings){input.value=String(state[key]);if(output)output.textContent=`${state[key]}${key==='rotation'?'°':key==='zoom'?'×':'%'}`;}bg.value=state.background;const output=photoCropBox(state),ratio=output.width/output.height;const match=[...format.options].find(option=>option.value!=='free' && Math.abs(ratio-(option.value==='original'?image.width/image.height:Number(option.value)))<.002);format.value=match?.value || 'free';undo.disabled=index===0;redo.disabled=index===history.length-1;render();}
 function record(){if(JSON.stringify(history[index])===JSON.stringify(state))return;history.splice(index+1);history.push(structuredClone(state));if(history.length>50)history.shift();index=history.length-1;refresh();}
 const group=name=>{const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=name;field.append(legend);controls.append(field);return field;};
 function inputField(host,label,key,{min,max,step=1,type='range'}={}){const wrap=document.createElement('label'),text=document.createElement('span'),output=document.createElement('output'),input=document.createElement('input');text.textContent=label+' ';if(type==='range')text.append(output);input.type=type;input.setAttribute('aria-label',label);if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;input.step=step;wrap.append(text,input);host.append(wrap);bindings.push({input,key,output:type==='range'?output:null});input.addEventListener('input',()=>{const value=Number(input.value);if(!Number.isFinite(value))return;state[key]=clamp(value,min,max);if(key==='width'||key==='height')resetPhotoCrop(state);render();if(type==='range')output.textContent=`${state[key]}${key==='rotation'?'°':key==='zoom'?'×':'%'}`;});input.addEventListener('change',record);return input;}
 const crop=group('Encuadre y tamaño'),formatLabel=document.createElement('label'),format=document.createElement('select');formatLabel.textContent='Proporción';format.setAttribute('aria-label','Proporción');
 for(const [value,text] of [['original','Original'],['1','Cuadrada · 1:1'],['0.8','Vertical · 4:5'],['0.75','Vertical · 3:4'],['1.7777777778','Horizontal · 16:9'],['free','Personalizada']]){const option=document.createElement('option');option.value=value;option.textContent=text;format.append(option);}formatLabel.append(format);crop.append(formatLabel);
 format.addEventListener('change',()=>{if(format.value==='free')return;const ratio=format.value==='original'?image.width/image.height:Number(format.value);state.height=Math.round(state.width/ratio);resetPhotoCrop(state);fitSize();record();});
 const dimensions=document.createElement('div');dimensions.className='tt-photo-edit-row';crop.append(dimensions);inputField(dimensions,'Ancho en píxeles','width',{type:'number',min:1,max:4096});inputField(dimensions,'Alto en píxeles','height',{type:'number',min:1,max:4096});
 inputField(crop,'Acercamiento','zoom',{min:0.1,max:5,step:0.05});
 const fitControls=document.createElement('div');fitControls.className='tt-photo-edit-row';crop.append(fitControls);button('Ver foto completa',()=>{state.zoom=1;state.x=state.y=0;resetPhotoCrop(state);record();},fitControls);button('Llenar encuadre',()=>{const size=sourceSize();state.zoom=clamp(Math.max((state.width*size.cos+state.height*size.sin)/image.width,(state.width*size.sin+state.height*size.cos)/image.height)/Math.min(state.width/size.width,state.height/size.height),.1,5);state.x=state.y=0;record();},fitControls);
 const transform=group('Girar y mover');inputField(transform,'Giro','rotation',{min:-180,max:180});
 const transformRow=document.createElement('div');transformRow.className='tt-photo-edit-row';transform.append(transformRow);
 button('Girar 90°',()=>{state.rotation=state.rotation>=90?state.rotation-270:state.rotation+90;record();},transformRow);
 button('Voltear horizontal',()=>{state.flipX*=-1;record();},transformRow);button('Voltear vertical',()=>{state.flipY*=-1;record();},transformRow);button('Centrar',()=>{state.x=state.y=0;record();},transformRow);
 const adjustments=group('Luz y color');inputField(adjustments,'Brillo','brightness',{min:0,max:200});inputField(adjustments,'Contraste','contrast',{min:0,max:200});inputField(adjustments,'Saturación','saturation',{min:0,max:200});
 const bgLabel=document.createElement('label'),bg=document.createElement('select');bgLabel.textContent='Fondo del espacio libre';bg.setAttribute('aria-label','Fondo del espacio libre');for(const [value,text] of [['transparent','Transparente'],['#ffffff','Blanco'],['#F8AACA','Rosa Tintín']]){const option=document.createElement('option');option.value=value;option.textContent=text;bg.append(option);}bgLabel.append(bg);adjustments.append(bgLabel);bg.addEventListener('change',()=>{state.background=bg.value;record();});
 const undo=button('Deshacer',()=>{if(index>0){state=structuredClone(history[--index]);refresh();}},historyControls),redo=button('Rehacer',()=>{if(index<history.length-1){state=structuredClone(history[++index]);refresh();}},historyControls);
 const reset=button('Original',()=>{state={...defaults(),width:image.width,height:image.height};fitSize();record();},historyControls);reset.setAttribute('aria-label','Volver al original');
 cropController=attachPhotoCrop({preview,canvas,host:crop,getState:()=>state,commit:record,previewChanged:()=>{format.value='free';},signal:abort.signal});
 const pointers=new Map();let pinch=null;
 canvas.addEventListener('pointerdown',e=>{if(working||cropController.isActive())return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,startX:state.x,startY:state.y};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:state.zoom};}});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()];state.zoom=clamp(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance),.1,5);}else if(drag&&!pinch){const r=canvas.getBoundingClientRect();const scale=Math.min(r.width/state.width,r.height/state.height);state.x=clamp(drag.startX+(e.clientX-drag.x)/(state.width*scale),-2,2);state.y=clamp(drag.startY+(e.clientY-drag.y)/(state.height*scale),-2,2);}render();});
 const end=e=>{pointers.delete(e.pointerId);pinch=null;drag=null;record();};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('keydown',e=>{if(cropController.isActive()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const amount=e.shiftKey ? 0.05 : 0.01;state.x=clamp(state.x+(e.key==='ArrowLeft'?-amount:e.key==='ArrowRight'?amount:0),-2,2);state.y=clamp(state.y+(e.key==='ArrowUp'?-amount:e.key==='ArrowDown'?amount:0),-2,2);record();});
 let resolve;const result=new Promise(done=>resolve=done);
 function finish(value){if(settled)return;settled=true;abort.abort();dialog.close();dialog.remove();image.close();if(opener?.isConnected)opener.focus({preventScroll:true});resolve(value);}
 button('Cancelar',()=>{if(!working)finish(null);},header);button('Cancelar edición',()=>{if(!working)finish(null);},footer);
 const apply=button('Aplicar edición',async()=>{if(working)return;working=true;dialog.setAttribute('aria-busy','true');for(const control of dialog.querySelectorAll('button,input,select'))control.disabled=true;status.textContent='Preparando copia editada…';try{if(typeof source!=='string' && !initialState && state.width===image.width && state.height===image.height && JSON.stringify(state)===JSON.stringify(history[0])){finish({file:source,state:structuredClone(state),source});return;}const output=document.createElement('canvas');render(output,true);const blob=await new Promise((resolve,reject)=>output.toBlob(value=>value?resolve(value):reject(Error('No pudimos crear la imagen. Reducí el tamaño e intentá de nuevo.')),'image/png'));if(settled)return;if(blob.size>15*1024*1024)throw Error('La copia supera 15 MB. Reducí el tamaño en píxeles e intentá de nuevo.');const name=(source.name||'fotografia').replace(/\.[^.]+$/,'')+'-editada.png';finish({file:new File([blob],name,{type:'image/png'}),state:structuredClone(state),source});}catch(error){status.textContent=error.message;working=false;dialog.removeAttribute('aria-busy');for(const control of dialog.querySelectorAll('button,input,select'))control.disabled=false;refresh();}},footer);apply.className='primary';
 dialog.addEventListener('cancel',event=>{event.preventDefault();if(!working)finish(null);});dialog.addEventListener('close',()=>finish(null));
 signal?.addEventListener('abort',()=>finish(null),{signal:abort.signal,once:true});
 dialog.showModal();refresh();format.focus();return result;
}
