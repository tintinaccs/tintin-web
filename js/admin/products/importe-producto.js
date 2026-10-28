// Adaptador visual: el input numérico original sigue siendo la autoridad del formulario.
const states=new WeakMap();
export function formatGuarani(value){return value===''?'':String(value).replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
export function mountProductMoney(input){
  let state=states.get(input);
  if(!state){
    const wrap=document.createElement('div');wrap.className='tt-editor-money';input.before(wrap);
    const unit=document.createElement('span');unit.textContent='Gs.';
    const display=document.createElement('input');display.type='text';display.inputMode='numeric';display.className='adm-input';display.dataset.moneyFor=input.id || input.getAttribute('aria-label');display.id=(input.id || 'prod-money-'+crypto.randomUUID())+'-formatted';
    display.setAttribute('aria-label',input.getAttribute('aria-label') || input.labels?.[0]?.textContent || 'Importe en guaraníes');
    input.hidden=true;input.tabIndex=-1;input.removeAttribute('aria-label');wrap.append(unit,input,display);
    for(const label of input.labels || [])if(label.htmlFor===input.id)label.htmlFor=display.id;
    const sync=()=>{const value=formatGuarani(input.value);if(display.value!==value)display.value=value;display.disabled=input.disabled;display.readOnly=input.readOnly;display.placeholder=input.placeholder || '';for(const key of ['aria-invalid','aria-describedby']){const value=input.getAttribute(key);if(value)display.setAttribute(key,value);else display.removeAttribute(key);}};
    display.addEventListener('input',()=>{
      const raw=display.value,position=display.selectionStart ?? raw.length,digitsBefore=raw.slice(0,position).replace(/\D/g,'').length;
      // No decimal conversion or rounding: PYG inputs use canonical integer guaraníes.
      if(!/^[\d.\s]*$/.test(raw)){display.setCustomValidity('Usá sólo números enteros en guaraníes.');return;}
      display.setCustomValidity('');input.value=raw.replace(/[.\s]/g,'');input.dispatchEvent(new Event('input',{bubbles:true}));sync();
      let caret=0,count=0;while(caret<display.value.length && count<digitsBefore){if(/\d/.test(display.value[caret]))count++;caret++;}display.setSelectionRange(caret,caret);
    });
    display.addEventListener('change',()=>input.dispatchEvent(new Event('change',{bubbles:true})));
    input.addEventListener('input',sync);input.addEventListener('change',sync);state={display,sync};states.set(input,state);
  }state.sync();return state.display;
}
