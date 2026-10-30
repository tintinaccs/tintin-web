import {appendPhotoOrderControls as appendOptionPhotoOrder} from './fotos-por-variante.js?v=tintin-20261028-opciones-inline-2';
import {attachColorPhotos} from './fotos-por-color.js?v=tintin-20261030-home-history-5';
import {sanitizeImageUrl} from '../../components/images/utilidades-imagenes.js?v=tintin-20261030-home-history-5';
import {attachMultiImageUploadWidget,attachImageUploadWidget} from '../../components/images/carga-imagenes.js?v=tintin-20261030-audit-integrity-1';

// Contrato existente: portada + doce adicionales. No se amplía almacenamiento.
export const PRODUCT_PHOTO_LIMIT=13;
export function attachProductGallery({container,product={},mainInput,imagesInput,variantsInput,openLibrary}) {
  const media=window.TintinProductMedia;
  const abort=new AbortController();let destroyed=false,replacement=null,replacementTarget='',lastGalleryState='',lastPhotoState='',renderFrame=0;
  let optionContext=null,optionSelection={},queuedSelection={};
  const librarySelections=new Map();
  container.replaceChildren();container.classList.add('tt-unified-photos');
  const heading=document.createElement('h3');heading.textContent='FOTOGRAFÍAS DEL PRODUCTO';
  const colors=document.createElement('div');colors.className='tt-photo-colors';colors.setAttribute('role','group');colors.setAttribute('aria-label','Fotos por opción');let colorSignature='';
  const hint=document.createElement('p');hint.textContent='La portada presenta el producto. Asociá sus fotos en Variantes.';
  const uploadHost=document.createElement('div'),grid=document.createElement('div'),context=document.createElement('div');grid.className='tt-unified-photo-grid';
  const status=document.createElement('p');status.setAttribute('role','status');
  const associationHost=document.createElement('div');associationHost.hidden=true;
  const optionUpload=document.createElement('details'),uploadTitle=document.createElement('summary');optionUpload.className='tt-option-upload';uploadTitle.textContent='Agregar fotos a esta opción';optionUpload.append(uploadTitle);
  context.className='tt-photo-context';
  const layout=document.createElement('div'),visual=document.createElement('div'),side=document.createElement('div');
  layout.className='tt-studio-photo-layout';visual.className='tt-studio-photo-visual';side.className='tt-studio-photo-side';
  const hero=document.createElement('figure'),heroImage=document.createElement('img'),heroCaption=document.createElement('figcaption'),heroActions=document.createElement('div');
  hero.className='tt-studio-photo';heroActions.className='tt-studio-photo-actions';heroImage.alt='Imagen seleccionada del producto';hero.append(heroImage,heroCaption,heroActions);
  const tools=document.createElement('div'),selectedLabel=document.createElement('small'),selectedName=document.createElement('strong');tools.className='tt-studio-photo-tools';selectedLabel.textContent='OPCIÓN SELECCIONADA';tools.append(selectedLabel,selectedName);
  let heroUrl='';
  button('Reemplazar imagen seleccionada',()=>{if(heroUrl)replace(heroUrl);},heroActions);
  button('Quitar imagen seleccionada',()=>{if(heroUrl)removePhoto(heroUrl);},heroActions);
  const coverControl=button('Portada del producto',()=>{if(heroUrl)publish([heroUrl,...urls().filter(url=>url!==heroUrl)],heroUrl);},tools,'Marcar imagen seleccionada como portada');
  visual.append(hero,colors,grid,uploadHost);side.append(tools,context);layout.append(visual,side);
  container.append(heading,hint,status,layout,associationHost);
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
  function removePhoto(url){
    if(replacementTarget===media.imageKey(url)){replacement?.destroy();replacement=null;replacementTarget='';}
    associations.removePhoto(url);publish(urls().filter(photo=>photo!==url));
    status.textContent='Quitada del producto. El archivo compartido permanece en la biblioteca.';grid.querySelector('button')?.focus({preventScroll:true});
  }
  function add(value,meta={}){
    if(destroyed)throw Error('El producto cambió.');
    const safe=sanitizeImageUrl(value);if(!safe)throw Error('La imagen no tiene una URL válida.');
    const selected=meta.fromLibrary?librarySelections.get(media.imageKey(safe)) || {}:queuedSelection;
    if(Object.entries(selected).some(([key,value])=>!groups().some(([name,values])=>name===key && values.includes(value))))throw Error('La opción de estas fotos cambió. Restaurala antes de reintentar la carga.');
    const current=urls();if(!current.includes(safe) && current.length>=PRODUCT_PHOTO_LIMIT)throw Error('Máximo 13 fotografías por producto.');
    if(Object.keys(selected).length)associations.setPhotos(selected,media.uniqueImages([...photosFor(selected),safe]));
    publish(media.uniqueImages([...current,safe]));librarySelections.delete(media.imageKey(safe));
  }
  const upload=attachMultiImageUploadWidget(uploadHost,{maxImages:PRODUCT_PHOTO_LIMIT,remaining:()=>Math.max(0,PRODUCT_PHOTO_LIMIT-urls().length),onOpenLibrary:async()=>{
    const selection={...optionSelection},url=await openLibrary();if(url)librarySelections.set(media.imageKey(url),selection);return url;
  },onChange:add});
  uploadHost.addEventListener('tintin:image-pending',()=>{if(upload.pendingSignature().length===1)queuedSelection={...optionSelection};if(optionContext)optionUpload.open=true;},{signal:abort.signal});
  function button(text,action,parent,label=text){const node=document.createElement('button');node.type='button';node.className='adm-btn adm-btn-outline';node.textContent=text;node.setAttribute('aria-label',label);node.addEventListener('click',action);parent.append(node);return node;}
  function refocus(url){grid.querySelector(`[data-photo-key="${CSS.escape(media.imageKey(url))}"] button`)?.focus({preventScroll:true});}
  function groups(){const result=new Map();for(const line of variantsInput.value.split(/\r?\n/)){const index=line.indexOf(':');if(index<1)continue;const key=line.slice(0,index).trim();result.set(key,[...new Set([...(result.get(key)||[]),...line.slice(index+1).split(',').map(s=>s.trim()).filter(Boolean)])]);}return [...result];}
  const metadata=new Set(['imageUrl','imageUrls','stock','price','sku','active','colorHex','swatch']);
  container.addEventListener('tintin:option-context-check',event=>{
    if(replacement?.hasPending() || upload.hasPending()){event.detail.accepted=false;status.textContent=replacement?.hasPending()?'Terminá o cancelá el reemplazo pendiente antes de cambiar de opción.':'Terminá o cancelá la carga pendiente antes de cambiar las fotos de otra opción.';}
  },{signal:abort.signal});
  container.addEventListener('tintin:option-context',event=>{
    optionContext=event.detail;optionSelection=optionContext?{...(optionContext.selection || {[optionContext.attribute]:optionContext.value})}:{};
    if(optionContext){uploadHost.before(optionUpload);optionUpload.append(uploadHost);optionUpload.open=upload.hasPending();}
    else if(optionUpload.isConnected){optionUpload.before(uploadHost);optionUpload.remove();}
    lastGalleryState='';lastPhotoState='';render();
  },{signal:abort.signal});
  const optionPhotos=()=>photosFor(optionSelection);
  function photosFor(selection){
    const selected=Object.keys(selection);
    return media.rowImages(associations.serialize().find(row=>{
      const keys=Object.keys(row).filter(key=>!metadata.has(key));
      return keys.length===selected.length && keys.every(key=>row[key]===selection[key]);
    }));
  }
  function renderOptionContext(){
    if(context.querySelector('#prod-variant-stock'))card?.dispatchEvent(new CustomEvent('tintin:close-option-panel'));
    context.replaceChildren();
    const title=document.createElement('h3');title.className='tt-option-photo-title';context.append(title);
    const help=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Ayuda';const note=document.createElement('p');note.textContent='Marcá las fotos que pertenecen a esta opción. La estrella elige su portada; las flechas cambian su orden.';help.append(summary,note);context.append(help);
    for(const [key,values] of groups()){
      if(key===optionContext.attribute)continue;
      const label=document.createElement('label');label.textContent=key;
      const select=document.createElement('select');select.setAttribute('aria-label','Fotos de esta opción: '+key);
      const all=document.createElement('option');all.value='';all.textContent='Todos los valores';select.append(all);
      for(const value of values){const choice=document.createElement('option');choice.value=value;choice.textContent=value;select.append(choice);}
      select.value=optionSelection[key] || '';
      select.addEventListener('change',()=>{if(upload.hasPending()){select.value=optionSelection[key] || '';status.textContent='Terminá o cancelá las fotos pendientes antes de elegir otra combinación.';return;}if(select.value)optionSelection[key]=select.value;else delete optionSelection[key];lastGalleryState='';lastPhotoState='';render();context.querySelector(`[aria-label="${CSS.escape('Fotos de esta opción: '+key)}"]`)?.focus({preventScroll:true});});
      label.append(select);context.append(label);
    }
  }
  function updateOptionTile(tile,url){
    const assigned=optionPhotos(),checked=assigned.some(photo=>media.imageKey(photo)===media.imageKey(url));
    const check=tile.querySelector('input[type=checkbox]');if(check)check.checked=checked;
    const order=JSON.stringify(assigned);
    if(tile.dataset.optionOrder===order)return;tile.dataset.optionOrder=order;
    const focus=tile.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    for(const control of tile.querySelectorAll('.tt-photo-order-actions,.tt-photo-order-badge'))control.remove();
    appendOptionPhotoOrder(tile,{url,photos:assigned,label:Object.values(optionSelection).join(' / '),draggable:false,update:next=>{associations.setPhotos({...optionSelection},next);lastGalleryState='';render();container.dispatchEvent(new Event('change',{bubbles:true}));}});
    if(focus){const target=[...tile.querySelectorAll('[aria-label]')].find(node=>node.getAttribute('aria-label')===focus);(target && !target.disabled?target:check)?.focus({preventScroll:true});}
  }
  function replace(url){
    if(replacement?.hasPending()){status.textContent='Terminá o cancelá el reemplazo pendiente antes de reemplazar otra foto.';context.scrollIntoView({block:'nearest'});return;}
    replacement?.destroy();replacementTarget=media.imageKey(url);context.replaceChildren();
    const host=document.createElement('div');context.append(host);
    replacement=attachImageUploadWidget(host,{label:'Reemplazar fotografía',cleanupPrevious:false,onOpenLibrary:openLibrary,onChange:value=>{
      const safe=sanitizeImageUrl(value);if(!safe)throw Error('Elegí una imagen válida.');if(destroyed)throw Error('El producto cambió.');
      const current=urls();if(current.some(photo=>media.imageKey(photo)===media.imageKey(safe)) && media.imageKey(url)!==media.imageKey(safe))throw Error('Esa fotografía ya está en la galería.');
      const next=current.map(photo=>media.imageKey(photo)===media.imageKey(url)?safe:photo);associations.replacePhoto(url,safe);publish(next,media.imageKey(mainInput.value)===media.imageKey(url)?safe:mainInput.value);status.textContent='Fotografía reemplazada; asociaciones conservadas.';
    }});
    button('Cancelar reemplazo',()=>{replacement?.destroy();replacement=null;context.replaceChildren();refocus(url);},context);
  }
  function viewPhoto(url,photos){
    container.querySelector('.tt-photo-viewer')?.remove();
    const viewer=document.createElement('section');viewer.className='tt-photo-viewer';viewer.setAttribute('aria-label','Vista de fotografías');
    const image=document.createElement('img'),count=document.createElement('p');count.setAttribute('role','status');let index=Math.max(0,photos.indexOf(url));
    const draw=()=>{image.src=photos[index];image.alt=`Foto ${index+1} de ${photos.length}`;count.textContent=`${index+1} / ${photos.length}`;};
    const actions=document.createElement('div');actions.className='tt-photo-viewer-actions';
    button('Foto anterior',()=>{index=(index+photos.length-1)%photos.length;draw();},actions);
    button('Foto siguiente',()=>{index=(index+1)%photos.length;draw();},actions);
    const close=button('Cerrar vista',()=>{viewer.remove();refocus(url);},actions);
    viewer.append(image,count,actions);grid.before(viewer);draw();close.focus({preventScroll:true});viewer.scrollIntoView({block:'nearest'});
    viewer.addEventListener('keydown',event=>{if(event.key==='Escape'){viewer.remove();refocus(url);}if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();index=(index+photos.length+(event.key==='ArrowRight'?1:-1))%photos.length;draw();}});
  }
  function associationText(rows,url){return rows.filter(row=>media.rowImages(row).some(photo=>media.imageKey(photo)===media.imageKey(url))).map(row=>Object.entries(row).filter(([key])=>!metadata.has(key)).map(([key,value])=>`${key}: ${value}`).join(' / ')).join(' · ');}
  function render(){
    if(destroyed)return;const photos=urls(),rows=associations.serialize();
    colors.hidden=container.dataset.optionInline==='photos';
    container.classList.toggle('tt-studio-color-selected',Boolean(optionContext));
    const colorGroups=[]; // Las asociaciones se administran únicamente en Variantes.
    const nextColorSignature=JSON.stringify([colorGroups,optionContext]);
    if(nextColorSignature!==colorSignature){
      colorSignature=nextColorSignature;colors.replaceChildren();
      const choose=(label,selected,pressed)=>{
        const control=button(label,()=>{
          const check={accepted:true};container.dispatchEvent(new CustomEvent('tintin:option-context-check',{detail:check}));if(!check.accepted)return;
          card?.dispatchEvent(new CustomEvent('tintin:close-option-panel'));
          container.dispatchEvent(new CustomEvent('tintin:option-context',{detail:selected}));
          // Editar el color y su disponibilidad en la misma superficie, usando
          // el panel canónico; la galería inline de Variantes conserva su flujo.
          if(selected && container.dataset.optionInline!=='photos')context.querySelector('button[aria-expanded="false"]')?.click();
          [...colors.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')===label)?.focus({preventScroll:true});
        },colors);control.setAttribute('aria-pressed',String(pressed));
        if(selected){
          const photos=photosFor({[selected.attribute]:selected.value}),copy=document.createElement('span');copy.textContent=label;
          const thumbnail=photos.map(sanitizeImageUrl).find(Boolean);
          if(thumbnail){const thumb=document.createElement('img');thumb.src=thumbnail;thumb.alt='';thumb.loading='lazy';control.replaceChildren(thumb,copy);}else control.replaceChildren(copy);
          const count=document.createElement('small');count.textContent=photos.length===1?'1 foto':`${photos.length} fotos`;count.setAttribute('aria-hidden','true');control.append(count);
        }
      };
      if(colorGroups.length){choose('Todo el producto',null,!optionContext);for(const [attribute,values] of colorGroups)for(const value of values)choose(value,{attribute,value},optionContext?.attribute===attribute && optionContext?.value===value);}
    }

    const state=JSON.stringify([photos,mainInput.value,groups(),rows,optionContext,optionSelection]);
    if(state===lastGalleryState)return;lastGalleryState=state;
    heading.hidden=hint.hidden=Boolean(optionContext);
    const title=context.querySelector('.tt-option-photo-title');if(title)title.textContent=`Fotos de ${Object.values(optionSelection).join(' / ')} — ${optionPhotos().length} imágenes`;
    const selectedPhotos=optionContext?optionPhotos():photos;
    heroUrl=selectedPhotos.map(photo=>photos.find(url=>media.imageKey(url)===media.imageKey(photo))).find(Boolean) || photos[0] || '';
    hero.hidden=!heroUrl;coverControl.disabled=!heroUrl;
    if(heroUrl && heroImage.getAttribute('src')!==heroUrl)heroImage.src=heroUrl;
    const selected=optionContext?Object.values(optionSelection).join(' / '):'Todo el producto';
    if(selectedName.textContent!==selected)selectedName.textContent=selected;
    const associated=optionContext && selectedPhotos.some(photo=>media.imageKey(photo)===media.imageKey(heroUrl));
    const caption=heroUrl?(optionContext?(associated?'Imagen asociada a '+selected:'Imagen general · sin asociación a '+selected):'Imagen del producto'):'';
    if(heroCaption.textContent!==caption)heroCaption.textContent=caption;
    coverControl.setAttribute('aria-pressed',String(Boolean(heroUrl) && media.imageKey(heroUrl)===media.imageKey(mainInput.value)));
    const photoState=JSON.stringify([photos,mainInput.value,groups(),optionContext,optionSelection]);
    // Cambiar asociaciones no vuelve a crear imágenes, controles ni sus cargas.
    if(!optionContext && photoState===lastPhotoState){for(const tile of grid.children){const assigned=tile.querySelector('small');if(assigned)assigned.textContent=associationText(rows,photos.find(url=>media.imageKey(url)===tile.dataset.photoKey));}return;}
    if(optionContext && photoState===lastPhotoState){
      for(const tile of grid.children){const url=photos.find(photo=>media.imageKey(photo)===tile.dataset.photoKey);updateOptionTile(tile,url);}
      return;
    }
    lastPhotoState=photoState;
    if(optionContext){renderOptionContext();context.querySelector('.tt-option-photo-title').textContent=`Fotos de ${Object.values(optionSelection).join(' / ')} — ${optionPhotos().length} imágenes`;}else if(!replacement?.hasPending())context.replaceChildren();
    const focus=grid.contains(document.activeElement)?document.activeElement?.getAttribute('aria-label'):null;
    grid.replaceChildren();
    const assigned=optionContext?optionPhotos().map(photo=>photos.find(url=>media.imageKey(url)===media.imageKey(photo))).filter(Boolean):[];
    const displayed=optionContext?media.uniqueImages([...assigned,...photos]):photos;
    displayed.forEach(url=>{
      const index=photos.indexOf(url);
      const tile=document.createElement('article');tile.className='tt-unified-photo';tile.dataset.photoKey=media.imageKey(url);
      if(optionContext){
        const label=document.createElement('label');label.className='tt-option-photo-pick';
        const check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label',`Usar foto ${index+1} en ${Object.values(optionSelection).join(' / ')}`);
        check.checked=optionPhotos().some(photo=>media.imageKey(photo)===media.imageKey(url));
        const image=document.createElement('img');image.src=url;image.alt=`Foto ${index+1}`;image.loading='lazy';
        const caption=document.createElement('span');caption.textContent=`Foto ${index+1}`;label.append(check,image,caption);tile.append(label);
        check.addEventListener('change',()=>{
          const existing=optionPhotos(),gallery=urls(),cover=mainInput.value;
          const next=check.checked?media.uniqueImages([...existing,url]):existing.filter(photo=>media.imageKey(photo)!==media.imageKey(url));
          associations.setPhotos({...optionSelection},next);
          // Conserva en galería los archivos que sólo estaban referenciados por esta asociación.
          imagesInput.value=gallery.filter(photo=>media.imageKey(photo)!==media.imageKey(cover)).join('\n');
          imagesInput.dispatchEvent(new Event('input',{bubbles:true}));
          lastGalleryState='';render();
          [...grid.querySelectorAll('[aria-label]')].find(node=>node.getAttribute('aria-label')===check.getAttribute('aria-label'))?.focus({preventScroll:true});
          container.dispatchEvent(new Event('change',{bubbles:true}));
        });
        button('Ver foto',()=>viewPhoto(url,optionPhotos().length?optionPhotos():photos),tile,`Ver foto ${index+1}`);
        updateOptionTile(tile,url);
        grid.append(tile);return;
      }
      const image=document.createElement('img');image.src=url;image.alt=`Fotografía ${index+1}`;image.loading='lazy';tile.append(image);
      const cover=media.imageKey(mainInput.value)===media.imageKey(url),badge=document.createElement('strong');badge.textContent=cover?'PORTADA':`Foto ${index+1}`;tile.append(badge);
      const assigned=document.createElement('small');assigned.textContent=associationText(rows,url);tile.append(assigned);
      const actions=document.createElement('div');actions.className='tt-unified-photo-actions';tile.append(actions);
      button('Ver imagen',()=>viewPhoto(url,photos),actions,`Ver foto ${index+1}`);
      const choose=button(cover?'Portada':'Elegir portada',()=>{publish([url,...photos.filter(photo=>photo!==url)],url);refocus(url);},actions,`Portada: foto ${index+1}`);choose.setAttribute('aria-pressed',String(cover));
      const move=to=>{const next=[...photos];next.splice(index,1);next.splice(to,0,url);publish(next);refocus(url);};
      for(const [label,to] of [['Anterior',index-1],['Siguiente',index+1]]){const control=button(label,()=>move(to),actions,`${label}: foto ${index+1}`);control.disabled=to<0||to>=photos.length;}
      button('Reemplazar',()=>replace(url),actions,`Reemplazar foto ${index+1}`);
      button('Quitar',()=>removePhoto(url),actions,`Quitar foto ${index+1}`);
      tile.draggable=true;tile.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-tintin-product-photo',url);});tile.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('application/x-tintin-product-photo'))event.preventDefault();});tile.addEventListener('drop',event=>{event.preventDefault();const from=photos.indexOf(event.dataTransfer.getData('application/x-tintin-product-photo'));if(from<0||from===index)return;const next=[...photos];const [photo]=next.splice(from,1);next.splice(index,0,photo);publish(next);refocus(photo);});
      grid.append(tile);
    });
    if(focus)[...grid.querySelectorAll('[aria-label]')].find(node=>node.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
  }
  function scheduleRender(){
    if(renderFrame)return;
    const schedule=window.requestAnimationFrame || (callback=>window.setTimeout(callback,16));
    renderFrame=schedule(()=>{renderFrame=0;render();});
  }
  for(const [input,event] of [[mainInput,'change'],[imagesInput,'input'],[variantsInput,'input']])input.addEventListener(event,scheduleRender,{signal:abort.signal});
  render();
  return {serialize:associations.serialize,refresh:render,pendingSignature:()=>[upload.pendingSignature(),replacement?.pendingSignature()||[]],async flush(){await upload.flush();await replacement?.flush();await associations.flush();if(urls().length>PRODUCT_PHOTO_LIMIT)throw Error('Este producto histórico supera las 13 fotos generales. Conservá sus asociaciones y revisá la galería antes de guardar.');},destroy(){destroyed=true;if(renderFrame){const cancel=window.cancelAnimationFrame || window.clearTimeout;cancel(renderFrame);renderFrame=0;}abort.abort();upload.destroy();replacement?.destroy();associations.destroy();container.replaceChildren();}};
}
