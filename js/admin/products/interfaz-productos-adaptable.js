import {ensureEditorialFields} from './editor-editorial-interfaz.js?v=tintin-20261024-editor-shopify-1';
import { mountProductPreview, refreshProductPreview } from './vista-previa-producto.js?v=tintin-20261028-product-tabs-1';
import { installEditorControls, refreshEditorControls } from './controles-editor-producto.js?v=tintin-20261028-product-tabs-1';
import {mountLocalVision} from './vision-productos-interfaz.js?v=tintin-20261024-editor-intuitivo-1';
import {mountProductSuggestions} from './sugerencias-producto-interfaz.js?v=tintin-20261028-product-tabs-1';
// Presentación del editor; los campos, eventos y controladores CRUD son canónicos.
const sections = [
  ['photos', 'Fotografías del producto', ['prod-imageUrl','prod-images-extra','prod-color-photos']],
  ['general', 'Producto', ['prod-name','prod-description']],
  ['prices', 'Precio', ['prod-price','prod-price-before','prod-badge','prod-oferta']],
  ['inventory', 'Opciones y variantes', ['prod-variants-text']],
  ['availability', 'Inventario y disponibilidad', ['prod-stock']],
  ['specs', 'Detalles del producto', ['prod-material','prod-measurements','prod-color-finish','prod-care','prod-water-resistance','prod-warranty','prod-size-fit','prod-package-contents']],
  ['visibility', 'Organización', ['prod-category','prod-collection','prod-tags','prod-sku','prod-destacado','prod-active']],
  ['private', 'Inventario interno', ['prod-inventory-fields']],
];
const tabs = [
  ['general','Información',['general']],
  ['photos','Fotos y colores',['photos']],
  ['inventory','Variantes',['inventory']],
  ['prices','Precio y stock',['prices','availability','private']],
  ['specs','Detalles',['specs']],
  ['visibility','Publicación',['visibility']],
];
const tabFor = value => tabs.find(([id,,groups])=>id===value || groups.includes(value))?.[0] || 'general';
let editorWasOpen = false;
let editorOpener = null;
let installed = false;
let lastError = '';
let surfaceSyncFrame = 0;

// ResizeObserver, visualViewport y los cambios de panel pueden llegar en ráfaga.
// Medir y escribir geometría más de una vez por frame fuerza recálculos de layout
// durante el scroll, especialmente cuando el teclado móvil está visible.
export function scheduleProductSurfaceSync() {
  if (surfaceSyncFrame) return;
  const schedule = window.requestAnimationFrame || (callback => window.setTimeout(callback, 16));
  surfaceSyncFrame = schedule(() => {
    surfaceSyncFrame = 0;
    syncProductSurfaces();
  });
}

export function visibleProductEditor() {
  const card = document.getElementById('prod-form-card');
  return card && !card.hidden && card.getClientRects().length && getComputedStyle(card).visibility !== 'hidden' ? card : null;
}

export function syncProductSurfaces() {
  const editor = visibleProductEditor();
  const drawer = document.querySelector('#tt-commerce-drawer[data-kind="product"].open:not([hidden])');
  document.documentElement.classList.toggle('tt-product-editor-open', Boolean(editor));
  document.documentElement.classList.toggle('tt-product-panel-open', Boolean(drawer));
  if (editor) {
    if (!editorWasOpen) {
      editorOpener = document.activeElement;
      showSection(editor,'general',true);
      window.TintinPageScroll?.reset(editor);
      (editor.querySelector('[role=tab][aria-selected=true]') || editor.querySelector('#prod-name,button'))?.focus({preventScroll:true});
    }
    editor.setAttribute('role','dialog');
    editor.setAttribute('aria-modal',String(editor.classList.contains('tt-editor-workspace')));
    editor.setAttribute('aria-labelledby','prod-form-title');
  } else if (editorWasOpen) {
    requestAnimationFrame(()=>{
      const target=editorOpener?.isConnected && editorOpener !== document.body && editorOpener.getClientRects().length ? editorOpener : document.querySelector('[data-action="product-new"]');
      target?.focus({preventScroll:true});
    });
  }
  editorWasOpen = Boolean(editor);
  const products=document.getElementById('tt-commerce-products');
  const bounds=products?.getBoundingClientRect();
  if(bounds?.width){
    products.style.setProperty('--tt-product-selection-left',`${bounds.left+12}px`);
    products.style.setProperty('--tt-product-selection-width',`${Math.max(0,bounds.width-24)}px`);
    const bar=products.querySelector('.tt-product-selection:not([hidden])');
    products.style.setProperty('--tt-product-selection-space',`${bar ? bar.getBoundingClientRect().height+24 : 12}px`);
  }
  const navigation=document.getElementById('adm-mobile-tabs');
  document.documentElement.style.setProperty('--tt-product-navigation-height', `${navigation?.getClientRects().length ? Math.max(0, innerHeight-navigation.getBoundingClientRect().top) : 0}px`);
  const viewport = window.visualViewport;
  const sidebar = document.getElementById('adm-sidebar');
  document.documentElement.style.setProperty('--tt-product-editor-left', `${innerWidth > 540 && sidebar?.getClientRects().length ? Math.max(0,sidebar.getBoundingClientRect().right) : 0}px`);
  document.documentElement.style.setProperty('--tt-product-viewport-height', `${viewport?.height || innerHeight}px`);
  document.documentElement.style.setProperty('--tt-product-viewport-top', `${viewport?.offsetTop || 0}px`);
  const header = document.querySelector('.adm-topbar');
  const headerBottom = header?.getClientRects().length ? header.getBoundingClientRect().bottom : 0;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportHeight = viewport?.height || innerHeight;
  const preferredTop = Math.max(viewportTop, headerBottom);
  // Teclado, zoom o una cabecera alta no pueden dejar el editor con altura cero.
  // Si no caben ambas barras, la del editor conserva sus propias acciones.
  const editorTop = preferredTop + Math.min(240, viewportHeight) > viewportTop + viewportHeight
    ? viewportTop : preferredTop;
  document.documentElement.style.setProperty('--tt-product-editor-top', `${editorTop}px`);
  document.documentElement.style.setProperty('--tt-product-editor-height', `${Math.max(0, (viewport?.height || innerHeight) + (viewport?.offsetTop || 0) - editorTop)}px`);
}

export function enhanceProductEditor() {
  const card = document.getElementById('prod-form-card');
  const body = card?.querySelector('.adm-card-body');
  ensureEditorialFields(card);
  const grid = body?.querySelector('.tt-product-fields, :scope > div[style*="grid-template-columns"]');
  if (!grid) return;
  grid.classList.add('tt-product-fields');
  card.classList.add('tt-editor-composer');
  let navigation = body.querySelector('.tt-product-section-nav');
  if (!navigation) {
    navigation = document.createElement('div');
    navigation.className = 'tt-product-section-nav';
    const text = document.createElement('label');text.htmlFor = 'prod-editor-section';text.textContent = 'Ir a sección';
    const select = document.createElement('select');select.id = 'prod-editor-section';select.className = 'adm-input';
    for (const [value,label] of tabs) {
      const option = document.createElement('option');option.value=value;option.textContent=label;select.append(option);
    }
    // Compatibilidad para consumidores internos que todavía apuntan a un bloque.
    for(const value of ['availability','private','all']) {const option=new Option(value,value);option.hidden=true;select.append(option);}
    select.value = 'general';
    select.addEventListener('change',()=>showSection(card,select.value,true));
    const shortcuts=document.createElement('nav');shortcuts.className='tt-product-quick-actions';shortcuts.setAttribute('role','tablist');shortcuts.setAttribute('aria-label','Editar producto');
    for(const [value,title] of tabs){
      const button=document.createElement('button');button.type='button';button.className='adm-btn adm-btn-outline';button.textContent=title;
      button.id='prod-tab-'+value;button.dataset.editorTab=value;button.setAttribute('role','tab');button.setAttribute('aria-controls','prod-panel-'+value);
      button.addEventListener('click',()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
      button.addEventListener('keydown',event=>{
        const buttons=[...shortcuts.querySelectorAll('[role=tab]')],index=buttons.indexOf(button);
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:null;
        if(next===null)return;event.preventDefault();buttons[next].click();buttons[next].focus({preventScroll:true});
      });shortcuts.append(button);
    }
    navigation.append(text,select,shortcuts);body.prepend(navigation);

  }
  let layout = body.querySelector('.tt-editor-layout');
  if (!layout) {
    layout = document.createElement('div'); layout.className = 'tt-editor-layout';
    grid.before(layout); layout.append(grid);
    const sidebar=document.createElement('aside');sidebar.className='tt-editor-sidebar';sidebar.setAttribute('aria-label','Publicación y organización del producto');layout.append(sidebar);
    const descriptions = {
      general:'Nombre y descripción que verán tus clientes.',
      photos:'La imagen principal es la portada. Agregá otras vistas y ordená las fotos de cada color.',
      prices:'Definí el precio general y las promociones.',
      inventory:'Opciones, precios y cantidades de cada combinación.',
      availability:'Cantidades y disponibilidad. La publicación se configura por separado.',
      specs:'Detalles opcionales que ayudan a elegir.',
      visibility:'Colección, búsqueda y referencias del producto.',
      private:'Costo y notas internas, disponibles sólo con permiso.',
    };
    const originalFields = [...grid.children];
    for (const [section,title,ids] of sections) {
      const group = document.createElement('section'); group.className = 'tt-editor-section'; group.dataset.productSection = section;
      const heading = document.createElement('h2');
      const toggle = document.createElement('button');toggle.type='button';toggle.className='tt-editor-section-toggle';toggle.setAttribute('aria-label',title);
      const titleText=document.createElement('span');titleText.className='tt-editor-section-title';titleText.textContent=title;toggle.append(titleText);
      const valueText=document.createElement('span');valueText.className='tt-editor-section-value';valueText.id=`prod-section-${section}-value`;toggle.setAttribute('aria-describedby',valueText.id);toggle.append(valueText);
      const open=['photos','general'].includes(section);
      group.dataset.advanced=String(!open);

      toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-controls',`prod-section-${section}`);
      const chevron=document.createElement('span');chevron.className='tt-editor-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌃';toggle.append(chevron);heading.append(toggle);
      const description = document.createElement('p'); description.className = 'tt-editor-caption'; description.textContent = descriptions[section];
      const fields = document.createElement('div'); fields.className = 'tt-editor-section-fields';
      fields.id=`prod-section-${section}`;fields.hidden=!open;description.hidden=!open;
      toggle.addEventListener('click',()=>{
        const expanded=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expanded));fields.hidden=!expanded;
      });
      // Las ayudas se consultan a demanda; no compiten con los campos editables.
      const help=document.createElement('details');help.className='tt-editor-section-help';
      const helpSummary=document.createElement('summary');helpSummary.textContent='Ayuda';help.append(helpSummary,description);
      description.hidden=false;fields.append(help);
      group.append(heading,fields); grid.append(group);
      for (const id of ids) {
        const field = originalFields.find(field=>field.id === id || field.querySelector(`#${id}`));
        if (field) fields.append(field);
      }
    }
    const previewShell=document.createElement('details');previewShell.className='tt-editor-preview-shell';
    const previewSummary=document.createElement('summary');previewSummary.textContent='Vista previa';previewShell.append(previewSummary);body.append(previewShell);
    mountProductPreview(card,previewShell);
  }
  for (const [section,,ids] of sections) for (const id of ids) {
    // La galería se monta al abrir cada producto; se reubica sin recrear sus controles.
    if (id !== 'prod-color-photos') continue;
    const field = card.querySelector(`#${id}`), target = card.querySelector(`[data-product-section="${section}"] .tt-editor-section-fields`);
    if (field && !field.dataset.optionInline && target && field.parentElement !== target) target.append(field);
  }
  for (const control of layout.querySelectorAll('input[id],select[id],textarea[id]')) {
    if (control.type === 'hidden' || control.closest('label')) continue;
    const label=control.parentElement.querySelector(':scope > label');
    if (label) label.htmlFor=control.id;
  }
  const variantsLabel=card.querySelector('label[for="prod-variants-text"]');if(variantsLabel && variantsLabel.textContent!=='Colores y opciones')variantsLabel.textContent='Colores y opciones';
  const save = card.querySelector('#prod-save-btn');
  const actions=save?.parentElement;
  if(actions && !actions.classList.contains('tt-product-primary-actions')) {
    actions.removeAttribute('style');actions.className='tt-product-primary-actions';actions.id='prod-editor-actions';actions.hidden=false;
    actions.setAttribute('role','group');actions.setAttribute('aria-label','Guardar o cancelar producto');actions.append(save);
    const header=card.querySelector('.adm-card-head');
    header?.querySelector('button[onclick="prodCancelForm()"]')?.remove();
    header?.append(actions);
  }
  const organization=grid.querySelector('[data-product-section="visibility"] .tt-editor-section-fields');
  const publication=card.querySelector('.tt-product-editorial-publication');
  if(publication && organization && organization.firstElementChild!==publication)organization.prepend(publication);
  for(const panel of card.querySelectorAll('.tt-product-editorial-seo,.tt-product-editorial-statistics'))if(organization && panel.parentElement!==organization)organization.append(panel);
  const category=card.querySelector('#prod-category')?.parentElement;
  const identity=grid.querySelector('[data-product-section="general"] .tt-editor-section-fields');
  if(category && identity && category.parentElement!==identity)identity.prepend(category);
  // Cada pestaña contiene nodos originales; nunca se desmonta el formulario.
  for(const [id,,groups] of tabs){
    let panel=grid.querySelector('#prod-panel-'+id);
    if(!panel){panel=document.createElement('div');panel.id='prod-panel-'+id;panel.className='tt-product-tabpanel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','prod-tab-'+id);panel.tabIndex=0;grid.append(panel);}
    for(const section of groups){const group=card.querySelector(`[data-product-section="${section}"]`);if(group && group.parentElement!==panel)panel.append(group);}
  }
  const priceFields=card.querySelector('[data-product-section=prices] .tt-editor-section-fields');
  if(priceFields && !priceFields.querySelector('.tt-photo-price-scope')){const note=document.createElement('p');note.className='tt-editor-caption tt-photo-price-scope';note.textContent='Precio general del producto. Los precios propios de cada color o combinación se editan en Inventario y disponibilidad.';priceFields.prepend(note);}
  // El panel pertenece al formulario, fuera de la galería que se destruye al reabrir.
  // Nunca se recrean campos ni se trasladan filas fuera de su serializer.
  const privateSection=card.querySelector('[data-product-section="private"]');
  const privateField=card.querySelector('#prod-inventory-fields');
  const privateHidden=!privateField || privateField.hidden || privateField.style.display==='none';
  if(privateSection)privateSection.dataset.permissionHidden=String(privateHidden);
  const privateOption=card.querySelector('#prod-editor-section option[value="private"]');
  if(privateOption){if(privateOption.hidden!==privateHidden)privateOption.hidden=privateHidden;if(privateOption.disabled!==privateHidden)privateOption.disabled=privateHidden;}
  const inventoryPanel=card.querySelector('#prod-variant-stock');
  const inventoryTarget=card.querySelector('[data-product-section="availability"] .tt-editor-section-fields');
  if(inventoryPanel && !inventoryPanel.dataset.optionInline && inventoryTarget && inventoryPanel.parentElement!==inventoryTarget)inventoryTarget.append(inventoryPanel);
  const preview=card.querySelector('.tt-editor-preview-shell');if(preview && body.lastElementChild!==preview)body.append(preview);
  const secondary=card.querySelector('.tt-work-secondary');if(secondary && preview && secondary.nextElementSibling!==preview)body.insertBefore(secondary,preview);
  refreshEditorHeading(card);
  const error=card.querySelector('#prod-form-error');
  if (error) {
    error.setAttribute('role','alert');error.setAttribute('tabindex','-1');
    let region=card.querySelector('.tt-editor-error-region');
    if(!region){
      region=document.createElement('div');region.className='tt-editor-error-region';
      const jump=document.createElement('button');jump.type='button';jump.className='adm-btn adm-btn-outline';jump.textContent='Ir al campo';
      jump.addEventListener('click',()=>{
        const input=card.querySelector('#'+error.dataset.editorField);
        const visible=element=>element && !element.disabled && element.getClientRects().length;
        const candidates=[input,...(input?.closest('[data-product-section]')?.querySelectorAll('input,textarea,select,button') || []),...(card.querySelector('#prod-variant-stock')?.querySelectorAll('input,select,button') || [])];
        const target=candidates.find(element=>visible(element) && element.matches('input,textarea,select')) || candidates.find(element=>visible(element) && !element.matches('.tt-editor-section-toggle'));target?.focus({preventScroll:true});target?.scrollIntoView({block:'center',behavior:'instant'});
      });region.append(error,jump);
    }
    if(region.nextElementSibling!==layout)body.insertBefore(region,layout);
  }
  const selected=privateHidden && card.querySelector('#prod-editor-section').value==='private'?'all':card.querySelector('#prod-editor-section').value;
  const message=error?.style.display !== 'none' ? error?.textContent.trim() || '' : '';
  // Sólo un error nuevo inicia navegación. El observer también corre al editar
  // controles: un mensaje persistente no debe reiniciar scroll ni desplegar
  // otra vez todos los bloques en cada pulsación.
  const newError=Boolean(message && message!==lastError);
  showSection(card,newError ? errorSection(card,message) : selected,newError);
  const errorRegion=card.querySelector('.tt-editor-error-region');
  if(errorRegion){
    if(errorRegion.hidden!==!message)errorRegion.hidden=!message;
    const jump=errorRegion.querySelector('button');const hidden=!message || !error.dataset.editorField;if(jump.hidden!==hidden)jump.hidden=hidden;
  }
  if(newError && visibleProductEditor()) {error.focus({preventScroll:true});error.scrollIntoView({block:'nearest'});}
  lastError=message;
  refreshProductPreview(card);
  installEditorControls(card);refreshEditorControls(card);
  mountLocalVision(card);
  mountProductSuggestions(card);
}

function refreshEditorHeading(card) {
  const title=card.querySelector('#prod-form-title');if(!title)return;
  title.setAttribute('role','heading');title.setAttribute('aria-level','1');
  let heading=card.querySelector('.tt-product-editor-heading');
  if(!heading){heading=document.createElement('div');heading.className='tt-product-editor-heading';title.before(heading);heading.append(title);}
  const name=card.querySelector('#prod-name')?.value.trim();
  const text=name || (card.querySelector('#prod-id')?.value?'Editar producto':'Nuevo producto');
  if(title.textContent!==text)title.textContent=text;
  if(title.title!==text)title.title=text;
  let state=heading.querySelector('.tt-product-editor-state');
  if(!state){state=document.createElement('span');state.className='tt-product-editor-state';heading.append(state);}
  const value=card.dataset.productPublicState || card.querySelector('#prod-publicationStatus')?.value || 'draft';
  const label={active:'Publicado',draft:'Borrador',archived:'Archivado',inactive:'Inactivo (histórico)'}[value] || 'Borrador';
  if(state.textContent!==label)state.textContent=label;
  if(state.dataset.state!==value)state.dataset.state=value;
  refreshSectionValues(card);
}

// Resumen de los campos actuales; no calcula precios ni inventario.
function refreshSectionValues(card) {
  const read=id=>card.querySelector(`#${id}`)?.value.trim() || '';
  const price=read('prod-price'),stock=read('prod-stock');
  const values={
    prices:price ? `Gs. ${Number(price).toLocaleString('es-PY')}` : 'Sin precio',
    inventory:stock==='' ? 'Stock sin control' : `${stock} unidades`,
    availability:stock==='' ? 'Stock sin control' : `${stock} unidades`,
    specs:read('prod-material') || 'Opcionales',
    private:'Sólo administración',
  };
  for(const [section,text] of Object.entries(values)) {
    const target=card.querySelector(`[data-product-section="${section}"] .tt-editor-section-value`);
    if(target && target.textContent!==text)target.textContent=text;
  }
}

function errorSection(card,message) {
  const read=id=>card.querySelector('#'+id)?.value.trim();
  let id;
  if(/descripción/i.test(message))id='prod-description';
  else if(/foto|imagen|carga/i.test(message))id='prod-imageUrl';
  else if(/costo|comprada|mínimo|notas internas/i.test(message))id='prod-cost-unit';
  else if(/variante|combinaci[oó]n|grupo|atributo|opci[oó]n.*quitar|quitar.*opci[oó]n/i.test(message))id='prod-variants-text';
  else if(/precio anterior/i.test(message))id='prod-price-before';
  else if(/stock|inventario|cantidad/i.test(message))id='prod-stock';
  else if(/colección/i.test(message) && !/obligatorios/i.test(message))id='prod-category';
  else if(/precio/i.test(message) && !/obligatorios/i.test(message))id='prod-price';
  else if(/obligatorios/i.test(message))id=!read('prod-name')?'prod-name':!read('prod-category')?'prod-category':'prod-price';
  const control=id && card.querySelector('#'+id),group=control?.closest('[data-product-section]');
  const error=card.querySelector('#prod-form-error');if(error)error.dataset.editorField=group?.dataset.permissionHidden==='true'?'':id || '';
  if(control && group?.dataset.permissionHidden!=='true'){
    control.setAttribute('aria-invalid','true');control.setAttribute('aria-describedby','prod-form-error');
    if(group?.dataset.productSection==='private'){
      group.querySelector('.tt-editor-section-toggle')?.setAttribute('aria-expanded','true');
      const fields=group.querySelector('.tt-editor-section-fields');if(fields)fields.hidden=false;
    }
  }
  return tabFor(group?.dataset.productSection || card.querySelector('#prod-editor-section').value);
}

function showSection(card,value,expand=false) {
  value=tabFor(value);
  const select=card.querySelector('#prod-editor-section');if(select.value!==value)select.value=value;
  const layout=card.querySelector('.tt-editor-layout');if(layout.dataset.editorSection!==value)layout.dataset.editorSection=value;
  for(const panel of card.querySelectorAll('.tt-product-tabpanel')){
    const hidden=panel.id!=='prod-panel-'+value;if(panel.hidden!==hidden)panel.hidden=hidden;
  }
  for(const button of card.querySelectorAll('[data-editor-tab]')){
    const selected=button.dataset.editorTab===value;
    if(button.getAttribute('aria-selected')!==String(selected))button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
  }
  for(const field of card.querySelectorAll('[data-product-section]')){
    const hidden=field.dataset.permissionHidden==='true';if(field.hidden!==hidden)field.hidden=hidden;
    // Los campos principales están abiertos; los internos conservan su despliegue.
    if(expand && field.dataset.productSection!=='private' && tabs.find(([id])=>id===value)[2].includes(field.dataset.productSection)){
      field.querySelector('.tt-editor-section-toggle')?.setAttribute('aria-expanded','true');
      const fields=field.querySelector(':scope > .tt-editor-section-fields');if(fields?.hidden)fields.hidden=false;
    }
  }
  if(expand){window.TintinPageScroll?.reset(card);card.querySelector('.adm-card-body')?.scrollTo({top:0,behavior:'instant'});}
}

export function installProductInterface() {
  enhanceProductEditor();syncProductSurfaces();
  if (installed) return;
  installed=true;
  let queued=false;
  const card=document.getElementById('prod-form-card');
  card?.addEventListener('click',event=>{if(event.target.closest('#prod-save-btn'))lastError='';},{capture:true});
  card?.addEventListener('input',event=>{refreshEditorHeading(card);if(event.target.getAttribute('aria-invalid')==='true'){event.target.removeAttribute('aria-invalid');event.target.removeAttribute('aria-describedby');}});
  card?.addEventListener('change',()=>refreshEditorHeading(card));
  if (card) new MutationObserver(()=>{
    if (queued) return;
    queued=true;queueMicrotask(()=>{queued=false;enhanceProductEditor();scheduleProductSurfaceSync();});
  }).observe(card,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});
  // La navegación nativa oculta la sección sin modificar el formulario.
  const section=card?.closest('.adm-section');
  if(section) new MutationObserver(scheduleProductSurfaceSync).observe(section,{attributes:true,attributeFilter:['class','style','hidden']});
  // La biblioteca se abre encima del editor; conserva el foco y sus controles.
  let pickerOpener=null;
  let previousPicker=null;
  new MutationObserver(()=>{
    const picker=visibleProductEditor() && document.querySelector('.tt-mlib-overlay');
    if(picker && picker!==previousPicker){
      pickerOpener=document.activeElement;
      picker.setAttribute('role','dialog');picker.setAttribute('aria-modal','true');picker.setAttribute('aria-label','Elegir imagen de la biblioteca');
      const close=picker.querySelector('.tt-mlib-close');close?.setAttribute('aria-label','Cerrar biblioteca');close?.focus({preventScroll:true});
    } else if(!picker && previousPicker && pickerOpener?.isConnected) pickerOpener.focus({preventScroll:true});
    previousPicker=picker;
  }).observe(document.body,{childList:true});
  window.addEventListener('resize',scheduleProductSurfaceSync,{passive:true});
  window.addEventListener('pageshow',scheduleProductSurfaceSync,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleProductSurfaceSync();});
  const header=document.querySelector('.adm-topbar');
  if(header && typeof ResizeObserver==='function')new ResizeObserver(scheduleProductSurfaceSync).observe(header);
  const sidebar=document.getElementById('adm-sidebar');
  if(sidebar && typeof ResizeObserver==='function')new ResizeObserver(scheduleProductSurfaceSync).observe(sidebar);
  window.visualViewport?.addEventListener('resize',scheduleProductSurfaceSync,{passive:true});
  window.visualViewport?.addEventListener('scroll',scheduleProductSurfaceSync,{passive:true});
  document.addEventListener('error',event=>{
    const img=event.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('#tt-commerce-products,.tt-commerce-product-preview')) return;
    const frame=img.closest('.tt-commerce-thumb');if(!frame)return;
    const message=document.createElement('span');message.textContent='Imagen no disponible';
    frame.classList.add('tt-product-image-unavailable');frame.replaceChildren(message);
  },true);
}
