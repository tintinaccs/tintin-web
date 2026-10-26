import {productSuggestionProfile} from './sugerencias-producto-core.mjs?v=tintin-20261026-contexto-1';
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
  let signature='';
  const refresh=()=>{
    const category=card.querySelector('#prod-category');
    const input={category:category?.selectedOptions?.[0]?.textContent || '',name:card.querySelector('#prod-name')?.value,material:card.querySelector('#prod-material')?.value};
    const next=JSON.stringify(input);if(next===signature)return;signature=next;status.textContent='';
    const profile=productSuggestionProfile(input);
    summary.textContent=`Sugerencias · ${profile.type}`;
    choices.replaceChildren();
    for(const [attribute,values] of Object.entries(profile.optionHints))for(const value of values){
      const button=document.createElement('button');button.type='button';button.className='tt-editor-choice';button.textContent=`${attribute}: ${value}`;
      button.addEventListener('click',()=>{
        const select=card.querySelector('[aria-label="Característica de variante"]'),custom=card.querySelector('[aria-label="Nombre del nuevo grupo"]'),input=card.querySelector('[aria-label="Nueva opción de variante"]');
        if(!select || !input || select.disabled || input.disabled)return;
        const native=[...select.options].some(option=>option.value===attribute);select.value=native?attribute:'__custom';select.dispatchEvent(new Event('change',{bubbles:true}));if(!native && custom)custom.value=attribute;
        input.value=value;input.focus({preventScroll:true});input.scrollIntoView({block:'nearest'});status.textContent='Revisá la opción y pulsá Agregar opción para confirmarla.';
      });choices.append(button);
    }
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
