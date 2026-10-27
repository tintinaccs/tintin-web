import {attachColorPhotos} from './fotos-por-color.js?v=tintin-20261026-editor-phase6-1';
import {sanitizeImageUrl} from '../../components/images/utilidades-imagenes.js?v=tintin-20261015-images-1';
import {attachMultiImageUploadWidget,attachImageUploadWidget} from '../../components/images/carga-imagenes.js?v=tintin-20261025-gallery-unified-1';

// Contrato existente: portada + doce adicionales. No se amplía almacenamiento.
export const PRODUCT_PHOTO_LIMIT=13;
export function attachProductGallery({container,product={},mainInput,imagesInput,variantsInput,openLibrary}) {
  const media=window.TintinProductMedia;
  const abort=new AbortController();let destroyed=false,replacement=null,replacementTarget='',lastGalleryState='',lastPhotoState='',selectionState='',selectionLayoutState='';
  const selectedPhotos=new Set();
  container.replaceChildren();container.classList.add('tt-unified-photos');
  const heading=document.createElement('h3');heading.textContent='FOTOGRAFÍAS DEL PRODUCTO';
  const hint=document.createElement('p');hint.textContent='Elegí una portada para todo el producto. Las asociaciones conservan la imagen propia de cada color o combinación.';
  const uploadHost=document.createElement('div'),grid=document.createElement('div'),context=document.createElement('div');grid.className='tt-unified-photo-grid';
  const status=document.createElement('p');status.setAttribute('role','status');
  const associationHost=document.createElement('div');associationHost.hidden=true;
  const selectionBar=document.createElement('div');selectionBar.className='tt-photo-selection-bar';
  const selectionLabel=document.createElement('strong');selectionLabel.setAttribute('aria-live','polite');selectionBar.append(selectionLabel);
  context.className='tt-photo-context';
  container.append(heading,hint,selectionBar,context,status,grid,uploadHost,associationHost);
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
  const metadata=new Set(['imageUrl','imageUrls','stock','price','sku','active','colorHex','swatch']);
  function syncColorChoice(check,key,value,chosen,rows){
    const row=rows.find(row=>row[key]===value && Object.keys(row).filter(k=>!metadata.has(k)).length===1),keys=new Set(media.rowImages(row).map(media.imageKey));
    const assigned=chosen.filter(url=>keys.has(media.imageKey(url))).length;
    check.checked=assigned===chosen.length;check.indeterminate=assigned>0 && assigned<chosen.length;
  }
  function targets(){return urls().filter(url=>selectedPhotos.has(media.imageKey(url)));}
  function refreshSelection(force=false){
    const photos=urls();for(const key of selectedPhotos)if(!photos.some(url=>media.imageKey(url)===key))selectedPhotos.delete(key);
    const chosen=targets();editSelection.disabled=!chosen.length;const label=chosen.length?`${chosen.length} fotografía${chosen.length===1?'':'s'} seleccionada${chosen.length===1?'':'s'}`:'Seleccioná una o varias fotografías';if(selectionLabel.textContent!==label)selectionLabel.textContent=label;
    for(const tile of grid.children){const active=selectedPhotos.has(tile.dataset.photoKey);tile.dataset.selected=String(active);const check=tile.querySelector('input[type=checkbox]');if(check)check.checked=active;}
    const mediaRows=associations.serialize();const signature=JSON.stringify([chosen,groups(),mediaRows]);
    const automatic=groups().length===1 && media.isColorKey(groups()[0][0]);
    if(replacement || (!force && signature===selectionState))return;
    const layout=JSON.stringify([chosen,groups()]);selectionState=signature;
    if(!force && automatic && layout===selectionLayoutState){
      for(const check of context.querySelectorAll('input[data-color-key]'))syncColorChoice(check,check.dataset.colorKey,check.dataset.colorValue,chosen,mediaRows);
      return;
    }
    selectionLayoutState=layout;context.replaceChildren();
    if(!chosen.length)return;
    const title=document.createElement('h4');title.textContent=automatic?'Colores de estas fotos':'Asociar a una combinación';context.append(title);
    const explanation=document.createElement('p');explanation.textContent=automatic?'Marcá para asociar; desmarcá para quitar. Se guarda automáticamente en tu borrador.':'Elegí colores y atributos y confirmá la asociación. No cambia la portada.';
    const preview=document.createElement('div');preview.className='tt-photo-selection-preview';for(const [index,url] of chosen.entries()){const image=document.createElement('img');image.src=url;image.alt=`Fotografía seleccionada ${index+1}`;preview.append(image);}context.append(preview,explanation);
    const picked={},colors=new Set();let colorKey='';
    for(const [key,values] of groups()){
      if(media.isColorKey(key) && !colorKey){
        colorKey=key;const field=document.createElement('fieldset');field.className='tt-photo-color-choices';const legend=document.createElement('legend');legend.textContent=key;field.append(legend);
        for(const value of values){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label',`Asociar color ${value}`);
          check.dataset.colorKey=key;check.dataset.colorValue=value;syncColorChoice(check,key,value,chosen,mediaRows);if(check.checked)colors.add(value);
          check.addEventListener('change',event=>{event.stopPropagation();if(check.checked)colors.add(value);else colors.delete(value);if(automatic){const name=check.getAttribute('aria-label');apply(!check.checked,[{[key]:value}]);context.querySelector(`[aria-label="${CSS.escape(name)}"]`)?.focus({preventScroll:true});}});label.append(check,document.createTextNode(value));field.append(label);
        }context.append(field);
      }else{
        const label=document.createElement('label');label.textContent=key;const select=document.createElement('select');select.setAttribute('aria-label',`Asociación: ${key}`);
        for(const value of ['',...values]){const option=document.createElement('option');option.value=value;option.textContent=value||'Cualquiera';select.append(option);}
        select.addEventListener('change',event=>{event.stopPropagation();if(select.value)picked[key]=select.value;else delete picked[key];});label.append(select);context.append(label);
      }
    }
    if(!groups().length){const note=document.createElement('p');note.textContent='Agregá colores u opciones en los controles de abajo para asociar estas fotos.';context.append(note);}
    const apply=(remove,selections=null)=>{
      const combinations=selections || (colors.size?[...colors].map(color=>({...picked,[colorKey]:color})):[{...picked}]);
      if(!combinations.every(selection=>Object.keys(selection).length)){status.textContent='Elegí al menos un color o atributo.';return;}
      const gallery=urls(),cover=mainInput.value;
      for(const selection of combinations){const row=associations.serialize().find(row=>{const keys=Object.keys(row).filter(k=>!metadata.has(k));return keys.length===Object.keys(selection).length && keys.every(k=>row[k]===selection[k]);});
        const existing=media.rowImages(row),keys=new Set(chosen.map(media.imageKey));associations.setPhotos(selection,remove?existing.filter(photo=>!keys.has(media.imageKey(photo))):media.uniqueImages([...existing,...chosen]));
      }
      const focused=context.contains(document.activeElement);status.textContent=remove?'Asociación quitada.':'Asociación aplicada.';
      const extras=gallery.filter(url=>media.imageKey(url)!==media.imageKey(cover)).join('\n');
      if(imagesInput.value!==extras)publish(gallery,cover);else render();
      if(focused && !automatic)[...context.querySelectorAll('button')].find(button=>button.textContent===(remove?'Quitar asociación':'Asociar fotografías'))?.focus({preventScroll:true});
      container.dispatchEvent(new Event('change',{bubbles:true}));
    };
    if(!automatic){button('Asociar fotografías',()=>apply(false),context);button('Quitar asociación',()=>apply(true),context);}
    button('Cerrar asociaciones',()=>{selectedPhotos.clear();refreshSelection(true);},context);
    button('Editar opciones, precios y stock',()=>{const controls=card?.querySelector('.tt-photo-product-controls');if(!controls)return;controls.open=true;for(const group of controls.querySelectorAll('[data-product-section]')){group.querySelector('.tt-editor-section-toggle')?.setAttribute('aria-expanded','true');const fields=group.querySelector(':scope > .tt-editor-section-fields');if(fields)fields.hidden=false;}const target=controls.querySelector('input:not([type=hidden]):not([readonly]),select,button');target?.focus({preventScroll:true});controls.scrollIntoView({block:'nearest'});},context);
  }
  function associate(url){if(replacement?.hasPending()){status.textContent='Terminá o cancelá el reemplazo pendiente antes de cambiar asociaciones.';context.scrollIntoView({block:'nearest'});return;}replacement?.destroy();replacement=null;if(!selectedPhotos.has(media.imageKey(url))){selectedPhotos.clear();selectedPhotos.add(media.imageKey(url));}refreshSelection(true);context.querySelector('input,select')?.focus({preventScroll:true});context.scrollIntoView({block:'nearest'});}
  button('Todas',()=>{urls().forEach(url=>selectedPhotos.add(media.imageKey(url)));refreshSelection(true);},selectionBar,'Seleccionar todas');
  button('Limpiar',()=>{selectedPhotos.clear();refreshSelection(true);},selectionBar,'Limpiar selección');
  const editSelection=button('Editar selección',()=>{context.querySelector('input,select')?.focus({preventScroll:true});context.scrollIntoView({block:'nearest'});},selectionBar);
  button('Agregar fotos',()=>{uploadHost.scrollIntoView({block:'nearest'});uploadHost.querySelector('input[type=file]')?.click();},selectionBar);
  function replace(url){
    if(replacement?.hasPending()){status.textContent='Terminá o cancelá el reemplazo pendiente antes de reemplazar otra foto.';context.scrollIntoView({block:'nearest'});return;}
    replacement?.destroy();replacementTarget=media.imageKey(url);context.replaceChildren();
    const host=document.createElement('div');context.append(host);
    replacement=attachImageUploadWidget(host,{label:'Reemplazar fotografía',cleanupPrevious:false,onOpenLibrary:openLibrary,onChange:value=>{
      const safe=sanitizeImageUrl(value);if(!safe)throw Error('Elegí una imagen válida.');if(destroyed)throw Error('El producto cambió.');
      const current=urls();if(current.some(photo=>media.imageKey(photo)===media.imageKey(safe)) && media.imageKey(url)!==media.imageKey(safe))throw Error('Esa fotografía ya está en la galería.');
      if(selectedPhotos.delete(media.imageKey(url)))selectedPhotos.add(media.imageKey(safe));
      const next=current.map(photo=>media.imageKey(photo)===media.imageKey(url)?safe:photo);associations.replacePhoto(url,safe);publish(next,media.imageKey(mainInput.value)===media.imageKey(url)?safe:mainInput.value);status.textContent='Fotografía reemplazada; asociaciones conservadas.';
    }});
    button('Cancelar reemplazo',()=>{replacement?.destroy();replacement=null;refreshSelection(true);refocus(url);},context);
  }
  function associationText(rows,url){return rows.filter(row=>media.rowImages(row).some(photo=>media.imageKey(photo)===media.imageKey(url))).map(row=>Object.entries(row).filter(([key])=>!metadata.has(key)).map(([key,value])=>`${key}: ${value}`).join(' / ')).join(' · ');}
  function render(){
    if(destroyed)return;const photos=urls(),rows=associations.serialize();
    const state=JSON.stringify([photos,mainInput.value,groups(),rows]);
    if(state===lastGalleryState)return;lastGalleryState=state;
    const photoState=JSON.stringify([photos,mainInput.value,groups()]);
    // Cambiar asociaciones no vuelve a crear imágenes, controles ni sus cargas.
    if(photoState===lastPhotoState){for(const tile of grid.children){const assigned=tile.querySelector('small');if(assigned)assigned.textContent=associationText(rows,photos.find(url=>media.imageKey(url)===tile.dataset.photoKey));}refreshSelection();return;}
    lastPhotoState=photoState;
    const focus=grid.contains(document.activeElement)?document.activeElement?.getAttribute('aria-label'):null;
    grid.replaceChildren();
    photos.forEach((url,index)=>{
      const tile=document.createElement('article');tile.className='tt-unified-photo';tile.dataset.photoKey=media.imageKey(url);
      const pick=document.createElement('label');pick.className='tt-photo-pick';const check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label',`Seleccionar foto ${index+1}`);check.checked=selectedPhotos.has(media.imageKey(url));
      const toggle=()=>{if(check.checked)selectedPhotos.add(media.imageKey(url));else selectedPhotos.delete(media.imageKey(url));refreshSelection(true);};check.addEventListener('change',event=>{event.stopPropagation();toggle();});pick.append(check,document.createTextNode(`Seleccionar foto ${index+1}`));tile.append(pick);
      const image=document.createElement('img');image.addEventListener('click',()=>{check.checked=!check.checked;toggle();});image.src=url;image.alt=`Fotografía ${index+1}`;image.loading='lazy';tile.append(image);
      const cover=media.imageKey(mainInput.value)===media.imageKey(url),badge=document.createElement('strong');badge.textContent=cover?'PORTADA':`Foto ${index+1}`;tile.append(badge);
      const assigned=document.createElement('small');assigned.textContent=associationText(rows,url);tile.append(assigned);
      const actions=document.createElement('div');actions.className='tt-unified-photo-actions';tile.append(actions);
      button('Ver imagen',()=>{const dialog=document.createElement('dialog');const img=document.createElement('img');img.src=url;img.alt=`Fotografía ${index+1}`;img.style.cssText='max-width:85vw;max-height:75vh';dialog.append(img);button('Cerrar imagen',()=>dialog.close(),dialog);dialog.addEventListener('close',()=>{dialog.remove();refocus(url);},{once:true});container.append(dialog);dialog.showModal();},actions,`Ver foto ${index+1}`);
      const choose=button(cover?'Portada':'Elegir portada',()=>{publish([url,...photos.filter(photo=>photo!==url)],url);refocus(url);},actions,`Portada: foto ${index+1}`);choose.setAttribute('aria-pressed',String(cover));
      const move=to=>{const next=[...photos];next.splice(index,1);next.splice(to,0,url);publish(next);refocus(url);};
      for(const [label,to] of [['Anterior',index-1],['Siguiente',index+1]]){const control=button(label,()=>move(to),actions,`${label}: foto ${index+1}`);control.disabled=to<0||to>=photos.length;}
      button('Reemplazar',()=>replace(url),actions,`Reemplazar foto ${index+1}`);
      button('Quitar',()=>{if(replacementTarget===media.imageKey(url)){replacement?.destroy();replacement=null;replacementTarget='';}associations.removePhoto(url);publish(photos.filter(photo=>photo!==url));refreshSelection(true);status.textContent='Quitada del producto. El archivo compartido permanece en la biblioteca.';grid.querySelector('button')?.focus({preventScroll:true});},actions,`Quitar foto ${index+1}`);
      if(groups().length)button('Asociar',()=>associate(url),actions,`Asociar foto ${index+1}`);
      tile.draggable=true;tile.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-tintin-product-photo',url);});tile.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('application/x-tintin-product-photo'))event.preventDefault();});tile.addEventListener('drop',event=>{event.preventDefault();const from=photos.indexOf(event.dataTransfer.getData('application/x-tintin-product-photo'));if(from<0||from===index)return;const next=[...photos];const [photo]=next.splice(from,1);next.splice(index,0,photo);publish(next);refocus(photo);});
      grid.append(tile);
    });
    refreshSelection();
    if(focus)[...grid.querySelectorAll('[aria-label]')].find(node=>node.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
  }
  for(const [input,event] of [[mainInput,'change'],[imagesInput,'input'],[variantsInput,'input']])input.addEventListener(event,render,{signal:abort.signal});
  render();
  return {serialize:associations.serialize,refresh:render,pendingSignature:()=>[upload.pendingSignature(),replacement?.pendingSignature()||[]],async flush(){await upload.flush();await replacement?.flush();await associations.flush();if(urls().length>PRODUCT_PHOTO_LIMIT)throw Error('Este producto histórico supera las 13 fotos generales. Conservá sus asociaciones y revisá la galería antes de guardar.');},destroy(){destroyed=true;abort.abort();upload.destroy();replacement?.destroy();associations.destroy();container.replaceChildren();}};
}
