import {quantity} from './controles-editor-producto.js?v=tintin-20261029-performance-1';
import {mountProductMoney,formatGuarani} from './importe-producto.js?v=tintin-20261028-guided-editor-2';
import {commercialDraft,commercialPatch,setCommercialOptionAvailability} from './editor-comercial-core.mjs?v=tintin-20261031-seo-espacios-2';
import {productVariantPrice,variantSelectionLabel} from '../../core/store/inventario-variantes.mjs?v=tintin-20261031-seo-espacios-2';
const element=(tag,text)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;return node;};
const button=(text,action)=>{const node=element('button',text);node.type='button';node.className='adm-btn adm-btn-outline';node.addEventListener('click',action);return node;};

export function mountCommercialEditor(panel, product, parseOptions, signal, persisted=product, onEmpty=null) {
  let draft=structuredClone(product),page=0,query='',context=panel.dataset.optionInline==='availability'?{attribute:panel.dataset.optionAttribute,value:panel.dataset.optionValue}:null,contextVariant='';
  const selected=new Set();
  const contextChoices=new Map();
  const effectivePrices=new Map();
  const options=document.getElementById('prod-variants-text'),total=document.getElementById('prod-stock');
  panel.closest('#prod-form-card')?.addEventListener('tintin:commercial-options-read',event=>{event.detail.product=draft;},{signal});
  panel.replaceChildren();panel.classList.add('tt-commercial-editor');
  const error=element('p');error.setAttribute('role','alert');
  const notice=element('p');notice.setAttribute('role','status');
  const announce=()=>{panel.dispatchEvent(new CustomEvent('tintin:commercial-draft',{bubbles:true,detail:draft}));panel.dispatchEvent(new Event('change',{bubbles:true}));};
  const heading=element('h3','Combinaciones');
  const toolbar=element('div');toolbar.className='tt-commercial-toolbar';
  const field=element('select');field.className='adm-input';field.setAttribute('aria-label','Campo para editar combinaciones seleccionadas');
  for(const [value,text] of [['price','Precio'],['priceBefore','Precio anterior'],['stock','Stock'],['active','Disponibilidad']]){const option=element('option',text);option.value=value;field.append(option);}
  const bulk=element('input');bulk.className='adm-input';bulk.placeholder='Vacío: heredar / sin control';bulk.setAttribute('aria-label','Valor para combinaciones seleccionadas');
  const parse=(key,raw)=>{if(key==='active'){const value=raw.trim().toLowerCase();if(!['sí','si','no'].includes(value))throw Error('Escribí sí o no para la disponibilidad.');return value!=='no';}return raw===''?null:Number(['price','priceBefore'].includes(key)?raw.replaceAll('.',''):raw);};
  field.addEventListener('change',()=>{bulk.value='';bulk.placeholder=field.value==='active'?'Sí / no':field.value==='stock'?'Vacío: sin control':'Gs. · vacío para heredar';});
  bulk.addEventListener('input',()=>{if(['price','priceBefore'].includes(field.value) && /^[\d.\s]*$/.test(bulk.value)){const before=bulk.selectionStart ?? bulk.value.length,digits=bulk.value.slice(0,before).replace(/\D/g,'').length;bulk.value=formatGuarani(bulk.value.replace(/[.\s]/g,''));let caret=0,count=0;while(caret<bulk.value.length && count<digits){if(/\d/.test(bulk.value[caret]))count++;caret++;}bulk.setSelectionRange(caret,caret);}});
  const apply=button('Aplicar a seleccionadas',()=>{
    if(!selected.size){error.textContent='Seleccioná al menos una combinación.';return;}
    try {const next={...draft,variantInventory:draft.variantInventory.map(row=>selected.has(row.variant)?{...row,[field.value]:parse(field.value,bulk.value)}:row)};Object.assign(next,commercialPatch(persisted,next));draft=next;error.textContent='';render();announce();} catch(failure){error.textContent=failure.message;}
  });
  const reorder=button('Invertir orden de atributos',()=>{
    const reversed=Object.entries(draft.variants).reverse();
    options.value=reversed.map(([key,values])=>`${key}: ${values.join(', ')}`).join('\n');
    options.dispatchEvent(new Event('input',{bubbles:true}));
  });
  toolbar.append(field,bulk,apply,reorder);
  const advanced=element('details');advanced.className='tt-commercial-advanced';advanced.append(element('summary','Edición múltiple y orden de atributos'),toolbar);
  const rows=element('div');rows.className='tt-commercial-rows';
  const pagination=element('div');pagination.className='tt-commercial-toolbar';
  const status=element('span');status.setAttribute('role','status');
  const previous=button('Anteriores',()=>{page--;render();});
  const next=button('Siguientes',()=>{page++;render();});
  pagination.append(previous,status,next);
  const search=element('input');search.className='adm-input';search.type='search';search.placeholder='Buscar variante o combinación';search.setAttribute('aria-label','Buscar combinación');let searchTimer;search.addEventListener('input',()=>{query=search.value;page=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(!signal?.aborted)render();},120);});search.addEventListener('blur',()=>{if(searchTimer && !signal?.aborted)render();});signal?.addEventListener('abort',()=>clearTimeout(searchTimer),{once:true});
  const help=element('details');help.className='tt-commercial-help';help.append(element('summary','Ayuda sobre precios y stock'),element('p','El precio vacío hereda el general. Stock 0 indica agotado; vacío mantiene stock sin control. Retirar de la venta conserva existencias e historial.'));panel.append(heading,help,search,advanced,error,notice,rows,pagination);
  function setOptionAvailability(attribute,value,active) {
    try {
      draft=setCommercialOptionAvailability(draft,attribute,value,active,persisted);
      error.textContent='';render();announce();
      notice.textContent=`${attribute}: ${value} ${active?'restaurado para la venta':'retirado de la venta; conserva sus existencias y referencias'}. Guardá para aplicar.`;
    } catch(failure) {error.textContent=failure.message;}
  }
  options.addEventListener('tintin:variant-option-availability',event=>{
    const {attribute,value,active}=event.detail;
    const protectedKeys=new Set((persisted?.variantInventory || []).map(row=>row.variant));
    if(!draft.variantInventory.some(row=>protectedKeys.has(row.variant) && row.attributes?.[attribute]===value) && active===false)return;
    event.preventDefault();setOptionAvailability(attribute,value,active);
  },{signal});
  function effectivePrice(row){try{return `Precio efectivo: Gs. ${productVariantPrice(draft,{variantKey:row.variant}).price.toLocaleString('es-PY')}`;}catch{return 'Revisá el precio de la combinación.';}}
  panel.addEventListener('tintin:option-context',event=>{if(context)contextChoices.set(JSON.stringify(context),contextVariant);context=event.detail;contextVariant=contextChoices.get(JSON.stringify(context)) || '';page=0;render();},{signal});
  const combination=element('select');combination.className='adm-input';combination.setAttribute('aria-label','Combinación disponible');
  combination.addEventListener('change',()=>{contextVariant=combination.value;render();});
  rows.before(combination);
  function render(){
    clearTimeout(searchTimer);searchTimer=null;
    rows.replaceChildren();
    effectivePrices.clear();
    let visible=draft.variantInventory.filter(row=>!query || variantSelectionLabel(draft,{variantKey:row.variant}).toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
    page=Math.max(0,Math.min(page,Math.ceil(visible.length/25)-1));
    const visibleCount=visible.length;search.hidden=Boolean(context);
    if(context){
      const matches=visible.filter(row=>row.attributes?.[context.attribute]===context.value);
      if(!matches.some(row=>row.variant===contextVariant))contextVariant=matches[0]?.variant || '';
      combination.replaceChildren(...matches.map(row=>{const option=element('option',variantSelectionLabel(draft,{variantKey:row.variant}));option.value=row.variant;return option;}));
      combination.value=contextVariant;visible=matches.filter(row=>row.variant===contextVariant);
    }
    combination.hidden=!context;advanced.hidden=pagination.hidden=Boolean(context);
    heading.hidden=Boolean(context);
    for(const row of (context?visible:visible.slice(page*25,page*25+25))){
      const card=element('fieldset');card.className='tt-commercial-row';
      const title=variantSelectionLabel(draft,{variantKey:row.variant});
      const legend=element('legend',title);card.append(legend);
      const choose=element('input');choose.type='checkbox';choose.checked=selected.has(row.variant);choose.setAttribute('aria-label',`Seleccionar ${title}`);
      choose.hidden=Boolean(context);choose.addEventListener('change',()=>{if(choose.checked)selected.add(row.variant);else selected.delete(row.variant);});card.append(choose);
      for(const [key,label] of [['stock','Stock'],['price','Precio'],['priceBefore','Precio anterior']]){
        const wrap=element('label',label),input=element('input');input.type='number';input.min=key==='stock'?'0':'1';input.max=key==='stock'?'1000000':'1000000000';input.step='1';input.className='adm-input';input.value=row[key]??'';input.placeholder=key==='stock'?'Sin control':'Heredar';input.setAttribute('aria-label',`${label}: ${title}`);
        input.addEventListener('input',()=>{row[key]=parse(key,input.value);updateTotal();announce();});wrap.append(input);card.append(wrap);if(key!=='stock')mountProductMoney(input);else{quantity(input,title);input.addEventListener('input',()=>quantity(input,title));}
      }
      const availability=element('label','Habilitada para la venta'),active=element('input');availability.className='tt-commercial-availability';active.type='checkbox';active.checked=row.active!==false;active.setAttribute('aria-label',`Habilitada para la venta: ${title}`);active.addEventListener('change',()=>{row.active=active.checked;announce();});availability.append(active);card.append(availability);
      const inventoryState=element('small');inventoryState.className='tt-variant-stock-state';const refreshState=()=>{inventoryState.textContent=row.active===false?'Retirada de la venta':row.stock===null?'Stock sin control':Number(row.stock)>0?'Disponible':'Sin stock';};refreshState();card.addEventListener('input',refreshState);card.addEventListener('change',refreshState);card.append(inventoryState);
      const effective=element('small',effectivePrice(row));card.append(effective);effectivePrices.set(row.variant,{row,node:effective});
      card.addEventListener('input',()=>{effective.textContent=effectivePrice(row);});
      rows.append(card);
    }
    previous.disabled=page===0;next.disabled=(page+1)*25>=visibleCount;
    status.textContent=`${visibleCount} de ${draft.variantInventory.length} combinaciones · página ${page+1}`;
    updateTotal();
  }
  function updateTotal(){try{const patch=commercialPatch(persisted,draft);total.value=patch.stock??'';error.textContent='';}catch(failure){error.textContent=/Conservá la combinación comercial/.test(failure.message)?'Esta combinación tiene referencias históricas. Conservá su control de stock: usá 0 si está agotada o desactivá su disponibilidad. No se puede eliminar su identidad ni cambiar entre cantidad y sin control.':failure.message;}}
  options.addEventListener('input',()=>{
    try {
      const variants=parseOptions(options.value).variants;
      if(!Object.keys(variants).length && !Object.keys(persisted?.variants || {}).length && draft.variantInventory.every(row=>(row.stock===null || row.stock===0) && row.price==null && row.priceBefore==null) && onEmpty){onEmpty();return;}
      draft=commercialDraft(draft,variants,persisted);error.textContent='';render();announce();
    }catch(failure){options.value=Object.entries(draft.variants).map(([key,values])=>`${key}: ${values.join(', ')}`).join('\n');error.textContent='No se aplicó el cambio. Esta opción puede tener inventario o referencias de pedidos anteriores. Podés dejar su combinación sin disponibilidad, pero no eliminar su identidad. '+failure.message;}
  },{signal});
  for(const id of ['prod-price','prod-price-before'])document.getElementById(id).addEventListener('input',()=>{
    draft.price=Number(document.getElementById('prod-price').value);draft.priceBefore=document.getElementById('prod-price-before').value===''?null:Number(document.getElementById('prod-price-before').value);updateTotal();
    for(const {row,node} of effectivePrices.values())node.textContent=effectivePrice(row);
    announce();
  },{signal});
  total.readOnly=true;render();announce();
  return {get:()=>structuredClone(draft),patch:base=>commercialPatch(persisted,{...draft,price:base.price,priceBefore:base.priceBefore}),setOptionAvailability};
}
