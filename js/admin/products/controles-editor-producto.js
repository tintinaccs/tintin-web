// Controles visuales sobre los campos nativos: una sola autoridad de datos/guardado.
const mounted = new WeakSet();
const quantityControls = new WeakMap();
const choices = new WeakMap();
const commercialDrafts = new WeakMap();
const node = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
};
const emit = input => {
  input.dispatchEvent(new Event('input', {bubbles:true}));
  input.dispatchEvent(new Event('change', {bubbles:true}));
};
function button(text, label, action) {
  const el = node('button', 'tt-editor-choice', text); el.type = 'button';
  if (label) el.setAttribute('aria-label', label);
  el.addEventListener('click', action); return el;
}

function quantity(input, label, main = false) {
  let state = quantityControls.get(input);
  if (!state) {
    const wrap = node('div', 'tt-editor-quantity');
    const stepper = node('div', 'tt-editor-stepper');
    input.before(wrap); wrap.append(stepper);
    const set = value => {
      if (input.readOnly || input.disabled) return;
      input.value = value; emit(input);
    };
    const minus = button('−', `Restar una unidad: ${label}`, () => set(String(Math.max(0, Number(input.value || 0) - 1))));
    const plus = button('+', `Sumar una unidad: ${label}`, () => set(String(Math.min(Number(input.max || 1000000), Number(input.value || 0) + 1))));
    stepper.append(minus, input, plus);
    input.inputMode = 'numeric'; input.step = '1';
    const select = node('select', 'adm-input tt-editor-quantity-select');
    select.setAttribute('aria-label', `Elegir cantidad: ${label}`);
    const placeholder = node('option', '', 'Elegir cantidad · 0 a 500'); placeholder.value = ''; select.append(placeholder);
    let expanded=main;
    const fill=()=>{const value=select.value;select.replaceChildren(placeholder);for(let i=0;i<=500;i++){const option=node('option','',String(i));option.value=String(i);select.append(option);}select.value=value;};
    if(main)fill();
    else {
      for(const count of [0,1,5,10,25,50,100,250,500]){const option=node('option','',String(count));option.value=String(count);select.append(option);}
      const expand=()=>{if(!expanded){expanded=true;fill();}};
      select.addEventListener('focus',expand);select.addEventListener('pointerdown',expand);
    }
    // El input nativo de select ocurre antes de change: no refrescarlo aún con el valor anterior.
    select.addEventListener('input', event => event.stopPropagation());
    select.addEventListener('change', () => { if (select.value !== '') set(select.value); });
    wrap.append(select);
    const quick = [];
    if (main) {
      const presets = node('div', 'tt-editor-choices');
      for (const count of [0,1,5,10,25,50]) {
        const choice = button(String(count), `Stock: ${count} unidades`, () => set(String(count)));
        presets.append(choice); quick.push(choice);
      }
      const unlimited=button('Sin control', 'No controlar stock', () => set(''));presets.append(unlimited);quick.push(unlimited);
      wrap.append(presets);
      const status = node('p', 'tt-editor-stock-status'); status.setAttribute('role','status'); wrap.append(status);
      const hint = node('small', 'tt-editor-caption', '0 significa agotado; vacío significa sin control. El estado de publicación se cambia por separado.'); wrap.append(hint);
      state = {minus,plus,select,quick,status};
    } else state = {minus,plus,select,quick};
    quantityControls.set(input, state);
  }
  const locked = input.readOnly || input.disabled;
  state.minus.disabled = locked || Number(input.value) <= 0;
  state.plus.disabled = locked || Number(input.value) >= Number(input.max || 1000000);
  state.select.disabled = locked;
  // Un stock legado mayor a 500 o sin control nunca se trunca al abrir.
  if(input.value!=='' && Number(input.value)<=500 && ![...state.select.options].some(option=>option.value===input.value)){const option=node('option','',input.value);option.value=input.value;state.select.append(option);}
  state.select.value = input.value !== '' && Number(input.value) <= 500 ? input.value : '';
  for (const choice of state.quick) {
    choice.disabled = locked;
    choice.setAttribute('aria-pressed', String(choice.textContent === (input.value===''?'Sin control':input.value)));
  }
  if (state.status) {
    const text = locked ? input.value === '' ? 'Completá la cantidad de cada opción' : `Stock total · ${Number(input.value).toLocaleString('es-PY')} unidades` : input.value === '' ? 'Sin control de stock' : Number(input.value) > 0 ? `${Number(input.value).toLocaleString('es-PY')} unidades disponibles` : 'Sin stock';
    if (state.status.textContent !== text) state.status.textContent = text;
    state.status.dataset.available = String(Number(input.value) > 0);
  }
}

function selection(input, values, label) {
  let state = choices.get(input);
  const signature = JSON.stringify(values);
  if (!state) {
    const row = node('div', 'tt-editor-choices'); row.setAttribute('role','group'); row.setAttribute('aria-label',label);
    input.before(row); state = {row,signature:''}; choices.set(input,state);
  }
  if (state.signature !== signature) {
    state.signature = signature; state.row.replaceChildren();
    for (const [value, text] of values) {
      const choice = button(text, null, () => {input.value = value; emit(input);});
      choice.dataset.value = value; state.row.append(choice);
    }
  }
  for (const choice of state.row.children) {
    choice.disabled = input.disabled || input.readOnly;
    choice.setAttribute('aria-pressed', String(input.value === choice.dataset.value));
  }
}

function money(input) {
  if (mounted.has(input)) return;
  mounted.add(input); input.inputMode = 'numeric'; input.step = '1';
  const wrap = node('div', 'tt-editor-money'); input.before(wrap);
  wrap.append(node('span', '', 'Gs.'), input);
  const row = node('div', 'tt-editor-choices');
  for (const delta of [-1000,1000,5000,10000]) row.append(button(`${delta > 0 ? '+' : '−'} ${Math.abs(delta).toLocaleString('es-PY')}`, `Ajustar ${input.labels?.[0]?.textContent || 'importe'} en ${delta} guaraníes`, () => {
    input.value = String(Math.min(1000000000, Math.max(0, Number(input.value || 0) + delta))); emit(input);
  }));
  if (input.id === 'prod-price-before') row.append(button('Sin descuento', null, () => {input.value=''; emit(input);}));
  wrap.after(row);
}

function variantBuilder(input) {
  if (mounted.has(input)) return;
  mounted.add(input);
  const card=input.closest('#prod-form-card');
  const panel = node('div', 'tt-editor-variant-builder');
  const form = node('div', 'tt-editor-variant-add');
  const attribute = node('select', 'adm-input'); attribute.setAttribute('aria-label', 'Característica de variante');
  for (const title of ['Color','Talle','Material','Forma','Diseño','Modelo']) attribute.append(node('option','',title));
  const other=node('option','','Otro grupo');other.value='__custom';attribute.append(other);
  const custom=node('input','adm-input');custom.placeholder='Nombre del grupo';custom.maxLength=60;custom.setAttribute('aria-label','Nombre del nuevo grupo');custom.hidden=true;
  attribute.addEventListener('change',()=>{custom.hidden=attribute.value!=='__custom';});
  const value = node('input', 'adm-input'); value.placeholder='Ej.: Verde Oliva'; value.maxLength=120; value.setAttribute('aria-label','Nueva opción de variante');
  const error = node('p','tt-editor-control-error'); error.setAttribute('role','alert');
  const chips = node('div','tt-editor-variant-groups');
  const groups=()=>{const map=new Map();for(const line of input.value.split(/\r?\n/)){const i=line.indexOf(':');if(i<1)continue;const key=line.slice(0,i).trim();map.set(key,[...new Set([...(map.get(key)||[]),...line.slice(i+1).split(',').map(s=>s.trim()).filter(Boolean)])]);}return map;};
  const valid=text=>text && !/[,:\n\r\/<>]/.test(text) && text.length<=120;
  const mediaRows=()=>{const detail={rows:[]};card?.dispatchEvent(new CustomEvent('tintin:option-media-read',{detail}));return detail.rows;};
  const baseline=()=>{const detail={product:null};card?.dispatchEvent(new CustomEvent('tintin:product-options-read',{detail}));return detail.product;};
  const hasDraftData=(key,option)=>{const detail={product:null};card?.dispatchEvent(new CustomEvent('tintin:commercial-options-read',{detail}));return detail.product?.variantInventory?.some(row=>row.attributes?.[key]===option && (Number(row.stock)>0 || row.price!=null || row.priceBefore!=null));};
  const write=map=>{
    const focused=panel.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    error.textContent='';input.value=[...map].filter(([,values])=>values.length).map(([key,values])=>key+': '+values.join(', ')).join('\n');emit(input);refresh();
    if(focused){const target=[...panel.querySelectorAll('[aria-label]')].find(node=>node.getAttribute('aria-label')===focused);const next=target?.disabled?[...target.closest('.tt-option-row').querySelectorAll('button:not(:disabled)')].find(node=>node.getClientRects().length):target;(next || value).focus({preventScroll:true});}
  };
  const add = (focus = true) => {
    if (input.readOnly) return;
    const text=value.value.trim();
    if(!valid(text)){error.textContent='Escribí una opción de hasta 120 caracteres, sin comas, barras ni dos puntos.';return;}
    const groupName=attribute.value==='__custom'?custom.value.trim():attribute.value;
    if(!valid(groupName) || groupName.length>60){error.textContent='Escribí un nombre de grupo de hasta 60 caracteres.';return;}
    const map=groups(),key=[...map.keys()].find(key=>key.toLocaleLowerCase('es')===groupName.toLocaleLowerCase('es')) || groupName;
    if((map.get(key)||[]).some(option=>option.toLocaleLowerCase('es')===text.toLocaleLowerCase('es'))){error.textContent='Esta opción ya está en '+key+'. Editá su nombre o elegí otro.';return;}
    map.set(key,[...(map.get(key)||[]),text]);write(map);
    value.value='';error.textContent='';if(focus)value.focus({preventScroll:true});
  };
  const addButton=button('Agregar opción',null,()=>add());
  value.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();add();}});
  const assistance=node('details','tt-editor-option-assistance'),assistanceTitle=node('summary','','Sugerencias de colores (opcionales)');
  const palette=node('div','tt-editor-choices tt-editor-color-presets');palette.setAttribute('role','group');palette.setAttribute('aria-label','Colores rápidos');
  for(const title of ['Dorado','Plateado','Oro rosa','Negro','Blanco']){
    const choice=button(title,'Agregar color '+title,()=>{attribute.value='Color';value.value=title;add(false);});
    const dot=node('span','adm-color-circle');dot.style.background=window.TintinProductColors?.preset(title)?.hex || 'transparent';dot.setAttribute('aria-hidden','true');choice.dataset.color=title;choice.prepend(dot);palette.append(choice);
  }
  const suggestion=node('div'),suggestStatus=node('p');suggestStatus.setAttribute('role','status');
  const suggest=button('Sugerir desde la portada',null,async()=>{
    const photo=card.querySelector('#prod-imageUrl')?.value,id=card.querySelector('#prod-id')?.value,manual=input.value;
    if(!photo){suggestStatus.textContent='Elegí primero una portada en Fotografías del producto.';return;}
    suggest.disabled=true;suggestStatus.textContent='Analizando una aproximación del color…';
    try {
      const result=await window.TintinProductColors?.suggestImageColor(photo);
      if(photo!==card.querySelector('#prod-imageUrl')?.value || id!==card.querySelector('#prod-id')?.value || manual!==input.value)return;
      suggestion.replaceChildren();suggestStatus.textContent=result?'Sugerencia aproximada: '+result.name+'. Podés corregir el nombre antes de agregarlo.':'No hay una sugerencia confiable. Escribí el nombre comercial manualmente.';
      if(result){suggestion.append(button('Usar sugerencia '+result.name,null,()=>{attribute.value='Color';value.value=result.name;suggestion.replaceChildren();value.focus({preventScroll:true});}),button('Descartar sugerencia',null,()=>{suggestion.replaceChildren();suggestStatus.textContent='Sugerencia descartada.';}));}
    } catch {suggestStatus.textContent='No se pudo analizar la foto. Podés escribir el color manualmente.';}
    finally {suggest.disabled=false;}
  });
  assistance.append(assistanceTitle,palette,suggest,suggestStatus,suggestion);
  form.append(attribute,custom,value,addButton);panel.append(form,error,chips,assistance);input.before(panel);
  const advanced=node('details','tt-editor-advanced');const summary=node('summary','','Formato avanzado');
  input.before(advanced);advanced.append(summary);input.hidden=true;
  advanced.addEventListener('toggle',()=>{input.hidden=!advanced.open;});
  const retired=(key,option)=>{const rows=commercialDrafts.get(card)?.variantInventory?.filter(row=>row.attributes?.[key]===option) || [];return rows.length>0 && rows.every(row=>row.active===false);};
  let signature='';
  function refresh(){
    attribute.disabled=value.disabled=addButton.disabled=input.readOnly;
    for(const key of groups().keys())if(![...attribute.options].some(option=>option.value===key))attribute.append(node('option','',key));
    const source=baseline();
    const current=JSON.stringify([input.value,input.readOnly,card?.querySelector('#prod-id')?.value,source?.variants,source?.variantCommerceVersion,commercialDrafts.get(card)?.variantInventory?.map(row=>[row.variant,row.active])]);if(current===signature)return;signature=current;
    chips.replaceChildren();
    for(const [key,values] of groups()){
      const group=node('fieldset','tt-option-group'),legend=node('legend','',key);group.append(legend);
      const original=baseline(),persisted=Boolean(card?.querySelector('#prod-id')?.value);
      const protectedValues=persisted && Array.isArray(original?.variants?.[key])?original.variants[key]:[];
      if(protectedValues.length)group.append(node('p','tt-editor-caption','Las opciones guardadas conservan sus referencias. Podés cambiar cantidades o dejar combinaciones sin disponibilidad; no eliminar su identidad histórica.'));
      for(const [index,option] of values.entries()){
        const protectedOption=protectedValues.includes(option);
        const row=node('div','tt-option-row'),title=node('strong','',option);row.append(title);
        const rename=node('details','tt-option-rename'),renameTitle=node('summary','','Editar nombre');
        const name=node('input','adm-input');name.value=option;name.maxLength=120;name.setAttribute('aria-label','Nombre comercial de '+key+': '+option);
        const apply=button('Aplicar nombre','Aplicar nombre de '+key+': '+option,()=>{
          if(protectedOption){error.textContent='Esta opción tiene inventario o referencias históricas. Conservá el nombre y editá su disponibilidad.';return;}
          if(hasDraftData(key,option)){error.textContent='Esta opción tiene cantidades o precios configurados. Revisalos antes de cambiar el nombre; podés editar su disponibilidad sin perder esos datos.';return;}
          const text=name.value.trim();if(!valid(text)){error.textContent='Revisá el nombre de la opción.';return;}
          if(values.some(other=>other!==option && other.toLocaleLowerCase('es')===text.toLocaleLowerCase('es'))){error.textContent='Ya existe una opción con ese nombre en '+key+'.';return;}
          if(mediaRows().some(media=>media[key]===option && window.TintinProductMedia?.rowImages(media).length)){error.textContent='Esta opción tiene fotografías asociadas. Conservá su nombre o revisá primero las asociaciones en la galería.';return;}
          const appearance=mediaRows().find(media=>media[key]===option);
          const map=groups();map.set(key,values.map(other=>other===option?text:other));write(map);
          if(appearance?.colorHex && window.TintinProductMedia?.isColorKey(key))card.dispatchEvent(new CustomEvent('tintin:color-appearance',{detail:{color:text,colorHex:appearance.colorHex}}));
        });apply.disabled=input.readOnly || protectedOption;name.disabled=input.readOnly || protectedOption;rename.append(renameTitle,name,apply);row.append(rename);
        const isRetired=retired(key,option);
        const remove=button(isRetired?'Restaurar':'Quitar',(isRetired?'Restaurar ':'Quitar ')+key+': '+option,()=>{if(input.readOnly)return;
          const handled=!input.dispatchEvent(new CustomEvent('tintin:variant-option-availability',{cancelable:true,detail:{attribute:key,value:option,active:isRetired}}));
          if(handled){refresh();[...chips.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')===(isRetired?'Quitar ':'Restaurar ')+key+': '+option)?.focus({preventScroll:true});return;}
          if(protectedOption || isRetired){error.textContent='Conservá esta identidad histórica y revisá su disponibilidad en la matriz.';return;}
          if(hasDraftData(key,option)){error.textContent='Esta opción tiene cantidades o precios configurados. Revisalos antes de quitarla o dejala sin disponibilidad.';return;}const map=groups();map.set(key,values.filter(other=>other!==option));write(map);});
        remove.disabled=input.readOnly;if(remove.disabled)remove.title='Esta opción tiene inventario o referencias históricas. Conservá su identidad y revisá su disponibilidad.';
        row.append(remove);
        for(const [label,to] of [['Anterior',index-1],['Siguiente',index+1]]){
          const move=button(label,label+' opción '+key+': '+option,()=>{const next=[...values];next.splice(index,1);next.splice(to,0,option);const map=groups();map.set(key,next);write(map);});
          const positional=protectedOption && original?.variantCommerceVersion!==2 && !original?.variantMedia?.length && window.TintinProductMedia?.isColorKey(key);
          move.disabled=input.readOnly || positional || to<0 || to>=values.length;if(positional)move.title='Revisá las asociaciones de fotos históricas antes de cambiar este orden.';row.append(move);
        }
        if(window.TintinProductMedia?.isColorKey(key)){
          const detail={rows:[]};card?.dispatchEvent(new CustomEvent('tintin:option-media-read',{detail}));
          const media=detail.rows.find(media=>media[key]===option && Object.keys(media).filter(k=>!['imageUrl','imageUrls','stock','price','sku','active','colorHex','swatch'].includes(k)).length===1) || {};
          const label=node('label','','Círculo visual (no cambia el nombre)');
          const color=node('input');color.type='color';color.value=media.colorHex || window.TintinProductColors?.preset(media.swatch || option)?.hex || '#CFD4DA';color.setAttribute('aria-label','Círculo de '+option);
          color.addEventListener('input',()=>{card.dispatchEvent(new CustomEvent('tintin:color-appearance',{detail:{color:option,colorHex:color.value}}));card.dispatchEvent(new Event('change',{bubbles:true}));});
          label.append(color);row.append(label);
        }
        row.append(button('Fotos','Fotos de '+key+': '+option,()=>{const select=card.querySelector('#prod-editor-section');select.value='photos';select.dispatchEvent(new Event('change',{bubbles:true}));card.querySelector('.tt-unified-photos button')?.focus({preventScroll:true});}));
        row.append(button('Disponibilidad','Disponibilidad de '+key+': '+option,()=>{
          const select=card.querySelector('#prod-editor-section');select.value='availability';select.dispatchEvent(new Event('change',{bubbles:true}));
          const visible=[...card.querySelectorAll('#prod-variant-stock input, #prod-stock')].filter(node=>node.getClientRects().length && !node.disabled);
          const matching=visible.find(node=>{const row=node.closest('.tt-commercial-row,.tt-editor-stock-row');const title=row?.querySelector('legend')?.textContent || row?.dataset.variant || '';return title.split('/').map(value=>value.trim()).includes(option);});
          (matching || visible[0])?.focus({preventScroll:true});
        }));
        group.append(row);
      }
      chips.append(group);
    }
    for(const choice of palette.children){choice.disabled=input.readOnly;choice.setAttribute('aria-pressed',String([...groups()].some(([key,values])=>/^colou?r$/i.test(key)&&values.some(option=>option.toLocaleLowerCase('es')===choice.dataset.color.toLocaleLowerCase('es')))));}
  }
  input.addEventListener('input',refresh);
  choices.set(panel,{refresh});
}

export function refreshEditorControls(card) {
  const stock=card.querySelector('#prod-stock');
  if(stock){
    quantity(stock,'Stock',true);
    const field=stock.closest('.tt-editor-quantity')?.parentElement;
    if(field && field.hidden!==stock.readOnly)field.hidden=stock.readOnly;
  }
  const inventory=card.querySelector('#prod-variant-stock');
  if(inventory){
    const hidden=!card.querySelector('#prod-variants-text')?.value.trim() && !inventory.classList.contains('tt-commercial-editor') && !inventory.querySelector('input');if(inventory.hidden!==hidden)inventory.hidden=hidden;
    let total=inventory.querySelector('.tt-inventory-total');
    if(stock?.readOnly){if(!total){total=node('p','tt-inventory-total');total.setAttribute('role','status');inventory.prepend(total);}const text=stock.value===''?(inventory.classList.contains('tt-commercial-editor')?'Total: inventario sin control':'Completá las cantidades de cada opción'):'Total: '+stock.value+' unidades';if(total.textContent!==text)total.textContent=text;}
    else total?.remove();
  }
  if(!card.querySelector('.tt-commercial-editor'))for(const input of card.querySelectorAll('#prod-variant-stock input')) quantity(input,input.getAttribute('aria-label') || 'Variante');
  for(const id of ['prod-purchased','prod-stock-minimum']) {
    const input=card.querySelector(`#${id}`);if(input)quantity(input,input.labels?.[0]?.textContent || id);
  }
  for(const id of ['prod-price','prod-price-before','prod-cost-unit']) {const input=card.querySelector(`#${id}`);if(input)money(input);}
  for(const id of ['prod-badge']) {
    const input=card.querySelector(`#${id}`); if(input)selection(input,[...input.options].filter(option=>option.value || id==='prod-badge').slice(0,id==='prod-category'?4:6).map(option=>[option.value,option.textContent]),id==='prod-category'?'Categorías rápidas':'Etiqueta del producto');
  }
  for(const input of card.querySelectorAll('input[list]')) {
    const list=card.querySelector(`#${input.getAttribute('list')}`);
    if(list) {
      let options=[...list.options].map(option=>option.value);
      if(input.id==='prod-material') {
        const category=card.querySelector('#prod-category');
        const text=`${category?.value || ''} ${category?.selectedOptions?.[0]?.textContent || ''}`.toLocaleLowerCase('es');
        const preferred=/cartera|bolso|billetera/.test(text)?['Cuero sintético','Cuero genuino','Tela / textil','Resina']:/reloj/.test(text)?['Acero inoxidable','Aleación metálica','Cuero sintético','Resina']:[];
        options=[...preferred.filter(value=>options.includes(value)),...options.filter(value=>!preferred.includes(value))];
      }
      selection(input,options.slice(0,4).map(value=>[value,value]),`Sugerencias: ${input.labels?.[0]?.textContent || input.id}`);
    }
  }
  const variants=card.querySelector('#prod-variants-text');if(variants)variantBuilder(variants);
  for(const panel of card.querySelectorAll('.tt-editor-variant-builder')) choices.get(panel)?.refresh();
}

export function installEditorControls(card) {
  if(mounted.has(card))return;
  mounted.add(card);
  const pendingPhoto=event=>{if(event.detail?.pending)window.AdminUnsaved?.markDirty('primary-editor');};
  card.addEventListener('tintin:image-pending',pendingPhoto);card.addEventListener('tintin:image-preview',pendingPhoto);
  card.addEventListener('change',event=>{
    const status=card.querySelector('#prod-publicationStatus'),active=card.querySelector('#prod-active');
    if(event.target===status && active)active.checked=status.value==='active';
    if(event.target===active && status)status.value=active.checked?'active':'draft';
  });
  card.addEventListener('tintin:commercial-draft',event=>{
    commercialDrafts.set(card,event.detail);
    refreshEditorControls(card);
  });
  card.addEventListener('input',event=>{
    refreshEditorControls(card);
  });
  card.addEventListener('change',()=>refreshEditorControls(card));
}
