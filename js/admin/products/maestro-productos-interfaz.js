import {productBulkPatch,productFingerprint} from './maestro-productos-core.mjs?v=tintin-20261022-catalog-reconcile-1';
let modalSequence=0;
const labels={price:'Precio fijo',pricePercent:'Ajustar precio por porcentaje',priceBefore:'Precio anterior',stock:'Establecer stock',stockDelta:'Sumar o restar stock',category:'Colección',active:'Activo',oferta:'En oferta',destacado:'Destacado en Inicio',badge:'Etiqueta visible',tags:'Etiquetas de búsqueda'};
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
function option(select,value,label){const node=element('option',label);node.value=value;select.append(node);}
function modal(title){
 const opener=document.activeElement,dialog=element('dialog',null,'tt-product-master-dialog');
 const heading=element('h2',title);heading.id=`tt-product-master-title-${++modalSequence}`;dialog.setAttribute('aria-labelledby',heading.id);
 const head=element('div',null,'tt-product-master-head'),close=element('button','Cerrar','tt-commerce-btn');close.type='button';head.append(heading,close);
 const body=element('div',null,'tt-product-master-body'),footer=element('div',null,'tt-product-master-footer'),error=element('p',null,'tt-product-master-error');error.setAttribute('role','alert');error.tabIndex=-1;
 dialog.append(head,body,error,footer);document.body.append(dialog);
 const finish=(restoreFocus=true)=>{dialog.close();dialog.remove();if(restoreFocus && opener?.isConnected)opener.focus({preventScroll:true});};
 close.addEventListener('click',()=>finish());dialog.addEventListener('cancel',event=>{if(dialog.dataset.busy==='true'){event.preventDefault();return;}event.preventDefault();finish();});
 const busy=value=>{dialog.dataset.busy=String(value);dialog.querySelectorAll('button,input,select').forEach(control=>control.disabled=value);};
 const fail=exception=>{error.textContent=exception?.message || String(exception);error.focus();};
 return {dialog,body,footer,error,finish,busy,fail,opener,show:()=>dialog.showModal()};
}
function field(text,control){const wrapper=element('div',null,'tt-product-master-field'),label=element('label',text);label.htmlFor=control.id;wrapper.append(label,control);return wrapper;}
function display(value,key,collections){
 if(value==null || value==='') return ['stock'].includes(key)?'Sin control':'Vacío';
 if(typeof value==='boolean') return value?'Sí':'No';
 if(key==='category')return collections.find(item=>item.slug===value)?.name || value;
 if(Array.isArray(value))return value.join(', ');
 if(['price','priceBefore'].includes(key))return `${Number(value).toLocaleString('es-PY')} Gs.`;
 return String(value);
}
export function openProductBulkEditor({products,collections,apply,onConfirmed,fields=Object.keys(labels),initialField='price',initialValue}){
 const snapshot=structuredClone(products),view=modal(`Editar ${snapshot.length} producto${snapshot.length===1?'':'s'}`);
 view.body.append(element('p','Revisá el antes y después. Se aplicará el cambio a toda la selección, incluidos los productos fuera del filtro. Si un producto cambió en otra sesión, se detendrá el lote completo.'));
 const select=element('select',null,'tt-commerce-select');select.id='tt-product-bulk-field';Object.entries(labels).filter(([value])=>fields.includes(value)).forEach(([value,label])=>option(select,value,label));
 if(fields.includes(initialField))select.value=initialField;
 const valueSlot=element('div'),preview=element('div',null,'tt-product-master-preview');preview.setAttribute('aria-label','Vista previa de cambios');
 view.body.append(field('Qué querés cambiar',select),valueSlot,preview);
 const save=element('button',`Confirmar y aplicar (${snapshot.length})`,'tt-commerce-btn primary');save.type='button';view.footer.append(save);
 let input,request,firstInput=true;
 function review(){
  view.error.textContent='';preview.replaceChildren();request=null;
  try {
   let value=input.value;if(['active','oferta','destacado'].includes(select.value)) value=value==='true';
   const changes=snapshot.map(product=>({product,patch:productBulkPatch(product,select.value,value,collections)}));
   for(const {product,patch} of changes){
    const row=element('div',null,'tt-product-review-row');row.append(element('strong',product.name || product._docId));
    for(const [key,after] of Object.entries(patch))row.append(element('span',`${labels[key] || key}: ${display(product[key],key,collections)} → ${display(after,key,collections)}`));
    preview.append(row);
   }
   request={ids:snapshot.map(product=>product._docId),field:select.value,value,expected:Object.fromEntries(snapshot.map(product=>[product._docId,productFingerprint(product)]))};save.disabled=false;
  } catch(error){view.error.textContent=error.message;save.disabled=true;}
 }
 function renderInput(){
  const key=select.value;valueSlot.replaceChildren();
  if(['category','active','oferta','destacado','badge'].includes(key)){
   input=element('select',null,'tt-commerce-select');
   if(key==='category'){option(input,'','Elegí una colección');collections.forEach(item=>option(input,item.slug,item.name || item.slug));}
   else if(key==='badge') ['', 'Nuevo','Destacado','Oferta','Agotado'].forEach(value=>option(input,value,value || 'Sin etiqueta'));
   else {option(input,'true','Sí');option(input,'false','No');}
  } else {
   input=element('input',null,'tt-commerce-input');input.type=key==='tags'?'text':'number';input.step='1';
   if(key==='tags')input.maxLength=2000;
   if(['stock','priceBefore'].includes(key))input.placeholder='Vacío = sin control / sin precio anterior';
   if(key==='stockDelta')input.placeholder='Ej.: 5 para sumar o -2 para restar';
   if(key==='pricePercent')input.placeholder='Ej.: 10 para aumentar o -10 para reducir';
  }
  if(firstInput && initialValue!==undefined)input.value=String(initialValue);firstInput=false;
  input.id='tt-product-bulk-value';valueSlot.append(field('Nuevo valor',input));input.addEventListener('input',review);input.addEventListener('change',review);review();
 }
 select.addEventListener('change',renderInput);renderInput();
 save.addEventListener('click',async()=>{
  if(!request || view.dialog.dataset.busy==='true')return;
  view.busy(true);view.error.textContent='';save.textContent='Guardando…';
  try {const result=await apply(request);if(!result?.confirmed)throw Error('No se confirmó el guardado.');onConfirmed?.(result);view.finish();}
  catch(error){view.busy(false);save.textContent=`Reintentar (${snapshot.length})`;view.fail(error);}
 });
 view.show();select.focus();return view.dialog;
}
export function openProductOrderLink({products,orders,onEdit}){
 const ids=products.map(product=>product._docId),view=modal('Vincular productos a una compra');
 view.body.append(element('p',`${ids.length} producto${ids.length===1?'':'s'} seleccionado${ids.length===1?'':'s'}. Abriremos un pedido existente como borrador para revisar sus artículos, variantes y cantidades, conservando el cliente. El inventario y el total se confirman al guardar el pedido.`));
 const search=element('input',null,'tt-commerce-input');search.type='search';search.placeholder='Cliente, teléfono o código';search.id='tt-product-order-search';
 const list=element('select',null,'tt-commerce-select');list.id='tt-product-order-list';list.size=5;
 const code=element('input',null,'tt-commerce-input');code.id='tt-product-order-code';code.maxLength=180;code.placeholder='Ej.: TINPED123 o ID del pedido';
 view.body.append(element('h3','Agregar a una compra existente'),field('Buscar en pedidos cargados',search),field('Elegí un pedido',list),field('O ingresá su código o ID exacto',code));
 const edit=element('button','Abrir pedido y agregar la selección','tt-commerce-btn');edit.type='button';view.footer.append(edit);
 const render=()=>{const q=search.value.trim().toLocaleLowerCase('es');list.replaceChildren();option(list,'','Elegí un pedido…');for(const order of orders.filter(order=>[order.id,order.orderNumber,order.shortId,order.userName,order.userPhone,order.userEmail].some(value=>String(value || '').toLocaleLowerCase('es').includes(q))))option(list,order.id,`${order.orderNumber || order.shortId || order.id} · ${order.userName || 'Sin nombre'} · ${order.status || 'Sin estado'}`);};
 search.addEventListener('input',render);list.addEventListener('change',()=>{code.value=list.value;});render();
 async function open(callback){if(view.dialog.dataset.busy==='true')return;view.busy(true);try{await callback();view.finish(false);document.getElementById('tinped-modal-close')?.focus({preventScroll:true});}catch(error){view.busy(false);view.fail(error);}}
 edit.addEventListener('click',()=>{const id=code.value.trim();if(!id){view.fail(Error('Elegí un pedido o ingresá su código.'));return;}open(()=>onEdit(id,{productIds:ids,returnFocus:view.opener}));});
 view.show();search.focus();return view.dialog;
}

export function closeProductMasterDialogs(){document.querySelectorAll('.tt-product-master-dialog').forEach(dialog=>{dialog.close();dialog.remove();});}
