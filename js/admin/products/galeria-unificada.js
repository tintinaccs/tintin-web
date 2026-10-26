import {attachColorPhotos} from './fotos-por-color.js?v=tintin-20261026-editor-studio-1';
import {sanitizeImageUrl} from '../../components/images/utilidades-imagenes.js?v=tintin-20261015-images-1';
import {attachMultiImageUploadWidget,attachImageUploadWidget} from '../../components/images/carga-imagenes.js?v=tintin-20261025-gallery-unified-1';

// Contrato existente: portada + doce adicionales. No se amplía almacenamiento.
export const PRODUCT_PHOTO_LIMIT=13;
export function attachProductGallery({container,product={},mainInput,imagesInput,variantsInput,openLibrary}) {
  const media=window.TintinProductMedia;
  const abort=new AbortController();let destroyed=false,replacement=null,lastGalleryState='';
  container.replaceChildren();container.classList.add('tt-unified-photos');
  const heading=document.createElement('h3');heading.textContent='FOTOGRAFÍAS DEL PRODUCTO';
  const hint=document.createElement('p');hint.textContent='Elegí una portada para todo el producto. Las asociaciones conservan la imagen propia de cada color o combinación.';
  const uploadHost=document.createElement('div'),grid=document.createElement('div'),context=document.createElement('div');grid.className='tt-unified-photo-grid';
  const status=document.createElement('p');status.setAttribute('role','status');
  const associationHost=document.createElement('div');associationHost.hidden=true;
  container.append(heading,hint,uploadHost,status,grid,context,associationHost);
  const associations=attachColorPhotos({container:associationHost,product,mainInput,imagesInput,variantsInput,openLibrary,headless:true});
  const card=container.closest('#prod-form-card');
  card?.addEventListener('tintin:option-media-read',event=>{event.detail.rows=associations.serialize();},{signal:abort.signal});
  card?.addEventListener('tintin:color-appearance',event=>{const {color,colorHex}=event.detail;if(!/^#[\da-f]{6}$/i.test(colorHex))return;associations.setAppearance(color,{colorHex});render();},{signal:abort.signal});
  const urls=()=>media.uniqueImages([mainInput.value,...imagesInput.value.split(/\r?\n/),...associations.serialize().flatMap(media.rowImages)].map(sanitizeImageUrl).filter(Boolean));
  // Los campos existentes siguen siendo la autoridad de orden/portada.
  function publish(next,cover=next[0]){
    mainInput.value=next.includes(cover)?cover:next[0] || '';
    imagesInput.value=next.filter(url=>media.imageKey(url)!==media.imageKey(mainInput.value)).join('\n');
    mainInput.dispatchEvent(new Event('change',{bubbles:true}));imagesInput.dispatchEvent(new Event('input',{bubbles:true}));
    render();
  }
  function add(value){if(destroyed)throw Error('El producto cambió.');const safe=sanitizeImageUrl(value);if(!safe)throw Error('La imagen no tiene una URL válida.');const current=urls();if(current.includes(safe))return;if(current.length>=PRODUCT_PHOTO_LIMIT)throw Error('Máximo 13 fotografías por producto.');publish([...current,safe]);}
  const upload=attachMultiImageUploadWidget(uploadHost,{maxImages:PRODUCT_PHOTO_LIMIT,remaining:()=>Math.max(0,PRODUCT_PHOTO_LIMIT-urls().length),onOpenLibrary:openLibrary,onChange:add});
  function button(text,action,parent,label=text){const node=document.createElement('button');node.type='button';node.className='adm-btn adm-btn-outline';node.textContent=text;node.setAttribute('aria-label',label);node.addEventListener('click',action);parent.append(node);return node;}
  function refocus(url){grid.querySelector(`[data-photo-key="${CSS.escape(media.imageKey(url))}"] button`)?.focus({preventScroll:true});}
  function groups(){const result=new Map();for(const line of variantsInput.value.split(/\r?\n/)){const index=line.indexOf(':');if(index<1)continue;const key=line.slice(0,index).trim();result.set(key,[...new Set([...(result.get(key)||[]),...line.slice(index+1).split(',').map(s=>s.trim()).filter(Boolean)])]);}return [...result];}
  function associate(url){
    replacement?.destroy();replacement=null;context.replaceChildren();
    const title=document.createElement('h4');title.textContent='Asociaciones de esta fotografía';context.append(title);
    const explanation=document.createElement('p');explanation.textContent='Elegí sólo Color para una asociación por color, o varios atributos para una combinación. Su primera fotografía mantiene la portada de esa selección.';context.append(explanation);
    const selected={};
    for(const [key,values] of groups()){const label=document.createElement('label');label.textContent=key;const select=document.createElement('select');select.setAttribute('aria-label',`Asociación: ${key}`);for(const value of ['',...values]){const option=document.createElement('option');option.value=value;option.textContent=value||'Cualquiera';select.append(option);}select.addEventListener('change',()=>{if(select.value)selected[key]=select.value;else delete selected[key];});label.append(select);context.append(label);}
    const apply=remove=>{if(!Object.keys(selected).length){status.textContent='Elegí al menos un atributo.';return;}const rows=associations.serialize();const metadata=new Set(['imageUrl','imageUrls','stock','price','sku','active','colorHex','swatch']);const row=rows.find(row=>{const keys=Object.keys(row).filter(k=>!metadata.has(k));return keys.length===Object.keys(selected).length && keys.every(k=>row[k]===selected[k]);});const photos=media.rowImages(row);associations.setPhotos({...selected},remove?photos.filter(photo=>media.imageKey(photo)!==media.imageKey(url)):media.uniqueImages([...photos,url]));status.textContent=remove?'Asociación quitada.':'Asociación guardada en el borrador.';render();};
    button('Asociar fotografía',()=>apply(false),context);button('Quitar asociación',()=>apply(true),context);button('Cerrar asociaciones',()=>context.replaceChildren(),context);
    context.querySelector('select')?.focus({preventScroll:true});
  }
  function replace(url){
    replacement?.destroy();context.replaceChildren();
    const host=document.createElement('div');context.append(host);
    replacement=attachImageUploadWidget(host,{label:'Reemplazar fotografía',cleanupPrevious:false,onOpenLibrary:openLibrary,onChange:value=>{
      const safe=sanitizeImageUrl(value);if(!safe)throw Error('Elegí una imagen válida.');if(destroyed)throw Error('El producto cambió.');
      const current=urls();if(current.some(photo=>media.imageKey(photo)===media.imageKey(safe)) && media.imageKey(url)!==media.imageKey(safe))throw Error('Esa fotografía ya está en la galería.');
      const next=current.map(photo=>media.imageKey(photo)===media.imageKey(url)?safe:photo);associations.replacePhoto(url,safe);publish(next,media.imageKey(mainInput.value)===media.imageKey(url)?safe:mainInput.value);status.textContent='Fotografía reemplazada; asociaciones conservadas.';
    }});
    button('Cancelar reemplazo',()=>{replacement?.destroy();replacement=null;context.replaceChildren();refocus(url);},context);
  }
  function render(){
    if(destroyed)return;const photos=urls(),rows=associations.serialize();
    const state=JSON.stringify([photos,mainInput.value,groups(),rows]);
    if(state===lastGalleryState)return;lastGalleryState=state;
    const focus=grid.contains(document.activeElement)?document.activeElement?.getAttribute('aria-label'):null;
    grid.replaceChildren();
    photos.forEach((url,index)=>{
      const tile=document.createElement('article');tile.className='tt-unified-photo';tile.dataset.photoKey=media.imageKey(url);
      const image=document.createElement('img');image.src=url;image.alt=`Fotografía ${index+1}`;image.loading='lazy';tile.append(image);
      const cover=media.imageKey(mainInput.value)===media.imageKey(url),badge=document.createElement('strong');badge.textContent=cover?'PORTADA':`Foto ${index+1}`;tile.append(badge);
      const assigned=document.createElement('small');assigned.textContent=rows.filter(row=>media.rowImages(row).some(photo=>media.imageKey(photo)===media.imageKey(url))).map(row=>Object.entries(row).filter(([key])=>!['imageUrl','imageUrls','stock','price','sku','active','colorHex','swatch'].includes(key)).map(([key,value])=>`${key}: ${value}`).join(' / ')).join(' · ');tile.append(assigned);
      const actions=document.createElement('div');actions.className='tt-unified-photo-actions';tile.append(actions);
      button('Ver imagen',()=>{const dialog=document.createElement('dialog');const img=document.createElement('img');img.src=url;img.alt=`Fotografía ${index+1}`;img.style.cssText='max-width:85vw;max-height:75vh';dialog.append(img);button('Cerrar imagen',()=>dialog.close(),dialog);dialog.addEventListener('close',()=>{dialog.remove();refocus(url);},{once:true});container.append(dialog);dialog.showModal();},actions,`Ver foto ${index+1}`);
      const choose=button(cover?'Portada':'Elegir portada',()=>{publish([url,...photos.filter(photo=>photo!==url)],url);refocus(url);},actions,`Portada: foto ${index+1}`);choose.setAttribute('aria-pressed',String(cover));
      const move=to=>{const next=[...photos];next.splice(index,1);next.splice(to,0,url);publish(next);refocus(url);};
      for(const [label,to] of [['Anterior',index-1],['Siguiente',index+1]]){const control=button(label,()=>move(to),actions,`${label}: foto ${index+1}`);control.disabled=to<0||to>=photos.length;}
      button('Reemplazar',()=>replace(url),actions,`Reemplazar foto ${index+1}`);
      button('Quitar',()=>{associations.removePhoto(url);publish(photos.filter(photo=>photo!==url));context.replaceChildren();status.textContent='Quitada del producto. El archivo compartido permanece en la biblioteca.';grid.querySelector('button')?.focus({preventScroll:true});},actions,`Quitar foto ${index+1}`);
      if(groups().length)button('Asociar',()=>associate(url),actions,`Asociar foto ${index+1}`);
      tile.draggable=true;tile.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-tintin-product-photo',url);});tile.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('application/x-tintin-product-photo'))event.preventDefault();});tile.addEventListener('drop',event=>{event.preventDefault();const from=photos.indexOf(event.dataTransfer.getData('application/x-tintin-product-photo'));if(from<0||from===index)return;const next=[...photos];const [photo]=next.splice(from,1);next.splice(index,0,photo);publish(next);refocus(photo);});
      grid.append(tile);
    });
    if(focus)[...grid.querySelectorAll('[aria-label]')].find(node=>node.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
  }
  for(const [input,event] of [[mainInput,'change'],[imagesInput,'input'],[variantsInput,'input']])input.addEventListener(event,render,{signal:abort.signal});
  render();
  return {serialize:associations.serialize,refresh:render,pendingSignature:()=>[upload.pendingSignature(),replacement?.pendingSignature()||[]],async flush(){await upload.flush();await replacement?.flush();await associations.flush();if(urls().length>PRODUCT_PHOTO_LIMIT)throw Error('Este producto histórico supera las 13 fotos generales. Conservá sus asociaciones y revisá la galería antes de guardar.');},destroy(){destroyed=true;abort.abort();upload.destroy();replacement?.destroy();associations.destroy();container.replaceChildren();}};
}
