// Controles visuales sobre los campos nativos: una sola autoridad de datos/guardado.
const mounted = new WeakSet();
const quantityControls = new WeakMap();
const choices = new WeakMap();
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
      const hint = node('small', 'tt-editor-caption', 'Al cambiar la cantidad: 0 sin stock; desde 1 se activa. Podés ajustar la visibilidad por separado.'); wrap.append(hint);
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
  const panel = node('div', 'tt-editor-variant-builder');
  const form = node('div', 'tt-editor-variant-add');
  const attribute = node('select', 'adm-input'); attribute.setAttribute('aria-label', 'Característica de variante');
  for (const title of ['Color','Talle','Material','Forma','Diseño','Modelo']) attribute.append(node('option','',title));
  const value = node('input', 'adm-input'); value.placeholder='Ej.: Dorado'; value.maxLength=120; value.setAttribute('aria-label','Nueva opción de variante');
  const error = node('p','tt-editor-control-error'); error.setAttribute('role','alert');
  const chips = node('div','tt-editor-variant-groups');
  const add = (focus = true) => {
    if (input.readOnly) return;
    const text = value.value.trim();
    if (!text || /[,:\n\r\/<>]/.test(text)) {error.textContent='Escribí una opción sin comas, barras ni dos puntos.'; return;}
    const lines = input.value.split(/\r?\n/).filter(Boolean);
    const exists = lines.some(line => line.split(':')[0].trim().toLocaleLowerCase('es') === attribute.value.toLocaleLowerCase('es') && line.slice(line.indexOf(':')+1).split(',').some(item=>item.trim().toLocaleLowerCase('es')===text.toLocaleLowerCase('es')));
    if (!exists) {input.value=[...lines,`${attribute.value}: ${text}`].join('\n'); emit(input);}
    value.value=''; error.textContent=''; if(focus)value.focus();
  };
  const addButton = button('Agregar opción', null, add);
  value.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();add();}});
  const palette=node('div','tt-editor-choices tt-editor-color-presets');palette.setAttribute('role','group');palette.setAttribute('aria-label','Colores rápidos');
  for(const title of ['Dorado','Plateado','Oro rosa','Negro','Blanco']) {
    const choice=button(title,`Agregar color ${title}`,()=>{attribute.value='Color';value.value=title;add(false);});const dot=node('span','adm-color-circle');dot.style.background=window.TintinProductColors?.preset(title)?.hex || 'transparent';dot.setAttribute('aria-hidden','true');choice.dataset.color=title;choice.prepend(dot);palette.append(choice);
  }
  form.append(attribute,value,addButton); panel.append(palette,form,error,chips); input.before(panel);
  const advanced = node('details','tt-editor-advanced'); const summary = node('summary','','Editar opciones en texto');
  input.before(advanced); advanced.append(summary);
  input.hidden=true;
  advanced.addEventListener('toggle',()=>{input.hidden=!advanced.open;});
  let signature = '';
  const refresh = () => {
    attribute.disabled=value.disabled=addButton.disabled=input.readOnly;
    const colors=input.value.split(/\r?\n/).filter(line=>/^\s*colou?r\s*:/i.test(line)).flatMap(line=>line.slice(line.indexOf(':')+1).split(',')).map(value=>value.trim().toLocaleLowerCase('es'));
    for(const choice of palette.children){choice.disabled=input.readOnly;choice.setAttribute('aria-pressed',String(colors.includes(choice.dataset.color.toLocaleLowerCase('es'))));}
    const current = JSON.stringify([input.value,input.readOnly]); if (current===signature) return;
    signature=current;chips.replaceChildren();
    for (const line of input.value.split(/\r?\n/)) {
      const index=line.indexOf(':'); if(index<1) continue;
      const key=line.slice(0,index).trim();
      for (const option of line.slice(index+1).split(',').map(item=>item.trim()).filter(Boolean)) {
        const chip = button(`${key}: ${option} ×`, `Quitar ${key}: ${option}`, () => {
          if(input.readOnly)return;
          input.value=input.value.split(/\r?\n/).flatMap(row=>{
            const separator=row.indexOf(':'); if(separator<1 || row.slice(0,separator).trim()!==key)return [row];
            const rest=row.slice(separator+1).split(',').map(item=>item.trim()).filter(item=>item && item!==option);
            return rest.length ? [`${key}: ${rest.join(', ')}`] : [];
          }).join('\n'); emit(input);
        });
        chip.disabled=input.readOnly;chips.append(chip);
      }
    }
  };
  input.addEventListener('input',refresh);
  choices.set(panel,{refresh});
  // El textarea mantiene su padre: inventario y fotos se montan en ese contenedor.
}

export function refreshEditorControls(card) {
  const stock=card.querySelector('#prod-stock');
  if(stock)quantity(stock,'Stock',true);
  for(const input of card.querySelectorAll('#prod-variant-stock input')) quantity(input,input.getAttribute('aria-label') || 'Variante');
  for(const id of ['prod-purchased','prod-stock-minimum']) {
    const input=card.querySelector(`#${id}`);if(input)quantity(input,input.labels?.[0]?.textContent || id);
  }
  for(const id of ['prod-price','prod-price-before','prod-cost-unit']) {const input=card.querySelector(`#${id}`);if(input)money(input);}
  for(const id of ['prod-badge']) {
    const input=card.querySelector(`#${id}`); if(input)selection(input,[...input.options].filter(option=>option.value || id==='prod-badge').slice(0,id==='prod-category'?4:6).map(option=>[option.value,option.textContent]),id==='prod-category'?'Categorías rápidas':'Etiqueta del producto');
  }
  for(const input of card.querySelectorAll('input[list]')) {
    const list=card.querySelector(`#${input.getAttribute('list')}`);
    if(list) selection(input,[...list.options].slice(0,4).map(option=>[option.value,option.value]),`Sugerencias: ${input.labels?.[0]?.textContent || input.id}`);
  }
  const variants=card.querySelector('#prod-variants-text');if(variants)variantBuilder(variants);
  for(const panel of card.querySelectorAll('.tt-editor-variant-builder')) choices.get(panel)?.refresh();
}

export function installEditorControls(card) {
  if(mounted.has(card))return;
  mounted.add(card);
  const pendingPhoto=event=>{if(event.detail?.pending)window.AdminUnsaved?.markDirty('primary-editor');};
  card.addEventListener('tintin:image-pending',pendingPhoto);card.addEventListener('tintin:image-preview',pendingPhoto);
  card.addEventListener('input',event=>{
    if(event.target.id==='prod-stock' || event.target.closest('#prod-variant-stock')) {
      const stock=card.querySelector('#prod-stock'),active=card.querySelector('#prod-active');
      // Sólo una modificación de cantidad cambia el estado; abrir nunca activa productos ocultos.
      if(stock.value!=='' && Number.isInteger(Number(stock.value)) && Number(stock.value)>=0) {
        active.checked=Number(stock.value)>0;active.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
    refreshEditorControls(card);
  });
  card.addEventListener('change',()=>refreshEditorControls(card));
}
