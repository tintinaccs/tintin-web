// Recorte del lienzo ya compuesto: no vuelve a escalar ni a centrar la fotografía.
export function resetPhotoCrop(state){Object.assign(state,{cropLeft:0,cropTop:0,cropRight:1,cropBottom:1});}
export function photoCropBox(state){
 const left=Math.round((state.cropLeft??0)*state.width),top=Math.round((state.cropTop??0)*state.height);
 const right=Math.max(left+1,Math.round((state.cropRight??1)*state.width)),bottom=Math.max(top+1,Math.round((state.cropBottom??1)*state.height));
 return {left,top,width:right-left,height:bottom-top};
}
export function attachPhotoCrop({preview,canvas,host,getState,commit,previewChanged,signal}){
 const layer=document.createElement('div');layer.className='tt-photo-crop-layer';
 const frame=document.createElement('div');frame.className='tt-photo-crop-frame';frame.tabIndex=0;frame.setAttribute('role','group');frame.setAttribute('aria-label','Mover el área de recorte');layer.append(frame);preview.append(layer);
 const actions=document.createElement('div');actions.className='tt-photo-edit-row';
 const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Recortar bordes';toggle.setAttribute('aria-pressed','false');
 const reset=document.createElement('button');reset.type='button';reset.textContent='Restablecer recorte';actions.append(toggle,reset);
 const output=document.createElement('p');output.setAttribute('role','status');output.className='tt-photo-crop-size';
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ajuste exacto por borde';details.append(summary);
 const fields=document.createElement('div');fields.className='tt-photo-edit-row';details.append(fields);
 host.querySelector('legend').after(actions,output,details);
 let active=false,gesture=null,scheduled=0;const help=preview.nextElementSibling,originalHelp=help?.textContent;
 const edges=[['left','izquierdo'],['top','superior'],['right','derecho'],['bottom','inferior']];
 const inputs=[];
 function applyEdge(edge,value){const s=getState(),minimum=edge==='left'||edge==='right'?1/s.width:1/s.height;
  if(edge==='left')s.cropLeft=Math.max(0,Math.min(value,s.cropRight-minimum));
  if(edge==='right')s.cropRight=Math.min(1,Math.max(value,s.cropLeft+minimum));
  if(edge==='top')s.cropTop=Math.max(0,Math.min(value,s.cropBottom-minimum));
  if(edge==='bottom')s.cropBottom=Math.min(1,Math.max(value,s.cropTop+minimum));
 }
 for(const [edge,label]of edges){const wrap=document.createElement('label');wrap.textContent=label[0].toUpperCase()+label.slice(1)+' (%)';const input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='0.01';input.setAttribute('aria-label','Recortar borde '+label+' (%)');wrap.append(input);fields.append(wrap);inputs.push({edge,input});
  input.addEventListener('input',()=>{const n=Number(input.value);if(!Number.isFinite(n))return;applyEdge(edge,edge==='right'||edge==='bottom'?1-n/100:n/100);previewChanged();sync(false);},{signal});input.addEventListener('change',()=>{commit();sync();},{signal});
 }
 function sync(updateInputs=true){
  if(signal.aborted)return;const message=active?'Arrastrá los bordes o las esquinas para cortar. La zona oscura queda fuera de la foto.':originalHelp;if(help && help.textContent!==message)help.textContent=message;canvas.closest('.tt-photo-edit').classList.toggle('tt-photo-is-cropping',active);const s=getState(),box=photoCropBox(s),r=canvas.getBoundingClientRect(),p=preview.getBoundingClientRect(),css=getComputedStyle(canvas);
  const leftBorder=parseFloat(css.borderLeftWidth)||0,rightBorder=parseFloat(css.borderRightWidth)||0,topBorder=parseFloat(css.borderTopWidth)||0,bottomBorder=parseFloat(css.borderBottomWidth)||0;
  Object.assign(layer.style,{left:(r.left-p.left+leftBorder)+'px',top:(r.top-p.top+topBorder)+'px',width:Math.max(0,r.width-leftBorder-rightBorder)+'px',height:Math.max(0,r.height-topBorder-bottomBorder)+'px'});
  Object.assign(frame.style,{left:s.cropLeft*100+'%',top:s.cropTop*100+'%',width:(s.cropRight-s.cropLeft)*100+'%',height:(s.cropBottom-s.cropTop)*100+'%'});
  const changed=s.cropLeft>0||s.cropTop>0||s.cropRight<1||s.cropBottom<1;
  layer.hidden=!active&&!changed;layer.classList.toggle('is-active',active);frame.tabIndex=active?0:-1;
  for(const handle of frame.querySelectorAll('button')){handle.hidden=!active;handle.tabIndex=active?0:-1;}
  toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'Terminar recorte':'Recortar bordes';
  output.textContent=`Foto final: ${box.width} × ${box.height} píxeles`;
  if(updateInputs)for(const {edge,input}of inputs){const value=s['crop'+edge[0].toUpperCase()+edge.slice(1)];input.value=String(Math.round((edge==='right'||edge==='bottom'?1-value:value)*10000)/100);}
 }
 const schedule=()=>{if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;sync();});};
 toggle.addEventListener('click',()=>{active=!active;sync();if(active)frame.focus({preventScroll:true});},{signal});
 reset.addEventListener('click',()=>{resetPhotoCrop(getState());commit();sync();},{signal});
 const handles=[['n','superior'],['s','inferior'],['w','izquierdo'],['e','derecho'],['nw','esquina superior izquierda'],['ne','esquina superior derecha'],['sw','esquina inferior izquierda'],['se','esquina inferior derecha']];
 for(const [direction,label]of handles){const button=document.createElement('button');button.type='button';button.className='tt-photo-crop-handle tt-photo-crop-'+direction;button.dataset.cropDirection=direction;button.setAttribute('aria-label','Recortar '+(label.startsWith('esquina')?label:'borde '+label));const mark=document.createElement('span');mark.setAttribute('aria-hidden','true');button.append(mark);frame.append(button);}
 function move(direction,dx,dy,start){const s=getState();
  if(!direction){const x=Math.max(-start.cropLeft,Math.min(dx,1-start.cropRight)),y=Math.max(-start.cropTop,Math.min(dy,1-start.cropBottom));Object.assign(s,{cropLeft:start.cropLeft+x,cropRight:start.cropRight+x,cropTop:start.cropTop+y,cropBottom:start.cropBottom+y});}
  else {if(direction.includes('w'))applyEdge('left',start.cropLeft+dx);if(direction.includes('e'))applyEdge('right',start.cropRight+dx);if(direction.includes('n'))applyEdge('top',start.cropTop+dy);if(direction.includes('s'))applyEdge('bottom',start.cropBottom+dy);}
  previewChanged();sync();
 }
 frame.addEventListener('pointerdown',event=>{if(!active||gesture||event.button>0)return;event.preventDefault();const target=event.target.closest('[data-crop-direction]')||frame;target.focus({preventScroll:true});frame.setPointerCapture(event.pointerId);gesture={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...getState()},direction:target.dataset.cropDirection||'',bounds:layer.getBoundingClientRect()};},{signal});
 frame.addEventListener('pointermove',event=>{if(!gesture||gesture.id!==event.pointerId)return;move(gesture.direction,(event.clientX-gesture.x)/gesture.bounds.width,(event.clientY-gesture.y)/gesture.bounds.height,gesture.start);},{signal});
 const end=event=>{if(!gesture||gesture.id!==event.pointerId)return;gesture=null;commit();sync();};
 frame.addEventListener('pointerup',end,{signal});frame.addEventListener('pointercancel',end,{signal});
 frame.addEventListener('keydown',event=>{if(!active||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const step=event.shiftKey ? 0.05 : 0.01;move(event.target.dataset.cropDirection||'',event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0,{...getState()});commit();},{signal});
 const observer=new ResizeObserver(schedule);observer.observe(canvas);observer.observe(preview);
 signal.addEventListener('abort',()=>{observer.disconnect();if(scheduled)cancelAnimationFrame(scheduled);},{once:true});schedule();
 return {sync:schedule,isActive:()=>active};
}
export const photoCropStyles=`
.tt-photo-crop-layer{position:absolute;overflow:hidden;pointer-events:none;z-index:2}.tt-photo-crop-layer[hidden]{display:none}.tt-photo-crop-frame{position:absolute;border:2px solid var(--color-primary,#F8AACA);box-shadow:0 0 0 2000px rgb(0 0 0 / .5);pointer-events:none;touch-action:none;outline:none}
.tt-photo-crop-layer.is-active .tt-photo-crop-frame{pointer-events:auto;cursor:move}.tt-photo-crop-frame:focus-visible{border-color:#fff;outline:2px solid var(--color-primary,#F8AACA);outline-offset:-4px}
.tt-photo-edit .tt-photo-crop-handle{position:absolute;width:44px;height:44px;min-width:44px;min-height:44px;margin:0;padding:0;border:0;border-radius:0;background:transparent;touch-action:none;display:grid;place-items:center;color:#fff}
.tt-photo-edit .tt-photo-crop-handle[hidden]{display:none}.tt-photo-crop-handle span{display:block;width:22px;height:5px;border-radius:2px;background:#fff;box-shadow:0 0 0 1px var(--color-primary,#F8AACA),0 1px 4px #222}
.tt-photo-edit .tt-photo-crop-n{top:0;left:50%;transform:translateX(-50%);cursor:ns-resize}.tt-photo-edit .tt-photo-crop-s{bottom:0;left:50%;transform:translateX(-50%);cursor:ns-resize}.tt-photo-edit .tt-photo-crop-w{left:0;top:50%;transform:translateY(-50%);cursor:ew-resize}.tt-photo-edit .tt-photo-crop-e{right:0;top:50%;transform:translateY(-50%);cursor:ew-resize}.tt-photo-crop-w span,.tt-photo-crop-e span{width:5px;height:22px}
.tt-photo-edit .tt-photo-crop-nw{top:0;left:0;cursor:nwse-resize}.tt-photo-edit .tt-photo-crop-ne{top:0;right:0;cursor:nesw-resize}.tt-photo-edit .tt-photo-crop-sw{bottom:0;left:0;cursor:nesw-resize}.tt-photo-edit .tt-photo-crop-se{bottom:0;right:0;cursor:nwse-resize}.tt-photo-crop-nw span,.tt-photo-crop-ne span,.tt-photo-crop-sw span,.tt-photo-crop-se span{width:16px;height:16px;border:4px solid #fff;background:transparent;border-radius:0}
.tt-photo-edit details>summary{min-height:44px;line-height:1.5;display:list-item;padding:12px 0;cursor:pointer}.tt-photo-crop-size{font-size:12px}
@media(max-width:760px) and (min-height:700px){.tt-photo-edit.tt-photo-is-cropping .tt-photo-edit-preview{height:34dvh}}
`;
