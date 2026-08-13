import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, getDocs, limit, query } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260716-cloudinary-fix-1';
import {
  CONTENT_PAGE_IDS, SITE_CONTENT_SCHEMA, getNested, getPageDefaults, getPageSchema,
  mergeContent, sanitizeContentHref, setNested,
} from '../../core/store/esquema-contenido.js?v=tintin-20260810-visual-studio-v2-3';
import { chooseRandomPreviewProduct, productPreviewTarget } from './preview-dynamic-targets.js?v=tintin-20260812-preview-dinamico-1';

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const TOP_ANCHOR = '__top__';
const DEVICES = ['desktop', 'tablet', 'mobile'];
const DEVICE_LABELS = { desktop: 'Escritorio', tablet: 'Tablet', mobile: 'Celular' };
const BLOCK_LABELS = {
  banner: 'Banner', text: 'Texto', products: 'Productos', gallery: 'Galería', promotion: 'Promoción', button: 'Botón',
  section: 'Sección libre', collections: 'Colecciones', testimonial: 'Testimonio', video: 'Video', faq: 'Preguntas frecuentes',
  columns: 'Imagen + texto', divider: 'Separador', spacer: 'Espacio', marquee: 'Texto en movimiento', features: 'Beneficios', countdown: 'Cuenta regresiva',
};
const LIBRARY = [
  ['banner','Hero / banner','Imagen, título, texto y llamada a la acción.','editorial','▣'],
  ['promotion','Promoción destacada','Bloque fuerte para lanzamientos y ofertas.','spotlight','✦'],
  ['text','Texto editorial','Título y contenido con mucho aire visual.','minimal','T'],
  ['products','Productos','Productos reales del catálogo en grid o carrusel.','cards','▦'],
  ['collections','Colecciones','Colecciones reales como tarjetas.','cards','◇'],
  ['gallery','Galería','Grid, mosaico o carrusel de imágenes.','mosaic','▧'],
  ['columns','Imagen + texto','Composición dividida con imagen y CTA.','split','◫'],
  ['video','Video','YouTube, Vimeo o Cloudinary con embed seguro.','default','▶'],
  ['testimonial','Testimonio','Reseña con nombre y foto opcional.','glass','“'],
  ['features','Beneficios','Tarjetas para ventajas, servicios o pasos.','cards','✓'],
  ['faq','Preguntas frecuentes','Acordeón editable de preguntas y respuestas.','default','?'],
  ['countdown','Cuenta regresiva','Contador para campaña, lanzamiento o cierre.','spotlight','◷'],
  ['marquee','Marquee','Frase animada horizontal estilo campaña.','bar','↔'],
  ['button','Botón / CTA','Llamada a la acción independiente.','minimal','↗'],
  ['section','Sección libre segura','Texto, imagen y botón con diseño flexible.','default','＋'],
  ['divider','Separador','Línea de separación entre contenidos.','minimal','—'],
  ['spacer','Espaciador','Control de espacio entre secciones.','minimal','↕'],
].map(([type,label,desc,variant,icon]) => ({ type,label,desc,variant,icon }));

let pageId = 'index';
let config = null;
let content = null;
let version = 0;
let contentRevision = '';
let history = [];
let selected = null;
let undoStack = [];
let redoStack = [];
let dirty = false;
let initialized = false;
let busyState = false;
let editDevice = 'desktop';
let inspectorTab = 'content';
let libraryOpen = false;
let draggedEntry = null;
let sectionListNode = null;
let previewProductsPromise = null;
let previewProductSample = null;

const responsiveDefaults = () => ({ visibility:'inherit', spacing:'inherit', width:'inherit', align:'inherit', columns:'inherit', imageFit:'inherit' });
const defaultStyle = () => ({
  background:'', textColor:'', accentColor:'', spacing:'normal', width:'contained', align:'center', radius:'none', shadow:'none',
  animation:'none', variant:'default', imageFit:'cover', responsive:Object.fromEntries(DEVICES.map(device => [device, responsiveDefaults()])),
});
function normalizeStyle(raw = {}) {
  const style = { ...defaultStyle(), ...(raw || {}) };
  style.responsive = Object.fromEntries(DEVICES.map(device => [device, { ...responsiveDefaults(), ...(raw?.responsive?.[device] || {}) }]));
  return style;
}
function make(tag, className = '', text = '') {
  const node = document.createElement(tag); if (className) node.className = className; if (text !== '') node.textContent = text; return node;
}
function setStatus(message, kind = '') {
  const node = $('visual-status'); if (!node) return; node.textContent = message; node.className = `visual-editor-status${kind ? ` is-${kind}` : ''}`;
}
function reorderableSectionIds(id = pageId) { return Object.entries(getPageSchema(id)?.sections || {}).filter(([,schema]) => !schema.global).map(([sectionId]) => sectionId); }
function pinnedSectionIds(id = pageId) { return Object.entries(getPageSchema(id)?.sections || {}).filter(([,schema]) => schema.global).map(([sectionId]) => sectionId); }
function defaultConfig(id) {
  return { pageId:id, sections:Object.fromEntries(Object.keys(getPageSchema(id)?.sections || {}).map(sectionId => [sectionId, defaultStyle()])), sectionOrder:reorderableSectionIds(id), customBlocks:[] };
}
function normalizedConfig(raw) {
  const base = defaultConfig(pageId);
  Object.keys(base.sections).forEach(id => { base.sections[id] = normalizeStyle(raw?.sections?.[id]); });
  const allowed = reorderableSectionIds(); const seen = new Set();
  base.sectionOrder = (Array.isArray(raw?.sectionOrder) ? raw.sectionOrder : []).filter(id => allowed.includes(id) && !seen.has(id) && seen.add(id));
  allowed.forEach(id => { if (!seen.has(id)) base.sectionOrder.push(id); });
  base.customBlocks = (Array.isArray(raw?.customBlocks) ? raw.customBlocks : []).map(block => ({ ...block, style:normalizeStyle(block?.style), items:Array.isArray(block?.items) ? block.items : [], images:Array.isArray(block?.images) ? block.images : [] }));
  return base;
}

async function api(method = 'GET', body) {
  const user = auth.currentUser;
  if (!user || String(user.email || '').trim().toLowerCase() !== SUPER_ADMIN) throw new Error('Acceso exclusivo de Super Admin.');
  const token = await user.getIdToken();
  const response = await fetch(method === 'GET' ? `/api/visual-builder?page=${encodeURIComponent(pageId)}` : '/api/visual-builder', {
    method, headers:{ authorization:`Bearer ${token}`, ...(body ? {'content-type':'application/json'} : {}) }, body:body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la operación.'), { code:data.code, status:response.status });
  return data;
}

function snapshot() { return clone({ config,content,selected }); }
function pushUndo(entry) { undoStack.push(entry); if (undoStack.length > 60) undoStack.shift(); }
function remember() { pushUndo(snapshot()); redoStack = []; }
function changed(message = 'Tenés cambios sin publicar.') { dirty = true; setStatus(message); updateActions(); postPreview(); }
function mutate(callback, options = {}) { remember(); callback(); changed(options.message); renderSectionList(); if (options.properties !== false) renderProperties(); }
function restoreSnapshot(value) { config=clone(value.config); content=clone(value.content); selected=clone(value.selected); dirty=true; renderAll(); setStatus('Cambio restaurado en el borrador.'); }
function updateActions() {
  if ($('visual-undo')) $('visual-undo').disabled = busyState || !undoStack.length;
  if ($('visual-redo')) $('visual-redo').disabled = busyState || !redoStack.length;
  ['visual-save','visual-cancel','visual-publish'].forEach(id => { if ($(id)) $(id).disabled = busyState || !dirty; });
  ['visual-add','visual-page','visual-library-open'].forEach(id => { if ($(id)) $(id).disabled = busyState; });
}
function busy(value) { busyState=value; updateActions(); if (value) setStatus('Procesando de forma segura…'); }

function ensureStudioUi() {
  const editor = $('visual-editor'); if (!editor || editor.dataset.studioReady === '1') return;
  editor.dataset.studioReady='1'; editor.classList.add('visual-studio-v2'); sectionListNode=$('visual-section-list');
  if (!document.getElementById('visual-studio-v2-css')) {
    const link=document.createElement('link'); link.id='visual-studio-v2-css'; link.rel='stylesheet'; link.href='css/admin/visual-studio-v2.css?v=tintin-20260812-preview-arriba-real-producto-1'; document.head.appendChild(link);
  }
  const pageLabel=editor.querySelector('label[for="visual-page"]'); pageLabel?.classList.add('visual-studio-hidden'); $('visual-page')?.classList.add('visual-studio-hidden');
  const sidebar=editor.querySelector('.visual-editor-sidebar');
  const brand=make('div','visual-studio-brand'); brand.append(make('strong','','Tintin'),make('span','','Constructor visual'));
  const tree=make('div','visual-page-tree'); tree.id='visual-page-tree'; sidebar.prepend(tree); sidebar.prepend(brand);
  const addRow=editor.querySelector('.visual-add-row'); $('visual-new-block')?.classList.add('visual-studio-hidden'); $('visual-add')?.classList.add('visual-studio-hidden');
  if (addRow) { const open=make('button','visual-library-open','+ Agregar sección'); open.type='button'; open.id='visual-library-open'; open.addEventListener('click',()=>toggleLibrary(true)); addRow.appendChild(open); }
  const properties=editor.querySelector('.visual-editor-properties');
  if (properties) {
    const heading=properties.querySelector('h3'); if (heading) heading.id='visual-inspector-heading';
    const tabs=make('div','visual-inspector-tabs'); tabs.id='visual-inspector-tabs';
    [['content','Contenido'],['design','Diseño'],['responsive','Responsive'],['advanced','Avanzado']].forEach(([id,label]) => { const button=make('button','',label); button.type='button'; button.dataset.inspectorTab=id; button.addEventListener('click',()=>{inspectorTab=id;renderProperties();}); tabs.appendChild(button); });
    properties.insertBefore(tabs,$('visual-properties'));
  }
  const devices=editor.querySelector('.visual-devices'); if (devices) { const badge=make('span','visual-device-edit-badge','Editando Escritorio'); badge.id='visual-device-edit-badge'; devices.prepend(badge); }
  const overlay=make('div','visual-library-overlay'); overlay.id='visual-library-overlay'; overlay.hidden=true;
  const panel=make('section','visual-library-panel'); const head=make('div','visual-library-head'); const title=make('div'); title.append(make('small','','Biblioteca de secciones'),make('h3','','¿Qué querés agregar?'));
  const close=make('button','visual-library-close','×'); close.type='button'; close.setAttribute('aria-label','Cerrar biblioteca'); close.addEventListener('click',()=>toggleLibrary(false)); head.append(title,close);
  const search=document.createElement('input'); search.type='search'; search.className='adm-input visual-library-search'; search.placeholder='Buscar banner, productos, galería, contador…'; search.id='visual-library-search'; search.addEventListener('input',renderLibrary);
  const grid=make('div','visual-library-grid'); grid.id='visual-library-grid'; panel.append(head,search,grid); overlay.appendChild(panel); editor.appendChild(overlay); overlay.addEventListener('click',event=>{if(event.target===overlay)toggleLibrary(false);});
  editor.addEventListener('dragstart',handleDragStart); editor.addEventListener('dragover',handleDragOver); editor.addEventListener('drop',handleDrop);
  editor.addEventListener('dragend',()=>{draggedEntry=null;document.querySelectorAll('.visual-drag-over,.is-dragging').forEach(node=>node.classList.remove('visual-drag-over','is-dragging'));});
}
function toggleLibrary(open) { libraryOpen=Boolean(open); const overlay=$('visual-library-overlay'); if(!overlay)return; overlay.hidden=!libraryOpen; if(libraryOpen){renderLibrary();setTimeout(()=>$('visual-library-search')?.focus(),20);} }
function renderLibrary() {
  const grid=$('visual-library-grid'); if(!grid)return; const query=String($('visual-library-search')?.value||'').trim().toLowerCase(); grid.replaceChildren();
  LIBRARY.filter(item=>!query||`${item.label} ${item.desc} ${item.type}`.toLowerCase().includes(query)).forEach(preset=>{const button=make('button','visual-library-card');button.type='button';button.append(make('span','visual-library-icon',preset.icon),make('strong','',preset.label),make('small','',preset.desc));button.addEventListener('click',()=>{addBlockFromPreset(preset);toggleLibrary(false);});grid.appendChild(button);});
}

function renderPages() {
  const select=$('visual-page'); if(select){select.replaceChildren();CONTENT_PAGE_IDS.forEach(id=>{const option=make('option','',(getPageSchema(id)?.label || id));option.value=id;select.appendChild(option);});select.value=pageId;}
  const tree=$('visual-page-tree'); if(!tree)return; const list=sectionListNode;
  tree.replaceChildren();
  CONTENT_PAGE_IDS.forEach(id=>{const group=make('div',`visual-page-group${id===pageId?' active':''}`);const button=make('button','visual-page-button');button.type='button';button.append(make('span','visual-page-chevron',id===pageId?'⌄':'›'),make('span','',(getPageSchema(id)?.label || id)));button.addEventListener('click',()=>{if(id!==pageId)switchPage(id);});group.appendChild(button);if(id===pageId){const slot=make('div','visual-page-sections-slot');slot.id='visual-page-sections-slot';group.appendChild(slot);}tree.appendChild(group);});
  const slot=$('visual-page-sections-slot'); if(slot&&list)slot.appendChild(list);
}
function renderBlockTypeOptions(){const select=$('visual-new-block');if(!select||select.childElementCount)return;Object.entries(BLOCK_LABELS).forEach(([type,label])=>{const option=make('option','',label);option.value=type;select.appendChild(option);});}
function visualOrderList(){const list=[];const blocks=config?.customBlocks||[];blocks.filter(block=>block.afterSection===TOP_ANCHOR).forEach(block=>list.push({kind:'block',id:block.id}));(config?.sectionOrder||[]).forEach(sectionId=>{list.push({kind:'section',id:sectionId});blocks.filter(block=>block.afterSection===sectionId).forEach(block=>list.push({kind:'block',id:block.id}));});pinnedSectionIds().forEach(id=>{list.push({kind:'section',id,pinned:true});blocks.filter(block=>block.afterSection===id).forEach(block=>list.push({kind:'block',id:block.id}));});return list;}
function renderSectionList(){const root=sectionListNode;if(!root)return;root.replaceChildren();visualOrderList().forEach(entry=>{const row=make('div',`visual-section-item${entry.pinned?' pinned':''}`);row.dataset.kind=entry.kind;row.dataset.id=entry.id;row.draggable=!entry.pinned;row.appendChild(make('span','visual-drag-handle',entry.pinned?'●':'⋮⋮'));if(entry.kind==='section'){const schema=getPageSchema(pageId).sections[entry.id];const button=make('button',`visual-section-select${selected?.kind==='section'&&selected.id===entry.id?' active':''}`);button.type='button';button.dataset.selectKind='section';button.dataset.selectId=entry.id;button.append(make('span','visual-section-title',schema.label),make('small','visual-section-badge',entry.pinned?'Global':'Sección'));row.appendChild(button);}else{const block=config.customBlocks.find(item=>item.id===entry.id);if(!block)return;const button=make('button',`visual-section-select${selected?.kind==='block'&&selected.id===block.id?' active':''}`);button.type='button';button.dataset.selectKind='block';button.dataset.selectId=block.id;button.append(make('span','visual-section-title',block.label||block.title||BLOCK_LABELS[block.type]||'Bloque'),make('small','visual-section-badge',BLOCK_LABELS[block.type]||block.type));row.appendChild(button);}root.appendChild(row);});}

function handleDragStart(event){const row=event.target.closest('.visual-section-item[draggable="true"]');if(!row)return;draggedEntry={kind:row.dataset.kind,id:row.dataset.id};row.classList.add('is-dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',`${draggedEntry.kind}:${draggedEntry.id}`);}
function handleDragOver(event){if(!draggedEntry)return;const row=event.target.closest('.visual-section-item');if(!row||row.classList.contains('pinned'))return;event.preventDefault();document.querySelectorAll('.visual-drag-over').forEach(node=>node.classList.remove('visual-drag-over'));row.classList.add('visual-drag-over');}
function handleDrop(event){if(!draggedEntry||!sectionListNode)return;const target=event.target.closest('.visual-section-item');const source=[...sectionListNode.children].find(row=>row.dataset.kind===draggedEntry.kind&&row.dataset.id===draggedEntry.id);if(!target||!source||target===source||target.classList.contains('pinned'))return;event.preventDefault();const after=event.clientY>target.getBoundingClientRect().top+target.getBoundingClientRect().height/2;if(after)target.after(source);else target.before(source);mutate(applyOrderFromDom,{properties:false,message:'Orden actualizado. Tenés cambios sin publicar.'});}
function applyOrderFromDom(){const rows=[...sectionListNode.querySelectorAll('.visual-section-item')];config.sectionOrder=rows.filter(row=>row.dataset.kind==='section'&&!getPageSchema(pageId).sections[row.dataset.id]?.global).map(row=>row.dataset.id);if(draggedEntry?.kind!=='block')return;const blockMap=new Map(config.customBlocks.map(block=>[block.id,block]));const newBlocks=[];let anchor=TOP_ANCHOR;rows.forEach(row=>{if(row.dataset.kind==='section'){anchor=row.dataset.id;return;}const block=blockMap.get(row.dataset.id);if(block){block.afterSection=anchor;newBlocks.push(block);blockMap.delete(block.id);}});config.customBlocks=[...newBlocks,...blockMap.values()];}

function field(label,control,full=false,help=''){const wrap=make('div',`visual-property${full?' full':''}`);const lab=make('label','',label);if(control.id)lab.htmlFor=control.id;wrap.append(lab,control);if(help)wrap.appendChild(make('small','visual-field-help',help));return wrap;}
function inputControl(value,onChange,options={}){const node=options.multiline?document.createElement('textarea'):document.createElement('input');node.className='adm-input';node.value=value??'';node.maxLength=options.max||1200;if(!options.multiline)node.type=options.type||'text';node.addEventListener(options.live===false?'change':'input',()=>mutate(()=>onChange(node.value),{properties:false}));return node;}
function selectControl(value,values,onChange){const node=make('select','adm-select');values.forEach(([key,label])=>{const option=make('option','',label);option.value=key;node.appendChild(option);});node.value=value;node.addEventListener('change',()=>mutate(()=>onChange(node.value),{properties:false}));return node;}
function colorControl(style,key){const row=make('div','visual-color-row');const picker=document.createElement('input');picker.type='color';picker.value=/^#[0-9a-f]{6}$/i.test(style[key])?style[key]:'#ffffff';const text=document.createElement('input');text.className='adm-input';text.value=style[key]||'';text.placeholder='Color original';const reset=make('button','adm-btn adm-btn-outline adm-btn-sm visual-reset-color','↺');reset.type='button';picker.addEventListener('input',()=>mutate(()=>{style[key]=picker.value;},{properties:false}));text.addEventListener('change',()=>{const value=text.value.trim();if(value&&!/^#[0-9a-f]{6}$/i.test(value)){setStatus('Usá un color hexadecimal completo, por ejemplo #fbe4ec.','error');text.value=style[key]||'';return;}mutate(()=>{style[key]=value.toLowerCase();},{properties:false});});reset.addEventListener('click',()=>mutate(()=>{style[key]='';}));row.append(picker,text,reset);return row;}
function selectionExists(value=selected){if(!value||!config)return false;if(value.kind==='section')return Boolean(getPageSchema(pageId)?.sections?.[value.id]&&config.sections?.[value.id]);if(value.kind==='block')return config.customBlocks?.some(item=>item.id===value.id)===true;return false;}
function fallbackSelection(){const id=config?.sectionOrder?.find(sectionId=>getPageSchema(pageId)?.sections?.[sectionId])||pinnedSectionIds().find(sectionId=>config?.sections?.[sectionId]);return id?{kind:'section',id}:null;}
function ensureValidSelection(){if(!selectionExists())selected=fallbackSelection();return Boolean(selected);}
function styleForSelected(){if(!selectionExists())return null;if(selected.kind==='section')return config.sections?.[selected.id]||null;return config.customBlocks?.find(item=>item.id===selected.id)?.style||null;}
function selectedBlock(){return selectionExists()&&selected.kind==='block'?config.customBlocks.find(item=>item.id===selected.id):null;}
function selectedSchema(){return selectionExists()&&selected.kind==='section'?getPageSchema(pageId)?.sections?.[selected.id]||null:null;}
function selectedLabel(){if(!selected)return'Propiedades';if(selected.kind==='section')return selectedSchema()?.label||'Sección';const block=selectedBlock();return block?.label||block?.title||BLOCK_LABELS[block?.type]||'Bloque';}
function effectiveFields(schema){const seen=new Map();(schema?.fields||[]).forEach(item=>seen.set(`${item.selector}:${item.index??0}:${item.type==='href'?'href':'text'}`,item));return[...seen.values()];}

function renderContentProperties(root){
  if(selected.kind==='section'){const schema=selectedSchema();if(!schema){root.appendChild(make('div','visual-empty','La sección seleccionada ya no existe. Elegí otra sección.'));return;}const values=content?.[selected.id]||(content[selected.id]={});const grid=make('div','visual-property-grid');if(schema.allowVisibility){const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=values.visible!==false;checkbox.addEventListener('change',()=>mutate(()=>{values.visible=checkbox.checked;},{properties:false}));grid.appendChild(field('Mostrar sección',checkbox,true));}effectiveFields(schema).forEach(item=>{const current=getNested(values,item.key)??item.default??'';const control=inputControl(current,value=>{const safe=item.type==='href'?sanitizeContentHref(value,item.default||''):String(value).slice(0,item.maxLength);setNested(values,item.key,safe);},{multiline:item.type==='multiline',type:item.type==='href'?'url':'text',max:item.maxLength});grid.appendChild(field(item.label,control,true,item.help));});root.appendChild(grid);return;}
  const block=selectedBlock();if(!block)return;const grid=make('div','visual-property-grid');
  if(!['divider','spacer'].includes(block.type))grid.appendChild(field('Nombre interno',inputControl(block.label||'',value=>{block.label=value;},{max:80}),true,'Solo sirve para reconocer el bloque dentro del editor.'));
  if(!['divider','spacer','marquee'].includes(block.type)){const labels=block.type==='testimonial'?{eyebrow:'Dato breve',title:'Nombre',text:'Testimonio'}:{eyebrow:'Texto pequeño',title:'Título',text:'Descripción'};grid.append(field(labels.eyebrow,inputControl(block.eyebrow,value=>{block.eyebrow=value;},{max:80}),true),field(labels.title,inputControl(block.title,value=>{block.title=value;},{max:180}),true),field(labels.text,inputControl(block.text,value=>{block.text=value;},{multiline:true,max:1200}),true));}
  if(block.type==='marquee')grid.appendChild(field('Frase',inputControl(block.title,value=>{block.title=value;},{max:180}),true));
  if(['banner','text','promotion','button','section','columns'].includes(block.type))grid.append(field('Texto del botón',inputControl(block.buttonLabel,value=>{block.buttonLabel=value;},{max:80}),true),field('Destino del botón',inputControl(block.href,value=>{block.href=value;},{type:'url',max:500}),true));
  if(['banner','section','columns'].includes(block.type))grid.append(field('Imagen',inputControl(block.image,value=>{block.image=value;},{type:'url',max:1000}),true,'Usá una imagen de Cloudinary o de la biblioteca.'),field('Texto alternativo',inputControl(block.imageAlt,value=>{block.imageAlt=value;},{max:140}),true));
  if(block.type==='testimonial')grid.appendChild(field('Foto (opcional)',inputControl(block.image,value=>{block.image=value;},{type:'url',max:1000}),true));
  if(block.type==='columns')grid.appendChild(field('Imagen a la',selectControl(block.imageSide,[['left','Izquierda'],['right','Derecha']],value=>{block.imageSide=value;})));
  if(block.type==='video')grid.appendChild(field('Video embed',inputControl(block.videoUrl,value=>{block.videoUrl=value;},{type:'url',max:500}),true,'Acepta YouTube, Vimeo o Cloudinary.'));
  if(['products','collections'].includes(block.type)){const count=document.createElement('input');count.className='adm-input';count.type='number';count.min='1';count.max='12';count.value=block.count||4;count.addEventListener('change',()=>mutate(()=>{block.count=Math.max(1,Math.min(12,Number(count.value)||4));},{properties:false}));grid.appendChild(field('Cantidad',count));if(block.type==='products')grid.appendChild(field('Colección / categoría',inputControl(block.category,value=>{block.category=value;},{max:120}),true,'Vacío muestra productos generales.'));const quick=make('div','visual-quick-links');[['productos','Gestionar productos'],['colecciones','Gestionar colecciones']].forEach(([section,label])=>{const button=make('button','adm-btn adm-btn-outline adm-btn-sm',label);button.type='button';button.addEventListener('click',()=>openAdminSection(section));quick.appendChild(button);});grid.appendChild(field('Catálogo real',quick,true));}
  if(block.type==='gallery'){const images=inputControl((block.images||[]).map(item=>`${item.src}|${item.alt||''}`).join('\n'),value=>{block.images=value.split('\n').slice(0,12).map(line=>{const[src,...alt]=line.split('|');return{src:src.trim(),alt:alt.join('|').trim()};}).filter(item=>item.src);},{multiline:true,max:12000});grid.appendChild(field('Imágenes',images,true,'Una URL por línea; opcionalmente URL | descripción.'));}
  if(['faq','features'].includes(block.type)){const items=inputControl((block.items||[]).map(item=>`${item.q||''}|${item.a||''}`).join('\n'),value=>{block.items=value.split('\n').slice(0,block.type==='faq'?16:12).map(line=>{const[q,...a]=line.split('|');return{q:q.trim(),a:a.join('|').trim()};}).filter(item=>item.q||item.a);},{multiline:true,max:16000});grid.appendChild(field(block.type==='faq'?'Preguntas y respuestas':'Tarjetas',items,true,block.type==='faq'?'Pregunta | Respuesta':'Título | Texto'));}
  if(block.type==='countdown'){const input=document.createElement('input');input.type='datetime-local';input.className='adm-input';if(block.endAt){const date=new Date(block.endAt);if(Number.isFinite(date.getTime()))input.value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}input.addEventListener('change',()=>mutate(()=>{const date=new Date(input.value);block.endAt=Number.isFinite(date.getTime())?date.toISOString():'';},{properties:false}));grid.append(field('Finaliza',input,true),field('Texto al finalizar',inputControl(block.expiredText||'Finalizado',value=>{block.expiredText=value;},{max:120}),true));}
  if(block.type==='marquee')grid.appendChild(field('Velocidad',selectControl(block.marqueeSpeed||'normal',[['slow','Lenta'],['normal','Normal'],['fast','Rápida']],value=>{block.marqueeSpeed=value;})));
  if(block.type==='spacer')grid.appendChild(field('Tamaño',selectControl(block.spacerSize||'medium',[['small','Pequeño'],['medium','Medio'],['large','Grande'],['xlarge','Extra grande']],value=>{block.spacerSize=value;})));
  root.appendChild(grid);
}
function appendStyleFields(grid,style){grid.append(field('Fondo',colorControl(style,'background'),true),field('Texto',colorControl(style,'textColor'),true),field('Acento y botones',colorControl(style,'accentColor'),true),field('Composición',selectControl(style.variant,[['default','Original'],['minimal','Minimal'],['editorial','Editorial'],['cards','Tarjetas'],['carousel','Carrusel'],['mosaic','Mosaico'],['split','Dividido'],['spotlight','Destacado'],['glass','Cristal'],['outline','Contorno'],['bar','Barra']],value=>{style.variant=value;})),field('Espacio',selectControl(style.spacing,[['flush','Sin espacio'],['compact','Compacto'],['normal','Normal'],['roomy','Amplio'],['dramatic','Dramático']],value=>{style.spacing=value;})),field('Ancho',selectControl(style.width,[['narrow','Estrecho'],['contained','Contenido'],['wide','Ancho'],['full','Pantalla completa']],value=>{style.width=value;})),field('Alineación',selectControl(style.align,[['left','Izquierda'],['center','Centro'],['right','Derecha']],value=>{style.align=value;})),field('Bordes',selectControl(style.radius,[['none','Sin redondeo'],['small','Suave'],['medium','Medio'],['large','Grande'],['pill','Píldora']],value=>{style.radius=value;})),field('Sombra',selectControl(style.shadow,[['none','Sin sombra'],['soft','Suave'],['medium','Marcada'],['large','Grande'],['floating','Flotante']],value=>{style.shadow=value;})),field('Imagen',selectControl(style.imageFit,[['cover','Rellenar'],['contain','Mostrar completa']],value=>{style.imageFit=value;})),field('Animación',selectControl(style.animation,[['none','Sin animación'],['fade','Aparecer'],['slide-up','Subir'],['slide-down','Bajar'],['slide-left','Desde derecha'],['slide-right','Desde izquierda'],['scale','Zoom suave'],['pop','Rebote suave'],['reveal','Revelar']],value=>{style.animation=value;})));}
function renderDesignProperties(root){const style=styleForSelected();if(!style)return;const grid=make('div','visual-property-grid');appendStyleFields(grid,style);root.appendChild(grid);root.appendChild(make('p','visual-property-help','Estos controles guardan configuración segura del componente; no escriben CSS o HTML libre.'));}
function renderResponsiveProperties(root){const style=styleForSelected();if(!style)return;const override=style.responsive[editDevice]||(style.responsive[editDevice]=responsiveDefaults());const intro=make('div','visual-responsive-intro');intro.append(make('strong','',`Editando ${DEVICE_LABELS[editDevice]}`),make('span','','“Heredar” usa el diseño general.'));root.appendChild(intro);const grid=make('div','visual-property-grid');grid.append(field('Visibilidad',selectControl(override.visibility,[['inherit','Heredar'],['show','Mostrar'],['hide','Ocultar']],value=>{override.visibility=value;})),field('Espacio',selectControl(override.spacing,[['inherit','Heredar'],['flush','Sin espacio'],['compact','Compacto'],['normal','Normal'],['roomy','Amplio'],['dramatic','Dramático']],value=>{override.spacing=value;})),field('Ancho',selectControl(override.width,[['inherit','Heredar'],['narrow','Estrecho'],['contained','Contenido'],['wide','Ancho'],['full','Pantalla completa']],value=>{override.width=value;})),field('Alineación',selectControl(override.align,[['inherit','Heredar'],['left','Izquierda'],['center','Centro'],['right','Derecha']],value=>{override.align=value;})),field('Columnas',selectControl(String(override.columns),[['inherit','Heredar'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6']],value=>{override.columns=value;})),field('Imagen',selectControl(override.imageFit,[['inherit','Heredar'],['cover','Rellenar'],['contain','Mostrar completa']],value=>{override.imageFit=value;})));root.appendChild(grid);const reset=make('button','adm-btn adm-btn-outline adm-btn-sm visual-responsive-reset','Restablecer este dispositivo');reset.type='button';reset.addEventListener('click',()=>mutate(()=>{style.responsive[editDevice]=responsiveDefaults();}));root.appendChild(reset);}
function reorderButtonsForSection(root,sectionId){const schema=getPageSchema(pageId).sections[sectionId];if(schema.global){root.appendChild(make('p','visual-property-help','Esta sección es global y permanece anclada al final.'));return;}const zone=make('div','visual-action-grid');const order=config.sectionOrder;const index=order.indexOf(sectionId);const last=order.length-1;[['Al principio',0],['Subir',index-1],['Bajar',index+1],['Al final',last]].forEach(([label,target])=>{const button=make('button','adm-btn adm-btn-outline adm-btn-sm',label);button.type='button';button.disabled=index<0||target<0||target>last||target===index;button.addEventListener('click',()=>mutate(()=>{const[item]=order.splice(index,1);order.splice(target,0,item);}));zone.appendChild(button);});root.appendChild(zone);}
function renderAdvancedProperties(root){if(selected.kind==='section'){reorderButtonsForSection(root,selected.id);return;}const block=selectedBlock();if(!block)return;const sections=getPageSchema(pageId).sections;const options=[[TOP_ANCHOR,'Arriba de todo'],...[...config.sectionOrder,...pinnedSectionIds()].map(id=>[id,`Debajo de ${sections[id].label}`])];const grid=make('div','visual-property-grid');grid.appendChild(field('Ubicación',selectControl(block.afterSection,options,value=>{block.afterSection=value;}),true));root.appendChild(grid);const actions=make('div','visual-action-grid');const duplicate=make('button','adm-btn adm-btn-outline adm-btn-sm','Duplicar');duplicate.type='button';duplicate.addEventListener('click',()=>duplicateBlock(block.id));actions.appendChild(duplicate);const index=config.customBlocks.findIndex(item=>item.id===block.id);const last=config.customBlocks.length-1;[['Al principio',0],['Subir',index-1],['Bajar',index+1],['Al final',last]].forEach(([label,target])=>{const button=make('button','adm-btn adm-btn-outline adm-btn-sm',label);button.type='button';button.disabled=target<0||target>last||target===index;button.addEventListener('click',()=>mutate(()=>{const[item]=config.customBlocks.splice(index,1);config.customBlocks.splice(target,0,item);}));actions.appendChild(button);});const remove=make('button','adm-btn adm-btn-danger adm-btn-sm','Quitar bloque');remove.type='button';remove.addEventListener('click',()=>removeBlock(block.id));actions.appendChild(remove);root.appendChild(actions);}
function renderProperties(){const root=$('visual-properties');if(!root)return;root.replaceChildren();ensureValidSelection();const heading=$('visual-inspector-heading');if(heading)heading.textContent=selectedLabel();document.querySelectorAll('[data-inspector-tab]').forEach(button=>button.classList.toggle('active',button.dataset.inspectorTab===inspectorTab));if(!selected){root.appendChild(make('div','visual-empty','Elegí una sección o tocá un elemento en la vista previa.'));return;}if(inspectorTab==='content')renderContentProperties(root);else if(inspectorTab==='design')renderDesignProperties(root);else if(inspectorTab==='responsive')renderResponsiveProperties(root);else renderAdvancedProperties(root);}

function renderHistory(){const root=$('visual-history-list');if(!root)return;root.replaceChildren();if(!history.length){root.appendChild(make('div','visual-empty','Todavía no hay versiones publicadas.'));return;}history.forEach(item=>{const row=make('div','visual-history-item');const info=make('div');info.append(make('strong','',`Versión ${item.version} · ${item.action==='restore'?'restauración':'publicación'}`),make('small','',`${item.actorEmail||''} · ${new Date(item.createdAt).toLocaleString('es-PY')}`));row.appendChild(info);if(['publish','restore'].includes(item.action)&&item.version>0){const button=make('button','adm-btn adm-btn-outline adm-btn-sm','Restaurar');button.type='button';button.dataset.restore=item.id;row.appendChild(button);}root.appendChild(row);});}
function postPreview(){const frame=$('visual-preview-frame');if(!frame?.contentWindow||!config||!content)return;frame.contentWindow.postMessage({type:'tintin:visual-preview',pageId,config,content,selected},location.origin);}
function renderPreviewVersion(){const node=$('visual-version');if(!node)return;const sample=pageId==='product'&&previewProductSample?` · Muestra: ${String(previewProductSample.name||previewProductSample.title||'Producto')}`:'';node.textContent=`Versión publicada: ${version}${sample}`;}
async function loadPreviewProducts(){
  if (!previewProductsPromise) {
    previewProductsPromise=getDocs(query(collection(db,'products'),limit(250)))
      .then(snapshot=>snapshot.docs.map(item=>({id:item.id,...item.data()})))
      .catch(error=>{previewProductsPromise=null;throw error;});
  }
  return previewProductsPromise;
}
async function previewTarget(){
  const basePath=getPageSchema(pageId)?.path||'index.html';
  if(pageId!=='product')return basePath;
  if(!previewProductSample)previewProductSample=chooseRandomPreviewProduct(await loadPreviewProducts(),()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);
  if(!previewProductSample)throw new Error('No hay productos disponibles para generar la vista previa.');
  return productPreviewTarget(basePath,previewProductSample);
}
async function loadPreview(){
  const frame=$('visual-preview-frame');
  try{
    const target=await previewTarget();
    const separator=target.includes('?')?'&':'?';
    frame.src=`${target}${separator}ttVisualPreview=1`;
    renderPreviewVersion();
    frame.onload=()=>{postPreview();setTimeout(postPreview,300);setTimeout(postPreview,1200);};
  }catch(error){
    frame.removeAttribute('src');
    setStatus(error.message||'No se pudo preparar la vista previa dinámica.','error');
    throw error;
  }
}
function renderDeviceState(){if($('visual-preview-stage'))$('visual-preview-stage').dataset.device=editDevice;document.querySelectorAll('[data-visual-device]').forEach(button=>{const active=button.dataset.visualDevice===editDevice;button.setAttribute('aria-pressed',String(active));button.classList.toggle('active',active);});if($('visual-device-edit-badge'))$('visual-device-edit-badge').textContent=`Editando ${DEVICE_LABELS[editDevice]}`;}
function renderAll(){ensureStudioUi();renderPages();renderBlockTypeOptions();renderSectionList();renderProperties();renderHistory();renderDeviceState();renderPreviewVersion();updateActions();postPreview();}
async function loadPage(){busy(true);try{const data=await api();version=Number(data.state?.version||0);contentRevision=String(data.contentRevision||'');history=data.history||[];config=normalizedConfig(data.draft?.config||data.state?.config||{});content=mergeContent(getPageDefaults(pageId),clone(data.draft?.content||data.content||getPageDefaults(pageId)));selected={kind:'section',id:config.sectionOrder[0]||Object.keys(getPageSchema(pageId).sections)[0]};undoStack=[];redoStack=[];dirty=Boolean(data.draft);renderAll();await loadPreview();if(data.draft&&(Number(data.draft.basedOnVersion)!==version||String(data.draft.basedOnContentRevision||'')!==contentRevision))setStatus('Este borrador parte de una versión anterior. Revisalo antes de publicar.','error');else setStatus(data.draft?'Borrador recuperado. Nada está publicado todavía.':'Página lista para editar.','saved');}catch(error){setStatus(error.message,'error');}finally{busy(false);}}

function baseBlock(type,preset={}){const ids=Object.keys(getPageSchema(pageId).sections);const anchor=selected?.kind==='section'?selected.id:(selectedBlock()?.afterSection||ids[0]||TOP_ANCHOR);const titles={products:'Productos destacados',collections:'Explorá nuestras colecciones',gallery:'Galería',features:'Todo pensado para vos',countdown:'No te lo pierdas',marquee:'TINTÍN · NUEVO · TINTÍN · NUEVO',testimonial:'Lo que dicen nuestras clientas'};return{id:`${type}-${crypto.randomUUID().slice(0,8)}`,type,label:preset.label||BLOCK_LABELS[type]||'Nueva sección',afterSection:anchor,eyebrow:'TINTÍN',title:titles[type]||'Nueva sección',text:'',buttonLabel:['banner','promotion','button','section','columns'].includes(type)?'Ver más':'',href:'catalogo.html',image:'',imageAlt:'',count:4,category:'',videoUrl:'',imageSide:'left',images:[],items:[],endAt:'',expiredText:'Finalizado',marqueeSpeed:'normal',spacerSize:'medium',style:{...defaultStyle(),variant:preset.variant||'default'}};}
function addBlockFromPreset(preset){const block=baseBlock(preset.type,preset);if(preset.type==='features')block.items=[{q:'Compra fácil',a:'Elegí tus favoritos desde la web.'},{q:'Atención personalizada',a:'Estamos para ayudarte.'},{q:'Envíos',a:'Opciones de entrega para tu zona.'}];if(preset.type==='faq')block.items=[{q:'¿Cómo comprar?',a:'Elegí tus productos, agregalos al carrito y completá el checkout.'}];if(preset.type==='countdown')block.endAt=new Date(Date.now()+86400000).toISOString();mutate(()=>{config.customBlocks.push(block);selected={kind:'block',id:block.id};inspectorTab='content';},{message:'Sección agregada al borrador.'});}
function addBlock(){const type=$('visual-new-block')?.value||'section';addBlockFromPreset({type,label:BLOCK_LABELS[type],variant:'default'});}
function duplicateBlock(id){const source=config.customBlocks.find(item=>item.id===id);if(!source)return;mutate(()=>{const copy=clone(source);copy.id=`${copy.type}-${crypto.randomUUID().slice(0,8)}`;copy.label=`${copy.label||copy.title||BLOCK_LABELS[copy.type]} copia`;config.customBlocks.splice(config.customBlocks.indexOf(source)+1,0,copy);selected={kind:'block',id:copy.id};},{message:'Bloque duplicado.'});}
function removeBlock(id){if(!confirm('¿Quitar este bloque del borrador?'))return;mutate(()=>{config.customBlocks=config.customBlocks.filter(item=>item.id!==id);selected={kind:'section',id:config.sectionOrder[0]||Object.keys(getPageSchema(pageId).sections)[0]};},{message:'Bloque quitado del borrador.'});}
function localReview(){const warnings=[];config.customBlocks.forEach(block=>{if(['banner','promotion','button','section','columns'].includes(block.type)&&block.buttonLabel&&!block.href)warnings.push(`${block.label||block.title}: botón sin destino.`);if(block.type==='video'&&!block.videoUrl)warnings.push(`${block.label||block.title}: video sin URL.`);if(block.type==='countdown'&&!block.endAt)warnings.push(`${block.label||block.title}: contador sin fecha.`);if(block.type==='gallery'&&!(block.images||[]).length)warnings.push(`${block.label||block.title}: galería sin imágenes.`);});return warnings;}
async function saveDraft(){busy(true);try{await api('POST',{action:'save',pageId,config,content});dirty=false;setStatus('Borrador guardado. La tienda pública no cambió.','saved');return true;}catch(error){setStatus(error.message,'error');return false;}finally{busy(false);}}
async function publish(){const warnings=localReview();const summary=`${Object.keys(config.sections).length} secciones existentes y ${config.customBlocks.length} bloques adicionales en ${getPageSchema(pageId).label}.`;const warningText=warnings.length?`\n\nAntes de publicar, revisá:\n- ${warnings.join('\n- ')}`:'';if(!confirm(`Se publicará una versión nueva.\n\n${summary}${warningText}\n\n¿Confirmás?`))return;busy(true);try{const data=await api('POST',{action:'publish',pageId,config,content,expectedVersion:version,expectedContentRevision:contentRevision});version=data.version;dirty=false;undoStack=[];redoStack=[];setStatus(`Versión ${version} publicada correctamente.`,'saved');await loadPage();}catch(error){setStatus(error.message,'error');}finally{busy(false);}}
async function cancel(){if(dirty&&!confirm('¿Descartar el borrador y volver a la última versión publicada?'))return;busy(true);try{await api('POST',{action:'cancel',pageId});await loadPage();setStatus('Borrador cancelado. La versión publicada no cambió.','saved');}catch(error){setStatus(error.message,'error');}finally{busy(false);}}
async function restore(historyId){if(!confirm('La versión elegida se publicará como una versión nueva. ¿Restaurar?'))return;busy(true);try{await api('POST',{action:'restore',pageId,historyId,expectedVersion:version,expectedContentRevision:contentRevision});await loadPage();setStatus('Versión restaurada correctamente.','saved');}catch(error){setStatus(error.message,'error');}finally{busy(false);}}
async function switchPage(nextPage){if(nextPage===pageId)return;if(dirty){if(!confirm('Hay cambios sin publicar. Se guardarán como borrador antes de cambiar de página. ¿Continuar?'))return;if(!await saveDraft())return;}pageId=nextPage;if($('visual-page'))$('visual-page').value=pageId;await loadPage();}
function openAdminSection(section){const nav=document.querySelector(`.adm-nav-item[data-section="${section}"]`);if(!nav)return;if(dirty&&!confirm('Tenés cambios sin publicar en Apariencia. ¿Salir igualmente?'))return;nav.click();}

function bind(){
  sectionListNode.addEventListener('click',event=>{const button=event.target.closest('[data-select-kind]');if(!button)return;selected={kind:button.dataset.selectKind,id:button.dataset.selectId};renderSectionList();renderProperties();postPreview();});
  $('visual-add')?.addEventListener('click',addBlock);$('visual-page')?.addEventListener('change',event=>switchPage(event.target.value));$('visual-save').addEventListener('click',saveDraft);$('visual-publish').addEventListener('click',publish);$('visual-cancel').addEventListener('click',cancel);
  $('visual-undo').addEventListener('click',()=>{if(!undoStack.length)return;redoStack.push(snapshot());restoreSnapshot(undoStack.pop());});$('visual-redo').addEventListener('click',()=>{if(!redoStack.length)return;pushUndo(snapshot());restoreSnapshot(redoStack.pop());});
  document.querySelectorAll('[data-visual-device]').forEach(button=>button.addEventListener('click',()=>{editDevice=button.dataset.visualDevice;renderDeviceState();if(inspectorTab==='responsive')renderProperties();postPreview();}));
  $('visual-history-list').addEventListener('click',event=>{const button=event.target.closest('[data-restore]');if(button)restore(button.dataset.restore);});
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==$('visual-preview-frame')?.contentWindow||event.data?.type!=='tintin:visual-select'||event.data.pageId!==pageId)return;const{kind,id}=event.data;const next={kind,id};if(!selectionExists(next))return;selected=next;renderSectionList();renderProperties();postPreview();});
  window.addEventListener('keydown',event=>{const mod=event.ctrlKey||event.metaKey;if(event.key==='Escape'&&libraryOpen){event.preventDefault();toggleLibrary(false);return;}if(!mod)return;const key=event.key.toLowerCase();if(key==='s'){event.preventDefault();saveDraft();}else if(key==='z'&&!event.shiftKey&&undoStack.length){event.preventDefault();redoStack.push(snapshot());restoreSnapshot(undoStack.pop());}else if((key==='y'||(key==='z'&&event.shiftKey))&&redoStack.length){event.preventDefault();pushUndo(snapshot());restoreSnapshot(redoStack.pop());}else if(key==='d'&&selected?.kind==='block'){event.preventDefault();duplicateBlock(selected.id);}});
  window.addEventListener('beforeunload',event=>{if(!dirty)return;event.preventDefault();event.returnValue='';});window.AdminUnsaved?.register?.('visual-builder',{hasChanges:()=>dirty,message:'CAMBIOS SIN PUBLICAR en el editor visual.'});
}

onAuthStateChanged(auth,user=>{const allowed=String(user?.email||'').trim().toLowerCase()===SUPER_ADMIN;$('visual-editor').hidden=!allowed;if(!allowed||initialized)return;initialized=true;ensureStudioUi();bind();loadPage();});
