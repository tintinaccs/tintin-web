import {ensureEditorialFields} from './editor-editorial-interfaz.js?v=tintin-20261024-editor-shopify-1-editor-search-20261028-2-guiado-1269-20261029-1';
import { mountProductPreview, refreshProductPreview } from './vista-previa-producto.js?v=tintin-20261030-home-history-5';
import { installEditorControls, refreshEditorControls } from './controles-editor-producto.js?v=tintin-20261029-performance-1';
import {mountLocalVision} from './vision-productos-interfaz.js?v=tintin-20261024-editor-intuitivo-1';
import {mountProductSuggestions} from './sugerencias-producto-interfaz.js?v=tintin-20261029-performance-1';
// Presentación del editor; los campos, eventos y controladores CRUD son canónicos.
const sections = [
  ['photos', 'Fotografías del producto', ['prod-imageUrl','prod-images-extra','prod-color-photos']],
  ['general', 'Producto', ['prod-name','prod-description']],
  ['prices', 'Precio', ['prod-price','prod-price-before','prod-badge','prod-oferta']],
  ['options', 'Opciones del producto', ['prod-variants-text']],
  ['availability', 'Cantidades y disponibilidad', ['prod-stock']],
  ['specs', 'Detalles del producto', ['prod-material','prod-measurements','prod-color-finish','prod-care','prod-water-resistance','prod-warranty','prod-size-fit','prod-package-contents']],
  ['visibility', 'Organización', ['prod-category','prod-collection','prod-tags','prod-sku','prod-destacado','prod-active']],
  ['private', 'Inventario interno', ['prod-inventory-fields']],
];
const tabs = [
  ['general','Información',['general']],
  ['photos','Fotos y opciones',['photos','options']],
  ['inventory','Variantes',['associations']],
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
    editor.setAttribute('role','region');
    editor.removeAttribute('aria-modal');
    const steps=editor.querySelector('.tt-editor-step-controls'),navigation=editor.querySelector('.tt-product-section-nav'),heading=editor.querySelector('.adm-card-head');const destination=innerWidth<768 && (window.visualViewport?.height || innerHeight)>560?navigation:heading;if(steps && destination && steps.parentElement!==destination)destination.append(steps);
    const headingHeight=Math.ceil(heading?.getBoundingClientRect().height || 0);if(editor.style.getPropertyValue('--tt-editor-heading-height')!==headingHeight+'px')editor.style.setProperty('--tt-editor-heading-height',headingHeight+'px');
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
  document.documentElement.style.setProperty('--tt-product-shell-top', `${preferredTop}px`);
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
  card.classList.add('tt-editor-composer','tt-editor-studio');
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
      const paths={general:'M5 4h14M12 4v16M8 20h8',photos:'M4 4h16v16H4zM7 15l4-4 3 3 3-5 3 4M8 8h.01',inventory:'M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5',prices:'M3 3h8l10 10-8 8L3 11zM7 7h.01',specs:'M4 5h16M4 12h12M4 19h8',visibility:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18'};
      const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
      icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('width','16');icon.setAttribute('height','16');icon.setAttribute('aria-hidden','true');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.4');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');path.setAttribute('d',paths[value]);icon.append(path);button.prepend(icon);
      button.id='prod-tab-'+value;button.dataset.editorTab=value;button.setAttribute('role','tab');button.setAttribute('aria-controls','prod-panel-'+value);
      button.addEventListener('click',()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
      button.addEventListener('keydown',event=>{
        const buttons=[...shortcuts.querySelectorAll('[role=tab]')],index=buttons.indexOf(button);
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:null;
        if(next===null)return;event.preventDefault();buttons[next].click();buttons[next].focus({preventScroll:true});
      });shortcuts.append(button);
    }
    navigation.append(text,select,shortcuts);body.prepend(navigation);
    const controls=document.createElement('div');controls.className='tt-editor-step-controls';
    for(const [direction,label] of [[-1,'Anterior'],[1,'Siguiente']]){const button=document.createElement('button');button.type='button';button.className='adm-btn adm-btn-outline';button.textContent=label;button.dataset.stepDirection=direction;button.addEventListener('click',()=>{const index=tabs.findIndex(([id])=>id===tabFor(select.value));if(direction>0 && !validateStep(card,select.value))return;showSection(card,tabs[index+direction]?.[0] || select.value,true);card.querySelector('[role=tab][aria-selected=true]')?.focus({preventScroll:true});});controls.append(button);}
    const progress=document.createElement('p');progress.className='tt-editor-step-progress';progress.setAttribute('role','status');controls.prepend(progress);card.querySelector('.adm-card-head')?.append(controls);

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
      const open=section!=='private';
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
  const publicationPanel=card.querySelector('#prod-panel-visibility');
  const preview=card.querySelector('.tt-editor-preview-shell');if(preview && publicationPanel && preview.parentElement!==publicationPanel){publicationPanel.append(preview);preview.open=true;}
  const secondary=card.querySelector('.tt-work-secondary');if(secondary && publicationPanel && secondary.parentElement!==publicationPanel)publicationPanel.append(secondary);
  organizeGuidedEditor(card);
  let seo=card.querySelector('.tt-seo-preview');const publicationPanelForSeo=card.querySelector('#prod-panel-visibility');
  if(!seo && publicationPanelForSeo){seo=document.createElement('section');seo.className='tt-seo-preview';const title=document.createElement('h3');title.textContent='Vista en Google';const name=document.createElement('strong');name.className='tt-seo-title';const description=document.createElement('p');description.className='tt-seo-description';seo.append(title,name,description);publicationPanelForSeo.prepend(seo);}
  if(seo){const title=card.querySelector('#prod-seoTitle')?.value.trim() || (card.querySelector('#prod-name')?.value.trim() || 'Nombre del producto')+' | Tintin Accesorios & Relojes';const description=card.querySelector('#prod-seoDescription')?.value.trim() || card.querySelector('#prod-description')?.value.trim() || '';const titleNode=seo.querySelector('.tt-seo-title'),descriptionNode=seo.querySelector('.tt-seo-description');if(titleNode.textContent!==title)titleNode.textContent=title;if(descriptionNode.textContent!==description.slice(0,220))descriptionNode.textContent=description.slice(0,220);}
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
  if(newError && visibleProductEditor()) {const field=error.dataset.stepValidation==='true'?(card.querySelector(`[data-money-for="${error.dataset.editorField}"]`) || card.querySelector('#'+error.dataset.editorField)):error;delete error.dataset.stepValidation;field?.focus({preventScroll:true});field?.scrollIntoView({block:'nearest'});}
  lastError=message;
  refreshProductPreview(card);
  refreshStudioFrame(card,body);
  installEditorControls(card);refreshEditorControls(card);
  mountLocalVision(card);
  mountProductSuggestions(card);
}

function validateStep(card,value){
  const ids=value==='general'?['prod-name','prod-category']:value==='prices'?['prod-price']:[];
  for(const id of ids){const input=card.querySelector('#'+id);if(!input || (input.value.trim() && (id!=='prod-price' || Number(input.value)>0)))continue;
    const error=card.querySelector('#prod-form-error');error.textContent=id==='prod-price'?'Ingresá un precio de venta válido.':id==='prod-name'?'Ingresá el nombre del producto.':'Elegí una colección.';error.style.display='';error.dataset.editorField=id;error.dataset.stepValidation='true';input.setAttribute('aria-invalid','true');const target=card.querySelector(`[data-money-for="${id}"]`) || input;target.focus();return false;
  }return true;
}
function organizeGuidedEditor(card){
  const options=card.querySelector('.tt-editor-variant-builder'),photos=card.querySelector('#prod-panel-photos');
  if(options && photos && !photos.contains(options)){const group=card.querySelector('[data-product-section=options]');if(group)photos.append(group);}
  const variants=card.querySelector('#prod-panel-inventory');
  if(variants && !variants.querySelector('.tt-variant-media-list')){const list=document.createElement('div');list.className='tt-variant-media-list';variants.append(list);}
  const variantsText=card.querySelector('#prod-variants-text')?.value || '';
  for(const [id,pattern] of [['prod-material',/^material\s*:/im],['prod-color-finish',/^colou?r\s*:/im],['prod-size-fit',/^(talle|talla|tama[ñn]o|ajuste)\s*:/im]]){const input=card.querySelector('#'+id);if(input){const hidden=pattern.test(variantsText) && !input.value.trim();if(input.parentElement.hidden!==hidden)input.parentElement.hidden=hidden;}}
  const privateFields=card.querySelector('#prod-inventory-fields');
  if(privateFields && !privateFields.querySelector('.tt-private-history')){
    const history=document.createElement('details');history.className='tt-private-history';const summary=document.createElement('summary');summary.textContent='Registros internos anteriores';history.append(summary);
    for(const id of ['prod-purchased','prod-stock-minimum','prod-internal-notes']){const input=card.querySelector('#'+id),field=input?.parentElement;if(field)history.append(field);}
    privateFields.append(history);const heading=privateFields.querySelector(':scope > div:not(:has(input))');if(heading)heading.hidden=true;
  }
  const history=privateFields?.querySelector('.tt-private-history');
  if(history){let records=history.querySelector('.tt-private-history-records');if(!records){records=document.createElement('dl');records.className='tt-private-history-records';history.prepend(records);}const values=[];for(const [id,label] of [['prod-purchased','Comprado (registro anterior)'],['prod-stock-minimum','Mínimo (registro anterior)']]){const input=card.querySelector('#'+id);if(input){if(!input.readOnly)input.readOnly=true;if(!input.parentElement.hidden)input.parentElement.hidden=true;if(input.value!=='')values.push([label,input.value]);}}const signature=JSON.stringify(values);if(records.dataset.values!==signature){records.dataset.values=signature;records.replaceChildren(...values.flatMap(([label,value])=>{const title=document.createElement('dt'),text=document.createElement('dd');title.textContent=label;text.textContent=value;return [title,text];}));}}
  for(const id of ['prod-price-before','prod-badge','prod-oferta']){const input=card.querySelector('#'+id);if(!input)continue;const section=card.querySelector('[data-product-section=prices] .tt-editor-section-fields');let advanced=section?.querySelector('.tt-price-advanced');if(!advanced && section){advanced=document.createElement('details');advanced.className='tt-price-advanced';const summary=document.createElement('summary');summary.textContent='Descuento y etiqueta';advanced.append(summary);section.append(advanced);}const field=input.closest('.tt-editor-money')?.parentElement || input.parentElement;if(advanced && field!==advanced && !advanced.contains(field))advanced.append(field);}
}

function refreshStudioFrame(card,body) {
  const head=card.querySelector('.adm-card-head');
  if(!head)return;
  let breadcrumb=head.querySelector('.tt-studio-breadcrumb');
  if(!breadcrumb){
    breadcrumb=document.createElement('div');breadcrumb.className='tt-studio-breadcrumb';
    const back=document.createElement('button');back.type='button';back.textContent='Productos';
    back.addEventListener('click',()=>{const cancel=card.querySelector('.tt-work-back');if(cancel)cancel.click();else window.prodCancelForm?.();});
    const name=document.createElement('span');breadcrumb.append(back,document.createTextNode(' › '),name);head.prepend(breadcrumb);
    const subtitle=document.createElement('p');subtitle.className='tt-studio-subtitle';subtitle.textContent='Editá cada detalle, sin salir de tu producto.';card.querySelector('.tt-product-editor-heading')?.append(subtitle);
    const preview=document.createElement('button');preview.type='button';preview.className='adm-btn adm-btn-outline tt-studio-preview';preview.textContent='Vista previa';
    preview.addEventListener('click',()=>{showSection(card,'visibility',true);const panel=body.querySelector('.tt-editor-preview-shell');if(panel){panel.open=true;panel.scrollIntoView({block:'nearest',behavior:'instant'});panel.querySelector('summary')?.focus({preventScroll:true});}});
    card.querySelector('.tt-product-primary-actions')?.prepend(preview);
  }
  // Cancelar conserva el guard del workspace, dentro de la misma fila de
  // acciones; no reserva otra fila ni se superpone a la ruta del producto.
  const actions=card.querySelector('.tt-product-primary-actions'),back=card.querySelector('.tt-work-back');
  if(back && actions && back.parentElement!==actions)actions.insertBefore(back,card.querySelector('#prod-save-btn'));
  const name=card.querySelector('#prod-name')?.value.trim() || 'Nuevo producto';
  if(breadcrumb.lastElementChild.textContent!==name)breadcrumb.lastElementChild.textContent=name;
  let footer=body.querySelector('.tt-studio-pagination');
  if(!footer){
    footer=document.createElement('nav');footer.className='tt-studio-pagination';footer.setAttribute('aria-label','Pasos del editor');
    const previous=document.createElement('button'),next=document.createElement('button'),position=document.createElement('span');
    for(const button of [previous,next]){button.type='button';button.className='adm-btn adm-btn-outline';}
    previous.textContent='← Anterior';previous.dataset.studioDirection='-1';next.dataset.studioDirection='1';position.setAttribute('aria-live','polite');
    for(const button of [previous,next])button.addEventListener('click',()=>{const index=tabs.findIndex(([id])=>id===card.querySelector('#prod-editor-section').value);if(button===next && index===tabs.length-1){card.querySelector('#prod-save-btn')?.click();return;}card.querySelector(`[data-step-direction="${button.dataset.studioDirection}"]`)?.click();});
    footer.append(previous,position,next);body.querySelector('.tt-editor-layout').after(footer);
  }
  const index=Math.max(0,tabs.findIndex(([id])=>id===card.querySelector('#prod-editor-section').value));
  const save=card.querySelector('#prod-save-btn');
  const busy=card.getAttribute('aria-busy')==='true' || Boolean(save?.disabled);
  if(footer.firstElementChild.disabled!==(index===0 || busy))footer.firstElementChild.disabled=index===0 || busy;
  if(footer.lastElementChild.disabled!==busy)footer.lastElementChild.disabled=busy;
  const label=`${tabs[index][1]} · ${index+1} de ${tabs.length}`;
  if(footer.children[1].textContent!==label)footer.children[1].textContent=label;
  const next=index<tabs.length-1?'Continuar a '+tabs[index+1][1]+' →':save?.textContent || 'Guardar cambios';
  if(footer.lastElementChild.textContent!==next)footer.lastElementChild.textContent=next;
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
  const validation=card.querySelector('#prod-form-error');
  let id=validation?.dataset.stepValidation==='true'?validation.dataset.editorField:null;
  if(!id || !document.getElementById(id)){
    if(/obligatorios/i.test(message))id=!read('prod-name')?'prod-name':!read('prod-category')?'prod-category':'prod-price';
    else if(/nombre/i.test(message))id='prod-name';
    else if(/descripción/i.test(message))id='prod-description';
    else if(/foto|imagen|carga/i.test(message))id='prod-imageUrl';
    else if(/costo|comprada|mínimo|notas internas/i.test(message))id='prod-cost-unit';
    else if(/precio anterior/i.test(message))id='prod-price-before';
    else if(/stock|inventario|cantidad/i.test(message))id='prod-stock';
    else if(/colección/i.test(message) && !/obligatorios/i.test(message))id='prod-category';
    else if(/precio/i.test(message) && !/obligatorios/i.test(message))id='prod-price';
    else if(/variante|combinaci[oó]n|grupo|atributo|opci[oó]n.*quitar|quitar.*opci[oó]n/i.test(message))id='prod-variants-text';
    else if(/obligatorios/i.test(message))id=!read('prod-name')?'prod-name':!read('prod-category')?'prod-category':'prod-price';
  }
  if(id==='prod-stock'){
    const invalid=[...card.querySelectorAll('#prod-variant-stock input[type=number]')].find(input=>!input.validity.valid);
    if(invalid){const target=invalid.closest('.tt-editor-money')?.querySelector('[data-money-for]') || invalid;if(!target.id)target.id='prod-combination-error-'+crypto.randomUUID();id=target.id;}
  }
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
  const select=card.querySelector('#prod-editor-section'),layout=card.querySelector('.tt-editor-layout');
  if(!select || !layout)return; // La superficie también puede abrirse antes de montar los campos.
  if(select.value!==value)select.value=value;
  if(layout.dataset.editorSection!==value)layout.dataset.editorSection=value;
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
  const index=tabs.findIndex(([id])=>id===value);
  const progress=card.querySelector('.tt-editor-step-progress');const text=`Paso ${index+1} de ${tabs.length} · ${tabs[index][1]}`;if(progress && progress.textContent!==text)progress.textContent=text;
  for(const button of card.querySelectorAll('[data-step-direction]'))button.disabled=Number(button.dataset.stepDirection)<0?index===0:index===tabs.length-1;
  if(expand){card.dataset.visitedSteps=[...new Set([...(card.dataset.visitedSteps || '').split(','),value])].filter(Boolean).join(',');window.TintinPageScroll?.reset(card);card.querySelector('.adm-card-body')?.scrollTo({top:0,behavior:'instant'});}
}

export function installProductInterface() {
  enhanceProductEditor();syncProductSurfaces();
  if (installed) return;
  installed=true;
  let queued=false;
  const card=document.getElementById('prod-form-card');
  card?.addEventListener('keydown',event=>{if((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='s'){event.preventDefault();card.querySelector('#prod-save-btn:not(:disabled)')?.click();}});
  card?.addEventListener('click',event=>{if(event.target.closest('#prod-save-btn'))lastError='';},{capture:true});
  card?.addEventListener('input',event=>{refreshEditorHeading(card);const error=card.querySelector('#prod-form-error');if(error?.dataset.editorField===event.target.id){error.textContent='';error.style.display='none';lastError='';}if(event.target.getAttribute('aria-invalid')==='true'){event.target.removeAttribute('aria-invalid');event.target.removeAttribute('aria-describedby');}});
  card?.addEventListener('change',()=>refreshEditorHeading(card));
  if (card) new MutationObserver(records=>{
    // Texto derivado del formulario no exige volver a montar sus controles.
    if(records.every(record=>record.target.closest?.('.tt-product-editor-heading,.tt-editor-section-value,.tt-editor-preview,.tt-seo-preview,.tt-studio-breadcrumb,.tt-work-feedback')))return;
    if (queued) return;
    queued=true;queueMicrotask(()=>{queued=false;enhanceProductEditor();scheduleProductSurfaceSync();});
  }).observe(card,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden','aria-busy']});
  const save=card?.querySelector('#prod-save-btn');
  if(save)new MutationObserver(()=>refreshStudioFrame(card,card.querySelector('.adm-card-body'))).observe(save,{attributes:true,attributeFilter:['disabled']});
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
