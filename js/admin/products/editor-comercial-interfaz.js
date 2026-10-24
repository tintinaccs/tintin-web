import {commercialDraft,commercialPatch} from './editor-comercial-core.mjs?v=tintin-20261024-editor-v2-3';
import {productVariantPrice,variantSelectionLabel} from '../../core/store/inventario-variantes.mjs?v=tintin-20261023-variant-engine-v2-2';
const element=(tag,text)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;return node;};
const button=(text,action)=>{const node=element('button',text);node.type='button';node.className='adm-btn adm-btn-outline';node.addEventListener('click',action);return node;};

export function mountCommercialEditor(panel, product, parseOptions, signal, persisted=product) {
  let draft=structuredClone(product),page=0;
  const selected=new Set();
  const options=document.getElementById('prod-variants-text'),total=document.getElementById('prod-stock');
  panel.replaceChildren();panel.classList.add('tt-commercial-editor');
  const error=element('p');error.setAttribute('role','alert');
  const announce=()=>{panel.dispatchEvent(new CustomEvent('tintin:commercial-draft',{bubbles:true,detail:draft}));panel.dispatchEvent(new Event('change',{bubbles:true}));};
  const heading=element('h3','Combinaciones');
  const toolbar=element('div');toolbar.className='tt-commercial-toolbar';
  const field=element('select');field.className='adm-input';field.setAttribute('aria-label','Campo para editar combinaciones seleccionadas');
  for(const [value,text] of [['price','Precio'],['priceBefore','Precio anterior'],['stock','Stock'],['active','Disponibilidad']]){const option=element('option',text);option.value=value;field.append(option);}
  const bulk=element('input');bulk.className='adm-input';bulk.placeholder='Vacío: heredar / sin control';bulk.setAttribute('aria-label','Valor para combinaciones seleccionadas');
  const parse=(key,raw)=>{if(key==='active'){const value=raw.trim().toLowerCase();if(!['sí','si','no'].includes(value))throw Error('Escribí sí o no para la disponibilidad.');return value!=='no';}return raw===''?null:Number(raw);};
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
  const rows=element('div');rows.className='tt-commercial-rows';
  const pagination=element('div');pagination.className='tt-commercial-toolbar';
  const status=element('span');status.setAttribute('role','status');
  const previous=button('Anteriores',()=>{page--;render();});
  const next=button('Siguientes',()=>{page++;render();});
  pagination.append(previous,status,next);
  panel.append(heading,element('p','Precio vacío hereda el general. Stock vacío significa sin control. Desactivar conserva el historial.'),toolbar,error,rows,pagination);
  function render(){
    rows.replaceChildren();
    page=Math.max(0,Math.min(page,Math.ceil(draft.variantInventory.length/25)-1));
    for(const row of draft.variantInventory.slice(page*25,page*25+25)){
      const card=element('fieldset');card.className='tt-commercial-row';
      const title=variantSelectionLabel(draft,{variantKey:row.variant});
      const legend=element('legend',title);card.append(legend);
      const choose=element('input');choose.type='checkbox';choose.checked=selected.has(row.variant);choose.setAttribute('aria-label',`Seleccionar ${title}`);
      choose.addEventListener('change',()=>{if(choose.checked)selected.add(row.variant);else selected.delete(row.variant);});card.append(choose);
      for(const [key,label] of [['stock','Stock'],['price','Precio'],['priceBefore','Precio anterior']]){
        const wrap=element('label',label),input=element('input');input.type='number';input.min=key==='stock'?'0':'1';input.max=key==='stock'?'1000000':'1000000000';input.step='1';input.className='adm-input';input.value=row[key]??'';input.placeholder=key==='stock'?'Sin control':'Heredar';input.setAttribute('aria-label',`${label}: ${title}`);
        input.addEventListener('input',()=>{row[key]=parse(key,input.value);updateTotal();announce();});wrap.append(input);card.append(wrap);
      }
      const availability=element('label','Disponible'),active=element('input');active.type='checkbox';active.checked=row.active!==false;active.setAttribute('aria-label',`Disponible: ${title}`);active.addEventListener('change',()=>{row.active=active.checked;announce();});availability.append(active);card.append(availability);
      const effective=element('small',`Precio efectivo: Gs. ${productVariantPrice(draft,{variantKey:row.variant}).price.toLocaleString('es-PY')}`);card.append(effective);
      card.addEventListener('input',()=>{try{effective.textContent=`Precio efectivo: Gs. ${productVariantPrice(draft,{variantKey:row.variant}).price.toLocaleString('es-PY')}`;}catch{effective.textContent='Revisá el precio de la combinación.';}});
      rows.append(card);
    }
    previous.disabled=page===0;next.disabled=(page+1)*25>=draft.variantInventory.length;
    status.textContent=`${draft.variantInventory.length} combinaciones · página ${page+1}`;
    updateTotal();
  }
  function updateTotal(){try{const patch=commercialPatch(persisted,draft);total.value=patch.stock??'';error.textContent='';}catch(failure){error.textContent=failure.message;}}
  options.addEventListener('input',()=>{
    try {
      const variants=parseOptions(options.value).variants;
      draft=commercialDraft(draft,variants,persisted);error.textContent='';render();announce();
    }catch(failure){options.value=Object.entries(draft.variants).map(([key,values])=>`${key}: ${values.join(', ')}`).join('\n');error.textContent=failure.message;}
  },{signal});
  for(const id of ['prod-price','prod-price-before'])document.getElementById(id).addEventListener('input',()=>{
    draft.price=Number(document.getElementById('prod-price').value);draft.priceBefore=document.getElementById('prod-price-before').value===''?null:Number(document.getElementById('prod-price-before').value);updateTotal();announce();
  },{signal});
  total.readOnly=true;render();announce();
  return {get:()=>structuredClone(draft),patch:base=>commercialPatch(persisted,{...draft,price:base.price,priceBefore:base.priceBefore})};
}
