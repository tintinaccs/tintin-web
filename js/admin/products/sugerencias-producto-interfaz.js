import {productSuggestionProfile,productEditorCategoryProfile} from './sugerencias-producto-core.mjs?v=tintin-20261026-editor-contextual-1';
const mounted=new WeakSet();
export function mountProductSuggestions(card) {
  const fields=card?.querySelector('[data-product-section="specs"] .tt-editor-section-fields');
  if(!fields || mounted.has(card))return;
  mounted.add(card);
  const panel=document.createElement('details');panel.className='tt-editor-suggestions';
  const summary=document.createElement('summary');summary.textContent='Sugerencias para este producto';
  const choices=document.createElement('div');choices.className='tt-editor-choices';
  const warranty=document.createElement('p');warranty.className='tt-editor-caption';
  const status=document.createElement('p');status.className='tt-editor-suggestion-status';status.setAttribute('role','status');
  const review=document.createElement('button');review.type='button';review.className='tt-editor-choice';review.textContent='Revisar garantía';
  review.addEventListener('click',()=>card.querySelector('#prod-warranty')?.focus());
  panel.append(summary,choices,warranty,review,status);fields.prepend(panel);
  const categoryPanel=document.createElement('section');categoryPanel.className='tt-category-fields';categoryPanel.setAttribute('aria-label','Opciones de la categoría');
  card.querySelector('[data-product-section="general"] .tt-editor-section-fields')?.append(categoryPanel);
  let categorySignature='';
  function reveal(id){const target=typeof id==='string'?card.querySelector('#'+id):id;if(!target)return;const tab=target.closest('[role=tabpanel]')?.id.replace('prod-panel-','');const select=card.querySelector('#prod-editor-section');if(tab && select && select.value!==tab){select.value=tab;select.dispatchEvent(new Event('change',{bubbles:true}));}for(let p=target.parentElement;p && p!==card;p=p.parentElement){if(p.tagName==='DETAILS')p.open=true;if(p.classList.contains('tt-editor-section-fields'))p.hidden=false;if(p.matches('[data-product-section]'))p.querySelector('.tt-editor-section-toggle')?.setAttribute('aria-expanded','true');}target.focus({preventScroll:true});target.scrollIntoView({block:'center'});}
  function renderCategory(input){
    const profile=productEditorCategoryProfile(input),next=JSON.stringify(profile);if(next===categorySignature)return;categorySignature=next;
    categoryPanel.replaceChildren();const title=document.createElement('h3');title.textContent=`Detalles y opciones · ${profile.title}`;categoryPanel.append(title);
    const hint=document.createElement('p');hint.textContent='Elegí sólo características confirmadas. Podés editar todos los textos y agregar opciones propias.';categoryPanel.append(hint);
    const quick=document.createElement('div');quick.className='tt-editor-choices';
    for(const [id,label] of [['prod-description','Descripción'],['prod-material','Material'],['prod-measurements','Medidas'],['prod-size-fit','Ajuste / uso'],['prod-package-contents','Contenido'],['prod-care','Cuidados'],['prod-warranty','Garantía'],['prod-water-resistance','Resistencia al agua']]){const button=document.createElement('button');button.type='button';button.className='tt-editor-choice';button.textContent=label;button.setAttribute('aria-label',`Editar ${label.toLowerCase()} del producto`);button.addEventListener('click',()=>reveal(id));quick.append(button);}categoryPanel.append(quick);
    const proposals=document.createElement('div');proposals.className='tt-editor-choices';proposals.setAttribute('aria-label','Detalles para añadir a la descripción');proposals.setAttribute('role','group');
    for(const text of profile.descriptionChoices){const button=document.createElement('button');button.type='button';button.className='tt-editor-choice';button.textContent=text;button.addEventListener('click',()=>{const target=card.querySelector('#prod-description');if(!target || target.disabled || target.readOnly)return;if(target.value.includes(text)){reveal('prod-description');return;}const next=(target.value.trim()+' '+text).trim();if(next.length>10000){status.textContent='La descripción no tiene espacio. Revisá el texto antes de agregar.';return;}target.value=next;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));reveal('prod-description');});proposals.append(button);}categoryPanel.append(proposals);
    const variants=document.createElement('div');variants.className='tt-editor-choices';variants.setAttribute('role','group');variants.setAttribute('aria-label','Variantes habituales de la categoría');
    for(const name of profile.variantGroups){const button=document.createElement('button');button.type='button';button.className='tt-editor-choice';button.textContent=`Agregar variante ${name}`;button.addEventListener('click',()=>{const builder=card.querySelector('.tt-editor-variant-builder'),attribute=builder?.querySelector('[aria-label="Característica de variante"]'),custom=builder?.querySelector('[aria-label="Nombre del nuevo grupo"]');if(!attribute)return;if([...attribute.options].some(option=>option.value===name))attribute.value=name;else{attribute.value='__custom';custom.value=name;}attribute.dispatchEvent(new Event('change',{bubbles:true}));const value=builder.querySelector('[aria-label="Nueva opción de variante"]');reveal(value);});variants.append(button);}categoryPanel.append(variants);
    const material=card.querySelector('#dl-prod-material');if(material){const values=profile.materials.length?profile.materials:['Acero inoxidable','Plata 925','Cuero sintético','Tela / textil'];material.replaceChildren(...values.map(value=>new Option(value,value)));}
    const finishes=card.querySelector('#dl-prod-color-finish');if(finishes){const colors=['bag','wallet'].includes(profile.key)?['Negro','Marrón','Beige','Rosado','Blanco','Multicolor']:['Dorado','Plateado','Oro rosa','Negro','Blanco','Multicolor'];finishes.replaceChildren(...colors.map(value=>new Option(value,value)));}
    const measurements=card.querySelector('#prod-measurements'),fit=card.querySelector('#prod-size-fit');if(measurements)measurements.placeholder=profile.measurements;if(fit)fit.placeholder=profile.sizeFit;
  }
  let signature='';
  const refresh=()=>{
    const category=card.querySelector('#prod-category');
    const input={category:category?.selectedOptions?.[0]?.textContent || '',name:card.querySelector('#prod-name')?.value,material:card.querySelector('#prod-material')?.value};
    const next=JSON.stringify(input);if(next===signature)return;signature=next;status.textContent='';
    renderCategory(input);
    const profile=productSuggestionProfile(input);
    summary.textContent=`Sugerencias · ${profile.type}`;
    choices.replaceChildren();
    for(const suggestion of profile.care){
      const button=document.createElement('button');button.type='button';button.className='tt-editor-choice';button.textContent=suggestion;
      button.addEventListener('click',()=>{
        const target=card.querySelector('#prod-care');if(!target || target.disabled || target.readOnly)return;
        // Nunca reemplazar cuidados existentes, incluso después de cambiar de producto.
        const existing=target.value.trim();if(existing.includes(suggestion)){status.textContent='Este cuidado ya está agregado.';return;}
        const value=existing?`${existing} ${suggestion}`:suggestion;
        if(value.length>target.maxLength && target.maxLength>=0){status.textContent='El campo de cuidados no tiene espacio. Revisá el texto antes de agregar.';return;}
        target.value=value;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));status.textContent='Cuidado agregado al borrador. Se aplica al guardar.';
      });choices.append(button);
    }
    warranty.textContent=`${profile.warrantyReview} La foto no confirma garantía ni resistencia al agua.`;
  };
  card.addEventListener('input',refresh);card.addEventListener('change',refresh);
  new MutationObserver(refresh).observe(card,{attributes:true,childList:true,subtree:true,attributeFilter:['style','hidden']});
  refresh();
}
