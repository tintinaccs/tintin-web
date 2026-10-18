// Presentación del editor; los campos, eventos y controladores CRUD son canónicos.
const sections = [
  ['general', 'Datos generales', ['prod-name','prod-sku','prod-category','prod-collection','prod-description','prod-tags']],
  ['photos', 'Fotos y galería', ['prod-imageUrl','prod-images-extra','prod-color-photos']],
  ['prices', 'Precios', ['prod-price','prod-price-before']],
  ['inventory', 'Inventario y variantes', ['prod-stock','prod-inventory-fields','prod-variants-text']],
  ['specs', 'Ficha técnica', ['prod-material','prod-measurements','prod-color-finish','prod-care','prod-water-resistance','prod-warranty','prod-size-fit','prod-package-contents']],
  ['visibility', 'Visibilidad', ['prod-active','prod-oferta','prod-destacado','prod-badge']],
];
let editorWasOpen = false;
let editorOpener = null;
let installed = false;
let lastError = '';

export function compactProductUI() {
  return matchMedia('(max-width:1199px), (pointer:coarse) and (max-width:1400px)').matches;
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
      editor.querySelector('#prod-editor-section,#prod-name,button')?.focus({preventScroll:true});
    }
    if (compactProductUI()) {
      editor.setAttribute('role','dialog');
      editor.setAttribute('aria-modal','true');
      editor.setAttribute('aria-labelledby','prod-form-title');
    } else {
      editor.removeAttribute('role'); editor.removeAttribute('aria-modal'); editor.removeAttribute('aria-labelledby');
    }
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
  document.documentElement.style.setProperty('--tt-product-navigation-height', `${navigation?.getClientRects().length ? navigation.getBoundingClientRect().height : 0}px`);
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty('--tt-product-viewport-height', `${viewport?.height || innerHeight}px`);
  document.documentElement.style.setProperty('--tt-product-viewport-top', `${viewport?.offsetTop || 0}px`);
}

export function enhanceProductEditor() {
  const card = document.getElementById('prod-form-card');
  const body = card?.querySelector('.adm-card-body');
  const grid = body?.querySelector(':scope > div[style*="grid-template-columns"]');
  if (!grid) return;
  grid.classList.add('tt-product-fields');
  let navigation = body.querySelector('.tt-product-section-nav');
  if (!navigation) {
    navigation = document.createElement('label');
    navigation.className = 'tt-product-section-nav';
    navigation.htmlFor = 'prod-editor-section';
    const text = document.createElement('span');text.textContent = 'Sección del producto';
    const select = document.createElement('select');select.id = 'prod-editor-section';select.className = 'adm-input';
    for (const [value,label] of [['all','Todos los campos'],...sections.map(([id,title])=>[id,title])]) {
      const option = document.createElement('option');option.value=value;option.textContent=label;select.append(option);
    }
    select.value = 'general';
    select.addEventListener('change',()=>showSection(card,grid,select.value));
    navigation.append(text,select);body.prepend(navigation);
  }
  for (const [section,,ids] of sections) for (const id of ids) {
    let field = card.querySelector(`#${id}`);
    if (!field) continue;
    while (field.parentElement && field.parentElement !== grid) field = field.parentElement;
    if (field.parentElement === grid) field.dataset.productSection = section;
  }
  for (const control of grid.querySelectorAll('input[id],select[id],textarea[id]')) {
    if (control.type === 'hidden' || control.closest('label')) continue;
    const label=control.parentElement.querySelector(':scope > label');
    if (label) label.htmlFor=control.id;
  }
  const save = card.querySelector('#prod-save-btn');
  const footer=save?.parentElement;
  if (footer && !footer.classList.contains('tt-product-editor-actions')) {
    footer.classList.add('tt-product-editor-actions');card.append(footer);
  }
  const error=card.querySelector('#prod-form-error');
  if (error) {
    error.setAttribute('role','alert');error.setAttribute('tabindex','-1');
    if(error.nextElementSibling!==grid) body.insertBefore(error,grid);
  }
  const selected=card.querySelector('#prod-editor-section').value;
  const message=error?.style.display !== 'none' ? error?.textContent.trim() || '' : '';
  showSection(card,grid,message ? 'all' : selected);
  if(message && message!==lastError && visibleProductEditor()) {error.focus({preventScroll:true});error.scrollIntoView({block:'nearest'});}
  lastError=message;
}

function showSection(card,grid,value) {
  card.querySelector('#prod-editor-section').value=value;
  for (const field of grid.querySelectorAll(':scope > [data-product-section]')) {
    const hidden=value !== 'all' && field.dataset.productSection !== value;
    if (field.hidden !== hidden) field.hidden=hidden;
  }
}

export function installProductInterface() {
  enhanceProductEditor();syncProductSurfaces();
  if (installed) return;
  installed=true;
  let queued=false;
  const card=document.getElementById('prod-form-card');
  if (card) new MutationObserver(()=>{
    if (queued) return;
    queued=true;queueMicrotask(()=>{queued=false;enhanceProductEditor();syncProductSurfaces();});
  }).observe(card,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});
  // La navegación nativa oculta la sección sin modificar el formulario.
  const section=card?.closest('.adm-section');
  if(section) new MutationObserver(syncProductSurfaces).observe(section,{attributes:true,attributeFilter:['class','style','hidden']});
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
  window.addEventListener('resize',syncProductSurfaces,{passive:true});
  window.visualViewport?.addEventListener('resize',syncProductSurfaces,{passive:true});
  window.visualViewport?.addEventListener('scroll',syncProductSurfaces,{passive:true});
  document.addEventListener('error',event=>{
    const img=event.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('#tt-commerce-products,.tt-commerce-product-preview')) return;
    const frame=img.closest('.tt-commerce-thumb');if(!frame)return;
    const message=document.createElement('span');message.textContent='Imagen no disponible';
    frame.classList.add('tt-product-image-unavailable');frame.replaceChildren(message);
  },true);
}
